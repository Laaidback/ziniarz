import type { PhotoCrop } from '../model/types';

interface Size {
  width: number;
  height: number;
}

/** Image rectangle in frame-local mm: covers the frame at zoom 1 ("cover" fit). */
export function imagePlacement(frame: Size, crop: PhotoCrop, imageWidth: number, imageHeight: number) {
  const scale = Math.max(frame.width / imageWidth, frame.height / imageHeight) * crop.zoom;
  const width = imageWidth * scale;
  const height = imageHeight * scale;
  return {
    x: frame.width / 2 + crop.offsetX - width / 2,
    y: frame.height / 2 + crop.offsetY - height / 2,
    width,
    height,
  };
}

/** Zoom at least 1 and offsets small enough that the image still covers the whole frame. */
export function clampCrop(frame: Size, crop: PhotoCrop, imageWidth: number, imageHeight: number): PhotoCrop {
  const zoom = Math.max(1, crop.zoom);
  const placed = imagePlacement(frame, { offsetX: 0, offsetY: 0, zoom }, imageWidth, imageHeight);
  const maxX = (placed.width - frame.width) / 2;
  const maxY = (placed.height - frame.height) / 2;
  const clamp = (v: number, m: number) => Math.max(-m, Math.min(m, v)) + 0;
  return { offsetX: clamp(crop.offsetX, maxX), offsetY: clamp(crop.offsetY, maxY), zoom };
}
