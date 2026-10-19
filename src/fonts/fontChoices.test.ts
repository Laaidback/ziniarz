import { describe, expect, test } from 'vitest';
import { DEFAULT_FONT_FAMILY } from '../model/factory';
import {
  BUILTIN_FONTS,
  builtinFontChoices,
  canToggle,
  FALLBACK_FONT_FAMILY,
  fitStyle,
  hasStyle,
  missingFontName,
  pickDefaultFontFamily,
  styleKey,
  stylesOfFiles,
  SYSTEM_FONTS,
  systemFont,
  type FontChoice,
} from './fontChoices';

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

describe('system fonts (Ayuthaya from macOS)', () => {
  const none = new Set<string>();
  const ayuthaya = new Set(['ayuthaya']);

  test('new texts use Ayuthaya when the computer has it, otherwise Inter', () => {
    expect(pickDefaultFontFamily(none)).toBe('inter');
    expect(pickDefaultFontFamily(ayuthaya)).toBe('ayuthaya');
    expect(FALLBACK_FONT_FAMILY).toBe(DEFAULT_FONT_FAMILY);
  });

  test('the font list offers Ayuthaya first, only when installed', () => {
    expect(builtinFontChoices(none)).toEqual(BUILTIN_FONTS);
    const choices = builtinFontChoices(ayuthaya);
    expect(choices[0]).toEqual({ id: 'ayuthaya', name: 'Ayuthaya (z macOS)', styles: ['regular'], builtin: true, system: true });
    expect(choices.slice(1)).toEqual(BUILTIN_FONTS);
  });

  test('regular only: bold and italic stay disabled, switching to it drops them', () => {
    const choice = builtinFontChoices(ayuthaya)[0];
    expect(canToggle(choice, { bold: false, italic: false }, 'bold')).toBe(false);
    expect(canToggle(choice, { bold: false, italic: false }, 'italic')).toBe(false);
    expect(fitStyle(choice, true, true)).toEqual({ bold: false, italic: false });
  });

  test('system font ids differ from bundled ones and the missing label names the font', () => {
    for (const font of SYSTEM_FONTS) expect(BUILTIN_FONTS.some((b) => b.id === font.id)).toBe(false);
    expect(systemFont('ayuthaya')?.localNames).toEqual(['Ayuthaya', 'Ayuthaya Regular']);
    expect(missingFontName('ayuthaya')).toBe('Ayuthaya (brak na tym komputerze)');
    expect(missingFontName('gone')).toBe('Brakujący font');
  });
});
