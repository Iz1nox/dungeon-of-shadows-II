'use strict';

// Wędrowny Handlarz — hub handlowy: towary (z wyróżnioną perełką i odświeżaniem),
// hazard na nieopisane przedmioty oraz sprzedaż hurtem z odkupem i wymianą na Pył.
const Shop = {
  visible: false,
  tab: 'goods',

  // stan sklepu żyje w stanie wyprawy (trafia do zapisu)
  state() {
    const s = Game.s;
    if (!s.shop) s.shop = { stock: this.genStock(), refreshes: 0, buyback: [], gambles: 0, underCounter: null };
    return s.shop;
  },

  // ===== ZAUFANIE HANDLARZA =====
  rep() { return Game.s.shopRep || 0; },
  tier() { return MerchantDB.tier(this.rep()); },

  addRep(points) {
    const s = Game.s;
    const before = MerchantDB.tierIndex(s.shopRep || 0);
    s.shopRep = (s.shopRep || 0) + points;
    const after = MerchantDB.tierIndex(s.shopRep);
    if (after > before) {
      const t = MerchantDB.tiers[after];
      Sfx.play('achieve');
      Game.msg('🤝 ' + MerchantDB.name + ' ufa ci bardziej: ' + t.name
        + ' (zniżka ' + Math.round(t.discount * 100) + '%)', 'gold');
      if (t.underCounter && !this.state().underCounter) {
        Game.msg('🕯️ „Zajrzyj pod ladę. Mam tam coś dla ciebie."', 'magic');
      }
      if (after === MerchantDB.tiers.length - 1) Meta.unlock('confidant');
    }
  },

  // towar spod lady pojawia się, gdy zaufanie na to pozwala
  ensureUnderCounter() {
    const st = this.state();
    if (!this.tier().underCounter || st.underCounter) return;
    const s = Game.s;
    st.underCounter = {
      item: ItemDB.rollEquip(s.floor, { rarity: ItemDB.underCounterRarity(), luck: s.p.d.luck + 2 }),
      sold: false, under: true,
    };
  },

  // ===== ASORTYMENT =====
  genStock() {
    const s = Game.s, floor = s.floor;
    // zaufany klient dostaje lepszy towar
    const luck = s.p.d.luck + (s.shopRep ? MerchantDB.tier(s.shopRep).luck : 0);
    const stock = [];
    // wyróżniona perełka — zawsze wysoka rzadkość
    stock.push({ item: ItemDB.rollEquip(floor, { rarity: ItemDB.shopFeaturedRarity(), luck }),
      sold: false, featured: true });
    // zwykły towar
    for (let i = 0; i < U.randi(3, 4); i++) {
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

  priceOf(entry) {
    const mult = entry.under ? BAL.underCounterMarkup
      : entry.featured ? BAL.shopFeaturedMarkup : BAL.shopMarkup;
    return Math.max(1, Math.round(ItemDB.price(entry.item) * mult * (1 - this.tier().discount)));
  },

  refreshCost() {
    const st = this.state();
    return Math.round((BAL.shopRefreshBase + Game.s.floor * BAL.shopRefreshPerFloor)
      * Math.pow(BAL.shopRefreshGrowth, st.refreshes));
  },

  gamblePrice() {
    return Math.round(BAL.gambleBase + Game.s.floor * BAL.gamblePerFloor);
  },

  // ===== OTWIERANIE =====
  open() {
    this.state();
    this.visible = true;
    Game.s.paused = true;
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

  setTab(t) { this.tab = t; ItemTip.hide(); this.render(); },

  // ===== RENDER =====
  render() {
    const p = Game.s.p;
    const el = U.el('shop-panel');
    const body = this.tab === 'gamble' ? this.renderGamble()
      : this.tab === 'sell' ? this.renderSell()
        : this.renderGoods();

    const rep = this.rep(), tier = this.tier(), next = MerchantDB.nextTier(rep);
    const tierIdx = MerchantDB.tierIndex(rep);
    const prevAt = MerchantDB.tiers[tierIdx].at;
    const pct = next ? U.clamp((rep - prevAt) / (next.at - prevAt) * 100, 0, 100) : 100;
    const biomeLine = MerchantDB.biomeLine(Game.s.map.biome.id);

    el.innerHTML = `
      <button class="panel-close" onclick="Shop.close()">✕</button>
      <h3>🧙 ${MerchantDB.name}</h3>
      <div class="p-sub">${MerchantDB.role} • ${MerchantDB.greeting(rep, Game.s.floor)}</div>
      ${biomeLine ? `<div class="shop-biome-line">„${U.esc(biomeLine)}"</div>` : ''}
      <div class="shop-rep">
        <div class="rep-head">
          <span>🤝 ${tier.name}${tier.discount ? ' — zniżka ' + Math.round(tier.discount * 100) + '%' : ''}</span>
          <span class="rep-next">${next ? 'do „' + next.name + '": ' + Math.max(0, Math.ceil(next.at - rep)) : 'najwyższe zaufanie'}</span>
        </div>
        <div class="rep-bar"><i style="width:${pct}%"></i></div>
      </div>
      <div class="shop-gold">💰 ${U.fmt(p.gold)} złota &nbsp;•&nbsp; ✨ ${U.fmt(p.dust)} Pyłu</div>
      <div class="inv-tabs">
        <button class="inv-tab ${this.tab === 'goods' ? 'active' : ''}" onclick="Shop.setTab('goods')">🛒 Towary</button>
        <button class="inv-tab ${this.tab === 'gamble' ? 'active' : ''}" onclick="Shop.setTab('gamble')">🎲 Hazard</button>
        <button class="inv-tab ${this.tab === 'sell' ? 'active' : ''}" onclick="Shop.setTab('sell')">💰 Sprzedaż</button>
      </div>
      ${body}`;

    this.bind(el);
  },

  renderGoods() {
    const st = this.state(), p = Game.s.p;
    this.ensureUnderCounter();
    const cost = this.refreshCost();
    let items = '';
    st.stock.forEach((entry, i) => {
      const it = entry.item;
      const price = this.priceOf(entry);
      const rar = ItemDB.rarities[it.rarity];
      const desc = it.kind === 'consumable' ? ItemDB.consumables[it.cid].desc
        : `${rar.name} • poz. ${it.lvl}`;
      items += `<div class="shop-item ${entry.sold ? 'sold' : ''} ${entry.featured ? 'featured' : ''}" data-i="${i}">
        ${entry.featured ? '<span class="si-badge">PEREŁKA</span>' : ''}
        <span class="si-icon">${it.icon}</span>
        <div class="si-body">
          <div class="si-name" style="color:${rar.color}">${U.esc(it.name)}</div>
          <div class="si-desc">${U.esc(desc)}</div>
        </div>
        <span class="si-price ${p.gold < price ? 'cant' : ''}">💰${price}</span>
      </div>`;
    });

    // odkup ostatnio sprzedanych
    let buyback = '';
    if (st.buyback.length) {
      buyback = '<div class="shop-sub">↩️ Odkup</div><div class="shop-grid">';
      st.buyback.forEach((b, i) => {
        const rar = ItemDB.rarities[b.item.rarity];
        buyback += `<div class="shop-item" data-bb="${i}">
          <span class="si-icon">${b.item.icon}</span>
          <div class="si-body"><div class="si-name" style="color:${rar.color}">${U.esc(b.item.name)}</div>
          <div class="si-desc">sprzedane przed chwilą</div></div>
          <span class="si-price ${p.gold < b.price ? 'cant' : ''}">💰${b.price}</span>
        </div>`;
      });
      buyback += '</div>';
    }

    // towar spod lady — tylko dla zaufanych
    let under = '';
    if (st.underCounter && !st.underCounter.sold) {
      const it = st.underCounter.item;
      const rar = ItemDB.rarities[it.rarity];
      const price = this.priceOf(st.underCounter);
      under = `<div class="shop-sub">🕯️ Spod lady</div>
        <div class="shop-grid"><div class="shop-item under" data-under="1">
          <span class="si-icon">${it.icon}</span>
          <div class="si-body">
            <div class="si-name" style="color:${rar.color}">${U.esc(it.name)}</div>
            <div class="si-desc">${rar.name} • poz. ${it.lvl} • „Tego nie było na liście."</div>
          </div>
          <span class="si-price ${p.gold < price ? 'cant' : ''}">💰${price}</span>
        </div></div>`;
    }

    return `<div class="shop-grid">${items}</div>
      <div class="shop-actions">
        <button onclick="Shop.refresh()" ${p.gold < cost ? 'disabled' : ''}>🔄 Odśwież asortyment (💰${cost})</button>
      </div>
      ${under}
      ${buyback}
      <div class="shop-sell-hint">Kliknij, by kupić. Perełka to najlepszy towar na tym piętrze — droższa, ale warta swojej ceny.</div>`;
  },

  renderGamble() {
    const st = this.state(), p = Game.s.p;
    const price = this.gamblePrice();
    const kinds = [
      { id: 'weapon', icon: '⚔️', name: 'Nieopisana broń' },
      { id: 'armor', icon: '🛡️', name: 'Nieopisany pancerz' },
      { id: 'jewel', icon: '💍', name: 'Nieopisana biżuteria' },
    ];
    let boxes = '';
    for (const k of kinds) {
      boxes += `<div class="gamble-box" data-g="${k.id}">
        <div class="gb-icon">❓</div>
        <div class="gb-name">${k.icon} ${k.name}</div>
        <div class="gb-price ${p.gold < price ? 'cant' : ''}">💰 ${price}</div>
      </div>`;
    }
    return `<div class="gamble-grid">${boxes}</div>
      <div class="shop-sell-hint" style="margin-top:14px">
        Handlarz nie wie, co sprzedaje — i ty też się nie dowiesz, póki nie zapłacisz.
        Szanse na rzadkie przedmioty są wyraźnie lepsze niż przy zwykłym łupie.
        <br>Zaryzykowano na tej wyprawie: <b>${st.gambles}</b>
      </div>`;
  },

  renderSell() {
    const p = Game.s.p;
    const sellables = p.inv.filter(i => i.kind === 'equip');
    let list = '';
    if (!sellables.length) {
      list = '<div class="shop-sell-hint">Nie masz nic na sprzedaż.</div>';
    } else {
      list = '<div class="shop-grid">';
      for (const it of sellables) {
        const rar = ItemDB.rarities[it.rarity];
        list += `<div class="shop-item" data-sell="${it.uid}">
          <span class="si-icon">${it.icon}</span>
          <div class="si-body"><div class="si-name" style="color:${rar.color}">${U.esc(it.name)}${it.plus ? ' +' + it.plus : ''}</div>
          <div class="si-desc">${rar.name} • poz. ${it.lvl}</div></div>
          <span class="si-price">+💰${ItemDB.sellPrice(it)}</span>
        </div>`;
      }
      list += '</div>';
    }

    const bulk = [['common', 'zwykłe'], ['magic', 'magiczne'], ['rare', 'rzadkie']]
      .map(([r, label]) => {
        const n = sellables.filter(i => i.rarity === r).length;
        const sum = sellables.filter(i => i.rarity === r).reduce((a, i) => a + ItemDB.sellPrice(i), 0);
        return `<button onclick="Shop.sellAll('${r}')" ${n ? '' : 'disabled'}>
          Sprzedaj ${label} (${n}) ${n ? '+💰' + sum : ''}</button>`;
      }).join('');

    const dust25 = 25 * BAL.dustPrice, dust100 = 100 * BAL.dustPrice;
    return `${list}
      <div class="shop-sub">📦 Sprzedaż hurtem</div>
      <div class="shop-actions">${bulk}</div>
      <div class="shop-sub">🔁 Wymiana</div>
      <div class="shop-actions">
        <button onclick="Shop.buyDust(25)" ${p.gold < dust25 ? 'disabled' : ''}>💰${dust25} → ✨25 Pyłu</button>
        <button onclick="Shop.buyDust(100)" ${p.gold < dust100 ? 'disabled' : ''}>💰${dust100} → ✨100 Pyłu</button>
      </div>
      <div class="shop-sell-hint">Pył Otchłani napędza Kuźnię. Sprzedane przedmioty możesz odkupić w zakładce Towary.</div>`;
  },

  bind(el) {
    const p = Game.s.p, st = this.state();
    el.querySelectorAll('.shop-item[data-i]').forEach(div => {
      const entry = st.stock[+div.dataset.i];
      if (!entry || entry.sold) return;
      div.onmouseenter = ev => ItemTip.show(entry.item, ev);
      div.onmousemove = ev => ItemTip.move(ev);
      div.onmouseleave = () => ItemTip.hide();
      div.onclick = () => this.buy(+div.dataset.i);
    });
    el.querySelectorAll('.shop-item[data-under]').forEach(div => {
      const entry = st.underCounter;
      if (!entry || entry.sold) return;
      div.onmouseenter = ev => ItemTip.show(entry.item, ev);
      div.onmousemove = ev => ItemTip.move(ev);
      div.onmouseleave = () => ItemTip.hide();
      div.onclick = () => this.buyUnder();
    });
    el.querySelectorAll('.shop-item[data-bb]').forEach(div => {
      const b = st.buyback[+div.dataset.bb];
      if (!b) return;
      div.onmouseenter = ev => ItemTip.show(b.item, ev);
      div.onmousemove = ev => ItemTip.move(ev);
      div.onmouseleave = () => ItemTip.hide();
      div.onclick = () => this.rebuy(+div.dataset.bb);
    });
    el.querySelectorAll('.shop-item[data-sell]').forEach(div => {
      const it = p.inv.find(i => i.uid == div.dataset.sell);
      if (!it) return;
      div.onmouseenter = ev => ItemTip.show(it, ev);
      div.onmousemove = ev => ItemTip.move(ev);
      div.onmouseleave = () => ItemTip.hide();
      div.onclick = () => this.sell(it);
    });
    el.querySelectorAll('.gamble-box').forEach(div => {
      div.onclick = () => this.gamble(div.dataset.g);
    });
  },

  // ===== TRANSAKCJE =====
  buy(i) {
    const p = Game.s.p, st = this.state();
    const entry = st.stock[i];
    if (!entry || entry.sold) return;
    const price = this.priceOf(entry);
    if (p.gold < price) { Sfx.play('error'); Game.msg('💰 Za mało złota!', 'bad'); return; }
    if (!Inv.addItem(entry.item)) { Sfx.play('error'); Game.msg('🎒 Ekwipunek pełny!', 'bad'); return; }
    p.gold -= price;
    entry.sold = true;
    this.addRep(price * BAL.repPerGoldSpent);
    Sfx.play('gold');
    Game.msg('🧙 Kupiono: ' + entry.item.name, 'gold');
    ItemTip.hide();
    this.render();
  },

  buyUnder() {
    const p = Game.s.p, st = this.state();
    const entry = st.underCounter;
    if (!entry || entry.sold) return;
    const price = this.priceOf(entry);
    if (p.gold < price) { Sfx.play('error'); Game.msg('💰 Za mało złota!', 'bad'); return; }
    if (!Inv.addItem(entry.item)) { Sfx.play('error'); Game.msg('🎒 Ekwipunek pełny!', 'bad'); return; }
    p.gold -= price;
    entry.sold = true;
    this.addRep(price * BAL.repPerGoldSpent);
    if (entry.item.rarity === 'legend') Meta.unlock('legend_find');
    Sfx.play('achieve');
    Game.msg('🕯️ Spod lady: ' + entry.item.name, 'gold');
    this.flashReveal(entry.item);
    ItemTip.hide();
    this.render();
  },

  sell(item) {
    const p = Game.s.p, st = this.state();
    const idx = p.inv.indexOf(item);
    if (idx < 0) return;
    p.inv.splice(idx, 1);
    const price = ItemDB.sellPrice(item);
    p.gold += price;
    st.buyback.unshift({ item, price });
    while (st.buyback.length > BAL.buybackSlots) st.buyback.pop();
    this.addRep(price * BAL.repPerGoldEarned);
    Sfx.play('gold');
    Game.msg('🧙 Sprzedano: ' + item.name + ' (+' + price + ' 💰)', 'gold');
    ItemTip.hide();
    this.render();
  },

  sellAll(rarity) {
    const p = Game.s.p;
    const batch = p.inv.filter(i => i.kind === 'equip' && i.rarity === rarity);
    if (!batch.length) { Sfx.play('error'); return; }
    let sum = 0;
    for (const it of batch) {
      const idx = p.inv.indexOf(it);
      if (idx >= 0) p.inv.splice(idx, 1);
      sum += ItemDB.sellPrice(it);
    }
    p.gold += sum;
    this.addRep(sum * BAL.repPerGoldEarned);
    Sfx.play('gold');
    Game.msg('🧙 Sprzedano ' + batch.length + ' szt. (+' + sum + ' 💰)', 'gold');
    this.render();
  },

  rebuy(i) {
    const p = Game.s.p, st = this.state();
    const b = st.buyback[i];
    if (!b) return;
    if (p.gold < b.price) { Sfx.play('error'); Game.msg('💰 Za mało złota!', 'bad'); return; }
    if (!Inv.addItem(b.item)) { Sfx.play('error'); Game.msg('🎒 Ekwipunek pełny!', 'bad'); return; }
    p.gold -= b.price;
    st.buyback.splice(i, 1);
    Sfx.play('pickup');
    Game.msg('↩️ Odkupiono: ' + b.item.name, 'gold');
    ItemTip.hide();
    this.render();
  },

  refresh() {
    const p = Game.s.p, st = this.state();
    const cost = this.refreshCost();
    if (p.gold < cost) { Sfx.play('error'); Game.msg('💰 Za mało złota!', 'bad'); return; }
    p.gold -= cost;
    st.refreshes++;
    st.stock = this.genStock();
    Sfx.play('forge');
    Game.msg('🔄 Handlarz rozkłada nowy towar.', 'sys');
    ItemTip.hide();
    this.render();
  },

  gamble(kind) {
    const s = Game.s, p = s.p, st = this.state();
    const price = this.gamblePrice();
    if (p.gold < price) { Sfx.play('error'); Game.msg('💰 Za mało złota!', 'bad'); return; }
    if (p.inv.length >= p.invMax) { Sfx.play('error'); Game.msg('🎒 Ekwipunek pełny!', 'bad'); return; }

    const slots = kind === 'weapon' ? ['weapon']
      : kind === 'armor' ? ['helmet', 'armor', 'boots']
        : ['amulet', 'ring'];
    const slot = U.choice(slots);
    let rarity = ItemDB.rollRarity(s.floor + BAL.gambleLuck, p.d.luck + 2);
    if (rarity === 'common') rarity = 'magic';
    const item = ItemDB.rollEquip(s.floor, { slot, rarity, luck: p.d.luck + 2 });

    p.gold -= price;
    st.gambles++;
    this.addRep(BAL.repPerGamble);
    Inv.addItem(item);

    Meta.data.stats.gambles = (Meta.data.stats.gambles || 0) + 1;
    if (Meta.data.stats.gambles >= 15) Meta.unlock('gambler');
    if (item.rarity === 'legend') { Meta.unlock('lucky'); Meta.unlock('legend_find'); }
    Meta.save();

    const rar = ItemDB.rarities[item.rarity];
    const big = ['epic', 'set', 'legend'].includes(item.rarity);
    Sfx.play(big ? 'achieve' : 'chest');
    Game.msg((big ? '🎲✨ ' : '🎲 ') + 'Nieopisany przedmiot to: ' + item.name + ' [' + rar.name + ']',
      big ? 'gold' : 'magic');
    this.flashReveal(item);
    this.render();
  },

  // krótkie ujawnienie wylosowanego przedmiotu
  flashReveal(item) {
    const rar = ItemDB.rarities[item.rarity];
    const el = U.el('gamble-reveal');
    el.innerHTML = `<div class="gr-icon">${item.icon}</div>
      <div class="gr-name" style="color:${rar.color}">${U.esc(item.name)}</div>
      <div class="gr-rar" style="color:${rar.color}">${rar.name}</div>`;
    el.classList.add('show');
    clearTimeout(this._revealT);
    this._revealT = setTimeout(() => el.classList.remove('show'), 2200);
  },

  buyDust(n) {
    const p = Game.s.p;
    const cost = n * BAL.dustPrice;
    if (p.gold < cost) { Sfx.play('error'); Game.msg('💰 Za mało złota!', 'bad'); return; }
    p.gold -= cost;
    p.dust += n;
    Sfx.play('forge');
    Game.msg('🔁 Wymieniono 💰' + cost + ' na ✨' + n + ' Pyłu.', 'sys');
    this.render();
  },
};
