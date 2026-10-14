import type { PrintLayout } from './layout';

export const MARK_OFFSET = 1;
export const MARK_LENGTH = 4;
/** Stroke width of printed marks, mm. */
export const MARK_STROKE = 0.25;

export interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** Corner crop marks at the four outer corners of the trimmed pair. None at the spine. */
export function cropMarks(l: PrintLayout): Segment[] {
  const start = l.bleed + MARK_OFFSET;
  const end = start + MARK_LENGTH;
  const { x, y, width, height } = l.spread;
  const corners: [number, number, number, number][] = [
    [x, y, -1, -1],
    [x + width, y, 1, -1],
    [x, y + height, -1, 1],
    [x + width, y + height, 1, 1],
  ];
  return corners.flatMap(([cx, cy, dx, dy]) => [
    { x1: cx + dx * start, y1: cy, x2: cx + dx * end, y2: cy },
    { x1: cx, y1: cy + dy * start, x2: cx, y2: cy + dy * end },
  ]);
}

/** Short fold ticks above and below the pair, on the sheet centre line. */
export function foldMarks(l: PrintLayout): Segment[] {
  const start = l.bleed + MARK_OFFSET;
  const end = start + MARK_LENGTH;
  const cx = l.spread.x + l.spread.width / 2;
  const top = l.spread.y;
  const bottom = l.spread.y + l.spread.height;
  return [
    { x1: cx, y1: top - start, x2: cx, y2: top - end },
    { x1: cx, y1: bottom + start, x2: cx, y2: bottom + end },
  ];
}
