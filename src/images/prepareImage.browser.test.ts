import { expect, test } from 'vitest';
import { ImageImportError, MAX_IMAGE_SIDE, prepareImage } from './prepareImage';

async function imageBlob(width: number, height: number, type: string, transparentHalf = false): Promise<Blob> {
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#c00';
  ctx.fillRect(0, 0, width, height);
  if (transparentHalf) ctx.clearRect(width / 2, 0, width / 2, height);
  return canvas.convertToBlob({ type });
}

test('downscales large images to MAX_IMAGE_SIDE as JPEG', async () => {
  const image = await prepareImage(await imageBlob(5000, 2000, 'image/jpeg'), 'a');
  expect(image).toMatchObject({ id: 'a', mime: 'image/jpeg', width: MAX_IMAGE_SIDE, height: 1440 });
  expect(image.data.byteLength).toBeGreaterThan(0);
});

test('keeps small images at their size', async () => {
  const image = await prepareImage(await imageBlob(300, 200, 'image/jpeg'));
  expect([image.width, image.height]).toEqual([300, 200]);
});

test('keeps PNG only when the image has transparency', async () => {
  expect((await prepareImage(await imageBlob(100, 100, 'image/png', true))).mime).toBe('image/png');
  expect((await prepareImage(await imageBlob(100, 100, 'image/png'))).mime).toBe('image/jpeg');
});

test('rejects files that are not images', async () => {
  await expect(prepareImage(new Blob(['hello'], { type: 'text/plain' }))).rejects.toThrow(ImageImportError);
});
