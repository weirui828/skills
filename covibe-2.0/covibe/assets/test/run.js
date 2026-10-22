// covibe comment layer tests (jsdom). Run: node test/run.js  (needs: npm i jsdom)
// Fake comment adapters are test fixtures, not real platform bridges.
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");
const LAYER = fs.readFileSync(path.join(__dirname, "..", "comment-layer.js"), "utf8");

let passed = 0, failed = 0;
function ok(cond, name) { if (cond) { passed++; console.log("  ok   " + name); } else { failed++; console.log("  FAIL " + name); } }
const tick = () => new Promise(r => setTimeout(r, 0));

function page(state, opts = {}) {
  const html = `<!doctype html><body><main id="m">
    <h1 data-covibe-id="h-title">Title</h1>
    <p data-covibe-id="p-one">First paragraph with <a href="#x" id="lnk">a link</a>.</p>
    <ul><li data-covibe-id="li-a">Item A</li></ul>
    <svg><g data-covibe-id="n-node"><rect width="10" height="10"/></g></svg>
    <p data-covibe-id="p-two">Second paragraph.</p>
  </main>
  <script type="application/json" id="covibe-state">${JSON.stringify(state)}</script></body>`;
  const dom = new JSDOM(html, { runScripts: "outside-only", url: "https://example.test/", pretendToBeVisual: true });
  const w = dom.window;
  if (opts.storage) for (const [k, v] of Object.entries(opts.storage)) w.localStorage.setItem(k, v);
  if (opts.brokenStorage) {
    Object.defineProperty(w, "localStorage", { value: { getItem() { throw new Error("x"); }, setItem() { throw new Error("quota"); }, removeItem() {} } });
  }
  if (opts.claude) w.claude = { use: async () => opts.claude };
  w.matchMedia = w.matchMedia || (() => ({ matches: false }));
  w.HTMLElement.prototype.scrollIntoView = function () {};
  w.eval(LAYER);
  return w;
}
function fakeClaude(log, canSend = "available") {
  return {
    anchorFor: async el => ({ path: "x", x: 0, y: 0, id: el.getAttribute && el.getAttribute("data-covibe-id") }),
    create: async ({ text }) => { log.push(["create", text]); return { threadId: "t" }; },
    sendToClaude: async ({ text }) => { log.push(["send", text]); return { threadId: "t" }; },
    canSendToClaude: async () => canSend
  };
}
function click(w, el) { el.dispatchEvent(new w.MouseEvent("click", { bubbles: true, cancelable: true })); }
function typeAndSend(w, id, text) {
  const ta = w.document.getElementById("cv-ta-" + id);
  ta.value = text; ta.dispatchEvent(new w.Event("input"));
  const btn = ta.parentNode.querySelector(".cv-btn");
  click(w, btn);
}
const base = (extra = {}) => Object.assign({ schema: "covibe/2", session: "t1", revision: 1, mode: "live", threads: {}, handled: [], versions: [{ revision: 1, summary: "first" }] }, extra);

(async () => {
  console.log("composer and anchoring");
  {
    const w = page(base());
    const c = w.Covibe.mount({ platform: "manual" }); await c.ready;
    click(w, w.document.querySelector("[data-covibe-id=p-one]"));
    ok(!!w.document.getElementById("cv-ta-p-one"), "tap on paragraph opens composer");
    ok(w.document.querySelector("[data-covibe-id=p-one]").nextElementSibling.classList.contains("cv-thread"), "composer sits below the paragraph");
    click(w, w.document.querySelector("[data-covibe-id=li-a]"));
    ok(w.document.querySelector("[data-covibe-id=li-a] > .cv-thread"), "list item thread stays inside the <li>");
    click(w, w.document.getElementById("cv-ta-p-one"));
    click(w, w.document.querySelector("[data-covibe-id=p-one] + .cv-thread .cv-composer"));
    ok(w.document.querySelectorAll(".cv-composer").length === 2 && w.document.querySelectorAll("[data-cv-for=p-one].cv-composer").length === 1, "clicks inside the comment layer do not open new composers");
    ok(c.mode() === "manual", "no platform trigger -> manual mode");
  }

  console.log("links keep working; review mode intercepts");
  {
    const w = page(base());
    const c = w.Covibe.mount({ platform: "manual" }); await c.ready;
    const ev = new w.MouseEvent("click", { bubbles: true, cancelable: true });
    w.document.getElementById("lnk").dispatchEvent(ev);
    ok(!ev.defaultPrevented && !w.document.getElementById("cv-ta-p-one"), "link click outside review mode is not intercepted");
    const reviewBtn = [...w.document.querySelectorAll(".cv-dock-btn")].find(b => /Review/.test(b.textContent));
    ok(reviewBtn && !reviewBtn.hidden, "review toggle shown when page has links");
    click(w, reviewBtn);
    const ev2 = new w.MouseEvent("click", { bubbles: true, cancelable: true });
    w.document.getElementById("lnk").dispatchEvent(ev2);
    ok(ev2.defaultPrevented && !!w.document.getElementById("cv-ta-p-one"), "in review mode link click opens composer instead");
  }

  console.log("manual mode: pending, export, plain text");
  {
    const w = page(base());
    const c = w.Covibe.mount({ platform: "manual" }); await c.ready;
    click(w, w.document.querySelector("[data-covibe-id=p-two]"));
    typeAndSend(w, "p-two", "<img src=x onerror=alert(1)> hello"); await tick();
    const p = c.pending();
    ok(p.length === 1 && /^c-/.test(p[0].id), "comment gets a comment ID and is pending");
    ok(JSON.parse(w.localStorage.getItem("covibe:t1:pending")).length === 1, "pending saved in session-scoped storage");
    const pend = w.document.querySelector(".cv-pending .cv-text");
    ok(pend && pend.textContent.startsWith("<img") && !w.document.querySelector(".cv-thread img"), "comment text shown as plain text, not HTML");
    ok(/\[p-two\|c-[a-z0-9]+\]/.test(c.exportText()), "export uses [element|comment] prefix");
    const batchBtn = [...w.document.querySelectorAll(".cv-dock-btn")].find(b => /Copy for chat/.test(b.textContent));
    ok(batchBtn && !batchBtn.hidden, "manual dock shows Copy for chat");
    click(w, batchBtn); await tick(); await tick();
    const exp = w.document.querySelector(".cv-export");
    ok(exp && !exp.hidden && /Copy failed/.test(exp.textContent), "clipboard unavailable -> selectable export text, honest message");
  }

  console.log("handled by ID clears pending on reload");
  {
    const w1 = page(base());
    const c1 = w1.Covibe.mount({ platform: "manual" }); await c1.ready;
    click(w1, w1.document.querySelector("[data-covibe-id=p-one]"));
    typeAndSend(w1, "p-one", "same text"); await tick();
    click(w1, w1.document.querySelector("[data-covibe-id=p-two]"));
    typeAndSend(w1, "p-two", "same text"); await tick();
    const [a, b] = c1.pending();
    const storage = { "covibe:t1:pending": w1.localStorage.getItem("covibe:t1:pending") };
    const st = base({ revision: 2, threads: { "p-one": [{ id: a.id, who: "user", text: "same text" }, { id: "r1", who: "agent", text: "done", rev: 2 }] }, handled: [a.id] });
    const w2 = page(st, { storage });
    const c2 = w2.Covibe.mount({ platform: "manual" }); await c2.ready;
    ok(c2.pending().length === 1 && c2.pending()[0].id === b.id, "only the handled ID is cleared, same-text comment stays");
  }

  console.log("unread replies");
  {
    const st = base({ revision: 3, threads: { "p-one": [{ id: "c1", who: "user", text: "q" }, { id: "r-old", who: "agent", text: "old", rev: 2 }, { id: "r-new", who: "agent", text: "new", rev: 3 }] }, handled: ["c1"] });
    const w = page(st);
    const c = w.Covibe.mount({ platform: "manual" }); await c.ready;
    const unread = w.document.querySelectorAll(".cv-unread");
    ok(unread.length === 1 && unread[0].getAttribute("data-cv-entry") === "r-new", "first visit: only current-revision reply is unread");
    const dockU = w.document.querySelector(".cv-dock-unread");
    ok(!dockU.hidden && /1 new reply/.test(dockU.textContent), "dock shows next-unread button");
    w.dispatchEvent(new w.Event("scroll"));
    ok(w.document.querySelectorAll(".cv-unread").length === 1, "scrolling does not mark read");
    click(w, w.document.querySelector(".cv-unread"));
    ok(w.document.querySelectorAll(".cv-unread").length === 0 && dockU.hidden, "tapping the reply marks it read");
  }

  console.log("small elements: marker and panel");
  {
    const st = base({ revision: 2, threads: { "n-node": [{ id: "r9", who: "agent", text: "note", rev: 2 }] } });
    const w = page(st);
    const c = w.Covibe.mount({ platform: "manual" }); await c.ready;
    const badge = w.document.querySelector(".cv-badge");
    ok(badge && !badge.hidden && badge.textContent === "1" && badge.classList.contains("cv-badge-unread"), "SVG node gets a count marker, unread colored");
    click(w, badge);
    const panel = w.document.querySelector(".cv-panel");
    ok(!panel.hidden && panel.querySelector("#cv-ta-n-node"), "marker opens panel with thread and composer");
    ok(!w.document.querySelector("svg .cv-thread"), "no thread markup injected into the SVG");
  }

  console.log("hide / show keeps drafts");
  {
    const w = page(base());
    const c = w.Covibe.mount({ platform: "manual" }); await c.ready;
    click(w, w.document.querySelector("[data-covibe-id=p-one]"));
    const ta = w.document.getElementById("cv-ta-p-one"); ta.value = "draft text"; ta.dispatchEvent(new w.Event("input"));
    c.setVisible(false);
    ok(w.document.documentElement.classList.contains("cv-hidden"), "hide adds root class");
    c.setVisible(true);
    ok(w.document.getElementById("cv-ta-p-one").value === "draft text", "draft survives hide/show");
  }

  console.log("Claude adapter: live, batch, marks");
  {
    const log = [];
    const w = page(base({ mode: "live" }), { claude: fakeClaude(log) });
    const c = w.Covibe.mount(); await c.ready;
    click(w, w.document.querySelector("[data-covibe-id=p-one]"));
    typeAndSend(w, "p-one", "live text"); await tick(); await tick();
    ok(log.length === 1 && log[0][0] === "send" && /^\[p-one\|c-/.test(log[0][1]), "live text comment -> one sendToClaude with prefix");
    const markBtn = w.document.querySelector(".cv-markbtn");
    click(w, markBtn); await tick(); await tick();
    ok(log.length === 2 && log[1][0] === "create", "mark-only comment -> plain create, no trigger");
  }
  {
    const log = [];
    const w = page(base({ mode: "batch", batchSize: 3 }), { claude: fakeClaude(log) });
    const c = w.Covibe.mount(); await c.ready;
    const node = w.document.querySelector("[data-covibe-id=p-two]");
    click(w, node);
    w.document.querySelector(".cv-markbtn").click(); await tick(); await tick();
    for (let i = 1; i <= 2; i++) { typeAndSend(w, "p-two", "t" + i); await tick(); await tick(); }
    ok(log.filter(l => l[0] === "send").length === 0, "below threshold: no trigger");
    typeAndSend(w, "p-two", "t3"); await tick(); await tick(); await tick();
    const sends = log.filter(l => l[0] === "send");
    ok(sends.length === 1 && /4 waiting/.test(sends[0][1]), "threshold of text comments triggers one batch, marks included");
    typeAndSend(w, "p-two", "t4"); await tick(); await tick();
    ok(log.filter(l => l[0] === "send").length === 1, "already-requested IDs are not re-triggered");
    const dockBatch = [...w.document.querySelectorAll(".cv-dock-btn")].find(b => /Process now/.test(b.textContent));
    click(w, dockBatch); await tick(); await tick(); await tick();
    const s2 = log.filter(l => l[0] === "send");
    ok(s2.length === 2 && /1 waiting/.test(s2[1][1]), "Process now sends only the new unrequested comment");
  }
  {
    const log = [];
    const w = page(base({ mode: "live" }), { claude: fakeClaude(log, "no_session") });
    const c = w.Covibe.mount(); await c.ready;
    click(w, w.document.querySelector("[data-covibe-id=p-one]"));
    typeAndSend(w, "p-one", "x"); await tick(); await tick();
    ok(log.length === 1 && log[0][0] === "create", "trigger unavailable -> stored as plain comment, not claimed as sent");
  }

  console.log("storage failure is reported");
  {
    const w = page(base(), { brokenStorage: true });
    const c = w.Covibe.mount({ platform: "manual" }); await c.ready;
    click(w, w.document.querySelector("[data-covibe-id=p-one]"));
    typeAndSend(w, "p-one", "hello"); await tick(); await tick();
    const msg = w.document.querySelector(".cv-msg");
    ok(!c.storageOk() && /Not saved on this device/.test(msg.textContent), "failed local save shows a warning, not 'saved'");
  }

  console.log("trash, version log, schema");
  {
    const st = base({ trash: [{ id: "old-1", label: "Old section", html: "<p>gone</p>" }], versions: [{ revision: 1, summary: "first" }, { revision: 2, summary: "second" }] });
    const w = page(st);
    const c = w.Covibe.mount({ platform: "manual" }); await c.ready;
    const item = w.document.querySelector(".cv-trash-item[data-covibe-id=old-1]");
    ok(item && item.tagName === "DETAILS" && !item.open, "trash item rendered collapsed with original ID");
    ok(w.document.querySelectorAll(".cv-versions li").length === 2, "version log has one line per revision");
    let threw = false;
    try { const w2 = page(base({ schema: "covibe/3" })); w2.Covibe.mount({ platform: "manual" }); } catch (e) { threw = true; }
    ok(threw, "unsupported schema major version is rejected");
  }

  console.log("destroy");
  {
    const w = page(base());
    const c = w.Covibe.mount({ platform: "manual" }); await c.ready;
    c.destroy();
    click(w, w.document.querySelector("[data-covibe-id=p-one]"));
    ok(!w.document.querySelector(".cv-ui") && !w.document.getElementById("cv-ta-p-one"), "destroy removes UI and listeners");
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();
