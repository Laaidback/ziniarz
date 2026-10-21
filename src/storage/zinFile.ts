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

const sameBytes = (a: ArrayBuffer, b: ArrayBuffer) => {
  if (a.byteLength !== b.byteLength) return false;
  const x = new Uint8Array(a);
  const y = new Uint8Array(b);
  return x.every((value, i) => value === y[i]);
};

/** Whether the stored family has exactly these files (same ids, styles and bytes). */
async function storedFamilyMatches(db: ZiniarzDb, familyId: string, files: FontFile[]): Promise<boolean> {
  const stored = await fontFilesOfFamily(db, familyId);
  if (stored.length !== files.length) return false;
  return files.every((file) => {
    const twin = stored.find((s) => s.id === file.id);
    return twin !== undefined && twin.bold === file.bold && twin.italic === file.italic && sameBytes(twin.data, file.data);
  });
}

/**
 * Font families are shared between zines by id, so an imported family whose id is already taken
 * (maybe changed since the file was saved) gets new ids for itself and its files instead of
 * overwriting it; the zine's font list and texts follow. Files of families not in the bundle are dropped.
 * With `reuseIdentical`, a stored family with exactly the same files keeps its id and is not written again
 * (a zine downloaded again from Google Drive must not collect copies of its fonts).
 */
async function withFreeFontIds(db: ZiniarzDb, bundle: ZinBundle, reuseIdentical = false): Promise<ZinBundle> {
  const familyIds = new Map<string, string>();
  const reused = new Set<string>();
  for (const family of bundle.fontFamilies) {
    if (!(await getFontFamily(db, family.id))) {
      familyIds.set(family.id, family.id);
    } else if (reuseIdentical && (await storedFamilyMatches(db, family.id, bundle.fontFiles.filter((f) => f.familyId === family.id)))) {
      familyIds.set(family.id, family.id);
      reused.add(family.id);
    } else {
      familyIds.set(family.id, newId());
    }
  }
  const fontFiles: FontFile[] = [];
  for (const file of bundle.fontFiles) {
    const familyId = familyIds.get(file.familyId);
    if (familyId === undefined || reused.has(familyId)) continue;
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
  const fontFamilies = bundle.fontFamilies.filter((f) => !reused.has(f.id)).map((family) => ({ ...family, id: remap(family.id) }));
  return { ...bundle, zine, fontFamilies, fontFiles };
}

async function storeBundle(db: ZiniarzDb, bundle: ZinBundle): Promise<Zine> {
  for (const image of bundle.images) await putImage(db, image);
  for (const family of bundle.fontFamilies) await putFontFamily(db, family);
  for (const file of bundle.fontFiles) await putFontFile(db, file);
  await saveZine(db, bundle.zine);
  return bundle.zine;
}

/** Stores an imported bundle without changing anything already in the database. */
export async function importBundle(db: ZiniarzDb, imported: ZinBundle): Promise<Zine> {
  return storeBundle(db, await withFreeFontIds(db, imported));
}

/**
 * Replaces the content of zine `zineId` with a bundle (a newer version from Google Drive). Photos are
 * stored by id (a photo id never changes its picture); font families follow importBundle, except that
 * a stored family with the same files is reused. Photos only the old version used are left for cleanup.
 */
export async function replaceFromBundle(db: ZiniarzDb, zineId: string, bundle: ZinBundle): Promise<Zine> {
  const free = await withFreeFontIds(db, { ...bundle, zine: { ...bundle.zine, id: zineId } }, true);
  return storeBundle(db, free);
}
