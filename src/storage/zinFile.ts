import JSZip from 'jszip';
import { newId } from '../model/ids';
import { parseZine, ZineFormatError } from '../model/parse';
import { imageIdsOfZine } from '../model/queries';
import type { Zine } from '../model/types';
import {
  fontFilesOfFamily,
  getFontFamily,
  getImage,
  loadZine,
  putFontFamily,
  putFontFile,
  putImage,
  saveZine,
  type FontFamily,
  type FontFile,
  type StoredImage,
  type ZiniarzDb,
} from './db';

export class ZinFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ZinFileError';
  }
}

export interface ZinBundle {
  zine: Zine;
  images: StoredImage[];
  fontFamilies: FontFamily[];
  fontFiles: FontFile[];
}

const MANIFEST = { kind: 'ziniarz', version: 1 };
const withoutData = <T extends { data: ArrayBuffer }>({ data: _data, ...rest }: T) => rest;

export async function writeZin(bundle: ZinBundle): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file('manifest.json', JSON.stringify(MANIFEST));
  zip.file('zine.json', JSON.stringify(bundle.zine));
  zip.file('images/index.json', JSON.stringify(bundle.images.map(withoutData)));
  for (const image of bundle.images) zip.file(`images/${image.id}`, image.data);
  zip.file('fonts/index.json', JSON.stringify({ families: bundle.fontFamilies, files: bundle.fontFiles.map(withoutData) }));
  for (const file of bundle.fontFiles) zip.file(`fonts/${file.id}`, file.data);
  return zip.generateAsync({ type: 'uint8array' });
}

async function readJson(zip: JSZip, path: string): Promise<unknown> {
  const entry = zip.file(path);
  if (!entry) throw new ZinFileError('Plik zina jest niekompletny.');
  try {
    return JSON.parse(await entry.async('string'));
  } catch {
    throw new ZinFileError('Plik zina jest uszkodzony.');
  }
}

async function readBinary(zip: JSZip, path: string, missing: string): Promise<ArrayBuffer> {
  const entry = zip.file(path);
  if (!entry) throw new ZinFileError(missing);
  return entry.async('arraybuffer');
}

/** Reads a .zin file. The zine gets a new id, so importing never overwrites an existing zine. */
export async function readZin(data: Uint8Array | ArrayBuffer): Promise<ZinBundle> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(data);
  } catch {
    throw new ZinFileError('To nie jest plik zina.');
  }
  const manifest = (await readJson(zip, 'manifest.json')) as { kind?: unknown };
  if (manifest?.kind !== 'ziniarz') throw new ZinFileError('To nie jest plik zina.');

  let zine: Zine;
  try {
    zine = parseZine(await readJson(zip, 'zine.json'));
  } catch (error) {
    if (error instanceof ZineFormatError) throw new ZinFileError(error.message);
    throw error;
  }

  const imageMeta = (await readJson(zip, 'images/index.json')) as Omit<StoredImage, 'data'>[];
  const fontMeta = (await readJson(zip, 'fonts/index.json')) as {
    families: FontFamily[];
    files: Omit<FontFile, 'data'>[];
  };
  const listedImages = new Set(imageMeta.map((m) => m.id));
  for (const id of imageIdsOfZine(zine)) {
    if (!listedImages.has(id)) throw new ZinFileError('Plik zina jest niekompletny (brakuje zdjęć).');
  }

  const missing = 'Plik zina jest niekompletny.';
  const images = await Promise.all(
    imageMeta.map(async (m) => ({ ...m, data: await readBinary(zip, `images/${m.id}`, missing) })),
  );
  const fontFiles = await Promise.all(
    fontMeta.files.map(async (m) => ({ ...m, data: await readBinary(zip, `fonts/${m.id}`, missing) })),
  );
  return { zine: { ...zine, id: newId() }, images, fontFamilies: fontMeta.families, fontFiles };
}

export async function bundleFromDb(db: ZiniarzDb, zineId: string): Promise<ZinBundle> {
  const zine = await loadZine(db, zineId);
  if (!zine) throw new ZinFileError('Nie znaleziono zina.');
  const images: StoredImage[] = [];
  for (const id of imageIdsOfZine(zine)) {
    const image = await getImage(db, id);
    if (image) images.push(image);
  }
  const fontFamilies: FontFamily[] = [];
  const fontFiles: FontFile[] = [];
  for (const familyId of zine.fonts) {
    const family = await getFontFamily(db, familyId);
    if (!family) continue;
    fontFamilies.push(family);
    fontFiles.push(...(await fontFilesOfFamily(db, familyId)));
  }
  return { zine, images, fontFamilies, fontFiles };
}

export async function importBundle(db: ZiniarzDb, bundle: ZinBundle): Promise<Zine> {
  for (const image of bundle.images) await putImage(db, image);
  for (const family of bundle.fontFamilies) await putFontFamily(db, family);
  for (const file of bundle.fontFiles) await putFontFile(db, file);
  await saveZine(db, bundle.zine);
  return bundle.zine;
}
