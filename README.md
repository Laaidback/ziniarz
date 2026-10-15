# ZINIARZ

ZINIARZ to aplikacja w przeglądarce do składania zinów: małych broszur zszywanych ze złożonych na pół kartek A4. Każda kartka to 4 strony A5. Układasz zdjęcia i napisy, a program przygotowuje arkusze do druku dwustronnego na zwykłej domowej drukarce (ze spadami i znacznikami cięcia i zgięcia).

Wszystko dzieje się w Twojej przeglądarce. Nie ma konta ani serwera: zdjęcia i ziny zostają na Twoim komputerze.

## Co potrafi

- **Lista zinów.** Ekran główny pokazuje Twoje ziny z okładkami. Przy każdym są przyciski „Otwórz”, „Powiel”, „Zapisz plik .zin” i „Usuń”.
- **Edytor.** Po lewej są rozkładówki. Przyciski „+ kartka” i „− kartka” zmieniają liczbę stron. „+ Zdjęcie” i „+ Napis” dodają elementy na stronę. Przeciągasz je myszką, a w prawej kolumnie ustawiasz resztę: kadr zdjęcia („Kadruj”), font, rozmiar, kolor, wyrównanie, tło strony i marginesy. Są też „Cofnij” i „Ponów”.
- **Fonty.** Do wyboru jest kilka gotowych fontów. Własny dodasz przyciskiem „Wgraj font…” (pliki `.ttf`, `.otf` albo `.woff2`). Font wgrany do innego zina wybierzesz przyciskiem „Użyj fontu z innego zina”.
- **Druk.** Przycisk „Druk” otwiera ekran druku. Ustawiasz tam margines drukarki, spady, linie cięcia, linię zgięcia, „Obróć tyły o 180°” i sposób druku dwustronnego. Obok widać podgląd arkuszy. „Pobierz PDF do druku” daje arkusze A4 do druku dwustronnego. „Pobierz PDF stronami” daje zwykłe strony A5 po kolei, na przykład do wysłania komuś.
- **Strona próbna.** Dwie kartki do sprawdzenia, czy drukarka dobrze drukuje dwustronnie i ile wynosi jej margines. Pod przyciskiem „Pobierz stronę próbną” jest krótka instrukcja, co sprawdzić.
- **Ręczny druk dwustronny.** Gdy drukarka nie drukuje sama na obu stronach, wybierz „ręcznie (osobno przody i tyły)”. Po kliknięciu „Przygotuj PDF-y do druku (przody i tyły)” pojawią się dwa przyciski: „Pobierz przody” i „Pobierz tyły”. Najpierw wydrukuj przody. Potem włóż wydrukowane kartki z powrotem do podajnika i wydrukuj tyły.
- **Podgląd 3D.** „Podgląd 3D” pokazuje złożony zin. Przeciągnij, żeby go obrócić, kółkiem myszy przybliż. Strony przewracasz kliknięciem, strzałkami na klawiaturze albo przyciskami „← Wstecz” i „Dalej →”.

## Jak zrobić zin

1. Na ekranie głównym wpisz tytuł i liczbę kartek, potem kliknij „Nowy zin”.
2. W edytorze dodaj zdjęcia i napisy i ułóż je na stronach. Zmiany zapisują się same.
3. Kliknij „Druk”. Za pierwszym razem wydrukuj stronę próbną i popraw ustawienia, jeśli coś się nie zgadza.
4. Pobierz PDF do druku i wydrukuj go. Ekran druku podpowiada, co wybrać w oknie drukowania (skala „Rzeczywisty rozmiar” i odwracanie po krótszej albo dłuższej krawędzi).
5. Złóż kartki na pół, włóż jedną w drugą i zszyj w grzbiecie.
6. Zrób kopię zina: „Zapisz plik .zin” przy zinie na ekranie głównym. „Wczytaj plik .zin” wczytuje go z powrotem. Warto to robić, bo ziny leżą tylko w tej przeglądarce, na tym komputerze i pod tym adresem strony.

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
npm run test:e2e                  # test całej aplikacji w przeglądarce: nowy zin, druk, podgląd 3D (trwa dłużej)
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
