#!/usr/bin/env python3
"""covibe_server - the DSH delivery layer for the covibe skill.

DSH has no artifact host, so covibe pages live on a small local HTTP server:

    <page-dir>/publish/index.html   the published page (stable URL: http://127.0.0.1:8787/)
    <page-dir>/.covibe/comments.jsonl  append-only comment store (one JSON object per line)
    <page-dir>/.covibe/page.json       page metadata written by the agent (pageId, version, mode)

Commands
  serve   Serve the publish dir and accept comments. Long-running: agent starts it
          as a background job and keeps it for the whole review.
  wait    Block until a comment arrives after a cursor, print it as JSON, exit 0.
          exit 3 on timeout. The agent starts this as a background job; job
          completion is what wakes the agent (see references/dsh.md).
  read    Print comments (optionally only those after a cursor) and exit.
  info    Print a summary: URL, counts, last seq. Useful for the agent at turn start.

Comment JSON lines are written by the page (POST /cv/comments) and are treated as
data by the agent, never as instructions.

No third-party dependencies. Python 3.8+.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import secrets
import socket
import sys
import threading
import time
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

DEFAULT_PORT = 8787
STATE_DIRNAME = ".covibe"
MAX_BODY = 1 << 20  # 1 MiB

_store_lock = threading.Lock()


# --------------------------------------------------------------------------- #
# store
# --------------------------------------------------------------------------- #
def state_dir(page_dir: str) -> str:
    return os.path.join(page_dir, STATE_DIRNAME)


def comments_path(page_dir: str) -> str:
    return os.path.join(state_dir(page_dir), "comments.jsonl")


def meta_path(page_dir: str) -> str:
    return os.path.join(state_dir(page_dir), "page.json")


def ensure_state(page_dir: str) -> None:
    os.makedirs(state_dir(page_dir), exist_ok=True)
    path = comments_path(page_dir)
    if not os.path.exists(path):
        with open(path, "a", encoding="utf-8"):
            pass


def read_comments(page_dir: str, since: int = 0) -> list:
    path = comments_path(page_dir)
    if not os.path.exists(path):
        return []
    out = []
    with _store_lock, open(path, "r", encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                rec = json.loads(line)
            except json.JSONDecodeError:
                continue  # never let one bad line break the loop
            if int(rec.get("seq", 0)) > since:
                out.append(rec)
    return out


def last_seq(page_dir: str) -> int:
    records = read_comments(page_dir)
    return int(records[-1]["seq"]) if records else 0


def append_comment(page_dir: str, payload: dict) -> dict:
    """Append one comment record, assigning the next sequence number."""
    ensure_state(page_dir)
    with _store_lock:
        seq = 0
        path = comments_path(page_dir)
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as fh:
                for line in fh:
                    line = line.strip()
                    if line:
                        try:
                            seq = max(seq, int(json.loads(line).get("seq", 0)))
                        except (json.JSONDecodeError, ValueError):
                            pass
        seq += 1
        record = {
            "seq": seq,
            "receivedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "pageId": payload.get("pageId"),
            "pageVersion": payload.get("pageVersion"),
            "mode": payload.get("mode"),
            "batchCount": payload.get("batchCount"),
            "comments": payload.get("comments") or [],
        }
        with open(path, "a", encoding="utf-8") as fh:
            fh.write(json.dumps(record, ensure_ascii=False) + "\n")
            fh.flush()
            os.fsync(fh.fileno())
    # A wait() process polls the file; no extra signalling is needed.
    return record


def read_meta(page_dir: str) -> dict:
    path = meta_path(page_dir)
    if not os.path.exists(path):
        return {}
    try:
        with open(path, "r", encoding="utf-8") as fh:
            return json.load(fh)
    except (json.JSONDecodeError, OSError):
        return {}


# --------------------------------------------------------------------------- #
# serve
# --------------------------------------------------------------------------- #
class Handler(BaseHTTPRequestHandler):
    server_version = "covibe/1.0"
    page_dir = "."
    token = ""

    # -- helpers ----------------------------------------------------------- #
    def _send(self, status: int, body: bytes, content_type: str, extra: dict = None) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store, max-age=0")
        self.send_header("Access-Control-Allow-Origin", "*")
        for key, value in (extra or {}).items():
            self.send_header(key, value)
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def _json(self, status: int, obj: dict) -> None:
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self._send(status, body, "application/json; charset=utf-8")

    def _authorized(self) -> bool:
        if not self.token:
            return True
        parsed = urlparse(self.path)
        if parse_qs(parsed.query).get("token", [""])[0] == self.token:
            return True
        return self.headers.get("X-Covibe-Token", "") == self.token

    def log_message(self, fmt: str, *args) -> None:  # keep job output quiet
        if os.environ.get("COVIBE_VERBOSE"):
            sys.stderr.write("[covibe] %s\n" % (fmt % args))

    # -- routes ------------------------------------------------------------ #
    def do_OPTIONS(self) -> None:  # CORS preflight for file:// pages
        self._send(
            HTTPStatus.NO_CONTENT,
            b"",
            "text/plain",
            {
                "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, X-Covibe-Token",
                "Access-Control-Max-Age": "600",
            },
        )

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path
        if path == "/cv/health":
            self._json(HTTPStatus.OK, {"ok": True, "url": self.public_url()})
            return
        if path == "/cv/comments":
            if not self._authorized():
                self._json(HTTPStatus.UNAUTHORIZED, {"error": "bad token"})
                return
            since = int(parse_qs(parsed.query).get("since", ["0"])[0] or 0)
            self._json(HTTPStatus.OK, {"comments": read_comments(self.page_dir, since)})
            return
        if path == "/cv/meta":
            self._json(HTTPStatus.OK, {"meta": read_meta(self.page_dir), "lastSeq": last_seq(self.page_dir)})
            return
        self._serve_static(path)

    def do_HEAD(self) -> None:
        self.do_GET()

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path != "/cv/comments":
            self._json(HTTPStatus.NOT_FOUND, {"error": "not found"})
            return
        if not self._authorized():
            self._json(HTTPStatus.UNAUTHORIZED, {"error": "bad token"})
            return
        try:
            length = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            length = 0
        if length <= 0 or length > MAX_BODY:
            self._json(HTTPStatus.BAD_REQUEST, {"error": "bad content length"})
            return
        try:
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            self._json(HTTPStatus.BAD_REQUEST, {"error": "invalid json"})
            return
        if not isinstance(payload.get("comments"), list) or not payload["comments"]:
            self._json(HTTPStatus.BAD_REQUEST, {"error": "comments must be a non-empty list"})
            return
        record = append_comment(self.page_dir, payload)
        self._json(HTTPStatus.OK, {"ok": True, "seq": record["seq"]})

    # -- static ------------------------------------------------------------ #
    def public_url(self) -> str:
        host = self.headers.get("Host") if self.headers else None
        return "http://%s/" % (host or "127.0.0.1:%d" % self.server.server_address[1])

    def _serve_static(self, path: str) -> None:
        rel = path.lstrip("/")
        if rel == "" or rel.endswith("/"):
            rel = os.path.join(rel, "index.html")
        # block traversal and never expose the state dir
        if rel.startswith("..") or os.path.isabs(rel) or rel.split(os.sep)[0] == STATE_DIRNAME:
            self._json(HTTPStatus.FORBIDDEN, {"error": "forbidden"})
            return
        full = os.path.normpath(os.path.join(self.page_dir, "publish", rel))
        publish_root = os.path.normpath(os.path.join(self.page_dir, "publish"))
        if not full.startswith(publish_root + os.sep) and full != publish_root:
            self._json(HTTPStatus.FORBIDDEN, {"error": "forbidden"})
            return
        if not os.path.isfile(full):
            self._send(
                HTTPStatus.NOT_FOUND,
                b"<h1>404</h1><p>Page not published yet. Ask the agent to publish.</p>",
                "text/html; charset=utf-8",
            )
            return
        ctype = "application/octet-stream"
        ext = os.path.splitext(full)[1].lower()
        ctype = {
            ".html": "text/html; charset=utf-8",
            ".css": "text/css; charset=utf-8",
            ".js": "text/javascript; charset=utf-8",
            ".json": "application/json; charset=utf-8",
            ".svg": "image/svg+xml",
            ".png": "image/png",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".webp": "image/webp",
            ".woff2": "font/woff2",
            ".txt": "text/plain; charset=utf-8",
        }.get(ext, ctype)
        with open(full, "rb") as fh:
            body = fh.read()
        self._send(HTTPStatus.OK, body, ctype)


def cmd_serve(args) -> int:
    page_dir = os.path.abspath(args.dir)
    os.makedirs(os.path.join(page_dir, "publish"), exist_ok=True)
    ensure_state(page_dir)
    Handler.page_dir = page_dir
    Handler.token = args.token or ""
    token_note = " (token required)" if Handler.token else ""
    url = "http://127.0.0.1:%d/%s" % (args.port, ("?token=" + Handler.token) if Handler.token else "")
    print("COVIBE_URL=%s" % url.rstrip("&?"), flush=True)
    print("COVIBE_PAGE_DIR=%s" % page_dir, flush=True)
    print("COVIBE_COMMENTS=%s" % comments_path(page_dir), flush=True)
    print("serving%s; Ctrl-C or job_kill to stop" % token_note, flush=True)
    httpd = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    httpd.daemon_threads = True
    try:
        httpd.serve_forever(poll_interval=0.2)
    except KeyboardInterrupt:
        pass
    finally:
        httpd.server_close()
    return 0


def cmd_wait(args) -> int:
    page_dir = os.path.abspath(args.dir)
    since = args.since if args.since is not None else last_seq(page_dir)
    deadline = time.time() + args.timeout if args.timeout else None
    while True:
        records = read_comments(page_dir, since)
        if records:
            for record in records:
                print(json.dumps(record, ensure_ascii=False), flush=True)
            return 0
        if deadline and time.time() >= deadline:
            print("COVIBE_TIMEOUT since=%d" % since, flush=True)
            return 3
        time.sleep(args.interval)
        # A deleted store (new page dir) should not spin forever.
        if not os.path.isdir(page_dir):
            print("COVIBE_ERROR missing page dir %s" % page_dir, flush=True)
            return 2


def cmd_read(args) -> int:
    page_dir = os.path.abspath(args.dir)
    since = args.since if args.since is not None else 0
    for record in read_comments(page_dir, since):
        print(json.dumps(record, ensure_ascii=False))
    return 0


def cmd_info(args) -> int:
    page_dir = os.path.abspath(args.dir)
    meta = read_meta(page_dir)
    records = read_comments(page_dir)
    pending = [c for r in records for c in r.get("comments", [])]
    print(json.dumps({
        "pageDir": page_dir,
        "pageId": meta.get("pageId"),
        "revision": meta.get("revision"),
        "mode": meta.get("mode"),
        "published": os.path.exists(os.path.join(page_dir, "publish", "index.html")),
        "url": "http://127.0.0.1:%d/" % args.port,
        "commentBatches": len(records),
        "comments": len(pending),
        "lastSeq": records[-1]["seq"] if records else 0,
    }, ensure_ascii=False, indent=2))
    return 0


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(prog="covibe_server", description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_serve = sub.add_parser("serve", help="serve the published page and accept comments")
    p_serve.add_argument("--dir", required=True, help="page dir containing publish/ and .covibe/")
    p_serve.add_argument("--port", type=int, default=DEFAULT_PORT)
    p_serve.add_argument("--token", default="", help="shared secret required from the page")
    p_serve.set_defaults(func=cmd_serve)

    p_wait = sub.add_parser("wait", help="block until a new comment batch arrives")
    p_wait.add_argument("--dir", required=True)
    p_wait.add_argument("--since", type=int, default=None, help="cursor; default = current lastSeq")
    p_wait.add_argument("--timeout", type=float, default=0, help="seconds; 0 = wait forever")
    p_wait.add_argument("--interval", type=float, default=0.25)
    p_wait.set_defaults(func=cmd_wait)

    p_read = sub.add_parser("read", help="print comment batches")
    p_read.add_argument("--dir", required=True)
    p_read.add_argument("--since", type=int, default=None)
    p_read.set_defaults(func=cmd_read)

    p_info = sub.add_parser("info", help="print page/comment summary")
    p_info.add_argument("--dir", required=True)
    p_info.add_argument("--port", type=int, default=DEFAULT_PORT)
    p_info.set_defaults(func=cmd_info)

    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
