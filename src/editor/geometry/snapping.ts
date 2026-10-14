import { frameBounds, marginRect, PAGE_WIDTH, pageRect, pagesOfSpread, slotOfPage, type Rect } from '../../model/geometry';
import type { Zine } from '../../model/types';

/** Lines (spread mm) an element snaps to: vertical lines in `xs`, horizontal in `ys`. */
export interface SnapTargets {
  xs: number[];
  ys: number[];
}

export interface SnapResult {
  dx: number;
  dy: number;
  /** The line that caught the box, to draw while dragging. */
  lineX: number | null;
  lineY: number | null;
}

const unique = (values: number[]) => [...new Set(values.map((v) => Math.round(v * 1000) / 1000))].sort((a, b) => a - b);

/** Margins, page edges and centres, the spine, and edges and centres of the other elements on the spread. */
export function snapTargets(zine: Zine, spread: number, excludeId: string | null): SnapTargets {
  const xs = [PAGE_WIDTH];
  const ys: number[] = [];
  for (const page of pagesOfSpread(spread, zine.sheets)) {
    const side = slotOfPage(page).side;
    const r = pageRect(side, 0);
    const m = marginRect(zine.margins, side);
    xs.push(r.x, r.x + r.width / 2, r.x + r.width, m.x, m.x + m.width);
    ys.push(r.y, r.y + r.height / 2, r.y + r.height, m.y, m.y + m.height);
  }
  for (const element of zine.spreads[spread].elements) {
    if (element.id === excludeId) continue;
    const b = frameBounds(element);
    xs.push(b.x, b.x + b.width / 2, b.x + b.width);
    ys.push(b.y, b.y + b.height / 2, b.y + b.height);
  }
  return { xs: unique(xs), ys: unique(ys) };
}

function bestShift(edges: number[], targets: number[], threshold: number): { shift: number; line: number } | null {
  let best: { shift: number; line: number } | null = null;
  for (const edge of edges) {
    for (const target of targets) {
      const shift = target - edge;
      if (Math.abs(shift) <= threshold && (!best || Math.abs(shift) < Math.abs(best.shift))) best = { shift, line: target };
    }
  }
  return best;
}

/** Moves a box so its nearest edge or centre lands on a target line within `threshold` mm (each axis apart). */
export function snapBox(box: Rect, targets: SnapTargets, threshold: number): SnapResult {
  const x = bestShift([box.x, box.x + box.width / 2, box.x + box.width], targets.xs, threshold);
  const y = bestShift([box.y, box.y + box.height / 2, box.y + box.height], targets.ys, threshold);
  return { dx: x?.shift ?? 0, dy: y?.shift ?? 0, lineX: x?.line ?? null, lineY: y?.line ?? null };
}

/** Snaps one coordinate (a resize handle) to the nearest target within `threshold`. */
export function snapPoint(value: number, targets: number[], threshold: number): { value: number; line: number | null } {
  const best = bestShift([value], targets, threshold);
  return best ? { value: best.line, line: best.line } : { value, line: null };
}
