# DUNGEON OF SHADOWS II — Serce Otchłani

Sequel **Dungeon of Shadows** (E:\giera). Dziesięć lat po upadku Pożeracza Światła
Otchłań wylewa się na powierzchnię — zejdź przez 5 skażonych krain i przebij jej Serce.

## Uruchomienie

Najprościej: **otwórz `index.html` w przeglądarce** (dwuklik).

Albo przez serwer dev:
```
node .claude/server.js
```
i wejdź na http://localhost:8124.

Bez zależności, bez builda — czysty JavaScript + Canvas.

## Sterowanie

| Klawisz | Akcja |
|---|---|
| WASD / strzałki | ruch |
| Mysz + LPM | celowanie i atak (można trzymać) |
| **Spacja** | unik z nietykalnością (2 ładunki) |
| 1–5 | umiejętności (5 = ulta) |
| Q / R | mikstura HP / MP |
| E | interakcja (schody, skrzynie, kapliczki, sklep) |
| I | ekwipunek i Kuźnia |
| Tab | pełna mapa |
| Esc | pauza / zapis / ustawienia |

## Co nowego względem części I

- **6 klas** — Wojownik, Mag Żywiołów, Łotrzyk, Nekromanta + nowi: **Paladyn** i **Łowca Pustki**; każda z 5 umiejętnościami (w tym ultą)
- **5 biomów + finał**: Katakumby → Grzybowe Jaskinie → Zamarznięta Głębia → Płonące Trzewia → Pałac Zwierciadeł → **Serce Otchłani** (16 pięter), każdy z własną paletą, pogodą, zagrożeniami terenu i pulą wrogów
- **Unik (dash)** z klatkami nietykalności i ładunkami
- **System statusów**: podpalenie, trucizna (stackująca), krwawienie, spowolnienie, zamrożenie, ogłuszenie, klątwa + odporności/słabości żywiołowe
- **Elity** z afiksami (Szybki, Wampiryczny, Opancerzony, Wybuchowy, Elektryzujący, Herszt)
- **6 bossów** z telegrafowanymi atakami i fazami szału (66% / 33%)
- **Przedmioty**: 5 rzadkości, losowe afiksy, **10 unikalnych legend** z efektami specjalnymi
- **Kuźnia**: przetapianie na Pył Otchłani, ulepszanie do +10, przelosowywanie afiksów
- **Talenty** przy każdym awansie (1 z 3, rangowane)
- **Eventy mapowe**: skrzynie (uwaga na Mimiki!), kapliczki, Ołtarze Krwi, Studnie Dusz
- **Sklepy** wędrownego handlarza (piętra 2, 5, 8, 11, 14)
- **Meta-progresja**: Esencja Dusz → 10 trwałych ulepszeń w Sanktuarium
- **18 osiągnięć**, bestiariusz, 3 sloty zapisu + autozapis
- **Głębia Bez Dna** — nieskończony endgame ze skalowaniem i bossami co 5 pięter
- Oświetlenie dynamiczne, pogoda per biom, cząsteczki, wstrząsy ekranu, syntezowany dźwięk (WebAudio)

## Changelog

**1.4.0**
- 📱 obsługa dotyku: wirtualny joystick, auto-celowanie, przyciski umiejętności
- 📲 PWA — instalacja jak aplikacja, granie offline (service worker, network-first)
- 🖥️ responsywny interfejs na małe ekrany

**1.3.0**
- 🎚️ poziomy trudności: Wędrowiec / Śmiałek / Koszmar (wybór na tytule, zapamiętywany)
- 🏆 panel Rekordów (najgłębiej, najszybsze zwycięstwo, zabójstwa, poziom, złoto)
- 📊 podsumowanie piętra na ekranie przejścia
- 💀 filmowe intro bossów
- 🔗 favicon + Open Graph (ładny podgląd linku)

**1.2.0** *(feedback graczy)*
- ⭐ awans nie pauzuje gry — punkty talentu kumulują się, wybór pod klawiszem **T** (Esc odkłada)
- ⚔️ wyższa trudność: mocniejsze skalowanie wrogów, więcej ich, częstsze elity, czujniejsze aggro, wolniejsza regeneracja HP
- 👁️ czytelniejsza ziemia: dekoracje mniejsze/przygaszone, przedmioty mniejsze z podstawką i obwódką rzadkości
- 📜 panel „Nowości" (release notes) w menu

**1.1.0**
- 🎵 proceduralna muzyka ambientowa — inny motyw w każdym biomie (suwak w ustawieniach)
- ▶️ przycisk „Kontynuuj" na ekranie tytułowym (z autozapisu)
- ⚖️ tooltip przedmiotu porównuje statystyki z założonym
- 🧹 premia Esencji za wyczyszczenie całego piętra
- ⏸️ auto-pauza przy przełączeniu okna; Esc nie przerywa wyboru talentu
- 🇫 klawisz F działa jak E (interakcja — jak w części I)
- 🔧 fix: panele tytułu (Bestiariusz/Osiągnięcia/Sanktuarium) otwierały się pod ekranem tytułowym
- 🔧 fix: Mimik nie skaluje się już podwójnie z piętrem
- 🚀 cache-busting zasobów — aktualizacje bez Ctrl+F5

## Struktura kodu

```
index.html          — szkielet DOM + kolejność ładowania skryptów
css/styles.css      — cały UI
js/config.js        — stałe i balans (BAL)
js/content/         — dane: biomy, klasy, wrogowie, przedmioty, talenty, osiągnięcia
js/engine/          — generator lochów, FOV, flow-field pathfinding, cząsteczki
js/game/            — logika: gracz, walka, umiejętności, AI, bossowie,
                      ekwipunek, eventy, sklep, progresja, meta, zapis,
                      render, HUD, wejście, pętla
```
