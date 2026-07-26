'use strict';

// Wędrowny Handlarz — tożsamość, progi zaufania i kwestie.
// Reputacja rośnie w obrębie jednej wyprawy: im więcej z nim handlujesz,
// tym lepsze ceny, lepszy asortyment, a w końcu towar spod lady.
const MerchantDB = {
  name: 'Wit Popielny',
  role: 'Wędrowny Handlarz',

  // progi zaufania (at = wymagane punkty)
  tiers: [
    { at: 0,   name: 'Nieznajomy',        discount: 0,   luck: 0, underCounter: false },
    { at: 25,  name: 'Znajomy',           discount: .05, luck: 0, underCounter: false },
    { at: 60,  name: 'Stały Klient',      discount: .09, luck: 1, underCounter: false },
    { at: 110, name: 'Wspólnik',          discount: .13, luck: 1, underCounter: true },
    { at: 180, name: 'Powiernik Otchłani', discount: .18, luck: 2, underCounter: true },
  ],

  // kwestie zależne od poziomu zaufania
  greetings: [
    [
      '„Zszedłem tu przed tobą. Nie pytaj jak."',
      '„Nie znam cię. Ale twoje złoto znam doskonale."',
      '„Patrz, nie dotykaj. Chyba że płacisz."',
    ],
    [
      '„A, znowu ty. Żyjesz — to już coś."',
      '„Zapamiętałem twoją twarz. Rzadko mi się to zdarza."',
      '„Wracasz. Otchłań jeszcze cię nie strawiła."',
    ],
    [
      '„Dla ciebie zawsze mam chwilę. I lepszą cenę."',
      '„Odkładam co ciekawsze rzeczy. Wiem, że wrócisz."',
      '„Powoli zaczynam na ciebie liczyć. Nie zawiedź."',
    ],
    [
      '„Mam coś, czego nie pokazuję byle komu. Zajrzyj pod ladę."',
      '„Robimy interesy, ty i ja. Prawdziwe interesy."',
      '„Trzymam dla ciebie rzeczy, których nie powinienem mieć."',
    ],
    [
      '„Powiem ci szczerze: ja stąd nie wyjdę. Ale ty możesz."',
      '„Byłem tu, gdy schodził pierwszy bohater. Ciebie lubię bardziej."',
      '„Gdy przebijesz Serce, wspomnij, kto cię uzbroił."',
    ],
  ],

  // komentarz do bieżącej krainy
  biomeLines: {
    catacombs: 'Kości nie skupuję. Mam ich aż nadto.',
    fungal:    'Nie oddychaj głęboko. Zarodniki liczę jak podatek.',
    frozen:    'Palce mi grabieją, więc licz szybko.',
    inferno:   'Towar się topi, ceny rosną. Taka logika.',
    mirror:    'Widziałem tu siebie trzy razy. Żaden nie chciał handlować.',
    heart:     'Dalej nie schodzę. Nawet ja mam granice.',
    endless:   'Ty naprawdę nie umiesz przestać, co?',
  },

  tierIndex(rep) {
    let idx = 0;
    for (let i = 0; i < this.tiers.length; i++) if (rep >= this.tiers[i].at) idx = i;
    return idx;
  },

  tier(rep) { return this.tiers[this.tierIndex(rep)]; },

  nextTier(rep) {
    const i = this.tierIndex(rep);
    return i + 1 < this.tiers.length ? this.tiers[i + 1] : null;
  },

  greeting(rep, floorSeed) {
    const list = this.greetings[this.tierIndex(rep)];
    return list[floorSeed % list.length];
  },

  biomeLine(biomeId) { return this.biomeLines[biomeId] || ''; },
};
