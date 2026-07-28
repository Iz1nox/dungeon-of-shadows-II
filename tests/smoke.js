'use strict';

// =====================================================================
// DUNGEON OF SHADOWS II — testy „na sucho"
//
// Ładuje całą grę w Node (bez canvasa i przeglądarki), po czym sprawdza
// spójność danych, generowanie map i przedmiotów, walkę, umiejętności,
// bossów, sklep, progresję oraz zapis/wczytanie.
//
// Uruchomienie:  node tests/smoke.js
// =====================================================================

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { install } = require('./dom-stub');

const ROOT = path.resolve(__dirname, '..');

// ---------------------------------------------------------------- loader
// Kolejność skryptów bierzemy wprost z index.html, żeby testy nigdy
// nie rozjechały się z tym, co faktycznie ładuje gra.
function gameFiles() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const files = [];
  const re = /<script src="([^"]+)"><\/script>/g;
  let m;
  while ((m = re.exec(html))) {
    const src = m[1].split('?')[0];
    if (src.endsWith('js/game/main.js')) continue; // init podpina DOM i pętlę — pomijamy
    files.push(src);
  }
  return files;
}

function loadGame() {
  const context = vm.createContext({});
  install(context);
  const files = gameFiles();
  for (const f of files) {
    const code = fs.readFileSync(path.join(ROOT, f), 'utf8');
    try {
      vm.runInContext(code, context, { filename: f });
    } catch (e) {
      console.error('BŁĄD ŁADOWANIA ' + f + ': ' + e.message);
      process.exit(1);
    }
  }
  // Deklaracje `const` z <script> żyją w zasięgu leksykalnym kontekstu,
  // a nie na obiekcie globalnym — wyciągamy je jawnie, od środka.
  const api = vm.runInContext(`({
    Game, Player, Combat, Skills, Minions, Enemies, Bosses, Inv, InvUI, ItemTip, Events, Shop,
    Progression, SaveSys, Meta, MetaUI, SettingsUI, Hud, Challenge, Dungeon, FOV, Path, Fx, U,
    Sfx, Music, Touch, Input, Renderer,
    ItemDB, EnemyDB, ClassDB, BiomeDB, TalentDB, AchievementDB, MerchantDB, ChangelogDB,
    PACTS, DIFFICULTY, BAL, TILE, ELEMENTS, WALKABLE,
    GAME_VERSION, FINAL_FLOOR, FOV_RADIUS, SAVE_KEY, SAVE_VERSION, MAP_W, MAP_H,
    localStorage,
  })`, context, { filename: 'api-export' });
  return { context, files, api };
}

// ---------------------------------------------------------------- runner
let passed = 0, failed = 0;
const failures = [];

function group(name) { console.log('\n' + name); }

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('   ✓ ' + name);
  } catch (e) {
    failed++;
    failures.push(name + ' — ' + e.message);
    console.log('   ✗ ' + name);
    console.log('       ' + e.message);
  }
}

function assert(cond, msg) { if (!cond) throw new Error(msg || 'oczekiwano prawdy'); }
function assertEq(a, b, msg) {
  if (a !== b) throw new Error((msg || 'różnica') + ': ' + JSON.stringify(a) + ' ≠ ' + JSON.stringify(b));
}
function assertFinite(v, msg) {
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error((msg || 'wartość') + ' nie jest skończoną liczbą: ' + v);
}

// ---------------------------------------------------------------- start
const { api: G, files } = loadGame();
const { Game, Player, Combat, Skills, Minions, Enemies, Bosses, Inv, InvUI, Events, Shop,
  Progression, SaveSys, Meta, Hud, Challenge, Dungeon, FOV, Path, Fx, U, ItemDB, EnemyDB,
  ClassDB, BiomeDB, TalentDB, AchievementDB, MerchantDB, ChangelogDB, PACTS, DIFFICULTY, BAL, TILE } = G;

Meta.load();

console.log('Dungeon of Shadows II — testy na sucho');
console.log('Wersja ' + G.GAME_VERSION + ', załadowano ' + files.length + ' plików.');

// ---------------------------------------------------------------- pomoce
function newRun(clsId, floor) {
  Meta.data.pacts = [];
  Meta.data.difficulty = 'normal';
  Game.s = Game.newRunState(clsId);
  Game.loadFloor(floor || 1);
  return Game.s;
}

// jedna klatka symulacji — dokładnie to, co robi Game.loop poza rysowaniem
function frame(dt) {
  const s = Game.s;
  s.time += dt;
  Player.update(dt);
  Minions.update(dt);
  Enemies.update(dt);
  Combat.updateProjectiles(dt);
  Combat.updateTelegraphs(dt);
  Combat.updateZones(dt);
  Combat.updateTraps(dt);
  Challenge.update(dt);
  Inv.updateDrops(dt);
  Fx.update(dt);
}

// Symulowany gracz zachowuje się jak człowiek: celuje w najbliższego wroga
// i podchodzi do niego. Bez tego klasy walczące wręcz nigdy nie doszłyby do
// przeciwnika, a test mierzyłby pathfinding zamiast walki.
function steerAndAim() {
  const s = Game.s, p = s.p;
  const keys = G.Game.keys;
  keys['w'] = keys['a'] = keys['s'] = keys['d'] = false;
  let target = null, best = Infinity;
  for (const e of s.enemies) {
    if (e.dead) continue;
    const d = U.dist(p.x, p.y, e.x, e.y);
    if (d < best) { best = d; target = e; }
  }
  if (!target) return null;
  G.Game.mouse.wx = target.x;
  G.Game.mouse.wy = target.y;
  if (best > 1.4) {   // podejdź, jeśli daleko
    const dx = target.x - p.x, dy = target.y - p.y;
    if (dx > .3) keys['d'] = true; else if (dx < -.3) keys['a'] = true;
    if (dy > .3) keys['s'] = true; else if (dy < -.3) keys['w'] = true;
  }
  return target;
}

// Wykarczowana arena o znanych współrzędnych. Testy pocisków i ruchu nie mogą
// zależeć od tego, gdzie generator postawił ściany — inaczej strzał trafia
// w mur i wynik jest przypadkowy.
function carveArena(cx = 32, cy = 25, halfW = 13, halfH = 8) {
  const s = Game.s;
  for (let x = cx - halfW; x <= cx + halfW; x++)
    for (let y = cy - halfH; y <= cy + halfH; y++) Dungeon.set(s.map, x, y, TILE.FLOOR);
  s.p.x = cx - halfW + 2; s.p.y = cy;
  s.enemies.length = 0;
  s.projectiles.length = 0;
  s.telegraphs.length = 0;
  return { cx, cy };
}

// nieruchomy cel: dalej potrafi uskakiwać (uskok ma własną prędkość),
// ale nie wędruje ani nie goni, więc pomiar dotyczy tylko badanego zachowania
function frozenTarget(typeId, x, y) {
  const e = Enemies.make(typeId, x, y, { noElite: true });
  e.baseSpeed = 0; e.speed = 0;
  e.aggro = false;
  Game.s.enemies.push(e);
  return e;
}

// dosypuje wrogów w pobliżu gracza, żeby walka faktycznie się zaczęła
function spawnNearPlayer(n) {
  const s = Game.s, p = s.p;
  const pool = EnemyDB.poolFor(s.floor);
  for (let i = 0; i < n; i++) {
    const spot = Dungeon.freeSpotNear(s.map, p.x, p.y, 5);
    const e = Enemies.make(U.choice(pool), spot.x, spot.y, { noElite: i % 4 !== 0 });
    e.aggro = true;
    s.enemies.push(e);
  }
}

function simulate(frames, opts = {}) {
  const dt = 1 / 60;
  const s = Game.s, p = s.p;
  for (let i = 0; i < frames; i++) {
    if (opts.keepAlive && p.hp < p.d.maxHp * .5) p.hp = p.d.maxHp;
    if (opts.chase) steerAndAim();
    if (opts.attack) G.Game.mouse.down = true;
    if (opts.castEvery && i % opts.castEvery === 0) {
      const idx = (i / opts.castEvery) % 5 | 0;
      p.mp = p.d.maxMp;
      p.skills[idx].cdT = 0;
      Skills.cast(idx);
    }
    // dosyp przeciwników, gdy pole bitwy opustoszeje
    if (opts.chase && i % 240 === 0 && s.enemies.filter(e => !e.dead).length < 3) spawnNearPlayer(6);
    frame(dt);
    if (i % 20 === 0) { FOV.update(s.map, p.x, p.y, G.FOV_RADIUS); Path.compute(s.map, p.x, p.y); }
    if (i % 100 === 0) checkInvariants('klatka ' + i);
    if (s.over) break;
  }
  G.Game.mouse.down = false;
  G.Game.keys['w'] = G.Game.keys['a'] = G.Game.keys['s'] = G.Game.keys['d'] = false;
}

function checkInvariants(label) {
  const s = Game.s, p = s.p;
  assertFinite(p.hp, label + ' — HP gracza');
  assertFinite(p.mp, label + ' — MP gracza');
  assertFinite(p.x, label + ' — X gracza');
  assertFinite(p.y, label + ' — Y gracza');
  assertFinite(p.d.atk, label + ' — atak gracza');
  assertFinite(p.d.maxHp, label + ' — maks. HP');
  assert(p.hp <= p.d.maxHp + .001, label + ' — HP ponad maksimum (' + p.hp + '/' + p.d.maxHp + ')');
  assert(p.hp >= 0, label + ' — ujemne HP: ' + p.hp);
  assert(p.x >= 0 && p.x < s.map.w, label + ' — gracz poza mapą (x=' + p.x + ')');
  assert(p.y >= 0 && p.y < s.map.h, label + ' — gracz poza mapą (y=' + p.y + ')');
  assert(s.enemies.length < 500, label + ' — eksplozja liczby wrogów: ' + s.enemies.length);
  assert(s.projectiles.length < 2000, label + ' — eksplozja liczby pocisków: ' + s.projectiles.length);
  assert(Fx.parts.length <= 1000, label + ' — eksplozja cząsteczek: ' + Fx.parts.length);
  for (const e of s.enemies) {
    assertFinite(e.hp, label + ' — HP wroga ' + e.name);
    assertFinite(e.x, label + ' — X wroga ' + e.name);
    assertFinite(e.y, label + ' — Y wroga ' + e.name);
  }
  for (const pr of s.projectiles) {
    assertFinite(pr.x, label + ' — X pocisku');
    assertFinite(pr.y, label + ' — Y pocisku');
  }
}

// =====================================================================
group('Dane statyczne');

test('każda klasa ma komplet pól i 5 umiejętności', () => {
  const ids = Object.keys(ClassDB);
  assertEq(ids.length, 6, 'liczba klas');
  for (const id of ids) {
    const c = ClassDB[id];
    assertEq(c.id, id, 'id klasy ' + id);
    assert(c.name && c.icon && c.desc, id + ': brak nazwy/ikony/opisu');
    for (const k of ['hp', 'mp', 'atk', 'def', 'speed', 'crit']) {
      assertFinite(c.stats[k], id + ': statystyka ' + k);
    }
    assertEq(c.skills.length, 5, id + ': liczba umiejętności');
    assert(c.skills.filter(s => s.ult).length === 1, id + ': dokładnie jedna ulta');
    for (const sk of c.skills) {
      assert(sk.id && sk.name && sk.icon && sk.type, id + ': niepełna umiejętność ' + sk.name);
      assertFinite(sk.mp, id + '/' + sk.name + ': koszt many');
      assertFinite(sk.cd, id + '/' + sk.name + ': odnowienie');
      assert(sk.desc && sk.desc.length > 5, id + '/' + sk.name + ': brak opisu');
    }
  }
});

test('wrogowie mają wymagane pola i poprawne żywioły', () => {
  const ids = Object.keys(EnemyDB.types);
  assert(ids.length > 30, 'zbyt mało typów wrogów: ' + ids.length);
  for (const id of ids) {
    const e = EnemyDB.types[id];
    assert(e.name && e.icon && e.color, id + ': brak nazwy/ikony/koloru');
    for (const k of ['hp', 'atk', 'def', 'xp', 'gold', 'speed']) assertFinite(e[k], id + ': ' + k);
    assert(e.ai, id + ': brak AI');
    if (e.element) assert(G.ELEMENTS[e.element], id + ': nieznany żywioł ' + e.element);
    if (e.summonType) assert(EnemyDB.types[e.summonType], id + ': przyzywa nieistniejący typ ' + e.summonType);
    if (e.splitInto) assert(EnemyDB.types[e.splitInto], id + ': dzieli się na nieistniejący typ ' + e.splitInto);
  }
});

test('bossowie wskazują istniejące relikwie i sługi', () => {
  const ids = Object.keys(EnemyDB.bosses);
  assertEq(ids.length, 6, 'liczba bossów');
  for (const id of ids) {
    const b = EnemyDB.bosses[id];
    assert(b.name && b.icon && b.taunt, id + ': brak nazwy/ikony/kwestii');
    assert(Array.isArray(b.abilities) && b.abilities.length, id + ': brak umiejętności');
    if (b.summonType) assert(EnemyDB.types[b.summonType], id + ': przyzywa nieistniejący typ');
    assert(b.legendary, id + ': brak przypisanej relikwii');
    const leg = ItemDB.legends.find(l => l.id === b.legendary);
    assert(leg, id + ': relikwia ' + b.legendary + ' nie istnieje');
    assert(leg.bossOnly, id + ': relikwia ' + b.legendary + ' powinna być bossOnly');
  }
});

test('pule biomów odwołują się do istniejących wrogów', () => {
  for (const b of BiomeDB.list) {
    assert(b.pool.length, b.id + ': pusta pula');
    for (const id of b.pool) assert(EnemyDB.types[id], b.id + ': nieznany wróg ' + id);
    if (b.boss) assert(EnemyDB.bosses[b.boss], b.id + ': nieznany boss ' + b.boss);
    assert(b.pal && b.pal.wall && b.pal.floor, b.id + ': niepełna paleta');
  }
});

test('osiągnięcia, pakty i changelog są spójne', () => {
  const ids = AchievementDB.list.map(a => a.id);
  assertEq(new Set(ids).size, ids.length, 'duplikaty identyfikatorów osiągnięć');
  for (const a of AchievementDB.list) assert(a.name && a.desc && a.icon, a.id + ': niepełne osiągnięcie');
  for (const k in PACTS) {
    const p = PACTS[k];
    assertEq(p.id, k, 'id paktu');
    assert(p.name && p.short && p.desc && p.icon, k + ': niepełny pakt');
    assertFinite(p.essence, k + ': mnożnik esencji');
  }
  assert(ChangelogDB.length > 0, 'pusty changelog');
  assertEq(ChangelogDB[0].v, G.GAME_VERSION, 'najnowszy wpis changelogu ≠ GAME_VERSION');
  for (const c of ChangelogDB) {
    assert(/^\d{2}\.\d{2}\.\d{4}$/.test(c.date), c.v + ': zła data „' + c.date + '"');
    assert(c.items && c.items.length, c.v + ': brak pozycji');
  }
});

test('progi zaufania handlarza rosną monotonicznie', () => {
  let lastAt = -1, lastDisc = -1;
  for (const t of MerchantDB.tiers) {
    assert(t.at > lastAt, 'próg ' + t.name + ' nie rośnie');
    assert(t.discount >= lastDisc, 'zniżka ' + t.name + ' nie rośnie');
    assert(t.discount < .5, 'zniżka ' + t.name + ' zbyt duża');
    lastAt = t.at; lastDisc = t.discount;
  }
  assertEq(MerchantDB.greetings.length, MerchantDB.tiers.length, 'kwestie ≠ progi');
  for (const b of BiomeDB.list) assert(MerchantDB.biomeLines[b.id], 'brak kwestii dla biomu ' + b.id);
});

// =====================================================================
group('Generowanie lochów');

test('piętra 1–20 generują się poprawnie', () => {
  Game.s = Game.newRunState('warrior');
  for (let f = 1; f <= 20; f++) {
    Game.s.floor = f;
    const map = Dungeon.generate(f);
    assert(map.rooms.length > 0, 'piętro ' + f + ': brak pokoi');
    assert(map.spawn, 'piętro ' + f + ': brak punktu startowego');
    assert(Dungeon.walkable(map, map.spawn.x | 0, map.spawn.y | 0), 'piętro ' + f + ': start w ścianie');
    assertFinite(map.spawn.x, 'piętro ' + f + ': X startu');
    assert(map.t.length === map.w * map.h, 'piętro ' + f + ': zły rozmiar siatki');
    const hasFloor = Array.from(map.t).some(t => t === TILE.FLOOR);
    assert(hasFloor, 'piętro ' + f + ': brak podłogi');
  }
});

test('piętra bossów blokują schody, zwykłe je udostępniają', () => {
  for (const f of [3, 6, 9, 12, 15]) {
    Game.s.floor = f;
    const map = Dungeon.generate(f);
    assert(map.stairsLocked, 'piętro ' + f + ': schody powinny być zablokowane');
  }
  for (const f of [2, 4, 5, 7]) {
    Game.s.floor = f;
    const map = Dungeon.generate(f);
    assert(!map.stairsLocked, 'piętro ' + f + ': schody nie powinny być zablokowane');
    assertEq(Dungeon.tile(map, map.stairs.x, map.stairs.y), TILE.STAIRS, 'piętro ' + f + ': brak kafla schodów');
  }
});

test('Pakt Nędzy usuwa sklepy, brak paktu je zostawia', () => {
  Game.s.pacts = [];
  let withShop = 0;
  for (let i = 0; i < 12; i++) { Game.s.floor = 5; if (Dungeon.generate(5).shopPos) withShop++; }
  assertEq(withShop, 12, 'sklep powinien być na każdym piętrze sklepowym');
  Game.s.pacts = ['poverty'];
  let poverty = 0;
  for (let i = 0; i < 12; i++) { Game.s.floor = 5; if (Dungeon.generate(5).shopPos) poverty++; }
  assertEq(poverty, 0, 'Pakt Nędzy nie usunął sklepów');
  Game.s.pacts = [];
});

// =====================================================================
group('Przedmioty');

test('2000 losowych przedmiotów jest poprawnych', () => {
  for (let i = 0; i < 2000; i++) {
    const floor = U.randi(1, 20);
    const it = ItemDB.rollAny(floor, U.randi(0, 3));
    assert(it.uid > 0, 'brak uid');
    assert(it.name && it.icon, 'brak nazwy/ikony');
    assert(ItemDB.rarities[it.rarity], 'nieznana rzadkość ' + it.rarity);
    assertFinite(ItemDB.price(it), 'cena ' + it.name);
    assert(ItemDB.price(it) > 0, 'niedodatnia cena ' + it.name);
    if (it.kind === 'equip') {
      assert(ItemDB.bases[it.slot], 'nieznany slot ' + it.slot);
      for (const k in it.stats) assertFinite(it.stats[k], it.name + ': statystyka ' + k);
      for (const a of it.affixes) {
        assert(ItemDB.affixes[a.id], it.name + ': nieznany afiks ' + a.id);
        assertFinite(a.val, it.name + ': wartość afiksu ' + a.id);
      }
      assertFinite(ItemDB.salvageValue(it), 'wartość przetopu ' + it.name);
    } else {
      assert(ItemDB.consumables[it.cid], 'nieznany konsument ' + it.cid);
    }
  }
});

test('relikwie bossów nie wypadają z losowych źródeł', () => {
  const bossOnly = ItemDB.legends.filter(l => l.bossOnly).map(l => l.id);
  assert(bossOnly.length === 6, 'oczekiwano 6 relikwii, jest ' + bossOnly.length);
  for (let i = 0; i < 3000; i++) {
    const it = ItemDB.rollEquip(U.randi(10, 20), { rarity: 'legend', luck: 3 });
    assert(!bossOnly.includes(it.legendId), 'relikwia ' + it.legendId + ' wyciekła do losowego dropu');
  }
  for (const id of bossOnly) {
    const it = ItemDB.makeLegendById(id, 12);
    assert(it && it.rarity === 'legend', 'nie można wytworzyć relikwii ' + id);
  }
});

test('części zestawów mają poprawny zestaw i slot', () => {
  for (const sid in ItemDB.sets) {
    const set = ItemDB.sets[sid];
    assert(set.bonus2 && set.bonus4, sid + ': brak bonusów 2/4');
    for (const slot in set.pieces) {
      const it = ItemDB.makeSetPiece(8, sid, slot);
      assertEq(it.setId, sid, 'setId części');
      assertEq(it.slot, slot, 'slot części');
      assertEq(it.rarity, 'set', 'rzadkość części');
      assert(ItemDB.bases[slot], sid + ': nieznany slot ' + slot);
    }
  }
});

test('nazwy odmieniają się przez rodzaj', () => {
  assertEq(ItemDB.declense('Pradawny', 'm'), 'Pradawny');
  assertEq(ItemDB.declense('Pradawny', 'f'), 'Pradawna');
  assertEq(ItemDB.declense('Pradawny', 'p'), 'Pradawne');
  assertEq(ItemDB.declense('Królewski', 'f'), 'Królewska');
  assertEq(ItemDB.declense('Królewski', 'p'), 'Królewskie');
  assertEq(ItemDB.declense('Smoczy', 'f'), 'Smocza');
  assertEq(ItemDB.declense('Smoczy', 'p'), 'Smocze');
  // każda baza ma zadeklarowany rodzaj
  for (const slot in ItemDB.bases) {
    for (const b of ItemDB.bases[slot]) {
      assert(['m', 'f', 'p'].includes(b.g), slot + '/' + b.id + ': brak rodzaju gramatycznego');
    }
  }
});

// =====================================================================
group('Walka i symulacja');

for (const clsId of Object.keys(ClassDB)) {
  test('klasa „' + ClassDB[clsId].name + '" przeżywa 1200 klatek walki', () => {
    const s = newRun(clsId, 6);
    const p = s.p;
    // bohater adekwatny do 6. piętra — postać z 1. poziomu bez sprzętu
    // nie zdążyłaby nikogo ubić i test mierzyłby nie to, co trzeba
    Progression.gainXp(3000);
    p.talentPoints = 0;
    for (const slot of ['weapon', 'armor', 'helmet']) {
      p.equip[slot] = ItemDB.rollEquip(6, { slot, rarity: 'rare' });
    }
    Player.recalc(p);
    p.hp = p.d.maxHp; p.mp = p.d.maxMp;
    for (const e of s.enemies) e.aggro = true;
    spawnNearPlayer(8);
    simulate(1200, { keepAlive: true, attack: true, castEvery: 45, chase: true });
    checkInvariants('koniec ' + clsId);
    assert(s.runStats.dmgDealt > 0, 'gracz nie zadał żadnych obrażeń');
    assert(s.runStats.kills > 0, 'gracz nikogo nie zabił przez 20 sekund walki');
  });
}

test('obrażenia zawsze ≥ 1 i wróg ginie od dużego ciosu', () => {
  const s = newRun('warrior', 5);
  const e = Enemies.make('moss_golem', s.p.x + 3, s.p.y, { noElite: true });
  s.enemies.push(e);
  const dealt = Combat.dealToEnemy(e, 0.0001, { element: 'phys' });
  assert(dealt >= 1, 'minimalne obrażenia poniżej 1: ' + dealt);
  Combat.dealToEnemy(e, 1e9, { element: 'phys' });
  assert(e.dead, 'wróg nie zginął po ogromnych obrażeniach');
});

test('gracz otrzymuje obrażenia i klatki nietykalności działają', () => {
  const s = newRun('warrior', 4);
  const p = s.p;
  p.iframesT = 0;
  const before = p.hp;
  Combat.hitPlayer(30, { element: 'phys', ignoreDodge: true });
  assert(p.hp < before, 'gracz nie stracił HP');
  const mid = p.hp;
  p.iframesT = 1;
  Combat.hitPlayer(30, { element: 'phys', ignoreDodge: true });
  assertEq(p.hp, mid, 'obrażenia przeszły przez nietykalność');
});

test('statusy nakładają się, tykają i wygasają', () => {
  const s = newRun('mage', 5);
  const e = Enemies.make('grave_rat', s.p.x + 4, s.p.y, { noElite: true });
  e.hp = e.maxHp = 10000;
  s.enemies.push(e);
  Combat.applyStatus(e, 'burn', 3);
  assert(e.statuses.burn, 'brak podpalenia');
  const hp0 = e.hp;
  for (let i = 0; i < 60; i++) Combat.updateStatuses(e, 1 / 60);
  assert(e.hp < hp0, 'podpalenie nie zadało obrażeń');
  for (let i = 0; i < 300; i++) Combat.updateStatuses(e, 1 / 60);
  assert(!e.statuses.burn, 'podpalenie nie wygasło');
  // trucizna kumuluje się do limitu
  for (let i = 0; i < 10; i++) Combat.applyStatus(e, 'poison', 5);
  assertEq(e.statuses.poison.stacks, BAL.poisonMaxStacks, 'limit kumulacji trucizny');
});

test('zwinni wrogowie uskakują przed pociskami, ociężali nie', () => {
  const s = newRun('hunter', 12);
  const p = s.p;
  // trafialność: strzelamy wprost we wroga i liczymy, ile pocisków dosięgło
  const hitRate = (typeId) => {
    let hits = 0; const shots = 60;
    for (let i = 0; i < shots; i++) {
      carveArena();
      const e = frozenTarget(typeId, p.x + 6, p.y);
      e.hp = e.maxHp = 1e6;
      e.dodgeCd = 0;
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
  };
  const agile = hitRate('snow_wolf');       // szybkość 3.3 → uskakuje
  const heavy = hitRate('magma_golem');     // szybkość 1.1 → nie potrafi
  assertEq(Enemies.agile(Enemies.make('magma_golem', 5, 5, { noElite: true })), false,
    'golem nie powinien być uznany za zwinnego');
  assert(heavy > .9, 'ociężały wróg powinien obrywać niemal zawsze (trafień ' + (heavy * 100).toFixed(0) + '%)');
  assert(agile < heavy - .1, 'zwinny wróg nie uskakuje (trafień ' + (agile * 100).toFixed(0) +
    '% vs ' + (heavy * 100).toFixed(0) + '%)');
});

test('uskoki mają odnowienie — seria pocisków i tak dosięga', () => {
  const s = newRun('rogue', 12);
  const p = s.p;
  carveArena();
  const e = frozenTarget('snow_wolf', p.x + 6, p.y);
  e.hp = e.maxHp = 1e6;
  e.dodgeCd = 0;
  let hits = 0;
  for (let i = 0; i < 10; i++) {
    const hp0 = e.hp;
    Combat.spawnProjectile({ x: p.x, y: e.y, ang: U.angle(p.x, e.y, e.x, e.y), speed: 12, size: .18,
      flat: 10, element: 'phys', color: '#fff', friendly: true, range: 16 });
    for (let f = 0; f < 45; f++) { Enemies.update(1 / 60); Combat.updateProjectiles(1 / 60); }
    if (e.hp < hp0) hits++;
  }
  assert(hits >= 3, 'przy serii 10 pocisków wróg uniknął niemal wszystkich (trafień: ' + hits + ')');
});

test('wrogowie rozpychają się zamiast zlepiać w jeden punkt', () => {
  const s = newRun('warrior', 8);
  carveArena();
  const cx = s.p.x + 6, cy = s.p.y;
  // wszyscy dokładnie w jednym punkcie — najtrudniejszy przypadek
  for (let i = 0; i < 10; i++) frozenTarget('skeleton_warrior', cx, cy);
  const spread = () => {
    let maxD = 0;
    for (const a of s.enemies) for (const b of s.enemies) maxD = Math.max(maxD, U.dist(a.x, a.y, b.x, b.y));
    return maxD;
  };
  const before = spread();
  for (let f = 0; f < 120; f++) Enemies.update(1 / 60);
  const after = spread();
  assert(after > before + .5, 'tłum się nie rozproszył (' + before.toFixed(2) + ' → ' + after.toFixed(2) + ')');
});

test('wrogowie schodzą z zapowiedzianego uderzenia gracza', () => {
  const s = newRun('mage', 10);
  carveArena();
  const tx = s.p.x + 5, ty = s.p.y;
  // wróg dokładnie w epicentrum — wektor ucieczki musi mieć fallback
  const e = frozenTarget('snow_wolf', tx, ty);
  Combat.addTelegraph({ x: tx, y: ty, r: 2.5, delay: 3, dmg: 50, friendly: true, element: 'fire' });
  const d0 = U.dist(e.x, e.y, tx, ty);
  for (let f = 0; f < 100; f++) Enemies.update(1 / 60);
  const d1 = U.dist(e.x, e.y, tx, ty);
  assert(d1 > d0 + 1, 'wróg nie uciekł ze strefy uderzenia (' + d0.toFixed(2) + ' → ' + d1.toFixed(2) + ')');
});

test('ścigający okrążają gracza w zwarciu', () => {
  const s = newRun('warrior', 8);
  carveArena();
  const p = s.p;
  const e = Enemies.make('skeleton_warrior', p.x + 2.2, p.y, { noElite: true });
  s.enemies.push(e);
  e.aggro = true;
  e.attackCdT = 999;                     // nie atakuje, żeby mierzyć sam ruch
  e.meleeCd = 999;
  s.enemies.push(e);
  const a0 = U.angle(p.x, p.y, e.x, e.y);
  let maxSwing = 0;
  for (let f = 0; f < 180; f++) {
    Enemies.update(1 / 60);
    maxSwing = Math.max(maxSwing, Math.abs(U.angDiff(a0, U.angle(p.x, p.y, e.x, e.y))));
  }
  assert(maxSwing > .3, 'wróg nie okrążał gracza (przesunięcie kątowe ' + maxSwing.toFixed(2) + ' rad)');
});

test('zagrożenia terenu ranią wrogów', () => {
  const s = newRun('warrior', 10);
  const p = s.p;
  s.enemies.length = 0;
  const cases = [
    [TILE.LAVA, 'lawa'], [TILE.SPIKES, 'kolce'], [TILE.VOID, 'pustka'],
  ];
  for (const [tile, label] of cases) {
    const x = (p.x | 0) + 4, y = p.y | 0;
    Dungeon.set(s.map, x, y, tile);
    const e = Enemies.make('magma_golem', x + .5, y + .5, { noElite: true });
    e.speed = 0;                    // stoi w miejscu, żeby zmierzyć samo zagrożenie
    e.baseSpeed = 0;
    s.enemies.push(e);
    const hp0 = e.hp;
    for (let i = 0; i < 120; i++) Enemies.tileHazards(e, 1 / 60);
    assert(e.hp < hp0, label + ' nie zraniła wroga');
    Dungeon.set(s.map, x, y, TILE.FLOOR);
  }
  // trucizna i lód nakładają statusy zamiast obrażeń
  const x = (p.x | 0) + 5, y = p.y | 0;
  Dungeon.set(s.map, x, y, TILE.POISON);
  const e2 = Enemies.make('snow_wolf', x + .5, y + .5, { noElite: true });
  e2.speed = 0; e2.baseSpeed = 0;
  for (let i = 0; i < 120; i++) Enemies.tileHazards(e2, 1 / 60);
  assert(e2.statuses.poison, 'kałuża jadu nie zatruła wroga');
  Dungeon.set(s.map, x, y, TILE.FLOOR);
});

test('lawa parzy proporcjonalnie do wielkości, a odporni cierpią mniej', () => {
  const s = newRun('warrior', 10);
  const measure = (typeId) => {
    const x = (s.p.x | 0) + 4, y = s.p.y | 0;
    Dungeon.set(s.map, x, y, TILE.LAVA);
    const e = Enemies.make(typeId, x + .5, y + .5, { noElite: true });
    e.speed = 0; e.baseSpeed = 0;
    const hp0 = e.hp;
    for (let i = 0; i < 180; i++) Enemies.tileHazards(e, 1 / 60);
    Dungeon.set(s.map, x, y, TILE.FLOOR);
    return (hp0 - e.hp) / hp0;      // ułamek puli HP
  };
  // składnik procentowy sprawia, że lawa boli też grubasów
  const small = measure('grave_rat');
  const bigNeutral = measure('crystal_sentinel');   // 300 HP, bez odporności na ogień
  assert(small > 0, 'lawa nie zraniła małego wroga');
  assert(bigNeutral > .07, 'lawa niemal nie rusza dużego wroga (' + (bigNeutral * 100).toFixed(1) + '% HP)');
  // ...ale odporność na ogień nadal ma znaczenie
  const fireProof = measure('magma_golem');         // resist.fire = .2
  assert(fireProof < bigNeutral, 'odporność na ogień nie chroni przed lawą');
});

test('rozważni wrogowie omijają ogień, nierozważni brną przez niego', () => {
  const s = newRun('warrior', 10);
  s.enemies.length = 0;
  // własna arena testowa o znanych współrzędnych — nie zdajemy się na układ mapy
  const Y = 25, X0 = 12;
  for (let dx = 0; dx <= 16; dx++)
    for (let dy = -5; dy <= 5; dy++) Dungeon.set(s.map, X0 + dx, Y + dy, TILE.FLOOR);
  for (let dx = 4; dx <= 7; dx++)
    for (let dy = -5; dy <= 5; dy++) Dungeon.set(s.map, X0 + dx, Y + dy, TILE.LAVA);

  const framesInLava = (careful) => {
    const e = Enemies.make('snow_wolf', X0 + 11.5, Y + .5, { noElite: true });
    e.aggro = true;
    e.hazardCare = careful;
    let n = 0;
    for (let i = 0; i < 300; i++) {
      Enemies.step(e, -e.speed, 0, 1 / 60);          // pcha się w stronę gracza
      if (Dungeon.tile(s.map, e.x | 0, e.y | 0) === TILE.LAVA) n++;
    }
    return n;
  };
  const careful = framesInLava(true);
  const reckless = framesInLava(false);
  // pas lawy ma 4 kratki, wilk pokonuje go w ~73 klatkach (~1,2 s parzenia)
  assert(reckless > 40, 'nierozważny wróg nie przeszedł przez lawę (' + reckless + ' klatek)');
  assertEq(careful, 0, 'rozważny wróg wszedł w lawę (' + careful + ' klatek)');
});

test('ostrożność wobec zagrożeń jest cechą wroga, nie losem co klatkę', () => {
  Game.s = Game.newRunState('warrior');
  Game.s.floor = 8;
  let careful = 0;
  for (let i = 0; i < 400; i++) if (Enemies.make('snow_wolf', 5, 5, { noElite: true }).hazardCare) careful++;
  const pct = careful / 400;
  assert(Math.abs(pct - BAL.enemyHazardAvoid) < .07,
    'odsetek ostrożnych (' + (pct * 100).toFixed(0) + '%) odbiega od ustawienia ' +
    (BAL.enemyHazardAvoid * 100) + '%');
});

test('bossowie stąpają ponad zagrożeniami', () => {
  const s = newRun('warrior', 3);
  const b = s.boss;
  const x = b.x | 0, y = b.y | 0;
  Dungeon.set(s.map, x, y, TILE.LAVA);
  const hp0 = b.hp;
  for (let i = 0; i < 300; i++) Enemies.tileHazards(b, 1 / 60);
  assertEq(b.hp, hp0, 'boss otrzymał obrażenia od lawy');
  Dungeon.set(s.map, x, y, TILE.FLOOR);
});

test('bossowie są odporni na pełną kontrolę', () => {
  const s = newRun('warrior', 3);
  const b = s.boss;
  assert(b, 'boss się nie pojawił na piętrze 3');
  Combat.applyStatus(b, 'stun', 10);
  assert(b.statuses.stun.t < 10, 'boss dostał pełne ogłuszenie');
});

// =====================================================================
group('Umiejętności');

test('wszystkie 30 umiejętności rzuca się bez błędu (z celem i bez)', () => {
  for (const clsId of Object.keys(ClassDB)) {
    for (const withTarget of [true, false]) {
      const s = newRun(clsId, 7);
      const p = s.p;
      s.enemies.length = 0;
      if (withTarget) {
        for (let i = 0; i < 3; i++) {
          const e = Enemies.make('grave_rat', p.x + 2 + i, p.y, { noElite: true });
          e.hp = e.maxHp = 5000;
          s.enemies.push(e);
        }
        G.Game.mouse.wx = p.x + 2; G.Game.mouse.wy = p.y;
      } else {
        G.Game.mouse.wx = p.x + 3; G.Game.mouse.wy = p.y + 1;
      }
      for (let i = 0; i < 5; i++) {
        p.mp = 9999;
        p.skills[i].cdT = 0;
        Skills.cast(i);           // nie może rzucić wyjątku
        for (let f = 0; f < 120; f++) frame(1 / 60);   // efekty muszą się dokończyć
        checkInvariants(clsId + '/' + p.skills[i].name + (withTarget ? ' (z celem)' : ' (bez celu)'));
      }
    }
  }
});

test('umiejętność zużywa manę i wchodzi na odnowienie', () => {
  const s = newRun('mage', 5);
  const p = s.p;
  p.mp = p.d.maxMp;
  const sk = p.skills[0];
  sk.cdT = 0;
  const mp0 = p.mp;
  G.Game.mouse.wx = p.x + 3; G.Game.mouse.wy = p.y;
  Skills.cast(0);
  assert(p.mp < mp0, 'mana nie ubyła');
  assert(sk.cdT > 0, 'odnowienie nie ruszyło');
  // brak many → brak rzutu
  p.mp = 0; sk.cdT = 0;
  const before = sk.cdT;
  Skills.cast(0);
  assertEq(sk.cdT, before, 'rzucono mimo braku many');
});

test('nekromanta nie przekracza limitu sług', () => {
  const s = newRun('necromancer', 8);
  const p = s.p;
  for (let i = 0; i < 12; i++) {
    p.mp = 9999; p.skills[1].cdT = 0;
    Skills.cast(1);
  }
  assert(s.minions.length <= p.d.minionMax, 'za dużo sług: ' + s.minions.length + ' > ' + p.d.minionMax);
});

// =====================================================================
group('Bossowie');

test('każdy boss spawnuje się i wykonuje wszystkie swoje ataki', () => {
  for (const bossId of Object.keys(EnemyDB.bosses)) {
    const s = newRun('warrior', 3);
    s.enemies.length = 0; s.boss = null;
    Bosses.spawn(bossId);
    const b = s.boss;
    assert(b, bossId + ': nie pojawił się');
    assertFinite(b.hp, bossId + ': HP');
    b.aggro = true;
    for (const ability of b.abilities) {
      Bosses.useAbility(b, ability);
      for (let f = 0; f < 60; f++) frame(1 / 60);
      checkInvariants(bossId + '/' + ability);
    }
  }
});

test('boss przechodzi fazy i upuszcza swoją relikwię', () => {
  const s = newRun('warrior', 3);
  const b = s.boss;
  b.aggro = true;
  assertEq(b.phase, 1, 'faza startowa');
  b.hp = b.maxHp * .5;
  Bosses.update(b, 1 / 60);
  assertEq(b.phase, 2, 'brak przejścia do fazy 2');
  b.hp = b.maxHp * .2;
  Bosses.update(b, 1 / 60);
  assertEq(b.phase, 3, 'brak przejścia do fazy 3');
  // relikwia wypada dostatecznie często
  let relics = 0;
  for (let i = 0; i < 40; i++) {
    const s2 = newRun('warrior', 3);
    const boss = s2.boss;
    s2.drops.length = 0;
    Combat.dealToEnemy(boss, 1e9, { element: 'phys' });
    if (s2.drops.some(d => d.item.legendId === EnemyDB.bosses[boss.id].legendary)) relics++;
  }
  assert(relics > 10, 'relikwia bossa wypadła tylko ' + relics + '/40 razy');
});

test('pokonanie bossa odblokowuje schody', () => {
  const s = newRun('warrior', 3);
  assert(s.map.stairsLocked, 'schody powinny startować zablokowane');
  Combat.dealToEnemy(s.boss, 1e9, { element: 'phys' });
  assert(!s.map.stairsLocked, 'schody nie zostały odblokowane');
  assertEq(Dungeon.tile(s.map, s.map.stairs.x, s.map.stairs.y), TILE.STAIRS, 'brak kafla schodów');
});

// =====================================================================
group('Progresja i talenty');

test('doświadczenie podnosi poziom i przyznaje punkty talentu', () => {
  const s = newRun('rogue', 3);
  const p = s.p;
  assertEq(p.level, 1, 'poziom startowy');
  Progression.gainXp(100000);
  assert(p.level > 5, 'zbyt wolny awans: poziom ' + p.level);
  assert(p.talentPoints > 0, 'brak punktów talentu');
  assertFinite(p.xpNext, 'próg następnego poziomu');
  assert(p.hp <= p.d.maxHp, 'HP ponad maksimum po awansach');
});

test('wybrany talent faktycznie zmienia statystyki', () => {
  const s = newRun('warrior', 3);
  const p = s.p;
  p.talentPoints = 1;
  const atk0 = p.d.atk;
  Progression.pickTalent('strength');   // +3 do ataku
  assert(p.d.atk > atk0, 'talent Siła nie podniósł ataku');
  assertEq(p.talents.strength, 1, 'ranga talentu');
  assertEq(p.talentPoints, 0, 'punkt nie został zużyty');
});

test('bonusy zestawów włączają się przy 2 i 4 częściach', () => {
  const s = newRun('rogue', 9);
  const p = s.p;
  p.equip = { weapon: null, helmet: null, armor: null, boots: null, amulet: null, ring: null };
  Player.recalc(p);
  const dash0 = p.d.dashMax;
  p.equip.weapon = ItemDB.makeSetPiece(9, 'shadow', 'weapon');
  p.equip.armor = ItemDB.makeSetPiece(9, 'shadow', 'armor');
  Player.recalc(p);
  assert(p.d.dodge > 0, 'bonus za 2 części nie zadziałał');
  assertEq(p.d.dashMax, dash0, 'bonus za 4 części zadziałał za wcześnie');
  p.equip.boots = ItemDB.makeSetPiece(9, 'shadow', 'boots');
  p.equip.ring = ItemDB.makeSetPiece(9, 'shadow', 'ring');
  Player.recalc(p);
  assertEq(p.d.dashMax, dash0 + 1, 'bonus za 4 części nie dodał ładunku uniku');
  assert(p.d.flags.setShadowBurst, 'brak flagi wybuchu cienia');
});

test('flagi przedmiotów będące statystykami trafiają do statystyk', () => {
  const s = newRun('paladin', 12);
  const p = s.p;
  const empty = () => { p.equip = { weapon: null, helmet: null, armor: null, boots: null, amulet: null, ring: null }; Player.recalc(p); };
  empty();
  const base = { thorns: p.d.thorns, lifesteal: p.d.lifesteal, dodge: p.d.dodge, cdr: p.d.cdr };

  // Sonda bez afiksów — jedynym źródłem bonusów są flagi, więc nic nie maskuje
  // ewentualnej regresji w mapowaniu flaga → statystyka.
  p.equip.ring = {
    uid: -1, kind: 'equip', slot: 'ring', base: 'ring', icon: '💍', name: 'Sonda testowa',
    rarity: 'legend', lvl: 1, plus: 0, stats: {}, affixes: [],
    flags: { thorns: 12, lifesteal: .05, dodge: .04, cdr: .1 },
  };
  Player.recalc(p);
  assert(Math.abs(p.d.thorns - (base.thorns + 12)) < .001, 'flaga „thorns" nie trafiła do statystyki (jest ' + p.d.thorns + ')');
  assert(Math.abs(p.d.lifesteal - (base.lifesteal + .05)) < .001, 'flaga „lifesteal" nie trafiła do statystyki');
  assert(Math.abs(p.d.dodge - (base.dodge + .04)) < .001, 'flaga „dodge" nie trafiła do statystyki');
  assert(Math.abs(p.d.cdr - (base.cdr + .1)) < .001, 'flaga „cdr" nie trafiła do statystyki');

  // flaga nieznana jako statystyka ma wylądować w worku efektów specjalnych
  empty();
  p.equip.ring = {
    uid: -2, kind: 'equip', slot: 'ring', base: 'ring', icon: '💍', name: 'Sonda testowa 2',
    rarity: 'legend', lvl: 1, plus: 0, stats: {}, affixes: [], flags: { phoenix: 1 },
  };
  Player.recalc(p);
  assertEq(p.d.flags.phoenix, 1, 'efekt specjalny nie trafił do d.flags');

  // a prawdziwe relikwie bossów faktycznie coś dają
  empty();
  p.equip.armor = ItemDB.makeLegendById('leg_warden_bones', 12);
  Player.recalc(p);
  assert(p.d.thorns > base.thorns, 'relikwia Strażnika nie dała cierni');
});

test('pakty zmieniają wyprawę zgodnie z opisem', () => {
  Meta.data.pacts = ['frail'];
  Game.s = Game.newRunState('warrior');
  const frailHp = Game.s.p.d.maxHp;
  Meta.data.pacts = [];
  Game.s = Game.newRunState('warrior');
  const normalHp = Game.s.p.d.maxHp;
  assert(frailHp < normalHp, 'Pakt Kruchości nie obniżył HP (' + frailHp + ' vs ' + normalHp + ')');
  assert(Math.abs(frailHp / normalHp - .7) < .05, 'Pakt Kruchości: zły mnożnik ' + (frailHp / normalHp).toFixed(2));

  Meta.data.pacts = ['swarm'];
  Game.s = Game.newRunState('warrior');
  Game.loadFloor(5);
  const swarm = Game.s.enemies.length;
  Meta.data.pacts = [];
  Game.s = Game.newRunState('warrior');
  Game.loadFloor(5);
  const normal = Game.s.enemies.length;
  assert(swarm > normal, 'Pakt Roju nie zwiększył liczby wrogów (' + swarm + ' vs ' + normal + ')');
});

// =====================================================================
group('Ekwipunek i Kuźnia');

test('podnoszenie, zakładanie i zdejmowanie działa', () => {
  const s = newRun('warrior', 6);
  const p = s.p;
  const item = ItemDB.rollEquip(6, { slot: 'weapon', rarity: 'rare' });
  assert(Inv.addItem(item), 'nie udało się dodać przedmiotu');
  const atk0 = p.d.atk;
  Inv.equip(item);
  assertEq(p.equip.weapon, item, 'przedmiot nie trafił na slot');
  assert(p.d.atk > atk0, 'założona broń nie podniosła ataku');
  Inv.unequip('weapon');
  assertEq(p.equip.weapon, null, 'przedmiot nie został zdjęty');
  assert(p.inv.includes(item), 'zdjęty przedmiot nie wrócił do plecaka');
});

test('ulepszanie w Kuźni zużywa surowce i wzmacnia przedmiot', () => {
  const s = newRun('warrior', 6);
  const p = s.p;
  p.dust = 5000; p.gold = 5000;
  const item = ItemDB.rollEquip(6, { slot: 'weapon', rarity: 'rare' });
  Inv.addItem(item);
  Inv.equip(item);
  const atk0 = p.d.atk, dust0 = p.dust;
  Inv.upgrade(item);
  assertEq(item.plus, 1, 'poziom ulepszenia');
  assert(p.dust < dust0, 'Pył nie został zużyty');
  assert(p.d.atk > atk0, 'ulepszenie nie podniosło ataku');
  // limit ulepszeń
  for (let i = 0; i < 30; i++) Inv.upgrade(item);
  assertEq(item.plus, BAL.upgradeMax, 'przekroczono limit ulepszeń');
});

test('przetapianie daje Pył i usuwa przedmiot', () => {
  const s = newRun('warrior', 6);
  const p = s.p;
  const item = ItemDB.rollEquip(6, { rarity: 'epic' });
  Inv.addItem(item);
  const dust0 = p.dust;
  Inv.salvage(item);
  assert(p.dust > dust0, 'przetop nie dał Pyłu');
  assert(!p.inv.includes(item), 'przedmiot został w plecaku');
});

test('mikstury leczą, a Pakt Postu je osłabia', () => {
  const s = newRun('warrior', 6);
  const p = s.p;
  p.hp = 10;
  const pot = ItemDB.makeConsumable('potion_hp_s', 1);
  p.inv.push(pot);
  Inv.useConsumable(pot);
  const healedNormal = p.hp - 10;
  assert(healedNormal > 0, 'mikstura nie uleczyła');

  s.pacts = ['fasting'];
  p.hp = 10;
  const pot2 = ItemDB.makeConsumable('potion_hp_s', 1);
  p.inv.push(pot2);
  Inv.useConsumable(pot2);
  const healedFasting = p.hp - 10;
  assert(healedFasting < healedNormal, 'Pakt Postu nie osłabił mikstury');
  s.pacts = [];
});

// =====================================================================
group('Handlarz');

test('kupno, sprzedaż, odkup i hurt działają', () => {
  const s = newRun('warrior', 5);
  const p = s.p;
  p.gold = 20000;
  Shop.state();
  const st = Game.s.shop;
  const idx = st.stock.findIndex(e => e.item.kind === 'equip');
  const gold0 = p.gold, inv0 = p.inv.length;
  Shop.buy(idx);
  assert(p.gold < gold0, 'złoto nie ubyło przy zakupie');
  assertEq(p.inv.length, inv0 + 1, 'zakup nie trafił do plecaka');
  assert(st.stock[idx].sold, 'pozycja nie została oznaczona jako sprzedana');

  const item = ItemDB.rollEquip(5, { rarity: 'rare' });
  p.inv.push(item);
  const gold1 = p.gold;
  Shop.sell(item);
  assert(p.gold > gold1, 'sprzedaż nie dała złota');
  assertEq(st.buyback[0].item, item, 'sprzedany przedmiot nie trafił do odkupu');
  Shop.rebuy(0);
  assert(p.inv.includes(item), 'odkup nie zwrócił przedmiotu');

  for (let i = 0; i < 5; i++) p.inv.push(ItemDB.rollEquip(5, { rarity: 'common' }));
  const gold2 = p.gold;
  Shop.sellAll('common');
  assert(p.gold > gold2, 'sprzedaż hurtem nie dała złota');
  assertEq(p.inv.filter(i => i.kind === 'equip' && i.rarity === 'common').length, 0, 'zostały zwykłe przedmioty');
});

test('hazard zawsze zwraca przedmiot i pobiera opłatę', () => {
  const s = newRun('hunter', 8);
  const p = s.p;
  p.gold = 100000;
  p.invMax = 999;
  Shop.state();
  const dist = {};
  for (let i = 0; i < 200; i++) {
    const gold0 = p.gold, inv0 = p.inv.length;
    Shop.gamble(U.choice(['weapon', 'armor', 'jewel']));
    assert(p.gold < gold0, 'hazard nie pobrał opłaty');
    assertEq(p.inv.length, inv0 + 1, 'hazard nie dał przedmiotu');
    const it = p.inv[p.inv.length - 1];
    dist[it.rarity] = (dist[it.rarity] || 0) + 1;
    assert(it.rarity !== 'common', 'hazard zwrócił przedmiot zwykły');
  }
  const good = (dist.epic || 0) + (dist.set || 0) + (dist.legend || 0);
  assert(good > 10, 'hazard za rzadko daje dobre przedmioty: ' + good + '/200');
});

test('zaufanie rośnie, daje zniżkę i odblokowuje towar spod lady', () => {
  const s = newRun('warrior', 5);
  const p = s.p;
  p.gold = 100000;
  Shop.state();
  const st = Game.s.shop;
  assertEq(Shop.rep(), 0, 'zaufanie startowe');
  assertEq(Shop.tier().discount, 0, 'zniżka na starcie');
  const entry = st.stock.find(e => e.item.kind === 'equip' && !e.featured);
  const priceBefore = Shop.priceOf(entry);
  Shop.addRep(500);
  const top = MerchantDB.tiers[MerchantDB.tiers.length - 1];
  assertEq(Shop.tier().name, top.name, 'nie osiągnięto najwyższego progu');
  assert(Shop.priceOf(entry) < priceBefore, 'zniżka nie obniżyła ceny');
  Shop.ensureUnderCounter();
  assert(st.underCounter, 'brak towaru spod lady na najwyższym progu');
  assert(['set', 'legend'].includes(st.underCounter.item.rarity), 'towar spod lady zbyt pospolity');
  assert(Meta.data.achievements.confidant, 'osiągnięcie Powiernik nie odblokowane');
});

test('odświeżanie asortymentu drożeje i wymienia towar', () => {
  const s = newRun('warrior', 5);
  s.p.gold = 100000;
  Shop.state();
  const names0 = Game.s.shop.stock.map(e => e.item.name).join('|');
  const c1 = Shop.refreshCost();
  Shop.refresh();
  const c2 = Shop.refreshCost();
  assert(c2 > c1, 'drugie odświeżenie nie jest droższe');
  assert(Game.s.shop.stock.map(e => e.item.name).join('|') !== names0, 'towar się nie zmienił');
  assertEq(Game.s.shop.stock.filter(e => e.featured).length, 1, 'po odświeżeniu brak dokładnie jednej perełki');
});

// =====================================================================
group('Areny i wydarzenia');

test('arena przechodzi trzy fale i wypłaca nagrodę', () => {
  const s = newRun('warrior', 6);
  const p = s.p;
  s.enemies.length = 0;
  s.drops.length = 0;
  Challenge.start(p.x | 0, p.y | 0);
  assert(s.challenge.active, 'arena nie wystartowała');
  assertEq(s.challenge.wave, 1, 'zła pierwsza fala');
  let guard = 0;
  while (s.challenge.active && guard++ < 20) {
    s.enemies.forEach(e => Combat.dealToEnemy(e, 1e9, {}));
    s.enemies = s.enemies.filter(e => !e.dead);
    Challenge.update(1 / 60);
    if (s.challenge.gapT) s.challenge.gapT = 0;
    Challenge.update(1 / 60);
  }
  assert(!s.challenge.active, 'arena się nie zakończyła');
  assertEq(s.challenge.wave, BAL.challengeWaves, 'zła liczba fal');
  assert(s.drops.length > 0, 'brak nagrody za arenę');
  assertEq(s.runStats.arenas, 1, 'arena nie została policzona');
});

test('skrzynie, kapliczki, ołtarze i studnie nie wywalają gry', () => {
  for (let i = 0; i < 40; i++) {
    const s = newRun('warrior', U.randi(2, 14));
    const p = s.p;
    const x = p.x | 0, y = p.y | 0;
    p.hp = p.d.maxHp;
    Events.openChest(x, y);
    Events.useShrine(x, y);
    Events.useAltar(x, y);
    Events.useWell(x, y);
    checkInvariants('wydarzenia #' + i);
  }
});

// =====================================================================
group('Zapis i wczytanie');

test('pełny cykl zapis → wczytanie zachowuje stan wyprawy', () => {
  Meta.data.pacts = ['swarm', 'elite'];
  Game.s = Game.newRunState('necromancer');
  Game.loadFloor(7);
  const s = Game.s, p = s.p;
  p.gold = 1234; p.dust = 567;
  Progression.gainXp(5000);
  p.equip.weapon = ItemDB.makeSetPiece(7, 'cult', 'weapon');
  p.inv.push(ItemDB.rollEquip(7, { rarity: 'epic' }));
  Player.recalc(p);
  Shop.state();
  Shop.addRep(70);
  s.runStats.kills = 42;

  const before = {
    floor: s.floor, cls: p.cls, level: p.level, gold: p.gold, dust: p.dust,
    weapon: p.equip.weapon.name, invLen: p.inv.length, kills: s.runStats.kills,
    pacts: s.pacts.join(','), rep: Math.round(s.shopRep),
    enemies: s.enemies.filter(e => !e.dead && !e.isBoss).length,
  };
  assert(SaveSys.save(1, true), 'zapis się nie powiódł');
  Game.s = null;
  assert(SaveSys.load(1), 'wczytanie się nie powiodło');

  const s2 = Game.s, p2 = s2.p;
  assertEq(s2.floor, before.floor, 'piętro');
  assertEq(p2.cls, before.cls, 'klasa');
  assertEq(p2.level, before.level, 'poziom');
  assertEq(p2.gold, before.gold, 'złoto');
  assertEq(p2.dust, before.dust, 'Pył');
  assertEq(p2.equip.weapon.name, before.weapon, 'broń');
  assertEq(p2.inv.length, before.invLen, 'liczba przedmiotów');
  assertEq(s2.runStats.kills, before.kills, 'zabójstwa');
  assertEq(s2.pacts.join(','), before.pacts, 'pakty');
  assertEq(Math.round(s2.shopRep), before.rep, 'zaufanie handlarza');
  assertEq(s2.enemies.filter(e => !e.dead && !e.isBoss).length, before.enemies, 'liczba wrogów');
  assert(s2.map.t.length === s2.map.w * s2.map.h, 'mapa nie odtworzona');
  Meta.data.pacts = [];
});

test('wczytanie zapisu z bossem odtwarza jego stan', () => {
  Game.s = Game.newRunState('warrior');
  Game.loadFloor(3);
  const b = Game.s.boss;
  b.hp = b.maxHp * .4;
  b.phase = 2;
  SaveSys.save(2, true);
  SaveSys.load(2);
  const b2 = Game.s.boss;
  assert(b2, 'boss nie został odtworzony');
  assertEq(b2.phase, 2, 'faza bossa');
  assert(Math.abs(b2.hp - b.maxHp * .4) < 2, 'HP bossa');
});

test('zapis z nowszej wersji jest odrzucany', () => {
  Game.s = Game.newRunState('warrior');
  Game.loadFloor(2);
  SaveSys.save(3, true);
  const raw = JSON.parse(G.localStorage.getItem(G.SAVE_KEY + 3));
  raw.v = 9999;
  G.localStorage.setItem(G.SAVE_KEY + 3, JSON.stringify(raw));
  assertEq(SaveSys.load(3), false, 'wczytano zapis z przyszłej wersji');
});

// =====================================================================
group('Meta-progresja');

test('Esencja, ulepszenia Sanktuarium i mnożniki działają', () => {
  Meta.data.essence = 100000;
  Meta.data.upgrades = {};
  Game.s = Game.newRunState('warrior');
  const before = Game.s.p.d.maxHp;
  assert(Meta.buy('soul_vitality'), 'nie udało się kupić ulepszenia');
  assertEq(Meta.rank('soul_vitality'), 1, 'ranga ulepszenia');
  Game.s = Game.newRunState('warrior');
  assert(Game.s.p.d.maxHp > before, 'ulepszenie Sanktuarium nie podniosło HP');

  // mnożniki trudności i paktów
  Meta.data.difficulty = 'hard';
  Meta.data.pacts = ['swarm'];
  Game.s = Game.newRunState('warrior');
  const e0 = Meta.data.essence;
  const gained = Meta.addEssence(100);
  assert(gained > 100, 'mnożniki nie podniosły Esencji: ' + gained);
  assertEq(Meta.data.essence, e0 + gained, 'Esencja nie została doliczona');
  Meta.data.difficulty = 'normal';
  Meta.data.pacts = [];
});

test('trudność skaluje wrogów w obie strony', () => {
  const hp = {};
  for (const diff of ['easy', 'normal', 'hard']) {
    Meta.data.difficulty = diff;
    Game.s = Game.newRunState('warrior');
    Game.s.floor = 5;
    hp[diff] = Enemies.make('grave_rat', 5, 5, { noElite: true }).maxHp;
  }
  assert(hp.easy < hp.normal, 'Wędrowiec nie osłabia wrogów');
  assert(hp.hard > hp.normal, 'Koszmar nie wzmacnia wrogów');
  Meta.data.difficulty = 'normal';
});

// =====================================================================
group('Śmierć i zwycięstwo');

test('śmierć kończy wyprawę i nalicza Esencję', () => {
  const s = newRun('mage', 4);
  const e0 = Meta.data.essence;
  s.runStats.essenceEarned = 50;
  Game.playerDeath('Test');
  assert(s.over, 'wyprawa nie została zakończona');
  assert(!Game.alive(), 'gra nadal uznaje wyprawę za trwającą');
  Hud.showDeath('Test');
  assert(Meta.data.essence > e0, 'Esencja nie została naliczona po śmierci');
});

test('zejście na kolejne piętro czyści stan i zwiększa numer', () => {
  const s = newRun('warrior', 4);
  s.projectiles.push({ x: 1, y: 1, vx: 0, vy: 0, size: .2, traveled: 0, range: 5 });
  s.drops.push({ x: 1, y: 1, item: ItemDB.rollConsumable(4), bob: 0 });
  Game.loadFloor(5);
  assertEq(Game.s.floor, 5, 'numer piętra');
  assertEq(Game.s.projectiles.length, 0, 'pociski nie zostały wyczyszczone');
  assertEq(Game.s.drops.length, 0, 'łupy nie zostały wyczyszczone');
  assertEq(Game.s.challenge, null, 'arena nie została zresetowana');
  assert(Game.s.enemies.length > 0, 'nowe piętro bez wrogów');
});

test('Serce Otchłani kończy grę zwycięstwem', () => {
  const s = newRun('paladin', G.FINAL_FLOOR);
  assert(s.boss && s.boss.final, 'na ostatnim piętrze brak finałowego bossa');
  Combat.dealToEnemy(s.boss, 1e9, { element: 'holy' });
  assert(s.victory, 'zwycięstwo nie zostało odnotowane');
});

// =====================================================================
// podsumowanie
console.log('\n' + '─'.repeat(58));
if (failed === 0) {
  console.log('Wszystkie testy przeszły: ' + passed + '/' + passed);
} else {
  console.log('Testy: ' + passed + ' przeszło, ' + failed + ' nie przeszło');
  console.log('\nNiepowodzenia:');
  for (const f of failures) console.log('  • ' + f);
}
console.log('─'.repeat(58));
process.exit(failed ? 1 : 0);
