import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Zine } from '../model/types';

export interface StoredImage {
  id: string;
  mime: string;
  width: number;
  height: number;
  data: ArrayBuffer;
}

export interface FontFamily {
  id: string;
  name: string;
}

export interface FontFile {
  id: string;
  familyId: string;
  bold: boolean;
  italic: boolean;
  mime: string;
  data: ArrayBuffer;
}

/** A zine saved to a file on Google Drive (src/cloud/links.ts). Never part of the zine's JSON. */
export interface DriveLink {
  zineId: string;
  fileId: string;
  /** The file's Drive `version` at the last upload or download. */
  version: string;
  /** The zine's `updatedAt` at the last upload or download: a different one means unsent changes. */
  syncedUpdatedAt: string;
  /** Who changed the file last and when, as Drive reported at the last sync. */
  modifiedTime: string;
  modifiedBy: string | null;
  modifiedByMe: boolean;
}

interface ZiniarzSchema extends DBSchema {
  zines: { key: string; value: Zine };
  images: { key: string; value: StoredImage };
  fontFamilies: { key: string; value: FontFamily };
  fontFiles: { key: string; value: FontFile; indexes: { byFamily: string } };
  driveLinks: { key: string; value: DriveLink; indexes: { byFile: string } };
}

export type ZiniarzDb = IDBPDatabase<ZiniarzSchema>;

export class StorageFullError extends Error {
  constructor() {
    super('Brak miejsca w przeglądarce. Zapisz ziny do plików .zin i usuń stare.');
    this.name = 'StorageFullError';
  }
}

export const DB_NAME = 'ziniarz';

export async function openZiniarzDb(name = DB_NAME): Promise<ZiniarzDb> {
  const db: ZiniarzDb = await openDB<ZiniarzSchema>(name, 2, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        db.createObjectStore('zines', { keyPath: 'id' });
        db.createObjectStore('images', { keyPath: 'id' });
        db.createObjectStore('fontFamilies', { keyPath: 'id' });
        db.createObjectStore('fontFiles', { keyPath: 'id' }).createIndex('byFamily', 'familyId');
      }
      if (oldVersion < 2) db.createObjectStore('driveLinks', { keyPath: 'zineId' }).createIndex('byFile', 'fileId');
    },
    // A newer version of the app opened in another tab waits for this one to let go of the database.
    blocking() {
      db.close();
      if (typeof location !== 'undefined') location.reload();
    },
  });
  return db;
}

async function guarded<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof DOMException && error.name === 'QuotaExceededError') throw new StorageFullError();
    throw error;
  }
}

export async function saveZine(db: ZiniarzDb, zine: Zine): Promise<void> {
  await guarded(() => db.put('zines', zine));
}

export function loadZine(db: ZiniarzDb, id: string): Promise<Zine | undefined> {
  return db.get('zines', id);
}

export function listZines(db: ZiniarzDb): Promise<Zine[]> {
  return db.getAll('zines');
}

/** Deletes the zine and its link to Google Drive (the file on Drive stays). */
export async function deleteZine(db: ZiniarzDb, id: string): Promise<void> {
  const tx = db.transaction(['zines', 'driveLinks'], 'readwrite');
  await Promise.all([tx.objectStore('zines').delete(id), tx.objectStore('driveLinks').delete(id), tx.done]);
}

export async function putImage(db: ZiniarzDb, image: StoredImage): Promise<void> {
  await guarded(() => db.put('images', image));
}

export function getImage(db: ZiniarzDb, id: string): Promise<StoredImage | undefined> {
  return db.get('images', id);
}

export function listImageIds(db: ZiniarzDb): Promise<string[]> {
  return db.getAllKeys('images');
}

export async function deleteImages(db: ZiniarzDb, ids: string[]): Promise<void> {
  const tx = db.transaction('images', 'readwrite');
  await Promise.all([...ids.map((id) => tx.store.delete(id)), tx.done]);
}

export async function putFontFamily(db: ZiniarzDb, family: FontFamily): Promise<void> {
  await guarded(() => db.put('fontFamilies', family));
}

export function getFontFamily(db: ZiniarzDb, id: string): Promise<FontFamily | undefined> {
  return db.get('fontFamilies', id);
}

export async function putFontFile(db: ZiniarzDb, file: FontFile): Promise<void> {
  await guarded(() => db.put('fontFiles', file));
}

export function getFontFile(db: ZiniarzDb, id: string): Promise<FontFile | undefined> {
  return db.get('fontFiles', id);
}

export function fontFilesOfFamily(db: ZiniarzDb, familyId: string): Promise<FontFile[]> {
  return db.getAllFromIndex('fontFiles', 'byFamily', familyId);
}

export function listFontFamilies(db: ZiniarzDb): Promise<FontFamily[]> {
  return db.getAll('fontFamilies');
}

export async function deleteFontFile(db: ZiniarzDb, id: string): Promise<void> {
  await db.delete('fontFiles', id);
}

/** Every stored font file's id and family, without reading the font data. */
export async function listFontFileFamilies(db: ZiniarzDb): Promise<{ id: string; familyId: string }[]> {
  const files: { id: string; familyId: string }[] = [];
  let cursor = await db.transaction('fontFiles').store.index('byFamily').openKeyCursor();
  while (cursor) {
    files.push({ id: cursor.primaryKey, familyId: cursor.key });
    cursor = await cursor.continue();
  }
  return files;
}

export async function deleteFontFiles(db: ZiniarzDb, ids: string[]): Promise<void> {
  const tx = db.transaction('fontFiles', 'readwrite');
  await Promise.all([...ids.map((id) => tx.store.delete(id)), tx.done]);
}

export function listFontFamilyIds(db: ZiniarzDb): Promise<string[]> {
  return db.getAllKeys('fontFamilies');
}

export async function deleteFontFamilies(db: ZiniarzDb, ids: string[]): Promise<void> {
  const tx = db.transaction(['fontFamilies', 'fontFiles'], 'readwrite');
  const files = tx.objectStore('fontFiles');
  const work: Promise<unknown>[] = [];
  for (const id of ids) {
    work.push(tx.objectStore('fontFamilies').delete(id));
    work.push(
      files.index('byFamily').getAllKeys(id).then((keys) => Promise.all(keys.map((key) => files.delete(key)))),
    );
  }
  await Promise.all([...work, tx.done]);
}
