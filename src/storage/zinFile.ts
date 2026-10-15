import JSZip from 'jszip';
import { newId } from '../model/ids';
import { parseZine, ZineFormatError } from '../model/parse';
import { imageIdsOfZine } from '../model/queries';
import type { Zine } from '../model/types';
import {
  fontFilesOfFamily,
  getFontFamily,
  getFontFile,
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

const CORRUPT = 'Plik zina jest uszkodzony.';
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
    throw new ZinFileError(CORRUPT);
  }
}

async function readBinary(zip: JSZip, path: string, missing: string): Promise<ArrayBuffer> {
  const entry = zip.file(path);
  if (!entry) throw new ZinFileError(missing);
  try {
    return await entry.async('arraybuffer');
  } catch {
    throw new ZinFileError(CORRUPT);
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function assertShape(valid: boolean): void {
  if (!valid) throw new ZinFileError(CORRUPT);
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
  const fontIndex = await readJson(zip, 'fonts/index.json');
  assertShape(Array.isArray(imageMeta) && imageMeta.every((m) => isRecord(m) && typeof m.id === 'string'));
  assertShape(isRecord(fontIndex) && Array.isArray(fontIndex.families) && Array.isArray(fontIndex.files));
  const fontMeta = fontIndex as { families: FontFamily[]; files: Omit<FontFile, 'data'>[] };
  assertShape(fontMeta.families.every((f) => isRecord(f) && typeof f.id === 'string'));
  assertShape(fontMeta.files.every((f) => isRecord(f) && typeof f.id === 'string' && typeof f.familyId === 'string'));
  // Photos of the zine that the file does not list were missing when it was saved: they draw as empty frames.

  const missing = 'Plik zina jest niekompletny.';
  const images = await Promise.all(
    imageMeta.map(async (m) => ({ ...m, data: await readBinary(zip, `images/${m.id}`, missing) })),
  );
  const fontFiles = await Promise.all(
    fontMeta.files.map(async (m) => ({ ...m, data: await readBinary(zip, `fonts/${m.id}`, missing) })),
  );
  const knownFamilies = new Set(fontMeta.families.map((f) => f.id));
  const fonts = zine.fonts.filter((id) => knownFamilies.has(id));
  return { zine: { ...zine, id: newId(), fonts }, images, fontFamilies: fontMeta.families, fontFiles };
}

/**
 * The zine with its photos and fonts, ready for writeZin. Photos missing from the browser are left
 * out (counted in `missingImages`), so one lost photo never blocks the backup; they draw as empty frames.
 */
export async function bundleFromDb(db: ZiniarzDb, zineId: string): Promise<{ bundle: ZinBundle; missingImages: number }> {
  const zine = await loadZine(db, zineId);
  if (!zine) throw new ZinFileError('Nie znaleziono zina.');
  const images: StoredImage[] = [];
  let missingImages = 0;
  for (const id of imageIdsOfZine(zine)) {
    const image = await getImage(db, id);
    if (image) images.push(image);
    else missingImages++;
  }
  const fontFamilies: FontFamily[] = [];
  const fontFiles: FontFile[] = [];
  for (const familyId of zine.fonts) {
    const family = await getFontFamily(db, familyId);
    if (!family) continue;
    fontFamilies.push(family);
    fontFiles.push(...(await fontFilesOfFamily(db, familyId)));
  }
  return { bundle: { zine, images, fontFamilies, fontFiles }, missingImages };
}

/**
 * Font families are shared between zines by id, so an imported family whose id is already taken
 * (maybe changed since the file was saved) gets new ids for itself and its files instead of
 * overwriting it; the zine's font list and texts follow. Files of families not in the bundle are dropped.
 */
async function withFreeFontIds(db: ZiniarzDb, bundle: ZinBundle): Promise<ZinBundle> {
  const familyIds = new Map<string, string>();
  for (const family of bundle.fontFamilies) {
    familyIds.set(family.id, (await getFontFamily(db, family.id)) ? newId() : family.id);
  }
  const fontFiles: FontFile[] = [];
  for (const file of bundle.fontFiles) {
    const familyId = familyIds.get(file.familyId);
    if (familyId === undefined) continue;
    const renamed = familyId !== file.familyId || (await getFontFile(db, file.id)) !== undefined;
    fontFiles.push({ ...file, id: renamed ? newId() : file.id, familyId });
  }
  const remap = (id: string) => familyIds.get(id) ?? id;
  const zine: Zine = {
    ...bundle.zine,
    fonts: bundle.zine.fonts.map(remap),
    spreads: bundle.zine.spreads.map((spread) => ({
      ...spread,
      elements: spread.elements.map((e) => (e.kind === 'text' ? { ...e, fontFamilyId: remap(e.fontFamilyId) } : e)),
    })),
  };
  const fontFamilies = bundle.fontFamilies.map((family) => ({ ...family, id: remap(family.id) }));
  return { ...bundle, zine, fontFamilies, fontFiles };
}

/** Stores an imported bundle without changing anything already in the database. */
export async function importBundle(db: ZiniarzDb, imported: ZinBundle): Promise<Zine> {
  const bundle = await withFreeFontIds(db, imported);
  for (const image of bundle.images) await putImage(db, image);
  for (const family of bundle.fontFamilies) await putFontFamily(db, family);
  for (const file of bundle.fontFiles) await putFontFile(db, file);
  await saveZine(db, bundle.zine);
  return bundle.zine;
}
