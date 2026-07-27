'use strict';

// Historia aktualizacji — wyświetlana w menu „Nowości".
const ChangelogDB = [
  {
    v: '1.7.2', date: '27.07.2026', name: 'Ogień Nie Wybiera',
    items: [
      '🔥 <b>Lawa, kolce, jad i pustka ranią teraz także wrogów</b> — obrażenia zależą od ich puli zdrowia, więc parzą i szczura, i golema',
      '🧠 Około 70% przeciwników omija zagrożenia; reszta brnie prosto przez ogień. Szarżujący, skaczący i bombowce <b>zawsze</b> pchają się na oślep — da się je wmanewrować w płomienie',
      '🛡️ Odporności działają: Golem Magmowy ledwo czuje lawę',
      '👑 Bossowie stąpają ponad zagrożeniami — na nich ta sztuczka nie zadziała',
    ],
  },
  {
    v: '1.7.1', date: '27.07.2026', name: 'Szlify',
    items: [
      '⌨️ Przytrzymanie <b>Tab</b> nie miga już mapą — akcje reagują raz na wciśnięcie klawisza (dotyczy też uniku i umiejętności)',
      '🧪 Pod maską: zestaw 52 automatycznych testów, które przed każdą aktualizacją sprawdzają walkę, umiejętności, bossów, sklep i zapisy',
    ],
  },
  {
    v: '1.7.0', date: '26.07.2026', name: 'Wit Popielny',
    items: [
      '🧙 Handlarz ma imię, twarz i historię — <b>Wit Popielny</b> wita cię inaczej w każdej krainie i komentuje, jak długo się znacie',
      '🤝 <b>Zaufanie handlarza</b> rośnie z każdą transakcją: pięć progów od Nieznajomego po Powiernika Otchłani',
      '💸 Wyższe zaufanie to <b>zniżki do 18%</b> i lepszej jakości asortyment',
      '🕯️ <b>Towar spod lady</b> — od progu Wspólnika Wit wyciąga rzeczy, których nie ma na ladzie: pewny zestaw albo legenda',
      '🏅 Nowe osiągnięcie: Powiernik',
    ],
  },
  {
    v: '1.6.1', date: '26.07.2026', name: 'Poprawka Ekwipunku',
    items: [
      '🎒 Naprawiony układ Ekwipunku — przy długich nazwach (części zestawów, relikwie bossów) sloty rozpychały się i siatka przedmiotów nachodziła na wyposażenie',
      '🧰 Ta sama poprawka objęła sklep, Sanktuarium i Osiągnięcia',
    ],
  },
  {
    v: '1.6.0', date: '26.07.2026', name: 'Kupiec Otchłani',
    items: [
      '🛒 <b>Handlarz przebudowany</b> — trzy zakładki zamiast jednej listy: Towary, Hazard i Sprzedaż',
      '💎 <b>Perełka</b> — na każdym piętrze jedna wyróżniona pozycja wysokiej rzadkości',
      '🔄 <b>Odświeżanie asortymentu</b> za złoto (każde kolejne droższe)',
      '🎲 <b>Hazard</b> — kup nieopisaną broń, pancerz albo biżuterię w ciemno; szanse na rzadkości dużo lepsze niż przy zwykłym łupie',
      '💰 Sprzedaż hurtem jednym kliknięciem, <b>odkup</b> ostatnio sprzedanych rzeczy i wymiana złota na Pył Otchłani',
      '🏅 Dwa nowe osiągnięcia: Hazardzista i Ślepy Traf',
      '✍️ Nazwy przedmiotów odmieniają się poprawnie — koniec z „Pradawny Kurta" (teraz „Pradawna Kurta", „Demoniczne Nagolenice")',
    ],
  },
  {
    v: '1.5.0', date: '26.07.2026', name: 'Pakty i Relikwie',
    items: [
      '🩸 <b>Pakty Otchłani</b> — dobrowolne utrudnienia wybierane przed wyprawą (Rój, Kruchość, Pośpiech, Elity, Post, Nędza). Każdy podnosi mnożnik zdobywanej Esencji Dusz.',
      '🟩 <b>Zestawy przedmiotów</b> — trzy komplety (Dziedzictwo Pierwszego Bohatera, Regalia Otchłannego Kultu, Łachy Cienioskoczka) z bonusami za 2 i 4 części',
      '🌟 <b>Relikwie bossów</b> — każdy boss ma własną, unikalną legendę, której nie znajdziesz nigdzie indziej',
      '⚔️ <b>Areny Otchłani</b> — opcjonalne wyzwanie: przetrwaj 3 fale wrogów, zgarnij pewny łup i Esencję',
      '🏅 Trzy nowe osiągnięcia: Gladiator, Komplet, Zaprzedany',
    ],
  },
  {
    v: '1.4.1', date: '22.07.2026', name: 'Szlify Mobilne',
    items: [
      '📜 Ekran tytułowy przewija się na telefonie — wszystkie przyciski (Bestiariusz, Rekordy...) są dostępne',
      '🖥️ Tryb mobilny włącza się na każdym urządzeniu dotykowym, niezależnie od rozmiaru ekranu (naprawia nachodzące elementy w Ekwipunku i u Handlarza)',
      '✋ Przycisk interakcji nie zasłania już paska umiejętności',
      '🌑 Otwarte panele przyciemniają tło gry',
    ],
  },
  {
    v: '1.4.0', date: '22.07.2026', name: 'Otchłań w Kieszeni',
    items: [
      '📱 <b>Pełna obsługa telefonów i tabletów</b>: wirtualny joystick, auto-celowanie w najbliższego wroga, dotykowe przyciski ataku, uniku i umiejętności',
      '🎯 Wskaźnik auto-celu — widzisz, w kogo polecą strzały',
      '📲 Grę można zainstalować jak aplikację (PWA) i grać <b>offline</b>',
      '🖥️ Interfejs dopasowuje się do małych ekranów (HUD, panele, ekran tytułowy)',
    ],
  },
  {
    v: '1.3.0', date: '17.07.2026', name: 'Rekordy i Koszmar',
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
    v: '1.1.0', date: '14.07.2026', name: 'Echa i Wygody',
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
    v: '1.0.0', date: '14.07.2026', name: 'Serce Otchłani',
    items: [
      '🫀 Premiera! 16 pięter przez 5 skażonych krain aż do Serca Otchłani',
      '🎭 6 klas (nowi: Paladyn i Łowca Pustki), po 5 umiejętności z ultą',
      '💨 Unik z nietykalnością, statusy żywiołowe, elity z afiksami, 6 bossów z fazami',
      '⚒️ Przedmioty 5 rzadkości, 10 legend, Kuźnia, talenty, sklepy, eventy mapowe',
      '🔮 Sanktuarium Dusz, 18 osiągnięć, bestiariusz, Głębia Bez Dna',
    ],
  },
];
