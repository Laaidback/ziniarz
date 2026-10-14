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
