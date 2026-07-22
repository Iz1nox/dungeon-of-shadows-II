'use strict';

// Sterowanie dotykowe: wirtualny joystick (lewa strona), auto-celowanie,
// przyciski ataku/uniku/umiejętności (prawa strona). Aktywne tylko na
// urządzeniach z ekranem dotykowym.
const Touch = {
  enabled: false,
  joyId: null, base: { x: 0, y: 0 }, vec: { x: 0, y: 0 }, mag: 0,
  attackHeld: false,
  target: null,
  uiT: 0,
  JOY_R: 55,

  isTouchDevice() {
    return ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  },

  init() {
    if (!this.isTouchDevice()) return;
    this.enabled = true;
    document.body.classList.add('touch');

    // ===== joystick =====
    const zone = U.el('tc-joyzone');
    const joy = U.el('tc-joy');
    const knob = U.el('tc-knob');
    zone.addEventListener('pointerdown', e => {
      if (this.joyId !== null) return;
      e.preventDefault();
      Sfx.init();
      this.joyId = e.pointerId;
      this.base = { x: e.clientX, y: e.clientY };
      joy.style.display = 'block';
      joy.style.left = e.clientX + 'px';
      joy.style.top = e.clientY + 'px';
      zone.setPointerCapture(e.pointerId);
    });
    zone.addEventListener('pointermove', e => {
      if (e.pointerId !== this.joyId) return;
      e.preventDefault();
      let dx = e.clientX - this.base.x, dy = e.clientY - this.base.y;
      const len = Math.hypot(dx, dy);
      this.mag = U.clamp(len / this.JOY_R, 0, 1);
      if (len > this.JOY_R) { dx *= this.JOY_R / len; dy *= this.JOY_R / len; }
      knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      if (len > 4) { this.vec.x = dx / this.JOY_R; this.vec.y = dy / this.JOY_R; }
    });
    const joyEnd = e => {
      if (e.pointerId !== this.joyId) return;
      this.joyId = null;
      this.vec.x = 0; this.vec.y = 0; this.mag = 0;
      joy.style.display = 'none';
      knob.style.transform = 'translate(-50%,-50%)';
    };
    zone.addEventListener('pointerup', joyEnd);
    zone.addEventListener('pointercancel', joyEnd);

    // ===== przyciski =====
    const bind = (id, down, up) => {
      const el = U.el(id);
      el.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); Sfx.init(); down(); });
      if (up) {
        el.addEventListener('pointerup', e => { e.preventDefault(); up(); });
        el.addEventListener('pointercancel', () => up());
        el.addEventListener('pointerleave', () => up());
      }
    };
    bind('tc-attack', () => { this.attackHeld = true; }, () => { this.attackHeld = false; });
    bind('tc-dash', () => Player.dash());
    bind('tc-pot-hp', () => Inv.quickUse('hp'));
    bind('tc-pot-mp', () => Inv.quickUse('mp'));
    bind('tc-interact', () => Events.interact());
    bind('tc-inv', () => InvUI.toggle());
    bind('tc-menu', () => SettingsUI.toggle());
  },

  // pasek umiejętności — budowany przy starcie wyprawy
  buildSkills(p) {
    if (!this.enabled) return;
    const row = U.el('tc-skills');
    row.innerHTML = '';
    p.skills.forEach((sk, i) => {
      const b = document.createElement('div');
      b.className = 'tc-btn tc-skill' + (sk.ult ? ' tc-ult' : '');
      b.innerHTML = `${sk.icon}<div class="cd"></div>`;
      b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); Skills.cast(i); });
      row.appendChild(b);
    });
  },

  // auto-celowanie: najbliższy widoczny wróg
  autoAim() {
    // gracz używa prawdziwej myszy (laptop dotykowy) → nie przejmuj celowania
    if (Game.lastMouseT && performance.now() - Game.lastMouseT < 3000) { this.target = null; return; }
    const s = Game.s, p = s.p;
    let best = null, bd = 11;
    for (const e of s.enemies) {
      if (e.invisT > 0) continue;
      if (!s.map.visible[(e.y | 0) * s.map.w + (e.x | 0)]) continue;
      const d = U.dist(p.x, p.y, e.x, e.y);
      if (d < bd) { bd = d; best = e; }
    }
    this.target = best;
    if (best) {
      Game.mouse.wx = best.x; Game.mouse.wy = best.y;
    } else if (this.mag > .15) {
      Game.mouse.wx = p.x + this.vec.x * 5; Game.mouse.wy = p.y + this.vec.y * 5;
    } else {
      Game.mouse.wx = p.x + Math.cos(p.dir) * 5; Game.mouse.wy = p.y + Math.sin(p.dir) * 5;
    }
  },

  // wywoływane co klatkę z pętli gry
  frame(dt) {
    if (!this.enabled || !Game.alive()) return;
    this.autoAim();
    this.uiT -= dt;
    if (this.uiT > 0) return;
    this.uiT = .2;
    const p = Game.s.p;
    // cooldowny umiejętności
    const btns = U.el('tc-skills').children;
    for (let i = 0; i < btns.length && i < p.skills.length; i++) {
      const sk = p.skills[i];
      const cd = btns[i].querySelector('.cd');
      if (sk.cdT > 0) { cd.style.display = 'flex'; cd.textContent = Math.ceil(sk.cdT); }
      else cd.style.display = 'none';
      btns[i].classList.toggle('nomana', p.mp < sk.mp);
    }
    // mikstury
    U.el('tc-hp-n').textContent = Inv.countPotions('hp');
    U.el('tc-mp-n').textContent = Inv.countPotions('mp');
    // interakcja
    U.el('tc-interact').style.display = Events.findInteractable() ? 'flex' : 'none';
  },
};
