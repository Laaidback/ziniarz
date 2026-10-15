import { newId } from '../model/ids';
import type { StoredImage } from '../storage/db';

/** About 300 dpi across a whole spread with bleed (302 mm). */
export const MAX_IMAGE_SIDE = 3600;
const JPEG_QUALITY = 0.92;

export class ImageImportError extends Error {
  constructor() {
    super('Ten plik nie jest obrazem.');
    this.name = 'ImageImportError';
  }
}

/** iPhone photos (HEIC/HEIF). Only Safari decodes them, so the message is shown only when decoding fails. */
export function isHeicFile(file: { name?: string; type: string }): boolean {
  return /^image\/hei[cf](-sequence)?$/i.test(file.type) || /\.hei[cf]$/i.test(file.name ?? '');
}

function hasTransparency(bitmap: ImageBitmap): boolean {
  const size = 256;
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0, size, size);
  const data = ctx.getImageData(0, 0, size, size).data;
  for (let i = 3; i < data.length; i += 4) if (data[i] < 255) return true;
  return false;
}

export async function prepareImage(file: Blob, id: string = newId()): Promise<StoredImage> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new ImageImportError();
  }
  try {
    const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, width, height);
    const mime = file.type !== 'image/jpeg' && hasTransparency(bitmap) ? 'image/png' : 'image/jpeg';
    const blob = await canvas.convertToBlob(mime === 'image/jpeg' ? { type: mime, quality: JPEG_QUALITY } : { type: mime });
    return { id, mime, width, height, data: await blob.arrayBuffer() };
  } finally {
    bitmap.close();
  }
}
