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
