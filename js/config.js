// =============================================
// DUNGEON OF SHADOWS II — SERCE OTCHŁANI
// Konfiguracja i stałe globalne
// =============================================
'use strict';

const GAME_VERSION = '1.4.1';
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
};

// Kafelki, po których można chodzić
const WALKABLE = new Set([TILE.FLOOR, TILE.STAIRS, TILE.SHRINE, TILE.ALTAR, TILE.WELL,
  TILE.SHOP, TILE.SPIKES, TILE.LAVA, TILE.POISON, TILE.ICE, TILE.DOOR, TILE.CHEST]);

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
