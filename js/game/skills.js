'use strict';

// Rzucanie umiejętności (klawisze 1-5). Obrażenia skalują się z atakiem
// i mocą umiejętności: dmg = baza * (atk/10) * spellPower.
const Skills = {

  scale(base) {
    const d = Game.s.p.d;
    return base * (d.atk / 10) * d.spellPower;
  },

  cast(i) {
    const s = Game.s, p = s.p;
    if (!Game.alive() || s.paused) return;
    const sk = p.skills[i];
    if (!sk) return;
    if (sk.cdT > 0) { Sfx.play('error'); return; }
    if (p.statuses.stun || p.statuses.freeze) return;
    if (p.mp < sk.mp) { Sfx.play('error'); Fx.text(p.x, p.y - .8, 'Brak many!', '#6a9aff', 13); return; }

    const ok = this.execute(sk);
    if (ok === false) return; // np. blink w ścianę

    p.mp -= sk.mp;
    sk.cdT = sk.cd * (1 - p.d.cdr);
    if (sk.ult) Sfx.play('ult'); else Sfx.play('magic');
  },

  execute(sk) {
    const s = Game.s, p = s.p, m = Game.mouse;
    const aim = U.angle(p.x, p.y, m.wx, m.wy);

    switch (sk.type) {
      case 'buff': {
        Player.addBuff(p, sk.buff);
        Fx.ring(p.x, p.y, 1.4, '#ffd84d', 3, .4);
        Sfx.play('buff');
        break;
      }

      case 'cone': {
        Fx.slash(p.x, p.y, aim, sk.arc, sk.range, ELEMENTS[sk.element].color);
        Fx.shake(3);
        for (const e of Combat.enemiesInArc(p.x, p.y, aim, sk.range, sk.arc)) {
          Combat.playerHitsEnemy(e, 1, sk.element, { flat: this.scale(sk.dmg), status: sk.status });
        }
        break;
      }

      case 'nova': {
        Fx.ring(p.x, p.y, sk.radius, ELEMENTS[sk.element].color, 5, .45);
        Fx.burst(p.x, p.y, ELEMENTS[sk.element].color, 24, { spd: 6, life: .5 });
        for (const e of Combat.enemiesInRadius(p.x, p.y, sk.radius)) {
          Combat.playerHitsEnemy(e, 1, sk.element, { flat: this.scale(sk.dmg), status: sk.status });
        }
        break;
      }

      case 'projectile': {
        Combat.spawnProjectile({
          x: p.x, y: p.y, ang: aim, speed: sk.speed, size: sk.size,
          flat: this.scale(sk.dmg), element: sk.element,
          color: ELEMENTS[sk.element].color, friendly: true,
          pierce: sk.pierce || 0, status: sk.status, blast: sk.blast || 0,
        });
        break;
      }

      case 'volley': {
        for (let i = 0; i < sk.count; i++) {
          const a = aim + (i / (sk.count - 1) - .5) * sk.spread;
          Combat.spawnProjectile({
            x: p.x, y: p.y, ang: a, speed: sk.speed, size: sk.size,
            flat: this.scale(sk.dmg), element: sk.element,
            color: ELEMENTS[sk.element].color, friendly: true, status: sk.status,
          });
        }
        break;
      }

      case 'chain': {
        let from = { x: p.x, y: p.y };
        let target = Combat.nearestEnemies(p.x, p.y, sk.range, 1)[0];
        if (!target) { Fx.text(p.x, p.y - .8, 'Brak celu!', '#aaa', 13); return false; }
        const hitList = new Set();
        let dmg = this.scale(sk.dmg);
        for (let j = 0; j < sk.jumps && target; j++) {
          Fx.beam(from.x, from.y, target.x, target.y, '#8ab0ff', 3, .25);
          Fx.burst(target.x, target.y, '#8ab0ff', 8, { spd: 4 });
          Combat.playerHitsEnemy(target, 1, sk.element, { flat: dmg });
          hitList.add(target);
          from = target;
          dmg *= .85;
          target = Combat.nearestEnemies(from.x, from.y, sk.jumpRange, 3, from).find(e => !hitList.has(e));
        }
        Fx.shake(2);
        break;
      }

      case 'blink': {
        const d = Math.min(sk.range, U.dist(p.x, p.y, m.wx, m.wy));
        let tx = p.x + Math.cos(aim) * d, ty = p.y + Math.sin(aim) * d;
        // cofaj wzdłuż linii aż znajdziesz wolne miejsce
        let steps = 12;
        while (steps-- > 0 && !Dungeon.circleFree(s.map, tx, ty, p.radius)) {
          tx = U.lerp(p.x, tx, .85); ty = U.lerp(p.y, ty, .85);
        }
        if (!Dungeon.circleFree(s.map, tx, ty, p.radius)) return false;
        Fx.burst(p.x, p.y, '#8ab0ff', 14, { spd: 3 });
        p.x = tx; p.y = ty;
        p.iframesT = .4;
        Fx.burst(p.x, p.y, '#8ab0ff', 14, { spd: 3 });
        Fx.ring(p.x, p.y, 1.2, '#8ab0ff', 3, .35);
        break;
      }

      case 'leap': {
        const d = Math.min(sk.range, U.dist(p.x, p.y, m.wx, m.wy));
        let tx = p.x + Math.cos(aim) * d, ty = p.y + Math.sin(aim) * d;
        let steps = 12;
        while (steps-- > 0 && !Dungeon.circleFree(s.map, tx, ty, p.radius)) {
          tx = U.lerp(p.x, tx, .85); ty = U.lerp(p.y, ty, .85);
        }
        if (!Dungeon.circleFree(s.map, tx, ty, p.radius)) return false;
        p.x = tx; p.y = ty;
        p.iframesT = .3;
        Fx.shake(5);
        Combat.explode(tx, ty, sk.radius, this.scale(sk.dmg), true, sk.element, { status: sk.status });
        if (sk.status) {
          for (const e of Combat.enemiesInRadius(tx, ty, sk.radius)) {
            if (U.chance(sk.status.chance)) Combat.applyStatus(e, sk.status.type, sk.status.dur);
          }
        }
        break;
      }

      case 'meteor': {
        const d = Math.min(sk.range, U.dist(p.x, p.y, m.wx, m.wy));
        const cx = p.x + Math.cos(aim) * d, cy = p.y + Math.sin(aim) * d;
        for (let i = 0; i < sk.count; i++) {
          const a = Math.random() * Math.PI * 2, r = Math.random() * sk.area;
          Combat.addTelegraph({
            x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, r: sk.radius,
            delay: .55 + i * .17, dmg: this.scale(sk.dmg), friendly: true,
            element: sk.element, color: '#ff7a3e', status: sk.status,
          });
        }
        break;
      }

      case 'stealth': {
        p.stealthT = sk.dur;
        for (const e of s.enemies) e.aggro = false;
        Fx.burst(p.x, p.y, '#8a8ab0', 16, { spd: 2.5 });
        Game.msg('👤 Znikasz w cieniu...', 'magic');
        break;
      }

      case 'execute_chain': {
        const targets = Combat.nearestEnemies(p.x, p.y, sk.range, sk.targets);
        if (!targets.length) { Fx.text(p.x, p.y - .8, 'Brak celu!', '#aaa', 13); return false; }
        let px = p.x, py = p.y;
        for (const e of targets) {
          Fx.beam(px, py, e.x, e.y, '#b06aff', 4, .3);
          Fx.burst(e.x, e.y, '#b06aff', 12, { spd: 5 });
          const execute = e.hp < e.maxHp * sk.executePct && !e.isBoss;
          Combat.playerHitsEnemy(e, 1, 'shadow', {
            flat: execute ? e.hp * 999 : this.scale(sk.dmg), forceCrit: !execute,
          });
          px = e.x; py = e.y;
        }
        const spot = Dungeon.freeSpotNear(s.map, px, py, 1.5);
        p.x = spot.x; p.y = spot.y;
        p.iframesT = .6;
        Fx.shake(6);
        break;
      }

      case 'summon': {
        Minions.summon(sk);
        break;
      }

      case 'drain': {
        const targets = Combat.nearestEnemies(p.x, p.y, sk.range, sk.targets);
        if (!targets.length) { Fx.text(p.x, p.y - .8, 'Brak celu!', '#aaa', 13); return false; }
        let healed = 0;
        for (const e of targets) {
          Fx.beam(e.x, e.y, p.x, p.y, '#b06aff', 3, .4);
          const dealt = Combat.playerHitsEnemy(e, 1, sk.element, { flat: this.scale(sk.dmg) });
          healed += dealt * sk.healPct;
        }
        Player.heal(p, healed);
        Sfx.play('heal');
        break;
      }

      case 'curse_area': {
        const d = Math.min(sk.range, U.dist(p.x, p.y, m.wx, m.wy));
        const cx = p.x + Math.cos(aim) * d, cy = p.y + Math.sin(aim) * d;
        Fx.ring(cx, cy, sk.radius, '#b06aff', 4, .5);
        Sfx.play('curse');
        for (const e of Combat.enemiesInRadius(cx, cy, sk.radius)) {
          Combat.playerHitsEnemy(e, 1, sk.element, { flat: this.scale(sk.dmg) });
          if (sk.status) Combat.applyStatus(e, sk.status.type, sk.status.dur);
          if (sk.status2) Combat.applyStatus(e, sk.status2.type, sk.status2.dur);
        }
        Combat.addZone({ x: cx, y: cy, r: sk.radius, dur: 3, dps: this.scale(sk.dmg) * .3, friendly: true, element: 'poison', color: '#8a4aff' });
        break;
      }

      case 'consecrate': {
        Combat.addZone({
          x: p.x, y: p.y, r: sk.radius, dur: sk.dur,
          dps: this.scale(sk.dps), friendly: true, element: sk.element,
          color: '#ffe9a0', healPlayer: sk.hps,
        });
        Sfx.play('heal');
        break;
      }

      case 'shield': {
        p.shield = Math.round(p.d.maxHp * sk.pct);
        p.shieldMax = p.shield;
        p.shieldT = sk.dur;
        Fx.ring(p.x, p.y, 1.3, '#a0c8ff', 4, .5);
        Sfx.play('buff');
        break;
      }

      case 'heal': {
        Player.heal(p, p.d.maxHp * sk.pct);
        if (sk.cleanse) {
          for (const k of ['burn', 'poison', 'bleed', 'chill', 'curse']) delete p.statuses[k];
        }
        Fx.burst(p.x, p.y, '#ffe9a0', 20, { spd: 3, life: .7 });
        Sfx.play('heal');
        break;
      }

      case 'trap': {
        const d = Math.min(5, U.dist(p.x, p.y, m.wx, m.wy));
        const tx = p.x + Math.cos(aim) * d, ty = p.y + Math.sin(aim) * d;
        if (!Dungeon.walkable(s.map, tx | 0, ty | 0)) return false;
        while (s.traps.length >= sk.max) s.traps.shift();
        s.traps.push({ x: tx, y: ty, radius: sk.radius, dmg: this.scale(sk.dmg), rootDur: sk.rootDur, t: 30 });
        break;
      }

      case 'dashshot': {
        // odskok w tył
        const back = aim + Math.PI;
        let tx = p.x + Math.cos(back) * sk.dashDist, ty = p.y + Math.sin(back) * sk.dashDist;
        let steps = 10;
        while (steps-- > 0 && !Dungeon.circleFree(s.map, tx, ty, p.radius)) {
          tx = U.lerp(p.x, tx, .8); ty = U.lerp(p.y, ty, .8);
        }
        if (Dungeon.circleFree(s.map, tx, ty, p.radius)) { p.x = tx; p.y = ty; }
        p.iframesT = .45;
        Sfx.play('dash');
        for (let i = 0; i < sk.count; i++) {
          const a = aim + (i - (sk.count - 1) / 2) * .14;
          Combat.spawnProjectile({
            x: p.x, y: p.y, ang: a, speed: sk.speed, size: .2,
            flat: this.scale(sk.dmg), element: sk.element, color: '#c8b5ff', friendly: true,
          });
        }
        break;
      }

      case 'rain': {
        const d = Math.min(sk.range, U.dist(p.x, p.y, m.wx, m.wy));
        const cx = p.x + Math.cos(aim) * d, cy = p.y + Math.sin(aim) * d;
        Combat.addZone({
          x: cx, y: cy, r: sk.radius, dur: sk.dur,
          dps: this.scale(sk.dps), friendly: true, element: sk.element,
          color: '#b06aff', rain: true,
        });
        break;
      }
    }
    return true;
  },
};

// ===== SŁUDZY (miniony) =====
const Minions = {
  summon(sk) {
    const s = Game.s, p = s.p;
    const maxM = p.d.minionMax;
    const count = sk.count + (sk.golem ? 1 : 0);
    Sfx.play('summon');
    for (let i = 0; i < count; i++) {
      // usuń najstarszego, jeśli limit
      while (s.minions.length >= maxM) s.minions.shift();
      const isGolem = sk.golem && i === count - 1;
      const def = EnemyDB.types[isGolem ? 'bone_golem' : (sk.unit || 'skeleton')];
      const spot = Dungeon.freeSpotNear(s.map, p.x, p.y, 2);
      const powerMult = (1 + (p.level - 1) * .12) * (sk.empowered ? 1.6 : 1) * (1 + p.d.minionDmg);
      s.minions.push({
        type: isGolem ? 'bone_golem' : 'skeleton',
        icon: def.icon, color: def.color,
        x: spot.x, y: spot.y,
        hp: Math.round(def.hp * powerMult), maxHp: Math.round(def.hp * powerMult),
        atk: def.atk * powerMult,
        speed: def.speed, radius: isGolem ? .42 : .3,
        t: sk.dur, attackCdT: 0, big: !!isGolem,
      });
      Fx.burst(spot.x, spot.y, '#d8f0d8', 10, { spd: 3 });
    }
  },

  update(dt) {
    const s = Game.s, p = s.p;
    for (let i = s.minions.length - 1; i >= 0; i--) {
      const mn = s.minions[i];
      mn.t -= dt;
      if (mn.t <= 0 || mn.hp <= 0) {
        Fx.burst(mn.x, mn.y, '#d8f0d8', 8, { spd: 2.5 });
        s.minions.splice(i, 1);
        continue;
      }
      if (mn.attackCdT > 0) mn.attackCdT -= dt;

      // cel: najbliższy wróg w 8 kratkach, inaczej podążaj za graczem
      const target = Combat.nearestEnemies(mn.x, mn.y, 8, 1)[0];
      if (target) {
        const d = U.dist(mn.x, mn.y, target.x, target.y);
        if (d > mn.radius + target.radius + .15) {
          const a = U.angle(mn.x, mn.y, target.x, target.y);
          Player.moveWithCollision(mn, mn.x + Math.cos(a) * mn.speed * dt, mn.y + Math.sin(a) * mn.speed * dt, s.map);
        } else if (mn.attackCdT <= 0) {
          mn.attackCdT = .9;
          Combat.dealToEnemy(target, mn.atk, { element: 'shadow' });
        }
      } else {
        const d = U.dist(mn.x, mn.y, p.x, p.y);
        if (d > 2.2) {
          const a = U.angle(mn.x, mn.y, p.x, p.y);
          Player.moveWithCollision(mn, mn.x + Math.cos(a) * mn.speed * dt, mn.y + Math.sin(a) * mn.speed * dt, s.map);
        }
      }
    }
  },
};
