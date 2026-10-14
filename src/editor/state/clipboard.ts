import { newId } from '../../model/ids';
import type { ZineElement } from '../../model/types';

export const PASTE_OFFSET = 5;

const samePlace = (a: { x: number; y: number }, x: number, y: number) => Math.abs(a.x - x) < 0.01 && Math.abs(a.y - y) < 0.01;

/** A copy with a new id, moved by 5 mm (repeatedly) while it would sit exactly on an element of the target spread. */
export function cloneForPaste(element: ZineElement, target: ZineElement[]): ZineElement {
  let { x, y } = element;
  while (target.some((e) => samePlace(e, x, y))) {
    x += PASTE_OFFSET;
    y += PASTE_OFFSET;
  }
  return { ...structuredClone(element), id: newId(), x, y };
}
