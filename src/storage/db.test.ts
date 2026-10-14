import 'fake-indexeddb/auto';
import { describe, expect, test } from 'vitest';
import { createZine } from '../model/factory';
import { newId } from '../model/ids';
import {
  deleteFontFamilies,
  deleteImages,
  deleteZine,
  fontFilesOfFamily,
  getImage,
  listFontFamilyIds,
  listImageIds,
  listZines,
  loadZine,
  openZiniarzDb,
  putFontFamily,
  putFontFile,
  putImage,
  saveZine,
} from './db';

const freshDb = () => openZiniarzDb(`test-${newId()}`);
const bytes = (...values: number[]) => new Uint8Array(values).buffer;

describe('zines', () => {
  test('save, load, list, delete', async () => {
    const db = await freshDb();
    const a = createZine('A', 1);
    const b = createZine('B', 2);
    await saveZine(db, a);
    await saveZine(db, b);
    expect(await loadZine(db, a.id)).toEqual(a);
    expect((await listZines(db)).map((z) => z.title).sort()).toEqual(['A', 'B']);
    await deleteZine(db, a.id);
    expect(await loadZine(db, a.id)).toBeUndefined();
  });
});

describe('images', () => {
  test('put, get, list, delete', async () => {
    const db = await freshDb();
    await putImage(db, { id: 'i1', mime: 'image/jpeg', width: 2, height: 1, data: bytes(1, 2, 3) });
    const image = await getImage(db, 'i1');
    expect(image?.width).toBe(2);
    expect(new Uint8Array(image!.data)).toEqual(new Uint8Array([1, 2, 3]));
    expect(await listImageIds(db)).toEqual(['i1']);
    await deleteImages(db, ['i1']);
    expect(await listImageIds(db)).toEqual([]);
  });
});

describe('fonts', () => {
  test('families group files; deleting a family deletes its files', async () => {
    const db = await freshDb();
    await putFontFamily(db, { id: 'f1', name: 'Grotesk' });
    await putFontFile(db, { id: 'r', familyId: 'f1', bold: false, italic: false, mime: 'font/ttf', data: bytes(1) });
    await putFontFile(db, { id: 'b', familyId: 'f1', bold: true, italic: false, mime: 'font/ttf', data: bytes(2) });
    expect((await fontFilesOfFamily(db, 'f1')).map((f) => f.id).sort()).toEqual(['b', 'r']);
    expect(await listFontFamilyIds(db)).toEqual(['f1']);
    await deleteFontFamilies(db, ['f1']);
    expect(await listFontFamilyIds(db)).toEqual([]);
    expect(await fontFilesOfFamily(db, 'f1')).toEqual([]);
  });
});
