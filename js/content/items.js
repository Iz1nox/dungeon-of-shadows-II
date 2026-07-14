'use strict';

// Przedmioty: bazy, rzadkości, afiksy, legendy, konsumenty, generator.
const ItemDB = {
  uid: 1,

  rarities: {
    common: { name: 'Zwykły', color: '#b8b8b8', affixes: [0, 0], mult: 1 },
    magic:  { name: 'Magiczny', color: '#5aa0ff', affixes: [1, 2], mult: 1.12 },
    rare:   { name: 'Rzadki', color: '#ffd84d', affixes: [2, 3], mult: 1.25 },
    epic:   { name: 'Epicki', color: '#c05aff', affixes: [3, 4], mult: 1.42 },
    legend: { name: 'Legendarny', color: '#ff8c2e', affixes: [2, 3], mult: 1.6 },
  },

  bases: {
    weapon: [
      { id: 'sword', name: 'Miecz', icon: '⚔️' },
      { id: 'axe', name: 'Topór', icon: '🪓' },
      { id: 'dagger', name: 'Sztylet', icon: '🗡️' },
      { id: 'staff', name: 'Kostur', icon: '🪄' },
      { id: 'bow', name: 'Łuk', icon: '🏹' },
      { id: 'hammer', name: 'Młot', icon: '🔨' },
    ],
    helmet: [
      { id: 'helm', name: 'Hełm', icon: '🪖' },
      { id: 'hood', name: 'Kaptur', icon: '🎩' },
      { id: 'crown', name: 'Diadem', icon: '👑' },
    ],
    armor: [
      { id: 'plate', name: 'Zbroja', icon: '🛡️' },
      { id: 'robe', name: 'Szata', icon: '🥋' },
      { id: 'leather', name: 'Kurta', icon: '🧥' },
    ],
    boots: [
      { id: 'boots', name: 'Buty', icon: '🥾' },
      { id: 'greaves', name: 'Nagolenice', icon: '👢' },
    ],
    amulet: [
      { id: 'amulet', name: 'Amulet', icon: '📿' },
      { id: 'talisman', name: 'Talizman', icon: '🧿' },
    ],
    ring: [
      { id: 'ring', name: 'Pierścień', icon: '💍' },
      { id: 'band', name: 'Obręcz', icon: '⭕' },
    ],
  },

  prefixes: {
    magic: ['Runiczny', 'Widmowy', 'Posrebrzany', 'Zaklęty', 'Mglisty'],
    rare: ['Otchłanny', 'Krwawy', 'Burzowy', 'Królewski', 'Przeklęty'],
    epic: ['Smoczy', 'Pradawny', 'Tytaniczny', 'Astralny', 'Demoniczny'],
  },

  // Afiksy: roll(lvl) zwraca wartość; txt(v) opis; key trafia do statystyk gracza
  affixes: {
    atk:       { key: 'atk', roll: l => U.randi(2, 3 + Math.ceil(l * .7)), txt: v => `+${v} do ataku` },
    atkPct:    { key: 'atkPct', roll: l => U.randi(5, 9 + Math.floor(l / 3)) / 100, txt: v => `+${Math.round(v * 100)}% ataku` },
    hp:        { key: 'hp', roll: l => U.randi(8, 12 + l * 3), txt: v => `+${v} maks. HP` },
    def:       { key: 'def', roll: l => U.randi(1, 2 + Math.ceil(l * .4)), txt: v => `+${v} pancerza` },
    crit:      { key: 'crit', roll: l => U.randi(3, 6 + Math.floor(l / 4)) / 100, txt: v => `+${Math.round(v * 100)}% szansy na kryt.` },
    critDmg:   { key: 'critDmg', roll: l => U.randi(10, 18 + l) / 100, txt: v => `+${Math.round(v * 100)}% obrażeń kryt.` },
    spd:       { key: 'spdPct', roll: l => U.randi(3, 6) / 100, txt: v => `+${Math.round(v * 100)}% szybkości ruchu` },
    spell:     { key: 'spellPct', roll: l => U.randi(6, 10 + Math.floor(l / 2)) / 100, txt: v => `+${Math.round(v * 100)}% mocy umiejętności` },
    lifesteal: { key: 'lifesteal', roll: l => U.randi(2, 4) / 100, txt: v => `${Math.round(v * 100)}% kradzieży życia` },
    mp:        { key: 'mp', roll: l => U.randi(6, 10 + l * 2), txt: v => `+${v} maks. MP` },
    mpRegen:   { key: 'mpRegen', roll: l => U.randi(4, 8) / 10, txt: v => `+${v.toFixed(1)} regeneracji MP/s` },
    gold:      { key: 'goldPct', roll: l => U.randi(8, 15) / 100, txt: v => `+${Math.round(v * 100)}% znajdowanego złota` },
    xp:        { key: 'xpPct', roll: l => U.randi(6, 12) / 100, txt: v => `+${Math.round(v * 100)}% zdobywanego dośw.` },
    dodge:     { key: 'dodge', roll: l => U.randi(2, 4) / 100, txt: v => `+${Math.round(v * 100)}% uniku` },
    cdr:       { key: 'cdr', roll: l => U.randi(4, 8) / 100, txt: v => `-${Math.round(v * 100)}% czasu odnowienia` },
    thorns:    { key: 'thorns', roll: l => U.randi(2, 4 + l), txt: v => `odbija ${v} obrażeń w zwarciu` },
    burnHit:   { key: 'burnHit', roll: l => U.randi(10, 18) / 100, txt: v => `${Math.round(v * 100)}% szansy na podpalenie` },
    poisonHit: { key: 'poisonHit', roll: l => U.randi(10, 18) / 100, txt: v => `${Math.round(v * 100)}% szansy na zatrucie` },
    iceHit:    { key: 'iceHit', roll: l => U.randi(10, 16) / 100, txt: v => `${Math.round(v * 100)}% szansy na spowolnienie` },
  },

  // Które afiksy mogą wypaść na danym slocie
  slotAffixes: {
    weapon: ['atk', 'atkPct', 'crit', 'critDmg', 'lifesteal', 'spell', 'burnHit', 'poisonHit', 'iceHit', 'cdr'],
    helmet: ['hp', 'def', 'mp', 'spell', 'xp', 'crit', 'mpRegen'],
    armor:  ['hp', 'def', 'thorns', 'dodge', 'atkPct', 'mp'],
    boots:  ['spd', 'dodge', 'def', 'hp', 'gold'],
    amulet: ['hp', 'mp', 'spell', 'mpRegen', 'xp', 'gold', 'atkPct', 'critDmg'],
    ring:   ['crit', 'critDmg', 'atk', 'lifesteal', 'dodge', 'gold', 'cdr'],
  },

  // ===== LEGENDY =====
  legends: [
    { id: 'leg_fang', slot: 'weapon', name: 'Kieł Otchłani', icon: '🗡️',
      stats: { atk: 1.35 }, affixIds: ['crit', 'lifesteal'],
      flag: { shadowHit: .35 }, legendTxt: '35% szansy na pocisk cienia przy trafieniu',
      flavor: 'Wyrwany z paszczy czegoś, co nie powinno mieć zębów.' },
    { id: 'leg_hammer', slot: 'weapon', name: 'Młot Świtu', icon: '🔨',
      stats: { atk: 1.3 }, affixIds: ['critDmg', 'atkPct'],
      flag: { holyNova: 1 }, legendTxt: 'krytyki wywołują świętą nowę',
      flavor: 'Kuty w pierwszym świetle po nocy, która trwała rok.' },
    { id: 'leg_golem_heart', slot: 'armor', name: 'Serce Golema', icon: '🛡️',
      stats: { def: 1.4 }, affixIds: ['hp', 'thorns'],
      flag: { hpPct: .2 }, legendTxt: '+20% maksymalnego zdrowia',
      flavor: 'Wciąż bije. Powoli. Kamiennie.' },
    { id: 'leg_wind_boots', slot: 'boots', name: 'Buty Wichru', icon: '🥾',
      stats: { def: 1 }, affixIds: ['spd', 'dodge'],
      flag: { extraDash: 1, spdPct: .12 }, legendTxt: '+1 ładunek uniku, +12% szybkości',
      flavor: 'Wiatr nie pyta o pozwolenie.' },
    { id: 'leg_phoenix', slot: 'ring', name: 'Pierścień Feniksa', icon: '💍',
      stats: {}, affixIds: ['hp', 'critDmg'],
      flag: { phoenix: 1 }, legendTxt: 'raz na piętro wskrzesza cię z 35% HP',
      flavor: 'Popiół pamięta kształt płomienia.' },
    { id: 'leg_lich_skull', slot: 'amulet', name: 'Czaszka Licha', icon: '📿',
      stats: {}, affixIds: ['mp', 'spell'],
      flag: { minionMax: 2, minionDmg: .5 }, legendTxt: '+2 maks. sług, słudzy zadają +50% obrażeń',
      flavor: 'Lich z pierwszej wyprawy wciąż szepcze z jej wnętrza.' },
    { id: 'leg_frozen_heart', slot: 'amulet', name: 'Zamarznięte Serce', icon: '🧿',
      stats: {}, affixIds: ['hp', 'def'],
      flag: { chillAura: 3 }, legendTxt: 'aura mrozu spowalnia pobliskich wrogów',
      flavor: 'Nie topnieje nawet w Trzewiach.' },
    { id: 'leg_herald_eye', slot: 'helmet', name: 'Oko Heralda', icon: '👁️',
      stats: { def: 1.1 }, affixIds: ['crit', 'critDmg'],
      flag: { fullHpDmg: .3 }, legendTxt: '+30% obrażeń wrogom z pełnym zdrowiem',
      flavor: 'Widzi słabość, zanim się pojawi.' },
    { id: 'leg_titan_crown', slot: 'helmet', name: 'Korona Tytana', icon: '👑',
      stats: { def: 1.3 }, affixIds: ['hp', 'atkPct'],
      flag: { hpPct: .15 }, legendTxt: '+15% maksymalnego zdrowia',
      flavor: 'Tytani nie klękali. Musieli ją zdjąć siłą.' },
    { id: 'leg_mirror_ring', slot: 'ring', name: 'Pierścień Zwierciadeł', icon: '⭕',
      stats: {}, affixIds: ['dodge', 'crit'],
      flag: { dodgeBlast: 1, dodge: .06 }, legendTxt: '+6% uniku; unik wywołuje arkaniczny wybuch',
      flavor: 'Odbija więcej niż światło.' },
  ],

  // ===== KONSUMENTY =====
  consumables: {
    potion_hp_s: { name: 'Mała Mikstura Zdrowia', icon: '🧪', use: 'heal', val: 40, price: 24, desc: 'Przywraca 40 HP.' },
    potion_hp_m: { name: 'Mikstura Zdrowia', icon: '❤️‍🩹', use: 'heal', val: 100, price: 55, desc: 'Przywraca 100 HP.' },
    potion_hp_l: { name: 'Wielka Mikstura Zdrowia', icon: '💗', use: 'healPct', val: .6, price: 120, desc: 'Przywraca 60% maks. HP.' },
    potion_mp_s: { name: 'Mała Mikstura Many', icon: '🔹', use: 'mana', val: 35, price: 20, desc: 'Przywraca 35 MP.' },
    potion_mp_m: { name: 'Mikstura Many', icon: '💙', use: 'mana', val: 80, price: 48, desc: 'Przywraca 80 MP.' },
    antidote:    { name: 'Antidotum', icon: '🧴', use: 'cleanse', price: 30, desc: 'Zdejmuje negatywne efekty.' },
    elixir_fury: { name: 'Eliksir Furii', icon: '🍷', use: 'buff', price: 70,
      buff: { icon: '🍷', name: 'Furia', dur: 20, atkPct: .3 }, desc: '+30% ataku na 20s.' },
    elixir_stone:{ name: 'Eliksir Kamienia', icon: '🥃', use: 'buff', price: 70,
      buff: { icon: '🥃', name: 'Kamienna Skóra', dur: 20, defFlat: 12 }, desc: '+12 pancerza na 20s.' },
    scroll_bless:{ name: 'Zwój Błogosławieństwa', icon: '📜', use: 'buff', price: 100,
      buff: { icon: '📜', name: 'Błogosławieństwo', dur: 30, atkPct: .15, defFlat: 6, spdPct: .1 }, desc: '+15% ataku, +6 pancerza, +10% szybkości na 30s.' },
    scroll_tp:   { name: 'Zwój Teleportu', icon: '🌀', use: 'teleport', price: 45, desc: 'Przenosi cię w losowe bezpieczne miejsce.' },
    bomb_fire:   { name: 'Bomba Ognista', icon: '💣', use: 'bomb', val: 70, price: 60, desc: 'Wybucha przy kursorze (70 obrażeń, podpala).' },
  },

  // ===== GENERATORY =====
  itemLvl(floor) { return Math.max(1, floor + U.randi(-1, 1)); },

  rollRarity(floor, luck = 0) {
    // wagi rosną z głębokością i szczęściem
    const f = floor + luck * 4;
    const w = [
      ['common', Math.max(6, 46 - f * 2.4)],
      ['magic', 32 + f * .4],
      ['rare', 6 + f * 1.1],
      ['epic', Math.max(0, f - 3) * .8],
      ['legend', Math.max(0, f - 5) * .33],
    ];
    let total = 0; for (const [, v] of w) total += v;
    let r = Math.random() * total;
    for (const [k, v] of w) { r -= v; if (r <= 0) return k; }
    return 'common';
  },

  baseStats(slot, lvl, mult) {
    const s = {};
    if (slot === 'weapon') s.atk = Math.round((4 + lvl * 1.9) * mult * U.rand(.85, 1.15));
    if (slot === 'armor') s.def = Math.round((2 + lvl * 1.0) * mult * U.rand(.85, 1.15));
    if (slot === 'helmet') { s.def = Math.round((1 + lvl * .55) * mult); s.hp = Math.round((4 + lvl * 2) * mult); }
    if (slot === 'boots') s.def = Math.round((1 + lvl * .45) * mult);
    if (slot === 'amulet') { s.hp = Math.round((6 + lvl * 2.6) * mult); s.mp = Math.round((4 + lvl * 1.6) * mult); }
    if (slot === 'ring') s.atk = Math.round((1 + lvl * .5) * mult);
    return s;
  },

  rollEquip(floor, opts = {}) {
    const luck = opts.luck || 0;
    const slot = opts.slot || U.choice(['weapon', 'weapon', 'helmet', 'armor', 'armor', 'boots', 'amulet', 'ring']);
    let rarity = opts.rarity || this.rollRarity(floor, luck);
    if (rarity === 'legend') {
      const item = this.makeLegend(floor, slot);
      if (item) return item;
      rarity = 'epic';
    }
    const lvl = this.itemLvl(floor);
    const rar = this.rarities[rarity];
    const base = U.choice(this.bases[slot]);
    const nAff = U.randi(rar.affixes[0], rar.affixes[1]);
    const pool = U.shuffle(this.slotAffixes[slot]);
    const affixes = [];
    for (let i = 0; i < nAff && i < pool.length; i++) {
      affixes.push({ id: pool[i], val: this.affixes[pool[i]].roll(lvl) });
    }
    let name = base.name;
    if (rarity !== 'common' && this.prefixes[rarity]) name = U.choice(this.prefixes[rarity]) + ' ' + name;
    return {
      uid: this.uid++, kind: 'equip', slot, base: base.id, icon: base.icon,
      name, rarity, lvl, plus: 0,
      stats: this.baseStats(slot, lvl, rar.mult),
      affixes, flags: {},
    };
  },

  makeLegend(floor, slot) {
    const cands = this.legends.filter(l => !slot || l.slot === slot);
    if (!cands.length) return null;
    const def = U.choice(cands);
    const lvl = this.itemLvl(floor);
    const stats = this.baseStats(def.slot, lvl, this.rarities.legend.mult);
    for (const k in def.stats) stats[k] = Math.round((stats[k] || lvl * 2) * def.stats[k]);
    const affixes = def.affixIds.map(id => ({ id, val: this.affixes[id].roll(lvl) }));
    return {
      uid: this.uid++, kind: 'equip', slot: def.slot, base: def.id, icon: def.icon,
      name: def.name, rarity: 'legend', lvl, plus: 0,
      stats, affixes, flags: Object.assign({}, def.flag),
      legendTxt: def.legendTxt, flavor: def.flavor, legendId: def.id,
    };
  },

  makeConsumable(id, qty = 1) {
    const def = this.consumables[id];
    return { uid: this.uid++, kind: 'consumable', cid: id, icon: def.icon, name: def.name, rarity: 'common', qty };
  },

  rollConsumable(floor) {
    const pool = floor < 4
      ? ['potion_hp_s', 'potion_hp_s', 'potion_mp_s', 'antidote', 'scroll_tp']
      : floor < 9
        ? ['potion_hp_s', 'potion_hp_m', 'potion_mp_s', 'potion_mp_m', 'antidote', 'bomb_fire', 'elixir_fury', 'scroll_tp']
        : ['potion_hp_m', 'potion_hp_l', 'potion_mp_m', 'bomb_fire', 'elixir_fury', 'elixir_stone', 'scroll_bless', 'scroll_tp'];
    return this.makeConsumable(U.choice(pool));
  },

  rollAny(floor, luck = 0) {
    return U.chance(BAL.potionDropChance) ? this.rollConsumable(floor) : this.rollEquip(floor, { luck });
  },

  price(item) {
    if (item.kind === 'consumable') return this.consumables[item.cid].price;
    const rMult = { common: 1, magic: 2.2, rare: 4.5, epic: 9, legend: 18 }[item.rarity];
    return Math.round((14 + item.lvl * 9) * rMult + item.plus * 25);
  },

  sellPrice(item) { return Math.max(1, Math.round(this.price(item) * .35)); },

  upgradeCost(item) {
    const n = item.plus + 1;
    return {
      dust: Math.round(BAL.upgradeDustBase * n * (1 + item.lvl * .06)),
      gold: Math.round(BAL.upgradeGoldBase * n * (1 + item.lvl * .1)),
    };
  },

  salvageValue(item) {
    const rMult = { common: 1, magic: 2, rare: 4, epic: 8, legend: 15 }[item.rarity];
    return Math.max(2, Math.round((3 + item.lvl * 1.2) * rMult + item.plus * 6));
  },
};
