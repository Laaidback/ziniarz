import { createSpread } from './factory';
import { MAX_SHEETS, MIN_SHEETS, pageCount } from './geometry';
import type { PageStyle, Zine } from './types';

export interface SheetRemoval {
  spreads: [number, number];
  pages: number[];
}

const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(value, high));

function remapPages(
  pages: Record<number, PageStyle>,
  map: (page: number) => number | null,
): Record<number, PageStyle> {
  const result: Record<number, PageStyle> = {};
  for (const [key, style] of Object.entries(pages)) {
    const target = map(Number(key));
    if (target !== null) result[target] = style;
  }
  return result;
}

export function canAddSheet(zine: Zine): boolean {
  return zine.sheets < MAX_SHEETS;
}

/** Inserts 4 empty pages after the current spread, never before the inside covers. */
export function addSheet(zine: Zine, currentSpread: number, now = new Date()): Zine {
  if (!canAddSheet(zine)) return zine;
  const half = pageCount(zine.sheets) / 2;
  const j = clamp(currentSpread, 1, Math.max(1, half - 2));
  const firstMoved = 2 * j + 2;
  return {
    ...zine,
    sheets: zine.sheets + 1,
    spreads: [...zine.spreads.slice(0, j + 1), createSpread(), createSpread(), ...zine.spreads.slice(j + 1)],
    pages: remapPages(zine.pages, (p) => (p >= firstMoved ? p + 4 : p)),
    updatedAt: now.toISOString(),
  };
}

/** Which two spreads "− kartka" would remove, or null when the zine has one sheet. */
export function sheetRemoval(zine: Zine, currentSpread: number): SheetRemoval | null {
  if (zine.sheets <= MIN_SHEETS) return null;
  const half = pageCount(zine.sheets) / 2;
  const j = Math.max(2, Math.min(currentSpread, half - 3));
  return { spreads: [j, j + 1], pages: [2 * j, 2 * j + 1, 2 * j + 2, 2 * j + 3] };
}

export function removalNeedsConfirmation(zine: Zine, removal: SheetRemoval): boolean {
  return (
    removal.spreads.some((s) => zine.spreads[s].elements.length > 0) ||
    removal.pages.some((p) => zine.pages[p] !== undefined)
  );
}

export function removeSheet(zine: Zine, currentSpread: number, now = new Date()): Zine {
  const removal = sheetRemoval(zine, currentSpread);
  if (!removal) return zine;
  const [first, second] = removal.spreads;
  const lastRemovedPage = removal.pages[3];
  return {
    ...zine,
    sheets: zine.sheets - 1,
    spreads: zine.spreads.filter((_, i) => i !== first && i !== second),
    pages: remapPages(zine.pages, (p) => {
      if (removal.pages.includes(p)) return null;
      return p > lastRemovedPage ? p - 4 : p;
    }),
    updatedAt: now.toISOString(),
  };
}
