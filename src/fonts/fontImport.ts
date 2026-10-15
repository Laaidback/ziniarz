import { newId } from '../model/ids';
import type { Zine } from '../model/types';
import {
  deleteFontFamilies,
  deleteFontFile,
  fontFilesOfFamily,
  getFontFamily,
  listZines,
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
  /**
   * Families borrowed from other zines that this zine now has its own copy of (old id → copy id):
   * swap them in the zine's font list and texts (replaceFontFamilies), in the same undo step.
   */
  replaced: Record<string, string>;
}

interface Upload {
  description: FontDescription;
  data: ArrayBuffer;
}

/** Whether a zine other than `zineId` lists the family, so changing it in place would change that zine too. */
async function usedElsewhere(db: ZiniarzDb, zineId: string, familyId: string): Promise<boolean> {
  return (await listZines(db)).some((z) => z.id !== zineId && Array.isArray(z.fonts) && z.fonts.includes(familyId));
}

/** A new family with the same name and copies of every file (new ids, same bytes), registered for drawing. */
async function copyFamily(db: ZiniarzDb, familyId: string): Promise<{ id: string; files: FontFile[] }> {
  const family = await getFontFamily(db, familyId);
  const id = newId();
  await putFontFamily(db, { id, name: family?.name ?? '' });
  const files: FontFile[] = [];
  for (const original of await fontFilesOfFamily(db, familyId)) {
    const file: FontFile = { ...original, id: newId(), familyId: id };
    await putFontFile(db, file);
    await registerFontFile(file).catch(() => {}); // it loaded before; a file that no longer does is still copied
    files.push(file);
  }
  return { id, files };
}

/**
 * Saves uploaded font files for a zine, grouped into families by family name. A name the zine
 * already has (any case) adds files to that family; a file with the same bold/italic replaces the
 * older one. Families are shared between zines by id (borrowed or duplicated zines), so a family
 * another zine also lists is first copied for this zine (copy-on-write, see `replaced`).
 * Throws StorageFullError when the browser is out of space.
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
  const replaced: Record<string, string> = {};
  for (const [key, group] of groupByFamily(uploads)) {
    const isNew = !existing.has(key);
    const ownFamily = existing.get(key);
    let familyId = ownFamily ?? newId();
    if (isNew) await putFontFamily(db, { id: familyId, name: group[0].description.family });
    let current = await fontFilesOfFamily(db, familyId);
    /** Set once the borrowed family has been copied (just before its first change). */
    let copied: { id: string; files: FontFile[] } | null = null;
    const shared = ownFamily !== undefined && (await usedElsewhere(db, zine.id, ownFamily));
    let added = 0;
    for (const upload of group) {
      const { bold, italic, mime } = upload.description;
      if (shared && !copied) {
        copied = await copyFamily(db, familyId);
        familyId = copied.id;
        current = copied.files;
      }
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
    if (added > 0) {
      familyIds.push(familyId);
      if (copied && ownFamily) replaced[ownFamily] = copied.id;
    } else if (isNew || copied) {
      // Nothing usable was uploaded: drop the new family (or the unneeded copy) again.
      for (const file of copied?.files ?? []) unregisterFontFile(file.id);
      await deleteFontFamilies(db, [familyId]);
    }
  }
  return { familyIds, skipped, replaced };
}
