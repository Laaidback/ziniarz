import { BLEED, PAGE_HEIGHT, pageRect, slotOfPage, SPREAD_WIDTH, type Rect } from '../model/geometry';
import type { Zine } from '../model/types';
import type { RenderAssets } from './assets';
import { buildSpreadGroup } from './buildSpread';
import { drawToCanvas } from './konvaCanvas';

export interface RenderOptions {
  pxPerMm: number;
}

function renderRegion(zine: Zine, spread: number, assets: RenderAssets, region: Rect, pxPerMm: number) {
  return drawToCanvas(Math.round(region.width * pxPerMm), Math.round(region.height * pxPerMm), (layer) => {
    const group = buildSpreadGroup(zine, spread, assets);
    group.position({ x: -region.x * pxPerMm, y: -region.y * pxPerMm });
    group.scale({ x: pxPerMm, y: pxPerMm });
    layer.add(group);
  });
}

/** One page cut from its spread: bleed only on outer edges, a clean cut at the spine. */
export function renderPage(
  zine: Zine,
  page: number,
  assets: RenderAssets,
  options: RenderOptions & { bleed: boolean },
): HTMLCanvasElement {
  const { spread, side } = slotOfPage(page);
  return renderRegion(zine, spread, assets, pageRect(side, options.bleed ? BLEED : 0), options.pxPerMm);
}

/** Whole spread with bleed on all sides (thumbnails, editor background). */
export function renderSpread(zine: Zine, spread: number, assets: RenderAssets, options: RenderOptions): HTMLCanvasElement {
  const region = { x: -BLEED, y: -BLEED, width: SPREAD_WIDTH + 2 * BLEED, height: PAGE_HEIGHT + 2 * BLEED };
  return renderRegion(zine, spread, assets, region, options.pxPerMm);
}
