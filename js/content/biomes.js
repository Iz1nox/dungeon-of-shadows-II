'use strict';

// Pięć krain + Serce Otchłani + nieskończona Głębia.
// Każdy biom: paleta, pogoda, kafelek-zagrożenie, pule wrogów, boss.
const BiomeDB = {
  list: [
    {
      id: 'catacombs', name: 'Zrujnowane Katakumby', floors: [1, 3],
      sub: 'Kości dawnych królestw wciąż pamiętają światło.',
      pal: { wall: '#3d3550', wallTop: '#524766', floor: '#221d30', floorAlt: '#282237', accent: '#7a6f96', glow: '#9a8bd8', liquid: '#1a4030' },
      weather: 'dust', hazard: TILE.SPIKES, hazardChance: .05,
      deco: ['🪦', '🦴', '💀', '🕸️', '⚰️'],
      pool: ['grave_rat', 'crypt_bat', 'skeleton_warrior', 'rotting_zombie', 'skeleton_archer', 'grave_ghost', 'bone_shaman'],
      boss: 'crypt_warden',
    },
    {
      id: 'fungal', name: 'Grzybowe Jaskinie', floors: [4, 6],
      sub: 'Zarodniki świecą tam, gdzie nigdy nie dotarło słońce.',
      pal: { wall: '#2a4436', wallTop: '#3a5a48', floor: '#18261e', floorAlt: '#1e2f24', accent: '#6ac08a', glow: '#8ae05a', liquid: '#3a7a20' },
      weather: 'spores', hazard: TILE.POISON, hazardChance: .07,
      deco: ['🍄', '🌿', '🪨', '🍄‍🟫', '🌱'],
      pool: ['fungal_brute', 'spore_bomber', 'cave_crawler', 'venom_spitter', 'fungal_shaman', 'moss_golem'],
      boss: 'spore_mother',
    },
    {
      id: 'frozen', name: 'Zamarznięta Głębia', floors: [7, 9],
      sub: 'Lód tutaj nie topnieje. On czeka.',
      pal: { wall: '#3a5570', wallTop: '#4d6f90', floor: '#1c2836', floorAlt: '#223142', accent: '#8ab8e0', glow: '#7ad8ff', liquid: '#3a80c0' },
      weather: 'snow', hazard: TILE.ICE, hazardChance: .08,
      deco: ['🧊', '❄️', '🪨', '⛄', '🌨️'],
      pool: ['ice_imp', 'snow_wolf', 'frozen_knight', 'ice_witch', 'yeti', 'shardling'],
      boss: 'ice_tyrant',
    },
    {
      id: 'inferno', name: 'Płonące Trzewia', floors: [10, 12],
      sub: 'Tu Otchłań oddycha ogniem.',
      pal: { wall: '#502a24', wallTop: '#6a382c', floor: '#2a1712', floorAlt: '#331c15', accent: '#e08a5a', glow: '#ff7a3e', liquid: '#e05a10' },
      weather: 'embers', hazard: TILE.LAVA, hazardChance: .07,
      deco: ['🌋', '🔥', '🪨', '💀', '🕯️'],
      pool: ['fire_impling', 'hellhound', 'magma_golem', 'flame_cultist', 'efreet', 'ash_bat'],
      boss: 'ash_lord',
    },
    {
      id: 'mirror', name: 'Pałac Zwierciadeł', floors: [13, 15],
      sub: 'Odbicia z pierwszej wyprawy wciąż tu krążą.',
      pal: { wall: '#4a4a72', wallTop: '#62629a', floor: '#232338', floorAlt: '#2a2a44', accent: '#b8c0f0', glow: '#c7d4ff', liquid: '#6a7ae0' },
      weather: 'sparks', hazard: TILE.SPIKES, hazardChance: .05,
      deco: ['🪞', '🔷', '🗿', '✨', '💠'],
      pool: ['mirror_assassin', 'crystal_sentinel', 'illusion_weaver', 'obelisk_seer', 'void_echo', 'mirage'],
      boss: 'archmage_reflections',
    },
    {
      id: 'heart', name: 'Serce Otchłani', floors: [16, 16],
      sub: 'Słyszysz je. Bije.',
      pal: { wall: '#3a1a4a', wallTop: '#552a6a', floor: '#1c0e26', floorAlt: '#241230', accent: '#b06aff', glow: '#ff4a7a', liquid: '#8a2aff' },
      weather: 'void', hazard: TILE.VOID, hazardChance: 0,
      deco: ['🫀', '🕳️', '🌑', '👁️', '🩸'],
      pool: ['abyss_spawn', 'abyss_eye', 'soul_devourer', 'void_worm'],
      boss: 'heart_of_abyss',
    },
    {
      id: 'endless', name: 'Głębia Bez Dna', floors: [17, 9999],
      sub: 'Nikt nie zszedł niżej. Jeszcze.',
      pal: { wall: '#2a1a50', wallTop: '#3d2a6a', floor: '#140c24', floorAlt: '#1a1030', accent: '#8a6fd8', glow: '#b06aff', liquid: '#5a2ad0' },
      weather: 'void', hazard: TILE.VOID, hazardChance: .05,
      deco: ['🕳️', '🌑', '👁️', '🪞', '💀'],
      pool: ['abyss_spawn', 'abyss_eye', 'soul_devourer', 'void_worm', 'end_herald', 'void_resonance'],
      boss: null, // losowy boss co 5 pięter
    },
  ],

  forFloor(f) {
    for (const b of this.list) if (f >= b.floors[0] && f <= b.floors[1]) return b;
    return this.list[this.list.length - 1];
  },
};
