import interUrl from '@fontsource/inter/files/inter-latin-400-normal.woff2?url';
import { expect, test } from 'vitest';
import { createTextElement, createZine } from '../model/factory';
import { newId } from '../model/ids';
import { openZiniarzDb, putFontFamily, putFontFile } from '../storage/db';
import {
  cssFontFamily,
  ensureFontsReady,
  FontImportError,
  konvaFontFamily,
  konvaFontStyle,
  registerFontFile,
  registerZineFonts,
  unregisterFontFile,
} from './fontLoader';

function loadedFaces(family: string): FontFace[] {
  return [...document.fonts].filter((f) => f.family.replace(/["']/g, '') === family && f.status === 'loaded');
}

test('font names', () => {
  expect(cssFontFamily('abc')).toBe('zf-abc');
  expect(konvaFontFamily('abc')).toBe('zf-abc, sans-serif');
  expect(konvaFontStyle({ bold: true, italic: true })).toBe('italic bold');
  expect(konvaFontStyle({ bold: false, italic: false })).toBe('normal');
});

test('registers a font file and makes it available', async () => {
  const data = await (await fetch(interUrl)).arrayBuffer();
  await registerFontFile({ id: 'inter-r', familyId: 'inter', bold: false, italic: false, mime: 'font/woff2', data });
  const zine = createZine('t', 1);
  zine.spreads[1].elements.push(createTextElement({ fontFamilyId: 'inter', text: 'A' }));
  await ensureFontsReady(zine);
  expect(loadedFaces('zf-inter').length).toBeGreaterThan(0);
});

test('unregisterFontFile removes the face of a replaced file', async () => {
  const data = await (await fetch(interUrl)).arrayBuffer();
  const file = { id: 'gone-r', familyId: 'gone', bold: false, italic: false, mime: 'font/woff2', data };
  await registerFontFile(file);
  expect(loadedFaces('zf-gone')).toHaveLength(1);
  unregisterFontFile(file.id);
  expect(loadedFaces('zf-gone')).toHaveLength(0);
  unregisterFontFile(file.id); // unknown ids are ignored
  await registerFontFile(file); // and the id can be registered again
  expect(loadedFaces('zf-gone')).toHaveLength(1);
});

test('rejects data that is not a font', async () => {
  const data = new TextEncoder().encode('not a font').buffer as ArrayBuffer;
  await expect(
    registerFontFile({ id: 'bad', familyId: 'bad', bold: false, italic: false, mime: 'font/ttf', data }),
  ).rejects.toThrow(FontImportError);
});

test('registerZineFonts loads the zine font families from the database', async () => {
  const db = await openZiniarzDb(`test-${newId()}`);
  const data = await (await fetch(interUrl)).arrayBuffer();
  await putFontFamily(db, { id: 'inter2', name: 'Inter' });
  await putFontFile(db, { id: 'inter2-r', familyId: 'inter2', bold: false, italic: false, mime: 'font/woff2', data });
  const zine = createZine('t', 1);
  zine.fonts = ['inter2'];
  await registerZineFonts(db, zine);
  expect(loadedFaces('zf-inter2').length).toBeGreaterThan(0);
});

test('registerZineFonts skips a corrupt font file and still loads the others', async () => {
  const db = await openZiniarzDb(`test-${newId()}`);
  const data = await (await fetch(interUrl)).arrayBuffer();
  const bad = new TextEncoder().encode('not a font').buffer as ArrayBuffer;
  await putFontFamily(db, { id: 'mixed', name: 'Mixed' });
  await putFontFile(db, { id: 'mixed-bad', familyId: 'mixed', bold: true, italic: false, mime: 'font/ttf', data: bad });
  await putFontFile(db, { id: 'mixed-ok', familyId: 'mixed', bold: false, italic: false, mime: 'font/woff2', data });
  const zine = createZine('t', 1);
  zine.fonts = ['mixed'];
  await expect(registerZineFonts(db, zine)).resolves.toBeUndefined();
  expect(loadedFaces('zf-mixed').length).toBe(1);
});
