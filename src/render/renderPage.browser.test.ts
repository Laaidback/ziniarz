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

test('renderSpread draws the whole cover: back cover left, front cover right', () => {
  const zine = createZine('t', 1);
  zine.pages[1] = { background: '#ff0000' };
  zine.pages[4] = { background: '#0000ff' };
  const canvas = renderSpread(zine, 0, { images: new Map() }, { pxPerMm: PX });
  expect([canvas.width, canvas.height]).toEqual([(SPREAD_WIDTH + 6) * PX, (PAGE_HEIGHT + 6) * PX]);
  expectColor(pixel(canvas, 203 * PX, 103 * PX), RED);
  expectColor(pixel(canvas, 50 * PX, 103 * PX), BLUE);
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

  test('guides show the cut line and tint the bleed outside it; without guides neither is drawn', () => {
    const zine = createZine('t', 1);
    const plain = renderSpread(zine, 1, { images: new Map() }, { pxPerMm: PX });
    const withGuides = renderSpread(zine, 1, { images: new Map() }, { pxPerMm: PX, guides: true });
    const rgb = (canvas: HTMLCanvasElement, x: number, y: number) => [...canvas.getContext('2d')!.getImageData(x, y, 1, 1).data.slice(0, 3)];
    // Inside the bleed, beside the outer edge of the left page (canvas starts 3 mm outside the cut).
    const bleedX = Math.round(1.5 * PX);
    const middleY = Math.round(70 * PX);
    expect(rgb(plain, bleedX, middleY)).toEqual([255, 255, 255]);
    const [r, g, b] = rgb(withGuides, bleedX, middleY);
    expect(r).toBeGreaterThan(g + 4);
    expect(Math.abs(g - b)).toBeLessThan(4);
    // The page itself stays white.
    expect(rgb(withGuides, Math.round(8 * PX), middleY)).toEqual([255, 255, 255]);
    // The cut line: a grey column at 3 mm (the trim of the left page's outer edge).
    const cutX = Math.round(3 * PX);
    const greyAt = (canvas: HTMLCanvasElement) =>
      [cutX - 1, cutX, cutX + 1].some((x) => {
        const [cr, cg, cb] = rgb(canvas, x, middleY);
        return cr < 235 && Math.abs(cr - cb) < 20 && Math.abs(cg - cb) < 20;
      });
    expect(greyAt(plain)).toBe(false);
    expect(greyAt(withGuides)).toBe(true);
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
