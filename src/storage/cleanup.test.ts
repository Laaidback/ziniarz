import 'fake-indexeddb/auto';
import { expect, test } from 'vitest';
import { createPhotoElement, createZine } from '../model/factory';
import { newId } from '../model/ids';
import { pruneUnusedAssets, unusedAssets } from './cleanup';
import {
  fontFilesOfFamily,
  listFontFamilyIds,
  listImageIds,
  openZiniarzDb,
  putFontFamily,
  putFontFile,
  putImage,
  saveZine,
} from './db';

test('unusedAssets finds images without photos and families on no font list', () => {
  const a = createZine('A', 1);
  a.spreads[1].elements.push(createPhotoElement('used'));
  a.fonts = ['kept'];
  expect(unusedAssets([a], ['used', 'orphan'], ['kept', 'unused'])).toEqual({
    images: ['orphan'],
    fontFamilies: ['unused'],
  });
});

test('pruneUnusedAssets deletes them from the database', async () => {
  const db = await openZiniarzDb(`test-${newId()}`);
  const zine = createZine('A', 1);
  zine.spreads[1].elements.push(createPhotoElement('used'));
  zine.fonts = ['kept'];
  await saveZine(db, zine);
  const data = new ArrayBuffer(1);
  await putImage(db, { id: 'used', mime: 'image/jpeg', width: 1, height: 1, data });
  await putImage(db, { id: 'orphan', mime: 'image/jpeg', width: 1, height: 1, data });
  await putFontFamily(db, { id: 'kept', name: 'K' });
  await putFontFamily(db, { id: 'unused', name: 'U' });
  await putFontFile(db, { id: 'kept-r', familyId: 'kept', bold: false, italic: false, mime: 'font/ttf', data });
  await putFontFile(db, { id: 'unused-r', familyId: 'unused', bold: false, italic: false, mime: 'font/ttf', data });

  expect(await pruneUnusedAssets(db)).toEqual({ images: 1, fontFamilies: 1 });
  expect(await listImageIds(db)).toEqual(['used']);
  expect(await listFontFamilyIds(db)).toEqual(['kept']);
  expect(await fontFilesOfFamily(db, 'unused')).toEqual([]);
  expect((await fontFilesOfFamily(db, 'kept')).map((f) => f.id)).toEqual(['kept-r']);
});
