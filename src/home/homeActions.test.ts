import 'fake-indexeddb/auto';
import { expect, test } from 'vitest';
import { createPhotoElement, createTextElement, createZine } from '../model/factory';
import { newId } from '../model/ids';
import type { Zine } from '../model/types';
import { listZines, loadZine, openZiniarzDb, putImage, saveZine } from '../storage/db';
import {
  copyOfZine,
  createNewZine,
  duplicateZine,
  exportZinFile,
  importZinFile,
  listZinesForHome,
  missingPhotosText,
  removeZine,
} from './homeActions';

const freshDb = () => openZiniarzDb(`test-${newId()}`);

test('createNewZine trims the title, clamps the sheet count and saves', async () => {
  const db = await freshDb();
  const zine = await createNewZine(db, '  Lato  ', 25);
  expect(zine).toMatchObject({ title: 'Lato', sheets: 20 });
  expect(await loadZine(db, zine.id)).toEqual(zine);
  expect((await createNewZine(db, ' ', 1)).title).toBe('Bez tytułu');
});

test('listZinesForHome parses stored zines, newest first, and counts unreadable ones', async () => {
  const db = await freshDb();
  const old = { ...createZine('Stary', 1), updatedAt: '2026-01-01T00:00:00.000Z' };
  const recent = { ...createZine('Nowy', 1), updatedAt: '2026-10-01T00:00:00.000Z' };
  await saveZine(db, old);
  await saveZine(db, recent);
  const { margins: _margins, ...withoutMargins } = createZine('Bez marginesów', 1);
  await db.put('zines', { ...withoutMargins, updatedAt: '2026-05-01T00:00:00.000Z' } as unknown as Zine);
  await db.put('zines', { ...createZine('Z przyszłości', 1), formatVersion: 99 });
  const { zines, unreadable } = await listZinesForHome(db);
  expect(zines.map((z) => z.title)).toEqual(['Nowy', 'Bez marginesów', 'Stary']);
  expect(zines[1].margins).toEqual({ outer: 12, inner: 7, top: 14, bottom: 11 });
  expect(unreadable).toBe(1);
});

test('copyOfZine gives new ids everywhere and keeps photos and fonts by id', () => {
  const zine = createZine('Lato', 1);
  zine.fonts = ['fam'];
  zine.spreads[1].elements.push(createPhotoElement('img'), createTextElement({ text: 'a' }));
  const copy = copyOfZine(zine, new Date('2026-10-14T10:00:00Z'));
  expect(copy.id).not.toBe(zine.id);
  expect(copy.title).toBe('Lato (kopia)');
  expect(copy.spreads[1].id).not.toBe(zine.spreads[1].id);
  expect(copy.spreads[1].elements[0].id).not.toBe(zine.spreads[1].elements[0].id);
  expect(copy.spreads[1].elements[0]).toMatchObject({ kind: 'photo', imageId: 'img' });
  expect(copy.fonts).toEqual(['fam']);
  expect(copy.updatedAt).toBe('2026-10-14T10:00:00.000Z');
});

test('duplicate and remove', async () => {
  const db = await freshDb();
  const zine = await createNewZine(db, 'Lato', 2);
  await duplicateZine(db, zine);
  expect((await listZines(db)).map((z) => z.title).sort()).toEqual(['Lato', 'Lato (kopia)']);
  await removeZine(db, zine.id);
  expect((await listZines(db)).map((z) => z.title)).toEqual(['Lato (kopia)']);
});

test('a saved .zin file reads back as a new zine with its photos', async () => {
  const db = await freshDb();
  const zine = createZine('Mój zin', 1);
  zine.spreads[1].elements.push(createPhotoElement('img'));
  await saveZine(db, zine);
  await putImage(db, { id: 'img', mime: 'image/png', width: 1, height: 1, data: new Uint8Array([1, 2]).buffer });
  const file = await exportZinFile(db, zine);
  expect(file.name).toBe('moj-zin.zin');
  expect(file.missingImages).toBe(0);
  const other = await freshDb();
  const imported = await importZinFile(other, file.blob);
  expect(imported.id).not.toBe(zine.id);
  expect(imported.title).toBe('Mój zin');
  expect(await loadZine(other, imported.id)).toBeDefined();
});

test('a zine with a photo missing from the browser still saves to a .zin, and says how many are missing', async () => {
  const db = await freshDb();
  const zine = createZine('Dziurawy', 1);
  zine.spreads[1].elements.push(createPhotoElement('gone'));
  await saveZine(db, zine);
  const file = await exportZinFile(db, zine);
  expect(file.missingImages).toBe(1);
  expect(missingPhotosText(file.missingImages)).toBe('Brakuje 1 zdjęcia — w pliku będą puste ramki.');
  expect(missingPhotosText(3)).toBe('Brakuje 3 zdjęć — w pliku będą puste ramki.');
  const imported = await importZinFile(await freshDb(), file.blob);
  expect(imported.spreads[1].elements).toHaveLength(1);
});
