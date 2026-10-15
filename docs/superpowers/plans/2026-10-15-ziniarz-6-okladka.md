# ZINIARZ, plan 6: okładka w całości Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the front and back cover one editable spread "Okładka" (back cover P on the left, front cover 1 on the right), so photos and texts can wrap around the spine; old zines are merged into the new layout when opened.

**Architecture:** Spread 0 becomes the outside cover; the separate last "Tył" spread disappears (`spreadCount = 2 · sheets`). Only the page numbering in `src/model/geometry.ts` knows about it (`pageAt`, `slotOfPage` take `sheets`; a new `sideOfPage` serves callers that only need the side). Raw format-2 data is merged by a new pure `mergeCovers` (`src/model/migrate.ts`, `FORMAT_VERSION` 3) inside `parseZine`. Printing and 3D render per page, so they follow the numbering without changes; the editor loses the grey "missing page" shade and gains "tył" / "przód" captions under the cover.

**Tech Stack:** Vite 7, React 19, TypeScript, Konva, Zustand, Vitest 3.2 (unit in Node, browser in Chromium), Playwright.

**Spec:** `docs/superpowers/specs/2026-10-15-ziniarz-okladka-design.md` (amends `2026-10-14-ziniarz-design.md` in its A6 form). Read it before starting. Earlier plans: 1 core, 2 editor, 3 print and 3D, 4 hosting, 5 A6.

## Decisions

- **`sideOfPage(page)`** (even page → `left`, odd → `right`) is new. Callers that only need the side (`buildSpread.ts`, `guides.ts`, `snapping.ts`, `placement.ts` `insertArea`, `pagesOfFrame`) use it instead of `slotOfPage(page).side`. The spec allows passing `sheets` mechanically instead; parity gives the same answer (P is even, so the back cover is `left`) with fewer changed signatures.
- **`slotOfPage(page, sheets)` and `pageAt(spread, side, sheets)`** take the sheet count, because the back cover P sits on spread 0.
- **`pagesOfSpread(spread, sheets)`** always returns `[left, right]`; every spread has two existing pages now.
- **`activePage` after "± kartka"** = `pageAt(moved, sideOfPage(activePage), next.sheets)`. `sideOfPage(activePage)` equals the spec's `slotOfPage(activePage, previous sheets).side` and needs no sheet count at all.
- **Cover captions** are an HTML overlay (`CoverCaptions.tsx`) placed from the `Viewport`, like `TextEditor`: under the bottom bleed edge, centred under each half. Never in the shared renderer.
- **3D caption:** `spreadCaption` in `book.ts` gets its own numbering by reading position and stops importing `spreadLabel`.
- **Old fixtures in tests:** tests that fake format 1 or 2 data from `createZine` (which now has `2 · sheets` spreads) append an empty back spread, so the data has the old shape.
- **Render references stay identical until Task 6.** Task 2 only moves the sample's back-cover text from `spreads[6]` to `spreads[0]` at the same coordinates (same pixels). Task 6 adds the wrapping photo and refreshes the references on purpose.
- **Nothing is pushed.** Pushing to `main` publishes the site; the owner decides (final task ends with local commits).

**Conventions for every task:**
- Repo root: `~/projects/ziniarz`, branch `main`.
- Code, comments and commit messages in English; UI texts, README, `CLAUDE.md` and specs in Polish.
- Every commit message ends with a blank line and `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Stage only the files you changed (`git add <paths>`), never `git add -A` (`test-output/` exists locally).
- Test commands: one file with `npx vitest run <path>`; all unit tests `npm run test:unit`; all browser tests `npm run test:browser` (Chromium, ~2 min); types `npm run typecheck`.
- Never delete an assertion or loosen a tolerance to make a test pass. If a test's idea no longer fits (e.g. "the missing page is grey"), rewrite it to check what the new layout promises.

---

## File structure

```
src/model/migrate.ts                     mergeCovers + COVER_FORMAT_VERSION (modify)
src/model/migrate.test.ts                mergeCovers tests (modify)
src/model/geometry.ts                    cover numbering, sideOfPage (modify)
src/model/geometry.test.ts               numbering tests (modify)
src/model/factory.ts                     FORMAT_VERSION 3 (modify)
src/model/parse.ts                       runs mergeCovers for version < 3 (modify)
src/model/parse.test.ts                  old-layout fixtures, merge tests (modify)
src/model/sheets.test.ts                 covers kept with the new layout (modify)
src/render/buildSpread.ts                sideOfPage (modify)
src/render/guides.ts                     sideOfPage; missing-page shade removed (modify)
src/render/renderPage.ts                 slotOfPage with sheets; shadeMissing removed (modify)
src/render/renderPage.browser.test.ts    whole cover spread drawn (modify)
src/editor/geometry/placement.ts         pageAtPoint/defaultPage/insertArea (modify)
src/editor/geometry/placement.test.ts    cover cases (modify)
src/editor/geometry/snapping.ts          sideOfPage (modify)
src/editor/spreadLabels.ts               no "Tył" (modify)
src/editor/spreadLabels.test.ts          (modify)
src/editor/state/store.ts                activePage after ± kartka (modify)
src/editor/state/store.test.ts           (modify)
src/editor/useSpreadThumbnails.ts        no shadeMissing (modify)
src/editor/canvas/EditorStage.ts         no missing-page shade (modify)
src/editor/canvas/EditorStage.browser.test.ts  (modify)
src/editor/canvas/CoverCaptions.tsx      "tył" / "przód" under the cover (create)
src/editor/canvas/CoverCaptions.browser.test.tsx  (create)
src/editor/canvas/SpreadCanvas.tsx       shows CoverCaptions on spread 0 (modify)
src/app/app.css                          .cover-caption (modify)
src/editor/SpreadList.browser.test.tsx   no "Tył" thumbnail (modify)
src/editor/insert.browser.test.ts        "+ Napis" on the cover (modify)
src/preview3d/book.ts                    own reading caption (modify)
src/print/testPage.ts, testPage.test.ts  slotOfPage with sheets (modify)
src/print/sheetSide.browser.test.ts      wrapping cover photo prints in one piece (modify)
src/print/screen/PrintScreen.browser.test.tsx, src/storage/zinFile.test.ts  old fixtures (modify)
src/test/sampleZine.ts                   back cover on spread 0, wrapping photo (modify)
src/print/__reference__/*.png            refreshed in Task 6 (modify)
CLAUDE.md, docs/superpowers/specs/2026-10-14-ziniarz-design.md, README.md   docs (modify)
```

---

### Task 1: `mergeCovers` (pure, not wired yet)

**Files:**
- Modify: `src/model/migrate.ts` (append)
- Test: `src/model/migrate.test.ts` (append)

- [ ] **Step 1: Write the failing tests**

Append to `src/model/migrate.test.ts` (and add `mergeCovers` to the import from `./migrate`):

```ts
describe('mergeCovers', () => {
  const v2 = (sheets: number, spreads: unknown[]) => ({ formatVersion: 2, id: 'z', sheets, spreads });
  const front = { kind: 'text', id: 'f', x: 120, y: 10, width: 50, text: 'przód' };
  const back = { kind: 'text', id: 'b', x: 20, y: 10, width: 50, text: 'tył' };
  const inside = { kind: 'text', id: 'i', x: 20, y: 10, width: 50, text: 'środek' };

  test('the back cover joins spread 0 under the front cover; the last spread goes', () => {
    const input = v2(1, [
      { id: 's0', elements: [front] },
      { id: 's1', elements: [inside] },
      { id: 's2', elements: [back] },
    ]);
    const before = JSON.stringify(input);
    const out = mergeCovers(input)!;
    expect(JSON.stringify(input)).toBe(before);
    expect(out.formatVersion).toBe(3);
    expect(out.spreads).toEqual([
      { id: 's0', elements: [back, front] },
      { id: 's1', elements: [inside] },
    ]);
  });

  test('works for any sheet count', () => {
    const spreads = Array.from({ length: 11 }, (_, i) => ({ id: `s${i}`, elements: [] as unknown[] }));
    spreads[10].elements.push(back);
    const out = mergeCovers(v2(5, spreads))!.spreads as { id: string; elements: unknown[] }[];
    expect(out).toHaveLength(10);
    expect(out[0]).toEqual({ id: 's0', elements: [back] });
    expect(out.map((s) => s.id)).toEqual(['s0', 's1', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 's9']);
  });

  test('data of the wrong shape gives null, so parseZine rejects it whole', () => {
    // 2 spreads for 1 sheet would look like a valid format-3 zine if it were passed on.
    expect(mergeCovers(v2(1, [{ id: 's0', elements: [] }, { id: 's1', elements: [] }]))).toBeNull();
    expect(mergeCovers(v2(1, [{ id: 's0', elements: [] }, { id: 's1', elements: [] }, { id: 's2' }]))).toBeNull();
    expect(mergeCovers({ formatVersion: 2, id: 'z', spreads: [] })).toBeNull();
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/model/migrate.test.ts`
Expected: FAIL, `mergeCovers` is not exported.

- [ ] **Step 3: Implement**

Append to `src/model/migrate.ts`:

```ts
/** Format version whose spread 0 is the whole outside cover (back cover left, front cover right). */
export const COVER_FORMAT_VERSION = 3;

/**
 * Raw data of format 2 (covers on separate spreads: 2 · sheets + 1 spreads) turned into format 3:
 * the last spread's elements join spread 0, under the front cover's. Coordinates stay, since the
 * back cover already lay on the left half and the front cover on the right. Data without that
 * shape gives null, and parseZine rejects it as broken: passed on, 2 · sheets spreads would
 * look like a valid format-3 zine. Never changes its input.
 */
export function mergeCovers(raw: Obj): Obj | null {
  const spreads = raw.spreads;
  if (!isNum(raw.sheets) || !Array.isArray(spreads) || spreads.length !== 2 * raw.sheets + 1) return null;
  const front = spreads[0];
  const back = spreads[spreads.length - 1];
  if (!isObj(front) || !isObj(back) || !Array.isArray(front.elements) || !Array.isArray(back.elements)) return null;
  return {
    ...raw,
    formatVersion: COVER_FORMAT_VERSION,
    spreads: [{ ...front, elements: [...back.elements, ...front.elements] }, ...spreads.slice(1, -1)],
  };
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/model/migrate.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/model/migrate.ts src/model/migrate.test.ts
git commit -m "Add mergeCovers to join the front and back cover spreads

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Cover numbering in the model, wired through `parseZine`

After this task `npm run typecheck` and the tests in `src/model`, `src/print` and `src/storage` are green. Still red until later tasks, and only these: `placement.test.ts`, `store.test.ts`, `spreadLabels.test.ts`, `renderPage.browser.test.ts`, `EditorStage.browser.test.ts`, `SpreadList.browser.test.tsx` (fixed in Task 3) and `book.test.ts` (fixed in Task 5). Any other red test is a mistake in this task.

**Files:**
- Modify: `src/model/geometry.ts`, `src/model/geometry.test.ts`
- Modify: `src/model/factory.ts`, `src/model/parse.ts`, `src/model/parse.test.ts`
- Modify: `src/model/sheets.test.ts`
- Modify (mechanical): `src/render/buildSpread.ts`, `src/render/guides.ts`, `src/render/renderPage.ts`, `src/editor/geometry/placement.ts`, `src/editor/geometry/snapping.ts`, `src/editor/spreadLabels.ts`, `src/print/testPage.ts`, `src/print/testPage.test.ts`
- Modify: `src/test/sampleZine.ts`, `src/print/screen/PrintScreen.browser.test.tsx`, `src/storage/zinFile.test.ts`

- [ ] **Step 1: Write the failing geometry tests**

In `src/model/geometry.test.ts` add `sideOfPage` to the import and replace the whole `describe('numbering', …)` block with:

```ts
describe('numbering', () => {
  test('counts pages and spreads', () => {
    expect(pageCount(5)).toBe(20);
    expect(spreadCount(5)).toBe(10);
  });

  test('spread 0 is the outside cover: back cover left, front cover right', () => {
    expect(pagesOfSpread(0, 5)).toEqual([20, 1]);
    expect(pagesOfSpread(3, 5)).toEqual([6, 7]);
    expect(pagesOfSpread(9, 5)).toEqual([18, 19]);
    expect(slotOfPage(1, 5)).toEqual({ spread: 0, side: 'right' });
    expect(slotOfPage(20, 5)).toEqual({ spread: 0, side: 'left' });
    expect(slotOfPage(2, 5)).toEqual({ spread: 1, side: 'left' });
    expect(slotOfPage(19, 5)).toEqual({ spread: 9, side: 'right' });
  });

  test('every page sits on exactly one spread slot, both ways', () => {
    for (let sheets = 1; sheets <= 6; sheets++) {
      const all = Array.from({ length: spreadCount(sheets) }, (_, s) => pagesOfSpread(s, sheets)).flat();
      expect([...all].sort((a, b) => a - b)).toEqual(Array.from({ length: pageCount(sheets) }, (_, i) => i + 1));
      for (let page = 1; page <= pageCount(sheets); page++) {
        const { spread, side } = slotOfPage(page, sheets);
        expect(pageAt(spread, side, sheets)).toBe(page);
        expect(sideOfPage(page)).toBe(side);
      }
    }
  });

  test('pages 0 and P + 1 do not exist', () => {
    expect(pageExists(0, 5)).toBe(false);
    expect(pageExists(21, 5)).toBe(false);
  });
});
```

In the same file, in `assigns a frame to the pages it overlaps`, replace the two spread-0 lines with:

```ts
    expect(pagesOfFrame(0, frame(10, 50, 80, 50), 5)).toEqual([20]);
    expect(pagesOfFrame(0, frame(100, 50, 100, 50), 5)).toEqual([20, 1]);
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/model/geometry.test.ts`
Expected: FAIL (`sideOfPage` missing, `spreadCount(5)` is 11, `pagesOfSpread(0, 5)` is `[1]`).

- [ ] **Step 3: Change the numbering in `src/model/geometry.ts`**

Replace `spreadCount`, `slotOfPage`, `pageAt` and `pagesOfSpread` with the following, add `sideOfPage`, and in `pagesOfFrame` replace `pageRect(slotOfPage(page).side, 0)` with `pageRect(sideOfPage(page), 0)`:

```ts
/** Spread 0 is the outside cover; spreads 1 … 2 · sheets − 1 are the inside pages. */
export function spreadCount(sheets: number): number {
  return sheets * 2;
}

/** Side of its spread a page sits on: even pages on the left (the back cover P too), odd on the right. */
export function sideOfPage(page: number): Side {
  return page % 2 === 0 ? 'left' : 'right';
}

/** Spread 0 holds the back cover P (left) and the front cover 1 (right); spread i ≥ 1 holds 2i | 2i + 1. */
export function slotOfPage(page: number, sheets: number): PageSlot {
  return { spread: page === pageCount(sheets) ? 0 : Math.floor(page / 2), side: sideOfPage(page) };
}

export function pageAt(spread: number, side: Side, sheets: number): number {
  if (spread === 0 && side === 'left') return pageCount(sheets);
  return spread * 2 + (side === 'left' ? 0 : 1);
}

/** Both pages of a spread, left first. Every spread has two. */
export function pagesOfSpread(spread: number, sheets: number): number[] {
  return [pageAt(spread, 'left', sheets), pageAt(spread, 'right', sheets)];
}
```

Run: `npx vitest run src/model/geometry.test.ts`
Expected: PASS.

- [ ] **Step 4: Update the callers so the types check**

Run: `npm run typecheck` and fix every error with these rules (all are mechanical):

- `src/render/buildSpread.ts`: `pageRect(slotOfPage(page).side, BLEED)` → `pageRect(sideOfPage(page), BLEED)`; import `sideOfPage` instead of `slotOfPage`.
- `src/render/guides.ts`: in `buildGuidesGroup`, `const side = slotOfPage(page).side;` → `const side = sideOfPage(page);`. In `buildMissingPagesShade`, `pageAt(spread, side)` → `pageAt(spread, side, zine.sheets)` (the function is removed in Task 3; keep it compiling for now). Fix the imports.
- `src/render/renderPage.ts`: `slotOfPage(page)` → `slotOfPage(page, zine.sheets)`.
- `src/editor/geometry/snapping.ts`: `const side = slotOfPage(page).side;` → `const side = sideOfPage(page);`; fix the import.
- `src/editor/geometry/placement.ts`: `pageAt(spread, x < PAGE_WIDTH ? 'left' : 'right')` → `pageAt(spread, x < PAGE_WIDTH ? 'left' : 'right', sheets)`; in `insertArea`, `slotOfPage(page).side` → `sideOfPage(page)`; fix the imports. Also change `defaultPage` now (its body becomes `return Math.min(...pagesOfSpread(spread, sheets));`), otherwise `pagesOfSpread(0, …)[0]` is the back cover and the editor tests that add a text on the cover (`EditorScreen`, `TextEditor`, `panels`) would put it on the wrong page. The rest of placement comes in Task 3.
- `src/editor/spreadLabels.ts`: every `pageAt(x, side)` → `pageAt(x, side, sheets)` (in `thumbnailKey` use `zine.sheets`). (The "Tył" removal comes in Task 3.)
- `src/print/testPage.ts`: `slotOfPage(page)` → `slotOfPage(page, SHEETS)`.
- `src/print/testPage.test.ts`: `slotOfPage(page)` → `slotOfPage(page, zine.sheets)`.
- Any other `slotOfPage(p)` / `pageAt(s, side)` the type checker reports: pass the zine's `sheets`, or use `sideOfPage(p)` when only `.side` is read.

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 5: Write the failing parse tests**

In `src/model/parse.test.ts`:

1. Below `roundTrip`, add:

```ts
/** Raw data in the layout of formats 1 and 2: the back cover on its own spread at the end. */
const oldLayout = <T extends { spreads: unknown[] }>(raw: T): T => ({ ...raw, spreads: [...raw.spreads, { id: 'back', elements: [] }] });
```

2. Wrap the raw data of the tests that pretend to be format 1 in `oldLayout(...)`:
   - `fills missing optional fields with defaults`: `const raw = oldLayout(roundTrip(createZine('Lato', 2)));`
   - `opens an A5 zine (format 1) converted to A6`: `const raw = oldLayout(roundTrip(createZine('Stary', 1)));`
   - `a zine without a version is an A5 zine`: `const raw = oldLayout(roundTrip(createZine('Stary', 1)));`

3. Rename `an A6 zine (format 2) is not converted again` to `a current zine (format 3) is not converted again` (body unchanged).

4. In `imageIdsOfZine lists photos of all spreads`, use `createZine('Lato', 2)` (one sheet has only spreads 0 and 1 now).

5. Add these tests inside `describe('parseZine', …)`:

```ts
  test('a format-2 zine gets one cover spread: the back cover under the front cover', () => {
    const raw = oldLayout(roundTrip(createZine('Stary', 1)));
    raw.formatVersion = 2;
    raw.spreads[0].elements = [{ kind: 'text', id: 'f', x: 120, y: 10, width: 50, height: 0, rotation: 0, text: 'przód' }];
    raw.spreads[1].elements = [{ kind: 'text', id: 'i', x: 20, y: 10, width: 50, height: 0, rotation: 0, text: 'środek' }];
    raw.spreads[2].elements = [{ kind: 'text', id: 'b', x: 20, y: 10, width: 50, height: 0, rotation: 0, text: 'tył' }];
    const zine = parseZine(raw);
    expect(zine.formatVersion).toBe(FORMAT_VERSION);
    expect(zine.spreads).toHaveLength(2);
    expect(zine.spreads[0].elements.map((e) => [e.id, e.x])).toEqual([['b', 20], ['f', 120]]);
    expect(zine.spreads[1].elements.map((e) => e.id)).toEqual(['i']);
    expect(parseZine(roundTrip(zine))).toEqual(zine);
  });

  test('a format-1 zine goes A5 → A6 → one cover spread', () => {
    const raw = oldLayout(roundTrip(createZine('Stary', 1)));
    raw.formatVersion = 1;
    raw.spreads[2].elements = [{ kind: 'text', id: 'b', x: 148, y: 0, width: 0, height: 0, rotation: 0, text: 'tył' }];
    const zine = parseZine(raw);
    expect(zine.spreads).toHaveLength(2);
    expect(zine.spreads[0].elements[0].x).toBeCloseTo(105, 9);
  });

  test('a format-2 zine with the wrong number of spreads is broken, not half merged', () => {
    const raw = roundTrip(createZine('Stary', 2)); // 4 spreads; format 2 needs 5
    raw.formatVersion = 2;
    expect(() => parseZine(raw)).toThrow(ZineFormatError);
  });

  test('the format version is the one that merges covers', () => {
    expect(FORMAT_VERSION).toBe(COVER_FORMAT_VERSION);
  });
```

and add `import { COVER_FORMAT_VERSION } from './migrate';`.

- [ ] **Step 6: Run them to see them fail**

Run: `npx vitest run src/model/parse.test.ts`
Expected: FAIL (format-2 data is rejected as broken, `FORMAT_VERSION` is 2).

- [ ] **Step 7: Wire the merge**

`src/model/factory.ts`: `export const FORMAT_VERSION = 3;`

`src/model/parse.ts`: import `COVER_FORMAT_VERSION, mergeCovers` from `./migrate` and replace

```ts
  // Format 1 had A5 pages; everything after this line reads A6 mm.
  const data = version < A6_FORMAT_VERSION ? migrateA5ToA6(input) : input;
```

with

```ts
  // Format 1 had A5 pages; format 2 kept the covers on separate spreads. After this: format 3.
  const a6 = version < A6_FORMAT_VERSION ? migrateA5ToA6(input) : input;
  const data = version < COVER_FORMAT_VERSION ? mergeCovers(a6) : a6;
  if (!data) throw invalid();
```

Run: `npx vitest run src/model/parse.test.ts src/model/migrate.test.ts`
Expected: PASS.

- [ ] **Step 8: Update `src/model/sheets.test.ts` to the new layout**

`addSheet`/`removeSheet` do not change; their tests named the old last spread (the separate back cover). Change exactly these:

- `adds four pages`: `expect(zine.spreads).toHaveLength(12);`
- `keeps covers and inside covers in place for every current spread` (addSheet): replace the loop body with

```ts
    for (let sheets = 2; sheets <= 6; sheets++) {
      const lastBefore = pageCount(sheets) / 2 - 1;
      for (let current = 0; current <= lastBefore; current++) {
        const before = marked(sheets);
        before.pages[pageCount(sheets)] = { background: 'back' };
        const zine = addSheet(before, current);
        const last = pageCount(zine.sheets) / 2 - 1;
        expect(zine.spreads).toHaveLength(2 * zine.sheets);
        expect(label(zine, 0)).toBe('s0');
        expect(label(zine, 1)).toBe('s1');
        expect(label(zine, last)).toBe(`s${lastBefore}`);
        expect(zine.pages[pageCount(zine.sheets)]).toEqual({ background: 'back' });
      }
    }
```

- `with one sheet inserts after spread 1`: `expect([0, 1, 2, 3].map((i) => label(zine, i))).toEqual(['s0', 's1', '', '']);`
- `clamps the current spread to 1..P/2 - 2`: replace the last two lines with

```ts
    const last = addSheet(marked(5), 9);
    expect([8, 9, 10, 11].map((i) => label(last, i))).toEqual(['s8', '', '', 's9']);
```

- `removes the current spread and the next one`: `expect(zine.spreads.map((_, i) => label(zine, i))).toEqual(['s0', 's1', 's2', 's3', 's6', 's7', 's8', 's9']);`
- `keeps covers and inside covers for 3+ sheets` (removeSheet): same shape as the addSheet loop above, with `removeSheet` and `sheets` from 3 to 6.
- `with two sheets removes spreads 2 and 3`: `expect(zine.spreads.map((_, i) => label(zine, i))).toEqual(['s0', 's1']);`
- `with two sheets always removes spreads 2 and 3, whatever is current`: loop `current <= 3`.
- `clamps the current spread to 2..P/2 - 3 for 3+ sheets`: the second line becomes `expect(sheetRemoval(createZine('t', 5), 9)!.spreads).toEqual([7, 8]);`

Run: `npx vitest run src/model/sheets.test.ts`
Expected: PASS.

- [ ] **Step 9: Keep the sample zine and old-format fixtures working**

`src/test/sampleZine.ts`: the back cover is now the left half of spread 0. Replace

```ts
  // Back cover (page 12, left half of the last spread).
  zine.spreads[6].elements.push(
```

with

```ts
  // Back cover (page 12, left half of spread 0, the outside cover).
  zine.spreads[0].elements.push(
```

and change the cover comment `// Cover (page 1, right half of spread 0).` to `// Front cover (page 1, right half of spread 0).` Coordinates stay, so the render references do not change.

`src/print/screen/PrintScreen.browser.test.tsx`, test `an old A5 zine is stored converted to A6, exactly once`: give the fake format-1 data the old layout and expect the current version:

```ts
    spreads: [
      ...fresh.spreads.map((spread, i) =>
        i === 1 ? { ...spread, elements: [createTextElement({ x: 148, y: 30, width: 148, text: 'A' })] } : spread,
      ),
      { id: 'back', elements: [] },
    ],
```

and replace both `expect(first.formatVersion).toBe(2);` and `expect(second.formatVersion).toBe(2);` with `toBe(FORMAT_VERSION)` (import it from `../../model/factory`). After `const first = await stored();` add `expect(first.spreads).toHaveLength(2);` (merged once, stored merged). Update the comment "it is already version 2" to "it is already the current version", and after `const second = await stored();` add `expect(second.spreads).toHaveLength(2);`.

`src/storage/zinFile.test.ts`, test `an old A5 .zin file opens as A6`: same change. Append `{ id: 'back', elements: [createTextElement({ x: 20, y: 10, width: 50, text: 'tył' })] }` after the mapped spreads, use `expect(read.zine.formatVersion).toBe(FORMAT_VERSION);` (import from `../model/factory`), and add:

```ts
    expect(read.zine.spreads).toHaveLength(2 * bundle.zine.sheets);
    expect(read.zine.spreads[0].elements.some((e) => e.kind === 'text' && e.text === 'tył')).toBe(true);
```

- [ ] **Step 10: Run the model, print and storage tests**

Run: `npm run typecheck && npx vitest run src/model src/print/testPage.test.ts src/storage`
Expected: PASS.

Run: `npx vitest run src/print/reference.browser.test.ts src/print/screen/PrintScreen.browser.test.tsx src/storage/zinFile.test.ts`
Expected: PASS (references unchanged).

Run: `npx vitest run src/editor/EditorScreen.browser.test.tsx src/editor/canvas/TextEditor.browser.test.tsx src/editor/panels src/editor/insert.browser.test.ts`
Expected: PASS (a new text on the cover still lands on the front).

- [ ] **Step 11: Commit**

```bash
git add src/model src/render/buildSpread.ts src/render/guides.ts src/render/renderPage.ts \
  src/editor/geometry/placement.ts src/editor/geometry/snapping.ts src/editor/spreadLabels.ts \
  src/print/testPage.ts src/print/testPage.test.ts src/test/sampleZine.ts \
  src/print/screen/PrintScreen.browser.test.tsx src/storage/zinFile.test.ts
git commit -m "Number spread 0 as the whole outside cover and merge old covers

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Editor on the new layout

**Files:**
- Modify: `src/editor/geometry/placement.ts`, `src/editor/geometry/placement.test.ts`
- Modify: `src/editor/state/store.ts`, `src/editor/state/store.test.ts`
- Modify: `src/editor/spreadLabels.ts`, `src/editor/spreadLabels.test.ts`
- Modify: `src/render/guides.ts`, `src/render/renderPage.ts`, `src/render/renderPage.browser.test.ts`
- Modify: `src/editor/canvas/EditorStage.ts`, `src/editor/canvas/EditorStage.browser.test.ts`
- Modify: `src/editor/useSpreadThumbnails.ts`, `src/editor/SpreadList.browser.test.tsx`, `src/editor/insert.browser.test.ts`

- [ ] **Step 1: Write the failing unit tests**

`src/editor/geometry/placement.test.ts`:

```ts
test('pageAtPoint finds the page, bleed included; on the cover the left half is the back cover', () => {
  expect(pageAtPoint(1, 1, 10, 100)).toBe(2);
  expect(pageAtPoint(1, 1, 200, 100)).toBe(3);
  expect(pageAtPoint(1, 1, -2, PAGE_HEIGHT + 2)).toBe(2);
  expect(pageAtPoint(1, 1, 10, PAGE_HEIGHT + 10)).toBeNull();
  expect(pageAtPoint(0, 1, 10, 100)).toBe(4);
  expect(pageAtPoint(0, 1, 200, 100)).toBe(1);
});

test('defaultPage is the lower page number: the front on the cover, else the left page', () => {
  expect(defaultPage(0, 2)).toBe(1);
  expect(defaultPage(2, 2)).toBe(4);
  expect(defaultPage(3, 2)).toBe(6);
});
```

(replacing the two old tests of those names).

`src/editor/spreadLabels.test.ts`: replace `spread labels` with

```ts
test('spread labels: the cover is one spread, there is no separate back', () => {
  expect([0, 1, 2, 3].map((i) => spreadLabel(i, 2))).toEqual(['Okładka', '2–3', '4–5', '6–7']);
  expect([0, 1, 3].map((i) => spreadName(i, 2))).toEqual(['Okładka', 'Strony 2–3', 'Strony 6–7']);
});
```

and append to the thumbnail key test:

```ts
  const cover = thumbnailKey(zine, 0, 0);
  expect(thumbnailKey({ ...zine, pages: { 8: { background: '#000' } } }, 0, 0)).not.toBe(cover);
  expect(thumbnailKey({ ...zine, pages: { 1: { background: '#000' } } }, 0, 0)).not.toBe(cover);
  expect(thumbnailKey({ ...zine, pages: { 2: { background: '#000' } } }, 0, 0)).toBe(cover);
```

`src/editor/state/store.test.ts`:

- `setSpread clamps…`: expect `spread: 3` (2 sheets have spreads 0…3).
- `removing a sheet keeps the current spread index valid; undo brings it back`: `s().setSpread(3);` and after `removeSheet` `expect(s().spread).toBe(1);`.
- Replace `adding a sheet on the back cover keeps showing the back cover` with:

```ts
test('a clicked back cover stays the back cover when a sheet is added or removed', () => {
  const { s, zine } = setup(2);
  s().clickPage(8);
  s().addSheet();
  expect(zine().sheets).toBe(3);
  expect(s()).toMatchObject({ spread: 0, activePage: 12 });
  s().removeSheet();
  s().removeSheet();
  expect(zine().sheets).toBe(1);
  expect(s()).toMatchObject({ spread: 0, activePage: 4 });
});

test('a clicked front cover stays page 1', () => {
  const { s } = setup(2);
  s().clickPage(1);
  s().addSheet();
  expect(s()).toMatchObject({ spread: 0, activePage: 1 });
});

test('a clicked inside page moves with its spread', () => {
  const { s } = setup(3);
  s().setSpread(5);
  s().clickPage(11);
  s().removeSheet();
  expect(s()).toMatchObject({ spread: 3, activePage: 7 });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/editor/geometry/placement.test.ts src/editor/spreadLabels.test.ts src/editor/state/store.test.ts`
Expected: FAIL (`pageAtPoint(0, 1, 10, 100)` is null, "Tył" label on spread 3, back cover `activePage` stays 8). The `defaultPage` test already passes since Task 2.

- [ ] **Step 3: Implement placement, labels and the store**

`src/editor/geometry/placement.ts`:

```ts
/** The page under a point in spread mm (the bleed counts as the page), or null outside the spread. */
export function pageAtPoint(spread: number, sheets: number, x: number, y: number): number | null {
  if (x < -BLEED || x > SPREAD_WIDTH + BLEED || y < -BLEED || y > PAGE_HEIGHT + BLEED) return null;
  return pageAt(spread, x < PAGE_WIDTH ? 'left' : 'right', sheets);
}

/** Where "+ Zdjęcie" and "+ Napis" go when no page was clicked: the lower page number, so the front on the cover. */
export function defaultPage(spread: number, sheets: number): number {
  return Math.min(...pagesOfSpread(spread, sheets));
}
```

(`defaultPage` is already like this since Task 2; only the comment may need updating.) Drop the now unused `pageExists` import.

`src/editor/spreadLabels.ts`:

```ts
import { pageAt } from '../model/geometry';
import type { Zine } from '../model/types';

export function spreadLabel(spread: number, sheets: number): string {
  if (spread === 0) return 'Okładka';
  return `${pageAt(spread, 'left', sheets)}–${pageAt(spread, 'right', sheets)}`;
}

/** Accessible name of a spread thumbnail: "Okładka", "Strony 2–3". */
export function spreadName(spread: number, sheets: number): string {
  return spread === 0 ? 'Okładka' : `Strony ${spreadLabel(spread, sheets)}`;
}
```

(`removalMessage` and `thumbnailKey` stay; `thumbnailKey` already uses `pageAt(…, zine.sheets)` from Task 2.)

`src/editor/state/store.ts`: import `pageAt, sideOfPage, spreadCount` from `../../model/geometry`, and replace `changeSheets` with:

```ts
    /**
     * Adds or removes a sheet and keeps showing the current spread's content where it moved, with the
     * clicked page on the same side (the back cover keeps being the back cover, renumbered P ± 4).
     */
    const changeSheets = (change: (zine: Zine, spread: number) => Zine) => {
      const { history, spread, activePage } = get();
      const next = change(history.present, spread);
      if (next === history.present) return;
      const moved = next.spreads.indexOf(history.present.spreads[spread]);
      if (moved < 0) settle(record(history, next));
      else settle(record(history, next), moved, activePage === null ? null : pageAt(moved, sideOfPage(activePage), next.sheets));
    };
```

Run: `npx vitest run src/editor/geometry/placement.test.ts src/editor/spreadLabels.test.ts src/editor/state/store.test.ts`
Expected: PASS.

- [ ] **Step 4: Rewrite the browser tests for the missing-page shade**

`src/render/renderPage.browser.test.ts`:
- Delete the test `shadeMissing greys out the part of an element on the missing page`.
- Replace `renderSpread leaves the missing half of a cover spread empty` with:

```ts
test('renderSpread draws the whole cover: back cover left, front cover right', () => {
  const zine = createZine('t', 1);
  zine.pages[1] = { background: '#ff0000' };
  zine.pages[4] = { background: '#0000ff' };
  const canvas = renderSpread(zine, 0, { images: new Map() }, { pxPerMm: PX });
  expect([canvas.width, canvas.height]).toEqual([(SPREAD_WIDTH + 6) * PX, (PAGE_HEIGHT + 6) * PX]);
  expectColor(pixel(canvas, 203 * PX, 103 * PX), RED);
  expectColor(pixel(canvas, 50 * PX, 103 * PX), BLUE);
});
```

`src/editor/canvas/EditorStage.browser.test.ts`: replace `guides follow the switch; the missing page next to a cover is shaded` with:

```ts
test('guides follow the switch; the cover has guides on both pages and nothing greyed out', () => {
  const { zine } = sample();
  const { editor, view } = mount(zine);
  expect(editor.stage.find('.guide-margin')).toHaveLength(2);
  editor.update({ ...view, spread: 0 });
  expect(editor.stage.find('.guide-margin')).toHaveLength(2);
  expect(editor.stage.find('.missing-page')).toHaveLength(0);
  editor.update({ ...view, showGuides: false, spread: 0 });
  expect(editor.stage.find('.guide-margin')).toHaveLength(0);
});
```

`src/editor/SpreadList.browser.test.tsx`:
- `const labels = ['Okładka', 'Strony 2–3', 'Strony 4–5', 'Strony 6–7'];`
- thumbnails: `.toBe(4)`
- after the label loop add `await expect.element(list.getByRole('button', { name: 'Tył' })).not.toBeInTheDocument();`

`src/editor/insert.browser.test.ts`, append:

```ts
test('on the cover "+ Napis" goes to the front, or to the back cover once it was clicked', async () => {
  const { store } = await setup();
  store.getState().setSpread(0);
  insertText(store);
  expect(selectedElement(store.getState())).toMatchObject({ text: 'Napis', x: RIGHT_MARGIN_X });
  store.getState().clickPage(4);
  insertText(store);
  expect(selectedElement(store.getState())).toMatchObject({ text: 'Napis', x: LEFT_MARGIN_X });
});
```

- [ ] **Step 5: Run them to see them fail**

Run: `npx vitest run src/render/renderPage.browser.test.ts src/editor/canvas/EditorStage.browser.test.ts src/editor/SpreadList.browser.test.tsx src/editor/insert.browser.test.ts`
Expected: these may already pass, because the model changed in Task 2 (`buildMissingPagesShade` finds page P on the cover's left and draws nothing). That is fine: they pin the new behaviour, and Step 6 removes the dead code.

- [ ] **Step 6: Remove the missing-page shade**

- `src/render/guides.ts`: delete `MISSING_PAGE_COLOR`, `FAR`, `missingSideRect` and `buildMissingPagesShade`, and drop the imports they alone used (`pageAt`, `pageExists`, `Side`, `Rect` if unused).
- `src/render/renderPage.ts`: delete the `shadeMissing` option and its line in `renderSpread`, and drop `buildMissingPagesShade` from the import. Update the doc comment of `renderSpread` to "Whole spread with bleed on all sides (thumbnails), optionally with guides."
- `src/editor/canvas/EditorStage.ts`: delete `this.decorations.add(buildMissingPagesShade(view.zine, view.spread));` and the import; in the layer comment drop "shade"; change the `pageUnderPointer` comment to "The page under the pointer, or null outside the spread."
- `src/editor/useSpreadThumbnails.ts`: `renderSpread(zine, spread, assets, { pxPerMm: THUMB_PX_PER_MM })`.

Run: `npm run typecheck && npx vitest run src/render src/editor`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/editor src/render
git commit -m "Edit the cover as one spread: no separate back, no greyed page

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: "tył" and "przód" under the cover

**Files:**
- Create: `src/editor/canvas/CoverCaptions.tsx`, `src/editor/canvas/CoverCaptions.browser.test.tsx`
- Modify: `src/editor/canvas/SpreadCanvas.tsx`, `src/app/app.css`

- [ ] **Step 1: Write the failing test**

`src/editor/canvas/CoverCaptions.browser.test.tsx`:

```tsx
import { expect, test } from 'vitest';
import '../../app/app.css';
import { createZine } from '../../model/factory';
import { openInEditor } from '../../test/editorHarness';

test('the cover says which half is the back and which the front; other spreads do not', async () => {
  const { screen } = await openInEditor(createZine('Lato', 2));
  const back = screen.getByText('tył', { exact: true });
  const front = screen.getByText('przód', { exact: true });
  await expect.element(back).toBeVisible();
  await expect.element(front).toBeVisible();
  const backBox = back.element().getBoundingClientRect();
  const frontBox = front.element().getBoundingClientRect();
  expect(backBox.right).toBeLessThan(frontBox.left);
  // Below the spread with its bleed, inside the canvas area.
  const stage = document.querySelector('.spread-stage')!.getBoundingClientRect();
  expect(backBox.bottom).toBeLessThanOrEqual(stage.bottom);

  await screen.getByRole('navigation', { name: 'Rozkładówki' }).getByRole('button', { name: 'Strony 2–3' }).click();
  await expect.element(screen.getByText('tył', { exact: true })).not.toBeInTheDocument();
  await expect.element(screen.getByText('przód', { exact: true })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/editor/canvas/CoverCaptions.browser.test.tsx`
Expected: FAIL, no "tył" text.

- [ ] **Step 3: Implement**

`src/editor/canvas/CoverCaptions.tsx`:

```tsx
import { BLEED, PAGE_HEIGHT, PAGE_WIDTH } from '../../model/geometry';
import type { Viewport } from './EditorStage';

/** Gap between the bottom bleed edge and the captions, px. Fits in STAGE_PADDING_PX with a 12 px font. */
const GAP_PX = 4;

/** "tył" and "przód" under the halves of the cover spread. Editor only: never drawn by the renderer. */
export function CoverCaptions({ viewport }: { viewport: Viewport }) {
  const { scale, originX, originY } = viewport;
  const top = originY + (PAGE_HEIGHT + BLEED) * scale + GAP_PX;
  return (
    <>
      <span className="cover-caption" style={{ left: originX + (PAGE_WIDTH / 2) * scale, top }}>
        tył
      </span>
      <span className="cover-caption" style={{ left: originX + PAGE_WIDTH * 1.5 * scale, top }}>
        przód
      </span>
    </>
  );
}
```

`src/editor/canvas/SpreadCanvas.tsx`: import `CoverCaptions` and render it next to the text editor:

```tsx
      <div ref={host} className="spread-stage" />
      {spread === 0 && viewport && <CoverCaptions viewport={viewport} />}
      {mode === 'text' && viewport && <TextEditor viewport={viewport} />}
```

`src/app/app.css`, after the `.spread-canvas, .spread-stage` rule:

```css
.cover-caption {
  position: absolute;
  transform: translateX(-50%);
  font-size: 12px;
  line-height: 1;
  color: var(--muted);
  pointer-events: none;
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/editor/canvas`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/editor/canvas/CoverCaptions.tsx src/editor/canvas/CoverCaptions.browser.test.tsx src/editor/canvas/SpreadCanvas.tsx src/app/app.css
git commit -m "Label the halves of the cover spread as back and front

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: 3D caption by reading position

**Files:**
- Modify: `src/preview3d/book.ts`
- Test: `src/preview3d/book.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/preview3d/book.test.ts`:

```ts
test('captions follow the reader: front cover, page pairs, back cover', () => {
  expect([0, 1, 2, 3, 4].map((turned) => spreadCaption(turned, 2))).toEqual([
    'Okładka',
    'Strony 2–3',
    'Strony 4–5',
    'Strony 6–7',
    'Tył',
  ]);
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/preview3d/book.test.ts`
Expected: FAIL. After Task 3, `spreadLabel(0, 2)` is "Okładka" and `spreadLabel(4, 2)` gives "8–9", so `turned` 4 is captioned "Strony 8–9".

- [ ] **Step 3: Implement**

In `src/preview3d/book.ts` delete `import { spreadLabel } from '../editor/spreadLabels';` and replace `spreadCaption` with:

```ts
/** What the reader sees with `turned` leaves turned: the front cover, two pages, or the back cover. */
export function spreadCaption(turned: number, sheets: number): string {
  if (turned === 0) return 'Okładka';
  if (turned === leafCount(sheets)) return 'Tył';
  return `Strony ${2 * turned}–${2 * turned + 1}`;
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/preview3d`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/preview3d/book.ts src/preview3d/book.test.ts
git commit -m "Caption the 3D preview by reading position, not editor spreads

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: A photo wrapping around the cover prints in one piece

**Files:**
- Modify: `src/print/sheetSide.browser.test.ts`
- Modify: `src/test/sampleZine.ts`
- Modify: `src/print/__reference__/*.png` (refreshed)

- [ ] **Step 1: Add the print test**

In `src/print/sheetSide.browser.test.ts`, inside `describe('renderSheetSide at the fold', …)`, append:

```ts
  test('a photo wrapping around the cover prints in one piece on the front of sheet 1', async () => {
    const wrap = createZine('t', 1);
    wrap.spreads[0].elements.push(createPhotoElement('dark', { x: -3, y: -3, width: SPREAD_WIDTH + 6, height: PAGE_HEIGHT + 6 }));
    const darkAssets = { images: new Map([['dark', await solidBitmap(64, 64, '#202020')]]) };
    const dpi = 150;
    const k = mmToPx(dpi);
    for (const l of layouts) {
      const canvas = renderSheetSide(wrap, front, darkAssets, l, { dpi, cropMarks: true, foldMarks: true, rotate180: false });
      const spine = l.spread.x + l.spread.width / 2;
      for (const x of [l.spread.x + PAGE_WIDTH / 2, spine, l.spread.x + l.spread.width - PAGE_WIDTH / 2]) {
        expectColor(pixel(canvas, x * k, 105 * k), [32, 32, 32]);
      }
    }
  });
```

Run: `npx vitest run src/print/sheetSide.browser.test.ts`
Expected: PASS. The test checks behaviour that Task 2 already gives, so it should pass without code changes. If it fails, stop and debug with superpowers:systematic-debugging; do not change the test.

- [ ] **Step 2: Add the wrapping photo to the sample zine**

In `src/test/sampleZine.ts`, add to the docblock: "a photo wrapping around the cover from the back to the front". Then push the wrapping photo first in the spread-0 back-cover block, so it lies under the "koniec" text:

```ts
  // Back cover (page 12, left half of spread 0, the outside cover), and a photo wrapping
  // around the spine from the back cover to the front, bleeding off the bottom.
  zine.spreads[0].elements.push(
    createPhotoElement('p', { x: 52.5, y: 130, width: 105, height: 21, crop: { offsetX: 0, offsetY: 0, zoom: 1.2 } }),
    createTextElement({ text: 'koniec', size: 17, x: 21.3, y: 67, width: 62.4, align: 'center', color: '#ffffff' }),
  );
```

(The front cover's texts end above y ≈ 125, so the strip at y 130…151 does not cover them.)

- [ ] **Step 3: See the reference test fail on the cover only**

Run: `npx vitest run src/print/reference.browser.test.ts`
Expected: FAIL only for the front of sheet 1 (the outside cover); every other sheet side passes. Look at `test-output/reference/*.diff.png`: the red difference is only the strip at the bottom across the spine.

- [ ] **Step 4: Refresh the references on purpose and look at them**

Run: `npm run test:update-references`
Then open `src/print/__reference__/sheet-1-front.png`. Check that the photo strip runs from the back cover (left) across the spine into the front cover (right), with no white strip at the spine, that it reaches into the bottom bleed, and that the crop marks sit in the corners. Check that `git status` shows only that one PNG changed. If other PNGs show as modified, compare their pixels (not bytes) with the old ones; commit only the cover PNG unless the pixels of others really differ, and then stop and find out why.

Run: `npx vitest run src/print/reference.browser.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/print/sheetSide.browser.test.ts src/test/sampleZine.ts src/print/__reference__/sheet-1-front.png
git commit -m "Wrap a sample photo around the cover and refresh its reference

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Documentation

**Files:**
- Modify: `CLAUDE.md`, `docs/superpowers/specs/2026-10-14-ziniarz-design.md`, `README.md`

- [ ] **Step 1: `CLAUDE.md`**

- Paragraph 1 (spec list): add `okładka w całości: 2026-10-15-ziniarz-okladka-design.md` next to the A6 spec.
- Structure table, `src/render/`: "prowadnice i wyszarzenie brakującej strony (`guides.ts`)" → "prowadnice (`guides.ts`)". `src/editor/canvas/`: add "podpisy „tył” i „przód” pod okładką (`CoverCaptions.tsx`)".
- Invariant **Rozkładówka `i`**: replace with: "**Rozkładówka 0 to cała okładka od zewnątrz:** lewa strona `P` (tył), prawa `1` (przód). Rozkładówka `i ≥ 1` ma strony `2i` (lewa) i `2i + 1` (prawa); rozkładówek jest `2 · sheets`, każda ma dwie strony. Numerację znają tylko `pageAt`, `slotOfPage` (biorą liczbę kartek) i `sideOfPage` (`geometry.ts`). Element należy do rozkładówki i może leżeć przez grzbiet, także na okładce."
- **Stan edytora**: append "Po „± kartka” kliknięta strona zostaje po tej samej stronie rozkładówki (`activePage` przez `pageAt`), więc kliknięty tył okładki zostaje tyłem."
- **Kompatybilność danych**: add after the A6 sentence: "`FORMAT_VERSION` 3 = okładka w jednej rozkładówce; wersja 2 i starsze mają osobną ostatnią rozkładówkę z tyłem, którą `parseZine` łączy z rozkładówką 0 (`mergeCovers`, tył pod przodem, współrzędne bez zmian). Dane o złym kształcie (`mergeCovers` zwraca `null`) dają błąd uszkodzonego zina."
- **Dostępne nazwy**: `spreadName` — „Okładka”, „Strony 2–3” (no „Tył”).
- **3D**: add "Podpis w 3D (`spreadCaption`) liczy się z pozycji czytelnika (zamknięty z przodu „Okładka”, z tyłu „Tył”), nie z rozkładówek edytora."

- [ ] **Step 2: base spec `docs/superpowers/specs/2026-10-14-ziniarz-design.md`**

- Line about **Rozkładówka** (section with `P = 4 · sheets`): replace with the new numbering (spread 0 = `P | 1`, spreads `1 … 2 · sheets − 1` = `2i | 2i + 1`) and a pointer "(zmiana: `2026-10-15-ziniarz-okladka-design.md`)".
- Delete "Część elementu na nieistniejącej stronie (obok okładki) jest w edytorze wyszarzona i nie trafia do druku." and add "Element może przechodzić przez grzbiet okładki z tyłu na przód; drukuje się w całości na przodzie kartki 1."
- Leave the add/remove sheet rules as they are (formulas still hold).

- [ ] **Step 3: `README.md`**

Run: `grep -n "Tył\|okładk\|rozkładówk" README.md`. Where the README describes the editor's spreads or covers, add one sentence: "Okładka to jedna rozkładówka: tył po lewej, przód po prawej, więc zdjęcie może przechodzić z tyłu na przód." If the README says nothing about spreads, add the sentence to the editor's bullet.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md docs/superpowers/specs/2026-10-14-ziniarz-design.md README.md
git commit -m "Describe the one-spread cover in the docs

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Full verification

- [ ] **Step 1: Everything CI runs**

Run: `npm run typecheck && npm test && npm run test:e2e && npm run build && npm run check:dist`
Expected: all green. `e2e/print.spec.ts` needs no change: a new zine opens on the cover and "+ Napis" goes to the front, as before. If something fails, debug it (superpowers:systematic-debugging) before touching tests.

- [ ] **Step 2: Look at it in the app**

Start the dev preview (`.claude/launch.json`, `ziniarz-dev`). Create a zine with 2 sheets and check:
- the thumbnails are "Okładka", "2–3", "4–5", "6–7", with no "Tył";
- the cover shows both pages with no grey half, and "tył" / "przód" under them;
- a photo dragged across the spine of the cover stays whole, and the cover thumbnail and the print screen's sheet 1 front show it across both halves;
- "+ kartka" with the back cover clicked keeps the page panel on the back cover (page number grows by 4);
- the 3D preview shows the wrapped photo on the closed front and back.

Take a screenshot of the editor with the wrapping photo as proof.

- [ ] **Step 3: Leave the commits local**

Do not push: pushing to `main` publishes the site. Report the commits (`git log --oneline -8`) to the owner.
