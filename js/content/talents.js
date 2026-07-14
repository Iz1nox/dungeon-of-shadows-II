'use strict';

// Talenty wybierane przy awansie (1 z 3). mod → klucze statystyk,
// flag → efekty specjalne sprawdzane w kodzie walki.
const TalentDB = {
  pool: [
    { id: 'strength', name: 'Siła', icon: '💪', max: 5, mod: { atk: 3 }, desc: '+3 do ataku' },
    { id: 'vitality', name: 'Witalność', icon: '❤️', max: 5, mod: { hp: 18 }, desc: '+18 maks. HP' },
    { id: 'armor', name: 'Pancerz', icon: '🛡️', max: 5, mod: { def: 3 }, desc: '+3 pancerza' },
    { id: 'precision', name: 'Precyzja', icon: '🎯', max: 4, mod: { crit: .04 }, desc: '+4% szansy na krytyk' },
    { id: 'brutality', name: 'Brutalność', icon: '🩸', max: 4, mod: { critDmg: .15 }, desc: '+15% obrażeń krytycznych' },
    { id: 'swiftness', name: 'Szybkie Nogi', icon: '👟', max: 3, mod: { spdPct: .04 }, desc: '+4% szybkości ruchu' },
    { id: 'arcana', name: 'Arkana', icon: '🔮', max: 4, mod: { spellPct: .08 }, desc: '+8% mocy umiejętności' },
    { id: 'vampirism', name: 'Wampiryzm', icon: '🧛', max: 3, mod: { lifesteal: .02 }, desc: '+2% kradzieży życia' },
    { id: 'greed', name: 'Chciwość', icon: '💰', max: 3, mod: { goldPct: .1 }, desc: '+10% znajdowanego złota' },
    { id: 'scholar', name: 'Uczony', icon: '📚', max: 3, mod: { xpPct: .08 }, desc: '+8% zdobywanego doświadczenia' },
    { id: 'focus', name: 'Skupienie', icon: '🧘', max: 4, mod: { cdr: .05 }, desc: '-5% czasu odnowienia umiejętności' },
    { id: 'thorns_t', name: 'Ciernie', icon: '🌵', max: 3, mod: { thorns: 4 }, desc: 'odbija 4 obrażenia atakującym w zwarciu' },
    { id: 'regeneration', name: 'Regeneracja', icon: '💚', max: 3, mod: { hpRegen: 1 }, desc: '+1 HP/s regeneracji' },
    { id: 'meditation', name: 'Medytacja', icon: '🕉️', max: 3, mod: { mpRegen: 1.2 }, desc: '+1,2 MP/s regeneracji' },
    { id: 'treasure', name: 'Łowca Skarbów', icon: '🗝️', max: 3, mod: { luck: 1 }, desc: 'lepsza jakość znajdowanych przedmiotów' },
    { id: 'igniter', name: 'Podpalacz', icon: '🔥', max: 3, mod: { burnHit: .08 }, desc: '8% szansy na podpalenie przy trafieniu' },
    { id: 'toxic', name: 'Toksykolog', icon: '☠️', max: 3, mod: { poisonHit: .08 }, desc: '8% szansy na zatrucie przy trafieniu' },
    { id: 'cold_blood', name: 'Zimna Krew', icon: '🧊', max: 3, flag: 'coldBlood', flagVal: .12, desc: '+12% obrażeń zmarzniętym wrogom' },
    { id: 'executioner', name: 'Egzekutor', icon: '⚰️', max: 3, flag: 'executioner', flagVal: .15, desc: '+15% obrażeń wrogom poniżej 30% HP' },
    { id: 'berserker', name: 'Berserker', icon: '😤', max: 2, flag: 'berserk', flagVal: .25, desc: '+25% ataku, gdy masz mniej niż 35% HP' },
    { id: 'reflexes', name: 'Refleks', icon: '💨', max: 1, mod: { extraDash: 1 }, desc: '+1 ładunek uniku' },
  ],

  classPool: {
    warrior: [{ id: 'c_war', name: 'Niezłomny', icon: '⚔️', max: 3, mod: { def: 2, hp: 12 }, desc: '+2 pancerza i +12 HP' }],
    mage: [{ id: 'c_mage', name: 'Przeciążenie', icon: '⚡', max: 3, mod: { spellPct: .1, mp: 12 }, desc: '+10% mocy umiejętności i +12 MP' }],
    rogue: [{ id: 'c_rogue', name: 'Tancerz Cieni', icon: '🌒', max: 3, mod: { dodge: .03, crit: .03 }, desc: '+3% uniku i +3% krytyka' }],
    necromancer: [{ id: 'c_necro', name: 'Mroczny Mistrz', icon: '💀', max: 2, mod: { minionMax: 1 }, desc: '+1 maksymalny sługa' }],
    paladin: [{ id: 'c_pala', name: 'Oddanie', icon: '⚜️', max: 3, mod: { lifesteal: .015, hp: 10 }, desc: '+1,5% kradzieży życia i +10 HP' }],
    hunter: [{ id: 'c_hunt', name: 'Snajper', icon: '🏹', max: 3, mod: { crit: .04, atkPct: .05 }, desc: '+4% krytyka i +5% ataku' }],
  },

  fullPool(clsId) {
    return this.pool.concat(this.classPool[clsId] || []);
  },

  byId(id, clsId) {
    return this.fullPool(clsId).find(t => t.id === id);
  },

  choicesFor(player) {
    const avail = this.fullPool(player.cls).filter(t => (player.talents[t.id] || 0) < t.max);
    return U.shuffle(avail).slice(0, 3);
  },
};
