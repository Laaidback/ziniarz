import type Konva from 'konva';
import { BLEED, PAGE_HEIGHT, pageRect, slotOfPage, SPREAD_WIDTH, type Rect } from '../model/geometry';
import type { Zine } from '../model/types';
import type { RenderAssets } from './assets';
import { buildSpreadGroup } from './buildSpread';
import { buildGuidesGroup } from './guides';
import { drawToCanvas } from './konvaCanvas';

export interface RenderOptions {
  pxPerMm: number;
}

export interface PixelSize {
  width: number;
  height: number;
}

export interface SpreadRenderOptions extends RenderOptions {
  /** Bleed, margin and spine lines (editor look). */
  guides?: boolean;
}

/** Nodes drawn on top of the spread, in spread mm; gets the final pixels per mm. */
type Overlays = (pxPerMm: number) => Konva.Group[];

/**
 * Draws `region` so that it fills the canvas exactly, edge to edge. The canvas
 * has whole-pixel dimensions (by default the region at `pxPerMm`, rounded) and
 * the drawing is stretched by the sub-pixel rounding difference, so no edge
 * column or row is left partly transparent.
 */
function renderRegion(
  zine: Zine,
  spread: number,
  assets: RenderAssets,
  region: Rect,
  pxPerMm: number,
  size?: PixelSize,
  overlays?: Overlays,
) {
  const width = size?.width ?? Math.round(region.width * pxPerMm);
  const height = size?.height ?? Math.round(region.height * pxPerMm);
  const scaleX = width / region.width;
  const scaleY = height / region.height;
  return drawToCanvas(width, height, (layer) => {
    const group = buildSpreadGroup(zine, spread, assets);
    group.position({ x: -region.x * scaleX, y: -region.y * scaleY });
    group.scale({ x: scaleX, y: scaleY });
    for (const overlay of overlays?.(scaleX) ?? []) group.add(overlay);
    layer.add(group);
  });
}

/**
 * One page cut from its spread: bleed only on outer edges, a clean cut at the spine.
 * `sizePx` forces exact canvas dimensions (the imposed sheet uses it so both pages
 * meet on the same whole-pixel column at the fold).
 */
export function renderPage(
  zine: Zine,
  page: number,
  assets: RenderAssets,
  options: RenderOptions & { bleed: boolean; sizePx?: PixelSize },
): HTMLCanvasElement {
  const { spread, side } = slotOfPage(page, zine.sheets);
  const region = pageRect(side, options.bleed ? BLEED : 0);
  return renderRegion(zine, spread, assets, region, options.pxPerMm, options.sizePx);
}

/** Whole spread with bleed on all sides (thumbnails), optionally with guides. */
export function renderSpread(
  zine: Zine,
  spread: number,
  assets: RenderAssets,
  options: SpreadRenderOptions,
): HTMLCanvasElement {
  const region = { x: -BLEED, y: -BLEED, width: SPREAD_WIDTH + 2 * BLEED, height: PAGE_HEIGHT + 2 * BLEED };
  const overlays: Overlays = (pxPerMm) => (options.guides ? [buildGuidesGroup(zine, spread, pxPerMm)] : []);
  return renderRegion(zine, spread, assets, region, options.pxPerMm, undefined, overlays);
}
