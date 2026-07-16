'use strict';

// Statystyki pochodne gracza, ruch, unik, atak podstawowy, buffy.
const Player = {

  // Zbiera: bazę klasy + poziom + ekwipunek + talenty + metę + buffy → p.d
  recalc(p) {
    const cls = ClassDB[p.cls];
    const meta = Meta.bonuses();
    const lvl = p.level - 1;
    const d = {
      maxHp: cls.stats.hp + lvl * 9 + meta.hp,
      maxMp: cls.stats.mp + lvl * 5,
      atk: cls.stats.atk + lvl * 1.6 + meta.atk,
      def: cls.stats.def + lvl * .7 + meta.def,
      crit: cls.stats.crit, critDmg: 1.5,
      speed: cls.stats.speed, spdPct: meta.spdPct,
      spellPower: cls.stats.spellPower, spellPct: 0,
      atkPct: 0, lifesteal: 0, dodge: 0,
      hpRegen: BAL.baseRegenHp, mpRegen: BAL.baseRegenMp,
      goldPct: meta.goldPct, xpPct: meta.xpPct, cdr: 0,
      thorns: 0, luck: 0,
      burnHit: 0, poisonHit: 0, iceHit: 0, shadowHit: 0,
      minionMax: 4, minionDmg: 0,
      dashMax: BAL.dashChargesBase,
      hpPct: 0, defFlat: 0,
      flags: {},
    };

    const addStat = (key, val) => {
      switch (key) {
        case 'atk': d.atk += val; break;
        case 'hp': d.maxHp += val; break;
        case 'mp': d.maxMp += val; break;
        case 'def': d.def += val; break;
        case 'crit': d.crit += val; break;
        case 'critDmg': d.critDmg += val; break;
        case 'atkPct': d.atkPct += val; break;
        case 'spdPct': d.spdPct += val; break;
        case 'spellPct': d.spellPct += val; break;
        case 'lifesteal': d.lifesteal += val; break;
        case 'dodge': d.dodge += val; break;
        case 'mpRegen': d.mpRegen += val; break;
        case 'hpRegen': d.hpRegen += val; break;
        case 'goldPct': d.goldPct += val; break;
        case 'xpPct': d.xpPct += val; break;
        case 'cdr': d.cdr += val; break;
        case 'thorns': d.thorns += val; break;
        case 'luck': d.luck += val; break;
        case 'burnHit': d.burnHit += val; break;
        case 'poisonHit': d.poisonHit += val; break;
        case 'iceHit': d.iceHit += val; break;
        case 'minionMax': d.minionMax += val; break;
        case 'extraDash': d.dashMax += val; break;
        case 'hpPct': d.hpPct += val; break;
        case 'defFlat': d.def += val; break;
      }
    };

    // ekwipunek
    for (const slot in p.equip) {
      const it = p.equip[slot];
      if (!it) continue;
      const plusMult = 1 + it.plus * .12;
      for (const k in it.stats) addStat(k, Math.round(it.stats[k] * plusMult));
      for (const a of it.affixes) addStat(ItemDB.affixes[a.id].key, a.val);
      for (const f in it.flags) {
        if (f === 'shadowHit') d.shadowHit += it.flags[f];
        else if (f === 'minionMax') d.minionMax += it.flags[f];
        else if (f === 'minionDmg') d.minionDmg += it.flags[f];
        else if (f === 'extraDash') d.dashMax += it.flags[f];
        else if (f === 'spdPct') d.spdPct += it.flags[f];
        else if (f === 'hpPct') d.hpPct += it.flags[f];
        else if (f === 'dodge') d.dodge += it.flags[f];
        else d.flags[f] = (d.flags[f] || 0) + it.flags[f];
      }
    }

    // talenty
    for (const tid in p.talents) {
      const t = TalentDB.byId(tid, p.cls);
      if (!t) continue;
      const rank = p.talents[tid];
      if (t.mod) for (const k in t.mod) addStat(k, t.mod[k] * rank);
      if (t.flag) d.flags[t.flag] = (d.flags[t.flag] || 0) + t.flagVal * rank;
    }

    // ofiary z Ołtarzy Krwi (na czas wyprawy)
    if (p.altarBonus) d.atk += p.altarBonus;

    // buffy
    for (const b of p.buffs) {
      if (b.atkPct) d.atkPct += b.atkPct;
      if (b.spdPct) d.spdPct += b.spdPct;
      if (b.defFlat) d.def += b.defFlat;
      if (b.lifesteal) d.lifesteal += b.lifesteal;
    }

    // statusy na graczu
    if (p.statuses.chill) d.spdPct -= BAL.chillSlow;

    // berserk
    if (d.flags.berserk && p.hp !== undefined && p.hp < d.maxHp * .35) d.atkPct += d.flags.berserk;

    d.maxHp = Math.round(d.maxHp * (1 + d.hpPct));
    d.atk = d.atk * (1 + d.atkPct);
    d.speed = Math.max(1.2, d.speed * (1 + d.spdPct));
    d.spellPower = 1 + d.spellPower + d.spellPct;
    d.crit = U.clamp(d.crit, 0, .8);
    d.dodge = U.clamp(d.dodge, 0, .5);
    d.cdr = U.clamp(d.cdr, 0, .5);
    p.d = d;

    if (p.hp !== undefined) p.hp = Math.min(p.hp, d.maxHp);
    if (p.mp !== undefined) p.mp = Math.min(p.mp, d.maxMp);
    if (p.dashCharges > d.dashMax) p.dashCharges = d.dashMax;
  },

  update(dt) {
    const s = Game.s, p = s.p, map = s.map;
    this.recalc(p);
    const d = p.d;

    // timery
    if (p.attackCdT > 0) p.attackCdT -= dt;
    if (p.iframesT > 0) p.iframesT -= dt;
    if (p.hitFlashT > 0) p.hitFlashT -= dt;
    if (p.stealthT > 0) p.stealthT -= dt;
    if (p.regenDelayT > 0) p.regenDelayT -= dt;
    if (p.shieldT > 0) { p.shieldT -= dt; if (p.shieldT <= 0) p.shield = 0; }
    for (const sk of p.skills) if (sk.cdT > 0) sk.cdT -= dt;

    // buffy
    for (let i = p.buffs.length - 1; i >= 0; i--) {
      const b = p.buffs[i];
      b.t -= dt;
      if (b.aura) this.tickAura(p, b.aura, dt);
      if (b.t <= 0) p.buffs.splice(i, 1);
    }

    // statusy (dot na graczu)
    Combat.updateStatuses(p, dt, true);

    // regeneracja
    if (p.regenDelayT <= 0 && p.hp > 0) p.hp = Math.min(d.maxHp, p.hp + d.hpRegen * dt);
    p.mp = Math.min(d.maxMp, p.mp + d.mpRegen * dt);

    // ładunki uniku
    if (p.dashCharges < d.dashMax) {
      p.dashRegenT += dt;
      if (p.dashRegenT >= BAL.dashRecharge) { p.dashRegenT = 0; p.dashCharges++; }
    } else p.dashRegenT = 0;

    // ruch
    const stunned = p.statuses.stun || p.statuses.freeze;
    let mvx = 0, mvy = 0;
    if (!stunned) {
      if (Game.keys['w'] || Game.keys['arrowup']) mvy -= 1;
      if (Game.keys['s'] || Game.keys['arrowdown']) mvy += 1;
      if (Game.keys['a'] || Game.keys['arrowleft']) mvx -= 1;
      if (Game.keys['d'] || Game.keys['arrowright']) mvx += 1;
    }
    let spd = d.speed;
    if (p.dashT > 0) {
      p.dashT -= dt;
      mvx = p.dashDirX; mvy = p.dashDirY; spd = BAL.dashSpeed;
      Fx.burst(p.x, p.y, '#4adfff', 1, { spd: 1, life: .3, size: 4 });
    }
    if (mvx || mvy) {
      const len = Math.hypot(mvx, mvy);
      const nx = p.x + (mvx / len) * spd * dt;
      const ny = p.y + (mvy / len) * spd * dt;
      this.moveWithCollision(p, nx, ny, map);
    }

    // zagrożenia terenu
    this.tileHazards(p, dt);

    // celowanie
    p.dir = U.angle(p.x, p.y, Game.mouse.wx, Game.mouse.wy);

    // atak podstawowy (przytrzymanie LPM)
    if (Game.mouse.down && !stunned && p.attackCdT <= 0 && !s.paused) this.attack();
  },

  moveWithCollision(ent, nx, ny, map) {
    const r = ent.radius;
    if (Dungeon.circleFree(map, nx, ny, r)) { ent.x = nx; ent.y = ny; return; }
    if (Dungeon.circleFree(map, nx, ent.y, r)) { ent.x = nx; return; }
    if (Dungeon.circleFree(map, ent.x, ny, r)) { ent.y = ny; }
  },

  tileHazards(p, dt) {
    const t = Dungeon.tile(Game.s.map, p.x | 0, p.y | 0);
    p.hazardT = (p.hazardT || 0) - dt;
    if (p.hazardT > 0) return;
    if (t === TILE.SPIKES && p.dashT <= 0) {
      p.hazardT = .8;
      Combat.hitPlayer(6 + Game.s.floor * 1.5, { element: 'phys', source: 'Kolce' });
    } else if (t === TILE.LAVA) {
      p.hazardT = .5;
      Combat.hitPlayer(8 + Game.s.floor, { element: 'fire', source: 'Lawa' });
      Combat.applyStatus(p, 'burn', 2, 0, true);
    } else if (t === TILE.POISON) {
      p.hazardT = .7;
      Combat.applyStatus(p, 'poison', 3, 0, true);
    } else if (t === TILE.ICE) {
      p.hazardT = .6;
      Combat.applyStatus(p, 'chill', 1.2, 0, true);
    } else if (t === TILE.VOID) {
      p.hazardT = .5;
      Combat.hitPlayer(10 + Game.s.floor * 1.2, { element: 'shadow', source: 'Pustka' });
    }
  },

  dash() {
    const p = Game.s.p;
    if (p.dashCharges <= 0 || p.dashT > 0) return;
    if (p.statuses.freeze || p.statuses.stun) return;
    let dx = 0, dy = 0;
    if (Game.keys['w'] || Game.keys['arrowup']) dy -= 1;
    if (Game.keys['s'] || Game.keys['arrowdown']) dy += 1;
    if (Game.keys['a'] || Game.keys['arrowleft']) dx -= 1;
    if (Game.keys['d'] || Game.keys['arrowright']) dx += 1;
    if (!dx && !dy) { dx = Math.cos(p.dir); dy = Math.sin(p.dir); }
    const len = Math.hypot(dx, dy);
    p.dashDirX = dx / len; p.dashDirY = dy / len;
    p.dashT = BAL.dashTime;
    p.iframesT = BAL.dashIframes;
    p.dashCharges--;
    delete p.statuses.chill;
    Meta.data.stats.dashes++;
    if (Meta.data.stats.dashes >= 100) Meta.unlock('dash100');
    Sfx.play('dash');
    Fx.ring(p.x, p.y, .9, '#4adfff', 2, .3);
  },

  attack() {
    const s = Game.s, p = s.p;
    const cls = ClassDB[p.cls];
    const atk = cls.attack;
    const weapon = p.equip.weapon;
    p.attackCdT = atk.cd * (1 - p.d.cdr * .5);

    const fromStealth = p.stealthT > 0;
    p.stealthT = 0;

    if (atk.type === 'melee') {
      Sfx.play('hit');
      Fx.slash(p.x, p.y, p.dir, atk.arc, atk.range, atk.color);
      let hitAny = false;
      Combat.enemiesInArc(p.x, p.y, p.dir, atk.range, atk.arc).forEach(e => {
        hitAny = true;
        Combat.playerHitsEnemy(e, atk.mult, atk.element, { forceCrit: fromStealth });
      });
      if (hitAny) Game.addCombo();
    } else {
      Sfx.play('shoot');
      Combat.spawnProjectile({
        x: p.x, y: p.y, ang: p.dir, speed: atk.projSpeed, size: atk.projSize,
        dmgMult: atk.mult, element: atk.element, color: atk.color,
        friendly: true, range: atk.range, forceCrit: fromStealth,
      });
    }
  },

  tickAura(p, aura, dt) {
    p._auraT = (p._auraT || 0) - dt;
    if (p._auraT > 0) return;
    p._auraT = .4;
    for (const e of Game.s.enemies) {
      if (U.dist(p.x, p.y, e.x, e.y) < aura.radius) {
        Combat.playerHitsEnemy(e, (aura.dps * .4) / p.d.atk, aura.element, { noCrit: true, flat: aura.dps * .4 });
      }
    }
    Fx.ring(p.x, p.y, aura.radius, ELEMENTS[aura.element].color, 1.5, .35);
  },

  addBuff(p, def) {
    // odśwież istniejący buff o tej samej nazwie
    const ex = p.buffs.find(b => b.name === def.name);
    if (ex) { ex.t = def.dur; return; }
    p.buffs.push(Object.assign({ t: def.dur }, def));
  },

  heal(p, amount, silent = false) {
    const before = p.hp;
    p.hp = Math.min(p.d.maxHp, p.hp + amount);
    const gained = Math.round(p.hp - before);
    if (gained > 0 && !silent) Fx.text(p.x, p.y - .6, '+' + gained, '#7ae08a', 14);
  },

  giveGold(n) {
    const p = Game.s.p;
    n = Math.round(n * (1 + p.d.goldPct) * Game.diff().gold);
    p.gold += n;
    Game.s.runStats.goldEarned += n;
    if (p.gold >= 5000) Meta.unlock('rich');
    return n;
  },
};
