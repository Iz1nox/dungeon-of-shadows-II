'use strict';

// Inicjalizacja: meta, renderer, wejście, ekran tytułowy.
(function init() {
  Meta.load();
  Sfx.volume = Meta.data.volume;

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

  // linia meta na tytule
  const d = Meta.data;
  const parts = [];
  parts.push('✨ Esencja Dusz: ' + U.fmt(d.essence));
  if (d.stats.deepest > 0) parts.push('🕳️ Najgłębiej: piętro ' + d.stats.deepest);
  if (d.stats.wins > 0) parts.push('🫀 Zwycięstwa: ' + d.stats.wins);
  const got = Object.keys(d.achievements).length;
  if (got > 0) parts.push('🏅 ' + got + '/' + AchievementDB.list.length);
  U.el('title-meta-line').textContent = parts.join('  •  ');

  // start pętli
  requestAnimationFrame(t => { Game.lastT = t; Game.loop(t); });
})();
