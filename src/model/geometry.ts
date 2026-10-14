import type { Frame, Side } from './types';

export const PAGE_WIDTH = 148;
export const PAGE_HEIGHT = 210;
export const SPREAD_WIDTH = PAGE_WIDTH * 2;
export const BLEED = 3;
export const MIN_SHEETS = 1;
export const MAX_SHEETS = 20;

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PageSlot {
  spread: number;
  side: Side;
}

export function pageCount(sheets: number): number {
  return sheets * 4;
}

export function spreadCount(sheets: number): number {
  return sheets * 2 + 1;
}

export function slotOfPage(page: number): PageSlot {
  return { spread: Math.floor(page / 2), side: page % 2 === 0 ? 'left' : 'right' };
}

export function pageAt(spread: number, side: Side): number {
  return spread * 2 + (side === 'left' ? 0 : 1);
}

export function pageExists(page: number, sheets: number): boolean {
  return page >= 1 && page <= pageCount(sheets);
}

export function pagesOfSpread(spread: number, sheets: number): number[] {
  return [pageAt(spread, 'left'), pageAt(spread, 'right')].filter((p) => pageExists(p, sheets));
}

/** Page rectangle in spread coordinates, grown by `bleed` on the outer edges (never at the spine). */
export function pageRect(side: Side, bleed: number): Rect {
  return {
    // `0 - bleed` instead of `-bleed` avoids -0 when bleed is 0.
    x: side === 'left' ? 0 - bleed : PAGE_WIDTH,
    y: 0 - bleed,
    width: PAGE_WIDTH + bleed,
    height: PAGE_HEIGHT + 2 * bleed,
  };
}

/** Axis-aligned bounds of a frame rotated around its centre. */
export function frameBounds(f: Frame): Rect {
  const rad = (f.rotation * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  const width = f.width * cos + f.height * sin;
  const height = f.width * sin + f.height * cos;
  const cx = f.x + f.width / 2;
  const cy = f.y + f.height / 2;
  return { x: cx - width / 2, y: cy - height / 2, width, height };
}

/** Existing pages whose trimmed area overlaps the frame. */
export function pagesOfFrame(spread: number, f: Frame, sheets: number): number[] {
  const b = frameBounds(f);
  return pagesOfSpread(spread, sheets).filter((page) => {
    const r = pageRect(slotOfPage(page).side, 0);
    return b.x < r.x + r.width && b.x + b.width > r.x && b.y < r.y + r.height && b.y + b.height > r.y;
  });
}
