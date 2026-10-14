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
