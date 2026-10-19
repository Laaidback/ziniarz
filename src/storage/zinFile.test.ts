import 'fake-indexeddb/auto';
import JSZip from 'jszip';
import { describe, expect, test } from 'vitest';
import { createPhotoElement, createTextElement, createZine, FORMAT_VERSION } from '../model/factory';
import type { TextElement } from '../model/types';
import { newId } from '../model/ids';
import {
  fontFilesOfFamily,
  getFontFamily,
  getImage,
  loadZine,
  openZiniarzDb,
  putFontFamily,
  putFontFile,
  putImage,
  saveZine,
} from './db';
import { bundleFromDb, importBundle, readZin, writeZin, ZinFileError, type ZinBundle } from './zinFile';

function sampleBundle(): ZinBundle {
  const zine = createZine('Lato', 1);
  zine.spreads[1].elements.push(createPhotoElement('img'));
  zine.fonts = ['fam'];
  zine.notes = '<div><b>Tytuł</b></div><div>Tekst <mark>do zina</mark></div>';
  zine.spreadNotes = { [zine.spreads[1].id]: '<b>Strony 2–3</b>' };
  return {
    zine,
    images: [{ id: 'img', mime: 'image/png', width: 3, height: 2, data: new Uint8Array([9, 8, 7]).buffer }],
    fontFamilies: [{ id: 'fam', name: 'Grotesk' }],
    fontFiles: [{ id: 'ff', familyId: 'fam', bold: true, italic: false, mime: 'font/ttf', data: new Uint8Array([5]).buffer }],
  };
}

describe('writeZin / readZin', () => {
  test('round trip gives a new zine id and the same content', async () => {
    const bundle = sampleBundle();
    const read = await readZin(await writeZin(bundle));
    expect(read.zine.id).not.toBe(bundle.zine.id);
    expect({ ...read.zine, id: bundle.zine.id }).toEqual(bundle.zine);
    expect(read.zine.notes).toBe('<div><b>Tytuł</b></div><div>Tekst <mark>do zina</mark></div>');
    expect(read.zine.spreadNotes).toEqual({ [bundle.zine.spreads[1].id]: '<b>Strony 2–3</b>' });
    expect(read.images[0]).toMatchObject({ id: 'img', mime: 'image/png', width: 3, height: 2 });
    expect(new Uint8Array(read.images[0].data)).toEqual(new Uint8Array([9, 8, 7]));
    expect(read.fontFamilies).toEqual(bundle.fontFamilies);
    expect(read.fontFiles[0]).toMatchObject({ id: 'ff', familyId: 'fam', bold: true });
    expect(new Uint8Array(read.fontFiles[0].data)).toEqual(new Uint8Array([5]));
  });

  test('rejects data that is not a zip', async () => {
    await expect(readZin(new Uint8Array([1, 2, 3]))).rejects.toThrow(ZinFileError);
  });

  test('rejects a zip without zine.json', async () => {
    const zip = new JSZip();
    zip.file('manifest.json', JSON.stringify({ kind: 'ziniarz', version: 1 }));
    await expect(readZin(await zip.generateAsync({ type: 'uint8array' }))).rejects.toThrow(ZinFileError);
  });

  test('accepts a file without some photos of its zine: those frames stay empty', async () => {
    const bundle = { ...sampleBundle(), images: [] };
    const read = await readZin(await writeZin(bundle));
    expect(read.images).toEqual([]);
    expect(read.zine.spreads[1].elements).toEqual(bundle.zine.spreads[1].elements);
  });

  test('a photo listed in the index but missing from the file is still corrupt', async () => {
    await expect(readZin(await zipWith({ 'images/img': null }))).rejects.toThrow(ZinFileError);
  });

  async function zipWith(overrides: Record<string, string | null>): Promise<Uint8Array> {
    const zip = await JSZip.loadAsync(await writeZin(sampleBundle()));
    for (const [path, content] of Object.entries(overrides)) {
      if (content === null) zip.remove(path);
      else zip.file(path, content);
    }
    return zip.generateAsync({ type: 'uint8array' });
  }

  test.each([
    ['null images index', { 'images/index.json': 'null' }],
    ['object images index', { 'images/index.json': '{}' }],
    ['null fonts index', { 'fonts/index.json': 'null' }],
    ['fonts index without files', { 'fonts/index.json': '{"families":[]}' }],
    ['fonts index without families', { 'fonts/index.json': '{"files":[]}' }],
    ['malformed image entry', { 'images/index.json': '[null]' }],
  ])('%s gives a ZinFileError', async (_name, overrides) => {
    await expect(readZin(await zipWith(overrides))).rejects.toThrow(ZinFileError);
  });

  test.each([
    ['without familyId', '{"id":"ff"}'],
    ['with a numeric familyId', '{"id":"ff","familyId":7}'],
  ])('a font file entry %s is rejected as corrupt', async (_name, entry) => {
    const overrides = { 'fonts/index.json': `{"families":[{"id":"fam","name":"Grotesk"}],"files":[${entry}]}` };
    const read = readZin(await zipWith(overrides));
    await expect(read).rejects.toThrow(ZinFileError);
    await expect(read).rejects.toThrow('Plik zina jest uszkodzony.');
  });

  test('a corrupt binary entry gives a ZinFileError', async () => {
    const bytes = await writeZin(sampleBundle());
    const zip = await JSZip.loadAsync(bytes);
    zip.file('images/img', new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]), { compression: 'DEFLATE' });
    const corrupt = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
    // Flip bytes inside the deflate stream of the last entry data so that inflating fails.
    const text = new TextDecoder('latin1').decode(corrupt);
    const at = text.indexOf('images/img') + 'images/img'.length;
    for (let i = 0; i < 6; i++) corrupt[at + i] = 0xff;
    await expect(readZin(corrupt)).rejects.toThrow(ZinFileError);
  });

  test('an old A5 .zin file opens as A6', async () => {
    const bundle = sampleBundle();
    const old = {
      ...bundle.zine,
      formatVersion: 1,
      margins: { outer: 30, inner: 30, top: 30, bottom: 30 },
      spreads: [
        ...bundle.zine.spreads.map((s, i) =>
          i === 1 ? { ...s, elements: [createTextElement({ x: 148, y: 210, width: 148, text: 'A' })] } : s,
        ),
        { id: 'back', elements: [createTextElement({ x: 20, y: 10, width: 50, text: 'tył' })] },
      ],
    };
    const read = await readZin(await writeZin({ ...bundle, zine: old }));
    expect(read.zine.formatVersion).toBe(FORMAT_VERSION);
    expect(read.zine.spreads).toHaveLength(2 * bundle.zine.sheets);
    expect(read.zine.spreads[0].elements.some((e) => e.kind === 'text' && e.text === 'tył')).toBe(true);
    expect(read.zine.margins.outer).toBeCloseTo(30 * (105 / 148), 9);
    expect(read.zine.spreads[1].elements[0].x).toBeCloseTo(105, 9);
    expect(read.zine.spreads[1].elements[0].y).toBeCloseTo(148, 9);
  });

  test('drops zine.fonts entries without a family in the file', async () => {
    const bundle = sampleBundle();
    bundle.zine.fonts = ['fam', 'ghost'];
    expect((await readZin(await writeZin(bundle))).zine.fonts).toEqual(['fam']);
  });
});

describe('database bundles', () => {
  test('export from one database and import into another', async () => {
    const source = await openZiniarzDb(`test-${newId()}`);
    const bundle = sampleBundle();
    await saveZine(source, bundle.zine);
    await putImage(source, bundle.images[0]);
    await putFontFamily(source, bundle.fontFamilies[0]);
    await putFontFile(source, bundle.fontFiles[0]);

    const exported = await bundleFromDb(source, bundle.zine.id);
    expect(exported.missingImages).toBe(0);
    const target = await openZiniarzDb(`test-${newId()}`);
    const imported = await importBundle(target, await readZin(await writeZin(exported.bundle)));

    expect(await loadZine(target, imported.id)).toEqual(imported);
    expect(await getImage(target, 'img')).toBeDefined();
  });

  test('importing into an empty database keeps the font ids', async () => {
    const db = await openZiniarzDb(`test-${newId()}`);
    const imported = await importBundle(db, sampleBundle());
    expect(imported.fonts).toEqual(['fam']);
    expect((await fontFilesOfFamily(db, 'fam')).map((f) => f.id)).toEqual(['ff']);
  });

  test('importing never changes a font family that is already there; the imported one gets new ids', async () => {
    const db = await openZiniarzDb(`test-${newId()}`);
    // The family as it is now in the browser: its bold file was replaced by a regular one.
    await putFontFamily(db, { id: 'fam', name: 'Grotesk' });
    const current = { id: 'ff-now', familyId: 'fam', bold: false, italic: false, mime: 'font/ttf', data: new Uint8Array([1]).buffer };
    await putFontFile(db, current);
    // An unrelated family whose file id clashes with the imported one.
    await putFontFamily(db, { id: 'other', name: 'Inna' });
    await putFontFile(db, { ...current, id: 'ff', familyId: 'other', data: new Uint8Array([2]).buffer });

    const bundle = sampleBundle();
    const custom = createTextElement({ text: 'a', fontFamilyId: 'fam' });
    const builtin = createTextElement({ text: 'b', fontFamilyId: 'inter' });
    bundle.zine.spreads[1].elements.push(custom, builtin);
    const imported = await importBundle(db, bundle);

    expect(await getFontFamily(db, 'fam')).toEqual({ id: 'fam', name: 'Grotesk' });
    expect((await fontFilesOfFamily(db, 'fam')).map((f) => f.id)).toEqual(['ff-now']);
    expect((await fontFilesOfFamily(db, 'other')).map((f) => new Uint8Array(f.data))).toEqual([new Uint8Array([2])]);

    const [familyId] = imported.fonts;
    expect(imported.fonts).toHaveLength(1);
    expect(familyId).not.toBe('fam');
    expect(await getFontFamily(db, familyId)).toEqual({ id: familyId, name: 'Grotesk' });
    const files = await fontFilesOfFamily(db, familyId);
    expect(files.map((f) => [f.bold, f.italic, new Uint8Array(f.data)])).toEqual([[true, false, new Uint8Array([5])]]);
    expect(files[0].id).not.toBe('ff');
    const texts = imported.spreads[1].elements.filter((e): e is TextElement => e.kind === 'text');
    expect(texts.map((t) => t.fontFamilyId)).toEqual([familyId, 'inter']);
    expect(await loadZine(db, imported.id)).toEqual(imported);
  });

  test('a text in Ayuthaya (a macOS system font) exports no font files and imports unchanged', async () => {
    const db = await openZiniarzDb(`test-${newId()}`);
    const zine = createZine('Lato', 1);
    zine.spreads[1].elements.push(createTextElement({ text: 'a', fontFamilyId: 'ayuthaya' }));
    await saveZine(db, zine);
    const { bundle } = await bundleFromDb(db, zine.id);
    expect(bundle.fontFamilies).toEqual([]);
    expect(bundle.fontFiles).toEqual([]);
    const imported = await importBundle(await openZiniarzDb(`test-${newId()}`), await readZin(await writeZin(bundle)));
    expect((imported.spreads[1].elements[0] as TextElement).fontFamilyId).toBe('ayuthaya');
  });

  test('export leaves out photos missing from the database and counts them', async () => {
    const db = await openZiniarzDb(`test-${newId()}`);
    const bundle = sampleBundle();
    bundle.zine.spreads[1].elements.push(createPhotoElement('kept'), createPhotoElement('gone-too'));
    await saveZine(db, bundle.zine);
    await putImage(db, { ...bundle.images[0], id: 'kept' });
    const exported = await bundleFromDb(db, bundle.zine.id);
    expect(exported.missingImages).toBe(2);
    expect(exported.bundle.images.map((i) => i.id)).toEqual(['kept']);
    const read = await readZin(await writeZin(exported.bundle));
    expect(read.images.map((i) => i.id)).toEqual(['kept']);
  });
});
