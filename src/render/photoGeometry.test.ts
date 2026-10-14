import { expect, test } from 'vitest';
import { clampCrop, imagePlacement } from './photoGeometry';

const frame = { width: 100, height: 100 };

test('image covers the frame at zoom 1, centred', () => {
  expect(imagePlacement(frame, { offsetX: 0, offsetY: 0, zoom: 1 }, 200, 100)).toEqual({
    x: -50,
    y: 0,
    width: 200,
    height: 100,
  });
});

test('zoom and offset move the image', () => {
  expect(imagePlacement(frame, { offsetX: 10, offsetY: -5, zoom: 2 }, 100, 100)).toEqual({
    x: -40,
    y: -55,
    width: 200,
    height: 200,
  });
});

test('clampCrop keeps the frame covered', () => {
  expect(clampCrop(frame, { offsetX: 80, offsetY: 3, zoom: 1 }, 200, 100)).toEqual({ offsetX: 50, offsetY: 0, zoom: 1 });
  expect(clampCrop(frame, { offsetX: 0, offsetY: 0, zoom: 0.5 }, 100, 100)).toEqual({ offsetX: 0, offsetY: 0, zoom: 1 });
  expect(clampCrop(frame, { offsetX: -70, offsetY: 70, zoom: 2 }, 100, 100)).toEqual({ offsetX: -50, offsetY: 50, zoom: 2 });
});
