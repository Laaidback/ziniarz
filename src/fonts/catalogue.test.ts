import 'fake-indexeddb/auto';
import { expect, test } from 'vitest';
import { createZine } from '../model/factory';
import { newId } from '../model/ids';
import { openZiniarzDb, putFontFamily, putFontFile } from '../storage/db';
import { loadFontChoices, otherZineFamilies } from './catalogue';
import { BUILTIN_FONTS } from './fontChoices';

async function dbWithFamilies() {
  const db = await openZiniarzDb(`test-${newId()}`);
  const data = new ArrayBuffer(1);
  await putFontFamily(db, { id: 'mine', name: 'Moja' });
  await putFontFile(db, { id: 'm1', familyId: 'mine', bold: false, italic: false, mime: 'font/ttf', data });
  await putFontFile(db, { id: 'm2', familyId: 'mine', bold: true, italic: false, mime: 'font/ttf', data });
  await putFontFamily(db, { id: 'z', name: 'Żabka' });
  await putFontFamily(db, { id: 'a', name: 'Alfa' });
  await putFontFile(db, { id: 'a1', familyId: 'a', bold: false, italic: true, mime: 'font/ttf', data });
  return db;
}

test('loadFontChoices lists built-in fonts, then the zine families with their styles', async () => {
  const db = await dbWithFamilies();
  const zine = createZine('t', 1);
  zine.fonts = ['mine', 'gone'];
  const choices = await loadFontChoices(db, zine);
  expect(choices.slice(0, BUILTIN_FONTS.length)).toEqual(BUILTIN_FONTS);
  expect(choices.slice(BUILTIN_FONTS.length)).toEqual([{ id: 'mine', name: 'Moja', styles: ['regular', 'bold'], builtin: false }]);
});

test('otherZineFamilies lists families this zine does not use, by name', async () => {
  const db = await dbWithFamilies();
  const zine = createZine('t', 1);
  zine.fonts = ['mine'];
  expect((await otherZineFamilies(db, zine)).map((f) => [f.name, f.styles])).toEqual([
    ['Alfa', ['italic']],
    ['Żabka', []],
  ]);
});
