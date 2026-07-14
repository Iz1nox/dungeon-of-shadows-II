'use strict';

// Zapis / wczytanie stanu wyprawy (localStorage, 3 sloty; slot 0 = autozapis).
const SaveSys = {

  serialize() {
    const s = Game.s, p = s.p;
    const item = it => it; // przedmioty są czystym JSON-em
    return {
      v: SAVE_VERSION, gameVersion: GAME_VERSION,
      when: Date.now(),
      floor: s.floor, endless: s.endless, time: s.time,
      runStats: s.runStats,
      shopStock: s.shopStock,
      player: {
        cls: p.cls, level: p.level, xp: p.xp, xpNext: p.xpNext,
        hp: p.hp, mp: p.mp, gold: p.gold, dust: p.dust,
        x: p.x, y: p.y,
        talents: p.talents, altarBonus: p.altarBonus || 0,
        equip: p.equip, inv: p.inv.map(item),
        phoenixFloorUsed: p.phoenixFloorUsed, metaReviveUsed: p.metaReviveUsed,
        dashCharges: p.dashCharges,
      },
      map: {
        t: Array.from(s.map.t), explored: Array.from(s.map.explored),
        deco: s.map.deco, torches: s.map.torches, rooms: s.map.rooms,
        spawn: s.map.spawn, stairs: s.map.stairs, stairsLocked: s.map.stairsLocked,
        shopPos: s.map.shopPos || null,
        bossRoomIdx: s.map.rooms.indexOf(s.map.bossRoom),
      },
      enemies: s.enemies.filter(e => !e.dead && !e.isBoss && !e.summonedBy).map(e => ({
        id: e.id, x: e.x, y: e.y, hp: e.hp, elite: e.elite, aggro: e.aggro,
      })),
      boss: s.boss && !s.boss.dead ? { id: s.boss.id, hp: s.boss.hp, phase: s.boss.phase } : null,
      drops: s.drops,
      maxUid: ItemDB.uid,
    };
  },

  save(slot, silent = false) {
    if (!Game.alive()) return false;
    try {
      localStorage.setItem(SAVE_KEY + slot, JSON.stringify(this.serialize()));
      if (!silent) { Hud.saveToast('💾 Zapisano grę (slot ' + (slot === 0 ? 'auto' : slot) + ')'); Sfx.play('click'); }
      return true;
    } catch (e) {
      if (!silent) Hud.saveToast('❌ Błąd zapisu: ' + e.message);
      return false;
    }
  },

  autoSave() { this.save(0, true); },

  slotInfo(slot) {
    try {
      const raw = localStorage.getItem(SAVE_KEY + slot);
      if (!raw) return null;
      const d = JSON.parse(raw);
      return {
        cls: d.player.cls, level: d.player.level, floor: d.floor,
        when: d.when, v: d.v,
      };
    } catch (e) { return null; }
  },

  load(slot) {
    let d;
    try {
      const raw = localStorage.getItem(SAVE_KEY + slot);
      if (!raw) return false;
      d = JSON.parse(raw);
    } catch (e) { return false; }
    if (!d || d.v > SAVE_VERSION) {
      Game.msg('❌ Zapis pochodzi z nowszej wersji gry.', 'bad');
      return false;
    }

    ItemDB.uid = Math.max(ItemDB.uid, d.maxUid || 1);

    const s = Game.newRunState(d.player.cls);
    Game.s = s;
    s.floor = d.floor; s.endless = !!d.endless; s.time = d.time || 0;
    s.runStats = Object.assign(s.runStats, d.runStats);
    s.shopStock = d.shopStock || null;

    // mapa
    const biome = BiomeDB.forFloor(d.floor);
    const map = {
      w: MAP_W, h: MAP_H, floor: d.floor, biome,
      t: Uint8Array.from(d.map.t), explored: Uint8Array.from(d.map.explored),
      visible: new Uint8Array(MAP_W * MAP_H),
      deco: d.map.deco || [], torches: d.map.torches || [], rooms: d.map.rooms || [],
      spawn: d.map.spawn, stairs: d.map.stairs, stairsLocked: !!d.map.stairsLocked,
      shopPos: d.map.shopPos || null, usedEvents: {},
      bossRoom: d.map.rooms[d.map.bossRoomIdx] || d.map.rooms[0],
    };
    s.map = map;

    // gracz
    const p = s.p, dp = d.player;
    p.level = dp.level; p.xp = dp.xp; p.xpNext = dp.xpNext;
    p.gold = dp.gold; p.dust = dp.dust;
    p.x = dp.x; p.y = dp.y;
    p.talents = dp.talents || {};
    p.altarBonus = dp.altarBonus || 0;
    p.equip = dp.equip;
    p.inv = dp.inv || [];
    p.phoenixFloorUsed = !!dp.phoenixFloorUsed;
    p.metaReviveUsed = !!dp.metaReviveUsed;
    p.dashCharges = dp.dashCharges !== undefined ? dp.dashCharges : BAL.dashChargesBase;
    Player.recalc(p);
    p.hp = Math.min(dp.hp, p.d.maxHp);
    p.mp = Math.min(dp.mp, p.d.maxMp);

    // wrogowie
    for (const ed of d.enemies || []) {
      if (!EnemyDB.types[ed.id]) continue;
      const e = Enemies.make(ed.id, ed.x, ed.y, { elite: ed.elite || undefined, noElite: !ed.elite });
      e.hp = Math.min(ed.hp, e.maxHp);
      e.aggro = !!ed.aggro;
      s.enemies.push(e);
    }
    if (d.boss && EnemyDB.bosses[d.boss.id]) {
      Bosses.spawn(d.boss.id);
      const b = s.boss;
      b.hp = Math.min(d.boss.hp, b.maxHp);
      b.phase = d.boss.phase || 1;
    }

    s.drops = d.drops || [];

    Fx.reset();
    FOV.update(map, p.x, p.y, FOV_RADIUS);
    Path.compute(map, p.x, p.y);
    Hud.buildSpellBar();
    Hud.setFloorLabel();
    Game.msg('📂 Wczytano grę — ' + biome.name + ', piętro ' + s.floor + '.', 'sys');
    return true;
  },
};
