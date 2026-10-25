// Minimal DOM stub for the covibe comment layer self-test.
//
// jsdom is not available in this environment, so this file implements just
// enough of the DOM for the layer: element trees, classList, attributes,
// textContent, event bubbling/capture, focus, localStorage and a swappable
// fetch/clipboard. It is a TEST FIXTURE, not part of the deliverable layer.
"use strict";

const fs = require("fs");
const path = require("path");

const LAYER_SRC = fs.readFileSync(path.join(__dirname, "..", "assets", "comment-layer.js"), "utf8");

let uid = 0;

class StubEvent {
  constructor(type, init = {}) {
    this.type = String(type || "event");
    this.bubbles = init.bubbles !== false;
    this.cancelable = init.cancelable !== false;
    this.defaultPrevented = false;
    this.target = null;
    this.currentTarget = null;
    this.key = init.key || "";
    this._stop = false;
    this._stopImmediate = false;
  }
  preventDefault() { if (this.cancelable) this.defaultPrevented = true; }
  stopPropagation() { this._stop = true; }
  stopImmediatePropagation() { this._stop = true; this._stopImmediate = true; }
}
class StubMouseEvent extends StubEvent {}
class StubKeyboardEvent extends StubEvent {}
class StubInputEvent extends StubEvent {}

class StubClassList {
  constructor(node) { this._node = node; this._set = new Set(); }
  _sync(value) {
    this._set = new Set(String(value || "").split(/\s+/).filter(Boolean));
  }
  _value() { return Array.from(this._set).join(" "); }
  add(...names) { names.forEach((n) => this._set.add(n)); this._node._className = this._value(); }
  remove(...names) { names.forEach((n) => this._set.delete(n)); this._node._className = this._value(); }
  contains(name) { return this._set.has(name); }
  toggle(name, force) {
    const on = force === undefined ? !this._set.has(name) : !!force;
    if (on) this._set.add(name); else this._set.delete(name);
    this._node._className = this._value();
    return on;
  }
  replace(value) { this._sync(value); this._node._className = this._value(); }
}

function later(callbacks) {
  // listeners are invoked synchronously in real DOM; keep that behaviour.
  callbacks.forEach((fn) => fn());
}

class StubNode {
  constructor(doc, tag, nodeType = 1) {
    this.ownerDocument = doc;
    this.nodeType = nodeType;
    this.tagName = String(tag || "div").toUpperCase();
    this.parentNode = null;
    this._children = [];
    this._text = "";
    this._html = "";
    this._className = "";
    this._attributes = new Map();
    this._listeners = Object.create(null);
    this.classList = new StubClassList(this);
    this.style = {};
    this.hidden = false;
    this.value = "";
    this.disabled = false;
    this.readOnly = false;
    this.open = false;
    this._uid = ++uid;
    this._rect = { left: 10, top: 20, right: 110, bottom: 40, width: 100, height: 20 };
  }
  get id() { return this._attributes.get("id") || this._id || ""; }
  set id(value) { this._id = value; }
  get className() { return this._className; }
  set className(value) { this.classList._sync(value); this._className = this.classList._value(); }
  get children() { return this._children; }
  get childNodes() { return this._children; }
  get firstChild() { return this._children[0] || null; }
  get nextSibling() {
    if (!this.parentNode) return null;
    const list = this.parentNode._children;
    return list[list.indexOf(this) + 1] || null;
  }
  get nextElementSibling() { return this.nextSibling; }
  get parentElement() { return this.parentNode && this.parentNode.nodeType === 1 ? this.parentNode : null; }
  get tag() { return this.tagName; }

  get textContent() {
    if (this._children.length) return this._children.map((c) => c.textContent).join("");
    return this._text || "";
  }
  set textContent(value) {
    this._children.forEach((c) => { c.parentNode = null; });
    this._children = [];
    this._text = value == null ? "" : String(value);
  }
  get innerHTML() { return this._html || ""; }
  set innerHTML(value) {
    this._html = value == null ? "" : String(value);
    this._children.forEach((c) => { c.parentNode = null; });
    this._children = [];
    this._text = "";
  }

  appendChild(child) {
    if (child.parentNode) child.parentNode.removeChild(child);
    child.parentNode = this;
    this._children.push(child);
    return child;
  }
  insertBefore(child, ref) {
    if (child.parentNode) child.parentNode.removeChild(child);
    child.parentNode = this;
    if (!ref) { this._children.push(child); return child; }
    const index = this._children.indexOf(ref);
    if (index < 0) this._children.push(child);
    else this._children.splice(index, 0, child);
    return child;
  }
  removeChild(child) {
    const index = this._children.indexOf(child);
    if (index >= 0) { this._children.splice(index, 1); child.parentNode = null; }
    return child;
  }
  remove() { if (this.parentNode) this.parentNode.removeChild(this); }
  contains(node) {
    for (let n = node; n; n = n.parentNode) if (n === this) return true;
    return false;
  }

  setAttribute(name, value) {
    name = String(name);
    this._attributes.set(name, String(value));
    if (name === "id") this._id = String(value);
  }
  getAttribute(name) {
    name = String(name);
    if (name === "class") return this.className;
    const value = this._attributes.get(name);
    return value === undefined ? null : value;
  }
  hasAttribute(name) { return this._attributes.has(String(name)) || (name === "id" && !!this._id); }
  removeAttribute(name) {
    name = String(name);
    this._attributes.delete(name);
    if (name === "id") this._id = "";
  }

  addEventListener(type, fn) {
    if (typeof fn !== "function") return;
    const capture = arguments[2] === true;
    const key = (capture ? "c:" : "b:") + type;
    (this._listeners[key] || (this._listeners[key] = [])).push(fn);
  }
  removeEventListener(type, fn) {
    const capture = arguments[2] === true;
    const key = (capture ? "c:" : "b:") + type;
    const list = this._listeners[key];
    if (list) this._listeners[key] = list.filter((f) => f !== fn);
  }

  _fire(event, capture) {
    const type = event.type;
    const key = capture ? "c:" + type : "b:" + type;
    const list = this._listeners[key];
    if (!list) return;
    for (const fn of list.slice()) {
      if (event._stopImmediate) return;
      event.currentTarget = this;
      fn.call(this, event);
    }
  }

  dispatchEvent(event) {
    event.target = this;
    const chain = [];
    for (let n = this; n; n = n.parentNode) chain.push(n);
    chain.reverse(); // document .. target
    const win = this.ownerDocument && this.ownerDocument.defaultView;
    if (win && chain[0] !== win) chain.unshift(win);
    // capture: window -> target's parent
    for (let i = 0; i < chain.length - 1 && !event._stop; i++) chain[i]._fire(event, true);
    // target: capture then bubble listeners
    if (!event._stop) {
      const target = chain[chain.length - 1];
      target._fire(event, true);
      if (!event._stop) target._fire(event, false);
    }
    // bubble: target's parent -> window
    if (event.bubbles) {
      for (let i = chain.length - 2; i >= 0 && !event._stop; i--) chain[i]._fire(event, false);
    }
    event.currentTarget = null;
    return !event.defaultPrevented;
  }

  focus() { if (this.ownerDocument) this.ownerDocument.activeElement = this; }
  select() { this.selected = true; }
  scrollIntoView() { this.scrolledIntoView = true; }
  getBoundingClientRect() { return this._rect; }
}

class StubTextNode {
  constructor(doc, text) {
    this.ownerDocument = doc;
    this.nodeType = 3;
    this.parentNode = null;
    this._text = text == null ? "" : String(text);
  }
  get textContent() { return this._text; }
  set textContent(value) { this._text = value == null ? "" : String(value); }
  toString() { return this._text; }
}

class StubDocument extends StubNode {
  constructor() {
    super(null, "#document", 9);
    this.ownerDocument = this;
    this.activeElement = null;
    this.documentElement = new StubNode(this, "html");
    this.documentElement.parentNode = this;
    this._children.push(this.documentElement);
    this.head = new StubNode(this, "head");
    this.body = new StubNode(this, "body");
    this.documentElement.appendChild(this.head);
    this.documentElement.appendChild(this.body);
    this.activeElement = this.body;
  }
  createElement(tag) { return new StubNode(this, tag); }
  createElementNS(ns, tag) { return new StubNode(this, tag); }
  createTextNode(text) { return new StubTextNode(this, text); }
  getElementById(id) {
    let found = null;
    const walk = (node) => {
      for (const child of node._children) {
        if (child.nodeType !== 1) continue;
        if (child.id === String(id)) { found = child; return; }
        walk(child);
        if (found) return;
      }
    };
    walk(this);
    return found;
  }
  querySelectorAll() { return []; }
  querySelector() { return null; }
}

function makeStorage(initial, mode) {
  const map = new Map(Object.entries(initial || {}).map(([k, v]) => [String(k), String(v)]));
  const broken = mode === "broken";
  return {
    _map: map,
    get length() { return map.size; },
    key(index) { return Array.from(map.keys())[index] || null; },
    getItem(key) {
      if (broken) throw new Error("storage disabled");
      key = String(key);
      return map.has(key) ? map.get(key) : null;
    },
    setItem(key, value) {
      if (broken) throw new Error("quota exceeded");
      map.set(String(key), String(value));
    },
    removeItem(key) {
      if (broken) throw new Error("storage disabled");
      map.delete(String(key));
    },
    clear() { map.clear(); }
  };
}

function loadLayer(win) {
  const factory = new Function(
    "window", "document", "localStorage", "navigator", "location", "matchMedia",
    "getSelection", "fetch", "SVGElement",
    LAYER_SRC + "\n;return window.Covibe;"
  );
  return factory(win, win.document, win.localStorage, win.navigator, win.location,
    win.matchMedia, win.getSelection, win.fetch, undefined);
}

function createPage(options = {}) {
  const doc = new StubDocument();
  const localStorage = makeStorage(options.storageData, options.storage);
  const win = {
    document: doc,
    localStorage,
    navigator: { clipboard: options.clipboard || null, userAgent: "covibe-node-stub" },
    location: { href: options.url || "file:///demo/page.html", pathname: "/demo/page.html", origin: "file://" },
    scrollX: 0, scrollY: 0, innerWidth: 1280, innerHeight: 900,
    setTimeout, clearTimeout,
    matchMedia: () => ({ matches: false, media: "", addEventListener() {}, removeEventListener() {} }),
    getSelection: () => win.__selection || null,
    fetch: options.fetch || null,
    MouseEvent: StubMouseEvent,
    KeyboardEvent: StubKeyboardEvent,
    InputEvent: StubInputEvent,
    Event: StubEvent,
    addEventListener(type, fn) {
      if (typeof fn !== "function") return;
      (win._listeners[type] || (win._listeners[type] = [])).push(fn);
    },
    removeEventListener(type, fn) {
      if (win._listeners[type]) win._listeners[type] = win._listeners[type].filter((f) => f !== fn);
    },
    dispatchEvent(event) {
      event.target = win;
      (win._listeners[event.type] || []).slice().forEach((fn) => fn.call(win, event));
      return !event.defaultPrevented;
    },
    _fire(event) {
      const list = win._listeners[event.type];
      if (!list) return;
      for (const fn of list.slice()) {
        if (event._stopImmediate) return;
        event.currentTarget = win;
        fn.call(win, event);
      }
    },
    _listeners: Object.create(null)
  };
  win.window = win;
  doc.visibilityState = "visible";
  doc.hidden = false;
  doc.defaultView = win;
  doc.ownerDocument = doc;
  win.Covibe = loadLayer(win);
  return { win, doc, storage: localStorage, Covibe: win.Covibe };
}

/** h(doc, "p", { class: "x", attrs: { "data-covibe-id": "p1" }, text: "hi" }) */
function h(doc, tag, props = {}, children = []) {
  const node = doc.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === "class") node.className = value;
    else if (key === "text") node.textContent = value;
    else if (key === "attrs") Object.entries(value).forEach(([name, val]) => node.setAttribute(name, val));
    else node[key] = value;
  }
  children.forEach((child) => node.appendChild(child));
  return node;
}

function buildPage(page, spec) {
  // spec: [{ tag, props, children: [...] }]
  const make = (node) => h(page.doc, node.tag, node.props || {}, (node.children || []).map(make));
  return (spec || []).map(make);
}

function findAll(root, predicate) {
  const out = [];
  const walk = (node) => {
    for (const child of node._children || []) {
      if (child.nodeType !== 1) continue;
      if (predicate(child)) out.push(child);
      walk(child);
    }
  };
  walk(root);
  return out;
}
function findOne(root, predicate) { return findAll(root, predicate)[0] || null; }
function hasClass(node, cls) { return !!node && node.classList.contains(cls); }
function textOf(node) { return node ? node.textContent : ""; }
function click(w, node) {
  return node.dispatchEvent(new w.MouseEvent("click", { bubbles: true, cancelable: true }));
}
function keydown(w, node, key) {
  return node.dispatchEvent(new w.KeyboardEvent("keydown", { bubbles: true, cancelable: true, key }));
}
function input(w, node, value) {
  node.value = value;
  node.dispatchEvent(new w.InputEvent("input", { bubbles: true }));
}
function settle() {
  return new Promise((resolve) => setTimeout(resolve, 0)).then(() => new Promise((resolve) => setTimeout(resolve, 0)));
}

module.exports = {
  createPage, loadLayer, h, buildPage, findAll, findOne, hasClass, textOf,
  click, keydown, input, settle, StubEvent, StubMouseEvent, StubKeyboardEvent
};
