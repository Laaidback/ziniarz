import { describe, expect, test } from 'vitest';
import { NOTES_WIDTH_DEFAULT, NOTES_WIDTH_MIN, clampNotesWidth, notesWidthMax } from './notesWidth';

describe('notes width limits', () => {
  test('the maximum is 720 px or 55 % of the window, whichever is smaller', () => {
    expect(notesWidthMax(1920)).toBe(720);
    expect(notesWidthMax(1280)).toBe(704);
    expect(notesWidthMax(1000)).toBe(550);
  });

  test('the maximum never drops below the minimum in a tiny window', () => {
    expect(notesWidthMax(300)).toBe(NOTES_WIDTH_MIN);
  });

  test('clamps into the limits and rounds', () => {
    expect(clampNotesWidth(100, 1280)).toBe(220);
    expect(clampNotesWidth(900, 1280)).toBe(704);
    expect(clampNotesWidth(333.4, 1280)).toBe(333);
  });

  test('a stored width that no longer fits a narrower window is pulled in', () => {
    expect(clampNotesWidth(700, 1000)).toBe(550);
  });

  test('a broken value falls back to the default', () => {
    expect(clampNotesWidth(Number.NaN, 1280)).toBe(NOTES_WIDTH_DEFAULT);
  });
});
