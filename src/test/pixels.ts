export type Rgba = [number, number, number, number];

export function pixel(canvas: HTMLCanvasElement, x: number, y: number): Rgba {
  const data = canvas.getContext('2d')!.getImageData(Math.floor(x), Math.floor(y), 1, 1).data;
  return [data[0], data[1], data[2], data[3]];
}

export function expectColor(actual: Rgba, expected: [number, number, number], tolerance = 8): void {
  const ok = expected.every((value, i) => Math.abs(actual[i] - value) <= tolerance) && actual[3] > 250;
  if (!ok) throw new Error(`Expected rgb(${expected.join(',')}) but got rgba(${actual.join(',')})`);
}

export async function solidBitmap(width: number, height: number, color: string): Promise<ImageBitmap> {
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, width, height);
  return createImageBitmap(canvas);
}

/** Left half `left`, right half `right`. */
export async function splitBitmap(width: number, height: number, left: string, right: string): Promise<ImageBitmap> {
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = left;
  ctx.fillRect(0, 0, width / 2, height);
  ctx.fillStyle = right;
  ctx.fillRect(width / 2, 0, width / 2, height);
  return createImageBitmap(canvas);
}

export function hasDarkPixel(canvas: HTMLCanvasElement, x: number, y: number, width: number, height: number): boolean {
  const data = canvas.getContext('2d')!.getImageData(x, y, width, height).data;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] > 200 && data[i] < 100 && data[i + 1] < 100 && data[i + 2] < 100) return true;
  }
  return false;
}
