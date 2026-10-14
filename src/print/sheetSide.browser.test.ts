import { describe, expect, test } from 'vitest';
import { sheetSides } from '../imposition/imposition';
import { printLayout } from '../imposition/layout';
import { createPhotoElement, createZine } from '../model/factory';
import { expectColor, pixel, solidBitmap } from '../test/pixels';
import { mmToPx, renderSheetSide } from './sheetSide';

const zine = createZine('t', 1);
zine.pages[1] = { background: '#ff0000' };
zine.pages[2] = { background: '#00ff00' };
zine.pages[3] = { background: '#0000ff' };
zine.pages[4] = { background: '#ffff00' };
const assets = { images: new Map() };
const [front, back] = sheetSides(1);
const layout = printLayout({ printerMargin: 4, bleed: true, cropMarks: true, foldMarks: true });
const marksOn = { cropMarks: true, foldMarks: true, rotate180: false };

describe('renderSheetSide', () => {
  test('front holds pages 4 | 1 on a white A4 sheet', () => {
    const dpi = 50;
    const k = mmToPx(dpi);
    const canvas = renderSheetSide(zine, front, assets, layout, { dpi, ...marksOn });
    expect([canvas.width, canvas.height]).toEqual([Math.round(297 * k), Math.round(210 * k)]);
    expectColor(pixel(canvas, 74 * k, 105 * k), [255, 255, 0]);
    expectColor(pixel(canvas, 223 * k, 105 * k), [255, 0, 0]);
    expectColor(pixel(canvas, 1, 1), [255, 255, 255]);
  });

  test('back holds pages 2 | 3, or 3 | 2 upside down when rotated', () => {
    const dpi = 50;
    const k = mmToPx(dpi);
    const plain = renderSheetSide(zine, back, assets, layout, { dpi, ...marksOn });
    expectColor(pixel(plain, 74 * k, 105 * k), [0, 255, 0]);
    expectColor(pixel(plain, 223 * k, 105 * k), [0, 0, 255]);
    const rotated = renderSheetSide(zine, back, assets, layout, { dpi, ...marksOn, rotate180: true });
    expectColor(pixel(rotated, 74 * k, 105 * k), [0, 0, 255]);
    expectColor(pixel(rotated, 223 * k, 105 * k), [0, 255, 0]);
  });

  test('draws crop and fold marks only when enabled', () => {
    const dpi = 300;
    const k = mmToPx(dpi);
    const cropProbe: [number, number] = [(layout.spread.x - layout.bleed - 3) * k, layout.spread.y * k];
    const foldProbe: [number, number] = [148.5 * k, (layout.spread.y - layout.bleed - 3) * k];
    const on = renderSheetSide(zine, front, assets, layout, { dpi, ...marksOn });
    expect(pixel(on, ...cropProbe)[0]).toBeLessThan(128);
    expect(pixel(on, ...foldProbe)[0]).toBeLessThan(128);
    const off = renderSheetSide(zine, front, assets, layout, { dpi, cropMarks: false, foldMarks: false, rotate180: false });
    expectColor(pixel(off, ...cropProbe), [255, 255, 255]);
    expectColor(pixel(off, ...foldProbe), [255, 255, 255]);
  });
});

describe('renderSheetSide at the fold', () => {
  const layouts = [
    printLayout({ printerMargin: 4, bleed: true, cropMarks: true, foldMarks: true }),
    printLayout({ printerMargin: 4, bleed: false, cropMarks: false, foldMarks: false }),
    printLayout({ printerMargin: 0, bleed: true, cropMarks: false, foldMarks: false }),
    printLayout({ printerMargin: 3.3, bleed: false, cropMarks: true, foldMarks: false }),
  ];

  test.each([100, 150, 300])('a photo across the spine has no light seam at %i dpi', async (dpi) => {
    const dark = createZine('t', 1);
    dark.spreads[1].elements.push(createPhotoElement('dark', { x: -3, y: -3, width: 302, height: 216 }));
    const darkAssets = { images: new Map([['dark', await solidBitmap(64, 64, '#202020')]]) };
    const k = mmToPx(dpi);
    for (const l of layouts) {
      for (const rotate180 of [false, true]) {
        const canvas = renderSheetSide(dark, back, darkAssets, l, { dpi, cropMarks: true, foldMarks: true, rotate180 });
        const spine = Math.floor((l.spread.x + l.spread.width / 2) * k);
        for (const yMm of [0.1, 0.3, 0.5, 0.7, 0.9]) {
          const y = Math.floor((l.spread.y + 2 + yMm * (l.spread.height - 4)) * k);
          const row = canvas.getContext('2d')!.getImageData(spine - 2, y, 5, 1).data;
          for (let i = 0; i < 5; i++) {
            const [r, g, b, a] = row.slice(i * 4, i * 4 + 4);
            const where = `dpi ${dpi}, scale ${l.scale.toFixed(4)}, bleed ${l.bleed > 0}, rotated ${rotate180}, x ${spine - 2 + i}, y ${y}`;
            expect(Math.max(r, g, b), `light pixel rgba(${r},${g},${b},${a}) at ${where}`).toBeLessThan(64);
            expect(a).toBe(255);
          }
        }
      }
    }
  });
});
