import { newId } from '../model/ids';
import type { Zine } from '../model/types';
import {
  deleteFontFamilies,
  deleteFontFile,
  fontFilesOfFamily,
  getFontFamily,
  putFontFamily,
  putFontFile,
  type FontFile,
  type ZiniarzDb,
} from '../storage/db';
import { FontImportError, registerFontFile, unregisterFontFile } from './fontLoader';
import { describeFontFile, fontMime, groupByFamily, type FontDescription } from './fontNames';

export interface FontImportResult {
  /** Families that got at least one file; add them to `Zine.fonts`. */
  familyIds: string[];
  /** Files that are not fonts (wrong extension or the browser cannot load them). */
  skipped: number;
}

interface Upload {
  description: FontDescription;
  data: ArrayBuffer;
}

/**
 * Saves uploaded font files for a zine, grouped into families by family name. A name the zine
 * already has (any case) adds files to that family; a file with the same bold/italic replaces the
 * older one. Throws StorageFullError when the browser is out of space.
 */
export async function importFontFiles(db: ZiniarzDb, zine: Zine, files: File[]): Promise<FontImportResult> {
  let skipped = 0;
  const uploads: Upload[] = [];
  for (const file of files) {
    if (!fontMime(file.name)) {
      skipped++;
      continue;
    }
    const data = await file.arrayBuffer();
    const description = describeFontFile(file.name, data);
    if (description) uploads.push({ description, data });
    else skipped++;
  }

  const existing = new Map<string, string>();
  for (const id of zine.fonts) {
    const family = await getFontFamily(db, id);
    if (family) existing.set(family.name.toLowerCase(), family.id);
  }

  const familyIds: string[] = [];
  for (const [key, group] of groupByFamily(uploads)) {
    const isNew = !existing.has(key);
    const familyId = existing.get(key) ?? newId();
    if (isNew) await putFontFamily(db, { id: familyId, name: group[0].description.family });
    let current = await fontFilesOfFamily(db, familyId);
    let added = 0;
    for (const upload of group) {
      const { bold, italic, mime } = upload.description;
      const file: FontFile = { id: newId(), familyId, bold, italic, mime, data: upload.data };
      try {
        await registerFontFile(file);
      } catch (error) {
        if (!(error instanceof FontImportError)) throw error;
        skipped++;
        continue;
      }
      try {
        await putFontFile(db, file);
      } catch (error) {
        unregisterFontFile(file.id);
        throw error;
      }
      for (const old of current.filter((f) => f.bold === bold && f.italic === italic)) {
        await deleteFontFile(db, old.id);
        unregisterFontFile(old.id);
      }
      current = [...current.filter((f) => f.bold !== bold || f.italic !== italic), file];
      added++;
    }
    if (added > 0) familyIds.push(familyId);
    else if (isNew) await deleteFontFamilies(db, [familyId]);
  }
  return { familyIds, skipped };
}
