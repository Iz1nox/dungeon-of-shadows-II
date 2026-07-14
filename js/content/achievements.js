'use strict';

const AchievementDB = {
  list: [
    { id: 'first_blood', name: 'Pierwsza Krew', icon: '🩸', desc: 'Zabij pierwszego wroga.' },
    { id: 'hundred', name: 'Setka', icon: '💯', desc: 'Zabij 100 wrogów (łącznie).' },
    { id: 'butcher', name: 'Rzeźnik', icon: '🔪', desc: 'Zabij 1000 wrogów (łącznie).' },
    { id: 'floor5', name: 'Coraz Głębiej', icon: '🕳️', desc: 'Dotrzyj na 5. piętro.' },
    { id: 'floor10', name: 'Połowa Drogi', icon: '⛏️', desc: 'Dotrzyj na 10. piętro.' },
    { id: 'floor16', name: 'U Bram', icon: '🚪', desc: 'Dotrzyj do Serca Otchłani.' },
    { id: 'winner', name: 'Pogromca Serca', icon: '🫀', desc: 'Przebij Serce Otchłani.' },
    { id: 'endless5', name: 'Bez Dna', icon: '🌀', desc: 'Zejdź 5 pięter w Głębię Bez Dna.' },
    { id: 'legend_find', name: 'Legenda', icon: '🌟', desc: 'Znajdź legendarny przedmiot.' },
    { id: 'forge10', name: 'Arcykowal', icon: '⚒️', desc: 'Ulepsz przedmiot do +10.' },
    { id: 'rich', name: 'Bogacz', icon: '💰', desc: 'Miej 5000 złota naraz.' },
    { id: 'level20', name: 'Weteran', icon: '🎖️', desc: 'Osiągnij 20. poziom.' },
    { id: 'elite25', name: 'Pogromca Elit', icon: '👑', desc: 'Zabij 25 elitarnych wrogów (łącznie).' },
    { id: 'dash100', name: 'Tancerz', icon: '💃', desc: 'Wykonaj 100 uników (łącznie).' },
    { id: 'tourist', name: 'Turysta', icon: '🪦', desc: 'Zgiń na 1. piętrze.' },
    { id: 'all_classes', name: 'Sześć Twarzy', icon: '🎭', desc: 'Zagraj każdą z 6 klas.' },
    { id: 'boss_nohit', name: 'Nietykalny', icon: '👻', desc: 'Pokonaj bossa bez otrzymania obrażeń.' },
    { id: 'mimic_slayer', name: 'To Nie Skrzynia!', icon: '📦', desc: 'Zabij Mimika.' },
  ],
  byId(id) { return this.list.find(a => a.id === id); },
};
