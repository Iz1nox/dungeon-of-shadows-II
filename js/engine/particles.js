'use strict';

// Cząsteczki, teksty bojowe, pierścienie, smugi, wstrząs ekranu, błyski.
const Fx = {
  parts: [], texts: [], rings: [], slashes: [], beams: [],
  shakeT: 0, shakePow: 0, flashCol: null, flashA: 0,

  reset() {
    this.parts.length = 0; this.texts.length = 0; this.rings.length = 0;
    this.slashes.length = 0; this.beams.length = 0;
    this.shakeT = 0; this.flashA = 0;
  },

  burst(x, y, color, n = 8, o = {}) {
    if (this.parts.length > 900) return;
    for (let i = 0; i < n; i++) {
      const a = o.ang !== undefined ? o.ang + U.rand(-(o.spread || .6), o.spread || .6) : Math.random() * Math.PI * 2;
      const spd = U.rand(.5, o.spd || 3.5);
      this.parts.push({
        x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
        life: U.rand(.25, o.life || .6), maxLife: o.life || .6,
        size: U.rand(2, o.size || 5), color, grav: o.grav || 0,
        glow: o.glow !== false, drag: o.drag !== undefined ? o.drag : 3,
      });
    }
  },

  blood(x, y, n = 6) { this.burst(x, y, '#c02a2a', n, { spd: 3, grav: 5, glow: false, size: 4 }); },

  text(x, y, str, color = '#fff', size = 15) {
    if (this.texts.length > 60) this.texts.shift();
    this.texts.push({ x: x + U.rand(-.2, .2), y, vy: -1.6, life: 1, str, color, size });
  },

  ring(x, y, maxR, color, width = 3, life = .4) {
    this.rings.push({ x, y, r: 0, maxR, life, maxLifeR: life, color, width });
  },

  slash(x, y, ang, arc, range, color) {
    this.slashes.push({ x, y, ang, arc, range, life: .18, maxLife: .18, color });
  },

  beam(x1, y1, x2, y2, color, width = 3, life = .22) {
    this.beams.push({ x1, y1, x2, y2, color, width, life, maxLife: life });
  },

  shake(p) { this.shakePow = Math.max(this.shakePow, p); this.shakeT = Math.max(this.shakeT, .28); },

  flash(color, a = .25) { this.flashCol = color; this.flashA = Math.max(this.flashA, a); },

  update(dt) {
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.life -= dt;
      if (p.life <= 0) { this.parts.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vy += p.grav * dt;
      const dr = 1 - p.drag * dt;
      p.vx *= dr; p.vy *= dr;
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.life -= dt; t.y += t.vy * dt; t.vy *= (1 - 2 * dt);
      if (t.life <= 0) this.texts.splice(i, 1);
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.life -= dt;
      r.r = r.maxR * (1 - r.life / r.maxLifeR);
      if (r.life <= 0) this.rings.splice(i, 1);
    }
    for (let i = this.slashes.length - 1; i >= 0; i--) {
      const s = this.slashes[i];
      s.life -= dt;
      if (s.life <= 0) this.slashes.splice(i, 1);
    }
    for (let i = this.beams.length - 1; i >= 0; i--) {
      const b = this.beams[i];
      b.life -= dt;
      if (b.life <= 0) this.beams.splice(i, 1);
    }
    if (this.shakeT > 0) { this.shakeT -= dt; if (this.shakeT <= 0) this.shakePow = 0; }
    if (this.flashA > 0) this.flashA = Math.max(0, this.flashA - dt * 1.4);
  },

  shakeOffset() {
    if (this.shakeT <= 0) return { x: 0, y: 0 };
    const p = this.shakePow * (this.shakeT / .28);
    return { x: U.rand(-p, p), y: U.rand(-p, p) };
  },
};
