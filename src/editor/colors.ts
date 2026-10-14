import type { Zine } from '../model/types';

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** "#ABC", "abc", "#aabbcc" → "#aabbcc"; anything else → null. */
export function normalizeHex(input: string): string | null {
  const match = HEX.exec(input.trim());
  if (!match) return null;
  const hex = match[1].length === 3 ? [...match[1]].map((c) => c + c).join('') : match[1];
  return `#${hex.toLowerCase()}`;
}

export const BASE_SWATCHES = ['#000000', '#ffffff'];

/** Colours already used in the zine: page backgrounds (by page number), then text colours. */
export function usedColors(zine: Zine, limit = 16): string[] {
  const seen: string[] = [];
  const add = (color: string) => {
    const hex = normalizeHex(color);
    if (hex && !seen.includes(hex)) seen.push(hex);
  };
  for (const page of Object.keys(zine.pages).map(Number).sort((a, b) => a - b)) add(zine.pages[page].background);
  for (const spread of zine.spreads) {
    for (const element of spread.elements) if (element.kind === 'text') add(element.color);
  }
  return seen.slice(0, limit);
}

/** Swatches for the colour picker: black and white, then the zine's colours. */
export function swatches(zine: Zine): string[] {
  return [...new Set([...BASE_SWATCHES, ...usedColors(zine)])];
}
