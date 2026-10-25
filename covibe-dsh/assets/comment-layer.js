/*!
 * covibe comment layer — DSH port 1.0.0
 * Dependency-free, environment-agnostic. Paste inline into a page.
 *
 * The page supplies one config object (window.COVIBE) and one state blob
 * (rewritten by the agent at every publish):
 *
 *   window.COVIBE = {
 *     state: { ...covibe/2 state... } | "#covibe-state",  // or a <script type="application/json">
 *     transport: "manual" | "post" | "none",
 *     endpoint: "http://127.0.0.1:8787/cv/comments",      // transport "post"
 *     token: "…",                                        // sent as X-Covibe-Token
 *     mode: "live" | "batch" | "manual",
 *     batchN: 5,
 *     pageId: "…", pageVersion: 3,
 *     lang: "en" | "zh"
 *   };
 *   Covibe.mount({ root: document.getElementById("covibe-root") });
 *
 * The page NEVER reads or writes the comment store. Threads and handled IDs
 * only arrive through the injected state; delivery leaves the page through
 * one of the pluggable transports above.
 */
(function (global) {
  "use strict";

  var VERSION = "1.0.0-dsh"; var MARKS = ["like", "dislike", "explain", "delete"]; var MAX_TEXT = 1500; var MAX_QUOTE = 300;
  var SWAP_QUIET_MS = 2000; var SWAP_TOAST_MS = 2500;
  var INSIDE_TAGS = { LI: 1, TD: 1, TH: 1, DT: 1, DD: 1 };
  var AFTER_TAGS = { P: 1, H1: 1, H2: 1, H3: 1, H4: 1, H5: 1, H6: 1, SPAN: 1, A: 1, BUTTON: 1, IMG: 1, PRE: 1, BLOCKQUOTE: 1, LABEL: 1, CODE: 1, DETAILS: 1, SVG: 1, FIGURE: 1, CAPTION: 1 };
  var SMALL_TAGS = { G: 1, PATH: 1, CIRCLE: 1, RECT: 1, LINE: 1, POLYGON: 1, POLYLINE: 1, ELLIPSE: 1, TEXT: 1, TSPAN: 1, USE: 1, IMAGE: 1, MARKER: 1 };
  var INTERACTIVE_TAGS = { A: 1, BUTTON: 1, INPUT: 1, SELECT: 1, TEXTAREA: 1, LABEL: 1, SUMMARY: 1, AUDIO: 1, VIDEO: 1 };

  // strings
  var STR = {
    en: {
      placeholder: "Comment on this", send: "Send", close: "Close", sending: "Sending…",
      marks: { like: "Like", dislike: "Dislike", explain: "Explain", delete: "Delete" },
      waiting: "waiting", you: "You", agent: "Agent", unreadTag: "New · tap to mark read",
      waitingForYou: "Waiting for you", restoreHint: "To restore an item, comment “restore” on it.",
      sentLive: "Sent to the agent.", markQueued: "Mark saved. It will go with your next text comment.", markSent: "Mark sent.",
      updated: function (rev) { return "Updated to r" + rev; },
      markQueuedShort: "saved for the next text comment",
      manualSaved: "Saved on this device. Use “Copy for chat” to hand it over.",
      noneSaved: "Saved on this device only. Delivery is disabled on this page.",
      notSaved: "Not saved on this device. It will be lost if you reload.",
      notDelivered: "Not delivered. The comment is kept on this page: press Retry.",
      notDeliveredShort: "not delivered · retry",
      manualLabel: "Manual handoff: copying does not start the agent. Paste the text into the chat.",
      copied: "Copied. Paste it into the chat.", copyFailed: "Copy failed. Select the text below and copy it.",
      hide: "Hide comments", show: "Show comments", reviewOn: "Review mode: on", reviewOff: "Review mode: off",
      trash: "Trash", trashEmpty: "Nothing deleted yet.", versions: "Version log", deletedItem: "Deleted element",
      gotoElement: "Go to element", nothingWaiting: "Nothing waiting.",
      hintLive: "Your text comments go to the agent immediately.", hintLiveImmediate: "Comments and quick marks go to the agent immediately.",
      noneLabel: "Delivery is disabled on this page. Comments stay on this device only.",
      storageBlocked: "This browser blocked local storage. Unhandled comments will be lost if you reload.",
      noEndpoint: "No delivery endpoint is configured, so comments use manual copy.",
      update: function (rev) { return "r" + rev + " is published. The comments you sent are kept."; },
      reload: "Reload", dismiss: "Dismiss",
      failedToast: "Delivery failed. The comments are kept; press Retry.",
      batchSent: function (n) { return "Sent " + n + " comment" + (n === 1 ? "" : "s") + " to the agent."; },
      queued: function (n, N) { return "Saved (" + n + "/" + N + ")."; },
      retry: function (n) { return n + " not delivered · Retry"; },
      processNow: function (n) { return n + " waiting · Process now"; },
      copyForChat: function (n) { return n + " waiting · Copy for chat"; },
      queuedDock: function (n) { return n + " waiting"; },
      unread: function (n) { return n + " new " + (n === 1 ? "reply" : "replies") + " ↓"; },
      hintBatch: function (n) { return "Comments collect. They are sent after " + n + " text comments or with “Process now”."; },
      hintBatchMarks: function (n) { return "Comments and marks collect. They are sent after " + n + " or with “Process now”."; },
      batchToast: function (n) { return "Processed " + n + " comment" + (n === 1 ? "" : "s") + "."; }
    },
    zh: {
      placeholder: "评论这里", send: "发送", close: "关闭", sending: "发送中…",
      marks: { like: "喜欢", dislike: "不喜欢", explain: "解释一下", delete: "删掉" },
      waiting: "等回复", you: "你", agent: "Agent", unreadTag: "新回复 · 点一下标为已读",
      waitingForYou: "等你决定", restoreHint: "要恢复某项，在它上面评论“restore”。",
      sentLive: "已发给 agent。", markQueued: "标记已保存，会随下一条文字评论一起发出。", markSent: "标记已发送。",
      updated: function (rev) { return "已更新到 r" + rev; },
      markQueuedShort: "随下一条文字评论发出",
      manualSaved: "已保存在本机。用“复制到聊天”交给 agent。",
      noneSaved: "只保存在本机，本页没有开启发送。",
      notSaved: "本机没有保存成功，刷新页面就会丢失。",
      notDelivered: "没发出。评论还留在本页，请按“重试”。",
      notDeliveredShort: "没发出 · 重试",
      manualLabel: "手动交接：复制不会唤醒 agent，请把文字粘贴到聊天里。",
      copied: "已复制，粘贴到聊天里即可。", copyFailed: "复制失败，请选中下面的文字手动复制。",
      hide: "隐藏对话", show: "显示对话", reviewOn: "评审模式：开", reviewOff: "评审模式：关",
      trash: "回收站", trashEmpty: "还没有被删除的内容。", versions: "版本记录", deletedItem: "已删除的内容",
      gotoElement: "定位到元素", nothingWaiting: "没有在等的评论。",
      hintLive: "文字评论会立即发给 agent。", hintLiveImmediate: "评论和快捷标记会立即发给 agent。",
      noneLabel: "本页没有开启发送，评论只保存在本机。",
      storageBlocked: "浏览器禁止了本机存储，刷新页面会丢失未处理的评论。",
      noEndpoint: "没有配置发送地址，改用手动复制。",
      update: function (rev) { return "r" + rev + " 已发布。你发出的评论会保留。"; },
      reload: "重新加载", dismiss: "忽略",
      failedToast: "发送失败，评论还在，请按“重试”。",
      batchSent: function (n) { return "已把 " + n + " 条评论发给 agent。"; },
      queued: function (n, N) { return "已保存（" + n + "/" + N + "）。"; },
      retry: function (n) { return n + " 条没发出 · 重试"; },
      processNow: function (n) { return n + " 条在等 · 立即处理"; },
      copyForChat: function (n) { return n + " 条在等 · 复制到聊天"; },
      queuedDock: function (n) { return n + " 条在等"; },
      unread: function (n) { return n + " 条新回复 ↓"; },
      hintBatch: function (n) { return "评论先收集，满 " + n + " 条文字评论或按“立即处理”后发给 agent。"; },
      hintBatchMarks: function (n) { return "评论和标记先收集，满 " + n + " 条或按“立即处理”后发给 agent。"; },
      batchToast: function (n) { return "已处理 " + n + " 条评论。"; }
    }
  };

  // DOM helpers (no Element.closest/matches: keeps the DOM layer thin)
  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  function tagOf(node) { return String((node && node.tagName) || "").toUpperCase(); }
  function walkElements(node, fn) { var kids = node.children; if (!kids) return; for (var i = 0; i < kids.length; i++) { fn(kids[i]); walkElements(kids[i], fn); } }
  function walkUp(node, fn) { for (var n = node; n; n = n.parentNode) { if (fn(n) === true) return n; } return null; }
  function hasClass(node, cls) { return !!(node && node.classList && node.classList.contains(cls)); }
  function insideLayer(node) { return !!walkUp(node, function (n) { return hasClass(n, "cv-ui") || hasClass(n, "cv-thread") || hasClass(n, "cv-composer"); }); }
  function isInteractiveNode(n) {
    if (!n) return false; if (INTERACTIVE_TAGS[tagOf(n)]) return true;
    var role = n.getAttribute && n.getAttribute("role"); if (role === "button" || role === "link" || role === "tab") return true;
    return !!(n.getAttribute && n.getAttribute("contenteditable") === "true");
  }
  function interactiveAncestor(node) { return walkUp(node, function (n) { return isInteractiveNode(n); }); }
  function clearNode(node) { while (node.firstChild) node.removeChild(node.firstChild); }
  function media(query) { try { return (typeof matchMedia === "function" && matchMedia(query)) || { matches: false }; } catch (e) { return { matches: false }; } }
  function focusedElement() { try { return document.activeElement || null; } catch (e) { return null; } }
  function isSmallNode(node) {
    if (node.hasAttribute && node.hasAttribute("data-covibe-small")) return true; if (SMALL_TAGS[tagOf(node)]) return true;
    try { return typeof SVGElement !== "undefined" && node instanceof SVGElement; } catch (e) { return false; }
  }

  // pure data layer (tested headlessly through Covibe.data)
  function cleanQuote(s, max) { var t = String(s == null ? "" : s).replace(/\s+/g, " ").trim(); if (!t) return ""; max = max || MAX_QUOTE; return t.length > max ? t.slice(0, max) + "…" : t; }
  function newCommentId(taken) {
    for (var i = 0; i < 64; i++) {
      var id = "c-" + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4); if (!taken || !taken[id]) return id;
    }
    return "c-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }
  function marksOf(c) { return (c.marks && c.marks.length) ? c.marks : (c.mark ? [c.mark] : []); }
  function commentLine(c) {
    var s = "[" + c.el + "|" + c.id + "]"; var marks = marksOf(c);
    for (var i = 0; i < marks.length; i++) s += " [" + marks[i] + "]"; if (c.quote) s += " «" + c.quote + "»";
    if (c.text) s += " " + c.text; return s;
  }
  function manualText(state, pending) { var head = "covibe " + state.session + " r" + (state.revision || 0); var lines = (pending || []).map(commentLine); return lines.length ? head + "\n" + lines.join("\n") : head; }
  function reconcile(pending, handled) {
    var h = {}; (handled || []).forEach(function (id) { h[id] = 1; });
    return (pending || []).filter(function (p) { return p && p.id && p.el && !h[p.id]; });
  }
  function initialSeen(threads, revision) {
    var seen = [];
    Object.keys(threads || {}).forEach(function (id) {
      var list = threads[id]; if (!Array.isArray(list)) return;
      list.forEach(function (e) {
        if (e && e.who === "agent" && e.id && (e.rev || 0) < (revision || 0)) seen.push(e.id);
      });
    });
    return seen;
  }
  function unsentCountable(pending, markDelivery) { return (pending || []).filter(function (p) { return !p.sent && (p.text || markDelivery === "immediate"); }).length; }
  function shouldTriggerBatch(mode, batchN, pending, markDelivery) { return mode === "batch" && unsentCountable(pending, markDelivery) >= batchN; }
  function wireComment(c) { return { elementId: c.el, commentId: c.id, marks: marksOf(c).slice(), text: c.text || "", ts: c.ts, elementLabel: c.label || "" }; }
  function postPayload(cfg, state, comments) {
    return {
      pageId: cfg.pageId || state.pageId || state.session,
      pageVersion: cfg.pageVersion != null ? cfg.pageVersion : (state.revision || 0),
      mode: cfg.mode || state.mode || "live",
      batchCount: (comments || []).length,
      comments: (comments || []).map(wireComment)
    };
  }
  function isNewerRevision(metaRevision, pageVersion) { return Number(metaRevision) > Number(pageVersion || 0); }
  function shouldDeferSwap(input) {
    input = input || {};
    if (input.composerHasText) return "composer";
    if (input.focusedInInput) return "focus";
    if (input.lastActivity && input.now - input.lastActivity < (input.quietMs || SWAP_QUIET_MS)) return "activity";
    return "";
  }
  function extractScripts(html) {
    var out = [], re = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi, m;
    while ((m = re.exec(String(html || "")))) {
      var attrs = m[1] || "";
      if (/\bsrc\s*=/.test(attrs)) continue;
      var type = (attrs.match(/\btype\s*=\s*["']([^"']*)["']/i) || [])[1];
      if (type && !/(?:javascript|ecmascript|module)/i.test(type)) continue;
      out.push(m[2]);
    }
    return out;
  }
  var data = { version: VERSION, MAX_TEXT: MAX_TEXT, MAX_QUOTE: MAX_QUOTE, SWAP_QUIET_MS: SWAP_QUIET_MS, cleanQuote: cleanQuote,
    newCommentId: newCommentId, marksOf: marksOf, commentLine: commentLine, manualText: manualText,
    reconcile: reconcile, initialSeen: initialSeen, unsentCountable: unsentCountable,
    shouldTriggerBatch: shouldTriggerBatch, wireComment: wireComment, postPayload: postPayload,
    isNewerRevision: isNewerRevision, shouldDeferSwap: shouldDeferSwap, extractScripts: extractScripts };

  // storage: session-scoped, honest about failure
  function Store(session, provided) {
    this.prefix = "covibe:" + session + ":"; this.mem = {};
    this.ok = true; this.backend = provided || null;
    if (!this.backend) {
      try { this.backend = (typeof localStorage !== "undefined" && localStorage) || null; }
      catch (e) { this.backend = null; }
    }
    if (!this.backend) { this.ok = false; return; }
    try {
      var probe = this.prefix + "probe"; this.backend.setItem(probe, "1");
      this.backend.removeItem(probe);
    } catch (e) { this.ok = false; this.backend = null; }
  }
  Store.prototype.get = function (key, dflt) {
    if (key in this.mem) return this.mem[key]; if (!this.backend) return dflt;
    try {
      var raw = this.backend.getItem(this.prefix + key); if (raw == null) return dflt;
      var value = JSON.parse(raw); this.mem[key] = value;
      return value;
    } catch (e) { return dflt; }
  };
  Store.prototype.set = function (key, value) {
    this.mem[key] = value; if (!this.backend) return false;
    try { this.backend.setItem(this.prefix + key, JSON.stringify(value)); return true; }
    catch (e) { this.ok = false; this.backend = null; return false; }
  };

  // mount
  function mount(opts) {
    opts = opts || {};
    var gcfg = (global.COVIBE && typeof global.COVIBE === "object") ? global.COVIBE : {};
    function cfgVal(key, dflt) { if (opts[key] !== undefined && opts[key] !== null) return opts[key]; if (gcfg[key] !== undefined && gcfg[key] !== null) return gcfg[key]; return dflt; }
    var state = resolveState(opts, gcfg); if (!state || typeof state !== "object") throw new Error("covibe: state must be an object");
    if (!state.session) throw new Error("covibe: state.session is required");
    if (state.schema) {
      var schema = String(state.schema).split("/");
      if (schema[0] !== "covibe" || (schema[1] && schema[1] !== "2")) throw new Error("covibe: unsupported schema " + state.schema);
    }
    var T = STR[cfgVal("lang", state.lang || "en")] || STR.en; var store = new Store(state.session, opts.storage);
    var transport = normalizeTransport(cfgVal("transport", "manual")); var mode = normalizeMode(cfgVal("mode", state.mode || "live"));
    if (mode === "manual") transport = "manual"; var batchN = Math.max(1, parseInt(cfgVal("batchN", state.batchSize || 5), 10) || 5);
    var pageId = cfgVal("pageId", state.pageId || state.session); var pageVersion = cfgVal("pageVersion", state.revision || 0);
    var endpoint = cfgVal("endpoint", ""); var token = cfgVal("token", "");
    var lang = cfgVal("lang", state.lang || "en"); var configWarning = "";
    var metaUrl = transport === "post" ? (cfgVal("metaUrl", "") || metaUrlFor(endpoint)) : "";
    var markDelivery = normalizeMarkDelivery(cfgVal("markDelivery", state.markDelivery || "immediate"));
    var updateMode = normalizeUpdateMode(cfgVal("updateMode", state.updateMode || "hotswap"));
    var pollMs = Math.max(1000, parseInt(cfgVal("pollMs", 3000), 10) || 3000);
    if (transport === "post" && !endpoint) {
      transport = "manual"; configWarning = T.noEndpoint;
    }
    var wireCfg = { pageId: pageId, pageVersion: pageVersion, mode: mode, lang: lang };
    var revision = state.revision || 0; var threads = (state.threads && typeof state.threads === "object") ? state.threads : {};
    var statusMap = (state.status && typeof state.status === "object") ? state.status : {};
    var handledList = Array.isArray(state.handled) ? state.handled : [];
    var handled = {}; handledList.forEach(function (id) { handled[id] = 1; });
    var stateIds = {};
    Object.keys(threads).forEach(function (key) {
      if (Array.isArray(threads[key])) threads[key].forEach(function (e) { if (e && e.id) stateIds[e.id] = 1; });
    });
    var agentName = state.agentName || T.agent;
    var pending = store.get("pending", []); if (!Array.isArray(pending)) pending = [];
    pending = reconcile(pending.filter(function (p) { return p && p.id && p.el; }), handledList); store.set("pending", pending);
    var seen = store.get("seen", null);
    if (!Array.isArray(seen)) { seen = initialSeen(threads, revision); store.set("seen", seen); }
    var seenSet = {}; seen.forEach(function (id) { seenSet[id] = 1; });
    var visible = store.get("visible", true) !== false; var review = false;
    var root = opts.root;
    if (typeof root === "string") {
      root = root.charAt(0) === "#" ? document.getElementById(root.slice(1)) : (document.querySelector ? document.querySelector(root) : null);
    }
    if (!root) root = document.body || document.documentElement; if (!root) throw new Error("covibe: root element not found");
    var vibeRoot = (root.getAttribute && root.getAttribute("id") === "covibe-root") ? root : (document.getElementById("covibe-root") || root);
    var threadsById = {};   // element id -> thread box (block elements)
    var composers = {};     // element id -> composer box
    var badges = {};        // element id -> count marker
    var labels = {};        // element id -> label, captured before threads are inserted
    var entryNodes = {};    // agent entry id -> node
    var targetsList = []; var targetById = {};
    var nodeById = {};
    var wired = [];
    var hasInteractiveTargets = false; var highlighted = null;
    var hlTimer = null; var toastTimer = null;
    var pollTimer = null; var checking = null; var updateRevision = 0; var dismissedRevision = 0;
    var swapping = null; var swapToastTimer = null; var lastActivity = 0; var focusTimer = null; var destroyed = false;
    var ui = el("div", "cv-ui"); (document.body || document.documentElement).appendChild(ui);
    var panel = el("div", "cv-panel"); panel.hidden = true;
    panel.setAttribute("role", "dialog"); panel.setAttribute("aria-label", T.agent);
    ui.appendChild(panel); var panelFor = null;
    /* ---------------- dock ---------------- */
    var dock = el("div", "cv-dock"); var dockUnread = el("button", "cv-dock-btn cv-dock-unread");
    var dockRetry = el("button", "cv-dock-btn cv-dock-warn"); var dockBatch = el("button", "cv-dock-btn");
    var dockCount = el("span", "cv-dock-count"); var dockReview = el("button", "cv-dock-btn cv-dock-ghost");
    var dockHide = el("button", "cv-dock-btn cv-dock-ghost"); var dockNotice = el("span", "cv-dock-notice");
    var dockToast = el("span", "cv-dock-toast"); dockToast.setAttribute("aria-live", "polite");
    dockToast.hidden = true;
    [dockUnread, dockRetry, dockBatch, dockCount, dockReview, dockHide, dockNotice, dockToast].forEach(function (n) {
      dock.appendChild(n);
    });
    [dockUnread, dockRetry, dockBatch, dockReview, dockHide].forEach(function (n) { n.type = "button"; });
    ui.appendChild(dock);
    /* ---------------- manual-copy panel ---------------- */
    var exportBox = el("div", "cv-export"); exportBox.hidden = true;
    exportBox.setAttribute("role", "dialog"); var exportMsg = el("p", "cv-hint");
    var exportArea = el("textarea", "cv-input"); exportArea.readOnly = true;
    var exportClose = el("button", "cv-btn-ghost", T.close); exportClose.type = "button";
    exportBox.appendChild(exportMsg); exportBox.appendChild(exportArea);
    exportBox.appendChild(exportClose); ui.appendChild(exportBox);
    exportClose.addEventListener("click", function () { exportBox.hidden = true; });
    /* ---------------- revision banner ---------------- */
    var updateBar = el("div", "cv-update"); updateBar.hidden = true; updateBar.setAttribute("role", "status");
    var updateText = el("span", "cv-update-text"); var updateReload = el("button", "cv-btn", T.reload);
    var updateDismiss = el("button", "cv-btn-ghost", T.dismiss); updateReload.type = "button"; updateDismiss.type = "button";
    updateBar.appendChild(updateText); updateBar.appendChild(updateReload); updateBar.appendChild(updateDismiss); ui.appendChild(updateBar);
    var swapToast = el("span", "cv-toast"); swapToast.hidden = true; swapToast.setAttribute("role", "status"); swapToast.setAttribute("aria-live", "polite"); ui.appendChild(swapToast);
    /* ---------------- state helpers ---------------- */
    function sayFor(id, text, cls) { var c = composers[id]; if (c && c.__say) c.__say(text, cls); }
    function takenIds() {
      var taken = {}; pending.forEach(function (p) { taken[p.id] = 1; });
      Object.keys(stateIds).forEach(function (id) { taken[id] = 1; }); handledList.forEach(function (id) { taken[id] = 1; });
      return taken;
    }
    function unsent() { return pending.filter(function (p) { return !p.sent; }); }
    function failedCount() { return pending.filter(function (p) { return !p.sent && p.failed; }).length; }
    function persistPending() { return store.set("pending", pending); }
    function unreadEntries() {
      var out = [];
      targetsList.forEach(function (node) {
        var id = node.getAttribute("data-covibe-id"); var list = threads[id];
        if (!Array.isArray(list)) return;
        list.forEach(function (e) {
          if (e && e.who === "agent" && e.id && !seenSet[e.id]) out.push({ el: id, entry: e.id });
        });
      });
      return out;
    }
    function pendingNote(p) { if (p.sent) return T.waiting; if (p.failed) return T.notDeliveredShort; if (transport === "post" && mode === "live" && !p.text && markDelivery === "defer") return T.markQueuedShort; return T.waiting; }
    function labelOf(node, id) {
      if (labels[id]) return labels[id];
      var label = (node.getAttribute && node.getAttribute("data-covibe-label")) ||
        String(node.textContent || "").replace(/\s+/g, " ").trim().slice(0, 60) || id;
      labels[id] = label; return label;
    }
    /* ---------------- thread rendering ---------------- */
    function entryNode(entry) {
      var mine = entry.who !== "agent"; var d = el("div", mine ? "cv-entry cv-you" : "cv-entry cv-agent");
      if (entry.id) { d.setAttribute("data-cv-entry", entry.id); entryNodes[entry.id] = d; }
      d.appendChild(el("span", "cv-by", mine ? T.you : agentName)); var marks = marksOf(entry);
      marks.forEach(function (m) { d.appendChild(el("span", "cv-mark", "[" + (T.marks[m] || m) + "]")); });
      if (entry.quote) d.appendChild(el("q", "cv-quote", entry.quote)); if (entry.text) d.appendChild(el("span", "cv-text", entry.text));
      if (!mine && entry.rev) d.appendChild(el("span", "cv-rev", "r" + entry.rev));
      if (!mine && entry.id && !seenSet[entry.id]) {
        d.classList.add("cv-unread"); d.setAttribute("tabindex", "0");
        d.appendChild(el("span", "cv-unread-tag", T.unreadTag));
        var read = function (ev) {
          if (ev) { ev.stopPropagation(); ev.preventDefault(); }
          markRead(entry.id);
        }; d.addEventListener("click", read);
        d.addEventListener("keydown", function (ev) {
          if (ev.key === "Enter" || ev.key === " ") read(ev);
        });
      }
      return d;
    }
    function pendingNode(p) {
      var d = entryNode({ id: p.id, who: "user", text: p.text, marks: p.marks, quote: p.quote }); d.classList.add("cv-pending");
      if (p.failed) d.classList.add("cv-failed"); d.appendChild(el("span", "cv-wait", pendingNote(p)));
      return d;
    }
    function entriesFor(id) {
      var out = []; (threads[id] || []).forEach(function (e) { if (e) out.push(entryNode(e)); });
      pending.forEach(function (p) {
        if (p.el === id && !stateIds[p.id]) out.push(pendingNode(p));
      });
      return out;
    }
    function placeAfter(node, box) {
      var tag = tagOf(node); if (INSIDE_TAGS[tag]) node.appendChild(box);
      else if (AFTER_TAGS[tag] || isSmallNode(node)) {
        if (node.parentNode) node.parentNode.insertBefore(box, node.nextSibling);
        else node.appendChild(box);
      } else node.appendChild(box);
    }
    function threadHead(node, id) {
      var head = el("div", "cv-thread-head"); head.appendChild(el("span", "cv-thread-label", labelOf(node, id)));
      var go = el("button", "cv-btn-ghost cv-goto", T.gotoElement); go.type = "button";
      go.addEventListener("click", function (ev) { ev.stopPropagation(); reveal(node, true); }); head.appendChild(go);
      return head;
    }
    function ensureThreadBox(node, id) {
      var box = threadsById[id]; if (box && box.parentNode) return box;
      box = el("div", "cv-thread"); box.setAttribute("data-cv-for", id);
      box.addEventListener("click", function (ev) { ev.stopPropagation(); }); placeAfter(node, box);
      threadsById[id] = box; return box;
    }
    function renderBlock(node) {
      var id = node.getAttribute("data-covibe-id"); var list = entriesFor(id);
      var composer = composers[id] || null; var statusText = statusMap[id] === "waiting-for-user" ? T.waitingForYou : "";
      var needed = list.length > 0 || statusText || composer; var box = threadsById[id];
      if (!needed) {
        if (box) { if (box.parentNode) box.parentNode.removeChild(box); delete threadsById[id]; }
        return;
      }
      box = ensureThreadBox(node, id); clearNode(box);
      if (list.length || statusText) box.appendChild(threadHead(node, id)); if (statusText) box.appendChild(el("div", "cv-status", statusText));
      list.forEach(function (n) { box.appendChild(n); });
      if (composer) box.appendChild(composer);
      if (!box.children || !box.children.length) {
        if (box.parentNode) box.parentNode.removeChild(box); delete threadsById[id];
      }
    }

    /* ---------------- count markers (small elements) ---------------- */
    function countIn(id) { return (threads[id] || []).length + pending.filter(function (p) { return p.el === id; }).length; }
    function unreadIn(id) { return (threads[id] || []).some(function (e) { return e && e.who === "agent" && e.id && !seenSet[e.id]; }); }
    function placeBadges() {
      targetsList.forEach(function (node) {
        if (!isSmallNode(node)) return; var id = node.getAttribute("data-covibe-id");
        var n = countIn(id); var badge = badges[id];
        if (!n) { if (badge) badge.hidden = true; return; }
        if (!badge) {
          badge = el("button", "cv-badge"); badge.type = "button";
          badge.addEventListener("click", function (ev) {
            ev.stopPropagation(); open(id);
          }); ui.appendChild(badge);
          badges[id] = badge;
        }
        var r = node.getBoundingClientRect(); badge.hidden = false;
        badge.textContent = String(n); badge.classList.toggle("cv-badge-unread", unreadIn(id));
        badge.setAttribute("aria-label", labelOf(node, id) + ": " + n + " comments"); badge.style.left = (r.right + (global.scrollX || 0) - 10) + "px";
        badge.style.top = (r.top + (global.scrollY || 0) - 10) + "px";
      });
    }

    /* ---------------- composer ---------------- */
    function hintText() {
      var base; if (transport === "none") base = T.noneLabel;
      else if (transport === "manual") base = T.manualLabel;
      else if (mode === "batch") base = markDelivery === "defer" ? T.hintBatch(batchN) : T.hintBatchMarks(batchN);
      else base = markDelivery === "defer" ? T.hintLive : T.hintLiveImmediate; if (configWarning) base += " " + configWarning;
      if (!store.ok) base += " " + T.storageBlocked; return base;
    }
    function makeComposer(node, quote) {
      var id = node.getAttribute("data-covibe-id"); var box = el("div", "cv-composer");
      box.setAttribute("data-cv-for", id); var ta = el("textarea", "cv-input");
      ta.id = "cv-ta-" + id; ta.maxLength = MAX_TEXT;
      ta.placeholder = T.placeholder; ta.value = store.get("draft:" + id, "") || "";
      ta.addEventListener("input", function () { store.set("draft:" + id, ta.value); });
      ta.addEventListener("keydown", function (ev) {
        if (ev.key === "Enter" && (ev.metaKey || ev.ctrlKey)) { ev.preventDefault(); submit(null); }
      }); box.__cvTa = ta;
      var msg = el("span", "cv-msg"); msg.setAttribute("aria-live", "polite");
      function say(text, cls) {
        msg.textContent = text; msg.className = "cv-msg" + (cls ? " " + cls : "");
      }
      box.__say = say; var quoteEl = null;
      function setQuote(q) {
        if (q) {
          if (!quoteEl) { quoteEl = el("q", "cv-quote"); box.insertBefore(quoteEl, box.firstChild); }
          quoteEl.textContent = q; ta.setAttribute("data-quote", q);
        } else {
          if (quoteEl && quoteEl.parentNode) quoteEl.parentNode.removeChild(quoteEl); quoteEl = null;
          ta.removeAttribute("data-quote");
        }
      }
      var marks = el("div", "cv-marks");
      MARKS.forEach(function (m) {
        var b = el("button", "cv-markbtn", T.marks[m]); b.type = "button";
        b.addEventListener("click", function (ev) { ev.stopPropagation(); submit(m); }); marks.appendChild(b);
      });
      var row = el("div", "cv-row");
      var send = el("button", "cv-btn", T.send); send.type = "button";
      var close = el("button", "cv-btn-ghost", T.close); close.type = "button";
      row.appendChild(send); row.appendChild(close); row.appendChild(msg); send.addEventListener("click", function () { submit(null); });
      close.addEventListener("click", function () {
        if (walkUp(box, function (n) { return hasClass(n, "cv-panel"); })) closePanel();
        else closeComposer(id);
      }); box.appendChild(marks);
      box.appendChild(ta); box.appendChild(row);
      box.appendChild(el("p", "cv-hint", hintText())); box.addEventListener("click", function (ev) { ev.stopPropagation(); });
      box.__setQuote = setQuote; if (quote) setQuote(quote);

      function submit(mark) {
        var text = String(ta.value || "").trim();
        if (!text && !mark) { if (ta.focus) ta.focus(); return; }
        var p = {
          id: newCommentId(takenIds()), el: id, text: text,
          quote: ta.getAttribute("data-quote") || undefined,
          marks: mark ? [mark] : [],
          ts: new Date().toISOString(), label: labels[id] || "",
          sent: false, failed: false
        }; pending.push(p);
        ta.value = ""; setQuote("");
        store.set("draft:" + id, ""); var saved = persistPending();
        refreshAll(); afterSubmit(p, saved);
      }
      composers[id] = box; return box;
    }
    function closeComposer(id) {
      var c = composers[id]; if (!c) return;
      if (walkUp(c, function (n) { return hasClass(n, "cv-panel"); })) { closePanel(); return; }
      delete composers[id]; var node = byId(id);
      if (node) { node.setAttribute("aria-expanded", "false"); renderBlock(node); if (node.focus) node.focus(); }
      else if (c.parentNode) c.parentNode.removeChild(c);
    }

    /* ---------------- block threads: unread / read ---------------- */
    function markRead(entryId) {
      if (seenSet[entryId]) return; seenSet[entryId] = 1;
      seen.push(entryId); store.set("seen", seen.slice(-1000));
      refreshAll();
    }
    var unreadCursor = 0;
    function nextUnread() {
      var order = unreadEntries();
      if (!order.length) { unreadCursor = 0; return null; }
      if (unreadCursor >= order.length) unreadCursor = 0; var u = order[unreadCursor];
      unreadCursor = (unreadCursor + 1) % order.length; var node = byId(u.el);
      if (!node) return null; if (!visible) setVisible(true);
      reveal(node, false); if (isSmallNode(node)) open(u.el);
      var target = entryNodes[u.entry]; if (target && target.focus) target.focus();
      return u.entry;
    }

    /* ---------------- open / close ---------------- */
    function highlight(node, autoClear) {
      clearHighlights(); if (!node) return;
      node.classList.add("cv-hl"); highlighted = node;
      if (autoClear) {
        clearTimeout(hlTimer); hlTimer = setTimeout(function () { clearHighlights(); }, 2500);
      }
    }
    function clearHighlights() { clearTimeout(hlTimer); hlTimer = null; if (highlighted && highlighted.classList) highlighted.classList.remove("cv-hl"); highlighted = null; }
    function reveal(node, autoClear) {
      var p = node.parentElement;
      while (p) {
        if (tagOf(p) === "DETAILS" && !p.open) p.open = true; p = p.parentElement;
      }
      if (typeof opts.onReveal === "function") { try { opts.onReveal(node); } catch (e) { /* page hook */ } }
      if (node.scrollIntoView) node.scrollIntoView({ block: "center", behavior: "smooth" }); highlight(node, autoClear);
    }
    function open(id, quote) {
      var node = byId(id); if (!node) return;
      if (!visible) setVisible(true);
      if (isSmallNode(node)) {
        panelFor = id; renderPanel(id);
        panel.hidden = false; node.setAttribute("aria-expanded", "true");
        highlight(node, false); var small = composers[id];
        if (small && small.__cvTa && small.__cvTa.focus) small.__cvTa.focus(); return;
      }
      if (!composers[id]) makeComposer(node, quote || "");
      else if (quote && composers[id].__setQuote) composers[id].__setQuote(quote); node.setAttribute("aria-expanded", "true");
      renderBlock(node); var c = composers[id];
      if (c && c.__cvTa && c.__cvTa.focus) c.__cvTa.focus();
    }
    function closePanel() {
      panel.hidden = true;
      if (panelFor) {
        var node = byId(panelFor); if (node) node.setAttribute("aria-expanded", "false");
        var c = composers[panelFor]; if (c && c.parentNode) c.parentNode.removeChild(c);
      }
      panelFor = null; clearHighlights();
    }

    /* ---------------- panel (small elements) ---------------- */
    function renderPanel(id) {
      var node = byId(id);
      if (!node) { closePanel(); return; }
      panelFor = id; clearNode(panel);
      var head = el("div", "cv-panel-head"); var title = el("button", "cv-panel-title", labelOf(node, id));
      title.type = "button"; title.addEventListener("click", function () { reveal(node, true); });
      var close = el("button", "cv-btn-ghost", T.close); close.type = "button";
      close.addEventListener("click", closePanel); head.appendChild(title); head.appendChild(close);
      panel.appendChild(head); var list = el("div", "cv-thread cv-thread-panel");
      if (statusMap[id] === "waiting-for-user") list.appendChild(el("div", "cv-status", T.waitingForYou));
      entriesFor(id).forEach(function (n) { list.appendChild(n); }); panel.appendChild(list);
      var composer = composers[id] || makeComposer(node, ""); panel.appendChild(composer);
      var narrow = media("(max-width: 700px)").matches; panel.classList.toggle("cv-sheet", narrow);
      if (!narrow) {
        var r = node.getBoundingClientRect(); var left = r.right + 12;
        if (left + 340 > (global.innerWidth || 1024)) left = Math.max(12, r.left - 340); panel.style.left = (left + (global.scrollX || 0)) + "px";
        panel.style.top = (Math.max(12, r.top) + (global.scrollY || 0)) + "px";
      } else {
        panel.style.left = ""; panel.style.top = "";
      }
    }

    /* ---------------- delivery ---------------- */
    var delivering = null;
    function getFetch() { if (typeof fetch === "function") return fetch; return global.fetch || null; }
    function deliverAll() {
      if (delivering) return delivering; var batch = unsent();
      if (!batch.length) return Promise.resolve({ ok: true, count: 0 });
      var fetchImpl = getFetch();
      if (!fetchImpl) {
        batch.forEach(function (p) { p.failed = true; }); persistPending();
        refreshAll(); return Promise.resolve({ ok: false, count: 0, error: "no_fetch" });
      }
      var body;
      try { body = JSON.stringify(postPayload(wireCfg, state, batch)); }
      catch (e) { return Promise.resolve({ ok: false, count: 0, error: e }); }
      var headers = { "Content-Type": "application/json" };
      if (token) headers["X-Covibe-Token"] = token;
      var request;
      try {
        request = Promise.resolve(fetchImpl(endpoint, { method: "POST", headers: headers, body: body }));
      } catch (e) { request = Promise.reject(e); }
      delivering = request.then(function (res) {
        if (!res || res.ok === false) throw new Error("HTTP " + ((res && res.status) || "error")); batch.forEach(function (p) { p.sent = true; p.failed = false; });
        persistPending(); return { ok: true, count: batch.length };
      }).catch(function (err) {
        batch.forEach(function (p) { p.failed = true; }); persistPending();
        return { ok: false, count: 0, error: err };
      }).then(function (result) {
        delivering = null; refreshAll();
        refreshDock(); return result;
      });
      return delivering;
    }
    function afterSubmit(p, saved) {
      var warn = saved ? "" : " " + T.notSaved; var cls = saved ? "cv-ok" : "cv-warn";
      if (transport === "none") { sayFor(p.el, saved ? T.noneSaved : T.notSaved, cls); return; }
      if (transport === "manual") { sayFor(p.el, saved ? T.manualSaved : T.notSaved, cls); return; }
      if (mode === "live" && (p.text || markDelivery === "immediate")) {
        var sentText = p.text ? T.sentLive : T.markSent;
        sayFor(p.el, T.sending + warn, saved ? "cv-msg" : "cv-warn");
        deliverAll().then(function (r) {
          sayFor(p.el, (r.ok ? sentText : T.notDelivered) + warn, (r.ok && saved) ? "cv-ok" : "cv-warn");
        }); return;
      }
      if (mode === "batch") {
        if (shouldTriggerBatch(mode, batchN, pending, markDelivery)) {
          sayFor(p.el, T.sending + warn, saved ? "cv-msg" : "cv-warn");
          deliverAll().then(function (r) {
            sayFor(p.el, (r.ok ? T.batchSent(r.count) : T.notDelivered) + warn, (r.ok && saved) ? "cv-ok" : "cv-warn");
          });
        } else {
          sayFor(p.el, T.queued(unsentCountable(pending, markDelivery), batchN) + warn, cls);
        }
        return;
      }
      sayFor(p.el, T.markQueued + warn, cls);
    }
    function retryDelivery() {
      if (delivering) return;
      deliverAll().then(function (r) {
        if (r.ok && r.count) toast(T.batchToast(r.count), false);
        else if (!r.ok) toast(T.failedToast, true);
      });
    }
    function processNow() {
      if (delivering) return;
      deliverAll().then(function (r) {
        if (r.ok && r.count) toast(T.batchToast(r.count), false);
        else if (!r.ok) toast(T.failedToast, true);
      });
    }

    /* ---------------- manual export ---------------- */
    function exportText() { return manualText(state, pending); }
    function copyForChat() {
      if (!pending.length) { toast(T.nothingWaiting, true); return; }
      var text = exportText();
      function done(ok) {
        exportArea.value = text; exportMsg.textContent = ok ? T.copied + " " + T.manualLabel : T.copyFailed + " " + T.manualLabel;
        exportBox.hidden = ok;
        if (!ok) {
          if (exportArea.focus) exportArea.focus(); if (exportArea.select) exportArea.select();
        }
        toast(ok ? T.copied : T.copyFailed, !ok);
      }
      try {
        if (typeof navigator !== "undefined" && navigator && navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(false); });
        } else done(false);
      } catch (e) { done(false); }
    }

    /* ---------------- revision updates: poll /cv/meta; hotswap or banner (post only) ---------------- */
    function pageVisible() { var v = document.visibilityState; return v === undefined || v === "visible"; }
    function focusInLayerControl() { var a = focusedElement(); return !!a && !!walkUp(a, function (n) { return hasClass(n, "cv-composer") || hasClass(n, "cv-dock"); }); }
    function composerHasText() {
      for (var id in composers) {
        if (!Object.prototype.hasOwnProperty.call(composers, id)) continue;
        var c = composers[id], ta = c && c.__cvTa;
        if (ta && (String(ta.value || "").trim() || ta.getAttribute("data-quote"))) return true;
      }
      return false;
    }
    function focusedInInput() {
      var a = focusedElement(); if (!a) return false;
      return hasClass(a, "cv-input") || !!walkUp(a, function (n) { return hasClass(n, "cv-composer"); });
    }
    function quietReason() { return shouldDeferSwap({ composerHasText: composerHasText(), focusedInInput: focusedInInput(), lastActivity: lastActivity, now: Date.now(), quietMs: SWAP_QUIET_MS }); }
    function showUpdate(rev) { updateRevision = rev; updateText.textContent = T.update(rev); updateBar.hidden = false; }
    function showSwapToast(rev) {
      swapToast.textContent = T.updated(rev); swapToast.hidden = false; clearTimeout(swapToastTimer);
      swapToastTimer = setTimeout(function () { swapToast.hidden = true; }, SWAP_TOAST_MS);
    }
    function showUpdateViaCurrentLayer(rev) {
      try {
        if (global.Covibe && typeof global.Covibe.showUpdateBanner === "function") { global.Covibe.showUpdateBanner(rev); return; }
      } catch (e) { /* fall through */ }
      showUpdate(rev);
    }
    function fallbackUpdate(rev) { showUpdateViaCurrentLayer(rev); return { checked: true, revision: rev, shown: true, fallback: true }; }
    function parseNewDocument(html) { try { return typeof DOMParser === "undefined" ? null : new DOMParser().parseFromString(html, "text/html"); } catch (e) { return null; } }
    function adoptNode(node) { try { return document.importNode(node, true); } catch (e) { try { return document.adoptNode(node); } catch (e2) { return node; } } }
    function scriptsFromDocument(doc) {
      var out = [], nodes = (doc.getElementsByTagName && doc.getElementsByTagName("script")) || [];
      for (var i = 0; i < nodes.length; i++) {
        var s = nodes[i], type = (s.getAttribute && s.getAttribute("type")) || "";
        if (type && !/(?:javascript|ecmascript|module)/i.test(type)) continue;
        if (s.getAttribute && s.getAttribute("src")) continue;
        out.push(s.textContent || s.text || "");
      }
      return out;
    }
    function mountSnapshot() {
      return { root: root, state: state, transport: transport, endpoint: endpoint, token: token, mode: mode,
        batchN: batchN, pageId: pageId, pageVersion: pageVersion, lang: lang, metaUrl: metaUrl,
        markDelivery: markDelivery, updateMode: updateMode, pollMs: pollMs,
        storage: opts.storage, fetch: opts.fetch, onReveal: opts.onReveal };
    }
    function restoreDom(children, title) {
      try {
        while (root.firstChild) root.removeChild(root.firstChild);
        for (var i = 0; i < children.length; i++) root.appendChild(children[i]);
        document.title = title;
      } catch (e) { /* best effort: a page may not end up blank */ }
    }
    function rollbackSwap(snapshot, rev) {
      try { if (global.Covibe && typeof global.Covibe.__destroyActive === "function") global.Covibe.__destroyActive(); } catch (e) {}
      restoreDom(snapshot.children, snapshot.title);
      try { if (snapshot.covibe) global.Covibe = snapshot.covibe; } catch (e) {}
      try {
        if (snapshot.mount) snapshot.mount(mountSnapshot());
        if (global.Covibe && typeof global.Covibe.showUpdateBanner === "function") global.Covibe.showUpdateBanner(rev);
      } catch (e) { try { showUpdate(rev); } catch (e2) {} }
      try { if (global.scrollTo) global.scrollTo(0, snapshot.scroll); } catch (e) {}
    }
    function doHotswap(rev) {
      if (destroyed) return Promise.resolve(false);
      if (swapping) return swapping;
      var fetchImpl = getFetch(), href = global.location && global.location.href;
      if (!fetchImpl || !href || vibeRoot === document.body || vibeRoot === document.documentElement) return Promise.resolve(false);
      var request;
      try { request = Promise.resolve(fetchImpl(href, { cache: "no-store", credentials: "same-origin" })); }
      catch (e) { return Promise.resolve(false); }
      swapping = request.then(function (res) {
        if (!res || res.ok === false || !res.text) return "";
        return res.text();
      }).catch(function () { return ""; }).then(function (html) {
        if (typeof html !== "string" || !html) return false;
        var newDoc = parseNewDocument(html); if (!newDoc) return false;
        var newRoot = newDoc.getElementById("covibe-root"); if (!newRoot) return false;
        var scripts = scriptsFromDocument(newDoc);
        var snapshot = { children: Array.prototype.slice.call(vibeRoot.childNodes), title: document.title,
          scroll: global.scrollY || 0, covibe: global.Covibe, mount: global.Covibe && global.Covibe.mount };
        try { api.destroy(); } catch (e) {}
        try {
          while (vibeRoot.firstChild) vibeRoot.removeChild(vibeRoot.firstChild);
          var kids = Array.prototype.slice.call(newRoot.childNodes);
          for (var i = 0; i < kids.length; i++) vibeRoot.appendChild(adoptNode(kids[i]));
          document.title = newDoc.title || snapshot.title;
          for (var i = 0; i < scripts.length; i++) new Function(scripts[i])();
          if (!global.Covibe || !global.Covibe.__active) throw new Error("covibe: hotswap did not mount");
          try { if (global.scrollTo) global.scrollTo(0, snapshot.scroll); } catch (e) {}
          setTimeout(function () { try { if (global.scrollTo) global.scrollTo(0, snapshot.scroll); } catch (e) {} }, 0);
          if (typeof global.Covibe.showSwapToast === "function") global.Covibe.showSwapToast(rev);
          return true;
        } catch (e) { rollbackSwap(snapshot, rev); return false; }
      }).catch(function () { return false; }).then(function (ok) { swapping = null; return ok; });
      return swapping;
    }
    function checkForUpdate() {
      if (destroyed) return Promise.resolve({ checked: false, skipped: "destroyed" });
      if (updateMode === "off") return Promise.resolve({ checked: false, skipped: "off" });
      if (transport !== "post") return Promise.resolve({ checked: false, skipped: "transport" });
      if (!metaUrl) return Promise.resolve({ checked: false, skipped: "no-meta-url" });
      if (checking) return checking;
      if (!pageVisible()) return Promise.resolve({ checked: false, skipped: "hidden" });
      if (focusInLayerControl()) return Promise.resolve({ checked: false, skipped: "focus" });
      if (!updateBar.hidden) return Promise.resolve({ checked: false, skipped: "banner" });
      var fetchImpl = getFetch(); if (!fetchImpl) return Promise.resolve({ checked: false, skipped: "no-fetch" });
      var headers = {}; if (token) headers["X-Covibe-Token"] = token;
      var request;
      try { request = Promise.resolve(fetchImpl(metaUrl, { method: "GET", headers: headers })); }
      catch (e) { return Promise.resolve({ checked: false, skipped: "error" }); }
      checking = request.then(function (res) {
        if (!res || res.ok === false || !res.json) return { checked: false, skipped: "http" };
        return res.json();
      }).then(function (body) {
        if (!body || !body.meta) return { checked: false, skipped: "body" };
        var rev = Number(body.meta.revision);
        if (!isFinite(rev)) return { checked: false, skipped: "body" };
        if (!isNewerRevision(rev, pageVersion) || rev <= dismissedRevision) return { checked: true, revision: rev, shown: false };
        if (updateMode !== "hotswap") { showUpdate(rev); return { checked: true, revision: rev, shown: true }; }
        var defer = quietReason();
        if (defer) return { checked: true, revision: rev, deferred: defer };
        return doHotswap(rev).then(function (ok) { return ok ? { checked: true, revision: rev, swapped: true } : fallbackUpdate(rev); });
      }).catch(function () { return { checked: false, skipped: "error" }; }).then(function (result) { checking = null; return result; });
      return checking;
    }
    function shouldPoll() { return updateMode !== "off" && transport === "post" && !!metaUrl && pageVisible() && !focusInLayerControl(); }
    function syncPolling() {
      if (destroyed) return;
      if (shouldPoll()) { if (!pollTimer) pollTimer = setInterval(function () { checkForUpdate(); }, pollMs); }
      else if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    }
    function polling() { return !!pollTimer; }
    updateReload.addEventListener("click", function () {
      try { global.location.reload(); } catch (e) { try { global.location.href = global.location.href; } catch (e2) { /* no location */ } }
    });
    updateDismiss.addEventListener("click", function () { dismissedRevision = Math.max(dismissedRevision, updateRevision); updateBar.hidden = true; syncPolling(); });

    /* ---------------- dock ---------------- */
    function toast(text, warn) {
      dockToast.textContent = text; dockToast.className = "cv-dock-toast" + (warn ? " cv-warn" : " cv-ok");
      dockToast.hidden = false; clearTimeout(toastTimer);
      toastTimer = setTimeout(function () { dockToast.hidden = true; }, 3000);
    }
    function refreshDock() {
      var unread = unreadEntries().length; dockUnread.hidden = unread === 0;
      dockUnread.textContent = T.unread(unread); var failed = failedCount();
      dockRetry.hidden = failed === 0; dockRetry.textContent = T.retry(failed);
      var waiting = unsent().length;
      if (transport === "manual") {
        dockBatch.hidden = waiting === 0; dockBatch.disabled = false;
        dockBatch.textContent = T.copyForChat(waiting);
      } else if (transport === "post" && mode === "batch") {
        dockBatch.hidden = false; dockBatch.disabled = waiting === 0;
        dockBatch.textContent = T.processNow(waiting);
      } else {
        dockBatch.hidden = true;
      }
      dockCount.hidden = !(transport === "none" && waiting > 0); dockCount.textContent = T.queuedDock(waiting);
      dockReview.hidden = !hasInteractiveTargets; dockReview.textContent = review ? T.reviewOn : T.reviewOff;
      dockReview.classList.toggle("cv-on", review); dockReview.setAttribute("aria-pressed", review ? "true" : "false");
      dockHide.textContent = visible ? T.hide : T.show; dockNotice.hidden = store.ok;
      dockNotice.textContent = store.ok ? "" : T.storageBlocked;
    }
    dockUnread.addEventListener("click", nextUnread); dockRetry.addEventListener("click", retryDelivery);
    dockBatch.addEventListener("click", function () {
      if (transport === "manual") copyForChat();
      else processNow();
    });
    dockReview.addEventListener("click", function () {
      review = !review; document.documentElement.classList.toggle("cv-review", review);
      refreshDock();
    }); dockHide.addEventListener("click", function () { setVisible(!visible); });
    function setVisible(v) {
      visible = !!v; store.set("visible", visible);
      document.documentElement.classList.toggle("cv-hidden", !visible); if (!visible) closePanel();
      refreshDock();
    }

    /* ---------------- meta: trash + version log ---------------- */
    var metaHost = null;
    function renderMeta() {
      var host = document.getElementById("covibe-meta");
      if (!host) {
        host = el("section", "cv-meta"); host.id = "covibe-meta";
        root.appendChild(host);
      }
      metaHost = host; host.classList.add("cv-meta"); clearNode(host);
      host.appendChild(el("h2", "cv-meta-title", T.trash)); var trash = Array.isArray(state.trash) ? state.trash : [];
      if (!trash.length) host.appendChild(el("p", "cv-hint", T.trashEmpty));
      trash.forEach(function (item) {
        if (!item || !item.id) return; var d = el("details", "cv-trash-item");
        var label = item.label || T.deletedItem;
        d.setAttribute("data-covibe-id", item.id); d.setAttribute("data-covibe-label", label);
        d.appendChild(el("summary", "", label)); var body = el("div", "cv-trash-body");
        // Agent-authored markup from the injected state, never user comment text.
        body.innerHTML = item.html || ""; d.appendChild(body);
        host.appendChild(d);
      });
      if (trash.length) host.appendChild(el("p", "cv-hint", T.restoreHint));
      host.appendChild(el("h2", "cv-meta-title", T.versions)); var ol = el("ol", "cv-versions");
      (Array.isArray(state.versions) ? state.versions : []).slice().reverse().forEach(function (v) {
        var li = el("li"); li.appendChild(el("b", "", "r" + v.revision + " "));
        li.appendChild(el("span", "", v.summary || "")); ol.appendChild(li);
      }); host.appendChild(ol);
    }

    /* ---------------- targets / refresh ---------------- */
    function collectTargets() {
      var out = []; var rootIsTarget = root.getAttribute && root.getAttribute("data-covibe-id");
      if (rootIsTarget && !insideLayer(root)) out.push(root);
      walkElements(root, function (n) {
        if (n.getAttribute && n.getAttribute("data-covibe-id") && !insideLayer(n)) out.push(n);
      });
      return out;
    }
    function refreshTargets() {
      targetsList = collectTargets(); targetById = {};
      hasInteractiveTargets = false;
      targetsList.forEach(function (n) {
        var id = n.getAttribute("data-covibe-id"); if (!targetById[id]) targetById[id] = n;
        if (!labels[id]) labelOf(n, id);
        if (!n.__cvWired) {
          n.__cvWired = true; n.classList.add("cv-target");
          if (!isInteractiveNode(n) && !n.hasAttribute("tabindex")) {
            n.setAttribute("tabindex", "0"); n.__cvTab = true;
          }
          wired.push(n);
        }
        if (isInteractiveNode(n) || hasInteractiveWithin(n)) hasInteractiveTargets = true;
      }); nodeById = {};
      targetsList.forEach(function (n) { nodeById[n.getAttribute("data-covibe-id")] = n; });
    }
    function hasInteractiveWithin(node) {
      var found = false; walkElements(node, function (n) { if (isInteractiveNode(n)) found = true; });
      return found;
    }
    function byId(id) { return targetById[id] || nodeById[id] || null; }
    function refreshAll() {
      refreshTargets();
      targetsList.forEach(function (node) {
        if (!isSmallNode(node)) renderBlock(node);
        else if (threadsById[node.getAttribute("data-covibe-id")]) {
          var b = threadsById[node.getAttribute("data-covibe-id")]; if (b.parentNode) b.parentNode.removeChild(b);
          delete threadsById[node.getAttribute("data-covibe-id")];
        }
      }); placeBadges();
      if (panelFor && !panel.hidden) renderPanel(panelFor); refreshDock();
    }

    /* ---------------- events ---------------- */
    function closestTarget(target) {
      var n = target;
      while (n && n !== root) {
        if (root.contains && !root.contains(n)) break; if (n.getAttribute && n.getAttribute("data-covibe-id") && !insideLayer(n)) return n;
        n = n.parentNode;
      }
      if (root.getAttribute && root.getAttribute("data-covibe-id") && root.contains(target)) return root; return null;
    }
    function selectionQuote(node) {
      try {
        var sel = (typeof getSelection === "function") ? getSelection() : (global.getSelection ? global.getSelection() : null); if (!sel || sel.isCollapsed) return "";
        var anchor = sel.anchorNode; if (!anchor || !(node === anchor || (node.contains && node.contains(anchor)))) return "";
        return cleanQuote(String(sel), MAX_QUOTE);
      } catch (e) { return ""; }
    }
    function onClick(ev) {
      var target = ev.target; if (insideLayer(target)) return;
      var node = closestTarget(target); if (!node) return;
      var inter = interactiveAncestor(target);
      if (inter && node.contains && node.contains(inter)) {
        if (!review) return; // links, buttons, summary keep working outside review mode
        ev.preventDefault(); ev.stopPropagation();
      }
      var quote = selectionQuote(node); open(node.getAttribute("data-covibe-id"), quote || undefined);
    }
    function onKey(ev) {
      if (ev.key !== "Enter" && ev.key !== " ") return; var node = ev.target;
      if (!node || !node.getAttribute || insideLayer(node)) return; if (!node.getAttribute("data-covibe-id")) return;
      if (isInteractiveNode(node) && !review) return; ev.preventDefault();
      open(node.getAttribute("data-covibe-id"));
    }
    function onDocClick(ev) { if (panel.hidden) return; if (insideLayer(ev.target)) return; if (closestTarget(ev.target)) return; closePanel(); }
    function onDocKey(ev) {
      if (ev.key !== "Escape") return;
      if (!panel.hidden) { closePanel(); return; }
      var c = focusedElement(); var composerNode = c ? walkUp(c, function (n) { return hasClass(n, "cv-composer"); }) : null;
      if (composerNode && composerNode.getAttribute) closeComposer(composerNode.getAttribute("data-cv-for"));
    }
    function onResize() { placeBadges(); if (panelFor && !panel.hidden) renderPanel(panelFor); }
    root.addEventListener("click", onClick, true); root.addEventListener("keydown", onKey);
    document.addEventListener("click", onDocClick); document.addEventListener("keydown", onDocKey);
    global.addEventListener("resize", onResize);
    function onFocusChange() { clearTimeout(focusTimer); focusTimer = setTimeout(syncPolling, 0); }
    function markActivity() { lastActivity = Date.now(); }
    document.addEventListener("keydown", markActivity, true); document.addEventListener("input", markActivity, true); document.addEventListener("pointerdown", markActivity, true);
    document.addEventListener("visibilitychange", syncPolling);
    document.addEventListener("focusin", onFocusChange); document.addEventListener("focusout", onFocusChange);

    /* ---------------- boot ---------------- */
    var api = {
      ready: Promise.resolve({ transport: transport, mode: mode, markDelivery: markDelivery, updateMode: updateMode }),
      open: open, setVisible: setVisible, nextUnread: nextUnread, markRead: markRead, exportText: exportText,
      pending: function () { return pending.slice(); }, mode: function () { return mode; },
      transport: function () { return transport; }, storageOk: function () { return store.ok; },
      updateMode: function () { return updateMode; },
      checkForUpdate: checkForUpdate, polling: polling, retry: deliverAll,
      destroy: function () {
        destroyed = true; clearTimeout(focusTimer); clearTimeout(hlTimer); clearTimeout(toastTimer); clearTimeout(swapToastTimer); clearInterval(pollTimer); pollTimer = null;
        root.removeEventListener("click", onClick, true);
        root.removeEventListener("keydown", onKey); document.removeEventListener("click", onDocClick);
        document.removeEventListener("keydown", onDocKey); global.removeEventListener("resize", onResize);
        document.removeEventListener("visibilitychange", syncPolling); document.removeEventListener("focusin", onFocusChange); document.removeEventListener("focusout", onFocusChange);
        document.removeEventListener("keydown", markActivity, true); document.removeEventListener("input", markActivity, true); document.removeEventListener("pointerdown", markActivity, true);
        Object.keys(threadsById).forEach(function (id) {
          var box = threadsById[id]; if (box && box.parentNode) box.parentNode.removeChild(box);
        });
        Object.keys(badges).forEach(function (id) {
          var badge = badges[id]; if (badge && badge.parentNode) badge.parentNode.removeChild(badge);
        });
        wired.forEach(function (n) {
          if (n.classList) n.classList.remove("cv-target", "cv-hl");
          if (n.__cvTab && n.removeAttribute) { n.removeAttribute("tabindex"); n.__cvTab = false; }
          if (n.removeAttribute) n.removeAttribute("aria-expanded"); n.__cvWired = false;
        });
        if (ui.parentNode) ui.parentNode.removeChild(ui);
        if (metaHost) clearNode(metaHost);
        document.documentElement.classList.remove("cv-hidden", "cv-review");
        try {
          if (global.Covibe) {
            global.Covibe.__active = Math.max(0, (global.Covibe.__active || 1) - 1);
            global.Covibe.__destroyActive = null;
          }
        } catch (e) { /* ignore */ }
      }
    };
    renderMeta(); document.documentElement.classList.toggle("cv-hidden", !visible);
    refreshAll(); syncPolling();
    global.Covibe.__active = (global.Covibe.__active || 0) + 1;
    global.Covibe.__destroyActive = function () { api.destroy(); };
    global.Covibe.checkForUpdate = checkForUpdate;
    global.Covibe.showUpdateBanner = showUpdate;
    global.Covibe.showSwapToast = showSwapToast;
    return api;
  }

  // config helpers + exports
  function resolveState(opts, gcfg) {
    var raw = opts.state !== undefined ? opts.state : gcfg.state; if (raw && typeof raw === "object") return raw;
    var node = null;
    if (typeof raw === "string" && raw) {
      if (raw.charAt(0) === "#") node = document.getElementById(raw.slice(1));
      else if (document.querySelector) node = document.querySelector(raw);
    }
    if (!node) node = document.getElementById("covibe-state");
    if (!node) throw new Error("covibe: state not found; provide window.COVIBE.state or a #covibe-state script");
    try { return JSON.parse(node.textContent); }
    catch (e) { throw new Error("covibe: state JSON is invalid"); }
  }
  function normalizeTransport(value) { var v = String(value || "").toLowerCase(); return (v === "post" || v === "none") ? v : "manual"; }
  function metaUrlFor(endpoint) {
    var s = String(endpoint || ""), m = s.match(/^[a-z][a-z0-9+.-]*:\/\/[^\/]+/i);
    if (m) return m[0] + "/cv/meta";
    return s.charAt(0) === "/" ? "/cv/meta" : "";
  }
  function normalizeMode(value) { var v = String(value || "").toLowerCase(); return (v === "batch" || v === "manual") ? v : "live"; }
  function normalizeMarkDelivery(value) { return String(value || "").toLowerCase() === "defer" ? "defer" : "immediate"; }
  function normalizeUpdateMode(value) { var v = String(value || "").toLowerCase(); return (v === "banner" || v === "off") ? v : "hotswap"; }

  global.Covibe = { mount: mount, version: VERSION, data: data };
})(typeof window !== "undefined" ? window : this);
