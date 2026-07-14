'use strict';

// Inicjalizacja: meta, renderer, wejście, ekran tytułowy.
(function init() {
  Meta.load();
  Sfx.volume = Meta.data.volume;
  Music.volume = Meta.data.musicVolume;

  Renderer.init();
  Input.init();

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
