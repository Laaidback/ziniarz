import type { Frame, Margins, Side } from './types';

export const PAGE_WIDTH = 105;
export const PAGE_HEIGHT = 148;
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

/** Spread 0 is the outside cover; spreads 1 … 2 · sheets − 1 are the inside pages. */
export function spreadCount(sheets: number): number {
  return sheets * 2;
}

/** Side of its spread a page sits on: even pages on the left (the back cover P too), odd on the right. */
export function sideOfPage(page: number): Side {
  return page % 2 === 0 ? 'left' : 'right';
}

/** Spread 0 holds the back cover P (left) and the front cover 1 (right); spread i ≥ 1 holds 2i | 2i + 1. */
export function slotOfPage(page: number, sheets: number): PageSlot {
  return { spread: page === pageCount(sheets) ? 0 : Math.floor(page / 2), side: sideOfPage(page) };
}

export function pageAt(spread: number, side: Side, sheets: number): number {
  if (spread === 0 && side === 'left') return pageCount(sheets);
  return spread * 2 + (side === 'left' ? 0 : 1);
}

export function pageExists(page: number, sheets: number): boolean {
  return page >= 1 && page <= pageCount(sheets);
}

/** Both pages of a spread, left first. Every spread has two. */
export function pagesOfSpread(spread: number, sheets: number): number[] {
  return [pageAt(spread, 'left', sheets), pageAt(spread, 'right', sheets)];
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

/** Area between the margins of a page, in spread coordinates. Never negative. */
export function marginRect(margins: Margins, side: Side): Rect {
  const left = side === 'left' ? margins.outer : PAGE_WIDTH + margins.inner;
  return {
    x: left,
    y: margins.top,
    width: Math.max(0, PAGE_WIDTH - margins.outer - margins.inner),
    height: Math.max(0, PAGE_HEIGHT - margins.top - margins.bottom),
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
    const r = pageRect(sideOfPage(page), 0);
    return b.x < r.x + r.width && b.x + b.width > r.x && b.y < r.y + r.height && b.y + b.height > r.y;
  });
}
