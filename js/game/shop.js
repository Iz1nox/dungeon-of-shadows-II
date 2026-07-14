'use strict';

// Sklep wędrownego handlarza (piętra 2, 5, 8, 11, 14 + Głębia).
const Shop = {
  visible: false,
  stock: null,

  genStock() {
    const s = Game.s, floor = s.floor, luck = s.p.d.luck;
    const stock = [];
    // 3-4 sztuki ekwipunku (min. magiczne)
    const n = U.randi(3, 4);
    for (let i = 0; i < n; i++) {
      let rarity = ItemDB.rollRarity(floor + 1, luck + 1);
      if (rarity === 'common') rarity = 'magic';
      stock.push({ item: ItemDB.rollEquip(floor, { rarity, luck }), sold: false });
    }
    // konsumenty
    const cons = floor < 6
      ? ['potion_hp_s', 'potion_hp_m', 'potion_mp_s', 'antidote', 'bomb_fire']
      : ['potion_hp_m', 'potion_hp_l', 'potion_mp_m', 'elixir_fury', 'elixir_stone', 'scroll_bless', 'bomb_fire'];
    for (const cid of U.shuffle(cons).slice(0, 4)) {
      stock.push({ item: ItemDB.makeConsumable(cid), sold: false });
    }
    return stock;
  },

  open() {
    const s = Game.s;
    if (!s.shopStock) s.shopStock = this.genStock();
    this.stock = s.shopStock;
    this.visible = true;
    s.paused = true;
    const el = U.el('shop-panel');
    el.classList.add('panel');
    el.style.display = 'block';
    Sfx.play('click');
    this.render();
  },

  close() {
    this.visible = false;
    Game.s.paused = false;
    U.el('shop-panel').style.display = 'none';
    ItemTip.hide();
  },

  render() {
    const p = Game.s.p;
    const el = U.el('shop-panel');
    let items = '';
    this.stock.forEach((entry, i) => {
      const it = entry.item;
      const price = Math.round(ItemDB.price(it) * 1.15);
      const rar = ItemDB.rarities[it.rarity];
      const desc = it.kind === 'consumable' ? ItemDB.consumables[it.cid].desc
        : `${rar.name} • poz. ${it.lvl}`;
      items += `<div class="shop-item ${entry.sold ? 'sold' : ''}" data-i="${i}">
        <span class="si-icon">${it.icon}</span>
        <div class="si-body">
          <div class="si-name" style="color:${rar.color}">${U.esc(it.name)}</div>
          <div class="si-desc">${U.esc(desc)}</div>
        </div>
        <span class="si-price">💰${price}</span>
      </div>`;
    });

    // sprzedaż: przedmioty gracza
    let sellables = p.inv.filter(i => i.kind === 'equip');
    let sellHtml = '';
    if (sellables.length) {
      sellHtml = '<h3 style="margin-top:16px;font-size:15px">Sprzedaj</h3><div class="shop-grid">';
      for (const it of sellables.slice(0, 8)) {
        const rar = ItemDB.rarities[it.rarity];
        sellHtml += `<div class="shop-item" data-sell="${it.uid}">
          <span class="si-icon">${it.icon}</span>
          <div class="si-body"><div class="si-name" style="color:${rar.color}">${U.esc(it.name)}${it.plus ? ' +' + it.plus : ''}</div>
          <div class="si-desc">${rar.name}</div></div>
          <span class="si-price">+💰${ItemDB.sellPrice(it)}</span>
        </div>`;
      }
      sellHtml += '</div>';
    }

    el.innerHTML = `
      <button class="panel-close" onclick="Shop.close()">✕</button>
      <h3>🧙 Wędrowny Handlarz</h3>
      <div class="p-sub">„Zszedłem tu przed tobą. Nie pytaj jak."</div>
      <div class="shop-gold">Twoje złoto: 💰 ${U.fmt(p.gold)} &nbsp;•&nbsp; ✨ ${U.fmt(p.dust)} Pyłu</div>
      <div class="shop-grid">${items}</div>
      ${sellHtml}
      <div class="shop-sell-hint">Najedź, by zobaczyć szczegóły. Kliknij, by kupić / sprzedać. [Esc] zamyka.</div>`;

    el.querySelectorAll('.shop-item[data-i]').forEach(div => {
      const entry = this.stock[+div.dataset.i];
      if (entry.sold) return;
      div.onmouseenter = ev => ItemTip.show(entry.item, ev);
      div.onmousemove = ev => ItemTip.move(ev);
      div.onmouseleave = () => ItemTip.hide();
      div.onclick = () => this.buy(+div.dataset.i);
    });
    el.querySelectorAll('.shop-item[data-sell]').forEach(div => {
      const it = p.inv.find(i => i.uid == div.dataset.sell);
      if (!it) return;
      div.onmouseenter = ev => ItemTip.show(it, ev);
      div.onmousemove = ev => ItemTip.move(ev);
      div.onmouseleave = () => ItemTip.hide();
      div.onclick = () => this.sell(it);
    });
  },

  buy(i) {
    const p = Game.s.p;
    const entry = this.stock[i];
    if (!entry || entry.sold) return;
    const price = Math.round(ItemDB.price(entry.item) * 1.15);
    if (p.gold < price) { Sfx.play('error'); Game.msg('💰 Za mało złota!', 'bad'); return; }
    if (!Inv.addItem(entry.item)) { Sfx.play('error'); Game.msg('🎒 Ekwipunek pełny!', 'bad'); return; }
    p.gold -= price;
    entry.sold = true;
    Sfx.play('gold');
    Game.msg('🧙 Kupiono: ' + entry.item.name, 'gold');
    ItemTip.hide();
    this.render();
  },

  sell(item) {
    const p = Game.s.p;
    const idx = p.inv.indexOf(item);
    if (idx < 0) return;
    p.inv.splice(idx, 1);
    const price = ItemDB.sellPrice(item);
    p.gold += price;
    Sfx.play('gold');
    Game.msg('🧙 Sprzedano: ' + item.name + ' (+' + price + ' 💰)', 'gold');
    ItemTip.hide();
    this.render();
  },
};
