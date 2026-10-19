import { errorMessage, notify } from '../app/notices';
import { defaultFontFamilyId } from '../fonts/systemFonts';
import { ImageImportError, isHeicFile, prepareImage } from '../images/prepareImage';
import { createPhotoElement, createTextElement } from '../model/factory';
import type { StoredImage } from '../storage/db';
import { putImage } from '../storage/db';
import { bitmapOf } from '../render/assets';
import type { EditorEnv } from './EditorContext';
import { cascade, defaultPage, fitPhotoFrame, insertArea, newTextFrame, pageAtPoint } from './geometry/placement';
import { selectedElement, selectZine, type EditorStore } from './state/store';

export const NEW_TEXT = 'Napis';

/**
 * The page new elements go to: the given one, else the last clicked page, else the existing page under
 * the centre of the selected element, else the first page of the spread.
 */
function targetPage(store: EditorStore, page: number | null): number {
  const state = store.getState();
  const { sheets } = selectZine(state);
  const selected = selectedElement(state);
  const selectedPage = selected
    ? pageAtPoint(state.spread, sheets, selected.x + selected.width / 2, selected.y + selected.height / 2)
    : null;
  return page ?? state.activePage ?? selectedPage ?? defaultPage(state.spread, sheets);
}

export const HEIC_SKIPPED = "Zdjęć HEIC (z iPhone'a) przeglądarka nie odczyta. Zapisz je jako JPG i dodaj jeszcze raz.";

export interface InsertPhotosOptions {
  /** Aborted when the editor closes: stops before the next file and adds nothing more. */
  signal?: AbortSignal;
  /** Called before each file: `current` (1-based) of `total`. */
  onProgress?(current: number, total: number): void;
}

/**
 * Adds photos to the current spread. Each fills the margin area of `page` keeping its proportions;
 * further photos of the same drop step 5 mm aside. Files that are not images are skipped and counted
 * (HEIC photos the browser cannot decode separately, with a hint to save them as JPG).
 */
export async function insertPhotos(
  env: Pick<EditorEnv, 'db' | 'store' | 'assets'>,
  files: File[],
  page: number | null,
  { signal, onProgress }: InsertPhotosOptions = {},
): Promise<void> {
  const { db, store, assets } = env;
  const area = insertArea(selectZine(store.getState()), targetPage(store, page));
  let placed = 0;
  let skipped = 0;
  let heic = 0;
  for (const [index, file] of files.entries()) {
    if (signal?.aborted) return;
    onProgress?.(index + 1, files.length);
    if (signal?.aborted) return;
    let image: StoredImage;
    try {
      image = await prepareImage(file);
    } catch (error) {
      if (!(error instanceof ImageImportError)) throw error;
      if (isHeicFile(file)) heic++;
      else skipped++;
      continue;
    }
    if (signal?.aborted) return;
    try {
      await putImage(db, image);
    } catch (error) {
      notify(errorMessage(error));
      break;
    }
    const bitmap = await bitmapOf(image);
    if (signal?.aborted) {
      bitmap.close(); // the editor is gone: nothing will draw it (the stored image is pruned later)
      return;
    }
    assets.images.set(image.id, bitmap);
    store.getState().assetsChanged();
    store.getState().addElement(createPhotoElement(image.id, cascade(fitPhotoFrame(area, image.width, image.height), placed++)));
  }
  if (heic > 0) notify(HEIC_SKIPPED);
  if (skipped > 0) notify(`Pominięto plików: ${skipped} (to nie są obrazy).`);
}

/** A text frame from margin to margin of the target page, selected (one undo step), in the default font of new texts. */
export function insertTextFrame(store: EditorStore, text: string): void {
  const zine = selectZine(store.getState());
  const frame = newTextFrame(zine, targetPage(store, null));
  store.getState().addElement(createTextElement({ ...frame, text, fontFamilyId: defaultFontFamilyId() }));
}

/** "+ Napis": a new frame, ready for typing. */
export function insertText(store: EditorStore): void {
  insertTextFrame(store, NEW_TEXT);
  store.getState().setMode('text');
}
