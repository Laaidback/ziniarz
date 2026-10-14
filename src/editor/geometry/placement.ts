import {
  BLEED,
  marginRect,
  PAGE_HEIGHT,
  PAGE_WIDTH,
  pageAt,
  pageExists,
  pageRect,
  pagesOfSpread,
  slotOfPage,
  SPREAD_WIDTH,
  type Rect,
} from '../../model/geometry';
import type { Frame, Zine } from '../../model/types';

/** Each further photo of one drop or paste lands this many mm lower and to the right. */
export const CASCADE_STEP = 5;
/** Margin areas smaller than this fall back to the whole page. */
const MIN_AREA = 10;

/** The existing page under a point in spread mm (the bleed counts as the page), or null. */
export function pageAtPoint(spread: number, sheets: number, x: number, y: number): number | null {
  if (x < -BLEED || x > SPREAD_WIDTH + BLEED || y < -BLEED || y > PAGE_HEIGHT + BLEED) return null;
  const page = pageAt(spread, x < PAGE_WIDTH ? 'left' : 'right');
  return pageExists(page, sheets) ? page : null;
}

/** Where "+ Zdjęcie" and "+ Napis" go when no page was clicked: the first existing page of the spread. */
export function defaultPage(spread: number, sheets: number): number {
  return pagesOfSpread(spread, sheets)[0];
}

/** Area new photos and texts fill: between the margins, or the whole page when the margins leave too little. */
export function insertArea(zine: Zine, page: number): Rect {
  const side = slotOfPage(page).side;
  const area = marginRect(zine.margins, side);
  return area.width >= MIN_AREA && area.height >= MIN_AREA ? area : pageRect(side, 0);
}

/** The largest frame with the image's proportions inside `area`, centred. */
export function fitPhotoFrame(area: Rect, imageWidth: number, imageHeight: number): Rect {
  const scale = Math.min(area.width / imageWidth, area.height / imageHeight);
  const width = imageWidth * scale;
  const height = imageHeight * scale;
  return { x: area.x + (area.width - width) / 2, y: area.y + (area.height - height) / 2, width, height };
}

/** A new text frame: from margin to margin of the page, at the top margin. Height comes from the text. */
export function newTextFrame(zine: Zine, page: number): { x: number; y: number; width: number } {
  const area = insertArea(zine, page);
  return { x: area.x, y: area.y, width: area.width };
}

export function cascade<T extends { x: number; y: number }>(rect: T, index: number): T {
  return { ...rect, x: rect.x + index * CASCADE_STEP, y: rect.y + index * CASCADE_STEP };
}

/** Frame from its centre (Konva nodes are positioned by their centre), size and rotation. */
export function frameFromCentre(cx: number, cy: number, width: number, height: number, rotation: number): Omit<Frame, 'id'> {
  return { x: cx - width / 2, y: cy - height / 2, width, height, rotation };
}
