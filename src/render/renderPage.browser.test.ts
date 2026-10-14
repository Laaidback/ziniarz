import { describe, expect, test } from 'vitest';
import { createPhotoElement, createTextElement, createZine } from '../model/factory';
import type { Zine } from '../model/types';
import { expectColor, hasDarkPixel, pixel, solidBitmap, splitBitmap } from '../test/pixels';
import type { RenderAssets } from './assets';
import { renderPage, renderSpread } from './renderPage';

const RED: [number, number, number] = [255, 0, 0];
const BLUE: [number, number, number] = [0, 0, 255];
const GREEN: [number, number, number] = [0, 255, 0];
const YELLOW: [number, number, number] = [255, 255, 0];
const PX = 2;

async function spinePhotoZine(): Promise<{ zine: Zine; assets: RenderAssets }> {
  const zine = createZine('t', 1);
  zine.pages[2] = { background: '#ff0000' };
  zine.pages[3] = { background: '#0000ff' };
  zine.spreads[1].elements.push(createPhotoElement('green', { x: 100, y: 50, width: 96, height: 100 }));
  return { zine, assets: { images: new Map([['green', await solidBitmap(100, 100, '#00ff00')]]) } };
}

describe('renderPage', () => {
  test('left page: bleed on the outer edge, photo cut at the spine', async () => {
    const { zine, assets } = await spinePhotoZine();
    const canvas = renderPage(zine, 2, assets, { pxPerMm: PX, bleed: true });
    expect([canvas.width, canvas.height]).toEqual([151 * PX, 216 * PX]);
    expectColor(pixel(canvas, 13 * PX, 13 * PX), RED);
    expectColor(pixel(canvas, 1, 1), RED);
    expectColor(pixel(canvas, 143 * PX, 103 * PX), GREEN);
  });

  test('right page continues the photo from the spine', async () => {
    const { zine, assets } = await spinePhotoZine();
    const canvas = renderPage(zine, 3, assets, { pxPerMm: PX, bleed: true });
    expectColor(pixel(canvas, 2 * PX, 103 * PX), GREEN);
    expectColor(pixel(canvas, 142 * PX, 13 * PX), BLUE);
    expectColor(pixel(canvas, canvas.width - 1, 13 * PX), BLUE);
  });

  test('without bleed the page is exactly A5', async () => {
    const { zine, assets } = await spinePhotoZine();
    const canvas = renderPage(zine, 2, assets, { pxPerMm: PX, bleed: false });
    expect([canvas.width, canvas.height]).toEqual([148 * PX, 210 * PX]);
    expectColor(pixel(canvas, 0, 0), RED);
  });

  test('flipX mirrors the photo', async () => {
    const zine = createZine('t', 1);
    const photo = createPhotoElement('split', { x: 20, y: 20, width: 50, height: 50 });
    zine.spreads[1].elements.push(photo);
    const assets = { images: new Map([['split', await splitBitmap(100, 100, '#00ff00', '#ffff00')]]) };
    expectColor(pixel(renderPage(zine, 2, assets, { pxPerMm: PX, bleed: false }), 25 * PX, 45 * PX), GREEN);
    photo.flipX = true;
    expectColor(pixel(renderPage(zine, 2, assets, { pxPerMm: PX, bleed: false }), 25 * PX, 45 * PX), YELLOW);
  });

  test('flipX mirrors the visible crop, not the whole image', async () => {
    // Image 100x50 mm in a 50x50 frame, shifted so the frame shows image x 10..60:
    // green on frame x 0..40, yellow on 40..50. Flipped: yellow 0..10, green 10..50.
    const zine = createZine('t', 1);
    const photo = createPhotoElement('split', {
      x: 20,
      y: 20,
      width: 50,
      height: 50,
      crop: { offsetX: 15, offsetY: 0, zoom: 1 },
    });
    zine.spreads[1].elements.push(photo);
    const assets = { images: new Map([['split', await splitBitmap(200, 100, '#00ff00', '#ffff00')]]) };
    const at = (frameX: number) =>
      pixel(renderPage(zine, 2, assets, { pxPerMm: PX, bleed: false }), (20 + frameX) * PX, 45 * PX);
    expectColor(at(5), GREEN);
    expectColor(at(45), YELLOW);
    photo.flipX = true;
    expectColor(at(5), YELLOW);
    expectColor(at(25), GREEN);
    expectColor(at(45), GREEN);
  });

  test('rotation turns the frame around its centre', async () => {
    const zine = createZine('t', 1);
    const photo = createPhotoElement('green', { x: 24, y: 95, width: 100, height: 20 });
    zine.spreads[1].elements.push(photo);
    const assets = { images: new Map([['green', await solidBitmap(100, 20, '#00ff00')]]) };
    expectColor(pixel(renderPage(zine, 2, assets, { pxPerMm: PX, bleed: false }), 74 * PX, 65 * PX), [255, 255, 255]);
    photo.rotation = 90;
    expectColor(pixel(renderPage(zine, 2, assets, { pxPerMm: PX, bleed: false }), 74 * PX, 65 * PX), GREEN);
  });

  test('missing image draws a grey placeholder', () => {
    const zine = createZine('t', 1);
    zine.spreads[1].elements.push(createPhotoElement('missing', { x: 20, y: 20, width: 50, height: 50 }));
    const canvas = renderPage(zine, 2, { images: new Map() }, { pxPerMm: PX, bleed: false });
    expectColor(pixel(canvas, 40 * PX, 40 * PX), [221, 221, 221]);
  });

  test('text is drawn inside its frame', () => {
    const zine = createZine('t', 1);
    zine.spreads[1].elements.push(createTextElement({ text: 'MMMM', size: 48, x: 20, y: 40, width: 100 }));
    const canvas = renderPage(zine, 2, { images: new Map() }, { pxPerMm: PX, bleed: false });
    expect(hasDarkPixel(canvas, 20 * PX, 40 * PX, 100 * PX, 30 * PX)).toBe(true);
    expect(hasDarkPixel(canvas, 20 * PX, 120 * PX, 100 * PX, 30 * PX)).toBe(false);
  });
});

test('renderSpread leaves the missing half of a cover spread empty', async () => {
  const zine = createZine('t', 1);
  zine.pages[1] = { background: '#ff0000' };
  const canvas = renderSpread(zine, 0, { images: new Map() }, { pxPerMm: PX });
  expect([canvas.width, canvas.height]).toEqual([302 * PX, 216 * PX]);
  expectColor(pixel(canvas, 203 * PX, 103 * PX), RED);
  expect(pixel(canvas, 50 * PX, 103 * PX)[3]).toBe(0);
});
