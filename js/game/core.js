'use strict';

// Główny obiekt gry — stan, komunikaty, pomocnicze.
// Metody dopisują kolejne moduły przez Object.assign(Game, {...}).
const Game = {
  s: null,          // stan bieżącej wyprawy
  canvas: null, ctx: null,
  mouse: { x: 0, y: 0, wx: 0, wy: 0, down: false, rdown: false },
  keys: {},
  cam: { x: 0, y: 0 },

  // aktywny poziom trudności (bezpieczny fallback na Śmiałka)
  diff() {
    return DIFFICULTY[this.s && this.s.difficulty] || DIFFICULTY.normal;
  },

  newRunState(clsId) {
    const cls = ClassDB[clsId];
    return {
      running: true, over: false, victory: false, paused: false,
      endless: false, floor: 1, time: 0,
      difficulty: Meta.data.difficulty || 'normal',
      map: null,
      p: this.makePlayer(cls),
      enemies: [], minions: [], projectiles: [], drops: [],
      zones: [], telegraphs: [], traps: [],
      boss: null, bossDefeated: false, bossHitTaken: false,
      combo: { count: 0, timer: 0 },
      runStats: {
        kills: 0, elites: 0, goldEarned: 0, dmgDealt: 0, dmgTaken: 0,
        potionsUsed: 0, essenceEarned: 0, itemsFound: 0, startTime: Date.now(),
      },
    };
  },

  makePlayer(cls) {
    const meta = Meta.bonuses();
    const p = {
      cls: cls.id, name: cls.name, icon: cls.icon,
      x: 0, y: 0, dir: 0, radius: BAL.playerRadius,
      level: 1, xp: 0, xpNext: Progression.xpFor(1),
      gold: 0, dust: meta.dust,
      talents: {},
      equip: { weapon: null, helmet: null, armor: null, boots: null, amulet: null, ring: null },
      inv: [], invMax: 32,
      skills: cls.skills.map(sk => Object.assign({ cdT: 0 }, sk)),
      buffs: [], statuses: {},
      shield: 0, shieldMax: 0, shieldT: 0,
      attackCdT: 0,
      dashCharges: BAL.dashChargesBase, dashRegenT: 0, dashT: 0, dashDirX: 0, dashDirY: 0, iframesT: 0,
      stealthT: 0, stealthCrit: false,
      regenDelayT: 0,
      hitFlashT: 0,
      phoenixFloorUsed: false, metaReviveUsed: false,
      d: null, // statystyki pochodne — Player.recalc()
    };
    // mikstury startowe
    p.inv.push(ItemDB.makeConsumable('potion_hp_s', 2 + meta.potions));
    p.inv.push(ItemDB.makeConsumable('potion_mp_s', 1));
    Player.recalc(p);
    p.hp = p.d.maxHp; p.mp = p.d.maxMp;
    return p;
  },

  msg(txt, cls = '') {
    const log = U.el('message-log');
    if (!log) return;
    const div = document.createElement('div');
    if (cls) div.className = 'm-' + cls;
    div.textContent = txt;
    log.appendChild(div);
    while (log.children.length > 9) log.removeChild(log.firstChild);
    // wygaszanie starych
    setTimeout(() => { div.style.transition = 'opacity 1.2s'; div.style.opacity = '0'; }, 7000);
  },

  clearLog() {
    const log = U.el('message-log');
    if (log) log.innerHTML = '';
  },

  addCombo() {
    const c = this.s.combo;
    c.count++; c.timer = BAL.comboWindow;
    if (c.count >= 3) {
      const el = U.el('combo-display');
      el.innerHTML = `${c.count}<span class="cx">COMBO</span>`;
      el.classList.add('show');
    }
  },

  // wspólny dostęp: żywy stan czy nie
  alive() { return this.s && this.s.running && !this.s.over; },
};
