/** Pixels as in ImageData: RGBA, row by row. */
export interface RgbaImage {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

export interface CompareOptions {
  /** Largest per-channel difference still treated as equal. */
  channelTolerance?: number;
  /** How far (px) to look in the other image for a matching colour; absorbs antialiasing and one pixel shifts. */
  neighbourhood?: number;
}

export interface CompareResult {
  differing: number;
  total: number;
  /** Faded grey copy of the expected image with the differing pixels in red. */
  diff: RgbaImage;
}

/**
 * Compares the RGB of two images of the same size (alpha is ignored). A pixel differs when its colour,
 * per channel, lies outside the range of colours around the same place in the other image, widened by
 * the tolerance, in either direction. An edge drawn a pixel further or with different antialiasing
 * stays inside that range; a missing line, a white seam or a moved element does not.
 */
export function compareImages(actual: RgbaImage, expected: RgbaImage, options: CompareOptions = {}): CompareResult {
  const { channelTolerance = 24, neighbourhood = 1 } = options;
  const { width, height } = expected;
  if (actual.width !== width || actual.height !== height) {
    throw new Error(`Image is ${actual.width}×${actual.height} instead of ${width}×${height}`);
  }

  const outsideNeighbourhood = (pixels: Uint8ClampedArray, other: Uint8ClampedArray, x: number, y: number): boolean => {
    const i = (y * width + x) * 4;
    for (let c = 0; c < 3; c++) {
      let min = 255;
      let max = 0;
      for (let ny = Math.max(0, y - neighbourhood); ny <= Math.min(height - 1, y + neighbourhood); ny++) {
        for (let nx = Math.max(0, x - neighbourhood); nx <= Math.min(width - 1, x + neighbourhood); nx++) {
          const v = other[(ny * width + nx) * 4 + c];
          if (v < min) min = v;
          if (v > max) max = v;
        }
      }
      const v = pixels[i + c];
      if (v < min - channelTolerance || v > max + channelTolerance) return true;
    }
    return false;
  };

  const diff = new Uint8ClampedArray(width * height * 4);
  let differing = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const a = actual.data;
      const e = expected.data;
      const quick =
        Math.abs(a[i] - e[i]) <= channelTolerance &&
        Math.abs(a[i + 1] - e[i + 1]) <= channelTolerance &&
        Math.abs(a[i + 2] - e[i + 2]) <= channelTolerance;
      if (!quick && (outsideNeighbourhood(a, e, x, y) || outsideNeighbourhood(e, a, x, y))) {
        differing++;
        diff.set([255, 0, 0, 255], i);
      } else {
        const luminance = 0.299 * e[i] + 0.587 * e[i + 1] + 0.114 * e[i + 2];
        const faded = 255 - (255 - luminance) * 0.3;
        diff.set([faded, faded, faded, 255], i);
      }
    }
  }
  return { differing, total: width * height, diff: { width, height, data: diff } };
}
