import { expect, test } from 'vitest';
import { printLayout } from '../imposition/layout';
import { DEFAULT_PRINT } from '../model/factory';
import { previewSheets, printReminders, sideCaption, trimSizeText } from './printTexts';

test('the preview lists every sheet with its front and back', () => {
  const sheets = previewSheets(5);
  expect(sheets).toHaveLength(5);
  expect(sheets[0].front).toMatchObject({ sheet: 0, face: 'front', left: 20, right: 1 });
  expect(sheets[0].back).toMatchObject({ sheet: 0, face: 'back', left: 2, right: 19 });
  expect(sheets[4].front).toMatchObject({ left: 12, right: 9 });
  expect(sideCaption(sheets[4].back)).toBe('tył: strony 10 i 11');
  expect(sideCaption(sheets[0].front)).toBe('przód: strony 20 i 1');
});

test('the trimmed page size matches the spec examples', () => {
  const plain = printLayout({ printerMargin: 4, bleed: true, cropMarks: false, foldMarks: false });
  expect(trimSizeText(plain)).toBe('Strona po przycięciu: 138 × 196 mm (94% projektu)');
  const marked = printLayout({ printerMargin: 4, bleed: true, cropMarks: true, foldMarks: false });
  expect(trimSizeText(marked)).toBe('Strona po przycięciu: 132 × 187 mm (89% projektu)');
});

test('reminders: actual size always, the duplex flip that fits the settings', () => {
  const auto = printReminders(DEFAULT_PRINT);
  expect(auto[0]).toContain('„Rzeczywisty rozmiar”');
  expect(auto[1]).toContain('„odwracanie po krótszej krawędzi”');
  expect(printReminders({ ...DEFAULT_PRINT, rotateBacks: true })[1]).toContain('„odwracanie po dłuższej krawędzi”');
  const manual = printReminders({ ...DEFAULT_PRINT, duplex: 'manual' });
  expect(manual[1]).toContain('z przodami');
  expect(manual[1]).toContain('z tyłami');
});
