// =============================================
// DUNGEON OF SHADOWS II — SERCE OTCHŁANI
// Konfiguracja i stałe globalne
// =============================================
'use strict';

const GAME_VERSION = '1.7.4';
const SAVE_VERSION = 1;
const SAVE_KEY = 'dos2_save_';
const META_KEY = 'dos2_meta';
const SAVE_SLOTS = 3;

const TILE_SIZE = 40;
const MAP_W = 66;
const MAP_H = 50;
const FOV_RADIUS = 11;
const FINAL_FLOOR = 16;      // Serce Otchłani
const BOSS_FLOORS = [3, 6, 9, 12, 15, 16];
const SHOP_FLOORS = [2, 5, 8, 11, 14];

// Typy kafelków
const TILE = {
  WALL: 0,
  FLOOR: 1,
  STAIRS: 2,
  CHEST: 3,
  SHRINE: 4,
  ALTAR: 5,
  WELL: 6,
  SHOP: 7,
  SPIKES: 8,
  LAVA: 9,
  POISON: 10,
  ICE: 11,
  DOOR: 12,
  VOID: 13,
  CHALLENGE: 14,
};

// Kafelki, po których można chodzić
const WALKABLE = new Set([TILE.FLOOR, TILE.STAIRS, TILE.SHRINE, TILE.ALTAR, TILE.WELL,
  TILE.SHOP, TILE.SPIKES, TILE.LAVA, TILE.POISON, TILE.ICE, TILE.DOOR, TILE.CHEST,
  TILE.CHALLENGE]);

// Centralny balans
const BAL = {
  // gracz
  playerRadius: .34,
  dashSpeed: 13,
  dashTime: .16,
  dashIframes: .34,
  dashRecharge: 3.2,
  dashChargesBase: 2,
  regenDelay: 4,            // s od otrzymania obrażeń do naturalnej regeneracji
  baseRegenHp: 0.4,
  baseRegenMp: 2.2,
  comboWindow: 3.2,
  lowHpPct: .3,

  // formuła obrony: redukcja = def/(def+K)
  defK: 60,

  // skalowanie wrogów
  enemyHpPerFloor: .10,     // mnożnik na piętro w ramach głębi
  enemyAtkPerFloor: .07,
  endlessScale: .16,        // dodatkowe skalowanie za każde piętro po 16
  eliteChanceBase: .1,
  eliteChancePerFloor: .015,
  eliteHpMult: 2.3,
  eliteAtkMult: 1.45,
  eliteRewardMult: 3,

  // XP
  xpCurveBase: 90,
  xpCurvePow: 1.38,

  // loot
  dropChance: .24,
  potionDropChance: .34,    // udział mikstur w dropach
  goldBase: 1,

  // statusy
  burnDps: 6, burnDur: 3,
  poisonDps: 4, poisonDur: 5, poisonMaxStacks: 5,
  bleedDps: 5, bleedDur: 4,
  chillSlow: .45, chillDur: 2.6,
  freezeDur: 1.4,
  stunDur: .9,
  curseAmp: .25, curseDur: 6,
  shockDmg: 8,

  // kuźnia
  upgradeMax: 10,
  upgradeDustBase: 14,
  upgradeGoldBase: 30,
  rerollDust: 45,

  // esencja dusz
  essencePerXp: 1 / 42,
  essenceFloorBonus: 4,

  // eventy mapowe
  altarHpCostPct: .2,
  altarAtkGain: 3,
  shrineCurseChance: .22,
  mimicChance: .16,
  chestGoldBase: 26,

  // handlarz
  shopMarkup: 1.15,           // narzut na zwykły towar
  shopFeaturedMarkup: 1.45,   // narzut na towar wyróżniony
  shopRefreshBase: 55,        // koszt odświeżenia asortymentu
  shopRefreshPerFloor: 24,
  shopRefreshGrowth: 1.85,    // każde kolejne odświeżenie na tym piętrze droższe
  gambleBase: 70,             // cena „nieopisanego przedmiotu"
  gamblePerFloor: 34,
  gambleLuck: 2,              // o ile lepsze losowanie rzadkości niż zwykły drop
  dustPrice: 8,               // ile złota za 1 Pył Otchłani
  buybackSlots: 3,
  repPerGoldSpent: 1 / 25,    // zaufanie handlarza za wydane złoto
  repPerGoldEarned: 1 / 45,   // ...i za sprzedaż
  repPerGamble: 3,
  underCounterMarkup: 1.9,    // narzut na towar spod lady

  // zagrożenia terenu dla wrogów (obrażenia = flat + % maks. HP,
  // żeby parzyły tak samo szczura, jak i golema)
  enemyHazardTick: .5,        // co ile sekund zagrożenie rani wroga
  enemyLavaFlat: 12, enemyLavaPct: .06,
  enemySpikeFlat: 8, enemySpikePct: .035,
  enemyVoidFlat: 14, enemyVoidPct: .07,
  enemyHazardAvoid: .7,       // odsetek wrogów, które omijają zagrożenia

  // zachowania AI
  aiDodgeBase: .2,            // bazowa szansa na uskok przed pociskiem
  aiDodgePerFloor: .012,
  aiDodgeElite: .2,
  aiDodgeMax: .6,
  aiDodgeCd: 1.6,             // nie da się uskakiwać przed serią
  aiDodgeReact: .45,          // reaguje na pociski, które trafią w ciągu tylu sekund
  aiDodgeSpeed: 7.5,
  aiDodgeTime: .18,
  aiAgileSpeed: 1.8,          // od jakiej szybkości wróg w ogóle potrafi uskoczyć
  aiSeparation: .62,          // promień rozpychania się w tłumie
  aiSeparationForce: 1.5,
  aiStrafe: .55,              // jak mocno wrogowie okrążają gracza w zwarciu
  aiStrafeFlip: 3.5,          // co ile sekund zmieniają kierunek okrążania
  aiTelegraphFlee: 2.2,       // jak szybko uciekają z zapowiedzianego uderzenia

  // łupy gwarantowane
  bossRelicChance: .2,        // szansa, że boss upuści swoją unikalną relikwię
                              // (finałowy zawsze — przejście gry ma nagrodzić)

  // arena wyzwania
  challengeChance: .42,
  challengeWaves: 3,
  challengeEssence: 12,
};

// Poziomy trudności — wybierane na ekranie tytułowym
const DIFFICULTY = {
  easy: {
    id: 'easy', name: 'Wędrowiec', icon: '🌿', color: '#7ae08a',
    desc: 'Spokojniejsza wyprawa: słabsi wrogowie, rzadsze elity. Esencja ×0,7.',
    enemyHp: .7, enemyAtk: .72, essence: .7, gold: 1, eliteBonus: -.04,
  },
  normal: {
    id: 'normal', name: 'Śmiałek', icon: '⚔️', color: '#e8c368',
    desc: 'Otchłań taka, jaką ją zaprojektowano.',
    enemyHp: 1, enemyAtk: 1, essence: 1, gold: 1, eliteBonus: 0,
  },
  hard: {
    id: 'hard', name: 'Koszmar', icon: '💀', color: '#ff5a5a',
    desc: 'Wrogowie +50% HP i +35% obrażeń, dużo więcej elit. Esencja ×1,6 i +15% złota.',
    enemyHp: 1.5, enemyAtk: 1.35, essence: 1.6, gold: 1.15, eliteBonus: .08,
  },
};

// Pakty Otchłani — dobrowolne utrudnienia wybierane przed wyprawą.
// Każdy podnosi mnożnik zdobywanej Esencji Dusz.
const PACTS = {
  swarm: {
    id: 'swarm', name: 'Pakt Roju', short: 'Rój', icon: '🐝', essence: .25,
    desc: 'Na każdym piętrze czyha o 40% więcej wrogów.',
  },
  frail: {
    id: 'frail', name: 'Pakt Kruchości', short: 'Kruchość', icon: '💔', essence: .3,
    desc: 'Twoje maksymalne zdrowie jest niższe o 30%.',
  },
  haste: {
    id: 'haste', name: 'Pakt Pośpiechu', short: 'Pośpiech', icon: '💨', essence: .2,
    desc: 'Wrogowie poruszają się o 25% szybciej.',
  },
  elite: {
    id: 'elite', name: 'Pakt Elit', short: 'Elity', icon: '👑', essence: .35,
    desc: 'Trzykrotnie większa szansa na elitarnych przeciwników.',
  },
  fasting: {
    id: 'fasting', name: 'Pakt Postu', short: 'Post', icon: '🚫', essence: .2,
    desc: 'Mikstury przywracają o połowę mniej.',
  },
  poverty: {
    id: 'poverty', name: 'Pakt Nędzy', short: 'Nędza', icon: '🕯️', essence: .25,
    desc: 'Wędrowny Handlarz nie zejdzie tak głęboko — brak sklepów.',
  },
};

// Żywioły
const ELEMENTS = {
  phys:   { name: 'Fizyczne',  color: '#d8d8d8', icon: '⚔️' },
  fire:   { name: 'Ogień',     color: '#ff7a3e', icon: '🔥' },
  ice:    { name: 'Lód',       color: '#7ad8ff', icon: '❄️' },
  poison: { name: 'Trucizna',  color: '#8ae05a', icon: '☠️' },
  shadow: { name: 'Cień',      color: '#b06aff', icon: '🌑' },
  holy:   { name: 'Światło',   color: '#ffe9a0', icon: '✨' },
  arcane: { name: 'Arkana',    color: '#6a9aff', icon: '🔮' },
};
