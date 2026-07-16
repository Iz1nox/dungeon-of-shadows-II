'use strict';

// Trwała meta-progresja: Esencja Dusz, Sanktuarium, osiągnięcia, bestiariusz.
const Meta = {
  data: null,

  upgrades: [
    { id: 'soul_vitality', name: 'Witalność Dusz', icon: '❤️', max: 5, base: 40,
      per: r => `+${r * 12} maks. HP`, desc: 'Trwale zwiększa zdrowie każdego bohatera.' },
    { id: 'soul_blade', name: 'Ostrze Dusz', icon: '⚔️', max: 5, base: 45,
      per: r => `+${r * 2} do ataku`, desc: 'Trwale zwiększa siłę ataku.' },
    { id: 'soul_armor', name: 'Pancerz Dusz', icon: '🛡️', max: 5, base: 45,
      per: r => `+${r * 2} pancerza`, desc: 'Trwale zwiększa pancerz.' },
    { id: 'soul_fortune', name: 'Fortuna', icon: '💰', max: 5, base: 35,
      per: r => `+${r * 8}% złota`, desc: 'Więcej złota z każdego źródła.' },
    { id: 'soul_wisdom', name: 'Mądrość Otchłani', icon: '📚', max: 5, base: 35,
      per: r => `+${r * 8}% doświadczenia`, desc: 'Szybszy rozwój postaci.' },
    { id: 'soul_greed', name: 'Głód Esencji', icon: '🔮', max: 3, base: 80,
      per: r => `+${r * 10}% esencji`, desc: 'Więcej Esencji Dusz z wypraw.' },
    { id: 'soul_supplies', name: 'Zapasy', icon: '🧪', max: 3, base: 50,
      per: r => `+${r} mikstura na start`, desc: 'Dodatkowe mikstury zdrowia na początku wyprawy.' },
    { id: 'soul_forge', name: 'Pamięć Kuźni', icon: '⚒️', max: 3, base: 60,
      per: r => `+${r * 25} Pyłu na start`, desc: 'Zaczynasz z zapasem Pyłu Otchłani.' },
    { id: 'soul_speed', name: 'Kroki Cienia', icon: '👟', max: 3, base: 70,
      per: r => `+${r * 3}% szybkości`, desc: 'Trwale zwiększa szybkość ruchu.' },
    { id: 'soul_phoenix', name: 'Iskra Odrodzenia', icon: '🐦‍🔥', max: 1, base: 600,
      per: () => 'wskrzeszenie raz na wyprawę', desc: 'Raz na wyprawę powstajesz z 50% HP zamiast zginąć.' },
  ],

  load() {
    try {
      const raw = localStorage.getItem(META_KEY);
      this.data = raw ? JSON.parse(raw) : null;
    } catch (e) { this.data = null; }
    if (!this.data) this.data = {};
    const d = this.data;
    d.essence = d.essence || 0;
    d.totalEssence = d.totalEssence || 0;
    d.upgrades = d.upgrades || {};
    d.achievements = d.achievements || {};
    d.bestiary = d.bestiary || {};
    d.stats = Object.assign({ kills: 0, elites: 0, dashes: 0, wins: 0, runs: 0, deepest: 0 }, d.stats);
    d.records = d.records || {};
    d.difficulty = d.difficulty || 'normal';
    d.classesPlayed = d.classesPlayed || {};
    d.volume = d.volume !== undefined ? d.volume : .5;
    d.musicVolume = d.musicVolume !== undefined ? d.musicVolume : .3;
    d.screenShake = d.screenShake !== undefined ? d.screenShake : true;
  },

  save() {
    try { localStorage.setItem(META_KEY, JSON.stringify(this.data)); } catch (e) { }
  },

  rank(id) { return this.data.upgrades[id] || 0; },

  cost(up) { return Math.round(up.base * Math.pow(1.7, this.rank(up.id))); },

  buy(id) {
    const up = this.upgrades.find(u => u.id === id);
    if (!up) return false;
    const r = this.rank(id);
    if (r >= up.max) return false;
    const c = this.cost(up);
    if (this.data.essence < c) return false;
    this.data.essence -= c;
    this.data.upgrades[id] = r + 1;
    this.save();
    Sfx.play('buff');
    return true;
  },

  // zsumowane bonusy startowe
  bonuses() {
    const r = id => this.rank(id);
    return {
      hp: r('soul_vitality') * 12,
      atk: r('soul_blade') * 2,
      def: r('soul_armor') * 2,
      goldPct: r('soul_fortune') * .08,
      xpPct: r('soul_wisdom') * .08,
      essencePct: r('soul_greed') * .1,
      potions: r('soul_supplies'),
      dust: r('soul_forge') * 25,
      spdPct: r('soul_speed') * .03,
      phoenix: r('soul_phoenix') > 0,
    };
  },

  addEssence(n) {
    n = Math.round(n * (1 + this.bonuses().essencePct) * Game.diff().essence);
    this.data.essence += n;
    this.data.totalEssence += n;
    return n;
  },

  // rekordy najlepszych wypraw (lokalnie)
  updateRecords(s, won) {
    const r = this.data.records, p = s.p, rs = s.runStats;
    const stamp = { cls: p.cls, diff: s.difficulty || 'normal', when: Date.now() };
    const beat = (cur, val, lowerIsBetter = false) =>
      !cur || (lowerIsBetter ? val < cur.val : val > cur.val);
    if (beat(r.deepest, s.floor)) r.deepest = Object.assign({ val: s.floor }, stamp);
    if (beat(r.kills, rs.kills)) r.kills = Object.assign({ val: rs.kills }, stamp);
    if (beat(r.level, p.level)) r.level = Object.assign({ val: p.level }, stamp);
    if (beat(r.gold, rs.goldEarned)) r.gold = Object.assign({ val: rs.goldEarned }, stamp);
    if (won && beat(r.fastwin, Math.round(s.time), true)) r.fastwin = Object.assign({ val: Math.round(s.time) }, stamp);
    this.save();
  },

  recordKill(typeId, elite) {
    this.data.bestiary[typeId] = (this.data.bestiary[typeId] || 0) + 1;
    this.data.stats.kills++;
    if (elite) this.data.stats.elites++;
    if (this.data.stats.kills === 1) this.unlock('first_blood');
    if (this.data.stats.kills >= 100) this.unlock('hundred');
    if (this.data.stats.kills >= 1000) this.unlock('butcher');
    if (this.data.stats.elites >= 25) this.unlock('elite25');
    if (typeId === 'mimic') this.unlock('mimic_slayer');
  },

  unlock(id) {
    if (this.data.achievements[id]) return;
    const a = AchievementDB.byId(id);
    if (!a) return;
    this.data.achievements[id] = true;
    this.save();
    Hud.achievementToast(a);
  },
};
