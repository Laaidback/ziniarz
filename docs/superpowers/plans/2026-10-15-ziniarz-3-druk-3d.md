# ZINIARZ, plan 3: druk i podgląd 3D Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the print and 3D placeholder screens: a print screen with a lazy sheet preview, every export option from the spec, a remembered printer margin, PDF downloads with progress, failure and retry; a three.js 3D preview of the folded zine to page through; and the Playwright end-to-end test.

**Architecture:** Pure logic (printer margin memory, print texts, export runner, render queue, page turning, input and camera maths) lives in small modules tested in Node. The print screen and the 3D screen load the zine read-only through `openZineView` (waits for pending editor saves) and draw only through the existing renderer (`renderSheetSide`, `renderPage`). three.js lives in one module (`src/preview3d/scene.ts`) that the 3D screen imports dynamically, so the main bundle does not grow; the scene is a thin class that draws on demand. Playwright runs against the production build, outside `npm test`.

**Tech Stack:** Vite 7, React 19, TypeScript 5.9 (strict), Konva 9, pdf-lib, three.js 0.186 (+ `@types/three`), Vitest 3.2 (node + browser/Playwright, WebGL through SwiftShader), vitest-browser-react 1.x, `@playwright/test` (same version as the installed `playwright`, 1.64.x).

**Spec:** `docs/superpowers/specs/2026-10-14-ziniarz-design.md` (sections Druk, Podgląd 3D, Błędy, Testy). Plans 1 and 2 (`docs/superpowers/plans/2026-10-14-ziniarz-1-rdzen.md`, `…-2-edytor.md`) are done; where their text and the repository differ, the repository is right. Later: plan 4 = hosting on GitHub Pages.

## Decisions

Made without the user (asleep); all fit the spec.

1. **Printer margin lives in the browser:** `localStorage` key `ziniarz.printerMargin`, clamped to 0–20 mm in 0.5 mm steps (at 20 mm with bleed and marks the scale is still ≈ 0.69, never negative); a non-number becomes the default 4 mm; blocked storage just forgets it. `printSettingsFor(zine.print, loadPrinterMargin())` gives the settings to print and preview with: the remembered margin wins, `Zine.print.printerMargin` is the fallback (a `.zin` opened on another computer) and is updated too.
2. **Other print options are saved into `Zine.print` by the print screen itself** (`createAutosaver` + `saveZine`, 500 ms, flushed on leaving), not through the editor store: the editor store only exists on the editor route, and print options are not undo steps.
3. **Print and 3D screens are read-only views** opened by `openZineView` (new, in `src/editor/session.ts`, split out of `openEditorSession`, which calls it). It keeps the existing wait for `whenSavesSettled()`, so the last edit made before clicking „Druk” or „Podgląd 3D” is in the PDF and the preview, and the print settings saved on leaving the print screen are in the editor.
4. **Sheet preview:** one row per sheet („Kartka N”: front | back), JPEG at 48 dpi (561 × 397 px per side), drawn the first time a side scrolls into view (`IntersectionObserver`) through a one-at-a-time background queue (`createRenderQueue`, shared later by the 3D textures). Backs are never shown turned: the preview shows the paper as it comes out of a correctly set printer; „Obróć tyły o 180°” changes only the PDF.
5. **Texts:** the final size is shown in whole mm with the scale („Strona po przycięciu: 138 × 196 mm (94% projektu)”). Reminders: always „Rzeczywisty rozmiar”; automatic duplex says „odwracanie po krótszej krawędzi” (or „po dłuższej” when „Obróć tyły o 180°” is on, because that is what the rotation is for); manual duplex says to print the fronts, put the stack back and print the backs.
6. **Test page** is exported with the current settings (margin, marks, rotation, duplex mode — manual gives two files), so it tests exactly what will be printed. Its instructions come from one function (`testPageInstructions`) used both on the PDF cover and under the download button.
7. **„PDF stronami”** follows the „Spady” option (spec: „ze spadami albo bez”).
8. **Downloads:** `runExport` builds every file of a download before saving any, so a failure never leaves a partial download (manual duplex saves both PDFs at the end). One progress bar („PDF do druku: 3 z 10”); buttons are disabled while it runs; a failure shows „Nie udało się zrobić PDF-u. Nic nie zostało pobrane. Spróbuj jeszcze raz.” with „Spróbuj jeszcze raz”, which reruns the same task with the same settings. The screen takes a `PdfExporter` (build + save) so tests use 20 dpi, collect files instead of downloading, and simulate failures.
9. **3D model:** the zine is `2 · sheets` rigid leaves hinged at the spine; leaf `j` carries pages `2j + 1` (front) and `2j + 2` (back); leaves `j` and `L − 1 − j` are the two halves of one sheet. Each leaf is lifted by 0.15 mm per leaf of paper (right stack: leaf 0 on top; left stack: the last turned leaf on top), interpolated during the turn. Turns take 0.6 s with ease-in-out, may overlap (fast clicking animates several leaves), and turning back mid-turn starts from where the leaf is.
10. **3D input:** a press and release within 5 px is a click (anything more is an orbit drag); right half of the view = forward, left half = back; ArrowRight/ArrowLeft too. Added: „← Wstecz” / „Dalej →” buttons and a live caption („Okładka”, „Strony 2–3”, „Tył”), for keyboard users and tests.
11. **3D scene:** `MeshBasicMaterial` (colours as printed, white until the texture arrives), a thin grey outline per leaf so white pages stay apart, background `#d9d9de`, camera slightly above the open spread at a distance that fits it, OrbitControls with damping, no panning, rotate speed 0.5. Frames are drawn on demand (camera change, turn, new texture, resize), not in an endless loop, which also keeps SwiftShader test runs fast. Page textures: `renderPage` without bleed at 1024 px page height, drawn in the background in page order after the preview opens; each canvas is freed once uploaded to the GPU. Page size = trimmed page with the current print settings. If WebGL is missing, a Polish message replaces the view.
12. **three.js is loaded on demand:** only `src/preview3d/scene.ts` imports `three`; `Preview3dScreen` does `import('./scene')`. The build shows a separate `scene-*.js` chunk; the main chunk does not contain `WebGLRenderer`.
13. **WebGL in tests:** headless Chromium renders WebGL with SwiftShader; the launch flags `--use-angle=swiftshader --enable-unsafe-swiftshader` are set in `vite.config.ts` and `playwright.config.ts` so it also works on Linux CI.
14. **End-to-end:** `@playwright/test` pinned to the installed `playwright` version (shares the downloaded Chromium). `npm run test:e2e` builds the app and serves it with `vite preview` on port 4173; the photo is drawn in the page (no binary fixture); the PDF is checked with pdf-lib in Node (10 pages, 841.89 × 595.28 pt). A second e2e test opens the 3D preview from the editor, which proves the lazy chunk loads in the production build. Output goes to `test-output/e2e/` (already git-ignored). The GitHub Actions workflow from plan 4 (`.github/workflows/deploy.yml`) already runs `npm run test:e2e` when the script exists, on Linux, which is why the SwiftShader flags matter.

**Conventions for every task:**
- Repo root: `~/projects/ziniarz`. Plans 1 and 2 are implemented; read `CLAUDE.md` for the existing structure and rules.
- UI strings and user-facing error messages in Polish; code, comments and commit messages in English.
- All lengths in millimetres unless a name says `Px`.
- `*.test.ts` run in Node (`npx vitest run --project unit <file>`); `*.browser.test.ts` and `*.browser.test.tsx` run in Chromium (`npx vitest run --project browser <file>`).
- Every commit message ends with a blank line and `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` (the two `-m` flags below do that).
- Never create two files whose names differ only in letter case (macOS file systems ignore case).
- Zustand selectors must return a stored value, never a newly built object or array.
- "Expected: FAIL" for a new module means Vitest reports that the import cannot be resolved (`Failed to load url` / `Failed to resolve import`). Exact wording of Vitest output may differ; what matters is pass or fail.
- Never import `three` (or anything under `three/`) outside `src/preview3d/scene.ts`.

**Left for later on purpose:** hosting and GitHub Actions (plan 4). The bundle-size warning from `vite build` about the main chunk (over 500 kB, mostly fonts and Konva) is accepted, as in plan 2; the three.js chunk is separate.

---

## File structure

```
src/print/printerMargin.ts           printer margin: clamp, localStorage, settings to print with
src/print/printTexts.ts              sheet list for the preview, captions, trimmed size, reminders
src/print/exportRunner.ts            build all files, then save; progress and failure states
src/print/exporter.ts                PdfExporter: real PDF builders + browser download
src/print/screen/PrintScreen.tsx     print screen: layout, saving options, downloads, test page
src/print/screen/PrintOptions.tsx    the option fields
src/print/screen/SheetPreview.tsx    lazy preview of every sheet side
src/print/screen/ExportStatusView.tsx progress bar, error with retry, downloaded files
src/render/renderQueue.ts            one-at-a-time background rendering
src/app/useZineView.ts               hook: open a zine read-only, release photos on close
src/app/LoadFailed.tsx               "could not open" screen with a way back
src/preview3d/book.ts                leaves, turning, angles, stacking, captions
src/preview3d/view.ts                click vs drag, halves, keys, camera distance, texture size
src/preview3d/scene.ts               three.js scene (the only module importing three)
src/preview3d/Preview3dScreen.tsx    3D screen: lazy scene, background textures, input
src/test/screenHarness.tsx           render a screen with a fresh test database
src/test/webgl.browser.test.ts       WebGL works in the test browser
e2e/print.spec.ts, playwright.config.ts   end-to-end test
```

Modified: `package.json`, `package-lock.json` (via npm), `vite.config.ts`, `tsconfig.json`, `src/App.tsx`, `src/App.browser.test.tsx`, `src/app/app.css`, `src/editor/session.ts` (`openZineView`), `src/editor/session.browser.test.ts`, `src/print/testPage.ts` (`testPageInstructions`), `src/print/testPage.test.ts`, `CLAUDE.md`. Deleted: `src/app/PlaceholderScreen.tsx`.

---

### Task 1: Dependencies and WebGL in browser tests

**Files:**
- Modify: `package.json`, `package-lock.json` (via npm), `vite.config.ts`
- Create: `src/test/webgl.browser.test.ts`

- [ ] **Step 1: Install the libraries**

```bash
npm install three@^0.186.1
npm install -D @types/three@^0.186.0 @playwright/test@$(node -p "require('playwright/package.json').version")
```

Expected: both finish without errors. `@playwright/test` gets exactly the version of the already installed `playwright` (1.64.x), so it uses the Chromium that `npx playwright install chromium` downloaded.

- [ ] **Step 2: Check the OrbitControls module exists**

```bash
ls node_modules/three/examples/jsm/controls/OrbitControls.js
```

Expected: the path is printed.

- [ ] **Step 3: Write the test `src/test/webgl.browser.test.ts`**

```ts
import { expect, test } from 'vitest';

test('the test browser can draw with WebGL (SwiftShader in headless Chromium)', () => {
  const gl = document.createElement('canvas').getContext('webgl2');
  expect(gl).not.toBeNull();
});
```

- [ ] **Step 4: Replace `vite.config.ts`**

New: `three` and OrbitControls are pre-bundled (otherwise Vite reloads the browser tests mid-run when the 3D tests first import them), and Chromium is launched with SwiftShader flags so WebGL also works on machines without a GPU.

```ts
import { configDefaults, defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  // Pre-bundle so the first browser test run is not reloaded mid-run.
  optimizeDeps: {
    include: [
      'konva',
      'pdf-lib',
      'idb',
      'jszip',
      'react',
      'react-dom',
      'react-dom/client',
      'react/jsx-dev-runtime',
      'zustand',
      'zustand/vanilla',
      'three',
      'three/examples/jsm/controls/OrbitControls.js',
      'vitest-browser-react',
    ],
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          environment: 'node',
          include: ['src/**/*.test.ts'],
          exclude: [...configDefaults.exclude, 'src/**/*.browser.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'browser',
          include: ['src/**/*.browser.test.{ts,tsx}'],
          browser: {
            enabled: true,
            provider: 'playwright',
            headless: true,
            // The default 414 px wide viewport is too small for the editor layout.
            viewport: { width: 1280, height: 900 },
            instances: [{ browser: 'chromium', launch: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] } }],
          },
        },
      },
    ],
  },
});
```

- [ ] **Step 5: Run the WebGL test**

Run: `npx vitest run --project browser src/test/webgl.browser.test.ts`
Expected: PASS (1 test).

- [ ] **Step 6: Type check**

Run: `npm run typecheck`
Expected: no errors (the `launch` option is typed by `@vitest/browser/providers/playwright`).

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json vite.config.ts src/test/webgl.browser.test.ts
git commit -m "Add three.js and Playwright Test, enable WebGL in browser tests" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Printer margin remembered in the browser

The printer margin belongs to the printer, so it is set once and remembered in this browser (spec, Druk). It must stay in 0–20 mm, so the print scale `s` never goes negative. The zine keeps a copy in `Zine.print.printerMargin` as a fallback.

**Files:**
- Create: `src/print/printerMargin.ts`
- Test: `src/print/printerMargin.test.ts`

- [ ] **Step 1: Write the failing test `src/print/printerMargin.test.ts`**

```ts
import { expect, test } from 'vitest';
import { printLayout } from '../imposition/layout';
import { DEFAULT_PRINT } from '../model/factory';
import {
  clampPrinterMargin,
  loadPrinterMargin,
  MAX_PRINTER_MARGIN,
  PRINTER_MARGIN_KEY,
  printSettingsFor,
  savePrinterMargin,
  type KeyValueStore,
} from './printerMargin';

function memoryStore(initial: Record<string, string> = {}): KeyValueStore & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => {
      data[key] = value;
    },
  };
}

const throwing: KeyValueStore = {
  getItem: () => {
    throw new Error('SecurityError');
  },
  setItem: () => {
    throw new Error('QuotaExceededError');
  },
};

test('the margin is kept between 0 and 20 mm, rounded to 0.5 mm; nonsense becomes the default', () => {
  expect(clampPrinterMargin(4)).toBe(4);
  expect(clampPrinterMargin(-3)).toBe(0);
  expect(clampPrinterMargin(35)).toBe(MAX_PRINTER_MARGIN);
  expect(clampPrinterMargin(3.26)).toBe(3.5);
  expect(clampPrinterMargin(Number.NaN)).toBe(DEFAULT_PRINT.printerMargin);
});

test('even the largest margin with marks and bleed leaves a positive scale', () => {
  const layout = printLayout({ printerMargin: MAX_PRINTER_MARGIN, bleed: true, cropMarks: true, foldMarks: true });
  expect(layout.scale).toBeGreaterThan(0.5);
});

test('the remembered margin is saved and read back, clamped', () => {
  const store = memoryStore();
  expect(loadPrinterMargin(store)).toBeNull();
  savePrinterMargin(6.5, store);
  expect(store.data[PRINTER_MARGIN_KEY]).toBe('6.5');
  expect(loadPrinterMargin(store)).toBe(6.5);
  expect(loadPrinterMargin(memoryStore({ [PRINTER_MARGIN_KEY]: '99' }))).toBe(MAX_PRINTER_MARGIN);
  expect(loadPrinterMargin(memoryStore({ [PRINTER_MARGIN_KEY]: 'abc' }))).toBeNull();
});

test('a browser that refuses storage just forgets the margin', () => {
  expect(loadPrinterMargin(throwing)).toBeNull();
  expect(() => savePrinterMargin(5, throwing)).not.toThrow();
  expect(loadPrinterMargin(null)).toBeNull();
});

test('the remembered margin wins over the one stored in the zine', () => {
  const zinePrint = { ...DEFAULT_PRINT, printerMargin: 7, bleed: false };
  expect(printSettingsFor(zinePrint, 2)).toEqual({ ...zinePrint, printerMargin: 2 });
  expect(printSettingsFor(zinePrint, null)).toEqual(zinePrint);
  expect(printSettingsFor({ ...zinePrint, printerMargin: -5 }, null).printerMargin).toBe(0);
});
```

- [ ] **Step 2: Run it**

Run: `npx vitest run --project unit src/print/printerMargin.test.ts`
Expected: FAIL, `./printerMargin` cannot be resolved.

- [ ] **Step 3: Write `src/print/printerMargin.ts`**

```ts
import { DEFAULT_PRINT } from '../model/factory';
import type { PrintSettings } from '../model/types';

/** localStorage key of the printer margin: it belongs to the printer, so it is remembered per browser. */
export const PRINTER_MARGIN_KEY = 'ziniarz.printerMargin';
export const MAX_PRINTER_MARGIN = 20;
const STEP = 0.5;

/** The part of `Storage` we use, so tests can pass a plain object. */
export type KeyValueStore = Pick<Storage, 'getItem' | 'setItem'>;

/** 0…20 mm in 0.5 mm steps; anything that is not a number becomes the default. 20 mm keeps the print scale well above zero. */
export function clampPrinterMargin(mm: number): number {
  if (!Number.isFinite(mm)) return DEFAULT_PRINT.printerMargin;
  return Math.min(MAX_PRINTER_MARGIN, Math.max(0, Math.round(mm / STEP) * STEP));
}

function browserStore(): KeyValueStore | null {
  try {
    return window.localStorage;
  } catch {
    return null; // storage blocked (privacy settings)
  }
}

/** The margin set earlier in this browser, or null when none was set (or storage is blocked). */
export function loadPrinterMargin(store: KeyValueStore | null = browserStore()): number | null {
  try {
    const raw = store?.getItem(PRINTER_MARGIN_KEY);
    if (raw == null || raw.trim() === '') return null;
    const value = Number(raw);
    return Number.isFinite(value) ? clampPrinterMargin(value) : null;
  } catch {
    return null;
  }
}

export function savePrinterMargin(mm: number, store: KeyValueStore | null = browserStore()): void {
  try {
    store?.setItem(PRINTER_MARGIN_KEY, String(clampPrinterMargin(mm)));
  } catch {
    // Not remembered; the zine still keeps its own copy.
  }
}

/**
 * Settings to print and preview with: the zine's own settings, except the printer margin,
 * which comes from this browser when it was set here (the zine copy is the fallback,
 * e.g. for a .zin file opened on another computer).
 */
export function printSettingsFor(zinePrint: PrintSettings, rememberedMargin: number | null): PrintSettings {
  return { ...zinePrint, printerMargin: rememberedMargin ?? clampPrinterMargin(zinePrint.printerMargin) };
}
```

- [ ] **Step 4: Run the test again**

Run: `npx vitest run --project unit src/print/printerMargin.test.ts`
Expected: PASS (5 tests). In Node `window` does not exist; `browserStore()` catches that and returns null, which the tests never rely on (they pass their own store).

- [ ] **Step 5: Commit**

```bash
git add src/print/printerMargin.ts src/print/printerMargin.test.ts
git commit -m "Remember the printer margin in the browser" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Background render queue

Previews (print sheets now, 3D page textures later) are drawn in the background one at a time, with a `setTimeout(0)` turn for the browser before each, so clicks and typing never freeze.

**Files:**
- Create: `src/render/renderQueue.ts`
- Test: `src/render/renderQueue.test.ts`

- [ ] **Step 1: Write the failing test `src/render/renderQueue.test.ts`**

```ts
import { expect, test } from 'vitest';
import { createRenderQueue } from './renderQueue';

const tick = () => new Promise((resolve) => setTimeout(resolve, 5));

test('jobs run one at a time, in order, with a pause between them', async () => {
  const log: string[] = [];
  const queue = createRenderQueue();
  queue.add(async () => {
    log.push('a start');
    await tick();
    log.push('a end');
  });
  queue.add(() => void log.push('b'));
  expect(log).toEqual([]); // nothing runs synchronously
  await queue.idle();
  expect(log).toEqual(['a start', 'a end', 'b']);
});

test('a cancelled job never runs; clear drops everything waiting', async () => {
  const log: string[] = [];
  const queue = createRenderQueue();
  queue.add(() => void log.push('a'));
  const cancelB = queue.add(() => void log.push('b'));
  queue.add(() => void log.push('c'));
  cancelB();
  await queue.idle();
  expect(log).toEqual(['a', 'c']);

  queue.add(() => void log.push('d'));
  queue.clear();
  await queue.idle();
  expect(log).toEqual(['a', 'c']);
});

test('a failing job does not stop the next one', async () => {
  const log: string[] = [];
  const queue = createRenderQueue();
  queue.add(() => {
    throw new Error('broken page');
  });
  queue.add(() => void log.push('next'));
  await queue.idle();
  expect(log).toEqual(['next']);
});
```

- [ ] **Step 2: Run it**

Run: `npx vitest run --project unit src/render/renderQueue.test.ts`
Expected: FAIL, `./renderQueue` cannot be resolved.

- [ ] **Step 3: Write `src/render/renderQueue.ts`**

```ts
export type RenderJob = () => void | Promise<void>;

export interface RenderQueue {
  /** Queues a job; the returned function drops it if it has not started yet. */
  add(job: RenderJob): () => void;
  /** Drops every job that has not started. */
  clear(): void;
  /** Resolves when the queue is empty and nothing runs. */
  idle(): Promise<void>;
}

/**
 * Runs rendering jobs one at a time, giving the browser a turn (setTimeout 0) before
 * each, so previews drawn in the background never freeze clicks and typing.
 * A failing job is skipped; it must show its own fallback.
 */
export function createRenderQueue(): RenderQueue {
  const waiting: RenderJob[] = [];
  let running = false;
  let idleWaiters: (() => void)[] = [];

  const settle = () => {
    for (const resolve of idleWaiters) resolve();
    idleWaiters = [];
  };

  const pump = () => {
    const job = waiting.shift();
    if (!job) {
      running = false;
      settle();
      return;
    }
    void (async () => {
      try {
        await job();
      } catch {
        // see the doc comment
      }
      setTimeout(pump, 0);
    })();
  };

  return {
    add(job) {
      waiting.push(job);
      if (!running) {
        running = true;
        setTimeout(pump, 0);
      }
      return () => {
        const index = waiting.indexOf(job);
        if (index >= 0) waiting.splice(index, 1);
      };
    },
    clear() {
      waiting.length = 0;
    },
    idle() {
      if (!running) return Promise.resolve();
      return new Promise((resolve) => idleWaiters.push(resolve));
    },
  };
}
```

- [ ] **Step 4: Run the test again**

Run: `npx vitest run --project unit src/render/renderQueue.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/render/renderQueue.ts src/render/renderQueue.test.ts
git commit -m "Add a one-at-a-time render queue for background previews" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Export runner and PDF exporter

Spec, Błędy: „Błąd eksportu PDF: komunikat i możliwość ponowienia; część pliku nie jest pobierana.” `runExport` builds every file of one download first and only then saves them. `PdfExporter` bundles the existing builders (`buildSheetsPdf`, `buildPagesPdf` in `src/print/pdf.ts`) with the browser download (`downloadBlob` in `src/home/download.ts`), so the print screen can be tested with a faster or failing exporter.

**Files:**
- Create: `src/print/exportRunner.ts`, `src/print/exporter.ts`
- Test: `src/print/exportRunner.test.ts`

- [ ] **Step 1: Write the failing test `src/print/exportRunner.test.ts`**

```ts
import { expect, test } from 'vitest';
import { EXPORT_FAILED, exportProgressText, runExport, type ExportStatus, type ExportTask } from './exportRunner';
import type { PdfFile } from './pdf';

const file = (name: string): PdfFile => ({ name, bytes: new Uint8Array([1]) });

test('reports progress, then hands over every file at the end', async () => {
  const statuses: ExportStatus[] = [];
  const saved: string[] = [];
  const task: ExportTask = {
    label: 'PDF do druku',
    async build(onProgress) {
      onProgress(1, 2);
      expect(saved).toEqual([]); // nothing is downloaded while building
      onProgress(2, 2);
      return [file('a-przody.pdf'), file('a-tyly.pdf')];
    },
  };
  const ok = await runExport(task, (s) => statuses.push(s), (f) => saved.push(f.name));
  expect(ok).toBe(true);
  expect(saved).toEqual(['a-przody.pdf', 'a-tyly.pdf']);
  expect(statuses).toEqual([
    { kind: 'running', label: 'PDF do druku', done: 0, total: 0 },
    { kind: 'running', label: 'PDF do druku', done: 1, total: 2 },
    { kind: 'running', label: 'PDF do druku', done: 2, total: 2 },
    { kind: 'finished', label: 'PDF do druku', files: ['a-przody.pdf', 'a-tyly.pdf'] },
  ]);
});

test('a failure part way saves nothing and says so', async () => {
  const statuses: ExportStatus[] = [];
  const saved: string[] = [];
  const task: ExportTask = {
    label: 'PDF stronami',
    async build(onProgress) {
      onProgress(3, 20);
      throw new Error('canvas too big');
    },
  };
  const ok = await runExport(task, (s) => statuses.push(s), (f) => saved.push(f.name));
  expect(ok).toBe(false);
  expect(saved).toEqual([]);
  expect(statuses.at(-1)).toEqual({ kind: 'failed', label: 'PDF stronami' });
  expect(EXPORT_FAILED).toContain('Nic nie zostało pobrane');
});

test('progress text', () => {
  expect(exportProgressText({ kind: 'running', label: 'PDF do druku', done: 3, total: 10 })).toBe('PDF do druku: 3 z 10');
  expect(exportProgressText({ kind: 'running', label: 'PDF do druku', done: 0, total: 0 })).toBe('PDF do druku: przygotowanie…');
});
```

- [ ] **Step 2: Run it**

Run: `npx vitest run --project unit src/print/exportRunner.test.ts`
Expected: FAIL, `./exportRunner` cannot be resolved.

- [ ] **Step 3: Write `src/print/exportRunner.ts`**

Only a type is imported from `./pdf`, so the Node test does not load pdf-lib or Konva.

```ts
import type { PdfFile } from './pdf';

export type ExportStatus =
  | { kind: 'idle' }
  | { kind: 'running'; label: string; done: number; total: number }
  | { kind: 'failed'; label: string }
  | { kind: 'finished'; label: string; files: string[] };

/** One download button's work: builds every file before anything is saved. */
export interface ExportTask {
  label: string;
  build(onProgress: (done: number, total: number) => void): Promise<PdfFile[]>;
}

export const EXPORT_FAILED = 'Nie udało się zrobić PDF-u. Nic nie zostało pobrane. Spróbuj jeszcze raz.';

/**
 * Builds all files of the task, reporting progress, and only then saves them, so a failure
 * part way never leaves a partial download. Resolves true when the files were saved.
 */
export async function runExport(
  task: ExportTask,
  report: (status: ExportStatus) => void,
  save: (file: PdfFile) => void,
): Promise<boolean> {
  report({ kind: 'running', label: task.label, done: 0, total: 0 });
  let files: PdfFile[];
  try {
    files = await task.build((done, total) => report({ kind: 'running', label: task.label, done, total }));
  } catch {
    report({ kind: 'failed', label: task.label });
    return false;
  }
  for (const file of files) save(file);
  report({ kind: 'finished', label: task.label, files: files.map((f) => f.name) });
  return true;
}

export function exportProgressText(status: Extract<ExportStatus, { kind: 'running' }>): string {
  return status.total === 0
    ? `${status.label}: przygotowanie…`
    : `${status.label}: ${status.done} z ${status.total}`;
}
```

- [ ] **Step 4: Write `src/print/exporter.ts`**

```ts
import { downloadBlob } from '../home/download';
import { buildPagesPdf, buildSheetsPdf, type PagesPdfJob, type PdfFile, type SheetsPdfJob } from './pdf';

/** How the print screen builds and saves PDFs; tests pass a faster or failing one. */
export interface PdfExporter {
  sheets(job: SheetsPdfJob): Promise<PdfFile[]>;
  pages(job: PagesPdfJob): Promise<PdfFile>;
  save(file: PdfFile): void;
}

export function savePdf(file: PdfFile): void {
  downloadBlob(file.name, new Blob([file.bytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' }));
}

export const browserPdfExporter: PdfExporter = { sheets: buildSheetsPdf, pages: buildPagesPdf, save: savePdf };
```

- [ ] **Step 5: Run the test and the type check**

Run: `npx vitest run --project unit src/print/exportRunner.test.ts && npm run typecheck`
Expected: PASS (3 tests), no type errors.

- [ ] **Step 6: Commit**

```bash
git add src/print/exportRunner.ts src/print/exportRunner.test.ts src/print/exporter.ts
git commit -m "Build PDFs fully before downloading, with progress and failure" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Print screen texts and shared test page instructions

**Files:**
- Create: `src/print/printTexts.ts`
- Modify: `src/print/testPage.ts`, `src/print/testPage.test.ts`
- Test: `src/print/printTexts.test.ts`

- [ ] **Step 1: Write the failing test `src/print/printTexts.test.ts`**

The expected sizes are the spec's examples (m = 4, bleed on: 138 × 196 mm without marks, 132 × 187 mm with marks).

```ts
import { expect, test } from 'vitest';
import { printLayout } from '../imposition/layout';
import { DEFAULT_PRINT } from '../model/factory';
import { previewSheets, printReminders, sideCaption, trimSizeText } from './printTexts';

test('the preview lists every sheet with its front and back', () => {
  const sheets = previewSheets(5);
  expect(sheets).toHaveLength(5);
  expect(sheets[0].front).toMatchObject({ sheet: 0, face: 'front', left: 20, right: 1 });
  expect(sheets[0].back).toMatchObject({ sheet: 0, face: 'back', left: 2, right: 19 });
  expect(sheets[4].front).toMatchObject({ left: 12, right: 9 });
  expect(sideCaption(sheets[4].back)).toBe('tył: strony 10 i 11');
  expect(sideCaption(sheets[0].front)).toBe('przód: strony 20 i 1');
});

test('the trimmed page size matches the spec examples', () => {
  const plain = printLayout({ printerMargin: 4, bleed: true, cropMarks: false, foldMarks: false });
  expect(trimSizeText(plain)).toBe('Strona po przycięciu: 138 × 196 mm (94% projektu)');
  const marked = printLayout({ printerMargin: 4, bleed: true, cropMarks: true, foldMarks: false });
  expect(trimSizeText(marked)).toBe('Strona po przycięciu: 132 × 187 mm (89% projektu)');
});

test('reminders: actual size always, the duplex flip that fits the settings', () => {
  const auto = printReminders(DEFAULT_PRINT);
  expect(auto[0]).toContain('„Rzeczywisty rozmiar”');
  expect(auto[1]).toContain('„odwracanie po krótszej krawędzi”');
  expect(printReminders({ ...DEFAULT_PRINT, rotateBacks: true })[1]).toContain('„odwracanie po dłuższej krawędzi”');
  const manual = printReminders({ ...DEFAULT_PRINT, duplex: 'manual' });
  expect(manual[1]).toContain('z przodami');
  expect(manual[1]).toContain('z tyłami');
});
```

- [ ] **Step 2: Add a failing test at the end of `src/print/testPage.test.ts`**

Change the import line `import { testPageZine } from './testPage';` to:

```ts
import { testPageInstructions, testPageZine } from './testPage';
```

and append:

```ts

test('the cover prints the same instructions the print screen shows', () => {
  const lines = testPageInstructions();
  expect(lines).toHaveLength(4);
  expect(texts(testPageZine()).map((e) => e.text)).toContain(lines.join('\n'));
});
```

- [ ] **Step 3: Run both**

Run: `npx vitest run --project unit src/print/printTexts.test.ts src/print/testPage.test.ts`
Expected: FAIL, `./printTexts` cannot be resolved and `testPageInstructions` is not a function.

- [ ] **Step 4: Write `src/print/printTexts.ts`**

```ts
import { sheetSides, type SheetSide } from '../imposition/imposition';
import type { PrintLayout } from '../imposition/layout';
import type { PrintSettings } from '../model/types';

export interface PreviewSheet {
  sheet: number;
  front: SheetSide;
  back: SheetSide;
}

/** Every sheet with both of its sides, in sheet order. */
export function previewSheets(sheets: number): PreviewSheet[] {
  const sides = sheetSides(sheets);
  return Array.from({ length: sheets }, (_, sheet) => ({
    sheet,
    front: sides.find((s) => s.sheet === sheet && s.face === 'front')!,
    back: sides.find((s) => s.sheet === sheet && s.face === 'back')!,
  }));
}

export function sideCaption(side: SheetSide): string {
  return `${side.face === 'front' ? 'przód' : 'tył'}: strony ${side.left} i ${side.right}`;
}

export function trimSizeText(layout: PrintLayout): string {
  const width = Math.round(layout.trimPage.width);
  const height = Math.round(layout.trimPage.height);
  return `Strona po przycięciu: ${width} × ${height} mm (${Math.round(layout.scale * 100)}% projektu)`;
}

/** What to choose in the browser's print dialog for these settings. */
export function printReminders(settings: PrintSettings): string[] {
  const actualSize = 'W oknie drukowania ustaw skalę „Rzeczywisty rozmiar” (100%), nie „Dopasuj do strony”.';
  if (settings.duplex === 'manual') {
    return [
      actualSize,
      'Najpierw wydrukuj plik z przodami. Potem włóż wydrukowane kartki z powrotem do podajnika i wydrukuj plik z tyłami.',
    ];
  }
  const edge = settings.rotateBacks ? 'dłuższej' : 'krótszej';
  return [actualSize, `Druk dwustronny: wybierz „odwracanie po ${edge} krawędzi”.`];
}
```

- [ ] **Step 5: Replace `src/print/testPage.ts`**

The instruction lines move into `testPageInstructions()` unchanged, so the printed test page looks exactly as before.

```ts
import { sheetSides } from '../imposition/imposition';
import { createTextElement, createZine } from '../model/factory';
import { pageRect, PAGE_WIDTH, slotOfPage } from '../model/geometry';
import type { Zine } from '../model/types';

const SHEETS = 2;

/** How to read the printed test page; printed on its cover and shown under its download button. */
export function testPageInstructions(): string[] {
  const backs = sheetSides(SHEETS)
    .filter((s) => s.face === 'back')
    .map((s) => `${s.left} | ${s.right}`);
  return [
    'Złóż obie kartki na pół, kartka 2 w środku: strony mają iść od 1 do 8 i stać „↑ góra”.',
    '• Tył do góry nogami? Włącz „Obróć tyły o 180°”.',
    `• Na tyle kartki 1 mają być strony ${backs[0]}, na tyle kartki 2: ${backs[1]}. ` +
      'Przód i tył kartki pokazują różne numery kartki? Przełącz „tyły w odwrotnej kolejności”.',
    '• Coś ważnego ucięte przy krawędzi kartki? Zwiększ margines drukarki.',
  ];
}

/**
 * Two sheets (pages 1–8) with big page numbers, "↑ góra" and the sheet side, on light
 * grey pages so the bleed is visible. Two sheets, because with one a wrong back order
 * cannot show. Printed duplex and folded, it must read 1–8 the right way up.
 */
export function testPageZine(): Zine {
  const zine = createZine('Strona próbna', SHEETS);
  const sides = sheetSides(SHEETS);
  for (const side of sides) {
    const label = `kartka ${side.sheet + 1} · ${side.face === 'front' ? 'przód' : 'tył'}`;
    for (const page of [side.left, side.right]) {
      zine.pages[page] = { background: '#e6e6e6' };
      const slot = slotOfPage(page);
      const x = pageRect(slot.side, 0).x;
      zine.spreads[slot.spread].elements.push(
        createTextElement({ text: `${page}\n↑ góra`, size: 72, align: 'center', x, y: 45, width: PAGE_WIDTH, lineHeight: 1 }),
        createTextElement({ text: label, size: 16, align: 'center', x, y: 110, width: PAGE_WIDTH }),
      );
    }
  }
  zine.spreads[0].elements.push(
    createTextElement({
      text: testPageInstructions().join('\n'),
      size: 9,
      align: 'left',
      x: PAGE_WIDTH + 10,
      y: 135,
      width: PAGE_WIDTH - 20,
    }),
  );
  return zine;
}
```

- [ ] **Step 6: Run the tests again**

Run: `npx vitest run --project unit src/print/printTexts.test.ts src/print/testPage.test.ts && npx vitest run --project browser src/print/pdf.browser.test.ts`
Expected: PASS (3 + 4 tests in Node; the PDF browser tests still pass).

- [ ] **Step 7: Commit**

```bash
git add src/print/printTexts.ts src/print/printTexts.test.ts src/print/testPage.ts src/print/testPage.test.ts
git commit -m "Add print screen texts and share the test page instructions" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Opening a zine for the print and 3D screens

`openEditorSession` already waits for saves still in flight (`whenSavesSettled` from `src/editor/state/autosave.ts`) before loading: leaving a screen starts a save that is not awaited. The loading part (wait, parse, fonts, photos, without the font list of the text panel) becomes `openZineView`, which the print and 3D screens use and `openEditorSession` calls. `useZineView` wraps it for the read-only screens; `LoadFailed` is their "could not open" view; `screenHarness` renders a screen with a fresh test database.

**Files:**
- Modify: `src/editor/session.ts`, `src/editor/session.browser.test.ts`
- Create: `src/app/useZineView.ts`, `src/app/LoadFailed.tsx`, `src/test/screenHarness.tsx`

- [ ] **Step 1: Add failing tests to `src/editor/session.browser.test.ts`**

Change the import line `import { openEditorSession } from './session';` to:

```ts
import { openEditorSession, openZineView, ZineNotFoundError } from './session';
```

and append:

```ts

test('the print and 3D screens open a zine the same way: after running saves, photos loaded', async () => {
  const db = await openZiniarzDb(`test-${newId()}`);
  const zine = createZine('Lato', 1);
  await saveZine(db, zine);
  const saver = createAutosaver(
    async (z) => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      await saveZine(db, z);
    },
    { onError: () => {} },
  );
  saver.schedule({ ...zine, title: 'Lato 2026' });
  void saver.flush(); // leaving the editor: not awaited
  const view = await openZineView(db, zine.id);
  expect(view.zine.title).toBe('Lato 2026');
  expect(view.assets.images.size).toBe(0);
});

test('a missing zine is reported in Polish', async () => {
  const db = await openZiniarzDb(`test-${newId()}`);
  await expect(openZineView(db, 'nope')).rejects.toBeInstanceOf(ZineNotFoundError);
});
```

- [ ] **Step 2: Run it**

Run: `npx vitest run --project browser src/editor/session.browser.test.ts`
Expected: FAIL, the file does not load because `./session` has no export `openZineView` (so no test in it runs).

- [ ] **Step 3: Replace `src/editor/session.ts`**

```ts
import { loadFontChoices } from '../fonts/catalogue';
import type { FontChoice } from '../fonts/fontChoices';
import { ensureFontsReady, registerZineFonts } from '../fonts/fontLoader';
import { parseZine } from '../model/parse';
import type { Zine } from '../model/types';
import { loadRenderAssets, type RenderAssets } from '../render/assets';
import { getImage, loadZine, type ZiniarzDb } from '../storage/db';
import { whenSavesSettled } from './state/autosave';

export class ZineNotFoundError extends Error {
  constructor() {
    super('Nie znaleziono tego zina. Może został usunięty.');
    this.name = 'ZineNotFoundError';
  }
}

/** A zine ready to draw: parsed, fonts registered and loaded, photos decoded. */
export interface ZineView {
  zine: Zine;
  assets: RenderAssets;
}

export interface EditorSession extends ZineView {
  fonts: FontChoice[];
}

/**
 * Loads a zine for drawing (editor, print screen, 3D preview). Stored data goes through parseZine.
 * Waits for saves still running (editor → Druk → editor) so it never loads an older version.
 */
export async function openZineView(db: ZiniarzDb, zineId: string): Promise<ZineView> {
  await whenSavesSettled();
  const raw = await loadZine(db, zineId);
  if (!raw) throw new ZineNotFoundError();
  const zine = parseZine(raw);
  await registerZineFonts(db, zine);
  await ensureFontsReady(zine);
  const assets = await loadRenderAssets(zine, (id) => getImage(db, id));
  return { zine, assets };
}

/** Everything the editor needs before it shows a zine. */
export async function openEditorSession(db: ZiniarzDb, zineId: string): Promise<EditorSession> {
  const view = await openZineView(db, zineId);
  const fonts = await loadFontChoices(db, view.zine);
  return { ...view, fonts };
}
```

- [ ] **Step 4: Run the test again**

Run: `npx vitest run --project browser src/editor/session.browser.test.ts`
Expected: PASS (3 tests). (Commenting out `await whenSavesSettled();` makes the first two fail with the old title; put the line back.)

- [ ] **Step 5: Write `src/app/useZineView.ts`**

```ts
import { useEffect, useState } from 'react';
import { openZineView, type ZineView } from '../editor/session';
import { releaseRenderAssets } from '../render/assets';
import { useDb } from './dbContext';
import { errorMessage } from './notices';

export type ZineViewState =
  | { status: 'loading' }
  | { status: 'failed'; message: string }
  | ({ status: 'ready' } & ZineView);

/** Opens a zine for a read-only screen (print, 3D); its photos are released when the screen closes. */
export function useZineView(zineId: string): ZineViewState {
  const db = useDb();
  const [state, setState] = useState<ZineViewState>({ status: 'loading' });
  useEffect(() => {
    let cancelled = false;
    let opened: ZineView | null = null;
    setState({ status: 'loading' });
    openZineView(db, zineId).then(
      (view) => {
        opened = view;
        if (cancelled) releaseRenderAssets(view.assets);
        else setState({ status: 'ready', ...view });
      },
      (reason: unknown) => !cancelled && setState({ status: 'failed', message: errorMessage(reason) }),
    );
    return () => {
      cancelled = true;
      if (opened) releaseRenderAssets(opened.assets);
    };
  }, [db, zineId]);
  return state;
}
```

- [ ] **Step 6: Write `src/app/LoadFailed.tsx`**

```tsx
import { routeHash } from './route';

/** A screen whose zine could not be opened: the reason and a way back to the list. */
export function LoadFailed({ message }: { message: string }) {
  return (
    <main className="screen-message">
      <p>{message}</p>
      <a className="link-button" href={routeHash({ name: 'home' })}>
        Wróć do listy zinów
      </a>
    </main>
  );
}
```

- [ ] **Step 7: Write `src/test/screenHarness.tsx`**

```tsx
import type { ReactNode } from 'react';
import { render } from 'vitest-browser-react';
import { DbContext } from '../app/dbContext';
import { NoticeList } from '../app/NoticeList';
import { newId } from '../model/ids';
import type { Zine } from '../model/types';
import { loadZine, openZiniarzDb, saveZine, type ZiniarzDb } from '../storage/db';

/** Saves `zine` in a fresh test database and renders `element` (a screen) with it, plus notices. */
export async function openScreen(zine: Zine, element: ReactNode, prepare?: (db: ZiniarzDb) => Promise<void>) {
  const db = await openZiniarzDb(`test-${newId()}`);
  await saveZine(db, zine);
  await prepare?.(db);
  const screen = render(
    <DbContext.Provider value={db}>
      {element}
      <NoticeList />
    </DbContext.Provider>,
  );
  /** The zine as it is now in the database. */
  const stored = async () => (await loadZine(db, zine.id))!;
  return { db, screen, stored };
}
```

- [ ] **Step 8: Type check and run the editor tests**

Run: `npm run typecheck && npx vitest run --project browser src/editor/EditorScreen.browser.test.tsx`
Expected: no type errors; the editor screen tests still pass.

- [ ] **Step 9: Commit**

```bash
git add src/editor/session.ts src/editor/session.browser.test.ts src/app/useZineView.ts src/app/LoadFailed.tsx src/test/screenHarness.tsx
git commit -m "Open zines for viewing after pending saves settle" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Sheet preview

Every sheet, front and back, as it comes out of the printer, drawn with the real sheet renderer (`renderSheetSide` from `src/print/sheetSide.ts`) at 48 dpi. A side is drawn the first time it comes near the visible area, one side at a time; changing the layout options (margin, bleed, marks) redraws the sides already shown. Rotation is never applied in the preview (Decision 4).

**Files:**
- Create: `src/print/screen/SheetPreview.tsx`
- Test: `src/print/screen/SheetPreview.browser.test.tsx`

- [ ] **Step 1: Write the failing test `src/print/screen/SheetPreview.browser.test.tsx`**

```tsx
import { render } from 'vitest-browser-react';
import { expect, test } from 'vitest';
import { createZine } from '../../model/factory';
import { PREVIEW_DPI, SheetPreview } from './SheetPreview';

const assets = { images: new Map() };

test('shows every sheet; the first sheet is drawn front and back at preview size', async () => {
  const zine = createZine('Lato', 5);
  const screen = render(<SheetPreview zine={zine} assets={assets} settings={zine.print} />);
  for (let sheet = 1; sheet <= 5; sheet++) {
    await expect.element(screen.getByRole('heading', { name: `Kartka ${sheet}` })).toBeInTheDocument();
  }
  const front = screen.getByRole('img', { name: 'Kartka 1, przód: strony 20 i 1' });
  await expect.element(front).toBeVisible();
  await expect.element(screen.getByRole('img', { name: 'Kartka 1, tył: strony 2 i 19' })).toBeVisible();
  const image = front.element() as HTMLImageElement;
  await expect.poll(() => image.naturalWidth).toBe(Math.round((297 * PREVIEW_DPI) / 25.4));
  expect(image.src).toMatch(/^data:image\/jpeg/);
});

test('changing the layout settings redraws the sides', async () => {
  const zine = createZine('Lato', 1);
  const screen = render(<SheetPreview zine={zine} assets={assets} settings={zine.print} />);
  const front = screen.getByRole('img', { name: 'Kartka 1, przód: strony 4 i 1' });
  await expect.element(front).toBeVisible();
  const before = (front.element() as HTMLImageElement).src;
  screen.rerender(<SheetPreview zine={zine} assets={assets} settings={{ ...zine.print, cropMarks: false, foldMarks: false }} />);
  await expect.poll(() => (front.element() as HTMLImageElement).src).not.toBe(before);
});
```

- [ ] **Step 2: Run it**

Run: `npx vitest run --project browser src/print/screen/SheetPreview.browser.test.tsx`
Expected: FAIL, `./SheetPreview` cannot be resolved.

- [ ] **Step 3: Write `src/print/screen/SheetPreview.tsx`**

The sheet list is memoised on `zine.sheets` and the layout on its four inputs, so the effects of a side rerun only when what it draws changes (the screen keeps the zine object stable and changes only the settings).

```tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import type { SheetSide } from '../../imposition/imposition';
import { printLayout, type PrintLayout } from '../../imposition/layout';
import type { PrintSettings, Zine } from '../../model/types';
import type { RenderAssets } from '../../render/assets';
import { releaseCanvas } from '../../render/canvasBytes';
import { createRenderQueue, type RenderQueue } from '../../render/renderQueue';
import { previewSheets, sideCaption } from '../printTexts';
import { renderSheetSide } from '../sheetSide';

/** Resolution of the preview images: an A4 side is 561 × 397 px. */
export const PREVIEW_DPI = 48;

interface Props {
  zine: Zine;
  assets: RenderAssets;
  settings: PrintSettings;
}

/**
 * Every sheet, front and back, as it comes out of the printer (backs are never shown turned:
 * "Obróć tyły o 180°" only undoes the turn of a long-edge printer). Each side is drawn
 * in the background the first time it scrolls into view, one side at a time.
 */
export function SheetPreview({ zine, assets, settings }: Props) {
  const queue = useMemo(() => createRenderQueue(), []);
  useEffect(() => () => queue.clear(), [queue]);
  const { printerMargin, bleed, cropMarks, foldMarks } = settings;
  const layout = useMemo(
    () => printLayout({ printerMargin, bleed, cropMarks, foldMarks }),
    [printerMargin, bleed, cropMarks, foldMarks],
  );
  const sheets = useMemo(() => previewSheets(zine.sheets), [zine.sheets]);
  const common = { zine, assets, layout, cropMarks, foldMarks, queue };
  return (
    <ol className="sheet-preview">
      {sheets.map(({ sheet, front, back }) => (
        <li key={sheet}>
          <h3>Kartka {sheet + 1}</h3>
          <div className="sheet-pair">
            <SheetSideImage side={front} {...common} />
            <SheetSideImage side={back} {...common} />
          </div>
        </li>
      ))}
    </ol>
  );
}

interface SideProps {
  zine: Zine;
  assets: RenderAssets;
  side: SheetSide;
  layout: PrintLayout;
  cropMarks: boolean;
  foldMarks: boolean;
  queue: RenderQueue;
}

function SheetSideImage({ zine, assets, side, layout, cropMarks, foldMarks, queue }: SideProps) {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '300px' },
    );
    observer.observe(ref.current!);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    const cancel = queue.add(() => {
      const canvas = renderSheetSide(zine, side, assets, layout, {
        dpi: PREVIEW_DPI,
        cropMarks,
        foldMarks,
        rotate180: false,
      });
      const next = canvas.toDataURL('image/jpeg', 0.85);
      releaseCanvas(canvas);
      if (!cancelled) setUrl(next);
    });
    return () => {
      cancelled = true;
      cancel();
    };
  }, [visible, zine, assets, side, layout, cropMarks, foldMarks, queue]);

  const label = `Kartka ${side.sheet + 1}, ${sideCaption(side)}`;
  return (
    <figure ref={ref} className="sheet-side">
      {url ? <img src={url} alt={label} /> : <div className="sheet-placeholder" aria-hidden="true" />}
      <figcaption>{sideCaption(side)}</figcaption>
    </figure>
  );
}
```

- [ ] **Step 4: Run the test again**

Run: `npx vitest run --project browser src/print/screen/SheetPreview.browser.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/print/screen/SheetPreview.tsx src/print/screen/SheetPreview.browser.test.tsx
git commit -m "Preview printed sheets lazily at low resolution" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: The print screen

`#/zin/<id>/druk` gets the real screen: options on the left (printer margin, bleed, crop marks, fold mark, rotate backs, duplex auto/manual with „Tyły w odwrotnej kolejności”), the final trimmed page size, reminders, „Pobierz PDF do druku”, „Pobierz PDF stronami”, the test page with its instructions, progress, error with retry; the sheet preview on the right. Option changes are saved into `Zine.print` (Decision 2); the printer margin is also remembered in the browser. The zine object stays the same while settings change, so the preview redraws only for layout changes.

**Files:**
- Create: `src/print/screen/PrintOptions.tsx`, `src/print/screen/ExportStatusView.tsx`, `src/print/screen/PrintScreen.tsx`
- Modify: `src/App.tsx`, `src/App.browser.test.tsx`, `src/app/app.css`
- Test: `src/print/screen/PrintScreen.browser.test.tsx`

- [ ] **Step 1: Write the failing test `src/print/screen/PrintScreen.browser.test.tsx`**

```tsx
import { PDFDocument } from 'pdf-lib';
import { beforeEach, expect, test } from 'vitest';
import { createZine } from '../../model/factory';
import type { Zine } from '../../model/types';
import { openScreen } from '../../test/screenHarness';
import type { PdfExporter } from '../exporter';
import { EXPORT_FAILED } from '../exportRunner';
import { buildPagesPdf, buildSheetsPdf, type PdfFile } from '../pdf';
import { PRINTER_MARGIN_KEY } from '../printerMargin';
import { PrintScreen } from './PrintScreen';

beforeEach(() => localStorage.removeItem(PRINTER_MARGIN_KEY));

/** Real PDFs at low resolution (fast); saved files are collected instead of downloaded. */
function testExporter(overrides: Partial<PdfExporter> = {}) {
  const saved: PdfFile[] = [];
  const exporter: PdfExporter = {
    sheets: (job) => buildSheetsPdf({ ...job, dpi: 20 }),
    pages: (job) => buildPagesPdf({ ...job, dpi: 20 }),
    save: (file) => saved.push(file),
    ...overrides,
  };
  return { exporter, saved };
}

async function openPrint(zine: Zine, exporter: PdfExporter) {
  return openScreen(zine, <PrintScreen zineId={zine.id} exporter={exporter} />);
}

const pageCountOf = async (file: PdfFile) => (await PDFDocument.load(file.bytes)).getPageCount();

test('shows the sheets, the trimmed size, the reminders and a way back', async () => {
  const zine = createZine('Lato', 5);
  const { screen } = await openPrint(zine, testExporter().exporter);
  await expect.element(screen.getByRole('heading', { name: 'Druk: Lato' })).toBeVisible();
  await expect.element(screen.getByRole('link', { name: '← Wróć do edytora' })).toHaveAttribute('href', `#/zin/${zine.id}`);
  await expect.element(screen.getByRole('img', { name: 'Kartka 1, przód: strony 20 i 1' })).toBeVisible();
  await expect.element(screen.getByRole('heading', { name: 'Kartka 5' })).toBeInTheDocument();
  await expect.element(screen.getByText('Strona po przycięciu: 132 × 187 mm (89% projektu)')).toBeVisible();
  await expect.element(screen.getByText(/„Rzeczywisty rozmiar”/)).toBeVisible();
  await expect.element(screen.getByText(/„odwracanie po krótszej krawędzi”/)).toBeVisible();
});

test('options change the size and are saved in the zine; the printer margin is remembered in the browser', async () => {
  const zine = createZine('Lato', 2);
  const { screen, stored } = await openPrint(zine, testExporter().exporter);
  await screen.getByRole('checkbox', { name: 'Linie cięcia' }).click();
  await screen.getByRole('checkbox', { name: 'Linia zgięcia' }).click();
  await expect.element(screen.getByText('Strona po przycięciu: 138 × 196 mm (94% projektu)')).toBeVisible();
  await screen.getByRole('spinbutton', { name: 'Margines drukarki' }).fill('35');
  await expect.element(screen.getByText('Strona po przycięciu: 116 × 165 mm (79% projektu)')).toBeVisible();
  expect(localStorage.getItem(PRINTER_MARGIN_KEY)).toBe('20');
  await expect.poll(async () => (await stored()).print).toMatchObject({ cropMarks: false, foldMarks: false, printerMargin: 20 });

  // Another zine opened in this browser starts with the remembered margin.
  screen.unmount();
  const other = createZine('Zima', 1);
  const second = await openPrint(other, testExporter().exporter);
  await expect.element(second.screen.getByRole('spinbutton', { name: 'Margines drukarki' })).toHaveValue(20);
});

test('automatic duplex downloads one PDF with every sheet side', async () => {
  const zine = createZine('Lato', 5);
  const { exporter, saved } = testExporter();
  const { screen } = await openPrint(zine, exporter);
  await screen.getByRole('button', { name: 'Pobierz PDF do druku' }).click();
  await expect.element(screen.getByText('Pobrano: lato-druk.pdf')).toBeVisible();
  expect(saved.map((f) => f.name)).toEqual(['lato-druk.pdf']);
  expect(await pageCountOf(saved[0])).toBe(10);
});

test('manual duplex: backs reversed by default, two PDFs, a different reminder', async () => {
  const zine = createZine('Lato', 3);
  const { exporter, saved } = testExporter();
  const { screen, stored } = await openPrint(zine, exporter);
  await screen.getByRole('radio', { name: /ręcznie/ }).click();
  await expect.element(screen.getByRole('checkbox', { name: 'Tyły w odwrotnej kolejności' })).toBeChecked();
  await expect.element(screen.getByText(/wydrukuj plik z tyłami/)).toBeVisible();
  await screen.getByRole('button', { name: 'Pobierz PDF-y do druku (przody i tyły)' }).click();
  await expect.element(screen.getByText('Pobrano: lato-przody.pdf, lato-tyly.pdf')).toBeVisible();
  expect(await Promise.all(saved.map(pageCountOf))).toEqual([3, 3]);
  await expect.poll(async () => (await stored()).print.duplex).toBe('manual');
});

test('a failed export downloads nothing, says so and can be retried', async () => {
  const zine = createZine('Lato', 1);
  let attempts = 0;
  const { exporter, saved } = testExporter({
    sheets: async (job) => {
      attempts++;
      if (attempts === 1) {
        job.onProgress?.(1, 2);
        throw new Error('out of memory');
      }
      return buildSheetsPdf({ ...job, dpi: 20 });
    },
  });
  const { screen } = await openPrint(zine, exporter);
  await screen.getByRole('button', { name: 'Pobierz PDF do druku' }).click();
  await expect.element(screen.getByRole('alert')).toHaveTextContent(EXPORT_FAILED);
  expect(saved).toEqual([]);
  await screen.getByRole('button', { name: 'Spróbuj jeszcze raz' }).click();
  await expect.element(screen.getByText('Pobrano: lato-druk.pdf')).toBeVisible();
  expect(saved).toHaveLength(1);
});

test('the test page and the pages PDF', async () => {
  const zine = createZine('Lato', 2);
  const { exporter, saved } = testExporter();
  const { screen } = await openPrint(zine, exporter);
  await expect
    .element(screen.getByRole('list', { name: 'Jak sprawdzić stronę próbną' }))
    .toHaveTextContent('Tył do góry nogami? Włącz „Obróć tyły o 180°”.');
  await screen.getByRole('button', { name: 'Pobierz stronę próbną' }).click();
  await expect.element(screen.getByText('Pobrano: strona-probna-druk.pdf')).toBeVisible();
  expect(await pageCountOf(saved[0])).toBe(4);
  await screen.getByRole('button', { name: 'Pobierz PDF stronami' }).click();
  await expect.element(screen.getByText('Pobrano: lato-strony.pdf')).toBeVisible();
  expect(await pageCountOf(saved[1])).toBe(8);
});
```

- [ ] **Step 2: Run it**

Run: `npx vitest run --project browser src/print/screen/PrintScreen.browser.test.tsx`
Expected: FAIL, `./PrintScreen` cannot be resolved.

- [ ] **Step 3: Write `src/print/screen/PrintOptions.tsx`**

The margin field keeps what is typed while it has focus; every number typed is clamped by `clampPrinterMargin` (typing 35 gives 20).

```tsx
import { useState } from 'react';
import type { PrintSettings } from '../../model/types';
import { clampPrinterMargin, MAX_PRINTER_MARGIN } from '../printerMargin';

interface Props {
  settings: PrintSettings;
  onChange(patch: Partial<PrintSettings>): void;
}

const format = (mm: number) => String(mm);

export function PrintOptions({ settings, onChange }: Props) {
  // Kept as typed while the field has focus; only valid numbers are reported.
  const [marginDraft, setMarginDraft] = useState<string | null>(null);
  return (
    <section className="panel">
      <h2>Ustawienia druku</h2>
      <label className="field">
        <span>Margines drukarki</span>
        <span className="field-input">
          <input
            type="number"
            aria-label="Margines drukarki"
            min={0}
            max={MAX_PRINTER_MARGIN}
            step={0.5}
            value={marginDraft ?? format(settings.printerMargin)}
            onChange={(event) => {
              setMarginDraft(event.target.value);
              const value = Number(event.target.value);
              if (event.target.value !== '' && Number.isFinite(value)) onChange({ printerMargin: clampPrinterMargin(value) });
            }}
            onBlur={() => setMarginDraft(null)}
          />
          <span className="muted">mm</span>
        </span>
        <span className="muted">Pas przy krawędzi kartki, na którym drukarka nie drukuje. Zapamiętany w tej przeglądarce.</span>
      </label>
      <Toggle label="Spady" checked={settings.bleed} onChange={(bleed) => onChange({ bleed })} />
      <Toggle label="Linie cięcia" checked={settings.cropMarks} onChange={(cropMarks) => onChange({ cropMarks })} />
      <Toggle label="Linia zgięcia" checked={settings.foldMarks} onChange={(foldMarks) => onChange({ foldMarks })} />
      <Toggle
        label="Obróć tyły o 180°"
        hint="Dla drukarek, które odwracają kartkę tylko po dłuższej krawędzi."
        checked={settings.rotateBacks}
        onChange={(rotateBacks) => onChange({ rotateBacks })}
      />
      <fieldset className="panel-group">
        <legend>Druk dwustronny</legend>
        <label className="toggle">
          <input type="radio" name="duplex" checked={settings.duplex === 'auto'} onChange={() => onChange({ duplex: 'auto' })} />
          automatycznie (jeden PDF)
        </label>
        <label className="toggle">
          <input
            type="radio"
            name="duplex"
            checked={settings.duplex === 'manual'}
            onChange={() => onChange({ duplex: 'manual' })}
          />
          ręcznie (osobno przody i tyły)
        </label>
        {settings.duplex === 'manual' && (
          <Toggle
            label="Tyły w odwrotnej kolejności"
            hint="Zależy od tego, jak drukarka odkłada kartki. Sprawdzisz to na stronie próbnej."
            checked={settings.manualReverseBacks}
            onChange={(manualReverseBacks) => onChange({ manualReverseBacks })}
          />
        )}
      </fieldset>
    </section>
  );
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange(value: boolean): void }) {
  return (
    <div className="panel-group">
      <label className="toggle">
        <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
        {label}
      </label>
      {hint && <span className="muted">{hint}</span>}
    </div>
  );
}
```

- [ ] **Step 4: Write `src/print/screen/ExportStatusView.tsx`**

```tsx
import { EXPORT_FAILED, exportProgressText, type ExportStatus } from '../exportRunner';

export function ExportStatusView({ status, onRetry }: { status: ExportStatus; onRetry(): void }) {
  switch (status.kind) {
    case 'idle':
      return null;
    case 'running':
      return (
        <div className="export-status">
          <progress max={status.total || 1} value={status.done} aria-label="Postęp eksportu" />
          <span>{exportProgressText(status)}</span>
        </div>
      );
    case 'failed':
      return (
        <div className="export-status export-error" role="alert">
          <span>{EXPORT_FAILED}</span>
          <button type="button" onClick={onRetry}>
            Spróbuj jeszcze raz
          </button>
        </div>
      );
    case 'finished':
      return <p className="export-status muted">Pobrano: {status.files.join(', ')}</p>;
  }
}
```

- [ ] **Step 5: Write `src/print/screen/PrintScreen.tsx`**

Each download is an `ExportTask` closed over the settings at the moment of the click; „Spróbuj jeszcze raz” reruns the same task.

```tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { useDb } from '../../app/dbContext';
import { LoadFailed } from '../../app/LoadFailed';
import { errorMessage, notify } from '../../app/notices';
import { routeHash } from '../../app/route';
import { useZineView } from '../../app/useZineView';
import { createAutosaver } from '../../editor/state/autosave';
import { printLayout } from '../../imposition/layout';
import type { PrintSettings, Zine } from '../../model/types';
import type { RenderAssets } from '../../render/assets';
import { saveZine } from '../../storage/db';
import { browserPdfExporter, type PdfExporter } from '../exporter';
import { runExport, type ExportStatus, type ExportTask } from '../exportRunner';
import { loadPrinterMargin, printSettingsFor, savePrinterMargin } from '../printerMargin';
import { printReminders, trimSizeText } from '../printTexts';
import { testPageInstructions, testPageZine } from '../testPage';
import { ExportStatusView } from './ExportStatusView';
import { PrintOptions } from './PrintOptions';
import { SheetPreview } from './SheetPreview';

const NO_ASSETS: RenderAssets = { images: new Map() };

export function PrintScreen({ zineId, exporter = browserPdfExporter }: { zineId: string; exporter?: PdfExporter }) {
  const view = useZineView(zineId);
  if (view.status === 'loading') return <main className="screen-message">Otwieranie zina…</main>;
  if (view.status === 'failed') return <LoadFailed message={view.message} />;
  return <PrintWorkspace zine={view.zine} assets={view.assets} exporter={exporter} />;
}

interface WorkspaceProps {
  zine: Zine;
  assets: RenderAssets;
  exporter: PdfExporter;
}

function PrintWorkspace({ zine, assets, exporter }: WorkspaceProps) {
  const db = useDb();
  const [settings, setSettings] = useState(() => printSettingsFor(zine.print, loadPrinterMargin()));
  const [status, setStatus] = useState<ExportStatus>({ kind: 'idle' });
  const lastTask = useRef<ExportTask | null>(null);
  const layout = useMemo(() => printLayout(settings), [settings]);

  // The zine's content never changes here; only its print settings are saved (500 ms after a change, at once on leaving).
  const saver = useMemo(
    () => createAutosaver((next) => saveZine(db, next), { onError: (error) => notify(errorMessage(error)) }),
    [db],
  );
  useEffect(() => () => void saver.flush(), [saver]);

  const change = (patch: Partial<PrintSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    if (patch.printerMargin !== undefined) savePrinterMargin(patch.printerMargin);
    saver.schedule({ ...zine, print: next });
  };

  const run = (task: ExportTask) => {
    lastTask.current = task;
    void runExport(task, setStatus, (file) => exporter.save(file));
  };
  const busy = status.kind === 'running';
  const manual = settings.duplex === 'manual';

  return (
    <div className="print">
      <header className="screen-top">
        <a className="link-button" href={routeHash({ name: 'editor', zineId: zine.id })}>
          ← Wróć do edytora
        </a>
        <h1 className="editor-title">Druk: {zine.title}</h1>
        <a className="link-button" href={routeHash({ name: 'preview3d', zineId: zine.id })}>
          Podgląd 3D
        </a>
      </header>
      <aside className="print-side">
        <PrintOptions settings={settings} onChange={change} />
        <p className="print-size">{trimSizeText(layout)}</p>

        <section className="panel">
          <h2>Pobierz</h2>
          <ul className="reminders">
            {printReminders(settings).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <button
            type="button"
            className="primary"
            disabled={busy}
            onClick={() =>
              run({ label: 'PDF do druku', build: (onProgress) => exporter.sheets({ zine, assets, settings, onProgress }) })
            }
          >
            {manual ? 'Pobierz PDF-y do druku (przody i tyły)' : 'Pobierz PDF do druku'}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              run({
                label: 'PDF stronami',
                build: async (onProgress) => [await exporter.pages({ zine, assets, bleed: settings.bleed, onProgress })],
              })
            }
          >
            Pobierz PDF stronami
          </button>
          <span className="muted">Strony A5 po kolei, do przejrzenia albo wysłania.</span>
          <ExportStatusView status={status} onRetry={() => lastTask.current && run(lastTask.current)} />
        </section>

        <section className="panel">
          <h2>Strona próbna</h2>
          <span className="muted">
            Dwie kartki do sprawdzenia druku dwustronnego i marginesu drukarki, z bieżącymi ustawieniami.
          </span>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              run({
                label: 'Strona próbna',
                build: (onProgress) => exporter.sheets({ zine: testPageZine(), assets: NO_ASSETS, settings, onProgress }),
              })
            }
          >
            Pobierz stronę próbną
          </button>
          <ul className="test-page-help" aria-label="Jak sprawdzić stronę próbną">
            {testPageInstructions().map((line) => (
              <li key={line}>{line.replace(/^• /, '')}</li>
            ))}
          </ul>
        </section>
      </aside>
      <section className="print-preview" aria-label="Podgląd arkuszy">
        <SheetPreview zine={zine} assets={assets} settings={settings} />
      </section>
    </div>
  );
}
```

- [ ] **Step 6: Append the print screen styles to `src/app/app.css`**

`.screen-top` is the top bar shared with the 3D screen (Task 12); only the print grid places it in its `top` area.

```css

.print {
  display: grid;
  grid-template-columns: 360px minmax(0, 1fr);
  grid-template-rows: auto 1fr;
  grid-template-areas:
    'top top'
    'side preview';
  height: 100vh;
}

/* Top bar of the print and 3D screens. */
.screen-top {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--line);
  background: var(--paper);
}

.print > .screen-top {
  grid-area: top;
}

.screen-top > :last-child {
  margin-left: auto;
}

.print-side {
  grid-area: side;
  overflow-y: auto;
  padding: 12px;
  border-right: 1px solid var(--line);
  background: var(--paper);
}

.print-side fieldset {
  margin: 0;
  padding: 8px;
  border: 1px solid var(--line);
  border-radius: 6px;
}

.print-size {
  font-weight: 600;
}

.reminders,
.test-page-help {
  display: grid;
  gap: 6px;
  margin: 0;
  padding-left: 18px;
}

.export-status {
  display: grid;
  gap: 6px;
}

.export-status progress {
  width: 100%;
}

.export-error {
  padding: 8px;
  border-radius: 6px;
  background: #ffe5e7;
  color: var(--danger);
}

.print-preview {
  grid-area: preview;
  overflow-y: auto;
  padding: 16px 24px;
  background: var(--canvas);
}

.sheet-preview {
  display: grid;
  gap: 20px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.sheet-preview h3 {
  margin: 0 0 6px;
  font-size: 13px;
}

.sheet-pair {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.sheet-side {
  margin: 0;
}

.sheet-side img,
.sheet-placeholder {
  display: block;
  width: 100%;
  aspect-ratio: 297 / 210;
  background: var(--paper);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.sheet-side figcaption {
  margin-top: 4px;
  color: var(--muted);
  font-size: 12px;
}
```

- [ ] **Step 7: Route the print screen in `src/App.tsx`**

Add the import below the `HomeScreen` import:

```tsx
import { PrintScreen } from './print/screen/PrintScreen';
```

and replace the `print` case:

```tsx
    case 'print':
      return <PrintScreen key={route.zineId} zineId={route.zineId} />;
```

(The `preview3d` case keeps `PlaceholderScreen` until Task 12.)

- [ ] **Step 8: Update the print route test in `src/App.browser.test.tsx`**

Replace the test `'the print route shows a placeholder with a way back to the editor'` with:

```tsx
test('the print route opens the print screen, which reports a missing zine', async () => {
  window.location.hash = '#/zin/abc/druk';
  const screen = render(<App />);
  await expect.element(screen.getByText('Nie znaleziono tego zina. Może został usunięty.')).toBeVisible();
  await expect.element(screen.getByRole('link', { name: 'Wróć do listy zinów' })).toHaveAttribute('href', '#/');
});
```

- [ ] **Step 9: Run the tests**

Run: `npx vitest run --project browser src/print/screen src/App.browser.test.tsx`
Expected: PASS (6 print screen tests, 2 sheet preview tests, 3 app tests).

- [ ] **Step 10: Type check**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 11: Commit**

```bash
git add src/print/screen src/App.tsx src/App.browser.test.tsx src/app/app.css
git commit -m "Add the print screen" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Page turning model for the 3D preview

Pure state for the folded zine: which leaves are turned, the angle of each leaf at a given time (0 = lying on the right, π = turned to the left), the lift by paper thickness and the caption of the open spread. The three.js scene (Task 11) only draws what this module computes.

**Files:**
- Create: `src/preview3d/book.ts`
- Test: `src/preview3d/book.test.ts`

- [ ] **Step 1: Write the failing test `src/preview3d/book.test.ts`**

```ts
import { expect, test } from 'vitest';
import {
  closedBook,
  easeInOut,
  isTurning,
  leafAngle,
  leafCount,
  leafLift,
  leafPages,
  PAPER_MM,
  sheetOfLeaf,
  spreadCaption,
  TURN_MS,
  turnPage,
} from './book';

test('each sheet is two leaves, one on each side of the middle; every page is on one leaf', () => {
  expect(leafCount(5)).toBe(10);
  expect(leafPages(0)).toEqual({ front: 1, back: 2 });
  expect(leafPages(9)).toEqual({ front: 19, back: 20 });
  expect([0, 9].map((leaf) => sheetOfLeaf(leaf, 10))).toEqual([0, 0]);
  expect([4, 5].map((leaf) => sheetOfLeaf(leaf, 10))).toEqual([4, 4]);
  const pages = Array.from({ length: 10 }, (_, leaf) => leafPages(leaf)).flatMap((p) => [p.front, p.back]);
  expect(pages.sort((a, b) => a - b)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
});

test('the book opens on the cover, with every leaf lying on the right', () => {
  const book = closedBook(2);
  expect(book).toEqual({ leaves: 4, turned: 0, turns: [] });
  for (let leaf = 0; leaf < 4; leaf++) expect(leafAngle(book, leaf, 0)).toBe(0);
  expect(spreadCaption(book.turned, 2)).toBe('Okładka');
});

test('turning forward lifts the next leaf over the spine in 0.6 s', () => {
  const start = 1000;
  const book = turnPage(closedBook(2), true, start);
  expect(book.turned).toBe(1);
  expect(spreadCaption(book.turned, 2)).toBe('Strony 2–3');
  expect(leafAngle(book, 0, start)).toBe(0);
  expect(leafAngle(book, 0, start + TURN_MS / 2)).toBeCloseTo(Math.PI / 2);
  expect(leafAngle(book, 0, start + TURN_MS)).toBe(Math.PI);
  expect(leafAngle(book, 1, start + TURN_MS / 2)).toBe(0);
  expect(isTurning(book, start + TURN_MS / 2)).toBe(true);
  expect(isTurning(book, start + TURN_MS)).toBe(false);
});

test('turning back from the open spread brings the leaf back to the right', () => {
  let book = turnPage(closedBook(1), true, 0);
  book = turnPage(book, true, 1000);
  expect(spreadCaption(book.turned, 1)).toBe('Tył');
  book = turnPage(book, false, 5000);
  expect(book.turned).toBe(1);
  expect(leafAngle(book, 1, 5000)).toBe(Math.PI);
  expect(leafAngle(book, 1, 5000 + TURN_MS)).toBe(0);
});

test('nothing turns past the covers', () => {
  const closed = closedBook(1);
  expect(turnPage(closed, false, 0)).toBe(closed);
  const open = turnPage(turnPage(closed, true, 0), true, 0);
  expect(turnPage(open, true, 0)).toBe(open);
});

test('turning back mid-turn starts from where the leaf is, and old turns are dropped', () => {
  let book = turnPage(closedBook(2), true, 0);
  const mid = leafAngle(book, 0, TURN_MS / 2);
  book = turnPage(book, false, TURN_MS / 2);
  expect(book.turned).toBe(0);
  expect(leafAngle(book, 0, TURN_MS / 2)).toBeCloseTo(mid);
  expect(leafAngle(book, 0, TURN_MS * 2)).toBe(0);
  book = turnPage(book, true, 10_000);
  expect(book.turns).toHaveLength(1);
});

test('easing is smooth at both ends', () => {
  expect(easeInOut(0)).toBe(0);
  expect(easeInOut(0.5)).toBeCloseTo(0.5);
  expect(easeInOut(1)).toBe(1);
  expect(easeInOut(0.1)).toBeLessThan(0.1);
});

test('leaves stack by paper thickness: the top leaf is the next one to turn on each side', () => {
  const leaves = 4;
  // Right stack (not turned): leaf 0 on top.
  expect(leafLift(0, 0, leaves)).toBeCloseTo(3 * PAPER_MM);
  expect(leafLift(3, 0, leaves)).toBeCloseTo(0);
  // Left stack (turned): the last turned leaf on top.
  expect(leafLift(3, Math.PI, leaves)).toBeCloseTo(3 * PAPER_MM);
  expect(leafLift(0, Math.PI, leaves)).toBeCloseTo(0);
});
```

- [ ] **Step 2: Run it**

Run: `npx vitest run --project unit src/preview3d/book.test.ts`
Expected: FAIL, `./book` cannot be resolved.

- [ ] **Step 3: Write `src/preview3d/book.ts`**

`spreadLabel` (from `src/editor/spreadLabels.ts`) gives „Okładka”, „Tył” and „2–3”; the caption adds „Strony” to the numbers.

```ts
import { spreadLabel } from '../editor/spreadLabels';

/** Duration of one page turn. */
export const TURN_MS = 600;
/** Thickness of one leaf (half a sheet), mm: keeps stacked pages from fighting for the same depth. */
export const PAPER_MM = 0.15;

export interface Turn {
  leaf: number;
  /** Angles in radians: 0 = lying on the right, π = turned to the left. */
  from: number;
  to: number;
  startedAt: number;
}

/**
 * The folded zine as rigid leaves hinged at the spine. Leaf `j` carries page 2j + 1 on its
 * front and 2j + 2 on its back; the leaves j and leaves − 1 − j are the two halves of one sheet.
 * `turned` leaves lie on the left, so the reader sees spread `turned`.
 */
export interface BookState {
  leaves: number;
  turned: number;
  turns: Turn[];
}

export function leafCount(sheets: number): number {
  return 2 * sheets;
}

export function leafPages(leaf: number): { front: number; back: number } {
  return { front: 2 * leaf + 1, back: 2 * leaf + 2 };
}

/** Which sheet (0 = outermost) a leaf is half of. */
export function sheetOfLeaf(leaf: number, leaves: number): number {
  return Math.min(leaf, leaves - 1 - leaf);
}

export function closedBook(sheets: number): BookState {
  return { leaves: leafCount(sheets), turned: 0, turns: [] };
}

export function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}

function restingAngle(state: BookState, leaf: number): number {
  return leaf < state.turned ? Math.PI : 0;
}

export function leafAngle(state: BookState, leaf: number, now: number): number {
  const turn = state.turns.find((t) => t.leaf === leaf);
  if (!turn) return restingAngle(state, leaf);
  const progress = (now - turn.startedAt) / TURN_MS;
  if (progress >= 1) return turn.to;
  if (progress <= 0) return turn.from;
  return turn.from + (turn.to - turn.from) * easeInOut(progress);
}

/** True while a leaf is still moving (the scene keeps drawing frames until then). */
export function isTurning(state: BookState, now: number): boolean {
  return state.turns.some((t) => now - t.startedAt < TURN_MS);
}

/** Starts turning the next leaf forward or the last turned leaf back; at either cover nothing happens. */
export function turnPage(state: BookState, forward: boolean, now: number): BookState {
  if (forward ? state.turned >= state.leaves : state.turned <= 0) return state;
  const leaf = forward ? state.turned : state.turned - 1;
  const turn: Turn = { leaf, from: leafAngle(state, leaf, now), to: forward ? Math.PI : 0, startedAt: now };
  return {
    ...state,
    turned: state.turned + (forward ? 1 : -1),
    turns: [...state.turns.filter((t) => t.leaf !== leaf && now - t.startedAt < TURN_MS), turn],
  };
}

/** Height of a leaf above the cover plane: right stack has leaf 0 on top, left stack the last turned leaf. */
export function leafLift(leaf: number, angle: number, leaves: number): number {
  const right = (leaves - 1 - leaf) * PAPER_MM;
  const left = leaf * PAPER_MM;
  return right + (left - right) * (angle / Math.PI);
}

export function spreadCaption(spread: number, sheets: number): string {
  const label = spreadLabel(spread, sheets);
  return /^\d/.test(label) ? `Strony ${label}` : label;
}
```

- [ ] **Step 4: Run the test again**

Run: `npx vitest run --project unit src/preview3d/book.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/preview3d/book.ts src/preview3d/book.test.ts
git commit -m "Model page turning of the folded zine" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: 3D input and camera helpers

**Files:**
- Create: `src/preview3d/view.ts`
- Test: `src/preview3d/view.test.ts`

- [ ] **Step 1: Write the failing test `src/preview3d/view.test.ts`**

```ts
import { expect, test } from 'vitest';
import { clickTurnsForward, fitDistance, isClick, TEXTURE_HEIGHT_PX, texturePxPerMm, turnForKey } from './view';

test('a press and release in place is a click; a drag (orbiting) is not', () => {
  expect(isClick({ x: 100, y: 100 }, { x: 103, y: 98 })).toBe(true);
  expect(isClick({ x: 100, y: 100 }, { x: 130, y: 100 })).toBe(false);
});

test('a click on the right half turns forward, on the left half back', () => {
  expect(clickTurnsForward(700, 1000)).toBe(true);
  expect(clickTurnsForward(300, 1000)).toBe(false);
});

test('arrow keys turn pages, other keys do nothing', () => {
  expect(turnForKey('ArrowRight')).toBe(true);
  expect(turnForKey('ArrowLeft')).toBe(false);
  expect(turnForKey('a')).toBeNull();
});

test('the camera distance fits the open spread in a wide and in a tall window', () => {
  const fov = 35;
  const half = Math.tan(((fov / 2) * Math.PI) / 180);
  const wide = fitDistance(276, 196, fov, 2);
  expect((196 / 2) / (wide * half)).toBeLessThanOrEqual(1);
  expect((276 / 2) / (wide * half * 2)).toBeLessThanOrEqual(1);
  const tall = fitDistance(276, 196, fov, 0.5);
  expect((276 / 2) / (tall * half * 0.5)).toBeLessThanOrEqual(1);
  expect(tall).toBeGreaterThan(wide);
});

test('page textures are about 1024 px high', () => {
  expect(TEXTURE_HEIGHT_PX).toBe(1024);
  expect(210 * texturePxPerMm()).toBeCloseTo(1024);
});
```

- [ ] **Step 2: Run it**

Run: `npx vitest run --project unit src/preview3d/view.test.ts`
Expected: FAIL, `./view` cannot be resolved.

- [ ] **Step 3: Write `src/preview3d/view.ts`**

```ts
import { PAGE_HEIGHT } from '../model/geometry';

export const TEXTURE_HEIGHT_PX = 1024;
/** Pointer movement (px) under which a press and release counts as a click, not an orbit drag. */
export const CLICK_TOLERANCE_PX = 5;

export interface Point {
  x: number;
  y: number;
}

/** Resolution of page textures: a page without bleed is TEXTURE_HEIGHT_PX high. */
export function texturePxPerMm(): number {
  return TEXTURE_HEIGHT_PX / PAGE_HEIGHT;
}

export function isClick(down: Point, up: Point): boolean {
  return Math.hypot(up.x - down.x, up.y - down.y) <= CLICK_TOLERANCE_PX;
}

/** `x` from the left edge of the view of `width` px. */
export function clickTurnsForward(x: number, width: number): boolean {
  return x >= width / 2;
}

/** true = forward, false = back, null = not a page-turning key. */
export function turnForKey(key: string): boolean | null {
  if (key === 'ArrowRight') return true;
  if (key === 'ArrowLeft') return false;
  return null;
}

/** Camera distance at which a `width` × `height` object fills the view with some room around it. */
export function fitDistance(width: number, height: number, fovDeg: number, aspect: number, room = 1.15): number {
  const half = Math.tan(((fovDeg / 2) * Math.PI) / 180);
  return Math.max(height / 2 / half, width / 2 / (half * aspect)) * room;
}
```

- [ ] **Step 4: Run the test again**

Run: `npx vitest run --project unit src/preview3d/view.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/preview3d/view.ts src/preview3d/view.test.ts
git commit -m "Add 3D preview input and camera helpers" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: The three.js scene

The only module that imports `three`. Each leaf is a `THREE.Group` hinged at x = 0 (the spine): a front plane at x 0…w facing the viewer, a back plane built at x −w…0 and turned half round so it covers the same area facing away (its texture then reads the right way round once the leaf is turned), and an outline. The group is rotated by `−angle` around y, so a turning leaf lifts towards the viewer, and lifted by `leafLift` in z. Frames are drawn only on request (`invalidate`): after a camera change, a turn (until it ends), a new texture or a resize.

**Files:**
- Create: `src/preview3d/scene.ts`
- Test: `src/preview3d/scene.browser.test.ts`

- [ ] **Step 1: Write the failing test `src/preview3d/scene.browser.test.ts`**

The pictures are read right after `renderFrame` (the WebGL drawing buffer is cleared once the browser shows it). Page images are split in two colours, so a mirrored page would fail. `[217, 217, 222]` is the background `#d9d9de`.

```ts
import { afterEach, expect, test } from 'vitest';
import { expectColor, pixel } from '../test/pixels';
import { closedBook, turnPage, TURN_MS } from './book';
import { ZineScene } from './scene';

let scene: ZineScene | null = null;
let container: HTMLDivElement | null = null;

afterEach(() => {
  scene?.dispose();
  container?.remove();
  scene = null;
});

function pageImage(left: string, right: string): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 90;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = left;
  ctx.fillRect(0, 0, 32, 90);
  ctx.fillStyle = right;
  ctx.fillRect(32, 0, 32, 90);
  return canvas;
}

/** Copies the WebGL picture right after drawing it (the drawing buffer is cleared once shown). */
function snapshot(target: ZineScene, now: number): HTMLCanvasElement {
  target.renderFrame(now);
  const copy = document.createElement('canvas');
  copy.width = target.canvas.width;
  copy.height = target.canvas.height;
  copy.getContext('2d')!.drawImage(target.canvas, 0, 0);
  return copy;
}

function open(sheets: number): ZineScene {
  container = document.createElement('div');
  container.style.cssText = 'width: 600px; height: 400px';
  document.body.append(container);
  scene = new ZineScene(container, { pageWidth: 138, pageHeight: 196, book: closedBook(sheets) });
  return scene;
}

test('the closed zine shows the cover on the right of the spine, the right way round', () => {
  const view = open(1);
  view.setPageImage(1, pageImage('#ff0000', '#0000ff'));
  const shot = snapshot(view, 0);
  const { width, height } = shot;
  expectColor(pixel(shot, width * 0.6, height / 2), [255, 0, 0]); // left half of page 1
  expectColor(pixel(shot, width * 0.8, height / 2), [0, 0, 255]); // right half of page 1
  expectColor(pixel(shot, width * 0.2, height / 2), [217, 217, 222]); // only the background left of the spine
});

test('after a turn, pages 2 and 3 lie open, page 2 the right way round', () => {
  const view = open(1);
  view.setPageImage(2, pageImage('#00ff00', '#ff00ff'));
  view.setPageImage(3, pageImage('#ffff00', '#ffff00'));
  view.setBook(turnPage(closedBook(1), true, 0));
  const shot = snapshot(view, TURN_MS);
  const { width, height } = shot;
  expectColor(pixel(shot, width * 0.2, height / 2), [0, 255, 0]);
  expectColor(pixel(shot, width * 0.4, height / 2), [255, 0, 255]);
  expectColor(pixel(shot, width * 0.7, height / 2), [255, 255, 0]);
});
```

- [ ] **Step 2: Run it**

Run: `npx vitest run --project browser src/preview3d/scene.browser.test.ts`
Expected: FAIL, `./scene` cannot be resolved.

- [ ] **Step 3: Write `src/preview3d/scene.ts`**

```ts
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { releaseCanvas } from '../render/canvasBytes';
import { isTurning, leafAngle, leafLift, leafPages, type BookState } from './book';
import { fitDistance } from './view';

const FOV = 35;
const BACKGROUND = '#d9d9de';
/** Thin outline around each leaf, so white pages stay apart from each other. */
const EDGE_COLOR = '#b4b4ba';

export interface SceneOptions {
  /** Trimmed page size in mm. */
  pageWidth: number;
  pageHeight: number;
  book: BookState;
}

/**
 * The three.js side of the 3D preview, kept thin: leaves are hinged groups at the spine
 * (x = 0), each with the front page facing the viewer and the back page facing away.
 * Angles and stacking come from book.ts; this class only draws them. Frames are drawn only
 * when something changes (a turn, the camera, a new page image), not in an endless loop.
 */
export class ZineScene {
  readonly canvas: HTMLCanvasElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly controls: OrbitControls;
  private readonly leaves: THREE.Group[] = [];
  private readonly materials = new Map<number, THREE.MeshBasicMaterial>();
  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly edgeMaterial = new THREE.LineBasicMaterial({ color: EDGE_COLOR });
  private readonly resizeObserver: ResizeObserver;
  private book: BookState;
  private frame = 0;
  private disposed = false;

  constructor(
    private readonly container: HTMLElement,
    private readonly options: SceneOptions,
  ) {
    this.book = options.book;
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.canvas = this.renderer.domElement;
    container.append(this.canvas);
    this.scene.background = new THREE.Color(BACKGROUND);
    this.camera = new THREE.PerspectiveCamera(FOV, 1, 10, 20_000);
    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true;
    this.controls.enablePan = false;
    this.controls.rotateSpeed = 0.5;
    this.controls.addEventListener('change', () => this.invalidate());
    this.buildLeaves();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    this.resetCamera();
  }

  private material(page: number): THREE.MeshBasicMaterial {
    let material = this.materials.get(page);
    if (!material) {
      // Pushed back a little in depth, so the leaf outline drawn in the same plane stays visible.
      material = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        side: THREE.FrontSide,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1,
      });
      this.materials.set(page, material);
    }
    return material;
  }

  private buildLeaves(): void {
    const { pageWidth: w, pageHeight: h } = this.options;
    // Front: x 0…w facing +z. Back: drawn at x −w…0 and turned half round, so it lands on 0…w facing −z.
    const front = new THREE.PlaneGeometry(w, h).translate(w / 2, 0, 0);
    const back = new THREE.PlaneGeometry(w, h).translate(-w / 2, 0, 0);
    const edges = new THREE.EdgesGeometry(front);
    this.geometries.push(front, back, edges);
    for (let leaf = 0; leaf < this.book.leaves; leaf++) {
      const pages = leafPages(leaf);
      const group = new THREE.Group();
      group.add(new THREE.Mesh(front, this.material(pages.front)));
      const backMesh = new THREE.Mesh(back, this.material(pages.back));
      backMesh.rotation.y = Math.PI;
      group.add(backMesh);
      group.add(new THREE.LineSegments(edges, this.edgeMaterial));
      this.leaves.push(group);
      this.scene.add(group);
    }
    this.placeLeaves(performance.now());
  }

  private placeLeaves(now: number): void {
    this.leaves.forEach((group, leaf) => {
      const angle = leafAngle(this.book, leaf, now);
      group.rotation.y = -angle; // negative: the leaf lifts towards the viewer while it turns
      group.position.z = leafLift(leaf, angle, this.book.leaves);
    });
  }

  private resize(): void {
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(width, height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.invalidate();
  }

  /** Looks at the open spread from the front, slightly from above. */
  resetCamera(): void {
    const { pageWidth: w, pageHeight: h } = this.options;
    const distance = fitDistance(2 * w, h, FOV, this.camera.aspect);
    this.camera.position.set(0, 0.15 * distance, distance);
    this.controls.target.set(0, 0, 0);
    this.controls.minDistance = distance * 0.3;
    this.controls.maxDistance = distance * 3;
    this.controls.update();
  }

  setBook(book: BookState): void {
    this.book = book;
    this.invalidate();
  }

  /** Puts a rendered page on its leaf. The canvas is freed once the GPU has it. */
  setPageImage(page: number, image: HTMLCanvasElement): void {
    const texture = new THREE.CanvasTexture(image);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    texture.onUpdate = () => releaseCanvas(image);
    const material = this.material(page);
    material.map?.dispose();
    material.map = texture;
    material.needsUpdate = true;
    this.invalidate();
  }

  /** Draws one frame now; keeps drawing on the next frames while a leaf turns or the camera glides. */
  renderFrame(now = performance.now()): void {
    this.placeLeaves(now);
    const cameraMoving = this.controls.update();
    this.renderer.render(this.scene, this.camera);
    if (cameraMoving || isTurning(this.book, now)) this.invalidate();
  }

  /** Asks for a frame on the next animation frame (once, however often it is called). */
  invalidate(): void {
    if (this.frame || this.disposed) return;
    this.frame = requestAnimationFrame((now) => {
      this.frame = 0;
      this.renderFrame(now);
    });
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.resizeObserver.disconnect();
    this.controls.dispose();
    for (const material of this.materials.values()) {
      material.map?.dispose();
      material.dispose();
    }
    this.edgeMaterial.dispose();
    for (const geometry of this.geometries) geometry.dispose();
    this.renderer.dispose();
    this.canvas.remove();
  }
}
```

- [ ] **Step 4: Run the test again**

Run: `npx vitest run --project browser src/preview3d/scene.browser.test.ts`
Expected: PASS (2 tests), and no "Vite unexpectedly reloaded a test" warning (Task 1 pre-bundled `three`).

- [ ] **Step 5: Commit**

```bash
git add src/preview3d/scene.ts src/preview3d/scene.browser.test.ts
git commit -m "Draw the folded zine with three.js" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: The 3D preview screen

`#/zin/<id>/3d` gets the real screen. It opens on the cover, imports `./scene` dynamically (three.js stays out of the main bundle), draws page textures in the background with the render queue (`renderPage` without bleed at 1024 px page height), and turns pages by click (right/left half, a press without dragging), arrow keys or the two buttons. The page size is the trimmed page with the current print settings. The placeholder screen is no longer used and is deleted.

**Files:**
- Create: `src/preview3d/Preview3dScreen.tsx`
- Modify: `src/App.tsx`, `src/app/app.css`
- Delete: `src/app/PlaceholderScreen.tsx`
- Test: `src/preview3d/Preview3dScreen.browser.test.tsx`

- [ ] **Step 1: Write the failing test `src/preview3d/Preview3dScreen.browser.test.tsx`**

It imports `app.css` so the view has a real size. The first dynamic import of three.js can take seconds while the whole browser suite runs in parallel, hence the longer timeouts.

```tsx
import { userEvent } from '@vitest/browser/context';
import { expect, test } from 'vitest';
import '../app/app.css';
import { createZine } from '../model/factory';
import { openScreen } from '../test/screenHarness';
import { Preview3dScreen } from './Preview3dScreen';

// three.js is imported on demand; under a full parallel test run that first import can take seconds.
const SLOW = { timeout: 20_000 };

test('opens on the cover, draws every page and turns with keys, buttons and clicks', { timeout: 40_000 }, async () => {
  const zine = createZine('Lato', 2);
  zine.pages[1] = { background: '#ff0000' };
  const { screen } = await openScreen(zine, <Preview3dScreen zineId={zine.id} />);
  await expect.element(screen.getByRole('heading', { name: 'Podgląd 3D: Lato' })).toBeVisible();
  await expect.element(screen.getByText('Okładka')).toBeVisible();
  const view = screen.getByLabelText('Podgląd 3D zina');
  await expect.poll(() => view.element().querySelector('canvas'), SLOW).not.toBeNull();
  await expect.poll(() => document.body.textContent, SLOW).not.toMatch(/Rysowanie stron/);
  await expect.element(screen.getByRole('button', { name: '← Wstecz' })).toBeDisabled();

  await userEvent.keyboard('{ArrowRight}');
  await expect.element(screen.getByText('Strony 2–3')).toBeVisible();
  await screen.getByRole('button', { name: 'Dalej →' }).click();
  await expect.element(screen.getByText('Strony 4–5')).toBeVisible();

  const { width, height } = view.element().getBoundingClientRect();
  await view.click({ position: { x: width * 0.25, y: height / 2 } });
  await expect.element(screen.getByText('Strony 2–3')).toBeVisible();
  await view.click({ position: { x: width * 0.75, y: height / 2 } });
  await expect.element(screen.getByText('Strony 4–5')).toBeVisible();
  await userEvent.keyboard('{ArrowLeft}');
  await expect.element(screen.getByText('Strony 2–3')).toBeVisible();
  await expect
    .element(screen.getByRole('link', { name: '← Wróć do edytora' }))
    .toHaveAttribute('href', `#/zin/${zine.id}`);
});

test('a missing zine shows a message and a way back', async () => {
  const zine = createZine('Lato', 1);
  const { screen } = await openScreen(zine, <Preview3dScreen zineId="nope" />);
  await expect.element(screen.getByText('Nie znaleziono tego zina. Może został usunięty.')).toBeVisible();
});
```

- [ ] **Step 2: Run it**

Run: `npx vitest run --project browser src/preview3d/Preview3dScreen.browser.test.tsx`
Expected: FAIL, `./Preview3dScreen` cannot be resolved.

- [ ] **Step 3: Write `src/preview3d/Preview3dScreen.tsx`**

Only the type `ZineScene` is imported statically (`import type` is erased); the class comes from `import('./scene')`.

```tsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LoadFailed } from '../app/LoadFailed';
import { routeHash } from '../app/route';
import { useZineView } from '../app/useZineView';
import { printLayout } from '../imposition/layout';
import { pageCount } from '../model/geometry';
import type { Zine } from '../model/types';
import { loadPrinterMargin, printSettingsFor } from '../print/printerMargin';
import type { RenderAssets } from '../render/assets';
import { renderPage } from '../render/renderPage';
import { createRenderQueue } from '../render/renderQueue';
import { closedBook, spreadCaption, turnPage, type BookState } from './book';
import type { ZineScene } from './scene';
import { clickTurnsForward, isClick, texturePxPerMm, turnForKey, type Point } from './view';

export function Preview3dScreen({ zineId }: { zineId: string }) {
  const view = useZineView(zineId);
  if (view.status === 'loading') return <main className="screen-message">Otwieranie zina…</main>;
  if (view.status === 'failed') return <LoadFailed message={view.message} />;
  return <PreviewWorkspace zine={view.zine} assets={view.assets} />;
}

function PreviewWorkspace({ zine, assets }: { zine: Zine; assets: RenderAssets }) {
  const container = useRef<HTMLDivElement>(null);
  const scene = useRef<ZineScene | null>(null);
  const book = useRef<BookState>(closedBook(zine.sheets));
  const pointerDown = useRef<Point | null>(null);
  const [spread, setSpread] = useState(0);
  const [drawn, setDrawn] = useState(0);
  const [failed, setFailed] = useState(false);
  const pages = pageCount(zine.sheets);
  // Page size as trimmed with the current print settings (printer margin remembered in this browser).
  const trimPage = useMemo(() => printLayout(printSettingsFor(zine.print, loadPrinterMargin())).trimPage, [zine]);

  useEffect(() => {
    let disposed = false;
    const queue = createRenderQueue();
    setDrawn(0);
    // three.js is loaded only when the preview opens, so the rest of the app stays small.
    import('./scene')
      .then(({ ZineScene }) => {
        if (disposed) return;
        const view = new ZineScene(container.current!, {
          pageWidth: trimPage.width,
          pageHeight: trimPage.height,
          book: book.current,
        });
        scene.current = view;
        for (let page = 1; page <= pages; page++) {
          queue.add(() => {
            if (disposed) return;
            view.setPageImage(page, renderPage(zine, page, assets, { pxPerMm: texturePxPerMm(), bleed: false }));
            setDrawn((count) => count + 1);
          });
        }
      })
      .catch(() => !disposed && setFailed(true));
    return () => {
      disposed = true;
      queue.clear();
      scene.current?.dispose();
      scene.current = null;
    };
  }, [zine, assets, pages, trimPage]);

  const turn = useCallback((forward: boolean) => {
    const next = turnPage(book.current, forward, performance.now());
    if (next === book.current) return;
    book.current = next;
    scene.current?.setBook(next);
    setSpread(next.turned);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const forward = turnForKey(event.key);
      if (forward === null) return;
      event.preventDefault();
      turn(forward);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [turn]);

  const leaves = 2 * zine.sheets;
  return (
    <div className="preview3d">
      <header className="screen-top">
        <a className="link-button" href={routeHash({ name: 'editor', zineId: zine.id })}>
          ← Wróć do edytora
        </a>
        <h1 className="editor-title">Podgląd 3D: {zine.title}</h1>
        <div className="toolbar">
          <button type="button" onClick={() => turn(false)} disabled={spread === 0}>
            ← Wstecz
          </button>
          <span className="preview-caption" aria-live="polite">
            {spreadCaption(spread, zine.sheets)}
          </span>
          <button type="button" onClick={() => turn(true)} disabled={spread === leaves}>
            Dalej →
          </button>
        </div>
        <a className="link-button" href={routeHash({ name: 'print', zineId: zine.id })}>
          Druk
        </a>
      </header>
      {failed ? (
        <p className="screen-message">Ta przeglądarka nie umie pokazać podglądu 3D. Spróbuj w aktualnym Chrome, Safari albo Firefoksie.</p>
      ) : (
        <div
          ref={container}
          className="preview3d-view"
          aria-label="Podgląd 3D zina"
          onPointerDown={(event) => (pointerDown.current = { x: event.clientX, y: event.clientY })}
          onPointerUp={(event) => {
            const down = pointerDown.current;
            pointerDown.current = null;
            if (!down || !isClick(down, { x: event.clientX, y: event.clientY })) return;
            const rect = event.currentTarget.getBoundingClientRect();
            turn(clickTurnsForward(event.clientX - rect.left, rect.width));
          }}
        />
      )}
      <p className="preview3d-help muted">
        {drawn < pages ? `Rysowanie stron: ${drawn} z ${pages}. ` : ''}
        Przeciągnij, żeby obrócić, kółkiem przybliż. Klik w prawą połowę albo strzałka w prawo przewraca dalej, w lewą
        albo strzałka w lewo wstecz.
      </p>
    </div>
  );
}
```

- [ ] **Step 4: Append the 3D styles to `src/app/app.css`**

```css

.preview3d {
  display: grid;
  grid-template-rows: auto 1fr auto;
  height: 100vh;
}

.preview3d-view {
  position: relative;
  min-height: 0;
  overflow: hidden;
  background: var(--canvas);
  cursor: grab;
}

.preview3d-view canvas {
  position: absolute;
  inset: 0;
  display: block;
}

.preview-caption {
  min-width: 96px;
  text-align: center;
  font-weight: 600;
}

.preview3d-help {
  margin: 0;
  padding: 8px 12px;
  border-top: 1px solid var(--line);
  background: var(--paper);
}
```

- [ ] **Step 5: Replace `src/App.tsx` and delete the placeholder**

```tsx
import { useEffect, useState } from 'react';
import { ConfirmHost } from './app/ConfirmHost';
import { DbContext } from './app/dbContext';
import { NoticeList } from './app/NoticeList';
import type { Route } from './app/route';
import { useRoute } from './app/useRoute';
import { EditorScreen } from './editor/EditorScreen';
import { HomeScreen } from './home/HomeScreen';
import { Preview3dScreen } from './preview3d/Preview3dScreen';
import { PrintScreen } from './print/screen/PrintScreen';
import { openZiniarzDb, type ZiniarzDb } from './storage/db';
import { requestPersistentStorage } from './storage/quota';

function Screen({ route }: { route: Route }) {
  switch (route.name) {
    case 'home':
      return <HomeScreen />;
    case 'editor':
      return <EditorScreen key={route.zineId} zineId={route.zineId} />;
    case 'print':
      return <PrintScreen key={route.zineId} zineId={route.zineId} />;
    case 'preview3d':
      return <Preview3dScreen key={route.zineId} zineId={route.zineId} />;
  }
}

export function App() {
  const route = useRoute();
  const [db, setDb] = useState<ZiniarzDb | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    openZiniarzDb().then(setDb, () => setFailed(true));
    void requestPersistentStorage();
  }, []);

  if (failed) {
    return (
      <main className="screen-message">
        Ta przeglądarka nie pozwala zapisywać zinów. Wyłącz tryb prywatny albo użyj innej przeglądarki.
      </main>
    );
  }
  if (!db) return <main className="screen-message">Wczytywanie…</main>;
  return (
    <DbContext.Provider value={db}>
      <Screen route={route} />
      <NoticeList />
      <ConfirmHost />
    </DbContext.Provider>
  );
}
```

```bash
git rm src/app/PlaceholderScreen.tsx
```

- [ ] **Step 6: Run the tests**

Run: `npx vitest run --project browser src/preview3d src/App.browser.test.tsx`
Expected: PASS (2 scene tests, 2 screen tests, 3 app tests).

- [ ] **Step 7: Check that three.js is a separate chunk**

Run: `npm run build && npm run check:dist && grep -l WebGLRenderer dist/assets/*.js`
Expected: the build succeeds (the usual warning about the main chunk over 500 kB is expected), it lists `dist/assets/scene-<hash>.js` of about 540 kB, `check:dist` reports `check:dist OK` (the new lazy chunk is loaded by a relative URL), and `grep` prints only that `scene-*.js` file, not `index-*.js`.

- [ ] **Step 8: Commit**

```bash
git add src/preview3d/Preview3dScreen.tsx src/preview3d/Preview3dScreen.browser.test.tsx src/App.tsx src/app/app.css
git commit -m "Add the 3D preview screen, loading three.js on demand" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Playwright end-to-end test

Spec, Testy: „nowy zin 5 kartek, dodanie zdjęcia i napisu, eksport PDF; sprawdzenie, że PDF ma 10 stron A4.” It runs against the production build (`vite build` + `vite preview`), with `npm run test:e2e`, and stays out of `npm test` (Vitest only collects `src/**`).

**Files:**
- Create: `playwright.config.ts`, `e2e/print.spec.ts`
- Modify: `package.json` (script), `tsconfig.json` (type-check the new files)

- [ ] **Step 1: Write `playwright.config.ts`**

```ts
import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

/** End-to-end tests against the production build (`npm run test:e2e`). Kept out of `npm test`. */
export default defineConfig({
  testDir: 'e2e',
  outputDir: 'test-output/e2e',
  timeout: 120_000,
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${PORT}/`,
    ...devices['Desktop Chrome'],
    viewport: { width: 1280, height: 900 },
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
  },
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
```

- [ ] **Step 2: Write `e2e/print.spec.ts`**

The labels and headings are the app's own: „Tytuł”, „Kartki”, „Nowy zin” (zine list), „Wybierz zdjęcia” (hidden file input of „+ Zdjęcie”), the panel headings „Zdjęcie” and „Napis” (the new photo and the new text are selected), „Druk” and „Podgląd 3D” (editor top bar).

```ts
import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';

/** A 600 × 400 PNG drawn in the page, so the test needs no image file. */
async function photoPng(page: import('@playwright/test').Page): Promise<Buffer> {
  const dataUrl = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 400;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#3366cc';
    ctx.fillRect(0, 0, 600, 400);
    ctx.fillStyle = '#ffcc00';
    ctx.fillRect(150, 100, 300, 200);
    return canvas.toDataURL('image/png');
  });
  return Buffer.from(dataUrl.split(',')[1], 'base64');
}

test('a new 5-sheet zine with a photo and a text prints as 10 landscape A4 pages', async ({ page }) => {
  await page.goto('./');
  await page.getByLabel('Tytuł').fill('Lato');
  await page.getByLabel('Kartki').fill('5');
  await page.getByRole('button', { name: 'Nowy zin' }).click();
  await expect(page.getByRole('heading', { name: 'Lato' })).toBeVisible();

  await page.getByLabel('Wybierz zdjęcia').setInputFiles({ name: 'zdjecie.png', mimeType: 'image/png', buffer: await photoPng(page) });
  await expect(page.getByRole('heading', { name: 'Zdjęcie' })).toBeVisible();

  await page.getByRole('button', { name: '+ Napis' }).click();
  await page.keyboard.type('Cześć, lato!');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: 'Napis' })).toBeVisible();

  await page.getByRole('link', { name: 'Druk' }).click();
  await expect(page.getByRole('heading', { name: 'Druk: Lato' })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Kartka 1, przód: strony 20 i 1' })).toBeVisible();

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Pobierz PDF do druku' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('lato-druk.pdf');

  const pdf = await PDFDocument.load(await readFile(await file.path()));
  expect(pdf.getPageCount()).toBe(10);
  for (const pdfPage of pdf.getPages()) {
    const { width, height } = pdfPage.getSize();
    expect(width).toBeCloseTo(841.89, 1);
    expect(height).toBeCloseTo(595.28, 1);
  }
});

test('the 3D preview loads three.js on demand and turns pages', async ({ page }) => {
  await page.goto('./');
  await page.getByLabel('Tytuł').fill('Zima');
  await page.getByLabel('Kartki').fill('2');
  await page.getByRole('button', { name: 'Nowy zin' }).click();
  await page.getByRole('link', { name: 'Podgląd 3D' }).click();
  await expect(page.getByRole('heading', { name: 'Podgląd 3D: Zima' })).toBeVisible();
  await expect(page.getByLabel('Podgląd 3D zina').locator('canvas')).toBeVisible();
  await expect(page.getByText('Okładka')).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByText('Strony 2–3')).toBeVisible();
});
```

- [ ] **Step 3: Add the script to `package.json`**

In `"scripts"`, after `"test:browser"`, add:

```json
    "test:e2e": "playwright test"
```

(with a comma after the `test:browser` line).

- [ ] **Step 4: Type-check the new files**

In `tsconfig.json`, replace `"include": ["src", "vite.config.ts"]` with:

```json
  "include": ["src", "e2e", "vite.config.ts", "playwright.config.ts"]
```

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 5: Run the end-to-end tests**

Run: `npm run test:e2e`
Expected: the web server builds the app (chunk-size warning is fine), then `2 passed` — the 5-sheet print test (a few seconds: ten 300 dpi sheets) and the 3D preview test.

- [ ] **Step 6: Check `npm test` does not pick them up**

Run: `npx vitest list 2>/dev/null | grep -c e2e/`
Expected: `0`.

- [ ] **Step 7: Commit**

```bash
git add playwright.config.ts e2e/print.spec.ts package.json tsconfig.json
git commit -m "Add the Playwright end-to-end test" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: Project docs and final check

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Edit `CLAUDE.md`**

Make these edits; everything else in the file stays as it is (another plan may have added its own lines in between, e.g. deployment notes — keep them). Each "find" text is a whole line or block of the current file.

1. After the line:

````markdown
npm test
````

insert:

````markdown
npm run test:e2e
````

2. Find:

````markdown
- `npm run test:unit`: czysta logika w Node. `npm run test:browser`: render, fonty, PDF i komponenty React w Chromium (Vitest browser mode, okno 1280×900).
````

Replace with:

````markdown
- `npm run test:unit`: czysta logika w Node. `npm run test:browser`: render, fonty, PDF, WebGL i komponenty React w Chromium (Vitest browser mode, okno 1280×900).
- `npm run test:e2e`: Playwright (`e2e/`, `playwright.config.ts`) na zbudowanej apce (`vite build` + `vite preview` na porcie 4173): nowy zin 5 kartek, zdjęcie, napis, PDF do druku ma 10 stron A4 poziomo; podgląd 3D. Nie wchodzi do `npm test`.
````

3. Find:

````markdown
| `src/App.tsx`, `src/app/` | Ekrany według adresu (`route.ts`: `#/`, `#/zin/<id>`, `#/zin/<id>/druk`, `#/zin/<id>/3d`), baza w kontekście (`dbContext.ts`), komunikaty (`notices.ts`, `NoticeList.tsx`), pytania „na pewno?” (`confirm.ts`, `ConfirmHost.tsx`), odmiana liczebników (`plural.ts`), style (`app.css`). |
````

Replace with:

````markdown
| `src/App.tsx`, `src/app/` | Ekrany według adresu (`route.ts`: `#/`, `#/zin/<id>`, `#/zin/<id>/druk`, `#/zin/<id>/3d`), baza w kontekście (`dbContext.ts`), zin do oglądania na ekranach druku i 3D (`useZineView.ts`, błąd otwarcia `LoadFailed.tsx`), komunikaty (`notices.ts`, `NoticeList.tsx`), pytania „na pewno?” (`confirm.ts`, `ConfirmHost.tsx`), odmiana liczebników (`plural.ts`), style (`app.css`). |
````

4. Find:

````markdown
| `src/editor/` (reszta) | Ekran edytora (`EditorScreen.tsx`, `EditorContext.ts`, `session.ts`), pasek u góry (`TopBar.tsx`, `InsertButtons.tsx`), miniatury rozkładówek i „± kartka” (`SpreadList.tsx`, `useSpreadThumbnails.ts`, `spreadLabels.ts`), wstawianie (`insert.ts`), skróty (`keyboard.ts`, `useEditorKeyboard.ts`), kolory (`colors.ts`). |
````

Replace with:

````markdown
| `src/editor/` (reszta) | Ekran edytora (`EditorScreen.tsx`, `EditorContext.ts`), otwieranie zina do rysowania (`session.ts`: `openZineView`, `openEditorSession`), pasek u góry (`TopBar.tsx`, `InsertButtons.tsx`), miniatury rozkładówek i „± kartka” (`SpreadList.tsx`, `useSpreadThumbnails.ts`, `spreadLabels.ts`), wstawianie (`insert.ts`), skróty (`keyboard.ts`, `useEditorKeyboard.ts`), kolory (`colors.ts`). |
````

5. Find:

````markdown
| `src/render/` | Jedyny rysownik (Konva): rozkładówka w mm (`buildSpread.ts`), prowadnice i wyszarzenie brakującej strony (`guides.ts`), wczytywanie zdjęć do rysowania (`assets.ts`, pomija uszkodzone), geometria zdjęcia (`photoGeometry.ts`), strona i rozkładówka do canvasu (`renderPage.ts`). |
| `src/print/` | Strona arkusza (`sheetSide.ts`), PDF arkuszy i stron (`pdf.ts`), grupowanie stron do druku (`printGroups.ts`), nazwy plików (`fileName.ts`), strona próbna (`testPage.ts`). |
| `src/test/` | Pomocniki testów: piksele, sztuczny plik TTF (`sfnt.ts`), płótno edytora (`stageHarness.ts`), cały edytor (`editorHarness.tsx`), panel (`panelHarness.tsx`), wybór plików (`files.ts`). |
````

Replace with:

````markdown
| `src/render/` | Jedyny rysownik (Konva): rozkładówka w mm (`buildSpread.ts`), prowadnice i wyszarzenie brakującej strony (`guides.ts`), wczytywanie zdjęć do rysowania (`assets.ts`, pomija uszkodzone), geometria zdjęcia (`photoGeometry.ts`), strona i rozkładówka do canvasu (`renderPage.ts`), kolejka rysowania w tle (`renderQueue.ts`). |
| `src/print/` | Strona arkusza (`sheetSide.ts`), PDF arkuszy i stron (`pdf.ts`), grupowanie stron do druku (`printGroups.ts`), nazwy plików (`fileName.ts`), strona próbna i jej instrukcja (`testPage.ts`), margines drukarki zapamiętany w przeglądarce (`printerMargin.ts`), teksty ekranu druku (`printTexts.ts`), pobieranie PDF z postępem i błędem (`exportRunner.ts`, `exporter.ts`). |
| `src/print/screen/` | Ekran druku: `PrintScreen.tsx` (układ, zapis ustawień, pobieranie), `PrintOptions.tsx` (opcje), `SheetPreview.tsx` (podgląd arkuszy), `ExportStatusView.tsx` (pasek postępu, błąd z ponowieniem). |
| `src/preview3d/` | Podgląd 3D: kartkowanie i ułożenie kartek (`book.ts`), klik, klawisze, kamera, rozdzielczość tekstur (`view.ts`) — czysta logika z testami w Node; scena three.js (`scene.ts`) i ekran (`Preview3dScreen.tsx`). |
| `src/test/` | Pomocniki testów: piksele, sztuczny plik TTF (`sfnt.ts`), płótno edytora (`stageHarness.ts`), cały edytor (`editorHarness.tsx`), ekrany druku i 3D (`screenHarness.tsx`), panel (`panelHarness.tsx`), wybór plików (`files.ts`), sprawdzenie WebGL (`webgl.browser.test.ts`). |
| `e2e/` | Test end-to-end Playwright (`print.spec.ts`). |
````

6. After the line:

````markdown
- **Eksport rysuje arkusze po jednym** i zwalnia canvas (`releaseCanvas`); `drawToCanvas` wymusza `Konva.pixelRatio = 1`.
````

insert:

````markdown
- **Margines drukarki** należy do drukarki, nie do zina: `localStorage` (`ziniarz.printerMargin`), 0–20 mm co 0,5 mm (`clampPrinterMargin`, przy 20 mm skala nadal > 0,5). Druk i 3D biorą ustawienia z `printSettingsFor(zine.print, loadPrinterMargin())`: zapamiętany margines wygrywa, `Zine.print.printerMargin` to zapas (np. plik `.zin` z innego komputera) i też się aktualizuje. Pozostałe opcje druku zapisuje do `Zine.print` ekran druku (autozapis jak w edytorze), poza sklepem edytora i historią cofania.
- **Ekrany druku i 3D tylko oglądają zina:** otwierają go przez `openZineView` (czeka na `whenSavesSettled()`, potem `parseZine`, fonty, zdjęcia) i nie zmieniają jego treści.
- **Pobieranie PDF:** `runExport` buduje wszystkie pliki, zanim cokolwiek pobierze; błąd = komunikat `EXPORT_FAILED` z „Spróbuj jeszcze raz”, nic nie zostaje pobrane. Ekran druku dostaje `PdfExporter` (testy podają szybszy albo psujący się).
- **Podgląd arkuszy** rysuje stronę arkusza dopiero, gdy wjedzie w widok (`IntersectionObserver`), po jednej (`createRenderQueue`), w 48 dpi. Tyły pokazuje zawsze nieobrócone (tak wychodzą z drukarki).
- **3D:** three.js ładuje się tylko przez `import('./scene')` w `Preview3dScreen`; nie importuj `three` nigdzie poza `src/preview3d/scene.ts`, bo trafi do głównego pakietu. Kartkowanie, kąty, grubość papieru, klik i klawisze liczą `book.ts` i `view.ts` (testy w Node); `ZineScene` tylko rysuje i rysuje klatkę na żądanie (`invalidate`), nie w pętli. Tekstury stron z `renderPage` bez spadu, 1024 px wysokości, liczone w tle po otwarciu; canvas zwalniany po wysłaniu do GPU.
- **WebGL w testach:** Chromium bez ekranu rysuje przez SwiftShader; flagi `--use-angle=swiftshader --enable-unsafe-swiftshader` są w `vite.config.ts` i `playwright.config.ts`. Obraz WebGL czytaj zaraz po `renderFrame` (później bufor jest pusty).
````

Then check: `git diff CLAUDE.md` shows only these changes, all in Polish.

- [ ] **Step 2: Run all unit and browser tests**

Run: `npm test`
Expected: all test files pass (plans 1–3), no "Vite unexpectedly reloaded a test" warning. If such a warning names a library, add it to `optimizeDeps.include` in `vite.config.ts` and run again.

- [ ] **Step 3: Type check and build**

Run: `npm run typecheck && npm run build && npm run check:dist`
Expected: no type errors; the build succeeds with a separate `scene-*.js` chunk; `check:dist OK` (the CI workflow runs the same check).

- [ ] **Step 4: Run the end-to-end tests**

Run: `npm run test:e2e`
Expected: `2 passed`.

- [ ] **Step 5: Look at the app once**

Run: `npm run dev`, open the printed URL, create a zine with 2 sheets, add a text on the cover, click „Druk”: both sheets show front and back with crop and fold marks, „Strona po przycięciu: 132 × 187 mm (89% projektu)”; untick „Linie cięcia” and „Linia zgięcia” (the size becomes 138 × 196 mm and the marks disappear), set the printer margin to 6, click „Pobierz PDF do druku” (progress bar, then one PDF); click „Podgląd 3D”: the cover shows the text, a click on the right half turns the page in about half a second, dragging orbits, the wheel zooms, ArrowLeft goes back. Stop the dev server.

- [ ] **Step 6: Commit**

```bash
git add CLAUDE.md
git commit -m "Document print, 3D and end-to-end tests in CLAUDE.md" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
