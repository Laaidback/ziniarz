import type { SheetSide } from '../imposition/imposition';
import { A4_LANDSCAPE, type PrintLayout } from '../imposition/layout';
import { cropMarks, foldMarks, MARK_STROKE, type Segment } from '../imposition/marks';
import type { Zine } from '../model/types';
import type { RenderAssets } from '../render/assets';
import { releaseCanvas } from '../render/canvasBytes';
import { renderPage } from '../render/renderPage';

export const PRINT_DPI = 300;

export function mmToPx(dpi: number): number {
  return dpi / 25.4;
}

export interface SheetSideOptions {
  dpi: number;
  cropMarks: boolean;
  foldMarks: boolean;
  rotate180: boolean;
}

/** One side of an A4 landscape sheet: two pages from the imposition at 100%, plus marks. */
export function renderSheetSide(
  zine: Zine,
  side: SheetSide,
  assets: RenderAssets,
  layout: PrintLayout,
  options: SheetSideOptions,
): HTMLCanvasElement {
  const k = mmToPx(options.dpi);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(A4_LANDSCAPE.width * k);
  canvas.height = Math.round(A4_LANDSCAPE.height * k);
  const ctx = canvas.getContext('2d')!;
  if (options.rotate180) ctx.setTransform(-1, 0, 0, -1, canvas.width, canvas.height);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Page edges on whole pixels, the fold computed once and shared by both pages:
  // canvases drawn at fractional positions get snapped or antialiased by the
  // browser, which left a white column at the fold.
  const { spread, bleed, trimPage } = layout;
  const x0 = Math.round((spread.x - bleed) * k);
  const fold = Math.round((spread.x + trimPage.width) * k);
  const x1 = Math.round((spread.x + spread.width + bleed) * k);
  const y0 = Math.round((spread.y - bleed) * k);
  const y1 = Math.round((spread.y + spread.height + bleed) * k);
  const placements: [number, number, number][] = [
    [side.left, x0, fold - x0],
    [side.right, fold, x1 - fold],
  ];
  for (const [page, left, width] of placements) {
    const pageCanvas = renderPage(zine, page, assets, {
      pxPerMm: k,
      bleed: bleed > 0,
      sizePx: { width, height: y1 - y0 },
    });
    ctx.drawImage(pageCanvas, left, y0);
    releaseCanvas(pageCanvas);
  }

  const segments: Segment[] = [
    ...(options.cropMarks ? cropMarks(layout) : []),
    ...(options.foldMarks ? foldMarks(layout) : []),
  ];
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = MARK_STROKE * k;
  ctx.beginPath();
  for (const s of segments) {
    ctx.moveTo(s.x1 * k, s.y1 * k);
    ctx.lineTo(s.x2 * k, s.y2 * k);
  }
  ctx.stroke();
  return canvas;
}
