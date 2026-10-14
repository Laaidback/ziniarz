import { ensureFontsReady, registerZineFonts } from '../fonts/fontLoader';
import type { Zine } from '../model/types';
import { loadRenderAssets, releaseRenderAssets } from '../render/assets';
import { releaseCanvas } from '../render/canvasBytes';
import { renderPage } from '../render/renderPage';
import { getImage, type ZiniarzDb } from '../storage/db';

export const COVER_PX_PER_MM = 1.5;

/** Page 1 as a PNG data URL for the zine list. Loads only the cover's photos. */
export async function renderCoverThumbnail(db: ZiniarzDb, zine: Zine): Promise<string> {
  await registerZineFonts(db, zine);
  await ensureFontsReady(zine);
  const assets = await loadRenderAssets(zine, (id) => getImage(db, id), [0]);
  try {
    const canvas = renderPage(zine, 1, assets, { pxPerMm: COVER_PX_PER_MM, bleed: false });
    const url = canvas.toDataURL('image/png');
    releaseCanvas(canvas);
    return url;
  } finally {
    releaseRenderAssets(assets);
  }
}
