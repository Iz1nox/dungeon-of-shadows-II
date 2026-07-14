'use strict';

// Spawnowanie wrogów, AI, elity, śmierć i łupy.
const Enemies = {

  floorMult(floor) {
    let m = 1 + (floor - 1) * .04;
    if (floor > FINAL_FLOOR) m *= 1 + (floor - FINAL_FLOOR) * BAL.endlessScale;
    return m;
  },

  make(typeId, x, y, opts = {}) {
    const def = EnemyDB.types[typeId];
    const floor = Game.s.floor;
    const m = this.floorMult(floor) * (opts.mult || 1);
    const e = {
      id: typeId, name: def.name, icon: def.icon, color: def.color,
      x, y, radius: def.big ? .45 : .34,
      hp: Math.round(def.hp * m), maxHp: Math.round(def.hp * m), hpGhost: 1,
      atk: def.atk * m, def: def.def * (1 + (floor - 1) * .03),
      xp: def.xp, gold: def.gold,
      speed: def.speed, baseSpeed: def.speed,
      ai: def.ai, element: def.element || 'phys',
      resist: def.resist, weak: def.weak,
      statuses: {}, hitFlashT: 0,
      aggro: false, aggroRange: 8.5,
      attackCdT: U.rand(0, .5), meleeCd: .95,
      def_: def,
      elite: null,
      wanderA: Math.random() * 6.28, wanderT: 0,
      state: 'idle', stateT: 0,
      summonT: def.summonCd ? def.summonCd * .5 : 0,
      healT: def.healCd ? def.healCd * .5 : 0,
      blinkT: def.blinkCd || 0, leapT: def.leapCd || 0,
      stealthTimer: def.stealthCd ? U.rand(1, def.stealthCd) : 0, invisT: 0,
      eliteZapT: 3,
      bobPhase: Math.random() * 6.28,
    };
    // elita?
    if (opts.elite || (!def.noSpawn && !opts.noElite &&
        U.chance(BAL.eliteChanceBase + floor * BAL.eliteChancePerFloor))) {
      const affixId = opts.elite || U.choice(Object.keys(EnemyDB.eliteAffixes));
      e.elite = affixId;
      e.hp = Math.round(e.hp * BAL.eliteHpMult); e.maxHp = e.hp;
      e.atk *= BAL.eliteAtkMult;
      e.xp = Math.round(e.xp * BAL.eliteRewardMult);
      e.gold = Math.round(e.gold * BAL.eliteRewardMult);
      e.radius *= 1.15;
      if (affixId === 'swift') e.baseSpeed *= 1.55;
      if (affixId === 'armored') { e.def *= 3; e.baseSpeed *= .85; }
    }
    return e;
  },

  spawnFloor() {
    const s = Game.s, map = s.map;
    const pool = EnemyDB.poolFor(s.floor);
    const bossId = EnemyDB.bossFor(s.floor);
    let count = Math.min(30, 13 + s.floor);
    if (bossId) count = Math.round(count * .55);
    if (s.floor === FINAL_FLOOR) count = 4;

    for (let i = 0; i < count; i++) {
      const spot = Dungeon.freeSpot(map, 9);
      s.enemies.push(this.make(U.choice(pool), spot.x, spot.y));
    }
    if (bossId) Bosses.spawn(bossId);
  },

  update(dt) {
    const s = Game.s, p = s.p, map = s.map;
    for (let i = s.enemies.length - 1; i >= 0; i--) {
      const e = s.enemies[i];
      if (e.dead) { s.enemies.splice(i, 1); continue; }

      Combat.updateStatuses(e, dt);
      if (e.dead) { s.enemies.splice(i, 1); continue; }
      if (e.hitFlashT > 0) e.hitFlashT -= dt;
      e.hpGhost = U.lerp(e.hpGhost, e.hp / e.maxHp, dt * 3);

      // kontrola tłumu
      if (e.statuses.stun || e.statuses.freeze) continue;

      // szybkość po statusach
      e.speed = e.baseSpeed * (e.statuses.chill ? 1 - BAL.chillSlow : 1);
      if (e.statuses.root) e.speed = 0;

      // aura mrozu gracza (legenda)
      if (p.d.flags.chillAura && U.dist(e.x, e.y, p.x, p.y) < p.d.flags.chillAura) {
        Combat.applyStatus(e, 'chill', .6);
      }

      // agresja
      const distP = U.dist(e.x, e.y, p.x, p.y);
      if (!e.aggro && distP < e.aggroRange && p.stealthT <= 0 &&
          FOV.lineOfSight(map, e.x, e.y, p.x, p.y)) {
        e.aggro = true;
      }
      if (p.stealthT > 0 && !e.isBoss) e.aggro = false;

      if (e.isBoss) { Bosses.update(e, dt); continue; }

      if (e.attackCdT > 0) e.attackCdT -= dt;

      // elita: elektryzujący
      if (e.elite === 'shocking' && e.aggro) {
        e.eliteZapT -= dt;
        if (e.eliteZapT <= 0) {
          e.eliteZapT = 3.2;
          Combat.addTelegraph({
            x: p.x, y: p.y, r: 1.6, delay: .8, dmg: e.atk * .8,
            friendly: false, element: 'arcane', color: '#ffe95a', source: e.name,
          });
        }
      }

      if (!e.aggro) { this.wander(e, dt, map); continue; }
      this.runAI(e, dt, distP);
    }
  },

  wander(e, dt, map) {
    e.wanderT -= dt;
    if (e.wanderT <= 0) { e.wanderT = U.rand(1, 3); e.wanderA = Math.random() * Math.PI * 2; }
    if (e.speed > 0) {
      this.step(e, Math.cos(e.wanderA) * e.speed * .35, Math.sin(e.wanderA) * e.speed * .35, dt);
    }
  },

  step(e, vx, vy, dt) {
    Player.moveWithCollision(e, e.x + vx * dt, e.y + vy * dt, Game.s.map);
  },

  // ruch w stronę gracza: LOS → prosto; inaczej flow field
  seekPlayer(e, dt, mult = 1) {
    const s = Game.s, p = s.p;
    if (e.speed <= 0) return;
    if (FOV.lineOfSight(s.map, e.x, e.y, p.x, p.y)) {
      const a = U.angle(e.x, e.y, p.x, p.y);
      this.step(e, Math.cos(a) * e.speed * mult, Math.sin(a) * e.speed * mult, dt);
    } else {
      const dir = Path.dirToPlayer(s.map, e.x, e.y);
      if (dir) this.step(e, dir.x * e.speed * mult, dir.y * e.speed * mult, dt);
    }
  },

  fleePlayer(e, dt, mult = 1) {
    const p = Game.s.p;
    const a = U.angle(p.x, p.y, e.x, e.y);
    this.step(e, Math.cos(a) * e.speed * mult, Math.sin(a) * e.speed * mult, dt);
  },

  tryMelee(e, distP, mult = 1) {
    const p = Game.s.p;
    if (distP < e.radius + p.radius + .25 && e.attackCdT <= 0) {
      e.attackCdT = e.meleeCd;
      let dmg = e.atk * mult;
      // Herszt w pobliżu?
      if (Game.s.enemies.some(o => o !== e && o.elite === 'warlord' && U.dist(o.x, o.y, e.x, e.y) < 4)) dmg *= 1.3;
      Combat.hitPlayer(dmg, { element: e.element, source: e.name });
      const def = e.def_;
      if (def.status && U.chance(def.status.chance)) {
        Combat.applyStatus(p, def.status.type, def.status.dur, 0, true);
      }
      // wampiryczny
      if (e.elite === 'vampiric') { e.hp = Math.min(e.maxHp, e.hp + dmg * .8); }
      // ciernie gracza
      if (p.d.thorns > 0) Combat.dealToEnemy(e, p.d.thorns, { element: 'phys' });
      return true;
    }
    return false;
  },

  shoot(e, def) {
    const p = Game.s.p;
    const a = U.angle(e.x, e.y, p.x, p.y);
    Sfx.play('shoot');
    Combat.spawnProjectile({
      x: e.x, y: e.y, ang: a, speed: def.projSpeed || 7, size: .22,
      dmg: e.atk, element: def.element || 'phys',
      color: def.projColor || '#fff', friendly: false,
      status: def.status, source: e.name,
    });
  },

  runAI(e, dt, distP) {
    const s = Game.s, p = s.p, def = e.def_;
    switch (e.ai) {
      case 'chase':
        if (!this.tryMelee(e, distP)) this.seekPlayer(e, dt);
        break;

      case 'erratic': {
        e.wanderT -= dt;
        if (e.wanderT <= 0) { e.wanderT = U.rand(.3, .8); e.wanderA = U.rand(-1.1, 1.1); }
        if (!this.tryMelee(e, distP)) {
          const a = U.angle(e.x, e.y, p.x, p.y) + e.wanderA;
          this.step(e, Math.cos(a) * e.speed, Math.sin(a) * e.speed, dt);
        }
        break;
      }

      case 'ranged': {
        const hasLOS = FOV.lineOfSight(s.map, e.x, e.y, p.x, p.y);
        if (distP < 3.5) this.fleePlayer(e, dt, .8);
        else if (distP > 7 || !hasLOS) this.seekPlayer(e, dt);
        if (hasLOS && distP < 9 && e.attackCdT <= 0) {
          e.attackCdT = def.attackCd || 1.6;
          this.shoot(e, def);
        }
        break;
      }

      case 'charger': {
        if (e.state === 'windup') {
          e.stateT -= dt;
          if (e.stateT <= 0) {
            e.state = 'charge'; e.stateT = def.chargeTime;
            const a = U.angle(e.x, e.y, p.x, p.y);
            e.chargeDX = Math.cos(a); e.chargeDY = Math.sin(a);
            Sfx.play('bossroar');
          }
        } else if (e.state === 'charge') {
          e.stateT -= dt;
          this.step(e, e.chargeDX * def.chargeSpeed, e.chargeDY * def.chargeSpeed, dt);
          Fx.burst(e.x, e.y, e.color, 1, { spd: 1, life: .3 });
          if (distP < e.radius + p.radius + .3) {
            Combat.hitPlayer(e.atk + (def.chargeBonus || 8), { element: e.element, source: e.name });
            e.state = 'cool'; e.stateT = 1;
          }
          if (e.stateT <= 0) { e.state = 'cool'; e.stateT = def.chargeCd || 4; }
        } else if (e.state === 'cool') {
          e.stateT -= dt;
          if (!this.tryMelee(e, distP)) this.seekPlayer(e, dt, .7);
          if (e.stateT <= 0) e.state = 'idle';
        } else {
          if (!this.tryMelee(e, distP)) this.seekPlayer(e, dt);
          if (distP < 6 && distP > 2.5 && FOV.lineOfSight(s.map, e.x, e.y, p.x, p.y)) {
            e.state = 'windup'; e.stateT = def.windup;
          }
        }
        break;
      }

      case 'bomber': {
        this.seekPlayer(e, dt, 1.1);
        if (distP < 1.3 && e.state !== 'fuse') {
          e.state = 'fuse'; e.stateT = def.fuseTime;
          Sfx.play('telegraph');
        }
        if (e.state === 'fuse') {
          e.stateT -= dt;
          e.hitFlashT = .1;
          if (e.stateT <= 0) {
            e.dead = true;
            Combat.explode(e.x, e.y, def.blastRadius, e.atk * 1.4, false, e.element || 'fire', { source: e.name });
          }
        }
        break;
      }

      case 'healer': {
        // trzyma dystans, leczy rannych sojuszników
        if (distP < 4.5) this.fleePlayer(e, dt, .9);
        e.healT -= dt;
        if (e.healT <= 0) {
          const ally = s.enemies
            .filter(o => o !== e && !o.dead && o.hp < o.maxHp * .8 && U.dist(e.x, e.y, o.x, o.y) < 7)
            .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
          if (ally) {
            e.healT = def.healCd;
            ally.hp = Math.min(ally.maxHp, ally.hp + def.healAmt);
            Fx.beam(e.x, e.y, ally.x, ally.y, '#7ae08a', 2, .4);
            Fx.text(ally.x, ally.y - .6, '+' + def.healAmt, '#7ae08a', 13);
            Sfx.play('heal');
          } else e.healT = 1;
        }
        break;
      }

      case 'summoner': {
        if (distP < 5) this.fleePlayer(e, dt, .8);
        else if (distP > 8) this.seekPlayer(e, dt, .7);
        e.summonT -= dt;
        if (e.summonT <= 0) {
          const myMinions = s.enemies.filter(o => o.summonedBy === e && !o.dead).length;
          if (myMinions < (def.summonMax || 3)) {
            e.summonT = def.summonCd;
            const spot = Dungeon.freeSpotNear(s.map, e.x, e.y, 2.5);
            const child = this.make(def.summonType, spot.x, spot.y, { noElite: true, mult: .8 });
            child.summonedBy = e;
            child.aggro = true;
            child.xp = Math.round(child.xp * .3); child.gold = Math.round(child.gold * .3);
            s.enemies.push(child);
            Fx.burst(spot.x, spot.y, e.color, 12, { spd: 3 });
            Sfx.play('summon');
          } else e.summonT = 2;
        }
        break;
      }

      case 'leaper': {
        e.leapT -= dt;
        if (e.state === 'leap') {
          e.stateT -= dt;
          this.step(e, e.chargeDX * 9, e.chargeDY * 9, dt);
          if (e.stateT <= 0 || distP < e.radius + p.radius + .2) {
            e.state = 'idle';
            if (distP < 1.4) Combat.hitPlayer(e.atk * (def.leapDmgMult || 1.4), { element: e.element, source: e.name });
            Fx.ring(e.x, e.y, 1, e.color, 2, .3);
          }
        } else {
          if (!this.tryMelee(e, distP)) this.seekPlayer(e, dt);
          if (e.leapT <= 0 && distP < def.leapRange && distP > 2 && FOV.lineOfSight(s.map, e.x, e.y, p.x, p.y)) {
            e.leapT = def.leapCd;
            e.state = 'leap'; e.stateT = distP / 9;
            const a = U.angle(e.x, e.y, p.x, p.y);
            e.chargeDX = Math.cos(a); e.chargeDY = Math.sin(a);
          }
        }
        break;
      }

      case 'teleporter': {
        e.blinkT -= dt;
        if (e.blinkT <= 0) {
          e.blinkT = def.blinkCd;
          Fx.burst(e.x, e.y, e.color, 12, { spd: 3 });
          const a = Math.random() * Math.PI * 2, d = U.rand(3, 5);
          const nx = p.x + Math.cos(a) * d, ny = p.y + Math.sin(a) * d;
          if (Dungeon.circleFree(s.map, nx, ny, e.radius)) { e.x = nx; e.y = ny; }
          Fx.burst(e.x, e.y, e.color, 12, { spd: 3 });
        }
        if (distP < 3) this.fleePlayer(e, dt, .7);
        if (e.attackCdT <= 0 && FOV.lineOfSight(s.map, e.x, e.y, p.x, p.y) && distP < 9) {
          e.attackCdT = def.attackCd || 1.6;
          this.shoot(e, def);
        }
        break;
      }

      case 'splitter':
        if (!this.tryMelee(e, distP)) this.seekPlayer(e, dt);
        break;

      case 'stealther': {
        e.stealthTimer -= dt;
        if (e.invisT > 0) {
          e.invisT -= dt;
          this.seekPlayer(e, dt, 1.3);
          if (distP < 1.2 || e.invisT <= 0) {
            e.invisT = 0;
            if (this.tryMelee(e, distP, 1.5)) Fx.burst(e.x, e.y, e.color, 10, { spd: 3 });
          }
        } else {
          if (!this.tryMelee(e, distP)) this.seekPlayer(e, dt);
          if (e.stealthTimer <= 0 && distP < 7) {
            e.stealthTimer = def.stealthCd;
            e.invisT = def.stealthDur;
            Fx.burst(e.x, e.y, '#8a8ab0', 10, { spd: 2.5 });
          }
        }
        break;
      }

      default:
        if (!this.tryMelee(e, distP)) this.seekPlayer(e, dt);
    }
  },

  kill(e, opts = {}) {
    if (e.dead) return;
    e.dead = true;
    const s = Game.s, p = s.p;

    Fx.burst(e.x, e.y, e.color, e.elite ? 22 : 12, { spd: 4, life: .6 });
    Fx.blood(e.x, e.y, 4);
    if (e.elite) { Fx.ring(e.x, e.y, 1.6, EnemyDB.eliteAffixes[e.elite].color, 3, .5); Fx.shake(4); }

    // Wybuchowy elita
    if (e.elite === 'explosive') {
      Combat.explode(e.x, e.y, 2.2, e.atk * 1.2, false, 'fire', { source: e.name + ' (wybuch)' });
    }
    // Sopelnik dzieli się
    if (e.ai === 'splitter' && e.def_.splitInto) {
      for (let i = 0; i < e.def_.splitCount; i++) {
        const spot = Dungeon.freeSpotNear(s.map, e.x, e.y, 1.5);
        const shard = this.make(e.def_.splitInto, spot.x, spot.y, { noElite: true });
        shard.aggro = true;
        s.enemies.push(shard);
      }
    }

    // nagrody
    if (e.xp > 0) Progression.gainXp(e.xp);
    if (e.gold > 0) {
      const got = Player.giveGold(e.gold * U.rand(.7, 1.3));
      Fx.text(e.x, e.y - .3, '+' + got + '💰', '#e8c368', 12);
      Sfx.play('gold');
    }
    // esencja
    const ess = e.xp * BAL.essencePerXp * (e.elite ? 2 : 1);
    s.runStats.essenceEarned += ess;

    // łupy
    let dropChance = BAL.dropChance + (e.elite ? .5 : 0);
    if (U.chance(dropChance)) {
      const item = ItemDB.rollAny(s.floor, p.d.luck + (e.elite ? 1 : 0));
      s.drops.push({ x: e.x + U.rand(-.3, .3), y: e.y + U.rand(-.3, .3), item, bob: Math.random() * 6.28 });
      if (item.rarity === 'legend') Meta.unlock('legend_find');
    }

    s.runStats.kills++;
    if (e.elite) s.runStats.elites++;
    Meta.recordKill(e.id, !!e.elite);
    Game.addCombo();

    if (e.isBoss) Bosses.onDeath(e);

    // piętro oczyszczone — premia esencji
    if (!s.floorCleared && s.enemies.every(o => o.dead || o === e)) {
      s.floorCleared = true;
      const bonus = Meta.addEssence(3 + Math.round(s.floor * .8));
      Game.msg('🧹 Piętro oczyszczone! +' + bonus + ' ✨ Esencji Dusz', 'gold');
      Sfx.play('achieve');
    }
  },
};
