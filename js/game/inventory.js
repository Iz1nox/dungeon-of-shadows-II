'use strict';

// Ekwipunek: podnoszenie, zakładanie, konsumenty, Kuźnia (ulepszanie/przetapianie).
const Inv = {

  addItem(item) {
    const p = Game.s.p;
    if (item.kind === 'consumable') {
      const ex = p.inv.find(i => i.kind === 'consumable' && i.cid === item.cid);
      if (ex) { ex.qty += item.qty || 1; return true; }
    }
    if (p.inv.length >= p.invMax) return false;
    p.inv.push(item);
    return true;
  },

  updateDrops(dt) {
    const s = Game.s, p = s.p;
    for (let i = s.drops.length - 1; i >= 0; i--) {
      const d = s.drops[i];
      d.bob += dt * 3;
      if (U.dist(d.x, d.y, p.x, p.y) < .75) {
        if (this.addItem(d.item)) {
          s.drops.splice(i, 1);
          s.runStats.itemsFound++;
          Sfx.play('pickup');
          const rar = ItemDB.rarities[d.item.rarity];
          Game.msg('📦 ' + d.item.name + (d.item.qty > 1 ? ' ×' + d.item.qty : ''),
            d.item.rarity === 'common' ? '' : 'magic');
          Fx.text(p.x, p.y - .8, d.item.name, rar.color, 13);
          if (InvUI.visible) InvUI.render();
        } else {
          if (!d.warned) { Game.msg('🎒 Ekwipunek pełny!', 'bad'); d.warned = true; }
        }
      }
    }
  },

  equip(item) {
    const p = Game.s.p;
    if (item.kind !== 'equip') return;
    const slot = item.slot;
    const old = p.equip[slot];
    p.equip[slot] = item;
    const idx = p.inv.indexOf(item);
    if (idx >= 0) p.inv.splice(idx, 1);
    if (old) p.inv.push(old);
    Player.recalc(p);
    Sfx.play('pickup');
  },

  unequip(slot) {
    const p = Game.s.p;
    const it = p.equip[slot];
    if (!it) return;
    if (p.inv.length >= p.invMax) { Game.msg('🎒 Ekwipunek pełny!', 'bad'); return; }
    p.equip[slot] = null;
    p.inv.push(it);
    Player.recalc(p);
  },

  useConsumable(item) {
    const s = Game.s, p = s.p;
    const def = ItemDB.consumables[item.cid];
    let used = true;
    switch (def.use) {
      case 'heal': Player.heal(p, def.val); Sfx.play('potion'); break;
      case 'healPct': Player.heal(p, p.d.maxHp * def.val); Sfx.play('potion'); break;
      case 'mana':
        p.mp = Math.min(p.d.maxMp, p.mp + def.val);
        Fx.text(p.x, p.y - .6, '+MP', '#6a9aff', 14); Sfx.play('potion');
        break;
      case 'cleanse':
        for (const k of ['burn', 'poison', 'bleed', 'chill', 'curse']) delete p.statuses[k];
        Fx.text(p.x, p.y - .6, 'Oczyszczony!', '#7ae08a', 14); Sfx.play('heal');
        break;
      case 'buff': Player.addBuff(p, def.buff); Sfx.play('buff'); break;
      case 'teleport': {
        const spot = Dungeon.freeSpot(s.map, 0);
        Fx.burst(p.x, p.y, '#8ab0ff', 14, { spd: 3 });
        p.x = spot.x; p.y = spot.y;
        Fx.burst(p.x, p.y, '#8ab0ff', 14, { spd: 3 });
        Sfx.play('magic');
        break;
      }
      case 'bomb': {
        const d = Math.min(7, U.dist(p.x, p.y, Game.mouse.wx, Game.mouse.wy));
        const a = U.angle(p.x, p.y, Game.mouse.wx, Game.mouse.wy);
        Combat.explode(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, 2.5, def.val, true, 'fire',
          { status: { type: 'burn', dur: 3 } });
        break;
      }
      default: used = false;
    }
    if (used) {
      s.runStats.potionsUsed++;
      item.qty--;
      if (item.qty <= 0) {
        const idx = p.inv.indexOf(item);
        if (idx >= 0) p.inv.splice(idx, 1);
      }
      if (InvUI.visible) InvUI.render();
    }
  },

  // szybkie użycie mikstur: Q — HP, R — MP
  quickUse(kind) {
    const p = Game.s.p;
    const ids = kind === 'hp' ? ['potion_hp_l', 'potion_hp_m', 'potion_hp_s'] : ['potion_mp_m', 'potion_mp_s'];
    // najpierw najmniejsze
    for (const id of ids.slice().reverse()) {
      const it = p.inv.find(i => i.kind === 'consumable' && i.cid === id);
      if (it) { this.useConsumable(it); return; }
    }
    Sfx.play('error');
    Fx.text(p.x, p.y - .8, kind === 'hp' ? 'Brak mikstur HP!' : 'Brak mikstur MP!', '#aaa', 13);
  },

  countPotions(kind) {
    const p = Game.s.p;
    const ids = kind === 'hp' ? ['potion_hp_s', 'potion_hp_m', 'potion_hp_l'] : ['potion_mp_s', 'potion_mp_m'];
    return p.inv.filter(i => i.kind === 'consumable' && ids.includes(i.cid))
      .reduce((a, i) => a + i.qty, 0);
  },

  salvage(item) {
    const p = Game.s.p;
    const dust = ItemDB.salvageValue(item);
    const idx = p.inv.indexOf(item);
    if (idx < 0) return;
    p.inv.splice(idx, 1);
    p.dust += dust;
    Sfx.play('forge');
    Game.msg('⚒️ Przetopiono: ' + item.name + ' → +' + dust + ' ✨ Pyłu', 'sys');
    if (InvUI.forgeItem === item) InvUI.forgeItem = null;
    InvUI.render();
  },

  upgrade(item) {
    const p = Game.s.p;
    if (item.plus >= BAL.upgradeMax) { Sfx.play('error'); return; }
    const cost = ItemDB.upgradeCost(item);
    if (p.dust < cost.dust || p.gold < cost.gold) { Sfx.play('error'); Game.msg('Za mało Pyłu lub złota!', 'bad'); return; }
    p.dust -= cost.dust; p.gold -= cost.gold;
    item.plus++;
    Player.recalc(p);
    Sfx.play('forge');
    Fx.text(p.x, p.y - .8, item.name + ' +' + item.plus + '!', '#ffd84d', 15);
    if (item.plus >= 10) Meta.unlock('forge10');
    InvUI.render();
  },

  reroll(item) {
    const p = Game.s.p;
    if (item.rarity === 'common' || item.kind !== 'equip') { Sfx.play('error'); return; }
    if (p.dust < BAL.rerollDust) { Sfx.play('error'); Game.msg('Za mało Pyłu!', 'bad'); return; }
    p.dust -= BAL.rerollDust;
    const pool = U.shuffle(ItemDB.slotAffixes[item.slot]);
    const n = item.affixes.length || 1;
    item.affixes = [];
    for (let i = 0; i < n && i < pool.length; i++) {
      item.affixes.push({ id: pool[i], val: ItemDB.affixes[pool[i]].roll(item.lvl) });
    }
    Player.recalc(p);
    Sfx.play('forge');
    Game.msg('🎲 Przelosowano właściwości: ' + item.name, 'magic');
    InvUI.render();
  },
};

// ===== UI EKWIPUNKU I KUŹNI =====
const InvUI = {
  visible: false,
  tab: 'items', // items | forge
  forgeItem: null,

  slotNames: { weapon: 'Broń', helmet: 'Hełm', armor: 'Zbroja', boots: 'Buty', amulet: 'Amulet', ring: 'Pierścień' },
  slotIcons: { weapon: '⚔️', helmet: '🪖', armor: '🛡️', boots: '🥾', amulet: '📿', ring: '💍' },

  toggle() {
    this.visible = !this.visible;
    const el = U.el('inventory-panel');
    el.classList.add('panel');
    el.style.display = this.visible ? 'block' : 'none';
    if (this.visible) { Game.s.paused = true; this.render(); }
    else { Game.s.paused = false; ItemTip.hide(); }
  },

  render() {
    const p = Game.s.p, d = p.d;
    const el = U.el('inventory-panel');

    let equipHtml = '';
    for (const slot in p.equip) {
      const it = p.equip[slot];
      equipHtml += `<div class="equip-slot" data-slot="${slot}" ${it ? `data-uid="${it.uid}"` : ''}>
        <span class="es-icon">${it ? it.icon : this.slotIcons[slot]}</span>
        <div class="es-info">
          <div class="es-name" style="color:${it ? ItemDB.rarities[it.rarity].color : '#5a5372'}">${it ? U.esc(it.name) + (it.plus ? ' +' + it.plus : '') : '—'}</div>
          <div class="es-type">${this.slotNames[slot]}</div>
        </div></div>`;
    }

    const statRows = [
      ['⚔️ Atak', Math.round(d.atk)],
      ['🛡️ Pancerz', Math.round(d.def) + ' (' + Math.round(d.def / (d.def + BAL.defK) * 100) + '%)'],
      ['💥 Krytyk', Math.round(d.crit * 100) + '% / ' + Math.round(d.critDmg * 100) + '%'],
      ['👟 Szybkość', d.speed.toFixed(1)],
      ['🔮 Moc umiej.', Math.round(d.spellPower * 100) + '%'],
      ['💨 Unik', Math.round(d.dodge * 100) + '%'],
      ['🧛 Kradzież życia', Math.round(d.lifesteal * 100) + '%'],
      ['⏳ Skróc. odnowień', Math.round(d.cdr * 100) + '%'],
    ].map(([n, v]) => `${n}<b>${v}</b><br>`).join('');

    let bodyHtml = '';
    if (this.tab === 'items') {
      let cells = '';
      for (const it of p.inv) {
        cells += `<div class="inv-cell r-${it.rarity}" data-uid="${it.uid}">
          ${it.icon}
          ${it.qty > 1 ? `<span class="ic-qty">${it.qty}</span>` : ''}
          ${it.plus ? `<span class="ic-plus">+${it.plus}</span>` : ''}
        </div>`;
      }
      for (let i = p.inv.length; i < p.invMax; i++) cells += '<div class="inv-cell"></div>';
      bodyHtml = `<div class="inv-grid">${cells}</div>
        <div class="inv-hint">LPM — załóż / użyj &nbsp;•&nbsp; PPM — przetop na Pył &nbsp;•&nbsp; Shift+LPM — wybierz do Kuźni</div>`;
    } else {
      const it = this.forgeItem;
      let info = 'Wybierz przedmiot z zakładki Przedmioty (Shift+LPM) lub kliknij założony.';
      let actions = '';
      if (it) {
        const cost = ItemDB.upgradeCost(it);
        info = `<span style="color:${ItemDB.rarities[it.rarity].color};font-weight:700">${U.esc(it.name)}${it.plus ? ' +' + it.plus : ''}</span><br>
          Poziom przedmiotu: ${it.lvl} • Ulepszenie: +${it.plus}/${BAL.upgradeMax}<br>
          ${it.plus < BAL.upgradeMax ? `Koszt ulepszenia: <b style="color:#ffd84d">✨${cost.dust} + 💰${cost.gold}</b> (+12% statystyk)` : '<b>Maksymalne ulepszenie!</b>'}`;
        actions = `
          ${it.plus < BAL.upgradeMax ? `<button onclick="InvUI.doUpgrade()">⚒️ Ulepsz (+${it.plus + 1})</button>` : ''}
          ${it.rarity !== 'common' ? `<button onclick="InvUI.doReroll()">🎲 Przelosuj afiksy (✨${BAL.rerollDust})</button>` : ''}
          <button onclick="InvUI.doSalvage()">🔥 Przetop (+✨${ItemDB.salvageValue(it)})</button>`;
      }
      bodyHtml = `<div class="forge-box">
        <div class="f-row">
          <div class="forge-sel">${it ? it.icon : '❔'}</div>
          <div class="forge-info">${info}</div>
        </div>
        <div class="forge-actions">${actions}</div>
      </div>
      <div class="inv-hint">Pył Otchłani ✨ zdobywasz przetapiając niepotrzebne przedmioty. Ulepszenia zachowują afiksy.</div>`;
    }

    el.innerHTML = `
      <button class="panel-close" onclick="InvUI.toggle()">✕</button>
      <h3>🎒 Ekwipunek</h3>
      <div class="p-sub">${U.esc(p.name)} • poz. ${p.level} • 💰 ${U.fmt(p.gold)} • ✨ ${U.fmt(p.dust)} Pyłu</div>
      <div class="inv-layout">
        <div class="inv-left">
          <div class="equip-grid">${equipHtml}</div>
          <div class="char-stats">${statRows}</div>
        </div>
        <div class="inv-right">
          <div class="inv-tabs">
            <button class="inv-tab ${this.tab === 'items' ? 'active' : ''}" onclick="InvUI.setTab('items')">Przedmioty (${p.inv.length}/${p.invMax})</button>
            <button class="inv-tab ${this.tab === 'forge' ? 'active' : ''}" onclick="InvUI.setTab('forge')">⚒️ Kuźnia</button>
          </div>
          ${bodyHtml}
        </div>
      </div>`;

    this.bindCells(el);
  },

  bindCells(el) {
    const p = Game.s.p;
    el.querySelectorAll('.inv-cell[data-uid]').forEach(cell => {
      const it = p.inv.find(i => i.uid == cell.dataset.uid);
      if (!it) return;
      cell.onmouseenter = ev => ItemTip.show(it, ev);
      cell.onmousemove = ev => ItemTip.move(ev);
      cell.onmouseleave = () => ItemTip.hide();
      cell.onclick = ev => {
        ItemTip.hide();
        if (ev.shiftKey && it.kind === 'equip') { this.forgeItem = it; this.tab = 'forge'; this.render(); return; }
        if (it.kind === 'equip') Inv.equip(it);
        else Inv.useConsumable(it);
        this.render();
      };
      cell.oncontextmenu = ev => {
        ev.preventDefault();
        ItemTip.hide();
        if (it.kind === 'equip') Inv.salvage(it);
        else Inv.useConsumable(it);
      };
    });
    el.querySelectorAll('.equip-slot').forEach(slotEl => {
      const slot = slotEl.dataset.slot;
      const it = p.equip[slot];
      if (it) {
        slotEl.onmouseenter = ev => ItemTip.show(it, ev);
        slotEl.onmousemove = ev => ItemTip.move(ev);
        slotEl.onmouseleave = () => ItemTip.hide();
      }
      slotEl.onclick = ev => {
        ItemTip.hide();
        if (!it) return;
        if (ev.shiftKey) { this.forgeItem = it; this.tab = 'forge'; this.render(); return; }
        Inv.unequip(slot);
        this.render();
      };
    });
  },

  setTab(t) { this.tab = t; this.render(); },
  doUpgrade() { if (this.forgeItem) Inv.upgrade(this.forgeItem); },
  doReroll() { if (this.forgeItem) Inv.reroll(this.forgeItem); },
  doSalvage() {
    if (!this.forgeItem) return;
    const p = Game.s.p;
    // jeśli założony — najpierw zdejmij
    for (const slot in p.equip) if (p.equip[slot] === this.forgeItem) { Inv.unequip(slot); break; }
    if (p.inv.includes(this.forgeItem)) Inv.salvage(this.forgeItem);
    this.forgeItem = null;
    this.render();
  },
};

// ===== TOOLTIP PRZEDMIOTU =====
const ItemTip = {
  show(item, ev) {
    const el = U.el('item-tooltip');
    const rar = ItemDB.rarities[item.rarity];
    let html = `<div class="tt-name" style="color:${rar.color}">${U.esc(item.name)}${item.plus ? ' +' + item.plus : ''}</div>`;
    if (item.kind === 'equip') {
      html += `<div class="tt-type"><span class="rc ${item.rarity}">${rar.name}</span> • ${InvUI.slotNames[item.slot]} • poz. ${item.lvl}</div>`;
      const plusMult = 1 + item.plus * .12;
      for (const k in item.stats) {
        const names = { atk: 'Atak', def: 'Pancerz', hp: 'Zdrowie', mp: 'Mana' };
        html += `<div class="tt-stat">+${Math.round(item.stats[k] * plusMult)} ${names[k] || k}</div>`;
      }
      for (const a of item.affixes) {
        html += `<div class="tt-affix">◆ ${ItemDB.affixes[a.id].txt(a.val)}</div>`;
      }
      if (item.legendTxt) html += `<div class="tt-legend">★ ${item.legendTxt}</div>`;
      if (item.flavor) html += `<div class="tt-flavor">„${item.flavor}"</div>`;
      html += this.compareHtml(item);
      html += `<div class="tt-actions">Wartość: 💰${ItemDB.sellPrice(item)} • Przetop: ✨${ItemDB.salvageValue(item)}</div>`;
    } else {
      const def = ItemDB.consumables[item.cid];
      html += `<div class="tt-type">Konsument${item.qty > 1 ? ' ×' + item.qty : ''}</div>`;
      html += `<div>${def.desc}</div>`;
    }
    el.innerHTML = html;
    el.style.display = 'block';
    this.move(ev);
  },
  // porównanie z założonym przedmiotem w tym slocie
  compareHtml(item) {
    if (!Game.s || item.kind !== 'equip') return '';
    const eq = Game.s.p.equip[item.slot];
    if (!eq || eq === item) return '';
    const val = (it, k) => Math.round((it.stats[k] || 0) * (1 + it.plus * .12));
    const names = { atk: 'ataku', def: 'pancerza', hp: 'HP', mp: 'MP' };
    let rows = '';
    for (const k of ['atk', 'def', 'hp', 'mp']) {
      const d = val(item, k) - val(eq, k);
      if (!d) continue;
      rows += `<div style="color:${d > 0 ? '#7ae08a' : '#ff7a6a'}">${d > 0 ? '▲ +' : '▼ '}${d} ${names[k]}</div>`;
    }
    const eqRar = ItemDB.rarities[eq.rarity];
    return `<div class="tt-actions">vs założony: <span style="color:${eqRar.color}">${U.esc(eq.name)}${eq.plus ? ' +' + eq.plus : ''}</span>${rows || '<div style="color:#7a6f96">te same statystyki bazowe</div>'}</div>`;
  },

  move(ev) {
    const el = U.el('item-tooltip');
    const x = Math.min(ev.clientX + 16, window.innerWidth - el.offsetWidth - 10);
    const y = Math.min(ev.clientY + 12, window.innerHeight - el.offsetHeight - 10);
    el.style.left = x + 'px'; el.style.top = y + 'px';
  },
  hide() { U.el('item-tooltip').style.display = 'none'; },
};
