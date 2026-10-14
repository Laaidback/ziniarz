# ZINIARZ, plan 1: rdzeń (model, impozycja, magazyn, rysownik, PDF) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the tested core of ZINIARZ: zine data model, saddle-stitch imposition, home-printer scaling and marks, IndexedDB storage, `.zin` files, image and font import, the single Konva renderer and the PDF exporters. No editor UI yet.

**Architecture:** Pure TypeScript modules (`model/`, `imposition/`, `storage/`) are tested in Node with Vitest. Everything that needs a real canvas, fonts or images (`images/`, `fonts/`, `render/`, `print/`) is tested in Chromium through Vitest browser mode. One renderer (`render/`) draws a spread in millimetre coordinates; pages, sheet sides and PDFs are cut from it.

**Tech Stack:** Vite 7, React 19, TypeScript 5.9 (strict), Konva 9, pdf-lib, idb, JSZip, Vitest 3.2 (node + browser/Playwright), fake-indexeddb, @fontsource/inter.

**Spec:** `docs/superpowers/specs/2026-10-14-ziniarz-design.md`. Later plans: 2 = editor, 3 = print screen and 3D preview, 4 = hosting.

**Left for later plans on purpose:** turning uploaded font files into a `FontFamily` + `FontFile[]` (family name and bold/italic from the file) and built-in fonts (plan 2); editor guides on `renderSpread` (plan 2); `navigator.storage.persist()` and storage usage (plan 2); printer margin remembered in the browser vs `Zine.print.printerMargin` (plan 3). Render tests probe pixels instead of comparing stored reference PNGs; `test-output/` holds samples to inspect by eye.

**Conventions for every task:**
- Repo root: `~/projects/ziniarz` (git repo already exists with the spec).
- UI strings and user-facing error messages in Polish; code, comments and commit messages in English.
- All lengths in millimetres unless a name says `Px` or `Pt`.
- Files ending in `.browser.test.ts` run in Chromium; other `*.test.ts` run in Node.
- Every commit message ends with a blank line and `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

---

## File structure

```
package.json, tsconfig.json, vite.config.ts, index.html, .gitignore, CLAUDE.md
src/main.tsx, src/App.tsx                 placeholder page (editor comes in plan 2)
src/model/types.ts                        Zine, Spread, elements, settings
src/model/ids.ts                          newId()
src/model/geometry.ts                     page/spread numbering, page rectangles, frame bounds
src/model/factory.ts                      defaults, createZine, createTextElement, createPhotoElement
src/model/parse.ts                        parseZine (validation, defaults, version check)
src/model/sheets.ts                       add/remove sheet keeping covers in place
src/model/queries.ts                      imageIdsOfZine
src/imposition/imposition.ts              sheetSides(sheets)
src/imposition/layout.ts                  printLayout (scale for home printer)
src/imposition/marks.ts                   crop and fold mark segments
src/storage/db.ts                         IndexedDB access
src/storage/cleanup.ts                    unused images and font families
src/storage/zinFile.ts                    .zin read/write, bundle from/to DB
src/images/prepareImage.ts                downscale + encode imported images (browser)
src/fonts/fontLoader.ts                   FontFace registration, Konva font names (browser)
src/render/photoGeometry.ts               photo cover/crop math (pure)
src/render/assets.ts                      ImageBitmaps for rendering
src/render/konvaCanvas.ts                 drawToCanvas helper
src/render/buildSpread.ts                 Konva nodes for one spread
src/render/renderPage.ts                  renderPage, renderSpread
src/render/canvasBytes.ts                 canvas -> JPEG/PNG bytes
src/print/sheetSide.ts                    renderSheetSide (two pages + marks on A4)
src/print/fileName.ts                     fileSlug
src/print/pdf.ts                          buildSheetsPdf, buildPagesPdf
src/print/testPage.ts                     testPageZine
src/test/pixels.ts                        test helpers for canvases (browser)
test-output/.gitkeep                      sample renders written by tests (ignored)
```

---

### Task 1: Project scaffold and test runners

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `.gitignore`, `src/main.tsx`, `src/App.tsx`, `test-output/.gitkeep`, `src/smoke.test.ts`, `src/smoke.browser.test.ts`

- [ ] **Step 1: Check Node**

Run: `node --version`
Expected: `v20.19` or newer (Vite 7 needs ≥ 20.19 / 22.12).

- [ ] **Step 2: Write `package.json`**

```json
{
  "name": "ziniarz",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:unit": "vitest run --project unit",
    "test:browser": "vitest run --project browser"
  },
  "dependencies": {
    "@fontsource/inter": "^5.2.6",
    "idb": "^8.0.3",
    "jszip": "^3.10.1",
    "konva": "~9.3.20",
    "pdf-lib": "^1.17.1",
    "react": "^19.1.1",
    "react-dom": "^19.1.1"
  },
  "devDependencies": {
    "@types/node": "^22.18.0",
    "@types/react": "^19.1.0",
    "@types/react-dom": "^19.1.0",
    "@vitejs/plugin-react": "^5.0.2",
    "@vitest/browser": "~3.2.4",
    "fake-indexeddb": "^6.0.1",
    "playwright": "^1.55.0",
    "typescript": "~5.9.2",
    "vite": "^7.1.5",
    "vitest": "~3.2.4"
  }
}
```

- [ ] **Step 3: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noEmit": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "types": ["vite/client", "@vitest/browser/providers/playwright"]
  },
  "include": ["src", "vite.config.ts"]
}
```

- [ ] **Step 4: Write `vite.config.ts`**

```ts
import { configDefaults, defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
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
          include: ['src/**/*.browser.test.ts'],
          browser: {
            enabled: true,
            provider: 'playwright',
            headless: true,
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
});
```

- [ ] **Step 5: Write `index.html`, `src/main.tsx`, `src/App.tsx`**

`index.html`:
```html
<!doctype html>
<html lang="pl">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>ZINIARZ</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`src/main.tsx`:
```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

`src/App.tsx`:
```tsx
export function App() {
  return <main style={{ fontFamily: 'Helvetica, Arial, sans-serif', padding: 32 }}>ZINIARZ</main>;
}
```

- [ ] **Step 6: Write `.gitignore` and `test-output/.gitkeep`**

`.gitignore`:
```
node_modules
dist
test-output/*
!test-output/.gitkeep
.DS_Store
```

Create an empty file `test-output/.gitkeep`.

- [ ] **Step 7: Write smoke tests**

`src/smoke.test.ts`:
```ts
import { expect, test } from 'vitest';

test('node project runs', () => {
  expect(1 + 1).toBe(2);
});
```

`src/smoke.browser.test.ts`:
```ts
import { expect, test } from 'vitest';

test('browser project has a canvas', () => {
  const canvas = document.createElement('canvas');
  expect(canvas.getContext('2d')).not.toBeNull();
});
```

- [ ] **Step 8: Install and run**

Run: `npm install && npx playwright install chromium && npm test`
Expected: both projects pass (`2 passed`).

Run: `npm run typecheck`
Expected: no output, exit code 0.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "Scaffold Vite + React + TS app with unit and browser test projects"
```

---

### Task 2: Types and page geometry

**Files:**
- Create: `src/model/types.ts`, `src/model/ids.ts`, `src/model/geometry.ts`
- Test: `src/model/geometry.test.ts`

- [ ] **Step 1: Write `src/model/types.ts`**

```ts
export type Side = 'left' | 'right';

export interface Margins {
  outer: number;
  inner: number;
  top: number;
  bottom: number;
}

export interface PageStyle {
  background: string;
}

export type DuplexMode = 'auto' | 'manual';

export interface PrintSettings {
  printerMargin: number;
  bleed: boolean;
  cropMarks: boolean;
  foldMarks: boolean;
  rotateBacks: boolean;
  duplex: DuplexMode;
  manualReverseBacks: boolean;
}

/** Frame in spread coordinates (mm). Rotation in degrees around the frame centre. */
export interface Frame {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

/** Photo position inside its frame: offset of the image centre from the frame centre (mm), zoom >= 1. */
export interface PhotoCrop {
  offsetX: number;
  offsetY: number;
  zoom: number;
}

export interface PhotoElement extends Frame {
  kind: 'photo';
  imageId: string;
  crop: PhotoCrop;
  flipX: boolean;
  opacity: number;
}

export type TextAlign = 'left' | 'center' | 'right' | 'justify';

/** Text frame: `width` is the wrap width, `height` is recomputed from the text by the renderer. */
export interface TextElement extends Frame {
  kind: 'text';
  text: string;
  fontFamilyId: string;
  /** Typographic points at A5 scale. */
  size: number;
  bold: boolean;
  italic: boolean;
  /** Thousandths of an em. */
  letterSpacing: number;
  lineHeight: number;
  color: string;
  align: TextAlign;
}

export type ZineElement = PhotoElement | TextElement;

export interface Spread {
  id: string;
  /** Draw order: last element on top. */
  elements: ZineElement[];
}

export interface Zine {
  formatVersion: number;
  id: string;
  title: string;
  sheets: number;
  margins: Margins;
  /** Length = 2 * sheets + 1. Spread i holds pages 2i (left) and 2i + 1 (right). */
  spreads: Spread[];
  /** Page background by page number; missing = white. */
  pages: Record<number, PageStyle>;
  /** Ids of custom font families uploaded to this zine. */
  fonts: string[];
  print: PrintSettings;
  createdAt: string;
  updatedAt: string;
}
```

- [ ] **Step 2: Write `src/model/ids.ts`**

```ts
export function newId(): string {
  return crypto.randomUUID();
}
```

- [ ] **Step 3: Write the failing test `src/model/geometry.test.ts`**

```ts
import { describe, expect, test } from 'vitest';
import {
  frameBounds,
  pageAt,
  pageCount,
  pageExists,
  pageRect,
  pagesOfFrame,
  pagesOfSpread,
  slotOfPage,
  spreadCount,
} from './geometry';

const frame = (x: number, y: number, width: number, height: number, rotation = 0) => ({
  id: 'f',
  x,
  y,
  width,
  height,
  rotation,
});

describe('numbering', () => {
  test('counts pages and spreads', () => {
    expect(pageCount(5)).toBe(20);
    expect(spreadCount(5)).toBe(11);
  });

  test('maps pages to spread slots and back', () => {
    expect(slotOfPage(1)).toEqual({ spread: 0, side: 'right' });
    expect(slotOfPage(2)).toEqual({ spread: 1, side: 'left' });
    expect(slotOfPage(20)).toEqual({ spread: 10, side: 'left' });
    for (let page = 1; page <= 24; page++) {
      const { spread, side } = slotOfPage(page);
      expect(pageAt(spread, side)).toBe(page);
    }
  });

  test('lists existing pages of a spread', () => {
    expect(pagesOfSpread(0, 5)).toEqual([1]);
    expect(pagesOfSpread(3, 5)).toEqual([6, 7]);
    expect(pagesOfSpread(10, 5)).toEqual([20]);
    expect(pageExists(0, 5)).toBe(false);
    expect(pageExists(21, 5)).toBe(false);
  });
});

describe('rectangles', () => {
  test('page rect grows by bleed on outer edges only', () => {
    expect(pageRect('left', 3)).toEqual({ x: -3, y: -3, width: 151, height: 216 });
    expect(pageRect('right', 3)).toEqual({ x: 148, y: -3, width: 151, height: 216 });
    expect(pageRect('right', 0)).toEqual({ x: 148, y: 0, width: 148, height: 210 });
  });

  test('frame bounds include rotation', () => {
    const b = frameBounds(frame(24, 95, 100, 20, 90));
    expect(b.x).toBeCloseTo(64);
    expect(b.y).toBeCloseTo(55);
    expect(b.width).toBeCloseTo(20);
    expect(b.height).toBeCloseTo(100);
  });

  test('assigns a frame to the pages it overlaps', () => {
    expect(pagesOfFrame(3, frame(100, 50, 100, 50), 5)).toEqual([6, 7]);
    expect(pagesOfFrame(3, frame(10, 50, 100, 50), 5)).toEqual([6]);
    expect(pagesOfFrame(0, frame(10, 50, 100, 50), 5)).toEqual([]);
    expect(pagesOfFrame(0, frame(100, 50, 100, 50), 5)).toEqual([1]);
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npx vitest run --project unit src/model/geometry.test.ts`
Expected: FAIL, cannot resolve `./geometry`.

- [ ] **Step 5: Write `src/model/geometry.ts`**

```ts
import type { Frame, Side } from './types';

export const PAGE_WIDTH = 148;
export const PAGE_HEIGHT = 210;
export const SPREAD_WIDTH = PAGE_WIDTH * 2;
export const BLEED = 3;
export const MIN_SHEETS = 1;
export const MAX_SHEETS = 20;

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PageSlot {
  spread: number;
  side: Side;
}

export function pageCount(sheets: number): number {
  return sheets * 4;
}

export function spreadCount(sheets: number): number {
  return sheets * 2 + 1;
}

export function slotOfPage(page: number): PageSlot {
  return { spread: Math.floor(page / 2), side: page % 2 === 0 ? 'left' : 'right' };
}

export function pageAt(spread: number, side: Side): number {
  return spread * 2 + (side === 'left' ? 0 : 1);
}

export function pageExists(page: number, sheets: number): boolean {
  return page >= 1 && page <= pageCount(sheets);
}

export function pagesOfSpread(spread: number, sheets: number): number[] {
  return [pageAt(spread, 'left'), pageAt(spread, 'right')].filter((p) => pageExists(p, sheets));
}

/** Page rectangle in spread coordinates, grown by `bleed` on the outer edges (never at the spine). */
export function pageRect(side: Side, bleed: number): Rect {
  return {
    x: side === 'left' ? -bleed : PAGE_WIDTH,
    y: -bleed,
    width: PAGE_WIDTH + bleed,
    height: PAGE_HEIGHT + 2 * bleed,
  };
}

/** Axis-aligned bounds of a frame rotated around its centre. */
export function frameBounds(f: Frame): Rect {
  const rad = (f.rotation * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  const width = f.width * cos + f.height * sin;
  const height = f.width * sin + f.height * cos;
  const cx = f.x + f.width / 2;
  const cy = f.y + f.height / 2;
  return { x: cx - width / 2, y: cy - height / 2, width, height };
}

/** Existing pages whose trimmed area overlaps the frame. */
export function pagesOfFrame(spread: number, f: Frame, sheets: number): number[] {
  const b = frameBounds(f);
  return pagesOfSpread(spread, sheets).filter((page) => {
    const r = pageRect(slotOfPage(page).side, 0);
    return b.x < r.x + r.width && b.x + b.width > r.x && b.y < r.y + r.height && b.y + b.height > r.y;
  });
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run --project unit src/model/geometry.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/model
git commit -m "Add zine types and page geometry"
```

---

### Task 3: Factory, defaults and parsing

**Files:**
- Create: `src/model/factory.ts`, `src/model/parse.ts`, `src/model/queries.ts`
- Test: `src/model/parse.test.ts`

- [ ] **Step 1: Write `src/model/factory.ts`**

```ts
import { MAX_SHEETS, MIN_SHEETS, spreadCount } from './geometry';
import { newId } from './ids';
import type { Margins, PhotoElement, PrintSettings, Spread, TextElement, Zine } from './types';

export const FORMAT_VERSION = 1;
export const DEFAULT_MARGINS: Margins = { outer: 30, inner: 30, top: 30, bottom: 30 };
export const DEFAULT_PRINT: PrintSettings = {
  printerMargin: 4,
  bleed: true,
  cropMarks: true,
  foldMarks: true,
  rotateBacks: false,
  duplex: 'auto',
  manualReverseBacks: true,
};
/** Falls back to the browser's sans-serif until built-in fonts arrive (plan 2). */
export const DEFAULT_FONT_FAMILY = 'system-sans';

export function clampSheets(sheets: number): number {
  return Math.min(MAX_SHEETS, Math.max(MIN_SHEETS, Math.round(sheets)));
}

export function createSpread(): Spread {
  return { id: newId(), elements: [] };
}

export function createZine(title: string, sheets: number, now = new Date()): Zine {
  const count = clampSheets(sheets);
  const stamp = now.toISOString();
  return {
    formatVersion: FORMAT_VERSION,
    id: newId(),
    title,
    sheets: count,
    margins: { ...DEFAULT_MARGINS },
    spreads: Array.from({ length: spreadCount(count) }, () => createSpread()),
    pages: {},
    fonts: [],
    print: { ...DEFAULT_PRINT },
    createdAt: stamp,
    updatedAt: stamp,
  };
}

export function createTextElement(fields: Partial<Omit<TextElement, 'kind'>> = {}): TextElement {
  return {
    id: newId(),
    x: 0,
    y: 0,
    width: 88,
    height: 0,
    rotation: 0,
    text: '',
    fontFamilyId: DEFAULT_FONT_FAMILY,
    size: 12,
    bold: false,
    italic: false,
    letterSpacing: 0,
    lineHeight: 1.2,
    color: '#000000',
    align: 'left',
    ...fields,
    kind: 'text',
  };
}

export function createPhotoElement(
  imageId: string,
  fields: Partial<Omit<PhotoElement, 'kind' | 'imageId'>> = {},
): PhotoElement {
  return {
    id: newId(),
    x: 0,
    y: 0,
    width: 88,
    height: 150,
    rotation: 0,
    crop: { offsetX: 0, offsetY: 0, zoom: 1 },
    flipX: false,
    opacity: 1,
    ...fields,
    kind: 'photo',
    imageId,
  };
}
```

- [ ] **Step 2: Write `src/model/queries.ts`**

```ts
import type { Zine } from './types';

export function imageIdsOfZine(zine: Zine): Set<string> {
  const ids = new Set<string>();
  for (const spread of zine.spreads) {
    for (const element of spread.elements) {
      if (element.kind === 'photo') ids.add(element.imageId);
    }
  }
  return ids;
}
```

- [ ] **Step 3: Write the failing test `src/model/parse.test.ts`**

```ts
import { describe, expect, test } from 'vitest';
import { createPhotoElement, createTextElement, createZine, DEFAULT_MARGINS, DEFAULT_PRINT } from './factory';
import { parseZine, ZineFormatError } from './parse';
import { imageIdsOfZine } from './queries';

const roundTrip = (value: unknown) => JSON.parse(JSON.stringify(value));

describe('parseZine', () => {
  test('reads back a saved zine unchanged', () => {
    const zine = createZine('Lato', 5);
    zine.pages[3] = { background: '#ff0000' };
    zine.spreads[1].elements.push(createTextElement({ text: 'Hej' }), createPhotoElement('img-1'));
    expect(parseZine(roundTrip(zine))).toEqual(zine);
  });

  test('fills missing optional fields with defaults', () => {
    const raw = roundTrip(createZine('Lato', 2));
    delete raw.margins;
    delete raw.print;
    delete raw.fonts;
    delete raw.pages;
    delete raw.formatVersion;
    const zine = parseZine(raw);
    expect(zine.margins).toEqual(DEFAULT_MARGINS);
    expect(zine.print).toEqual(DEFAULT_PRINT);
    expect(zine.fonts).toEqual([]);
    expect(zine.pages).toEqual({});
    expect(zine.formatVersion).toBe(1);
  });

  test('fills missing element fields and drops unknown elements', () => {
    const raw = roundTrip(createZine('Lato', 1));
    raw.spreads[1].elements = [
      { kind: 'text', id: 't', x: 1, y: 2, width: 50, height: 0, rotation: 0, text: 'A' },
      { kind: 'sticker', id: 's' },
      { kind: 'photo', id: 'p' },
    ];
    const zine = parseZine(raw);
    expect(zine.spreads[1].elements).toHaveLength(1);
    expect(zine.spreads[1].elements[0]).toMatchObject({ kind: 'text', text: 'A', size: 12, lineHeight: 1.2 });
  });

  test('rejects files from a newer version', () => {
    const raw = roundTrip(createZine('Lato', 1));
    raw.formatVersion = 99;
    expect(() => parseZine(raw)).toThrow(ZineFormatError);
    try {
      parseZine(raw);
    } catch (e) {
      expect((e as ZineFormatError).reason).toBe('newer');
    }
  });

  test('rejects broken data', () => {
    expect(() => parseZine('nope')).toThrow(ZineFormatError);
    const raw = roundTrip(createZine('Lato', 2));
    raw.spreads.pop();
    expect(() => parseZine(raw)).toThrow(ZineFormatError);
  });
});

test('imageIdsOfZine lists photos of all spreads', () => {
  const zine = createZine('Lato', 1);
  zine.spreads[0].elements.push(createPhotoElement('a'));
  zine.spreads[2].elements.push(createPhotoElement('b'), createTextElement());
  expect([...imageIdsOfZine(zine)].sort()).toEqual(['a', 'b']);
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npx vitest run --project unit src/model/parse.test.ts`
Expected: FAIL, cannot resolve `./parse`.

- [ ] **Step 5: Write `src/model/parse.ts`**

```ts
import {
  clampSheets,
  createPhotoElement,
  createTextElement,
  DEFAULT_MARGINS,
  DEFAULT_PRINT,
  FORMAT_VERSION,
} from './factory';
import { spreadCount } from './geometry';
import { newId } from './ids';
import type { Frame, PageStyle, Spread, TextAlign, Zine, ZineElement } from './types';

export class ZineFormatError extends Error {
  constructor(
    readonly reason: 'invalid' | 'newer',
    message: string,
  ) {
    super(message);
    this.name = 'ZineFormatError';
  }
}

const invalid = () => new ZineFormatError('invalid', 'Plik zina jest uszkodzony.');

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const str = (v: unknown, fallback: string) => (typeof v === 'string' ? v : fallback);
const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback);
const ALIGNS: TextAlign[] = ['left', 'center', 'right', 'justify'];

function parseFrame(o: Obj): Frame {
  return {
    id: str(o.id, newId()),
    x: num(o.x, 0),
    y: num(o.y, 0),
    width: num(o.width, 50),
    height: num(o.height, 50),
    rotation: num(o.rotation, 0),
  };
}

function parseElement(v: unknown): ZineElement | null {
  if (!isObj(v)) return null;
  if (v.kind === 'photo') {
    if (typeof v.imageId !== 'string') return null;
    const crop = isObj(v.crop) ? v.crop : {};
    return createPhotoElement(v.imageId, {
      ...parseFrame(v),
      crop: {
        offsetX: num(crop.offsetX, 0),
        offsetY: num(crop.offsetY, 0),
        zoom: Math.max(1, num(crop.zoom, 1)),
      },
      flipX: bool(v.flipX, false),
      opacity: num(v.opacity, 1),
    });
  }
  if (v.kind === 'text') {
    const d = createTextElement();
    return createTextElement({
      ...parseFrame(v),
      text: str(v.text, ''),
      fontFamilyId: str(v.fontFamilyId, d.fontFamilyId),
      size: num(v.size, d.size),
      bold: bool(v.bold, d.bold),
      italic: bool(v.italic, d.italic),
      letterSpacing: num(v.letterSpacing, d.letterSpacing),
      lineHeight: num(v.lineHeight, d.lineHeight),
      color: str(v.color, d.color),
      align: ALIGNS.includes(v.align as TextAlign) ? (v.align as TextAlign) : d.align,
    });
  }
  return null;
}

function parseSpread(v: unknown): Spread {
  if (!isObj(v) || !Array.isArray(v.elements)) throw invalid();
  return {
    id: str(v.id, newId()),
    elements: v.elements.map(parseElement).filter((e): e is ZineElement => e !== null),
  };
}

export function parseZine(input: unknown): Zine {
  if (!isObj(input)) throw invalid();
  if (num(input.formatVersion, 1) > FORMAT_VERSION) {
    throw new ZineFormatError('newer', 'Ten zin zapisała nowsza wersja ZINIARZA. Odśwież stronę i spróbuj jeszcze raz.');
  }
  if (typeof input.id !== 'string' || typeof input.sheets !== 'number' || !Array.isArray(input.spreads)) {
    throw invalid();
  }
  const sheets = clampSheets(input.sheets);
  if (sheets !== input.sheets || input.spreads.length !== spreadCount(sheets)) throw invalid();

  const margins = isObj(input.margins) ? input.margins : {};
  const print = isObj(input.print) ? input.print : {};
  const pages: Record<number, PageStyle> = {};
  if (isObj(input.pages)) {
    for (const [key, value] of Object.entries(input.pages)) {
      const page = Number(key);
      if (Number.isInteger(page) && isObj(value) && typeof value.background === 'string') {
        pages[page] = { background: value.background };
      }
    }
  }
  const now = new Date().toISOString();

  return {
    formatVersion: FORMAT_VERSION,
    id: input.id,
    title: str(input.title, 'Bez tytułu'),
    sheets,
    margins: {
      outer: num(margins.outer, DEFAULT_MARGINS.outer),
      inner: num(margins.inner, DEFAULT_MARGINS.inner),
      top: num(margins.top, DEFAULT_MARGINS.top),
      bottom: num(margins.bottom, DEFAULT_MARGINS.bottom),
    },
    spreads: input.spreads.map(parseSpread),
    pages,
    fonts: Array.isArray(input.fonts) ? input.fonts.filter((f): f is string => typeof f === 'string') : [],
    print: {
      printerMargin: num(print.printerMargin, DEFAULT_PRINT.printerMargin),
      bleed: bool(print.bleed, DEFAULT_PRINT.bleed),
      cropMarks: bool(print.cropMarks, DEFAULT_PRINT.cropMarks),
      foldMarks: bool(print.foldMarks, DEFAULT_PRINT.foldMarks),
      rotateBacks: bool(print.rotateBacks, DEFAULT_PRINT.rotateBacks),
      duplex: print.duplex === 'manual' ? 'manual' : 'auto',
      manualReverseBacks: bool(print.manualReverseBacks, DEFAULT_PRINT.manualReverseBacks),
    },
    createdAt: str(input.createdAt, now),
    updatedAt: str(input.updatedAt, now),
  };
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run --project unit src/model/parse.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/model
git commit -m "Add zine factory, defaults and tolerant parsing"
```

---

### Task 4: Adding and removing sheets

**Files:**
- Create: `src/model/sheets.ts`
- Test: `src/model/sheets.test.ts`

Rules from the spec: spread 1 holds the inside front cover (page 2), spread `P/2 − 1` the inside back cover (page `P − 1`). Add inserts 2 empty spreads after `j = clamp(current, 1, P/2 − 2)`; remove deletes spreads `j, j + 1` with `j = clamp(current, 2, P/2 − 3)` (for 2 sheets this gives `j = 2`). Page backgrounds follow their pages.

- [ ] **Step 1: Write the failing test `src/model/sheets.test.ts`**

```ts
import { describe, expect, test } from 'vitest';
import { createTextElement, createZine } from './factory';
import { pageCount } from './geometry';
import { addSheet, removalNeedsConfirmation, removeSheet, sheetRemoval } from './sheets';
import type { Zine } from './types';

/** Zine where every spread holds one text element naming its original index. */
function marked(sheets: number): Zine {
  const zine = createZine('t', sheets);
  zine.spreads.forEach((s, i) => s.elements.push(createTextElement({ text: `s${i}` })));
  return zine;
}
const label = (zine: Zine, spread: number) =>
  zine.spreads[spread].elements.map((e) => (e.kind === 'text' ? e.text : '')).join('');

describe('addSheet', () => {
  test('adds four pages', () => {
    const zine = addSheet(createZine('t', 5), 3);
    expect(zine.sheets).toBe(6);
    expect(zine.spreads).toHaveLength(13);
  });

  test('inserts two empty spreads after the current one', () => {
    const zine = addSheet(marked(5), 3);
    expect(label(zine, 3)).toBe('s3');
    expect(label(zine, 4)).toBe('');
    expect(label(zine, 5)).toBe('');
    expect(label(zine, 6)).toBe('s4');
  });

  test('keeps covers and inside covers in place for every current spread', () => {
    for (let sheets = 2; sheets <= 6; sheets++) {
      const lastBefore = pageCount(sheets) / 2;
      for (let current = 0; current <= lastBefore; current++) {
        const zine = addSheet(marked(sheets), current);
        const last = pageCount(zine.sheets) / 2;
        expect(label(zine, 0)).toBe('s0');
        expect(label(zine, 1)).toBe('s1');
        expect(label(zine, last - 1)).toBe(`s${lastBefore - 1}`);
        expect(label(zine, last)).toBe(`s${lastBefore}`);
      }
    }
  });

  test('with one sheet inserts after spread 1', () => {
    const zine = addSheet(marked(1), 0);
    expect([0, 1, 2, 3, 4].map((i) => label(zine, i))).toEqual(['s0', 's1', '', '', 's2']);
  });

  test('moves page backgrounds with their pages', () => {
    const zine = createZine('t', 2);
    zine.pages[3] = { background: 'a' };
    zine.pages[4] = { background: 'b' };
    zine.pages[8] = { background: 'c' };
    const next = addSheet(zine, 1);
    expect(next.pages).toEqual({ 3: { background: 'a' }, 8: { background: 'b' }, 12: { background: 'c' } });
  });

  test('stops at 20 sheets', () => {
    const zine = createZine('t', 20);
    expect(addSheet(zine, 3)).toBe(zine);
  });
});

describe('removeSheet', () => {
  test('cannot remove the last sheet', () => {
    expect(sheetRemoval(createZine('t', 1), 1)).toBeNull();
    const zine = createZine('t', 1);
    expect(removeSheet(zine, 1)).toBe(zine);
  });

  test('removes the current spread and the next one', () => {
    expect(sheetRemoval(createZine('t', 5), 4)).toEqual({ spreads: [4, 5], pages: [8, 9, 10, 11] });
    const zine = removeSheet(marked(5), 4);
    expect(zine.sheets).toBe(4);
    expect(zine.spreads.map((_, i) => label(zine, i))).toEqual(['s0', 's1', 's2', 's3', 's6', 's7', 's8', 's9', 's10']);
  });

  test('keeps covers and inside covers for 3+ sheets', () => {
    for (let sheets = 3; sheets <= 6; sheets++) {
      const lastBefore = pageCount(sheets) / 2;
      for (let current = 0; current <= lastBefore; current++) {
        const zine = removeSheet(marked(sheets), current);
        const last = pageCount(zine.sheets) / 2;
        expect(label(zine, 0)).toBe('s0');
        expect(label(zine, 1)).toBe('s1');
        expect(label(zine, last - 1)).toBe(`s${lastBefore - 1}`);
        expect(label(zine, last)).toBe(`s${lastBefore}`);
      }
    }
  });

  test('with two sheets removes spreads 2 and 3', () => {
    expect(sheetRemoval(createZine('t', 2), 0)).toEqual({ spreads: [2, 3], pages: [4, 5, 6, 7] });
    const zine = removeSheet(marked(2), 0);
    expect(zine.spreads.map((_, i) => label(zine, i))).toEqual(['s0', 's1', 's4']);
  });

  test('drops and shifts page backgrounds', () => {
    const zine = createZine('t', 3);
    zine.pages[2] = { background: 'a' };
    zine.pages[5] = { background: 'gone' };
    zine.pages[11] = { background: 'b' };
    expect(removeSheet(zine, 2).pages).toEqual({ 2: { background: 'a' }, 7: { background: 'b' } });
  });

  test('asks for confirmation only when removed pages have content', () => {
    const zine = createZine('t', 3);
    const removal = sheetRemoval(zine, 2)!;
    expect(removalNeedsConfirmation(zine, removal)).toBe(false);
    zine.pages[4] = { background: '#000' };
    expect(removalNeedsConfirmation(zine, removal)).toBe(true);
    const other = createZine('t', 3);
    other.spreads[3].elements.push(createTextElement());
    expect(removalNeedsConfirmation(other, removal)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --project unit src/model/sheets.test.ts`
Expected: FAIL, cannot resolve `./sheets`.

- [ ] **Step 3: Write `src/model/sheets.ts`**

```ts
import { createSpread } from './factory';
import { MAX_SHEETS, MIN_SHEETS, pageCount } from './geometry';
import type { PageStyle, Zine } from './types';

export interface SheetRemoval {
  spreads: [number, number];
  pages: number[];
}

const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(value, high));

function remapPages(
  pages: Record<number, PageStyle>,
  map: (page: number) => number | null,
): Record<number, PageStyle> {
  const result: Record<number, PageStyle> = {};
  for (const [key, style] of Object.entries(pages)) {
    const target = map(Number(key));
    if (target !== null) result[target] = style;
  }
  return result;
}

export function canAddSheet(zine: Zine): boolean {
  return zine.sheets < MAX_SHEETS;
}

/** Inserts 4 empty pages after the current spread, never before the inside covers. */
export function addSheet(zine: Zine, currentSpread: number, now = new Date()): Zine {
  if (!canAddSheet(zine)) return zine;
  const half = pageCount(zine.sheets) / 2;
  const j = clamp(currentSpread, 1, Math.max(1, half - 2));
  const firstMoved = 2 * j + 2;
  return {
    ...zine,
    sheets: zine.sheets + 1,
    spreads: [...zine.spreads.slice(0, j + 1), createSpread(), createSpread(), ...zine.spreads.slice(j + 1)],
    pages: remapPages(zine.pages, (p) => (p >= firstMoved ? p + 4 : p)),
    updatedAt: now.toISOString(),
  };
}

/** Which two spreads "− kartka" would remove, or null when the zine has one sheet. */
export function sheetRemoval(zine: Zine, currentSpread: number): SheetRemoval | null {
  if (zine.sheets <= MIN_SHEETS) return null;
  const half = pageCount(zine.sheets) / 2;
  const j = Math.max(2, Math.min(currentSpread, half - 3));
  return { spreads: [j, j + 1], pages: [2 * j, 2 * j + 1, 2 * j + 2, 2 * j + 3] };
}

export function removalNeedsConfirmation(zine: Zine, removal: SheetRemoval): boolean {
  return (
    removal.spreads.some((s) => zine.spreads[s].elements.length > 0) ||
    removal.pages.some((p) => zine.pages[p] !== undefined)
  );
}

export function removeSheet(zine: Zine, currentSpread: number, now = new Date()): Zine {
  const removal = sheetRemoval(zine, currentSpread);
  if (!removal) return zine;
  const [first, second] = removal.spreads;
  const lastRemovedPage = removal.pages[3];
  return {
    ...zine,
    sheets: zine.sheets - 1,
    spreads: zine.spreads.filter((_, i) => i !== first && i !== second),
    pages: remapPages(zine.pages, (p) => {
      if (removal.pages.includes(p)) return null;
      return p > lastRemovedPage ? p - 4 : p;
    }),
    updatedAt: now.toISOString(),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --project unit src/model/sheets.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/model
git commit -m "Add sheet insertion and removal that keep covers in place"
```

---

### Task 5: Imposition

**Files:**
- Create: `src/imposition/imposition.ts`
- Test: `src/imposition/imposition.test.ts`

- [ ] **Step 1: Write the failing test `src/imposition/imposition.test.ts`**

```ts
import { describe, expect, test } from 'vitest';
import { sheetSides } from './imposition';

describe('sheetSides', () => {
  test('5 sheets (20 pages)', () => {
    expect(sheetSides(5).map((s) => [s.sheet, s.face, s.left, s.right])).toEqual([
      [0, 'front', 20, 1],
      [0, 'back', 2, 19],
      [1, 'front', 18, 3],
      [1, 'back', 4, 17],
      [2, 'front', 16, 5],
      [2, 'back', 6, 15],
      [3, 'front', 14, 7],
      [3, 'back', 8, 13],
      [4, 'front', 12, 9],
      [4, 'back', 10, 11],
    ]);
  });

  test('6 sheets (24 pages)', () => {
    const sides = sheetSides(6);
    expect(sides[0]).toEqual({ sheet: 0, face: 'front', left: 24, right: 1 });
    expect(sides[1]).toEqual({ sheet: 0, face: 'back', left: 2, right: 23 });
    expect(sides[10]).toEqual({ sheet: 5, face: 'front', left: 14, right: 11 });
    expect(sides[11]).toEqual({ sheet: 5, face: 'back', left: 12, right: 13 });
  });

  test('every page appears exactly once, even pages on the left', () => {
    for (let sheets = 1; sheets <= 20; sheets++) {
      const sides = sheetSides(sheets);
      expect(sides).toHaveLength(sheets * 2);
      const pages = sides.flatMap((s) => [s.left, s.right]).sort((a, b) => a - b);
      expect(pages).toEqual(Array.from({ length: sheets * 4 }, (_, i) => i + 1));
      for (const s of sides) {
        expect(s.left % 2).toBe(0);
        expect(s.right % 2).toBe(1);
      }
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --project unit src/imposition/imposition.test.ts`
Expected: FAIL, cannot resolve `./imposition`.

- [ ] **Step 3: Write `src/imposition/imposition.ts`**

```ts
import { pageCount } from '../model/geometry';

export type SheetFace = 'front' | 'back';

export interface SheetSide {
  sheet: number;
  face: SheetFace;
  /** Page on the left half of the landscape A4 sheet. */
  left: number;
  /** Page on the right half. */
  right: number;
}

/**
 * Saddle-stitch imposition in print order: front 0, back 0, front 1, back 1, ...
 * The back assumes the sheet is turned left-to-right (duplex "flip on short edge").
 */
export function sheetSides(sheets: number): SheetSide[] {
  const total = pageCount(sheets);
  const sides: SheetSide[] = [];
  for (let k = 0; k < sheets; k++) {
    sides.push({ sheet: k, face: 'front', left: total - 2 * k, right: 2 * k + 1 });
    sides.push({ sheet: k, face: 'back', left: 2 * k + 2, right: total - 2 * k - 1 });
  }
  return sides;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --project unit src/imposition/imposition.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/imposition
git commit -m "Add saddle-stitch imposition"
```

---

### Task 6: Print layout and marks

**Files:**
- Create: `src/imposition/layout.ts`, `src/imposition/marks.ts`
- Test: `src/imposition/layout.test.ts`

- [ ] **Step 1: Write the failing test `src/imposition/layout.test.ts`**

```ts
import { describe, expect, test } from 'vitest';
import { A4_LANDSCAPE, printLayout, type PrintLayoutOptions } from './layout';
import { cropMarks, foldMarks, MARK_LENGTH, MARK_OFFSET } from './marks';

const options = (o: Partial<PrintLayoutOptions> = {}): PrintLayoutOptions => ({
  printerMargin: 4,
  bleed: true,
  cropMarks: false,
  foldMarks: false,
  ...o,
});

describe('printLayout', () => {
  test('bleed without marks, 4 mm printer margin', () => {
    const l = printLayout(options());
    expect(l.scale).toBeCloseTo(202 / 216, 6);
    expect(l.trimPage.width).toBeCloseTo(138.4, 1);
    expect(l.trimPage.height).toBeCloseTo(196.4, 1);
    expect(l.bleed).toBeCloseTo(3 * l.scale, 6);
    expect(l.markBand).toBe(0);
  });

  test('bleed with marks', () => {
    const l = printLayout(options({ cropMarks: true }));
    expect(l.scale).toBeCloseTo(192 / 216, 6);
    expect(l.trimPage.width).toBeCloseTo(131.6, 1);
    expect(l.trimPage.height).toBeCloseTo(186.7, 1);
    expect(l.markBand).toBe(5);
    expect(printLayout(options({ foldMarks: true })).scale).toBeCloseTo(l.scale, 6);
  });

  test('never enlarges', () => {
    const l = printLayout(options({ printerMargin: 0, bleed: false }));
    expect(l.scale).toBe(1);
    expect(l.bleed).toBe(0);
  });

  test('centres the trimmed pair on the sheet', () => {
    const l = printLayout(options());
    expect(l.spread.x * 2 + l.spread.width).toBeCloseTo(A4_LANDSCAPE.width, 6);
    expect(l.spread.y * 2 + l.spread.height).toBeCloseTo(A4_LANDSCAPE.height, 6);
    expect(l.spread.width).toBeCloseTo(l.trimPage.width * 2, 6);
  });

  test('bleed and marks stay inside the printable area', () => {
    for (const printerMargin of [0, 3, 4, 5, 6]) {
      for (const bleed of [false, true]) {
        for (const marks of [false, true]) {
          const l = printLayout(options({ printerMargin, bleed, cropMarks: marks, foldMarks: marks }));
          const eps = 1e-9;
          expect(l.spread.x - l.bleed - l.markBand).toBeGreaterThanOrEqual(printerMargin - eps);
          expect(l.spread.y - l.bleed - l.markBand).toBeGreaterThanOrEqual(printerMargin - eps);
          const segments = marks ? [...cropMarks(l), ...foldMarks(l)] : [];
          for (const s of segments) {
            for (const [x, y] of [
              [s.x1, s.y1],
              [s.x2, s.y2],
            ]) {
              expect(x).toBeGreaterThanOrEqual(printerMargin - eps);
              expect(x).toBeLessThanOrEqual(A4_LANDSCAPE.width - printerMargin + eps);
              expect(y).toBeGreaterThanOrEqual(printerMargin - eps);
              expect(y).toBeLessThanOrEqual(A4_LANDSCAPE.height - printerMargin + eps);
            }
          }
        }
      }
    }
  });
});

describe('marks', () => {
  test('8 crop marks starting 1 mm beyond the bleed', () => {
    const l = printLayout(options({ cropMarks: true }));
    const marks = cropMarks(l);
    expect(marks).toHaveLength(8);
    const left = l.spread.x;
    const top = l.spread.y;
    const start = l.bleed + MARK_OFFSET;
    const end = start + MARK_LENGTH;
    expect(marks).toContainEqual({ x1: left - start, y1: top, x2: left - end, y2: top });
    expect(marks).toContainEqual({ x1: left, y1: top - start, x2: left, y2: top - end });
  });

  test('2 fold marks on the sheet centre line', () => {
    const l = printLayout(options({ foldMarks: true }));
    const marks = foldMarks(l);
    expect(marks).toHaveLength(2);
    for (const m of marks) {
      expect(m.x1).toBeCloseTo(148.5, 6);
      expect(m.x2).toBeCloseTo(148.5, 6);
    }
    expect(marks[0].y1).toBeCloseTo(l.spread.y - l.bleed - MARK_OFFSET, 6);
    expect(marks[1].y1).toBeCloseTo(l.spread.y + l.spread.height + l.bleed + MARK_OFFSET, 6);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --project unit src/imposition/layout.test.ts`
Expected: FAIL, cannot resolve `./layout`.

- [ ] **Step 3: Write `src/imposition/layout.ts`**

```ts
import { BLEED, PAGE_HEIGHT, PAGE_WIDTH, SPREAD_WIDTH, type Rect } from '../model/geometry';

export const A4_LANDSCAPE = { width: 297, height: 210 } as const;
/** Space reserved outside the bleed for crop or fold marks (not scaled). */
export const MARK_BAND = 5;

export interface PrintLayoutOptions {
  printerMargin: number;
  bleed: boolean;
  cropMarks: boolean;
  foldMarks: boolean;
}

export interface PrintLayout {
  /** Factor applied to the A5 design so bleed and marks fit the printable area. */
  scale: number;
  /** Bleed on the sheet, in sheet mm (0 when bleed is off). */
  bleed: number;
  markBand: number;
  /** Trimmed pair of pages on the sheet, in sheet mm. */
  spread: Rect;
  trimPage: { width: number; height: number };
}

export function printLayout(o: PrintLayoutOptions): PrintLayout {
  const bleed = o.bleed ? BLEED : 0;
  const markBand = o.cropMarks || o.foldMarks ? MARK_BAND : 0;
  const reserve = 2 * o.printerMargin + 2 * markBand;
  const scale = Math.min(
    1,
    (A4_LANDSCAPE.width - reserve) / (SPREAD_WIDTH + 2 * bleed),
    (A4_LANDSCAPE.height - reserve) / (PAGE_HEIGHT + 2 * bleed),
  );
  const width = SPREAD_WIDTH * scale;
  const height = PAGE_HEIGHT * scale;
  return {
    scale,
    bleed: bleed * scale,
    markBand,
    spread: { x: (A4_LANDSCAPE.width - width) / 2, y: (A4_LANDSCAPE.height - height) / 2, width, height },
    trimPage: { width: PAGE_WIDTH * scale, height },
  };
}
```

- [ ] **Step 4: Write `src/imposition/marks.ts`**

```ts
import type { PrintLayout } from './layout';

export const MARK_OFFSET = 1;
export const MARK_LENGTH = 4;
/** Stroke width of printed marks, mm. */
export const MARK_STROKE = 0.25;

export interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** Corner crop marks at the four outer corners of the trimmed pair. None at the spine. */
export function cropMarks(l: PrintLayout): Segment[] {
  const start = l.bleed + MARK_OFFSET;
  const end = start + MARK_LENGTH;
  const { x, y, width, height } = l.spread;
  const corners: [number, number, number, number][] = [
    [x, y, -1, -1],
    [x + width, y, 1, -1],
    [x, y + height, -1, 1],
    [x + width, y + height, 1, 1],
  ];
  return corners.flatMap(([cx, cy, dx, dy]) => [
    { x1: cx + dx * start, y1: cy, x2: cx + dx * end, y2: cy },
    { x1: cx, y1: cy + dy * start, x2: cx, y2: cy + dy * end },
  ]);
}

/** Short fold ticks above and below the pair, on the sheet centre line. */
export function foldMarks(l: PrintLayout): Segment[] {
  const start = l.bleed + MARK_OFFSET;
  const end = start + MARK_LENGTH;
  const cx = l.spread.x + l.spread.width / 2;
  const top = l.spread.y;
  const bottom = l.spread.y + l.spread.height;
  return [
    { x1: cx, y1: top - start, x2: cx, y2: top - end },
    { x1: cx, y1: bottom + start, x2: cx, y2: bottom + end },
  ];
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run --project unit src/imposition/layout.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/imposition
git commit -m "Add home-printer layout scale with crop and fold marks"
```

---

### Task 7: Photo crop geometry

**Files:**
- Create: `src/render/photoGeometry.ts`
- Test: `src/render/photoGeometry.test.ts`

- [ ] **Step 1: Write the failing test `src/render/photoGeometry.test.ts`**

```ts
import { expect, test } from 'vitest';
import { clampCrop, imagePlacement } from './photoGeometry';

const frame = { width: 100, height: 100 };

test('image covers the frame at zoom 1, centred', () => {
  expect(imagePlacement(frame, { offsetX: 0, offsetY: 0, zoom: 1 }, 200, 100)).toEqual({
    x: -50,
    y: 0,
    width: 200,
    height: 100,
  });
});

test('zoom and offset move the image', () => {
  expect(imagePlacement(frame, { offsetX: 10, offsetY: -5, zoom: 2 }, 100, 100)).toEqual({
    x: -40,
    y: -55,
    width: 200,
    height: 200,
  });
});

test('clampCrop keeps the frame covered', () => {
  expect(clampCrop(frame, { offsetX: 80, offsetY: 3, zoom: 1 }, 200, 100)).toEqual({ offsetX: 50, offsetY: 0, zoom: 1 });
  expect(clampCrop(frame, { offsetX: 0, offsetY: 0, zoom: 0.5 }, 100, 100)).toEqual({ offsetX: 0, offsetY: 0, zoom: 1 });
  expect(clampCrop(frame, { offsetX: -70, offsetY: 70, zoom: 2 }, 100, 100)).toEqual({ offsetX: -50, offsetY: 50, zoom: 2 });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --project unit src/render/photoGeometry.test.ts`
Expected: FAIL, cannot resolve `./photoGeometry`.

- [ ] **Step 3: Write `src/render/photoGeometry.ts`**

```ts
import type { PhotoCrop } from '../model/types';

interface Size {
  width: number;
  height: number;
}

/** Image rectangle in frame-local mm: covers the frame at zoom 1 ("cover" fit). */
export function imagePlacement(frame: Size, crop: PhotoCrop, imageWidth: number, imageHeight: number) {
  const scale = Math.max(frame.width / imageWidth, frame.height / imageHeight) * crop.zoom;
  const width = imageWidth * scale;
  const height = imageHeight * scale;
  return {
    x: frame.width / 2 + crop.offsetX - width / 2,
    y: frame.height / 2 + crop.offsetY - height / 2,
    width,
    height,
  };
}

/** Zoom at least 1 and offsets small enough that the image still covers the whole frame. */
export function clampCrop(frame: Size, crop: PhotoCrop, imageWidth: number, imageHeight: number): PhotoCrop {
  const zoom = Math.max(1, crop.zoom);
  const placed = imagePlacement(frame, { offsetX: 0, offsetY: 0, zoom }, imageWidth, imageHeight);
  const maxX = (placed.width - frame.width) / 2;
  const maxY = (placed.height - frame.height) / 2;
  const clamp = (v: number, m: number) => Math.max(-m, Math.min(m, v)) + 0;
  return { offsetX: clamp(crop.offsetX, maxX), offsetY: clamp(crop.offsetY, maxY), zoom };
}
```

(The `+ 0` turns `-0` into `0`, so `toEqual` comparisons stay simple.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --project unit src/render/photoGeometry.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/render
git commit -m "Add photo cover and crop geometry"
```

---

### Task 8: IndexedDB storage

**Files:**
- Create: `src/storage/db.ts`
- Test: `src/storage/db.test.ts`

- [ ] **Step 1: Write the failing test `src/storage/db.test.ts`**

```ts
import 'fake-indexeddb/auto';
import { describe, expect, test } from 'vitest';
import { createZine } from '../model/factory';
import { newId } from '../model/ids';
import {
  deleteFontFamilies,
  deleteImages,
  deleteZine,
  fontFilesOfFamily,
  getImage,
  listFontFamilyIds,
  listImageIds,
  listZines,
  loadZine,
  openZiniarzDb,
  putFontFamily,
  putFontFile,
  putImage,
  saveZine,
} from './db';

const freshDb = () => openZiniarzDb(`test-${newId()}`);
const bytes = (...values: number[]) => new Uint8Array(values).buffer;

describe('zines', () => {
  test('save, load, list, delete', async () => {
    const db = await freshDb();
    const a = createZine('A', 1);
    const b = createZine('B', 2);
    await saveZine(db, a);
    await saveZine(db, b);
    expect(await loadZine(db, a.id)).toEqual(a);
    expect((await listZines(db)).map((z) => z.title).sort()).toEqual(['A', 'B']);
    await deleteZine(db, a.id);
    expect(await loadZine(db, a.id)).toBeUndefined();
  });
});

describe('images', () => {
  test('put, get, list, delete', async () => {
    const db = await freshDb();
    await putImage(db, { id: 'i1', mime: 'image/jpeg', width: 2, height: 1, data: bytes(1, 2, 3) });
    const image = await getImage(db, 'i1');
    expect(image?.width).toBe(2);
    expect(new Uint8Array(image!.data)).toEqual(new Uint8Array([1, 2, 3]));
    expect(await listImageIds(db)).toEqual(['i1']);
    await deleteImages(db, ['i1']);
    expect(await listImageIds(db)).toEqual([]);
  });
});

describe('fonts', () => {
  test('families group files; deleting a family deletes its files', async () => {
    const db = await freshDb();
    await putFontFamily(db, { id: 'f1', name: 'Grotesk' });
    await putFontFile(db, { id: 'r', familyId: 'f1', bold: false, italic: false, mime: 'font/ttf', data: bytes(1) });
    await putFontFile(db, { id: 'b', familyId: 'f1', bold: true, italic: false, mime: 'font/ttf', data: bytes(2) });
    expect((await fontFilesOfFamily(db, 'f1')).map((f) => f.id).sort()).toEqual(['b', 'r']);
    expect(await listFontFamilyIds(db)).toEqual(['f1']);
    await deleteFontFamilies(db, ['f1']);
    expect(await listFontFamilyIds(db)).toEqual([]);
    expect(await fontFilesOfFamily(db, 'f1')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --project unit src/storage/db.test.ts`
Expected: FAIL, cannot resolve `./db`.

- [ ] **Step 3: Write `src/storage/db.ts`**

```ts
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Zine } from '../model/types';

export interface StoredImage {
  id: string;
  mime: string;
  width: number;
  height: number;
  data: ArrayBuffer;
}

export interface FontFamily {
  id: string;
  name: string;
}

export interface FontFile {
  id: string;
  familyId: string;
  bold: boolean;
  italic: boolean;
  mime: string;
  data: ArrayBuffer;
}

interface ZiniarzSchema extends DBSchema {
  zines: { key: string; value: Zine };
  images: { key: string; value: StoredImage };
  fontFamilies: { key: string; value: FontFamily };
  fontFiles: { key: string; value: FontFile; indexes: { byFamily: string } };
}

export type ZiniarzDb = IDBPDatabase<ZiniarzSchema>;

export class StorageFullError extends Error {
  constructor() {
    super('Brak miejsca w przeglądarce. Zapisz ziny do plików .zin i usuń stare.');
    this.name = 'StorageFullError';
  }
}

export function openZiniarzDb(name = 'ziniarz'): Promise<ZiniarzDb> {
  return openDB<ZiniarzSchema>(name, 1, {
    upgrade(db) {
      db.createObjectStore('zines', { keyPath: 'id' });
      db.createObjectStore('images', { keyPath: 'id' });
      db.createObjectStore('fontFamilies', { keyPath: 'id' });
      db.createObjectStore('fontFiles', { keyPath: 'id' }).createIndex('byFamily', 'familyId');
    },
  });
}

async function guarded<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof DOMException && error.name === 'QuotaExceededError') throw new StorageFullError();
    throw error;
  }
}

export async function saveZine(db: ZiniarzDb, zine: Zine): Promise<void> {
  await guarded(() => db.put('zines', zine));
}

export function loadZine(db: ZiniarzDb, id: string): Promise<Zine | undefined> {
  return db.get('zines', id);
}

export function listZines(db: ZiniarzDb): Promise<Zine[]> {
  return db.getAll('zines');
}

export async function deleteZine(db: ZiniarzDb, id: string): Promise<void> {
  await db.delete('zines', id);
}

export async function putImage(db: ZiniarzDb, image: StoredImage): Promise<void> {
  await guarded(() => db.put('images', image));
}

export function getImage(db: ZiniarzDb, id: string): Promise<StoredImage | undefined> {
  return db.get('images', id);
}

export function listImageIds(db: ZiniarzDb): Promise<string[]> {
  return db.getAllKeys('images');
}

export async function deleteImages(db: ZiniarzDb, ids: string[]): Promise<void> {
  const tx = db.transaction('images', 'readwrite');
  await Promise.all([...ids.map((id) => tx.store.delete(id)), tx.done]);
}

export async function putFontFamily(db: ZiniarzDb, family: FontFamily): Promise<void> {
  await guarded(() => db.put('fontFamilies', family));
}

export function getFontFamily(db: ZiniarzDb, id: string): Promise<FontFamily | undefined> {
  return db.get('fontFamilies', id);
}

export async function putFontFile(db: ZiniarzDb, file: FontFile): Promise<void> {
  await guarded(() => db.put('fontFiles', file));
}

export function fontFilesOfFamily(db: ZiniarzDb, familyId: string): Promise<FontFile[]> {
  return db.getAllFromIndex('fontFiles', 'byFamily', familyId);
}

export function listFontFamilyIds(db: ZiniarzDb): Promise<string[]> {
  return db.getAllKeys('fontFamilies');
}

export async function deleteFontFamilies(db: ZiniarzDb, ids: string[]): Promise<void> {
  const tx = db.transaction(['fontFamilies', 'fontFiles'], 'readwrite');
  const files = tx.objectStore('fontFiles');
  const work: Promise<unknown>[] = [];
  for (const id of ids) {
    work.push(tx.objectStore('fontFamilies').delete(id));
    work.push(
      files.index('byFamily').getAllKeys(id).then((keys) => Promise.all(keys.map((key) => files.delete(key)))),
    );
  }
  await Promise.all([...work, tx.done]);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --project unit src/storage/db.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/storage
git commit -m "Add IndexedDB storage for zines, images and fonts"
```

---

### Task 9: Cleanup of unused assets

**Files:**
- Create: `src/storage/cleanup.ts`
- Test: `src/storage/cleanup.test.ts`

- [ ] **Step 1: Write the failing test `src/storage/cleanup.test.ts`**

```ts
import 'fake-indexeddb/auto';
import { expect, test } from 'vitest';
import { createPhotoElement, createZine } from '../model/factory';
import { newId } from '../model/ids';
import { pruneUnusedAssets, unusedAssets } from './cleanup';
import { listFontFamilyIds, listImageIds, openZiniarzDb, putFontFamily, putImage, saveZine } from './db';

test('unusedAssets finds images without photos and families on no font list', () => {
  const a = createZine('A', 1);
  a.spreads[1].elements.push(createPhotoElement('used'));
  a.fonts = ['kept'];
  expect(unusedAssets([a], ['used', 'orphan'], ['kept', 'unused'])).toEqual({
    images: ['orphan'],
    fontFamilies: ['unused'],
  });
});

test('pruneUnusedAssets deletes them from the database', async () => {
  const db = await openZiniarzDb(`test-${newId()}`);
  const zine = createZine('A', 1);
  zine.spreads[1].elements.push(createPhotoElement('used'));
  zine.fonts = ['kept'];
  await saveZine(db, zine);
  const data = new ArrayBuffer(1);
  await putImage(db, { id: 'used', mime: 'image/jpeg', width: 1, height: 1, data });
  await putImage(db, { id: 'orphan', mime: 'image/jpeg', width: 1, height: 1, data });
  await putFontFamily(db, { id: 'kept', name: 'K' });
  await putFontFamily(db, { id: 'unused', name: 'U' });

  expect(await pruneUnusedAssets(db)).toEqual({ images: 1, fontFamilies: 1 });
  expect(await listImageIds(db)).toEqual(['used']);
  expect(await listFontFamilyIds(db)).toEqual(['kept']);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --project unit src/storage/cleanup.test.ts`
Expected: FAIL, cannot resolve `./cleanup`.

- [ ] **Step 3: Write `src/storage/cleanup.ts`**

```ts
import { imageIdsOfZine } from '../model/queries';
import type { Zine } from '../model/types';
import { deleteFontFamilies, deleteImages, listFontFamilyIds, listImageIds, listZines, type ZiniarzDb } from './db';

export function unusedAssets(zines: Zine[], imageIds: string[], familyIds: string[]) {
  const usedImages = new Set(zines.flatMap((z) => [...imageIdsOfZine(z)]));
  const usedFamilies = new Set(zines.flatMap((z) => z.fonts));
  return {
    images: imageIds.filter((id) => !usedImages.has(id)),
    fontFamilies: familyIds.filter((id) => !usedFamilies.has(id)),
  };
}

/** Call only from the zine list screen, never while a zine is being edited. */
export async function pruneUnusedAssets(db: ZiniarzDb): Promise<{ images: number; fontFamilies: number }> {
  const unused = unusedAssets(await listZines(db), await listImageIds(db), await listFontFamilyIds(db));
  await deleteImages(db, unused.images);
  await deleteFontFamilies(db, unused.fontFamilies);
  return { images: unused.images.length, fontFamilies: unused.fontFamilies.length };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --project unit src/storage/cleanup.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/storage
git commit -m "Prune images and font families no zine uses"
```

---

### Task 10: `.zin` files

**Files:**
- Create: `src/storage/zinFile.ts`
- Test: `src/storage/zinFile.test.ts`

Zip layout: `manifest.json` (`{"kind":"ziniarz","version":1}`), `zine.json`, `images/index.json` (metadata), `images/<id>`, `fonts/index.json` (`{families, files}` metadata), `fonts/<fileId>`.

- [ ] **Step 1: Write the failing test `src/storage/zinFile.test.ts`**

```ts
import 'fake-indexeddb/auto';
import JSZip from 'jszip';
import { describe, expect, test } from 'vitest';
import { createPhotoElement, createZine } from '../model/factory';
import { newId } from '../model/ids';
import { getImage, loadZine, openZiniarzDb, putFontFamily, putFontFile, putImage, saveZine } from './db';
import { bundleFromDb, importBundle, readZin, writeZin, ZinFileError, type ZinBundle } from './zinFile';

function sampleBundle(): ZinBundle {
  const zine = createZine('Lato', 1);
  zine.spreads[1].elements.push(createPhotoElement('img'));
  zine.fonts = ['fam'];
  return {
    zine,
    images: [{ id: 'img', mime: 'image/png', width: 3, height: 2, data: new Uint8Array([9, 8, 7]).buffer }],
    fontFamilies: [{ id: 'fam', name: 'Grotesk' }],
    fontFiles: [{ id: 'ff', familyId: 'fam', bold: true, italic: false, mime: 'font/ttf', data: new Uint8Array([5]).buffer }],
  };
}

describe('writeZin / readZin', () => {
  test('round trip gives a new zine id and the same content', async () => {
    const bundle = sampleBundle();
    const read = await readZin(await writeZin(bundle));
    expect(read.zine.id).not.toBe(bundle.zine.id);
    expect({ ...read.zine, id: bundle.zine.id }).toEqual(bundle.zine);
    expect(read.images[0]).toMatchObject({ id: 'img', mime: 'image/png', width: 3, height: 2 });
    expect(new Uint8Array(read.images[0].data)).toEqual(new Uint8Array([9, 8, 7]));
    expect(read.fontFamilies).toEqual(bundle.fontFamilies);
    expect(read.fontFiles[0]).toMatchObject({ id: 'ff', familyId: 'fam', bold: true });
    expect(new Uint8Array(read.fontFiles[0].data)).toEqual(new Uint8Array([5]));
  });

  test('rejects data that is not a zip', async () => {
    await expect(readZin(new Uint8Array([1, 2, 3]))).rejects.toThrow(ZinFileError);
  });

  test('rejects a zip without zine.json', async () => {
    const zip = new JSZip();
    zip.file('manifest.json', JSON.stringify({ kind: 'ziniarz', version: 1 }));
    await expect(readZin(await zip.generateAsync({ type: 'uint8array' }))).rejects.toThrow(ZinFileError);
  });

  test('rejects a file with missing images', async () => {
    const bundle = { ...sampleBundle(), images: [] };
    await expect(readZin(await writeZin(bundle))).rejects.toThrow('brakuje zdjęć');
  });
});

describe('database bundles', () => {
  test('export from one database and import into another', async () => {
    const source = await openZiniarzDb(`test-${newId()}`);
    const bundle = sampleBundle();
    await saveZine(source, bundle.zine);
    await putImage(source, bundle.images[0]);
    await putFontFamily(source, bundle.fontFamilies[0]);
    await putFontFile(source, bundle.fontFiles[0]);

    const exported = await bundleFromDb(source, bundle.zine.id);
    const target = await openZiniarzDb(`test-${newId()}`);
    const imported = await importBundle(target, await readZin(await writeZin(exported)));

    expect(await loadZine(target, imported.id)).toEqual(imported);
    expect(await getImage(target, 'img')).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --project unit src/storage/zinFile.test.ts`
Expected: FAIL, cannot resolve `./zinFile`.

- [ ] **Step 3: Write `src/storage/zinFile.ts`**

```ts
import JSZip from 'jszip';
import { newId } from '../model/ids';
import { parseZine, ZineFormatError } from '../model/parse';
import { imageIdsOfZine } from '../model/queries';
import type { Zine } from '../model/types';
import {
  fontFilesOfFamily,
  getFontFamily,
  getImage,
  loadZine,
  putFontFamily,
  putFontFile,
  putImage,
  saveZine,
  type FontFamily,
  type FontFile,
  type StoredImage,
  type ZiniarzDb,
} from './db';

export class ZinFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ZinFileError';
  }
}

export interface ZinBundle {
  zine: Zine;
  images: StoredImage[];
  fontFamilies: FontFamily[];
  fontFiles: FontFile[];
}

const MANIFEST = { kind: 'ziniarz', version: 1 };
const withoutData = <T extends { data: ArrayBuffer }>({ data: _data, ...rest }: T) => rest;

export async function writeZin(bundle: ZinBundle): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file('manifest.json', JSON.stringify(MANIFEST));
  zip.file('zine.json', JSON.stringify(bundle.zine));
  zip.file('images/index.json', JSON.stringify(bundle.images.map(withoutData)));
  for (const image of bundle.images) zip.file(`images/${image.id}`, image.data);
  zip.file('fonts/index.json', JSON.stringify({ families: bundle.fontFamilies, files: bundle.fontFiles.map(withoutData) }));
  for (const file of bundle.fontFiles) zip.file(`fonts/${file.id}`, file.data);
  return zip.generateAsync({ type: 'uint8array' });
}

async function readJson(zip: JSZip, path: string): Promise<unknown> {
  const entry = zip.file(path);
  if (!entry) throw new ZinFileError('Plik zina jest niekompletny.');
  try {
    return JSON.parse(await entry.async('string'));
  } catch {
    throw new ZinFileError('Plik zina jest uszkodzony.');
  }
}

async function readBinary(zip: JSZip, path: string, missing: string): Promise<ArrayBuffer> {
  const entry = zip.file(path);
  if (!entry) throw new ZinFileError(missing);
  return entry.async('arraybuffer');
}

/** Reads a .zin file. The zine gets a new id, so importing never overwrites an existing zine. */
export async function readZin(data: Uint8Array | ArrayBuffer): Promise<ZinBundle> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(data);
  } catch {
    throw new ZinFileError('To nie jest plik zina.');
  }
  const manifest = (await readJson(zip, 'manifest.json')) as { kind?: unknown };
  if (manifest?.kind !== 'ziniarz') throw new ZinFileError('To nie jest plik zina.');

  let zine: Zine;
  try {
    zine = parseZine(await readJson(zip, 'zine.json'));
  } catch (error) {
    if (error instanceof ZineFormatError) throw new ZinFileError(error.message);
    throw error;
  }

  const imageMeta = (await readJson(zip, 'images/index.json')) as Omit<StoredImage, 'data'>[];
  const fontMeta = (await readJson(zip, 'fonts/index.json')) as {
    families: FontFamily[];
    files: Omit<FontFile, 'data'>[];
  };
  const listedImages = new Set(imageMeta.map((m) => m.id));
  for (const id of imageIdsOfZine(zine)) {
    if (!listedImages.has(id)) throw new ZinFileError('Plik zina jest niekompletny (brakuje zdjęć).');
  }

  const missing = 'Plik zina jest niekompletny.';
  const images = await Promise.all(
    imageMeta.map(async (m) => ({ ...m, data: await readBinary(zip, `images/${m.id}`, missing) })),
  );
  const fontFiles = await Promise.all(
    fontMeta.files.map(async (m) => ({ ...m, data: await readBinary(zip, `fonts/${m.id}`, missing) })),
  );
  return { zine: { ...zine, id: newId() }, images, fontFamilies: fontMeta.families, fontFiles };
}

export async function bundleFromDb(db: ZiniarzDb, zineId: string): Promise<ZinBundle> {
  const zine = await loadZine(db, zineId);
  if (!zine) throw new ZinFileError('Nie znaleziono zina.');
  const images: StoredImage[] = [];
  for (const id of imageIdsOfZine(zine)) {
    const image = await getImage(db, id);
    if (image) images.push(image);
  }
  const fontFamilies: FontFamily[] = [];
  const fontFiles: FontFile[] = [];
  for (const familyId of zine.fonts) {
    const family = await getFontFamily(db, familyId);
    if (!family) continue;
    fontFamilies.push(family);
    fontFiles.push(...(await fontFilesOfFamily(db, familyId)));
  }
  return { zine, images, fontFamilies, fontFiles };
}

export async function importBundle(db: ZiniarzDb, bundle: ZinBundle): Promise<Zine> {
  for (const image of bundle.images) await putImage(db, image);
  for (const family of bundle.fontFamilies) await putFontFamily(db, family);
  for (const file of bundle.fontFiles) await putFontFile(db, file);
  await saveZine(db, bundle.zine);
  return bundle.zine;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --project unit src/storage/zinFile.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the whole unit project and typecheck**

Run: `npm run test:unit && npm run typecheck`
Expected: all unit tests pass, typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add src/storage
git commit -m "Read and write .zin files and move zines between databases"
```

---

### Task 11: Image import (browser)

**Files:**
- Create: `src/images/prepareImage.ts`, `src/test/pixels.ts`
- Test: `src/images/prepareImage.browser.test.ts`

- [ ] **Step 1: Write test helpers `src/test/pixels.ts`**

```ts
export type Rgba = [number, number, number, number];

export function pixel(canvas: HTMLCanvasElement, x: number, y: number): Rgba {
  const data = canvas.getContext('2d')!.getImageData(Math.floor(x), Math.floor(y), 1, 1).data;
  return [data[0], data[1], data[2], data[3]];
}

export function expectColor(actual: Rgba, expected: [number, number, number], tolerance = 8): void {
  const ok = expected.every((value, i) => Math.abs(actual[i] - value) <= tolerance) && actual[3] > 250;
  if (!ok) throw new Error(`Expected rgb(${expected.join(',')}) but got rgba(${actual.join(',')})`);
}

export async function solidBitmap(width: number, height: number, color: string): Promise<ImageBitmap> {
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, width, height);
  return createImageBitmap(canvas);
}

/** Left half `left`, right half `right`. */
export async function splitBitmap(width: number, height: number, left: string, right: string): Promise<ImageBitmap> {
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = left;
  ctx.fillRect(0, 0, width / 2, height);
  ctx.fillStyle = right;
  ctx.fillRect(width / 2, 0, width / 2, height);
  return createImageBitmap(canvas);
}

export function hasDarkPixel(canvas: HTMLCanvasElement, x: number, y: number, width: number, height: number): boolean {
  const data = canvas.getContext('2d')!.getImageData(x, y, width, height).data;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] > 200 && data[i] < 100 && data[i + 1] < 100 && data[i + 2] < 100) return true;
  }
  return false;
}
```

- [ ] **Step 2: Write the failing test `src/images/prepareImage.browser.test.ts`**

```ts
import { expect, test } from 'vitest';
import { ImageImportError, MAX_IMAGE_SIDE, prepareImage } from './prepareImage';

async function imageBlob(width: number, height: number, type: string, transparentHalf = false): Promise<Blob> {
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#c00';
  ctx.fillRect(0, 0, width, height);
  if (transparentHalf) ctx.clearRect(width / 2, 0, width / 2, height);
  return canvas.convertToBlob({ type });
}

test('downscales large images to MAX_IMAGE_SIDE as JPEG', async () => {
  const image = await prepareImage(await imageBlob(5000, 2000, 'image/jpeg'), 'a');
  expect(image).toMatchObject({ id: 'a', mime: 'image/jpeg', width: MAX_IMAGE_SIDE, height: 1440 });
  expect(image.data.byteLength).toBeGreaterThan(0);
});

test('keeps small images at their size', async () => {
  const image = await prepareImage(await imageBlob(300, 200, 'image/jpeg'));
  expect([image.width, image.height]).toEqual([300, 200]);
});

test('keeps PNG only when the image has transparency', async () => {
  expect((await prepareImage(await imageBlob(100, 100, 'image/png', true))).mime).toBe('image/png');
  expect((await prepareImage(await imageBlob(100, 100, 'image/png'))).mime).toBe('image/jpeg');
});

test('rejects files that are not images', async () => {
  await expect(prepareImage(new Blob(['hello'], { type: 'text/plain' }))).rejects.toThrow(ImageImportError);
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run --project browser src/images/prepareImage.browser.test.ts`
Expected: FAIL, cannot resolve `./prepareImage`.

- [ ] **Step 4: Write `src/images/prepareImage.ts`**

```ts
import { newId } from '../model/ids';
import type { StoredImage } from '../storage/db';

/** About 300 dpi across a whole spread with bleed (302 mm). */
export const MAX_IMAGE_SIDE = 3600;
const JPEG_QUALITY = 0.92;

export class ImageImportError extends Error {
  constructor() {
    super('Ten plik nie jest obrazem.');
    this.name = 'ImageImportError';
  }
}

function hasTransparency(bitmap: ImageBitmap): boolean {
  const size = 256;
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0, size, size);
  const data = ctx.getImageData(0, 0, size, size).data;
  for (let i = 3; i < data.length; i += 4) if (data[i] < 255) return true;
  return false;
}

export async function prepareImage(file: Blob, id: string = newId()): Promise<StoredImage> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new ImageImportError();
  }
  try {
    const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, width, height);
    const mime = file.type !== 'image/jpeg' && hasTransparency(bitmap) ? 'image/png' : 'image/jpeg';
    const blob = await canvas.convertToBlob(mime === 'image/jpeg' ? { type: mime, quality: JPEG_QUALITY } : { type: mime });
    return { id, mime, width, height, data: await blob.arrayBuffer() };
  } finally {
    bitmap.close();
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run --project browser src/images/prepareImage.browser.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/images src/test
git commit -m "Downscale and encode imported images"
```

---

### Task 12: Font loading (browser)

**Files:**
- Create: `src/fonts/fontLoader.ts`
- Test: `src/fonts/fontLoader.browser.test.ts`

- [ ] **Step 1: Write the failing test `src/fonts/fontLoader.browser.test.ts`**

```ts
import interUrl from '@fontsource/inter/files/inter-latin-400-normal.woff2?url';
import { expect, test } from 'vitest';
import { createTextElement, createZine } from '../model/factory';
import { cssFontFamily, ensureFontsReady, FontImportError, konvaFontFamily, konvaFontStyle, registerFontFile } from './fontLoader';

test('font names', () => {
  expect(cssFontFamily('abc')).toBe('zf-abc');
  expect(konvaFontFamily('abc')).toBe('zf-abc, sans-serif');
  expect(konvaFontStyle({ bold: true, italic: true })).toBe('italic bold');
  expect(konvaFontStyle({ bold: false, italic: false })).toBe('normal');
});

test('registers a font file and makes it available', async () => {
  const data = await (await fetch(interUrl)).arrayBuffer();
  await registerFontFile({ id: 'inter-r', familyId: 'inter', bold: false, italic: false, mime: 'font/woff2', data });
  const zine = createZine('t', 1);
  zine.spreads[1].elements.push(createTextElement({ fontFamilyId: 'inter', text: 'A' }));
  await ensureFontsReady(zine);
  expect(document.fonts.check('16px "zf-inter"')).toBe(true);
});

test('rejects data that is not a font', async () => {
  const data = new TextEncoder().encode('not a font').buffer as ArrayBuffer;
  await expect(
    registerFontFile({ id: 'bad', familyId: 'bad', bold: false, italic: false, mime: 'font/ttf', data }),
  ).rejects.toThrow(FontImportError);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --project browser src/fonts/fontLoader.browser.test.ts`
Expected: FAIL, cannot resolve `./fontLoader`.

- [ ] **Step 3: Write `src/fonts/fontLoader.ts`**

```ts
import type { TextElement, Zine } from '../model/types';
import type { FontFile } from '../storage/db';

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

/** Waits until every font style used by the zine's texts is loaded (missing ones resolve empty). */
export async function ensureFontsReady(zine: Zine): Promise<void> {
  const specs = new Set<string>();
  for (const spread of zine.spreads) {
    for (const e of spread.elements) {
      if (e.kind !== 'text') continue;
      specs.add(`${e.italic ? 'italic ' : ''}${e.bold ? 'bold ' : ''}16px "${cssFontFamily(e.fontFamilyId)}"`);
    }
  }
  await Promise.all([...specs].map((spec) => document.fonts.load(spec)));
}

/** Registers every file of the zine's custom font families from the database. Call before rendering. */
export async function registerZineFonts(db: ZiniarzDb, zine: Zine): Promise<void> {
  for (const familyId of zine.fonts) {
    for (const file of await fontFilesOfFamily(db, familyId)) await registerFontFile(file);
  }
}
```

Also change the second import line of the file to:

```ts
import { fontFilesOfFamily, type FontFile, type ZiniarzDb } from '../storage/db';
```

And append this test to `src/fonts/fontLoader.browser.test.ts` (add `import { newId } from '../model/ids';` and `import { openZiniarzDb, putFontFamily, putFontFile } from '../storage/db';` to its imports; the browser has a real IndexedDB):

```ts
test('registerZineFonts loads the zine font families from the database', async () => {
  const db = await openZiniarzDb(`test-${newId()}`);
  const data = await (await fetch(interUrl)).arrayBuffer();
  await putFontFamily(db, { id: 'inter2', name: 'Inter' });
  await putFontFile(db, { id: 'inter2-r', familyId: 'inter2', bold: false, italic: false, mime: 'font/woff2', data });
  const zine = createZine('t', 1);
  zine.fonts = ['inter2'];
  await registerZineFonts(db, zine);
  expect(document.fonts.check('16px "zf-inter2"')).toBe(true);
});
```

and add `registerZineFonts` to the import from `./fontLoader`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --project browser src/fonts/fontLoader.browser.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/fonts
git commit -m "Register custom font files and wait for zine fonts"
```

---

### Task 13: The renderer (spread and page)

**Files:**
- Create: `src/render/assets.ts`, `src/render/konvaCanvas.ts`, `src/render/buildSpread.ts`, `src/render/renderPage.ts`, `src/render/canvasBytes.ts`
- Test: `src/render/renderPage.browser.test.ts`

- [ ] **Step 1: Write `src/render/assets.ts`**

```ts
import { imageIdsOfZine } from '../model/queries';
import type { Zine } from '../model/types';
import type { StoredImage } from '../storage/db';

export interface RenderAssets {
  images: Map<string, ImageBitmap>;
}

export async function loadRenderAssets(
  zine: Zine,
  getImage: (id: string) => Promise<StoredImage | undefined>,
): Promise<RenderAssets> {
  const images = new Map<string, ImageBitmap>();
  for (const id of imageIdsOfZine(zine)) {
    const image = await getImage(id);
    if (image) images.set(id, await createImageBitmap(new Blob([image.data], { type: image.mime })));
  }
  return { images };
}

export function releaseRenderAssets(assets: RenderAssets): void {
  for (const bitmap of assets.images.values()) bitmap.close();
  assets.images.clear();
}
```

- [ ] **Step 2: Write `src/render/konvaCanvas.ts`**

```ts
import Konva from 'konva';

/**
 * Draws Konva nodes into a new canvas of exactly width × height pixels.
 * Konva.pixelRatio is forced to 1 while the stage exists, so big export
 * canvases are not doubled on Retina screens.
 */
export function drawToCanvas(width: number, height: number, draw: (layer: Konva.Layer) => void): HTMLCanvasElement {
  const previous = Konva.pixelRatio;
  Konva.pixelRatio = 1;
  const stage = new Konva.Stage({ container: document.createElement('div'), width, height });
  try {
    const layer = new Konva.Layer({ listening: false });
    stage.add(layer);
    draw(layer);
    return stage.toCanvas({ pixelRatio: 1 });
  } finally {
    stage.destroy();
    Konva.pixelRatio = previous;
  }
}
```

- [ ] **Step 3: Write `src/render/buildSpread.ts`**

```ts
import Konva from 'konva';
import { konvaFontFamily, konvaFontStyle } from '../fonts/fontLoader';
import { BLEED, pageRect, pagesOfSpread, slotOfPage } from '../model/geometry';
import type { PhotoElement, TextElement, Zine } from '../model/types';
import type { RenderAssets } from './assets';
import { imagePlacement } from './photoGeometry';

export const PLACEHOLDER_COLOR = '#dddddd';

export function ptToMm(points: number): number {
  return (points * 25.4) / 72;
}

function photoNode(element: PhotoElement, assets: RenderAssets): Konva.Group {
  const { width, height } = element;
  const group = new Konva.Group({
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
  const fontSize = ptToMm(element.size);
  const text = new Konva.Text({
    text: element.text,
    width: element.width,
    fontFamily: konvaFontFamily(element.fontFamilyId),
    fontSize,
    fontStyle: konvaFontStyle(element),
    letterSpacing: (element.letterSpacing / 1000) * fontSize,
    lineHeight: element.lineHeight,
    fill: element.color,
    align: element.align,
    wrap: 'word',
  });
  const height = text.height();
  const group = new Konva.Group({
    x: element.x + element.width / 2,
    y: element.y + height / 2,
    offsetX: element.width / 2,
    offsetY: height / 2,
    rotation: element.rotation,
  });
  group.add(text);
  return group;
}

/** The single drawing of a spread, in spread millimetres (page backgrounds include bleed). */
export function buildSpreadGroup(zine: Zine, spreadIndex: number, assets: RenderAssets): Konva.Group {
  const group = new Konva.Group();
  for (const page of pagesOfSpread(spreadIndex, zine.sheets)) {
    const rect = pageRect(slotOfPage(page).side, BLEED);
    group.add(new Konva.Rect({ ...rect, fill: zine.pages[page]?.background ?? '#ffffff' }));
  }
  for (const element of zine.spreads[spreadIndex].elements) {
    group.add(element.kind === 'photo' ? photoNode(element, assets) : textNode(element));
  }
  return group;
}
```

- [ ] **Step 4: Write `src/render/renderPage.ts`**

```ts
import { BLEED, PAGE_HEIGHT, pageRect, slotOfPage, SPREAD_WIDTH, type Rect } from '../model/geometry';
import type { Zine } from '../model/types';
import type { RenderAssets } from './assets';
import { buildSpreadGroup } from './buildSpread';
import { drawToCanvas } from './konvaCanvas';

export interface RenderOptions {
  pxPerMm: number;
}

function renderRegion(zine: Zine, spread: number, assets: RenderAssets, region: Rect, pxPerMm: number) {
  return drawToCanvas(Math.round(region.width * pxPerMm), Math.round(region.height * pxPerMm), (layer) => {
    const group = buildSpreadGroup(zine, spread, assets);
    group.position({ x: -region.x * pxPerMm, y: -region.y * pxPerMm });
    group.scale({ x: pxPerMm, y: pxPerMm });
    layer.add(group);
  });
}

/** One page cut from its spread: bleed only on outer edges, a clean cut at the spine. */
export function renderPage(
  zine: Zine,
  page: number,
  assets: RenderAssets,
  options: RenderOptions & { bleed: boolean },
): HTMLCanvasElement {
  const { spread, side } = slotOfPage(page);
  return renderRegion(zine, spread, assets, pageRect(side, options.bleed ? BLEED : 0), options.pxPerMm);
}

/** Whole spread with bleed on all sides (thumbnails, editor background). */
export function renderSpread(zine: Zine, spread: number, assets: RenderAssets, options: RenderOptions): HTMLCanvasElement {
  const region = { x: -BLEED, y: -BLEED, width: SPREAD_WIDTH + 2 * BLEED, height: PAGE_HEIGHT + 2 * BLEED };
  return renderRegion(zine, spread, assets, region, options.pxPerMm);
}
```

- [ ] **Step 5: Write `src/render/canvasBytes.ts`**

```ts
export function canvasToBytes(
  canvas: HTMLCanvasElement,
  type: 'image/jpeg' | 'image/png',
  quality?: number,
): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) return reject(new Error('Canvas export failed'));
        blob.arrayBuffer().then((buffer) => resolve(new Uint8Array(buffer)), reject);
      },
      type,
      quality,
    );
  });
}

/** Frees the bitmap memory of a big canvas right away. */
export function releaseCanvas(canvas: HTMLCanvasElement): void {
  canvas.width = 0;
  canvas.height = 0;
}
```

- [ ] **Step 6: Write the failing test `src/render/renderPage.browser.test.ts`**

```ts
import { describe, expect, test } from 'vitest';
import { createPhotoElement, createTextElement, createZine } from '../model/factory';
import type { Zine } from '../model/types';
import { expectColor, hasDarkPixel, pixel, solidBitmap, splitBitmap } from '../test/pixels';
import type { RenderAssets } from './assets';
import { renderPage, renderSpread } from './renderPage';

const RED: [number, number, number] = [255, 0, 0];
const BLUE: [number, number, number] = [0, 0, 255];
const GREEN: [number, number, number] = [0, 255, 0];
const YELLOW: [number, number, number] = [255, 255, 0];
const PX = 2;

async function spinePhotoZine(): Promise<{ zine: Zine; assets: RenderAssets }> {
  const zine = createZine('t', 1);
  zine.pages[2] = { background: '#ff0000' };
  zine.pages[3] = { background: '#0000ff' };
  zine.spreads[1].elements.push(createPhotoElement('green', { x: 100, y: 50, width: 96, height: 100 }));
  return { zine, assets: { images: new Map([['green', await solidBitmap(100, 100, '#00ff00')]]) } };
}

describe('renderPage', () => {
  test('left page: bleed on the outer edge, photo cut at the spine', async () => {
    const { zine, assets } = await spinePhotoZine();
    const canvas = renderPage(zine, 2, assets, { pxPerMm: PX, bleed: true });
    expect([canvas.width, canvas.height]).toEqual([151 * PX, 216 * PX]);
    expectColor(pixel(canvas, 13 * PX, 13 * PX), RED);
    expectColor(pixel(canvas, 1, 1), RED);
    expectColor(pixel(canvas, 143 * PX, 103 * PX), GREEN);
  });

  test('right page continues the photo from the spine', async () => {
    const { zine, assets } = await spinePhotoZine();
    const canvas = renderPage(zine, 3, assets, { pxPerMm: PX, bleed: true });
    expectColor(pixel(canvas, 2 * PX, 103 * PX), GREEN);
    expectColor(pixel(canvas, 142 * PX, 13 * PX), BLUE);
    expectColor(pixel(canvas, canvas.width - 1, 13 * PX), BLUE);
  });

  test('without bleed the page is exactly A5', async () => {
    const { zine, assets } = await spinePhotoZine();
    const canvas = renderPage(zine, 2, assets, { pxPerMm: PX, bleed: false });
    expect([canvas.width, canvas.height]).toEqual([148 * PX, 210 * PX]);
    expectColor(pixel(canvas, 0, 0), RED);
  });

  test('flipX mirrors the photo', async () => {
    const zine = createZine('t', 1);
    const photo = createPhotoElement('split', { x: 20, y: 20, width: 50, height: 50 });
    zine.spreads[1].elements.push(photo);
    const assets = { images: new Map([['split', await splitBitmap(100, 100, '#00ff00', '#ffff00')]]) };
    expectColor(pixel(renderPage(zine, 2, assets, { pxPerMm: PX, bleed: false }), 25 * PX, 45 * PX), GREEN);
    photo.flipX = true;
    expectColor(pixel(renderPage(zine, 2, assets, { pxPerMm: PX, bleed: false }), 25 * PX, 45 * PX), YELLOW);
  });

  test('rotation turns the frame around its centre', async () => {
    const zine = createZine('t', 1);
    const photo = createPhotoElement('green', { x: 24, y: 95, width: 100, height: 20 });
    zine.spreads[1].elements.push(photo);
    const assets = { images: new Map([['green', await solidBitmap(100, 20, '#00ff00')]]) };
    expectColor(pixel(renderPage(zine, 2, assets, { pxPerMm: PX, bleed: false }), 74 * PX, 65 * PX), [255, 255, 255]);
    photo.rotation = 90;
    expectColor(pixel(renderPage(zine, 2, assets, { pxPerMm: PX, bleed: false }), 74 * PX, 65 * PX), GREEN);
  });

  test('missing image draws a grey placeholder', () => {
    const zine = createZine('t', 1);
    zine.spreads[1].elements.push(createPhotoElement('missing', { x: 20, y: 20, width: 50, height: 50 }));
    const canvas = renderPage(zine, 2, { images: new Map() }, { pxPerMm: PX, bleed: false });
    expectColor(pixel(canvas, 40 * PX, 40 * PX), [221, 221, 221]);
  });

  test('text is drawn inside its frame', () => {
    const zine = createZine('t', 1);
    zine.spreads[1].elements.push(createTextElement({ text: 'MMMM', size: 48, x: 20, y: 40, width: 100 }));
    const canvas = renderPage(zine, 2, { images: new Map() }, { pxPerMm: PX, bleed: false });
    expect(hasDarkPixel(canvas, 20 * PX, 40 * PX, 100 * PX, 30 * PX)).toBe(true);
    expect(hasDarkPixel(canvas, 20 * PX, 120 * PX, 100 * PX, 30 * PX)).toBe(false);
  });
});

test('renderSpread leaves the missing half of a cover spread empty', async () => {
  const zine = createZine('t', 1);
  zine.pages[1] = { background: '#ff0000' };
  const canvas = renderSpread(zine, 0, { images: new Map() }, { pxPerMm: PX });
  expect([canvas.width, canvas.height]).toEqual([302 * PX, 216 * PX]);
  expectColor(pixel(canvas, 203 * PX, 103 * PX), RED);
  expect(pixel(canvas, 50 * PX, 103 * PX)[3]).toBe(0);
});
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npx vitest run --project browser src/render/renderPage.browser.test.ts`
Expected: PASS. If the text test fails because Konva measured nothing, check that `konvaFontFamily` returns a family list ending in `sans-serif`.

- [ ] **Step 8: Commit**

```bash
git add src/render
git commit -m "Add the single Konva renderer for spreads and pages"
```

---

### Task 14: Sheet sides

**Files:**
- Create: `src/print/sheetSide.ts`
- Test: `src/print/sheetSide.browser.test.ts`

- [ ] **Step 1: Write the failing test `src/print/sheetSide.browser.test.ts`**

```ts
import { describe, expect, test } from 'vitest';
import { sheetSides } from '../imposition/imposition';
import { printLayout } from '../imposition/layout';
import { createZine } from '../model/factory';
import { expectColor, pixel } from '../test/pixels';
import { mmToPx, renderSheetSide } from './sheetSide';

const zine = createZine('t', 1);
zine.pages[1] = { background: '#ff0000' };
zine.pages[2] = { background: '#00ff00' };
zine.pages[3] = { background: '#0000ff' };
zine.pages[4] = { background: '#ffff00' };
const assets = { images: new Map() };
const [front, back] = sheetSides(1);
const layout = printLayout({ printerMargin: 4, bleed: true, cropMarks: true, foldMarks: true });
const marksOn = { cropMarks: true, foldMarks: true, rotate180: false };

describe('renderSheetSide', () => {
  test('front holds pages 4 | 1 on a white A4 sheet', () => {
    const dpi = 50;
    const k = mmToPx(dpi);
    const canvas = renderSheetSide(zine, front, assets, layout, { dpi, ...marksOn });
    expect([canvas.width, canvas.height]).toEqual([Math.round(297 * k), Math.round(210 * k)]);
    expectColor(pixel(canvas, 74 * k, 105 * k), [255, 255, 0]);
    expectColor(pixel(canvas, 223 * k, 105 * k), [255, 0, 0]);
    expectColor(pixel(canvas, 1, 1), [255, 255, 255]);
  });

  test('back holds pages 2 | 3, or 3 | 2 upside down when rotated', () => {
    const dpi = 50;
    const k = mmToPx(dpi);
    const plain = renderSheetSide(zine, back, assets, layout, { dpi, ...marksOn });
    expectColor(pixel(plain, 74 * k, 105 * k), [0, 255, 0]);
    expectColor(pixel(plain, 223 * k, 105 * k), [0, 0, 255]);
    const rotated = renderSheetSide(zine, back, assets, layout, { dpi, ...marksOn, rotate180: true });
    expectColor(pixel(rotated, 74 * k, 105 * k), [0, 0, 255]);
    expectColor(pixel(rotated, 223 * k, 105 * k), [0, 255, 0]);
  });

  test('draws crop and fold marks only when enabled', () => {
    const dpi = 300;
    const k = mmToPx(dpi);
    const cropProbe: [number, number] = [(layout.spread.x - layout.bleed - 3) * k, layout.spread.y * k];
    const foldProbe: [number, number] = [148.5 * k, (layout.spread.y - layout.bleed - 3) * k];
    const on = renderSheetSide(zine, front, assets, layout, { dpi, ...marksOn });
    expect(pixel(on, ...cropProbe)[0]).toBeLessThan(128);
    expect(pixel(on, ...foldProbe)[0]).toBeLessThan(128);
    const off = renderSheetSide(zine, front, assets, layout, { dpi, cropMarks: false, foldMarks: false, rotate180: false });
    expectColor(pixel(off, ...cropProbe), [255, 255, 255]);
    expectColor(pixel(off, ...foldProbe), [255, 255, 255]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --project browser src/print/sheetSide.browser.test.ts`
Expected: FAIL, cannot resolve `./sheetSide`.

- [ ] **Step 3: Write `src/print/sheetSide.ts`**

```ts
import type { SheetSide } from '../imposition/imposition';
import { A4_LANDSCAPE, type PrintLayout } from '../imposition/layout';
import { cropMarks, foldMarks, MARK_STROKE, type Segment } from '../imposition/marks';
import type { Zine } from '../model/types';
import type { RenderAssets } from '../render/assets';
import { releaseCanvas } from '../render/canvasBytes';
import { renderPage } from '../render/renderPage';

export const PRINT_DPI = 300;

export function mmToPx(dpi: number): number {
  return dpi / 25.4;
}

export interface SheetSideOptions {
  dpi: number;
  cropMarks: boolean;
  foldMarks: boolean;
  rotate180: boolean;
}

/** One side of an A4 landscape sheet: two pages from the imposition, scaled by the layout, plus marks. */
export function renderSheetSide(
  zine: Zine,
  side: SheetSide,
  assets: RenderAssets,
  layout: PrintLayout,
  options: SheetSideOptions,
): HTMLCanvasElement {
  const k = mmToPx(options.dpi);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(A4_LANDSCAPE.width * k);
  canvas.height = Math.round(A4_LANDSCAPE.height * k);
  const ctx = canvas.getContext('2d')!;
  if (options.rotate180) ctx.setTransform(-1, 0, 0, -1, canvas.width, canvas.height);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const pageOptions = { pxPerMm: k * layout.scale, bleed: layout.bleed > 0 };
  const top = (layout.spread.y - layout.bleed) * k;
  const placements: [number, number][] = [
    [side.left, (layout.spread.x - layout.bleed) * k],
    [side.right, (layout.spread.x + layout.trimPage.width) * k],
  ];
  for (const [page, left] of placements) {
    const pageCanvas = renderPage(zine, page, assets, pageOptions);
    ctx.drawImage(pageCanvas, left, top);
    releaseCanvas(pageCanvas);
  }

  const segments: Segment[] = [
    ...(options.cropMarks ? cropMarks(layout) : []),
    ...(options.foldMarks ? foldMarks(layout) : []),
  ];
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = MARK_STROKE * k;
  ctx.beginPath();
  for (const s of segments) {
    ctx.moveTo(s.x1 * k, s.y1 * k);
    ctx.lineTo(s.x2 * k, s.y2 * k);
  }
  ctx.stroke();
  return canvas;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --project browser src/print/sheetSide.browser.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/print
git commit -m "Render imposed sheet sides with marks and back rotation"
```

---

### Task 15: PDF export and test page

**Files:**
- Create: `src/print/fileName.ts`, `src/print/pdf.ts`, `src/print/testPage.ts`
- Test: `src/print/fileName.test.ts`, `src/print/pdf.browser.test.ts`

- [ ] **Step 1: Write the failing test `src/print/fileName.test.ts`**

```ts
import { expect, test } from 'vitest';
import { fileSlug } from './fileName';

test('fileSlug strips Polish letters and punctuation', () => {
  expect(fileSlug('Żółta łąka, część 2!')).toBe('zolta-laka-czesc-2');
  expect(fileSlug('   ')).toBe('zin');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --project unit src/print/fileName.test.ts`
Expected: FAIL, cannot resolve `./fileName`.

- [ ] **Step 3: Write `src/print/fileName.ts`**

```ts
export function fileSlug(title: string): string {
  const slug = title
    .replace(/ł/g, 'l')
    .replace(/Ł/g, 'L')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'zin';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --project unit src/print/fileName.test.ts`
Expected: PASS.

- [ ] **Step 5: Write `src/print/testPage.ts`**

```ts
import { createTextElement, createZine } from '../model/factory';
import { pageRect, PAGE_WIDTH, slotOfPage } from '../model/geometry';
import type { Zine } from '../model/types';

/**
 * One sheet (pages 1–4) with big page numbers and "↑ góra", on light grey pages so the
 * bleed is visible. Printed duplex and folded it must read 1, 2, 3, 4 the right way up.
 */
export function testPageZine(): Zine {
  const zine = createZine('Strona próbna', 1);
  for (let page = 1; page <= 4; page++) {
    zine.pages[page] = { background: '#e6e6e6' };
    const { spread, side } = slotOfPage(page);
    const left = pageRect(side, 0).x;
    zine.spreads[spread].elements.push(
      createTextElement({ text: `${page}\n↑ góra`, size: 72, align: 'center', x: left, y: 60, width: PAGE_WIDTH, lineHeight: 1 }),
    );
  }
  zine.spreads[0].elements.push(
    createTextElement({
      text: 'Tył do góry nogami? Włącz „Obróć tyły o 180°”.\nStrony 2 i 3 zamienione? Przełącz kolejność tyłów.',
      size: 9,
      align: 'center',
      x: PAGE_WIDTH + 10,
      y: 170,
      width: PAGE_WIDTH - 20,
    }),
  );
  return zine;
}
```

- [ ] **Step 6: Write the failing test `src/print/pdf.browser.test.ts`**

```ts
import { PDFDocument } from 'pdf-lib';
import { expect, test } from 'vitest';
import { createZine } from '../model/factory';
import { buildPagesPdf, buildSheetsPdf, MM_TO_PT } from './pdf';
import { testPageZine } from './testPage';

const assets = { images: new Map() };
const dpi = 30;

async function pagesOf(bytes: Uint8Array) {
  const pdf = await PDFDocument.load(bytes);
  return pdf.getPages().map((p) => p.getSize());
}

test('automatic duplex: one landscape A4 PDF, front and back of every sheet', async () => {
  const zine = createZine('Lato 2026', 5);
  const progress: number[] = [];
  const files = await buildSheetsPdf({ zine, assets, settings: zine.print, dpi, onProgress: (done) => progress.push(done) });
  expect(files.map((f) => f.name)).toEqual(['lato-2026-druk.pdf']);
  const sizes = await pagesOf(files[0].bytes);
  expect(sizes).toHaveLength(10);
  expect(sizes[0].width).toBeCloseTo(841.89, 1);
  expect(sizes[0].height).toBeCloseTo(595.28, 1);
  expect(progress).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
});

test('manual duplex: separate fronts and backs', async () => {
  const zine = createZine('Lato', 6);
  const files = await buildSheetsPdf({ zine, assets, settings: { ...zine.print, duplex: 'manual' }, dpi });
  expect(files.map((f) => f.name)).toEqual(['lato-przody.pdf', 'lato-tyly.pdf']);
  expect(await pagesOf(files[0].bytes)).toHaveLength(6);
  expect(await pagesOf(files[1].bytes)).toHaveLength(6);
});

test('pages PDF: A5 pages with outer bleed, in reading order', async () => {
  const zine = createZine('Lato', 5);
  const file = await buildPagesPdf({ zine, assets, bleed: true, dpi });
  expect(file.name).toBe('lato-strony.pdf');
  const sizes = await pagesOf(file.bytes);
  expect(sizes).toHaveLength(20);
  expect(sizes[0].width).toBeCloseTo(151 * MM_TO_PT, 1);
  expect(sizes[0].height).toBeCloseTo(216 * MM_TO_PT, 1);
});

test('test page prints as one sheet', async () => {
  const zine = testPageZine();
  const files = await buildSheetsPdf({ zine, assets, settings: zine.print, dpi });
  expect(await pagesOf(files[0].bytes)).toHaveLength(2);
});
```

- [ ] **Step 7: Run test to verify it fails**

Run: `npx vitest run --project browser src/print/pdf.browser.test.ts`
Expected: FAIL, cannot resolve `./pdf`.

- [ ] **Step 8: Write `src/print/pdf.ts`**

```ts
import { PDFDocument } from 'pdf-lib';
import { ensureFontsReady } from '../fonts/fontLoader';
import { sheetSides, type SheetSide } from '../imposition/imposition';
import { A4_LANDSCAPE, printLayout } from '../imposition/layout';
import { BLEED, PAGE_HEIGHT, PAGE_WIDTH, pageCount } from '../model/geometry';
import type { PrintSettings, Zine } from '../model/types';
import type { RenderAssets } from '../render/assets';
import { canvasToBytes, releaseCanvas } from '../render/canvasBytes';
import { renderPage } from '../render/renderPage';
import { fileSlug } from './fileName';
import { mmToPx, PRINT_DPI, renderSheetSide } from './sheetSide';

export const MM_TO_PT = 72 / 25.4;
const JPEG_QUALITY = 0.9;

export interface PdfFile {
  name: string;
  bytes: Uint8Array;
}

export interface SheetsPdfJob {
  zine: Zine;
  assets: RenderAssets;
  settings: PrintSettings;
  dpi?: number;
  onProgress?: (done: number, total: number) => void;
}

/** Imposed sheets for home duplex printing. Sheets are rendered one at a time to keep memory low. */
export async function buildSheetsPdf(job: SheetsPdfJob): Promise<PdfFile[]> {
  const { zine, assets, settings } = job;
  const dpi = job.dpi ?? PRINT_DPI;
  await ensureFontsReady(zine);
  const layout = printLayout(settings);
  const sides = sheetSides(zine.sheets);
  const backs = sides.filter((s) => s.face === 'back');
  const groups: { suffix: string; sides: SheetSide[] }[] =
    settings.duplex === 'auto'
      ? [{ suffix: 'druk', sides }]
      : [
          { suffix: 'przody', sides: sides.filter((s) => s.face === 'front') },
          { suffix: 'tyly', sides: settings.manualReverseBacks ? [...backs].reverse() : backs },
        ];

  const width = A4_LANDSCAPE.width * MM_TO_PT;
  const height = A4_LANDSCAPE.height * MM_TO_PT;
  let done = 0;
  const files: PdfFile[] = [];
  for (const group of groups) {
    const pdf = await PDFDocument.create();
    pdf.setTitle(zine.title);
    for (const side of group.sides) {
      const canvas = renderSheetSide(zine, side, assets, layout, {
        dpi,
        cropMarks: settings.cropMarks,
        foldMarks: settings.foldMarks,
        rotate180: settings.rotateBacks && side.face === 'back',
      });
      const image = await pdf.embedJpg(await canvasToBytes(canvas, 'image/jpeg', JPEG_QUALITY));
      releaseCanvas(canvas);
      pdf.addPage([width, height]).drawImage(image, { x: 0, y: 0, width, height });
      job.onProgress?.(++done, sides.length);
    }
    files.push({ name: `${fileSlug(zine.title)}-${group.suffix}.pdf`, bytes: await pdf.save() });
  }
  return files;
}

export interface PagesPdfJob {
  zine: Zine;
  assets: RenderAssets;
  bleed: boolean;
  dpi?: number;
  onProgress?: (done: number, total: number) => void;
}

/** A5 pages in reading order, unscaled, for review or sending. */
export async function buildPagesPdf(job: PagesPdfJob): Promise<PdfFile> {
  const { zine, assets } = job;
  const dpi = job.dpi ?? PRINT_DPI;
  await ensureFontsReady(zine);
  const bleed = job.bleed ? BLEED : 0;
  const width = (PAGE_WIDTH + bleed) * MM_TO_PT;
  const height = (PAGE_HEIGHT + 2 * bleed) * MM_TO_PT;
  const total = pageCount(zine.sheets);
  const pdf = await PDFDocument.create();
  pdf.setTitle(zine.title);
  for (let page = 1; page <= total; page++) {
    const canvas = renderPage(zine, page, assets, { pxPerMm: mmToPx(dpi), bleed: job.bleed });
    const image = await pdf.embedJpg(await canvasToBytes(canvas, 'image/jpeg', JPEG_QUALITY));
    releaseCanvas(canvas);
    pdf.addPage([width, height]).drawImage(image, { x: 0, y: 0, width, height });
    job.onProgress?.(page, total);
  }
  return { name: `${fileSlug(zine.title)}-strony.pdf`, bytes: await pdf.save() };
}
```

Note: `printLayout(settings)` works because `PrintSettings` has every field of `PrintLayoutOptions`.

- [ ] **Step 9: Run test to verify it passes**

Run: `npx vitest run --project browser src/print/pdf.browser.test.ts`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add src/print
git commit -m "Export imposed sheet PDFs, page PDFs and the duplex test page"
```

---

### Task 16: Sample renders, project docs, final check

**Files:**
- Create: `src/print/samples.browser.test.ts`, `CLAUDE.md`
- Delete: `src/smoke.test.ts`, `src/smoke.browser.test.ts`

- [ ] **Step 1: Write `src/print/samples.browser.test.ts`**

This test writes files to look at by eye (not compared automatically).

```ts
import { commands } from '@vitest/browser/context';
import { test } from 'vitest';
import { sheetSides } from '../imposition/imposition';
import { printLayout } from '../imposition/layout';
import { createPhotoElement, createTextElement, createZine } from '../model/factory';
import { canvasToBytes } from '../render/canvasBytes';
import { buildSheetsPdf } from './pdf';
import { renderSheetSide } from './sheetSide';
import { testPageZine } from './testPage';

const OUT = '../../test-output';

function base64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

async function gradientBitmap(): Promise<ImageBitmap> {
  const canvas = new OffscreenCanvas(1200, 800);
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createLinearGradient(0, 0, 1200, 800);
  gradient.addColorStop(0, '#ff5f6d');
  gradient.addColorStop(1, '#6a5acd');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1200, 800);
  return createImageBitmap(canvas);
}

test('write sample sheets and PDFs to test-output/', { timeout: 120_000 }, async () => {
  const zine = createZine('Próbka', 5);
  zine.pages[1] = { background: '#e8e2ff' };
  zine.spreads[0].elements.push(
    createTextElement({ text: 'PRÓBKA', size: 40, bold: true, x: 178, y: 30, width: 88, align: 'center', letterSpacing: 80 }),
  );
  zine.spreads[5].elements.push(
    createPhotoElement('g', { x: 40, y: 40, width: 216, height: 130 }),
    createTextElement({ text: 'Zdjęcie przez grzbiet, strony 10 i 11', size: 11, x: 30, y: 180, width: 88 }),
  );
  const assets = { images: new Map([['g', await gradientBitmap()]]) };

  const layout = printLayout(zine.print);
  for (const side of sheetSides(zine.sheets)) {
    const canvas = renderSheetSide(zine, side, assets, layout, { dpi: 100, cropMarks: true, foldMarks: true, rotate180: false });
    const name = `sheet-${side.sheet + 1}-${side.face}.png`;
    await commands.writeFile(`${OUT}/${name}`, base64(await canvasToBytes(canvas, 'image/png')), { encoding: 'base64' });
  }
  for (const file of await buildSheetsPdf({ zine, assets, settings: zine.print, dpi: 150 })) {
    await commands.writeFile(`${OUT}/${file.name}`, base64(file.bytes), { encoding: 'base64' });
  }
  const probe = testPageZine();
  for (const file of await buildSheetsPdf({ zine: probe, assets: { images: new Map() }, settings: probe.print, dpi: 150 })) {
    await commands.writeFile(`${OUT}/${file.name}`, base64(file.bytes), { encoding: 'base64' });
  }
});
```

- [ ] **Step 2: Run it and look at the output**

Run: `npx vitest run --project browser src/print/samples.browser.test.ts && ls test-output`
Expected: PASS; `test-output/` holds `sheet-1-front.png` … `sheet-5-back.png`, `probka-druk.pdf`, `strona-probna-druk.pdf`.

Open `test-output/sheet-5-front.png` and `sheet-5-back.png`: sheet 5 is the centre (pages 12 | 9 front, 10 | 11 back). The back must show the gradient photo crossing the centre fold, cut cleanly at the fold, with bleed on the outer edges and crop marks at the four outer corners. Open `strona-probna-druk.pdf`: front shows 4 | 1, back 2 | 3, all upright.

- [ ] **Step 3: Remove the smoke tests**

```bash
git rm src/smoke.test.ts src/smoke.browser.test.ts
```

- [ ] **Step 4: Write `CLAUDE.md`**

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

- `npm run test:unit`: czysta logika w Node. `npm run test:browser`: render, fonty, PDF w Chromium (Vitest browser mode).
- `test-output/`: próbne arkusze PNG i PDF z `src/print/samples.browser.test.ts` do obejrzenia.

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
````

- [ ] **Step 5: Run everything**

Run: `npm test && npm run typecheck && npm run build`
Expected: all unit and browser tests pass, typecheck clean, `vite build` writes `dist/`.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Add sample renders and project CLAUDE.md"
```
