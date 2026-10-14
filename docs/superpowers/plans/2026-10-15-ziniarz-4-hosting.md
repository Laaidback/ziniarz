# ZINIARZ, plan 4: hosting na GitHub Pages i README Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make ZINIARZ publishable on GitHub Pages: a GitHub Actions workflow that tests, builds and deploys after every push to `main`, an automated check that the build works under a sub-path, a Polish README for a non-programmer owner, and an updated `CLAUDE.md`.

**Architecture:** No app code changes. Vite already builds with `base: './'` and the app uses hash routes (`src/app/route.ts`), so the build runs from any sub-path (`https://<user>.github.io/<repo>/`) with no server-side routing or `404.html` fallback. A small plain-JS script (`scripts/checkDist.mjs`, pure functions plus a CLI) scans `dist/` for root-absolute URLs and missing referenced files; its pure functions are unit-tested by Vitest and the CLI runs in CI as `npm run check:dist`. A three-job workflow (`test` -> `build` -> `deploy`) uses the official Pages actions.

**Tech Stack:** GitHub Actions, GitHub Pages, Node 24 in CI, Vite 7, Vitest 3.2, Playwright (Chromium).

**Spec:** `docs/superpowers/specs/2026-10-14-ziniarz-design.md`, section "Technika" (hosting: GitHub Pages, publication through GitHub Actions after a push to `main`). Earlier plans: 1 = core, 2 = editor, 3 = print screen and 3D preview.

## Decisions (nobody could be asked, so these were made up front)

- **No publishing is done by this plan.** No GitHub repo is created, no remote is added, nothing is pushed. That is public publishing and is the owner's decision; the README explains how, step by step. Every task only commits locally on `main`.
- **Action versions:** the newest majors (checked through the GitHub API on 2026-10-15): `actions/checkout@v7`, `actions/setup-node@v7` (Node 24, npm cache), `actions/configure-pages@v6`, `actions/upload-pages-artifact@v5`, `actions/deploy-pages@v5`. Older majors (v4/v5/v3/v4) run on the Node 20 runtime that GitHub is retiring in 2026; these all run on Node 24 (`runs.using: node24`). The inputs the workflow uses (`node-version`, `cache`, `path`) are unchanged; setup-node v7's only breaking change (dummy `NODE_AUTH_TOKEN` removed) does not matter here (no `registry-url`). `upload-pages-artifact@v5` (uploads via upload-artifact v7, artifact name `github-pages`) and `deploy-pages@v5` are used together and must be bumped together. They could not be run here, only inspected.
- **Node in CI:** 24 (current LTS; the project needs Node >= 20.19, Vite 7 requirement).
- **Triggers:** push to `main` and manual `workflow_dispatch`. No `pull_request` trigger (single owner, no PRs).
- **Gate:** `build` needs `test`, `deploy` needs `build`; a red test or typecheck blocks publication.
- **Permissions:** top-level `contents: read`, `pages: write`, `id-token: write` (what the Pages actions need); the `test` job narrows itself to `contents: read`.
- **Concurrency:** group `pages`, `cancel-in-progress: false`, so a running deployment is never cancelled half-way.
- **E2E tests:** plan 3 or a later plan may add `npm run test:e2e`. The workflow runs it only when the script exists (`npm pkg get scripts.test:e2e` returns `{}` when absent), so no edit is needed later.
- **Sub-path check** is a plain `.mjs` script with a `.d.mts` typing file, not TypeScript, so `node scripts/checkDist.mjs` runs on any supported Node (>= 20.19) without a loader. Its pure functions are tested from `src/build/checkDist.test.ts` (the existing unit project includes `src/**/*.test.ts`). Dynamic chunks and fonts: Vite emits them as `new URL("file", import.meta.url)` relative to the JS file, and the check verifies those targets exist in `dist/`.
- **YAML verification** uses `npx --yes js-yaml` (network is available) plus a Node assertion on the parsed structure. `actionlint` is not available offline.
- **`.claude/launch.json`** (dev server config for the Claude Code preview, port 5199) is committed in Task 4 and mentioned in `CLAUDE.md`.
- **README language:** Polish, written for a non-programmer. Mentions that the repo may be public or private, and that Pages on private repos needs a paid GitHub plan.
- **User data stays in the browser** (IndexedDB), per address. The README says so, so the owner knows to back up zines as `.zin` files and that a new address starts empty.

**Conventions for every task:**
- Repo root: `~/projects/ziniarz`, branch `main`.
- Code, comments and commit messages in English; README and `CLAUDE.md` in Polish.
- Every commit message ends with a blank line and `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Stage only the files named in the task (`git add <paths>`), never `git add -A` (a `test-output/` or other local folder may exist).

---

## File structure

```
scripts/checkDist.mjs                 build output check: pure functions + CLI (create)
scripts/checkDist.d.mts               types for the pure functions (create)
src/build/checkDist.test.ts           Vitest unit tests for the checker (create)
package.json                          + "check:dist" script (modify)
.github/workflows/deploy.yml          test -> build -> deploy to GitHub Pages (create)
README.md                             Polish owner guide incl. "Publikacja na GitHub Pages" (create)
CLAUDE.md                             deployment section, structure rows, base-path rule (modify)
.claude/launch.json                   dev server for Claude Code preview (add to git, already exists)
```

---

### Task 1: Sub-path build check (`check:dist`)

**Files:**
- Create: `scripts/checkDist.mjs`, `scripts/checkDist.d.mts`
- Create: `src/build/checkDist.test.ts`
- Modify: `package.json` (scripts)

- [ ] **Step 1: Write the failing test**

Create `src/build/checkDist.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { findMissingFiles, findProblems, referencesIn } from '../../scripts/checkDist.mjs';

describe('referencesIn', () => {
  it('reads html attributes, css url() and import.meta.url assets, skipping external and data URLs', () => {
    expect(
      referencesIn('index.html', '<script src="./assets/a.js"></script><a href="https://example.com/">x</a>'),
    ).toEqual([['./assets/a.js', 'html']]);
    expect(referencesIn('assets/a.css', 'a{background:url("./f.woff2")} b{background:url(data:image/png;base64,AA)}')).toEqual([
      ['./f.woff2', 'css'],
    ]);
    expect(referencesIn('assets/a.js', 'new URL("f.woff2",import.meta.url)')).toEqual([['f.woff2', 'js']]);
  });
});

describe('findProblems', () => {
  it('accepts a fully relative build', () => {
    expect(
      findProblems({
        'index.html': '<script type="module" src="./assets/index.js"></script><link href="./assets/index.css">',
        'assets/index.css': 'a{background:url(./logo.png)}',
        'assets/index.js': 'const f=new URL("inter.woff2",import.meta.url);',
      }),
    ).toEqual([]);
  });

  it('reports root-absolute URLs in html, css and js', () => {
    const problems = findProblems({
      'index.html': '<script src="/assets/index.js"></script>',
      'assets/index.css': 'a{background:url(/assets/f.woff2)}',
      'assets/index.js': 'import("/assets/chunk.js")',
    });
    expect(problems).toHaveLength(3);
  });
});

describe('findMissingFiles', () => {
  it('resolves references next to the file that contains them', () => {
    const files = {
      'index.html': '<script src="./assets/index.js"></script>',
      'assets/index.js': 'new URL("inter.woff2",import.meta.url)',
    };
    expect(findMissingFiles(files, (p) => p === 'assets/index.js' || p === 'assets/inter.woff2')).toEqual([]);
    expect(findMissingFiles(files, (p) => p === 'assets/index.js')).toEqual([
      'assets/index.js: "inter.woff2" -> assets/inter.woff2 not found',
    ]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run --project unit src/build`
Expected: FAIL, cannot resolve `../../scripts/checkDist.mjs`.

- [ ] **Step 3: Write the typing file and the script**

Create `scripts/checkDist.d.mts`:

```ts
export function referencesIn(fileName: string, text: string): [url: string, kind: 'html' | 'css' | 'js'][];
export function findProblems(files: Record<string, string>): string[];
export function findMissingFiles(files: Record<string, string>, exists: (path: string) => boolean): string[];
```

Create `scripts/checkDist.mjs`:

```js
// Checks that a production build can be served from any sub-path, as GitHub Pages does
// (https://user.github.io/repo/). Vite is configured with `base: './'`, so every URL in the
// output must be relative. Pure functions are exported for tests; the CLI is at the bottom.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, posix, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/** A URL that points at the server root (or another origin-relative place) instead of next to the file. */
function isRootAbsolute(url) {
  return url.startsWith('/') && !url.startsWith('//');
}

function isLocal(url) {
  return !/^(?:[a-z][a-z0-9+.-]*:|\/\/|#|data:)/i.test(url);
}

/**
 * Relative asset references found in one built file: `[url, kind]` pairs.
 * html: src/href attributes; css: url(...); js: new URL("...", import.meta.url).
 */
export function referencesIn(fileName, text) {
  const found = [];
  const add = (re, kind) => {
    for (const m of text.matchAll(re)) found.push([m[1], kind]);
  };
  if (fileName.endsWith('.html')) {
    add(/\b(?:src|href)\s*=\s*["']([^"']+)["']/g, 'html');
  } else if (fileName.endsWith('.css')) {
    add(/url\(\s*["']?([^"')]+?)["']?\s*\)/g, 'css');
  } else if (fileName.endsWith('.js')) {
    add(/new URL\(\s*["'`]([^"'`]+)["'`]\s*,\s*import\.meta\.url/g, 'js');
  }
  return found.filter(([url]) => isLocal(url) || isRootAbsolute(url));
}

/** Problems that would break the app under a sub-path. `files` maps a path inside dist to its text. */
export function findProblems(files) {
  const problems = [];
  for (const [name, text] of Object.entries(files)) {
    for (const [url] of referencesIn(name, text)) {
      if (isRootAbsolute(url)) problems.push(`${name}: absolute URL "${url}" (use a relative one)`);
    }
    if (name.endsWith('.js')) {
      for (const m of text.matchAll(/["'`](\/assets\/[^"'`]*)["'`]/g)) {
        problems.push(`${name}: hard-coded "${m[1]}"`);
      }
    }
  }
  return problems;
}

/** Local files that a build file points at but that are missing from dist. */
export function findMissingFiles(files, exists) {
  const missing = [];
  for (const [name, text] of Object.entries(files)) {
    for (const [url] of referencesIn(name, text)) {
      if (isRootAbsolute(url)) continue;
      const target = posix.normalize(posix.join(posix.dirname(name), url.split(/[?#]/)[0]));
      if (!exists(target)) missing.push(`${name}: "${url}" -> ${target} not found`);
    }
  }
  return missing;
}

function readTextFiles(dir) {
  const files = {};
  const walk = (current) => {
    for (const entry of readdirSync(current)) {
      const full = join(current, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(html|css|js)$/.test(entry)) {
        files[relative(dir, full).split(sep).join('/')] = readFileSync(full, 'utf8');
      }
    }
  };
  walk(dir);
  return files;
}

function main() {
  const dist = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
  if (!existsSync(join(dist, 'index.html'))) {
    console.error('dist/index.html not found. Run "npm run build" first.');
    process.exit(1);
  }
  const files = readTextFiles(dist);
  const problems = [...findProblems(files), ...findMissingFiles(files, (p) => existsSync(join(dist, p)))];
  if (problems.length > 0) {
    console.error(`check:dist found ${problems.length} problem(s):\n${problems.map((p) => `  ${p}`).join('\n')}`);
    process.exit(1);
  }
  console.log(`check:dist OK: ${Object.keys(files).length} files, all URLs relative and present.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
```

- [ ] **Step 4: Add the npm script**

In `package.json`, add after `"typecheck"`:

```json
    "check:dist": "node scripts/checkDist.mjs",
```

- [ ] **Step 5: Run tests and typecheck**

Run: `npx vitest run --project unit src/build && npm run typecheck`
Expected: 4 tests PASS; typecheck prints nothing and exits 0.

- [ ] **Step 6: Check the real build and the CLI**

Run: `npm run build && npm run check:dist`
Expected: `check:dist OK: N files, all URLs relative and present.` (N is the number of html, css and js files in `dist/`.)

Prove the check can fail: `sed -i.bak 's#src="./assets#src="/assets#' dist/index.html && npm run check:dist; echo "exit $?"; mv dist/index.html.bak dist/index.html`
Expected: `check:dist found 1 problem(s):` naming `index.html: absolute URL "/assets/..."`, then `exit 1`. (`dist/` is git-ignored; the last command restores it.)

- [ ] **Step 7: Serve the build from a sub-path like GitHub Pages does**

Run (second terminal, or in the background):
```bash
npx vite preview --base /ziniarz/ --port 4199 --strictPort
```
Then:
```bash
curl -s -o /dev/null -w '%{http_code} %{content_type}\n' http://localhost:4199/ziniarz/
curl -s -o /dev/null -w '%{http_code} %{content_type}\n' "http://localhost:4199/ziniarz/assets/$(ls dist/assets | grep -m1 'inter-latin-400-normal')"
curl -s -o /dev/null -w '%{http_code}\n' "http://localhost:4199/assets/$(ls dist/assets | grep -m1 '\.js$')"
```
Expected: `200 text/html`, `200 font/woff2`, then `404` (the same file at the server root is not there, so a root-absolute URL would have failed). Optional: open `http://localhost:4199/ziniarz/` in a browser, create a zine, check that text with Polish letters uses the right font, and reload on `#/zin/<id>` (hash routes: no 404). Stop the preview server when done (`pkill -f "vite preview"`).

- [ ] **Step 8: Commit**

```bash
git add scripts/checkDist.mjs scripts/checkDist.d.mts src/build/checkDist.test.ts package.json
git commit -m "test: check that the production build uses only relative URLs

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: GitHub Actions workflow

**Files:**
- Create: `.github/workflows/deploy.yml`

- [ ] **Step 1: Create the workflow**

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

# GITHUB_TOKEN rights needed by the Pages actions (the test job narrows them).
permissions:
  contents: read
  pages: write
  id-token: write

# One deployment at a time; a newer push waits instead of cancelling a running deploy.
concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  test:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - name: Install Chromium for the browser tests
        run: npx playwright install --with-deps chromium
      - run: npm run typecheck
      - run: npm test
      - name: End-to-end tests (only when the script exists)
        run: |
          if [ "$(npm pkg get scripts.test:e2e)" != "{}" ]; then
            npm run test:e2e
          else
            echo "No test:e2e script yet, skipping."
          fi

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - uses: actions/configure-pages@v6
      - run: npm run build
      - run: npm run check:dist
      - uses: actions/upload-pages-artifact@v5
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v5
```

- [ ] **Step 2: Verify the YAML parses**

Run: `npx --yes js-yaml .github/workflows/deploy.yml > /dev/null && echo YAML_OK`
Expected: `YAML_OK`.

- [ ] **Step 3: Verify the structure the deployment depends on**

Run:
```bash
npx --yes js-yaml .github/workflows/deploy.yml > "$TMPDIR/deploy.json" && node -e '
const w = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); process.exit(1); } };
ok(w.on.push.branches[0] === "main" && "workflow_dispatch" in w.on, "triggers");
ok(w.permissions.pages === "write" && w.permissions["id-token"] === "write", "pages permissions");
ok(w.concurrency.group === "pages" && w.concurrency["cancel-in-progress"] === false, "concurrency");
ok(w.jobs.build.needs === "test" && w.jobs.deploy.needs === "build", "job order");
ok(w.jobs.deploy.environment.name === "github-pages", "environment");
const uploads = w.jobs.build.steps.filter((s) => (s.uses || "").startsWith("actions/upload-pages-artifact"));
ok(uploads.length === 1 && uploads[0].with.path === "dist", "artifact path");
console.log("STRUCTURE_OK");
' "$TMPDIR/deploy.json"
```
Expected: `STRUCTURE_OK`.

- [ ] **Step 4: Verify the e2e guard**

Run: `npm pkg get scripts.test:e2e`
Expected: `{}` while no `test:e2e` script exists (the workflow then skips it); once a later plan adds the script this prints its command and the workflow runs it. Do not add the script here.

- [ ] **Step 5: Run the CI commands locally, in workflow order**

Run: `npm run typecheck && npm test && npm run build && npm run check:dist`
Expected: all pass (`npm test` runs the unit and Chromium browser projects). If a step fails, fix the cause before committing; CI would fail the same way.

- [ ] **Step 6: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: test, build and deploy to GitHub Pages on push to main

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: README for the owner (Polish)

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write the README**

Create `README.md` with exactly this content (it is Polish on purpose; the owner is not a programmer):

````markdown
# ZINIARZ

ZINIARZ to aplikacja w przeglądarce do składania zinów: małych broszur zszywanych ze złożonych na pół kartek A4. Każda kartka to 4 strony A5. Układasz zdjęcia i napisy, a program przygotowuje arkusze do druku dwustronnego na zwykłej domowej drukarce (ze spadami i znacznikami cięcia i zgięcia).

Wszystko dzieje się w Twojej przeglądarce. Nie ma konta ani serwera: zdjęcia i zine zostają na Twoim komputerze.

## Jak tego używać

1. Na ekranie głównym wpisz liczbę kartek i kliknij „Nowy zin”.
2. W edytorze dodawaj zdjęcia i napisy, przeciągaj je na stronach i ustawiaj w prawej kolumnie (kolory, fonty, kadr zdjęcia). Zmiany zapisują się same.
3. Na ekranie druku pobierz PDF z arkuszami. Wydrukuj go dwustronnie (odwracanie po krótszej krawędzi), złóż kartki na pół i zszyj w grzbiecie.
4. Kopię zina zrobisz jako plik `.zin` („Zapisz plik .zin” przy zinie na ekranie głównym; „Wczytaj plik .zin” wczytuje go z powrotem). Warto to robić, bo ziny leżą tylko w tej przeglądarce, na tym komputerze i pod tym adresem strony.

## Uruchomienie na swoim komputerze

Potrzebny jest [Node.js](https://nodejs.org) w wersji 22 lub nowszej.

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

Pamiętaj: zine zapisane na komputerze, pod adresem `localhost`, nie przeniosą się same pod adres na GitHub Pages (przeglądarka trzyma dane osobno dla każdego adresu). Przenieś je plikami `.zin`: „Zapisz plik .zin” na starym adresie i „Wczytaj plik .zin” pod nowym.
````

- [ ] **Step 2: Check that the README matches reality**

Run: `grep -n '"dev"\|"check:dist"\|"typecheck"\|"build"\|"test"' package.json`
Expected: each script named in the README exists. Then check the wording against the app: `grep -n 'Nowy zin\|plik .zin' src/home/HomeScreen.tsx src/home/ZineCard.tsx`. If the labels drifted ("Nowy zin", "Zapisz plik .zin", "Wczytaj plik .zin"), change the README to the app's actual wording.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: add Polish README with GitHub Pages publishing steps

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: CLAUDE.md, launch.json and final check

**Files:**
- Modify: `CLAUDE.md`
- Add to git: `.claude/launch.json`

- [ ] **Step 1: Update "Szybki start"**

In `CLAUDE.md`, under "Szybki start", insert these two bullets right after the `test-output/` bullet (before the `vite.config.ts` bullet):

```markdown
- `npm run check:dist` (po `npm run build`): sprawdza, że zbudowana strona nie ma adresów od korzenia serwera (`/assets/...`) i że wszystkie pliki, do których się odwołuje, są w `dist/`. Bez tego strona pod GitHub Pages (`/<repo>/`) by się nie wczytała. Logika w `scripts/checkDist.mjs`, testy w `src/build/checkDist.test.ts`.
- `.claude/launch.json`: serwer deweloperski dla podglądu w Claude Code (`ziniarz-dev`, port 5199).
```

- [ ] **Step 2: Add structure rows**

In the table under "Struktura", append these rows after the `src/test/` row:

```markdown
| `src/build/`, `scripts/` | Sprawdzenie zbudowanej strony pod podadresem: czyste funkcje (`scripts/checkDist.mjs` z typami w `checkDist.d.mts`) i ich testy (`src/build/checkDist.test.ts`). |
| `.github/workflows/deploy.yml` | Publikacja: po pushu do `main` (albo ręcznie) testy → budowa → GitHub Pages. |
| `README.md` | Opis dla właścicielki po polsku: użycie, uruchomienie, testy, publikacja. |
```

- [ ] **Step 3: Add the deployment section and rule**

Insert a new section between "Struktura" and "Zasady i niezmienniki":

```markdown
## Publikacja

- Hosting: GitHub Pages, adres `https://<user>.github.io/<repo>/`. `.github/workflows/deploy.yml` po każdym pushu do `main` (i ręcznie: Actions → Run workflow) uruchamia po kolei: `npm run typecheck`, `npm test`, `npm run test:e2e` (tylko gdy skrypt istnieje), `npm run build`, `npm run check:dist`, a potem wysyła `dist/` na Pages. Czerwony test blokuje publikację.
- Wymaga w ustawieniach repo *Settings → Pages → Source: GitHub Actions*. Chrome do testów instaluje workflow (`npx playwright install --with-deps chromium`).
- **Repo, `remote` i `push` zostały celowo niewykonane:** to publikacja publiczna i decyzja właścicielki. Instrukcja jest w `README.md`. Nie zakładaj repo ani nie pushuj bez jej polecenia.
- Strona działa pod podadresem, więc `base` w `vite.config.ts` zostaje `'./'`, a adresy ekranów są po haszu (`#/zin/<id>`), bez routingu po stronie serwera i bez `404.html`. **Nie używaj adresów zaczynających się od `/`** (np. `/fonts/x.woff2`, `fetch('/api')`, `<img src="/logo.png">`). Zasoby importuj w kodzie (`import url from '...?url'`) albo przez `new URL('./x', import.meta.url)`; `npm run check:dist` to wyłapie.
- Zine są w IndexedDB przeglądarki, osobno dla każdego adresu (`localhost` i adres na GitHub Pages to dwa różne magazyny): przenosi się je plikami `.zin`.
- Nowe wersje akcji w workflow podnoś parami (`upload-pages-artifact` razem z `deploy-pages`).
```

- [ ] **Step 4: Review the edited file**

Run: `git diff CLAUDE.md`
Expected: only the three insertions above; the existing text is untouched. The doc must stay Polish.

- [ ] **Step 5: Final check, all of it**

Run: `npm run typecheck && npm test && npm run build && npm run check:dist`
Expected: typecheck clean; `npm test` passes both projects (the unit project now includes `src/build/checkDist.test.ts`); build succeeds; `check:dist OK`.
Also: `git status --short` shows only `?? test-output/...` or nothing besides the files of this task (and `.claude/launch.json` before the commit).

- [ ] **Step 6: Commit**

```bash
git add CLAUDE.md .claude/launch.json
git commit -m "docs: document deployment in CLAUDE.md and commit the dev preview config

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 7: Hand-off note for the owner (do not act on it)**

Tell the owner, in Polish: repo, remote and push were intentionally not done; to publish, follow "Publikacja na GitHub Pages" in `README.md`; repo may be public or private (Pages on private needs a paid plan). Do not run `gh repo create`, `git remote add` or `git push`.
