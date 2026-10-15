import { describe, expect, test } from 'vitest';
import {
  frameBounds,
  pageAt,
  pageCount,
  pageExists,
  pageRect,
  pagesOfFrame,
  pagesOfSpread,
  PAGE_HEIGHT,
  PAGE_WIDTH,
  slotOfPage,
  SPREAD_WIDTH,
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
    expect(pageRect('left', 3)).toEqual({ x: -3, y: -3, width: PAGE_WIDTH + 3, height: PAGE_HEIGHT + 6 });
    expect(pageRect('right', 3)).toEqual({ x: PAGE_WIDTH, y: -3, width: PAGE_WIDTH + 3, height: PAGE_HEIGHT + 6 });
    expect(pageRect('right', 0)).toEqual({ x: PAGE_WIDTH, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT });
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
    expect(pagesOfFrame(3, frame(10, 50, 80, 50), 5)).toEqual([6]);
    expect(pagesOfFrame(0, frame(10, 50, 80, 50), 5)).toEqual([]);
    expect(pagesOfFrame(0, frame(100, 50, 100, 50), 5)).toEqual([1]);
  });
});

test('pages are A6', () => {
  expect([PAGE_WIDTH, PAGE_HEIGHT, SPREAD_WIDTH]).toEqual([105, 148, 210]);
});
