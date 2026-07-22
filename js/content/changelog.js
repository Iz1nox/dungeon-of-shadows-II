'use strict';

// Historia aktualizacji — wyświetlana w menu „Nowości".
const ChangelogDB = [
  {
    v: '1.4.0', date: '17.07.2026', name: 'Otchłań w Kieszeni',
    items: [
      '📱 <b>Pełna obsługa telefonów i tabletów</b>: wirtualny joystick, auto-celowanie w najbliższego wroga, dotykowe przyciski ataku, uniku i umiejętności',
      '🎯 Wskaźnik auto-celu — widzisz, w kogo polecą strzały',
      '📲 Grę można zainstalować jak aplikację (PWA) i grać <b>offline</b>',
      '🖥️ Interfejs dopasowuje się do małych ekranów (HUD, panele, ekran tytułowy)',
    ],
  },
  {
    v: '1.3.0', date: '16.07.2026', name: 'Rekordy i Koszmar',
    items: [
      '🎚️ Trzy poziomy trudności do wyboru na ekranie tytułowym: <b>Wędrowiec</b> (łagodniej), <b>Śmiałek</b> i <b>Koszmar</b> (+50% HP wrogów, więcej elit, ale esencja ×1,6)',
      '🏆 Panel „Rekordy": najgłębsze zejście, najszybsze zwycięstwo, rekordy zabójstw, poziomu i złota',
      '📊 Podsumowanie piętra przy zejściu na kolejne (zabójstwa, złoto, łupy, czas)',
      '💀 Filmowe intro bossów przy pierwszym spotkaniu',
      '🔗 Ikona gry w karcie przeglądarki i ładny podgląd linku przy udostępnianiu',
    ],
  },
  {
    v: '1.2.0', date: '16.07.2026', name: 'Głos Graczy',
    items: [
      '⭐ Awans nie przerywa już gry — punkty talentu się kumulują, wybierasz je klawiszem <b>T</b>, kiedy chcesz (Esc odkłada wybór)',
      '⚔️ Trudność w górę: wrogowie mocniej skalują się z piętrem, jest ich więcej, elity częstsze, czujniej reagują',
      '❤️ Wolniejsza pasywna regeneracja zdrowia — mikstury znów mają znaczenie',
      '👁️ Czytelność: dekoracje podłóg są mniejsze i przygaszone, przedmioty na ziemi mniejsze, z podstawką i obwódką rzadkości',
      '📜 Ten panel — historia aktualizacji w menu',
    ],
  },
  {
    v: '1.1.0', date: '15.07.2026', name: 'Echa i Wygody',
    items: [
      '🎵 Proceduralna muzyka ambientowa — każdy biom ma własny motyw (suwak w ustawieniach)',
      '▶️ Przycisk „Kontynuuj" na ekranie tytułowym (z autozapisu)',
      '⚖️ Tooltip przedmiotu porównuje statystyki z założonym',
      '🧹 Premia Esencji Dusz za wyczyszczenie całego piętra',
      '⏸️ Auto-pauza przy przełączeniu okna; klawisz F działa jak E',
      '🔧 Naprawione panele menu tytułowego; Mimik nie skaluje się już podwójnie',
    ],
  },
  {
    v: '1.0.0', date: '13.07.2026', name: 'Serce Otchłani',
    items: [
      '🫀 Premiera! 16 pięter przez 5 skażonych krain aż do Serca Otchłani',
      '🎭 6 klas (nowi: Paladyn i Łowca Pustki), po 5 umiejętności z ultą',
      '💨 Unik z nietykalnością, statusy żywiołowe, elity z afiksami, 6 bossów z fazami',
      '⚒️ Przedmioty 5 rzadkości, 10 legend, Kuźnia, talenty, sklepy, eventy mapowe',
      '🔮 Sanktuarium Dusz, 18 osiągnięć, bestiariusz, Głębia Bez Dna',
    ],
  },
];
