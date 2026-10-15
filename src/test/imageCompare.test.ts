import { describe, expect, test } from 'vitest';
import { compareImages, type RgbaImage } from './imageCompare';

function image(width: number, height: number, paint: (x: number, y: number) => [number, number, number]): RgbaImage {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      [data[i], data[i + 1], data[i + 2]] = paint(x, y);
      data[i + 3] = 255;
    }
  }
  return { width, height, data };
}

const white = (): [number, number, number] => [255, 255, 255];

describe('compareImages', () => {
  test('identical images have no differing pixels', () => {
    const a = image(10, 8, (x, y) => [x * 20, y * 30, 100]);
    const result = compareImages(a, image(10, 8, (x, y) => [x * 20, y * 30, 100]));
    expect(result.differing).toBe(0);
    expect(result.total).toBe(80);
  });

  test('small channel differences are within the tolerance', () => {
    const result = compareImages(image(6, 6, white), image(6, 6, () => [240, 250, 232]), { channelTolerance: 24 });
    expect(result.differing).toBe(0);
  });

  test('a one pixel shift of an edge (antialiasing, hinting) is absorbed', () => {
    const edge = (at: number) => (x: number): [number, number, number] => (x < at ? [0, 0, 0] : x === at ? [128, 128, 128] : [255, 255, 255]);
    const result = compareImages(image(12, 6, edge(5)), image(12, 6, edge(6)));
    expect(result.differing).toBe(0);
  });

  test('a missing thin line counts, both when it vanishes and when it appears', () => {
    const line = image(9, 9, (x) => (x === 4 ? [0, 0, 0] : [255, 255, 255]));
    expect(compareImages(line, image(9, 9, white)).differing).toBe(9);
    expect(compareImages(image(9, 9, white), line).differing).toBe(9);
  });

  test('a white seam inside a photo counts', () => {
    const photo = (x: number): [number, number, number] => [200 - x * 5, 80, 120 + x * 5];
    const seam = image(20, 10, (x) => (x === 10 ? [255, 255, 255] : photo(x)));
    expect(compareImages(seam, image(20, 10, photo)).differing).toBe(10);
  });

  test('marks differing pixels red on a faded copy of the expected image', () => {
    const expected = image(3, 1, () => [0, 0, 0]);
    const actual = image(3, 1, (x) => (x === 2 ? [255, 255, 255] : [0, 0, 0]));
    const { diff } = compareImages(actual, expected, { neighbourhood: 0 });
    expect([...diff.data.slice(8, 12)]).toEqual([255, 0, 0, 255]);
    expect(diff.data[0]).toBeGreaterThan(150);
  });

  test('images of different sizes are reported, not compared', () => {
    expect(() => compareImages(image(2, 2, white), image(3, 2, white))).toThrow('2×2 instead of 3×2');
  });
});
