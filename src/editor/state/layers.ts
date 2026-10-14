import type { ZineElement } from '../../model/types';

/** "na wierzch", "wyżej", "niżej", "na spód". The last element is drawn on top. */
export type LayerOp = 'front' | 'forward' | 'backward' | 'back';

function targetIndex(length: number, from: number, op: LayerOp): number {
  const last = length - 1;
  if (op === 'front') return last;
  if (op === 'back') return 0;
  return op === 'forward' ? Math.min(last, from + 1) : Math.max(0, from - 1);
}

export function moveLayer(elements: ZineElement[], id: string, op: LayerOp): ZineElement[] {
  const from = elements.findIndex((e) => e.id === id);
  if (from < 0) return elements;
  const to = targetIndex(elements.length, from, op);
  if (to === from) return elements;
  const result = elements.filter((e) => e.id !== id);
  result.splice(to, 0, elements[from]);
  return result;
}

export function canMoveLayer(elements: ZineElement[], id: string, op: LayerOp): boolean {
  const from = elements.findIndex((e) => e.id === id);
  return from >= 0 && targetIndex(elements.length, from, op) !== from;
}
