# ZINIARZ — aplikacja do składania zinów

Data: 2026-10-14

## Cel

Aplikacja webowa do robienia zinów od pustej strony do pliku PDF gotowego do druku w domu. Zin to broszura zszywana w grzbiecie: kartki A4 złożone na pół, każda kartka daje 4 strony A5. Użytkownicy zrobili już dwa ziny: z 5 kartek (20 stron) i z 6 kartek (24 strony).

Decyzje użytkowniczki:

- Osobna aplikacja webowa, nie narzędzie w KONTENTEUSZU. Repo `~/projects/ziniarz`, nazwa wyświetlana **ZINIARZ**.
- Strona w internecie (darmowy hosting), ale wszystkie dane zostają w przeglądarce. Bez kont i serwera.
- Jedna osoba pracuje nad zinem naraz. Przekazanie zina drugiej osobie: plik `.zin`.
- Praca na komputerze (myszka, gładzik, klawiatura).
- Strony powstają w edytorze w apce. Elementy: zdjęcia i napisy, także przez dwie strony rozkładówki.
- Druk na domowej drukarce na A4, dwustronnie, ze spadami, potem przycinanie.
- Podejście A: jeden rysownik (canvas) dla edytora, miniatur, PDF i podglądu 3D. PDF z arkuszy jako obrazów 300 dpi.
- Podgląd 3D złożonego zina do kartkowania.

Poza pierwszą wersją: efekty ksero/riso, rysowanie i kształty, szablony stron, przesuwanie stron w grubym zinie (creep), druk w drukarni (CMYK, PDF wektorowy), zmiana kolejności rozkładówek, mockupy do social mediów.

## Pojęcia

- **Kartka (arkusz):** jedna kartka A4 drukowana z obu stron. Liczba kartek `sheets` = 1…20.
- **Strona:** połowa kartki po złożeniu, format A5 148×210 mm. Liczba stron `P = 4 · sheets`. Strony numerujemy od 1 (przednia okładka) do `P` (tylna okładka).
- **Rozkładówka:** to, co czytelnik widzi po otwarciu zina. Rozkładówka `i` (0…`P/2`) ma lewą stronę `2i` i prawą `2i + 1`. Strony 0 i `P + 1` nie istnieją, więc rozkładówka 0 to sama przednia okładka (po prawej), a rozkładówka `P/2` to sama tylna okładka (po lewej).
- **Spad:** 3 mm tła i zdjęć poza krawędzią strony, odcinane przy przycinaniu. Tylko na zewnętrznych krawędziach strony (góra, dół, krawędź przeciwna do grzbietu). Przy grzbiecie strona kończy się równo.
- **Margines:** prowadnica w odległości od krawędzi strony, w której trzymamy napisy. Domyślnie 30 mm od każdej krawędzi, także od grzbietu.

## Model danych (`src/model/`)

Wszystkie wymiary w milimetrach, w skali projektu (A5 = 148×210). Rozkładówka ma układ współrzędnych od lewego górnego rogu lewej strony: szerokość 296, wysokość 210, grzbiet na x = 148. Spad wychodzi poza ten prostokąt (x od −3 do 299, y od −3 do 213).

```ts
interface Zine {
  formatVersion: number;        // migracje przy wczytaniu
  id: string;
  title: string;
  sheets: number;               // 1...20, P = 4 * sheets
  margins: { outer: number; inner: number; top: number; bottom: number }; // domyślnie 30 mm
  spreads: Spread[];            // długość P/2 + 1
  pages: Record<number, PageStyle>; // kolor tła strony, brak = biały
  print: PrintSettings;         // ostatnie ustawienia eksportu
  createdAt: string; updatedAt: string;
}

interface Spread { id: string; elements: Element[] } // kolejność = kolejność rysowania, ostatni na wierzchu

type Element = PhotoElement | TextElement;

interface Frame { id: string; x: number; y: number; width: number; height: number; rotation: number }

interface PhotoElement extends Frame {
  kind: 'photo';
  imageId: string;              // plik w magazynie zdjęć, nigdy w JSON
  crop: { offsetX: number; offsetY: number; zoom: number }; // zdjęcie w ramce, zoom >= 1 (wypełnia ramkę)
  flipX: boolean; opacity: number;
}

interface TextElement extends Frame {
  kind: 'text';                 // height liczona z tekstu, width = szerokość łamania
  text: string;
  fontId: string; size: number; // punkty typograficzne w skali A5
  bold: boolean; italic: boolean; // tylko gdy font ma taki wariant
  letterSpacing: number;        // kerning, w tysięcznych em
  lineHeight: number;           // mnożnik, domyślnie 1.2
  color: string; align: 'left' | 'center' | 'right' | 'justify';
}
```

- Element należy do rozkładówki, nie do strony. Może leżeć przez grzbiet.
- Część elementu na nieistniejącej stronie (obok okładki) jest w edytorze wyszarzona i nie trafia do druku.
- **„+ kartka”** wstawia 2 puste rozkładówki tuż przed ostatnią (tylna okładka zostaje na końcu). **„− kartka”** usuwa 2 rozkładówki przed ostatnią; gdy mają elementy albo kolor tła, apka najpierw pyta. Minimum 1 kartka.
- Kolory tła stron przesuwają się razem z numeracją przy dodawaniu i usuwaniu kartek.
- Nowe pola w modelu zawsze z wartością domyślną przy wczytywaniu. Zmiana znaczenia pola = nowa `formatVersion` i migracja. Test wczytuje zapisane pliki starych wersji.

## Edytor (`src/editor/`)

- **Ekran startowy:** lista zinów z miniaturą okładki. Nowy zin (tytuł, liczba kartek), otwórz, powiel, usuń (z potwierdzeniem), „Zapisz plik .zin”, „Wczytaj plik .zin”.
- **Układ:** pasek u góry (tytuł, „+ Zdjęcie”, „+ Napis”, cofnij/ponów, „Podgląd 3D”, „Druk”), po lewej miniatury rozkładówek, w środku bieżąca rozkładówka, po prawej ustawienia zaznaczonego elementu albo strony.
- **Prowadnice:** linia spadu (czerwona przerywana), marginesy (niebieskie przerywane), grzbiet. Przełącznik „pokaż prowadnice”.
- **Przyciąganie:** do marginesów, krawędzi i środków stron, grzbietu, krawędzi i środków innych elementów. Alt wyłącza przyciąganie na czas przeciągania.
- **Zdjęcie:** „+ Zdjęcie” albo przeciągnięcie plików na rozkładówkę. Nowe zdjęcie wypełnia obszar między marginesami strony, na którą je upuszczono (z zachowaniem proporcji). Uchwyty w rogach zmieniają rozmiar z zachowaniem proporcji, z Shiftem swobodnie; boki zmieniają tylko szerokość albo wysokość ramki. Uchwyt obrotu nad ramką. Podwójne kliknięcie = kadrowanie: przeciąganie zdjęcia w ramce, suwak i kółko myszy przybliżają, Enter albo klik obok kończy. Ustawienia: odbicie, przezroczystość.
- **Napis:** „+ Napis” wstawia ramkę od marginesu do marginesu bieżącej strony (szerokość łamania = szerokość obszaru między marginesami). Tekst łamie się w ramce, wysokość rośnie z tekstem. Krawędzie ramki przyciągają się do marginesów, ale ramkę można przeciągnąć i rozciągnąć poza margines, aż przez grzbiet. Podwójne kliknięcie = edycja tekstu na miejscu. Ustawienia: font, rozmiar, pogrubienie, kursywa, kerning, odstęp między wierszami, kolor, wyrównanie, obrót.
- **Strona:** klik w puste miejsce strony pokazuje jej ustawienia: kolor tła. Ustawienia zina: marginesy (cztery wartości), tytuł.
- **Kolory:** próbnik z HEX-em i próbki kolorów użytych w zinie.
- **Fonty:** zestaw darmowych fontów (licencja OFL) dostarczony z apką i wgrywanie własnych `.ttf`/`.otf`/`.woff2`. Własne fonty leżą w magazynie i jadą w pliku `.zin`. Pogrubienie i kursywa są dostępne tylko, gdy font ma taki plik; inaczej przełącznik jest wyszarzony.
- **Warstwy:** „na wierzch”, „wyżej”, „niżej”, „na spód”.
- **Skróty:** Cmd+Z / Shift+Cmd+Z, Delete, Cmd+C / Cmd+V (także między rozkładówkami), Cmd+D (powiel), strzałki przesuwają o 1 mm, z Shiftem o 10 mm, Escape odznacza, PageUp/PageDown zmieniają rozkładówkę.
- **Historia:** cofnij/ponów do 100 kroków, w pamięci, na otwarty zin.
- **Zapis:** automatyczny po każdej zmianie (z opóźnieniem 500 ms), bez przycisku „Zapisz”.

## Rysownik (`src/render/`)

Jedyna droga rysowania strony i rozkładówki (Konva). Edytor, miniatury, podgląd druku, PDF i tekstury 3D korzystają z niego, różni się tylko rozdzielczość i to, czy rysujemy prowadnice.

- `renderSpread(zine, spreadIndex, { pxPerMm, guides })`: cała rozkładówka ze spadem.
- `renderPage(zine, pageNumber, { pxPerMm, bleed })`: jedna strona. Rysuje rozkładówkę przesuniętą tak, że strona jest w kadrze, i obcina do strony plus spad na zewnętrznych krawędziach. Przy grzbiecie obcina równo, więc zdjęcie przez grzbiet dzieli się na dwie strony bez dubla.
- Tekst rysuje wyłącznie Konva.Text z tymi samymi ustawieniami w edytorze i eksporcie (łamanie, `letterSpacing`, `lineHeight`), więc pomiar i rysunek zawsze się zgadzają. Rysownik czeka na wczytanie fontów (`document.fonts.load`) przed eksportem.
- Zdjęcia przy wczytaniu zmniejszamy tak, żeby dłuższy bok miał najwyżej 3600 px (ok. 300 dpi dla całej rozkładówki ze spadem), JPEG jakość 0,92, PNG gdy zdjęcie ma przezroczystość.

## Druk (`src/imposition/`, `src/print/`)

### Impozycja

Kartka `k` (0…`sheets − 1`), arkusz A4 poziomo:

- przód: lewa połowa = strona `P − 2k`, prawa = strona `2k + 1`,
- tył: lewa połowa = strona `2k + 2`, prawa = strona `P − 2k − 1`.

Przykład dla 20 stron: kartka 1 przód 20 | 1, tył 2 | 19; kartka 5 przód 12 | 9, tył 10 | 11.

### Skala pod domową drukarkę

Drukarka nie drukuje przy samej krawędzi (margines drukarki `m`, domyślnie 4 mm, ustawiany raz i zapamiętany w przeglądarce). Spad musi zmieścić się w obszarze druku, więc dwie strony ze spadem zmniejszamy jedną skalą `s`:

```
c = (linie cięcia || linia zgięcia) ? 5 : 0       // pas na znaczniki, mm, poza spadem, nie skalowany
b = spady ? 3 : 0
s = min(1, (297 − 2m − 2c) / (296 + 2b), (210 − 2m − 2c) / (210 + 2b))
```

Przy `m = 4`, spadach i bez znaczników: `s ≈ 0,935`, strona po przycięciu ok. 138×196 mm. Ze znacznikami: `s ≈ 0,889`, ok. 132×187 mm. Para stron jest wyśrodkowana na arkuszu. Ekran druku zawsze pokazuje końcowy rozmiar strony po przycięciu.

### Opcje eksportu

- **Spady** wł./wył. (domyślnie wł.).
- **Linie cięcia** wł./wył.: krótkie kreski 4 mm w przedłużeniu krawędzi przycięcia, zaczynające się 1 mm za spadem, w pasie `c`. Na zewnętrznych rogach pary stron; przy grzbiecie brak (tam się zgina, nie tnie).
- **Linia zgięcia** wł./wył.: krótkie kreski 4 mm na środku arkusza, u góry i u dołu, w pasie `c`, na obu stronach kartki. Nigdy przez całą wysokość, żeby nie było jej widać w zinie.
- **Obróć tyły o 180°** dla drukarek, które odwracają kartkę po krótszym boku.
- **Tryb dwustronny:** „automatycznie” (jeden PDF: przód 1, tył 1, przód 2, tył 2…) albo „ręcznie” (dwa PDF-y: same przody i same tyły w odwrotnej kolejności, do odwrócenia stosu).
- **Strona próbna:** jedna kartka z numerami i strzałkami na przodzie i tyle, do sprawdzenia dwustronności i marginesu drukarki.
- **PDF stronami:** strony A5 po kolei, ze spadami albo bez, do przejrzenia.

### Eksport

- Podgląd druku pokazuje każdy arkusz (przód i tył) tak, jak wyjdzie z drukarki.
- PDF składa pdf-lib: każdy arkusz rysowany osobno w 300 dpi (3508×2480 px), zapisany do JPEG i wklejony jako cała strona A4. Arkusze rysujemy po jednym, żeby nie trzymać wszystkich w pamięci. Pasek postępu.
- Rozmiar strony PDF to dokładnie A4; skalowanie przy druku ma być wyłączone („rzeczywisty rozmiar”), o czym przypomina ekran druku.

## Podgląd 3D (`src/preview3d/`)

- three.js: złożony zin ze sztywnymi stronami. Każda kartka to dwie połówki obracające się wokół grzbietu, z drobnym przesunięciem na grubość papieru.
- Tekstury stron z `renderPage` (bez spadu, ok. 1024 px wysokości), liczone w tle po otwarciu podglądu.
- Mysz: obracanie i przybliżanie (OrbitControls). Klik w prawą połowę albo strzałka w prawo przewraca stronę dalej, w lewą połowę albo strzałka w lewo wstecz. Animacja przewracania 0,6 s.
- Podgląd otwiera się na okładce. Rozmiar strony jak po przycięciu w bieżących ustawieniach druku.

## Magazyn (`src/storage/`)

- IndexedDB: tabela zinów (JSON), tabela zdjęć (Blob, klucz `imageId`), tabela fontów (Blob + nazwa, grubość, kursywa).
- Zdjęcia i fonty nieużywane przez żaden zin są usuwane przy otwarciu listy zinów, nigdy w trakcie edycji.
- Plik `.zin`: zip z `zine.json`, folderem `images/` i `fonts/`. Wczytanie tworzy nowy zin (nowe id), nigdy nie nadpisuje istniejącego.
- Apka prosi przeglądarkę o trwały magazyn (`navigator.storage.persist()`) i pokazuje zajęte miejsce. Przy braku miejsca komunikat: zapisz plik `.zin` i usuń stare ziny.

## Błędy

Komunikaty po polsku, bez technicznych szczegółów. Nic się nie nadpisuje po błędzie.

- Uszkodzony albo nieznany plik `.zin` / nowsza `formatVersion`: „Nie da się otworzyć tego pliku”, z powodem.
- Plik nie jest obrazem albo fontem: pominięty, z informacją ile pominięto.
- Brak miejsca w przeglądarce: jak wyżej w Magazynie.
- Błąd eksportu PDF: komunikat i możliwość ponowienia; część pliku nie jest pobierana.

## Technika

- Vite + React + TypeScript (strict). Konva (react-konva) do rysowania, pdf-lib do PDF, three.js do 3D, `idb` do IndexedDB, JSZip do `.zin`. Stan edytora w Zustand z historią cofania.
- Obsługiwane przeglądarki: aktualne Chrome, Safari i Firefox na komputerze.
- Interfejs po polsku. Kod, komentarze i commity po angielsku.
- Hosting: GitHub Pages, publikacja przez GitHub Actions po pushu do `main`.
- Repo ma własny `CLAUDE.md` po polsku (opis, struktura, zasady), jak w KONTENTEUSZU.

## Testy

- **Vitest, czysta logika:** impozycja (5 i 6 kartek dokładnie, każda strona dokładnie raz dla N = 1…20), skala `s` i rozmiar po przycięciu dla różnych opcji, pozycje znaczników, dodawanie i usuwanie kartek (tylna okładka zostaje na końcu, kolory tła idą za stronami), przypisanie fragmentów elementu przez grzbiet do stron, migracje `formatVersion`, zapis i odczyt `.zin`.
- **Testy renderu:** arkusze przykładowego zina rysowane do PNG i porównywane z wzorcem (z tolerancją); wzorce w repo, odświeżane świadomie.
- **Playwright (Chrome):** nowy zin 5 kartek, dodanie zdjęcia i napisu, eksport PDF; sprawdzenie, że PDF ma 10 stron A4.
