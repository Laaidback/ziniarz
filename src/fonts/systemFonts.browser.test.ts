import { afterEach, expect, test } from 'vitest';
import { createTextElement, createZine } from '../model/factory';
import { newId } from '../model/ids';
import type { Zine } from '../model/types';
import { buildSheetsPdf } from '../print/pdf';
import { renderPage } from '../render/renderPage';
import { openZiniarzDb } from '../storage/db';
import { loadFontChoices } from './catalogue';
import { ensureFontsReady, konvaFontFamily } from './fontLoader';
import {
  defaultFontFamilyId,
  detectSystemFonts,
  isSystemFontAvailable,
  isSystemFontRegistered,
  setSystemFontAvailability,
} from './systemFonts';

// src/test/browserSetup.ts makes Ayuthaya count as missing; each test sets what it needs.
afterEach(() => setSystemFontAvailability('ayuthaya', false));

const assets = { images: new Map() };

function zineWithText(fontFamilyId: string): Zine {
  const zine = createZine('Ayuthaya', 1);
  zine.spreads[0].elements.push(
    createTextElement({ fontFamilyId, text: 'Zażółć gęślą jaźń WMW', size: 40, x: 110, y: 20, width: 90, color: '#000000' }),
  );
  return zine;
}

function pixelsOf(zine: Zine): Uint8ClampedArray {
  const canvas = renderPage(zine, 1, assets, { pxPerMm: 4, bleed: false });
  return canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
}

const samePixels = (a: Uint8ClampedArray, b: Uint8ClampedArray) => a.length === b.length && a.every((v, i) => v === b[i]);

test('detection finishes and agrees with document.fonts', async () => {
  await detectSystemFonts();
  setSystemFontAvailability('ayuthaya', null); // what this computer really has
  const found = isSystemFontAvailable('ayuthaya');
  console.info(`Ayuthaya on this computer: ${found ? 'found' : 'missing'}`);
  expect(isSystemFontRegistered('ayuthaya')).toBe(found);
  expect([...document.fonts].some((f) => f.family.replace(/["']/g, '') === 'zf-ayuthaya')).toBe(found);
  expect(defaultFontFamilyId()).toBe(found ? 'ayuthaya' : 'inter');
  const names = (await loadFontChoices(await openZiniarzDb(`test-${newId()}`), createZine('t', 1))).map((f) => f.name);
  expect(names.includes('Ayuthaya (z macOS)')).toBe(found);
});

test('a system font falls back to Inter, never just sans-serif', () => {
  expect(konvaFontFamily('ayuthaya')).toBe('zf-ayuthaya, zf-inter, sans-serif');
});

test('a zine using Ayuthaya on a computer without it draws in Inter and still exports', async () => {
  await detectSystemFonts();
  const ayuthaya = zineWithText('ayuthaya');
  const inter = zineWithText('inter');
  await ensureFontsReady(ayuthaya);
  await ensureFontsReady(inter);
  expect(document.fonts.check('16px "zf-inter"', 'ż')).toBe(true);
  expect(samePixels(pixelsOf(ayuthaya), pixelsOf(inter))).toBe(true);
  const files = await buildSheetsPdf({ zine: ayuthaya, assets, settings: ayuthaya.print, dpi: 30 });
  expect(files[0].bytes.length).toBeGreaterThan(0);
});

test('where Ayuthaya is installed, its texts draw in it', async () => {
  await detectSystemFonts();
  setSystemFontAvailability('ayuthaya', null);
  if (!isSystemFontRegistered('ayuthaya')) return; // e.g. Linux CI: covered by the test above
  const ayuthaya = zineWithText('ayuthaya');
  const inter = zineWithText('inter');
  await ensureFontsReady(ayuthaya);
  await ensureFontsReady(inter);
  expect(samePixels(pixelsOf(ayuthaya), pixelsOf(inter))).toBe(false);
});
