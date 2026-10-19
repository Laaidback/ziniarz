import { countOf } from '../app/plural';
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
  const spreads = copy.spreads.map((spread) => ({
    id: newId(),
    elements: spread.elements.map((element) => ({ ...element, id: newId() })),
  }));
  // Spread notes are keyed by spread id: they follow their spreads to the new ids.
  const spreadNotes: Record<string, string> = {};
  copy.spreads.forEach((spread, i) => {
    const notes = copy.spreadNotes[spread.id];
    if (notes !== undefined) spreadNotes[spreads[i].id] = notes;
  });
  return {
    ...copy,
    id: newId(),
    title: `${zine.title} (kopia)`,
    spreads,
    spreadNotes,
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

/** The .zin file of a zine; `missingImages` counts photos missing from the browser, left out as empty frames. */
export async function exportZinFile(db: ZiniarzDb, zine: Zine): Promise<{ name: string; blob: Blob; missingImages: number }> {
  const { bundle, missingImages } = await bundleFromDb(db, zine.id);
  const bytes = await writeZin(bundle);
  // JSZip returns a Uint8Array over a plain ArrayBuffer.
  const blob = new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/zip' });
  return { name: `${fileSlug(zine.title)}.zin`, blob, missingImages };
}

/** "Brakuje 1 zdjęcia — w pliku będą puste ramki." */
export function missingPhotosText(count: number): string {
  return `Brakuje ${countOf(count, 'zdjęcia', 'zdjęć', 'zdjęć')} — w pliku będą puste ramki.`;
}

/** Reading a .zin always creates a new zine (new id); it never overwrites one. */
export async function importZinFile(db: ZiniarzDb, file: Blob): Promise<Zine> {
  return importBundle(db, await readZin(await file.arrayBuffer()));
}
