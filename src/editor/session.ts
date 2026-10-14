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

export interface EditorSession {
  zine: Zine;
  assets: RenderAssets;
  fonts: FontChoice[];
}

/**
 * Everything the editor needs before it shows a zine. Stored data goes through parseZine.
 * Waits for saves still running (editor → Druk → editor) so it never loads an older version.
 */
export async function openEditorSession(db: ZiniarzDb, zineId: string): Promise<EditorSession> {
  await whenSavesSettled();
  const raw = await loadZine(db, zineId);
  if (!raw) throw new ZineNotFoundError();
  const zine = parseZine(raw);
  await registerZineFonts(db, zine);
  await ensureFontsReady(zine);
  const assets = await loadRenderAssets(zine, (id) => getImage(db, id));
  const fonts = await loadFontChoices(db, zine);
  return { zine, assets, fonts };
}
