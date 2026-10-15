import { describe, expect, test } from 'vitest';
import { BLEED, PAGE_HEIGHT, PAGE_WIDTH, SPREAD_WIDTH } from '../model/geometry';
import { A4_LANDSCAPE, printLayout, type PrintLayoutOptions } from './layout';
import { cropMarks, foldMarks, MARK_LENGTH, MARK_OFFSET } from './marks';

const options = (o: Partial<PrintLayoutOptions> = {}): PrintLayoutOptions => ({
  bleed: true,
  cropMarks: false,
  foldMarks: false,
  ...o,
});

const ALL = [false, true].flatMap((bleed) =>
  [false, true].flatMap((cropMarks) => [false, true].map((foldMarks) => options({ bleed, cropMarks, foldMarks }))),
);

describe('printLayout', () => {
  test('the A5 leaf is printed at 100%, centred on A4 landscape', () => {
    for (const o of ALL) {
      const l = printLayout(o);
      expect(l.trimPage).toEqual({ width: PAGE_WIDTH, height: PAGE_HEIGHT });
      expect(l.spread.width).toBe(SPREAD_WIDTH);
      expect(l.spread.height).toBe(PAGE_HEIGHT);
      expect(l.spread.x * 2 + l.spread.width).toBeCloseTo(A4_LANDSCAPE.width, 9);
      expect(l.spread.y * 2 + l.spread.height).toBeCloseTo(A4_LANDSCAPE.height, 9);
      expect(l.bleed).toBe(o.bleed ? BLEED : 0);
      expect(l.markBand).toBe(o.cropMarks || o.foldMarks ? 5 : 0);
    }
  });

  test('bleed and marks keep more than 20 mm of paper to the sheet edge', () => {
    for (const o of ALL) {
      const l = printLayout(o);
      const segments = [...(o.cropMarks ? cropMarks(l) : []), ...(o.foldMarks ? foldMarks(l) : [])];
      const points = segments.flatMap((s) => [
        [s.x1, s.y1],
        [s.x2, s.y2],
      ]);
      points.push(
        [l.spread.x - l.bleed, l.spread.y - l.bleed],
        [l.spread.x + l.spread.width + l.bleed, l.spread.y + l.spread.height + l.bleed],
      );
      for (const [x, y] of points) {
        expect(x).toBeGreaterThan(20);
        expect(x).toBeLessThan(A4_LANDSCAPE.width - 20);
        expect(y).toBeGreaterThan(20);
        expect(y).toBeLessThan(A4_LANDSCAPE.height - 20);
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
