import { expect, test } from 'vitest';
import { createPhotoElement, createZine } from '../model/factory';
import { newId } from '../model/ids';
import { openZiniarzDb, putImage } from '../storage/db';
import { expectColor, pixel } from '../test/pixels';
import { COVER_PX_PER_MM, renderCoverThumbnail } from './coverThumbnail';

async function pngBytes(color: string): Promise<ArrayBuffer> {
  const canvas = new OffscreenCanvas(10, 10);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 10, 10);
  return (await canvas.convertToBlob({ type: 'image/png' })).arrayBuffer();
}

async function toCanvas(url: string): Promise<HTMLCanvasElement> {
  const image = new Image();
  image.src = url;
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  canvas.getContext('2d')!.drawImage(image, 0, 0);
  return canvas;
}

test('the cover thumbnail shows page 1 with its background and photos', async () => {
  const db = await openZiniarzDb(`test-${newId()}`);
  const zine = createZine('t', 1);
  zine.pages[1] = { background: '#ff0000' };
  zine.spreads[0].elements.push(createPhotoElement('blue', { x: 148 + 50, y: 50, width: 40, height: 40 }));
  await putImage(db, { id: 'blue', mime: 'image/png', width: 10, height: 10, data: await pngBytes('#0000ff') });
  const canvas = await toCanvas(await renderCoverThumbnail(db, zine));
  expect([canvas.width, canvas.height]).toEqual([148 * COVER_PX_PER_MM, 210 * COVER_PX_PER_MM]);
  expectColor(pixel(canvas, 10, 10), [255, 0, 0]);
  expectColor(pixel(canvas, 70 * COVER_PX_PER_MM, 70 * COVER_PX_PER_MM), [0, 0, 255]);
});
