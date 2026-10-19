import { describe, expect, test } from 'vitest';
import { CANVAS_MIN_WIDTH, COLUMN_LIMITS, clampColumnWidth, fitColumnWidths, thumbnailPxPerMm } from './columnWidth';

const defaults = { spreads: 180, settings: 300, notes: 280 };
const none = { spreads: true, settings: false, notes: false };

describe('notes width limits', () => {
  const max = (windowWidth: number) => fitColumnWidths({ ...defaults, notes: 5000 }, { ...none, notes: true }, windowWidth).notes.max;

  test('the maximum is 720 px or 55 % of the window, whichever is smaller', () => {
    expect(clampColumnWidth('notes', 5000, 1920)).toBe(720);
    expect(clampColumnWidth('notes', 5000, 1280)).toBe(704);
    expect(clampColumnWidth('notes', 5000, 1000)).toBe(550);
    expect(max(1920)).toBe(720);
  });

  test('the maximum never drops below the minimum in a tiny window', () => {
    expect(clampColumnWidth('notes', 5000, 300)).toBe(COLUMN_LIMITS.notes.min);
    expect(max(300)).toBe(COLUMN_LIMITS.notes.min);
  });

  test('clamps into the limits and rounds', () => {
    expect(clampColumnWidth('notes', 100, 1280)).toBe(220);
    expect(clampColumnWidth('notes', 900, 1280)).toBe(704);
    expect(clampColumnWidth('notes', 333.4, 1280)).toBe(333);
  });

  test('a stored width that no longer fits a narrower window is pulled in', () => {
    expect(clampColumnWidth('notes', 700, 1000)).toBe(550);
  });

  test('a broken value falls back to the default', () => {
    expect(clampColumnWidth('notes', Number.NaN, 1280)).toBe(COLUMN_LIMITS.notes.default);
  });
});

describe('spread list and settings limits', () => {
  test('the spread list is 140 to 360 px, 180 by default', () => {
    expect(COLUMN_LIMITS.spreads).toMatchObject({ default: 180, min: 140, max: 360, key: 'ziniarz.spreadsWidth' });
    expect(clampColumnWidth('spreads', 50, 1920)).toBe(140);
    expect(clampColumnWidth('spreads', 900, 1920)).toBe(360);
  });

  test('the settings panel is 240 to 480 px, 300 by default', () => {
    expect(COLUMN_LIMITS.settings).toMatchObject({ default: 300, min: 240, max: 480, key: 'ziniarz.settingsWidth' });
    expect(clampColumnWidth('settings', 50, 1920)).toBe(240);
    expect(clampColumnWidth('settings', 900, 1920)).toBe(480);
  });
});

describe('fitting the columns to the window', () => {
  const all = { spreads: true, settings: true, notes: true };

  test('hidden columns take no room and keep their own limits', () => {
    const fitted = fitColumnWidths(defaults, none, 1280);
    expect(fitted.spreads).toEqual({ width: 180, min: 140, max: 360 });
    expect(fitted.settings.max).toBe(480);
  });

  test('a column may grow only until the canvas is down to its minimum', () => {
    const fitted = fitColumnWidths(defaults, all, 1280);
    expect(fitted.settings.max).toBe(1280 - CANVAS_MIN_WIDTH - 180 - 280);
    expect(fitted.spreads.max).toBe(1280 - CANVAS_MIN_WIDTH - 300 - 280);
    expect(fitted.notes.max).toBe(1280 - CANVAS_MIN_WIDTH - 180 - 300);
  });

  test('when the window shrinks, the notepad gives up room first, then settings, then the list', () => {
    const wide = { spreads: 360, settings: 480, notes: 720 };
    const fitted = fitColumnWidths(wide, all, 1280);
    const total = fitted.spreads.width + fitted.settings.width + fitted.notes.width;
    expect(total).toBe(1280 - CANVAS_MIN_WIDTH);
    expect(fitted.spreads.width).toBe(360);
    expect(fitted.settings.width).toBe(340);
    expect(fitted.notes.width).toBe(220);
  });

  test('columns never go below their minimum, even if the canvas has to give in', () => {
    const fitted = fitColumnWidths(defaults, all, 800);
    expect(fitted.spreads.width).toBe(140);
    expect(fitted.settings.width).toBe(240);
    expect(fitted.notes.width).toBe(220);
  });
});

describe('thumbnail resolution', () => {
  test('wider columns and sharper screens get more pixels per mm, in steps', () => {
    expect(thumbnailPxPerMm(180, 1)).toBe(0.8);
    expect(thumbnailPxPerMm(360, 1)).toBeGreaterThan(thumbnailPxPerMm(180, 1));
    expect(thumbnailPxPerMm(180, 2)).toBeGreaterThan(thumbnailPxPerMm(180, 1));
    expect(thumbnailPxPerMm(360, 3)).toBeLessThanOrEqual(3.2);
  });
});
