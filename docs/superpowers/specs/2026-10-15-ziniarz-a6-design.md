# ZINIARZ: format A6

Zmiana do `2026-10-14-ziniarz-design.md`. Po wdrożeniu ZINIARZ robi wyłącznie ziny A6: kartka A5 złożona na pół, wydrukowana w skali 100% na środku arkusza A4 i wycięta po liniach cięcia. Format A5 znika z aplikacji, a istniejące ziny A5 przeliczają się na A6 przy otwarciu.

## Dlaczego

Właścicielka składa ziny w Illustratorze właśnie tak: strony A6 (105×148 mm), jedna kartka A5 na środku A4 z liniami cięcia i zgięcia, po wydruku przycięcie czterech brzegów i złożenie. ZINIARZ robił strony A5 na A4, pomniejszone pod margines drukarki, więc marginesy i wielkości w milimetrach nie zgadzały się z tym, co zna z Illustratora (domyślne 30 mm na stronie A5 wyglądało zupełnie inaczej niż jej ok. 12 mm na A6).

## Zasada: prawdziwe milimetry A6

- Wszystkie wymiary w modelu to milimetry na wydrukowanej, przyciętej stronie A6. To, co użytkowniczka wpisze w panelu, wychodzi z drukarki 1:1.
- Strona 105×148 mm, rozkładówka 210×148 mm, grzbiet x = 105, spad 3 mm jak dotąd (tylko na zewnętrznych krawędziach).
- Rozmiary siedzą w stałych `PAGE_WIDTH`, `PAGE_HEIGHT`, `SPREAD_WIDTH` (`src/model/geometry.ts`), więc rysownik, prowadnice, przyciąganie, wstawianie i podgląd 3D idą za nimi. Rozmiar napisu (`TextElement.size`) to punkty typograficzne na wydruku (opis w `types.ts` zmienia się z „at A5 scale” na rzeczywiste punkty).
- Miejsca z liczbami poza tymi stałymi, które też się zmieniają:
  - `ZinePanel.tsx`: górna granica marginesu 45 mm (było 70; przy stronie 105 mm dwa marginesy po 70 nie mają sensu).
  - Ostrość miniatur: `THUMB_PX_PER_MM` (`useSpreadThumbnails.ts`) i `COVER_PX_PER_MM` (`coverThumbnail.ts`) razy 148/105, żeby miniatura w tym samym rozmiarze na ekranie miała tyle samo pikseli co dotąd.
  - `app.css`: proporcje okładki na liście (`aspect-ratio: 148 / 210`) i miniatury rozkładówki (`302 / 216`) liczone z nowych wymiarów (105 / 148 i 216 / 154).
  - `factory.ts`: zapasowe rozmiary nowego napisu i zdjęcia (szerokość 88, zdjęcie 88×150) zmniejszone do wiarygodnych dla A6 (np. 60 i 60×90). To tylko wartości zapasowe, bo wstawianie i `parseZine` zawsze podają ramkę.

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
- Strona próbna: dwie kartki jak dotąd, ułożona na nowo pod A6. Dziś `src/print/testPage.ts` ma wpisane na sztywno położenia dla A5 (numer 72 pt na y = 45, podpis na y = 110, instrukcja od y = 135), które na stronie 148 mm wychodzą poza stronę. Położenia i rozmiary liczone względem `PAGE_WIDTH` i `PAGE_HEIGHT`; cała instrukcja mieści się na stronie 1 w obrębie strony (z zapasem od krawędzi). Instrukcja traci punkt o marginesie drukarki („coś ważnego ucięte przy krawędzi”), reszta (obrót tyłów, kolejność tyłów) bez zmian. Dochodzi zdanie, że po wydruku tnie się po liniach cięcia i składa na znaczniku zgięcia.
- Tekst o rozmiarze po przycięciu (`trimSizeText` w `printTexts.ts`) traci dopisek „(N% projektu)”: zostaje „Strona po przycięciu: 105 × 148 mm”. Napis „Strony A5 po kolei” na ekranie druku i komentarze w `pdf.ts` mówią o A6.
- „PDF stronami”: strony A6 po kolei, ze spadami albo bez.
- PDF nadal: strona dokładnie A4, arkusz rysowany w 300 dpi, po jednym.

## Przeliczenie starych zinów

- `FORMAT_VERSION` = 2. Zin w wersji 1 (albo bez wersji) to zin A5; `parseZine` przelicza go na A6, zanim zrobi cokolwiek innego. Dotyczy ziny z bazy i pliki `.zin`, bo oba przechodzą przez `parseZine`.
- Przeliczenie w osobnej, czystej funkcji (np. `migrateA5ToA6` w `src/model/`), działającej na surowych danych przed resztą `parseZine`.
- **Współrzędne.** Każda współrzędna pozioma przechodzi przez `mapX`, pionowa przez `mapY`. Skalowanie jest liniowe, żeby krawędzie stron trafiały w krawędzie stron, a elementy celowo wystające daleko poza stronę zachowały proporcje; jedynie wystawanie w spad (do 3 mm, `BLEED`) nie maleje:
  - `kx = 105 / 148`, `ky = 148 / 210`.
  - `mapX(x)`: dla 0 ≤ x ≤ 296 → `x · kx`; dla x < 0 → `min(x · kx, max(x, −BLEED))`; dla x > 296 → `max(210 + (x − 296) · kx, min(210 + (x − 296), 210 + BLEED))`.
  - `mapY(y)`: tak samo z `ky`, 210 → 148.
  - Przykłady: −3 → −3 (pełny spad), −1 → −1, −100 → −71 (proporcjonalnie), 299 → 213.
  - Działa na ramce przed obrotem, więc u obróconej ramki wystawanie liczy się na nieobróconym prostokącie, nie na widocznych rogach.
  - Ramka (zdjęcie i napis): lewa krawędź `x' = mapX(x)`, prawa `mapX(x + width)`, `width' = prawa − x'`; tak samo `y` i `height` przez `mapY`. Dotyczy ramki przed obrotem (pola `x, y, width, height`); obrócone ramki nie dostają dokładnej korekty, różnica jest niewidoczna. Przykład: zdjęcie na spad od x = −3 do 299 kończy jako −3 do 213, czyli z pełnym spadem 3 mm.
  - Dla każdej ramki `fx = width' / width` i `fy = height' / height` (1, gdy wymiar był 0).
- **Kadr zdjęcia:** `offsetX × fx`, `offsetY × fy`, `zoom × max(fx, fy) / min(fx, fy)`. Mnożnik zoomu (ok. 1,007 dla ramek w obrębie strony, nieco więcej dla ramek kilka milimetrów w spadzie) gwarantuje, że zdjęcie nadal wypełnia ramkę bez białego paska: obraz rośnie co najmniej tyle co większy z wymiarów ramki, więc przesunięcia mieszczą się w nowych granicach (`clampCrop` w `photoGeometry.ts` nie jest wołany przy rysowaniu, więc to musi wyjść z samego przeliczenia). Zoom po przeliczeniu może minimalnie przekroczyć `MAX_CROP_ZOOM` z panelu zdjęcia; nie przycinamy go ani w przeliczeniu, ani w `parseZine`, bo wróciłby biały pasek.
- **Napis:** `size × fx`, żeby szerokość łamania i wielkość liter zmieniły się razem i wiersze łamały się tak samo; wysokość napisu i tak przelicza się z tekstu.
- **Marginesy:** `outer` i `inner` × `kx`, `top` i `bottom` × `ky`.
- Bez zmian: obrót, `letterSpacing` (tysięczne em), `lineHeight` (krotność), przezroczystość, odbicie, kolory, fonty, tła stron, tytuł, kartki, opcje druku poza `printerMargin`.
- Stary zin w bazie zostaje w wersji 1, dopóki ktoś go nie zapisze: lista, druk i 3D przeliczają go przy każdym otwarciu (tak samo za każdym razem). Pierwszy zapis (autozapis w edytorze, zmiana opcji na ekranie druku, powielenie) zapisuje już przeliczony zin w wersji 2. Przeliczenie wersji 2 nie robi nic.
- **Niezmiennik:** nic nie zapisuje przeliczonych (A6) wymiarów z `formatVersion` 1. Zapis zawsze bierze zin z `parseZine`, który ustawia `FORMAT_VERSION`.
- Nowsza wersja niż 2 = dotychczasowy czytelny błąd, nigdy częściowy zin.

## Czego nie robimy

- Wyboru formatu (A5/A6): tylko A6.
- Dwóch kartek zina na jednym A4: zawsze jedna kartka na arkusz, reszta papieru to odpad, jak w Illustratorze.
- Druku na papierze A5 włożonym do drukarki.
- Obracania kartki na A4 pionowe.

## Testy

- `geometry`, `factory`: nowe stałe i wartości domyślne (marginesy 12/7/14/11, napis 9 pt).
- Przeliczenie: zin w wersji 1 z elementami przy krawędziach i grzbiecie (x = 148, x = 296, y = 210) trafia w 105, 210, 148; element w spadzie (x = −3, y = −3, prawa krawędź 299, dolna 213) zachowuje 3 mm spadu; napis i zdjęcie wystające daleko poza stronę (np. od x = −100) zachowują proporcje względem strony (`fx` ≈ `kx`); rozmiar napisu, kadr (z mnożnikiem zoomu) i marginesy przeliczone; zdjęcie z kadrem przesuniętym do granicy nadal wypełnia ramkę (sprawdzone przez `imagePlacement`); obrót i odstępy liter bez zmian; wynik ma `formatVersion` 2; ponowne `parseZine` wyniku niczego nie zmienia; stary plik `.zin` wczytuje się jako A6.
- Strona próbna: ramka instrukcji kończy się w obrębie strony 1.
- `parseZine`: `printerMargin` w danych nie przechodzi do wyniku.
- `printLayout`: kartka 210×148 (+ spad) na środku A4 w skali 100% przy każdej kombinacji spadów i znaczników; spad i znaczniki w granicach arkusza.
- Ekran druku: brak pola marginesu drukarki, rozmiar 105×148 mm na ekranie.
- Przykładowy zin (`src/test/sampleZine.ts`) przepisany w milimetrach A6 (dziś ma np. x = 178, szerokość 236, napisy 40 i 60 pt), z zachowaniem tego, co sprawdza: zdjęcie przez grzbiet, napisy, kolory tła. Dopiero potem wzorce renderu (`src/print/__reference__/`) odświeżone świadomie przez `npm run test:update-references` i obejrzane (kartka na środku, linie cięcia w rogach, zdjęcie przez grzbiet bez białego paska).
- Istniejące testy z liczbami A5 (m.in. `snapping`, `placement`, `insert`, `layout`, `sheetSide`, `renderPage`, `coverThumbnail`, `homeActions` z marginesami 30, `PrintScreen` z `printerMargin`) przechodzą na wartości A6 albo na stałe z `geometry.ts`; `printerMargin.test.ts` znika razem z modułem.
- E2E (`e2e/print.spec.ts`): PDF do druku nadal ma 10 stron A4 poziomo dla 5 kartek.

## Dokumentacja

- `2026-10-14-ziniarz-design.md`: „Cel” i „Pojęcia” (A4 → wycięta kartka A5 → 4 strony A6), rozmiary A6, marginesy, sekcja „Skala pod domową drukarkę” zastąpiona opisem druku 100%, strona próbna, „PDF stronami”.
- `CLAUDE.md`: opis na początku („każda kartka = 4 strony A6”, druk A4 i cięcie), „Jednostki” (A6, 105×148, grzbiet 105), „Skala druku” i „Margines drukarki” zastąpione zasadą druku 100%, „Kompatybilność danych” (wersja 2 i przeliczenie A5→A6), struktura `src/print/` bez `printerMargin.ts`.
- `README.md`: opis formatu i druku (A4, cięcie, składanie).
