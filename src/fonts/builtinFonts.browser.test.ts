import { expect, test } from 'vitest';
import { createTextElement, createZine } from '../model/factory';
import { BUILTIN_FONT_FILES } from './builtinFontFiles';
import { BUILTIN_FONTS, styleKey } from './fontChoices';
import { ensureFontsReady, registerBuiltinFonts } from './fontLoader';

const faces = (family: string) => [...document.fonts].filter((f) => f.family.replace(/["']/g, '') === family);

test('the file table matches the styles the font picker offers', () => {
  for (const font of BUILTIN_FONTS) {
    const styles = BUILTIN_FONT_FILES.filter((f) => f.familyId === font.id).map((f) => styleKey(f.bold, f.italic));
    expect(styles.sort()).toEqual([...font.styles].sort());
  }
});

test('every bundled file is served', async () => {
  for (const file of BUILTIN_FONT_FILES) {
    for (const url of [file.latin, file.latinExt]) expect((await fetch(url)).ok).toBe(true);
  }
});

test('registerBuiltinFonts adds two faces per style, once', () => {
  registerBuiltinFonts();
  registerBuiltinFonts();
  expect(faces('zf-lora')).toHaveLength(8);
  expect(faces('zf-archivo-black')).toHaveLength(2);
});

test('ensureFontsReady loads the latin-ext file for Polish letters', async () => {
  const zine = createZine('t', 1);
  zine.spreads[1].elements.push(createTextElement({ fontFamilyId: 'lora', italic: true, text: 'Zażółć gęślą jaźń' }));
  registerBuiltinFonts();
  expect(document.fonts.check('italic 16px "zf-lora"', 'ą')).toBe(false);
  await ensureFontsReady(zine);
  expect(document.fonts.check('italic 16px "zf-lora"', 'ą')).toBe(true);
  expect(document.fonts.check('italic 16px "zf-lora"', 'Z')).toBe(true);
});

test('new texts use Inter by default', () => {
  expect(createTextElement().fontFamilyId).toBe('inter');
});
