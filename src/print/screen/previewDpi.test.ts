import { expect, test } from 'vitest';
import { A4_LANDSCAPE } from '../../imposition/layout';
import { MAX_PREVIEW_DPI, MIN_PREVIEW_DPI, previewDpi } from './previewDpi';

const widthPx = (dpi: number) => (A4_LANDSCAPE.width * dpi) / 25.4;

test('a side gets at least as many pixels as the screen shows it with', () => {
  // A sheet 544 px wide on a Retina screen (2 device pixels per px) needs 1088 pixels.
  const dpi = previewDpi(544, 2);
  expect(widthPx(dpi)).toBeGreaterThanOrEqual(1088);
  expect(widthPx(previewDpi(300, 1))).toBeGreaterThanOrEqual(300);
  expect(widthPx(previewDpi(700, 1.5))).toBeGreaterThanOrEqual(1050);
});

test('goes up in steps, so a slightly wider window does not redraw', () => {
  expect(previewDpi(540, 2)).toBe(previewDpi(544, 2));
});

test('stays between the lowest and highest preview resolution', () => {
  expect(previewDpi(10, 1)).toBe(MIN_PREVIEW_DPI);
  expect(previewDpi(0, 2)).toBe(MIN_PREVIEW_DPI);
  expect(previewDpi(5000, 3)).toBe(MAX_PREVIEW_DPI);
});

test('an unknown pixel ratio counts as 1', () => {
  expect(previewDpi(544, 0)).toBe(previewDpi(544, 1));
  expect(previewDpi(544, Number.NaN)).toBe(previewDpi(544, 1));
});
