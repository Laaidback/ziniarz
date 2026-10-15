import { describe, expect, test } from 'vitest';
import { createPhotoElement, createTextElement, createZine, DEFAULT_MARGINS } from '../model/factory';
import { PAGE_HEIGHT, PAGE_WIDTH, SPREAD_WIDTH } from '../model/geometry';
import type { Zine } from '../model/types';
import { expectColor, hasDarkPixel, pixel, solidBitmap, splitBitmap } from '../test/pixels';
import type { RenderAssets } from './assets';
import { buildSpreadGroup, ELEMENT_NODE_NAME, measureTextHeight, ptToMm, textStyleMm } from './buildSpread';
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
  zine.spreads[1].elements.push(createPhotoElement('green', { x: PAGE_WIDTH - 48, y: 50, width: 96, height: 90 }));
  return { zine, assets: { images: new Map([['green', await solidBitmap(100, 100, '#00ff00')]]) } };
}

describe('renderPage', () => {
  test('left page: bleed on the outer edge, photo cut at the spine', async () => {
    const { zine, assets } = await spinePhotoZine();
    const canvas = renderPage(zine, 2, assets, { pxPerMm: PX, bleed: true });
    expect([canvas.width, canvas.height]).toEqual([(PAGE_WIDTH + 3) * PX, (PAGE_HEIGHT + 6) * PX]);
    expectColor(pixel(canvas, 13 * PX, 13 * PX), RED);
    expectColor(pixel(canvas, 1, 1), RED);
    expectColor(pixel(canvas, (PAGE_WIDTH - 5) * PX, 103 * PX), GREEN);
  });

  test('right page continues the photo from the spine', async () => {
    const { zine, assets } = await spinePhotoZine();
    const canvas = renderPage(zine, 3, assets, { pxPerMm: PX, bleed: true });
    expectColor(pixel(canvas, 2 * PX, 103 * PX), GREEN);
    expectColor(pixel(canvas, (PAGE_WIDTH - 6) * PX, 13 * PX), BLUE);
    expectColor(pixel(canvas, canvas.width - 1, 13 * PX), BLUE);
  });

  test('without bleed the page is exactly A6', async () => {
    const { zine, assets } = await spinePhotoZine();
    const canvas = renderPage(zine, 2, assets, { pxPerMm: PX, bleed: false });
    expect([canvas.width, canvas.height]).toEqual([PAGE_WIDTH * PX, PAGE_HEIGHT * PX]);
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
  expect([canvas.width, canvas.height]).toEqual([(SPREAD_WIDTH + 6) * PX, (PAGE_HEIGHT + 6) * PX]);
  expectColor(pixel(canvas, 203 * PX, 103 * PX), RED);
  expect(pixel(canvas, 50 * PX, 103 * PX)[3]).toBe(0);
});

describe('renderSpread overlays', () => {
  const bluish = (canvas: HTMLCanvasElement, x0: number, y0: number, width: number, height: number) => {
    const data = canvas.getContext('2d')!.getImageData(x0, y0, width, height).data;
    for (let i = 0; i < data.length; i += 4) if (data[i + 2] > data[i] + 60) return true;
    return false;
  };

  test('guides draw the blue margin line only when asked', () => {
    const zine = createZine('t', 1);
    // Left page of spread 1: the outer margin, plus 3 mm bleed at the canvas edge.
    const column = (DEFAULT_MARGINS.outer + 3) * PX - 2;
    const plain = renderSpread(zine, 1, { images: new Map() }, { pxPerMm: PX });
    const withGuides = renderSpread(zine, 1, { images: new Map() }, { pxPerMm: PX, guides: true });
    expect(bluish(plain, column, 50 * PX, 4, 40 * PX)).toBe(false);
    expect(bluish(withGuides, column, 50 * PX, 4, 40 * PX)).toBe(true);
  });

  test('shadeMissing greys out the part of an element on the missing page', async () => {
    const zine = createZine('t', 1);
    zine.spreads[0].elements.push(createPhotoElement('red', { x: PAGE_WIDTH - 48, y: 50, width: 100, height: 90 }));
    const assets = { images: new Map([['red', await solidBitmap(100, 100, '#ff0000')]]) };
    const at = (canvas: HTMLCanvasElement) => pixel(canvas, (PAGE_WIDTH - 28 + 3) * PX, (100 + 3) * PX);
    expectColor(at(renderSpread(zine, 0, assets, { pxPerMm: PX })), RED);
    expect(at(renderSpread(zine, 0, assets, { pxPerMm: PX, shadeMissing: true }))[1]).toBeGreaterThan(150);
    expectColor(pixel(renderSpread(zine, 0, assets, { pxPerMm: PX, shadeMissing: true }), (PAGE_WIDTH + 22) * PX, 100 * PX), RED);
  });
});

describe('shared text builder', () => {
  test('element nodes carry the element id', () => {
    const zine = createZine('t', 1);
    const text = createTextElement({ text: 'A' });
    zine.spreads[1].elements.push(text);
    const group = buildSpreadGroup(zine, 1, { images: new Map() });
    const nodes = group.getChildren((node) => node.hasName(ELEMENT_NODE_NAME));
    expect(nodes.map((node) => node.id())).toEqual([text.id]);
  });

  test('measureTextHeight grows with the number of lines', () => {
    const one = measureTextHeight(createTextElement({ text: 'a', size: 12, lineHeight: 1.2 }));
    const three = measureTextHeight(createTextElement({ text: 'a\nb\nc', size: 12, lineHeight: 1.2 }));
    expect(one).toBeCloseTo(ptToMm(12) * 1.2, 5);
    expect(three).toBeCloseTo(one * 3, 5);
  });

  test('textStyleMm converts points and thousandths of an em to mm', () => {
    const style = textStyleMm(createTextElement({ size: 72, letterSpacing: 100, lineHeight: 1.5 }));
    expect(style.fontSize).toBeCloseTo(25.4, 5);
    expect(style.letterSpacing).toBeCloseTo(2.54, 5);
    expect(style.lineHeight).toBe(1.5);
  });
});
