import { imageIdsOfZine } from '../model/queries';
import type { Zine } from '../model/types';
import type { StoredImage } from '../storage/db';

export interface RenderAssets {
  images: Map<string, ImageBitmap>;
}

export async function loadRenderAssets(
  zine: Zine,
  getImage: (id: string) => Promise<StoredImage | undefined>,
): Promise<RenderAssets> {
  const images = new Map<string, ImageBitmap>();
  for (const id of imageIdsOfZine(zine)) {
    const image = await getImage(id);
    if (image) images.set(id, await createImageBitmap(new Blob([image.data], { type: image.mime })));
  }
  return { images };
}

export function releaseRenderAssets(assets: RenderAssets): void {
  for (const bitmap of assets.images.values()) bitmap.close();
  assets.images.clear();
}
