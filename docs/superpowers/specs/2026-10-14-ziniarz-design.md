# ZINIARZ — aplikacja do składania zinów

Data: 2026-10-14

## Cel

Aplikacja webowa do robienia zinów od pustej strony do pliku PDF gotowego do druku w domu. Zin to broszura zszywana w grzbiecie: kartki A5 złożone na pół, każda kartka daje 4 strony A6. Każdą kartkę drukuje się w domu na środku arkusza A4, a potem wycina po liniach cięcia. Użytkownicy zrobili już dwa ziny: z 5 kartek (20 stron) i z 6 kartek (24 strony).

Decyzje użytkowniczki:

- Osobna aplikacja webowa, nie narzędzie w KONTENTEUSZU. Repo `~/projects/ziniarz`, nazwa wyświetlana **ZINIARZ**.
- Strona w internecie (darmowy hosting), ale wszystkie dane zostają w przeglądarce. Bez kont i serwera.
- Jedna osoba pracuje nad zinem naraz. Przekazanie zina drugiej osobie: plik `.zin`.
- Praca na komputerze (myszka, gładzik, klawiatura).
- Strony powstają w edytorze w apce. Elementy: zdjęcia i napisy, także przez dwie strony rozkładówki.
- Druk na domowej drukarce na A4, dwustronnie, ze spadami, potem wycinanie kartki A5 po liniach cięcia i składanie.
- Podejście A: jeden rysownik (canvas) dla edytora, miniatur, PDF i podglądu 3D. PDF z arkuszy jako obrazów 300 dpi.
- Podgląd 3D złożonego zina do kartkowania.

Poza pierwszą wersją: efekty ksero/riso, rysowanie i kształty, szablony stron, przesuwanie stron w grubym zinie (creep), druk w drukarni (CMYK, PDF wektorowy), zmiana kolejności rozkładówek, mockupy do social mediów.

## Pojęcia

- **Kartka:** jedna kartka A5 zina, drukowana z obu stron na środku arkusza A4 i wycinana z niego. Liczba kartek `sheets` = 1…20.
- **Arkusz:** kartka A4 z drukarki, na której stoi jedna kartka zina; reszta papieru to odpad.
- **Strona:** połowa kartki po złożeniu, format A6 105×148 mm. Liczba stron `P = 4 · sheets`. Strony numerujemy od 1 (przednia okładka) do `P` (tylna okładka).
- **Rozkładówka:** to, co czytelnik widzi po otwarciu zina. Rozkładówka 0 to cała okładka od zewnątrz: strona `P` (tył) po lewej, strona 1 (przód) po prawej. Rozkładówki `1 … 2 · sheets − 1` mają lewą stronę `2i` i prawą `2i + 1` (zmiana: `2026-10-15-ziniarz-okladka-design.md`).
- **Spad:** 3 mm tła i zdjęć poza krawędzią strony, odcinane przy przycinaniu. Tylko na zewnętrznych krawędziach strony (góra, dół, krawędź przeciwna do grzbietu). Przy grzbiecie strona kończy się równo.
- **Margines:** prowadnica w odległości od krawędzi strony, w której trzymamy napisy. Domyślnie 12 mm od zewnętrznej krawędzi, 7 mm od grzbietu, 14 mm od góry i 11 mm od dołu; każdy zin ma własne.

## Model danych (`src/model/`)

Wszystkie wymiary w milimetrach na wydrukowanej, przyciętej stronie A6 (105×148): to, co stoi w panelu, wychodzi z drukarki 1:1. Rozkładówka ma układ współrzędnych od lewego górnego rogu lewej strony: szerokość 210, wysokość 148, grzbiet na x = 105. Spad wychodzi poza ten prostokąt (x od −3 do 213, y od −3 do 151). Rozmiary siedzą w stałych `PAGE_WIDTH`, `PAGE_HEIGHT`, `SPREAD_WIDTH` (`src/model/geometry.ts`).

```ts
interface Zine {
  formatVersion: number;        // 2 = strony A6; migracje przy wczytaniu
  id: string;
  title: string;
  sheets: number;               // 1...20, P = 4 * sheets
  margins: { outer: number; inner: number; top: number; bottom: number }; // domyślnie 12 / 7 / 14 / 11 mm
  spreads: Spread[];            // długość P/2 + 1
  pages: Record<number, PageStyle>; // kolor tła strony, brak = biały
  fonts: string[];              // id własnych rodzin fontów wgranych do tego zina
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
  fontFamilyId: string;         // rodzina fontu (wbudowana albo własna)
  size: number;                 // punkty typograficzne na wydruku (nowy napis 9 pt)
  bold: boolean; italic: boolean; // wybiera plik z rodziny; tylko gdy rodzina ma taki wariant
  letterSpacing: number;        // kerning, w tysięcznych em
  lineHeight: number;           // mnożnik, domyślnie 1.2
  color: string; align: 'left' | 'center' | 'right' | 'justify';
}
```

- Element należy do rozkładówki, nie do strony. Może leżeć przez grzbiet.
- Element może przechodzić przez grzbiet okładki z tyłu na przód; drukuje się w całości na przodzie kartki 1.
- Rozkładówka 1 zawiera wewnętrzną stronę przedniej okładki (strona 2), rozkładówka `P/2 − 1` wewnętrzną stronę tylnej okładki (strona `P − 1`). Rozkładówki przesuwają się zawsze w całości.
- **„+ kartka”** wstawia 2 puste rozkładówki (4 strony) za rozkładówką `j = clamp(bieżąca, 1, P/2 − 2)`. Dzięki temu obie okładki i obie wewnętrzne strony okładek zostają na miejscu. Wyjątek: przy 1 kartce (P = 4) rozkładówka 1 zawiera obie wewnętrzne strony okładek; nowe strony idą za nią, więc treść strony 3 zostaje na stronie 3, a nowa wewnętrzna strona tylnej okładki (7) jest pusta.
- **„− kartka”** usuwa dwie sąsiednie rozkładówki `j` i `j + 1`, gdzie `j = clamp(bieżąca, 2, P/2 − 3)`, więc okładki i ich wewnętrzne strony zostają. Przy 2 kartkach (P = 8) takiej pary nie ma; wtedy usuwa rozkładówki 2 i 3, a wewnętrzną stroną tylnej okładki staje się strona 3. Zanim usunie, zawsze podświetla, które strony znikną, i pyta, gdy mają elementy albo kolor tła. Minimum 1 kartka.
- Kolory tła stron przesuwają się razem z numeracją przy dodawaniu i usuwaniu kartek.
- Nowe pola w modelu zawsze z wartością domyślną przy wczytywaniu. Zmiana znaczenia pola = nowa `formatVersion` i migracja. Test wczytuje zapisane pliki starych wersji.
- **`formatVersion` 2 = strony A6.** Wersja 1 (albo brak wersji) to dawny zin A5; `parseZine` przelicza go na A6 (`migrateA5ToA6` w `src/model/migrate.ts`): skalowanie liniowe, krawędzie stron trafiają w krawędzie stron, wystawanie w spad (do 3 mm) zostaje, rozmiar napisu idzie za szerokością łamania, kadr zdjęć nadal wypełnia ramkę. Szczegóły w `2026-10-15-ziniarz-a6-design.md`. Zapis zawsze bierze zin z `parseZine`, więc przeliczony zin nigdy nie jest zapisany jako wersja 1.

## Edytor (`src/editor/`)

- **Ekran startowy:** lista zinów z miniaturą okładki. Nowy zin (tytuł, liczba kartek), otwórz, powiel, usuń (z potwierdzeniem), „Zapisz plik .zin”, „Wczytaj plik .zin”.
- **Układ:** pasek u góry (tytuł, „+ Zdjęcie”, „+ Napis”, cofnij/ponów, „Podgląd 3D”, „Druk”), po lewej miniatury rozkładówek, w środku bieżąca rozkładówka, po prawej ustawienia zaznaczonego elementu albo strony.
- **Prowadnice:** linia spadu (czerwona przerywana), marginesy (niebieskie przerywane), grzbiet. Przełącznik „pokaż prowadnice”.
- **Przyciąganie:** do marginesów, krawędzi i środków stron, grzbietu, krawędzi i środków innych elementów. Alt wyłącza przyciąganie na czas przeciągania.
- **Zdjęcie:** „+ Zdjęcie” albo przeciągnięcie plików na rozkładówkę. Nowe zdjęcie wypełnia obszar między marginesami strony, na którą je upuszczono (z zachowaniem proporcji). Uchwyty w rogach zmieniają rozmiar z zachowaniem proporcji, z Shiftem swobodnie; boki zmieniają tylko szerokość albo wysokość ramki. Uchwyt obrotu nad ramką. Podwójne kliknięcie = kadrowanie: przeciąganie zdjęcia w ramce, suwak i kółko myszy przybliżają, Enter albo klik obok kończy. Ustawienia: odbicie, przezroczystość.
- **Napis:** „+ Napis” wstawia ramkę od marginesu do marginesu bieżącej strony (szerokość łamania = szerokość obszaru między marginesami). Tekst łamie się w ramce, wysokość rośnie z tekstem. Krawędzie ramki przyciągają się do marginesów, ale ramkę można przeciągnąć i rozciągnąć poza margines, aż przez grzbiet. Podwójne kliknięcie = edycja tekstu na miejscu. Ustawienia: font, rozmiar, pogrubienie, kursywa, kerning, odstęp między wierszami, kolor, wyrównanie, obrót.
- **Strona:** klik w puste miejsce strony pokazuje jej ustawienia: kolor tła. Ustawienia zina: marginesy (cztery wartości), tytuł.
- **Kolory:** próbnik z HEX-em i próbki kolorów użytych w zinie.
- **Fonty:** zestaw darmowych fontów (licencja OFL) dostarczony z apką i wgrywanie własnych `.ttf`/`.otf`/`.woff2`. Własny font wgrywa się do bieżącego zina. Pliki o tej samej nazwie rodziny (np. Regular, Bold, Italic) łączą się w jedną rodzinę, która trafia na listę `Zine.fonts` . Rodzina jest dostępna w zinie także wtedy, gdy żaden napis jej jeszcze nie używa. Plik `.zin` zabiera wszystkie rodziny z tej listy. Przycisk „użyj fontu z innego zina” dopisuje istniejącą rodzinę do listy bez ponownego wgrywania. Pogrubienie i kursywa są dostępne tylko, gdy rodzina ma taki plik; inaczej przełącznik jest wyszarzony.
- **Warstwy:** „na wierzch”, „wyżej”, „niżej”, „na spód”.
- **Skróty:** Cmd+Z / Shift+Cmd+Z, Delete, Cmd+C / Cmd+V (także między rozkładówkami), Cmd+D (powiel), strzałki przesuwają o 1 mm, z Shiftem o 10 mm, Escape odznacza, PageUp/PageDown zmieniają rozkładówkę.
- **Historia:** cofnij/ponów do 100 kroków, w pamięci, na otwarty zin.
- **Zapis:** automatyczny po każdej zmianie (z opóźnieniem 500 ms), bez przycisku „Zapisz”.

## Rysownik (`src/render/`)

Jedyna droga rysowania strony i rozkładówki (Konva). Edytor, miniatury, podgląd druku, PDF i tekstury 3D korzystają z niego, różni się tylko rozdzielczość i to, czy rysujemy prowadnice.

- `renderSpread(zine, spreadIndex, { pxPerMm, guides })`: cała rozkładówka ze spadem.
- `renderPage(zine, pageNumber, { pxPerMm, bleed })`: jedna strona. Rysuje rozkładówkę przesuniętą tak, że strona jest w kadrze, i obcina do strony plus spad na zewnętrznych krawędziach. Przy grzbiecie obcina równo, więc zdjęcie przez grzbiet dzieli się na dwie strony bez dubla.
- Tekst rysuje wyłącznie Konva.Text z tymi samymi ustawieniami w edytorze i eksporcie (łamanie, `letterSpacing`, `lineHeight`), więc pomiar i rysunek zawsze się zgadzają. Rysownik czeka na wczytanie fontów (`document.fonts.load`) przed eksportem.
- Zdjęcia przy wczytaniu zmniejszamy tak, żeby dłuższy bok miał najwyżej 3600 px (ponad 300 dpi dla całej rozkładówki A6 ze spadem), JPEG jakość 0,92, PNG gdy zdjęcie ma przezroczystość.

## Druk (`src/imposition/`, `src/print/`)

### Impozycja

Kartka `k` (0…`sheets − 1`) na arkuszu A4 poziomo:

- przód: lewa połowa = strona `P − 2k`, prawa = strona `2k + 1`,
- tył: lewa połowa = strona `2k + 2`, prawa = strona `P − 2k − 1`.

Przykład dla 20 stron: k = 0 (pierwsza kartka) przód 20 | 1, tył 2 | 19; k = 4 (piąta kartka) przód 12 | 9, tył 10 | 11.

Strony parzyste leżą zawsze na lewej połowie kartki, nieparzyste na prawej, więc grzbiet każdej strony jest na środku arkusza, a zewnętrzna krawędź na zewnątrz.

Strony PDF są poziome (MediaBox 842×595 pt), treść nie jest obracana. Tył jest ułożony dla kartki odwracanej w lewo/prawo, czyli dla druku dwustronnego **„odwracanie po krótszej krawędzi”**. Ekran druku mówi, żeby wybrać tę opcję w oknie drukowania.

### Kartka na arkuszu

Kartka zina (dwie strony A6 obok siebie, 210×148 mm) stoi w skali 100% na środku arkusza A4 poziomo, ze spadem 3 mm, gdy spady są włączone. Znaczniki leżą w pasie `c` poza spadem:

```
c = (linie cięcia || linia zgięcia) ? 5 : 0       // pas na znaczniki, mm
```

Od spadu i znaczników do krawędzi arkusza zostaje ponad 20 mm papieru (pilnuje test), więc wszystko mieści się w obszarze druku każdej domowej drukarki: nie ma marginesu drukarki ani skalowania. Strona po przycięciu ma zawsze 105×148 mm, co pokazuje ekran druku. Po wydruku kartkę wycina się po liniach cięcia i składa na znacznikach zgięcia.

### Opcje eksportu

- **Spady** wł./wył. (domyślnie wł.).
- **Linie cięcia** wł./wył.: krótkie kreski 4 mm w przedłużeniu krawędzi przycięcia, zaczynające się 1 mm za spadem, w pasie `c`. Na czterech zewnętrznych rogach kartki; przy grzbiecie brak (tam się zgina, nie tnie).
- **Linia zgięcia** wł./wył.: krótkie kreski 4 mm nad i pod grzbietem kartki, w pasie `c`, na obu stronach kartki. Nigdy przez całą wysokość, żeby nie było jej widać w zinie.
- **Obróć tyły o 180°** dla drukarek, które umieją odwracać kartkę tylko po dłuższej krawędzi (wtedy bez obrotu tył wychodzi do góry nogami).
- **Tryb dwustronny:** „automatycznie” (jeden PDF: przód 1, tył 1, przód 2, tył 2…) albo „ręcznie” (dwa PDF-y: same przody i same tyły, do włożenia stosu z powrotem). W trybie ręcznym przełącznik „tyły w odwrotnej kolejności” (domyślnie wł.), bo zależy to od tego, jak drukarka odkłada kartki.
- **Strona próbna:** dwie kartki (strony 1–8), na każdej stronie duży numer, strzałka „↑ góra” i podpis „kartka N · przód/tył”, do sprawdzenia dwustronności (dwie, bo przy jednej kartce złej kolejności tyłów nie widać). Położenia i rozmiary liczone względem rozmiaru strony. Na okładce krótka instrukcja: wytnij obie kartki po liniach cięcia i złóż na pół na znaczniku zgięcia, kartka 2 w środku, strony mają iść od 1 do 8 i stać „↑ góra”; tył do góry nogami = włącz „Obróć tyły o 180°”; na tyle kartki 1 mają być strony 2 | 7, na tyle kartki 2 strony 4 | 5, a jeśli tyły trafiły na złe kartki = przełącz „tyły w odwrotnej kolejności”.
- **PDF stronami:** strony A6 po kolei, ze spadami albo bez, do przejrzenia.

### Eksport

- Podgląd druku pokazuje każdy arkusz (przód i tył) tak, jak wyjdzie z drukarki.
- PDF składa pdf-lib: każdy arkusz rysowany osobno w 300 dpi (3508×2480 px), zapisany do JPEG i wklejony jako cała strona A4. Arkusze rysujemy po jednym, żeby nie trzymać wszystkich w pamięci. Pasek postępu.
- Rozmiar strony PDF to dokładnie A4; skalowanie przy druku ma być wyłączone („rzeczywisty rozmiar”, 100%), o czym przypomina ekran druku. Inaczej strona po przycięciu nie wyjdzie 105×148 mm.

## Podgląd 3D (`src/preview3d/`)

- three.js: złożony zin ze sztywnymi stronami. Każda kartka to dwie połówki obracające się wokół grzbietu, z drobnym przesunięciem na grubość papieru.
- Tekstury stron z `renderPage` (bez spadu, ok. 1024 px wysokości), liczone w tle po otwarciu podglądu.
- Mysz: obracanie i przybliżanie (OrbitControls). Klik w prawą połowę albo strzałka w prawo przewraca stronę dalej, w lewą połowę albo strzałka w lewo wstecz. Animacja przewracania 0,6 s.
- Podgląd otwiera się na okładce. Rozmiar strony jak po przycięciu: A6, 105×148 mm (`PAGE_WIDTH`, `PAGE_HEIGHT`).

## Magazyn (`src/storage/`)

- IndexedDB: tabela zinów (JSON), tabela zdjęć (Blob, klucz `imageId`), tabela rodzin fontów (id, nazwa) i tabela plików fontów (Blob, id rodziny, pogrubienie, kursywa).
- Zdjęcia, których nie używa żaden element żadnego zina, i rodziny fontów (z plikami), których nie ma na liście `fonts` żadnego zina, są usuwane przy otwarciu listy zinów, nigdy w trakcie edycji.
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

- **Vitest, czysta logika:** impozycja (5 i 6 kartek dokładnie, każda strona dokładnie raz dla N = 1…20), kartka na środku A4 w skali 100% i ponad 20 mm papieru wokół spadu i znaczników dla każdej kombinacji opcji, pozycje znaczników, dodawanie i usuwanie kartek przy każdej bieżącej rozkładówce dla 1…6 kartek (okładki i ich wewnętrzne strony zostają na miejscu poza opisanymi wyjątkami, kolory tła idą za stronami), przypisanie fragmentów elementu przez grzbiet do stron, migracje `formatVersion` (przeliczenie A5→A6), zapis i odczyt `.zin`.
- **Testy renderu:** arkusze przykładowego zina rysowane do PNG i porównywane z wzorcem (z tolerancją); wzorce w repo, odświeżane świadomie.
- **Playwright (Chrome):** nowy zin 5 kartek, dodanie zdjęcia i napisu, eksport PDF; sprawdzenie, że PDF ma 10 stron A4.

## Kolejność budowy

1. Model, impozycja, położenie kartki na arkuszu i znaczniki, magazyn i `.zin` (czysta logika z testami, bez UI).
2. Rysownik i eksport PDF (arkusze, strona próbna, PDF stronami) z testami renderu.
3. Edytor: lista zinów, rozkładówki, zdjęcia, napisy, fonty, prowadnice, przyciąganie, historia.
4. Ekran druku z podglądem arkuszy.
5. Podgląd 3D.
6. Hosting na GitHub Pages i `CLAUDE.md`.
