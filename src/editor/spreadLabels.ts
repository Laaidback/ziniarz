import { pageAt } from '../model/geometry';
import type { Zine } from '../model/types';

export function spreadLabel(spread: number, sheets: number): string {
  if (spread === 0) return 'Okładka';
  return `${pageAt(spread, 'left', sheets)}–${pageAt(spread, 'right', sheets)}`;
}

/** Accessible name of a spread thumbnail: "Okładka", "Strony 2–3". */
export function spreadName(spread: number, sheets: number): string {
  return spread === 0 ? 'Okładka' : `Strony ${spreadLabel(spread, sheets)}`;
}

/** Question asked before "− kartka" removes pages that have content or notes in the notepad. */
export function removalMessage(pages: number[], lost: { content: boolean; notes: boolean }): string {
  const range = `Strony ${pages[0]}–${pages[pages.length - 1]}`;
  if (!lost.notes) return `${range} mają treść, która zniknie. Usunąć kartkę?`;
  const what = lost.content ? 'treść i notatki w notatniku' : 'notatki w notatniku';
  return `${range} mają ${what}, które znikną. Usunąć kartkę?`;
}

/** Everything a spread thumbnail depends on, as a cache key. */
export function thumbnailKey(zine: Zine, spread: number, version: number): string {
  const left = pageAt(spread, 'left', zine.sheets);
  const right = pageAt(spread, 'right', zine.sheets);
  return JSON.stringify([zine.sheets, zine.pages[left], zine.pages[right], zine.spreads[spread], version]);
}
