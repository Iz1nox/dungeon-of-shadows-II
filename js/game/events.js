'use strict';

// Interakcje z mapą (klawisz E): schody, skrzynie, kapliczki, ołtarze, studnie, sklep.
const Events = {

  // znajdź interaktywny kafelek obok gracza
  findInteractable() {
    const s = Game.s, p = s.p;
    const px = p.x | 0, py = p.y | 0;
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const x = px + dx, y = py + dy;
        const t = Dungeon.tile(s.map, x, y);
        if ([TILE.STAIRS, TILE.CHEST, TILE.SHRINE, TILE.ALTAR, TILE.WELL, TILE.SHOP].includes(t)) {
          // środek kafelka musi być blisko
          if (U.dist(p.x, p.y, x + .5, y + .5) < 1.35) return { x, y, t };
        }
      }
    return null;
  },

  hintFor(t) {
    switch (t) {
      case TILE.STAIRS: return '<b>E</b> — zejdź niżej 🌀';
      case TILE.CHEST: return '<b>E</b> — otwórz skrzynię 📦';
      case TILE.SHRINE: return '<b>E</b> — pomódl się przy kapliczce ⛩️';
      case TILE.ALTAR: return '<b>E</b> — Ołtarz Krwi 🩸 (−20% HP → +3 ataku)';
      case TILE.WELL: return '<b>E</b> — Studnia Dusz 💧';
      case TILE.SHOP: return '<b>E</b> — handluj 🧙';
      default: return '';
    }
  },

  interact() {
    const it = this.findInteractable();
    if (!it) return;
    const s = Game.s;
    switch (it.t) {
      case TILE.STAIRS: Game.nextFloor(); break;
      case TILE.CHEST: this.openChest(it.x, it.y); break;
      case TILE.SHRINE: this.useShrine(it.x, it.y); break;
      case TILE.ALTAR: this.useAltar(it.x, it.y); break;
      case TILE.WELL: this.useWell(it.x, it.y); break;
      case TILE.SHOP: Shop.open(); break;
    }
  },

  openChest(x, y) {
    const s = Game.s, p = s.p;
    Dungeon.set(s.map, x, y, TILE.FLOOR);
    // Mimik!
    if (U.chance(BAL.mimicChance)) {
      Sfx.play('mimic');
      Fx.shake(5);
      Game.msg('📦 TO MIMIK!', 'bad');
      const m = Enemies.make('mimic', x + .5, y + .5, { noElite: true, mult: 1.35 });
      m.aggro = true;
      s.enemies.push(m);
      return;
    }
    Sfx.play('chest');
    Fx.burst(x + .5, y + .5, '#ffd84d', 16, { spd: 3.5 });
    const gold = Player.giveGold(BAL.chestGoldBase + s.floor * 9 * U.rand(.7, 1.4));
    Game.msg('📦 Skrzynia: +' + gold + ' 💰', 'gold');
    const n = U.randi(1, 2);
    for (let i = 0; i < n; i++) {
      const item = ItemDB.rollAny(s.floor, p.d.luck + 1);
      s.drops.push({ x: x + .5 + U.rand(-.4, .4), y: y + .5 + U.rand(-.4, .4), item, bob: Math.random() * 6 });
      if (item.rarity === 'legend') Meta.unlock('legend_find');
    }
  },

  useShrine(x, y) {
    const s = Game.s, p = s.p;
    Dungeon.set(s.map, x, y, TILE.FLOOR);
    if (U.chance(BAL.shrineCurseChance)) {
      Sfx.play('curse');
      Fx.flash('#8a2aff', .25);
      const roll = U.randi(0, 2);
      if (roll === 0) {
        Combat.applyStatus(p, 'curse', 12, 0, true);
        Game.msg('⛩️ Kapliczka była skażona... Klątwa! (+25% obrażeń przez 12s)', 'bad');
      } else if (roll === 1) {
        const dmg = Math.round(p.d.maxHp * .15);
        Combat.hitPlayer(dmg, { element: 'shadow', source: 'Skażona kapliczka', ignoreDodge: true });
        Game.msg('⛩️ Cień wypełza z kapliczki i rani cię!', 'bad');
      } else {
        const spot = Dungeon.freeSpotNear(s.map, x + .5, y + .5, 3);
        const pool = EnemyDB.poolFor(s.floor);
        const e = Enemies.make(U.choice(pool), spot.x, spot.y, { elite: U.choice(Object.keys(EnemyDB.eliteAffixes)) });
        e.aggro = true;
        s.enemies.push(e);
        Game.msg('⛩️ Kapliczka przyzywa strażnika!', 'bad');
      }
      return;
    }
    Sfx.play('buff');
    Fx.burst(x + .5, y + .5, '#ffe9a0', 18, { spd: 3.5 });
    const roll = U.randi(0, 3);
    if (roll === 0) {
      Player.heal(p, p.d.maxHp * .4);
      Game.msg('⛩️ Kapliczka leczy twoje rany (+40% HP).', 'good');
    } else if (roll === 1) {
      Player.addBuff(p, { icon: '⛩️', name: 'Błogosławieństwo', dur: 45, atkPct: .2, defFlat: 4 });
      Game.msg('⛩️ Błogosławieństwo: +20% ataku, +4 pancerza (45s).', 'good');
    } else if (roll === 2) {
      const gold = Player.giveGold(30 + s.floor * 12);
      Game.msg('⛩️ Znajdujesz ofiarne złoto: +' + gold + ' 💰', 'gold');
    } else {
      const ess = Meta.addEssence(5 + Math.round(s.floor * 1.5));
      Game.msg('⛩️ Duchy szepczą... +' + ess + ' ✨ Esencji Dusz.', 'magic');
    }
  },

  useAltar(x, y) {
    const s = Game.s, p = s.p;
    const cost = Math.round(p.d.maxHp * BAL.altarHpCostPct);
    if (p.hp <= cost + 5) { Game.msg('🩸 Za mało życia, by złożyć ofiarę.', 'bad'); Sfx.play('error'); return; }
    Dungeon.set(s.map, x, y, TILE.FLOOR);
    p.hp -= cost;
    p.regenDelayT = BAL.regenDelay;
    p.altarBonus = (p.altarBonus || 0) + BAL.altarAtkGain;
    Sfx.play('curse');
    Fx.blood(x + .5, y + .5, 14);
    Fx.flash('#a01010', .2);
    Game.msg('🩸 Ołtarz przyjmuje ofiarę: +' + BAL.altarAtkGain + ' ataku (do końca wyprawy).', 'magic');
  },

  useWell(x, y) {
    const s = Game.s, p = s.p;
    Dungeon.set(s.map, x, y, TILE.FLOOR);
    Sfx.play('heal');
    Fx.burst(x + .5, y + .5, '#7ad8ff', 16, { spd: 3 });
    p.mp = p.d.maxMp;
    Player.heal(p, p.d.maxHp * .25);
    for (const sk of p.skills) sk.cdT = Math.min(sk.cdT, 1);
    Game.msg('💧 Studnia Dusz: pełna mana, +25% HP, odświeżone umiejętności.', 'good');
    if (U.chance(.3)) {
      const ess = Meta.addEssence(4 + s.floor);
      Game.msg('💧 Z dna studni: +' + ess + ' ✨ Esencji.', 'magic');
    }
  },
};
