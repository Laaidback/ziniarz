# ZINIARZ

ZINIARZ to aplikacja w przeglądarce do składania zinów: małych broszur A6 zszywanych ze złożonych na pół kartek A5. Każda kartka to 4 strony A6 (105 × 148 mm). Układasz zdjęcia i napisy, a program przygotowuje arkusze A4 do druku dwustronnego na zwykłej domowej drukarce: na środku każdego arkusza jest jedna kartka zina ze spadami i znacznikami cięcia i zgięcia. Po wydruku wycinasz ją po liniach cięcia.

Milimetry w programie to prawdziwe milimetry na wydrukowanej stronie, a rozmiar napisu to punkty na wydruku. Ziny zrobione wcześniej w formacie A5 same przeliczają się na A6 przy otwarciu.

Wszystko dzieje się w Twojej przeglądarce. Nie ma konta ani serwera: zdjęcia i ziny zostają na Twoim komputerze. Wybrane ziny możesz dodatkowo zapisać na swoim Dysku Google, żeby otworzyć je na innym komputerze albo robić je razem z kimś (zob. „Dysk Google” niżej).

## Co potrafi

- **Lista zinów.** Ekran główny pokazuje Twoje ziny z okładkami. Przy każdym są przyciski „Otwórz”, „Powiel”, „Zapisz plik .zin” i „Usuń”.
- **Edytor.** Po lewej są rozkładówki. Przyciski „+ kartka” i „− kartka” zmieniają liczbę stron. „+ Zdjęcie” i „+ Napis” dodają elementy na stronę. Okładka to jedna rozkładówka: tył po lewej, przód po prawej, więc zdjęcie może przechodzić z tyłu na przód. Przeciągasz elementy myszką, a resztę ustawiasz w kolumnie „Ustawienia”: kadr zdjęcia („Kadruj”), font, rozmiar, kolor, wyrównanie, tło strony i marginesy. Ta kolumna jest na początku schowana, żeby płótno miało więcej miejsca: pokazuje ją przycisk „Ustawienia” u góry, a chowa „Schowaj”. Edytor pamięta, czy była otwarta. Są też „Cofnij” i „Ponów”.
- **Notatnik.** Kremowa kolumna po prawej stronie edytora to notatnik tego zina. Trzymasz w nim teksty do zina: wklejasz, poprawiasz, pogrubiasz („B”, ⌘B) i zaznaczasz markerem („Zaznaczenie”, ⇧⌘H). Zaznaczony tekst skopiujesz (⌘C) i wkleisz do napisu albo wstawisz od razu przyciskiem „Wstaw zaznaczenie jako napis”. Notatnik dzieli się na kartki, widoczne jako małe kafelki: „Ogólne” i osobny kafelek na każdą rozkładówkę („Okładka”, „Strony 2–3”…). Na kafelku widać początek notatek, a kafelek rozkładówki otwartej w edytorze jest wyróżniony („teraz”). Kliknięcie kafelka otwiera tę kartkę do pisania (i tę rozkładówkę w edytorze); kartka rozkładówki idzie potem za edytorem, gdy przechodzisz na inne strony. „← Wszystkie” wraca do kafelków. „Wstaw zaznaczenie jako napis” wstawia napis na rozkładówkę, do której kartka należy (z „Ogólne”: na otwartą). Notatki rozkładówki idą za nią, gdy dodajesz kartki; „− kartka” pyta, zanim usunie rozkładówki z notatkami. Notatnik zapisuje się sam, jedzie z zinem w pliku `.zin` i nie trafia do druku. „Cofnij” w edytorze go nie rusza. Przycisk „Notatnik” u góry chowa go i pokazuje, a „Schowaj” w notatniku też go chowa.
- **Fonty.** Do wyboru jest kilka gotowych fontów. Własny dodasz przyciskiem „Wgraj font…” (pliki `.ttf`, `.otf` albo `.woff2`). Font wgrany do innego zina wybierzesz przyciskiem „Użyj fontu z innego zina”. Na Macu nowe napisy są domyślnie w foncie Ayuthaya, wziętym z systemu (aplikacja go nie zawiera); na komputerze bez niego napis wygląda jak w Inter.
- **Druk.** Przycisk „Druk” otwiera ekran druku. Ustawiasz tam spady, linie cięcia, linię zgięcia, „Obróć tyły o 180°” i sposób druku dwustronnego. Obok widać podgląd arkuszy. „Pobierz PDF do druku” daje arkusze A4 do druku dwustronnego, z kartką zina w rzeczywistym rozmiarze (100%). „Pobierz PDF stronami” daje zwykłe strony A6 po kolei, na przykład do wysłania komuś. Po wydruku wytnij kartkę po liniach cięcia w rogach i złóż na pół na znacznikach zgięcia.
- **Strona próbna.** Dwie kartki do sprawdzenia, czy drukarka dobrze drukuje dwustronnie. Pod przyciskiem „Pobierz stronę próbną” jest krótka instrukcja, co sprawdzić.
- **Ręczny druk dwustronny.** Gdy drukarka nie drukuje sama na obu stronach, wybierz „ręcznie (osobno przody i tyły)”. Po kliknięciu „Przygotuj PDF-y do druku (przody i tyły)” pojawią się dwa przyciski: „Pobierz przody” i „Pobierz tyły”. Najpierw wydrukuj przody. Potem włóż wydrukowane kartki z powrotem do podajnika i wydrukuj tyły.
- **Dysk Google.** „Zapisz na Dysku Google” przy zinie zapisuje go jako plik w folderze „Ziniarz” na Twoim Dysku. Od tej chwili zmiany idą tam same, a u góry edytora widać, czy wszystko jest zapisane. „Otwórz z Dysku Google” otwiera zina z Dysku na innym komputerze albo zina, którego ktoś Ci udostępnił. Szczegóły niżej.
- **Podgląd 3D.** „Podgląd 3D” pokazuje złożony zin. Przeciągnij, żeby go obrócić, kółkiem myszy przybliż. Strony przewracasz kliknięciem, strzałkami na klawiaturze albo przyciskami „← Wstecz” i „Dalej →”.

## Jak zrobić zin

1. Na ekranie głównym wpisz tytuł i liczbę kartek, potem kliknij „Nowy zin”.
2. W edytorze dodaj zdjęcia i napisy i ułóż je na stronach. Zmiany zapisują się same.
3. Kliknij „Druk”. Za pierwszym razem wydrukuj stronę próbną i popraw ustawienia, jeśli coś się nie zgadza.
4. Pobierz PDF do druku i wydrukuj go. Ekran druku podpowiada, co wybrać w oknie drukowania (skala „Rzeczywisty rozmiar” i odwracanie po krótszej albo dłuższej krawędzi).
5. Wytnij kartki po liniach cięcia, złóż je na pół na znacznikach zgięcia, włóż jedną w drugą i zszyj w grzbiecie.
6. Zrób kopię zina: „Zapisz plik .zin” przy zinie na ekranie głównym. „Wczytaj plik .zin” wczytuje go z powrotem. Warto to robić, bo ziny leżą tylko w tej przeglądarce, na tym komputerze i pod tym adresem strony.

## Dysk Google: kilka komputerów i kilka osób

Przyciski Dysku są widoczne dopiero po jednorazowym ustawieniu po stronie Google (zob. „Ustawienie Dysku Google” niżej).

- **Zapisanie zina na Dysku:** na liście zinów „Zapisz na Dysku Google” (albo w edytorze „Zapisz na Dysku”). Za pierwszym razem Google poprosi o zalogowanie i zgodę. Ziniarz widzi na Twoim Dysku tylko pliki, które sam zapisał albo które wskażesz w oknie Google, nic więcej.
- **Zapisywanie zmian:** dzieje się samo, kilka sekund po ostatniej zmianie i przy wyjściu z edytora. Stan widać u góry edytora i na karcie zina: „Zapisano na Dysku”, „Zmiany czekają na zapis na Dysku”, „Brak internetu, zapiszę później”. Najedź na niego myszką, a zobaczysz, kto i kiedy zmienił zina ostatnio. Zin zawsze jest też w przeglądarce, więc bez internetu pracujesz dalej.
- **Logowanie wygasa po mniej więcej godzinie.** Wtedy pojawia się „Zaloguj się, żeby zapisać na Dysku” z przyciskiem „Zaloguj”.
- **Udostępnienie:** na karcie zina „Pokaż na Dysku” otwiera plik na Dysku Google. Tam kliknij „Udostępnij”, wpisz e-mail drugiej osoby i daj jej prawo do edycji.
- **Druga osoba (albo Ty na innym komputerze):** na liście zinów „Otwórz z Dysku Google” i w oknie Google wybierz zina. Zin trafi na listę i będzie zapisywał się do tego samego pliku.
- **Praca po kolei:** przy otwarciu Ziniarz bierze najnowszą wersję z Dysku. Gdy ktoś zmienił zina na Dysku, a Ty też masz zmiany, których tam nie ma, Ziniarz zapyta, co zrobić: „Weź wersję z Dysku”, „Zostaw moją” albo „Zapisz moją jako kopię” (Twoja wersja będzie osobnym zinem i nic nie przepadnie). Edycja w tej samej chwili przez dwie osoby nie jest obsługiwana.
- **„Odłącz od Dysku”** zostawia zina tylko w przeglądarce. Plik na Dysku zostaje. „Usuń” też nie usuwa pliku z Dysku.
- Font Ayuthaya nie jedzie z zinem (to font macOS): na komputerze bez niego napisy wyglądają jak w Inter.

### Ustawienie Dysku Google (raz)

Potrzebne są trzy wartości z Google: **Client ID**, **klucz API** i **numer projektu**. Strona musi mieć już stały adres, więc najpierw zrób „Publikację na GitHub Pages” (niżej). Google przyjmuje logowanie tylko z adresów, które wpiszesz w jego konsoli.

1. Wejdź na [console.cloud.google.com](https://console.cloud.google.com), zaloguj się i utwórz projekt (np. „Ziniarz”). Na stronie głównej projektu (*Dashboard*, karta „Project info”) zapisz **Project number**: to numer projektu.
2. *APIs & Services* → *Library*: wyszukaj i włącz **Google Drive API**, potem **Google Picker API**.
3. *Google Auth Platform* (dawniej *OAuth consent screen*):
   - *Branding*: nazwa aplikacji „Ziniarz”, Twój e-mail.
   - *Audience*: typ **External**, zostaw stan **Testing**. W *Test users* dodaj swój adres Gmail i adresy osób, z którymi robisz ziny (do 100 osób).
   - *Data Access* → *Add or remove scopes*: zaznacz `.../auth/drive.file` („See, edit, create, and delete only the specific Google Drive files you use with this app”).
4. *Google Auth Platform* → *Clients* → *Create client*: typ **Web application**. W *Authorized JavaScript origins* dodaj `https://<twoja-nazwa>.github.io` (sam adres, bez `/ziniarz`), `http://localhost:5173` i `http://localhost:5199`. Zapisz **Client ID** (kończy się na `.apps.googleusercontent.com`).
5. *APIs & Services* → *Credentials* → *Create credentials* → *API key*. Kliknij nowy klucz:
   - *Application restrictions*: **Websites**, dodaj `https://<twoja-nazwa>.github.io/*`, `http://localhost:5173/*` i `http://localhost:5199/*`;
   - *API restrictions*: **Restrict key**, zaznacz Google Picker API.

   Zapisz **klucz API**.
6. Na GitHubie, w repozytorium: *Settings* → *Secrets and variables* → *Actions* → zakładka *Variables* → *New repository variable*. Dodaj trzy zmienne: `GOOGLE_CLIENT_ID`, `GOOGLE_API_KEY` i `GOOGLE_APP_ID` (numer projektu). Te wartości nie są tajne: i tak trafiają do przeglądarki, a Google przyjmuje je tylko z Twoich adresów.
7. Uruchom publikację jeszcze raz (*Actions* → „Deploy to GitHub Pages” → *Run workflow*). Po kilku minutach przyciski Dysku pojawią się na stronie.
8. Na swoim komputerze (`npm run dev`) utwórz w folderze projektu plik `.env.local` (nie trafia do repozytorium):
   ```
   VITE_GOOGLE_CLIENT_ID=...
   VITE_GOOGLE_API_KEY=...
   VITE_GOOGLE_APP_ID=...
   ```

Dopóki aplikacja jest w stanie *Testing*, logować się mogą tylko osoby z listy *Test users*. Google pokazuje im najpierw ostrzeżenie „Google hasn't verified this app”: trzeba kliknąć *Continue*. Żeby zniknęło, a logować mógł się każdy, w *Audience* kliknij *Publish app* i przejdź weryfikację marki Google (strona główna i polityka prywatności). Przy uprawnieniu `drive.file` to prosta weryfikacja, bez audytu bezpieczeństwa.

## Uruchomienie na swoim komputerze

Potrzebny jest [Node.js](https://nodejs.org) w wersji 22 lub nowszej (publikacja na GitHubie używa wersji 24).

```bash
npm install
npm run dev
```

Potem otwórz adres, który pojawi się w terminalu (zwykle `http://localhost:5173`).

## Testy

```bash
npx playwright install chromium   # tylko za pierwszym razem
npm test                          # wszystkie testy
npm run typecheck                 # kontrola typów
npm run test:e2e                  # test całej aplikacji w przeglądarce: nowy zin, druk, podgląd 3D, dwie osoby na (sztucznym) Dysku Google (trwa dłużej)
npm run test:update-references    # nowe wzorce arkuszy (src/print/__reference__/), tylko po zamierzonej zmianie wyglądu
npm run build                     # budowa wersji do publikacji (folder dist/)
npm run check:dist                # sprawdza, czy zbudowana strona zadziała pod podadresem
```

## Publikacja na GitHub Pages

Dzięki temu ZINIARZ będzie dostępny pod adresem `https://<twoja-nazwa>.github.io/<nazwa-repozytorium>/`, z każdego komputera.

> **Ten krok nie został wykonany za Ciebie.** Repozytorium na GitHubie nie zostało założone, nie dodano adresu zdalnego (`remote`) i nic nie zostało wysłane (`push`). To publikacja w internecie, więc decyzja jest Twoja. Poniżej jest dokładna instrukcja.

Repozytorium może być publiczne albo prywatne. Uwaga: GitHub Pages dla repozytorium **prywatnego** wymaga płatnego planu GitHuba (Pro, Team lub Enterprise). W darmowym koncie strona opublikowana z repozytorium publicznego jest dostępna dla wszystkich, a kod też jest publiczny.

1. **Załóż konto** na [github.com](https://github.com), jeśli go nie masz.
2. **Załóż repozytorium.** Najprościej w terminalu, w folderze projektu (potrzebny jest zainstalowany i zalogowany program `gh`, logowanie: `gh auth login`):
   ```bash
   gh repo create ziniarz --public --source=. --remote=origin --push
   ```
   Dla repozytorium prywatnego zamień `--public` na `--private`. To jedno polecenie zakłada repozytorium, dodaje `remote` i wysyła gałąź `main`.

   Bez programu `gh`: na github.com kliknij „New repository”, nazwij je `ziniarz`, nie zaznaczaj „Add a README”, a potem w terminalu wpisz (podstaw swoją nazwę użytkownika):
   ```bash
   git remote add origin https://github.com/<twoja-nazwa>/ziniarz.git
   git push -u origin main
   ```
3. **Włącz Pages.** W repozytorium: *Settings* → *Pages* → w polu *Source* wybierz **GitHub Actions**. (Zrób to przed pierwszym uruchomieniem publikacji, bo inaczej się nie uda.)
4. **Poczekaj na publikację.** Zakładka *Actions* pokazuje przebieg „Deploy to GitHub Pages”: testy, budowa, publikacja. Trwa kilka minut. Jeśli pierwszy przebieg zakończył się błędem o Pages, ustaw Source jak w punkcie 3 i kliknij *Re-run all jobs*.
5. **Otwórz stronę:** `https://<twoja-nazwa>.github.io/ziniarz/`. Adres jest też widoczny w *Settings* → *Pages* i w przebiegu publikacji.

Od tej pory każda zmiana wysłana na `main` (`git push`) publikuje się sama, o ile testy przejdą. Publikację można też uruchomić ręcznie: *Actions* → „Deploy to GitHub Pages” → *Run workflow*.

Pamiętaj: ziny zapisane na komputerze, pod adresem `localhost`, nie przeniosą się same pod adres na GitHub Pages (przeglądarka trzyma dane osobno dla każdego adresu). Przenieś je plikami `.zin`: „Zapisz plik .zin” na starym adresie i „Wczytaj plik .zin” pod nowym.
