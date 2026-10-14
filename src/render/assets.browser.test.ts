import { expect, test } from 'vitest';
import { createPhotoElement, createZine } from '../model/factory';
import type { StoredImage } from '../storage/db';
import { loadRenderAssets, releaseRenderAssets } from './assets';

async function pngBytes(): Promise<ArrayBuffer> {
  const canvas = new OffscreenCanvas(4, 4);
  canvas.getContext('2d')!.fillRect(0, 0, 4, 4);
  return (await canvas.convertToBlob({ type: 'image/png' })).arrayBuffer();
}

test('a corrupt image is skipped (drawn as a placeholder), the others still load', async () => {
  const zine = createZine('t', 1);
  zine.spreads[1].elements.push(
    createPhotoElement('broken', { x: 0, y: 0, width: 20, height: 20 }),
    createPhotoElement('good', { x: 30, y: 0, width: 20, height: 20 }),
  );
  const stored: Record<string, StoredImage> = {
    broken: { id: 'broken', mime: 'image/jpeg', width: 4, height: 4, data: new Uint8Array([1, 2, 3, 4]).buffer },
    good: { id: 'good', mime: 'image/png', width: 4, height: 4, data: await pngBytes() },
  };
  const assets = await loadRenderAssets(zine, async (id) => stored[id]);
  expect([...assets.images.keys()]).toEqual(['good']);
  expect(assets.images.get('good')!.width).toBe(4);
  releaseRenderAssets(assets);
});
