import { afterEach, expect, test } from 'vitest';
import { availableSystemFonts, defaultFontFamilyId, detectSystemFonts, setSystemFontAvailability } from './systemFonts';

afterEach(() => setSystemFontAvailability('ayuthaya', null));

test('without a browser nothing is detected and new texts use Inter', async () => {
  await expect(detectSystemFonts()).resolves.toBeUndefined();
  expect(availableSystemFonts().size).toBe(0);
  expect(defaultFontFamilyId()).toBe('inter');
});

test('the default follows the availability of Ayuthaya', () => {
  setSystemFontAvailability('ayuthaya', true);
  expect(defaultFontFamilyId()).toBe('ayuthaya');
  setSystemFontAvailability('ayuthaya', false);
  expect(defaultFontFamilyId()).toBe('inter');
});
