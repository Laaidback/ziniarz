import type { Margins, PhotoElement, Spread, TextElement, Zine, ZineElement } from '../../model/types';

/** Fields of either element kind; the store only passes fields that fit the element. */
export type ElementPatch = Partial<Omit<PhotoElement, 'kind' | 'id' | 'imageId'>> & Partial<Omit<TextElement, 'kind' | 'id'>>;

export function findElement(zine: Zine, spread: number, id: string): ZineElement | undefined {
  return zine.spreads[spread]?.elements.find((e) => e.id === id);
}

export function updateSpreadElements(
  zine: Zine,
  spread: number,
  update: (elements: ZineElement[]) => ZineElement[],
): Zine {
  const current = zine.spreads[spread];
  if (!current) return zine;
  const elements = update(current.elements);
  if (elements === current.elements) return zine;
  return { ...zine, spreads: zine.spreads.map((s, i) => (i === spread ? { ...s, elements } : s)) };
}

/** Replaces one element; returns the same zine when the element is missing or unchanged. */
export function mapElement(zine: Zine, spread: number, id: string, update: (element: ZineElement) => ZineElement): Zine {
  return updateSpreadElements(zine, spread, (elements) => {
    const index = elements.findIndex((e) => e.id === id);
    if (index < 0) return elements;
    const next = update(elements[index]);
    return next === elements[index] ? elements : elements.map((e, i) => (i === index ? next : e));
  });
}

export function patchElement(element: ZineElement, patch: ElementPatch): ZineElement {
  return { ...element, ...patch } as ZineElement;
}

const FRAME_KEYS = ['x', 'y', 'width', 'height', 'rotation'] as const;

/** The part of `patch` a locked element takes: everything but its frame (and its lock, toggled on its own). */
export function lockedPatch(patch: ElementPatch): ElementPatch {
  const allowed: ElementPatch = { ...patch };
  for (const key of FRAME_KEYS) delete allowed[key];
  delete allowed.locked;
  return allowed;
}

/** Adds on top of everything else on the spread. */
export function addElement(zine: Zine, spread: number, element: ZineElement): Zine {
  return updateSpreadElements(zine, spread, (elements) => [...elements, element]);
}

export function removeElement(zine: Zine, spread: number, id: string): Zine {
  return updateSpreadElements(zine, spread, (elements) =>
    elements.some((e) => e.id === id) ? elements.filter((e) => e.id !== id) : elements,
  );
}

/** `null` goes back to white (no entry). Like the other setters, returns the same zine when nothing changes. */
export function setPageBackground(zine: Zine, page: number, color: string | null): Zine {
  if ((zine.pages[page]?.background ?? null) === color) return zine;
  const pages = { ...zine.pages };
  if (color === null) delete pages[page];
  else pages[page] = { background: color };
  return { ...zine, pages };
}

export function setMargins(zine: Zine, margins: Margins): Zine {
  const old = zine.margins;
  const same = old.outer === margins.outer && old.inner === margins.inner && old.top === margins.top && old.bottom === margins.bottom;
  if (same) return zine;
  return { ...zine, margins };
}

export function setTitle(zine: Zine, title: string): Zine {
  if (zine.title === title) return zine;
  return { ...zine, title };
}

/** Adds custom font families to the zine's list (no duplicates, order kept). */
export function addFontFamilies(zine: Zine, familyIds: string[]): Zine {
  const fresh = familyIds.filter((id, i) => !zine.fonts.includes(id) && familyIds.indexOf(id) === i);
  return fresh.length ? { ...zine, fonts: [...zine.fonts, ...fresh] } : zine;
}

/** Swaps font family ids (old → new) in the zine's font list and in its texts; same zine when nothing changes. */
export function replaceFontFamilies(zine: Zine, replaced: Record<string, string>): Zine {
  const hit = (id: string) => Object.hasOwn(replaced, id);
  const swap = (id: string) => (hit(id) ? replaced[id] : id);
  const usesHit = (spread: Spread) => spread.elements.some((e) => e.kind === 'text' && hit(e.fontFamilyId));
  if (!zine.fonts.some(hit) && !zine.spreads.some(usesHit)) return zine;
  return {
    ...zine,
    fonts: zine.fonts.map(swap),
    spreads: zine.spreads.map((spread) =>
      usesHit(spread)
        ? { ...spread, elements: spread.elements.map((e) => (e.kind === 'text' ? { ...e, fontFamilyId: swap(e.fontFamilyId) } : e)) }
        : spread,
    ),
  };
}
