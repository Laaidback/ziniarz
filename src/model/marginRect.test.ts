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
