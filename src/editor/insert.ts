import { errorMessage, notify } from '../app/notices';
import { ImageImportError, prepareImage } from '../images/prepareImage';
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

/**
 * Adds photos to the current spread. Each fills the margin area of `page` keeping its proportions;
 * further photos of the same drop step 5 mm aside. Files that are not images are skipped and counted.
 */
export async function insertPhotos(env: Pick<EditorEnv, 'db' | 'store' | 'assets'>, files: File[], page: number | null): Promise<void> {
  const { db, store, assets } = env;
  const area = insertArea(selectZine(store.getState()), targetPage(store, page));
  let placed = 0;
  let skipped = 0;
  for (const file of files) {
    let image: StoredImage;
    try {
      image = await prepareImage(file);
    } catch (error) {
      if (!(error instanceof ImageImportError)) throw error;
      skipped++;
      continue;
    }
    try {
      await putImage(db, image);
    } catch (error) {
      notify(errorMessage(error));
      break;
    }
    assets.images.set(image.id, await bitmapOf(image));
    store.getState().assetsChanged();
    store.getState().addElement(createPhotoElement(image.id, cascade(fitPhotoFrame(area, image.width, image.height), placed++)));
  }
  if (skipped > 0) notify(`Pominięto plików: ${skipped} (to nie są obrazy).`);
}

/** "+ Napis": a frame from margin to margin of the page, selected and ready for typing. */
export function insertText(store: EditorStore): void {
  const zine = selectZine(store.getState());
  const frame = newTextFrame(zine, targetPage(store, null));
  store.getState().addElement(createTextElement({ ...frame, text: NEW_TEXT }));
  store.getState().setMode('text');
}
