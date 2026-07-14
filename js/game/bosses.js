'use strict';

// Bossowie: maszyna stanów z telegrafowanymi atakami i fazami.
const Bosses = {

  spawn(bossId) {
    const s = Game.s, map = s.map;
    const def = EnemyDB.bosses[bossId];
    const m = Enemies.floorMult(s.floor);
    const r = map.bossRoom;
    const b = {
      id: bossId, name: def.name, icon: def.icon, color: def.color,
      x: r.cx + .5, y: r.cy + .5, radius: def.radius,
      hp: Math.round(def.hp * m), maxHp: Math.round(def.hp * m), hpGhost: 1,
      atk: def.atk * m, def: def.def,
      xp: def.xp, gold: def.gold, essence: def.essence,
      speed: def.speed, baseSpeed: def.speed,
      ai: 'boss', element: 'phys',
      resist: def.resist, weak: def.weak,
      statuses: {}, hitFlashT: 0,
      aggro: false, aggroRange: 10,
      attackCdT: 0, meleeCd: 1.1,
      def_: def, isBoss: true,
      phase: 1, abilityT: 2.2, abilities: def.abilities,
      taunted: false, final: def.final,
      state: 'idle', stateT: 0,
      bobPhase: 0, elite: null,
      hpGhostBar: 1,
    };
    s.enemies.push(b);
    s.boss = b;
    s.bossHitTaken = false;
  },

  update(b, dt) {
    const s = Game.s, p = s.p;
    const distP = U.dist(b.x, b.y, p.x, p.y);

    if (!b.taunted && b.aggro) {
      b.taunted = true;
      Game.msg('💀 ' + b.name + ': „' + b.def_.taunt + '"', 'bad');
      Sfx.play('bossroar');
      Fx.shake(6);
    }
    if (!b.aggro) return;

    // fazy
    const hpPct = b.hp / b.maxHp;
    if (b.phase === 1 && hpPct < .66) this.phaseUp(b, 2);
    else if (b.phase === 2 && hpPct < .33) this.phaseUp(b, 3);

    if (b.attackCdT > 0) b.attackCdT -= dt;

    // stan szarży
    if (b.state === 'windup') {
      b.stateT -= dt;
      b.hitFlashT = .1;
      if (b.stateT <= 0) {
        b.state = 'charge'; b.stateT = .55;
        const a = U.angle(b.x, b.y, p.x, p.y);
        b.chargeDX = Math.cos(a); b.chargeDY = Math.sin(a);
        Sfx.play('bossroar');
      }
      return;
    }
    if (b.state === 'charge') {
      b.stateT -= dt;
      Enemies.step(b, b.chargeDX * 11, b.chargeDY * 11, dt);
      Fx.burst(b.x, b.y, b.color, 2, { spd: 1.5, life: .3 });
      if (distP < b.radius + p.radius + .3) {
        Combat.hitPlayer(b.atk * 1.5, { element: 'phys', source: b.name });
        b.state = 'idle';
      }
      if (b.stateT <= 0) b.state = 'idle';
      return;
    }

    // ruch: powolne dążenie do gracza
    if (distP > b.radius + p.radius + .3) {
      Enemies.seekPlayer(b, dt, 1);
    } else {
      Enemies.tryMelee(b, distP, 1);
    }

    // rotacja umiejętności
    b.abilityT -= dt;
    if (b.abilityT <= 0) {
      const cd = (b.phase === 1 ? 4.2 : b.phase === 2 ? 3.2 : 2.4) * U.rand(.85, 1.15);
      b.abilityT = cd;
      this.useAbility(b, U.choice(b.abilities));
    }
  },

  phaseUp(b, phase) {
    b.phase = phase;
    b.baseSpeed *= 1.18;
    Sfx.play('bossroar');
    Fx.shake(8);
    Fx.flash(b.color, .25);
    Fx.ring(b.x, b.y, 4, b.color, 5, .6);
    Game.msg('⚠️ ' + b.name + ' wpada w szał! (faza ' + phase + ')', 'bad');
    U.el('boss-phase').textContent = phase === 2 ? '⚠️ FAZA 2' : '🔥 FAZA 3';
  },

  useAbility(b, ability) {
    const s = Game.s, p = s.p, m = Enemies.floorMult(s.floor);
    switch (ability) {
      case 'slam':
        Combat.addTelegraph({
          x: p.x, y: p.y, r: 2.2, delay: 1.0, dmg: b.atk * 1.6,
          friendly: false, element: 'phys', color: '#ff6a4a', source: b.name,
        });
        break;

      case 'bone_spray': {
        const n = 12 + b.phase * 3;
        for (let i = 0; i < n; i++) {
          Combat.spawnProjectile({
            x: b.x, y: b.y, ang: (i / n) * Math.PI * 2, speed: 5.5, size: .22,
            dmg: b.atk * .7, element: 'phys', color: '#e8dcb0', friendly: false, source: b.name,
          });
        }
        Sfx.play('shoot');
        break;
      }

      case 'summon': {
        const count = 2 + (b.phase > 1 ? 1 : 0);
        for (let i = 0; i < count; i++) {
          const spot = Dungeon.freeSpotNear(s.map, b.x, b.y, 3);
          const child = Enemies.make(b.def_.summonType, spot.x, spot.y, { noElite: true, mult: .75 });
          child.aggro = true;
          child.xp = Math.round(child.xp * .3); child.gold = Math.round(child.gold * .3);
          s.enemies.push(child);
          Fx.burst(spot.x, spot.y, b.color, 12, { spd: 3 });
        }
        Sfx.play('summon');
        break;
      }

      case 'spore_cloud':
        for (let i = 0; i < 2 + b.phase; i++) {
          Combat.addZone({
            x: p.x + U.rand(-3, 3), y: p.y + U.rand(-3, 3), r: 1.8, dur: 5,
            dps: b.atk * .5, friendly: false, element: 'poison', color: '#8ae05a',
            status: { type: 'poison', dur: 3 }, source: b.name,
          });
        }
        break;

      case 'charge':
        b.state = 'windup'; b.stateT = .7;
        break;

      case 'ice_breath': {
        const a0 = U.angle(b.x, b.y, p.x, p.y);
        for (let i = 0; i < 9; i++) {
          Combat.spawnProjectile({
            x: b.x, y: b.y, ang: a0 + (i - 4) * .12, speed: 6.5, size: .24,
            dmg: b.atk * .6, element: 'ice', color: '#b0e8ff', friendly: false,
            status: { type: 'chill', dur: 2.5, chance: .8 }, source: b.name,
          });
        }
        break;
      }

      case 'blizzard':
        for (let i = 0; i < 5 + b.phase * 2; i++) {
          Combat.addTelegraph({
            x: p.x + U.rand(-5, 5), y: p.y + U.rand(-5, 5), r: 1.6, delay: 1.1 + i * .16,
            dmg: b.atk * 1.1, friendly: false, element: 'ice', color: '#7ad8ff',
            status: { type: 'freeze', dur: 1.2 }, source: b.name,
          });
        }
        break;

      case 'freeze_nova':
        Combat.addTelegraph({
          x: b.x, y: b.y, r: 3.6, delay: 1.3, dmg: b.atk * 1.3,
          friendly: false, element: 'ice', color: '#7ad8ff',
          status: { type: 'freeze', dur: 1.6 }, source: b.name,
        });
        break;

      case 'meteor_rain':
        for (let i = 0; i < 4 + b.phase * 2; i++) {
          Combat.addTelegraph({
            x: p.x + U.rand(-4.5, 4.5), y: p.y + U.rand(-4.5, 4.5), r: 1.8, delay: 1.0 + i * .2,
            dmg: b.atk * 1.3, friendly: false, element: 'fire', color: '#ff7a3e',
            status: { type: 'burn', dur: 3 }, source: b.name,
          });
        }
        break;

      case 'fire_nova':
        Combat.addTelegraph({
          x: b.x, y: b.y, r: 4.2, delay: 1.4, dmg: b.atk * 1.5,
          friendly: false, element: 'fire', color: '#ff7a3e',
          status: { type: 'burn', dur: 3 }, source: b.name,
        });
        break;

      case 'arcane_barrage': {
        const a0 = U.angle(b.x, b.y, p.x, p.y);
        for (let w = 0; w < 3; w++) {
          for (let i = 0; i < 5; i++) {
            setTimeout(() => {
              if (!Game.alive() || b.dead) return;
              const a = U.angle(b.x, b.y, Game.s.p.x, Game.s.p.y) + (i - 2) * .18;
              Combat.spawnProjectile({
                x: b.x, y: b.y, ang: a, speed: 8, size: .22,
                dmg: b.atk * .65, element: 'arcane', color: '#c7d4ff', friendly: false, source: b.name,
              });
            }, w * 450);
          }
        }
        Sfx.play('magic');
        break;
      }

      case 'blink': {
        Fx.burst(b.x, b.y, b.color, 16, { spd: 4 });
        const a = Math.random() * Math.PI * 2, d = U.rand(2.5, 4);
        const nx = p.x + Math.cos(a) * d, ny = p.y + Math.sin(a) * d;
        if (Dungeon.circleFree(s.map, nx, ny, b.radius)) { b.x = nx; b.y = ny; }
        Fx.burst(b.x, b.y, b.color, 16, { spd: 4 });
        Sfx.play('magic');
        break;
      }

      case 'mirror_clones': {
        const clones = s.enemies.filter(e => e.cloneOf === b && !e.dead).length;
        if (clones >= 2) break;
        for (let i = 0; i < 2; i++) {
          const spot = Dungeon.freeSpotNear(s.map, b.x, b.y, 3.5);
          const c = Enemies.make('mirage', spot.x, spot.y, { noElite: true });
          c.name = 'Odbicie Arcymaga'; c.icon = b.icon; c.color = '#9aa8e0';
          c.hp = Math.round(b.maxHp * .06); c.maxHp = c.hp;
          c.cloneOf = b; c.aggro = true;
          c.xp = 15; c.gold = 10;
          s.enemies.push(c);
          Fx.burst(spot.x, spot.y, '#c7d4ff', 14, { spd: 3 });
        }
        Game.msg('🪞 Arcymag tworzy odbicia!', 'magic');
        break;
      }

      case 'beam_sweep': {
        // linia telegrafów przez gracza
        const a = U.angle(b.x, b.y, p.x, p.y);
        for (let i = 1; i <= 7; i++) {
          Combat.addTelegraph({
            x: b.x + Math.cos(a) * i * 1.5, y: b.y + Math.sin(a) * i * 1.5,
            r: 1.2, delay: .9 + i * .08, dmg: b.atk * 1.1,
            friendly: false, element: 'arcane', color: '#c7d4ff', source: b.name,
          });
        }
        break;
      }

      case 'void_bolts': {
        const n = 16 + b.phase * 4;
        const off = Math.random() * Math.PI * 2;
        for (let i = 0; i < n; i++) {
          setTimeout(() => {
            if (!Game.alive() || b.dead) return;
            Combat.spawnProjectile({
              x: b.x, y: b.y, ang: off + (i / n) * Math.PI * 4, speed: 5.5, size: .24,
              dmg: b.atk * .6, element: 'shadow', color: '#b06aff', friendly: false, source: b.name,
            });
          }, i * 70);
        }
        break;
      }

      case 'void_zones':
        for (let i = 0; i < 2 + b.phase; i++) {
          Combat.addZone({
            x: p.x + U.rand(-4, 4), y: p.y + U.rand(-4, 4), r: 1.7, dur: 6,
            dps: b.atk * .55, friendly: false, element: 'shadow', color: '#8a2aff',
            status: { type: 'curse', dur: 4 }, source: b.name,
          });
        }
        break;

      case 'heartbeat':
        Game.msg('🫀 Serce bije... UCIEKAJ Z KRĘGU!', 'bad');
        Combat.addTelegraph({
          x: b.x, y: b.y, r: 5.5, delay: 1.8, dmg: b.atk * 2,
          friendly: false, element: 'shadow', color: '#ff4a7a', source: b.name,
        });
        Sfx.play('bossroar');
        break;
    }
  },

  onDeath(b) {
    const s = Game.s;
    s.boss = null;
    Sfx.play('bossdie');
    Fx.shake(10);
    Fx.flash('#fff', .35);
    for (let i = 0; i < 5; i++) {
      setTimeout(() => Fx.burst(b.x + U.rand(-1, 1), b.y + U.rand(-1, 1), b.color, 20, { spd: 6, life: .8 }), i * 120);
    }
    Game.msg('🏆 ' + b.name + ' pokonany!', 'gold');

    // esencja + gwarantowany łup
    const ess = Meta.addEssence(b.essence);
    s.runStats.essenceEarned += 0; // esencja bossów trafia od razu do meta
    Game.msg('✨ +' + ess + ' Esencji Dusz', 'magic');
    const rarity = U.chance(.25) ? 'legend' : 'epic';
    const item = ItemDB.rollEquip(s.floor, { rarity, luck: s.p.d.luck });
    s.drops.push({ x: b.x, y: b.y, item, bob: 0 });
    if (item.rarity === 'legend') Meta.unlock('legend_find');
    s.drops.push({ x: b.x + .6, y: b.y + .3, item: ItemDB.rollConsumable(s.floor), bob: 1 });

    if (!s.bossHitTaken) Meta.unlock('boss_nohit');

    // odblokuj schody
    if (b.final) {
      Game.victory();
      return;
    }
    if (s.map.stairsLocked) {
      s.map.stairsLocked = false;
      Dungeon.set(s.map, s.map.stairs.x, s.map.stairs.y, TILE.STAIRS);
      Game.msg('🌀 Zejście na kolejne piętro otwarte!', 'sys');
    }
    Meta.save();
  },
};
