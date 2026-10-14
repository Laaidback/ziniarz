import { pageCount } from '../model/geometry';

export type SheetFace = 'front' | 'back';

export interface SheetSide {
  sheet: number;
  face: SheetFace;
  /** Page on the left half of the landscape A4 sheet. */
  left: number;
  /** Page on the right half. */
  right: number;
}

/**
 * Saddle-stitch imposition in print order: front 0, back 0, front 1, back 1, ...
 * The back assumes the sheet is turned left-to-right (duplex "flip on short edge").
 */
export function sheetSides(sheets: number): SheetSide[] {
  const total = pageCount(sheets);
  const sides: SheetSide[] = [];
  for (let k = 0; k < sheets; k++) {
    sides.push({ sheet: k, face: 'front', left: total - 2 * k, right: 2 * k + 1 });
    sides.push({ sheet: k, face: 'back', left: 2 * k + 2, right: total - 2 * k - 1 });
  }
  return sides;
}
