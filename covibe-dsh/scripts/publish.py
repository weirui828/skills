#!/usr/bin/env python3
"""publish.py - build and publish a covibe page for the DSH port.

The agent authors two things:

    <page-dir>/page.html          the page, with the covibe markers:
                                    <style>/*covibe:css*/</style>
                                    <script>/*covibe:js*/</script>
                                  and elements carrying data-covibe-id="<stable id>"
    <page-dir>/.covibe/state.json the covibe/2 state (threads, handled, trash, versions)

publish.py inlines the comment layer, injects the config + state, validates the
data rules that can be checked mechanically, and atomically replaces
<page-dir>/publish/index.html - the file the covibe server serves at the stable URL.

Usage
  python3 publish.py --dir PAGE_DIR [--page page.html] [--state .covibe/state.json]
                     [--summary "r4 - shortened the intro"] [--port 8787]
                     [--transport auto|post|manual|none] [--mode live|batch|manual]
                     [--batch-n 5] [--token SECRET] [--mark-delivery immediate|defer]
                     [--strict] [--dry-run]

Exit codes: 0 ok, 1 validation error, 2 usage/I-O error.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import tempfile
from datetime import datetime, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.normpath(os.path.join(HERE, "..", "assets"))
STATE_SCHEMA = "covibe/2"
ID_ATTR = "data-covibe-id"


# --------------------------------------------------------------------------- #
# helpers
# --------------------------------------------------------------------------- #
def die(code: int, message: str) -> "NoReturn":  # noqa: F821
    sys.stderr.write("publish.py: %s\n" % message)
    raise SystemExit(code)


def read_text(path: str) -> str:
    try:
        with open(path, "r", encoding="utf-8") as fh:
            return fh.read()
    except OSError as exc:
        die(2, "cannot read %s: %s" % (path, exc))


def read_json(path: str, default=None):
    if not os.path.exists(path):
        return default
    try:
        with open(path, "r", encoding="utf-8") as fh:
            return json.load(fh)
    except (OSError, json.JSONDecodeError) as exc:
        die(1, "invalid JSON in %s: %s" % (path, exc))


def write_atomic(path: str, text: str) -> None:
    directory = os.path.dirname(path)
    os.makedirs(directory, exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix=".covibe-tmp-", dir=directory)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            fh.write(text)
        os.replace(tmp, path)
    except BaseException:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise


def json_for_script(value) -> str:
    """JSON that is safe inside an inline <script> element."""
    text = json.dumps(value, ensure_ascii=False)
    return text.replace("</", "<\\/").replace("\u2028", "\\u2028").replace("\u2029", "\\u2029")


def replace_marker(html: str, marker: str, body: str) -> tuple:
    """Replace /*marker*/ (and an optional .../*marker:end*/ block) once."""
    pattern = re.compile(r"/\*%s\*/(?:.*?/\*%s:end\*/)?" % (re.escape(marker), re.escape(marker)), re.S)
    block = "/*%s*/\n%s\n/*%s:end*/" % (marker, body, marker)
    return pattern.subn(lambda _m: block, html, count=1)


def inline_assets(html: str) -> str:
    css = read_text(os.path.join(ASSETS, "comment-layer.css"))
    js = read_text(os.path.join(ASSETS, "comment-layer.js"))
    html, n_css = replace_marker(html, "covibe:css", css)
    html, n_js = replace_marker(html, "covibe:js", js)
    if not (n_css and n_js):
        die(1, "page.html needs <style>/*covibe:css*/</style> and <script>/*covibe:js*/</script>")
    return html


def inject_config(html: str, config: dict) -> str:
    """Put the delivery config where it wins: right before the layer script.

    A source page may carry its own placeholder window.COVIBE (the template
    does), so an injected config in <head> would be overwritten. Inserting
    immediately before the inlined layer keeps the published page authoritative.
    """
    script = "<script>\n/* covibe config injected by publish.py */\nwindow.COVIBE = %s;\n</script>" % json_for_script(config)
    html, n = replace_marker(html, "covibe:config", script)
    if n:
        return html
    marker = html.find("/*covibe:js*/")
    if marker == -1:  # inline_assets already failed loudly; defensive only
        return script + "\n" + html
    tag = html.rfind("<script", 0, marker)
    if tag == -1:
        return script + "\n" + html
    return html[:tag] + script + "\n" + html[tag:]


MOUNT_RE = re.compile(r"Covibe\s*\.\s*mount\s*\(")


def has_mount_call(html: str) -> bool:
    """True when a script element (not prose, not the inlined layer) mounts.

    Comment text and state strings may legally contain the substring
    "Covibe.mount(", so only script bodies are searched, with comments removed.
    """
    for body in re.findall(r"<script\b[^>]*>(.*?)</script>", html, flags=re.S | re.I):
        body = re.sub(r"/\*.*?\*/", "", body, flags=re.S)
        body = re.sub(r"<!--.*?-->", "", body, flags=re.S)
        if MOUNT_RE.search(body):
            return True
    return False


def inject_mount(html: str) -> str:
    """Add the mount call unless the source page already makes one."""
    if has_mount_call(html):
        return html
    mount = "<script>Covibe.mount({ root: document.getElementById(\"covibe-root\") || document.body });</script>"
    if "</body>" in html:
        return html.replace("</body>", "%s\n</body>" % mount, 1)
    return html + "\n" + mount


# --------------------------------------------------------------------------- #
# validation
# --------------------------------------------------------------------------- #
def element_ids(html: str) -> list:
    return re.findall(r'%s\s*=\s*"([^"]+)"' % ID_ATTR, html) + re.findall(r"%s\s*=\s*'([^']+)'" % ID_ATTR, html)


def validate(state: dict, html: str, previous_ids, trash_ids: set, strict: bool) -> list:
    warnings = []

    def problem(msg: str) -> None:
        if strict:
            die(1, msg)
        warnings.append(msg)

    if not state.get("session"):
        die(1, "state.session is required (a stable id for this page's review)")
    schema = str(state.get("schema") or STATE_SCHEMA)
    if schema != STATE_SCHEMA:
        warnings.append("state.schema is %r, expected %r" % (schema, STATE_SCHEMA))
    if "revision" not in state:
        warnings.append("state.revision missing; the version log will show r0")
    if not isinstance(state.get("threads", {}), dict):
        die(1, "state.threads must be an object: {elementId: [entries]}")
    if not isinstance(state.get("handled", []), list):
        die(1, "state.handled must be an array of comment ids")
    if not isinstance(state.get("versions", []), list):
        die(1, "state.versions must be an array of {revision, summary}")

    ids = element_ids(html)
    seen, duplicates = set(), []
    for element_id in ids:
        if element_id in seen and element_id not in duplicates:
            duplicates.append(element_id)
        seen.add(element_id)
    if duplicates:
        problem("duplicate %s values (ids must be unique): %s" % (ID_ATTR, ", ".join(duplicates)))

    threads = state.get("threads") or {}
    for element_id in threads:
        if element_id not in seen and element_id not in trash_ids:
            problem("state.threads has a thread for %r, but no element with that id is in the page "
                    "(moved to trash? then add it to state.trash)" % element_id)
    for element_id in state.get("trash") or []:
        if isinstance(element_id, dict) and element_id.get("id") and element_id["id"] in seen:
            warnings.append("trashed id %r is still present in the page" % element_id["id"])

    entries = [entry for thread in threads.values() if isinstance(thread, list) for entry in thread]
    missing_id = [entry for entry in entries if not (isinstance(entry, dict) and entry.get("id"))]
    if missing_id:
        die(1, "%d thread entries have no comment id" % len(missing_id))
    comment_ids = [entry["id"] for entry in entries]
    if len(comment_ids) != len(set(comment_ids)):
        warnings.append("the same comment id appears in more than one thread entry")

    handled = set(state.get("handled") or [])
    unanswered = [entry["id"] for entry in entries if entry.get("who") == "user" and entry["id"] not in handled]
    if unanswered:
        warnings.append("%d user comment(s) are in threads but not in state.handled: %s"
                        % (len(unanswered), ", ".join(unanswered[:8])))

    if previous_ids is not None:
        removed = [element_id for element_id in previous_ids if element_id not in seen]
        if removed:
            problem("these ids were published before and are gone from the page (ids must not change; "
                    "move the element to state.trash instead): %s" % ", ".join(removed[:8]))
    return warnings


# --------------------------------------------------------------------------- #
# main
# --------------------------------------------------------------------------- #
def main(argv=None) -> int:
    parser = argparse.ArgumentParser(prog="publish.py", description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--dir", required=True, help="page dir (contains publish/ and .covibe/)")
    parser.add_argument("--page", default=None, help="page source (default: <dir>/page.html)")
    parser.add_argument("--state", default=None, help="state file (default: <dir>/.covibe/state.json)")
    parser.add_argument("--summary", default="", help="version-log line for this revision")
    parser.add_argument("--port", type=int, default=8787, help="port of the covibe server")
    parser.add_argument("--transport", choices=["auto", "post", "manual", "none"], default="auto")
    parser.add_argument("--mode", choices=["live", "batch", "manual"], default=None)
    parser.add_argument("--batch-n", type=int, default=None)
    parser.add_argument("--token", default=os.environ.get("COVIBE_TOKEN", ""))
    parser.add_argument("--mark-delivery", choices=["immediate", "defer"], default=None,
                        help="quick marks without text: 'immediate' (default) posts them like a "
                             "comment; 'defer' keeps covibe 1.1 behaviour (send with the next text comment)")
    parser.add_argument("--update-mode", choices=["hotswap", "banner", "off"], default=None,
                        help="how the open page picks up a new revision: 'hotswap' (default) updates "
                             "in place, 'banner' offers a Reload button, 'off' stops polling")
    parser.add_argument("--strict", action="store_true", help="treat data-rule warnings as errors")
    parser.add_argument("--dry-run", action="store_true", help="validate only, publish nothing")
    args = parser.parse_args(argv)

    page_dir = os.path.abspath(args.dir)
    page_path = args.page or os.path.join(page_dir, "page.html")
    state_path = args.state or os.path.join(page_dir, ".covibe", "state.json")
    publish_dir = os.path.join(page_dir, "publish")
    meta_path = os.path.join(page_dir, ".covibe", "page.json")
    ids_path = os.path.join(page_dir, ".covibe", "ids.json")

    if not os.path.isfile(page_path):
        die(2, "no page source at %s (write page.html first, or pass --page)" % page_path)
    state = read_json(state_path)
    if state is None:
        die(2, "no state at %s (write the covibe/2 state first, or pass --state)" % state_path)

    # version bump + version log line (the state file stays the source of truth)
    revision = int(state.get("revision") or 0)
    if args.summary or not state.get("versions"):
        revision = revision + 1 if state.get("versions") else max(1, revision)
        state["revision"] = revision
        if args.summary:
            versions = state.setdefault("versions", [])
            versions.append({"revision": revision, "summary": args.summary})
    else:
        state["revision"] = revision

    transport = args.transport
    mode = args.mode or state.get("mode") or "live"
    if transport == "auto":
        transport = "manual" if mode == "manual" else "post"
    if transport == "post" and not args.port:
        die(2, "transport post needs --port")

    html = read_text(page_path)
    trash_ids = {item["id"] for item in (state.get("trash") or [])
                 if isinstance(item, dict) and item.get("id")}
    previous = read_json(ids_path)
    warnings = validate(state, html, previous, trash_ids, args.strict)

    html = inline_assets(html)
    config = {
        "state": state,
        "transport": transport,
        "endpoint": "http://127.0.0.1:%d/cv/comments" % args.port if transport == "post" else "",
        "token": args.token if transport == "post" else "",
        "mode": mode,
        "batchN": int(args.batch_n or state.get("batchSize") or 5),
        "markDelivery": args.mark_delivery or state.get("markDelivery") or "immediate",
        "updateMode": args.update_mode or state.get("updateMode") or "hotswap",
        "pageId": state.get("pageId") or state.get("session"),
        "pageVersion": revision,
        "lang": state.get("lang") or "en",
    }
    html = inject_mount(html)  # before config: the config may embed arbitrary state text
    html = inject_config(html, config)

    url = "http://127.0.0.1:%d/" % args.port
    if args.dry_run:
        print(json.dumps({"ok": True, "dryRun": True, "revision": revision,
                          "transport": transport, "warnings": warnings}, ensure_ascii=False, indent=2))
        return 0

    write_atomic(os.path.join(publish_dir, "index.html"), html)
    write_atomic(ids_path, json.dumps(sorted(set(element_ids(html))), indent=1))
    write_atomic(meta_path, json.dumps({
        "pageId": config["pageId"],
        "session": state.get("session"),
        "revision": revision,
        "mode": mode,
        "batchN": config["batchN"],
        "transport": transport,
        "port": args.port,
        "publishedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "bytes": len(html.encode("utf-8")),
    }, ensure_ascii=False, indent=2))
    # keep the bumped revision/version log in the state the agent edits
    write_atomic(state_path, json.dumps(state, ensure_ascii=False, indent=2))

    for warning in warnings:
        print("WARN: %s" % warning, file=sys.stderr)
    print(json.dumps({
        "ok": True,
        "url": url,
        "revision": revision,
        "transport": transport,
        "mode": mode,
        "published": os.path.join(publish_dir, "index.html"),
        "warnings": len(warnings),
    }, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
