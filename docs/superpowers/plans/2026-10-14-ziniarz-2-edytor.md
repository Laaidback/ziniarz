# ZINIARZ, plan 2: edytor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the editor of ZINIARZ: the zine list (create, open, duplicate, delete, `.zin` files, cleanup), and the spread editor with photos, texts, built-in and uploaded fonts, guides, snapping, layers, shortcuts, undo/redo and autosave.

**Architecture:** Pure logic (history, zine commands, layers, clipboard, placement, snapping, colours, shortcuts, font-name reading, the Zustand store) lives in small modules tested in Node. The editor canvas is a plain-Konva class (`EditorStage`) that draws the spread with the existing single renderer (`buildSpreadGroup`) and adds guides, selection, snapping and pointer handling; React components stay thin and talk to one vanilla Zustand store per open zine. Hash routes pick the screen (list, editor, and placeholders for print and 3D that plan 3 fills).

**Tech Stack:** Vite 7, React 19, TypeScript 5.9 (strict), Konva 9 (plain, no react-konva), Zustand 5 (vanilla store + `useStore`), idb, JSZip, @fontsource (8 OFL families), Vitest 3.2 (node + browser/Playwright), vitest-browser-react 1.x, fake-indexeddb.

**Spec:** `docs/superpowers/specs/2026-10-14-ziniarz-design.md` (sections Edytor, Magazyn, Błędy, Technika, Testy). Plan 1 (`docs/superpowers/plans/2026-10-14-ziniarz-1-rdzen.md`) is done. Later plans: 3 = print screen, 3D preview and the Playwright end-to-end test, 4 = hosting.

## Decisions

Made without the user (asleep); all fit the spec.

1. **Plain Konva, not react-konva.** The renderer from plan 1 builds imperative Konva groups; react-konva would need a second, declarative drawing path. `EditorStage` (a class) reuses `buildSpreadGroup`; `SpreadCanvas` is a thin React wrapper. This deviates from "Konva (react-konva)" in the spec's Technika only in the binding.
2. **One shared text builder.** `createTextShape` (render/buildSpread.ts) is the only `Konva.Text` config; `measureTextHeight` uses it for `TextElement.height`, and the in-place textarea takes its sizes from `textStyleMm`.
3. **Single selection.** No multi-select (the spec does not ask for it); Delete, Cmd+C/V/D, arrows and layer buttons act on the selected element. The clipboard lives in the open zine's store and works across spreads.
4. **Undo = whole-zine snapshots,** 100 steps. Consecutive changes with the same key (typing, sliders, number fields, crop drag) merge into one step; each arrow nudge is its own step. Selection, spread and mode are not undone.
5. **Resize handles:** the Konva Transformer edits an invisible proxy rectangle (a photo group is clipped, Konva would measure the whole image). Corners keep proportions, Shift frees them, sides change one dimension. Text frames get only the side handles; height always follows the text; text reflows when the handle is released.
6. **Snapping** within 6 screen pixels to margins, page edges and centres, the spine and other elements' edges and centres; resize handles snap only on unrotated frames; Alt turns it off. Snap lines are drawn in pink while dragging.
7. **Where new things go:** "+ Zdjęcie" / "+ Napis" use the page last clicked on the current spread, else its first existing page. A new photo fits the margin area keeping its proportions (several photos step 5 mm aside); margins leaving less than 10 mm fall back to the whole page. A new text reads "Napis", is selected and opens in edit mode; a text left empty is removed. Crop zoom is 1–5.
8. **Built-in fonts (OFL, Polish letters):** Inter (new default instead of `system-sans`), Lora, Playfair Display, EB Garamond, Space Mono (regular/bold/italic/bold italic), Oswald and Caveat (regular/bold), Archivo Black (regular). Each style is a latin + latin-ext pair of `@fontsource` woff2 files registered as URL `FontFace`s with `unicode-range`; the browser downloads a file only when a text needs it. `ensureFontsReady` now passes the texts so Polish letters load before export.
9. **Uploaded fonts:** TTF/OTF family and style from the `name` table (legacy family, nameID 1) and the OS/2 bold/italic bits; WOFF2 (compressed) from the file name, e.g. `Lato-BoldItalic.woff2`. A family name the zine already has (any case) gets the new files; the same style replaces the old file.
10. **"− kartka"** highlights the spreads that would go while the button is hovered or focused; empty pages are removed at once, pages with content or a background colour ask first.
11. **Dialogs and messages** are our own (`askConfirm`, a notice bar), not `window.confirm`/`alert`. Skipped files: "Pominięto plików: N (to nie są obrazy/fonty)."
12. **Routing:** hash routes `#/`, `#/zin/<id>`, `#/zin/<id>/druk`, `#/zin/<id>/3d`, no router library. Print and 3D are placeholder screens with a way back.
13. **Storage:** `navigator.storage.persist()` at start; the list shows used space and the "brak miejsca" text above 90 %. Autosave stamps `updatedAt` when it saves and also saves at once when the tab is hidden or closed; the list waits for pending saves (`whenSavesSettled`) before pruning unused photos and fonts.
14. **Test setup:** browser tests run in a 1280×900 viewport (the default 414 px is too narrow for clicks on the canvas); file inputs in tests are filled with `chooseFiles` (DataTransfer), because `userEvent.upload` in Vitest 3.2 corrupts binary files. File names never differ only by letter case (macOS): `notices.ts` + `NoticeList.tsx`, `spreadLabels.ts` + `SpreadList.tsx`.

**Conventions for every task:**
- Repo root: `~/projects/ziniarz`. Plan 1 is implemented; read `CLAUDE.md` for the existing structure.
- UI strings and user-facing error messages in Polish; code, comments and commit messages in English.
- All lengths in millimetres unless a name says `Px`. Spread coordinates: x 0…296, spine at 148, bleed 3 mm.
- `*.test.ts` run in Node (`npx vitest run --project unit <file>`); `*.browser.test.ts` and `*.browser.test.tsx` run in Chromium (`npx vitest run --project browser <file>`).
- Every commit message ends with a blank line and `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` (the two `-m` flags below do that).
- Never create two files whose names differ only in letter case (macOS file systems ignore case).
- Zustand selectors passed to `useEditor`/`useStore` must return a stored value (a field, an element), never a newly built object or array.
- "Expected: FAIL" for a new module means Vitest reports that the import cannot be resolved (`Failed to load url` / `Failed to resolve import`). Exact wording of Vitest output may differ; what matters is pass or fail.

**Left for later plans on purpose:** the print screen and the remembered printer margin (plan 3), the 3D preview (plan 3), the Playwright end-to-end test (plan 3), hosting (plan 4). The bundle-size warning from `vite build` (one chunk over 500 kB) is accepted for now.

---

## File structure

```
src/App.tsx                               routes → screens, database, notices, dialogs
src/main.tsx                              registers built-in fonts, imports app.css
src/app/route.ts, useRoute.ts             hash routes
src/app/dbContext.ts                      DbContext, useDb
src/app/notices.ts, NoticeList.tsx        messages, errorMessage()
src/app/confirm.ts, ConfirmHost.tsx       askConfirm() dialog
src/app/plural.ts                         Polish plural forms
src/app/PlaceholderScreen.tsx             print / 3D placeholders
src/app/app.css                           all styles
src/home/homeActions.ts                   list, create, duplicate, delete, .zin export/import
src/home/coverThumbnail.ts, download.ts   cover PNG, file download
src/home/HomeScreen.tsx, ZineCard.tsx     zine list screen
src/editor/state/history.ts               undo stack with merge keys
src/editor/state/autosave.ts              debounced, ordered saves; whenSavesSettled
src/editor/state/commands.ts              pure zine edits
src/editor/state/layers.ts                layer order
src/editor/state/clipboard.ts             paste copies
src/editor/state/store.ts                 Zustand store of the open zine
src/editor/geometry/placement.ts          where new photos/texts go, page under a point
src/editor/geometry/snapping.ts           snap targets and snapping
src/editor/colors.ts                      HEX parsing, colours used in the zine
src/editor/keyboard.ts                    shortcuts → store actions
src/editor/spreadLabels.ts                spread labels, removal question, thumbnail key
src/editor/canvas/EditorStage.ts          the Konva editor canvas
src/editor/canvas/SpreadCanvas.tsx        React wrapper, file drops
src/editor/canvas/TextEditor.tsx          in-place text editing
src/editor/session.ts                     open a zine for editing (parseZine, fonts, photos)
src/editor/EditorContext.ts               EditorEnv context, useEditor
src/editor/EditorScreen.tsx               editor layout, autosave, shortcuts
src/editor/TopBar.tsx, InsertButtons.tsx  top bar
src/editor/insert.ts                      add photos and texts
src/editor/SpreadList.tsx, useSpreadThumbnails.ts   spread thumbnails, ± kartka
src/editor/useEditorKeyboard.ts           window shortcuts
src/editor/panels/*.tsx                   properties: photo, text, font, page, zine, colour, layers
src/fonts/fontChoices.ts                  FontChoice, built-in families, style helpers
src/fonts/builtinFontFiles.ts             @fontsource file URLs
src/fonts/fontNames.ts                    family/style from TTF/OTF tables or file name
src/fonts/fontImport.ts                   upload fonts into a zine
src/fonts/catalogue.ts                    fonts offered in a zine, fonts of other zines
src/fonts/useFontsVersion.ts              redraw when fonts finish loading
src/storage/quota.ts                      persist(), storage usage
src/render/guides.ts                      guides and missing-page shade
src/test/sfnt.ts, stageHarness.ts, editorHarness.tsx, panelHarness.tsx, files.ts   test helpers
```

Modified: `package.json`, `vite.config.ts`, `src/model/factory.ts` (default font), `src/model/geometry.ts` (`marginRect`), `src/storage/db.ts` (`listFontFamilies`, `deleteFontFile`), `src/fonts/fontLoader.ts` (built-in fonts, text-aware loading), `src/render/buildSpread.ts` (shared text builder, element ids), `src/render/assets.ts`, `src/render/renderPage.ts` (guides options), `CLAUDE.md`.

---
### Task 1: Dependencies and test setup

**Files:**
- Modify: `package.json`, `package-lock.json` (via npm), `vite.config.ts`
- Create: `src/test/react.browser.test.tsx`

- [ ] **Step 1: Install the libraries**

```bash
npm install zustand@^5.0.8 @fontsource/lora@^5.2.6 @fontsource/playfair-display@^5.2.6 @fontsource/eb-garamond@^5.2.6 @fontsource/space-mono@^5.2.6 @fontsource/oswald@^5.2.6 @fontsource/caveat@^5.2.6 @fontsource/archivo-black@^5.2.6
npm install -D vitest-browser-react@^1.0.1
```

Expected: both finish without errors. `vitest-browser-react` 1.x is the line for Vitest 3 (2.x needs Vitest 4). `@fontsource/inter` is already installed from plan 1.

- [ ] **Step 2: Check the font files used later exist**

```bash
ls node_modules/@fontsource/{inter,lora,playfair-display,eb-garamond,space-mono,oswald,caveat,archivo-black}/files/*-latin-ext-400-normal.woff2
```

Expected: 8 paths, one per family. (Task 2 also imports the `latin` subset and the `700` / `italic` files that exist for each family.)

- [ ] **Step 3: Replace `vite.config.ts`**

New: more pre-bundled libraries, `.tsx` browser tests, and a desktop-size viewport.

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
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
});
```

- [ ] **Step 4: Write a smoke test for React components `src/test/react.browser.test.tsx`**

```tsx
import { useState } from 'react';
import { render } from 'vitest-browser-react';
import { expect, test } from 'vitest';

function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(count + 1)}>Kliknięto {count}</button>;
}

test('React components render and react to clicks in browser tests', async () => {
  const screen = render(<Counter />);
  await screen.getByRole('button').click();
  await expect.element(screen.getByText('Kliknięto 1')).toBeVisible();
});
```

- [ ] **Step 5: Run it**

Run: `npx vitest run --project browser src/test/react.browser.test.tsx`
Expected: PASS (1 test), no "Vite unexpectedly reloaded a test" warning.

- [ ] **Step 6: Run everything**

Run: `npm test && npm run typecheck`
Expected: all tests pass (the plan 1 suite plus the smoke test), no type errors.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json vite.config.ts src/test/react.browser.test.tsx
git commit -m "Add Zustand, built-in font packages and React browser tests" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Built-in fonts

Eight OFL families from `@fontsource`, registered as on-demand `FontFace`s. `ensureFontsReady` learns to pass the texts, so the latin-ext files with Polish letters load too.

**Files:**
- Create: `src/fonts/fontChoices.ts`, `src/fonts/builtinFontFiles.ts`
- Modify: `src/fonts/fontLoader.ts`, `src/model/factory.ts`
- Test: `src/fonts/fontChoices.test.ts`, `src/fonts/builtinFonts.browser.test.ts`

- [ ] **Step 1: Write the failing test `src/fonts/fontChoices.test.ts`**

```ts
import { expect, test } from 'vitest';
import { BUILTIN_FONTS, canToggle, fitStyle, hasStyle, styleKey, stylesOfFiles, type FontChoice } from './fontChoices';

const byId = (id: string) => BUILTIN_FONTS.find((f) => f.id === id)!;
const boldOnly: FontChoice = { id: 'b', name: 'B', styles: ['bold'], builtin: false };

test('eight built-in families, ids unique', () => {
  expect(BUILTIN_FONTS).toHaveLength(8);
  expect(new Set(BUILTIN_FONTS.map((f) => f.id)).size).toBe(8);
});

test('styleKey and hasStyle', () => {
  expect(styleKey(true, true)).toBe('boldItalic');
  expect(styleKey(false, true)).toBe('italic');
  expect(hasStyle(byId('oswald'), true, false)).toBe(true);
  expect(hasStyle(byId('oswald'), false, true)).toBe(false);
});

test('toggles are enabled only when the family has the target file', () => {
  expect(canToggle(byId('inter'), { bold: false, italic: false }, 'italic')).toBe(true);
  expect(canToggle(byId('oswald'), { bold: false, italic: false }, 'italic')).toBe(false);
  expect(canToggle(byId('archivo-black'), { bold: false, italic: false }, 'bold')).toBe(false);
  expect(canToggle(boldOnly, { bold: true, italic: false }, 'bold')).toBe(false);
});

test('fitStyle keeps what exists, then drops italic, then bold', () => {
  expect(fitStyle(byId('inter'), true, true)).toEqual({ bold: true, italic: true });
  expect(fitStyle(byId('oswald'), true, true)).toEqual({ bold: true, italic: false });
  expect(fitStyle(byId('archivo-black'), true, true)).toEqual({ bold: false, italic: false });
  expect(fitStyle(boldOnly, false, false)).toEqual({ bold: true, italic: false });
});

test('stylesOfFiles lists styles in a fixed order', () => {
  expect(stylesOfFiles([{ bold: true, italic: true }, { bold: false, italic: false }])).toEqual(['regular', 'boldItalic']);
});
```

- [ ] **Step 2: Run it**

Run: `npx vitest run --project unit src/fonts/fontChoices.test.ts`
Expected: FAIL, `./fontChoices` cannot be resolved.

- [ ] **Step 3: Write `src/fonts/fontChoices.ts`**

```ts
export type FontStyleKey = 'regular' | 'bold' | 'italic' | 'boldItalic';

export interface FontStyleFlags {
  bold: boolean;
  italic: boolean;
}

/** A font family the text panel can offer: built-in (bundled OFL fonts) or uploaded to the zine. */
export interface FontChoice {
  id: string;
  name: string;
  /** Styles the family has files for, in the order of STYLE_ORDER. */
  styles: FontStyleKey[];
  builtin: boolean;
}

const STYLE_ORDER: FontStyleKey[] = ['regular', 'bold', 'italic', 'boldItalic'];
const UPRIGHT: FontStyleKey[] = ['regular', 'bold'];

/** Bundled fonts (SIL Open Font License, all with Polish letters). The id is also the fontFamilyId of texts. */
export const BUILTIN_FONTS: FontChoice[] = [
  { id: 'inter', name: 'Inter', styles: STYLE_ORDER, builtin: true },
  { id: 'lora', name: 'Lora', styles: STYLE_ORDER, builtin: true },
  { id: 'playfair-display', name: 'Playfair Display', styles: STYLE_ORDER, builtin: true },
  { id: 'eb-garamond', name: 'EB Garamond', styles: STYLE_ORDER, builtin: true },
  { id: 'space-mono', name: 'Space Mono', styles: STYLE_ORDER, builtin: true },
  { id: 'oswald', name: 'Oswald', styles: UPRIGHT, builtin: true },
  { id: 'caveat', name: 'Caveat', styles: UPRIGHT, builtin: true },
  { id: 'archivo-black', name: 'Archivo Black', styles: ['regular'], builtin: true },
];

export function styleKey(bold: boolean, italic: boolean): FontStyleKey {
  if (bold && italic) return 'boldItalic';
  if (bold) return 'bold';
  return italic ? 'italic' : 'regular';
}

function flagsOf(key: FontStyleKey): FontStyleFlags {
  return { bold: key === 'bold' || key === 'boldItalic', italic: key === 'italic' || key === 'boldItalic' };
}

export function hasStyle(choice: FontChoice, bold: boolean, italic: boolean): boolean {
  return choice.styles.includes(styleKey(bold, italic));
}

/** A bold/italic toggle is enabled only when the family has the file the click would switch to. */
export function canToggle(choice: FontChoice, current: FontStyleFlags, which: 'bold' | 'italic'): boolean {
  const next = { ...current, [which]: !current[which] };
  return hasStyle(choice, next.bold, next.italic);
}

/** The closest style the family has: keep it when it exists, else drop italic, then bold. */
export function fitStyle(choice: FontChoice, bold: boolean, italic: boolean): FontStyleFlags {
  const tries: FontStyleFlags[] = [
    { bold, italic },
    { bold, italic: false },
    { bold: false, italic },
    { bold: false, italic: false },
  ];
  return tries.find((s) => hasStyle(choice, s.bold, s.italic)) ?? flagsOf(choice.styles[0] ?? 'regular');
}

export function stylesOfFiles(files: FontStyleFlags[]): FontStyleKey[] {
  const keys = new Set(files.map((f) => styleKey(f.bold, f.italic)));
  return STYLE_ORDER.filter((key) => keys.has(key));
}
```

- [ ] **Step 4: Run it**

Run: `npx vitest run --project unit src/fonts/fontChoices.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Write the failing browser test `src/fonts/builtinFonts.browser.test.ts`**

```ts
import { expect, test } from 'vitest';
import { createTextElement, createZine } from '../model/factory';
import { BUILTIN_FONT_FILES } from './builtinFontFiles';
import { BUILTIN_FONTS, styleKey } from './fontChoices';
import { ensureFontsReady, registerBuiltinFonts } from './fontLoader';

const faces = (family: string) => [...document.fonts].filter((f) => f.family.replace(/["']/g, '') === family);

test('the file table matches the styles the font picker offers', () => {
  for (const font of BUILTIN_FONTS) {
    const styles = BUILTIN_FONT_FILES.filter((f) => f.familyId === font.id).map((f) => styleKey(f.bold, f.italic));
    expect(styles.sort()).toEqual([...font.styles].sort());
  }
});

test('every bundled file is served', async () => {
  for (const file of BUILTIN_FONT_FILES) {
    for (const url of [file.latin, file.latinExt]) expect((await fetch(url)).ok).toBe(true);
  }
});

test('registerBuiltinFonts adds two faces per style, once', () => {
  registerBuiltinFonts();
  registerBuiltinFonts();
  expect(faces('zf-lora')).toHaveLength(8);
  expect(faces('zf-archivo-black')).toHaveLength(2);
});

test('ensureFontsReady loads the latin-ext file for Polish letters', async () => {
  const zine = createZine('t', 1);
  zine.spreads[1].elements.push(createTextElement({ fontFamilyId: 'lora', italic: true, text: 'Zażółć gęślą jaźń' }));
  registerBuiltinFonts();
  expect(document.fonts.check('italic 16px "zf-lora"', 'ą')).toBe(false);
  await ensureFontsReady(zine);
  expect(document.fonts.check('italic 16px "zf-lora"', 'ą')).toBe(true);
  expect(document.fonts.check('italic 16px "zf-lora"', 'Z')).toBe(true);
});

test('new texts use Inter by default', () => {
  expect(createTextElement().fontFamilyId).toBe('inter');
});
```

- [ ] **Step 6: Run it**

Run: `npx vitest run --project browser src/fonts/builtinFonts.browser.test.ts`
Expected: FAIL, `./builtinFontFiles` cannot be resolved.

- [ ] **Step 7: Write `src/fonts/builtinFontFiles.ts`**

The `?url` imports make Vite copy each woff2 into the build and give its URL.

```ts
import interLatin400 from '@fontsource/inter/files/inter-latin-400-normal.woff2?url';
import interLatinExt400 from '@fontsource/inter/files/inter-latin-ext-400-normal.woff2?url';
import interLatin700 from '@fontsource/inter/files/inter-latin-700-normal.woff2?url';
import interLatinExt700 from '@fontsource/inter/files/inter-latin-ext-700-normal.woff2?url';
import interLatin400Italic from '@fontsource/inter/files/inter-latin-400-italic.woff2?url';
import interLatinExt400Italic from '@fontsource/inter/files/inter-latin-ext-400-italic.woff2?url';
import interLatin700Italic from '@fontsource/inter/files/inter-latin-700-italic.woff2?url';
import interLatinExt700Italic from '@fontsource/inter/files/inter-latin-ext-700-italic.woff2?url';
import loraLatin400 from '@fontsource/lora/files/lora-latin-400-normal.woff2?url';
import loraLatinExt400 from '@fontsource/lora/files/lora-latin-ext-400-normal.woff2?url';
import loraLatin700 from '@fontsource/lora/files/lora-latin-700-normal.woff2?url';
import loraLatinExt700 from '@fontsource/lora/files/lora-latin-ext-700-normal.woff2?url';
import loraLatin400Italic from '@fontsource/lora/files/lora-latin-400-italic.woff2?url';
import loraLatinExt400Italic from '@fontsource/lora/files/lora-latin-ext-400-italic.woff2?url';
import loraLatin700Italic from '@fontsource/lora/files/lora-latin-700-italic.woff2?url';
import loraLatinExt700Italic from '@fontsource/lora/files/lora-latin-ext-700-italic.woff2?url';
import playfairDisplayLatin400 from '@fontsource/playfair-display/files/playfair-display-latin-400-normal.woff2?url';
import playfairDisplayLatinExt400 from '@fontsource/playfair-display/files/playfair-display-latin-ext-400-normal.woff2?url';
import playfairDisplayLatin700 from '@fontsource/playfair-display/files/playfair-display-latin-700-normal.woff2?url';
import playfairDisplayLatinExt700 from '@fontsource/playfair-display/files/playfair-display-latin-ext-700-normal.woff2?url';
import playfairDisplayLatin400Italic from '@fontsource/playfair-display/files/playfair-display-latin-400-italic.woff2?url';
import playfairDisplayLatinExt400Italic from '@fontsource/playfair-display/files/playfair-display-latin-ext-400-italic.woff2?url';
import playfairDisplayLatin700Italic from '@fontsource/playfair-display/files/playfair-display-latin-700-italic.woff2?url';
import playfairDisplayLatinExt700Italic from '@fontsource/playfair-display/files/playfair-display-latin-ext-700-italic.woff2?url';
import ebGaramondLatin400 from '@fontsource/eb-garamond/files/eb-garamond-latin-400-normal.woff2?url';
import ebGaramondLatinExt400 from '@fontsource/eb-garamond/files/eb-garamond-latin-ext-400-normal.woff2?url';
import ebGaramondLatin700 from '@fontsource/eb-garamond/files/eb-garamond-latin-700-normal.woff2?url';
import ebGaramondLatinExt700 from '@fontsource/eb-garamond/files/eb-garamond-latin-ext-700-normal.woff2?url';
import ebGaramondLatin400Italic from '@fontsource/eb-garamond/files/eb-garamond-latin-400-italic.woff2?url';
import ebGaramondLatinExt400Italic from '@fontsource/eb-garamond/files/eb-garamond-latin-ext-400-italic.woff2?url';
import ebGaramondLatin700Italic from '@fontsource/eb-garamond/files/eb-garamond-latin-700-italic.woff2?url';
import ebGaramondLatinExt700Italic from '@fontsource/eb-garamond/files/eb-garamond-latin-ext-700-italic.woff2?url';
import spaceMonoLatin400 from '@fontsource/space-mono/files/space-mono-latin-400-normal.woff2?url';
import spaceMonoLatinExt400 from '@fontsource/space-mono/files/space-mono-latin-ext-400-normal.woff2?url';
import spaceMonoLatin700 from '@fontsource/space-mono/files/space-mono-latin-700-normal.woff2?url';
import spaceMonoLatinExt700 from '@fontsource/space-mono/files/space-mono-latin-ext-700-normal.woff2?url';
import spaceMonoLatin400Italic from '@fontsource/space-mono/files/space-mono-latin-400-italic.woff2?url';
import spaceMonoLatinExt400Italic from '@fontsource/space-mono/files/space-mono-latin-ext-400-italic.woff2?url';
import spaceMonoLatin700Italic from '@fontsource/space-mono/files/space-mono-latin-700-italic.woff2?url';
import spaceMonoLatinExt700Italic from '@fontsource/space-mono/files/space-mono-latin-ext-700-italic.woff2?url';
import oswaldLatin400 from '@fontsource/oswald/files/oswald-latin-400-normal.woff2?url';
import oswaldLatinExt400 from '@fontsource/oswald/files/oswald-latin-ext-400-normal.woff2?url';
import oswaldLatin700 from '@fontsource/oswald/files/oswald-latin-700-normal.woff2?url';
import oswaldLatinExt700 from '@fontsource/oswald/files/oswald-latin-ext-700-normal.woff2?url';
import caveatLatin400 from '@fontsource/caveat/files/caveat-latin-400-normal.woff2?url';
import caveatLatinExt400 from '@fontsource/caveat/files/caveat-latin-ext-400-normal.woff2?url';
import caveatLatin700 from '@fontsource/caveat/files/caveat-latin-700-normal.woff2?url';
import caveatLatinExt700 from '@fontsource/caveat/files/caveat-latin-ext-700-normal.woff2?url';
import archivoBlackLatin400 from '@fontsource/archivo-black/files/archivo-black-latin-400-normal.woff2?url';
import archivoBlackLatinExt400 from '@fontsource/archivo-black/files/archivo-black-latin-ext-400-normal.woff2?url';

/** One weight/style of a bundled font, split by fontsource into a Latin and a Latin Extended file (Polish letters). */
export interface BuiltinFontFile {
  familyId: string;
  bold: boolean;
  italic: boolean;
  latin: string;
  latinExt: string;
}

// unicode-range values copied from the @fontsource CSS files.
export const LATIN_RANGE =
  'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
export const LATIN_EXT_RANGE =
  'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF';

/** Must list exactly the styles named in BUILTIN_FONTS (fontChoices.ts); a test checks it. */
export const BUILTIN_FONT_FILES: BuiltinFontFile[] = [
  { familyId: 'inter', bold: false, italic: false, latin: interLatin400, latinExt: interLatinExt400 },
  { familyId: 'inter', bold: true, italic: false, latin: interLatin700, latinExt: interLatinExt700 },
  { familyId: 'inter', bold: false, italic: true, latin: interLatin400Italic, latinExt: interLatinExt400Italic },
  { familyId: 'inter', bold: true, italic: true, latin: interLatin700Italic, latinExt: interLatinExt700Italic },
  { familyId: 'lora', bold: false, italic: false, latin: loraLatin400, latinExt: loraLatinExt400 },
  { familyId: 'lora', bold: true, italic: false, latin: loraLatin700, latinExt: loraLatinExt700 },
  { familyId: 'lora', bold: false, italic: true, latin: loraLatin400Italic, latinExt: loraLatinExt400Italic },
  { familyId: 'lora', bold: true, italic: true, latin: loraLatin700Italic, latinExt: loraLatinExt700Italic },
  { familyId: 'playfair-display', bold: false, italic: false, latin: playfairDisplayLatin400, latinExt: playfairDisplayLatinExt400 },
  { familyId: 'playfair-display', bold: true, italic: false, latin: playfairDisplayLatin700, latinExt: playfairDisplayLatinExt700 },
  { familyId: 'playfair-display', bold: false, italic: true, latin: playfairDisplayLatin400Italic, latinExt: playfairDisplayLatinExt400Italic },
  { familyId: 'playfair-display', bold: true, italic: true, latin: playfairDisplayLatin700Italic, latinExt: playfairDisplayLatinExt700Italic },
  { familyId: 'eb-garamond', bold: false, italic: false, latin: ebGaramondLatin400, latinExt: ebGaramondLatinExt400 },
  { familyId: 'eb-garamond', bold: true, italic: false, latin: ebGaramondLatin700, latinExt: ebGaramondLatinExt700 },
  { familyId: 'eb-garamond', bold: false, italic: true, latin: ebGaramondLatin400Italic, latinExt: ebGaramondLatinExt400Italic },
  { familyId: 'eb-garamond', bold: true, italic: true, latin: ebGaramondLatin700Italic, latinExt: ebGaramondLatinExt700Italic },
  { familyId: 'space-mono', bold: false, italic: false, latin: spaceMonoLatin400, latinExt: spaceMonoLatinExt400 },
  { familyId: 'space-mono', bold: true, italic: false, latin: spaceMonoLatin700, latinExt: spaceMonoLatinExt700 },
  { familyId: 'space-mono', bold: false, italic: true, latin: spaceMonoLatin400Italic, latinExt: spaceMonoLatinExt400Italic },
  { familyId: 'space-mono', bold: true, italic: true, latin: spaceMonoLatin700Italic, latinExt: spaceMonoLatinExt700Italic },
  { familyId: 'oswald', bold: false, italic: false, latin: oswaldLatin400, latinExt: oswaldLatinExt400 },
  { familyId: 'oswald', bold: true, italic: false, latin: oswaldLatin700, latinExt: oswaldLatinExt700 },
  { familyId: 'caveat', bold: false, italic: false, latin: caveatLatin400, latinExt: caveatLatinExt400 },
  { familyId: 'caveat', bold: true, italic: false, latin: caveatLatin700, latinExt: caveatLatinExt700 },
  { familyId: 'archivo-black', bold: false, italic: false, latin: archivoBlackLatin400, latinExt: archivoBlackLatinExt400 },
];
```

- [ ] **Step 8: Replace `src/fonts/fontLoader.ts`**

Adds `registerBuiltinFonts`, `loadSpreadFonts` and text-aware loading; the rest is unchanged.

```ts
import type { Spread, TextElement, Zine, ZineElement } from '../model/types';
import { fontFilesOfFamily, type FontFile, type ZiniarzDb } from '../storage/db';
import { BUILTIN_FONT_FILES, LATIN_EXT_RANGE, LATIN_RANGE } from './builtinFontFiles';

export class FontImportError extends Error {
  constructor() {
    super('Ten plik nie jest fontem.');
    this.name = 'FontImportError';
  }
}

const registered = new Set<string>();

export function cssFontFamily(familyId: string): string {
  return `zf-${familyId}`;
}

/** Konva quotes nothing here because ids have no spaces; unknown families fall back to sans-serif. */
export function konvaFontFamily(familyId: string): string {
  return `${cssFontFamily(familyId)}, sans-serif`;
}

export function konvaFontStyle(style: Pick<TextElement, 'bold' | 'italic'>): string {
  return [style.italic ? 'italic' : '', style.bold ? 'bold' : ''].filter(Boolean).join(' ') || 'normal';
}

export async function registerFontFile(file: FontFile): Promise<void> {
  if (registered.has(file.id)) return;
  const face = new FontFace(cssFontFamily(file.familyId), file.data, {
    weight: file.bold ? '700' : '400',
    style: file.italic ? 'italic' : 'normal',
  });
  try {
    await face.load();
  } catch {
    throw new FontImportError();
  }
  document.fonts.add(face);
  registered.add(file.id);
}

let builtinsRegistered = false;

/**
 * Adds the bundled fonts to document.fonts. Nothing is downloaded yet: the browser
 * fetches a file when a text needs it (see loadTextFonts).
 */
export function registerBuiltinFonts(): void {
  if (builtinsRegistered) return;
  builtinsRegistered = true;
  for (const file of BUILTIN_FONT_FILES) {
    const descriptors = { weight: file.bold ? '700' : '400', style: file.italic ? 'italic' : 'normal' };
    for (const [url, unicodeRange] of [
      [file.latin, LATIN_RANGE],
      [file.latinExt, LATIN_EXT_RANGE],
    ]) {
      document.fonts.add(
        new FontFace(cssFontFamily(file.familyId), `url(${url}) format('woff2')`, { ...descriptors, unicodeRange }),
      );
    }
  }
}

/** Loads the font files the given texts need. The text matters: Polish letters live in the latin-ext files. */
async function loadTextFonts(elements: Iterable<ZineElement>): Promise<void> {
  registerBuiltinFonts();
  const requests = new Map<string, Set<string>>();
  for (const e of elements) {
    if (e.kind !== 'text') continue;
    const spec = `${e.italic ? 'italic ' : ''}${e.bold ? 'bold ' : ''}16px "${cssFontFamily(e.fontFamilyId)}"`;
    const chars = requests.get(spec) ?? new Set<string>();
    for (const char of e.text) chars.add(char);
    requests.set(spec, chars);
  }
  await Promise.all([...requests].map(([spec, chars]) => document.fonts.load(spec, [...chars].join('') || ' ')));
}

/** Waits until every font style used by the zine's texts is loaded (missing ones resolve empty). */
export async function ensureFontsReady(zine: Zine): Promise<void> {
  await loadTextFonts(zine.spreads.flatMap((s) => s.elements));
}

/** Same as ensureFontsReady for one spread (the editor calls it when a spread changes). */
export async function loadSpreadFonts(spread: Spread): Promise<void> {
  await loadTextFonts(spread.elements);
}

/** Registers every file of the zine's custom font families from the database, skipping corrupt files. Call before rendering. */
export async function registerZineFonts(db: ZiniarzDb, zine: Zine): Promise<void> {
  for (const familyId of zine.fonts) {
    for (const file of await fontFilesOfFamily(db, familyId)) {
      try {
        await registerFontFile(file);
      } catch {
        // One corrupt stored font file must not stop the others (or the zine) from loading.
      }
    }
  }
}
```

- [ ] **Step 9: Make Inter the default font in `src/model/factory.ts`**

Replace the two lines

```ts
/** Falls back to the browser's sans-serif until built-in fonts arrive (plan 2). */
export const DEFAULT_FONT_FAMILY = 'system-sans';
```

with

```ts
/** Id of a built-in family (src/fonts/fontChoices.ts). */
export const DEFAULT_FONT_FAMILY = 'inter';
```

- [ ] **Step 10: Run the font, render and print tests**

Run: `npx vitest run src/fonts src/render src/print src/model`
Expected: PASS (all; the existing tests do not depend on the default font).

- [ ] **Step 11: Commit**

```bash
git add src/fonts src/model/factory.ts
git commit -m "Bundle eight OFL font families and load them on demand" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Reading family names from font files

Pure functions, tested in Node with a hand-built minimal TrueType file.

**Files:**
- Create: `src/fonts/fontNames.ts`, `src/test/sfnt.ts`
- Test: `src/fonts/fontNames.test.ts`

- [ ] **Step 1: Write the test helper `src/test/sfnt.ts`**

```ts
export interface SfntOptions {
  /** name table entries by nameID (1 family, 2 subfamily, 16/17 typographic family/subfamily). */
  names: Record<number, string>;
  /** When set (or `weight` is set), an OS/2 table is written. Bit 0 italic, bit 5 bold, bit 6 regular. */
  fsSelection?: number;
  weight?: number;
}

function utf16be(text: string): Uint8Array {
  const out = new Uint8Array(text.length * 2);
  for (let i = 0; i < text.length; i++) {
    out[2 * i] = text.charCodeAt(i) >> 8;
    out[2 * i + 1] = text.charCodeAt(i) & 0xff;
  }
  return out;
}

/** A minimal TrueType file with only `name` (and optionally `OS/2`): enough for the name reader, not a real font. */
export function buildSfnt(options: SfntOptions): ArrayBuffer {
  const strings = Object.entries(options.names).map(([id, value]) => ({ id: Number(id), bytes: utf16be(value) }));
  const recordsLength = 6 + strings.length * 12;
  const nameLength = recordsLength + strings.reduce((sum, s) => sum + s.bytes.length, 0);
  const withOs2 = options.fsSelection !== undefined || options.weight !== undefined;
  const tables = [...(withOs2 ? [{ tag: 'OS/2', length: 78 }] : []), { tag: 'name', length: nameLength }];
  let offset = 12 + tables.length * 16;
  const placed = tables.map((table) => {
    const at = { ...table, offset };
    offset += table.length;
    return at;
  });
  const buffer = new ArrayBuffer(offset);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  view.setUint32(0, 0x00010000);
  view.setUint16(4, tables.length);
  placed.forEach((table, i) => {
    const record = 12 + i * 16;
    for (let c = 0; c < 4; c++) view.setUint8(record + c, table.tag.charCodeAt(c));
    view.setUint32(record + 8, table.offset);
    view.setUint32(record + 12, table.length);
  });
  for (const table of placed) {
    if (table.tag === 'OS/2') {
      view.setUint16(table.offset + 4, options.weight ?? 400);
      view.setUint16(table.offset + 62, options.fsSelection ?? 0x40);
      continue;
    }
    view.setUint16(table.offset + 2, strings.length);
    view.setUint16(table.offset + 4, recordsLength);
    let stringOffset = 0;
    strings.forEach((s, i) => {
      const record = table.offset + 6 + i * 12;
      view.setUint16(record, 3); // Windows
      view.setUint16(record + 2, 1); // Unicode BMP
      view.setUint16(record + 4, 0x409); // English (US)
      view.setUint16(record + 6, s.id);
      view.setUint16(record + 8, s.bytes.length);
      view.setUint16(record + 10, stringOffset);
      bytes.set(s.bytes, table.offset + recordsLength + stringOffset);
      stringOffset += s.bytes.length;
    });
  }
  return buffer;
}
```

- [ ] **Step 2: Write the failing test `src/fonts/fontNames.test.ts`**

```ts
import { expect, test } from 'vitest';
import { buildSfnt } from '../test/sfnt';
import { describeFontFile, fontMime, groupByFamily, readSfntNames, styleFromFileName } from './fontNames';

test('reads the family and the OS/2 bold and italic bits', () => {
  const data = buildSfnt({ names: { 1: 'Grotesk', 2: 'Bold Italic' }, fsSelection: 0x21 });
  expect(readSfntNames(data)).toEqual({ family: 'Grotesk', bold: true, italic: true });
});

test('prefers the legacy family name so light weights stay a separate family', () => {
  const data = buildSfnt({ names: { 1: 'Lato Light', 2: 'Regular', 16: 'Lato', 17: 'Light' }, fsSelection: 0x40, weight: 300 });
  expect(readSfntNames(data)).toEqual({ family: 'Lato Light', bold: false, italic: false });
});

test('without OS/2 the subfamily name decides the style', () => {
  expect(readSfntNames(buildSfnt({ names: { 1: 'Mono', 2: 'Italic' } }))).toEqual({ family: 'Mono', bold: false, italic: true });
});

test('anything that is not a TrueType/OpenType file gives null', () => {
  expect(readSfntNames(new TextEncoder().encode('hello world, not a font').buffer as ArrayBuffer)).toBeNull();
  expect(readSfntNames(new ArrayBuffer(2))).toBeNull();
});

test('style from file names', () => {
  expect(styleFromFileName('Lato-BoldItalic.woff2')).toEqual({ family: 'Lato', bold: true, italic: true });
  expect(styleFromFileName('PlayfairDisplay-Regular.ttf')).toEqual({ family: 'Playfair Display', bold: false, italic: false });
  expect(styleFromFileName('Comic_Neue.woff2')).toEqual({ family: 'Comic Neue', bold: false, italic: false });
  expect(styleFromFileName('Inter-SemiBoldItalic.woff2')).toEqual({ family: 'Inter', bold: true, italic: true });
  expect(styleFromFileName('Space-Mono.woff2')).toEqual({ family: 'Space Mono', bold: false, italic: false });
});

test('describeFontFile reads tables for .ttf/.otf and the file name for .woff2', () => {
  const ttf = buildSfnt({ names: { 1: 'Grotesk', 2: 'Bold' }, fsSelection: 0x20 });
  expect(describeFontFile('whatever.ttf', ttf)).toEqual({ family: 'Grotesk', bold: true, italic: false, mime: 'font/ttf' });
  expect(describeFontFile('Lato-Italic.woff2', new ArrayBuffer(8))).toEqual({
    family: 'Lato',
    bold: false,
    italic: true,
    mime: 'font/woff2',
  });
  expect(describeFontFile('Broken-Bold.OTF', new ArrayBuffer(8))).toEqual({
    family: 'Broken',
    bold: true,
    italic: false,
    mime: 'font/otf',
  });
  expect(describeFontFile('notes.txt', new ArrayBuffer(8))).toBeNull();
  expect(fontMime('font.woff')).toBeNull();
});

test('groupByFamily ignores case and keeps first-seen order', () => {
  const item = (family: string) => ({ description: { family, bold: false, italic: false } });
  const groups = groupByFamily([item('Lato'), item('Inter'), item('lato')]);
  expect([...groups.keys()]).toEqual(['lato', 'inter']);
  expect(groups.get('lato')).toHaveLength(2);
});
```

- [ ] **Step 3: Run it**

Run: `npx vitest run --project unit src/fonts/fontNames.test.ts`
Expected: FAIL, `./fontNames` cannot be resolved.

- [ ] **Step 4: Write `src/fonts/fontNames.ts`**

```ts
export interface FontStyleName {
  family: string;
  bold: boolean;
  italic: boolean;
}

export interface FontDescription extends FontStyleName {
  mime: string;
}

const MIME: Record<string, string> = { ttf: 'font/ttf', otf: 'font/otf', woff2: 'font/woff2' };
const SFNT_VERSIONS = [0x00010000, 0x4f54544f /* OTTO */, 0x74727565 /* true */];

function utf16be(view: DataView, start: number, length: number): string {
  let text = '';
  for (let i = 0; i + 1 < length; i += 2) text += String.fromCharCode(view.getUint16(start + i));
  return text;
}

function latin1(view: DataView, start: number, length: number): string {
  let text = '';
  for (let i = 0; i < length; i++) text += String.fromCharCode(view.getUint8(start + i));
  return text;
}

/** Strings of the `name` table by nameID, preferring Windows English, then other Unicode, then Mac Roman. */
function readNameTable(view: DataView, offset: number): Map<number, string> {
  const count = view.getUint16(offset + 2);
  const stringBase = offset + view.getUint16(offset + 4);
  const best = new Map<number, { score: number; value: string }>();
  for (let i = 0; i < count; i++) {
    const record = offset + 6 + i * 12;
    const platform = view.getUint16(record);
    const encoding = view.getUint16(record + 2);
    const language = view.getUint16(record + 4);
    const nameId = view.getUint16(record + 6);
    const length = view.getUint16(record + 8);
    const start = stringBase + view.getUint16(record + 10);
    let entry: { score: number; value: string };
    if (platform === 3 && (encoding === 1 || encoding === 10)) {
      entry = { score: language === 0x409 ? 3 : 2, value: utf16be(view, start, length) };
    } else if (platform === 0) {
      entry = { score: 1, value: utf16be(view, start, length) };
    } else if (platform === 1 && encoding === 0) {
      entry = { score: 0, value: latin1(view, start, length) };
    } else {
      continue;
    }
    const previous = best.get(nameId);
    if (!previous || entry.score > previous.score) best.set(nameId, entry);
  }
  return new Map([...best].map(([id, entry]) => [id, entry.value]));
}

/**
 * Family and style of a TrueType/OpenType file. Uses the legacy family name (nameID 1) and the
 * OS/2 bold/italic bits, which are exactly the "regular, bold, italic, bold italic" grouping a
 * zine font family needs ("Lato Light" stays its own family). Returns null for anything else.
 */
export function readSfntNames(data: ArrayBuffer): FontStyleName | null {
  try {
    const view = new DataView(data);
    if (!SFNT_VERSIONS.includes(view.getUint32(0))) return null;
    const tables = new Map<string, number>();
    const count = view.getUint16(4);
    for (let i = 0; i < count; i++) {
      const record = 12 + i * 16;
      const tag = String.fromCharCode(
        view.getUint8(record),
        view.getUint8(record + 1),
        view.getUint8(record + 2),
        view.getUint8(record + 3),
      );
      tables.set(tag, view.getUint32(record + 8));
    }
    const nameOffset = tables.get('name');
    if (nameOffset === undefined) return null;
    const names = readNameTable(view, nameOffset);
    const family = (names.get(1) ?? names.get(16) ?? '').trim();
    if (!family) return null;
    const os2 = tables.get('OS/2');
    if (os2 !== undefined) {
      const fsSelection = view.getUint16(os2 + 62);
      return { family, bold: (fsSelection & 0x20) !== 0, italic: (fsSelection & 0x01) !== 0 };
    }
    const subfamily = (names.get(2) ?? '').toLowerCase();
    return { family, bold: subfamily.includes('bold'), italic: /italic|oblique/.test(subfamily) };
  } catch {
    return null; // truncated or corrupt file
  }
}

const STYLE_SUFFIX = /^(regular|normal|book|roman|bold|italic|oblique|semi|demi|extra|ultra|black|heavy|light|thin|medium)+$/;

function prettyFamily(raw: string): string {
  const spaced = raw.replace(/[-_]+/g, ' ').trim();
  return (spaced.includes(' ') ? spaced : spaced.replace(/([a-z])([A-Z])/g, '$1 $2')) || 'Font';
}

/** Fallback for WOFF2 (compressed tables): "Lato-BoldItalic.woff2" → Lato, bold, italic. */
export function styleFromFileName(fileName: string): FontStyleName {
  const base = fileName.replace(/\.[^.]+$/, '');
  const cut = Math.max(base.lastIndexOf('-'), base.lastIndexOf('_'));
  const suffix = cut > 0 ? base.slice(cut + 1).toLowerCase() : '';
  const isStyle = STYLE_SUFFIX.test(suffix);
  return {
    family: prettyFamily(isStyle ? base.slice(0, cut) : base),
    bold: isStyle && suffix.includes('bold'),
    italic: isStyle && /italic|oblique/.test(suffix),
  };
}

export function fontMime(fileName: string): string | null {
  const dot = fileName.lastIndexOf('.');
  return dot > 0 ? (MIME[fileName.slice(dot + 1).toLowerCase()] ?? null) : null;
}

/** Family and style of an uploaded font file, or null when it is not .ttf, .otf or .woff2. */
export function describeFontFile(fileName: string, data: ArrayBuffer): FontDescription | null {
  const mime = fontMime(fileName);
  if (!mime) return null;
  const fromTables = mime === 'font/woff2' ? null : readSfntNames(data);
  return { ...(fromTables ?? styleFromFileName(fileName)), mime };
}

/** Groups items by family name, ignoring case, in order of first appearance. */
export function groupByFamily<T extends { description: FontStyleName }>(items: T[]): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = item.description.family.toLowerCase();
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return groups;
}
```

- [ ] **Step 5: Run it**

Run: `npx vitest run --project unit src/fonts/fontNames.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 6: Commit**

```bash
git add src/fonts/fontNames.ts src/fonts/fontNames.test.ts src/test/sfnt.ts
git commit -m "Read font family and style from TTF/OTF tables or the file name" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Font upload and the zine's font list

**Files:**
- Modify: `src/storage/db.ts`
- Create: `src/fonts/catalogue.ts`, `src/fonts/fontImport.ts`
- Test: `src/fonts/catalogue.test.ts`, `src/fonts/fontImport.browser.test.ts`

- [ ] **Step 1: Add two database functions to `src/storage/db.ts`**

Insert right before `export function listFontFamilyIds`:

```ts
export function listFontFamilies(db: ZiniarzDb): Promise<FontFamily[]> {
  return db.getAll('fontFamilies');
}

export async function deleteFontFile(db: ZiniarzDb, id: string): Promise<void> {
  await db.delete('fontFiles', id);
}
```

- [ ] **Step 2: Write the failing test `src/fonts/catalogue.test.ts`**

```ts
import 'fake-indexeddb/auto';
import { expect, test } from 'vitest';
import { createZine } from '../model/factory';
import { newId } from '../model/ids';
import { openZiniarzDb, putFontFamily, putFontFile } from '../storage/db';
import { loadFontChoices, otherZineFamilies } from './catalogue';
import { BUILTIN_FONTS } from './fontChoices';

async function dbWithFamilies() {
  const db = await openZiniarzDb(`test-${newId()}`);
  const data = new ArrayBuffer(1);
  await putFontFamily(db, { id: 'mine', name: 'Moja' });
  await putFontFile(db, { id: 'm1', familyId: 'mine', bold: false, italic: false, mime: 'font/ttf', data });
  await putFontFile(db, { id: 'm2', familyId: 'mine', bold: true, italic: false, mime: 'font/ttf', data });
  await putFontFamily(db, { id: 'z', name: 'Żabka' });
  await putFontFamily(db, { id: 'a', name: 'Alfa' });
  await putFontFile(db, { id: 'a1', familyId: 'a', bold: false, italic: true, mime: 'font/ttf', data });
  return db;
}

test('loadFontChoices lists built-in fonts, then the zine families with their styles', async () => {
  const db = await dbWithFamilies();
  const zine = createZine('t', 1);
  zine.fonts = ['mine', 'gone'];
  const choices = await loadFontChoices(db, zine);
  expect(choices.slice(0, BUILTIN_FONTS.length)).toEqual(BUILTIN_FONTS);
  expect(choices.slice(BUILTIN_FONTS.length)).toEqual([{ id: 'mine', name: 'Moja', styles: ['regular', 'bold'], builtin: false }]);
});

test('otherZineFamilies lists families this zine does not use, by name', async () => {
  const db = await dbWithFamilies();
  const zine = createZine('t', 1);
  zine.fonts = ['mine'];
  expect((await otherZineFamilies(db, zine)).map((f) => [f.name, f.styles])).toEqual([
    ['Alfa', ['italic']],
    ['Żabka', []],
  ]);
});
```

- [ ] **Step 3: Run it**

Run: `npx vitest run --project unit src/fonts/catalogue.test.ts`
Expected: FAIL, `./catalogue` cannot be resolved.

- [ ] **Step 4: Write `src/fonts/catalogue.ts`**

```ts
import type { Zine } from '../model/types';
import { fontFilesOfFamily, getFontFamily, listFontFamilies, type FontFamily, type ZiniarzDb } from '../storage/db';
import { BUILTIN_FONTS, stylesOfFiles, type FontChoice } from './fontChoices';

async function choiceOf(db: ZiniarzDb, family: FontFamily): Promise<FontChoice> {
  return { id: family.id, name: family.name, styles: stylesOfFiles(await fontFilesOfFamily(db, family.id)), builtin: false };
}

/** Built-in families first, then the zine's own uploaded families in list order. */
export async function loadFontChoices(db: ZiniarzDb, zine: Zine): Promise<FontChoice[]> {
  const custom: FontChoice[] = [];
  for (const id of zine.fonts) {
    const family = await getFontFamily(db, id);
    if (family) custom.push(await choiceOf(db, family));
  }
  return [...BUILTIN_FONTS, ...custom];
}

/** Families uploaded to other zines that this zine does not list yet ("użyj fontu z innego zina"). */
export async function otherZineFamilies(db: ZiniarzDb, zine: Zine): Promise<FontChoice[]> {
  const own = new Set(zine.fonts);
  const families = (await listFontFamilies(db))
    .filter((family) => !own.has(family.id))
    .sort((a, b) => a.name.localeCompare(b.name, 'pl'));
  return Promise.all(families.map((family) => choiceOf(db, family)));
}
```

- [ ] **Step 5: Run it**

Run: `npx vitest run --project unit src/fonts/catalogue.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Write the failing browser test `src/fonts/fontImport.browser.test.ts`**

The Inter woff2 files stand in for an uploaded family; their file names decide the family ("Moja").

```ts
import interBold from '@fontsource/inter/files/inter-latin-700-normal.woff2?url';
import interItalic from '@fontsource/inter/files/inter-latin-400-italic.woff2?url';
import interRegular from '@fontsource/inter/files/inter-latin-400-normal.woff2?url';
import { expect, test } from 'vitest';
import { createZine } from '../model/factory';
import { newId } from '../model/ids';
import { fontFilesOfFamily, getFontFamily, openZiniarzDb } from '../storage/db';
import { cssFontFamily } from './fontLoader';
import { importFontFiles } from './fontImport';

async function fontFile(url: string, name: string): Promise<File> {
  return new File([await (await fetch(url)).arrayBuffer()], name);
}

const loadedFaces = (familyId: string) =>
  [...document.fonts].filter((f) => f.family.replace(/["']/g, '') === cssFontFamily(familyId) && f.status === 'loaded');

test('files with the same family name become one family; other files are skipped', async () => {
  const db = await openZiniarzDb(`test-${newId()}`);
  const zine = createZine('t', 1);
  const files = [
    await fontFile(interRegular, 'Moja-Regular.woff2'),
    await fontFile(interBold, 'Moja-Bold.woff2'),
    new File(['hello'], 'notatki.txt'),
    new File(['not a font'], 'Zepsuty-Regular.ttf'),
  ];
  const result = await importFontFiles(db, zine, files);
  expect(result.skipped).toBe(2);
  expect(result.familyIds).toHaveLength(1);
  const [familyId] = result.familyIds;
  expect(await getFontFamily(db, familyId)).toEqual({ id: familyId, name: 'Moja' });
  const stored = await fontFilesOfFamily(db, familyId);
  expect(stored.map((f) => [f.bold, f.italic, f.mime]).sort()).toEqual([
    [false, false, 'font/woff2'],
    [true, false, 'font/woff2'],
  ]);
  expect(loadedFaces(familyId)).toHaveLength(2);
});

test('a family the zine already has gets the new file, and the same style is replaced', async () => {
  const db = await openZiniarzDb(`test-${newId()}`);
  const zine = createZine('t', 1);
  const first = await importFontFiles(db, zine, [await fontFile(interRegular, 'Moja-Regular.woff2')]);
  zine.fonts = first.familyIds;
  const second = await importFontFiles(db, zine, [
    await fontFile(interItalic, 'moja-Italic.woff2'),
    await fontFile(interRegular, 'Moja-Regular.woff2'),
  ]);
  expect(second.familyIds).toEqual(first.familyIds);
  const stored = await fontFilesOfFamily(db, first.familyIds[0]);
  expect(stored.map((f) => [f.bold, f.italic]).sort()).toEqual([
    [false, false],
    [false, true],
  ]);
});

test('an upload with no usable file leaves no empty family behind', async () => {
  const db = await openZiniarzDb(`test-${newId()}`);
  const result = await importFontFiles(db, createZine('t', 1), [new File(['x'], 'Pusty-Regular.otf')]);
  expect(result).toEqual({ familyIds: [], skipped: 1 });
  expect(await db.getAll('fontFamilies')).toEqual([]);
});
```

- [ ] **Step 7: Run it**

Run: `npx vitest run --project browser src/fonts/fontImport.browser.test.ts`
Expected: FAIL, `./fontImport` cannot be resolved.

- [ ] **Step 8: Write `src/fonts/fontImport.ts`**

```ts
import { newId } from '../model/ids';
import type { Zine } from '../model/types';
import {
  deleteFontFamilies,
  deleteFontFile,
  fontFilesOfFamily,
  getFontFamily,
  putFontFamily,
  putFontFile,
  type FontFile,
  type ZiniarzDb,
} from '../storage/db';
import { FontImportError, registerFontFile } from './fontLoader';
import { describeFontFile, groupByFamily, type FontDescription } from './fontNames';

export interface FontImportResult {
  /** Families that got at least one file; add them to `Zine.fonts`. */
  familyIds: string[];
  /** Files that are not fonts (wrong extension or the browser cannot load them). */
  skipped: number;
}

interface Upload {
  description: FontDescription;
  data: ArrayBuffer;
}

/**
 * Saves uploaded font files for a zine, grouped into families by family name. A name the zine
 * already has (any case) adds files to that family; a file with the same bold/italic replaces the
 * older one. Throws StorageFullError when the browser is out of space.
 */
export async function importFontFiles(db: ZiniarzDb, zine: Zine, files: File[]): Promise<FontImportResult> {
  let skipped = 0;
  const uploads: Upload[] = [];
  for (const file of files) {
    const data = await file.arrayBuffer();
    const description = describeFontFile(file.name, data);
    if (description) uploads.push({ description, data });
    else skipped++;
  }

  const existing = new Map<string, string>();
  for (const id of zine.fonts) {
    const family = await getFontFamily(db, id);
    if (family) existing.set(family.name.toLowerCase(), family.id);
  }

  const familyIds: string[] = [];
  for (const [key, group] of groupByFamily(uploads)) {
    const isNew = !existing.has(key);
    const familyId = existing.get(key) ?? newId();
    if (isNew) await putFontFamily(db, { id: familyId, name: group[0].description.family });
    let current = await fontFilesOfFamily(db, familyId);
    let added = 0;
    for (const upload of group) {
      const { bold, italic, mime } = upload.description;
      const file: FontFile = { id: newId(), familyId, bold, italic, mime, data: upload.data };
      try {
        await registerFontFile(file);
      } catch (error) {
        if (!(error instanceof FontImportError)) throw error;
        skipped++;
        continue;
      }
      await putFontFile(db, file);
      for (const old of current.filter((f) => f.bold === bold && f.italic === italic)) await deleteFontFile(db, old.id);
      current = [...current.filter((f) => f.bold !== bold || f.italic !== italic), file];
      added++;
    }
    if (added > 0) familyIds.push(familyId);
    else if (isNew) await deleteFontFamilies(db, [familyId]);
  }
  return { familyIds, skipped };
}
```

- [ ] **Step 9: Run the font and storage tests**

Run: `npx vitest run src/fonts src/storage`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add src/storage/db.ts src/fonts
git commit -m "Upload font files into zine font families" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Renderer: shared text builder, element ids, guides

The editor must measure and draw text exactly like the export, so the `Konva.Text` settings move into `createTextShape`. Element nodes get their element id. Guides and the grey-out of the missing page next to a cover become renderer pieces, also available through `renderSpread`.

**Files:**
- Modify: `src/model/geometry.ts`, `src/render/buildSpread.ts`, `src/render/assets.ts`, `src/render/renderPage.ts`, `src/render/renderPage.browser.test.ts`
- Create: `src/render/guides.ts`
- Test: `src/model/marginRect.test.ts`

- [ ] **Step 1: Write the failing test `src/model/marginRect.test.ts`**

```ts
import { expect, test } from 'vitest';
import { marginRect } from './geometry';

const margins = { outer: 10, inner: 20, top: 15, bottom: 25 };

test('left page: outer margin on the left, inner margin at the spine', () => {
  expect(marginRect(margins, 'left')).toEqual({ x: 10, y: 15, width: 118, height: 170 });
});

test('right page: inner margin at the spine, outer margin on the right', () => {
  expect(marginRect(margins, 'right')).toEqual({ x: 168, y: 15, width: 118, height: 170 });
});

test('margins wider than the page give an empty area, not a negative one', () => {
  expect(marginRect({ outer: 100, inner: 100, top: 0, bottom: 0 }, 'left').width).toBe(0);
});
```

- [ ] **Step 2: Run it**

Run: `npx vitest run --project unit src/model/marginRect.test.ts`
Expected: FAIL, `marginRect` is not exported (`marginRect is not a function`).

- [ ] **Step 3: Add `marginRect` to `src/model/geometry.ts`**

Change the first line from `import type { Frame, Side } from './types';` to `import type { Frame, Margins, Side } from './types';`, and insert right before the comment `/** Axis-aligned bounds of a frame rotated around its centre. */`:

```ts
/** Area between the margins of a page, in spread coordinates. Never negative. */
export function marginRect(margins: Margins, side: Side): Rect {
  const left = side === 'left' ? margins.outer : PAGE_WIDTH + margins.inner;
  return {
    x: left,
    y: margins.top,
    width: Math.max(0, PAGE_WIDTH - margins.outer - margins.inner),
    height: Math.max(0, PAGE_HEIGHT - margins.top - margins.bottom),
  };
}
```

- [ ] **Step 4: Run it**

Run: `npx vitest run --project unit src/model/marginRect.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Add the failing renderer tests to `src/render/renderPage.browser.test.ts`**

Replace the import lines

```ts
import type { RenderAssets } from './assets';
import { renderPage, renderSpread } from './renderPage';
```

with

```ts
import type { RenderAssets } from './assets';
import { buildSpreadGroup, ELEMENT_NODE_NAME, measureTextHeight, ptToMm, textStyleMm } from './buildSpread';
import { renderPage, renderSpread } from './renderPage';
```

and append at the end of the file:

```ts
describe('renderSpread overlays', () => {
  const bluish = (canvas: HTMLCanvasElement, x0: number, y0: number, width: number, height: number) => {
    const data = canvas.getContext('2d')!.getImageData(x0, y0, width, height).data;
    for (let i = 0; i < data.length; i += 4) if (data[i + 2] > data[i] + 60) return true;
    return false;
  };

  test('guides draw the blue margin line only when asked', () => {
    const zine = createZine('t', 1);
    // Left page of spread 1: outer margin 30 mm, plus 3 mm bleed at the canvas edge.
    const column = (30 + 3) * PX - 2;
    const plain = renderSpread(zine, 1, { images: new Map() }, { pxPerMm: PX });
    const withGuides = renderSpread(zine, 1, { images: new Map() }, { pxPerMm: PX, guides: true });
    expect(bluish(plain, column, 100 * PX, 4, 40 * PX)).toBe(false);
    expect(bluish(withGuides, column, 100 * PX, 4, 40 * PX)).toBe(true);
  });

  test('shadeMissing greys out the part of an element on the missing page', async () => {
    const zine = createZine('t', 1);
    zine.spreads[0].elements.push(createPhotoElement('red', { x: 100, y: 50, width: 100, height: 100 }));
    const assets = { images: new Map([['red', await solidBitmap(100, 100, '#ff0000')]]) };
    const at = (canvas: HTMLCanvasElement) => pixel(canvas, (120 + 3) * PX, (100 + 3) * PX);
    expectColor(at(renderSpread(zine, 0, assets, { pxPerMm: PX })), RED);
    expect(at(renderSpread(zine, 0, assets, { pxPerMm: PX, shadeMissing: true }))[1]).toBeGreaterThan(150);
    expectColor(pixel(renderSpread(zine, 0, assets, { pxPerMm: PX, shadeMissing: true }), 170 * PX, 100 * PX), RED);
  });
});

describe('shared text builder', () => {
  test('element nodes carry the element id', () => {
    const zine = createZine('t', 1);
    const text = createTextElement({ text: 'A' });
    zine.spreads[1].elements.push(text);
    const group = buildSpreadGroup(zine, 1, { images: new Map() });
    const nodes = group.getChildren((node) => node.hasName(ELEMENT_NODE_NAME));
    expect(nodes.map((node) => node.id())).toEqual([text.id]);
  });

  test('measureTextHeight grows with the number of lines', () => {
    const one = measureTextHeight(createTextElement({ text: 'a', size: 12, lineHeight: 1.2 }));
    const three = measureTextHeight(createTextElement({ text: 'a\nb\nc', size: 12, lineHeight: 1.2 }));
    expect(one).toBeCloseTo(ptToMm(12) * 1.2, 5);
    expect(three).toBeCloseTo(one * 3, 5);
  });

  test('textStyleMm converts points and thousandths of an em to mm', () => {
    const style = textStyleMm(createTextElement({ size: 72, letterSpacing: 100, lineHeight: 1.5 }));
    expect(style.fontSize).toBeCloseTo(25.4, 5);
    expect(style.letterSpacing).toBeCloseTo(2.54, 5);
    expect(style.lineHeight).toBe(1.5);
  });
});
```

- [ ] **Step 6: Run it**

Run: `npx vitest run --project browser src/render/renderPage.browser.test.ts`
Expected: FAIL, `ELEMENT_NODE_NAME` / `measureTextHeight` / `textStyleMm` are not exported.

- [ ] **Step 7: Replace `src/render/buildSpread.ts`**

```ts
import Konva from 'konva';
import { konvaFontFamily, konvaFontStyle } from '../fonts/fontLoader';
import { BLEED, pageRect, pagesOfSpread, slotOfPage } from '../model/geometry';
import type { PhotoElement, TextElement, Zine, ZineElement } from '../model/types';
import type { RenderAssets } from './assets';
import { imagePlacement } from './photoGeometry';

export const PLACEHOLDER_COLOR = '#dddddd';
/** Konva name of every element node; its Konva id is the element id. */
export const ELEMENT_NODE_NAME = 'element';

export function ptToMm(points: number): number {
  return (points * 25.4) / 72;
}

export interface TextStyleMm {
  fontSize: number;
  letterSpacing: number;
  lineHeight: number;
}

/** Text metrics in mm, shared by the renderer and the editor's in-place text box. */
export function textStyleMm(element: TextElement): TextStyleMm {
  const fontSize = ptToMm(element.size);
  return { fontSize, letterSpacing: (element.letterSpacing / 1000) * fontSize, lineHeight: element.lineHeight };
}

/** The only Konva.Text configuration. Drawing and measuring both use it, so they always agree. */
export function createTextShape(element: TextElement): Konva.Text {
  const style = textStyleMm(element);
  return new Konva.Text({
    text: element.text,
    width: element.width,
    fontFamily: konvaFontFamily(element.fontFamilyId),
    fontSize: style.fontSize,
    fontStyle: konvaFontStyle(element),
    letterSpacing: style.letterSpacing,
    lineHeight: style.lineHeight,
    fill: element.color,
    align: element.align,
    wrap: 'word',
  });
}

/** Height of the wrapped text in mm (what `TextElement.height` should be). */
export function measureTextHeight(element: TextElement): number {
  const shape = createTextShape(element);
  const height = shape.height();
  shape.destroy();
  return height;
}

function photoNode(element: PhotoElement, assets: RenderAssets): Konva.Group {
  const { width, height } = element;
  const group = new Konva.Group({
    id: element.id,
    name: ELEMENT_NODE_NAME,
    x: element.x + width / 2,
    y: element.y + height / 2,
    offsetX: width / 2,
    offsetY: height / 2,
    rotation: element.rotation,
    opacity: element.opacity,
    clip: { x: 0, y: 0, width, height },
  });
  const bitmap = assets.images.get(element.imageId);
  if (!bitmap) {
    group.add(new Konva.Rect({ width, height, fill: PLACEHOLDER_COLOR }));
    return group;
  }
  const placed = imagePlacement(element, element.crop, bitmap.width, bitmap.height);
  group.add(
    new Konva.Image({
      image: bitmap,
      x: element.flipX ? placed.x + placed.width : placed.x,
      y: placed.y,
      width: placed.width,
      height: placed.height,
      scaleX: element.flipX ? -1 : 1,
    }),
  );
  return group;
}

function textNode(element: TextElement): Konva.Group {
  const text = createTextShape(element);
  const height = text.height();
  const group = new Konva.Group({
    id: element.id,
    name: ELEMENT_NODE_NAME,
    x: element.x + element.width / 2,
    y: element.y + height / 2,
    offsetX: element.width / 2,
    offsetY: height / 2,
    rotation: element.rotation,
  });
  group.add(text);
  return group;
}

/** One element positioned by its centre: offset = half its size, so rotation turns it around the centre. */
export function buildElementNode(element: ZineElement, assets: RenderAssets): Konva.Group {
  return element.kind === 'photo' ? photoNode(element, assets) : textNode(element);
}

/** The single drawing of a spread, in spread millimetres (page backgrounds include bleed). */
export function buildSpreadGroup(zine: Zine, spreadIndex: number, assets: RenderAssets): Konva.Group {
  const group = new Konva.Group();
  for (const page of pagesOfSpread(spreadIndex, zine.sheets)) {
    const rect = pageRect(slotOfPage(page).side, BLEED);
    group.add(new Konva.Rect({ ...rect, fill: zine.pages[page]?.background ?? '#ffffff', name: 'page' }));
  }
  for (const element of zine.spreads[spreadIndex].elements) group.add(buildElementNode(element, assets));
  return group;
}
```

- [ ] **Step 8: Write `src/render/guides.ts`**

```ts
import Konva from 'konva';
import { BLEED, marginRect, PAGE_HEIGHT, PAGE_WIDTH, pageAt, pageExists, pageRect, pagesOfSpread, slotOfPage, type Rect } from '../model/geometry';
import type { Side, Zine } from '../model/types';

export const GUIDE_COLORS = { bleed: '#e5484d', margin: '#3e63dd', spine: 'rgba(0, 0, 0, 0.35)' };
/** Same grey as the editor's canvas background, so a missing page blends into it. */
export const MISSING_PAGE_COLOR = '#e8e8e8';
const FAR = 1000;

/** Bleed (red dashed), margins (blue dashed) and the spine. `pxPerMm` keeps the lines 1 px wide on screen. */
export function buildGuidesGroup(zine: Zine, spread: number, pxPerMm: number): Konva.Group {
  const px = 1 / pxPerMm;
  const dash = [4 * px, 3 * px];
  const group = new Konva.Group({ listening: false });
  for (const page of pagesOfSpread(spread, zine.sheets)) {
    const side = slotOfPage(page).side;
    group.add(new Konva.Rect({ ...pageRect(side, BLEED), stroke: GUIDE_COLORS.bleed, strokeWidth: px, dash, name: 'guide-bleed' }));
    group.add(new Konva.Rect({ ...marginRect(zine.margins, side), stroke: GUIDE_COLORS.margin, strokeWidth: px, dash, name: 'guide-margin' }));
  }
  group.add(
    new Konva.Line({
      points: [PAGE_WIDTH, -BLEED, PAGE_WIDTH, PAGE_HEIGHT + BLEED],
      stroke: GUIDE_COLORS.spine,
      strokeWidth: px,
      name: 'guide-spine',
    }),
  );
  return group;
}

/** The half of the spread where `side` has no page, reaching far outwards (never past the spine). */
function missingSideRect(side: Side): Rect {
  return side === 'left'
    ? { x: -FAR, y: -FAR, width: FAR + PAGE_WIDTH, height: PAGE_HEIGHT + 2 * FAR }
    : { x: PAGE_WIDTH, y: -FAR, width: PAGE_WIDTH + FAR, height: PAGE_HEIGHT + 2 * FAR };
}

/** Greys out what lies on the non-existing page next to a cover (it is never printed). */
export function buildMissingPagesShade(zine: Zine, spread: number): Konva.Group {
  const group = new Konva.Group({ listening: false });
  for (const side of ['left', 'right'] as const) {
    if (pageExists(pageAt(spread, side), zine.sheets)) continue;
    group.add(new Konva.Rect({ ...missingSideRect(side), fill: MISSING_PAGE_COLOR, opacity: 0.85, name: 'missing-page' }));
  }
  return group;
}
```

- [ ] **Step 9: Replace `src/render/assets.ts`**

Adds `bitmapOf` (the editor needs it for new photos) and an optional list of spreads (the cover thumbnail loads only spread 0).

```ts
import { imageIdsOfZine } from '../model/queries';
import type { Zine } from '../model/types';
import type { StoredImage } from '../storage/db';

export interface RenderAssets {
  images: Map<string, ImageBitmap>;
}

export function bitmapOf(image: StoredImage): Promise<ImageBitmap> {
  return createImageBitmap(new Blob([image.data], { type: image.mime }));
}

/** Bitmaps of the zine's photos; `spreads` limits it to some spreads (the cover thumbnail needs only spread 0). */
export async function loadRenderAssets(
  zine: Zine,
  getImage: (id: string) => Promise<StoredImage | undefined>,
  spreads?: number[],
): Promise<RenderAssets> {
  const source = spreads ? { ...zine, spreads: spreads.map((i) => zine.spreads[i]).filter(Boolean) } : zine;
  const images = new Map<string, ImageBitmap>();
  for (const id of imageIdsOfZine(source)) {
    const image = await getImage(id);
    if (image) images.set(id, await bitmapOf(image));
  }
  return { images };
}

export function releaseRenderAssets(assets: RenderAssets): void {
  for (const bitmap of assets.images.values()) bitmap.close();
  assets.images.clear();
}
```

- [ ] **Step 10: Replace `src/render/renderPage.ts`**

`renderSpread` gets `guides` and `shadeMissing`; `renderRegion` takes overlays drawn in the same transform.

```ts
import type Konva from 'konva';
import { BLEED, PAGE_HEIGHT, pageRect, slotOfPage, SPREAD_WIDTH, type Rect } from '../model/geometry';
import type { Zine } from '../model/types';
import type { RenderAssets } from './assets';
import { buildSpreadGroup } from './buildSpread';
import { buildGuidesGroup, buildMissingPagesShade } from './guides';
import { drawToCanvas } from './konvaCanvas';

export interface RenderOptions {
  pxPerMm: number;
}

export interface PixelSize {
  width: number;
  height: number;
}

export interface SpreadRenderOptions extends RenderOptions {
  /** Bleed, margin and spine lines (editor look). */
  guides?: boolean;
  /** Grey out the missing page next to a cover. */
  shadeMissing?: boolean;
}

/** Nodes drawn on top of the spread, in spread mm; gets the final pixels per mm. */
type Overlays = (pxPerMm: number) => Konva.Group[];

/**
 * Draws `region` so that it fills the canvas exactly, edge to edge. The canvas
 * has whole-pixel dimensions (by default the region at `pxPerMm`, rounded) and
 * the drawing is stretched by the sub-pixel rounding difference, so no edge
 * column or row is left partly transparent.
 */
function renderRegion(
  zine: Zine,
  spread: number,
  assets: RenderAssets,
  region: Rect,
  pxPerMm: number,
  size?: PixelSize,
  overlays?: Overlays,
) {
  const width = size?.width ?? Math.round(region.width * pxPerMm);
  const height = size?.height ?? Math.round(region.height * pxPerMm);
  const scaleX = width / region.width;
  const scaleY = height / region.height;
  return drawToCanvas(width, height, (layer) => {
    const group = buildSpreadGroup(zine, spread, assets);
    group.position({ x: -region.x * scaleX, y: -region.y * scaleY });
    group.scale({ x: scaleX, y: scaleY });
    for (const overlay of overlays?.(scaleX) ?? []) group.add(overlay);
    layer.add(group);
  });
}

/**
 * One page cut from its spread: bleed only on outer edges, a clean cut at the spine.
 * `sizePx` forces exact canvas dimensions (the imposed sheet uses it so both pages
 * meet on the same whole-pixel column at the fold).
 */
export function renderPage(
  zine: Zine,
  page: number,
  assets: RenderAssets,
  options: RenderOptions & { bleed: boolean; sizePx?: PixelSize },
): HTMLCanvasElement {
  const { spread, side } = slotOfPage(page);
  const region = pageRect(side, options.bleed ? BLEED : 0);
  return renderRegion(zine, spread, assets, region, options.pxPerMm, options.sizePx);
}

/** Whole spread with bleed on all sides (thumbnails), optionally with guides and the missing page greyed out. */
export function renderSpread(
  zine: Zine,
  spread: number,
  assets: RenderAssets,
  options: SpreadRenderOptions,
): HTMLCanvasElement {
  const region = { x: -BLEED, y: -BLEED, width: SPREAD_WIDTH + 2 * BLEED, height: PAGE_HEIGHT + 2 * BLEED };
  const overlays: Overlays = (pxPerMm) => [
    ...(options.shadeMissing ? [buildMissingPagesShade(zine, spread)] : []),
    ...(options.guides ? [buildGuidesGroup(zine, spread, pxPerMm)] : []),
  ];
  return renderRegion(zine, spread, assets, region, options.pxPerMm, undefined, overlays);
}
```

- [ ] **Step 11: Run the renderer and print tests**

Run: `npx vitest run src/render src/print src/model`
Expected: PASS.

- [ ] **Step 12: Commit**

```bash
git add src/model/geometry.ts src/model/marginRect.test.ts src/render
git commit -m "Share the text builder, tag element nodes and add guide overlays" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Undo history and autosave

**Files:**
- Create: `src/editor/state/history.ts`, `src/editor/state/autosave.ts`
- Test: `src/editor/state/history.test.ts`, `src/editor/state/autosave.test.ts`

- [ ] **Step 1: Write the failing test `src/editor/state/history.test.ts`**

```ts
import { expect, test } from 'vitest';
import { canRedo, canUndo, createHistory, HISTORY_LIMIT, record, redo, replacePresent, undo } from './history';

test('undo and redo walk through recorded states', () => {
  let h = createHistory('a');
  h = record(h, 'b');
  h = record(h, 'c');
  h = undo(h);
  expect(h.present).toBe('b');
  h = undo(h);
  expect(h.present).toBe('a');
  expect(canUndo(h)).toBe(false);
  h = redo(h);
  expect(h.present).toBe('b');
  expect(canRedo(h)).toBe(true);
});

test('recording after an undo drops the redo branch', () => {
  let h = record(record(createHistory('a'), 'b'), 'c');
  h = record(undo(h), 'x');
  expect(h.future).toEqual([]);
  expect(undo(h).present).toBe('b');
});

test('changes with the same key merge into one step; other keys do not', () => {
  let h = createHistory('');
  h = record(h, 'A', 'title');
  h = record(h, 'Al', 'title');
  h = record(h, 'Ala', 'title');
  expect(undo(h).present).toBe('');
  h = record(h, 'Ala!', null);
  h = record(h, 'Ala!!', null);
  expect(undo(h).present).toBe('Ala!');
});

test('a key does not merge across an undo', () => {
  let h = record(record(createHistory(0), 1, 'k'), 2, 'k');
  h = undo(h);
  h = record(h, 5, 'k');
  expect(h.past).toEqual([0]);
});

test(`keeps at most ${HISTORY_LIMIT} undo steps`, () => {
  let h = createHistory(0);
  for (let i = 1; i <= 150; i++) h = record(h, i);
  expect(h.past).toHaveLength(HISTORY_LIMIT);
  expect(h.past[0]).toBe(50);
});

test('recording the same value or replacing the present adds no step', () => {
  const h = createHistory('a');
  expect(record(h, 'a')).toBe(h);
  expect(replacePresent(h, 'b')).toEqual({ past: [], present: 'b', future: [], lastKey: null });
});
```

- [ ] **Step 2: Run it**

Run: `npx vitest run --project unit src/editor/state/history.test.ts`
Expected: FAIL, `./history` cannot be resolved.

- [ ] **Step 3: Write `src/editor/state/history.ts`**

```ts
export const HISTORY_LIMIT = 100;

/** Undo stack for one open zine, in memory only. */
export interface History<T> {
  past: T[];
  present: T;
  future: T[];
  /** Key of the last recorded change; a change with the same key merges into it. */
  lastKey: string | null;
}

export function createHistory<T>(present: T): History<T> {
  return { past: [], present, future: [], lastKey: null };
}

/**
 * Records `next` as a new undo step (at most HISTORY_LIMIT are kept). Consecutive changes with
 * the same non-null key (typing in a field, dragging a slider) merge into one step.
 */
export function record<T>(history: History<T>, next: T, key: string | null = null): History<T> {
  if (next === history.present) return history;
  if (key !== null && key === history.lastKey) return { ...history, present: next, future: [] };
  return { past: [...history.past, history.present].slice(-HISTORY_LIMIT), present: next, future: [], lastKey: key };
}

/** Replaces the present without an undo step (derived data, such as re-measured text heights). */
export function replacePresent<T>(history: History<T>, next: T): History<T> {
  return { ...history, present: next };
}

export function undo<T>(history: History<T>): History<T> {
  if (history.past.length === 0) return history;
  return {
    past: history.past.slice(0, -1),
    present: history.past[history.past.length - 1],
    future: [history.present, ...history.future],
    lastKey: null,
  };
}

export function redo<T>(history: History<T>): History<T> {
  if (history.future.length === 0) return history;
  return {
    past: [...history.past, history.present],
    present: history.future[0],
    future: history.future.slice(1),
    lastKey: null,
  };
}

export const canUndo = (history: History<unknown>) => history.past.length > 0;
export const canRedo = (history: History<unknown>) => history.future.length > 0;
```

- [ ] **Step 4: Run it**

Run: `npx vitest run --project unit src/editor/state/history.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Write the failing test `src/editor/state/autosave.test.ts`**

```ts
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createZine } from '../../model/factory';
import type { Zine } from '../../model/types';
import { createAutosaver, whenSavesSettled } from './autosave';

const NOW = new Date('2026-10-14T12:00:00.000Z');

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

test('saves once, 500 ms after the last change, with a fresh updatedAt', async () => {
  const save = vi.fn(async (_zine: Zine) => {});
  const saver = createAutosaver(save, { onError: vi.fn(), now: () => NOW });
  const zine = createZine('A', 1);
  saver.schedule(zine);
  await vi.advanceTimersByTimeAsync(300);
  saver.schedule({ ...zine, title: 'B' });
  await vi.advanceTimersByTimeAsync(499);
  expect(save).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);
  expect(save).toHaveBeenCalledTimes(1);
  expect(save.mock.calls[0][0]).toMatchObject({ title: 'B', updatedAt: NOW.toISOString() });
});

test('flush saves right away and whenSavesSettled waits for it', async () => {
  let finish!: () => void;
  const save = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
  const saver = createAutosaver(save, { onError: vi.fn() });
  saver.schedule(createZine('A', 1));
  void saver.flush();
  await vi.advanceTimersByTimeAsync(0);
  expect(save).toHaveBeenCalledTimes(1);
  let settled = false;
  void whenSavesSettled().then(() => (settled = true));
  await vi.advanceTimersByTimeAsync(0);
  expect(settled).toBe(false);
  finish();
  await vi.advanceTimersByTimeAsync(0);
  expect(settled).toBe(true);
  await vi.advanceTimersByTimeAsync(1000);
  expect(save).toHaveBeenCalledTimes(1);
});

test('a failed save is reported and later saves still run', async () => {
  const onError = vi.fn();
  const save = vi.fn().mockRejectedValueOnce(new Error('full')).mockResolvedValue(undefined);
  const saver = createAutosaver(save, { onError });
  saver.schedule(createZine('A', 1));
  await saver.flush();
  expect(onError).toHaveBeenCalledTimes(1);
  saver.schedule(createZine('B', 1));
  await saver.flush();
  expect(save).toHaveBeenCalledTimes(2);
});
```

- [ ] **Step 6: Run it**

Run: `npx vitest run --project unit src/editor/state/autosave.test.ts`
Expected: FAIL, `./autosave` cannot be resolved.

- [ ] **Step 7: Write `src/editor/state/autosave.ts`**

```ts
import type { Zine } from '../../model/types';

export const AUTOSAVE_DELAY_MS = 500;

const inFlight = new Set<Promise<void>>();

/**
 * Resolves when every save started so far has finished. The zine list awaits it before
 * pruning unused photos, so a photo added just before leaving the editor is never deleted.
 */
export async function whenSavesSettled(): Promise<void> {
  await Promise.allSettled([...inFlight]);
}

export interface Autosaver {
  /** Saves `zine` AUTOSAVE_DELAY_MS after the last call. */
  schedule(zine: Zine): void;
  /** Saves a scheduled zine right away (leaving the editor). */
  flush(): Promise<void>;
}

export interface AutosaveOptions {
  delayMs?: number;
  onError(error: unknown): void;
  now?: () => Date;
}

export function createAutosaver(save: (zine: Zine) => Promise<void>, options: AutosaveOptions): Autosaver {
  const delay = options.delayMs ?? AUTOSAVE_DELAY_MS;
  const now = options.now ?? (() => new Date());
  let pending: Zine | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let chain: Promise<void> = Promise.resolve();

  const run = (): Promise<void> => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    const zine = pending;
    pending = null;
    if (!zine) return chain;
    // One save at a time, in order, so an older version never lands after a newer one.
    const job = chain.then(() => save({ ...zine, updatedAt: now().toISOString() })).catch(options.onError);
    chain = job;
    inFlight.add(job);
    void job.finally(() => inFlight.delete(job));
    return job;
  };

  return {
    schedule(zine) {
      pending = zine;
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(() => void run(), delay);
    },
    flush: run,
  };
}
```

- [ ] **Step 8: Run it**

Run: `npx vitest run --project unit src/editor/state`
Expected: PASS (9 tests).

- [ ] **Step 9: Commit**

```bash
git add src/editor/state
git commit -m "Add undo history with merge keys and ordered autosave" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Zine edit commands, layers, clipboard

Pure functions that return a new zine (or the same object when nothing changes, so no empty undo step is recorded).

**Files:**
- Create: `src/editor/state/commands.ts`, `src/editor/state/layers.ts`, `src/editor/state/clipboard.ts`
- Test: `src/editor/state/commands.test.ts`, `src/editor/state/layers.test.ts`, `src/editor/state/clipboard.test.ts`

- [ ] **Step 1: Write the failing tests**

`src/editor/state/commands.test.ts`:

```ts
import { expect, test } from 'vitest';
import { createPhotoElement, createTextElement, createZine } from '../../model/factory';
import {
  addElement,
  addFontFamilies,
  findElement,
  mapElement,
  patchElement,
  removeElement,
  setMargins,
  setPageBackground,
  setTitle,
} from './commands';

test('add, find, patch and remove elements without touching other spreads', () => {
  const zine = createZine('t', 1);
  const text = createTextElement({ text: 'a' });
  const added = addElement(zine, 1, text);
  expect(zine.spreads[1].elements).toEqual([]);
  expect(added.spreads[0]).toBe(zine.spreads[0]);
  expect(findElement(added, 1, text.id)).toBe(text);
  const moved = mapElement(added, 1, text.id, (e) => patchElement(e, { x: 12 }));
  expect(findElement(moved, 1, text.id)?.x).toBe(12);
  expect(findElement(added, 1, text.id)?.x).toBe(0);
  expect(removeElement(moved, 1, text.id).spreads[1].elements).toEqual([]);
});

test('missing elements leave the zine untouched', () => {
  const zine = createZine('t', 1);
  expect(mapElement(zine, 1, 'nope', (e) => patchElement(e, { x: 1 }))).toBe(zine);
  expect(removeElement(zine, 1, 'nope')).toBe(zine);
  expect(findElement(zine, 7, 'nope')).toBeUndefined();
});

test('new elements go on top', () => {
  const photo = createPhotoElement('img');
  const text = createTextElement();
  const zine = addElement(addElement(createZine('t', 1), 1, photo), 1, text);
  expect(zine.spreads[1].elements.map((e) => e.id)).toEqual([photo.id, text.id]);
});

test('page background, margins, title', () => {
  const zine = setPageBackground(createZine('t', 1), 2, '#ff0000');
  expect(zine.pages[2]).toEqual({ background: '#ff0000' });
  expect(setPageBackground(zine, 2, null).pages).toEqual({});
  expect(setMargins(zine, { outer: 1, inner: 2, top: 3, bottom: 4 }).margins).toEqual({ outer: 1, inner: 2, top: 3, bottom: 4 });
  expect(setTitle(zine, 'Nowy').title).toBe('Nowy');
});

test('addFontFamilies skips families already on the list', () => {
  const zine = { ...createZine('t', 1), fonts: ['a'] };
  expect(addFontFamilies(zine, ['a', 'b', 'b']).fonts).toEqual(['a', 'b']);
  expect(addFontFamilies(zine, ['a'])).toBe(zine);
});
```

`src/editor/state/layers.test.ts`:

```ts
import { expect, test } from 'vitest';
import { createTextElement } from '../../model/factory';
import { canMoveLayer, moveLayer } from './layers';

const [a, b, c] = ['a', 'b', 'c'].map((id) => createTextElement({ id }));
const ids = (elements: { id: string }[]) => elements.map((e) => e.id).join('');

test('moves an element to the front, forward, backward and to the back', () => {
  const elements = [a, b, c];
  expect(ids(moveLayer(elements, 'a', 'front'))).toBe('bca');
  expect(ids(moveLayer(elements, 'a', 'forward'))).toBe('bac');
  expect(ids(moveLayer(elements, 'c', 'backward'))).toBe('acb');
  expect(ids(moveLayer(elements, 'c', 'back'))).toBe('cab');
});

test('a move that changes nothing returns the same array', () => {
  const elements = [a, b, c];
  expect(moveLayer(elements, 'c', 'front')).toBe(elements);
  expect(moveLayer(elements, 'x', 'back')).toBe(elements);
  expect(canMoveLayer(elements, 'c', 'forward')).toBe(false);
  expect(canMoveLayer(elements, 'c', 'back')).toBe(true);
});
```

`src/editor/state/clipboard.test.ts`:

```ts
import { expect, test } from 'vitest';
import { createPhotoElement } from '../../model/factory';
import { cloneForPaste, PASTE_OFFSET } from './clipboard';

test('a pasted copy gets a new id and a deep copy of the crop', () => {
  const photo = createPhotoElement('img', { x: 10, y: 20 });
  const copy = cloneForPaste(photo, []);
  expect(copy.id).not.toBe(photo.id);
  expect(copy).toMatchObject({ kind: 'photo', imageId: 'img', x: 10, y: 20 });
  expect(copy.kind === 'photo' && copy.crop).not.toBe(photo.crop);
});

test('the copy steps aside while it would cover an element exactly', () => {
  const photo = createPhotoElement('img', { x: 10, y: 20 });
  const shifted = createPhotoElement('img', { x: 10 + PASTE_OFFSET, y: 20 + PASTE_OFFSET });
  expect(cloneForPaste(photo, [photo])).toMatchObject({ x: 15, y: 25 });
  expect(cloneForPaste(photo, [photo, shifted])).toMatchObject({ x: 20, y: 30 });
});
```

- [ ] **Step 2: Run them**

Run: `npx vitest run --project unit src/editor/state/commands.test.ts src/editor/state/layers.test.ts src/editor/state/clipboard.test.ts`
Expected: FAIL, the three modules cannot be resolved.

- [ ] **Step 3: Write `src/editor/state/commands.ts`**

```ts
import type { Margins, PhotoElement, TextElement, Zine, ZineElement } from '../../model/types';

/** Fields of either element kind; the store only passes fields that fit the element. */
export type ElementPatch = Partial<Omit<PhotoElement, 'kind' | 'id' | 'imageId'>> & Partial<Omit<TextElement, 'kind' | 'id'>>;

export function findElement(zine: Zine, spread: number, id: string): ZineElement | undefined {
  return zine.spreads[spread]?.elements.find((e) => e.id === id);
}

export function updateSpreadElements(
  zine: Zine,
  spread: number,
  update: (elements: ZineElement[]) => ZineElement[],
): Zine {
  const current = zine.spreads[spread];
  if (!current) return zine;
  const elements = update(current.elements);
  if (elements === current.elements) return zine;
  return { ...zine, spreads: zine.spreads.map((s, i) => (i === spread ? { ...s, elements } : s)) };
}

/** Replaces one element; returns the same zine when the element is missing or unchanged. */
export function mapElement(zine: Zine, spread: number, id: string, update: (element: ZineElement) => ZineElement): Zine {
  return updateSpreadElements(zine, spread, (elements) => {
    const index = elements.findIndex((e) => e.id === id);
    if (index < 0) return elements;
    const next = update(elements[index]);
    return next === elements[index] ? elements : elements.map((e, i) => (i === index ? next : e));
  });
}

export function patchElement(element: ZineElement, patch: ElementPatch): ZineElement {
  return { ...element, ...patch } as ZineElement;
}

/** Adds on top of everything else on the spread. */
export function addElement(zine: Zine, spread: number, element: ZineElement): Zine {
  return updateSpreadElements(zine, spread, (elements) => [...elements, element]);
}

export function removeElement(zine: Zine, spread: number, id: string): Zine {
  return updateSpreadElements(zine, spread, (elements) =>
    elements.some((e) => e.id === id) ? elements.filter((e) => e.id !== id) : elements,
  );
}

/** `null` goes back to white (no entry). */
export function setPageBackground(zine: Zine, page: number, color: string | null): Zine {
  const pages = { ...zine.pages };
  if (color === null) delete pages[page];
  else pages[page] = { background: color };
  return { ...zine, pages };
}

export function setMargins(zine: Zine, margins: Margins): Zine {
  return { ...zine, margins };
}

export function setTitle(zine: Zine, title: string): Zine {
  return { ...zine, title };
}

/** Adds custom font families to the zine's list (no duplicates, order kept). */
export function addFontFamilies(zine: Zine, familyIds: string[]): Zine {
  const fresh = familyIds.filter((id, i) => !zine.fonts.includes(id) && familyIds.indexOf(id) === i);
  return fresh.length ? { ...zine, fonts: [...zine.fonts, ...fresh] } : zine;
}
```

- [ ] **Step 4: Write `src/editor/state/layers.ts`**

```ts
import type { ZineElement } from '../../model/types';

/** "na wierzch", "wyżej", "niżej", "na spód". The last element is drawn on top. */
export type LayerOp = 'front' | 'forward' | 'backward' | 'back';

function targetIndex(length: number, from: number, op: LayerOp): number {
  const last = length - 1;
  if (op === 'front') return last;
  if (op === 'back') return 0;
  return op === 'forward' ? Math.min(last, from + 1) : Math.max(0, from - 1);
}

export function moveLayer(elements: ZineElement[], id: string, op: LayerOp): ZineElement[] {
  const from = elements.findIndex((e) => e.id === id);
  if (from < 0) return elements;
  const to = targetIndex(elements.length, from, op);
  if (to === from) return elements;
  const result = elements.filter((e) => e.id !== id);
  result.splice(to, 0, elements[from]);
  return result;
}

export function canMoveLayer(elements: ZineElement[], id: string, op: LayerOp): boolean {
  const from = elements.findIndex((e) => e.id === id);
  return from >= 0 && targetIndex(elements.length, from, op) !== from;
}
```

- [ ] **Step 5: Write `src/editor/state/clipboard.ts`**

```ts
import { newId } from '../../model/ids';
import type { ZineElement } from '../../model/types';

export const PASTE_OFFSET = 5;

const samePlace = (a: { x: number; y: number }, x: number, y: number) => Math.abs(a.x - x) < 0.01 && Math.abs(a.y - y) < 0.01;

/** A copy with a new id, moved by 5 mm (repeatedly) while it would sit exactly on an element of the target spread. */
export function cloneForPaste(element: ZineElement, target: ZineElement[]): ZineElement {
  let { x, y } = element;
  while (target.some((e) => samePlace(e, x, y))) {
    x += PASTE_OFFSET;
    y += PASTE_OFFSET;
  }
  return { ...structuredClone(element), id: newId(), x, y };
}
```

- [ ] **Step 6: Run them**

Run: `npx vitest run --project unit src/editor/state`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/editor/state
git commit -m "Add pure zine edit commands, layer order and paste copies" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Editor geometry: placement, snapping, colours

**Files:**
- Create: `src/editor/geometry/placement.ts`, `src/editor/geometry/snapping.ts`, `src/editor/colors.ts`
- Test: `src/editor/geometry/placement.test.ts`, `src/editor/geometry/snapping.test.ts`, `src/editor/colors.test.ts`

- [ ] **Step 1: Write the failing tests**

`src/editor/geometry/placement.test.ts`:

```ts
import { expect, test } from 'vitest';
import { createZine } from '../../model/factory';
import { cascade, defaultPage, fitPhotoFrame, frameFromCentre, insertArea, newTextFrame, pageAtPoint } from './placement';

test('pageAtPoint finds existing pages, bleed included', () => {
  expect(pageAtPoint(1, 1, 10, 100)).toBe(2);
  expect(pageAtPoint(1, 1, 200, 100)).toBe(3);
  expect(pageAtPoint(1, 1, -2, 212)).toBe(2);
  expect(pageAtPoint(1, 1, 10, 220)).toBeNull();
  expect(pageAtPoint(0, 1, 10, 100)).toBeNull(); // left of the front cover
  expect(pageAtPoint(0, 1, 200, 100)).toBe(1);
});

test('defaultPage is the first existing page', () => {
  expect(defaultPage(0, 2)).toBe(1);
  expect(defaultPage(2, 2)).toBe(4);
  expect(defaultPage(4, 2)).toBe(8);
});

test('insertArea is the margin area, or the page when margins leave too little', () => {
  const zine = createZine('t', 1);
  expect(insertArea(zine, 3)).toEqual({ x: 178, y: 30, width: 88, height: 150 });
  zine.margins = { outer: 70, inner: 70, top: 30, bottom: 30 };
  expect(insertArea(zine, 2)).toEqual({ x: 0, y: 0, width: 148, height: 210 });
});

test('fitPhotoFrame keeps proportions, centred in the area', () => {
  expect(fitPhotoFrame({ x: 30, y: 30, width: 88, height: 150 }, 200, 100)).toEqual({ x: 30, y: 83, width: 88, height: 44 });
  expect(fitPhotoFrame({ x: 0, y: 0, width: 100, height: 100 }, 100, 200)).toEqual({ x: 25, y: 0, width: 50, height: 100 });
});

test('a new text frame spans the margins of its page', () => {
  expect(newTextFrame(createZine('t', 1), 1)).toEqual({ x: 178, y: 30, width: 88 });
});

test('cascade and frameFromCentre', () => {
  expect(cascade({ x: 1, y: 2, width: 3 }, 2)).toEqual({ x: 11, y: 12, width: 3 });
  expect(frameFromCentre(50, 70, 60, 40, 15)).toEqual({ x: 20, y: 50, width: 60, height: 40, rotation: 15 });
});
```

`src/editor/geometry/snapping.test.ts` (spread 1 of a 1-sheet zine: pages 2 and 3, margins 30 mm):

```ts
import { expect, test } from 'vitest';
import { createPhotoElement, createZine } from '../../model/factory';
import { snapBox, snapPoint, snapTargets } from './snapping';

test('targets: page edges and centres, margins, spine and other elements', () => {
  const zine = createZine('t', 1);
  const other = createPhotoElement('i', { x: 40, y: 50, width: 20, height: 10 });
  const moving = createPhotoElement('i', { x: 0, y: 0, width: 5, height: 5 });
  zine.spreads[1].elements.push(other, moving);
  const targets = snapTargets(zine, 1, moving.id);
  expect(targets.xs).toEqual([0, 30, 40, 50, 60, 74, 118, 148, 178, 222, 266, 296]);
  expect(targets.ys).toEqual([0, 30, 50, 55, 60, 105, 180, 210]);
});

test('the cover spread only snaps to the cover page and the spine', () => {
  expect(snapTargets(createZine('t', 1), 0, null).xs).toEqual([148, 178, 222, 266, 296]);
});

test('snapBox picks the closest edge or centre within the threshold', () => {
  const targets = { xs: [30, 148], ys: [30] };
  expect(snapBox({ x: 31, y: 100, width: 20, height: 20 }, targets, 2)).toEqual({ dx: -1, dy: 0, lineX: 30, lineY: null });
  expect(snapBox({ x: 100, y: 19.5, width: 20, height: 20 }, targets, 2)).toEqual({ dx: 0, dy: 0.5, lineX: null, lineY: 30 });
  expect(snapBox({ x: 137, y: 0, width: 20, height: 0 }, targets, 2)).toMatchObject({ dx: 1, lineX: 148 });
  expect(snapBox({ x: 34, y: 100, width: 20, height: 20 }, targets, 2).dx).toBe(0);
});

test('snapPoint moves a single coordinate', () => {
  expect(snapPoint(29, [30], 2)).toEqual({ value: 30, line: 30 });
  expect(snapPoint(25, [30], 2)).toEqual({ value: 25, line: null });
});
```

`src/editor/colors.test.ts`:

```ts
import { expect, test } from 'vitest';
import { createTextElement, createZine } from '../model/factory';
import { normalizeHex, swatches, usedColors } from './colors';

test('normalizeHex accepts short and long forms, with or without #', () => {
  expect(normalizeHex('#ABC')).toBe('#aabbcc');
  expect(normalizeHex('ff0000')).toBe('#ff0000');
  expect(normalizeHex(' #12ab9F ')).toBe('#12ab9f');
  expect(normalizeHex('red')).toBeNull();
  expect(normalizeHex('#12345')).toBeNull();
});

test('usedColors lists page backgrounds by page number, then text colours, once each', () => {
  const zine = createZine('t', 1);
  zine.pages[3] = { background: '#00FF00' };
  zine.pages[1] = { background: '#ff0000' };
  zine.spreads[1].elements.push(createTextElement({ color: '#ff0000' }), createTextElement({ color: '#123456' }));
  expect(usedColors(zine)).toEqual(['#ff0000', '#00ff00', '#123456']);
  expect(usedColors(zine, 2)).toHaveLength(2);
  expect(swatches(zine)).toEqual(['#000000', '#ffffff', '#ff0000', '#00ff00', '#123456']);
});
```

- [ ] **Step 2: Run them**

Run: `npx vitest run --project unit src/editor/geometry src/editor/colors.test.ts`
Expected: FAIL, the modules cannot be resolved.

- [ ] **Step 3: Write `src/editor/geometry/placement.ts`**

```ts
import {
  BLEED,
  marginRect,
  PAGE_HEIGHT,
  PAGE_WIDTH,
  pageAt,
  pageExists,
  pageRect,
  pagesOfSpread,
  slotOfPage,
  SPREAD_WIDTH,
  type Rect,
} from '../../model/geometry';
import type { Frame, Zine } from '../../model/types';

/** Each further photo of one drop or paste lands this many mm lower and to the right. */
export const CASCADE_STEP = 5;
/** Margin areas smaller than this fall back to the whole page. */
const MIN_AREA = 10;

/** The existing page under a point in spread mm (the bleed counts as the page), or null. */
export function pageAtPoint(spread: number, sheets: number, x: number, y: number): number | null {
  if (x < -BLEED || x > SPREAD_WIDTH + BLEED || y < -BLEED || y > PAGE_HEIGHT + BLEED) return null;
  const page = pageAt(spread, x < PAGE_WIDTH ? 'left' : 'right');
  return pageExists(page, sheets) ? page : null;
}

/** Where "+ Zdjęcie" and "+ Napis" go when no page was clicked: the first existing page of the spread. */
export function defaultPage(spread: number, sheets: number): number {
  return pagesOfSpread(spread, sheets)[0];
}

/** Area new photos and texts fill: between the margins, or the whole page when the margins leave too little. */
export function insertArea(zine: Zine, page: number): Rect {
  const side = slotOfPage(page).side;
  const area = marginRect(zine.margins, side);
  return area.width >= MIN_AREA && area.height >= MIN_AREA ? area : pageRect(side, 0);
}

/** The largest frame with the image's proportions inside `area`, centred. */
export function fitPhotoFrame(area: Rect, imageWidth: number, imageHeight: number): Rect {
  const scale = Math.min(area.width / imageWidth, area.height / imageHeight);
  const width = imageWidth * scale;
  const height = imageHeight * scale;
  return { x: area.x + (area.width - width) / 2, y: area.y + (area.height - height) / 2, width, height };
}

/** A new text frame: from margin to margin of the page, at the top margin. Height comes from the text. */
export function newTextFrame(zine: Zine, page: number): { x: number; y: number; width: number } {
  const area = insertArea(zine, page);
  return { x: area.x, y: area.y, width: area.width };
}

export function cascade<T extends { x: number; y: number }>(rect: T, index: number): T {
  return { ...rect, x: rect.x + index * CASCADE_STEP, y: rect.y + index * CASCADE_STEP };
}

/** Frame from its centre (Konva nodes are positioned by their centre), size and rotation. */
export function frameFromCentre(cx: number, cy: number, width: number, height: number, rotation: number): Omit<Frame, 'id'> {
  return { x: cx - width / 2, y: cy - height / 2, width, height, rotation };
}
```

- [ ] **Step 4: Write `src/editor/geometry/snapping.ts`**

```ts
import { frameBounds, marginRect, PAGE_WIDTH, pageRect, pagesOfSpread, slotOfPage, type Rect } from '../../model/geometry';
import type { Zine } from '../../model/types';

/** Lines (spread mm) an element snaps to: vertical lines in `xs`, horizontal in `ys`. */
export interface SnapTargets {
  xs: number[];
  ys: number[];
}

export interface SnapResult {
  dx: number;
  dy: number;
  /** The line that caught the box, to draw while dragging. */
  lineX: number | null;
  lineY: number | null;
}

const unique = (values: number[]) => [...new Set(values.map((v) => Math.round(v * 1000) / 1000))].sort((a, b) => a - b);

/** Margins, page edges and centres, the spine, and edges and centres of the other elements on the spread. */
export function snapTargets(zine: Zine, spread: number, excludeId: string | null): SnapTargets {
  const xs = [PAGE_WIDTH];
  const ys: number[] = [];
  for (const page of pagesOfSpread(spread, zine.sheets)) {
    const side = slotOfPage(page).side;
    const r = pageRect(side, 0);
    const m = marginRect(zine.margins, side);
    xs.push(r.x, r.x + r.width / 2, r.x + r.width, m.x, m.x + m.width);
    ys.push(r.y, r.y + r.height / 2, r.y + r.height, m.y, m.y + m.height);
  }
  for (const element of zine.spreads[spread].elements) {
    if (element.id === excludeId) continue;
    const b = frameBounds(element);
    xs.push(b.x, b.x + b.width / 2, b.x + b.width);
    ys.push(b.y, b.y + b.height / 2, b.y + b.height);
  }
  return { xs: unique(xs), ys: unique(ys) };
}

function bestShift(edges: number[], targets: number[], threshold: number): { shift: number; line: number } | null {
  let best: { shift: number; line: number } | null = null;
  for (const edge of edges) {
    for (const target of targets) {
      const shift = target - edge;
      if (Math.abs(shift) <= threshold && (!best || Math.abs(shift) < Math.abs(best.shift))) best = { shift, line: target };
    }
  }
  return best;
}

/** Moves a box so its nearest edge or centre lands on a target line within `threshold` mm (each axis apart). */
export function snapBox(box: Rect, targets: SnapTargets, threshold: number): SnapResult {
  const x = bestShift([box.x, box.x + box.width / 2, box.x + box.width], targets.xs, threshold);
  const y = bestShift([box.y, box.y + box.height / 2, box.y + box.height], targets.ys, threshold);
  return { dx: x?.shift ?? 0, dy: y?.shift ?? 0, lineX: x?.line ?? null, lineY: y?.line ?? null };
}

/** Snaps one coordinate (a resize handle) to the nearest target within `threshold`. */
export function snapPoint(value: number, targets: number[], threshold: number): { value: number; line: number | null } {
  const best = bestShift([value], targets, threshold);
  return best ? { value: best.line, line: best.line } : { value, line: null };
}
```

- [ ] **Step 5: Write `src/editor/colors.ts`**

```ts
import type { Zine } from '../model/types';

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** "#ABC", "abc", "#aabbcc" → "#aabbcc"; anything else → null. */
export function normalizeHex(input: string): string | null {
  const match = HEX.exec(input.trim());
  if (!match) return null;
  const hex = match[1].length === 3 ? [...match[1]].map((c) => c + c).join('') : match[1];
  return `#${hex.toLowerCase()}`;
}

export const BASE_SWATCHES = ['#000000', '#ffffff'];

/** Colours already used in the zine: page backgrounds (by page number), then text colours. */
export function usedColors(zine: Zine, limit = 16): string[] {
  const seen: string[] = [];
  const add = (color: string) => {
    const hex = normalizeHex(color);
    if (hex && !seen.includes(hex)) seen.push(hex);
  };
  for (const page of Object.keys(zine.pages).map(Number).sort((a, b) => a - b)) add(zine.pages[page].background);
  for (const spread of zine.spreads) {
    for (const element of spread.elements) if (element.kind === 'text') add(element.color);
  }
  return seen.slice(0, limit);
}

/** Swatches for the colour picker: black and white, then the zine's colours. */
export function swatches(zine: Zine): string[] {
  return [...new Set([...BASE_SWATCHES, ...usedColors(zine)])];
}
```

- [ ] **Step 6: Run them**

Run: `npx vitest run --project unit src/editor/geometry src/editor/colors.test.ts`
Expected: PASS (12 tests).

- [ ] **Step 7: Commit**

```bash
git add src/editor/geometry src/editor/colors.ts src/editor/colors.test.ts
git commit -m "Add placement, snapping and colour helpers for the editor" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: The editor store (Zustand)

One vanilla store per open zine. It never imports Konva: text measuring and image sizes come in `EditorDeps`, so the whole store is tested in Node.

**Files:**
- Create: `src/editor/state/store.ts`
- Test: `src/editor/state/store.test.ts`

- [ ] **Step 1: Write the failing test `src/editor/state/store.test.ts`**

```ts
import { describe, expect, test } from 'vitest';
import { createPhotoElement, createTextElement, createZine } from '../../model/factory';
import type { PhotoElement, TextElement } from '../../model/types';
import { createEditorStore, MAX_CROP_ZOOM, selectCanRedo, selectCanUndo, selectedElement, selectZine } from './store';

const deps = {
  measureText: (e: TextElement) => e.text.split('\n').length * 5,
  imageSize: () => ({ width: 200, height: 100 }),
};

function setup(sheets = 2) {
  const store = createEditorStore(createZine('Zin', sheets), deps);
  return { store, s: () => store.getState(), zine: () => selectZine(store.getState()) };
}

describe('elements', () => {
  test('addElement measures text, selects it, and undo/redo work', () => {
    const { s, zine } = setup();
    s().setSpread(1);
    const text = createTextElement({ text: 'a\nb' });
    s().addElement(text);
    expect(zine().spreads[1].elements[0]).toMatchObject({ id: text.id, height: 10 });
    expect(s().selectedId).toBe(text.id);
    expect(selectCanUndo(s())).toBe(true);
    s().undo();
    expect(zine().spreads[1].elements).toEqual([]);
    expect(s().selectedId).toBeNull();
    s().redo();
    expect(zine().spreads[1].elements).toHaveLength(1);
    expect(selectCanRedo(s())).toBe(false);
  });

  test('changes with the same key are one undo step', () => {
    const { s, zine } = setup();
    const text = createTextElement({ text: '' });
    s().addElement(text);
    for (const value of ['A', 'Al', 'Ala']) s().updateElement(text.id, { text: value }, `text:${text.id}`);
    expect((zine().spreads[0].elements[0] as TextElement).text).toBe('Ala');
    s().undo();
    expect((zine().spreads[0].elements[0] as TextElement).text).toBe('');
  });

  test('photo crops stay valid: zoom at most 5, the frame stays covered', () => {
    const { s, zine } = setup();
    const photo = createPhotoElement('img', { width: 100, height: 100 });
    s().addElement(photo);
    s().updateElement(photo.id, { crop: { offsetX: 999, offsetY: 0, zoom: 9 } });
    const crop = (zine().spreads[0].elements[0] as PhotoElement).crop;
    expect(crop.zoom).toBe(MAX_CROP_ZOOM);
    expect(crop.offsetX).toBe(450); // (200 * 5 - 100) / 2
  });

  test('delete, nudge, layers', () => {
    const { s, zine } = setup();
    const a = createTextElement({ text: 'a', x: 10 });
    const b = createTextElement({ text: 'b' });
    s().addElement(a);
    s().addElement(b);
    s().moveSelectedLayer('back');
    expect(zine().spreads[0].elements.map((e) => e.id)).toEqual([b.id, a.id]);
    s().select(a.id);
    s().nudgeSelected(1, -10);
    expect(selectedElement(s())).toMatchObject({ x: 11, y: -10 });
    s().deleteSelected();
    expect(zine().spreads[0].elements.map((e) => e.id)).toEqual([b.id]);
    expect(s().selectedId).toBeNull();
  });
});

describe('clipboard', () => {
  test('copy on one spread, paste on another, paste again steps aside', () => {
    const { s, zine } = setup();
    s().setSpread(1);
    const text = createTextElement({ text: 'x', x: 20, y: 30 });
    s().addElement(text);
    s().copySelected();
    s().setSpread(2);
    s().paste();
    s().paste();
    const pasted = zine().spreads[2].elements;
    expect(pasted.map((e) => [e.x, e.y])).toEqual([
      [20, 30],
      [25, 35],
    ]);
    expect(pasted[0].id).not.toBe(text.id);
    expect(s().selectedId).toBe(pasted[1].id);
  });

  test('duplicate selects the copy, 5 mm aside', () => {
    const { s, zine } = setup();
    s().addElement(createTextElement({ text: 'x', x: 20, y: 30 }));
    s().duplicateSelected();
    expect(zine().spreads[0].elements).toHaveLength(2);
    expect(selectedElement(s())).toMatchObject({ x: 25, y: 35 });
  });
});

describe('spreads and sheets', () => {
  test('setSpread clamps and clears the selection and the active page', () => {
    const { s } = setup(2);
    s().addElement(createTextElement());
    s().clickPage(1);
    s().setSpread(99);
    expect(s()).toMatchObject({ spread: 4, selectedId: null, activePage: null });
  });

  test('removing a sheet keeps the current spread index valid; undo brings it back', () => {
    const { s, zine } = setup(2);
    s().setSpread(4);
    s().removeSheet();
    expect(zine().sheets).toBe(1);
    expect(s().spread).toBe(2);
    s().undo();
    expect(zine().sheets).toBe(2);
    s().addSheet();
    expect(zine().sheets).toBe(3);
  });
});

describe('modes and selection', () => {
  test('selecting the already selected element keeps crop mode; another element ends it', () => {
    const { s } = setup();
    const a = createPhotoElement('img');
    const b = createPhotoElement('img');
    s().addElement(b);
    s().addElement(a);
    s().setMode('crop');
    s().select(a.id);
    expect(s().mode).toBe('crop');
    s().select(b.id);
    expect(s().mode).toBe('idle');
  });

  test('clicking a page deselects and remembers the page', () => {
    const { s } = setup();
    s().addElement(createTextElement());
    s().clickPage(1);
    expect(s()).toMatchObject({ selectedId: null, activePage: 1 });
  });
});

test('refreshTextHeights updates heights without an undo step', () => {
  let lines = 1;
  const store = createEditorStore(createZine('t', 1), { ...deps, measureText: () => lines * 5 });
  store.getState().addElement(createTextElement({ text: 'a' }));
  const pastLength = store.getState().history.past.length;
  lines = 3;
  store.getState().refreshTextHeights();
  expect(selectZine(store.getState()).spreads[0].elements[0].height).toBe(15);
  expect(store.getState().history.past.length).toBe(pastLength);
});
```

- [ ] **Step 2: Run it**

Run: `npx vitest run --project unit src/editor/state/store.test.ts`
Expected: FAIL, `./store` cannot be resolved.

- [ ] **Step 3: Write `src/editor/state/store.ts`**

```ts
import { createStore, type StoreApi } from 'zustand/vanilla';
import { spreadCount } from '../../model/geometry';
import { addSheet, removeSheet } from '../../model/sheets';
import type { PhotoCrop, TextElement, Zine, ZineElement } from '../../model/types';
import { clampCrop } from '../../render/photoGeometry';
import { cloneForPaste } from './clipboard';
import {
  addElement,
  findElement,
  mapElement,
  patchElement,
  removeElement,
  updateSpreadElements,
  type ElementPatch,
} from './commands';
import { canRedo, canUndo, createHistory, record, redo, replacePresent, undo, type History } from './history';
import { moveLayer, type LayerOp } from './layers';

export const MAX_CROP_ZOOM = 5;

/** Things the store needs from the browser; Node tests pass fakes. */
export interface EditorDeps {
  /** Height in mm of the wrapped text (render/buildSpread.ts measureTextHeight). */
  measureText(element: TextElement): number;
  /** Pixel size of a loaded image, for keeping the crop valid. */
  imageSize(imageId: string): { width: number; height: number } | undefined;
}

/** idle: select, move, resize. crop: move/zoom the photo inside its frame. text: typing in the frame. */
export type EditorMode = 'idle' | 'crop' | 'text';

export interface EditorState {
  history: History<Zine>;
  spread: number;
  selectedId: string | null;
  /** Page last clicked on the current spread: its settings are shown and new elements go there. */
  activePage: number | null;
  mode: EditorMode;
  showGuides: boolean;
  /** Copied element (Cmd+C); pasting works on any spread of the open zine. */
  clipboard: ZineElement | null;
  /** Bumped when photos are added to the render assets, so canvases redraw. */
  assetsVersion: number;

  setSpread(index: number): void;
  select(id: string | null): void;
  clickPage(page: number | null): void;
  setMode(mode: EditorMode): void;
  setShowGuides(show: boolean): void;
  /** Any zine change as one undo step; `key` merges consecutive changes (typing, sliders). */
  edit(recipe: (zine: Zine) => Zine, key?: string): void;
  addElement(element: ZineElement): void;
  updateElement(id: string, patch: ElementPatch, key?: string): void;
  deleteSelected(): void;
  nudgeSelected(dx: number, dy: number): void;
  copySelected(): void;
  paste(): void;
  duplicateSelected(): void;
  moveSelectedLayer(op: LayerOp): void;
  addSheet(): void;
  removeSheet(): void;
  undo(): void;
  redo(): void;
  /** Re-measures text heights after fonts load; no undo step. */
  refreshTextHeights(): void;
  assetsChanged(): void;
}

export type EditorStore = StoreApi<EditorState>;

export const selectZine = (state: EditorState): Zine => state.history.present;
export const selectCanUndo = (state: EditorState): boolean => canUndo(state.history);
export const selectCanRedo = (state: EditorState): boolean => canRedo(state.history);

export function selectedElement(state: EditorState): ZineElement | null {
  return state.selectedId ? (findElement(state.history.present, state.spread, state.selectedId) ?? null) : null;
}

const sameCrop = (a: PhotoCrop, b: PhotoCrop) => a.offsetX === b.offsetX && a.offsetY === b.offsetY && a.zoom === b.zoom;

export function createEditorStore(zine: Zine, deps: EditorDeps): EditorStore {
  /** Keeps derived fields true: text height from the text, photo crop covering the frame. */
  const normalize = (element: ZineElement): ZineElement => {
    if (element.kind === 'text') {
      const height = deps.measureText(element);
      return height === element.height ? element : { ...element, height };
    }
    const size = deps.imageSize(element.imageId);
    const wanted = { ...element.crop, zoom: Math.min(MAX_CROP_ZOOM, element.crop.zoom) };
    const crop = size ? clampCrop(element, wanted, size.width, size.height) : wanted;
    return sameCrop(crop, element.crop) ? element : { ...element, crop };
  };

  return createStore<EditorState>()((set, get) => {
    const zineOf = () => get().history.present;

    /** Applies a new history and keeps the spread index and selection valid for it. */
    const settle = (history: History<Zine>) => {
      const state = get();
      const spread = Math.min(state.spread, spreadCount(history.present.sheets) - 1);
      const keep = state.selectedId !== null && findElement(history.present, spread, state.selectedId) !== undefined;
      set({
        history,
        spread,
        selectedId: keep ? state.selectedId : null,
        mode: keep ? state.mode : 'idle',
        activePage: spread === state.spread ? state.activePage : null,
      });
    };

    const edit = (recipe: (zine: Zine) => Zine, key?: string) => {
      const next = recipe(zineOf());
      if (next !== zineOf()) settle(record(get().history, next, key ?? null));
    };

    const current = () => selectedElement(get());
    const spreadElements = () => zineOf().spreads[get().spread].elements;

    return {
      history: createHistory(zine),
      spread: 0,
      selectedId: null,
      activePage: null,
      mode: 'idle',
      showGuides: true,
      clipboard: null,
      assetsVersion: 0,

      setSpread: (index) => {
        const spread = Math.max(0, Math.min(spreadCount(zineOf().sheets) - 1, index));
        set({ spread, selectedId: null, activePage: null, mode: 'idle' });
      },
      select: (id) => {
        if (id === get().selectedId) return;
        set({ selectedId: id, mode: 'idle', activePage: null });
      },
      clickPage: (page) => set({ selectedId: null, activePage: page, mode: 'idle' }),
      setMode: (mode) => set({ mode }),
      setShowGuides: (showGuides) => set({ showGuides }),
      edit,
      addElement: (element) => {
        edit((z) => addElement(z, get().spread, normalize(element)));
        set({ selectedId: element.id, mode: 'idle' });
      },
      updateElement: (id, patch, key) =>
        edit((z) => mapElement(z, get().spread, id, (e) => normalize(patchElement(e, patch))), key),
      deleteSelected: () => {
        const id = get().selectedId;
        if (id) edit((z) => removeElement(z, get().spread, id));
      },
      nudgeSelected: (dx, dy) => {
        const element = current();
        if (element) get().updateElement(element.id, { x: element.x + dx, y: element.y + dy });
      },
      copySelected: () => {
        const element = current();
        if (element) set({ clipboard: element });
      },
      paste: () => {
        const copied = get().clipboard;
        if (copied) get().addElement(cloneForPaste(copied, spreadElements()));
      },
      duplicateSelected: () => {
        const element = current();
        if (element) get().addElement(cloneForPaste(element, spreadElements()));
      },
      moveSelectedLayer: (op) => {
        const id = get().selectedId;
        if (id) edit((z) => updateSpreadElements(z, get().spread, (elements) => moveLayer(elements, id, op)));
      },
      addSheet: () => edit((z) => addSheet(z, get().spread)),
      removeSheet: () => edit((z) => removeSheet(z, get().spread)),
      undo: () => settle(undo(get().history)),
      redo: () => settle(redo(get().history)),
      refreshTextHeights: () => {
        const z = zineOf();
        let changed = false;
        const spreads = z.spreads.map((spread) => {
          const elements = spread.elements.map((e) => (e.kind === 'text' ? normalize(e) : e));
          if (elements.every((e, i) => e === spread.elements[i])) return spread;
          changed = true;
          return { ...spread, elements };
        });
        if (changed) set({ history: replacePresent(get().history, { ...z, spreads }) });
      },
      assetsChanged: () => set((state) => ({ assetsVersion: state.assetsVersion + 1 })),
    };
  });
}
```

- [ ] **Step 4: Run it**

Run: `npx vitest run --project unit src/editor/state`
Expected: PASS (all state tests, 11 of them in `store.test.ts`).

- [ ] **Step 5: Commit**

```bash
git add src/editor/state/store.ts src/editor/state/store.test.ts
git commit -m "Add the editor store with undo, clipboard, layers and sheets" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Shortcuts, spread labels, Polish plurals

**Files:**
- Create: `src/editor/keyboard.ts`, `src/editor/spreadLabels.ts`, `src/app/plural.ts`
- Test: `src/editor/keyboard.test.ts`, `src/editor/spreadLabels.test.ts`, `src/app/plural.test.ts`

- [ ] **Step 1: Write the failing tests**

`src/editor/keyboard.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { createPhotoElement, createTextElement, createZine } from '../model/factory';
import { applyKeyCommand, isTypingTarget, keyCommand, type KeyLike } from './keyboard';
import { createEditorStore, selectedElement, selectZine } from './state/store';

const key = (k: string, mods: Partial<KeyLike> = {}): KeyLike => ({
  key: k,
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  ...mods,
});

describe('keyCommand', () => {
  test('Cmd and Ctrl shortcuts', () => {
    expect(keyCommand(key('z', { metaKey: true }))).toEqual({ type: 'undo' });
    expect(keyCommand(key('Z', { metaKey: true, shiftKey: true }))).toEqual({ type: 'redo' });
    expect(keyCommand(key('y', { ctrlKey: true }))).toEqual({ type: 'redo' });
    expect(keyCommand(key('c', { ctrlKey: true }))).toEqual({ type: 'copy' });
    expect(keyCommand(key('v', { metaKey: true }))).toEqual({ type: 'paste' });
    expect(keyCommand(key('d', { metaKey: true }))).toEqual({ type: 'duplicate' });
    expect(keyCommand(key('s', { metaKey: true }))).toBeNull();
  });

  test('arrows nudge by 1 mm, with Shift by 10 mm', () => {
    expect(keyCommand(key('ArrowLeft'))).toEqual({ type: 'nudge', dx: -1, dy: 0 });
    expect(keyCommand(key('ArrowDown', { shiftKey: true }))).toEqual({ type: 'nudge', dx: 0, dy: 10 });
  });

  test('other keys', () => {
    expect(keyCommand(key('Backspace'))).toEqual({ type: 'delete' });
    expect(keyCommand(key('Delete'))).toEqual({ type: 'delete' });
    expect(keyCommand(key('Escape'))).toEqual({ type: 'escape' });
    expect(keyCommand(key('PageUp'))).toEqual({ type: 'prevSpread' });
    expect(keyCommand(key('PageDown'))).toEqual({ type: 'nextSpread' });
    expect(keyCommand(key('a'))).toBeNull();
  });
});

test('isTypingTarget', () => {
  expect(isTypingTarget({ tagName: 'INPUT' } as unknown as EventTarget)).toBe(true);
  expect(isTypingTarget({ tagName: 'DIV', isContentEditable: true } as unknown as EventTarget)).toBe(true);
  expect(isTypingTarget({ tagName: 'BUTTON' } as unknown as EventTarget)).toBe(false);
  expect(isTypingTarget(null)).toBe(false);
});

describe('applyKeyCommand', () => {
  const deps = { measureText: () => 5, imageSize: () => ({ width: 10, height: 10 }) };

  test('nudge, delete and undo go to the store; nothing selected = not handled', () => {
    const store = createEditorStore(createZine('t', 1), deps);
    expect(applyKeyCommand(store, { type: 'nudge', dx: 1, dy: 0 })).toBe(false);
    store.getState().addElement(createTextElement({ x: 10 }));
    expect(applyKeyCommand(store, { type: 'nudge', dx: 10, dy: 0 })).toBe(true);
    expect(selectedElement(store.getState())?.x).toBe(20);
    expect(applyKeyCommand(store, { type: 'delete' })).toBe(true);
    expect(selectZine(store.getState()).spreads[0].elements).toEqual([]);
    applyKeyCommand(store, { type: 'undo' });
    expect(selectZine(store.getState()).spreads[0].elements).toHaveLength(1);
  });

  test('Escape leaves crop mode first, then deselects; Enter ends cropping', () => {
    const store = createEditorStore(createZine('t', 1), deps);
    store.getState().addElement(createPhotoElement('img'));
    store.getState().setMode('crop');
    expect(applyKeyCommand(store, { type: 'enter' })).toBe(true);
    expect(store.getState().mode).toBe('idle');
    expect(applyKeyCommand(store, { type: 'enter' })).toBe(false);
    store.getState().setMode('crop');
    applyKeyCommand(store, { type: 'escape' });
    expect(store.getState()).toMatchObject({ mode: 'idle' });
    expect(store.getState().selectedId).not.toBeNull();
    applyKeyCommand(store, { type: 'escape' });
    expect(store.getState().selectedId).toBeNull();
  });

  test('PageUp and PageDown change the spread', () => {
    const store = createEditorStore(createZine('t', 1), deps);
    applyKeyCommand(store, { type: 'nextSpread' });
    applyKeyCommand(store, { type: 'nextSpread' });
    applyKeyCommand(store, { type: 'nextSpread' });
    expect(store.getState().spread).toBe(2);
    applyKeyCommand(store, { type: 'prevSpread' });
    expect(store.getState().spread).toBe(1);
  });
});
```

`src/editor/spreadLabels.test.ts`:

```ts
import { expect, test } from 'vitest';
import { createTextElement, createZine } from '../model/factory';
import { removalMessage, spreadLabel, thumbnailKey } from './spreadLabels';

test('spread labels', () => {
  expect([0, 1, 2, 3, 4].map((i) => spreadLabel(i, 2))).toEqual(['Okładka', '2–3', '4–5', '6–7', 'Tył']);
});

test('removal message names the pages', () => {
  expect(removalMessage([4, 5, 6, 7])).toBe('Strony 4–7 mają treść, która zniknie. Usunąć kartkę?');
});

test('thumbnail key changes with the spread, its page colours and the version only', () => {
  const zine = createZine('t', 2);
  const key = thumbnailKey(zine, 1, 0);
  expect(thumbnailKey({ ...zine, title: 'x' }, 1, 0)).toBe(key);
  expect(thumbnailKey({ ...zine, pages: { 5: { background: '#000' } } }, 1, 0)).toBe(key);
  expect(thumbnailKey({ ...zine, pages: { 3: { background: '#000' } } }, 1, 0)).not.toBe(key);
  expect(thumbnailKey(zine, 1, 1)).not.toBe(key);
  const edited = structuredClone(zine);
  edited.spreads[1].elements.push(createTextElement());
  expect(thumbnailKey(edited, 1, 0)).not.toBe(key);
});
```

`src/app/plural.test.ts`:

```ts
import { expect, test } from 'vitest';
import { countOf, plural } from './plural';

test('Polish plural forms', () => {
  const forms = [1, 2, 4, 5, 12, 14, 20, 22, 24, 25, 112].map((n) => plural(n, 'strona', 'strony', 'stron'));
  expect(forms).toEqual(['strona', 'strony', 'strony', 'stron', 'stron', 'stron', 'stron', 'strony', 'strony', 'stron', 'stron']);
  expect(countOf(5, 'kartka', 'kartki', 'kartek')).toBe('5 kartek');
});
```

- [ ] **Step 2: Run them**

Run: `npx vitest run --project unit src/editor/keyboard.test.ts src/editor/spreadLabels.test.ts src/app/plural.test.ts`
Expected: FAIL, the modules cannot be resolved.

- [ ] **Step 3: Write `src/editor/keyboard.ts`**

```ts
import type { EditorStore } from './state/store';

export const NUDGE_MM = 1;
export const NUDGE_SHIFT_MM = 10;

export type KeyCommand =
  | { type: 'undo' | 'redo' | 'delete' | 'copy' | 'paste' | 'duplicate' | 'escape' | 'enter' | 'prevSpread' | 'nextSpread' }
  | { type: 'nudge'; dx: number; dy: number };

export interface KeyLike {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

/** Editor shortcuts. Cmd on a Mac and Ctrl elsewhere both work. */
export function keyCommand(event: KeyLike): KeyCommand | null {
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  if (event.metaKey || event.ctrlKey) {
    if (key === 'z') return { type: event.shiftKey ? 'redo' : 'undo' };
    if (key === 'y') return { type: 'redo' };
    if (key === 'c') return { type: 'copy' };
    if (key === 'v') return { type: 'paste' };
    if (key === 'd') return { type: 'duplicate' };
    return null;
  }
  const step = event.shiftKey ? NUDGE_SHIFT_MM : NUDGE_MM;
  switch (key) {
    case 'Delete':
    case 'Backspace':
      return { type: 'delete' };
    case 'ArrowLeft':
      return { type: 'nudge', dx: -step, dy: 0 };
    case 'ArrowRight':
      return { type: 'nudge', dx: step, dy: 0 };
    case 'ArrowUp':
      return { type: 'nudge', dx: 0, dy: -step };
    case 'ArrowDown':
      return { type: 'nudge', dx: 0, dy: step };
    case 'Escape':
      return { type: 'escape' };
    case 'Enter':
      return { type: 'enter' };
    case 'PageUp':
      return { type: 'prevSpread' };
    case 'PageDown':
      return { type: 'nextSpread' };
    default:
      return null;
  }
}

/** Keys typed into fields belong to the field, not to the editor. */
export function isTypingTarget(target: EventTarget | null): boolean {
  const element = target as { tagName?: unknown; isContentEditable?: boolean } | null;
  if (!element || typeof element.tagName !== 'string') return false;
  return element.isContentEditable === true || ['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName);
}

/** Runs a shortcut; returns false when it does nothing here (the browser keeps its default). */
export function applyKeyCommand(store: EditorStore, command: KeyCommand): boolean {
  const s = store.getState();
  switch (command.type) {
    case 'undo':
      s.undo();
      return true;
    case 'redo':
      s.redo();
      return true;
    case 'delete':
      if (!s.selectedId) return false;
      s.deleteSelected();
      return true;
    case 'copy':
      if (!s.selectedId) return false;
      s.copySelected();
      return true;
    case 'paste':
      if (!s.clipboard) return false;
      s.paste();
      return true;
    case 'duplicate':
      s.duplicateSelected();
      return true;
    case 'nudge':
      if (!s.selectedId) return false;
      s.nudgeSelected(command.dx, command.dy);
      return true;
    case 'escape':
      if (s.mode !== 'idle') s.setMode('idle');
      else s.select(null);
      return true;
    case 'enter':
      if (s.mode !== 'crop') return false;
      s.setMode('idle');
      return true;
    case 'prevSpread':
      s.setSpread(s.spread - 1);
      return true;
    case 'nextSpread':
      s.setSpread(s.spread + 1);
      return true;
  }
}
```

- [ ] **Step 4: Write `src/editor/spreadLabels.ts`**

(Not `spreadList.ts`: Task 19 adds `SpreadList.tsx`, and the names must not differ only by case.)

```ts
import { pageAt, spreadCount } from '../model/geometry';
import type { Zine } from '../model/types';

export function spreadLabel(spread: number, sheets: number): string {
  if (spread === 0) return 'Okładka';
  if (spread === spreadCount(sheets) - 1) return 'Tył';
  return `${pageAt(spread, 'left')}–${pageAt(spread, 'right')}`;
}

/** Question asked before "− kartka" removes pages that have content. */
export function removalMessage(pages: number[]): string {
  return `Strony ${pages[0]}–${pages[pages.length - 1]} mają treść, która zniknie. Usunąć kartkę?`;
}

/** Everything a spread thumbnail depends on, as a cache key. */
export function thumbnailKey(zine: Zine, spread: number, version: number): string {
  const left = pageAt(spread, 'left');
  const right = pageAt(spread, 'right');
  return JSON.stringify([zine.sheets, zine.pages[left], zine.pages[right], zine.spreads[spread], version]);
}
```

- [ ] **Step 5: Write `src/app/plural.ts`**

```ts
/** Polish plural: plural(1, 'strona', 'strony', 'stron'), 2–4 'strony', 5+ and 12–14 'stron'. */
export function plural(count: number, one: string, few: string, many: string): string {
  if (count === 1) return one;
  const tens = count % 100;
  const units = count % 10;
  return units >= 2 && units <= 4 && (tens < 12 || tens > 14) ? few : many;
}

/** "20 stron", "1 kartka", "24 strony". */
export function countOf(count: number, one: string, few: string, many: string): string {
  return `${count} ${plural(count, one, few, many)}`;
}
```

- [ ] **Step 6: Run them**

Run: `npx vitest run --project unit src/editor src/app`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/editor/keyboard.ts src/editor/keyboard.test.ts src/editor/spreadLabels.ts src/editor/spreadLabels.test.ts src/app/plural.ts src/app/plural.test.ts
git commit -m "Add editor shortcuts, spread labels and Polish plurals" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: App shell: routes, database, notices, dialogs, storage

The app opens IndexedDB once, asks for persistent storage, and picks a screen from the hash. Home and editor stay simple placeholders until Tasks 13 and 16.

**Files:**
- Create: `src/app/route.ts`, `src/app/useRoute.ts`, `src/app/dbContext.ts`, `src/app/notices.ts`, `src/app/NoticeList.tsx`, `src/app/confirm.ts`, `src/app/ConfirmHost.tsx`, `src/app/PlaceholderScreen.tsx`, `src/app/app.css`, `src/storage/quota.ts`
- Modify: `src/App.tsx`, `src/main.tsx`
- Test: `src/app/route.test.ts`, `src/app/notices.test.ts`, `src/storage/quota.test.ts`, `src/App.browser.test.tsx`

- [ ] **Step 1: Write the failing Node tests**

`src/app/route.test.ts`:

```ts
import { expect, test } from 'vitest';
import { parseRoute, routeHash, type Route } from './route';

test('parses the four screens', () => {
  expect(parseRoute('')).toEqual({ name: 'home' });
  expect(parseRoute('#/')).toEqual({ name: 'home' });
  expect(parseRoute('#/zin/abc')).toEqual({ name: 'editor', zineId: 'abc' });
  expect(parseRoute('#/zin/abc/druk')).toEqual({ name: 'print', zineId: 'abc' });
  expect(parseRoute('#/zin/abc/3d/')).toEqual({ name: 'preview3d', zineId: 'abc' });
});

test('unknown paths go home', () => {
  expect(parseRoute('#/cokolwiek')).toEqual({ name: 'home' });
  expect(parseRoute('#/zin/abc/inne')).toEqual({ name: 'home' });
});

test('routeHash round-trips, ids are encoded', () => {
  const routes: Route[] = [
    { name: 'home' },
    { name: 'editor', zineId: 'a b' },
    { name: 'print', zineId: 'x' },
    { name: 'preview3d', zineId: 'x' },
  ];
  for (const route of routes) expect(parseRoute(routeHash(route))).toEqual(route);
  expect(routeHash({ name: 'editor', zineId: 'a b' })).toBe('#/zin/a%20b');
});
```

`src/app/notices.test.ts`:

```ts
import { beforeEach, expect, test } from 'vitest';
import { StorageFullError } from '../storage/db';
import { ZinFileError } from '../storage/zinFile';
import { dismissNotice, errorMessage, GENERIC_ERROR, noticeStore, notify } from './notices';

beforeEach(() => noticeStore.setState({ notices: [] }));

test('our errors keep their Polish message, others get a generic one', () => {
  expect(errorMessage(new StorageFullError())).toBe(new StorageFullError().message);
  expect(errorMessage(new ZinFileError('To nie jest plik zina.'))).toBe('To nie jest plik zina.');
  expect(errorMessage(new TypeError('x is undefined'))).toBe(GENERIC_ERROR);
  expect(errorMessage('boom')).toBe(GENERIC_ERROR);
});

test('notify adds a message once; dismissNotice removes it', () => {
  notify('A');
  notify('B');
  notify('A');
  const texts = noticeStore.getState().notices.map((n) => n.text);
  expect(texts).toEqual(['B', 'A']);
  dismissNotice(noticeStore.getState().notices[0].id);
  expect(noticeStore.getState().notices.map((n) => n.text)).toEqual(['A']);
});
```

`src/storage/quota.test.ts`:

```ts
import { expect, test } from 'vitest';
import { formatBytes, isNearlyFull, usageText } from './quota';

test('formatBytes', () => {
  expect(formatBytes(0)).toBe('0 B');
  expect(formatBytes(999)).toBe('999 B');
  expect(formatBytes(1_500_000)).toBe('1,5 MB');
  expect(formatBytes(12_345_678)).toBe('12 MB');
  expect(formatBytes(2_000_000_000)).toBe('2 GB');
});

test('usage text and the nearly-full threshold', () => {
  expect(usageText({ usage: 1_500_000, quota: 2_000_000_000 })).toBe('Zajęte miejsce: 1,5 MB z 2 GB');
  expect(isNearlyFull({ usage: 89, quota: 100 })).toBe(false);
  expect(isNearlyFull({ usage: 90, quota: 100 })).toBe(true);
});
```

- [ ] **Step 2: Run them**

Run: `npx vitest run --project unit src/app src/storage/quota.test.ts`
Expected: FAIL, `./route`, `./notices` and `./quota` cannot be resolved.

- [ ] **Step 3: Write `src/app/route.ts`**

```ts
export type Route =
  | { name: 'home' }
  | { name: 'editor'; zineId: string }
  | { name: 'print'; zineId: string }
  | { name: 'preview3d'; zineId: string };

/** Hash routes, because GitHub Pages serves the app from a sub-path with no server routing. */
export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#/, '');
  const match = /^\/zin\/([^/]+)(?:\/(druk|3d))?\/?$/.exec(path);
  if (!match) return { name: 'home' };
  const zineId = decodeURIComponent(match[1]);
  if (match[2] === 'druk') return { name: 'print', zineId };
  if (match[2] === '3d') return { name: 'preview3d', zineId };
  return { name: 'editor', zineId };
}

export function routeHash(route: Route): string {
  if (route.name === 'home') return '#/';
  const base = `#/zin/${encodeURIComponent(route.zineId)}`;
  if (route.name === 'print') return `${base}/druk`;
  if (route.name === 'preview3d') return `${base}/3d`;
  return base;
}

export function navigate(route: Route): void {
  window.location.hash = routeHash(route);
}
```

- [ ] **Step 4: Write `src/app/notices.ts`**

```ts
import { createStore } from 'zustand/vanilla';

export interface Notice {
  id: number;
  text: string;
}

export const GENERIC_ERROR = 'Coś poszło nie tak. Spróbuj jeszcze raz.';

/** Errors whose message is already a Polish sentence for the user. */
const USER_FACING = new Set([
  'StorageFullError',
  'ZinFileError',
  'ZineFormatError',
  'ImageImportError',
  'FontImportError',
  'ZineNotFoundError',
]);

/** What to tell the user about an error: our own messages as they are, anything else a generic sentence. */
export function errorMessage(error: unknown): string {
  return error instanceof Error && USER_FACING.has(error.name) ? error.message : GENERIC_ERROR;
}

export const noticeStore = createStore<{ notices: Notice[] }>()(() => ({ notices: [] }));

let nextId = 1;

/** Shows a message at the top of the screen until the user closes it. The same text is shown once. */
export function notify(text: string): void {
  noticeStore.setState((s) => ({ notices: [...s.notices.filter((n) => n.text !== text), { id: nextId++, text }] }));
}

export function dismissNotice(id: number): void {
  noticeStore.setState((s) => ({ notices: s.notices.filter((n) => n.id !== id) }));
}
```

- [ ] **Step 5: Write `src/storage/quota.ts`**

```ts
export interface StorageUsage {
  usage: number;
  quota: number;
}

/** Above this share of the quota the zine list warns that space is running out. */
export const NEARLY_FULL = 0.9;

/** Asks the browser not to evict our data under storage pressure. Never throws. */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    return (await navigator.storage.persisted()) || (await navigator.storage.persist());
  } catch {
    return false;
  }
}

export async function storageUsage(): Promise<StorageUsage | null> {
  try {
    const estimate = await navigator.storage?.estimate?.();
    return estimate?.usage !== undefined && estimate.quota ? { usage: estimate.usage, quota: estimate.quota } : null;
  } catch {
    return null;
  }
}

/** "0 B", "1,5 MB", "12 MB", "2 GB" (decimal units, Polish decimal comma). */
export function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000;
    unit++;
  }
  const text = unit === 0 ? String(Math.round(value)) : value.toLocaleString('pl-PL', { maximumFractionDigits: value < 10 ? 1 : 0 });
  return `${text} ${units[unit]}`;
}

export function usageText(usage: StorageUsage): string {
  return `Zajęte miejsce: ${formatBytes(usage.usage)} z ${formatBytes(usage.quota)}`;
}

export function isNearlyFull(usage: StorageUsage): boolean {
  return usage.usage / usage.quota >= NEARLY_FULL;
}
```

- [ ] **Step 6: Run them**

Run: `npx vitest run --project unit src/app src/storage/quota.test.ts`
Expected: PASS.

- [ ] **Step 7: Write the failing browser test `src/App.browser.test.tsx`**

```tsx
import { render } from 'vitest-browser-react';
import { afterEach, expect, test } from 'vitest';
import { App } from './App';
import { askConfirm } from './app/confirm';
import { ConfirmHost } from './app/ConfirmHost';
import { NoticeList } from './app/NoticeList';
import { notify } from './app/notices';

afterEach(() => {
  window.location.hash = '';
});

test('the print route shows a placeholder with a way back to the editor', async () => {
  window.location.hash = '#/zin/abc/druk';
  const screen = render(<App />);
  await expect.element(screen.getByRole('heading', { name: 'Druk' })).toBeVisible();
  await expect.element(screen.getByRole('link', { name: 'Wróć do edytora' })).toHaveAttribute('href', '#/zin/abc');
});

test('askConfirm resolves with the button the user clicks', async () => {
  const screen = render(<ConfirmHost />);
  const answer = askConfirm('Usunąć zin „Lato”?');
  await screen.getByRole('button', { name: 'Usuń' }).click();
  expect(await answer).toBe(true);
  const second = askConfirm('Na pewno?', 'Tak');
  await screen.getByRole('button', { name: 'Anuluj' }).click();
  expect(await second).toBe(false);
  await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
});

test('notices can be closed', async () => {
  const screen = render(<NoticeList />);
  notify('Brak miejsca w przeglądarce.');
  await expect.element(screen.getByRole('alert')).toHaveTextContent('Brak miejsca w przeglądarce.');
  await screen.getByRole('button', { name: 'Zamknij komunikat' }).click();
  await expect.element(screen.getByRole('alert')).not.toBeInTheDocument();
});
```

Run: `npx vitest run --project browser src/App.browser.test.tsx`
Expected: FAIL, `./app/confirm` cannot be resolved.

- [ ] **Step 8: Write `src/app/useRoute.ts`**

```ts
import { useEffect, useMemo, useState } from 'react';
import { parseRoute, type Route } from './route';

export function useRoute(): Route {
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const onChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return useMemo(() => parseRoute(hash), [hash]);
}
```

- [ ] **Step 9: Write `src/app/dbContext.ts`**

```ts
import { createContext, useContext } from 'react';
import type { ZiniarzDb } from '../storage/db';

/** The open IndexedDB database; tests provide their own. */
export const DbContext = createContext<ZiniarzDb | null>(null);

export function useDb(): ZiniarzDb {
  const db = useContext(DbContext);
  if (!db) throw new Error('DbContext is missing');
  return db;
}
```

- [ ] **Step 10: Write `src/app/NoticeList.tsx`**

(`NoticeList`, not `Notices.tsx`: `notices.ts` already exists and names must not differ only by case.)

```tsx
import { useStore } from 'zustand';
import { dismissNotice, noticeStore } from './notices';

export function NoticeList() {
  const notices = useStore(noticeStore, (s) => s.notices);
  if (notices.length === 0) return null;
  return (
    <div className="notices">
      {notices.map((notice) => (
        <div key={notice.id} className="notice" role="alert">
          <span>{notice.text}</span>
          <button type="button" aria-label="Zamknij komunikat" onClick={() => dismissNotice(notice.id)}>
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 11: Write `src/app/confirm.ts` and `src/app/ConfirmHost.tsx`**

`src/app/confirm.ts`:

```ts
import { createStore } from 'zustand/vanilla';

export interface ConfirmRequest {
  message: string;
  confirmLabel: string;
  answer(ok: boolean): void;
}

export const confirmStore = createStore<{ request: ConfirmRequest | null }>()(() => ({ request: null }));

/** Asks a yes/no question in a dialog (ConfirmHost). A new question cancels an open one. */
export function askConfirm(message: string, confirmLabel = 'Usuń'): Promise<boolean> {
  confirmStore.getState().request?.answer(false);
  return new Promise((resolve) => {
    const request: ConfirmRequest = {
      message,
      confirmLabel,
      answer: (ok) => {
        if (confirmStore.getState().request === request) confirmStore.setState({ request: null });
        resolve(ok);
      },
    };
    confirmStore.setState({ request });
  });
}
```

`src/app/ConfirmHost.tsx`:

```tsx
import { useStore } from 'zustand';
import { confirmStore } from './confirm';

export function ConfirmHost() {
  const request = useStore(confirmStore, (s) => s.request);
  if (!request) return null;
  return (
    <div className="dialog-backdrop">
      <div className="dialog" role="dialog" aria-modal="true" aria-label="Potwierdzenie">
        <p>{request.message}</p>
        <div className="dialog-buttons">
          <button type="button" onClick={() => request.answer(false)}>
            Anuluj
          </button>
          <button type="button" className="danger" autoFocus onClick={() => request.answer(true)}>
            {request.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 12: Write `src/app/PlaceholderScreen.tsx`**

```tsx
import { routeHash } from './route';

/** Screens that later plans build (print, 3D preview). */
export function PlaceholderScreen({ title, zineId }: { title: string; zineId: string }) {
  return (
    <main className="screen-message">
      <h1>{title}</h1>
      <p>Ten ekran jeszcze powstaje.</p>
      <a className="link-button" href={routeHash({ name: 'editor', zineId })}>
        Wróć do edytora
      </a>
    </main>
  );
}
```

- [ ] **Step 13: Replace `src/App.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { ConfirmHost } from './app/ConfirmHost';
import { DbContext } from './app/dbContext';
import { NoticeList } from './app/NoticeList';
import { PlaceholderScreen } from './app/PlaceholderScreen';
import type { Route } from './app/route';
import { useRoute } from './app/useRoute';
import { openZiniarzDb, type ZiniarzDb } from './storage/db';
import { requestPersistentStorage } from './storage/quota';

function Screen({ route }: { route: Route }) {
  switch (route.name) {
    case 'home':
      return <main className="screen-message">Lista zinów</main>;
    case 'editor':
      return <main className="screen-message">Edytor</main>;
    case 'print':
      return <PlaceholderScreen title="Druk" zineId={route.zineId} />;
    case 'preview3d':
      return <PlaceholderScreen title="Podgląd 3D" zineId={route.zineId} />;
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

- [ ] **Step 14: Replace `src/main.tsx`**

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './app/app.css';
import { registerBuiltinFonts } from './fonts/fontLoader';

registerBuiltinFonts();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 15: Write `src/app/app.css`**

Later tasks append their sections to this file.

```css
:root {
  --ink: #1d1d1f;
  --muted: #6e6e73;
  --line: #d2d2d7;
  --paper: #ffffff;
  --canvas: #e8e8e8;
  --accent: #2b6cff;
  --danger: #d70015;
  font-family: Inter, system-ui, -apple-system, 'Segoe UI', sans-serif;
  font-size: 14px;
  color: var(--ink);
  background: #f5f5f7;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
}

button,
.link-button,
.file-button {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--paper);
  color: var(--ink);
  font: inherit;
  text-decoration: none;
  cursor: pointer;
}

button:disabled {
  opacity: 0.4;
  cursor: default;
}

button.primary,
.link-button.primary {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}

button.danger {
  color: var(--danger);
}

button[aria-pressed='true'] {
  background: var(--ink);
  border-color: var(--ink);
  color: #fff;
}

input,
select {
  font: inherit;
  padding: 4px 6px;
  border: 1px solid var(--line);
  border-radius: 4px;
}

.screen-message {
  padding: 48px;
  max-width: 640px;
}

.notices {
  position: fixed;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  display: grid;
  gap: 8px;
  z-index: 20;
}

.notice {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 10px 14px;
  border-radius: 8px;
  background: var(--ink);
  color: #fff;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
}

.notice button {
  border: none;
  background: transparent;
  color: #fff;
  padding: 0 4px;
}

.dialog-backdrop {
  position: fixed;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgba(0, 0, 0, 0.3);
  z-index: 30;
}

.dialog {
  max-width: 420px;
  padding: 20px;
  border-radius: 10px;
  background: var(--paper);
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.25);
}

.dialog-buttons {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
```

- [ ] **Step 16: Run the browser test and the type check**

Run: `npx vitest run --project browser src/App.browser.test.tsx && npm run typecheck`
Expected: PASS (3 tests), no type errors.

- [ ] **Step 17: Commit**

```bash
git add src/App.tsx src/main.tsx src/App.browser.test.tsx src/app src/storage/quota.ts src/storage/quota.test.ts
git commit -m "Add hash routes, notices, confirm dialog and storage helpers" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Zine list actions and cover thumbnails

**Files:**
- Create: `src/home/homeActions.ts`, `src/home/coverThumbnail.ts`, `src/home/download.ts`
- Test: `src/home/homeActions.test.ts`, `src/home/coverThumbnail.browser.test.ts`

- [ ] **Step 1: Write the failing test `src/home/homeActions.test.ts`**

```ts
import 'fake-indexeddb/auto';
import { expect, test } from 'vitest';
import { createPhotoElement, createTextElement, createZine } from '../model/factory';
import { newId } from '../model/ids';
import type { Zine } from '../model/types';
import { listZines, loadZine, openZiniarzDb, putImage, saveZine } from '../storage/db';
import {
  copyOfZine,
  createNewZine,
  duplicateZine,
  exportZinFile,
  importZinFile,
  listZinesForHome,
  removeZine,
} from './homeActions';

const freshDb = () => openZiniarzDb(`test-${newId()}`);

test('createNewZine trims the title, clamps the sheet count and saves', async () => {
  const db = await freshDb();
  const zine = await createNewZine(db, '  Lato  ', 25);
  expect(zine).toMatchObject({ title: 'Lato', sheets: 20 });
  expect(await loadZine(db, zine.id)).toEqual(zine);
  expect((await createNewZine(db, ' ', 1)).title).toBe('Bez tytułu');
});

test('listZinesForHome parses stored zines, newest first, and counts unreadable ones', async () => {
  const db = await freshDb();
  const old = { ...createZine('Stary', 1), updatedAt: '2026-01-01T00:00:00.000Z' };
  const recent = { ...createZine('Nowy', 1), updatedAt: '2026-10-01T00:00:00.000Z' };
  await saveZine(db, old);
  await saveZine(db, recent);
  const { margins: _margins, ...withoutMargins } = createZine('Bez marginesów', 1);
  await db.put('zines', { ...withoutMargins, updatedAt: '2026-05-01T00:00:00.000Z' } as unknown as Zine);
  await db.put('zines', { ...createZine('Z przyszłości', 1), formatVersion: 99 });
  const { zines, unreadable } = await listZinesForHome(db);
  expect(zines.map((z) => z.title)).toEqual(['Nowy', 'Bez marginesów', 'Stary']);
  expect(zines[1].margins).toEqual({ outer: 30, inner: 30, top: 30, bottom: 30 });
  expect(unreadable).toBe(1);
});

test('copyOfZine gives new ids everywhere and keeps photos and fonts by id', () => {
  const zine = createZine('Lato', 1);
  zine.fonts = ['fam'];
  zine.spreads[1].elements.push(createPhotoElement('img'), createTextElement({ text: 'a' }));
  const copy = copyOfZine(zine, new Date('2026-10-14T10:00:00Z'));
  expect(copy.id).not.toBe(zine.id);
  expect(copy.title).toBe('Lato (kopia)');
  expect(copy.spreads[1].id).not.toBe(zine.spreads[1].id);
  expect(copy.spreads[1].elements[0].id).not.toBe(zine.spreads[1].elements[0].id);
  expect(copy.spreads[1].elements[0]).toMatchObject({ kind: 'photo', imageId: 'img' });
  expect(copy.fonts).toEqual(['fam']);
  expect(copy.updatedAt).toBe('2026-10-14T10:00:00.000Z');
});

test('duplicate and remove', async () => {
  const db = await freshDb();
  const zine = await createNewZine(db, 'Lato', 2);
  await duplicateZine(db, zine);
  expect((await listZines(db)).map((z) => z.title).sort()).toEqual(['Lato', 'Lato (kopia)']);
  await removeZine(db, zine.id);
  expect((await listZines(db)).map((z) => z.title)).toEqual(['Lato (kopia)']);
});

test('a saved .zin file reads back as a new zine with its photos', async () => {
  const db = await freshDb();
  const zine = createZine('Mój zin', 1);
  zine.spreads[1].elements.push(createPhotoElement('img'));
  await saveZine(db, zine);
  await putImage(db, { id: 'img', mime: 'image/png', width: 1, height: 1, data: new Uint8Array([1, 2]).buffer });
  const file = await exportZinFile(db, zine);
  expect(file.name).toBe('moj-zin.zin');
  const other = await freshDb();
  const imported = await importZinFile(other, file.blob);
  expect(imported.id).not.toBe(zine.id);
  expect(imported.title).toBe('Mój zin');
  expect(await loadZine(other, imported.id)).toBeDefined();
});
```

- [ ] **Step 2: Run it**

Run: `npx vitest run --project unit src/home/homeActions.test.ts`
Expected: FAIL, `./homeActions` cannot be resolved.

- [ ] **Step 3: Write `src/home/homeActions.ts`**

```ts
import { createZine } from '../model/factory';
import { newId } from '../model/ids';
import { parseZine } from '../model/parse';
import type { Zine } from '../model/types';
import { fileSlug } from '../print/fileName';
import { deleteZine, listZines, saveZine, type ZiniarzDb } from '../storage/db';
import { bundleFromDb, importBundle, readZin, writeZin } from '../storage/zinFile';

export const DEFAULT_SHEETS = 5;

/** Zines for the list, last changed first. Stored data always goes through parseZine (defaults, versions). */
export async function listZinesForHome(db: ZiniarzDb): Promise<{ zines: Zine[]; unreadable: number }> {
  const zines: Zine[] = [];
  let unreadable = 0;
  for (const raw of await listZines(db)) {
    try {
      zines.push(parseZine(raw));
    } catch {
      unreadable++;
    }
  }
  zines.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return { zines, unreadable };
}

export async function createNewZine(db: ZiniarzDb, title: string, sheets: number): Promise<Zine> {
  const zine = createZine(title.trim() || 'Bez tytułu', sheets);
  await saveZine(db, zine);
  return zine;
}

/** A copy with new ids. Photos and fonts are shared by id, so nothing is copied in the database. */
export function copyOfZine(zine: Zine, now = new Date()): Zine {
  const stamp = now.toISOString();
  const copy = structuredClone(zine);
  return {
    ...copy,
    id: newId(),
    title: `${zine.title} (kopia)`,
    spreads: copy.spreads.map((spread) => ({
      id: newId(),
      elements: spread.elements.map((element) => ({ ...element, id: newId() })),
    })),
    createdAt: stamp,
    updatedAt: stamp,
  };
}

export async function duplicateZine(db: ZiniarzDb, zine: Zine): Promise<Zine> {
  const copy = copyOfZine(zine);
  await saveZine(db, copy);
  return copy;
}

export async function removeZine(db: ZiniarzDb, id: string): Promise<void> {
  await deleteZine(db, id);
}

export async function exportZinFile(db: ZiniarzDb, zine: Zine): Promise<{ name: string; blob: Blob }> {
  const bytes = await writeZin(await bundleFromDb(db, zine.id));
  // JSZip returns a Uint8Array over a plain ArrayBuffer.
  return { name: `${fileSlug(zine.title)}.zin`, blob: new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/zip' }) };
}

/** Reading a .zin always creates a new zine (new id); it never overwrites one. */
export async function importZinFile(db: ZiniarzDb, file: Blob): Promise<Zine> {
  return importBundle(db, await readZin(await file.arrayBuffer()));
}
```

- [ ] **Step 4: Run it**

Run: `npx vitest run --project unit src/home/homeActions.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Write the failing browser test `src/home/coverThumbnail.browser.test.ts`**

```ts
import { expect, test } from 'vitest';
import { createPhotoElement, createZine } from '../model/factory';
import { newId } from '../model/ids';
import { openZiniarzDb, putImage } from '../storage/db';
import { expectColor, pixel } from '../test/pixels';
import { COVER_PX_PER_MM, renderCoverThumbnail } from './coverThumbnail';

async function pngBytes(color: string): Promise<ArrayBuffer> {
  const canvas = new OffscreenCanvas(10, 10);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 10, 10);
  return (await canvas.convertToBlob({ type: 'image/png' })).arrayBuffer();
}

async function toCanvas(url: string): Promise<HTMLCanvasElement> {
  const image = new Image();
  image.src = url;
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  canvas.getContext('2d')!.drawImage(image, 0, 0);
  return canvas;
}

test('the cover thumbnail shows page 1 with its background and photos', async () => {
  const db = await openZiniarzDb(`test-${newId()}`);
  const zine = createZine('t', 1);
  zine.pages[1] = { background: '#ff0000' };
  zine.spreads[0].elements.push(createPhotoElement('blue', { x: 148 + 50, y: 50, width: 40, height: 40 }));
  await putImage(db, { id: 'blue', mime: 'image/png', width: 10, height: 10, data: await pngBytes('#0000ff') });
  const canvas = await toCanvas(await renderCoverThumbnail(db, zine));
  expect([canvas.width, canvas.height]).toEqual([148 * COVER_PX_PER_MM, 210 * COVER_PX_PER_MM]);
  expectColor(pixel(canvas, 10, 10), [255, 0, 0]);
  expectColor(pixel(canvas, 70 * COVER_PX_PER_MM, 70 * COVER_PX_PER_MM), [0, 0, 255]);
});
```

- [ ] **Step 6: Run it**

Run: `npx vitest run --project browser src/home/coverThumbnail.browser.test.ts`
Expected: FAIL, `./coverThumbnail` cannot be resolved.

- [ ] **Step 7: Write `src/home/coverThumbnail.ts` and `src/home/download.ts`**

`src/home/coverThumbnail.ts`:

```ts
import { ensureFontsReady, registerZineFonts } from '../fonts/fontLoader';
import type { Zine } from '../model/types';
import { loadRenderAssets, releaseRenderAssets } from '../render/assets';
import { releaseCanvas } from '../render/canvasBytes';
import { renderPage } from '../render/renderPage';
import { getImage, type ZiniarzDb } from '../storage/db';

export const COVER_PX_PER_MM = 1.5;

/** Page 1 as a PNG data URL for the zine list. Loads only the cover's photos. */
export async function renderCoverThumbnail(db: ZiniarzDb, zine: Zine): Promise<string> {
  await registerZineFonts(db, zine);
  await ensureFontsReady(zine);
  const assets = await loadRenderAssets(zine, (id) => getImage(db, id), [0]);
  try {
    const canvas = renderPage(zine, 1, assets, { pxPerMm: COVER_PX_PER_MM, bleed: false });
    const url = canvas.toDataURL('image/png');
    releaseCanvas(canvas);
    return url;
  } finally {
    releaseRenderAssets(assets);
  }
}
```

`src/home/download.ts`:

```ts
/** Saves a file through the browser's download. */
export function downloadBlob(name: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
```

- [ ] **Step 8: Run it**

Run: `npx vitest run src/home`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/home
git commit -m "Add zine list actions, .zin export/import and cover thumbnails" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: The zine list screen

Opening the list first waits for pending autosaves, then prunes unused photos and fonts (spec: Magazyn), then lists the zines.

**Files:**
- Create: `src/home/ZineCard.tsx`, `src/home/HomeScreen.tsx`
- Modify: `src/App.tsx`, `src/app/app.css`
- Test: `src/home/HomeScreen.browser.test.tsx`

- [ ] **Step 1: Write the failing test `src/home/HomeScreen.browser.test.tsx`**

```tsx
import { render } from 'vitest-browser-react';
import { afterEach, expect, test } from 'vitest';
import { ConfirmHost } from '../app/ConfirmHost';
import { DbContext } from '../app/dbContext';
import { createPhotoElement, createZine } from '../model/factory';
import { newId } from '../model/ids';
import { listImageIds, listZines, openZiniarzDb, putImage, saveZine, type ZiniarzDb } from '../storage/db';
import { HomeScreen } from './HomeScreen';

async function setup(prepare?: (db: ZiniarzDb) => Promise<void>) {
  const db = await openZiniarzDb(`test-${newId()}`);
  await prepare?.(db);
  const screen = render(
    <DbContext.Provider value={db}>
      <HomeScreen />
      <ConfirmHost />
    </DbContext.Provider>,
  );
  return { db, screen };
}

afterEach(() => {
  window.location.hash = '';
});

test('creating a zine saves it and opens the editor', async () => {
  const { db, screen } = await setup();
  await expect.element(screen.getByText('Nie masz jeszcze żadnego zina.')).toBeVisible();
  await screen.getByLabelText('Tytuł').fill('Lato');
  await screen.getByLabelText('Kartki').fill('6');
  await expect.element(screen.getByText('= 24 strony')).toBeVisible();
  await screen.getByRole('button', { name: 'Nowy zin' }).click();
  await expect.poll(async () => (await listZines(db)).map((z) => [z.title, z.sheets])).toEqual([['Lato', 6]]);
  const [zine] = await listZines(db);
  await expect.poll(() => window.location.hash).toBe(`#/zin/${zine.id}`);
});

test('a zine can be duplicated and deleted after confirming', async () => {
  const { db, screen } = await setup((db) => saveZine(db, createZine('Lato', 5)));
  await expect.element(screen.getByRole('heading', { name: 'Lato', exact: true })).toBeVisible();
  await expect.element(screen.getByText('5 kartek · 20 stron')).toBeVisible();
  await screen.getByRole('button', { name: 'Powiel' }).click();
  await expect.element(screen.getByRole('heading', { name: 'Lato (kopia)' })).toBeVisible();

  await screen.getByRole('button', { name: 'Usuń' }).first().click();
  await screen.getByRole('dialog').getByRole('button', { name: 'Usuń' }).click();
  await expect.poll(async () => (await listZines(db)).length).toBe(1);
});

test('opening the list removes photos no zine uses', async () => {
  const { db, screen } = await setup(async (db) => {
    const zine = createZine('Ze zdjęciem', 1);
    zine.spreads[1].elements.push(createPhotoElement('used'));
    await saveZine(db, zine);
    const data = new ArrayBuffer(1);
    await putImage(db, { id: 'used', mime: 'image/jpeg', width: 1, height: 1, data });
    await putImage(db, { id: 'orphan', mime: 'image/jpeg', width: 1, height: 1, data });
  });
  await expect.element(screen.getByRole('heading', { name: 'Ze zdjęciem' })).toBeVisible();
  await expect.poll(() => listImageIds(db)).toEqual(['used']);
});
```

- [ ] **Step 2: Run it**

Run: `npx vitest run --project browser src/home/HomeScreen.browser.test.tsx`
Expected: FAIL, `./HomeScreen` cannot be resolved.

- [ ] **Step 3: Write `src/home/ZineCard.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { askConfirm } from '../app/confirm';
import { useDb } from '../app/dbContext';
import { errorMessage, notify } from '../app/notices';
import { countOf } from '../app/plural';
import { routeHash } from '../app/route';
import type { Zine } from '../model/types';
import { renderCoverThumbnail } from './coverThumbnail';
import { downloadBlob } from './download';
import { duplicateZine, exportZinFile, removeZine } from './homeActions';

export function ZineCard({ zine, onChanged }: { zine: Zine; onChanged(): void }) {
  const db = useDb();
  const [cover, setCover] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    renderCoverThumbnail(db, zine).then(
      (url) => !cancelled && setCover(url),
      () => {}, // a missing cover is not worth a message
    );
    return () => {
      cancelled = true;
    };
  }, [db, zine]);

  const run = (action: () => Promise<unknown>) => () =>
    action().then(onChanged, (error: unknown) => notify(errorMessage(error)));

  const remove = async () => {
    if (await askConfirm(`Usunąć zin „${zine.title}”? Tego nie da się cofnąć.`)) await removeZine(db, zine.id);
  };

  const save = async () => {
    const file = await exportZinFile(db, zine);
    downloadBlob(file.name, file.blob);
  };

  const pages = 4 * zine.sheets;
  return (
    <li className="zine-card">
      <a className="zine-cover" href={routeHash({ name: 'editor', zineId: zine.id })} aria-label={`Otwórz ${zine.title}`}>
        {cover ? <img src={cover} alt="" /> : <span className="zine-cover-empty" />}
      </a>
      <h2>{zine.title}</h2>
      <p className="muted">
        {countOf(zine.sheets, 'kartka', 'kartki', 'kartek')} · {countOf(pages, 'strona', 'strony', 'stron')}
      </p>
      <div className="zine-card-buttons">
        <a className="link-button primary" href={routeHash({ name: 'editor', zineId: zine.id })}>
          Otwórz
        </a>
        <button type="button" onClick={run(() => duplicateZine(db, zine))}>
          Powiel
        </button>
        <button type="button" onClick={run(save)}>
          Zapisz plik .zin
        </button>
        <button type="button" className="danger" onClick={run(remove)}>
          Usuń
        </button>
      </div>
    </li>
  );
}
```

- [ ] **Step 4: Write `src/home/HomeScreen.tsx`**

```tsx
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useDb } from '../app/dbContext';
import { errorMessage, notify } from '../app/notices';
import { countOf } from '../app/plural';
import { navigate } from '../app/route';
import { whenSavesSettled } from '../editor/state/autosave';
import { MAX_SHEETS, MIN_SHEETS } from '../model/geometry';
import type { Zine } from '../model/types';
import { pruneUnusedAssets } from '../storage/cleanup';
import { StorageFullError } from '../storage/db';
import { isNearlyFull, storageUsage, usageText, type StorageUsage } from '../storage/quota';
import { createNewZine, DEFAULT_SHEETS, importZinFile, listZinesForHome } from './homeActions';
import { ZineCard } from './ZineCard';

export function HomeScreen() {
  const db = useDb();
  const [zines, setZines] = useState<Zine[] | null>(null);
  const [usage, setUsage] = useState<StorageUsage | null>(null);
  const [title, setTitle] = useState('');
  const [sheets, setSheets] = useState(DEFAULT_SHEETS);

  const reload = useCallback(async () => {
    const result = await listZinesForHome(db);
    setZines(result.zines);
    if (result.unreadable > 0) notify(`Nie da się otworzyć zinów: ${result.unreadable}. Odśwież stronę.`);
    setUsage(await storageUsage());
  }, [db]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      // Never prune while the editor may still be saving: a new photo would look unused.
      await whenSavesSettled();
      await pruneUnusedAssets(db).catch(() => {});
      if (!cancelled) await reload();
    })();
    return () => {
      cancelled = true;
    };
  }, [db, reload]);

  const create = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const zine = await createNewZine(db, title, sheets);
      navigate({ name: 'editor', zineId: zine.id });
    } catch (error) {
      notify(errorMessage(error));
    }
  };

  const load = async (file: File) => {
    try {
      await importZinFile(db, file);
      await reload();
    } catch (error) {
      notify(`Nie da się otworzyć tego pliku. ${errorMessage(error)}`);
    }
  };

  return (
    <main className="home">
      <header className="home-header">
        <h1>ZINIARZ</h1>
        <label className="file-button">
          Wczytaj plik .zin
          <input
            type="file"
            accept=".zin"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) void load(file);
            }}
          />
        </label>
      </header>

      <form className="new-zine" onSubmit={create}>
        <label>
          Tytuł
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Bez tytułu" />
        </label>
        <label>
          Kartki
          <input
            type="number"
            min={MIN_SHEETS}
            max={MAX_SHEETS}
            value={sheets}
            onChange={(event) => setSheets(Number(event.target.value) || MIN_SHEETS)}
          />
        </label>
        <span className="muted">= {countOf(4 * sheets, 'strona', 'strony', 'stron')}</span>
        <button type="submit" className="primary">
          Nowy zin
        </button>
      </form>

      {zines === null ? (
        <p className="muted">Wczytywanie…</p>
      ) : zines.length === 0 ? (
        <p className="muted">Nie masz jeszcze żadnego zina.</p>
      ) : (
        <ul className="zine-grid">
          {zines.map((zine) => (
            <ZineCard key={zine.id} zine={zine} onChanged={reload} />
          ))}
        </ul>
      )}

      {usage && (
        <footer className="home-footer muted">
          {usageText(usage)}
          {isNearlyFull(usage) && <strong className="warning"> {new StorageFullError().message}</strong>}
        </footer>
      )}
    </main>
  );
}
```

- [ ] **Step 5: Show it on the home route in `src/App.tsx`**

Replace `import { useRoute } from './app/useRoute';` with

```tsx
import { useRoute } from './app/useRoute';
import { HomeScreen } from './home/HomeScreen';
```

and replace

```tsx
      return <main className="screen-message">Lista zinów</main>;
```

with

```tsx
      return <HomeScreen />;
```

- [ ] **Step 6: Append to `src/app/app.css`**

```css
.muted {
  color: var(--muted);
}

.warning {
  color: var(--danger);
}

.home {
  max-width: 1080px;
  margin: 0 auto;
  padding: 24px;
}

.home-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.home-header h1 {
  letter-spacing: 0.08em;
}

.new-zine {
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  gap: 12px;
  margin: 16px 0 24px;
}

.new-zine label {
  display: grid;
  gap: 4px;
}

.new-zine input[type='number'] {
  width: 72px;
}

.zine-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 20px;
  padding: 0;
  list-style: none;
}

.zine-card h2 {
  margin: 8px 0 0;
  font-size: 16px;
}

.zine-card p {
  margin: 2px 0 8px;
}

.zine-cover {
  display: block;
  aspect-ratio: 148 / 210;
  background: var(--paper);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.15);
}

.zine-cover img {
  width: 100%;
  height: 100%;
  display: block;
}

.zine-card-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.home-footer {
  margin-top: 32px;
}
```

- [ ] **Step 7: Run it**

Run: `npx vitest run --project browser src/home src/App.browser.test.tsx && npm run typecheck`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/home src/App.tsx src/app/app.css
git commit -m "Add the zine list screen with cleanup and storage usage" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: Editor canvas I: drawing, viewport, clicks

`EditorStage` is plain Konva. Three layers: `content` (the spread from `buildSpreadGroup`, scaled so 1 unit = 1 mm), `overlay` (guides, missing-page shade, the selection proxy; scaled, not listening) and `tools` (the Transformer, unscaled: Konva's Transformer works in screen pixels and ignores its parents' scale). This task draws, fits the spread into the box, reports clicks and double-clicks, and shows the selection; Task 15 adds dragging, resizing and cropping.

**Files:**
- Create: `src/editor/canvas/EditorStage.ts`, `src/test/stageHarness.ts`
- Test: `src/editor/canvas/EditorStage.browser.test.ts`

- [ ] **Step 1: Write the test harness `src/test/stageHarness.ts`**

```ts
import { vi } from 'vitest';
import { EditorStage, type StageView } from '../editor/canvas/EditorStage';
import type { Zine } from '../model/types';

/** An EditorStage in an 800×500 box, spying callbacks, and helpers to turn spread mm into box pixels. */
export function mountStage(zine: Zine, view: Partial<StageView> = {}) {
  const container = document.createElement('div');
  container.style.cssText = 'width: 800px; height: 500px; position: relative';
  document.body.append(container);
  const callbacks = {
    select: vi.fn(),
    clickPage: vi.fn(),
    change: vi.fn(),
    crop: vi.fn(),
    doubleClick: vi.fn(),
    endCrop: vi.fn(),
  };
  const editor = new EditorStage(container, callbacks);
  editor.resize(800, 500);
  const fullView: StageView = {
    zine,
    spread: 1,
    assets: { images: new Map() },
    selectedId: null,
    mode: 'idle',
    showGuides: true,
    ...view,
  };
  editor.update(fullView);
  const surface = container.querySelector('.konvajs-content') as HTMLElement;
  /** Box pixels of a point in spread mm (for userEvent `position`). */
  const at = (x: number, y: number) => {
    const v = editor.viewport();
    return { x: v.originX + x * v.scale, y: v.originY + y * v.scale };
  };
  const cleanup = () => {
    editor.destroy();
    container.remove();
  };
  return { editor, callbacks, surface, at, view: fullView, container, cleanup };
}
```

- [ ] **Step 2: Write the failing test `src/editor/canvas/EditorStage.browser.test.ts`**

Clicks use `userEvent.click(surface, { position })`, a real mouse click at box pixels; `at(x, y)` turns spread mm into those pixels.

```ts
import { userEvent } from '@vitest/browser/context';
import type Konva from 'konva';
import { afterEach, expect, test } from 'vitest';
import { createPhotoElement, createTextElement, createZine } from '../../model/factory';
import { mountStage } from '../../test/stageHarness';
import { PHOTO_ANCHORS, TEXT_ANCHORS } from './EditorStage';

let cleanup = () => {};
afterEach(() => cleanup());

function mount(...args: Parameters<typeof mountStage>) {
  const mounted = mountStage(...args);
  cleanup = mounted.cleanup;
  return mounted;
}

function sample() {
  const zine = createZine('t', 1);
  const photo = createPhotoElement('missing', { x: 20, y: 40, width: 60, height: 60 });
  const text = createTextElement({ text: 'Napis', x: 178, y: 30, width: 88, size: 24 });
  zine.spreads[1].elements.push(photo, text);
  return { zine, photo, text };
}

const transformer = (stage: Konva.Stage) => stage.findOne('Transformer') as Konva.Transformer;

test('the spread with its bleed fits the box, centred', () => {
  const { editor } = mount(sample().zine);
  const { scale, originX, originY } = editor.viewport();
  expect(scale).toBeCloseTo((500 - 48) / 216, 5);
  expect(originX).toBeCloseTo((800 - 296 * scale) / 2, 5);
  expect(originY).toBeCloseTo((500 - 210 * scale) / 2, 5);
  const box = editor.stage.container().getBoundingClientRect();
  const point = editor.toSpreadMm(box.left + originX + 10 * scale, box.top + originY + 20 * scale);
  expect(point.x).toBeCloseTo(10, 5);
  expect(point.y).toBeCloseTo(20, 5);
});

test('clicking an element selects it', async () => {
  const { zine, photo } = sample();
  const { callbacks, surface, at } = mount(zine);
  await userEvent.click(surface, { position: at(50, 70) });
  expect(callbacks.select).toHaveBeenCalledWith(photo.id);
});

test('clicking an empty page reports the page; clicking outside reports null', async () => {
  const { callbacks, surface, at } = mount(sample().zine);
  await userEvent.click(surface, { position: at(100, 180) });
  expect(callbacks.clickPage).toHaveBeenLastCalledWith(2);
  await userEvent.click(surface, { position: at(250, 180) });
  expect(callbacks.clickPage).toHaveBeenLastCalledWith(3);
  await userEvent.click(surface, { position: at(100, -8) });
  expect(callbacks.clickPage).toHaveBeenLastCalledWith(null);
  expect(callbacks.select).not.toHaveBeenCalled();
});

test('double-clicking an element asks to edit it', async () => {
  const { zine, text } = sample();
  const { callbacks, surface, at } = mount(zine);
  await userEvent.dblClick(surface, { position: at(190, 34) });
  expect(callbacks.doubleClick).toHaveBeenCalledWith(text.id);
});

test('guides follow the switch; the missing page next to a cover is shaded', () => {
  const { zine } = sample();
  const { editor, view } = mount(zine);
  expect(editor.stage.find('.guide-margin')).toHaveLength(2);
  expect(editor.stage.find('.missing-page')).toHaveLength(0);
  editor.update({ ...view, showGuides: false, spread: 0 });
  expect(editor.stage.find('.guide-margin')).toHaveLength(0);
  expect(editor.stage.find('.missing-page')).toHaveLength(1);
});

test('a selected text gets side handles only, a photo gets all eight', () => {
  const { zine, photo, text } = sample();
  const { editor, view } = mount(zine, { selectedId: text.id });
  expect(transformer(editor.stage).enabledAnchors()).toEqual(TEXT_ANCHORS);
  expect(transformer(editor.stage).nodes()).toHaveLength(1);
  editor.update({ ...view, selectedId: photo.id });
  expect(transformer(editor.stage).enabledAnchors()).toEqual(PHOTO_ANCHORS);
  editor.update({ ...view, selectedId: null });
  expect(transformer(editor.stage).nodes()).toHaveLength(0);
});

test('while a text is being typed, its canvas node is hidden', () => {
  const { zine, text } = sample();
  const { editor } = mount(zine, { selectedId: text.id, mode: 'text' });
  const node = editor.stage.findOne((n: Konva.Node) => n.id() === text.id)!;
  expect(node.visible()).toBe(false);
  expect(transformer(editor.stage).nodes()).toHaveLength(0);
});
```

- [ ] **Step 3: Run it**

Run: `npx vitest run --project browser src/editor/canvas/EditorStage.browser.test.ts`
Expected: FAIL, `./EditorStage` cannot be resolved.

- [ ] **Step 4: Write `src/editor/canvas/EditorStage.ts`**

```ts
import Konva from 'konva';
import { BLEED, PAGE_HEIGHT, SPREAD_WIDTH } from '../../model/geometry';
import type { Frame, PhotoCrop, PhotoElement, Zine, ZineElement } from '../../model/types';
import type { RenderAssets } from '../../render/assets';
import { buildSpreadGroup, ELEMENT_NODE_NAME } from '../../render/buildSpread';
import { buildGuidesGroup, buildMissingPagesShade } from '../../render/guides';
import { imagePlacement } from '../../render/photoGeometry';
import { pageAtPoint } from '../geometry/placement';
import type { EditorMode } from '../state/store';

export const STAGE_PADDING_PX = 24;
const SELECTION_COLOR = '#2b6cff';
export const TEXT_ANCHORS = ['middle-left', 'middle-right'];
export const PHOTO_ANCHORS = [
  'top-left',
  'top-center',
  'top-right',
  'middle-right',
  'bottom-right',
  'bottom-center',
  'bottom-left',
  'middle-left',
];

/** Everything the canvas shows; the React wrapper passes a new view after each store change. */
export interface StageView {
  zine: Zine;
  spread: number;
  assets: RenderAssets;
  selectedId: string | null;
  mode: EditorMode;
  showGuides: boolean;
}

/** What the canvas asks the store to do. */
export interface StageCallbacks {
  select(id: string): void;
  clickPage(page: number | null): void;
  /** After a drag, resize or rotation, in spread mm. */
  change(id: string, patch: Partial<Omit<Frame, 'id'>>): void;
  crop(id: string, crop: PhotoCrop): void;
  doubleClick(id: string): void;
  endCrop(): void;
}

/** Where spread mm (0, 0) lies in the stage, and how many pixels one mm takes. */
export interface Viewport {
  scale: number;
  originX: number;
  originY: number;
}

function elementNodeOf(target: Konva.Node): Konva.Node | null {
  if (target.hasName(ELEMENT_NODE_NAME)) return target;
  return target.findAncestor(`.${ELEMENT_NODE_NAME}`) ?? null;
}

/**
 * The editor canvas, in plain Konva. The spread itself is drawn by the shared renderer
 * (buildSpreadGroup); this class only adds guides, selection, snapping and pointer handling.
 * Layers: `content` (spread, scaled to mm), `overlay` (guides, shade, snap lines, the selection
 * proxy; scaled, not listening) and `tools` (the Transformer; unscaled, it works in screen pixels).
 */
export class EditorStage {
  readonly stage: Konva.Stage;
  private readonly content = new Konva.Layer();
  private readonly overlay = new Konva.Layer({ listening: false });
  private readonly tools = new Konva.Layer();
  private readonly decorations = new Konva.Group();
  /** Invisible rectangle matching the selected frame; the Transformer edits it, not the photo itself. */
  private readonly proxy = new Konva.Rect();
  private readonly transformer: Konva.Transformer;
  private view: StageView | null = null;
  private viewportState: Viewport = { scale: 1, originX: 0, originY: 0 };

  constructor(
    container: HTMLDivElement,
    private readonly callbacks: StageCallbacks,
  ) {
    this.stage = new Konva.Stage({ container, width: Math.max(1, container.clientWidth), height: Math.max(1, container.clientHeight) });
    this.transformer = new Konva.Transformer({
      rotateEnabled: true,
      flipEnabled: false,
      keepRatio: true,
      shiftBehavior: 'inverted', // corners keep proportions; Shift frees them
      rotationSnaps: [0, 90, 180, 270],
      rotationSnapTolerance: 5,
      anchorSize: 9,
      borderStroke: SELECTION_COLOR,
      anchorStroke: SELECTION_COLOR,
      ignoreStroke: true,
    });
    this.overlay.add(this.decorations, this.proxy);
    this.tools.add(this.transformer);
    this.stage.add(this.content, this.overlay, this.tools);

    this.stage.on('click tap', (event) => this.handleClick(event));
    this.stage.on('dblclick dbltap', (event) => this.handleDoubleClick(event));
  }

  destroy(): void {
    this.stage.destroy();
  }

  /** Fits the spread with its bleed into the container, centred. */
  resize(width: number, height: number): void {
    this.stage.size({ width: Math.max(1, width), height: Math.max(1, height) });
    const fullWidth = SPREAD_WIDTH + 2 * BLEED;
    const fullHeight = PAGE_HEIGHT + 2 * BLEED;
    const scale = Math.max(
      0.1,
      Math.min((width - 2 * STAGE_PADDING_PX) / fullWidth, (height - 2 * STAGE_PADDING_PX) / fullHeight),
    );
    this.viewportState = {
      scale,
      originX: (width - SPREAD_WIDTH * scale) / 2,
      originY: (height - PAGE_HEIGHT * scale) / 2,
    };
    for (const layer of [this.content, this.overlay]) {
      layer.scale({ x: scale, y: scale });
      layer.position({ x: this.viewportState.originX, y: this.viewportState.originY });
    }
    this.rebuild();
  }

  viewport(): Viewport {
    return { ...this.viewportState };
  }

  /** Spread mm under a point in client (page) pixels, for file drops. */
  toSpreadMm(clientX: number, clientY: number): { x: number; y: number } {
    const box = this.stage.container().getBoundingClientRect();
    const { scale, originX, originY } = this.viewportState;
    return { x: (clientX - box.left - originX) / scale, y: (clientY - box.top - originY) / scale };
  }

  update(view: StageView): void {
    this.view = view;
    this.rebuild();
  }

  private rebuild(): void {
    const view = this.view;
    if (!view) return;
    this.content.destroyChildren();
    const spread = buildSpreadGroup(view.zine, view.spread, view.assets);
    for (const node of spread.getChildren((child) => child.hasName(ELEMENT_NODE_NAME))) {
      if (view.mode === 'text' && node.id() === view.selectedId) node.visible(false);
    }
    this.content.add(spread);
    this.decorations.destroyChildren();
    this.decorations.add(buildMissingPagesShade(view.zine, view.spread));
    if (view.showGuides) this.decorations.add(buildGuidesGroup(view.zine, view.spread, this.viewportState.scale));
    this.attachSelection();
    this.stage.batchDraw();
  }

  private selectedElement(): ZineElement | null {
    const view = this.view;
    if (!view?.selectedId) return null;
    return view.zine.spreads[view.spread]?.elements.find((e) => e.id === view.selectedId) ?? null;
  }

  private selectedNode(): Konva.Node | null {
    const id = this.view?.selectedId;
    if (!id) return null;
    return this.content.findOne((node: Konva.Node) => node.hasName(ELEMENT_NODE_NAME) && node.id() === id) ?? null;
  }

  private attachSelection(): void {
    const node = this.selectedNode();
    const element = this.selectedElement();
    if (!node || !element || this.view?.mode === 'text') {
      this.transformer.nodes([]);
      return;
    }
    this.syncProxy(node);
    if (this.view?.mode === 'crop' && element.kind === 'photo') {
      this.transformer.nodes([]);
      this.decorations.add(this.cropGhost(element));
      return;
    }
    this.transformer.enabledAnchors(element.kind === 'text' ? TEXT_ANCHORS : PHOTO_ANCHORS);
    this.transformer.nodes([this.proxy]);
    this.transformer.forceUpdate();
  }

  /** Element nodes are centred (offset = half size), so the proxy copies position, offset and rotation. */
  private syncProxy(node: Konva.Node): void {
    const width = node.offsetX() * 2;
    const height = node.offsetY() * 2;
    this.proxy.setAttrs({
      x: node.x(),
      y: node.y(),
      width,
      height,
      offsetX: width / 2,
      offsetY: height / 2,
      rotation: node.rotation(),
      scaleX: 1,
      scaleY: 1,
    });
  }

  private pointerMm(): { x: number; y: number } | null {
    return this.content.getRelativePointerPosition();
  }

  private handleClick(event: Konva.KonvaEventObject<MouseEvent>): void {
    const view = this.view;
    if (!view || event.target.getLayer() === this.tools) return;
    const node = elementNodeOf(event.target);
    if (node) {
      this.callbacks.select(node.id());
      return;
    }
    const point = this.pointerMm();
    this.callbacks.clickPage(point ? pageAtPoint(view.spread, view.zine.sheets, point.x, point.y) : null);
  }

  private handleDoubleClick(event: Konva.KonvaEventObject<MouseEvent>): void {
    const node = elementNodeOf(event.target);
    if (node && this.view?.mode === 'idle') this.callbacks.doubleClick(node.id());
  }

  // --- cropping ---------------------------------------------------------------

  /** The whole photo, faint, so the part outside the frame is visible while cropping. */
  private cropGhost(element: PhotoElement): Konva.Group {
    const group = new Konva.Group({
      x: element.x + element.width / 2,
      y: element.y + element.height / 2,
      offsetX: element.width / 2,
      offsetY: element.height / 2,
      rotation: element.rotation,
    });
    const bitmap = this.view?.assets.images.get(element.imageId);
    if (bitmap) {
      const placed = imagePlacement(element, element.crop, bitmap.width, bitmap.height);
      group.add(
        new Konva.Image({
          image: bitmap,
          opacity: 0.35,
          x: element.flipX ? placed.x + placed.width : placed.x,
          y: placed.y,
          width: placed.width,
          height: placed.height,
          scaleX: element.flipX ? -1 : 1,
        }),
      );
    }
    group.add(
      new Konva.Rect({ width: element.width, height: element.height, stroke: SELECTION_COLOR, strokeWidth: 1 / this.viewportState.scale }),
    );
    return group;
  }
}
```

- [ ] **Step 5: Run it**

Run: `npx vitest run --project browser src/editor/canvas/EditorStage.browser.test.ts`
Expected: PASS (7 tests). If clicks land nowhere, check that `vite.config.ts` sets the 1280×900 viewport (Task 1).

- [ ] **Step 6: Commit**

```bash
git add src/editor/canvas src/test/stageHarness.ts
git commit -m "Add the Konva editor canvas: drawing, guides, selection, clicks" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 15: Editor canvas II: moving, resizing, rotating, cropping

- Dragging an element snaps its box (edges and centre) to the targets from `snapTargets`; Alt turns snapping off; pink lines show what caught it. While a drag or a resize runs, `update()` only stores the view (rebuilding would destroy the node under the mouse); the store change sent at the end brings the next update.
- The Transformer edits the proxy; the element mirrors it while dragging; `transformend` reports a frame (text: no height).
- Crop mode: pressing on the photo and moving shifts the crop offset (rotated into the frame's axes), the wheel zooms by 1.1, pressing elsewhere ends cropping.

**Files:**
- Modify: `src/editor/canvas/EditorStage.ts`
- Test: `src/editor/canvas/EditorStage.interaction.browser.test.ts`

- [ ] **Step 1: Write the failing test `src/editor/canvas/EditorStage.interaction.browser.test.ts`**

`userEvent.dragAndDrop(surface, surface, { sourcePosition, targetPosition })` is a real mouse drag; `{Alt>}` holds Alt for the drag. A pointer lands within about one pixel (0.5 mm here), hence `near`.

```ts
import { userEvent } from '@vitest/browser/context';
import type Konva from 'konva';
import { afterEach, expect, test } from 'vitest';
import { createPhotoElement, createTextElement, createZine } from '../../model/factory';
import { mountStage } from '../../test/stageHarness';
import { solidBitmap } from '../../test/pixels';

let cleanup = () => {};
afterEach(() => cleanup());

function mount(...args: Parameters<typeof mountStage>) {
  const mounted = mountStage(...args);
  cleanup = mounted.cleanup;
  return mounted;
}

/** Spread mm are about 2 px here; pointer positions land within a pixel. */
const near = (actual: number, expected: number) => expect(Math.abs(actual - expected)).toBeLessThan(1);

function photoZine() {
  const zine = createZine('t', 1);
  const photo = createPhotoElement('img', { x: 20, y: 40, width: 60, height: 60 });
  zine.spreads[1].elements.push(photo);
  return { zine, photo };
}

test('dragging a frame near a margin snaps it there and reports the new position', async () => {
  const { zine, photo } = photoZine();
  const { callbacks, surface, at } = mount(zine);
  await userEvent.dragAndDrop(surface, surface, { sourcePosition: at(50, 70), targetPosition: at(61, 70) });
  expect(callbacks.select).toHaveBeenCalledWith(photo.id);
  const [id, patch] = callbacks.change.mock.calls.at(-1)!;
  expect(id).toBe(photo.id);
  expect(patch.x).toBeCloseTo(30, 5); // the left margin, 1 mm away
  near(patch.y, 40);
});

test('holding Alt turns snapping off', async () => {
  const { zine } = photoZine();
  const { callbacks, surface, at } = mount(zine);
  await userEvent.keyboard('{Alt>}');
  await userEvent.dragAndDrop(surface, surface, { sourcePosition: at(50, 70), targetPosition: at(61, 70) });
  await userEvent.keyboard('{/Alt}');
  near(callbacks.change.mock.calls.at(-1)![1].x, 31);
});

test('a finished resize is reported as a frame in mm', () => {
  const { zine, photo } = photoZine();
  const { editor, callbacks } = mount(zine, { selectedId: photo.id });
  const transformer = editor.stage.findOne('Transformer') as Konva.Transformer;
  const proxy = transformer.nodes()[0];
  proxy.scaleX(2);
  transformer.fire('transformend');
  expect(callbacks.change).toHaveBeenCalledWith(photo.id, { x: -10, y: 40, width: 120, height: 60, rotation: 0 });
});

test('a resized text reports width but never height', () => {
  const zine = createZine('t', 1);
  const text = createTextElement({ text: 'a', x: 30, y: 30, width: 80 });
  zine.spreads[1].elements.push(text);
  const { editor, callbacks } = mount(zine, { selectedId: text.id });
  const transformer = editor.stage.findOne('Transformer') as Konva.Transformer;
  transformer.nodes()[0].scaleX(0.5);
  transformer.fire('transformend');
  const patch = callbacks.change.mock.calls[0][1];
  expect(Object.keys(patch).sort()).toEqual(['rotation', 'width', 'x', 'y']);
  expect(patch.width).toBeCloseTo(40, 5);
  expect(patch.x).toBeCloseTo(50, 5);
  expect(patch.y).toBeCloseTo(30, 5);
});

test('in crop mode, dragging moves the photo inside the frame and the wheel zooms', async () => {
  const { zine, photo } = photoZine();
  const assets = { images: new Map([['img', await solidBitmap(200, 100, '#00ff00')]]) };
  const { editor, callbacks, surface, at } = mount(zine, { selectedId: photo.id, mode: 'crop', assets });
  expect((editor.stage.findOne('Transformer') as Konva.Transformer).nodes()).toHaveLength(0);
  await userEvent.dragAndDrop(surface, surface, { sourcePosition: at(50, 70), targetPosition: at(40, 70) });
  const [id, crop] = callbacks.crop.mock.calls.at(-1)!;
  expect(id).toBe(photo.id);
  near(crop.offsetX, -10);
  near(crop.offsetY, 0);
  expect(callbacks.change).not.toHaveBeenCalled();
  editor.stage.fire('wheel', { evt: new WheelEvent('wheel', { deltaY: -100, cancelable: true }) });
  expect(callbacks.crop.mock.calls.at(-1)![1].zoom).toBeCloseTo(1.1, 5);
});

test('in crop mode, pressing outside the photo ends cropping', async () => {
  const { zine, photo } = photoZine();
  const { callbacks, surface, at } = mount(zine, { selectedId: photo.id, mode: 'crop' });
  await userEvent.click(surface, { position: at(120, 150) });
  expect(callbacks.endCrop).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run it**

Run: `npx vitest run --project browser src/editor/canvas/EditorStage.interaction.browser.test.ts`
Expected: FAIL (nothing is draggable yet, `change` and `crop` are never called).

- [ ] **Step 3: Replace `src/editor/canvas/EditorStage.ts` with the complete version**

Compared to Task 14 it adds the imports of `frameBounds`, `frameFromCentre` and the snapping functions, the constants `SNAP_DISTANCE_PX`, `MIN_FRAME_MM`, `CROP_WHEEL_STEP`, `SNAP_LINE_COLOR`, the fields `snapLines`, `interacting`, `dragTargets`, `cropDrag`, the Transformer's `boundBoxFunc`/`anchorDragBoundFunc`, the event wiring in the constructor, `draggable` in `rebuild`, and the sections "moving", "resizing and rotating" and the pointer part of "cropping".

```ts
import Konva from 'konva';
import { BLEED, frameBounds, PAGE_HEIGHT, SPREAD_WIDTH } from '../../model/geometry';
import type { Frame, PhotoCrop, PhotoElement, Zine, ZineElement } from '../../model/types';
import type { RenderAssets } from '../../render/assets';
import { buildSpreadGroup, ELEMENT_NODE_NAME } from '../../render/buildSpread';
import { buildGuidesGroup, buildMissingPagesShade } from '../../render/guides';
import { imagePlacement } from '../../render/photoGeometry';
import { frameFromCentre, pageAtPoint } from '../geometry/placement';
import { snapBox, snapPoint, snapTargets, type SnapTargets } from '../geometry/snapping';
import type { EditorMode } from '../state/store';

export const STAGE_PADDING_PX = 24;
export const SNAP_DISTANCE_PX = 6;
export const MIN_FRAME_MM = 5;
export const CROP_WHEEL_STEP = 1.1;
const SELECTION_COLOR = '#2b6cff';
const SNAP_LINE_COLOR = '#e5487f';
export const TEXT_ANCHORS = ['middle-left', 'middle-right'];
export const PHOTO_ANCHORS = [
  'top-left',
  'top-center',
  'top-right',
  'middle-right',
  'bottom-right',
  'bottom-center',
  'bottom-left',
  'middle-left',
];

/** Everything the canvas shows; the React wrapper passes a new view after each store change. */
export interface StageView {
  zine: Zine;
  spread: number;
  assets: RenderAssets;
  selectedId: string | null;
  mode: EditorMode;
  showGuides: boolean;
}

/** What the canvas asks the store to do. */
export interface StageCallbacks {
  select(id: string): void;
  clickPage(page: number | null): void;
  /** After a drag, resize or rotation, in spread mm. */
  change(id: string, patch: Partial<Omit<Frame, 'id'>>): void;
  crop(id: string, crop: PhotoCrop): void;
  doubleClick(id: string): void;
  endCrop(): void;
}

/** Where spread mm (0, 0) lies in the stage, and how many pixels one mm takes. */
export interface Viewport {
  scale: number;
  originX: number;
  originY: number;
}

function elementNodeOf(target: Konva.Node): Konva.Node | null {
  if (target.hasName(ELEMENT_NODE_NAME)) return target;
  return target.findAncestor(`.${ELEMENT_NODE_NAME}`) ?? null;
}

/**
 * The editor canvas, in plain Konva. The spread itself is drawn by the shared renderer
 * (buildSpreadGroup); this class only adds guides, selection, snapping and pointer handling.
 * Layers: `content` (spread, scaled to mm), `overlay` (guides, shade, snap lines, the selection
 * proxy; scaled, not listening) and `tools` (the Transformer; unscaled, it works in screen pixels).
 */
export class EditorStage {
  readonly stage: Konva.Stage;
  private readonly content = new Konva.Layer();
  private readonly overlay = new Konva.Layer({ listening: false });
  private readonly tools = new Konva.Layer();
  private readonly decorations = new Konva.Group();
  private readonly snapLines = new Konva.Group();
  /** Invisible rectangle matching the selected frame; the Transformer edits it, not the photo itself. */
  private readonly proxy = new Konva.Rect();
  private readonly transformer: Konva.Transformer;
  private view: StageView | null = null;
  private viewportState: Viewport = { scale: 1, originX: 0, originY: 0 };
  /** True while a drag or a resize runs: store updates must not rebuild the nodes under the pointer. */
  private interacting = false;
  private dragTargets: SnapTargets | null = null;
  private cropDrag: { id: string; startX: number; startY: number; crop: PhotoCrop; rotation: number } | null = null;

  constructor(
    container: HTMLDivElement,
    private readonly callbacks: StageCallbacks,
  ) {
    this.stage = new Konva.Stage({ container, width: Math.max(1, container.clientWidth), height: Math.max(1, container.clientHeight) });
    this.transformer = new Konva.Transformer({
      rotateEnabled: true,
      flipEnabled: false,
      keepRatio: true,
      shiftBehavior: 'inverted', // corners keep proportions; Shift frees them
      rotationSnaps: [0, 90, 180, 270],
      rotationSnapTolerance: 5,
      anchorSize: 9,
      borderStroke: SELECTION_COLOR,
      anchorStroke: SELECTION_COLOR,
      ignoreStroke: true,
      boundBoxFunc: (oldBox, newBox) => this.limitBox(oldBox, newBox),
      anchorDragBoundFunc: (_oldPos, newPos, event) => this.snapAnchor(newPos, event),
    });
    this.overlay.add(this.decorations, this.proxy, this.snapLines);
    this.tools.add(this.transformer);
    this.stage.add(this.content, this.overlay, this.tools);

    this.stage.on('click tap', (event) => this.handleClick(event));
    this.stage.on('dblclick dbltap', (event) => this.handleDoubleClick(event));
    this.content.on('dragstart', (event) => this.handleDragStart(event));
    this.content.on('dragmove', (event) => this.handleDragMove(event));
    this.content.on('dragend', (event) => this.handleDragEnd(event));
    this.transformer.on('transformstart', () => (this.interacting = true));
    this.transformer.on('transform', () => this.mirrorProxy());
    this.transformer.on('transformend', () => this.handleTransformEnd());
    this.stage.on('mousedown touchstart', (event) => this.handlePointerDown(event));
    this.stage.on('mousemove touchmove', () => this.handlePointerMove());
    this.stage.on('wheel', (event) => this.handleWheel(event));
    window.addEventListener('mouseup', this.endCropDrag);
    window.addEventListener('touchend', this.endCropDrag);
  }

  destroy(): void {
    window.removeEventListener('mouseup', this.endCropDrag);
    window.removeEventListener('touchend', this.endCropDrag);
    this.stage.destroy();
  }

  /** Fits the spread with its bleed into the container, centred. */
  resize(width: number, height: number): void {
    this.stage.size({ width: Math.max(1, width), height: Math.max(1, height) });
    const fullWidth = SPREAD_WIDTH + 2 * BLEED;
    const fullHeight = PAGE_HEIGHT + 2 * BLEED;
    const scale = Math.max(
      0.1,
      Math.min((width - 2 * STAGE_PADDING_PX) / fullWidth, (height - 2 * STAGE_PADDING_PX) / fullHeight),
    );
    this.viewportState = {
      scale,
      originX: (width - SPREAD_WIDTH * scale) / 2,
      originY: (height - PAGE_HEIGHT * scale) / 2,
    };
    for (const layer of [this.content, this.overlay]) {
      layer.scale({ x: scale, y: scale });
      layer.position({ x: this.viewportState.originX, y: this.viewportState.originY });
    }
    this.rebuild();
  }

  viewport(): Viewport {
    return { ...this.viewportState };
  }

  /** Spread mm under a point in client (page) pixels, for file drops. */
  toSpreadMm(clientX: number, clientY: number): { x: number; y: number } {
    const box = this.stage.container().getBoundingClientRect();
    const { scale, originX, originY } = this.viewportState;
    return { x: (clientX - box.left - originX) / scale, y: (clientY - box.top - originY) / scale };
  }

  update(view: StageView): void {
    this.view = view;
    // The next update after the drag or resize ends redraws everything.
    if (!this.interacting) this.rebuild();
  }

  private rebuild(): void {
    const view = this.view;
    if (!view) return;
    this.content.destroyChildren();
    const spread = buildSpreadGroup(view.zine, view.spread, view.assets);
    for (const node of spread.getChildren((child) => child.hasName(ELEMENT_NODE_NAME))) {
      node.draggable(view.mode === 'idle');
      node.dragDistance(3);
      if (view.mode === 'text' && node.id() === view.selectedId) node.visible(false);
    }
    this.content.add(spread);
    this.decorations.destroyChildren();
    this.decorations.add(buildMissingPagesShade(view.zine, view.spread));
    if (view.showGuides) this.decorations.add(buildGuidesGroup(view.zine, view.spread, this.viewportState.scale));
    this.snapLines.destroyChildren();
    this.attachSelection();
    this.stage.batchDraw();
  }

  private selectedElement(): ZineElement | null {
    const view = this.view;
    if (!view?.selectedId) return null;
    return view.zine.spreads[view.spread]?.elements.find((e) => e.id === view.selectedId) ?? null;
  }

  private selectedNode(): Konva.Node | null {
    const id = this.view?.selectedId;
    if (!id) return null;
    return this.content.findOne((node: Konva.Node) => node.hasName(ELEMENT_NODE_NAME) && node.id() === id) ?? null;
  }

  private attachSelection(): void {
    const node = this.selectedNode();
    const element = this.selectedElement();
    if (!node || !element || this.view?.mode === 'text') {
      this.transformer.nodes([]);
      return;
    }
    this.syncProxy(node);
    if (this.view?.mode === 'crop' && element.kind === 'photo') {
      this.transformer.nodes([]);
      this.decorations.add(this.cropGhost(element));
      return;
    }
    this.transformer.enabledAnchors(element.kind === 'text' ? TEXT_ANCHORS : PHOTO_ANCHORS);
    this.transformer.nodes([this.proxy]);
    this.transformer.forceUpdate();
  }

  /** Element nodes are centred (offset = half size), so the proxy copies position, offset and rotation. */
  private syncProxy(node: Konva.Node): void {
    const width = node.offsetX() * 2;
    const height = node.offsetY() * 2;
    this.proxy.setAttrs({
      x: node.x(),
      y: node.y(),
      width,
      height,
      offsetX: width / 2,
      offsetY: height / 2,
      rotation: node.rotation(),
      scaleX: 1,
      scaleY: 1,
    });
  }

  private pointerMm(): { x: number; y: number } | null {
    return this.content.getRelativePointerPosition();
  }

  private handleClick(event: Konva.KonvaEventObject<MouseEvent>): void {
    const view = this.view;
    if (!view || event.target.getLayer() === this.tools) return;
    const node = elementNodeOf(event.target);
    if (node) {
      this.callbacks.select(node.id());
      return;
    }
    const point = this.pointerMm();
    this.callbacks.clickPage(point ? pageAtPoint(view.spread, view.zine.sheets, point.x, point.y) : null);
  }

  private handleDoubleClick(event: Konva.KonvaEventObject<MouseEvent>): void {
    const node = elementNodeOf(event.target);
    if (node && this.view?.mode === 'idle') this.callbacks.doubleClick(node.id());
  }

  // --- moving -------------------------------------------------------------

  private handleDragStart(event: Konva.KonvaEventObject<DragEvent>): void {
    const node = event.target;
    if (!this.view || !node.hasName(ELEMENT_NODE_NAME)) return;
    this.interacting = true;
    this.dragTargets = snapTargets(this.view.zine, this.view.spread, node.id());
    if (node.id() !== this.view.selectedId) {
      this.transformer.nodes([]);
      this.callbacks.select(node.id());
    }
  }

  private handleDragMove(event: Konva.KonvaEventObject<DragEvent>): void {
    const node = event.target;
    if (!node.hasName(ELEMENT_NODE_NAME) || !this.dragTargets) return;
    const width = node.offsetX() * 2;
    const height = node.offsetY() * 2;
    if ((event.evt as MouseEvent | undefined)?.altKey) {
      this.drawSnapLines(null, null);
    } else {
      const box = frameBounds({ id: '', x: node.x() - width / 2, y: node.y() - height / 2, width, height, rotation: node.rotation() });
      const snap = snapBox(box, this.dragTargets, SNAP_DISTANCE_PX / this.viewportState.scale);
      node.position({ x: node.x() + snap.dx, y: node.y() + snap.dy });
      this.drawSnapLines(snap.lineX, snap.lineY);
    }
    if (node.id() === this.view?.selectedId) this.syncProxy(node);
  }

  private handleDragEnd(event: Konva.KonvaEventObject<DragEvent>): void {
    const node = event.target;
    if (!node.hasName(ELEMENT_NODE_NAME)) return;
    this.dragTargets = null;
    this.endInteraction();
    this.callbacks.change(node.id(), { x: node.x() - node.offsetX(), y: node.y() - node.offsetY() });
  }

  private endInteraction(): void {
    this.interacting = false;
    this.drawSnapLines(null, null);
  }

  private drawSnapLines(x: number | null, y: number | null): void {
    this.snapLines.destroyChildren();
    const px = 1 / this.viewportState.scale;
    const reach = 20;
    if (x !== null) {
      this.snapLines.add(
        new Konva.Line({ points: [x, -BLEED - reach, x, PAGE_HEIGHT + BLEED + reach], stroke: SNAP_LINE_COLOR, strokeWidth: px }),
      );
    }
    if (y !== null) {
      this.snapLines.add(
        new Konva.Line({ points: [-BLEED - reach, y, SPREAD_WIDTH + BLEED + reach, y], stroke: SNAP_LINE_COLOR, strokeWidth: px }),
      );
    }
    this.overlay.batchDraw();
  }

  // --- resizing and rotating -----------------------------------------------

  /** While the Transformer changes the proxy, the element follows it (stretched until the drop). */
  private mirrorProxy(): void {
    this.selectedNode()?.setAttrs({
      x: this.proxy.x(),
      y: this.proxy.y(),
      rotation: this.proxy.rotation(),
      scaleX: this.proxy.scaleX(),
      scaleY: this.proxy.scaleY(),
    });
  }

  private handleTransformEnd(): void {
    const element = this.selectedElement();
    this.endInteraction();
    if (!element) return;
    const p = this.proxy;
    const frame = frameFromCentre(p.x(), p.y(), p.width() * p.scaleX(), p.height() * p.scaleY(), p.rotation());
    // A text's height always comes from its text, so only width, position and rotation are kept.
    this.callbacks.change(
      element.id,
      element.kind === 'text' ? { x: frame.x, y: frame.y, width: frame.width, rotation: frame.rotation } : frame,
    );
  }

  private limitBox<T extends { width: number; height: number }>(oldBox: T, newBox: T): T {
    const min = MIN_FRAME_MM * this.viewportState.scale;
    return Math.abs(newBox.width) < min || Math.abs(newBox.height) < min ? oldBox : newBox;
  }

  /** Resize handles snap like dragged frames (not for rotated frames, not with Alt, not the rotation handle). */
  private snapAnchor(position: { x: number; y: number }, event: MouseEvent | undefined): { x: number; y: number } {
    const view = this.view;
    const element = this.selectedElement();
    if (!view || !element || event?.altKey || this.transformer.getActiveAnchor() === 'rotater' || element.rotation % 360 !== 0) {
      return position;
    }
    const { scale, originX, originY } = this.viewportState;
    const targets = snapTargets(view.zine, view.spread, element.id);
    const threshold = SNAP_DISTANCE_PX / scale;
    const x = snapPoint((position.x - originX) / scale, targets.xs, threshold);
    const y = snapPoint((position.y - originY) / scale, targets.ys, threshold);
    this.drawSnapLines(x.line, y.line);
    return { x: x.value * scale + originX, y: y.value * scale + originY };
  }

  // --- cropping ---------------------------------------------------------------

  /** The whole photo, faint, so the part outside the frame is visible while cropping. */
  private cropGhost(element: PhotoElement): Konva.Group {
    const group = new Konva.Group({
      x: element.x + element.width / 2,
      y: element.y + element.height / 2,
      offsetX: element.width / 2,
      offsetY: element.height / 2,
      rotation: element.rotation,
    });
    const bitmap = this.view?.assets.images.get(element.imageId);
    if (bitmap) {
      const placed = imagePlacement(element, element.crop, bitmap.width, bitmap.height);
      group.add(
        new Konva.Image({
          image: bitmap,
          opacity: 0.35,
          x: element.flipX ? placed.x + placed.width : placed.x,
          y: placed.y,
          width: placed.width,
          height: placed.height,
          scaleX: element.flipX ? -1 : 1,
        }),
      );
    }
    group.add(
      new Konva.Rect({ width: element.width, height: element.height, stroke: SELECTION_COLOR, strokeWidth: 1 / this.viewportState.scale }),
    );
    return group;
  }

  private handlePointerDown(event: Konva.KonvaEventObject<MouseEvent | TouchEvent>): void {
    if (this.view?.mode !== 'crop') return;
    const element = this.selectedElement();
    const point = this.pointerMm();
    if (element?.kind === 'photo' && point && elementNodeOf(event.target)?.id() === element.id) {
      this.cropDrag = { id: element.id, startX: point.x, startY: point.y, crop: { ...element.crop }, rotation: element.rotation };
    } else {
      this.callbacks.endCrop();
    }
  }

  private handlePointerMove(): void {
    const drag = this.cropDrag;
    const point = this.pointerMm();
    if (!drag || !point) return;
    // The crop offset lives in the frame's own (rotated) axes.
    const angle = (-drag.rotation * Math.PI) / 180;
    const dx = point.x - drag.startX;
    const dy = point.y - drag.startY;
    this.callbacks.crop(drag.id, {
      ...drag.crop,
      offsetX: drag.crop.offsetX + dx * Math.cos(angle) - dy * Math.sin(angle),
      offsetY: drag.crop.offsetY + dx * Math.sin(angle) + dy * Math.cos(angle),
    });
  }

  private readonly endCropDrag = (): void => {
    this.cropDrag = null;
  };

  private handleWheel(event: Konva.KonvaEventObject<WheelEvent>): void {
    const element = this.selectedElement();
    if (this.view?.mode !== 'crop' || element?.kind !== 'photo') return;
    event.evt.preventDefault();
    const zoom = element.crop.zoom * (event.evt.deltaY < 0 ? CROP_WHEEL_STEP : 1 / CROP_WHEEL_STEP);
    this.callbacks.crop(element.id, { ...element.crop, zoom: Math.max(1, zoom) });
  }
}
```

- [ ] **Step 4: Run both canvas tests**

Run: `npx vitest run --project browser src/editor/canvas`
Expected: PASS (13 tests).

- [ ] **Step 5: Commit**

```bash
git add src/editor/canvas
git commit -m "Move, snap, resize, rotate and crop on the editor canvas" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 16: Editor screen: loading, layout, top bar, shortcuts, autosave

`openEditorSession` loads a zine through `parseZine` (defaults and version check), registers its fonts, waits for them and loads its photos. The workspace gets the grid layout (top bar, spreads on the left, canvas in the middle, properties on the right; Tasks 17, 19 and 20 fill the three areas), the window shortcuts and autosave.

**Files:**
- Create: `src/editor/session.ts`, `src/editor/EditorContext.ts`, `src/editor/useEditorKeyboard.ts`, `src/editor/TopBar.tsx`, `src/editor/EditorScreen.tsx`, `src/test/editorHarness.tsx`
- Modify: `src/App.tsx`, `src/app/app.css`
- Test: `src/editor/EditorScreen.browser.test.tsx`

- [ ] **Step 1: Write the test harness `src/test/editorHarness.tsx`**

```tsx
import type { ReactNode } from 'react';
import { render } from 'vitest-browser-react';
import { ConfirmHost } from '../app/ConfirmHost';
import { DbContext } from '../app/dbContext';
import { NoticeList } from '../app/NoticeList';
import { EditorScreen } from '../editor/EditorScreen';
import { newId } from '../model/ids';
import type { Zine } from '../model/types';
import { loadZine, openZiniarzDb, saveZine, type ZiniarzDb } from '../storage/db';

/** Saves `zine` in a fresh test database and opens it in the full editor (with notices and dialogs). */
export async function openInEditor(zine: Zine, prepare?: (db: ZiniarzDb) => Promise<void>, extra?: ReactNode) {
  const db = await openZiniarzDb(`test-${newId()}`);
  await saveZine(db, zine);
  await prepare?.(db);
  const screen = render(
    <DbContext.Provider value={db}>
      <EditorScreen zineId={zine.id} />
      <NoticeList />
      <ConfirmHost />
      {extra}
    </DbContext.Provider>,
  );
  /** The zine as autosave left it in the database. */
  const stored = async () => (await loadZine(db, zine.id))!;
  return { db, screen, stored };
}
```

- [ ] **Step 2: Write the failing test `src/editor/EditorScreen.browser.test.tsx`**

```tsx
import { render } from 'vitest-browser-react';
import { expect, test } from 'vitest';
import { DbContext } from '../app/dbContext';
import { createZine } from '../model/factory';
import { newId } from '../model/ids';
import type { Zine } from '../model/types';
import { openZiniarzDb } from '../storage/db';
import { openInEditor } from '../test/editorHarness';
import { EditorScreen } from './EditorScreen';

test('opens a zine with its title, links to print and 3D, and nothing to undo yet', async () => {
  const zine = createZine('Lato', 5);
  const { screen } = await openInEditor(zine);
  await expect.element(screen.getByRole('heading', { name: 'Lato' })).toBeVisible();
  await expect.element(screen.getByRole('button', { name: 'Cofnij' })).toBeDisabled();
  await expect.element(screen.getByRole('link', { name: 'Druk' })).toHaveAttribute('href', `#/zin/${zine.id}/druk`);
  await expect.element(screen.getByRole('link', { name: 'Podgląd 3D' })).toHaveAttribute('href', `#/zin/${zine.id}/3d`);
  await expect.element(screen.getByRole('checkbox', { name: 'Pokaż prowadnice' })).toBeChecked();
});

test('an old stored zine without margins opens through parseZine', async () => {
  const { margins: _margins, ...old } = createZine('Stary', 1);
  const { screen } = await openInEditor(old as unknown as Zine);
  await expect.element(screen.getByRole('heading', { name: 'Stary' })).toBeVisible();
});

test('a missing zine shows a message and a way back', async () => {
  const db = await openZiniarzDb(`test-${newId()}`);
  const screen = render(
    <DbContext.Provider value={db}>
      <EditorScreen zineId="nope" />
    </DbContext.Provider>,
  );
  await expect.element(screen.getByText('Nie znaleziono tego zina. Może został usunięty.')).toBeVisible();
  await expect.element(screen.getByRole('link', { name: 'Wróć do listy zinów' })).toHaveAttribute('href', '#/');
});
```

- [ ] **Step 3: Run it**

Run: `npx vitest run --project browser src/editor/EditorScreen.browser.test.tsx`
Expected: FAIL, `../editor/EditorScreen` cannot be resolved.

- [ ] **Step 4: Write `src/editor/session.ts`**

```ts
import { loadFontChoices } from '../fonts/catalogue';
import type { FontChoice } from '../fonts/fontChoices';
import { ensureFontsReady, registerZineFonts } from '../fonts/fontLoader';
import { parseZine } from '../model/parse';
import type { Zine } from '../model/types';
import { loadRenderAssets, type RenderAssets } from '../render/assets';
import { getImage, loadZine, type ZiniarzDb } from '../storage/db';

export class ZineNotFoundError extends Error {
  constructor() {
    super('Nie znaleziono tego zina. Może został usunięty.');
    this.name = 'ZineNotFoundError';
  }
}

export interface EditorSession {
  zine: Zine;
  assets: RenderAssets;
  fonts: FontChoice[];
}

/** Everything the editor needs before it shows a zine. Stored data goes through parseZine. */
export async function openEditorSession(db: ZiniarzDb, zineId: string): Promise<EditorSession> {
  const raw = await loadZine(db, zineId);
  if (!raw) throw new ZineNotFoundError();
  const zine = parseZine(raw);
  await registerZineFonts(db, zine);
  await ensureFontsReady(zine);
  const assets = await loadRenderAssets(zine, (id) => getImage(db, id));
  const fonts = await loadFontChoices(db, zine);
  return { zine, assets, fonts };
}
```

- [ ] **Step 5: Write `src/editor/EditorContext.ts`**

```ts
import { createContext, useContext } from 'react';
import { useStore } from 'zustand';
import type { FontChoice } from '../fonts/fontChoices';
import type { RenderAssets } from '../render/assets';
import type { ZiniarzDb } from '../storage/db';
import type { EditorState, EditorStore } from './state/store';

/** The open zine's editor: store, database, loaded photos and the fonts the text panel offers. */
export interface EditorEnv {
  zineId: string;
  db: ZiniarzDb;
  store: EditorStore;
  assets: RenderAssets;
  fonts: FontChoice[];
  setFonts(fonts: FontChoice[]): void;
}

export const EditorContext = createContext<EditorEnv | null>(null);

export function useEditorEnv(): EditorEnv {
  const env = useContext(EditorContext);
  if (!env) throw new Error('EditorContext is missing');
  return env;
}

/** Subscribes to one value of the editor store. Selectors must return stable values (no new objects). */
export function useEditor<T>(selector: (state: EditorState) => T): T {
  return useStore(useEditorEnv().store, selector);
}
```

- [ ] **Step 6: Write `src/editor/useEditorKeyboard.ts`**

```ts
import { useEffect } from 'react';
import { applyKeyCommand, isTypingTarget, keyCommand } from './keyboard';
import type { EditorStore } from './state/store';

/** Editor shortcuts on the whole window, except while typing in a field or in a text frame. */
export function useEditorKeyboard(store: EditorStore): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target) || store.getState().mode === 'text') return;
      const command = keyCommand(event);
      if (command && applyKeyCommand(store, command)) event.preventDefault();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [store]);
}
```

- [ ] **Step 7: Write `src/editor/TopBar.tsx`**

```tsx
import { routeHash } from '../app/route';
import { useEditor, useEditorEnv } from './EditorContext';
import { selectCanRedo, selectCanUndo } from './state/store';

export function TopBar() {
  const { store, zineId } = useEditorEnv();
  const title = useEditor((s) => s.history.present.title);
  const canUndo = useEditor(selectCanUndo);
  const canRedo = useEditor(selectCanRedo);
  const showGuides = useEditor((s) => s.showGuides);

  return (
    <header className="editor-top">
      <a className="link-button" href={routeHash({ name: 'home' })}>
        ← Ziny
      </a>
      <h1 className="editor-title">{title}</h1>
      <div className="toolbar">
        <button type="button" onClick={() => store.getState().undo()} disabled={!canUndo} title="Cofnij (⌘Z)">
          Cofnij
        </button>
        <button type="button" onClick={() => store.getState().redo()} disabled={!canRedo} title="Ponów (⇧⌘Z)">
          Ponów
        </button>
        <label className="toggle">
          <input
            type="checkbox"
            checked={showGuides}
            onChange={(event) => store.getState().setShowGuides(event.target.checked)}
          />
          Pokaż prowadnice
        </label>
      </div>
      <div className="toolbar">
        <a className="link-button" href={routeHash({ name: 'preview3d', zineId })}>
          Podgląd 3D
        </a>
        <a className="link-button primary" href={routeHash({ name: 'print', zineId })}>
          Druk
        </a>
      </div>
    </header>
  );
}
```

- [ ] **Step 8: Write `src/editor/EditorScreen.tsx`**

Assets are released by the effect that loaded them (safe under React StrictMode's double effects); leaving the editor or hiding the tab (`pagehide`, `visibilitychange`) saves at once.

```tsx
import { useEffect, useState } from 'react';
import { useDb } from '../app/dbContext';
import { errorMessage, notify } from '../app/notices';
import { routeHash } from '../app/route';
import type { FontChoice } from '../fonts/fontChoices';
import { releaseRenderAssets, type RenderAssets } from '../render/assets';
import { measureTextHeight } from '../render/buildSpread';
import { saveZine } from '../storage/db';
import { EditorContext, type EditorEnv } from './EditorContext';
import { openEditorSession } from './session';
import { createAutosaver } from './state/autosave';
import { createEditorStore, type EditorStore } from './state/store';
import { TopBar } from './TopBar';
import { useEditorKeyboard } from './useEditorKeyboard';

interface Loaded {
  store: EditorStore;
  assets: RenderAssets;
}

function EditorWorkspace({ env }: { env: EditorEnv }) {
  useEditorKeyboard(env.store);

  // Autosave 500 ms after each change; leaving the editor or hiding the tab saves at once.
  useEffect(() => {
    const saver = createAutosaver((zine) => saveZine(env.db, zine), { onError: (error) => notify(errorMessage(error)) });
    const unsubscribe = env.store.subscribe((state, previous) => {
      if (state.history.present !== previous.history.present) saver.schedule(state.history.present);
    });
    const saveNow = () => void saver.flush();
    const saveWhenHidden = () => document.visibilityState === 'hidden' && saveNow();
    window.addEventListener('pagehide', saveNow);
    document.addEventListener('visibilitychange', saveWhenHidden);
    return () => {
      unsubscribe();
      window.removeEventListener('pagehide', saveNow);
      document.removeEventListener('visibilitychange', saveWhenHidden);
      saveNow();
    };
  }, [env.db, env.store]);

  return (
    <EditorContext.Provider value={env}>
      <div className="editor">
        <TopBar />
        <aside className="editor-spreads" />
        <section className="editor-canvas" />
        <aside className="editor-panel" />
      </div>
    </EditorContext.Provider>
  );
}

export function EditorScreen({ zineId }: { zineId: string }) {
  const db = useDb();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [fonts, setFonts] = useState<FontChoice[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let assets: RenderAssets | null = null;
    openEditorSession(db, zineId).then(
      (session) => {
        assets = session.assets;
        if (cancelled) {
          releaseRenderAssets(session.assets);
          return;
        }
        const store = createEditorStore(session.zine, {
          measureText: measureTextHeight,
          imageSize: (id) => {
            const bitmap = session.assets.images.get(id);
            return bitmap && { width: bitmap.width, height: bitmap.height };
          },
        });
        setFonts(session.fonts);
        setLoaded({ store, assets: session.assets });
      },
      (reason: unknown) => !cancelled && setError(errorMessage(reason)),
    );
    return () => {
      cancelled = true;
      if (assets) releaseRenderAssets(assets);
    };
  }, [db, zineId]);

  if (error) {
    return (
      <main className="screen-message">
        <p>{error}</p>
        <a className="link-button" href={routeHash({ name: 'home' })}>
          Wróć do listy zinów
        </a>
      </main>
    );
  }
  if (!loaded) return <main className="screen-message">Otwieranie zina…</main>;
  return <EditorWorkspace env={{ zineId, db, store: loaded.store, assets: loaded.assets, fonts, setFonts }} />;
}
```

- [ ] **Step 9: Show it on the editor route in `src/App.tsx`**

Replace `import { HomeScreen } from './home/HomeScreen';` with

```tsx
import { EditorScreen } from './editor/EditorScreen';
import { HomeScreen } from './home/HomeScreen';
```

and replace

```tsx
      return <main className="screen-message">Edytor</main>;
```

with

```tsx
      return <EditorScreen key={route.zineId} zineId={route.zineId} />;
```

- [ ] **Step 10: Append to `src/app/app.css`**

```css
.editor {
  display: grid;
  grid-template-columns: 180px minmax(0, 1fr) 300px;
  grid-template-rows: auto 1fr;
  grid-template-areas:
    'top top top'
    'spreads canvas panel';
  height: 100vh;
}

.editor-top {
  grid-area: top;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--line);
  background: var(--paper);
}

.editor-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 6px;
}

.toolbar:last-child {
  margin-left: auto;
}

.toggle {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.editor-spreads {
  grid-area: spreads;
  overflow-y: auto;
  border-right: 1px solid var(--line);
  background: var(--paper);
}

.editor-canvas {
  grid-area: canvas;
  position: relative;
  min-width: 0;
  min-height: 0;
  background: var(--canvas);
}

.editor-panel {
  grid-area: panel;
  overflow-y: auto;
  padding: 12px;
  border-left: 1px solid var(--line);
  background: var(--paper);
}
```

- [ ] **Step 11: Run it**

Run: `npx vitest run --project browser src/editor/EditorScreen.browser.test.tsx && npm run typecheck`
Expected: PASS (3 tests).

- [ ] **Step 12: Commit**

```bash
git add src/editor src/test/editorHarness.tsx src/App.tsx src/app/app.css
git commit -m "Add the editor screen with top bar, shortcuts and autosave" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 17: The canvas in the editor; adding photos and texts

`SpreadCanvas` creates one `EditorStage`, passes it a new view after every store change, sends its callbacks to the store, loads the fonts of the current spread in the background (re-measuring text heights when they arrive) and turns file drops into photos on the page under the pointer. `insert.ts` holds the "+ Zdjęcie" / "+ Napis" logic.

**Files:**
- Create: `src/fonts/useFontsVersion.ts`, `src/editor/insert.ts`, `src/editor/InsertButtons.tsx`, `src/editor/canvas/SpreadCanvas.tsx`
- Modify: `src/editor/TopBar.tsx`, `src/editor/EditorScreen.tsx`, `src/app/app.css`, `src/editor/EditorScreen.browser.test.tsx`
- Test: `src/editor/insert.browser.test.ts`

- [ ] **Step 1: Write the failing test `src/editor/insert.browser.test.ts`**

A 200×100 image in the 88×150 margin area of page 3 becomes 88×44, centred: x 178, y 30 + (150 − 44) / 2 = 83.

```ts
import { beforeEach, expect, test } from 'vitest';
import { noticeStore } from '../app/notices';
import { createZine } from '../model/factory';
import { newId } from '../model/ids';
import type { PhotoElement } from '../model/types';
import { measureTextHeight } from '../render/buildSpread';
import { getImage, openZiniarzDb } from '../storage/db';
import { insertPhotos, insertText } from './insert';
import { createEditorStore, selectedElement, selectZine } from './state/store';

async function pngFile(width: number, height: number, name = 'zdjecie.png'): Promise<File> {
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#336699';
  ctx.fillRect(0, 0, width, height);
  return new File([await canvas.convertToBlob({ type: 'image/png' })], name, { type: 'image/png' });
}

async function setup() {
  const db = await openZiniarzDb(`test-${newId()}`);
  const assets = { images: new Map<string, ImageBitmap>() };
  const store = createEditorStore(createZine('t', 1), {
    measureText: measureTextHeight,
    imageSize: (id) => assets.images.get(id),
  });
  store.getState().setSpread(1);
  return { db, assets, store };
}

beforeEach(() => noticeStore.setState({ notices: [] }));

test('a dropped photo fills the margin area of its page, keeping proportions', async () => {
  const env = await setup();
  await insertPhotos(env, [await pngFile(200, 100)], 3);
  const photo = selectZine(env.store.getState()).spreads[1].elements[0] as PhotoElement;
  expect(photo).toMatchObject({ kind: 'photo', x: 178, y: 83, width: 88, height: 44 });
  expect(await getImage(env.db, photo.imageId)).toBeDefined();
  expect(env.assets.images.get(photo.imageId)?.width).toBe(200);
  expect(env.store.getState().selectedId).toBe(photo.id);
});

test('several photos step aside; files that are not images are skipped with a message', async () => {
  const env = await setup();
  const text = new File(['hello'], 'notatki.txt', { type: 'text/plain' });
  await insertPhotos(env, [await pngFile(100, 100), text, await pngFile(100, 100)], null);
  const photos = selectZine(env.store.getState()).spreads[1].elements;
  expect(photos.map((p) => [p.x, p.y])).toEqual([
    [30, 61],
    [35, 66],
  ]);
  expect(noticeStore.getState().notices.map((n) => n.text)).toEqual(['Pominięto plików: 1 (to nie są obrazy).']);
});

test('"+ Napis" adds a frame across the margins of the clicked page, ready for typing', async () => {
  const { store } = await setup();
  store.getState().clickPage(3);
  insertText(store);
  expect(selectedElement(store.getState())).toMatchObject({ kind: 'text', text: 'Napis', x: 178, y: 30, width: 88 });
  expect(selectedElement(store.getState())!.height).toBeGreaterThan(0);
  expect(store.getState().mode).toBe('text');
});
```

- [ ] **Step 2: Append a failing test to `src/editor/EditorScreen.browser.test.tsx`**

```tsx
test('"+ Napis" adds a text on the cover and autosave stores it', async () => {
  const zine = createZine('Lato', 1);
  const { screen, stored } = await openInEditor(zine);
  await screen.getByRole('button', { name: '+ Napis' }).click();
  await expect
    .poll(async () => (await stored()).spreads[0].elements.map((e) => e.kind === 'text' && [e.text, e.x, e.width]))
    .toEqual([['Napis', 178, 88]]);
  await expect.element(screen.getByRole('button', { name: 'Cofnij' })).toBeEnabled();
});
```

- [ ] **Step 3: Run them**

Run: `npx vitest run --project browser src/editor/insert.browser.test.ts src/editor/EditorScreen.browser.test.tsx`
Expected: FAIL, `./insert` cannot be resolved and there is no "+ Napis" button.

- [ ] **Step 4: Write `src/fonts/useFontsVersion.ts`**

```ts
import { useEffect, useState } from 'react';

/** A number that grows whenever the browser finishes loading font files, so canvases can redraw. */
export function useFontsVersion(): number {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const bump = () => setVersion((v) => v + 1);
    document.fonts.addEventListener('loadingdone', bump);
    return () => document.fonts.removeEventListener('loadingdone', bump);
  }, []);
  return version;
}
```

- [ ] **Step 5: Write `src/editor/insert.ts`**

```ts
import { errorMessage, notify } from '../app/notices';
import { ImageImportError, prepareImage } from '../images/prepareImage';
import { createPhotoElement, createTextElement } from '../model/factory';
import type { StoredImage } from '../storage/db';
import { putImage } from '../storage/db';
import { bitmapOf } from '../render/assets';
import type { EditorEnv } from './EditorContext';
import { cascade, defaultPage, fitPhotoFrame, insertArea, newTextFrame } from './geometry/placement';
import { selectZine, type EditorStore } from './state/store';

export const NEW_TEXT = 'Napis';

/** The page new elements go to: the given one, else the last clicked page, else the first page of the spread. */
function targetPage(store: EditorStore, page: number | null): number {
  const state = store.getState();
  return page ?? state.activePage ?? defaultPage(state.spread, selectZine(state).sheets);
}

/**
 * Adds photos to the current spread. Each fills the margin area of `page` keeping its proportions;
 * further photos of the same drop step 5 mm aside. Files that are not images are skipped and counted.
 */
export async function insertPhotos(env: Pick<EditorEnv, 'db' | 'store' | 'assets'>, files: File[], page: number | null): Promise<void> {
  const { db, store, assets } = env;
  const area = insertArea(selectZine(store.getState()), targetPage(store, page));
  let placed = 0;
  let skipped = 0;
  for (const file of files) {
    let image: StoredImage;
    try {
      image = await prepareImage(file);
    } catch (error) {
      if (!(error instanceof ImageImportError)) throw error;
      skipped++;
      continue;
    }
    try {
      await putImage(db, image);
    } catch (error) {
      notify(errorMessage(error));
      break;
    }
    assets.images.set(image.id, await bitmapOf(image));
    store.getState().assetsChanged();
    store.getState().addElement(createPhotoElement(image.id, cascade(fitPhotoFrame(area, image.width, image.height), placed++)));
  }
  if (skipped > 0) notify(`Pominięto plików: ${skipped} (to nie są obrazy).`);
}

/** "+ Napis": a frame from margin to margin of the page, selected and ready for typing. */
export function insertText(store: EditorStore): void {
  const zine = selectZine(store.getState());
  const frame = newTextFrame(zine, targetPage(store, null));
  store.getState().addElement(createTextElement({ ...frame, text: NEW_TEXT }));
  store.getState().setMode('text');
}
```

- [ ] **Step 6: Write `src/editor/InsertButtons.tsx`**

```tsx
import { useRef } from 'react';
import { errorMessage, notify } from '../app/notices';
import { useEditorEnv } from './EditorContext';
import { insertPhotos, insertText } from './insert';

export function InsertButtons() {
  const env = useEditorEnv();
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="toolbar">
      <button type="button" onClick={() => input.current?.click()}>
        + Zdjęcie
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        hidden
        aria-label="Wybierz zdjęcia"
        onChange={(event) => {
          const files = [...(event.target.files ?? [])];
          event.target.value = '';
          if (files.length) insertPhotos(env, files, null).catch((error) => notify(errorMessage(error)));
        }}
      />
      <button type="button" onClick={() => insertText(env.store)}>
        + Napis
      </button>
    </div>
  );
}
```

- [ ] **Step 7: Write `src/editor/canvas/SpreadCanvas.tsx`**

```tsx
import { useEffect, useRef, useState } from 'react';
import { errorMessage, notify } from '../../app/notices';
import { loadSpreadFonts } from '../../fonts/fontLoader';
import { useFontsVersion } from '../../fonts/useFontsVersion';
import { useEditor, useEditorEnv } from '../EditorContext';
import { pageAtPoint } from '../geometry/placement';
import { insertPhotos } from '../insert';
import { findElement } from '../state/commands';
import { selectZine } from '../state/store';
import { EditorStage } from './EditorStage';

/** React wrapper around EditorStage: passes store changes in, store actions out, and takes file drops. */
export function SpreadCanvas() {
  const env = useEditorEnv();
  const { store, assets } = env;
  const zine = useEditor(selectZine);
  const spread = useEditor((s) => s.spread);
  const selectedId = useEditor((s) => s.selectedId);
  const mode = useEditor((s) => s.mode);
  const showGuides = useEditor((s) => s.showGuides);
  const assetsVersion = useEditor((s) => s.assetsVersion);
  const fontsVersion = useFontsVersion();
  const host = useRef<HTMLDivElement>(null);
  const [editor, setEditor] = useState<EditorStage | null>(null);

  useEffect(() => {
    const element = host.current!;
    const stage = new EditorStage(element, {
      select: (id) => store.getState().select(id),
      clickPage: (page) => store.getState().clickPage(page),
      change: (id, patch) => store.getState().updateElement(id, patch),
      crop: (id, crop) => store.getState().updateElement(id, { crop }, `crop:${id}`),
      doubleClick: (id) => {
        const state = store.getState();
        const target = findElement(selectZine(state), state.spread, id);
        if (!target) return;
        state.select(id);
        state.setMode(target.kind === 'text' ? 'text' : 'crop');
      },
      endCrop: () => store.getState().setMode('idle'),
    });
    const observer = new ResizeObserver(() => stage.resize(element.clientWidth, element.clientHeight));
    observer.observe(element);
    stage.resize(element.clientWidth, element.clientHeight);
    setEditor(stage);
    return () => {
      observer.disconnect();
      stage.destroy();
      setEditor(null);
    };
  }, [store]);

  useEffect(() => {
    editor?.update({ zine, spread, assets, selectedId, mode, showGuides });
  }, [editor, zine, spread, assets, selectedId, mode, showGuides, assetsVersion, fontsVersion]);

  // Fonts of this spread load in the background; when they arrive the text is measured again.
  useEffect(() => {
    void loadSpreadFonts(zine.spreads[spread]);
  }, [zine, spread]);
  useEffect(() => {
    if (fontsVersion > 0) store.getState().refreshTextHeights();
  }, [fontsVersion, store]);

  return (
    <div
      className="spread-canvas"
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes('Files')) event.preventDefault();
      }}
      onDrop={(event) => {
        event.preventDefault();
        const files = [...event.dataTransfer.files];
        if (!files.length || !editor) return;
        const point = editor.toSpreadMm(event.clientX, event.clientY);
        const page = pageAtPoint(spread, zine.sheets, point.x, point.y);
        insertPhotos(env, files, page).catch((error) => notify(errorMessage(error)));
      }}
    >
      <div ref={host} className="spread-stage" />
    </div>
  );
}
```

- [ ] **Step 8: Put the buttons into `src/editor/TopBar.tsx`**

Replace `import { useEditor, useEditorEnv } from './EditorContext';` with

```tsx
import { useEditor, useEditorEnv } from './EditorContext';
import { InsertButtons } from './InsertButtons';
```

and right after the line `<h1 className="editor-title">{title}</h1>` add `<InsertButtons />`:

```tsx
      <h1 className="editor-title">{title}</h1>
      <InsertButtons />
```

- [ ] **Step 9: Put the canvas into `src/editor/EditorScreen.tsx`**

Replace `import { EditorContext, type EditorEnv } from './EditorContext';` with

```tsx
import { SpreadCanvas } from './canvas/SpreadCanvas';
import { EditorContext, type EditorEnv } from './EditorContext';
```

and replace

```tsx
        <section className="editor-canvas" />
```

with

```tsx
        <section className="editor-canvas">
          <SpreadCanvas />
        </section>
```

- [ ] **Step 10: Append to `src/app/app.css`**

```css
.spread-canvas,
.spread-stage {
  position: absolute;
  inset: 0;
}
```

- [ ] **Step 11: Run them**

Run: `npx vitest run --project browser src/editor && npm run typecheck`
Expected: PASS.

- [ ] **Step 12: Commit**

```bash
git add src/fonts/useFontsVersion.ts src/editor src/app/app.css
git commit -m "Show the canvas in the editor and add photos and texts" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 18: Editing text in place

In text mode a transparent textarea lies exactly over the frame, styled from `textStyleMm` (the same numbers the renderer uses) at the canvas scale; the canvas hides that text node meanwhile. Typing goes to the store as one undo step (key `text:<id>`); Escape, Cmd+Enter or clicking elsewhere ends editing; an empty frame is removed.

**Files:**
- Create: `src/editor/canvas/TextEditor.tsx`
- Modify: `src/editor/canvas/SpreadCanvas.tsx`, `src/app/app.css`
- Test: `src/editor/canvas/TextEditor.browser.test.tsx`

- [ ] **Step 1: Write the failing test `src/editor/canvas/TextEditor.browser.test.tsx`**

```tsx
import { userEvent } from '@vitest/browser/context';
import { expect, test } from 'vitest';
import { createZine } from '../../model/factory';
import type { TextElement } from '../../model/types';
import { openInEditor } from '../../test/editorHarness';

test('"+ Napis" opens the text box; typing changes the text and Escape ends editing', async () => {
  const { screen, stored } = await openInEditor(createZine('Lato', 1));
  await screen.getByRole('button', { name: '+ Napis' }).click();
  const box = screen.getByRole('textbox', { name: 'Treść napisu' });
  await expect.element(box).toHaveFocus();
  await expect.element(box).toHaveValue('Napis');
  await userEvent.keyboard('Ala ma kota');
  await expect.element(box).toHaveValue('Ala ma kota');
  await userEvent.keyboard('{Escape}');
  await expect.element(box).not.toBeInTheDocument();
  await expect.poll(async () => ((await stored()).spreads[0].elements[0] as TextElement).text).toBe('Ala ma kota');
  // Typing was one undo step on top of adding the frame.
  await screen.getByRole('button', { name: 'Cofnij' }).click();
  await expect.poll(async () => ((await stored()).spreads[0].elements[0] as TextElement).text).toBe('Napis');
});

test('a text frame left empty is removed', async () => {
  const { screen, stored } = await openInEditor(createZine('Lato', 1));
  await screen.getByRole('button', { name: '+ Napis' }).click();
  await userEvent.keyboard('{Backspace}{Escape}');
  await expect.element(screen.getByRole('textbox', { name: 'Treść napisu' })).not.toBeInTheDocument();
  await expect.poll(async () => (await stored()).spreads[0].elements).toEqual([]);
});
```

- [ ] **Step 2: Run it**

Run: `npx vitest run --project browser src/editor/canvas/TextEditor.browser.test.tsx`
Expected: FAIL, no textbox "Treść napisu" appears.

- [ ] **Step 3: Write `src/editor/canvas/TextEditor.tsx`**

```tsx
import { useLayoutEffect, useRef } from 'react';
import { cssFontFamily } from '../../fonts/fontLoader';
import { textStyleMm } from '../../render/buildSpread';
import { useEditor, useEditorEnv } from '../EditorContext';
import { selectedElement } from '../state/store';
import type { Viewport } from './EditorStage';

/**
 * In-place text editing: a transparent textarea over the frame, styled with the same mm metrics
 * as the renderer (textStyleMm). The canvas hides the text node meanwhile. Escape, Cmd+Enter or
 * clicking elsewhere ends editing; an empty text frame is removed.
 */
export function TextEditor({ viewport }: { viewport: Viewport }) {
  const { store } = useEditorEnv();
  const element = useEditor(selectedElement);
  const area = useRef<HTMLTextAreaElement>(null);
  const text = element?.kind === 'text' ? element : null;

  useLayoutEffect(() => {
    area.current?.focus();
    area.current?.select();
  }, [text?.id]);

  useLayoutEffect(() => {
    const node = area.current;
    if (!node) return;
    node.style.height = '0px';
    node.style.height = `${node.scrollHeight}px`;
  });

  if (!text) return null;

  const finish = () => {
    const state = store.getState();
    if (state.mode !== 'text') return;
    const current = selectedElement(state);
    if (current?.kind === 'text' && current.text.trim() === '') state.deleteSelected();
    store.getState().setMode('idle');
  };

  const { scale, originX, originY } = viewport;
  const style = textStyleMm(text);
  return (
    <textarea
      ref={area}
      className="text-editor"
      aria-label="Treść napisu"
      spellCheck={false}
      value={text.text}
      onChange={(event) => store.getState().updateElement(text.id, { text: event.target.value }, `text:${text.id}`)}
      onKeyDown={(event) => {
        if (event.key === 'Escape' || (event.key === 'Enter' && (event.metaKey || event.ctrlKey))) {
          event.preventDefault();
          finish();
        }
      }}
      onBlur={finish}
      style={{
        left: originX + text.x * scale,
        top: originY + text.y * scale,
        width: text.width * scale,
        transform: `rotate(${text.rotation}deg)`,
        fontFamily: `${cssFontFamily(text.fontFamilyId)}, sans-serif`,
        fontSize: style.fontSize * scale,
        fontWeight: text.bold ? 700 : 400,
        fontStyle: text.italic ? 'italic' : 'normal',
        letterSpacing: style.letterSpacing * scale,
        lineHeight: style.lineHeight,
        color: text.color,
        textAlign: text.align,
      }}
    />
  );
}
```

- [ ] **Step 4: Replace `src/editor/canvas/SpreadCanvas.tsx`**

New: the viewport is kept in state (updated on resize) and the text editor is shown in text mode.

```tsx
import { useEffect, useRef, useState } from 'react';
import { errorMessage, notify } from '../../app/notices';
import { loadSpreadFonts } from '../../fonts/fontLoader';
import { useFontsVersion } from '../../fonts/useFontsVersion';
import { useEditor, useEditorEnv } from '../EditorContext';
import { pageAtPoint } from '../geometry/placement';
import { insertPhotos } from '../insert';
import { findElement } from '../state/commands';
import { selectZine } from '../state/store';
import { EditorStage, type Viewport } from './EditorStage';
import { TextEditor } from './TextEditor';

/** React wrapper around EditorStage: passes store changes in, store actions out, and takes file drops. */
export function SpreadCanvas() {
  const env = useEditorEnv();
  const { store, assets } = env;
  const zine = useEditor(selectZine);
  const spread = useEditor((s) => s.spread);
  const selectedId = useEditor((s) => s.selectedId);
  const mode = useEditor((s) => s.mode);
  const showGuides = useEditor((s) => s.showGuides);
  const assetsVersion = useEditor((s) => s.assetsVersion);
  const fontsVersion = useFontsVersion();
  const host = useRef<HTMLDivElement>(null);
  const [editor, setEditor] = useState<EditorStage | null>(null);
  const [viewport, setViewport] = useState<Viewport | null>(null);

  useEffect(() => {
    const element = host.current!;
    const stage = new EditorStage(element, {
      select: (id) => store.getState().select(id),
      clickPage: (page) => store.getState().clickPage(page),
      change: (id, patch) => store.getState().updateElement(id, patch),
      crop: (id, crop) => store.getState().updateElement(id, { crop }, `crop:${id}`),
      doubleClick: (id) => {
        const state = store.getState();
        const target = findElement(selectZine(state), state.spread, id);
        if (!target) return;
        state.select(id);
        state.setMode(target.kind === 'text' ? 'text' : 'crop');
      },
      endCrop: () => store.getState().setMode('idle'),
    });
    const fit = () => {
      stage.resize(element.clientWidth, element.clientHeight);
      setViewport(stage.viewport());
    };
    const observer = new ResizeObserver(fit);
    observer.observe(element);
    fit();
    setEditor(stage);
    return () => {
      observer.disconnect();
      stage.destroy();
      setEditor(null);
    };
  }, [store]);

  useEffect(() => {
    editor?.update({ zine, spread, assets, selectedId, mode, showGuides });
  }, [editor, zine, spread, assets, selectedId, mode, showGuides, assetsVersion, fontsVersion]);

  // Fonts of this spread load in the background; when they arrive the text is measured again.
  useEffect(() => {
    void loadSpreadFonts(zine.spreads[spread]);
  }, [zine, spread]);
  useEffect(() => {
    if (fontsVersion > 0) store.getState().refreshTextHeights();
  }, [fontsVersion, store]);

  return (
    <div
      className="spread-canvas"
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes('Files')) event.preventDefault();
      }}
      onDrop={(event) => {
        event.preventDefault();
        const files = [...event.dataTransfer.files];
        if (!files.length || !editor) return;
        const point = editor.toSpreadMm(event.clientX, event.clientY);
        const page = pageAtPoint(spread, zine.sheets, point.x, point.y);
        insertPhotos(env, files, page).catch((error) => notify(errorMessage(error)));
      }}
    >
      <div ref={host} className="spread-stage" />
      {mode === 'text' && viewport && <TextEditor viewport={viewport} />}
    </div>
  );
}
```

- [ ] **Step 5: Append to `src/app/app.css`**

```css
.text-editor {
  position: absolute;
  margin: 0;
  padding: 0;
  border: none;
  outline: 1px dashed var(--accent);
  background: transparent;
  resize: none;
  overflow: hidden;
  white-space: pre-wrap;
  overflow-wrap: break-word;
  transform-origin: center center;
}
```

- [ ] **Step 6: Run it**

Run: `npx vitest run --project browser src/editor && npm run typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/editor/canvas src/app/app.css
git commit -m "Edit texts in place over the canvas" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 19: Spread thumbnails and adding/removing sheets

Thumbnails come from `renderSpread` (0.5 px/mm, missing page greyed out), 150 ms after a change, cached by `thumbnailKey`. "+ kartka" / "− kartka" use `addSheet` / `sheetRemoval` / `removeSheet` from `src/model/sheets.ts` through the store.

**Files:**
- Create: `src/editor/useSpreadThumbnails.ts`, `src/editor/SpreadList.tsx`
- Modify: `src/editor/EditorScreen.tsx`, `src/app/app.css`
- Test: `src/editor/SpreadList.browser.test.tsx`

- [ ] **Step 1: Write the failing test `src/editor/SpreadList.browser.test.tsx`**

```tsx
import { expect, test } from 'vitest';
import { createTextElement, createZine } from '../model/factory';
import { openInEditor } from '../test/editorHarness';

const labels = ['Okładka', '2–3', '4–5', '6–7', 'Tył'];

test('lists spreads with thumbnails; clicking one makes it current', async () => {
  const { screen } = await openInEditor(createZine('Lato', 2));
  const list = screen.getByRole('navigation', { name: 'Rozkładówki' });
  for (const label of labels) await expect.element(list.getByRole('button', { name: label })).toBeVisible();
  await expect.poll(() => document.querySelectorAll('.spread-thumb img').length).toBe(5);
  await list.getByRole('button', { name: '4–5' }).click();
  await expect.element(list.getByRole('button', { name: '4–5' })).toHaveAttribute('aria-current', 'true');
});

test('"+ kartka" adds four pages after the current spread', async () => {
  const { screen, stored } = await openInEditor(createZine('Lato', 2));
  await screen.getByRole('button', { name: '+ kartka' }).click();
  await expect.element(screen.getByText('3 kartki · 12 stron')).toBeVisible();
  await expect.poll(async () => (await stored()).sheets).toBe(3);
});

test('"− kartka" removes empty pages at once', async () => {
  const { screen, stored } = await openInEditor(createZine('Lato', 2));
  await screen.getByRole('button', { name: '− kartka' }).click();
  await expect.poll(async () => (await stored()).sheets).toBe(1);
});

test('"− kartka" asks first when the pages have content, and highlights them', async () => {
  const zine = createZine('Lato', 2);
  zine.spreads[2].elements.push(createTextElement({ text: 'Treść' }));
  const { screen, stored } = await openInEditor(zine);
  const list = screen.getByRole('navigation', { name: 'Rozkładówki' });
  await list.getByRole('button', { name: '4–5' }).click();
  await screen.getByRole('button', { name: '− kartka' }).click();
  await expect.element(screen.getByRole('dialog')).toHaveTextContent('Strony 4–7 mają treść, która zniknie. Usunąć kartkę?');
  await expect.element(list.getByRole('button', { name: '4–5' })).toHaveClass('doomed');
  await expect.element(list.getByRole('button', { name: '6–7' })).toHaveClass('doomed');
  await screen.getByRole('button', { name: 'Usuń kartkę' }).click();
  await expect.poll(async () => (await stored()).sheets).toBe(1);
});
```

- [ ] **Step 2: Run it**

Run: `npx vitest run --project browser src/editor/SpreadList.browser.test.tsx`
Expected: FAIL, there is no "Rozkładówki" navigation.

- [ ] **Step 3: Write `src/editor/useSpreadThumbnails.ts`**

```ts
import { useEffect, useRef, useState } from 'react';
import type { Zine } from '../model/types';
import type { RenderAssets } from '../render/assets';
import { releaseCanvas } from '../render/canvasBytes';
import { renderSpread } from '../render/renderPage';
import { thumbnailKey } from './spreadLabels';

export const THUMB_PX_PER_MM = 0.5;
const CACHE_LIMIT = 300;
const DEBOUNCE_MS = 150;

/** PNG data URLs of every spread, redrawn shortly after a change; unchanged spreads come from a cache. */
export function useSpreadThumbnails(zine: Zine, assets: RenderAssets, version: number): string[] {
  const cache = useRef(new Map<string, string>());
  const [urls, setUrls] = useState<string[]>([]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (cache.current.size > CACHE_LIMIT) cache.current.clear();
      setUrls(
        zine.spreads.map((_, spread) => {
          const key = thumbnailKey(zine, spread, version);
          let url = cache.current.get(key);
          if (!url) {
            const canvas = renderSpread(zine, spread, assets, { pxPerMm: THUMB_PX_PER_MM, shadeMissing: true });
            url = canvas.toDataURL('image/png');
            releaseCanvas(canvas);
            cache.current.set(key, url);
          }
          return url;
        }),
      );
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [zine, assets, version]);

  return urls;
}
```

- [ ] **Step 4: Write `src/editor/SpreadList.tsx`**

```tsx
import { useState } from 'react';
import { askConfirm } from '../app/confirm';
import { countOf } from '../app/plural';
import { useFontsVersion } from '../fonts/useFontsVersion';
import { canAddSheet, removalNeedsConfirmation, sheetRemoval } from '../model/sheets';
import { useEditor, useEditorEnv } from './EditorContext';
import { removalMessage, spreadLabel } from './spreadLabels';
import { selectZine } from './state/store';
import { useSpreadThumbnails } from './useSpreadThumbnails';

export function SpreadList() {
  const { store, assets } = useEditorEnv();
  const zine = useEditor(selectZine);
  const current = useEditor((s) => s.spread);
  const assetsVersion = useEditor((s) => s.assetsVersion);
  const fontsVersion = useFontsVersion();
  const thumbnails = useSpreadThumbnails(zine, assets, assetsVersion * 10_000 + fontsVersion);
  const [hovering, setHovering] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const removal = sheetRemoval(zine, current);
  // Pages that "− kartka" would remove are highlighted while the button is hovered or the question is open.
  const doomed: number[] = (hovering || confirming) && removal ? removal.spreads : [];

  const removeSheet = async () => {
    if (!removal) return;
    let ok = true;
    if (removalNeedsConfirmation(zine, removal)) {
      setConfirming(true);
      ok = await askConfirm(removalMessage(removal.pages), 'Usuń kartkę');
      setConfirming(false);
    }
    if (ok) store.getState().removeSheet();
  };

  return (
    <nav className="spread-list" aria-label="Rozkładówki">
      <ol>
        {zine.spreads.map((spread, index) => (
          <li key={spread.id}>
            <button
              type="button"
              className={['spread-thumb', index === current && 'current', doomed.includes(index) && 'doomed']
                .filter(Boolean)
                .join(' ')}
              aria-current={index === current ? 'true' : undefined}
              onClick={() => store.getState().setSpread(index)}
            >
              {thumbnails[index] ? <img src={thumbnails[index]} alt="" /> : <span className="thumb-empty" />}
              <span>{spreadLabel(index, zine.sheets)}</span>
            </button>
          </li>
        ))}
      </ol>
      <div className="sheet-buttons">
        <button type="button" onClick={() => store.getState().addSheet()} disabled={!canAddSheet(zine)}>
          + kartka
        </button>
        <button
          type="button"
          disabled={!removal}
          onClick={() => void removeSheet()}
          onMouseEnter={() => setHovering(true)}
          onMouseLeave={() => setHovering(false)}
          onFocus={() => setHovering(true)}
          onBlur={() => setHovering(false)}
        >
          − kartka
        </button>
      </div>
      <p className="muted sheet-count">
        {countOf(zine.sheets, 'kartka', 'kartki', 'kartek')} · {countOf(4 * zine.sheets, 'strona', 'strony', 'stron')}
      </p>
    </nav>
  );
}
```

- [ ] **Step 5: Put the list into `src/editor/EditorScreen.tsx`**

Replace `import { createEditorStore, type EditorStore } from './state/store';` with

```tsx
import { SpreadList } from './SpreadList';
import { createEditorStore, type EditorStore } from './state/store';
```

and replace

```tsx
        <aside className="editor-spreads" />
```

with

```tsx
        <aside className="editor-spreads">
          <SpreadList />
        </aside>
```

- [ ] **Step 6: Append to `src/app/app.css`**

```css
.spread-list ol {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 12px;
  list-style: none;
}

.spread-thumb {
  display: grid;
  gap: 4px;
  width: 100%;
  padding: 4px;
  border: 2px solid transparent;
  background: transparent;
  justify-items: center;
}

.spread-thumb img,
.thumb-empty {
  width: 100%;
  aspect-ratio: 302 / 216;
  background: var(--canvas);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.25);
}

.spread-thumb.current {
  border-color: var(--accent);
}

.spread-thumb.doomed {
  border-color: var(--danger);
  background: #ffe5e7;
}

.sheet-buttons {
  display: flex;
  gap: 6px;
  padding: 0 12px;
}

.sheet-count {
  padding: 0 12px;
}
```

- [ ] **Step 7: Run it**

Run: `npx vitest run --project browser src/editor && npm run typecheck`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/editor src/app/app.css
git commit -m "Add spread thumbnails and adding and removing sheets" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 20: Properties panels

Right column: the selected photo's or text's settings; with nothing selected, the clicked page's background and the zine's title and margins. Every continuous field passes a merge key so typing or sliding is one undo step. The font list here is the plain selector; Task 21 adds uploading.

**Files:**
- Create: `src/editor/panels/NumberField.tsx`, `ColorField.tsx`, `LayerButtons.tsx`, `FontField.tsx`, `TextPanel.tsx`, `PhotoPanel.tsx`, `PagePanel.tsx`, `ZinePanel.tsx`, `PropertiesPanel.tsx` (all in `src/editor/panels/`), `src/test/panelHarness.tsx`
- Modify: `src/editor/EditorScreen.tsx`, `src/app/app.css`
- Test: `src/editor/panels/panels.browser.test.tsx`

- [ ] **Step 1: Write the test harness `src/test/panelHarness.tsx`**

```tsx
import { useState } from 'react';
import { render } from 'vitest-browser-react';
import { DbContext } from '../app/dbContext';
import { NoticeList } from '../app/NoticeList';
import { EditorContext } from '../editor/EditorContext';
import { PropertiesPanel } from '../editor/panels/PropertiesPanel';
import { createEditorStore, selectZine, type EditorStore } from '../editor/state/store';
import { BUILTIN_FONTS, type FontChoice } from '../fonts/fontChoices';
import { newId } from '../model/ids';
import type { Zine } from '../model/types';
import { measureTextHeight } from '../render/buildSpread';
import { openZiniarzDb } from '../storage/db';

/** The properties panel on its own, with a real store and a fresh test database. */
export async function renderPanel(zine: Zine, prepare?: (store: EditorStore) => void) {
  const db = await openZiniarzDb(`test-${newId()}`);
  const store = createEditorStore(zine, { measureText: measureTextHeight, imageSize: () => ({ width: 100, height: 100 }) });
  prepare?.(store);
  function Host() {
    const [fonts, setFonts] = useState<FontChoice[]>(BUILTIN_FONTS);
    return (
      <DbContext.Provider value={db}>
        <EditorContext.Provider value={{ zineId: zine.id, db, store, assets: { images: new Map() }, fonts, setFonts }}>
          <PropertiesPanel />
          <NoticeList />
        </EditorContext.Provider>
      </DbContext.Provider>
    );
  }
  const screen = render(<Host />);
  return { db, store, screen, zine: () => selectZine(store.getState()) };
}
```

- [ ] **Step 2: Write the failing test `src/editor/panels/panels.browser.test.tsx`**

`exact: true` on "Font" because Task 21 adds a "Wybierz pliki fontów" field that also contains the word.

```tsx
import { expect, test } from 'vitest';
import { createPhotoElement, createTextElement, createZine } from '../../model/factory';
import type { PhotoElement, TextElement } from '../../model/types';
import { renderPanel } from '../../test/panelHarness';

const textOf = (zine: { spreads: { elements: unknown[] }[] }) => zine.spreads[0].elements[0] as TextElement;

test('with nothing selected: zine title and margins; typing the title is one undo step', async () => {
  const { screen, store, zine } = await renderPanel(createZine('Lato', 1));
  await screen.getByLabelText('Tytuł').fill('Jesień');
  expect(zine().title).toBe('Jesień');
  await screen.getByLabelText('Zewnętrzny').fill('12');
  expect(zine().margins.outer).toBe(12);
  store.getState().undo();
  store.getState().undo();
  expect(zine().title).toBe('Lato');
});

test('a clicked page shows its background colour; HEX and "Białe tło" change it', async () => {
  const { screen, zine } = await renderPanel(createZine('Lato', 1), (store) => store.getState().clickPage(1));
  await expect.element(screen.getByRole('heading', { name: 'Strona 1' })).toBeVisible();
  await screen.getByLabelText('Tło strony (HEX)').fill('#FF0000');
  expect(zine().pages[1]).toEqual({ background: '#ff0000' });
  await screen.getByRole('button', { name: 'Białe tło' }).click();
  expect(zine().pages[1]).toBeUndefined();
});

test('text settings: size, colour swatch from the zine, alignment', async () => {
  const start = createZine('Lato', 1);
  start.pages[1] = { background: '#123456' };
  const { screen, zine } = await renderPanel(start, (store) => store.getState().addElement(createTextElement({ text: 'a' })));
  await screen.getByLabelText('Rozmiar').fill('24');
  expect(textOf(zine()).size).toBe(24);
  await screen.getByRole('button', { name: 'Kolor #123456' }).click();
  expect(textOf(zine()).color).toBe('#123456');
  await screen.getByRole('button', { name: 'Do środka' }).click();
  expect(textOf(zine()).align).toBe('center');
});

test('bold and italic are only offered when the family has those files', async () => {
  const { screen, zine } = await renderPanel(createZine('Lato', 1), (store) =>
    store.getState().addElement(createTextElement({ text: 'a', bold: true, italic: true })),
  );
  await expect.element(screen.getByRole('button', { name: 'Kursywa' })).toBeEnabled();
  await screen.getByLabelText('Font', { exact: true }).selectOptions('Oswald');
  expect(textOf(zine())).toMatchObject({ fontFamilyId: 'oswald', bold: true, italic: false });
  await expect.element(screen.getByRole('button', { name: 'Kursywa' })).toBeDisabled();
  await screen.getByLabelText('Font', { exact: true }).selectOptions('Archivo Black');
  expect(textOf(zine())).toMatchObject({ bold: false, italic: false });
  await expect.element(screen.getByRole('button', { name: 'Pogrubienie' })).toBeDisabled();
});

test('layer buttons reorder; the top element cannot go higher', async () => {
  const first = createTextElement({ text: 'a' });
  const second = createTextElement({ text: 'b' });
  const { screen, zine } = await renderPanel(createZine('Lato', 1), (store) => {
    store.getState().addElement(first);
    store.getState().addElement(second);
    store.getState().select(first.id);
  });
  await screen.getByRole('button', { name: 'Na wierzch' }).click();
  expect(zine().spreads[0].elements.map((e) => e.id)).toEqual([second.id, first.id]);
  await expect.element(screen.getByRole('button', { name: 'Wyżej' })).toBeDisabled();
});

test('photo settings: crop mode and mirroring', async () => {
  const { screen, store, zine } = await renderPanel(createZine('Lato', 1), (store) =>
    store.getState().addElement(createPhotoElement('img')),
  );
  await screen.getByRole('button', { name: 'Kadruj' }).click();
  expect(store.getState().mode).toBe('crop');
  await screen.getByLabelText('Odbij w poziomie').click();
  expect((zine().spreads[0].elements[0] as PhotoElement).flipX).toBe(true);
});
```

- [ ] **Step 3: Run it**

Run: `npx vitest run --project browser src/editor/panels/panels.browser.test.tsx`
Expected: FAIL, `../editor/panels/PropertiesPanel` cannot be resolved.

- [ ] **Step 4: Write `src/editor/panels/NumberField.tsx`**

```tsx
import { useState } from 'react';

interface Props {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange(value: number): void;
}

const format = (value: number) => String(Math.round(value * 100) / 100);

/** Number input that only reports valid values in [min, max]; what is typed stays until the field loses focus. */
export function NumberField({ label, value, min, max, step = 1, unit, onChange }: Props) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <label className="field">
      <span>{label}</span>
      <span className="field-input">
        <input
          type="number"
          aria-label={label}
          value={draft ?? format(value)}
          min={min}
          max={max}
          step={step}
          onChange={(event) => {
            setDraft(event.target.value);
            const number = Number(event.target.value);
            if (event.target.value !== '' && Number.isFinite(number) && number >= min && number <= max) onChange(number);
          }}
          onBlur={() => setDraft(null)}
        />
        {unit && <span className="muted">{unit}</span>}
      </span>
    </label>
  );
}
```

- [ ] **Step 5: Write `src/editor/panels/ColorField.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { normalizeHex, swatches } from '../colors';
import { useEditor } from '../EditorContext';
import { selectZine } from '../state/store';

interface Props {
  label: string;
  value: string;
  onChange(color: string): void;
}

/** Colour picker, HEX field and swatches of the colours already used in the zine. */
export function ColorField({ label, value, onChange }: Props) {
  const zine = useEditor(selectZine);
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <fieldset className="color-field">
      <legend>{label}</legend>
      <div className="row">
        <input type="color" aria-label={label} value={normalizeHex(value) ?? '#000000'} onChange={(e) => onChange(e.target.value)} />
        <input
          type="text"
          aria-label={`${label} (HEX)`}
          className="hex"
          maxLength={7}
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            const hex = normalizeHex(event.target.value);
            if (hex) onChange(hex);
          }}
          onBlur={() => setDraft(value)}
        />
      </div>
      <div className="swatches">
        {swatches(zine).map((color) => (
          <button
            key={color}
            type="button"
            className="swatch"
            style={{ background: color }}
            aria-label={`Kolor ${color}`}
            title={color}
            onClick={() => onChange(color)}
          />
        ))}
      </div>
    </fieldset>
  );
}
```

- [ ] **Step 6: Write `src/editor/panels/LayerButtons.tsx`**

```tsx
import { useEditor, useEditorEnv } from '../EditorContext';
import { canMoveLayer, type LayerOp } from '../state/layers';

const OPS: [LayerOp, string][] = [
  ['front', 'Na wierzch'],
  ['forward', 'Wyżej'],
  ['backward', 'Niżej'],
  ['back', 'Na spód'],
];

export function LayerButtons() {
  const { store } = useEditorEnv();
  const elements = useEditor((s) => s.history.present.spreads[s.spread].elements);
  const id = useEditor((s) => s.selectedId);
  if (!id) return null;
  return (
    <div className="panel-group">
      <h3>Warstwa</h3>
      <div className="row">
        {OPS.map(([op, label]) => (
          <button key={op} type="button" disabled={!canMoveLayer(elements, id, op)} onClick={() => store.getState().moveSelectedLayer(op)}>
            {label}
          </button>
        ))}
      </div>
      <div className="row">
        <button type="button" onClick={() => store.getState().duplicateSelected()}>
          Powiel
        </button>
        <button type="button" className="danger" onClick={() => store.getState().deleteSelected()}>
          Usuń
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Write `src/editor/panels/FontField.tsx`**

```tsx
import { fitStyle } from '../../fonts/fontChoices';
import { cssFontFamily } from '../../fonts/fontLoader';
import type { TextElement } from '../../model/types';
import { useEditor, useEditorEnv } from '../EditorContext';
import { selectZine } from '../state/store';

/** Font family of a text: built-in fonts and the zine's own. Switching keeps bold/italic only when the family has them. */
export function FontField({ element }: { element: TextElement }) {
  const { store, fonts } = useEditorEnv();
  const zine = useEditor(selectZine);
  const offered = fonts.filter((font) => font.builtin || zine.fonts.includes(font.id));
  const missing = !offered.some((font) => font.id === element.fontFamilyId);

  const choose = (id: string) => {
    const choice = offered.find((font) => font.id === id);
    if (choice) store.getState().updateElement(element.id, { fontFamilyId: id, ...fitStyle(choice, element.bold, element.italic) });
  };

  return (
    <div className="font-field">
      <label className="field">
        <span>Font</span>
        <select aria-label="Font" value={element.fontFamilyId} onChange={(event) => choose(event.target.value)}>
          {offered.map((font) => (
            <option key={font.id} value={font.id} style={{ fontFamily: `${cssFontFamily(font.id)}, sans-serif` }}>
              {font.name}
            </option>
          ))}
          {missing && <option value={element.fontFamilyId}>Brakujący font</option>}
        </select>
      </label>
    </div>
  );
}
```

- [ ] **Step 8: Write `src/editor/panels/TextPanel.tsx`**

```tsx
import { canToggle } from '../../fonts/fontChoices';
import type { TextAlign, TextElement } from '../../model/types';
import { useEditorEnv } from '../EditorContext';
import type { ElementPatch } from '../state/commands';
import { ColorField } from './ColorField';
import { FontField } from './FontField';
import { LayerButtons } from './LayerButtons';
import { NumberField } from './NumberField';

const ALIGNS: [TextAlign, string][] = [
  ['left', 'Do lewej'],
  ['center', 'Do środka'],
  ['right', 'Do prawej'],
  ['justify', 'Wyjustuj'],
];

export function TextPanel({ element }: { element: TextElement }) {
  const { store, fonts } = useEditorEnv();
  const update = (patch: ElementPatch, key?: string) => store.getState().updateElement(element.id, patch, key);
  const family = fonts.find((font) => font.id === element.fontFamilyId);
  const key = (field: string) => `${field}:${element.id}`;

  return (
    <section className="panel">
      <h2>Napis</h2>
      <button type="button" onClick={() => store.getState().setMode('text')}>
        Edytuj tekst
      </button>
      <FontField element={element} />
      <NumberField label="Rozmiar" unit="pt" value={element.size} min={4} max={400} onChange={(size) => update({ size }, key('size'))} />
      <div className="row">
        <button
          type="button"
          aria-pressed={element.bold}
          disabled={!family || !canToggle(family, element, 'bold')}
          onClick={() => update({ bold: !element.bold })}
        >
          Pogrubienie
        </button>
        <button
          type="button"
          aria-pressed={element.italic}
          disabled={!family || !canToggle(family, element, 'italic')}
          onClick={() => update({ italic: !element.italic })}
        >
          Kursywa
        </button>
      </div>
      <NumberField
        label="Kerning"
        unit="‰ em"
        value={element.letterSpacing}
        min={-200}
        max={1000}
        step={10}
        onChange={(letterSpacing) => update({ letterSpacing }, key('letterSpacing'))}
      />
      <NumberField
        label="Interlinia"
        unit="×"
        value={element.lineHeight}
        min={0.5}
        max={4}
        step={0.05}
        onChange={(lineHeight) => update({ lineHeight }, key('lineHeight'))}
      />
      <ColorField label="Kolor tekstu" value={element.color} onChange={(color) => update({ color }, key('color'))} />
      <div className="row" role="group" aria-label="Wyrównanie">
        {ALIGNS.map(([align, label]) => (
          <button key={align} type="button" aria-pressed={element.align === align} onClick={() => update({ align })}>
            {label}
          </button>
        ))}
      </div>
      <NumberField label="Obrót" unit="°" value={element.rotation} min={-360} max={360} onChange={(rotation) => update({ rotation }, key('rotation'))} />
      <LayerButtons />
    </section>
  );
}
```

- [ ] **Step 9: Write `src/editor/panels/PhotoPanel.tsx`**

```tsx
import type { PhotoElement } from '../../model/types';
import { useEditor, useEditorEnv } from '../EditorContext';
import type { ElementPatch } from '../state/commands';
import { MAX_CROP_ZOOM } from '../state/store';
import { LayerButtons } from './LayerButtons';
import { NumberField } from './NumberField';

export function PhotoPanel({ element }: { element: PhotoElement }) {
  const { store } = useEditorEnv();
  const mode = useEditor((s) => s.mode);
  const update = (patch: ElementPatch, key?: string) => store.getState().updateElement(element.id, patch, key);
  const transparency = Math.round((1 - element.opacity) * 100);

  return (
    <section className="panel">
      <h2>Zdjęcie</h2>
      <button type="button" aria-pressed={mode === 'crop'} onClick={() => store.getState().setMode(mode === 'crop' ? 'idle' : 'crop')}>
        Kadruj
      </button>
      {mode === 'crop' && (
        <p className="muted">Przeciągnij zdjęcie w ramce, kółkiem myszy przybliż. Enter albo klik obok kończy.</p>
      )}
      <label className="field">
        <span>Przybliżenie</span>
        <input
          type="range"
          aria-label="Przybliżenie"
          min={1}
          max={MAX_CROP_ZOOM}
          step={0.01}
          value={element.crop.zoom}
          onChange={(event) => update({ crop: { ...element.crop, zoom: Number(event.target.value) } }, `zoom:${element.id}`)}
        />
      </label>
      <label className="toggle">
        <input type="checkbox" checked={element.flipX} onChange={(event) => update({ flipX: event.target.checked })} />
        Odbij w poziomie
      </label>
      <label className="field">
        <span>Przezroczystość {transparency}%</span>
        <input
          type="range"
          aria-label="Przezroczystość"
          min={0}
          max={100}
          step={1}
          value={transparency}
          onChange={(event) => update({ opacity: 1 - Number(event.target.value) / 100 }, `opacity:${element.id}`)}
        />
      </label>
      <NumberField
        label="Obrót"
        unit="°"
        value={element.rotation}
        min={-360}
        max={360}
        onChange={(rotation) => update({ rotation }, `rotation:${element.id}`)}
      />
      <LayerButtons />
    </section>
  );
}
```

- [ ] **Step 10: Write `src/editor/panels/PagePanel.tsx` and `src/editor/panels/ZinePanel.tsx`**

`src/editor/panels/PagePanel.tsx`:

```tsx
import { useEditor, useEditorEnv } from '../EditorContext';
import { setPageBackground } from '../state/commands';
import { ColorField } from './ColorField';

export function PagePanel({ page }: { page: number }) {
  const { store } = useEditorEnv();
  const background = useEditor((s) => s.history.present.pages[page]?.background ?? '#ffffff');
  return (
    <section className="panel">
      <h2>Strona {page}</h2>
      <ColorField
        label="Tło strony"
        value={background}
        onChange={(color) => store.getState().edit((zine) => setPageBackground(zine, page, color), `background:${page}`)}
      />
      <button type="button" onClick={() => store.getState().edit((zine) => setPageBackground(zine, page, null))}>
        Białe tło
      </button>
    </section>
  );
}
```

`src/editor/panels/ZinePanel.tsx`:

```tsx
import type { Margins } from '../../model/types';
import { useEditor, useEditorEnv } from '../EditorContext';
import { setMargins, setTitle } from '../state/commands';
import { NumberField } from './NumberField';

const MARGINS: [keyof Margins, string][] = [
  ['outer', 'Zewnętrzny'],
  ['inner', 'Wewnętrzny (przy grzbiecie)'],
  ['top', 'Górny'],
  ['bottom', 'Dolny'],
];

export function ZinePanel() {
  const { store } = useEditorEnv();
  const title = useEditor((s) => s.history.present.title);
  const margins = useEditor((s) => s.history.present.margins);
  return (
    <section className="panel">
      <h2>Zin</h2>
      <label className="field">
        <span>Tytuł</span>
        <input aria-label="Tytuł" value={title} onChange={(event) => store.getState().edit((z) => setTitle(z, event.target.value), 'title')} />
      </label>
      <h3>Marginesy</h3>
      {MARGINS.map(([side, label]) => (
        <NumberField
          key={side}
          label={label}
          unit="mm"
          value={margins[side]}
          min={0}
          max={70}
          onChange={(value) => store.getState().edit((z) => setMargins(z, { ...z.margins, [side]: value }), `margin:${side}`)}
        />
      ))}
    </section>
  );
}
```

- [ ] **Step 11: Write `src/editor/panels/PropertiesPanel.tsx`**

```tsx
import { useEditor } from '../EditorContext';
import { selectedElement } from '../state/store';
import { PagePanel } from './PagePanel';
import { PhotoPanel } from './PhotoPanel';
import { TextPanel } from './TextPanel';
import { ZinePanel } from './ZinePanel';

/** Right column: the selected element's settings, or the clicked page's and the zine's. */
export function PropertiesPanel() {
  const element = useEditor(selectedElement);
  const activePage = useEditor((s) => s.activePage);
  if (element?.kind === 'photo') return <PhotoPanel element={element} />;
  if (element?.kind === 'text') return <TextPanel element={element} />;
  return (
    <>
      {activePage !== null && <PagePanel page={activePage} />}
      <ZinePanel />
    </>
  );
}
```

- [ ] **Step 12: Put the panel into `src/editor/EditorScreen.tsx`**

Replace `import { openEditorSession } from './session';` with

```tsx
import { PropertiesPanel } from './panels/PropertiesPanel';
import { openEditorSession } from './session';
```

and replace

```tsx
        <aside className="editor-panel" />
```

with

```tsx
        <aside className="editor-panel">
          <PropertiesPanel />
        </aside>
```

- [ ] **Step 13: Append to `src/app/app.css`**

```css
.panel {
  display: grid;
  gap: 10px;
  margin-bottom: 20px;
}

.panel h2 {
  margin: 0;
  font-size: 15px;
}

.panel h3 {
  margin: 4px 0 0;
  font-size: 13px;
  color: var(--muted);
}

.panel-group {
  display: grid;
  gap: 6px;
}

.row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}

.field {
  display: grid;
  gap: 4px;
}

.field-input {
  display: flex;
  align-items: center;
  gap: 6px;
}

.field-input input {
  width: 90px;
}

.color-field {
  display: grid;
  gap: 6px;
  margin: 0;
  padding: 8px;
  border: 1px solid var(--line);
  border-radius: 6px;
}

.color-field .hex {
  width: 90px;
  font-family: ui-monospace, monospace;
}

.swatches {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.swatch {
  width: 22px;
  height: 22px;
  padding: 0;
  border-radius: 4px;
}

.font-field {
  display: grid;
  gap: 6px;
}
```

- [ ] **Step 14: Run it**

Run: `npx vitest run --project browser src/editor && npm run typecheck`
Expected: PASS.

- [ ] **Step 15: Commit**

```bash
git add src/editor src/test/panelHarness.tsx src/app/app.css
git commit -m "Add photo, text, page and zine settings panels" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 21: Fonts in the text panel: upload and fonts of other zines

"Wgraj font…" uploads `.ttf/.otf/.woff2` into the current zine (Task 4's `importFontFiles`), adds the families to `Zine.fonts` (one undo step), reloads the font list and applies the first new family to the selected text. "Użyj fontu z innego zina" lists families other zines uploaded and adds one without uploading again.

**Files:**
- Create: `src/test/files.ts`
- Modify: `src/editor/panels/FontField.tsx`, `src/app/app.css`
- Test: `src/editor/panels/FontField.browser.test.tsx`

- [ ] **Step 1: Write the test helper `src/test/files.ts`**

```ts
/**
 * Puts files into an <input type="file"> and fires `change`, as a user choosing them would.
 * (userEvent.upload in Vitest 3.2 sends binary files as text, which corrupts fonts and images.)
 */
export function chooseFiles(input: Element, files: File[]): void {
  const transfer = new DataTransfer();
  for (const file of files) transfer.items.add(file);
  const element = input as HTMLInputElement;
  element.files = transfer.files;
  element.dispatchEvent(new Event('change', { bubbles: true }));
}
```

- [ ] **Step 2: Write the failing test `src/editor/panels/FontField.browser.test.tsx`**

```tsx
import interBold from '@fontsource/inter/files/inter-latin-700-normal.woff2?url';
import interRegular from '@fontsource/inter/files/inter-latin-400-normal.woff2?url';
import { expect, test } from 'vitest';
import { createTextElement, createZine } from '../../model/factory';
import type { TextElement } from '../../model/types';
import { putFontFamily, putFontFile } from '../../storage/db';
import { chooseFiles } from '../../test/files';
import { renderPanel } from '../../test/panelHarness';

async function fontFile(url: string, name: string): Promise<File> {
  return new File([await (await fetch(url)).arrayBuffer()], name);
}

const textOf = (zine: { spreads: { elements: unknown[] }[] }) => zine.spreads[0].elements[0] as TextElement;

test('uploaded files become a family of this zine and the text uses it', async () => {
  const { screen, zine } = await renderPanel(createZine('Lato', 1), (store) =>
    store.getState().addElement(createTextElement({ text: 'a' })),
  );
  chooseFiles(screen.getByLabelText('Wybierz pliki fontów').element(), [
    await fontFile(interRegular, 'Moja-Regular.woff2'),
    await fontFile(interBold, 'Moja-Bold.woff2'),
  ]);
  await expect.element(screen.getByLabelText('Font', { exact: true })).toHaveDisplayValue('Moja');
  expect(zine().fonts).toHaveLength(1);
  expect(textOf(zine()).fontFamilyId).toBe(zine().fonts[0]);
  await expect.element(screen.getByRole('button', { name: 'Pogrubienie' })).toBeEnabled();
  await expect.element(screen.getByRole('button', { name: 'Kursywa' })).toBeDisabled();
});

test('files that are not fonts are reported', async () => {
  const { screen, zine } = await renderPanel(createZine('Lato', 1), (store) =>
    store.getState().addElement(createTextElement({ text: 'a' })),
  );
  chooseFiles(screen.getByLabelText('Wybierz pliki fontów').element(), [new File(['x'], 'Zepsuty.ttf')]);
  await expect.element(screen.getByRole('alert')).toHaveTextContent('Pominięto plików: 1 (to nie są fonty).');
  expect(zine().fonts).toEqual([]);
});

test('"Użyj fontu z innego zina" adds a family uploaded elsewhere', async () => {
  const { screen, db, zine } = await renderPanel(createZine('Lato', 1), (store) =>
    store.getState().addElement(createTextElement({ text: 'a' })),
  );
  await putFontFamily(db, { id: 'inna', name: 'Inna' });
  const data = await (await fetch(interRegular)).arrayBuffer();
  await putFontFile(db, { id: 'inna-r', familyId: 'inna', bold: false, italic: false, mime: 'font/woff2', data });
  await screen.getByRole('button', { name: 'Użyj fontu z innego zina' }).click();
  await screen.getByRole('list', { name: 'Fonty z innych zinów' }).getByRole('button', { name: 'Inna' }).click();
  await expect.poll(() => textOf(zine()).fontFamilyId).toBe('inna');
  expect(zine().fonts).toEqual(['inna']);
});
```

- [ ] **Step 3: Run it**

Run: `npx vitest run --project browser src/editor/panels/FontField.browser.test.tsx`
Expected: FAIL, there is no "Wybierz pliki fontów" field.

- [ ] **Step 4: Replace `src/editor/panels/FontField.tsx`**

```tsx
import { useRef, useState } from 'react';
import { errorMessage, notify } from '../../app/notices';
import { loadFontChoices, otherZineFamilies } from '../../fonts/catalogue';
import { fitStyle, type FontChoice } from '../../fonts/fontChoices';
import { importFontFiles } from '../../fonts/fontImport';
import { cssFontFamily, registerZineFonts } from '../../fonts/fontLoader';
import type { TextElement, Zine } from '../../model/types';
import { useEditor, useEditorEnv } from '../EditorContext';
import { addFontFamilies } from '../state/commands';
import { selectZine } from '../state/store';

/**
 * Font family of a text: built-in fonts and the zine's own. Uploading .ttf/.otf/.woff2 adds a family
 * to this zine; "Użyj fontu z innego zina" adds one that another zine uploaded. Switching keeps
 * bold/italic only when the family has them.
 */
export function FontField({ element }: { element: TextElement }) {
  const { db, store, fonts, setFonts } = useEditorEnv();
  const zine = useEditor(selectZine);
  const input = useRef<HTMLInputElement>(null);
  const [others, setOthers] = useState<FontChoice[] | null>(null);
  const offered = fonts.filter((font) => font.builtin || zine.fonts.includes(font.id));
  const missing = !offered.some((font) => font.id === element.fontFamilyId);

  const apply = (choice: FontChoice) =>
    store.getState().updateElement(element.id, { fontFamilyId: choice.id, ...fitStyle(choice, element.bold, element.italic) });

  /** Adds families to the zine (one undo step), reloads the font list and applies the first one to this text. */
  const addFamilies = async (familyIds: string[]) => {
    store.getState().edit((z) => addFontFamilies(z, familyIds));
    const updated: Zine = selectZine(store.getState());
    const choices = await loadFontChoices(db, updated);
    setFonts(choices);
    const first = choices.find((font) => font.id === familyIds[0]);
    if (first) apply(first);
  };

  const upload = async (files: File[]) => {
    try {
      const result = await importFontFiles(db, zine, files);
      if (result.skipped > 0) notify(`Pominięto plików: ${result.skipped} (to nie są fonty).`);
      if (result.familyIds.length > 0) await addFamilies(result.familyIds);
    } catch (error) {
      notify(errorMessage(error));
    }
  };

  const useOther = async (choice: FontChoice) => {
    try {
      await registerZineFonts(db, { ...zine, fonts: [choice.id] });
      await addFamilies([choice.id]);
      setOthers(null);
    } catch (error) {
      notify(errorMessage(error));
    }
  };

  return (
    <div className="font-field">
      <label className="field">
        <span>Font</span>
        <select
          aria-label="Font"
          value={element.fontFamilyId}
          onChange={(event) => {
            const choice = offered.find((font) => font.id === event.target.value);
            if (choice) apply(choice);
          }}
        >
          {offered.map((font) => (
            <option key={font.id} value={font.id} style={{ fontFamily: `${cssFontFamily(font.id)}, sans-serif` }}>
              {font.name}
            </option>
          ))}
          {missing && <option value={element.fontFamilyId}>Brakujący font</option>}
        </select>
      </label>
      <div className="row">
        <button type="button" onClick={() => input.current?.click()}>
          Wgraj font…
        </button>
        <input
          ref={input}
          type="file"
          accept=".ttf,.otf,.woff2"
          multiple
          hidden
          aria-label="Wybierz pliki fontów"
          onChange={(event) => {
            const files = [...(event.target.files ?? [])];
            event.target.value = '';
            if (files.length) void upload(files);
          }}
        />
        <button
          type="button"
          onClick={() => otherZineFamilies(db, zine).then(setOthers, (error) => notify(errorMessage(error)))}
        >
          Użyj fontu z innego zina
        </button>
      </div>
      {others &&
        (others.length === 0 ? (
          <p className="muted">Inne ziny nie mają własnych fontów.</p>
        ) : (
          <ul className="font-others" aria-label="Fonty z innych zinów">
            {others.map((choice) => (
              <li key={choice.id}>
                <button type="button" onClick={() => void useOther(choice)}>
                  {choice.name}
                </button>
              </li>
            ))}
          </ul>
        ))}
    </div>
  );
}
```

- [ ] **Step 5: Append to `src/app/app.css`**

```css
.font-others {
  display: grid;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}
```

- [ ] **Step 6: Run the panel tests**

Run: `npx vitest run --project browser src/editor/panels && npm run typecheck`
Expected: PASS (9 tests).

- [ ] **Step 7: Commit**

```bash
git add src/editor/panels/FontField.tsx src/editor/panels/FontField.browser.test.tsx src/test/files.ts src/app/app.css
git commit -m "Upload fonts and reuse fonts of other zines from the text panel" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 22: Project docs and final check

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Replace `CLAUDE.md`**

````markdown
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

- `npm run test:unit`: czysta logika w Node. `npm run test:browser`: render, fonty, PDF i komponenty React w Chromium (Vitest browser mode, okno 1280×900).
- `test-output/`: próbne arkusze PNG i PDF z `src/print/samples.browser.test.ts` do obejrzenia.
- `vite.config.ts` wymienia biblioteki w `optimizeDeps.include`, żeby testy w przeglądarce nie przeładowywały się w trakcie przebiegu. Każdą nową bibliotekę używaną w testach przeglądarkowych dopisz tam też.

## Struktura

| Ścieżka | Odpowiedzialność |
|---|---|
| `src/App.tsx`, `src/app/` | Ekrany według adresu (`route.ts`: `#/`, `#/zin/<id>`, `#/zin/<id>/druk`, `#/zin/<id>/3d`), baza w kontekście (`dbContext.ts`), komunikaty (`notices.ts`, `NoticeList.tsx`), pytania „na pewno?” (`confirm.ts`, `ConfirmHost.tsx`), odmiana liczebników (`plural.ts`), style (`app.css`). |
| `src/home/` | Lista zinów: nowy, powiel, usuń, pliki `.zin` (`homeActions.ts`), miniatura okładki (`coverThumbnail.ts`), ekran (`HomeScreen.tsx`, `ZineCard.tsx`). |
| `src/editor/state/` | Stan edytora w Zustand (`store.ts`), historia cofania (`history.ts`), zmiany zina (`commands.ts`), warstwy (`layers.ts`), schowek (`clipboard.ts`), autozapis (`autosave.ts`). Czysta logika, testy w Node. |
| `src/editor/geometry/` | Gdzie wstawić zdjęcie i napis (`placement.ts`), przyciąganie (`snapping.ts`). Czysta matematyka. |
| `src/editor/canvas/` | Płótno edytora w Konvie (`EditorStage.ts`), jego opakowanie w React (`SpreadCanvas.tsx`), edycja tekstu na miejscu (`TextEditor.tsx`). |
| `src/editor/panels/` | Prawa kolumna: ustawienia zdjęcia, napisu, strony, zina, kolory, fonty, warstwy. |
| `src/editor/` (reszta) | Ekran edytora (`EditorScreen.tsx`, `session.ts`), pasek u góry, miniatury rozkładówek (`SpreadList.tsx`), wstawianie (`insert.ts`), skróty (`keyboard.ts`), kolory (`colors.ts`). |
| `src/model/` | Typy zina (`types.ts`), numeracja stron i rozkładówek, marginesy (`geometry.ts`), wartości domyślne (`factory.ts`), wczytywanie z wartościami domyślnymi i wersją (`parse.ts`), dodawanie i usuwanie kartek (`sheets.ts`). |
| `src/imposition/` | Kolejność stron na arkuszach (`imposition.ts`), skala pod margines drukarki (`layout.ts`), znaczniki cięcia i zgięcia (`marks.ts`). Czysta matematyka. |
| `src/storage/` | IndexedDB (`db.ts`), sprzątanie nieużywanych zdjęć i fontów (`cleanup.ts`), pliki `.zin` (`zinFile.ts`), trwały magazyn i zajęte miejsce (`quota.ts`). |
| `src/images/` | Wczytywanie zdjęć: zmniejszanie do 3600 px, JPEG albo PNG z przezroczystością. |
| `src/fonts/` | Wbudowane fonty (`fontChoices.ts`, pliki w `builtinFontFiles.ts`), rejestracja fontów i czekanie na nie (`fontLoader.ts`), nazwa rodziny z pliku (`fontNames.ts`), wgrywanie (`fontImport.ts`), lista fontów zina (`catalogue.ts`). |
| `src/render/` | Jedyny rysownik (Konva): rozkładówka w mm (`buildSpread.ts`), prowadnice i wyszarzenie brakującej strony (`guides.ts`), strona i rozkładówka do canvasu (`renderPage.ts`). |
| `src/print/` | Strona arkusza (`sheetSide.ts`), PDF arkuszy i stron (`pdf.ts`), strona próbna (`testPage.ts`). |
| `src/test/` | Pomocniki testów: piksele, sztuczny plik TTF (`sfnt.ts`), płótno edytora (`stageHarness.ts`), cały edytor (`editorHarness.tsx`), panel (`panelHarness.tsx`), wybór plików (`files.ts`). |

## Zasady i niezmienniki

- **Jednostki:** wszystko w milimetrach w skali A5 (strona 148×210). Rozkładówka: x 0…296, grzbiet x = 148, spad 3 mm poza nią.
- **Rozkładówka `i`** ma strony `2i` (lewa) i `2i + 1` (prawa). Strony 0 i `P + 1` nie istnieją (okładki stoją same). Element należy do rozkładówki i może leżeć przez grzbiet.
- **Jeden rysownik.** Edytor, miniatury, PDF i 3D rysują przez `buildSpreadGroup`. Nie twórz osobnej ścieżki rysowania. Tekst rysuje i mierzy tylko `createTextShape` (`Konva.Text`); wysokość ramki napisu liczy `measureTextHeight`, a pole edycji tekstu bierze rozmiary z `textStyleMm`.
- **Płótno edytora to zwykła Konva** (`EditorStage`), nie react-konva: rysunek rozkładówki pochodzi z rysownika, klasa dokłada tylko prowadnice, zaznaczenie, przyciąganie i obsługę myszy. Transformer działa na niewidocznym prostokącie (`proxy`) w warstwie bez skali.
- **Stan edytora:** zmiany zina tylko przez akcje sklepu (`edit`, `updateElement`…), każda to krok cofania (do 100). Zmiany z tym samym kluczem (pisanie, suwaki, pola liczb) łączą się w jeden krok. Zaznaczenie, rozkładówka i tryb nie są w historii. Sklep nie importuje Konvy: pomiar tekstu i rozmiar zdjęcia dostaje w `EditorDeps`.
- **Selektory Zustand** zwracają wartości stałe (pole stanu albo element), nigdy nowy obiekt, bo React wpada w pętlę.
- **Spad tylko na zewnętrznych krawędziach strony;** przy grzbiecie strona kończy się równo (`pageRect`).
- **Impozycja:** kartka `k`: przód `P − 2k | 2k + 1`, tył `2k + 2 | P − 2k − 1`. PDF poziomy, tył pod „odwracanie po krótszej krawędzi”; „Obróć tyły o 180°” dla drukarek odwracających po dłuższej.
- **Skala druku:** `s = min(1, (297 − 2m − 2c)/(296 + 2b), (210 − 2m − 2c)/(210 + 2b))`; spad i znaczniki zawsze mieszczą się w obszarze druku (pilnuje test).
- **Kartki:** dodawanie i usuwanie nigdy nie przesuwa okładek ani wewnętrznych stron okładek (poza wyjątkami 1 i 2 kartek opisanymi w specu). Kolory tła idą za stronami.
- **Kompatybilność danych:** nowe pole = wartość domyślna w `parseZine`. Zmiana znaczenia pola = nowa `FORMAT_VERSION` i migracja. Nowsza wersja pliku = czytelny błąd, nigdy częściowy zin. **Zin z bazy zawsze przechodzi przez `parseZine`** (lista zinów, otwieranie w edytorze).
- **Zdjęcia i fonty leżą w IndexedDB, nigdy w JSON-ie zina.** Sprzątanie (`pruneUnusedAssets`) tylko z listy zinów, nigdy w trakcie edycji, i dopiero po `whenSavesSettled()`, żeby świeżo dodane zdjęcie nie wyglądało na nieużywane. Font jest „używany”, gdy jest na liście `Zine.fonts`.
- **Autozapis** 500 ms po zmianie, zapisy po kolei; wyjście z edytora zapisuje od razu. `updatedAt` ustawia zapis.
- **Fonty:** wbudowane rodziny mają id jak `fontFamilyId` (`inter`, `lora`…), domyślna `inter`. Każdy styl to dwa pliki (latin i latin-ext z polskimi literami), przeglądarka pobiera je dopiero, gdy tekst ich potrzebuje; `ensureFontsReady` i `loadSpreadFonts` podają tekst, żeby pobrała właściwe. Nowy wbudowany font = wpis w `BUILTIN_FONTS` i pliki w `builtinFontFiles.ts` (test pilnuje zgodności). Własne fonty: rodzina z tabeli `name` (ID 1) i bitów OS/2 dla TTF/OTF, z nazwy pliku dla WOFF2.
- **Wczytanie `.zin` tworzy nowy zin** (nowe id), nigdy nie nadpisuje istniejącego.
- **Eksport rysuje arkusze po jednym** i zwalnia canvas (`releaseCanvas`); `drawToCanvas` wymusza `Konva.pixelRatio = 1`.
- **Nazwy plików** nie mogą różnić się tylko wielkością liter (macOS jej nie rozróżnia): stąd `notices.ts` i `NoticeList.tsx`, `spreadLabels.ts` i `SpreadList.tsx`.
- **Testy komponentów:** `*.browser.test.tsx` z `vitest-browser-react`. Pliki do `<input type="file">` podawaj przez `chooseFiles` (`src/test/files.ts`), bo `userEvent.upload` psuje pliki binarne.
````

- [ ] **Step 2: Run all tests**

Run: `npm test`
Expected: all test files pass (plan 1 and plan 2 suites), no "Vite unexpectedly reloaded a test" warning. If such a warning names a library, add it to `optimizeDeps.include` in `vite.config.ts` and run again.

- [ ] **Step 3: Type check and build**

Run: `npm run typecheck && npm run build`
Expected: no type errors; the build succeeds (a warning that one chunk is larger than 500 kB is expected) and `dist/assets/` contains the woff2 files of the built-in fonts.

- [ ] **Step 4: Look at the app once**

Run: `npm run dev`, open the printed URL, create a zine with 2 sheets, add a text ("+ Napis", type, Escape), drag it near a margin (it snaps), change its font to Caveat, go back to the list ("← Ziny") and open the zine again: the text is still there. Stop the dev server.

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md
git commit -m "Document the editor structure and rules in CLAUDE.md" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

