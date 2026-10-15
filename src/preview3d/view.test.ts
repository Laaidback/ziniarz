import { expect, test } from 'vitest';
import { clickTurnsForward, fitDistance, isClick, TEXTURE_HEIGHT_PX, texturePxPerMm, turnForKey } from './view';

test('a press and release in place is a click; a drag (orbiting) is not', () => {
  expect(isClick({ x: 100, y: 100 }, { x: 103, y: 98 })).toBe(true);
  expect(isClick({ x: 100, y: 100 }, { x: 130, y: 100 })).toBe(false);
});

test('a click on the right half turns forward, on the left half back', () => {
  expect(clickTurnsForward(700, 1000)).toBe(true);
  expect(clickTurnsForward(300, 1000)).toBe(false);
});

test('arrow keys turn pages, other keys do nothing', () => {
  expect(turnForKey('ArrowRight')).toBe(true);
  expect(turnForKey('ArrowLeft')).toBe(false);
  expect(turnForKey('a')).toBeNull();
});

test('the camera distance fits the open spread in a wide and in a tall window', () => {
  const fov = 35;
  const half = Math.tan(((fov / 2) * Math.PI) / 180);
  const wide = fitDistance(276, 196, fov, 2);
  expect((196 / 2) / (wide * half)).toBeLessThanOrEqual(1);
  expect((276 / 2) / (wide * half * 2)).toBeLessThanOrEqual(1);
  const tall = fitDistance(276, 196, fov, 0.5);
  expect((276 / 2) / (tall * half * 0.5)).toBeLessThanOrEqual(1);
  expect(tall).toBeGreaterThan(wide);
});

test('page textures are about 1024 px high', () => {
  expect(TEXTURE_HEIGHT_PX).toBe(1024);
  expect(210 * texturePxPerMm()).toBeCloseTo(1024);
});
