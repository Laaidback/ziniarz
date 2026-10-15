import { describe, expect, test } from 'vitest';
import { imagePlacement } from '../render/photoGeometry';
import { mapX, mapY, migrateA5ToA6 } from './migrate';

const kx = 105 / 148;
const ky = 148 / 210;

const v1 = (elements: unknown[], extra: Record<string, unknown> = {}) => ({
  formatVersion: 1,
  id: 'z',
  title: 'Stary',
  sheets: 1,
  margins: { outer: 30, inner: 20, top: 30, bottom: 40 },
  spreads: [{ id: 's0', elements: [] }, { id: 's1', elements }, { id: 's2', elements: [] }],
  ...extra,
});

const elementsOf = (raw: Record<string, unknown>) =>
  (raw.spreads as { elements: Record<string, unknown>[] }[])[1].elements;

describe('mapX and mapY', () => {
  test('trim edges and the spine land on the A6 edges and spine', () => {
    expect(mapX(0)).toBe(0);
    expect(mapX(148)).toBeCloseTo(105, 9);
    expect(mapX(296)).toBeCloseTo(210, 9);
    expect(mapY(0)).toBe(0);
    expect(mapY(210)).toBeCloseTo(148, 9);
  });

  test('overshoot into the bleed keeps its millimetres, up to 3 mm', () => {
    expect(mapX(-3)).toBe(-3);
    expect(mapX(-1)).toBe(-1);
    expect(mapX(299)).toBeCloseTo(213, 9);
    expect(mapY(-3)).toBe(-3);
    expect(mapY(213)).toBeCloseTo(151, 9);
  });

  test('far overhangs scale linearly', () => {
    expect(mapX(-100)).toBeCloseTo(-100 * kx, 9);
    expect(mapX(400)).toBeCloseTo(210 + 104 * kx, 9);
    expect(mapY(-50)).toBeCloseTo(-50 * ky, 9);
  });

  test('never decreases', () => {
    for (let x = -120; x < 420; x += 0.25) expect(mapX(x + 0.25)).toBeGreaterThanOrEqual(mapX(x));
  });
});

describe('migrateA5ToA6', () => {
  test('frames: page edges, spine and bleed land where they belong', () => {
    const raw = v1([
      { kind: 'text', id: 't', x: 148, y: 0, width: 148, height: 0, rotation: 7, text: 'A', size: 12, letterSpacing: 50, lineHeight: 1.4 },
      { kind: 'photo', id: 'p', imageId: 'i', x: -3, y: -3, width: 302, height: 216, rotation: 0, crop: { offsetX: 0, offsetY: 0, zoom: 1 } },
    ]);
    const [text, photo] = elementsOf(migrateA5ToA6(raw));
    expect(text.x).toBeCloseTo(105, 9);
    expect(text.width).toBeCloseTo(105, 9);
    expect(text.height).toBe(0);
    expect(text).toMatchObject({ rotation: 7, letterSpacing: 50, lineHeight: 1.4, text: 'A' });
    expect(photo.x).toBe(-3);
    expect(photo.y).toBe(-3);
    expect(photo.width).toBeCloseTo(216, 9);
    expect(photo.height).toBeCloseTo(154, 9);
  });

  test('text size follows the wrap width', () => {
    const raw = v1([{ kind: 'text', id: 't', x: 20, y: 30, width: 108, height: 10, rotation: 0, text: 'A', size: 12 }]);
    const [text] = elementsOf(migrateA5ToA6(raw));
    expect(text.size).toBeCloseTo(12 * kx, 9);
    expect(text.width).toBeCloseTo(108 * kx, 9);
    expect(text.y).toBeCloseTo(30 * ky, 9);
  });

  test('elements hanging far off the page keep their proportions to the page', () => {
    const raw = v1([
      { kind: 'text', id: 't', x: -100, y: 20, width: 150, height: 0, rotation: 0, text: 'TYTUŁ', size: 90 },
      { kind: 'photo', id: 'p', imageId: 'i', x: -100, y: 20, width: 150, height: 100, rotation: 0, crop: { offsetX: 0, offsetY: 0, zoom: 1 } },
    ]);
    const [text, photo] = elementsOf(migrateA5ToA6(raw));
    expect((text.width as number) / 150).toBeCloseTo(kx, 2);
    expect((text.size as number) / 90).toBeCloseTo(kx, 2);
    expect((photo.crop as { zoom: number }).zoom).toBeLessThan(1.01);
  });

  test('a crop pushed to its limit still covers the frame', () => {
    // Wide image in a frame that reaches into the bleed: cover fit follows the height.
    const image = { width: 3000, height: 1000 };
    const frame = { width: 302, height: 120 };
    const zoom = 1.5;
    const placed = imagePlacement(frame, { offsetX: 0, offsetY: 0, zoom }, image.width, image.height);
    const offsetX = (placed.width - frame.width) / 2; // the old limit
    const offsetY = -(placed.height - frame.height) / 2;
    const raw = v1([
      { kind: 'photo', id: 'p', imageId: 'i', x: -3, y: 40, ...frame, rotation: 0, crop: { offsetX, offsetY, zoom } },
    ]);
    const [photo] = elementsOf(migrateA5ToA6(raw));
    const newFrame = { width: photo.width as number, height: photo.height as number };
    const crop = photo.crop as { offsetX: number; offsetY: number; zoom: number };
    const after = imagePlacement(newFrame, crop, image.width, image.height);
    const eps = 1e-9;
    expect(after.x).toBeLessThanOrEqual(eps);
    expect(after.y).toBeLessThanOrEqual(eps);
    expect(after.x + after.width).toBeGreaterThanOrEqual(newFrame.width - eps);
    expect(after.y + after.height).toBeGreaterThanOrEqual(newFrame.height - eps);
    expect(crop.zoom).toBeGreaterThan(zoom);
  });

  test('margins scale by axis', () => {
    const raw = migrateA5ToA6(v1([]));
    const margins = raw.margins as Record<string, number>;
    expect(margins.outer).toBeCloseTo(30 * kx, 9);
    expect(margins.inner).toBeCloseTo(20 * kx, 9);
    expect(margins.top).toBeCloseTo(30 * ky, 9);
    expect(margins.bottom).toBeCloseTo(40 * ky, 9);
  });

  test('leaves missing or broken fields for parseZine and does not touch the input', () => {
    const input = v1([{ kind: 'photo', id: 'p', imageId: 'i', x: 10 }, 'junk'], { margins: 'x' });
    const before = JSON.stringify(input);
    const out = migrateA5ToA6(input);
    expect(JSON.stringify(input)).toBe(before);
    expect(out.formatVersion).toBe(2);
    expect(out.margins).toBe('x');
    const [photo, junk] = elementsOf(out) as unknown[];
    expect(photo).toMatchObject({ x: 10 * kx });
    expect(junk).toBe('junk');
  });
});
