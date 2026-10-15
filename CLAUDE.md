# ZINIARZ

Aplikacja webowa do składania zinów: broszura zszywana z kartek A4 złożonych na pół (każda kartka = 4 strony A5), druk dwustronny na domowej drukarce ze spadami. Spec: `docs/superpowers/specs/2026-10-14-ziniarz-design.md`. Plany: `docs/superpowers/plans/`.

Użytkowniczka nie jest programistką: pisze po polsku i opisuje efekt, a nie implementację. Odpowiadaj po polsku. Kod, komentarze i commity pisz po angielsku. Interfejs i komunikaty błędów po polsku.

## Szybki start

```bash
npm install
npx playwright install chromium
npm test
npm run test:e2e
npm run dev
```

- `npm run test:unit`: czysta logika w Node. `npm run test:browser`: render, fonty, PDF, WebGL i komponenty React w Chromium (Vitest browser mode, okno 1280×900).
- `npm run test:e2e`: Playwright (`e2e/`, `playwright.config.ts`) na zbudowanej apce (`vite build` + `vite preview` na porcie 4173): nowy zin 5 kartek, zdjęcie, napis, PDF do druku ma 10 stron A4 poziomo; podgląd 3D. Nie wchodzi do `npm test`.
- `test-output/`: próbne arkusze PNG i PDF z `src/print/samples.browser.test.ts` do obejrzenia.
- `vite.config.ts` wymienia biblioteki w `optimizeDeps.include`, żeby testy w przeglądarce nie przeładowywały się w trakcie przebiegu. Każdą nową bibliotekę używaną w testach przeglądarkowych dopisz tam też.

## Struktura

| Ścieżka | Odpowiedzialność |
|---|---|
| `src/App.tsx`, `src/app/` | Ekrany według adresu (`route.ts`, `useRoute.ts`: `#/`, `#/zin/<id>`, `#/zin/<id>/druk`, `#/zin/<id>/3d`), baza w kontekście (`dbContext.ts`), zin do oglądania na ekranach druku i 3D (`useZineView.ts`, błąd otwarcia `LoadFailed.tsx`), komunikaty (`notices.ts`, `NoticeList.tsx`), pytania „na pewno?” (`confirm.ts`, `ConfirmHost.tsx`), odmiana liczebników (`plural.ts`), style (`app.css`). |
| `src/home/` | Lista zinów: nowy, powiel, usuń, pliki `.zin` (`homeActions.ts`, pobieranie pliku `download.ts`), miniatura okładki (`coverThumbnail.ts`), ekran (`HomeScreen.tsx`, `ZineCard.tsx`). |
| `src/editor/state/` | Stan edytora w Zustand (`store.ts`), historia cofania (`history.ts`), zmiany zina (`commands.ts`), warstwy (`layers.ts`), schowek (`clipboard.ts`), autozapis (`autosave.ts`). Czysta logika, testy w Node. |
| `src/editor/geometry/` | Gdzie wstawić zdjęcie i napis (`placement.ts`), przyciąganie (`snapping.ts`). Czysta matematyka. |
| `src/editor/canvas/` | Płótno edytora w Konvie (`EditorStage.ts`), jego opakowanie w React (`SpreadCanvas.tsx`), edycja tekstu na miejscu (`TextEditor.tsx`). |
| `src/editor/panels/` | Prawa kolumna: ustawienia zdjęcia (`PhotoPanel.tsx`), napisu (`TextPanel.tsx`), strony (`PagePanel.tsx`), zina (`ZinePanel.tsx`), a do tego pola `ColorField`, `FontField`, `NumberField` i przyciski warstw (`LayerButtons.tsx`); `PropertiesPanel.tsx` wybiera właściwy panel. |
| `src/editor/` (reszta) | Ekran edytora (`EditorScreen.tsx`, `EditorContext.ts`), otwieranie zina do rysowania (`session.ts`: `openZineView`, `openEditorSession`), pasek u góry (`TopBar.tsx`, `InsertButtons.tsx`), miniatury rozkładówek i „± kartka” (`SpreadList.tsx`, `useSpreadThumbnails.ts`, `spreadLabels.ts`), wstawianie (`insert.ts`), skróty (`keyboard.ts`, `useEditorKeyboard.ts`), kolory (`colors.ts`). |
| `src/model/` | Typy zina (`types.ts`), numeracja stron i rozkładówek, marginesy (`geometry.ts`), wartości domyślne (`factory.ts`), wczytywanie z wartościami domyślnymi i wersją (`parse.ts`), nowe id (`ids.ts`), odczyty z zina (`queries.ts`), dodawanie i usuwanie kartek (`sheets.ts`). |
| `src/imposition/` | Kolejność stron na arkuszach (`imposition.ts`), skala pod margines drukarki (`layout.ts`), znaczniki cięcia i zgięcia (`marks.ts`). Czysta matematyka. |
| `src/storage/` | IndexedDB (`db.ts`), sprzątanie nieużywanych zdjęć i fontów (`cleanup.ts`), pliki `.zin` (`zinFile.ts`), trwały magazyn i zajęte miejsce (`quota.ts`). |
| `src/images/` | Wczytywanie zdjęć (`prepareImage.ts`): zmniejszanie do 3600 px, JPEG albo PNG z przezroczystością. |
| `src/fonts/` | Wbudowane fonty (`fontChoices.ts`, pliki w `builtinFontFiles.ts`), rejestracja fontów i czekanie na nie (`fontLoader.ts`), nazwa rodziny z pliku (`fontNames.ts`), wgrywanie (`fontImport.ts`), lista fontów zina i fonty innych zinów (`catalogue.ts`), odświeżanie po załadowaniu fontów (`useFontsVersion.ts`). |
| `src/render/` | Jedyny rysownik (Konva): rozkładówka w mm (`buildSpread.ts`), prowadnice i wyszarzenie brakującej strony (`guides.ts`), wczytywanie zdjęć do rysowania (`assets.ts`, pomija uszkodzone), geometria zdjęcia (`photoGeometry.ts`), strona i rozkładówka do canvasu (`renderPage.ts`), kolejka rysowania w tle (`renderQueue.ts`), canvas do Konvy i do bajtów (`konvaCanvas.ts`, `canvasBytes.ts`). |
| `src/print/` | Strona arkusza (`sheetSide.ts`), PDF arkuszy i stron (`pdf.ts`), grupowanie stron do druku (`printGroups.ts`), nazwy plików (`fileName.ts`), strona próbna i jej instrukcja (`testPage.ts`), margines drukarki zapamiętany w przeglądarce (`printerMargin.ts`), teksty ekranu druku (`printTexts.ts`), pobieranie PDF z postępem i błędem (`exportRunner.ts`, `exporter.ts`). |
| `src/print/screen/` | Ekran druku: `PrintScreen.tsx` (układ, zapis ustawień, pobieranie), `PrintOptions.tsx` (opcje), `SheetPreview.tsx` (podgląd arkuszy), `ExportStatusView.tsx` (pasek postępu, błąd z ponowieniem, przyciski pobierania kilku plików). |
| `src/preview3d/` | Podgląd 3D: kartkowanie i ułożenie kartek (`book.ts`), klik, klawisze, kamera, rozdzielczość tekstur (`view.ts`) — czysta logika z testami w Node; scena three.js (`scene.ts`) i ekran (`Preview3dScreen.tsx`). |
| `src/test/` | Pomocniki testów: piksele, sztuczny plik TTF (`sfnt.ts`), płótno edytora (`stageHarness.ts`), cały edytor (`editorHarness.tsx`), ekrany druku i 3D (`screenHarness.tsx`), panel (`panelHarness.tsx`), wybór plików (`files.ts`), sprawdzenie WebGL (`webgl.browser.test.ts`). |
| `e2e/` | Test end-to-end Playwright (`print.spec.ts`). |
| `scripts/` | `checkDist.mjs` (`npm run check:dist`): czy zbudowana apka działa spod dowolnej podścieżki, jak na GitHub Pages (`base: './'`, adresy tylko względne); CI w `.github/workflows/deploy.yml` robi testy, build i to sprawdzenie. |

## Zasady i niezmienniki

- **Jednostki:** wszystko w milimetrach w skali A5 (strona 148×210). Rozkładówka: x 0…296, grzbiet x = 148, spad 3 mm poza nią.
- **Rozkładówka `i`** ma strony `2i` (lewa) i `2i + 1` (prawa). Strony 0 i `P + 1` nie istnieją (okładki stoją same). Element należy do rozkładówki i może leżeć przez grzbiet.
- **Jeden rysownik.** Edytor, miniatury, PDF i 3D rysują przez `buildSpreadGroup`. Nie twórz osobnej ścieżki rysowania. Tekst rysuje i mierzy tylko `createTextShape` (`Konva.Text`); wysokość ramki napisu liczy `measureTextHeight`, a pole edycji tekstu bierze rozmiary z `textStyleMm`.
- **Płótno edytora to zwykła Konva** (`EditorStage`), nie react-konva: rysunek rozkładówki pochodzi z rysownika, klasa dokłada tylko prowadnice, zaznaczenie, przyciąganie i obsługę myszy. Transformer działa na niewidocznym prostokącie (`proxy`) w warstwie bez skali.
- **Stan edytora:** zmiany zina tylko przez akcje sklepu (`edit`, `updateElement`…), każda to krok cofania (do 100). Zmiany z tym samym kluczem (pisanie, suwaki, pola liczb, przesuwanie zdjęcia w kadrze) łączą się w jeden krok, a **na końcu każdej interakcji (puszczenie myszy, blur, Enter) wołaj `endMerge()`**; łączenie kończy też `select`, `clickPage`, `setSpread` i `setMode`. Zmiana, która nic nie zmienia, zwraca ten sam zin i nie robi kroku cofania. Cofnięcie i ponowienie ponownie mierzą wysokości napisów i przełączają na rozkładówkę ze zmianą. Dodanie i usunięcie kartki zostawia podgląd na tej samej rozkładówce. Zaznaczenie, rozkładówka i tryb nie są w historii. Sklep nie importuje Konvy: pomiar tekstu i rozmiar zdjęcia dostaje w `EditorDeps`.
- **`EditorStage.update` przebudowuje węzły elementów tylko, gdy zmieniła się treść** (zin, rozkładówka, zdjęcia, `contentVersion` z wersji zdjęć i fontów, tryb, napis w edycji). Samo zaznaczenie ich nie rusza: Konva wysyła `dblclick` tylko wtedy, gdy oba kliknięcia trafią w ten sam węzeł, a pierwsze kliknięcie zaznacza. Aktualizacje w trakcie przeciągania czekają do `finishGesture()`, które rysuje je po puszczeniu myszy. Test pilnuje obu rzeczy.
- **Selektory Zustand** zwracają wartości stałe (pole stanu albo element), nigdy nowy obiekt, bo React wpada w pętlę.
- **Spad tylko na zewnętrznych krawędziach strony;** przy grzbiecie strona kończy się równo (`pageRect`).
- **Impozycja:** kartka `k`: przód `P − 2k | 2k + 1`, tył `2k + 2 | P − 2k − 1`. PDF poziomy, tył pod „odwracanie po krótszej krawędzi”; „Obróć tyły o 180°” dla drukarek odwracających po dłuższej.
- **Skala druku:** `s = min(1, (297 − 2m − 2c)/(296 + 2b), (210 − 2m − 2c)/(210 + 2b))`; spad i znaczniki zawsze mieszczą się w obszarze druku (pilnuje test).
- **Kartki:** dodawanie i usuwanie nigdy nie przesuwa okładek ani wewnętrznych stron okładek (poza wyjątkami 1 i 2 kartek opisanymi w specu). Kolory tła idą za stronami.
- **Kompatybilność danych:** nowe pole = wartość domyślna w `parseZine`. Zmiana znaczenia pola = nowa `FORMAT_VERSION` i migracja. Nowsza wersja pliku = czytelny błąd, nigdy częściowy zin. **Zin z bazy zawsze przechodzi przez `parseZine`** (lista zinów, otwieranie w edytorze).
- **Zdjęcia i fonty leżą w IndexedDB, nigdy w JSON-ie zina.** Sprzątanie (`pruneUnusedAssets`) tylko z listy zinów, nigdy w trakcie edycji, i dopiero po `whenSavesSettled()`, żeby świeżo dodane zdjęcie nie wyglądało na nieużywane. Font jest „używany”, gdy jest na liście `Zine.fonts`.
- **Autozapis** 500 ms po zmianie, zapisy po kolei; wyjście z edytora zapisuje od razu. `updatedAt` ustawia zapis.
- **Fonty:** wbudowane rodziny mają id jak `fontFamilyId` (`inter`, `lora`…), domyślna `inter`. Każdy styl to dwa pliki (latin i latin-ext z polskimi literami), przeglądarka pobiera je dopiero, gdy tekst ich potrzebuje; `ensureFontsReady` i `loadSpreadFonts` podają tekst, żeby pobrała właściwe. Nowy wbudowany font = wpis w `BUILTIN_FONTS` i pliki w `builtinFontFiles.ts` (test pilnuje zgodności). Własne fonty: rodzina z tabeli `name` (ID 1) i bitów OS/2 dla TTF/OTF, z nazwy pliku dla WOFF2. Poza pogrubieniem i kursywą waga (Light, SemiBold…) zostaje w nazwie rodziny („Lato Light”), żeby komplet wag nie nadpisywał Regular i Bold.
- **Wczytanie `.zin` tworzy nowy zin** (nowe id), nigdy nie nadpisuje istniejącego. Rodzina fontów, której id już jest w bazie, dostaje nowe id razem z plikami, a zin i napisy idą za nią.
- **Eksport rysuje arkusze po jednym** i zwalnia canvas (`releaseCanvas`); `drawToCanvas` wymusza `Konva.pixelRatio = 1`.
- **Margines drukarki** należy do drukarki, nie do zina: `localStorage` (`ziniarz.printerMargin`), 0–20 mm co 0,5 mm (`clampPrinterMargin`, przy 20 mm skala nadal > 0,5). Druk i 3D biorą ustawienia z `printSettingsFor(zine.print, loadPrinterMargin())`: zapamiętany margines wygrywa, `Zine.print.printerMargin` to zapas (np. plik `.zin` z innego komputera) i też się aktualizuje. Pozostałe opcje druku zapisuje do `Zine.print` ekran druku (autozapis jak w edytorze), poza sklepem edytora i historią cofania.
- **Ekrany druku i 3D tylko oglądają zina:** otwierają go przez `openZineView` (czeka na `whenSavesSettled()`, potem `parseZine`, fonty, zdjęcia) i nie zmieniają jego treści.
- **Pobieranie PDF:** `runExport` buduje wszystkie pliki, zanim cokolwiek pobierze; błąd = komunikat `EXPORT_FAILED` z „Spróbuj jeszcze raz”, nic nie zostaje pobrane. Ekran druku dostaje `PdfExporter` (testy podają szybszy albo psujący się). Budowniczowie PDF (`buildSheetsPdf`, `buildPagesPdf`) biorą `AbortSignal` i przerywają przed kolejną stroną arkusza albo stroną zina; ekran druku przerywa eksport przy odmontowaniu (wyjście z ekranu), a przerwany eksport niczego już nie pobiera ani nie zgłasza. Eksport z kilkoma plikami (ręczny druk dwustronny) pokazuje po jednym przycisku pobierania na plik i nie pobiera nic sam, bo przeglądarka przepuszcza tylko pobranie wywołane kliknięciem.
- **Podgląd arkuszy** rysuje stronę arkusza dopiero, gdy wjedzie w widok (`IntersectionObserver`), po jednej (`createRenderQueue`), w 48 dpi. Tyły pokazuje zawsze nieobrócone (tak wychodzą z drukarki).
- **3D:** three.js ładuje się tylko przez `import('./scene')` w `Preview3dScreen`; nie importuj `three` nigdzie poza `src/preview3d/scene.ts`, bo trafi do głównego pakietu. Kartkowanie, kąty, grubość papieru, klik i klawisze liczą `book.ts` i `view.ts` (testy w Node); `ZineScene` tylko rysuje i rysuje klatkę na żądanie (`invalidate`), nie w pętli. Tekstury stron z `renderPage` bez spadu, 1024 px wysokości, liczone w tle po otwarciu; canvas zwalniany po wysłaniu do GPU. **`scene.dispose()` woła `renderer.forceContextLoss()`**, żeby wyjście z ekranu zwalniało kontekst WebGL (przeglądarka ma ich ograniczoną liczbę). **Po przywróceniu kontekstu** (`webglcontextrestored`, opcja `onContextRestored`) ekran rysuje tekstury stron od nowa, bo GPU je zgubił.
- **WebGL w testach:** Chromium bez ekranu rysuje przez SwiftShader; flagi `--use-angle=swiftshader --enable-unsafe-swiftshader` są w `vite.config.ts` i `playwright.config.ts`. Obraz WebGL czytaj zaraz po `renderFrame` (później bufor jest pusty).
- **Nazwy plików** nie mogą różnić się tylko wielkością liter (macOS jej nie rozróżnia): stąd `notices.ts` i `NoticeList.tsx`, `spreadLabels.ts` i `SpreadList.tsx`.
- **Testy komponentów:** `*.browser.test.tsx` z `vitest-browser-react`. Pliki do `<input type="file">` podawaj przez `chooseFiles` (`src/test/files.ts`), bo `userEvent.upload` psuje pliki binarne.
