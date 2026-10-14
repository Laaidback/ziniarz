import { imageIdsOfZine } from '../model/queries';
import type { Zine } from '../model/types';
import type { StoredImage } from '../storage/db';

export interface RenderAssets {
  images: Map<string, ImageBitmap>;
}

export function bitmapOf(image: StoredImage): Promise<ImageBitmap> {
  return createImageBitmap(new Blob([image.data], { type: image.mime }));
}

/** Bitmaps of the zine's photos; `spreads` limits it to some spreads (the cover thumbnail needs only spread 0). */
export async function loadRenderAssets(
  zine: Zine,
  getImage: (id: string) => Promise<StoredImage | undefined>,
  spreads?: number[],
): Promise<RenderAssets> {
  const source = spreads ? { ...zine, spreads: spreads.map((i) => zine.spreads[i]).filter(Boolean) } : zine;
  const images = new Map<string, ImageBitmap>();
  for (const id of imageIdsOfZine(source)) {
    const image = await getImage(id);
    if (!image) continue;
    try {
      images.set(id, await bitmapOf(image));
    } catch {
      // A corrupt stored image is left out, so it draws as the placeholder instead of stopping the render.
    }
  }
  return { images };
}

export function releaseRenderAssets(assets: RenderAssets): void {
  for (const bitmap of assets.images.values()) bitmap.close();
  assets.images.clear();
}
