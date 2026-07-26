'use strict';

// Inicjalizacja: meta, renderer, wejście, ekran tytułowy.
(function init() {
  Meta.load();
  Sfx.volume = Meta.data.volume;
  Music.volume = Meta.data.musicVolume;

  Renderer.init();
  Input.init();
  Touch.init();

  // PWA: service worker → gra działa offline po pierwszej wizycie
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => { });
  }

  // karty klas
  const box = U.el('class-cards');
  box.innerHTML = '';
  for (const id in ClassDB) {
    const c = ClassDB[id];
    const card = document.createElement('button');
    card.className = 'class-card';
    card.innerHTML = `
      ${c.isNew ? '<span class="cc-new">NOWA</span>' : ''}
      <span class="cc-icon">${c.icon}</span>
      <span class="cc-name">${c.name}</span>
      <span class="cc-desc">${c.desc}</span>
      <span class="cc-stats">❤️ ${c.stats.hp} &nbsp; 🔮 ${c.stats.mp} &nbsp; ⚔ ${c.stats.atk}</span>`;
    card.onclick = () => Game.start(id);
    box.appendChild(card);
  }

  // wybór poziomu trudności (zapamiętywany)
  const renderDiff = () => {
    const row = U.el('diff-row');
    row.innerHTML = '<span class="diff-label">Trudność:</span>';
    for (const key of ['easy', 'normal', 'hard']) {
      const D = DIFFICULTY[key];
      const b = document.createElement('button');
      b.className = 'diff-btn' + (Meta.data.difficulty === key ? ' active' : '');
      b.style.setProperty('--dc', D.color);
      b.textContent = D.icon + ' ' + D.name;
      b.onclick = () => { Meta.data.difficulty = key; Meta.save(); Sfx.init(); Sfx.play('click'); renderDiff(); };
      row.appendChild(b);
    }
    U.el('diff-desc').textContent = DIFFICULTY[Meta.data.difficulty].desc;
  };
  renderDiff();

  // Pakty Otchłani — dobrowolne utrudnienia za mnożnik Esencji
  const renderPacts = () => {
    const row = U.el('pact-row');
    row.innerHTML = '<span class="diff-label">Pakty Otchłani:</span>';
    for (const key in PACTS) {
      const P = PACTS[key];
      const on = Meta.data.pacts.includes(key);
      const b = document.createElement('button');
      b.className = 'pact-btn' + (on ? ' active' : '');
      b.textContent = P.icon + ' ' + (P.short || P.name);
      b.title = P.desc;
      b.onclick = () => {
        const i = Meta.data.pacts.indexOf(key);
        if (i >= 0) Meta.data.pacts.splice(i, 1); else Meta.data.pacts.push(key);
        Meta.save(); Sfx.init(); Sfx.play('click');
        renderPacts();
      };
      row.appendChild(b);
    }
    const active = Meta.data.pacts.filter(k => PACTS[k]);
    const mult = active.reduce((m, k) => m + PACTS[k].essence, 1);
    const desc = U.el('pact-desc');
    if (!active.length) {
      desc.innerHTML = '<span style="color:#6a5f88">Bez paktów. Włącz dowolne, by grać trudniej i zdobywać więcej Esencji Dusz.</span>';
    } else {
      desc.innerHTML = `<b style="color:#b98aff">✨ Esencja ×${mult.toFixed(2).replace('.', ',')}</b> — `
        + active.map(k => U.esc(PACTS[k].desc)).join(' ');
    }
  };
  renderPacts();

  // przycisk „Kontynuuj" z autozapisu
  const auto = SaveSys.slotInfo(0);
  if (auto && ClassDB[auto.cls]) {
    const btn = document.createElement('button');
    btn.style.borderColor = '#8a5fff';
    btn.textContent = `▶️ Kontynuuj — ${ClassDB[auto.cls].icon} poz. ${auto.level}, piętro ${auto.floor}`;
    btn.onclick = () => { Sfx.init(); Game.loadAndRun(0); };
    U.el('title-buttons').prepend(btn);
  }

  // linia meta na tytule
  const d = Meta.data;
  const parts = [];
  parts.push('✨ Esencja Dusz: ' + U.fmt(d.essence));
  if (d.stats.deepest > 0) parts.push('🕳️ Najgłębiej: piętro ' + d.stats.deepest);
  if (d.stats.wins > 0) parts.push('🫀 Zwycięstwa: ' + d.stats.wins);
  const got = Object.keys(d.achievements).length;
  if (got > 0) parts.push('🏅 ' + got + '/' + AchievementDB.list.length);
  U.el('title-meta-line').textContent = parts.join('  •  ');

  // muzyka tytułowa od pierwszej interakcji (przeglądarki wymagają gestu)
  document.addEventListener('pointerdown', () => {
    Sfx.init();
    if (!Game.s) Music.start('title');
  }, { once: true });

  // start pętli
  requestAnimationFrame(t => { Game.lastT = t; Game.loop(t); });
})();
