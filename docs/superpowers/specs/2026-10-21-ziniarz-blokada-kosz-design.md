# ZINIARZ: blokada elementów i kosz

Zmiana do `2026-10-14-ziniarz-design.md`. Zdjęcie albo napis można zablokować, żeby przypadkiem go nie przesunąć. Kosz wyrzuca zaznaczony element jednym kliknięciem.

## Dlaczego

Usuwanie jest dziś schowane: przycisk „Usuń” w kolumnie „Ustawienia” (domyślnie ukrytej) i klawisz Backspace. Blokady nie ma. Duże zdjęcie w tle łatwo przesunąć, gdy chce się złapać napis albo kliknąć stronę.

Odrzucone:
- **Zablokowany element jak tło (klik przechodzi przez niego):** trzeba by osobnej listy warstw do odblokowania, a Ziniarz jej nie ma.
- **Zablokowane wszystko (też tekst, kolor, kadr):** właścicielka chce dalej poprawiać literówki i kolory bez odblokowywania.
- **Przyciski w górnym pasku:** dalej od elementu, którego dotyczą.

## Jak to wygląda w użyciu

- Zaznaczone zdjęcie albo napis ma tuż nad sobą mały pasek z dwoma przyciskami: **kłódka** i **kosz**. Gdy nad elementem brak miejsca w oknie płótna, pasek stoi pod nim. Pasek znika, gdy nic nie jest zaznaczone, w trakcie przeciągania, zmiany rozmiaru i obracania (wraca po puszczeniu myszy) oraz w trybie pisania w napisie i kadrowania zdjęcia.
- **Kosz** (`aria-label` „Wyrzuć”) usuwa element od razu, bez pytania. „Cofnij” (⌘Z) przywraca go.
- **Kłódka** (`aria-label` „Zablokuj” / „Odblokuj”, `aria-pressed`) przełącza blokadę. Blokada i odblokowanie to zwykły krok cofania.
- **Zablokowany element:**
  - da się go zaznaczyć kliknięciem (pokazuje ramkę zaznaczenia, bez uchwytów), żeby go odblokować albo zmienić treść;
  - nie przesuwa się myszą ani strzałkami, nie zmienia rozmiaru ani obrotu (pole „Obrót” w ustawieniach jest wyszarzone);
  - nie da się go wyrzucić: kosz jest wyszarzony z podpowiedzią „Odblokuj, żeby wyrzucić”, a Delete i Backspace nic nie robią; przycisk „Usuń” w ustawieniach też jest wyszarzony;
  - treść zmienia się jak zwykle: tekst (dwuklik), font, rozmiar pisma, kolor, wyrównanie, kadr i przybliżenie zdjęcia, odbicie, przezroczystość, kolejność warstw.
- Kopia („Powiel”, ⌘D, wklejenie) wychodzi odblokowana.
- Inne elementy dalej przyciągają się do zablokowanego.
- „− kartka” usuwa rozkładówki razem z zablokowanymi elementami, jak dotąd z pytaniem, gdy jest na nich treść.

## Dane

- Nowe pole elementu `locked: boolean` (w `Frame`, więc ma je zdjęcie i napis). `parseZine` daje `false`, gdy go brak; bez zmiany `FORMAT_VERSION`. Starsza wersja Ziniarza pomija to pole.
- Blokada jest w JSON-ie zina, więc idzie z plikiem `.zin`, z „Powiel” zina i na Dysk Google.
- Rysownik, druk, miniatury i 3D blokady nie czytają.

## Jak to zrobić

- **Sklep pilnuje blokady** (jedno miejsce, niezależne od przycisków): `updateElement` dla zablokowanego elementu pomija zmiany `x`, `y`, `width`, `height` z zewnątrz i `rotation` (wysokość napisu liczy dalej `normalize`); `deleteSelected` i `nudgeSelected` nic nie robią. Nowa akcja `toggleLockSelected()` przełącza `locked` (krok cofania). `cloneForPaste` ustawia `locked: false`.
- **Płótno** (`EditorStage`): zablokowany węzeł nie jest `draggable`, Transformer nie ma uchwytów ani obrotu, zostaje sama ramka. `StageCallbacks` dostaje informację o początku i końcu gestu (przeciąganie, Transformer), żeby pasek mógł się schować.
- **Pasek** (`SelectionToolbar.tsx` w `src/editor/canvas/`): zwykłe przyciski HTML nałożone na płótno jak `TextEditor`, pozycja z ramki elementu (obrócony prostokąt → najmniejszy prostokąt wokół niego) przeliczonej przez `Viewport`. Pozycję liczy czysta funkcja z testem w Node. Ikony to SVG w kodzie (bez nowych plików i bibliotek).
- **Ustawienia:** pole „Obrót” i przycisk „Usuń” wyszarzone, gdy element zablokowany.

## Testy

- Node: `parseZine` (brak pola → `false`, `true` zostaje), sklep (zablokowany: brak przesunięcia, zmiany rozmiaru, obrotu, usunięcia; zmiana koloru i tekstu działa; przełączenie to jeden krok cofania; kopia odblokowana), pozycja paska (nad, pod przy górnej krawędzi).
- Przeglądarka: płótno nie przesuwa zablokowanego elementu przeciągnięciem i nie pokazuje uchwytów; pasek w edytorze: kosz wyrzuca i ⌘Z przywraca, kłódka blokuje i kosz staje się wyszarzony, pasek znika przy pustym zaznaczeniu i w trybie pisania.
