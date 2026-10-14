# ZINIARZ

Aplikacja webowa do składania zinów: broszura zszywana z kartek A4 złożonych na pół (każda kartka = 4 strony A5), druk dwustronny na domowej drukarce ze spadami. Spec: `docs/superpowers/specs/2026-10-14-ziniarz-design.md`. Plany: `docs/superpowers/plans/`.

Użytkowniczka nie jest programistką: pisze po polsku i opisuje efekt, a nie implementację. Odpowiadaj po polsku. Kod, komentarze i commity pisz po angielsku. Interfejs i komunikaty błędów po polsku.

## Szybki start

```bash
npm install
npx playwright install chromium
npm test
npm run dev
```

- `npm run test:unit`: czysta logika w Node. `npm run test:browser`: render, fonty, PDF w Chromium (Vitest browser mode).
- `test-output/`: próbne arkusze PNG i PDF z `src/print/samples.browser.test.ts` do obejrzenia.
- `vite.config.ts` wymienia `konva` i `pdf-lib` w `optimizeDeps.include`, żeby testy w przeglądarce nie przeładowywały się w trakcie przebiegu. Każdą nową bibliotekę używaną w testach przeglądarkowych dopisz tam też.

## Struktura

| Ścieżka | Odpowiedzialność |
|---|---|
| `src/model/` | Typy zina (`types.ts`), numeracja stron i rozkładówek (`geometry.ts`), wartości domyślne (`factory.ts`), wczytywanie z wartościami domyślnymi i wersją (`parse.ts`), dodawanie i usuwanie kartek (`sheets.ts`). |
| `src/imposition/` | Kolejność stron na arkuszach (`imposition.ts`), skala pod margines drukarki (`layout.ts`), znaczniki cięcia i zgięcia (`marks.ts`). Czysta matematyka. |
| `src/storage/` | IndexedDB (`db.ts`), sprzątanie nieużywanych zdjęć i fontów (`cleanup.ts`), pliki `.zin` (`zinFile.ts`). |
| `src/images/` | Wczytywanie zdjęć: zmniejszanie do 3600 px, JPEG albo PNG z przezroczystością. |
| `src/fonts/` | Rejestracja fontów (`FontFace`), nazwy rodzin dla Konvy, czekanie na fonty przed eksportem. |
| `src/render/` | Jedyny rysownik (Konva): rozkładówka w mm (`buildSpread.ts`), strona i rozkładówka do canvasu (`renderPage.ts`). |
| `src/print/` | Strona arkusza (`sheetSide.ts`), PDF arkuszy i stron (`pdf.ts`), strona próbna (`testPage.ts`). |

## Zasady i niezmienniki

- **Jednostki:** wszystko w milimetrach w skali A5 (strona 148×210). Rozkładówka: x 0…296, grzbiet x = 148, spad 3 mm poza nią.
- **Rozkładówka `i`** ma strony `2i` (lewa) i `2i + 1` (prawa). Strony 0 i `P + 1` nie istnieją (okładki stoją same). Element należy do rozkładówki i może leżeć przez grzbiet.
- **Jeden rysownik.** Edytor, miniatury, PDF i 3D rysują przez `buildSpreadGroup`. Nie twórz osobnej ścieżki rysowania. Tekst rysuje tylko `Konva.Text`.
- **Spad tylko na zewnętrznych krawędziach strony;** przy grzbiecie strona kończy się równo (`pageRect`).
- **Impozycja:** kartka `k`: przód `P − 2k | 2k + 1`, tył `2k + 2 | P − 2k − 1`. PDF poziomy, tył pod „odwracanie po krótszej krawędzi”; „Obróć tyły o 180°” dla drukarek odwracających po dłuższej.
- **Skala druku:** `s = min(1, (297 − 2m − 2c)/(296 + 2b), (210 − 2m − 2c)/(210 + 2b))`; spad i znaczniki zawsze mieszczą się w obszarze druku (pilnuje test).
- **Kartki:** dodawanie i usuwanie nigdy nie przesuwa okładek ani wewnętrznych stron okładek (poza wyjątkami 1 i 2 kartek opisanymi w specu). Kolory tła idą za stronami.
- **Kompatybilność danych:** nowe pole = wartość domyślna w `parseZine`. Zmiana znaczenia pola = nowa `FORMAT_VERSION` i migracja. Nowsza wersja pliku = czytelny błąd, nigdy częściowy zin.
- **Zdjęcia i fonty leżą w IndexedDB, nigdy w JSON-ie zina.** Sprzątanie (`pruneUnusedAssets`) tylko z listy zinów, nigdy w trakcie edycji. Font jest „używany”, gdy jest na liście `Zine.fonts`.
- **Wczytanie `.zin` tworzy nowy zin** (nowe id), nigdy nie nadpisuje istniejącego.
- **Eksport rysuje arkusze po jednym** i zwalnia canvas (`releaseCanvas`); `drawToCanvas` wymusza `Konva.pixelRatio = 1`.
