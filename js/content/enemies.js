'use strict';

// Baza wrogów. AI: chase, ranged, charger, bomber, healer, summoner,
// leaper, teleporter, splitter, stealther.
const EnemyDB = {
  types: {
    // ===== ZRUJNOWANE KATAKUMBY (1-3) =====
    grave_rat:        { name: 'Szczur Grobowy', icon: '🐀', hp: 18, atk: 5, def: 0, xp: 8, gold: 3, speed: 2.6, ai: 'chase', color: '#a88a7a' },
    crypt_bat:        { name: 'Nietoperz Krypty', icon: '🦇', hp: 14, atk: 6, def: 0, xp: 8, gold: 2, speed: 3.4, ai: 'erratic', color: '#8a7aa8' },
    skeleton_warrior: { name: 'Szkielet Wojownik', icon: '💀', hp: 34, atk: 8, def: 3, xp: 15, gold: 6, speed: 1.9, ai: 'chase', color: '#ddd0a8' },
    rotting_zombie:   { name: 'Gnijący Zombie', icon: '🧟', hp: 52, atk: 10, def: 2, xp: 18, gold: 6, speed: 1.2, ai: 'chase', color: '#7a9a6a', status: { type: 'poison', dur: 3, chance: .3 } },
    skeleton_archer:  { name: 'Szkielet Łucznik', icon: '🏹', hp: 24, atk: 9, def: 1, xp: 17, gold: 8, speed: 2.0, ai: 'ranged', color: '#d0c098', attackCd: 1.7, projSpeed: 7.5, projColor: '#e8dcb0' },
    grave_ghost:      { name: 'Duch Grobowy', icon: '👻', hp: 28, atk: 9, def: 0, xp: 19, gold: 8, speed: 2.8, ai: 'stealther', color: '#c8d8f0', stealthCd: 6, stealthDur: 2.2, element: 'shadow' },
    bone_shaman:      { name: 'Kościany Szaman', icon: '🦴', hp: 38, atk: 8, def: 2, xp: 24, gold: 12, speed: 1.7, ai: 'summoner', color: '#e0d0b0', summonCd: 9, summonType: 'skeleton_warrior', summonMax: 3 },

    // ===== GRZYBOWE JASKINIE (4-6) =====
    fungal_brute:     { name: 'Grzybowy Osiłek', icon: '🍄', hp: 75, atk: 13, def: 4, xp: 28, gold: 11, speed: 1.8, ai: 'chase', color: '#c08a9a', status: { type: 'poison', dur: 3, chance: .35 } },
    spore_bomber:     { name: 'Zarodnik Wybuchowy', icon: '🦠', hp: 34, atk: 20, def: 0, xp: 24, gold: 9, speed: 3.0, ai: 'bomber', color: '#a0e05a', fuseTime: .8, blastRadius: 2.0, element: 'poison' },
    cave_crawler:     { name: 'Pełzacz Jaskiniowy', icon: '🕷️', hp: 55, atk: 14, def: 2, xp: 27, gold: 10, speed: 2.4, ai: 'leaper', color: '#8a6ab0', leapCd: 4, leapRange: 5, leapDmgMult: 1.5 },
    venom_spitter:    { name: 'Jadowy Plujak', icon: '🐍', hp: 46, atk: 13, def: 2, xp: 28, gold: 12, speed: 1.9, ai: 'ranged', color: '#7ac05a', attackCd: 1.9, projSpeed: 6.5, projColor: '#a0ff5a', element: 'poison', status: { type: 'poison', dur: 4, chance: .8 } },
    fungal_shaman:    { name: 'Grzybi Szaman', icon: '🌿', hp: 52, atk: 11, def: 3, xp: 32, gold: 15, speed: 1.7, ai: 'healer', color: '#8ad08a', healAmt: 30, healCd: 5 },
    moss_golem:       { name: 'Mchowy Golem', icon: '🗿', hp: 130, atk: 16, def: 8, xp: 38, gold: 16, speed: 1.0, ai: 'chase', color: '#6a9a6a', resist: { poison: .5 } },

    // ===== ZAMARZNIĘTA GŁĘBIA (7-9) =====
    ice_imp:          { name: 'Lodowy Chochlik', icon: '❄️', hp: 68, atk: 18, def: 3, xp: 36, gold: 15, speed: 2.6, ai: 'ranged', color: '#8ad8ff', attackCd: 1.6, projSpeed: 7, projColor: '#b0e8ff', element: 'ice', status: { type: 'chill', dur: 2.5, chance: .7 } },
    snow_wolf:        { name: 'Śnieżny Wilk', icon: '🐺', hp: 80, atk: 20, def: 3, xp: 36, gold: 14, speed: 3.3, ai: 'chase', color: '#c8d8e8' },
    frozen_knight:    { name: 'Zamarznięty Rycerz', icon: '🥶', hp: 150, atk: 22, def: 11, xp: 48, gold: 22, speed: 1.4, ai: 'chase', color: '#a0c0e0', resist: { ice: .5 }, weak: { fire: 1.4 } },
    ice_witch:        { name: 'Lodowa Wiedźma', icon: '🧙', hp: 90, atk: 24, def: 4, xp: 50, gold: 24, speed: 1.8, ai: 'ranged', color: '#b0d0ff', attackCd: 2.1, projSpeed: 6, projColor: '#e0f0ff', element: 'ice', status: { type: 'freeze', dur: 1.2, chance: .45 } },
    yeti:             { name: 'Yeti', icon: '🦍', hp: 170, atk: 26, def: 7, xp: 52, gold: 24, speed: 2.0, ai: 'charger', color: '#e8f0f8', chargeCd: 5, windup: .6, chargeSpeed: 9, chargeTime: .45, chargeBonus: 12 },
    shardling:        { name: 'Sopelnik', icon: '🧊', hp: 100, atk: 20, def: 5, xp: 44, gold: 18, speed: 2.2, ai: 'splitter', color: '#a8e0ff', splitInto: 'ice_shard', splitCount: 3, element: 'ice' },
    ice_shard:        { name: 'Odłamek Lodu', icon: '🔹', hp: 26, atk: 12, def: 1, xp: 8, gold: 3, speed: 3.4, ai: 'chase', color: '#c8ecff', element: 'ice', noSpawn: true },

    // ===== PŁONĄCE TRZEWIA (10-12) =====
    fire_impling:     { name: 'Diablik', icon: '😈', hp: 100, atk: 27, def: 4, xp: 55, gold: 24, speed: 3.0, ai: 'erratic', color: '#ff8a5a', element: 'fire' },
    hellhound:        { name: 'Ogar Piekielny', icon: '🐕', hp: 130, atk: 30, def: 6, xp: 60, gold: 26, speed: 3.5, ai: 'chase', color: '#e05a3a', status: { type: 'burn', dur: 2.5, chance: .4 }, resist: { fire: .4 } },
    magma_golem:      { name: 'Golem Magmowy', icon: '🌋', hp: 260, atk: 34, def: 14, xp: 78, gold: 34, speed: 1.1, ai: 'chase', color: '#ff7a3e', resist: { fire: .2 }, weak: { ice: 1.5 } },
    flame_cultist:    { name: 'Kultysta Płomieni', icon: '🔥', hp: 130, atk: 32, def: 6, xp: 68, gold: 32, speed: 1.9, ai: 'ranged', color: '#ffb05a', attackCd: 1.7, projSpeed: 7.5, projColor: '#ffc06a', element: 'fire', status: { type: 'burn', dur: 3, chance: .7 } },
    efreet:           { name: 'Ifryt', icon: '🧞', hp: 160, atk: 34, def: 8, xp: 80, gold: 38, speed: 2.3, ai: 'teleporter', color: '#ff9a4a', blinkCd: 4.5, attackCd: 1.5, projSpeed: 8, projColor: '#ffd08a', element: 'fire' },
    ash_bat:          { name: 'Popielny Nietoperz', icon: '🦇', hp: 90, atk: 26, def: 3, xp: 50, gold: 20, speed: 3.8, ai: 'erratic', color: '#a8887a', element: 'fire' },

    // ===== PAŁAC ZWIERCIADEŁ (13-15) =====
    mirror_assassin:  { name: 'Lustrzany Skrytobójca', icon: '🪞', hp: 170, atk: 42, def: 8, xp: 90, gold: 42, speed: 3.2, ai: 'stealther', color: '#d7e0ff', stealthCd: 5, stealthDur: 2.4, element: 'arcane' },
    crystal_sentinel: { name: 'Kryształowy Strażnik', icon: '🔷', hp: 300, atk: 40, def: 16, xp: 100, gold: 46, speed: 1.4, ai: 'chase', color: '#aeb6d4', resist: { arcane: .5 } },
    illusion_weaver:  { name: 'Tkacz Iluzji', icon: '✨', hp: 190, atk: 40, def: 9, xp: 105, gold: 50, speed: 1.8, ai: 'summoner', color: '#e6ecff', summonCd: 8, summonType: 'mirage', summonMax: 3 },
    obelisk_seer:     { name: 'Wieszcz Obelisku', icon: '🗿', hp: 220, atk: 44, def: 12, xp: 108, gold: 50, speed: 1.6, ai: 'ranged', color: '#d9e3ff', attackCd: 1.4, projSpeed: 8, projColor: '#c7d6ff', element: 'arcane' },
    void_echo:        { name: 'Echo Pustki', icon: '🫧', hp: 200, atk: 38, def: 10, xp: 100, gold: 46, speed: 1.7, ai: 'healer', color: '#8ad8ff', healAmt: 60, healCd: 4.5 },
    mirage:           { name: 'Miraż', icon: '🫥', hp: 120, atk: 36, def: 5, xp: 60, gold: 24, speed: 2.8, ai: 'teleporter', color: '#c7d4ff', blinkCd: 4, attackCd: 1.6, projSpeed: 7.5, projColor: '#e5ecff', element: 'arcane' },

    // ===== SERCE / GŁĘBIA BEZ DNA =====
    abyss_spawn:      { name: 'Pomiot Otchłani', icon: '🕷️', hp: 280, atk: 52, def: 14, xp: 130, gold: 60, speed: 3.0, ai: 'chase', color: '#7a5aff', element: 'shadow' },
    abyss_eye:        { name: 'Oko Otchłani', icon: '👁️', hp: 250, atk: 56, def: 12, xp: 135, gold: 62, speed: 1.8, ai: 'ranged', color: '#a06aff', attackCd: 1.3, projSpeed: 8.5, projColor: '#c9a6ff', element: 'shadow', status: { type: 'curse', dur: 4, chance: .4 } },
    soul_devourer:    { name: 'Pożeracz Dusz', icon: '👿', hp: 340, atk: 58, def: 16, xp: 150, gold: 70, speed: 2.5, ai: 'chase', color: '#ff5a8a', element: 'shadow' },
    void_worm:        { name: 'Czerw Pustki', icon: '🪱', hp: 200, atk: 70, def: 10, xp: 125, gold: 58, speed: 3.4, ai: 'bomber', color: '#b08aff', fuseTime: .75, blastRadius: 2.3, element: 'shadow' },
    end_herald:       { name: 'Herold Końca', icon: '🌑', hp: 380, atk: 60, def: 18, xp: 165, gold: 78, speed: 1.9, ai: 'summoner', color: '#5a3aaf', summonCd: 7, summonType: 'abyss_spawn', summonMax: 3, element: 'shadow' },
    void_resonance:   { name: 'Wybrzmienie Pustki', icon: '🫧', hp: 320, atk: 52, def: 16, xp: 150, gold: 70, speed: 1.8, ai: 'healer', color: '#8ad8ff', healAmt: 90, healCd: 4, element: 'shadow' },

    // ===== SPECJALNE =====
    mimic:            { name: 'Mimik', icon: '📦', hp: 90, atk: 18, def: 5, xp: 50, gold: 60, speed: 3.0, ai: 'chase', color: '#c9a85a', noSpawn: true },
    skeleton:         { name: 'Szkielet Sługa', icon: '💀', hp: 60, atk: 12, def: 3, xp: 0, gold: 0, speed: 3.2, ai: 'minion', color: '#d8f0d8', noSpawn: true },
    bone_golem:       { name: 'Kościany Golem', icon: '🦴', hp: 220, atk: 24, def: 10, xp: 0, gold: 0, speed: 2.4, ai: 'minion', color: '#e8e0c8', noSpawn: true, big: true },
  },

  // Afiksy elit
  eliteAffixes: {
    swift:     { name: 'Szybki', color: '#4adfff', desc: '+55% szybkości' },
    vampiric:  { name: 'Wampiryczny', color: '#ff5a8a', desc: 'leczy się przy trafieniu' },
    armored:   { name: 'Opancerzony', color: '#d0d0d0', desc: 'potrojony pancerz' },
    explosive: { name: 'Wybuchowy', color: '#ff7a3e', desc: 'eksploduje po śmierci' },
    shocking:  { name: 'Elektryzujący', color: '#ffe95a', desc: 'okresowo razi prądem' },
    warlord:   { name: 'Herszt', color: '#ffb84d', desc: 'wzmacnia pobliskich sojuszników' },
  },

  // ===== BOSSOWIE =====
  bosses: {
    crypt_warden: {
      name: 'Strażnik Krypty', icon: '🪦', hp: 620, atk: 20, def: 8, xp: 260, gold: 180,
      speed: 1.7, color: '#c8d8a0', radius: .62, essence: 40,
      abilities: ['slam', 'bone_spray', 'summon'], summonType: 'skeleton_warrior',
      taunt: 'KTO ZAKŁÓCA SEN UMARŁYCH...',
    },
    spore_mother: {
      name: 'Matka Zarodników', icon: '🍄', hp: 1150, atk: 27, def: 10, xp: 420, gold: 280,
      speed: 1.5, color: '#c08a9a', radius: .68, essence: 60,
      abilities: ['spore_cloud', 'charge', 'summon'], summonType: 'spore_bomber',
      taunt: 'MOJE DZIECI SĄ GŁODNE...',
    },
    ice_tyrant: {
      name: 'Lodowy Tyran', icon: '🧊', hp: 1800, atk: 36, def: 15, xp: 640, gold: 420,
      speed: 1.6, color: '#a0d0ff', radius: .68, essence: 85, resist: { ice: .3 }, weak: { fire: 1.3 },
      abilities: ['ice_breath', 'blizzard', 'freeze_nova'],
      taunt: 'ZAMARZNIESZ JAK RESZTA.',
    },
    ash_lord: {
      name: 'Władca Popiołów', icon: '🔥', hp: 2600, atk: 46, def: 18, xp: 900, gold: 600,
      speed: 1.9, color: '#ff8a4a', radius: .68, essence: 110, resist: { fire: .3 }, weak: { ice: 1.3 },
      abilities: ['meteor_rain', 'fire_nova', 'summon', 'charge'], summonType: 'hellhound',
      taunt: 'SPŁONIESZ, ROBAKU!',
    },
    archmage_reflections: {
      name: 'Arcymag Odbić', icon: '🪞', hp: 3400, atk: 54, def: 20, xp: 1300, gold: 850,
      speed: 2.1, color: '#d7e0ff', radius: .62, essence: 150, resist: { arcane: .4 },
      abilities: ['arcane_barrage', 'blink', 'mirror_clones', 'beam_sweep'],
      taunt: 'KTÓRY Z NAS JEST PRAWDZIWY?',
    },
    heart_of_abyss: {
      name: 'SERCE OTCHŁANI', icon: '🫀', hp: 5600, atk: 62, def: 24, xp: 3000, gold: 2000,
      speed: 1.3, color: '#ff4a7a', radius: .85, essence: 400, resist: { shadow: .4 },
      abilities: ['void_bolts', 'summon', 'void_zones', 'heartbeat', 'blink'], summonType: 'abyss_spawn',
      taunt: 'BIŁEM, ZANIM POWSTAŁO ŚWIATŁO. BĘDĘ BIŁ, GDY ZGAŚNIE.',
      final: true,
    },
  },

  // Pula wrogów dla piętra: typy z biomu odblokowywane stopniowo
  poolFor(floor) {
    const biome = BiomeDB.forFloor(floor);
    const ids = biome.pool.filter(id => !this.types[id].noSpawn);
    if (biome.id === 'endless' || biome.id === 'heart') return ids;
    const prog = floor - biome.floors[0]; // 0..2
    const count = Math.min(ids.length, 4 + prog * 2);
    return ids.slice(0, count);
  },

  bossFor(floor) {
    const biome = BiomeDB.forFloor(floor);
    if (biome.boss && floor === biome.floors[1]) return biome.boss;
    if (biome.id === 'endless' && (floor - 16) % 5 === 0) {
      const keys = ['crypt_warden', 'spore_mother', 'ice_tyrant', 'ash_lord', 'archmage_reflections'];
      return keys[U.randi(0, keys.length - 1)];
    }
    return null;
  },
};
