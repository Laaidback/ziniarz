import 'fake-indexeddb/auto';
import JSZip from 'jszip';
import { describe, expect, test } from 'vitest';
import { createPhotoElement, createZine } from '../model/factory';
import { newId } from '../model/ids';
import { getImage, loadZine, openZiniarzDb, putFontFamily, putFontFile, putImage, saveZine } from './db';
import { bundleFromDb, importBundle, readZin, writeZin, ZinFileError, type ZinBundle } from './zinFile';

function sampleBundle(): ZinBundle {
  const zine = createZine('Lato', 1);
  zine.spreads[1].elements.push(createPhotoElement('img'));
  zine.fonts = ['fam'];
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

  test('rejects a file with missing images', async () => {
    const bundle = { ...sampleBundle(), images: [] };
    await expect(readZin(await writeZin(bundle))).rejects.toThrow('brakuje zdjęć');
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
    const target = await openZiniarzDb(`test-${newId()}`);
    const imported = await importBundle(target, await readZin(await writeZin(exported)));

    expect(await loadZine(target, imported.id)).toEqual(imported);
    expect(await getImage(target, 'img')).toBeDefined();
  });

  test('export fails with a Polish error when images are missing from the database', async () => {
    const db = await openZiniarzDb(`test-${newId()}`);
    const bundle = sampleBundle();
    await saveZine(db, bundle.zine);
    await expect(bundleFromDb(db, bundle.zine.id)).rejects.toThrow(ZinFileError);
    await expect(bundleFromDb(db, bundle.zine.id)).rejects.toThrow('Brakuje zdjęć');
  });
});
