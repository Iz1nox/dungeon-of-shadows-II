'use strict';

// =====================================================================
// DUNGEON OF SHADOWS II — sonda balansu
//
// Nie sprawdza poprawności (od tego jest smoke.js), tylko MIERZY:
// ile łupów sypie gra, jak wygląda krzywa mocy gracza kontra wrogowie
// i czy zagrożenia terenu mają znaczenie. Służy do tego, żeby zmiany
// balansu opierać na liczbach, a nie na przeczuciu.
//
// Uruchomienie:  node tests/balance.js
// =====================================================================

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { install } = require('./dom-stub');

const ROOT = path.resolve(__dirname, '..');

function loadGame() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const files = [];
  const re = /<script src="([^"]+)"><\/script>/g;
  let m;
  while ((m = re.exec(html))) {
    const src = m[1].split('?')[0];
    if (!src.endsWith('js/game/main.js')) files.push(src);
  }
  const ctx = vm.createContext({});
  install(ctx);
  for (const f of files) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  return vm.runInContext(`({
    Game, Player, Combat, Enemies, Bosses, Inv, Shop, Progression, Meta, Dungeon, U,
    ItemDB, EnemyDB, ClassDB, BiomeDB, BAL, TILE, FINAL_FLOOR, GAME_VERSION,
  })`, ctx, { filename: 'api-export' });
}

const G = loadGame();
const { Game, Player, Enemies, Meta, Dungeon, U, ItemDB, EnemyDB, ClassDB, BAL, TILE } = G;

Meta.load();
Meta.data.upgrades = {};      // mierzymy „gołą" grę, bez meta-ulepszeń
Meta.data.pacts = [];
Meta.data.difficulty = 'normal';

const CELE = {
  epicPlusNaWyprawe: [8, 14],   // ile przedmiotów epik+ powinno wpaść
  legendNaWyprawe: [1, 3],
  przewaga: [3, 6],             // TTD / TTK
};

function bar(v, [lo, hi]) {
  if (v < lo) return '⬇ poniżej celu';
  if (v > hi) return '⬆ POWYŻEJ CELU';
  return '✓ w celu';
}

// =====================================================================
console.log('Dungeon of Shadows II — sonda balansu (wersja ' + G.GAME_VERSION + ')\n');
console.log('═══ 1. PODAŻ ŁUPÓW ═══');
console.log('   (średnia z 200 wypraw przez piętra 1-16; gracz ma 6 slotów ekwipunku)\n');

function lootAudit(runs = 200) {
  const tally = { common: 0, magic: 0, rare: 0, epic: 0, set: 0, legend: 0 };
  const bySource = {};
  const add = (src, it) => {
    if (!it) return;
    tally[it.rarity]++;
    bySource[src] = bySource[src] || 0;
    if (['epic', 'set', 'legend'].includes(it.rarity)) bySource[src]++;
  };
  for (let r = 0; r < runs; r++) {
    Game.s = Game.newRunState('warrior');
    for (let f = 1; f <= 16; f++) {
      Game.s.floor = f;
      const enemyCount = Math.min(34, 14 + Math.round(f * 1.4));
      for (let i = 0; i < enemyCount; i++) if (U.chance(BAL.dropChance)) add('wrogowie', ItemDB.rollAny(f, 0));
      for (let c = 0; c < U.randi(1, 2); c++)
        for (let i = 0; i < U.randi(1, 2); i++) add('skrzynie', ItemDB.rollAny(f, 1));
      if (f >= 2 && U.chance(BAL.challengeChance)) {
        const rarity = U.chance(.3) ? 'legend' : (U.chance(.5) ? 'set' : 'epic');
        add('areny', ItemDB.rollEquip(f, { rarity, luck: 1 }));
      }
      if ([3, 6, 9, 12, 15, 16].includes(f)) {
        const bossId = EnemyDB.bossFor(f);
        const def = bossId && EnemyDB.bosses[bossId];
        if (def && def.legendary && U.chance(.6)) add('bossowie', ItemDB.makeLegendById(def.legendary, f));
        else add('bossowie', ItemDB.rollEquip(f, { rarity: U.chance(.35) ? 'set' : 'epic' }));
      }
      if ([2, 5, 8, 11, 14].includes(f)) {
        const feat = U.chance(.15) ? 'legend' : (U.chance(.45) ? 'set' : 'epic');
        add('sklep-perełka', ItemDB.rollEquip(f, { rarity: feat }));
        if (f >= 11) add('spod-lady', ItemDB.rollEquip(f, { rarity: U.chance(.4) ? 'legend' : 'set' }));
        for (let g = 0; g < 3; g++) {
          let rar = ItemDB.rollRarity(f + BAL.gambleLuck, 2);
          if (rar === 'common') rar = 'magic';
          add('hazard', ItemDB.rollEquip(f, { rarity: rar }));
        }
      }
    }
  }
  const total = Object.values(tally).reduce((a, b) => a + b, 0);
  for (const k of Object.keys(tally)) {
    const per = tally[k] / runs;
    console.log('   ' + k.padEnd(8) + per.toFixed(1).padStart(6) + ' szt./wyprawę   ' +
      (tally[k] / total * 100).toFixed(1).padStart(5) + '%');
  }
  const epicPlus = (tally.epic + tally.set + tally.legend) / runs;
  const legends = tally.legend / runs;
  console.log('\n   EPIK+ : ' + epicPlus.toFixed(1).padStart(5) + ' /wyprawę   cel ' +
    CELE.epicPlusNaWyprawe.join('-') + '   ' + bar(epicPlus, CELE.epicPlusNaWyprawe));
  console.log('   LEGENDY: ' + legends.toFixed(1).padStart(4) + ' /wyprawę   cel ' +
    CELE.legendNaWyprawe.join('-') + '     ' + bar(legends, CELE.legendNaWyprawe));
  console.log('\n   Skąd biorą się epiki+ (szt./wyprawę):');
  const sorted = Object.entries(bySource).sort((a, b) => b[1] - a[1]);
  for (const [src, n] of sorted) console.log('     ' + src.padEnd(16) + (n / runs).toFixed(1).padStart(5));
}
lootAudit();

// =====================================================================
console.log('\n═══ 2. KRZYWA MOCY ═══');
console.log('   TTK = sekundy na zabicie przeciętnego wroga danego piętra');
console.log('   TTD = sekundy, w których przeciętny wróg zabiłby stojącego gracza');
console.log('   przewaga = TTD / TTK  (cel: ' + CELE.przewaga.join('-') + '×)\n');

function referencePlayer(cls, floor) {
  Game.s = Game.newRunState(cls);
  const p = Game.s.p;
  Game.s.floor = floor;
  p.level = Math.round(2 + floor * 1.15);
  const picks = ['strength', 'vitality', 'precision', 'brutality', 'armor'];
  for (let i = 0; i < p.level - 1; i++) {
    const t = picks[i % picks.length];
    p.talents[t] = (p.talents[t] || 0) + 1;
  }
  const rarityFor = f => f <= 3 ? 'magic' : f <= 7 ? 'rare' : 'epic';
  for (const slot of ['weapon', 'helmet', 'armor', 'boots', 'amulet', 'ring']) {
    const it = ItemDB.rollEquip(floor, { slot, rarity: rarityFor(floor) });
    it.plus = Math.min(BAL.upgradeMax, Math.floor(floor / 2));
    p.equip[slot] = it;
  }
  Player.recalc(p);
  p.hp = p.d.maxHp;
  return p;
}

function avgEnemy(floor) {
  Game.s.floor = floor;
  const pool = EnemyDB.poolFor(floor);
  let hp = 0, atk = 0, def = 0;
  for (const id of pool) {
    const e = Enemies.make(id, 5, 5, { noElite: true });
    hp += e.maxHp; atk += e.atk; def += e.def;
  }
  return { hp: hp / pool.length, atk: atk / pool.length, def: def / pool.length };
}

console.log('   piętro poz.  atak    HP panc. │ wróg HP atak │   TTK    TTD  przewaga');
console.log('   ' + '─'.repeat(70));
const przewagi = [];
for (const floor of [1, 3, 5, 8, 11, 14, 16]) {
  const p = referencePlayer('warrior', floor);
  const e = avgEnemy(floor);
  const d = p.d;
  const critMult = 1 + d.crit * (d.critDmg - 1);
  const perHit = d.atk * critMult * (1 - e.def / (e.def + BAL.defK));
  const dps = perHit / (ClassDB.warrior.attack.cd * (1 - d.cdr * .5));
  const ttk = e.hp / dps;
  const eHit = e.atk * (1 - d.def / (d.def + BAL.defK)) * (1 - d.dodge);
  const ttd = d.maxHp / (eHit / 0.95);
  const ratio = ttd / ttk;
  przewagi.push(ratio);
  const flag = ratio > CELE.przewaga[1] ? ' ⬆' : ratio < CELE.przewaga[0] ? ' ⬇' : ' ✓';
  console.log('   ' + String(floor).padStart(5) + String(p.level).padStart(5) +
    String(Math.round(d.atk)).padStart(6) + String(d.maxHp).padStart(6) +
    String(Math.round(d.def)).padStart(6) + ' │' + String(Math.round(e.hp)).padStart(8) +
    String(Math.round(e.atk)).padStart(5) + ' │' + (ttk.toFixed(1) + 's').padStart(7) +
    (ttd.toFixed(0) + 's').padStart(7) + (ratio.toFixed(1) + '×').padStart(9) + flag);
}
const sredniaPrzewaga = przewagi.reduce((a, b) => a + b, 0) / przewagi.length;
console.log('\n   Średnia przewaga: ' + sredniaPrzewaga.toFixed(1) + '×   ' + bar(sredniaPrzewaga, CELE.przewaga));

// =====================================================================
console.log('\n═══ 3. ZAGROŻENIA TERENU ═══\n');
Game.s = Game.newRunState('warrior');
for (const floor of [3, 6, 10, 14]) {
  Game.loadFloor(floor);
  const map = Game.s.map;
  let n = 0;
  for (let i = 0; i < map.t.length; i++) {
    if ([TILE.LAVA, TILE.SPIKES, TILE.POISON, TILE.ICE, TILE.VOID].includes(map.t[i])) n++;
  }
  const careful = Game.s.enemies.filter(e => e.hazardCare).length;
  console.log('   piętro ' + String(floor).padStart(2) + ' (' + map.biome.name.padEnd(22) + ') — ' +
    String(n).padStart(3) + ' kafli zagrożeń, ostrożnych wrogów: ' +
    Math.round(careful / Math.max(1, Game.s.enemies.length) * 100) + '%');
}
// ile HP traci wróg na przejściu przez 3 kratki lawy
Game.s.floor = 10;
const probe = Enemies.make('hellhound', 5, 5, { noElite: true });
const tiles = 3, speed = probe.speed;
const seconds = tiles / speed;
const ticks = seconds / BAL.enemyHazardTick;
const perTick = BAL.enemyLavaFlat + probe.maxHp * BAL.enemyLavaPct;
console.log('\n   Przejście Ogara przez 3 kratki lawy: ' + Math.round(ticks * perTick) +
  ' obrażeń (' + Math.round(ticks * perTick / probe.maxHp * 100) + '% jego puli HP)');
console.log('   Odsetek wrogów omijających zagrożenia: ' + Math.round(BAL.enemyHazardAvoid * 100) + '%');
console.log('');
