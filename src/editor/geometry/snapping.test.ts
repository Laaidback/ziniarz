import { expect, test } from 'vitest';
import { createPhotoElement, createZine } from '../../model/factory';
import { snapBox, snapPoint, snapTargets } from './snapping';

test('targets: page edges and centres, margins, spine and other elements', () => {
  const zine = createZine('t', 1);
  const other = createPhotoElement('i', { x: 40, y: 50, width: 20, height: 10 });
  const moving = createPhotoElement('i', { x: 0, y: 0, width: 5, height: 5 });
  zine.spreads[1].elements.push(other, moving);
  const targets = snapTargets(zine, 1, moving.id);
  // Pages 105 wide, spine at 105; default margins outer 12, inner 7, top 14, bottom 11.
  expect(targets.xs).toEqual([0, 12, 40, 50, 52.5, 60, 98, 105, 112, 157.5, 198, 210]);
  expect(targets.ys).toEqual([0, 14, 50, 55, 60, 74, 137, 148]);
});

test('the cover spread only snaps to the cover page and the spine', () => {
  expect(snapTargets(createZine('t', 1), 0, null).xs).toEqual([105, 112, 157.5, 198, 210]);
});

test('snapBox picks the closest edge or centre within the threshold', () => {
  const targets = { xs: [30, 148], ys: [30] };
  expect(snapBox({ x: 31, y: 100, width: 20, height: 20 }, targets, 2)).toEqual({ dx: -1, dy: 0, lineX: 30, lineY: null });
  expect(snapBox({ x: 100, y: 19.5, width: 20, height: 20 }, targets, 2)).toEqual({ dx: 0, dy: 0.5, lineX: null, lineY: 30 });
  expect(snapBox({ x: 137, y: 0, width: 20, height: 0 }, targets, 2)).toMatchObject({ dx: 1, lineX: 148 });
  expect(snapBox({ x: 34, y: 100, width: 20, height: 20 }, targets, 2).dx).toBe(0);
});

test('snapPoint moves a single coordinate', () => {
  expect(snapPoint(29, [30], 2)).toEqual({ value: 30, line: 30 });
  expect(snapPoint(25, [30], 2)).toEqual({ value: 25, line: null });
});
