'use strict';

// Serce walki: obrażenia, statusy, pociski, telegrafy, strefy, pułapki.
const Combat = {

  // ===== ZAPYTANIA PRZESTRZENNE =====
  enemiesInRadius(x, y, r) {
    return Game.s.enemies.filter(e => U.dist(x, y, e.x, e.y) <= r + e.radius);
  },

  enemiesInArc(x, y, ang, range, arc) {
    return Game.s.enemies.filter(e => {
      const d = U.dist(x, y, e.x, e.y);
      if (d > range + e.radius) return false;
      if (d < .6) return true;
      return Math.abs(U.angDiff(ang, U.angle(x, y, e.x, e.y))) <= arc / 2;
    });
  },

  nearestEnemies(x, y, range, n = 1, exclude = null) {
    return Game.s.enemies
      .filter(e => e !== exclude && U.dist(x, y, e.x, e.y) <= range)
      .sort((a, b) => U.dist2(x, y, a.x, a.y) - U.dist2(x, y, b.x, b.y))
      .slice(0, n);
  },

  // ===== GRACZ ZADAJE OBRAŻENIA =====
  playerHitsEnemy(e, mult, element = 'phys', opts = {}) {
    const p = Game.s.p, d = p.d;
    let dmg = opts.flat !== undefined ? opts.flat : d.atk * mult;
    // moc umiejętności dla ataków nie-fizycznych z umiejętności
    if (opts.spell) dmg *= d.spellPower;

    // flagi warunkowe
    if (d.flags.coldBlood && (e.statuses.chill || e.statuses.freeze)) dmg *= 1 + d.flags.coldBlood;
    if (d.flags.executioner && e.hp < e.maxHp * .3) dmg *= 1 + d.flags.executioner;
    if (d.flags.fullHpDmg && e.hp >= e.maxHp * .999) dmg *= 1 + d.flags.fullHpDmg;

    // kryt
    let crit = false;
    if (!opts.noCrit && (opts.forceCrit || U.chance(d.crit))) {
      crit = true;
      dmg *= d.critDmg;
    }

    const dealt = this.dealToEnemy(e, dmg, { element, crit });

    // kradzież życia
    if (d.lifesteal > 0 && dealt > 0) Player.heal(p, dealt * d.lifesteal, true);

    // prockowanie statusów
    if (!opts.noOnHit && dealt > 0) {
      if (d.burnHit && U.chance(d.burnHit)) this.applyStatus(e, 'burn', BAL.burnDur);
      if (d.poisonHit && U.chance(d.poisonHit)) this.applyStatus(e, 'poison', BAL.poisonDur);
      if (d.iceHit && U.chance(d.iceHit)) this.applyStatus(e, 'chill', BAL.chillDur);
      if (d.shadowHit && U.chance(d.shadowHit)) {
        this.spawnProjectile({
          x: p.x, y: p.y, ang: U.angle(p.x, p.y, e.x, e.y), speed: 10, size: .22,
          flat: d.atk * .5, element: 'shadow', color: '#b06aff', friendly: true, noOnHit: true,
        });
      }
      if (d.flags.holyNova && crit) {
        this.explode(e.x, e.y, 1.8, d.atk * .6, true, 'holy', { noOnHit: true });
      }
      for (const b of p.buffs) {
        if (b.onHitStatus && U.chance(b.onHitStatus.chance)) {
          this.applyStatus(e, b.onHitStatus.type, b.onHitStatus.dur);
        }
      }
      if (opts.status && U.chance(opts.status.chance !== undefined ? opts.status.chance : 1)) {
        this.applyStatus(e, opts.status.type, opts.status.dur);
      }
    }
    return dealt;
  },

  // surowe obrażenia dla wroga (po pancerzu i żywiołach)
  dealToEnemy(e, dmg, opts = {}) {
    if (e.dead || e.hp <= 0) return 0;
    const el = opts.element || 'phys';
    // odporności / słabości
    if (e.resist && e.resist[el]) dmg *= e.resist[el];
    if (e.weak && e.weak[el]) dmg *= e.weak[el];
    // klątwa zwiększa otrzymywane obrażenia
    if (e.statuses.curse) dmg *= 1 + BAL.curseAmp;
    // pancerz
    dmg *= 1 - e.def / (e.def + BAL.defK);
    dmg = Math.max(1, Math.round(dmg * U.rand(.92, 1.08)));

    e.hp -= dmg;
    e.hitFlashT = .12;
    e.aggro = true;
    Game.s.runStats.dmgDealt += dmg;

    const col = opts.crit ? '#ffd84d' : ELEMENTS[el].color;
    Fx.text(e.x, e.y - e.radius - .25, (opts.crit ? '💥' : '') + dmg, col, opts.crit ? 18 : 14);
    Fx.burst(e.x, e.y, ELEMENTS[el].color, opts.crit ? 10 : 5, { spd: 3 });
    if (opts.crit) { Sfx.play('crit'); Fx.shake(3); }

    if (e.hp <= 0) Enemies.kill(e, opts);
    return dmg;
  },

  // ===== GRACZ OTRZYMUJE OBRAŻENIA =====
  hitPlayer(dmg, opts = {}) {
    const s = Game.s, p = s.p;
    if (!Game.alive() || p.hp <= 0) return;
    if (p.iframesT > 0) return;

    // unik
    if (!opts.ignoreDodge && U.chance(p.d.dodge)) {
      Fx.text(p.x, p.y - .7, 'UNIK!', '#4adfff', 15);
      if (p.d.flags.dodgeBlast) this.explode(p.x, p.y, 2, p.d.atk * .8, true, 'arcane', { noOnHit: true });
      return;
    }

    const el = opts.element || 'phys';
    dmg *= 1 - p.d.def / (p.d.def + BAL.defK);
    if (p.statuses.curse) dmg *= 1 + BAL.curseAmp;
    dmg = Math.max(1, Math.round(dmg * U.rand(.92, 1.08)));

    // tarcza absorbuje
    if (p.shield > 0) {
      const absorbed = Math.min(p.shield, dmg);
      p.shield -= absorbed;
      dmg -= absorbed;
      Fx.text(p.x, p.y - .9, '🛡' + absorbed, '#a0c8ff', 13);
      if (dmg <= 0) return;
    }

    p.hp -= dmg;
    p.regenDelayT = BAL.regenDelay;
    p.hitFlashT = .2;
    s.runStats.dmgTaken += dmg;
    if (s.boss && !s.boss.dead) s.bossHitTaken = true;

    Fx.text(p.x, p.y - .7, '-' + dmg, '#ff5a4a', 16);
    Fx.blood(p.x, p.y, 5);
    Fx.shake(Math.min(7, 2 + dmg / 12));
    Fx.flash('#a01010', .12);
    Sfx.play('hurt');

    if (p.hp <= 0) {
      // Pierścień Feniksa — raz na piętro
      if (p.d.flags.phoenix && !p.phoenixFloorUsed) {
        p.phoenixFloorUsed = true;
        p.hp = Math.round(p.d.maxHp * .35);
        p.iframesT = 1.5;
        Fx.ring(p.x, p.y, 3, '#ff8c2e', 4, .6);
        Fx.flash('#ff8c2e', .3);
        Sfx.play('levelup');
        Game.msg('🐦‍🔥 Pierścień Feniksa wskrzesza cię!', 'gold');
        return;
      }
      // Iskra Odrodzenia — raz na wyprawę
      if (Meta.bonuses().phoenix && !p.metaReviveUsed) {
        p.metaReviveUsed = true;
        p.hp = Math.round(p.d.maxHp * .5);
        p.iframesT = 2;
        Fx.ring(p.x, p.y, 3.5, '#b98aff', 4, .7);
        Fx.flash('#b98aff', .3);
        Sfx.play('levelup');
        Game.msg('🔮 Iskra Odrodzenia płonie! Żyjesz.', 'magic');
        return;
      }
      p.hp = 0;
      Game.playerDeath(opts.source || 'Otchłań');
    }
  },

  // ===== STATUSY =====
  // type: burn, poison, bleed, chill, freeze, stun, curse, root
  applyStatus(t, type, dur, pow = 0, isPlayer = false) {
    if (!t.statuses) t.statuses = {};
    const st = t.statuses;
    if (t.isBoss && (type === 'stun' || type === 'freeze' || type === 'root')) {
      dur *= .35; // bossowie odporni na kontrolę
    }
    switch (type) {
      case 'poison': {
        const cur = st.poison;
        st.poison = { t: dur, stacks: Math.min(BAL.poisonMaxStacks, (cur ? cur.stacks : 0) + 1) };
        break;
      }
      case 'freeze':
        st.freeze = { t: dur };
        delete st.chill;
        if (!isPlayer) Sfx.play('freeze');
        break;
      default:
        if (!st[type] || st[type].t < dur) st[type] = { t: dur };
    }
    if (isPlayer && (type === 'burn' || type === 'poison' || type === 'curse')) {
      // krótka informacja
      const names = { burn: '🔥 Płoniesz!', poison: '☠️ Zatruty!', curse: '🌑 Przeklęty!' };
      if (!st['_warn' + type]) { Game.msg(names[type], 'bad'); st['_warn' + type] = { t: 3 }; }
    }
  },

  updateStatuses(ent, dt, isPlayer = false) {
    const st = ent.statuses;
    if (!st) return;
    ent._dotT = (ent._dotT || 0) - dt;
    const tick = ent._dotT <= 0;
    if (tick) ent._dotT = .5;

    for (const key in st) {
      st[key].t -= dt;
      if (st[key].t <= 0) { delete st[key]; continue; }
      if (!tick) continue;
      let dot = 0, el = 'phys';
      if (key === 'burn') { dot = BAL.burnDps * .5; el = 'fire'; }
      if (key === 'poison') { dot = BAL.poisonDps * .5 * st.poison.stacks; el = 'poison'; }
      if (key === 'bleed') { dot = BAL.bleedDps * .5; el = 'phys'; }
      if (dot > 0) {
        if (isPlayer) {
          ent.hp -= dot;
          ent.regenDelayT = BAL.regenDelay;
          if (ent.hp <= 0) { ent.hp = 0; Game.playerDeath(key === 'burn' ? 'Ogień' : key === 'poison' ? 'Trucizna' : 'Krwawienie'); }
        } else {
          ent.hp -= dot;
          Fx.text(ent.x, ent.y - ent.radius - .2, Math.round(dot), ELEMENTS[el].color, 11);
          if (ent.hp <= 0) Enemies.kill(ent, { element: el });
        }
      }
    }
  },

  // ===== POCISKI =====
  // opts: x,y,ang,speed,size,dmgMult|flat,element,color,friendly,pierce,range,status,blast,forceCrit,noOnHit,spell,fromEnemy
  spawnProjectile(o) {
    Game.s.projectiles.push({
      x: o.x, y: o.y,
      vx: Math.cos(o.ang) * o.speed, vy: Math.sin(o.ang) * o.speed,
      size: o.size || .2, color: o.color || '#fff',
      element: o.element || 'phys',
      friendly: !!o.friendly,
      dmgMult: o.dmgMult, flat: o.flat, dmg: o.dmg,
      pierce: o.pierce || 0, hitSet: o.pierce ? new Set() : null,
      status: o.status, blast: o.blast || 0,
      forceCrit: !!o.forceCrit, noOnHit: !!o.noOnHit, spell: !!o.spell,
      traveled: 0, range: o.range || 14,
      trail: o.trail !== false,
    });
  },

  updateProjectiles(dt) {
    const s = Game.s, p = s.p;
    for (let i = s.projectiles.length - 1; i >= 0; i--) {
      const pr = s.projectiles[i];
      const step = Math.hypot(pr.vx, pr.vy) * dt;
      pr.x += pr.vx * dt; pr.y += pr.vy * dt;
      pr.traveled += step;
      if (pr.trail && U.chance(.5)) Fx.burst(pr.x, pr.y, pr.color, 1, { spd: .6, life: .28, size: 3 });

      let dead = false;
      // ściany
      if (Dungeon.tile(s.map, pr.x | 0, pr.y | 0) === TILE.WALL) dead = true;
      else if (pr.traveled > pr.range) dead = true;
      else if (pr.friendly) {
        for (const e of s.enemies) {
          if (pr.hitSet && pr.hitSet.has(e)) continue;
          if (U.dist(pr.x, pr.y, e.x, e.y) < e.radius + pr.size) {
            const mult = pr.dmgMult !== undefined ? pr.dmgMult : 1;
            this.playerHitsEnemy(e, mult, pr.element, {
              flat: pr.flat, status: pr.status, forceCrit: pr.forceCrit,
              noOnHit: pr.noOnHit, spell: pr.spell,
            });
            if (pr.pierce > 0) { pr.pierce--; pr.hitSet.add(e); }
            else dead = true;
            break;
          }
        }
      } else {
        if (p.hp > 0 && U.dist(pr.x, pr.y, p.x, p.y) < p.radius + pr.size) {
          this.hitPlayer(pr.dmg || 8, { element: pr.element, source: pr.source });
          if (pr.status && U.chance(pr.status.chance !== undefined ? pr.status.chance : 1)) {
            this.applyStatus(p, pr.status.type, pr.status.dur, 0, true);
          }
          dead = true;
        }
      }

      if (dead) {
        if (pr.blast > 0) {
          if (pr.friendly) this.explode(pr.x, pr.y, pr.blast, (pr.flat || p.d.atk * (pr.dmgMult || 1)) * .8, true, pr.element, { spell: pr.spell, status: pr.status });
          else this.explode(pr.x, pr.y, pr.blast, (pr.dmg || 10) * .8, false, pr.element);
        } else {
          Fx.burst(pr.x, pr.y, pr.color, 5, { spd: 2.5, life: .3 });
        }
        s.projectiles.splice(i, 1);
      }
    }
  },

  // ===== EKSPLOZJE =====
  explode(x, y, radius, dmg, friendly, element = 'fire', opts = {}) {
    Fx.ring(x, y, radius, ELEMENTS[element].color, 4, .35);
    Fx.burst(x, y, ELEMENTS[element].color, 16, { spd: 5, life: .5, size: 6 });
    Fx.shake(4);
    Sfx.play('explode');
    if (friendly) {
      for (const e of this.enemiesInRadius(x, y, radius)) {
        this.playerHitsEnemy(e, 1, element, { flat: dmg, noOnHit: opts.noOnHit, spell: opts.spell, status: opts.status });
      }
    } else {
      const p = Game.s.p;
      if (U.dist(x, y, p.x, p.y) < radius + p.radius) {
        this.hitPlayer(dmg, { element, source: opts.source || 'Eksplozja' });
      }
    }
  },

  // ===== TELEGRAFY (zapowiedziane uderzenia) =====
  // o: x,y,r,delay,dmg,friendly,element,color,onDone,status
  addTelegraph(o) {
    Game.s.telegraphs.push(Object.assign({ t: o.delay, maxT: o.delay }, o));
    if (!o.friendly) Sfx.play('telegraph');
  },

  updateTelegraphs(dt) {
    const s = Game.s;
    for (let i = s.telegraphs.length - 1; i >= 0; i--) {
      const t = s.telegraphs[i];
      t.t -= dt;
      if (t.t > 0) continue;
      s.telegraphs.splice(i, 1);
      if (t.onDone) { t.onDone(t); continue; }
      this.explode(t.x, t.y, t.r, t.dmg, !!t.friendly, t.element || 'fire', { source: t.source });
      if (!t.friendly && t.status) {
        const p = s.p;
        if (U.dist(t.x, t.y, p.x, p.y) < t.r + p.radius) this.applyStatus(p, t.status.type, t.status.dur, 0, true);
      }
    }
  },

  // ===== STREFY NAZIEMNE =====
  // o: x,y,r,dur,dps,friendly,element,color,healPlayer
  addZone(o) {
    Game.s.zones.push(Object.assign({ t: o.dur, tickT: 0 }, o));
  },

  updateZones(dt) {
    const s = Game.s, p = s.p;
    for (let i = s.zones.length - 1; i >= 0; i--) {
      const z = s.zones[i];
      z.t -= dt; z.tickT -= dt;
      if (z.t <= 0) { s.zones.splice(i, 1); continue; }
      if (z.tickT > 0) continue;
      z.tickT = .5;
      if (z.friendly) {
        for (const e of this.enemiesInRadius(z.x, z.y, z.r)) {
          this.playerHitsEnemy(e, 1, z.element, { flat: z.dps * .5, noOnHit: true, spell: true, noCrit: true });
          if (z.status) this.applyStatus(e, z.status.type, z.status.dur);
        }
        if (z.healPlayer && U.dist(z.x, z.y, p.x, p.y) < z.r) Player.heal(p, z.healPlayer * .5);
      } else {
        if (p.hp > 0 && U.dist(z.x, z.y, p.x, p.y) < z.r + p.radius) {
          this.hitPlayer(z.dps * .5, { element: z.element, source: z.source || 'Strefa', ignoreDodge: true });
          if (z.status) this.applyStatus(p, z.status.type, z.status.dur, 0, true);
        }
      }
    }
  },

  // ===== PUŁAPKI ŁOWCY =====
  updateTraps(dt) {
    const s = Game.s;
    for (let i = s.traps.length - 1; i >= 0; i--) {
      const tr = s.traps[i];
      tr.t -= dt;
      if (tr.t <= 0) { s.traps.splice(i, 1); continue; }
      for (const e of s.enemies) {
        if (U.dist(tr.x, tr.y, e.x, e.y) < tr.radius + e.radius) {
          Sfx.play('trap');
          Fx.ring(tr.x, tr.y, 1.2, '#c8b5ff', 3, .3);
          this.playerHitsEnemy(e, 1, 'phys', { flat: tr.dmg, spell: true });
          this.applyStatus(e, 'root', tr.rootDur);
          s.traps.splice(i, 1);
          break;
        }
      }
    }
  },
};
