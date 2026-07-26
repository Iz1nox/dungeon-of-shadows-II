'use strict';

// Arena Otchłani — dobrowolne wyzwanie: 3 fale wrogów w zamian
// za gwarantowany łup i Esencję Dusz.
const Challenge = {

  start(x, y) {
    const s = Game.s;
    if (s.challenge && s.challenge.active) return;
    Dungeon.set(s.map, x, y, TILE.FLOOR);
    s.challenge = {
      active: true, wave: 0, x: x + .5, y: y + .5,
      pending: 0, gapT: 0,
    };
    Sfx.play('bossroar');
    Fx.shake(6);
    Fx.flash('#8a2aff', .25);
    Fx.ring(x + .5, y + .5, 4, '#b06aff', 4, .7);
    Game.msg('⚔️ ARENA OTCHŁANI! Przetrwaj ' + BAL.challengeWaves + ' fale.', 'magic');
    this.spawnWave();
  },

  spawnWave() {
    const s = Game.s, c = s.challenge;
    c.wave++;
    const pool = EnemyDB.poolFor(s.floor);
    const count = 3 + Math.round(s.floor * .35) + c.wave;
    const lastWave = c.wave >= BAL.challengeWaves;
    for (let i = 0; i < count; i++) {
      const spot = Dungeon.freeSpotNear(s.map, c.x, c.y, 6);
      // ostatnia fala: gwarantowana elita na czele
      const e = Enemies.make(U.choice(pool), spot.x, spot.y,
        (lastWave && i === 0) ? { elite: U.choice(Object.keys(EnemyDB.eliteAffixes)) } : {});
      e.aggro = true;
      e.fromChallenge = true;
      s.enemies.push(e);
      Fx.burst(spot.x, spot.y, '#b06aff', 10, { spd: 3 });
    }
    c.pending = count;
    Sfx.play('summon');
    Game.msg('🌀 Fala ' + c.wave + '/' + BAL.challengeWaves + ' — ' + count + ' wrogów!', 'bad');
    Hud.challengeBanner(c.wave, BAL.challengeWaves);
  },

  update(dt) {
    const s = Game.s, c = s.challenge;
    if (!c || !c.active) return;
    const alive = s.enemies.filter(e => e.fromChallenge && !e.dead).length;
    if (alive > 0) return;
    // przerwa między falami
    if (c.gapT > 0) { c.gapT -= dt; return; }
    if (c.wave < BAL.challengeWaves) {
      c.gapT = 1.6;
      this.spawnWave();
    } else {
      this.complete();
    }
  },

  complete() {
    const s = Game.s, c = s.challenge;
    c.active = false;
    Sfx.play('achieve');
    Fx.shake(7);
    Fx.flash('#e8c368', .3);
    Fx.ring(c.x, c.y, 5, '#e8c368', 5, .8);
    Game.msg('🏆 Arena pokonana! Otchłań płaci daninę.', 'gold');

    // nagroda: pewny łup wysokiej jakości + konsument + esencja
    const rarity = U.chance(.3) ? 'legend' : (U.chance(.5) ? 'set' : 'epic');
    const item = ItemDB.rollEquip(s.floor, { rarity, luck: s.p.d.luck + 1 });
    s.drops.push({ x: c.x, y: c.y, item, bob: 0 });
    if (item.rarity === 'legend') Meta.unlock('legend_find');
    s.drops.push({ x: c.x + .7, y: c.y + .3, item: ItemDB.rollConsumable(s.floor), bob: 1 });

    const ess = Meta.addEssence(BAL.challengeEssence + s.floor * 2);
    Game.msg('✨ +' + ess + ' Esencji Dusz za arenę.', 'magic');
    s.runStats.arenas = (s.runStats.arenas || 0) + 1;
    if (s.runStats.arenas >= 3) Meta.unlock('arena3');
    Meta.save();
    Hud.challengeBanner(0, 0);
  },
};
