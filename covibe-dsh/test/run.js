// covibe comment layer self-test. Run: node test/run.js
//
// No dependencies and no network: test/dom-stub.js is a small DOM fixture and
// fetch/clipboard are in-memory mocks. This exercises the data rules and the
// main DOM flows of assets/comment-layer.js.
"use strict";

const {
  createPage, h, findAll, findOne, hasClass, textOf, click, keydown, input, settle
} = require("./dom-stub");

let passed = 0;
let failed = 0;
function ok(cond, name) {
  if (cond) { passed++; console.log("  ok   " + name); }
  else { failed++; console.log("  FAIL " + name); }
}
function eq(actual, expected, name) {
  ok(actual === expected, name + (actual === expected ? "" : " (got " + JSON.stringify(actual) + ", want " + JSON.stringify(expected) + ")"));
}
function deep(actual, expected, name) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  ok(a === b, name + (a === b ? "" : " (got " + a + ", want " + b + ")"));
}

/* ------------------------------------------------------------------ */
/* page fixtures                                                       */
/* ------------------------------------------------------------------ */
function article(page) {
  const doc = page.doc;
  const main = h(doc, "main", { id: "covibe-root" });
  main.appendChild(h(doc, "h1", { attrs: { "data-covibe-id": "h-title" }, text: "Title" }));
  const p = h(doc, "p", { attrs: { "data-covibe-id": "p-one" } });
  p.appendChild(h(doc, "a", { attrs: { href: "#x", id: "lnk" }, text: "a link" }));
  p.appendChild(doc.createTextNode(" more text"));
  main.appendChild(p);
  main.appendChild(h(doc, "ul", {}, [
    h(doc, "li", { attrs: { "data-covibe-id": "li-a" }, text: "Item A" })
  ]));
  const svg = h(doc, "svg", {});
  svg.appendChild(h(doc, "g", { attrs: { "data-covibe-id": "n-node" } }, [h(doc, "rect", {})]));
  main.appendChild(svg);
  main.appendChild(h(doc, "p", { attrs: { "data-covibe-id": "p-two" }, text: "Second paragraph." }));
  main.appendChild(h(doc, "button", { attrs: { "data-covibe-id": "btn-one", id: "btn" }, text: "Do it" }));
  main.appendChild(h(doc, "section", { id: "covibe-meta" }));
  doc.body.appendChild(main);
  page.main = main;
  return main;
}
function newArticlePage(options) {
  const page = createPage(options);
  article(page);
  return page;
}
function baseState(extra) {
  return Object.assign({
    schema: "covibe/2", session: "t1", revision: 1, mode: "manual", batchSize: 5,
    lang: "en", agentName: "Agent", threads: {}, status: {}, handled: [],
    trash: [], versions: [{ revision: 1, summary: "first" }]
  }, extra || {});
}
async function mount(page, state, opts) {
  const api = page.Covibe.mount(Object.assign({
    root: page.main, state: state || baseState(), transport: "manual", mode: "manual",
    pageId: "page-1", pageVersion: (state || {}).revision || 1
  }, opts || {}));
  await api.ready;
  return api;
}
async function mountManual(page, extra, opts) {
  return mount(page, baseState(extra), opts);
}
function composerFor(page, id) {
  return findOne(page.doc, (n) => hasClass(n, "cv-composer") && n.getAttribute("data-cv-for") === id);
}
function composers(page) { return findAll(page.doc, (n) => hasClass(n, "cv-composer")); }
function composerButton(page, id, re) {
  const c = composerFor(page, id);
  return c ? findOne(c, (n) => n.tagName === "BUTTON" && re.test(n.textContent)) : null;
}
function dockButton(page, re) {
  return findOne(page.doc, (n) => n.tagName === "BUTTON" && hasClass(n, "cv-dock-btn") && re.test(n.textContent) && !n.hidden);
}
function openTarget(page, id) {
  click(page.win, findOne(page.doc, (n) => n.getAttribute && n.getAttribute("data-covibe-id") === id));
}
function send(page, id, text) {
  const ta = page.doc.getElementById("cv-ta-" + id);
  input(page.win, ta, text);
  click(page.win, composerButton(page, id, /^Send$/));
}
function sendMark(page, id, label) {
  click(page.win, composerButton(page, id, new RegExp("^" + label + "$")));
}
function pendingStorage(page, session) {
  return JSON.parse(page.storage.getItem("covibe:" + (session || "t1") + ":pending") || "[]");
}
function storageSnapshot(page) {
  return Object.fromEntries(page.storage._map.entries());
}
function msg(page, id) {
  const c = composerFor(page, id);
  return c ? findOne(c, (n) => hasClass(n, "cv-msg")) : null;
}

const tests = [];
function test(name, fn) { tests.push([name, fn]); }

/* ================================================================== */
/* pure data layer                                                     */
/* ================================================================== */
test("data: ids, formatting, quotes, manual text, reconcile, payload", async () => {
  const data = createPage().Covibe.data;

  const ids = new Set();
  let unique = true;
  for (let i = 0; i < 4000; i++) {
    const id = data.newCommentId();
    if (!/^c-[a-z0-9]+$/.test(id) || ids.has(id)) { unique = false; break; }
    ids.add(id);
  }
  ok(unique, "comment IDs are unique and well formed");

  const taken = {};
  let avoids = true;
  for (let i = 0; i < 100; i++) {
    const id = data.newCommentId(taken);
    if (taken[id]) { avoids = false; break; }
    taken[id] = 1;
  }
  ok(avoids, "newCommentId skips taken IDs");

  eq(data.commentLine({ el: "p-one", id: "c-abc", marks: ["like"], quote: "hi", text: "ok" }),
    "[p-one|c-abc] [like] «hi» ok", "comment line = [element|comment] mark «quote» text");
  eq(data.commentLine({ el: "e", id: "c-1", marks: [] }), "[e|c-1]", "empty mark/text line is just the prefix");
  eq(data.commentLine({ el: "e", id: "c-1", marks: ["delete"], text: "gone" }), "[e|c-1] [delete] gone", "mark without text still carries the token");

  eq(data.cleanQuote("  a \n  b\tc ", 300), "a b c", "quote whitespace is collapsed");
  eq(data.cleanQuote("x".repeat(400), 10).length, 11, "quote is truncated with an ellipsis");
  eq(data.cleanQuote(""), "", "empty quote stays empty");

  const manual = data.manualText({ session: "s-1", revision: 3 }, [
    { el: "p-one", id: "c-1", marks: ["like"], text: "ok" },
    { el: "p-two", id: "c-2", quote: "q", text: "hm" }
  ]);
  eq(manual, "covibe s-1 r3\n[p-one|c-1] [like] ok\n[p-two|c-2] «q» hm", "manual text starts with covibe <session> r<rev>");

  deep(data.reconcile([
    { id: "a", el: "e1", text: "same" },
    { id: "b", el: "e1", text: "same" }
  ], ["a"]).map((p) => p.id), ["b"], "handled IDs are removed by ID, never by text");

  deep(data.initialSeen({ e: [
    { id: "u1", who: "user" },
    { id: "r1", who: "agent", rev: 1 },
    { id: "r2", who: "agent", rev: 2 }
  ] }, 2), ["r1"], "first visit: only replies older than the current revision are pre-read");

  eq(data.shouldTriggerBatch("batch", 3, [{ text: "a" }, { text: "b" }, { text: "c" }], "defer"), true, "defer: batch threshold counts text comments");
  eq(data.shouldTriggerBatch("batch", 3, [{ text: "a" }, { marks: ["like"] }], "defer"), false, "defer: marks alone do not reach the batch threshold");
  eq(data.shouldTriggerBatch("batch", 2, [{ text: "a" }, { marks: ["like"] }], "immediate"), true, "immediate: marks count toward the batch threshold");
  eq(data.shouldTriggerBatch("live", 1, [{ text: "a" }], "immediate"), false, "live mode never uses the batch threshold");
  eq(data.unsentCountable([{ marks: ["like"] }, { text: "" }, { text: "done", sent: true }], "immediate"), 2, "unsentCountable counts unsent marks in immediate mode");
  eq(data.unsentCountable([{ marks: ["like"] }, { text: "" }], "defer"), 0, "unsentCountable counts only unsent text in defer mode");

  const payload = data.postPayload(
    { pageId: "pg", pageVersion: 4, mode: "batch" },
    { session: "s1" },
    [{ el: "p-one", id: "c-9", marks: ["explain"], text: "why", ts: "2026-01-01T00:00:00.000Z", label: "Para" }]
  );
  deep(payload, {
    pageId: "pg", pageVersion: 4, mode: "batch", batchCount: 1,
    comments: [{ elementId: "p-one", commentId: "c-9", marks: ["explain"], text: "why", ts: "2026-01-01T00:00:00.000Z", elementLabel: "Para" }]
  }, "post payload has the documented shape");
});

test("data: hotswap helpers (revision compare, defer guards, script order)", async () => {
  const data = createPage().Covibe.data;
  eq(data.isNewerRevision(4, 3), true, "isNewerRevision: a higher revision is newer");
  eq(data.isNewerRevision(3, 3), false, "isNewerRevision: the same revision is not newer");
  eq(data.isNewerRevision(2, 3), false, "isNewerRevision: an older revision is not newer");
  eq(data.isNewerRevision(2, 0), true, "isNewerRevision: handles a missing page version");
  eq(data.shouldDeferSwap({ composerHasText: true }), "composer", "swap defers while a composer has text");
  eq(data.shouldDeferSwap({ focusedInInput: true }), "focus", "swap defers while an input is focused");
  eq(data.shouldDeferSwap({ lastActivity: 1000, now: 2999, quietMs: 2000 }), "activity", "swap defers right after typing or clicking");
  eq(data.shouldDeferSwap({ lastActivity: 1000, now: 3000, quietMs: 2000 }), "", "swap proceeds after the quiet window");
  eq(data.shouldDeferSwap({}), "", "swap proceeds when nothing is disruptive");
  eq(data.SWAP_QUIET_MS, 2000, "the quiet window is exposed for tests");
  const html = [
    '<script type="application/json" id="covibe-state">{"session":"s"}</script>',
    '<script src="/external.js"></script>',
    '<script>window.one = 1;</script>',
    '<script type="text/template">not js</script>',
    '<script type="text/javascript">window.two = 2;</script>',
    '<script type="module">window.three = 3;</script>'
  ].join("\n");
  deep(data.extractScripts(html), ["window.one = 1;", "window.two = 2;", "window.three = 3;"],
    "script extraction keeps executable scripts in document order and skips JSON/src/templates");
});

/* ================================================================== */
/* composer placement                                                  */
/* ================================================================== */
test("composer: tap to comment, no Comment button, threads sit with their element", async () => {
  const page = newArticlePage();
  await mountManual(page);

  openTarget(page, "p-one");
  ok(composerFor(page, "p-one") != null, "tapping a paragraph opens a comment box");
  const thread = findOne(page.doc, (n) => hasClass(n, "cv-thread") && n.getAttribute("data-cv-for") === "p-one");
  ok(thread && thread.parentNode === page.main, "block thread sits directly below the paragraph");
  ok(composerFor(page, "p-one").getAttribute("data-cv-for") === "p-one", "comment box belongs to that element");

  openTarget(page, "li-a");
  const liThread = findOne(page.doc, (n) => hasClass(n, "cv-thread") && n.getAttribute("data-cv-for") === "li-a");
  ok(liThread && liThread.parentNode === findOne(page.doc, (n) => n.getAttribute && n.getAttribute("data-covibe-id") === "li-a"),
    "list-item thread stays inside the <li>");

  const before = composers(page).length;
  click(page.win, page.doc.getElementById("cv-ta-p-one"));
  click(page.win, findOne(composerFor(page, "p-one"), (n) => hasClass(n, "cv-composer")) || page.doc.getElementById("cv-ta-p-one"));
  eq(composers(page).length, before, "clicks inside the comment layer do not open more comment boxes");
  eq(findOne(page.doc, (n) => n.tagName === "BUTTON" && /^Comment$/i.test(n.textContent)), null, "there is no separate Comment button");
});

/* ================================================================== */
/* links, buttons, review mode                                         */
/* ================================================================== */
test("review mode: links work normally until review mode is on, and it is shown", async () => {
  const page = newArticlePage();
  await mountManual(page);
  const link = page.doc.getElementById("lnk");

  let ev = new page.win.MouseEvent("click", { bubbles: true, cancelable: true });
  link.dispatchEvent(ev);
  eq(ev.defaultPrevented, false, "link click outside review mode is not intercepted");
  eq(composerFor(page, "p-one"), null, "link click outside review mode does not open a comment box");

  const review = findOne(page.doc, (n) => n.tagName === "BUTTON" && /Review mode: off/.test(n.textContent));
  ok(review && !review.hidden, "review toggle is shown when the page has links/buttons");
  click(page.win, review);
  ok(page.doc.documentElement.classList.contains("cv-review"), "review mode is shown on the page");
  ok(/Review mode: on/.test(review.textContent), "review toggle reads on");

  ev = new page.win.MouseEvent("click", { bubbles: true, cancelable: true });
  link.dispatchEvent(ev);
  eq(ev.defaultPrevented, true, "in review mode a link click is captured");
  ok(composerFor(page, "p-one") != null, "in review mode a tap on a link opens its comment box");

  eq(review.getAttribute("aria-pressed"), "true", "review toggle exposes aria-pressed");
});

/* ================================================================== */
/* manual transport                                                    */
/* ================================================================== */
test("manual: pending, waiting tag, plain text, copy fallback", async () => {
  const page = newArticlePage();
  const api = await mountManual(page);

  openTarget(page, "p-two");
  send(page, "p-two", "<img src=x onerror=alert(1)> hello");
  await settle();

  const pending = api.pending();
  eq(pending.length, 1, "a sent comment is pending until the agent handles it");
  ok(/^c-/.test(pending[0].id), "the page assigns a comment ID when the user sends");
  eq(pendingStorage(page).length, 1, "pending comments are kept in localStorage");

  const pendingEntry = findOne(page.doc, (n) => hasClass(n, "cv-pending"));
  const text = findOne(pendingEntry, (n) => hasClass(n, "cv-text"));
  ok(text.textContent.startsWith("<img"), "comment text is rendered verbatim");
  eq(findAll(pendingEntry, (n) => n.tagName === "IMG").length, 0, "comment text is plain text, never parsed as HTML");
  ok(/waiting/.test(textOf(findOne(pendingEntry, (n) => hasClass(n, "cv-wait")))), "the comment is marked waiting immediately");

  ok(/\[p-two\|c-[a-z0-9]+\]/.test(api.exportText()), "manual handoff uses the [elementId|commentId] prefix");

  const copy = dockButton(page, /Copy for chat/);
  ok(copy != null, "manual dock shows Copy for chat");
  click(page.win, copy);
  await settle();
  const box = findOne(page.doc, (n) => hasClass(n, "cv-export"));
  ok(box && !box.hidden, "copy failure falls back to a selectable text area");
  ok(/Copy failed/.test(textOf(box)), "the fallback explains what happened");
  const area = findOne(box, (n) => n.tagName === "TEXTAREA");
  ok(area.value.startsWith("covibe t1 r1") && /\[p-two\|c-/.test(area.value), "fallback text is exactly the chat message");
  ok(/does not start the agent/.test(area.value) === false, "the copied message has no agent claims");

  openTarget(page, "p-one");
  sendMark(page, "p-one", "Explain");
  await settle();
  eq(api.pending().length, 2, "a quick mark can be sent without text");
  deep(api.pending()[1].marks, ["explain"], "the mark is stored");
  ok(/\[p-one\|c-[a-z0-9]+\] \[explain\]/.test(api.exportText()), "marks are exported as [explain]");
});

test("manual: successful copy says copied, never claims the agent was started", async () => {
  let copied = null;
  const page = newArticlePage({ clipboard: { writeText(text) { copied = text; return Promise.resolve(); } } });
  await mountManual(page);
  openTarget(page, "p-one");
  send(page, "p-one", "hello");
  await settle();

  click(page.win, dockButton(page, /Copy for chat/));
  await settle();
  ok(copied && copied.startsWith("covibe t1 r1\n[p-one|c-"), "clipboard receives the exact message");
  const toast = findOne(page.doc, (n) => hasClass(n, "cv-dock-toast"));
  ok(/Copied\. Paste it into the chat\./.test(textOf(toast)), "success message tells the user to paste, not that the session started");
  ok(!/started your session|sent to the agent/i.test(textOf(toast)), "no false claim about starting the agent");
});

test("manual: handled IDs clear localStorage on the next publish, by ID only", async () => {
  const page1 = newArticlePage();
  const api1 = await mountManual(page1);
  openTarget(page1, "p-one");
  send(page1, "p-one", "same text");
  await settle();
  openTarget(page1, "p-two");
  send(page1, "p-two", "same text");
  await settle();
  const [a, b] = api1.pending();
  eq(api1.pending().length, 2, "two pending comments before the publish");

  const page2 = newArticlePage({ storageData: storageSnapshot(page1) });
  const state2 = baseState({
    revision: 2,
    threads: { "p-one": [{ id: a.id, who: "user", text: "same text" }, { id: "r1", who: "agent", text: "done", rev: 2 }] },
    handled: [a.id]
  });
  const api2 = await mount(page2, state2);
  eq(api2.pending().length, 1, "the handled comment is removed from local storage");
  eq(api2.pending()[0].id, b.id, "a second comment with identical text stays pending");
  eq(pendingStorage(page2).length, 1, "the pruned list is written back");
});

/* ================================================================== */
/* unread replies                                                      */
/* ================================================================== */
test("unread: obvious, read only on touch, next-unread navigation", async () => {
  const page = newArticlePage();
  const state = baseState({
    revision: 3,
    threads: { "p-one": [
      { id: "c1", who: "user", text: "q" },
      { id: "r-old", who: "agent", text: "old", rev: 2 },
      { id: "r-new", who: "agent", text: "new", rev: 3 },
      { id: "r-new2", who: "agent", text: "newer", rev: 3 }
    ] },
    handled: ["c1"]
  });
  const api = await mount(page, state);

  eq(findAll(page.doc, (n) => hasClass(n, "cv-unread")).length, 2, "only replies from the current revision are unread");
  const dockUnread = findOne(page.doc, (n) => hasClass(n, "cv-dock-unread"));
  ok(dockUnread && !dockUnread.hidden, "unread replies get a next-unread button");
  ok(/2 new replies/.test(textOf(dockUnread)), "the button shows the unread count");

  page.win.dispatchEvent(new page.win.Event("scroll"));
  eq(findAll(page.doc, (n) => hasClass(n, "cv-unread")).length, 2, "scrolling past a reply does not mark it read");

  const first = api.nextUnread();
  eq(first, "r-new", "next-unread goes to the first unread reply");
  const second = api.nextUnread();
  eq(second, "r-new2", "next-unread advances to the next unread reply");
  eq(findAll(page.doc, (n) => hasClass(n, "cv-unread")).length, 2, "navigation alone does not mark replies read");

  const unread = findAll(page.doc, (n) => hasClass(n, "cv-unread"));
  click(page.win, unread[0]);
  eq(findAll(page.doc, (n) => hasClass(n, "cv-unread")).length, 1, "tapping a reply marks only it read");
  click(page.win, findAll(page.doc, (n) => hasClass(n, "cv-unread"))[0]);
  eq(findAll(page.doc, (n) => hasClass(n, "cv-unread")).length, 0, "tapping the last unread reply clears the count");
  ok(dockUnread.hidden, "next-unread button hides when nothing is unread");
});

/* ================================================================== */
/* small elements                                                      */
/* ================================================================== */
test("small elements: count marker opens a panel, panel goes back to the element", async () => {
  const page = newArticlePage();
  const state = baseState({
    revision: 2,
    threads: { "n-node": [{ id: "r9", who: "agent", text: "note", rev: 2 }] }
  });
  await mount(page, state);

  const badge = findOne(page.doc, (n) => hasClass(n, "cv-badge"));
  ok(badge && !badge.hidden, "an SVG node gets a count marker");
  eq(textOf(badge), "1", "the marker shows the comment count");
  ok(hasClass(badge, "cv-badge-unread"), "the marker is visually unread when a reply is new");

  click(page.win, badge);
  const panel = findOne(page.doc, (n) => hasClass(n, "cv-panel"));
  ok(panel && !panel.hidden, "tapping the marker opens the thread panel");
  ok(page.doc.getElementById("cv-ta-n-node") != null, "the panel has the comment box for that node");
  eq(findAll(findOne(page.doc, (n) => n.getAttribute && n.getAttribute("data-covibe-id") === "n-node"), (n) => hasClass(n, "cv-thread")).length,
    0, "no thread markup is injected into the SVG");

  const title = findOne(panel, (n) => hasClass(n, "cv-panel-title"));
  click(page.win, title);
  const node = findOne(page.doc, (n) => n.getAttribute && n.getAttribute("data-covibe-id") === "n-node");
  ok(hasClass(node, "cv-hl"), "panel title goes to the element in one step and highlights it");
  ok(node.scrolledIntoView === true, "the element is scrolled into view");

  const close = findOne(panel, (n) => n.tagName === "BUTTON" && /^Close$/.test(textOf(n)));
  click(page.win, close);
  eq(panel.hidden, true, "the panel closes");
});

/* ================================================================== */
/* hide / show                                                         */
/* ================================================================== */
test("hide/show: toggles the whole layer and keeps drafts", async () => {
  const page = newArticlePage();
  const api = await mountManual(page);
  openTarget(page, "p-one");
  const ta = page.doc.getElementById("cv-ta-p-one");
  input(page.win, ta, "draft text");

  api.setVisible(false);
  ok(page.doc.documentElement.classList.contains("cv-hidden"), "hiding adds the cv-hidden root class");
  api.setVisible(true);
  ok(!page.doc.documentElement.classList.contains("cv-hidden"), "showing removes it");
  eq(page.doc.getElementById("cv-ta-p-one").value, "draft text", "the draft survives hide/show");
});

/* ================================================================== */
/* trash + version log                                                 */
/* ================================================================== */
test("trash: collapsed with original ID, still commentable, version log lines", async () => {
  const page = newArticlePage();
  const state = baseState({
    trash: [{ id: "old-1", label: "Old section", html: "<p>gone</p>" }, { id: "old-2", html: "<p>unlabelled</p>" }],
    versions: [{ revision: 1, summary: "first" }, { revision: 2, summary: "second" }]
  });
  const api = await mount(page, state);

  const details = findOne(page.doc, (n) => n.tagName === "DETAILS" && n.getAttribute("data-covibe-id") === "old-1");
  ok(details != null, "trash item keeps the original element ID");
  eq(details.open, false, "trash item is shown collapsed");
  const unlabelled = findOne(page.doc, (n) => n.tagName === "SUMMARY" && n.parentNode.getAttribute("data-covibe-id") === "old-2");
  eq(textOf(unlabelled), "Deleted element", "an unlabelled trash item hides its raw element ID");
  eq(findAll(page.doc, (n) => hasClass(n, "cv-versions") && n.tagName === "OL")[0].children.length, 2, "version log has one line per revision");
  ok(/second/.test(textOf(findOne(page.doc, (n) => hasClass(n, "cv-versions")))), "version log shows the published summaries");

  click(page.win, details);
  ok(composerFor(page, "old-1") != null, "a trash item is commentable, so the user can send restore");
  const summary = findOne(details, (n) => n.tagName === "SUMMARY");
  eq(textOf(summary), "Old section", "trash uses the provided label, not the element ID");
  const before = composers(page).length;
  click(page.win, summary);
  eq(composers(page).length, before, "summary keeps its normal collapse/expand behaviour outside review mode");

  send(page, "old-1", "restore");
  await settle();
  ok(/\[old-1\|c-[a-z0-9]+\] restore/.test(api.exportText()), "the restore comment carries the original element ID");
});

/* ================================================================== */
/* post transport                                                      */
/* ================================================================== */
function fetchLog(options = {}) {
  const calls = [];
  const results = options.results || ["ok"];
  let index = 0;
  const impl = (url, init) => {
    calls.push({ url: url, init: init, body: JSON.parse(init.body) });
    const step = results[Math.min(index, results.length - 1)];
    index += 1;
    if (step === "fail") return Promise.reject(new Error("network down"));
    if (step === "http500") return Promise.resolve({ ok: false, status: 500 });
    return Promise.resolve({ ok: true, status: 200 });
  };
  return { calls, impl };
}
const postOpts = (log, extra) => Object.assign({
  transport: "post", endpoint: "http://127.0.0.1:8787/cv/comments", token: "tok",
  mode: "live", pageId: "onboard", pageVersion: 3
}, extra || {});

test("post/live: mark-only posts immediately (markDelivery immediate, the default)", async () => {
  const log = fetchLog();
  const page = newArticlePage({ fetch: log.impl });
  const api = await mount(page, baseState({ mode: "live" }), postOpts(log));
  eq(api.transport(), "post", "transport post is active");

  openTarget(page, "p-one");
  sendMark(page, "p-one", "Dislike");
  await settle(); await settle();
  eq(log.calls.length, 1, "a mark without text posts immediately in live mode");
  const call = log.calls[0];
  eq(call.body.batchCount, 1, "the mark is its own post");
  eq(call.body.comments.length, 1, "one wire comment");
  eq(call.body.comments[0].elementId, "p-one", "wire comment carries elementId");
  ok(/^c-/.test(call.body.comments[0].commentId), "wire comment carries commentId");
  deep(call.body.comments[0].marks, ["dislike"], "wire comment carries the mark");
  eq(call.body.comments[0].text, "", "wire comment text is empty");
  ok(api.pending().length === 1 && api.pending()[0].sent === true, "the mark is delivered, not left stranded");
  ok(/Mark sent\./.test(textOf(msg(page, "p-one"))), "feedback says the mark was sent");
  ok(!/next text comment/.test(textOf(msg(page, "p-one"))), "immediate mode never uses the defer wording");
});

test("post/live: a text comment posts immediately with the documented wire shape", async () => {
  const log = fetchLog();
  const page = newArticlePage({ fetch: log.impl });
  await mount(page, baseState({ mode: "live" }), postOpts(log));

  openTarget(page, "p-one");
  send(page, "p-one", "hello");
  await settle(); await settle();
  eq(log.calls.length, 1, "a text comment triggers exactly one post");
  const call = log.calls[0];
  eq(call.url, "http://127.0.0.1:8787/cv/comments", "the configured endpoint is used");
  eq(call.init.headers["X-Covibe-Token"], "tok", "the token is sent as X-Covibe-Token");
  eq(call.body.pageId, "onboard", "payload pageId");
  eq(call.body.pageVersion, 3, "payload pageVersion");
  eq(call.body.mode, "live", "payload mode");
  eq(call.body.batchCount, 1, "batchCount counts this post");
  eq(call.body.comments[0].text, "hello", "text comment carries text");
  eq(call.body.comments[0].elementId, "p-one", "comment carries elementId");
  eq(typeof call.body.comments[0].ts, "string", "comment carries a timestamp");
  eq(typeof call.body.comments[0].elementLabel, "string", "comment carries elementLabel");
  ok(/Sent to the agent/.test(textOf(msg(page, "p-one"))), "the comment box confirms delivery");
});

test("post/live defer: marks wait for the next text comment (covibe 1.1 section 4)", async () => {
  const log = fetchLog();
  const page = newArticlePage({ fetch: log.impl });
  await mount(page, baseState({ mode: "live", markDelivery: "defer" }), postOpts(log));

  openTarget(page, "p-one");
  sendMark(page, "p-one", "Like");
  await settle(); await settle();
  eq(log.calls.length, 0, "defer: a mark without text does not post");
  const pendingEntry = findOne(page.doc, (n) => hasClass(n, "cv-pending"));
  ok(/next text comment/.test(textOf(pendingEntry)), "defer: the pending mark says it waits for text");
  ok(/next text comment/.test(textOf(msg(page, "p-one"))), "defer: the comment box keeps the defer wording");

  send(page, "p-one", "hello");
  await settle(); await settle();
  eq(log.calls.length, 1, "defer: the next text comment posts once");
  const call = log.calls[0];
  eq(call.body.batchCount, 2, "defer: the queued mark rides along with the text comment");
  deep(call.body.comments[0].marks, ["like"], "defer: the mark is delivered with the text");
  eq(call.body.comments[0].text, "", "defer: the queued mark still has empty text");
  eq(call.body.comments[1].text, "hello", "defer: the text comment follows the mark");
});

test("post: network failure keeps the comment and offers Retry", async () => {
  const log = fetchLog({ results: ["fail", "ok"] });
  const page = newArticlePage({ fetch: log.impl });
  await mount(page, baseState({ mode: "live" }), postOpts(log));

  openTarget(page, "p-one");
  send(page, "p-one", "please keep me");
  await settle(); await settle();
  const apiPending = findAll(page.doc, (n) => hasClass(n, "cv-pending"));
  ok(apiPending.length === 1, "the failed comment stays on the page");
  ok(hasClass(apiPending[0], "cv-failed"), "the failed comment is marked not delivered");
  ok(/not delivered/.test(textOf(findOne(apiPending[0], (n) => hasClass(n, "cv-wait")))), "the failure is explained in place");
  const stored = JSON.parse(page.storage.getItem("covibe:t1:pending"));
  eq(stored[0].failed, true, "the failure survives a reload in localStorage");

  const retry = dockButton(page, /Retry/);
  ok(retry != null && /1 not delivered/.test(textOf(retry)), "dock offers Retry with a count");
  click(page.win, retry);
  await settle(); await settle();
  eq(log.calls.length, 2, "Retry posts again");
  eq(JSON.parse(page.storage.getItem("covibe:t1:pending"))[0].sent, true, "successful retry marks the comment sent");
  eq(dockButton(page, /Retry/), null, "retry button hides after success");
});

test("post/live immediate: a failed mark stays local and Retry delivers it", async () => {
  const log = fetchLog({ results: ["fail", "ok"] });
  const page = newArticlePage({ fetch: log.impl });
  await mount(page, baseState({ mode: "live" }), postOpts(log));

  openTarget(page, "p-one");
  sendMark(page, "p-one", "Explain");
  await settle(); await settle();
  eq(log.calls.length, 1, "the mark attempted delivery");
  const pending = findAll(page.doc, (n) => hasClass(n, "cv-pending"));
  ok(pending.length === 1 && hasClass(pending[0], "cv-failed"), "the failed mark stays on the page");
  ok(/not delivered/.test(textOf(findOne(pending[0], (n) => hasClass(n, "cv-wait")))), "the failure is explained in place");
  eq(JSON.parse(page.storage.getItem("covibe:t1:pending"))[0].failed, true, "the failure survives a reload");
  const retry = dockButton(page, /Retry/);
  ok(retry != null && /1 not delivered/.test(textOf(retry)), "dock offers Retry for the mark");
  click(page.win, retry);
  await settle(); await settle();
  eq(log.calls.length, 2, "Retry posts the mark again");
  eq(JSON.parse(page.storage.getItem("covibe:t1:pending"))[0].sent, true, "successful retry marks it sent");
  eq(dockButton(page, /Retry/), null, "retry button hides after the mark is delivered");
});

test("post/batch defer: posts only at N text comments or Process now, never twice", async () => {
  const log = fetchLog();
  const page = newArticlePage({ fetch: log.impl });
  const state = baseState({ mode: "batch", batchSize: 3 });
  await mount(page, state, postOpts(log, { mode: "batch", markDelivery: "defer" }));

  openTarget(page, "p-one");
  sendMark(page, "p-one", "Explain");
  send(page, "p-one", "t1");
  await settle();
  send(page, "p-one", "t2");
  await settle();
  eq(log.calls.length, 0, "below the threshold nothing is posted");
  eq(composers(page).length, 1, "the same comment box is reused for every comment on the element");
  const process = dockButton(page, /Process now/);
  ok(process != null && /3 waiting/.test(textOf(process)), "batch dock shows the waiting count and Process now");

  send(page, "p-one", "t3");
  await settle(); await settle();
  eq(log.calls.length, 1, "the N-th text comment posts the batch once");
  eq(log.calls[0].body.batchCount, 4, "the batch includes the earlier mark");
  eq(log.calls[0].body.comments.length, 4, "all waiting comments are posted together");
  eq(log.calls[0].body.mode, "batch", "payload mode is batch");

  send(page, "p-one", "t4");
  await settle(); await settle();
  eq(log.calls.length, 1, "already-posted comments are not posted twice");

  click(page.win, dockButton(page, /Process now/));
  await settle(); await settle();
  eq(log.calls.length, 2, "Process now sends the comments still waiting");
  eq(log.calls[1].body.batchCount, 1, "Process now sends only the unposted comment");
});

test("post/batch immediate: marks count toward N and trigger a batch", async () => {
  const log = fetchLog();
  const page = newArticlePage({ fetch: log.impl });
  const state = baseState({ mode: "batch", batchSize: 3 });
  const api = await mount(page, state, postOpts(log, { mode: "batch" }));

  openTarget(page, "p-one");
  sendMark(page, "p-one", "Like");
  await settle();
  eq(log.calls.length, 0, "one mark is below the threshold");
  sendMark(page, "p-one", "Dislike");
  await settle();
  eq(log.calls.length, 0, "two marks are below the threshold");
  const process = dockButton(page, /Process now/);
  ok(process != null && /2 waiting/.test(textOf(process)), "batch dock counts the marks");
  ok(/Saved \(2\/3\)/.test(textOf(msg(page, "p-one"))), "saved feedback counts the marks");

  sendMark(page, "p-one", "Explain");
  await settle(); await settle();
  eq(log.calls.length, 1, "the N-th mark triggers the batch");
  eq(log.calls[0].body.batchCount, 3, "the batch has all three marks");
  eq(log.calls[0].body.comments.length, 3, "all three marks are posted together");
  deep(log.calls[0].body.comments.map((c) => c.marks[0]), ["like", "dislike", "explain"], "each mark is carried");
  ok(log.calls[0].body.comments.every((c) => c.text === ""), "mark-only comments have empty text");
  ok(api.pending().every((c) => c.sent === true), "all three marks are marked sent locally");

  sendMark(page, "p-one", "Delete");
  await settle();
  eq(log.calls.length, 1, "a mark after a batch does not post immediately");
  click(page.win, dockButton(page, /Process now/));
  await settle(); await settle();
  eq(log.calls.length, 2, "Process now still sends the remaining mark");
  eq(log.calls[1].body.batchCount, 1, "Process now sends only the unposted mark");
});

/* ================================================================== */
/* revision banner (post transport)                                    */
/* ================================================================== */
test("update banner: newer publish shows a dismissible Reload notice, with token", async () => {
  const meta = { revision: 3 };
  const calls = [];
  const impl = (url, init = {}) => {
    calls.push({ url: url, method: init.method || "GET", headers: init.headers || {}, init: init });
    if (String(url).indexOf("/cv/meta") >= 0) {
      return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve({ meta: { revision: meta.revision }, lastSeq: 9 }); } });
    }
    return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve({ ok: true }); } });
  };
  const page = newArticlePage({ fetch: impl });
  let reloads = 0;
  page.win.location.reload = function () { reloads++; };
  const api = await mount(page, baseState({ mode: "live" }), postOpts(null, { updateMode: "banner" }));
  const bar = findOne(page.doc, (n) => hasClass(n, "cv-update"));

  ok(bar && bar.hidden, "no banner before a newer revision is published");
  eq(typeof page.win.Covibe.checkForUpdate, "function", "Covibe.checkForUpdate() is exposed globally");
  eq(api.polling(), true, "post transport starts polling for new revisions");

  let result = await api.checkForUpdate();
  eq(result.shown, false, "same revision shows no banner");
  meta.revision = 4;
  result = await api.checkForUpdate();
  eq(result.shown, true, "a newer revision shows the banner");
  ok(!bar.hidden && /r4/.test(textOf(bar)), "banner names the new revision");
  ok(/kept/.test(textOf(bar)), "banner says the comments were kept, not lost");
  ok(!/lost|discard/i.test(textOf(bar)), "banner does not imply pending comments are lost");

  const metaCall = calls.find((c) => c.method === "GET" && /\/cv\/meta$/.test(c.url));
  ok(metaCall != null, "meta endpoint is polled with GET");
  eq(metaCall.url, "http://127.0.0.1:8787/cv/meta", "meta URL is derived from the post endpoint");
  eq(metaCall.headers["X-Covibe-Token"], "tok", "meta GET sends the token header");

  const dismiss = findOne(bar, (n) => n.tagName === "BUTTON" && /^Dismiss$/.test(textOf(n)));
  click(page.win, dismiss);
  eq(bar.hidden, true, "Dismiss hides the banner");
  result = await api.checkForUpdate();
  eq(result.shown, false, "a dismissed revision stays dismissed");

  meta.revision = 5;
  result = await api.checkForUpdate();
  eq(result.shown, true, "a later revision can notify again");
  eq(reloads, 0, "Reload is not automatic");
  const reload = findOne(bar, (n) => n.tagName === "BUTTON" && /^Reload$/.test(textOf(n)));
  click(page.win, reload);
  eq(reloads, 1, "Reload calls location.reload()");
  api.destroy();
  eq(api.polling(), false, "destroy stops polling");
});

test("update banner: silent failures and no polling for manual/none", async () => {
  const failPage = newArticlePage({ fetch: (url, init = {}) => Promise.reject(new Error("network down")) });
  const failApi = await mount(failPage, baseState({ mode: "live" }), postOpts(null, { updateMode: "banner" }));
  const failed = await failApi.checkForUpdate();
  eq(failed.checked, false, "a failed meta fetch resolves quietly");
  eq(findOne(failPage.doc, (n) => hasClass(n, "cv-update")).hidden, true, "no banner on a failed check");
  failApi.destroy();

  const manualPage = newArticlePage();
  const manualApi = await mountManual(manualPage);
  eq(manualApi.polling(), false, "manual transport never polls");
  eq((await manualApi.checkForUpdate()).skipped, "transport", "manual checkForUpdate is a no-op");
  manualApi.destroy();

  const nonePage = newArticlePage();
  const noneApi = await mount(nonePage, baseState({ mode: "live" }), { transport: "none", mode: "live" });
  eq(noneApi.polling(), false, "none transport never polls");
  eq((await noneApi.checkForUpdate()).skipped, "transport", "none checkForUpdate is a no-op");
  noneApi.destroy();
});

test("post/hotswap: a failed swap keeps the DOM and falls back to the banner", async () => {
  const calls = [];
  const impl = (url, init = {}) => {
    calls.push({ url: String(url), init: init });
    if (String(url).indexOf("/cv/meta") >= 0) {
      return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve({ meta: { revision: 4 }, lastSeq: 5 }); } });
    }
    return Promise.reject(new Error("document fetch failed"));
  };
  const page = newArticlePage({ fetch: impl });
  const api = await mount(page, baseState({ mode: "live" }), postOpts(null, { updateMode: "hotswap" }));
  eq(api.updateMode(), "hotswap", "updateMode hotswap is active");
  eq(api.polling(), true, "hotswap mode polls");
  const before = { text: textOf(page.main), composers: composers(page).length, ui: findAll(page.doc, (n) => hasClass(n, "cv-ui")).length };
  const result = await api.checkForUpdate();
  eq(result.fallback, true, "a failed document fetch falls back");
  eq(textOf(page.main), before.text, "the page markup is unchanged after a failed swap");
  eq(composers(page).length, before.composers, "no half-built comment box remains");
  eq(findAll(page.doc, (n) => hasClass(n, "cv-ui")).length, 1, "exactly one layer instance");
  const bar = findOne(page.doc, (n) => hasClass(n, "cv-update"));
  ok(bar && !bar.hidden && /r4/.test(textOf(bar)), "the fallback banner offers the new revision");
  eq(findOne(page.doc, (n) => hasClass(n, "cv-toast")).hidden, true, "no success toast after a failure");
  const documentCalls = calls.filter((c) => c.url.indexOf("/cv/meta") < 0);
  eq(documentCalls.length, 1, "the swap fetched the live document once");
  api.destroy();
});

test("updateMode off: no polling, no banner, no swap", async () => {
  const calls = [];
  const impl = (url) => {
    calls.push(String(url));
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ meta: { revision: 99 } }), text: () => Promise.resolve("<html></html>") });
  };
  const page = newArticlePage({ fetch: impl });
  const api = await mount(page, baseState({ mode: "live" }), postOpts(null, { updateMode: "off" }));
  eq(api.updateMode(), "off", "updateMode off is active");
  eq(api.polling(), false, "off does not poll");
  eq((await api.checkForUpdate()).skipped, "off", "checkForUpdate is a no-op when off");
  eq(calls.length, 0, "off makes no requests");
  eq(findOne(page.doc, (n) => hasClass(n, "cv-update")).hidden, true, "no banner in off mode");
  api.destroy();
});

/* ================================================================== */
/* none transport                                                      */
/* ================================================================== */
test("none transport: collects on the page, no copy, no post", async () => {
  const page = newArticlePage();
  const api = await mount(page, baseState({ mode: "live" }), { transport: "none", mode: "live" });
  eq(api.transport(), "none", "transport none is active");
  openTarget(page, "p-one");
  send(page, "p-one", "hello");
  await settle();
  eq(dockButton(page, /Copy for chat/), null, "no copy control in none transport");
  const count = findOne(page.doc, (n) => hasClass(n, "cv-dock-count"));
  ok(count && !count.hidden && /1 waiting/.test(textOf(count)), "waiting count is shown");
  ok(/Saved on this device only/.test(textOf(msg(page, "p-one"))), "the user is told delivery is disabled");
});

/* ================================================================== */
/* storage failure                                                     */
/* ================================================================== */
test("storage failure: says not saved, keeps working in memory", async () => {
  const page = newArticlePage({ storage: "broken" });
  const api = await mountManual(page);
  eq(api.storageOk(), false, "the layer notices localStorage is unavailable");

  openTarget(page, "p-one");
  send(page, "p-one", "hello");
  await settle();
  eq(api.pending().length, 1, "comments still work in memory");
  ok(/Not saved on this device/.test(textOf(msg(page, "p-one"))), "the comment box says it was not saved");
  const notice = findOne(page.doc, (n) => hasClass(n, "cv-dock-notice"));
  ok(notice && !notice.hidden, "a persistent warning explains local storage is blocked");
  eq(page.storage._map.size, 0, "nothing was written to localStorage");
});

/* ================================================================== */
/* config + state sources                                              */
/* ================================================================== */
test("config: window.COVIBE supplies transport and mode, state can come from #covibe-state", async () => {
  const page = createPage();
  page.win.COVIBE = { transport: "manual", mode: "manual" };
  const doc = page.doc;
  const main = h(doc, "main", { id: "covibe-root" });
  main.appendChild(h(doc, "p", { attrs: { "data-covibe-id": "p-one" }, text: "Hi" }));
  main.appendChild(h(doc, "section", { id: "covibe-meta" }));
  doc.body.appendChild(main);
  const script = h(doc, "script", { id: "covibe-state", type: "application/json" });
  script.textContent = JSON.stringify(baseState());
  doc.body.appendChild(script);

  const api = page.Covibe.mount({ root: main });
  await api.ready;
  eq(api.transport(), "manual", "transport comes from window.COVIBE");
  eq(api.mode(), "manual", "mode comes from window.COVIBE");
  click(page.win, findOne(doc, (n) => n.getAttribute && n.getAttribute("data-covibe-id") === "p-one"));
  ok(composerFor(page, "p-one") != null, "state was read from the #covibe-state script");

  let threw = false;
  try {
    const bad = newArticlePage();
    bad.Covibe.mount({ root: bad.main, state: baseState({ schema: "covibe/3" }) });
  } catch (e) { threw = true; }
  ok(threw, "an unsupported state schema is rejected");
});

test("config: window.COVIBE markDelivery (the publish.py injection path) is honored", async () => {
  const log = fetchLog();
  const page = newArticlePage({ fetch: log.impl });
  page.win.COVIBE = {
    transport: "post", mode: "live", endpoint: "http://127.0.0.1:8787/cv/comments",
    token: "tok", pageId: "onboard", pageVersion: 3, markDelivery: "defer",
    state: baseState({ mode: "live" })
  };
  const api = page.Covibe.mount({ root: page.main });
  const info = await api.ready;
  eq(info.markDelivery, "defer", "mount reports the configured markDelivery");
  openTarget(page, "p-one");
  sendMark(page, "p-one", "Like");
  await settle(); await settle();
  eq(log.calls.length, 0, "publish.py-injected defer keeps mark-only comments local");
  send(page, "p-one", "hello");
  await settle(); await settle();
  eq(log.calls.length, 1, "defer window.COVIBE: the next text comment posts");
  eq(log.calls[0].body.batchCount, 2, "defer window.COVIBE: the mark rides with the text comment");
});

/* ================================================================== */
/* keyboard + selection + destroy                                      */
/* ================================================================== */
test("keyboard: Enter opens, Escape closes, focus goes to the box", async () => {
  const page = newArticlePage();
  const api = await mountManual(page);
  const p = findOne(page.doc, (n) => n.getAttribute && n.getAttribute("data-covibe-id") === "p-one");

  keydown(page.win, p, "Enter");
  ok(composerFor(page, "p-one") != null, "Enter on a focused element opens its comment box");
  const ta = page.doc.getElementById("cv-ta-p-one");
  eq(page.doc.activeElement, ta, "focus moves into the comment box");

  keydown(page.win, ta, "Escape");
  eq(composerFor(page, "p-one"), null, "Escape closes the comment box");
  eq(findAll(page.doc, (n) => hasClass(n, "cv-composer")).length, 0, "no stray comment box remains");

  keydown(page.win, p, " ");
  ok(composerFor(page, "p-one") != null, "Space opens the comment box too");
  api.destroy();
});

test("selection: selected text becomes a quote", async () => {
  const page = newArticlePage();
  const api = await mountManual(page);
  const p = findOne(page.doc, (n) => n.getAttribute && n.getAttribute("data-covibe-id") === "p-one");
  page.win.__selection = { isCollapsed: false, anchorNode: p, toString: () => "selected   words" };

  click(page.win, p);
  const quote = findOne(composerFor(page, "p-one"), (n) => hasClass(n, "cv-quote"));
  ok(quote && textOf(quote) === "selected words", "selected text is quoted in the comment box");
  send(page, "p-one", "about this");
  await settle();
  const pendingEntry = findOne(page.doc, (n) => hasClass(n, "cv-pending"));
  const quoteEl = findOne(pendingEntry, (n) => hasClass(n, "cv-quote"));
  const line = findAll(page.doc, (n) => hasClass(n, "cv-text") && textOf(n) === "about this")[0];
  ok(line != null, "the comment is shown in place");
  eq(textOf(quoteEl), "selected words", "pending entry keeps the quote");
  ok(/\[p-one\|c-[a-z0-9]+\] «selected words» about this/.test(api.exportText()), "the outgoing message quotes the selection");
});

test("destroy: removes the UI and its listeners", async () => {
  const page = newArticlePage();
  const api = await mountManual(page);
  openTarget(page, "p-one");
  api.destroy();
  eq(findOne(page.doc, (n) => hasClass(n, "cv-ui")), null, "destroy removes the layer UI");
  eq(page.doc.getElementById("covibe-meta").children.length, 0, "destroy clears the layer-owned trash/version section");
  eq(findAll(page.doc, (n) => hasClass(n, "cv-thread")).length, 0, "destroy removes thread boxes");
  click(page.win, findOne(page.doc, (n) => n.getAttribute && n.getAttribute("data-covibe-id") === "p-one"));
  eq(composerFor(page, "p-one"), null, "destroy removes the click handlers");
  eq(findAll(page.doc, (n) => hasClass(n, "cv-target")).length, 0, "destroy removes target classes");
});

/* ================================================================== */
/* runner                                                              */
/* ================================================================== */
(async () => {
  for (const [name, fn] of tests) {
    console.log("\n" + name);
    try {
      await fn();
    } catch (error) {
      failed++;
      console.log("  FAIL threw: " + String((error && error.stack) || error).split("\n").slice(0, 6).join("\n       "));
    }
  }
  console.log("\n" + passed + " passed, " + failed + " failed");
  process.exit(failed ? 1 : 0);
})();
