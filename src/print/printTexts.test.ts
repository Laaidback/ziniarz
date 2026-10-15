import { expect, test } from 'vitest';
import { printLayout } from '../imposition/layout';
import { DEFAULT_PRINT } from '../model/factory';
import { fileDownloadText, previewSheets, printReminders, sideCaption, trimSizeText } from './printTexts';

test('the preview lists every sheet with its front and back', () => {
  const sheets = previewSheets(5);
  expect(sheets).toHaveLength(5);
  expect(sheets[0].front).toMatchObject({ sheet: 0, face: 'front', left: 20, right: 1 });
  expect(sheets[0].back).toMatchObject({ sheet: 0, face: 'back', left: 2, right: 19 });
  expect(sheets[4].front).toMatchObject({ left: 12, right: 9 });
  expect(sideCaption(sheets[4].back)).toBe('tył: strony 10 i 11');
  expect(sideCaption(sheets[0].front)).toBe('przód: strony 20 i 1');
});

test('the trimmed page is always the A6 page', () => {
  for (const bleed of [false, true]) {
    for (const cropMarks of [false, true]) {
      expect(trimSizeText(printLayout({ bleed, cropMarks, foldMarks: false }))).toBe('Strona po przycięciu: 105 × 148 mm');
    }
  }
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

test('download buttons of ready files name the part and the file', () => {
  expect(fileDownloadText('lato-przody.pdf')).toBe('Pobierz przody (lato-przody.pdf)');
  expect(fileDownloadText('lato-tyly.pdf')).toBe('Pobierz tyły (lato-tyly.pdf)');
  expect(fileDownloadText('lato-druk.pdf')).toBe('Pobierz lato-druk.pdf');
});
