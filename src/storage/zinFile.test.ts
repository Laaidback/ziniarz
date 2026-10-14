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
});
