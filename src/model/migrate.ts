import { BLEED } from './geometry';

/** Page of format version 1 (A5), mm. */
const A5 = { width: 148, height: 210 } as const;
/** Page of format version 2 (A6), mm. Equal to PAGE_WIDTH × PAGE_HEIGHT. */
const A6 = { width: 105, height: 148 } as const;
const KX = A6.width / A5.width;
const KY = A6.height / A5.height;

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/**
 * One axis from A5 to A6 mm: linear (0 → 0, old edge → new edge), also beyond the edges,
 * except that an overshoot into the bleed (up to BLEED) never shrinks, so bleeding photos
 * keep their full bleed.
 */
function mapAxis(v: number, oldEdge: number, newEdge: number): number {
  const k = newEdge / oldEdge;
  if (v < 0) return Math.min(v * k, Math.max(v, -BLEED));
  if (v > oldEdge) {
    const over = v - oldEdge;
    return Math.max(newEdge + over * k, Math.min(newEdge + over, newEdge + BLEED));
  }
  return v * k;
}

export const mapX = (x: number) => mapAxis(x, 2 * A5.width, 2 * A6.width);
export const mapY = (y: number) => mapAxis(y, A5.height, A6.height);

/** New position and size of one frame axis, plus the factor the size changed by. */
function mapSpan(start: number, size: number, map: (v: number) => number, fallback: number) {
  const from = map(start);
  const to = map(start + size);
  return { start: from, size: to - from, factor: size === 0 ? fallback : (to - from) / size };
}

function migrateElement(e: unknown): unknown {
  if (!isObj(e)) return e;
  const out: Obj = { ...e };
  let fx = KX;
  let fy = KY;
  if (isNum(e.x) && isNum(e.width)) {
    const h = mapSpan(e.x, e.width, mapX, KX);
    out.x = h.start;
    out.width = h.size;
    fx = h.factor;
  } else if (isNum(e.x)) {
    out.x = mapX(e.x);
  }
  if (isNum(e.y) && isNum(e.height)) {
    const v = mapSpan(e.y, e.height, mapY, KY);
    out.y = v.start;
    out.height = v.size;
    fy = v.factor;
  } else if (isNum(e.y)) {
    out.y = mapY(e.y);
  }
  // Same wrap width relative to the letters, so lines break where they did.
  if (e.kind === 'text' && isNum(e.size)) out.size = e.size * fx;
  if (e.kind === 'photo' && isObj(e.crop)) {
    const crop = e.crop;
    // Growing the image by the larger frame factor keeps every in-bounds offset in bounds,
    // so no white strip appears (the renderer does not clamp crops).
    out.crop = {
      ...crop,
      ...(isNum(crop.offsetX) ? { offsetX: crop.offsetX * fx } : {}),
      ...(isNum(crop.offsetY) ? { offsetY: crop.offsetY * fy } : {}),
      zoom: (isNum(crop.zoom) ? crop.zoom : 1) * (Math.max(fx, fy) / Math.min(fx, fy)),
    };
  }
  return out;
}

function scaleKeys(o: Obj, keys: string[], k: number): Obj {
  const out: Obj = {};
  for (const key of keys) if (isNum(o[key])) out[key] = (o[key] as number) * k;
  return out;
}

/**
 * Raw zine data of format version 1 (A5 pages) converted to format 2 (A6 mm), before parseZine
 * reads it. Only geometry changes; missing or broken fields are left for parseZine's defaults.
 * Never changes its input.
 */
export function migrateA5ToA6(raw: Obj): Obj {
  const out: Obj = { ...raw, formatVersion: 2 };
  if (isObj(raw.margins)) {
    const m = raw.margins;
    out.margins = { ...m, ...scaleKeys(m, ['outer', 'inner'], KX), ...scaleKeys(m, ['top', 'bottom'], KY) };
  }
  if (Array.isArray(raw.spreads)) {
    out.spreads = raw.spreads.map((s) =>
      isObj(s) && Array.isArray(s.elements) ? { ...s, elements: s.elements.map(migrateElement) } : s,
    );
  }
  return out;
}
