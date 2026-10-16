import { pageAt, spreadCount } from '../model/geometry';
import type { Zine } from '../model/types';

export function spreadLabel(spread: number, sheets: number): string {
  if (spread === 0) return 'Okładka';
  if (spread === spreadCount(sheets) - 1) return 'Tył';
  return `${pageAt(spread, 'left', sheets)}–${pageAt(spread, 'right', sheets)}`;
}

/** Accessible name of a spread thumbnail: "Okładka", "Strony 2–3", "Tył". */
export function spreadName(spread: number, sheets: number): string {
  const label = spreadLabel(spread, sheets);
  return spread === 0 || spread === spreadCount(sheets) - 1 ? label : `Strony ${label}`;
}

/** Question asked before "− kartka" removes pages that have content. */
export function removalMessage(pages: number[]): string {
  return `Strony ${pages[0]}–${pages[pages.length - 1]} mają treść, która zniknie. Usunąć kartkę?`;
}

/** Everything a spread thumbnail depends on, as a cache key. */
export function thumbnailKey(zine: Zine, spread: number, version: number): string {
  const left = pageAt(spread, 'left', zine.sheets);
  const right = pageAt(spread, 'right', zine.sheets);
  return JSON.stringify([zine.sheets, zine.pages[left], zine.pages[right], zine.spreads[spread], version]);
}
