# ZINIARZ: okładka w całości

Zmiana do `2026-10-14-ziniarz-design.md` (w wersji A6 z `2026-10-15-ziniarz-a6-design.md`). Po wdrożeniu przód i tył okładki to jedna rozkładówka „Okładka”: tylna okładka po lewej, przednia po prawej, tak jak wygląda rozłożony zin od zewnątrz. Zdjęcie albo napis może przechodzić przez grzbiet z tyłu na przód.

## Dlaczego

Właścicielka projektuje okładkę jako całość (np. jedno zdjęcie owinięte wokół zina) i chce widzieć, czy przód i tył się łączą. Dziś okładki stoją osobno: rozkładówka 0 to sam przód (obok szare pole), ostatnia to sam tył, a element nie może przejść z jednej na drugą. Na wydruku te dwie strony i tak leżą obok siebie: przód kartki 1 to `P | 1`.

Odrzucone: zostawić osobne okładki i tylko sklejać je na ekranie w podglądzie. Element przez grzbiet trzeba by wtedy ciąć na dwa kawałki w dwóch rozkładówkach, a podgląd nie pozwalałby niczego poprawić.

## Model: rozkładówki edytora

- Rozkładówek jest `2 · sheets` (było `2 · sheets + 1`); `spreadCount(sheets)` zwraca nową liczbę.
- **Rozkładówka 0 to okładka:** lewa strona `P` (tylna okładka), prawa strona `1` (przednia).
- **Rozkładówka `i` dla `i ≥ 1`:** jak dotąd, lewa `2i`, prawa `2i + 1`. Ostatnia (`2 · sheets − 1`) ma strony `P − 2 | P − 1`; `P − 1` to wewnętrzna strona tylnej okładki.
- Każda rozkładówka ma dwie istniejące strony. Strony 0 i `P + 1` dalej nie istnieją, ale nigdzie już nie stoją.
- Funkcje w `src/model/geometry.ts` dostają liczbę kartek tam, gdzie okładka jej wymaga:
  - `pageAt(spread, side, sheets)`: dla rozkładówki 0 po lewej zwraca `pageCount(sheets)`.
  - `slotOfPage(page, sheets)`: strona `P` to `{ spread: 0, side: 'left' }`.
  - `pagesOfSpread(spread, sheets)`: zawsze dwie strony, lewa i prawa.
  - Wywołania, które biorą z `slotOfPage` tylko `.side` (`buildSpread.ts`, `guides.ts`, `snapping.ts`, `placement.ts`, `pagesOfFrame`), dostają liczbę kartek mechanicznie; `P` jest parzyste, więc strona dalej wychodzi lewa.
- Geometria stron się nie zmienia. Tylna okładka leży po lewej, więc jej zewnętrzna krawędź jest po lewej, a przy grzbiecie po prawej: `pageRect('left', …)` i `marginRect(…, 'left')` są dla niej poprawne (spad i margines zewnętrzny po lewej, krawędź równo przy grzbiecie).
- `Spread` i `ZineElement` bez zmian. Element dalej należy do rozkładówki i może leżeć przez grzbiet, teraz także na okładce.
- Tła stron (`Zine.pages`) bez zmian, po numerze strony.

## Edytor

- **Miniatury:** pierwsza „Okładka” pokazuje całą okładkę (tył | przód). Osobnej miniatury „Tył” na końcu nie ma. Pozostałe podpisy jak dotąd („2–3”, …, „P − 2 – P − 1”). Dostępna nazwa pierwszej miniatury: „Okładka”.
- **Podpisy na płótnie okładki:** pod płótnem rozkładówki 0 małe podpisy „tył” pod lewą połową i „przód” pod prawą. Tylko w edytorze; nigdy w rysowniku (`buildSpreadGroup`), miniaturach, PDF ani 3D. Dokładne miejsce i wygląd ustala plan (np. warstwa nakładek `EditorStage` albo element HTML pod płótnem).
- **Szare pole obok okładki znika:** nie ma już brakujących stron w rozkładówkach edytora. `buildMissingPagesShade` i opcja `shadeMissing` w `renderSpread` znikają razem z ich testami.
- **Wstawianie bez klikniętej strony:** `defaultPage` zwraca stronę o najniższym numerze w rozkładówce. Na okładce to przód (1), w pozostałych rozkładówkach lewa strona (jak dotąd). Klik w stronę dalej wybiera klikniętą (`pageAtPoint`, `select(id, page)`), także tył okładki.
- **Przyciąganie i prowadnice** idą za stronami rozkładówki, więc na okładce przyciągają do marginesów i krawędzi obu stron i do grzbietu.
- **„+ kartka” i „− kartka”** bez zmian w zasadzie: okładki i ich wewnętrzne strony zostają na miejscu, wyjątki 1 i 2 kartek jak w specu. `addSheet` i `removeSheet` w `sheets.ts` liczą tak samo (rozkładówka 0 zostaje na początku, strony od wstawionych w górę przesuwają się o 4, więc tylna okładka `P` idzie za nimi). W `sheets.ts` zmienia się tylko długość tablicy rozkładówek.
- **Kliknięta strona po „± kartka”:** `changeSheets` w `src/editor/state/store.ts` przesuwa dziś `activePage` o `2 · (moved − spread)`, co zakłada, że numery stron wynikają z indeksu rozkładówki. Na okładce to nie działa: rozkładówka 0 się nie rusza, a jej lewa strona `P` zmienia się na `P ± 4`. Nowa zasada: `activePage` = `pageAt(moved, side, next.sheets)`, gdzie `side` to strona (`left`/`right`), po której leżała kliknięta strona w starej rozkładówce: `slotOfPage(activePage, poprzednia liczba kartek).side` (nigdy z nową liczbą kartek). Kliknięty tył okładki zostaje tyłem okładki (nowe `P`).
- Pierwszy ekran edytora, cofanie, przełączanie rozkładówek: bez zmian poza nową liczbą rozkładówek (`spreadCount`).

## Druk

- Impozycja bez zmian: przód kartki 1 to `P | 1`, więc okładka drukuje się dokładnie tak, jak wygląda w edytorze.
- Strony do arkusza rysuje `renderPage` po stronie (wycięcie z rozkładówki), teraz przez `slotOfPage(page, sheets)`. Element przez grzbiet okładki wychodzi na obu stronach jednej strony arkusza jako ciągły obraz.
- „PDF stronami”, strona próbna i miniatura okładki na liście zinów (`renderPage(zine, 1, …)`, zdjęcia z rozkładówki 0) działają przez te same funkcje. Strona próbna wkłada napisy przez `slotOfPage(page, sheets)`; jej strona `P` trafia na lewą połowę rozkładówki 0.

## Podgląd 3D

- Kartkowanie bez zmian: zamknięty zin pokazuje przód, po przewróceniu wszystkich kartek tył. Tekstury stron z `renderPage`, więc zdjęcie przez grzbiet okładki owija się wokół zina.
- Podpis czytanej rozkładówki w 3D (`spreadCaption`) liczy się z pozycji czytelnika, nie z rozkładówek edytora: `turned = 0` „Okładka”, `turned = 2 · sheets` „Tył”, pomiędzy „Strony 2i–2i+1”. Własna funkcja w `book.ts`, bez `spreadLabel` z edytora (te dwie numeracje się rozjeżdżają).

## Przeliczenie starych zinów

- `FORMAT_VERSION` = 3. Zin w wersji 2 (albo starszej, po przeliczeniu A5 → A6) ma `2 · sheets + 1` rozkładówek; `parseZine` łączy okładki, zanim sprawdzi liczbę rozkładówek.
- Przeliczenie w osobnej czystej funkcji (np. `mergeCovers` w `src/model/migrate.ts`) na surowych danych, po `migrateA5ToA6` i przed resztą `parseZine`.
- **Połączenie:** nowa rozkładówka 0 ma id starej rozkładówki 0 i elementy `[...elementy ostatniej rozkładówki, ...elementy rozkładówki 0]` (tył pod spodem, przód na wierzchu). Ostatnia rozkładówka znika. Pozostałe rozkładówki bez zmian. Gdy dane wersji 2 są uszkodzone (liczba rozkładówek inna niż `2 · sheets + 1` albo pierwsza lub ostatnia rozkładówka bez tablicy `elements`), funkcja zwraca `null`, a `parseZine` zgłasza swój zwykły błąd uszkodzonego zina (przepuszczone dalej `2 · sheets` rozkładówek wyglądałoby jak poprawny zin w wersji 3). Nigdy nie łączy częściowo. Współrzędne elementów się nie zmieniają: tył leżał po lewej, przód po prawej, i tak zostaje.
- **Nic nie znika.** Fragment elementu, który dotąd wystawał na szare pole obok okładki (i się nie drukował), pojawia się teraz na drugiej połowie okładki. Bez komunikatu; właścicielka przesunie albo usunie go w edytorze.
- Jak przy A6: stary zin w bazie zostaje w wersji 2, dopóki ktoś go nie zapisze, i przelicza się przy każdym otwarciu tak samo. Zapis zawsze z `parseZine`, więc nic nie zapisuje połączonej okładki z `formatVersion` 2. Przeliczenie wersji 3 nie robi nic. Stare pliki `.zin` wczytują się przez ten sam `parseZine`.
- Nowsza wersja niż 3 = dotychczasowy czytelny błąd. Plik zapisany nową wersją i otwarty w starej apce dostaje ten błąd, nie częściowy zin.

## Czego nie robimy

- Grzbietu z grubością (okładka z paskiem na grzbiet): zin zszywany zginany na pół nie ma grzbietu do zadruku.
- Edycji wewnętrznych stron okładek jako jednej rozkładówki (`P − 1 | 2`): one nie leżą obok siebie ani w zinie, ani na arkuszu.
- Komunikatu o elementach, które po połączeniu wyszły na drugą połowę okładki.

## Testy

- `geometry`: `spreadCount`, `pageAt`, `slotOfPage`, `pagesOfSpread` dla 1…6 kartek; każda strona 1…`P` dokładnie raz w dokładnie jednej rozkładówce i `pageAt(slotOfPage(p))` = `p`.
- `placement`: `defaultPage` na okładce = 1, w innych rozkładówkach lewa strona; `pageAtPoint` na lewej połowie okładki = `P`.
- `sheets`: dodawanie i usuwanie kartek przy każdej bieżącej rozkładówce dla 1…6 kartek: rozkładówka 0 (z elementami tyłu i przodu) zostaje, strona `P` dalej jest tylną okładką z tym samym tłem, wewnętrzne strony okładek na miejscu (z wyjątkami 1 i 2 kartek), liczba rozkładówek `2 · sheets`.
- Przeliczenie: zin w wersji 2 z elementami na obu okładkach i na wewnętrznych stronach daje `2 · sheets` rozkładówek, rozkładówkę 0 z elementami tyłu, a po nich przodu, z niezmienionymi współrzędnymi i id, pozostałe rozkładówki bez zmian; wynik ma `formatVersion` 3; ponowne `parseZine` nic nie zmienia; zin w wersji 1 przechodzi A5 → A6 → połączenie; stary plik `.zin` wczytuje się z połączoną okładką.
- `spreadLabels`: „Okładka” dla 0, brak „Tył”, podpisy stron dla reszty; `thumbnailKey` zależy od tła strony `P` dla rozkładówki 0.
- 3D: `spreadCaption` dla `turned` 0, środka i `2 · sheets`.
- Edytor (testy przeglądarkowe): okładka ma dwie strony bez szarego pola, podpisy „tył” i „przód” są tylko na okładce, miniatur jest `2 · sheets`, nowy napis na okładce trafia na przód, klik w tył i „+ Napis” wstawia na tył.
- Druk: zdjęcie przez grzbiet okładki rysuje się na obu połowach przodu kartki 1 bez szwu przy grzbiecie (jak test szwu w `sheetSide.browser.test.ts`).
- Przykładowy zin (`src/test/sampleZine.ts`): elementy tyłu przechodzą do rozkładówki 0, rozkładówki 1…5 bez zmian, dochodzi zdjęcie owinięte przez grzbiet okładki. Wzorce renderu odświeżone świadomie (`npm run test:update-references`) i obejrzane: na przodzie kartki 1 zdjęcie przechodzi z tyłu na przód bez białego paska, pozostałe arkusze bez zmian.
- Sklep edytora: klik w tył okładki, potem „+ kartka” i „− kartka”: `activePage` = nowe `P`, rozkładówka 0; klik w przód: `activePage` = 1. Klik w stronę w innej rozkładówce: zachowanie jak dotąd.
- E2E (`e2e/print.spec.ts`) i istniejące testy, które liczą miniatury, szukają „Tył” albo używają ostatniej rozkładówki, przechodzą na nowy układ. Znane miejsca: `store.test.ts` (`spreads[4]` jako tył), `SpreadList.browser.test.tsx`, `spreadLabels.test.ts`, `book.test.ts`, `geometry.test.ts` (`pagesOfSpread(0, 5)` = `[1]`), test `shadeMissing` w `renderPage.browser.test.ts`, `EditorStage.browser.test.ts` (szare pole), `sampleZine.ts` (`spreads[6]` jako tył).
- Uszkodzony zin w wersji 2 (zła liczba rozkładówek) daje błąd uszkodzonego zina, nie częściowo połączoną okładkę.

## Dokumentacja

- `CLAUDE.md`: niezmiennik rozkładówek (rozkładówka 0 = `P | 1`, liczba `2 · sheets`), wzmianka o szarym polu i `buildMissingPagesShade` znika, `FORMAT_VERSION` 3 z połączeniem okładek, `spreadName` bez „Tył”.
- `README.md`: zdanie o okładce w całości, jeśli opisuje miniatury albo okładki.
