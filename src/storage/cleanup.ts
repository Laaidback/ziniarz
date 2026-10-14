import { imageIdsOfZine } from '../model/queries';
import type { Zine } from '../model/types';
import { deleteFontFamilies, deleteImages, listFontFamilyIds, listImageIds, listZines, type ZiniarzDb } from './db';

export function unusedAssets(zines: Zine[], imageIds: string[], familyIds: string[]) {
  const usedImages = new Set(zines.flatMap((z) => [...imageIdsOfZine(z)]));
  const usedFamilies = new Set(zines.flatMap((z) => z.fonts));
  return {
    images: imageIds.filter((id) => !usedImages.has(id)),
    fontFamilies: familyIds.filter((id) => !usedFamilies.has(id)),
  };
}

/** Call only from the zine list screen, never while a zine is being edited. */
export async function pruneUnusedAssets(db: ZiniarzDb): Promise<{ images: number; fontFamilies: number }> {
  const unused = unusedAssets(await listZines(db), await listImageIds(db), await listFontFamilyIds(db));
  await deleteImages(db, unused.images);
  await deleteFontFamilies(db, unused.fontFamilies);
  return { images: unused.images.length, fontFamilies: unused.fontFamilies.length };
}
