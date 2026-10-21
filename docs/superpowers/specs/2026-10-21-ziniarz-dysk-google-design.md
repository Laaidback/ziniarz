# ZINIARZ: ziny na Dysku Google

Zmiana do `2026-10-14-ziniarz-design.md`. Wybrany zin można zapisać na Dysku Google i udostępnić innym osobom zwykłym „Udostępnij” z Dysku. Kilka osób pracuje nad nim po kolei (nie w tej samej chwili), z różnych komputerów.

## Dlaczego

Ziny są dziś tylko w przeglądarce jednego komputera; przenosi się je plikami `.zin`. Właścicielka chce kończyć zina na innym komputerze i robić go razem z koleżankami.

Odrzucone:
- **Własny serwer** (Supabase, Firebase): konta, baza i zdjęcia u nas. Więcej pracy, opłata przy wzroście, odpowiedzialność za cudze dane (RODO), stałe utrzymanie.
- **Tylko lepsze pliki `.zin`** (zapis do folderu synchronizowanego przez Dropbox): dalej ręcznie, Safari nie ma File System Access API, łatwo o dwie wersje.
- **Edycja w tej samej chwili** (jak Google Docs): niepotrzebna przy pracy po kolei, a najtrudniejsza.

## Zasady

- Ziniarz działa jak dziś, bez logowania. Dysk jest **dodatkową kopią**: zin w przeglądarce jest zawsze zapisany, a błąd Dysku nigdy nie gubi pracy.
- Na Dysk idą **tylko wybrane ziny** (przycisk „Zapisz na Dysku Google”).
- Strona zostaje statyczna (GitHub Pages), bez własnego serwera. Logowanie i Dysk działają w przeglądarce.
- Uprawnienie tylko `https://www.googleapis.com/auth/drive.file`: Ziniarz widzi wyłącznie pliki, które sam utworzył albo które osoba wskazała w oknie wyboru Google (Picker). Google uznaje je za niewrażliwe.
- Bez konfiguracji Google (brak identyfikatorów przy budowie) przyciski Dysku się nie pokazują i aplikacja działa jak dotąd.

## Jak to wygląda w użyciu

- **Lista zinów:**
  - przycisk „Otwórz z Dysku Google” obok „Wczytaj plik .zin”,
  - na karcie zina bez Dysku: „Zapisz na Dysku Google”,
  - na karcie zina z Dyskiem: znaczek „Dysk Google” ze stanem oraz przyciski „Pokaż na Dysku” i „Odłącz od Dysku”.
- **„Zapisz na Dysku Google”:** za pierwszym razem okno logowania Google. Zin trafia jako jeden plik `<tytuł>.zin` do folderu „Ziniarz” na Dysku zalogowanej osoby.
- **„Pokaż na Dysku”** otwiera plik na Dysku Google w nowej karcie. Tam osoba klika „Udostępnij” i wpisuje e-mail koleżanki z prawem do edycji.
- **„Otwórz z Dysku Google”:** logowanie, potem okno wyboru Google z plikami zinów (moje i udostępnione mi). Wybrany zin trafia na listę i od tej pory zapisuje się do tego samego pliku. Ponowne otwarcie tego samego pliku nie tworzy kopii, tylko pobiera najnowszą wersję do zina, który już jest na liście.
- **Edytor zina z Dyskiem:** u góry stan:
  - „Zapisano na Dysku”,
  - „Zapisywanie na Dysku…”,
  - „Zmiany czekają na zapis na Dysku”,
  - „Brak internetu, zapiszę później”,
  - „Zaloguj się, żeby zapisać na Dysku” (przycisk „Zaloguj”).

  W podpowiedzi stanu jest „Ostatnia zmiana: Ola, 10 min temu”.
- **Edytor zina bez Dysku:** przycisk „Zapisz na Dysku” u góry.
- **Wysyłanie:** 10 s po ostatniej zmianie oraz przy wyjściu z edytora. Przy zamknięciu karty zin zostaje „do wysłania” i wysyła się przy następnym otwarciu listy albo edytora.
- **Otwarcie zina w edytorze:** gdy na Dysku jest nowsza wersja, a lokalnie nic nie czeka na wysłanie, Ziniarz najpierw ją pobiera.
- **Konflikt:** ktoś zapisał zmiany na Dysku, a tu też są niewysłane zmiany. Okno pyta:
  - „Weź wersję z Dysku”: lokalne zmiany od ostatniej synchronizacji przepadają,
  - „Zostaw moją”: wersja z Dysku zostaje nadpisana,
  - „Zapisz moją jako kopię”: lokalna wersja staje się osobnym zinem (bez Dysku, tytuł z „(kopia)”), a zin z Dyskiem dostaje wersję z Dysku. Nic nie ginie.
- **Nowsza wersja na Dysku w trakcie edycji** (bez lokalnych zmian): pasek „Na Dysku jest nowsza wersja (Ola, 2 min temu)” z przyciskiem „Wczytaj”. Ziniarz nigdy nie podmienia zina pod ręką.
- **„Odłącz od Dysku”:** zin zostaje tylko w przeglądarce, plik na Dysku nietknięty.
- **„Usuń”** na liście usuwa zina z przeglądarki i jego połączenie z Dyskiem. Plik na Dysku zostaje, a pytanie o usunięcie o tym mówi.
- **„Powiel”** daje zina bez Dysku. Plik `.zin` nie zawiera nic o Dysku.
- **Zawartość wspólna:** zdjęcia, własne fonty, notatnik, ustawienia druku. Ayuthaya (font z macOS) nie jest w pliku, tak jak dziś: na komputerze bez niej napisy rysują się w Inter.

## Błędy (po polsku, nic nie ginie)

- **Brak internetu:** stan „Brak internetu, zapiszę później”. Kolejna próba przy następnej zmianie, wyjściu z edytora albo otwarciu listy.
- **Wygasłe logowanie** (token Google ważny około godziny, odnowienie wymaga kliknięcia, bo przeglądarka blokuje okienka bez kliknięcia): stan „Zaloguj się, żeby zapisać na Dysku” z przyciskiem.
- **Brak dostępu do pliku** (odebrany albo tylko do podglądu): „Nie masz prawa zmieniać tego pliku na Dysku. Zmiany zostają w przeglądarce.”
- **Plik usunięty z Dysku:** „Tego pliku nie ma już na Dysku.” z przyciskami „Zapisz jako nowy plik” i „Odłącz od Dysku”.
- **Pełny Dysk:** „Na Dysku Google brakuje miejsca.”
- **Plik, który nie jest zinem albo jest z nowszej wersji Ziniarza:** komunikat jak przy wczytywaniu `.zin`.
- **Inne błędy Google:** „Dysk Google nie odpowiada. Spróbuję później.”

## Jak to działa w środku

### Konfiguracja

Zmienne przy budowie (Vite): `VITE_GOOGLE_CLIENT_ID` (OAuth Client ID), `VITE_GOOGLE_API_KEY` (klucz do Pickera) i `VITE_GOOGLE_APP_ID` (numer projektu Google Cloud; Picker potrzebuje go, żeby wybór pliku dał aplikacji dostęp przy `drive.file`). Wszystkie są publiczne z natury (trafiają do przeglądarki). Google przyjmuje je tylko z adresów wpisanych w konsoli. Workflow publikacji bierze je z *Variables* repozytorium. Brak którejkolwiek oznacza, że funkcja jest wyłączona.

### Moduły (`src/cloud/`)

- `config.ts`: odczyt konfiguracji, `cloudConfigured()`.
- `googleAuth.ts`: Google Identity Services (`https://accounts.google.com/gsi/client`, ładowany dopiero przy pierwszym użyciu). Token w pamięci i w `sessionStorage` (w `try/catch`) z czasem ważności, żeby odświeżenie strony nie wymagało logowania. `token()` zwraca ważny token albo `null`; `signIn()` (tylko z kliknięcia) otwiera okno Google.
- `picker.ts`: Google Picker (`https://apis.google.com/js/api.js`, `gapi.load('picker')`, ładowany przy pierwszym użyciu). Widoki: moje pliki i udostępnione mi, filtr typów plików zina, język polski. Zwraca id pliku albo `null`.
- `driveApi.ts`: `DriveClient` na `fetch` i REST v3 Dysku:
  - `ensureFolder()`: folder „Ziniarz”,
  - `create(name, bytes)` i `update(id, name, bytes)`: wysyłanie wznawialne (`uploadType=resumable`),
  - `meta(id)`: `id, name, headRevisionId, modifiedTime, trashed, lastModifyingUser(displayName, me)`,
  - `download(id)`: `alt=media`.

  Błędy zamienia na `CloudError` z rodzajem (`offline`, `auth`, `notFound`, `forbidden`, `quota`, `other`) i polskim komunikatem. Dostaje funkcję tokenu i `fetch` z zewnątrz, więc testuje się na sztucznym Dysku.
- `links.ts`: połączenia zin ↔ plik w nowym magazynie IndexedDB `driveLinks` (baza w wersji 2). Każde połączenie ma:
  - `zineId`,
  - `fileId`,
  - `revision`: wersja treści pliku na Dysku (`headRevisionId`) przy ostatniej synchronizacji; `version` Dysku rośnie też przy udostępnieniu i zmianie nazwy, więc dawałaby fałszywe konflikty,
  - `syncedUpdatedAt`: `updatedAt` zina przy ostatniej synchronizacji,
  - `modifiedTime` i `modifiedBy`: do „Ostatnia zmiana”.

  Nie ma tego w JSON-ie zina, więc plik `.zin` nie zdradza niczyjego Dysku.
- `sync.ts` (czysta logika): `decideSync({ localChanged, remoteChanged })` daje `none`, `upload`, `download` albo `conflict`. „Lokalnie zmieniony” znaczy `zine.updatedAt ≠ link.syncedUpdatedAt`; autozapis edytora i ekranu druku ustawia `updatedAt`, więc nie trzeba osobnego znacznika. „Zmieniony na Dysku” znaczy `meta.revision ≠ link.revision`. Do tego `lastChangeText` („Ostatnia zmiana: Ola, 10 min temu”, „ty”, gdy `me`).
- `cloudSync.ts` (praca z bazą i Dyskiem):
  - `linkToDrive`,
  - `syncZine(…, { allowDownload })`: zwraca wynik, a nie wyjątek przy konflikcie,
  - `resolveConflict(choice)`,
  - `openFromDrive(fileId)`,
  - `unlink`.

  Pliki tworzy i czyta tymi samymi funkcjami co `.zin` (`bundleFromDb`, `writeZin`, `readZin`). Wszystkie operacje na jednym zinie idą po kolei (kolejka na zin), żeby dwa wysyłania się nie minęły.
- `cloudStatus.ts`: sklep Zustand ze stanem każdego zina z Dyskiem (dla listy i edytora).
- `CloudContext`: usługi (`auth`, `drive`, `pickFile`) wstrzykiwane przez kontekst React. Aplikacja daje prawdziwe Google, a testy sztuczny Dysk.

### Pobieranie wersji z Dysku

`readZin` daje zina z nowym id; `replaceFromBundle` (`zinFile.ts`) zapisuje go pod id istniejącego zina. Zdjęcia zapisuje po id (zdjęcie o danym id się nie zmienia). Rodzina fontów, której id już jest w bazie:
- z identycznymi plikami zostaje bez zmian,
- z innymi plikami dostaje nowe id, jak przy wczytywaniu `.zin`.

Nigdy nie zmieniamy w miejscu rodziny używanej przez inny zin. Zin przechodzi przez `parseZine`. Zdjęcia, których nowa wersja nie używa, sprzątnie jak zawsze lista zinów. Na czas pobierania lista trzyma blokadę otwartego zina (`holdOpenZineLock`), żeby inna karta nie sprzątnęła świeżych zdjęć.

### Wykrywanie konfliktu

Tuż przed wysłaniem Ziniarz czyta `headRevisionId` pliku. Gdy różni się od `link.revision`, wysyłanie się nie odbywa i zwraca `conflict` albo `download`. REST v3 Dysku nie ma warunkowego zapisu, więc między odczytem a zapisem zostaje okno rzędu sekundy. Przy pracy po kolei to w praktyce nie wystąpi, a spec to akceptuje.

### Gdzie dzieje się synchronizacja

- **Lista zinów:** po wczytaniu, gdy jest ważny token, synchronizuje po kolei ziny z Dyskiem: wysyła oczekujące, pobiera nowsze, a konflikt tylko oznacza. Okno konfliktu pokazuje się dopiero przy otwarciu zina. Bez tokenu znaczek mówi „Zaloguj się”. Sprzątanie zdjęć idzie dopiero po tej synchronizacji.
- **Wejście do edytora:** przed otwarciem sesji `syncZine({ allowDownload: true })`; przy konflikcie okno wyboru, potem otwarcie. Bez tokenu albo internetu edytor otwiera wersję z przeglądarki ze stanem błędu.
- **W edytorze:** 10 s po ostatniej zmianie zina (`history.present`), przy wyjściu i po zalogowaniu: autozapis `flush`, potem `syncZine({ allowDownload: false })`. Gdy Dysk ma nowszą wersję, wynik to `remoteNewer` („Wczytaj”) albo `conflict` (okno). Wybór, który pobiera („Weź wersję z Dysku”, „Zapisz moją jako kopię”, „Wczytaj”), zamyka edytor, a pobranie dzieje się przy ponownym otwarciu: nigdy pod działającym autozapisem.
- **Blokada:** edytor, druk i 3D czekają na współdzieloną blokadę otwartego zina, zanim go przeczytają; lista pobiera tylko pod blokadą na wyłączność (`whenNoZineIsOpen`), więc nic nie pobiera się do zina otwartego w innej karcie.
- Ekrany druku i 3D tylko czytają lokalnego zina, bez zmian.

## Testy

- **Node:** `decideSync`, `lastChangeText`, mapowanie błędów `driveApi` (sztuczny `fetch`), `cloudSync` na `fake-indexeddb` i sztucznym Dysku w pamięci: wysłanie, pobranie, konflikt i każdy wybór, ponowne otwarcie tego samego pliku, fonty wspólne z innym zinem, offline, usunięty plik, migracja bazy z wersji 1.
- **Przeglądarka:** stan w edytorze i okno konfliktu, przyciski na liście (sztuczne usługi przez `CloudContext`), brak przycisków bez konfiguracji.
- **e2e (Playwright):** dwie osoby (dwa konteksty przeglądarki) na sztucznym Dysku. Skrypty Google i REST Dysku są podstawione przez `page.route`, więc test idzie przez prawdziwy kod HTTP: Ala zapisuje zina na Dysku, Ola otwiera go z Dysku i dopisuje napis, Ala widzi zmianę po otwarciu. Prawdziwego Google testy nie dotykają; raz sprawdza się to ręcznie na dwóch kontach.

## Poza kodem (właścicielka, instrukcja w README)

1. Opublikować stronę na GitHub Pages.
2. Google Cloud Console: projekt, włączyć Google Drive API i Google Picker API, ekran zgody (typ „zewnętrzny”, zakres `drive.file`, testerzy), OAuth Client ID typu „aplikacja internetowa” z adresem strony i `http://localhost:5199` w „Authorized JavaScript origins”, klucz API ograniczony do strony i Picker API.
3. Wpisać trzy wartości w *Settings → Secrets and variables → Actions → Variables* repozytorium oraz w `.env.local` do pracy lokalnej.
4. Dopóki Google nie zweryfikuje aplikacji: dopisać konta koleżanek jako testerów (do 100 osób).

## Poza zakresem

Edycja w tej samej chwili, lista „udostępnione mi” bez okna wyboru, „Otwórz za pomocą” z Dysku, udostępnianie z wnętrza Ziniarza, logowanie inne niż Google, wysyłanie samych zmienionych zdjęć.
