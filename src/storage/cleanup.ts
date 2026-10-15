import { imageIdsOfZine } from '../model/queries';
import type { Zine } from '../model/types';
import {
  deleteFontFamilies,
  deleteFontFiles,
  deleteImages,
  listFontFamilyIds,
  listFontFileFamilies,
  listImageIds,
  listZines,
  type ZiniarzDb,
} from './db';

/**
 * Images no photo uses, families on no zine's font list, and font files whose family record is
 * gone (an interrupted upload or deletion); the unused families' own files go with them.
 */
export function unusedAssets(
  zines: Zine[],
  imageIds: string[],
  familyIds: string[],
  fontFiles: { id: string; familyId: string }[],
) {
  const usedImages = new Set(zines.flatMap((z) => [...imageIdsOfZine(z)]));
  const usedFamilies = new Set(zines.flatMap((z) => z.fonts));
  const families = new Set(familyIds);
  return {
    images: imageIds.filter((id) => !usedImages.has(id)),
    fontFamilies: familyIds.filter((id) => !usedFamilies.has(id)),
    fontFiles: fontFiles.filter((file) => !families.has(file.familyId)).map((file) => file.id),
  };
}

/** Call only from the zine list screen, never while a zine is being edited (see whenNoZineIsOpen). */
export async function pruneUnusedAssets(db: ZiniarzDb): Promise<{ images: number; fontFamilies: number; fontFiles: number }> {
  const unused = unusedAssets(await listZines(db), await listImageIds(db), await listFontFamilyIds(db), await listFontFileFamilies(db));
  await deleteImages(db, unused.images);
  await deleteFontFamilies(db, unused.fontFamilies);
  await deleteFontFiles(db, unused.fontFiles);
  return { images: unused.images.length, fontFamilies: unused.fontFamilies.length, fontFiles: unused.fontFiles.length };
}
