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
    expect(zine.spreads).toHaveLength(12);
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
  });

  test('with one sheet inserts after spread 1', () => {
    const zine = addSheet(marked(1), 0);
    expect([0, 1, 2, 3].map((i) => label(zine, i))).toEqual(['s0', 's1', '', '']);
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

  test('with one sheet keeps page 3 content on page 3 and leaves the new page 7 empty', () => {
    const zine = createZine('t', 1);
    zine.pages[3] = { background: 'p3' };
    const next = addSheet(zine, 1);
    expect(next.pages).toEqual({ 3: { background: 'p3' } });
    expect(next.pages[7]).toBeUndefined();
  });

  test('clamps the current spread to 1..P/2 - 2', () => {
    // 5 sheets: P = 20, so the insertion point is clamped to 1..8.
    expect(label(addSheet(marked(5), 0), 2)).toBe('');
    const last = addSheet(marked(5), 9);
    expect([8, 9, 10, 11].map((i) => label(last, i))).toEqual(['s8', '', '', 's9']);
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
    expect(zine.spreads.map((_, i) => label(zine, i))).toEqual(['s0', 's1', 's2', 's3', 's6', 's7', 's8', 's9']);
  });

  test('keeps covers and inside covers for 3+ sheets', () => {
    for (let sheets = 3; sheets <= 6; sheets++) {
      const lastBefore = pageCount(sheets) / 2 - 1;
      for (let current = 0; current <= lastBefore; current++) {
        const before = marked(sheets);
        before.pages[pageCount(sheets)] = { background: 'back' };
        const zine = removeSheet(before, current);
        const last = pageCount(zine.sheets) / 2 - 1;
        expect(zine.spreads).toHaveLength(2 * zine.sheets);
        expect(label(zine, 0)).toBe('s0');
        expect(label(zine, 1)).toBe('s1');
        expect(label(zine, last)).toBe(`s${lastBefore}`);
        expect(zine.pages[pageCount(zine.sheets)]).toEqual({ background: 'back' });
      }
    }
  });

  test('with two sheets removes spreads 2 and 3', () => {
    expect(sheetRemoval(createZine('t', 2), 0)).toEqual({ spreads: [2, 3], pages: [4, 5, 6, 7] });
    const zine = removeSheet(marked(2), 0);
    expect(zine.spreads.map((_, i) => label(zine, i))).toEqual(['s0', 's1']);
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

  test('with two sheets always removes spreads 2 and 3, whatever is current', () => {
    for (let current = 0; current <= 3; current++) {
      expect(sheetRemoval(createZine('t', 2), current)).toEqual({ spreads: [2, 3], pages: [4, 5, 6, 7] });
    }
  });

  test('with two sheets page 3 becomes the inside back cover and old page 7 is dropped', () => {
    const zine = createZine('t', 2);
    zine.pages[3] = { background: 'p3' };
    zine.pages[7] = { background: 'p7' };
    zine.pages[8] = { background: 'p8' };
    const next = removeSheet(zine, 2);
    expect(next.sheets).toBe(1);
    expect(next.pages).toEqual({ 3: { background: 'p3' }, 4: { background: 'p8' } });
  });

  test('clamps the current spread to 2..P/2 - 3 for 3+ sheets', () => {
    // 5 sheets: P = 20, so j is clamped to 2..7.
    expect(sheetRemoval(createZine('t', 5), 0)!.spreads).toEqual([2, 3]);
    expect(sheetRemoval(createZine('t', 5), 9)!.spreads).toEqual([7, 8]);
  });
});
