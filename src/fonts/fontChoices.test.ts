import { expect, test } from 'vitest';
import { BUILTIN_FONTS, canToggle, fitStyle, hasStyle, styleKey, stylesOfFiles, type FontChoice } from './fontChoices';

const byId = (id: string) => BUILTIN_FONTS.find((f) => f.id === id)!;
const boldOnly: FontChoice = { id: 'b', name: 'B', styles: ['bold'], builtin: false };

test('eight built-in families, ids unique', () => {
  expect(BUILTIN_FONTS).toHaveLength(8);
  expect(new Set(BUILTIN_FONTS.map((f) => f.id)).size).toBe(8);
});

test('styleKey and hasStyle', () => {
  expect(styleKey(true, true)).toBe('boldItalic');
  expect(styleKey(false, true)).toBe('italic');
  expect(hasStyle(byId('oswald'), true, false)).toBe(true);
  expect(hasStyle(byId('oswald'), false, true)).toBe(false);
});

test('toggles are enabled only when the family has the target file', () => {
  expect(canToggle(byId('inter'), { bold: false, italic: false }, 'italic')).toBe(true);
  expect(canToggle(byId('oswald'), { bold: false, italic: false }, 'italic')).toBe(false);
  expect(canToggle(byId('archivo-black'), { bold: false, italic: false }, 'bold')).toBe(false);
  expect(canToggle(boldOnly, { bold: true, italic: false }, 'bold')).toBe(false);
});

test('fitStyle keeps what exists, then drops italic, then bold', () => {
  expect(fitStyle(byId('inter'), true, true)).toEqual({ bold: true, italic: true });
  expect(fitStyle(byId('oswald'), true, true)).toEqual({ bold: true, italic: false });
  expect(fitStyle(byId('archivo-black'), true, true)).toEqual({ bold: false, italic: false });
  expect(fitStyle(boldOnly, false, false)).toEqual({ bold: true, italic: false });
});

test('stylesOfFiles lists styles in a fixed order', () => {
  expect(stylesOfFiles([{ bold: true, italic: true }, { bold: false, italic: false }])).toEqual(['regular', 'boldItalic']);
});
