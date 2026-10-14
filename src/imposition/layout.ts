import { BLEED, PAGE_HEIGHT, PAGE_WIDTH, SPREAD_WIDTH, type Rect } from '../model/geometry';

export const A4_LANDSCAPE = { width: 297, height: 210 } as const;
/** Space reserved outside the bleed for crop or fold marks (not scaled). */
export const MARK_BAND = 5;

export interface PrintLayoutOptions {
  printerMargin: number;
  bleed: boolean;
  cropMarks: boolean;
  foldMarks: boolean;
}

export interface PrintLayout {
  /** Factor applied to the A5 design so bleed and marks fit the printable area. */
  scale: number;
  /** Bleed on the sheet, in sheet mm (0 when bleed is off). */
  bleed: number;
  markBand: number;
  /** Trimmed pair of pages on the sheet, in sheet mm. */
  spread: Rect;
  trimPage: { width: number; height: number };
}

export function printLayout(o: PrintLayoutOptions): PrintLayout {
  const bleed = o.bleed ? BLEED : 0;
  const markBand = o.cropMarks || o.foldMarks ? MARK_BAND : 0;
  const reserve = 2 * o.printerMargin + 2 * markBand;
  const scale = Math.min(
    1,
    (A4_LANDSCAPE.width - reserve) / (SPREAD_WIDTH + 2 * bleed),
    (A4_LANDSCAPE.height - reserve) / (PAGE_HEIGHT + 2 * bleed),
  );
  const width = SPREAD_WIDTH * scale;
  const height = PAGE_HEIGHT * scale;
  return {
    scale,
    bleed: bleed * scale,
    markBand,
    spread: { x: (A4_LANDSCAPE.width - width) / 2, y: (A4_LANDSCAPE.height - height) / 2, width, height },
    trimPage: { width: PAGE_WIDTH * scale, height },
  };
}
