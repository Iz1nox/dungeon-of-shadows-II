'use strict';

// Minimalna atrapa przeglądarki: tyle DOM-u, ile gra realnie dotyka poza rysowaniem.
// Dzięki temu logikę można odpalić w Node bez canvasa i bez okna.

function makeEl(id) {
  const classes = new Set();
  const el = {
    id: id || '',
    style: {},
    dataset: {},
    children: [],
    innerHTML: '',
    textContent: '',
    value: '',
    classList: {
      add: (...c) => c.forEach(x => classes.add(x)),
      remove: (...c) => c.forEach(x => classes.delete(x)),
      toggle: (c, on) => { if (on === undefined) classes.has(c) ? classes.delete(c) : classes.add(c); else on ? classes.add(c) : classes.delete(c); },
      contains: c => classes.has(c),
    },
    appendChild(child) { this.children.push(child); return child; },
    prepend(child) { this.children.unshift(child); return child; },
    removeChild(child) {
      const i = this.children.indexOf(child);
      if (i >= 0) this.children.splice(i, 1);
      return child;
    },
    querySelector: () => makeEl(),
    querySelectorAll: () => [],
    addEventListener() {},
    removeEventListener() {},
    setAttribute() {},
    getAttribute: () => null,
    getBoundingClientRect: () => ({ left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 }),
    focus() {}, click() {}, blur() {},
    setPointerCapture() {},
    // canvas — gdyby coś jednak sięgnęło po kontekst
    getContext: () => make2dContext(),
    width: 800, height: 600,
  };
  Object.defineProperty(el, 'firstChild', { get() { return el.children[0] || null; } });
  Object.defineProperty(el, 'lastChild', { get() { return el.children[el.children.length - 1] || null; } });
  return el;
}

// kontekst 2D, w którym każda metoda jest pusta — gdyby test chciał rysować
function make2dContext() {
  const noop = () => {};
  const ctx = {
    canvas: { width: 800, height: 600 },
    createRadialGradient: () => ({ addColorStop: noop }),
    createLinearGradient: () => ({ addColorStop: noop }),
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
    measureText: () => ({ width: 10 }),
  };
  for (const m of ['save', 'restore', 'translate', 'rotate', 'scale', 'beginPath', 'closePath',
    'moveTo', 'lineTo', 'arc', 'ellipse', 'rect', 'fill', 'stroke', 'fillRect', 'strokeRect',
    'clearRect', 'fillText', 'strokeText', 'drawImage', 'setLineDash', 'putImageData', 'roundRect']) {
    ctx[m] = noop;
  }
  return ctx;
}

function install(context) {
  const byId = new Map();
  const doc = {
    getElementById(id) {
      if (!byId.has(id)) byId.set(id, makeEl(id));
      return byId.get(id);
    },
    createElement: () => makeEl(),
    querySelector: () => makeEl(),
    querySelectorAll: () => [],
    addEventListener() {},
    removeEventListener() {},
    body: makeEl('body'),
    documentElement: makeEl('html'),
    hidden: false,
    visibilityState: 'visible',
    hasFocus: () => true,
  };

  const store = new Map();
  const localStorage = {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: k => store.delete(k),
    clear: () => store.clear(),
    get length() { return store.size; },
    key: i => [...store.keys()][i],
  };

  context.document = doc;
  context.localStorage = localStorage;
  context.navigator = { maxTouchPoints: 0, userAgent: 'node-test' };
  context.performance = { now: () => Date.now() };
  context.requestAnimationFrame = () => 0;
  context.cancelAnimationFrame = () => {};
  context.matchMedia = () => ({ matches: false, addEventListener() {}, addListener() {} });
  context.innerWidth = 1280;
  context.innerHeight = 800;
  context.addEventListener = () => {};
  context.removeEventListener = () => {};
  context.setTimeout = setTimeout;
  context.clearTimeout = clearTimeout;
  context.setInterval = setInterval;
  context.clearInterval = clearInterval;
  context.console = console;
  // brak AudioContext → Sfx.init() sam się wyłączy (enabled = false)
  context.window = context;
  return { doc, localStorage };
}

module.exports = { install, makeEl, make2dContext };
