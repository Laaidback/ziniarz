import { loadFontChoices } from '../fonts/catalogue';
import type { FontChoice } from '../fonts/fontChoices';
import { ensureFontsReady, registerZineFonts } from '../fonts/fontLoader';
import { parseZine } from '../model/parse';
import type { Zine } from '../model/types';
import { loadRenderAssets, type RenderAssets } from '../render/assets';
import { getImage, loadZine, type ZiniarzDb } from '../storage/db';
import { whenSavesSettled } from './state/autosave';

export class ZineNotFoundError extends Error {
  constructor() {
    super('Nie znaleziono tego zina. Może został usunięty.');
    this.name = 'ZineNotFoundError';
  }
}

/** A zine ready to draw: parsed, fonts registered and loaded, photos decoded. */
export interface ZineView {
  zine: Zine;
  assets: RenderAssets;
}

export interface EditorSession extends ZineView {
  fonts: FontChoice[];
}

/**
 * Loads a zine for drawing (editor, print screen, 3D preview). Stored data goes through parseZine.
 * Waits for saves still running (editor → Druk → editor) so it never loads an older version.
 */
export async function openZineView(db: ZiniarzDb, zineId: string): Promise<ZineView> {
  await whenSavesSettled();
  const raw = await loadZine(db, zineId);
  if (!raw) throw new ZineNotFoundError();
  const zine = parseZine(raw);
  await registerZineFonts(db, zine);
  await ensureFontsReady(zine);
  const assets = await loadRenderAssets(zine, (id) => getImage(db, id));
  return { zine, assets };
}

/** Everything the editor needs before it shows a zine. */
export async function openEditorSession(db: ZiniarzDb, zineId: string): Promise<EditorSession> {
  const view = await openZineView(db, zineId);
  const fonts = await loadFontChoices(db, view.zine);
  return { ...view, fonts };
}
