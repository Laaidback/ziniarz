import { BLEED, PAGE_HEIGHT, PAGE_WIDTH, SPREAD_WIDTH, type Rect } from '../model/geometry';
import type { PrintSettings } from '../model/types';

export const A4_LANDSCAPE = { width: 297, height: 210 } as const;
/** Space reserved outside the bleed for crop or fold marks. */
export const MARK_BAND = 5;

export type PrintLayoutOptions = Pick<PrintSettings, 'bleed' | 'cropMarks' | 'foldMarks'>;

export interface PrintLayout {
  /** Bleed on the sheet, mm (0 when bleed is off). */
  bleed: number;
  markBand: number;
  /** Trimmed pair of pages (the A5 leaf) on the sheet, mm. */
  spread: Rect;
  trimPage: { width: number; height: number };
}

/**
 * The A5 leaf (two A6 pages) at 100% in the middle of an A4 landscape sheet. More than
 * 20 mm of paper stays around the bleed and marks, so every home printer prints it whole.
 */
export function printLayout(o: PrintLayoutOptions): PrintLayout {
  return {
    bleed: o.bleed ? BLEED : 0,
    markBand: o.cropMarks || o.foldMarks ? MARK_BAND : 0,
    spread: {
      x: (A4_LANDSCAPE.width - SPREAD_WIDTH) / 2,
      y: (A4_LANDSCAPE.height - PAGE_HEIGHT) / 2,
      width: SPREAD_WIDTH,
      height: PAGE_HEIGHT,
    },
    trimPage: { width: PAGE_WIDTH, height: PAGE_HEIGHT },
  };
}
