import { expect, test } from 'vitest';
import { createPhotoElement } from '../../model/factory';
import { TOOLBAR_GAP, TOOLBAR_HEIGHT, TOOLBAR_WIDTH, toolbarPosition } from './toolbarPosition';

const viewport = { scale: 2, originX: 10, originY: 20 };

test('the toolbar sits centred under the frame', () => {
  const frame = createPhotoElement('img', { x: 50, y: 30, width: 40, height: 20 });
  // Frame in px: x 110…190, y 80…120.
  expect(toolbarPosition(frame, viewport, 800, 500)).toEqual({ left: 150 - TOOLBAR_WIDTH / 2, top: 120 + TOOLBAR_GAP });
});

test('without room below, the toolbar goes above the frame', () => {
  const frame = createPhotoElement('img', { x: 50, y: 150, width: 40, height: 50 });
  // Frame in px: y 320…420; the box is 450 px high.
  expect(toolbarPosition(frame, viewport, 800, 450).top).toBe(320 - TOOLBAR_GAP - TOOLBAR_HEIGHT);
});

test('a rotated frame counts with its rotated outline', () => {
  const frame = createPhotoElement('img', { x: 50, y: 30, width: 40, height: 20, rotation: 90 });
  // Rotated outline in px: y 60…140.
  expect(toolbarPosition(frame, viewport, 800, 500).top).toBe(140 + TOOLBAR_GAP);
});

test('the toolbar stays inside the canvas box', () => {
  const huge = createPhotoElement('img', { x: -20, y: -20, width: 400, height: 300 });
  expect(toolbarPosition(huge, viewport, 800, 500)).toEqual({ left: 370 - TOOLBAR_WIDTH / 2, top: 0 });
  const leftEdge = createPhotoElement('img', { x: -5, y: 30, width: 4, height: 20 });
  expect(toolbarPosition(leftEdge, viewport, 800, 500).left).toBe(0);
  const rightEdge = createPhotoElement('img', { x: 390, y: 30, width: 4, height: 20 });
  expect(toolbarPosition(rightEdge, viewport, 800, 500).left).toBe(800 - TOOLBAR_WIDTH);
});
