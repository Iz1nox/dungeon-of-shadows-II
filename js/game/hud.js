'use strict';

// HUD: paski, umiejętności, buffy, boss bar, toasty, podpowiedzi.
const Hud = {
  hpGhostW: 100,

  update(dt) {
    const s = Game.s;
    if (!s) return;
    const p = s.p, d = p.d;

    // paski
    const hpPct = U.clamp(p.hp / d.maxHp * 100, 0, 100);
    U.el('hp-bar').style.width = hpPct + '%';
    this.hpGhostW = Math.max(hpPct, U.lerp(this.hpGhostW, hpPct, dt * 2));
    U.el('hp-ghost').style.width = this.hpGhostW + '%';
    U.el('hp-text').textContent = Math.ceil(p.hp) + '/' + d.maxHp;
    U.el('hp-shield').style.width = (p.shield > 0 ? U.clamp(p.shield / d.maxHp * 100, 0, 100) : 0) + '%';
    U.el('mp-bar').style.width = U.clamp(p.mp / d.maxMp * 100, 0, 100) + '%';
    U.el('mp-text').textContent = Math.floor(p.mp) + '/' + d.maxMp;
    U.el('xp-bar').style.width = U.clamp(p.xp / p.xpNext * 100, 0, 100) + '%';
    U.el('xp-text').textContent = p.xp + '/' + p.xpNext;

    U.el('hud-level').textContent = p.level;
    U.el('hud-name').textContent = p.name;
    U.el('hud-portrait-icon').textContent = p.icon;
    U.el('hud-atk').textContent = '⚔ ' + Math.round(d.atk);
    U.el('hud-def').textContent = '🛡 ' + Math.round(d.def);
    U.el('hud-kills').textContent = '💀 ' + s.runStats.kills;
    U.el('hud-gold').textContent = '💰 ' + U.fmt(p.gold);
    U.el('hud-dust').textContent = '✨ ' + U.fmt(p.dust);
    U.el('hud-floor').textContent = '📍 ' + s.floor;

    // niski poziom HP
    U.el('low-hp-overlay').classList.toggle('active', p.hp < d.maxHp * BAL.lowHpPct);

    // unik — wskaźniki
    const pips = U.el('dash-pips');
    if (pips.children.length !== d.dashMax) {
      pips.innerHTML = '';
      for (let i = 0; i < d.dashMax; i++) {
        const div = document.createElement('div');
        div.className = 'dash-pip';
        div.innerHTML = '<i></i>';
        pips.appendChild(div);
      }
    }
    for (let i = 0; i < pips.children.length; i++) {
      const pip = pips.children[i];
      if (i < p.dashCharges) { pip.classList.add('full'); pip.firstChild.style.width = '100%'; }
      else if (i === p.dashCharges) {
        pip.classList.remove('full');
        pip.firstChild.style.width = (p.dashRegenT / BAL.dashRecharge * 100) + '%';
      } else { pip.classList.remove('full'); pip.firstChild.style.width = '0%'; }
    }

    this.updateSpellBar(p);
    this.updateQuickslots();
    this.updateBuffs(p);
    this.updateBossBar(s);

    // combo
    if (s.combo.timer > 0) {
      s.combo.timer -= dt;
      if (s.combo.timer <= 0) {
        s.combo.count = 0;
        U.el('combo-display').classList.remove('show');
      }
    }

    // wskaźnik odłożonych punktów talentu
    const th = U.el('talent-hint');
    if (p.talentPoints > 0 && !s.paused) {
      th.style.display = 'block';
      const label = '✨ Punkty talentu: ' + p.talentPoints + ' — wciśnij T';
      if (th._last !== label) { th.innerHTML = label; th._last = label; }
    } else th.style.display = 'none';

    // podpowiedź interakcji
    const it = Events.findInteractable();
    const hint = U.el('interact-hint');
    if (it && !s.paused) {
      hint.innerHTML = Events.hintFor(it.t);
      hint.style.display = 'block';
    } else hint.style.display = 'none';
  },

  buildSpellBar() {
    const p = Game.s.p;
    const bar = U.el('spell-bar');
    bar.innerHTML = '';
    p.skills.forEach((sk, i) => {
      const div = document.createElement('div');
      div.className = 'spell-slot' + (sk.ult ? ' ult' : '');
      div.id = 'spell-slot-' + i;
      div.innerHTML = `<span class="s-ic">${sk.icon}</span><span class="sk">${i + 1}</span><span class="smp">${sk.mp}</span><div class="cd-overlay" style="display:none"></div>`;
      div.onclick = () => Skills.cast(i);
      div.onmouseenter = ev => this.skillTip(sk, ev);
      div.onmousemove = ev => ItemTip.move(ev);
      div.onmouseleave = () => ItemTip.hide();
      bar.appendChild(div);
    });
  },

  skillTip(sk, ev) {
    const el = U.el('item-tooltip');
    el.innerHTML = `<div class="tt-name">${sk.icon} ${U.esc(sk.name)}${sk.ult ? ' <span style="color:#e8c368">ULTA</span>' : ''}</div>
      <div class="tt-type">🔮 ${sk.mp} many • ⏳ ${sk.cd}s odnowienia</div>
      <div>${U.esc(sk.desc)}</div>`;
    el.style.display = 'block';
    ItemTip.move(ev);
  },

  updateSpellBar(p) {
    p.skills.forEach((sk, i) => {
      const slot = U.el('spell-slot-' + i);
      if (!slot) return;
      const cd = slot.querySelector('.cd-overlay');
      if (sk.cdT > 0) {
        cd.style.display = 'flex';
        cd.textContent = sk.cdT >= 1 ? Math.ceil(sk.cdT) : sk.cdT.toFixed(1);
        const total = sk.cd * (1 - p.d.cdr);
        cd.style.height = U.clamp(sk.cdT / total * 100, 0, 100) + '%';
      } else cd.style.display = 'none';
      slot.classList.toggle('nomana', p.mp < sk.mp);
      if (sk.ult) slot.classList.toggle('ready', sk.cdT <= 0 && p.mp >= sk.mp);
    });
  },

  updateQuickslots() {
    const qs = U.el('quickslots');
    const hp = Inv.countPotions('hp'), mp = Inv.countPotions('mp');
    const key = hp + '/' + mp;
    if (qs._last === key) return;
    qs._last = key;
    qs.innerHTML = `
      <div class="qslot ${hp ? '' : 'empty'}" onclick="Inv.quickUse('hp')" title="Mikstura zdrowia">
        🧪<span class="qk">Q</span><span class="qn">${hp}</span></div>
      <div class="qslot ${mp ? '' : 'empty'}" onclick="Inv.quickUse('mp')" title="Mikstura many">
        🔹<span class="qk">R</span><span class="qn">${mp}</span></div>`;
  },

  updateBuffs(p) {
    const bar = U.el('buff-bar');
    let html = '';
    for (const b of p.buffs) {
      html += `<div class="buff-icon" title="${U.esc(b.name)}">${b.icon}<span class="bt">${Math.ceil(b.t)}</span></div>`;
    }
    const stNames = { burn: ['🔥', 'Podpalenie'], poison: ['☠️', 'Trucizna'], bleed: ['🩸', 'Krwawienie'], chill: ['❄️', 'Spowolnienie'], freeze: ['🧊', 'Zamrożenie'], stun: ['💫', 'Ogłuszenie'], curse: ['🌑', 'Klątwa'] };
    for (const k in p.statuses) {
      if (!stNames[k]) continue;
      html += `<div class="buff-icon debuff" title="${stNames[k][1]}">${stNames[k][0]}<span class="bt">${Math.ceil(p.statuses[k].t)}</span></div>`;
    }
    if (bar._last !== html) { bar.innerHTML = html; bar._last = html; }
  },

  updateBossBar(s) {
    const el = U.el('boss-hp');
    const b = s.boss;
    if (b && !b.dead && b.aggro) {
      el.style.display = 'block';
      U.el('boss-name').textContent = b.icon + ' ' + b.name;
      const pct = U.clamp(b.hp / b.maxHp * 100, 0, 100);
      U.el('boss-hp-fill').style.width = pct + '%';
      b.hpGhostBar = Math.max(pct, U.lerp(b.hpGhostBar || 100, pct, .05));
      U.el('boss-ghost').style.width = b.hpGhostBar + '%';
      if (b.phase === 1) U.el('boss-phase').textContent = '';
    } else {
      el.style.display = 'none';
    }
  },

  setFloorLabel() {
    const s = Game.s;
    const biome = s.map.biome;
    U.el('minimap-label').textContent = '📍 ' + s.floor + ' • ' + biome.name;
  },

  floorTransition(title, sub, cb) {
    const ft = U.el('floor-transition');
    ft.style.display = 'flex';
    ft.style.opacity = '0';
    U.el('ft-title').textContent = title;
    U.el('ft-sub').textContent = sub;
    ft.style.transition = 'opacity .4s';
    requestAnimationFrame(() => { ft.style.opacity = '1'; });
    setTimeout(() => {
      if (cb) cb();
      setTimeout(() => {
        ft.style.opacity = '0';
        setTimeout(() => { ft.style.display = 'none'; }, 450);
      }, 650);
    }, 550);
  },

  saveToast(txt) {
    const el = U.el('save-toast');
    el.textContent = txt;
    el.classList.add('show');
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => el.classList.remove('show'), 2200);
  },

  achievementToast(a) {
    const el = U.el('achievement-toast');
    el.innerHTML = `<div class="at-title">🏅 OSIĄGNIĘCIE</div><div class="at-name">${a.icon} ${U.esc(a.name)}</div>`;
    el.classList.add('show');
    Sfx.play('achieve');
    clearTimeout(this._achT);
    this._achT = setTimeout(() => el.classList.remove('show'), 3500);
  },

  showDeath(cause) {
    const s = Game.s, rs = s.runStats;
    U.el('death-cause').textContent = 'Pokonał cię: ' + cause + ' — piętro ' + s.floor + ', ' + s.map.biome.name;
    U.el('death-stats').innerHTML =
      `💀 Zabójstwa: ${rs.kills} (elity: ${rs.elites}) &nbsp;•&nbsp; 💰 Złoto: ${U.fmt(rs.goldEarned)}<br>` +
      `⚔️ Zadane obrażenia: ${U.fmt(rs.dmgDealt)} &nbsp;•&nbsp; 🛡️ Otrzymane: ${U.fmt(rs.dmgTaken)}<br>` +
      `⏱️ Czas: ${U.timeStr(s.time)} &nbsp;•&nbsp; 🧪 Mikstury: ${rs.potionsUsed} &nbsp;•&nbsp; 📦 Przedmioty: ${rs.itemsFound}`;
    const ess = Meta.addEssence(rs.essenceEarned + s.floor * BAL.essenceFloorBonus);
    U.el('death-essence').textContent = '✨ +' + ess + ' Esencji Dusz (łącznie: ' + U.fmt(Meta.data.essence) + ')';
    Meta.save();
    U.el('death-screen').style.display = 'flex';
  },

  showWin() {
    const s = Game.s, rs = s.runStats;
    U.el('win-stats').innerHTML =
      `💀 Zabójstwa: ${rs.kills} (elity: ${rs.elites}) &nbsp;•&nbsp; 💰 Złoto: ${U.fmt(rs.goldEarned)}<br>` +
      `⚔️ Zadane obrażenia: ${U.fmt(rs.dmgDealt)} &nbsp;•&nbsp; ⏱️ Czas: ${U.timeStr(s.time)} &nbsp;•&nbsp; poziom ${s.p.level}`;
    const ess = Meta.addEssence(rs.essenceEarned + 150);
    U.el('win-essence').textContent = '✨ +' + ess + ' Esencji Dusz (łącznie: ' + U.fmt(Meta.data.essence) + ')';
    Meta.data.stats.wins++;
    Meta.save();
    U.el('win-screen').style.display = 'flex';
  },
};

// ===== SANKTUARIUM / BESTIARIUSZ / OSIĄGNIĘCIA =====
const MetaUI = {
  open() {
    const el = U.el('meta-panel');
    el.classList.add('panel');
    el.style.display = 'block';
    let ups = '';
    for (const up of Meta.upgrades) {
      const r = Meta.rank(up.id);
      const maxed = r >= up.max;
      const cost = Meta.cost(up);
      ups += `<div class="meta-up">
        <span class="mu-icon">${up.icon}</span>
        <div class="mu-body">
          <div class="mu-name">${up.name}</div>
          <div class="mu-desc">${up.desc}</div>
          <div class="mu-rank">ranga ${r}/${up.max}${r > 0 ? ' • ' + up.per(r) : ''}</div>
        </div>
        <button ${maxed || Meta.data.essence < cost ? 'disabled' : ''} onclick="MetaUI.buy('${up.id}')">
          ${maxed ? 'MAX' : '✨ ' + U.fmt(cost)}</button>
      </div>`;
    }
    el.innerHTML = `
      <button class="panel-close" onclick="MetaUI.close()">✕</button>
      <h3>🔮 Sanktuarium Dusz</h3>
      <div class="p-sub">Trwałe wzmocnienia — obowiązują każdego bohatera, w każdej wyprawie.</div>
      <div class="meta-essence">✨ Esencja Dusz: ${U.fmt(Meta.data.essence)}</div>
      <div class="meta-grid">${ups}</div>`;
  },

  buy(id) {
    if (Meta.buy(id)) this.open();
    else Sfx.play('error');
  },

  openBestiary() {
    const el = U.el('meta-panel');
    el.classList.add('panel');
    el.style.display = 'block';
    let cards = '';
    let known = 0, total = 0;
    for (const id in EnemyDB.types) {
      const t = EnemyDB.types[id];
      if (t.noSpawn && !Meta.data.bestiary[id]) continue;
      total++;
      const kills = Meta.data.bestiary[id] || 0;
      if (kills > 0) known++;
      cards += `<div class="beast-card ${kills ? '' : 'unknown'}">
        <span class="b-icon">${kills ? t.icon : '❓'}</span>
        <div><div class="b-name">${kills ? t.name : '???'}</div>
        <div class="b-kills">${kills ? '💀 ' + kills : 'nieodkryty'}</div></div>
      </div>`;
    }
    for (const id in EnemyDB.bosses) {
      const b = EnemyDB.bosses[id];
      const kills = Meta.data.bestiary[id] || 0;
      total++;
      if (kills > 0) known++;
      cards += `<div class="beast-card ${kills ? '' : 'unknown'}" style="border-color:#5a2030">
        <span class="b-icon">${kills ? b.icon : '❓'}</span>
        <div><div class="b-name">${kills ? b.name : '??? (BOSS)'}</div>
        <div class="b-kills">${kills ? '💀 ' + kills : 'niepokonany'}</div></div>
      </div>`;
    }
    el.innerHTML = `
      <button class="panel-close" onclick="MetaUI.close()">✕</button>
      <h3>📖 Bestiariusz</h3>
      <div class="p-sub">Odkryto ${known}/${total} stworzeń Otchłani.</div>
      <div class="beast-grid">${cards}</div>`;
  },

  openAchievements() {
    const el = U.el('meta-panel');
    el.classList.add('panel');
    el.style.display = 'block';
    let cards = '';
    let got = 0;
    for (const a of AchievementDB.list) {
      const has = !!Meta.data.achievements[a.id];
      if (has) got++;
      cards += `<div class="ach-card ${has ? '' : 'locked'}">
        <span class="a-icon">${a.icon}</span>
        <div><div class="a-name">${a.name}</div><div class="a-desc">${a.desc}</div></div>
      </div>`;
    }
    el.innerHTML = `
      <button class="panel-close" onclick="MetaUI.close()">✕</button>
      <h3>🏅 Osiągnięcia</h3>
      <div class="p-sub">Zdobyto ${got}/${AchievementDB.list.length}.</div>
      <div class="ach-grid">${cards}</div>`;
  },

  openChangelog() {
    const el = U.el('meta-panel');
    el.classList.add('panel');
    el.style.display = 'block';
    let html = '';
    for (const rel of ChangelogDB) {
      html += `<div class="log-ver">v${rel.v} — ${U.esc(rel.name)} <span class="log-date">${rel.date}</span></div>
        <ul class="log-list">${rel.items.map(i => `<li>${i}</li>`).join('')}</ul>`;
    }
    el.innerHTML = `
      <button class="panel-close" onclick="MetaUI.close()">✕</button>
      <h3>📜 Nowości</h3>
      <div class="p-sub">Historia aktualizacji Dungeon of Shadows II</div>
      ${html}`;
  },

  close() { U.el('meta-panel').style.display = 'none'; },
};

// ===== USTAWIENIA / MENU PAUZY =====
const SettingsUI = {
  visible: false,

  toggle() {
    this.visible = !this.visible;
    const el = U.el('settings-panel');
    el.classList.add('panel');
    el.style.display = this.visible ? 'block' : 'none';
    if (Game.s) Game.s.paused = this.visible;
    if (this.visible) this.render();
  },

  render() {
    const el = U.el('settings-panel');
    const inGame = Game.alive();
    let slots = '';
    for (let i = 0; i <= SAVE_SLOTS; i++) {
      const info = SaveSys.slotInfo(i);
      const label = i === 0 ? 'Autozapis' : 'Slot ' + i;
      const desc = info
        ? `<b>${ClassDB[info.cls] ? ClassDB[info.cls].icon + ' ' + ClassDB[info.cls].name : '?'}</b> poz. ${info.level}, piętro ${info.floor}<br>${new Date(info.when).toLocaleString('pl-PL')}`
        : '— pusty —';
      slots += `<div class="save-slot">
        <div class="ss-info"><b>${label}</b><br>${desc}</div>
        <div class="ss-btns">
          ${inGame && i > 0 ? `<button onclick="SettingsUI.doSave(${i})">💾 Zapisz</button>` : ''}
          ${info ? `<button onclick="SettingsUI.doLoad(${i})">📂 Wczytaj</button>` : ''}
        </div>
      </div>`;
    }
    el.innerHTML = `
      <button class="panel-close" onclick="SettingsUI.toggle()">✕</button>
      <h3>⚙️ ${inGame ? 'Pauza' : 'Ustawienia'}</h3>
      <div class="p-sub">${inGame ? 'Gra wstrzymana' : 'Dungeon of Shadows II v' + GAME_VERSION}</div>
      <div class="set-row"><span>🔊 Efekty dźwiękowe</span>
        <input type="range" min="0" max="100" value="${Math.round(Sfx.volume * 100)}"
          oninput="SettingsUI.setVolume(this.value)"></div>
      <div class="set-row"><span>🎵 Muzyka</span>
        <input type="range" min="0" max="100" value="${Math.round(Music.volume * 100)}"
          oninput="SettingsUI.setMusicVolume(this.value)"></div>
      <div class="set-row"><span>📳 Wstrząsy ekranu</span>
        <input type="checkbox" ${Meta.data.screenShake ? 'checked' : ''} onchange="SettingsUI.setShake(this.checked)"></div>
      <h3 style="font-size:15px;margin-top:14px">💾 Zapisy</h3>
      <div class="save-slots">${slots}</div>
      <div class="set-buttons">
        ${inGame ? '<button onclick="SettingsUI.toggle()">▶️ Wróć do gry</button>' : ''}
        ${inGame ? '<button onclick="SettingsUI.abandon()">🏳️ Porzuć wyprawę (esencja zostaje naliczona)</button>' : ''}
      </div>`;
  },

  setVolume(v) {
    Sfx.setVolume(v / 100);
    Meta.data.volume = v / 100;
    Meta.save();
  },

  setMusicVolume(v) {
    Music.setVolume(v / 100);
    Meta.data.musicVolume = v / 100;
    Meta.save();
  },

  setShake(on) {
    Meta.data.screenShake = on;
    Meta.save();
  },

  doSave(slot) {
    SaveSys.save(slot);
    this.render();
  },

  doLoad(slot) {
    if (!SaveSys.slotInfo(slot)) return;
    this.visible = false;
    U.el('settings-panel').style.display = 'none';
    Game.loadAndRun(slot);
  },

  abandon() {
    if (Game.alive()) Game.playerDeath('Rezygnacja');
    this.toggle();
  },
};
