# ZINIARZ: format A6

Zmiana do `2026-10-14-ziniarz-design.md`. Po wdrożeniu ZINIARZ robi wyłącznie ziny A6: kartka A5 złożona na pół, wydrukowana w skali 100% na środku arkusza A4 i wycięta po liniach cięcia. Format A5 znika z aplikacji, a istniejące ziny A5 przeliczają się na A6 przy otwarciu.

## Dlaczego

Właścicielka składa ziny w Illustratorze właśnie tak: strony A6 (105×148 mm), jedna kartka A5 na środku A4 z liniami cięcia i zgięcia, po wydruku przycięcie czterech brzegów i złożenie. ZINIARZ robił strony A5 na A4, pomniejszone pod margines drukarki, więc marginesy i wielkości w milimetrach nie zgadzały się z tym, co zna z Illustratora (domyślne 30 mm na stronie A5 wyglądało zupełnie inaczej niż jej ok. 12 mm na A6).

## Zasada: prawdziwe milimetry A6

- Wszystkie wymiary w modelu to milimetry na wydrukowanej, przyciętej stronie A6. To, co użytkowniczka wpisze w panelu, wychodzi z drukarki 1:1.
- Strona 105×148 mm, rozkładówka 210×148 mm, grzbiet x = 105, spad 3 mm jak dotąd (tylko na zewnętrznych krawędziach).
- Rozmiary siedzą w stałych `PAGE_WIDTH`, `PAGE_HEIGHT`, `SPREAD_WIDTH` (`src/model/geometry.ts`), więc edytor, miniatury, prowadnice, przyciąganie, wstawianie i podgląd 3D idą za nimi bez osobnych zmian. Rozmiar napisu (`TextElement.size`) to punkty typograficzne na wydruku (opis w `types.ts` zmienia się z „at A5 scale” na rzeczywiste punkty).

Odrzucone: model dalej w milimetrach A5 i zmniejszanie dopiero przy druku. Panel pokazywałby „30 mm”, a na papierze wychodziłoby 21 mm, czyli dokładnie ten rozjazd, który zmylił właścicielkę.

## Wartości domyślne

- Marginesy: zewnętrzny 12, przy grzbiecie 7, górny 14, dolny 11 mm (zmierzone z jej projektu w Illustratorze). Nadal edytowalne dla każdego zina w panelu „Zin” → „Marginesy”.
- Nowy napis: 9 pt (było 12 pt, za duże na A6).
- Nowe zdjęcie: bez zmian, wypełnia obszar między marginesami strony.
- Pozostałe opcje druku bez zmian (spady, linie cięcia, zgięcie włączone).

## Druk

- Arkusz A4 poziomo (297×210 mm). Na środku jedna kartka zina: dwie strony A6 obok siebie (210×148 mm), w skali 100%, ze spadem 3 mm, gdy spady są włączone.
- Linie cięcia w czterech zewnętrznych rogach, znaczniki zgięcia nad i pod grzbietem (`marks.ts` bez zmian, liczone od kartki na arkuszu).
- Kolejność stron, przód i tył kartki, „Obróć tyły o 180°”, druk dwustronny automatyczny i ręczny („tyły w odwrotnej kolejności”) bez zmian.
- Wokół kartki zostaje ok. 40 mm w poziomie i 28 mm w pionie wolnego papieru (licząc od spadu), więc znaczniki i spad zawsze mieszczą się w obszarze druku każdej domowej drukarki. Dlatego **znika skalowanie i margines drukarki:**
  - `printLayout` nie przyjmuje `printerMargin` i nie liczy skali; kartka zawsze ma 100%. Pole `scale` znika z `PrintLayout` (albo jest stałe 1, jeśli to upraszcza rysowanie; decyzja w planie).
  - `PrintSettings.printerMargin` znika z modelu; `parseZine` ignoruje to pole w starych zinach i plikach `.zin`.
  - `src/print/printerMargin.ts` (zapis w `localStorage`, `clampPrinterMargin`, `printSettingsFor`) znika, a ekrany druku i 3D biorą ustawienia prosto z `zine.print`. Stary klucz `ziniarz.printerMargin` w przeglądarce zostaje nieużywany (bez sprzątania).
  - Ekran druku nie ma pola „margines drukarki”; rozmiar strony po przycięciu to zawsze 105×148 mm. Przypomnienie o drukowaniu w rzeczywistym rozmiarze („bez skalowania”) zostaje i jest ważniejsze niż dotąd.
- Strona próbna: dwie kartki jak dotąd, w nowym rozmiarze. Instrukcja traci punkt o marginesie drukarki („coś ważnego ucięte przy krawędzi”), reszta (obrót tyłów, kolejność tyłów) bez zmian. Dochodzi zdanie, że po wydruku tnie się po liniach cięcia i składa na znaczniku zgięcia.
- „PDF stronami”: strony A6 po kolei, ze spadami albo bez.
- PDF nadal: strona dokładnie A4, arkusz rysowany w 300 dpi, po jednym.

## Przeliczenie starych zinów

- `FORMAT_VERSION` = 2. Zin w wersji 1 (albo bez wersji) to zin A5; `parseZine` przelicza go na A6, zanim zrobi cokolwiek innego. Dotyczy ziny z bazy i pliki `.zin`, bo oba przechodzą przez `parseZine`.
- Przeliczenie w osobnej, czystej funkcji (np. `migrateA5ToA6` w `src/model/`), z dwoma współczynnikami, żeby krawędzie stron trafiały w krawędzie stron:
  - `kx = 105 / 148` dla wszystkiego poziomego: `x`, `width`, `crop.offsetX`, marginesy `outer` i `inner`;
  - `ky = 148 / 210` dla wszystkiego pionowego: `y`, `height`, `crop.offsetY`, marginesy `top` i `bottom`;
  - rozmiar napisu `size` × `kx`, żeby szerokość łamania i wielkość liter zmieniły się razem i wiersze łamały się tak samo; wysokość napisu i tak przelicza się z tekstu.
  - Bez zmian: obrót, `crop.zoom`, `letterSpacing` (tysięczne em), `lineHeight` (krotność), przezroczystość, kolory, fonty, tła stron, tytuł, kartki, opcje druku poza `printerMargin`.
- Różnica `kx` i `ky` to ok. 0,7 %: ramka zdjęcia minimalnie zmienia proporcje, a zdjęcie nadal ją wypełnia (kadr może przesunąć się o ułamek milimetra). Obrócone ramki skalują się tak samo, bez dokładnej korekty; różnica jest niewidoczna.
- Stary zin w bazie zostaje w wersji 1, dopóki ktoś go nie zmieni: lista, druk i 3D przeliczają go przy każdym otwarciu (tak samo za każdym razem), a pierwszy autozapis w edytorze albo powielenie zapisuje go jako wersję 2. Przeliczenie wersji 2 nie robi nic.
- Nowsza wersja niż 2 = dotychczasowy czytelny błąd, nigdy częściowy zin.

## Czego nie robimy

- Wyboru formatu (A5/A6): tylko A6.
- Dwóch kartek zina na jednym A4: zawsze jedna kartka na arkusz, reszta papieru to odpad, jak w Illustratorze.
- Druku na papierze A5 włożonym do drukarki.
- Obracania kartki na A4 pionowe.

## Testy

- `geometry`, `factory`: nowe stałe i wartości domyślne (marginesy 12/7/14/11, napis 9 pt).
- Przeliczenie: zin w wersji 1 z elementami przy krawędziach i grzbiecie (x = 148, x = 296, y = 210) trafia w 105, 210, 148; rozmiar napisu, kadr i marginesy przeliczone; obrót, zoom, odstępy liter bez zmian; wynik ma `formatVersion` 2; ponowne `parseZine` wyniku niczego nie zmienia; stary plik `.zin` wczytuje się jako A6.
- `parseZine`: `printerMargin` w danych nie przechodzi do wyniku.
- `printLayout`: kartka 210×148 (+ spad) na środku A4 w skali 100% przy każdej kombinacji spadów i znaczników; spad i znaczniki w granicach arkusza.
- Ekran druku: brak pola marginesu drukarki, rozmiar 105×148 mm na ekranie.
- Wzorce renderu (`src/print/__reference__/`) odświeżone świadomie przez `npm run test:update-references` i obejrzane (kartka na środku, linie cięcia w rogach, zdjęcie przez grzbiet bez białego paska).
- E2E (`e2e/print.spec.ts`): PDF do druku nadal ma 10 stron A4 poziomo dla 5 kartek.

## Dokumentacja

- `2026-10-14-ziniarz-design.md`: rozmiary A6, marginesy, sekcja „Skala pod domową drukarkę” zastąpiona opisem druku 100%, strona próbna, „PDF stronami”.
- `CLAUDE.md`: „Jednostki” (A6, 105×148, grzbiet 105), „Skala druku” i „Margines drukarki” zastąpione zasadą druku 100%, „Kompatybilność danych” (wersja 2 i przeliczenie A5→A6), struktura `src/print/` bez `printerMargin.ts`.
- `README.md`: opis formatu i druku (A4, cięcie, składanie).
