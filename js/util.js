'use strict';

// Narzędzia ogólne
const U = {
  rand: (a, b) => a + Math.random() * (b - a),
  randi: (a, b) => Math.floor(a + Math.random() * (b - a + 1)),
  chance: p => Math.random() < p,
  choice: arr => arr[Math.floor(Math.random() * arr.length)],
  clamp: (v, a, b) => v < a ? a : v > b ? b : v,
  lerp: (a, b, t) => a + (b - a) * t,
  dist: (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay),
  dist2: (ax, ay, bx, by) => (bx - ax) * (bx - ax) + (by - ay) * (by - ay),
  angle: (ax, ay, bx, by) => Math.atan2(by - ay, bx - ax),
  // różnica kątów znormalizowana do [-PI, PI]
  angDiff(a, b) {
    let d = (b - a) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return d;
  },
  shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  },
  fmt(n) {
    n = Math.round(n);
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 10000) return (n / 1000).toFixed(1) + 'k';
    return '' + n;
  },
  pct: v => Math.round(v * 100) + '%',
  timeStr(sec) {
    const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
  },
  el: id => document.getElementById(id),
  esc(str) {
    return String(str).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  },
};
