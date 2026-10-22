/*! covibe comment layer 2.0.0 — dependency-free, MIT-style use. Paste inline into a page. */
(function (global) {
  "use strict";

  var STR = {
    en: {
      placeholder: "Comment on this",
      send: "Send", close: "Close", marks: { like: "Like", dislike: "Dislike", explain: "Explain", delete: "Delete" },
      waiting: "waiting", you: "You", agent: "Agent", unreadTag: "New · tap to mark read",
      waitingForYou: "Waiting for you",
      saved: "Saved", sentLive: "Sent to the agent", markSaved: "Saved. Marks go with the next batch.",
      queued: function (n, N) { return "Saved (" + n + "/" + N + ")"; },
      batchSent: function (n) { return "Sent " + n + " comments to the agent"; },
      manualSaved: "Saved on this device. Use “Copy for chat” to hand it over.",
      notSaved: "Not saved on this device. It will be lost if you reload.",
      failed: "Not sent. Your text is kept. Try again.",
      consent: "Not sent: allow this page to comment for you, then try again.",
      mobileHint: "After sending, the app may switch to the chat. Reopen this page to see replies.",
      processNow: function (n) { return n + " waiting · Process now"; },
      copyForChat: function (n) { return n + " waiting · Copy for chat"; },
      manualLabel: "Manual handoff: copying does not start the agent. Paste the text into the chat.",
      copied: "Copied. Paste it into the chat.",
      copyFailed: "Copy failed. Select the text below and copy it.",
      unread: function (n) { return n + " new " + (n === 1 ? "reply" : "replies") + " ↓"; },
      hide: "Hide comments", show: "Show comments",
      reviewOn: "Review mode: on", reviewOff: "Review mode: off",
      trash: "Trash", trashEmpty: "Nothing deleted yet.", versions: "Version log",
      nothingWaiting: "Nothing waiting."
    },
    zh: {
      placeholder: "评论这里",
      send: "发送", close: "关闭", marks: { like: "喜欢", dislike: "不喜欢", explain: "解释一下", delete: "删掉" },
      waiting: "等回复", you: "你", agent: "Agent", unreadTag: "新回复 · 点一下标为已读",
      waitingForYou: "等你决定",
      saved: "已保存", sentLive: "已发给 agent", markSaved: "已保存，标记会随下一批一起处理。",
      queued: function (n, N) { return "已保存（" + n + "/" + N + "）"; },
      batchSent: function (n) { return "已把 " + n + " 条评论发给 agent"; },
      manualSaved: "已保存在本机。用“复制到聊天”交给 agent。",
      notSaved: "本机没有保存成功，刷新页面就会丢失。",
      failed: "没发出，文字还在，再试一次。",
      consent: "没发出：请允许页面以你的名义评论，然后再试。",
      mobileHint: "发送后 App 可能会跳回聊天，回来重新打开页面就能看到回复。",
      processNow: function (n) { return n + " 条在等 · 立即处理"; },
      copyForChat: function (n) { return n + " 条在等 · 复制到聊天"; },
      manualLabel: "手动交接：复制不会唤醒 agent，请把文字粘贴到聊天里。",
      copied: "已复制，粘贴到聊天里即可。",
      copyFailed: "复制失败，请选中下面的文字手动复制。",
      unread: function (n) { return n + " 条新回复 ↓"; },
      hide: "隐藏对话", show: "显示对话",
      reviewOn: "评审模式：开", reviewOff: "评审模式：关",
      trash: "回收站", trashEmpty: "还没有被删除的内容。", versions: "版本记录",
      nothingWaiting: "没有在等的评论。"
    }
  };

  var MARKS = ["like", "dislike", "explain", "delete"];
  var INTERACTIVE = "a,button,input,select,textarea,label,summary,[role=button],[contenteditable=true]";
  var INSIDE_TAGS = { LI: 1, TD: 1, TH: 1, DT: 1, DD: 1 };
  var AFTER_TAGS = { P: 1, H1: 1, H2: 1, H3: 1, H4: 1, H5: 1, H6: 1, SPAN: 1, A: 1, BUTTON: 1, IMG: 1, PRE: 1, BLOCKQUOTE: 1, LABEL: 1, CODE: 1 };

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function rid() { return "c-" + Math.random().toString(36).slice(2, 7) + Date.now().toString(36).slice(-3); }
  function isSmall(node) {
    return node.hasAttribute("data-covibe-small") || (typeof SVGElement !== "undefined" && node instanceof SVGElement);
  }

  /* ---------- storage (scoped by session; reports failure honestly) ---------- */
  function Store(session) {
    this.prefix = "covibe:" + session + ":";
    this.ok = true;
    try {
      var k = this.prefix + "probe";
      localStorage.setItem(k, "1"); localStorage.removeItem(k);
    } catch (e) { this.ok = false; }
    this.mem = {};
  }
  Store.prototype.get = function (k, dflt) {
    try { var v = localStorage.getItem(this.prefix + k); return v == null ? (k in this.mem ? this.mem[k] : dflt) : JSON.parse(v); }
    catch (e) { return k in this.mem ? this.mem[k] : dflt; }
  };
  Store.prototype.set = function (k, v) {
    this.mem[k] = v;
    try { localStorage.setItem(this.prefix + k, JSON.stringify(v)); return true; }
    catch (e) { this.ok = false; return false; }
  };

  /* ---------- adapters ---------- */
  function manualAdapter() {
    return {
      kind: "manual", canTrigger: false,
      persist: function () { return Promise.resolve(); },
      trigger: function () { return Promise.reject({ code: "no_trigger" }); }
    };
  }
  function claudeAdapter(c) {
    return {
      kind: "claude", canTrigger: false, c: c,
      refresh: function () {
        var self = this;
        if (!c.canSendToClaude) return Promise.resolve(false);
        return c.canSendToClaude().then(function (s) { self.canTrigger = s === "available"; return self.canTrigger; }, function () { self.canTrigger = false; return false; });
      },
      persist: function (node, text) {
        return c.anchorFor(node).then(function (anchor) { return c.create({ anchor: anchor, text: text }); });
      },
      trigger: function (node, text) {
        return c.anchorFor(node).then(function (anchor) { return c.sendToClaude({ anchor: anchor, text: text }); });
      }
    };
  }
  function detectAdapter(platform) {
    if (platform === "manual") return Promise.resolve(manualAdapter());
    var use = global.claude && global.claude.use;
    if (!use) return Promise.resolve(manualAdapter());
    return Promise.resolve(use.call(global.claude, "comments")).then(function (c) {
      if (!c) return manualAdapter();
      var a = claudeAdapter(c);
      return a.refresh().then(function () { return a; });
    }, function () { return manualAdapter(); });
  }

  /* ---------- formatting ---------- */
  function fmtComment(p) {
    var s = "[" + p.el + "|" + p.id + "]";
    if (p.mark) s += " [" + p.mark + "]";
    if (p.quote) s += " «" + p.quote + "»";
    if (p.text) s += " " + p.text;
    return s;
  }

  /* ---------- main ---------- */
  function mount(opts) {
    opts = opts || {};
    var root = opts.root || document.body;
    var stateEl = typeof opts.state === "string" ? document.querySelector(opts.state) : null;
    var state = opts.state && typeof opts.state === "object" ? opts.state : null;
    if (!state) {
      try { state = JSON.parse((stateEl || document.getElementById("covibe-state")).textContent); }
      catch (e) { throw new Error("covibe: state JSON not found or invalid"); }
    }
    if (!state.session) throw new Error("covibe: state.session is required");
    if (String(state.schema || "covibe/2").split("/")[1] !== "2") throw new Error("covibe: unsupported schema " + state.schema);

    var T = STR[opts.lang || state.lang || "en"] || STR.en;
    var store = new Store(state.session);
    var threads = state.threads || {};
    var handled = {};
    (state.handled || []).forEach(function (id) { handled[id] = 1; });
    var mode = state.mode || "live";
    var N = state.batchSize || 5;
    var adapter = manualAdapter();
    var touch = typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches;
    var review = false, visible = store.get("visible", true);
    var cleanup = [];
    var ui = el("div", "cv-ui");
    document.body.appendChild(ui);

    // drop pending entries the published page already handled
    var pending = store.get("pending", []).filter(function (p) { return !handled[p.id]; });
    store.set("pending", pending);

    // read state: on first visit, only replies from the current revision count as new
    var seen = store.get("seen", null);
    if (!Array.isArray(seen)) {
      seen = [];
      Object.keys(threads).forEach(function (k) { threads[k].forEach(function (e) { if (e.who === "agent" && (e.rev || 0) < (state.revision || 0)) seen.push(e.id); }); });
      store.set("seen", seen);
    }
    var seenSet = {}; seen.forEach(function (id) { seenSet[id] = 1; });

    function targets() { return Array.prototype.slice.call(root.querySelectorAll("[data-covibe-id]")).filter(function (n) { return !n.closest(".cv-ui,.cv-thread,.cv-composer"); }); }
    function byId(id) {
      var list = targets();
      for (var i = 0; i < list.length; i++) if (list[i].getAttribute("data-covibe-id") === id) return list[i];
      return null;
    }
    function labelOf(node) { return node.getAttribute("data-covibe-label") || (node.textContent || "").trim().slice(0, 60) || node.getAttribute("data-covibe-id"); }

    /* ---------- thread rendering ---------- */
    function entryNode(e) {
      var mine = e.who !== "agent";
      var d = el("div", mine ? "cv-entry cv-you" : "cv-entry cv-agent");
      d.setAttribute("data-cv-entry", e.id || "");
      var by = el("span", "cv-by", mine ? T.you : (state.agentName || T.agent));
      d.appendChild(by);
      if (e.mark) d.appendChild(el("span", "cv-mark", "[" + (T.marks[e.mark] || e.mark) + "]"));
      if (e.quote) d.appendChild(el("q", "cv-quote", e.quote));
      if (e.text) d.appendChild(el("span", "cv-text", e.text));
      if (!mine && e.id && !seenSet[e.id]) {
        d.classList.add("cv-unread");
        d.setAttribute("tabindex", "0");
        d.appendChild(el("span", "cv-unread-tag", T.unreadTag));
        var mark = function (ev) { ev.stopPropagation(); markRead(e.id); };
        d.addEventListener("click", mark);
        d.addEventListener("keydown", function (ev) { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); mark(ev); } });
      }
      return d;
    }
    function pendingNode(p) {
      var d = entryNode({ who: "user", text: p.text, mark: p.mark, quote: p.quote, id: p.id });
      d.classList.add("cv-pending");
      d.appendChild(el("span", "cv-wait", T.waiting));
      return d;
    }
    function entriesFor(id) {
      var list = (threads[id] || []).map(entryNode);
      pending.filter(function (p) { return p.el === id; }).forEach(function (p) { list.push(pendingNode(p)); });
      return list;
    }
    function placeAfter(node, box) {
      if (INSIDE_TAGS[node.tagName]) node.appendChild(box);
      else if (AFTER_TAGS[node.tagName] || isSmall(node)) node.parentNode.insertBefore(box, node.nextSibling);
      else node.appendChild(box);
    }
    function threadBox(node, create) {
      var id = node.getAttribute("data-covibe-id");
      var box = null;
      var probe = INSIDE_TAGS[node.tagName] || !(AFTER_TAGS[node.tagName]) ? node.querySelector(":scope > .cv-thread[data-cv-for='" + cssEsc(id) + "']") : null;
      if (probe) box = probe;
      else { var sib = node.nextElementSibling; if (sib && sib.classList.contains("cv-thread") && sib.getAttribute("data-cv-for") === id) box = sib; }
      if (!box && create) { box = el("div", "cv-thread"); box.setAttribute("data-cv-for", id); placeAfter(node, box); }
      return box;
    }
    function cssEsc(s) { return String(s).replace(/['\\]/g, "\\$&"); }

    function renderBlock(node) {
      var id = node.getAttribute("data-covibe-id");
      var list = entriesFor(id);
      var box = threadBox(node, list.length > 0 || !!(state.status && state.status[id]));
      if (!box) return;
      var keepComposer = box.querySelector(".cv-composer");
      box.innerHTML = "";
      if (state.status && state.status[id] === "waiting-for-user") box.appendChild(el("div", "cv-status", T.waitingForYou));
      list.forEach(function (n) { box.appendChild(n); });
      if (keepComposer) box.appendChild(keepComposer);
      if (!box.children.length) box.remove();
    }

    /* ---------- markers + panel for small elements ---------- */
    var badges = {};
    var panel = el("div", "cv-panel"); panel.hidden = true; ui.appendChild(panel);
    var panelFor = null;
    function unreadIn(id) { return (threads[id] || []).some(function (e) { return e.who === "agent" && e.id && !seenSet[e.id]; }); }
    function countIn(id) { return (threads[id] || []).length + pending.filter(function (p) { return p.el === id; }).length; }
    function placeBadges() {
      targets().forEach(function (node) {
        if (!isSmall(node)) return;
        var id = node.getAttribute("data-covibe-id"), n = countIn(id), b = badges[id];
        if (!n) { if (b) b.hidden = true; return; }
        if (!b) {
          b = el("button", "cv-badge"); b.type = "button";
          b.addEventListener("click", function (ev) { ev.stopPropagation(); open(id); });
          ui.appendChild(b); badges[id] = b;
        }
        var r = node.getBoundingClientRect();
        b.hidden = false; b.textContent = n;
        b.classList.toggle("cv-badge-unread", unreadIn(id));
        b.setAttribute("aria-label", labelOf(node) + ": " + n);
        b.style.left = (r.right + global.scrollX - 10) + "px";
        b.style.top = (r.top + global.scrollY - 10) + "px";
      });
    }
    function renderPanel(id) {
      var node = byId(id); if (!node) return;
      panel.innerHTML = "";
      var head = el("div", "cv-panel-head");
      var t = el("button", "cv-panel-title", labelOf(node)); t.type = "button";
      t.addEventListener("click", function () { reveal(node); });
      var x = el("button", "cv-btn-ghost", T.close); x.type = "button";
      x.addEventListener("click", closePanel);
      head.appendChild(t); head.appendChild(x); panel.appendChild(head);
      var list = el("div", "cv-thread cv-thread-panel");
      if (state.status && state.status[id] === "waiting-for-user") list.appendChild(el("div", "cv-status", T.waitingForYou));
      entriesFor(id).forEach(function (n) { list.appendChild(n); });
      panel.appendChild(list);
      panel.appendChild(composer(node));
      var narrow = typeof matchMedia !== "undefined" && matchMedia("(max-width: 700px)").matches;
      panel.classList.toggle("cv-sheet", narrow);
      if (!narrow) {
        var r = node.getBoundingClientRect();
        var left = r.right + 12; if (left + 340 > global.innerWidth) left = Math.max(12, r.left - 340);
        panel.style.left = (left + global.scrollX) + "px";
        panel.style.top = (Math.max(12, r.top) + global.scrollY) + "px";
      } else { panel.style.left = ""; panel.style.top = ""; }
    }
    function closePanel() { panel.hidden = true; panelFor = null; highlight(null); }

    /* ---------- composer ---------- */
    function composer(node, quote) {
      var id = node.getAttribute("data-covibe-id");
      var box = el("div", "cv-composer");
      box.setAttribute("data-cv-for", id);
      var marks = el("div", "cv-marks");
      var ta = el("textarea", "cv-input"); ta.id = "cv-ta-" + id; ta.maxLength = 1500; ta.placeholder = T.placeholder;
      ta.value = store.get("draft:" + id, "") || "";
      if (quote) ta.setAttribute("data-quote", quote);
      ta.addEventListener("input", function () { store.set("draft:" + id, ta.value); });
      var row = el("div", "cv-row");
      var sendBtn = el("button", "cv-btn", T.send); sendBtn.type = "button";
      var closeBtn = el("button", "cv-btn-ghost", T.close); closeBtn.type = "button";
      var msg = el("span", "cv-msg"); msg.setAttribute("aria-live", "polite");
      MARKS.forEach(function (m) {
        var b = el("button", "cv-markbtn", T.marks[m]); b.type = "button";
        b.addEventListener("click", function () { submit(m); });
        marks.appendChild(b);
      });
      sendBtn.addEventListener("click", function () { submit(null); });
      closeBtn.addEventListener("click", function () { if (box.closest(".cv-panel")) closePanel(); else { box.remove(); renderBlock(node); } });
      row.appendChild(sendBtn); row.appendChild(closeBtn); row.appendChild(msg);
      if (quote) box.appendChild(el("q", "cv-quote", quote));
      box.appendChild(marks); box.appendChild(ta); box.appendChild(row);
      if (adapter.kind === "manual") box.appendChild(el("p", "cv-hint", T.manualLabel));
      else if (touch) box.appendChild(el("p", "cv-hint", T.mobileHint));
      box.addEventListener("click", function (ev) { ev.stopPropagation(); });

      function say(text, cls) { msg.textContent = text; msg.className = "cv-msg" + (cls ? " " + cls : ""); }
      function submit(mark) {
        var text = ta.value.trim();
        if (!text && !mark) { ta.focus(); return; }
        var p = { id: rid(), el: id, text: text, mark: mark || undefined, quote: ta.getAttribute("data-quote") || undefined, at: new Date().toISOString(), requested: false };
        // persist locally before any transport
        pending.push(p);
        var savedLocally = store.set("pending", pending);
        ta.value = ""; ta.removeAttribute("data-quote"); store.set("draft:" + id, "");
        refreshAll();
        var warn = savedLocally ? "" : " " + T.notSaved;
        sendBtn.disabled = true;
        deliver(node, p).then(function (res) {
          say(res + warn, savedLocally ? "cv-ok" : "cv-warn");
        }, function (e) {
          say((e && e.code === "consent_required" ? T.consent : T.failed) + warn, "cv-warn");
        }).then(function () { sendBtn.disabled = false; refreshDock(); });
      }
      return box;
    }

    /* ---------- delivery ---------- */
    function unrequestedText() { return pending.filter(function (p) { return !p.requested && p.text; }).length; }
    function deliver(node, p) {
      if (adapter.kind === "manual") return Promise.resolve(T.manualSaved);
      var text = fmtComment(p);
      var isLiveText = mode === "live" && p.text && adapter.canTrigger;
      if (isLiveText) {
        return adapter.trigger(node, text).then(function () { p.requested = true; store.set("pending", pending); return T.sentLive; });
      }
      return adapter.persist(node, text).then(function () {
        if (mode === "batch" && p.text && unrequestedText() >= N && adapter.canTrigger) return flush().then(function (n) { return T.batchSent(n); });
        if (!p.text) return T.markSaved;
        return mode === "batch" ? T.queued(unrequestedText(), N) : T.saved;
      });
    }
    var flushing = false;
    function flush() {
      var batch = pending.filter(function (p) { return !p.requested; });
      if (!batch.length || flushing) return Promise.resolve(0);
      flushing = true;
      var anchor = dockBatch;
      var text = "[batch] " + batch.length + " waiting: " + batch.map(function (p) { return p.el + "|" + p.id; }).join(", ");
      return adapter.trigger(anchor, text).then(function () {
        batch.forEach(function (p) { p.requested = true; });
        store.set("pending", pending);
        return batch.length;
      }).then(function (n) { flushing = false; refreshDock(); return n; }, function (e) { flushing = false; throw e; });
    }
    function exportText() {
      var list = pending.filter(function (p) { return !handled[p.id]; });
      return "covibe " + state.session + " r" + (state.revision || 0) + "\n" + list.map(fmtComment).join("\n");
    }

    /* ---------- open / reveal / highlight ---------- */
    function highlight(node) {
      targets().forEach(function (n) { n.classList.remove("cv-hl"); });
      if (node) node.classList.add("cv-hl");
    }
    function reveal(node) {
      var p = node.parentElement;
      while (p) { if (p.tagName === "DETAILS" && !p.open) p.open = true; p = p.parentElement; }
      if (typeof opts.onReveal === "function") opts.onReveal(node);
      var smooth = !(typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches);
      if (node.scrollIntoView) node.scrollIntoView({ block: "center", behavior: smooth ? "smooth" : "auto" });
      highlight(node);
    }
    function open(id, quote) {
      var node = byId(id); if (!node) return;
      if (!visible) setVisible(true);
      if (isSmall(node)) { panelFor = id; highlight(node); renderPanel(id); panel.hidden = false; return; }
      var box = threadBox(node, true);
      var c = box.querySelector(".cv-composer");
      if (!c) { c = composer(node, quote); box.appendChild(c); }
      else if (quote) {
        var old = c.querySelector(":scope > .cv-quote");
        if (old) old.textContent = quote; else c.insertBefore(el("q", "cv-quote", quote), c.firstChild);
        c.querySelector(".cv-input").setAttribute("data-quote", quote);
      }
      var t = c.querySelector(".cv-input"); if (t && t.focus) t.focus();
    }

    /* ---------- unread ---------- */
    function markRead(id) {
      if (seenSet[id]) return;
      seenSet[id] = 1; seen.push(id); store.set("seen", seen.slice(-1000));
      refreshAll();
    }
    function unreadOrder() {
      var out = [];
      targets().forEach(function (n) {
        var id = n.getAttribute("data-covibe-id");
        (threads[id] || []).forEach(function (e) { if (e.who === "agent" && e.id && !seenSet[e.id]) out.push({ el: id, entry: e.id }); });
      });
      return out;
    }
    function nextUnread() {
      var u = unreadOrder()[0]; if (!u) return null;
      var node = byId(u.el);
      if (!visible) setVisible(true);
      if (isSmall(node)) { reveal(node); open(u.el); }
      else {
        reveal(node);
        var box = threadBox(node, false);
        var target = box && box.querySelector("[data-cv-entry='" + cssEsc(u.entry) + "']");
        if (target && target.focus) target.focus({ preventScroll: true });
      }
      return u.entry;
    }

    /* ---------- dock ---------- */
    var dock = el("div", "cv-dock"); ui.appendChild(dock);
    var dockUnread = el("button", "cv-dock-btn cv-dock-unread"); dockUnread.type = "button";
    var dockBatch = el("button", "cv-dock-btn"); dockBatch.type = "button";
    var dockReview = el("button", "cv-dock-btn cv-dock-ghost"); dockReview.type = "button";
    var dockHide = el("button", "cv-dock-btn cv-dock-ghost"); dockHide.type = "button";
    var exportBox = el("div", "cv-export"); exportBox.hidden = true;
    var exportArea = el("textarea", "cv-input"); exportArea.readOnly = true; exportArea.id = "cv-export-text";
    var exportMsg = el("p", "cv-hint");
    var exportClose = el("button", "cv-btn-ghost", T.close); exportClose.type = "button";
    exportBox.appendChild(exportMsg); exportBox.appendChild(exportArea); exportBox.appendChild(exportClose);
    ui.appendChild(exportBox);
    exportClose.addEventListener("click", function () { exportBox.hidden = true; });
    [dockUnread, dockBatch, dockReview, dockHide].forEach(function (b) { dock.appendChild(b); });
    dockUnread.addEventListener("click", nextUnread);
    dockHide.addEventListener("click", function () { setVisible(!visible); });
    dockReview.addEventListener("click", function () { review = !review; document.documentElement.classList.toggle("cv-review", review); refreshDock(); });
    dockBatch.addEventListener("click", function () {
      var n = pending.filter(function (p) { return !p.requested; }).length;
      if (adapter.kind === "manual") return copyExport();
      if (!n) return;
      dockBatch.disabled = true;
      flush().then(function (k) { dockBatch.textContent = T.batchSent(k); }, function () { dockBatch.textContent = T.failed; })
        .then(function () { setTimeout(function () { dockBatch.disabled = false; refreshDock(); }, 1500); });
    });
    function copyExport() {
      var text = exportText();
      var done = function (ok) {
        exportArea.value = text;
        exportMsg.textContent = ok ? T.copied : T.copyFailed;
        exportBox.hidden = ok;
        if (!ok) { exportArea.focus(); exportArea.select(); }
        dockBatch.textContent = ok ? T.copied : T.copyFailed;
        setTimeout(refreshDock, 1800);
      };
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(false); });
        else done(false);
      } catch (e) { done(false); }
    }
    function hasInteractive() { return targets().some(function (n) { return n.matches(INTERACTIVE) || n.querySelector(INTERACTIVE); }); }
    function refreshDock() {
      var u = unreadOrder().length;
      dockUnread.hidden = u === 0; dockUnread.textContent = T.unread(u);
      var waiting = pending.filter(function (p) { return !p.requested; }).length;
      if (adapter.kind === "manual") { dockBatch.hidden = waiting === 0; dockBatch.textContent = T.copyForChat(waiting); }
      else if (mode === "batch") { dockBatch.hidden = false; dockBatch.textContent = T.processNow(waiting); }
      else dockBatch.hidden = true;
      dockReview.hidden = !hasInteractive();
      dockReview.textContent = review ? T.reviewOn : T.reviewOff;
      dockReview.classList.toggle("cv-on", review);
      dockHide.textContent = visible ? T.hide : T.show;
    }
    function setVisible(v) {
      visible = !!v; store.set("visible", visible);
      document.documentElement.classList.toggle("cv-hidden", !visible);
      if (!visible) closePanel();
      refreshDock();
    }

    /* ---------- trash + version log ---------- */
    function renderMeta() {
      var host = document.getElementById("covibe-meta");
      if (!host) { host = el("section", ""); host.id = "covibe-meta"; root.appendChild(host); }
      host.innerHTML = "";
      host.classList.add("cv-meta");
      var th = el("h2", "cv-meta-title", T.trash); host.appendChild(th);
      var trash = state.trash || [];
      if (!trash.length) host.appendChild(el("p", "cv-hint", T.trashEmpty));
      trash.forEach(function (t) {
        var d = el("details", "cv-trash-item");
        d.setAttribute("data-covibe-id", t.id);
        d.setAttribute("data-covibe-label", t.label || t.id);
        var s = el("summary", "", t.label || t.id); d.appendChild(s);
        var body = el("div", "cv-trash-body");
        body.innerHTML = t.html || ""; // agent-authored content, not user comment text
        d.appendChild(body);
        host.appendChild(d);
      });
      var vh = el("h2", "cv-meta-title", T.versions); host.appendChild(vh);
      var ol = el("ol", "cv-versions"); ol.reversed = true;
      (state.versions || []).slice().reverse().forEach(function (v) {
        var li = el("li", ""); li.appendChild(el("b", "", "r" + v.revision + " ")); li.appendChild(document.createTextNode(v.summary || "")); ol.appendChild(li);
      });
      host.appendChild(ol);
    }

    /* ---------- refresh ---------- */
    function refreshAll() {
      targets().forEach(function (n) { if (!isSmall(n)) renderBlock(n); });
      placeBadges();
      if (panelFor && !panel.hidden) renderPanel(panelFor);
      refreshDock();
    }

    /* ---------- events ---------- */
    function onClick(ev) {
      if (ev.target.closest(".cv-ui,.cv-thread,.cv-composer")) return;
      var node = ev.target.closest("[data-covibe-id]");
      if (!node || !root.contains(node)) { if (!panel.hidden && !ev.target.closest(".cv-panel")) closePanel(); return; }
      var inter = ev.target.closest(INTERACTIVE);
      if (inter && node.contains(inter) && inter.tagName !== "SUMMARY") {
        if (!review) return; // links and buttons keep working outside review mode
        ev.preventDefault();
      }
      if (inter && inter.tagName === "SUMMARY" && !review) return;
      var sel = global.getSelection && global.getSelection();
      var quote = sel && !sel.isCollapsed && node.contains(sel.anchorNode) ? String(sel).trim().slice(0, 300) : "";
      open(node.getAttribute("data-covibe-id"), quote || undefined);
    }
    function onKey(ev) {
      if (ev.key !== "Enter" && ev.key !== " ") return;
      var node = ev.target;
      if (!node.hasAttribute || !node.hasAttribute("data-covibe-id")) return;
      if (node.matches(INTERACTIVE) && !review) return;
      ev.preventDefault();
      open(node.getAttribute("data-covibe-id"));
    }
    function onResize() { placeBadges(); if (panelFor && !panel.hidden) renderPanel(panelFor); }
    root.addEventListener("click", onClick, true);
    root.addEventListener("keydown", onKey);
    global.addEventListener("resize", onResize);
    cleanup.push(function () { root.removeEventListener("click", onClick, true); root.removeEventListener("keydown", onKey); global.removeEventListener("resize", onResize); });

    renderMeta();
    targets().forEach(function (n) {
      n.classList.add("cv-target");
      if (!n.matches(INTERACTIVE) && !n.hasAttribute("tabindex")) n.setAttribute("tabindex", "0");
    });
    document.documentElement.classList.toggle("cv-hidden", !visible);
    refreshAll();

    var ready = detectAdapter(opts.platform || "auto").then(function (a) {
      adapter = a;
      if (a.kind === "manual") mode = "manual";
      refreshAll();
      return a.kind;
    });

    return {
      ready: ready,
      open: open,
      setVisible: setVisible,
      nextUnread: nextUnread,
      markRead: markRead,
      exportText: exportText,
      pending: function () { return pending.slice(); },
      mode: function () { return mode; },
      storageOk: function () { return store.ok; },
      destroy: function () { cleanup.forEach(function (f) { f(); }); ui.remove(); document.querySelectorAll(".cv-thread").forEach(function (n) { n.remove(); }); }
    };
  }

  global.Covibe = { mount: mount, version: "2.0.0", _format: fmtComment };
})(typeof window !== "undefined" ? window : this);
