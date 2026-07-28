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
  })`, ctx, { filename: 'api-eksport' });
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
  // Ile grup po 5 wrogów gracz wyczyści bez leczenia. To lepsza miara niż
  // „jeden wróg kontra stojący gracz", bo gra polega na walce z grupami —
  // tamten wskaźnik nigdy nie zszedłby do sensownych wartości i tylko mylił.
  grupyDoSmierci: [1.5, 3],
  // Na piętrze bywa 15-34 wrogów, więc szybkie ubijanie pojedynczej sztuki
  // jest zamierzone — dłuższe TTK zmieniłoby walkę w mielenie gąbek.
  ttkSekundy: [.5, 1.5],
};

const PACK = 5;                 // ilu wrogów liczymy w grupie
const ATAKUJACYCH = 2.5;        // ilu średnio dosięga gracza naraz
// Gracz nie wali wyłącznie podstawowym atakiem — wplata umiejętności,
// które biją mocniej. Bez tej poprawki model zaniżałby jego siłę.
const UMIEJETNOSCI = 1.7;

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
      // uwaga: rzadkości nagród bierzemy z ItemDB, czyli dokładnie z tego,
      // czego używa gra — inaczej sonda mierzyłaby własną fikcję
      if (f >= 2 && U.chance(BAL.challengeChance)) {
        add('areny', ItemDB.rollEquip(f, { rarity: ItemDB.arenaRewardRarity(), luck: 1 }));
      }
      if ([3, 6, 9, 12, 15, 16].includes(f)) {
        const bossId = EnemyDB.bossFor(f);
        const def = bossId && EnemyDB.bosses[bossId];
        const final = f === 16;
        if (def && def.legendary && (final || U.chance(BAL.bossRelicChance))) {
          add('bossowie', ItemDB.makeLegendById(def.legendary, f));
        } else {
          add('bossowie', ItemDB.rollEquip(f, { rarity: ItemDB.bossRewardRarity() }));
        }
      }
      if ([2, 5, 8, 11, 14].includes(f)) {
        add('sklep-perełka', ItemDB.rollEquip(f, { rarity: ItemDB.shopFeaturedRarity() }));
        if (f >= 11) add('spod-lady', ItemDB.rollEquip(f, { rarity: ItemDB.underCounterRarity() }));
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
console.log('   TTK   = sekundy na zabicie przeciętnego wroga (cel ' + CELE.ttkSekundy.join('-') + ' s)');
console.log('   grupy = ile grup po ' + PACK + ' wrogów gracz wyczyści bez leczenia');
console.log('           (cel ' + CELE.grupyDoSmierci.join('-') + '; zakładamy, że ' + ATAKUJACYCH + ' wrogów dosięga naraz)\n');

function referencePlayer(cls, floor) {
  Game.s = Game.newRunState(cls);
  const p = Game.s.p;
  Game.s.floor = floor;
  p.level = Math.max(1, Math.round(1 + floor * 1.15));
  const picks = ['strength', 'vitality', 'precision', 'brutality', 'armor'];
  for (let i = 0; i < p.level - 1; i++) {
    const t = picks[i % picks.length];
    p.talents[t] = (p.talents[t] || 0) + 1;
  }
  // Ekwipunek modelujemy tak, jak realnie wygląda: gracz zakłada najlepsze
  // z tego, co wypadło. Losujemy kilka sztuk na slot zwykłą krzywą rzadkości
  // i zostawiamy najlepszą — bez tego model zakładałby epiki na każdym slocie,
  // czego po przebudowie ekonomii łupów już nie ma.
  const rank = { common: 0, magic: 1, rare: 2, epic: 3, set: 3, legend: 4 };
  // na pierwszych piętrach gracz ma dopiero pojedyncze części — pełny komplet
  // dopiero ok. 10. piętra
  const slots = ['weapon', 'helmet', 'armor', 'boots', 'amulet', 'ring']
    .slice(0, U.clamp(Math.round(floor * .7), 1, 6));
  for (const slot of slots) {
    let best = null;
    for (let i = 0; i < 4; i++) {
      const cand = ItemDB.rollEquip(floor, { slot });
      if (!best || rank[cand.rarity] > rank[best.rarity]) best = cand;
    }
    best.plus = Math.min(BAL.upgradeMax, Math.floor(floor / 2.5));
    p.equip[slot] = best;
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

console.log('   piętro poz.  atak    HP panc. │ wróg HP atak │   TTK   cios  grupy');
console.log('   ' + '─'.repeat(68));
const grupy = [], ttki = [];
const PROBEK = 12;              // uśredniamy, bo sprzęt bohatera jest losowany
for (const floor of [1, 3, 5, 8, 11, 14, 16]) {
  const e = avgEnemy(floor);
  let ttk = 0, packs = 0, lvl = 0, atk = 0, maxHp = 0, def = 0, eHit = 0;
  for (let i = 0; i < PROBEK; i++) {
    const p = referencePlayer('warrior', floor);
    const d = p.d;
    const critMult = 1 + d.crit * (d.critDmg - 1);
    const perHit = d.atk * critMult * (1 - e.def / (e.def + BAL.defK));
    const dps = perHit / (ClassDB.warrior.attack.cd * (1 - d.cdr * .5)) * UMIEJETNOSCI;
    const t = e.hp / dps;
    // ile obrywa gracz, zanim wybije grupę
    const hit = e.atk * (1 - d.def / (d.def + BAL.defK)) * (1 - d.dodge);
    const packDmg = ATAKUJACYCH * (hit / 0.95) * (t * PACK);
    ttk += t / PROBEK; packs += (d.maxHp / packDmg) / PROBEK;
    lvl = p.level; atk += d.atk / PROBEK; maxHp += d.maxHp / PROBEK;
    def += d.def / PROBEK; eHit += hit / PROBEK;
  }
  const p = { level: lvl };
  const d = { atk, maxHp, def };
  grupy.push(packs); ttki.push(ttk);
  const flag = packs > CELE.grupyDoSmierci[1] ? ' ⬆' : packs < CELE.grupyDoSmierci[0] ? ' ⬇' : ' ✓';
  console.log('   ' + String(floor).padStart(5) + String(p.level).padStart(5) +
    String(Math.round(d.atk)).padStart(6) + String(Math.round(d.maxHp)).padStart(6) +
    String(Math.round(d.def)).padStart(6) + ' │' + String(Math.round(e.hp)).padStart(8) +
    String(Math.round(e.atk)).padStart(5) + ' │' + (ttk.toFixed(1) + 's').padStart(7) +
    (Math.round(eHit) + '').padStart(6) + (packs.toFixed(1)).padStart(7) + flag);
}
const avg = a => a.reduce((x, y) => x + y, 0) / a.length;
console.log('\n   Średnie TTK: ' + avg(ttki).toFixed(1) + ' s   ' + bar(avg(ttki), CELE.ttkSekundy));
console.log('   Średnio grup do śmierci: ' + avg(grupy).toFixed(1) + '   ' + bar(avg(grupy), CELE.grupyDoSmierci));

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

// =====================================================================
console.log('\n═══ 4. UNIKI PRZECIWNIKÓW ═══');
console.log('   Ile pocisków gracza dosięga celu (im niżej, tym więcej uników)\n');

function hitRate(typeId, floor, elite) {
  const Combat = G.Combat;
  Game.s = Game.newRunState('hunter');
  Game.loadFloor(floor);
  const s = Game.s, p = s.p;
  // wykarczowana arena, żeby pociski nie ginęły na ścianach
  for (let x = 19; x <= 45; x++) for (let y = 17; y <= 33; y++) Dungeon.set(s.map, x, y, TILE.FLOOR);
  p.x = 21; p.y = 25;
  let hits = 0; const shots = 300;
  for (let i = 0; i < shots; i++) {
    s.enemies.length = 0; s.projectiles.length = 0;
    const e = Enemies.make(typeId, p.x + 6, p.y, elite ? { elite: 'swift' } : { noElite: true });
    e.baseSpeed = 0; e.speed = 0; e.aggro = false;
    e.hp = e.maxHp = 1e6; e.dodgeCd = 0;
    s.enemies.push(e);
    const hp0 = e.hp;
    Combat.spawnProjectile({ x: p.x, y: p.y, ang: 0, speed: 12, size: .18,
      flat: 10, element: 'phys', color: '#fff', friendly: true, range: 16 });
    for (let f = 0; f < 90 && s.projectiles.length; f++) {
      Enemies.update(1 / 60);
      Combat.updateProjectiles(1 / 60);
    }
    if (e.hp < hp0) hits++;
  }
  return hits / shots;
}

console.log('   cel                     piętro 3   piętro 10   piętro 16');
for (const [label, typeId] of [['Śnieżny Wilk (zwinny)', 'snow_wolf'], ['Golem Magmowy (ociężały)', 'magma_golem']]) {
  const r = [3, 10, 16].map(f => Math.round(hitRate(typeId, f, false) * 100) + '%');
  console.log('   ' + label.padEnd(24) + r.map(x => x.padStart(8)).join('    '));
}
const eliteRate = Math.round(hitRate('snow_wolf', 16, true) * 100);
console.log('   ' + 'Elita (zwinna), piętro 16'.padEnd(24) + (eliteRate + '%').padStart(8));
console.log('\n   Zwinność progiem szybkości: ' + BAL.aiAgileSpeed +
  ' | odnowienie uniku: ' + BAL.aiDodgeCd + 's | sufit szansy: ' + Math.round(BAL.aiDodgeMax * 100) + '%');
console.log('');
