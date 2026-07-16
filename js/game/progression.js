'use strict';

// Doświadczenie, awanse, wybór talentów.
const Progression = {

  xpFor(level) {
    return Math.round(BAL.xpCurveBase * Math.pow(level, BAL.xpCurvePow));
  },

  gainXp(amount) {
    const s = Game.s, p = s.p;
    amount = Math.round(amount * (1 + p.d.xpPct));
    p.xp += amount;
    while (p.xp >= p.xpNext) {
      p.xp -= p.xpNext;
      p.level++;
      p.xpNext = this.xpFor(p.level);
      this.onLevelUp();
    }
  },

  onLevelUp() {
    const s = Game.s, p = s.p;
    Sfx.play('levelup');
    Fx.ring(p.x, p.y, 2.4, '#ffd84d', 4, .7);
    Fx.burst(p.x, p.y, '#ffd84d', 26, { spd: 5, life: .8 });
    Fx.text(p.x, p.y - 1, 'POZIOM ' + p.level + '!', '#ffd84d', 20);
    Player.recalc(p);
    // pełne odnowienie przy awansie
    p.hp = p.d.maxHp;
    p.mp = p.d.maxMp;
    if (p.level >= 20) Meta.unlock('level20');
    // punkt talentu do banku — gracz wybiera, kiedy chce (T)
    p.talentPoints = (p.talentPoints || 0) + 1;
    Game.msg('⬆️ Poziom ' + p.level + '! Punkt talentu — wciśnij T, kiedy zechcesz.', 'gold');
  },

  showTalentChoice() {
    const s = Game.s, p = s.p;
    if (!Game.alive() || !(p.talentPoints > 0)) return;
    const choices = TalentDB.choicesFor(p);
    if (!choices.length) { p.talentPoints = 0; return; } // wszystko wymaksowane
    s.paused = true;
    const scr = U.el('level-up-screen');
    scr.style.display = 'flex';
    U.el('level-up-info').textContent =
      `Punkty talentu: ${p.talentPoints} — wybierz wzmocnienie (Esc — wybierzesz później)`;
    const box = U.el('level-up-choices');
    box.innerHTML = '';
    for (const t of choices) {
      const rank = p.talents[t.id] || 0;
      const card = document.createElement('div');
      card.className = 'talent-card';
      card.innerHTML = `
        <span class="t-icon">${t.icon}</span>
        <div class="t-name">${U.esc(t.name)}</div>
        <div class="t-rank">ranga ${rank + 1}/${t.max}</div>
        <div class="t-desc">${U.esc(t.desc)}</div>`;
      card.onclick = () => this.pickTalent(t.id);
      box.appendChild(card);
    }
  },

  closeTalentChoice() {
    U.el('level-up-screen').style.display = 'none';
    if (Game.s) Game.s.paused = false;
  },

  pickTalent(id) {
    const s = Game.s, p = s.p;
    p.talents[id] = (p.talents[id] || 0) + 1;
    p.talentPoints = Math.max(0, (p.talentPoints || 0) - 1);
    Player.recalc(p);
    Sfx.play('buff');
    const t = TalentDB.byId(id, p.cls);
    Game.msg('⬆️ Talent: ' + t.name + ' (ranga ' + p.talents[id] + ')', 'gold');
    if (p.talentPoints > 0) this.showTalentChoice(); // kolejny punkt od razu
    else this.closeTalentChoice();
  },
};
