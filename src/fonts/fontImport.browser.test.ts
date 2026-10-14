import interBold from '@fontsource/inter/files/inter-latin-700-normal.woff2?url';
import interItalic from '@fontsource/inter/files/inter-latin-400-italic.woff2?url';
import interRegular from '@fontsource/inter/files/inter-latin-400-normal.woff2?url';
import { expect, test, vi } from 'vitest';
import { createZine } from '../model/factory';
import { newId } from '../model/ids';
import { fontFilesOfFamily, getFontFamily, openZiniarzDb } from '../storage/db';
import { cssFontFamily } from './fontLoader';
import { importFontFiles } from './fontImport';

async function fontFile(url: string, name: string): Promise<File> {
  return new File([await (await fetch(url)).arrayBuffer()], name);
}

const loadedFaces = (familyId: string) =>
  [...document.fonts].filter((f) => f.family.replace(/["']/g, '') === cssFontFamily(familyId) && f.status === 'loaded');

test('files with the same family name become one family; other files are skipped', async () => {
  const db = await openZiniarzDb(`test-${newId()}`);
  const zine = createZine('t', 1);
  const files = [
    await fontFile(interRegular, 'Moja-Regular.woff2'),
    await fontFile(interBold, 'Moja-Bold.woff2'),
    new File(['hello'], 'notatki.txt'),
    new File(['not a font'], 'Zepsuty-Regular.ttf'),
  ];
  const result = await importFontFiles(db, zine, files);
  expect(result.skipped).toBe(2);
  expect(result.familyIds).toHaveLength(1);
  const [familyId] = result.familyIds;
  expect(await getFontFamily(db, familyId)).toEqual({ id: familyId, name: 'Moja' });
  const stored = await fontFilesOfFamily(db, familyId);
  expect(stored.map((f) => [f.bold, f.italic, f.mime]).sort()).toEqual([
    [false, false, 'font/woff2'],
    [true, false, 'font/woff2'],
  ]);
  expect(loadedFaces(familyId)).toHaveLength(2);
});

test('a family the zine already has gets the new file, and the same style is replaced', async () => {
  const db = await openZiniarzDb(`test-${newId()}`);
  const zine = createZine('t', 1);
  const first = await importFontFiles(db, zine, [await fontFile(interRegular, 'Moja-Regular.woff2')]);
  zine.fonts = first.familyIds;
  const second = await importFontFiles(db, zine, [
    await fontFile(interItalic, 'moja-Italic.woff2'),
    await fontFile(interRegular, 'Moja-Regular.woff2'),
  ]);
  expect(second.familyIds).toEqual(first.familyIds);
  const stored = await fontFilesOfFamily(db, first.familyIds[0]);
  expect(stored.map((f) => [f.bold, f.italic]).sort()).toEqual([
    [false, false],
    [false, true],
  ]);
  expect(loadedFaces(first.familyIds[0])).toHaveLength(2); // the replaced Regular is gone from document.fonts
});

test('files that are not fonts are not read at all', async () => {
  const db = await openZiniarzDb(`test-${newId()}`);
  const notes = new File(['hello'], 'notatki.txt');
  const read = vi.spyOn(notes, 'arrayBuffer');
  const result = await importFontFiles(db, createZine('t', 1), [notes]);
  expect(result).toEqual({ familyIds: [], skipped: 1 });
  expect(read).not.toHaveBeenCalled();
});

test('an upload with no usable file leaves no empty family behind', async () => {
  const db = await openZiniarzDb(`test-${newId()}`);
  const result = await importFontFiles(db, createZine('t', 1), [new File(['x'], 'Pusty-Regular.otf')]);
  expect(result).toEqual({ familyIds: [], skipped: 1 });
  expect(await db.getAll('fontFamilies')).toEqual([]);
});
