import { createZine } from '../model/factory';
import { newId } from '../model/ids';
import { parseZine } from '../model/parse';
import type { Zine } from '../model/types';
import { fileSlug } from '../print/fileName';
import { deleteZine, listZines, saveZine, type ZiniarzDb } from '../storage/db';
import { bundleFromDb, importBundle, readZin, writeZin } from '../storage/zinFile';

export const DEFAULT_SHEETS = 5;

/** Zines for the list, last changed first. Stored data always goes through parseZine (defaults, versions). */
export async function listZinesForHome(db: ZiniarzDb): Promise<{ zines: Zine[]; unreadable: number }> {
  const zines: Zine[] = [];
  let unreadable = 0;
  for (const raw of await listZines(db)) {
    try {
      zines.push(parseZine(raw));
    } catch {
      unreadable++;
    }
  }
  zines.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return { zines, unreadable };
}

export async function createNewZine(db: ZiniarzDb, title: string, sheets: number): Promise<Zine> {
  const zine = createZine(title.trim() || 'Bez tytułu', sheets);
  await saveZine(db, zine);
  return zine;
}

/** A copy with new ids. Photos and fonts are shared by id, so nothing is copied in the database. */
export function copyOfZine(zine: Zine, now = new Date()): Zine {
  const stamp = now.toISOString();
  const copy = structuredClone(zine);
  return {
    ...copy,
    id: newId(),
    title: `${zine.title} (kopia)`,
    spreads: copy.spreads.map((spread) => ({
      id: newId(),
      elements: spread.elements.map((element) => ({ ...element, id: newId() })),
    })),
    createdAt: stamp,
    updatedAt: stamp,
  };
}

export async function duplicateZine(db: ZiniarzDb, zine: Zine): Promise<Zine> {
  const copy = copyOfZine(zine);
  await saveZine(db, copy);
  return copy;
}

export async function removeZine(db: ZiniarzDb, id: string): Promise<void> {
  await deleteZine(db, id);
}

export async function exportZinFile(db: ZiniarzDb, zine: Zine): Promise<{ name: string; blob: Blob }> {
  const bytes = await writeZin(await bundleFromDb(db, zine.id));
  // JSZip returns a Uint8Array over a plain ArrayBuffer.
  return { name: `${fileSlug(zine.title)}.zin`, blob: new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/zip' }) };
}

/** Reading a .zin always creates a new zine (new id); it never overwrites one. */
export async function importZinFile(db: ZiniarzDb, file: Blob): Promise<Zine> {
  return importBundle(db, await readZin(await file.arrayBuffer()));
}
