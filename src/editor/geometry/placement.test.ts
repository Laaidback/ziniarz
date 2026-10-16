import { expect, test } from 'vitest';
import { createZine, DEFAULT_MARGINS } from '../../model/factory';
import { PAGE_HEIGHT, PAGE_WIDTH } from '../../model/geometry';
import { cascade, defaultPage, fitPhotoFrame, frameFromCentre, insertArea, newTextFrame, pageAtPoint } from './placement';

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

test('insertArea is the margin area, or the page when margins leave too little', () => {
  const zine = createZine('t', 1);
  const { outer, inner, top, bottom } = DEFAULT_MARGINS;
  expect(insertArea(zine, 3)).toEqual({
    x: PAGE_WIDTH + inner,
    y: top,
    width: PAGE_WIDTH - outer - inner,
    height: PAGE_HEIGHT - top - bottom,
  });
  zine.margins = { outer: 70, inner: 70, top: 30, bottom: 30 };
  expect(insertArea(zine, 2)).toEqual({ x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT });
});

test('fitPhotoFrame keeps proportions, centred in the area', () => {
  expect(fitPhotoFrame({ x: 30, y: 30, width: 88, height: 150 }, 200, 100)).toEqual({ x: 30, y: 83, width: 88, height: 44 });
  expect(fitPhotoFrame({ x: 0, y: 0, width: 100, height: 100 }, 100, 200)).toEqual({ x: 25, y: 0, width: 50, height: 100 });
});

test('fitPhotoFrame treats an image without a size as square', () => {
  expect(fitPhotoFrame({ x: 0, y: 0, width: 100, height: 50 }, 0, 0)).toEqual({ x: 25, y: 0, width: 50, height: 50 });
  expect(fitPhotoFrame({ x: 0, y: 0, width: 100, height: 50 }, 300, 0)).toEqual({ x: 25, y: 0, width: 50, height: 50 });
});

test('a new text frame spans the margins of its page', () => {
  const { outer, inner, top } = DEFAULT_MARGINS;
  expect(newTextFrame(createZine('t', 1), 1)).toEqual({ x: PAGE_WIDTH + inner, y: top, width: PAGE_WIDTH - outer - inner });
});

test('cascade and frameFromCentre', () => {
  expect(cascade({ x: 1, y: 2, width: 3 }, 2)).toEqual({ x: 11, y: 12, width: 3 });
  expect(frameFromCentre(50, 70, 60, 40, 15)).toEqual({ x: 20, y: 50, width: 60, height: 40, rotation: 15 });
});
