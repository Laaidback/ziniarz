import { userEvent } from '@vitest/browser/context';
import type Konva from 'konva';
import { afterEach, expect, test } from 'vitest';
import { createPhotoElement, createTextElement, createZine } from '../../model/factory';
import { mountStage } from '../../test/stageHarness';
import { solidBitmap } from '../../test/pixels';

let cleanup = () => {};
afterEach(() => cleanup());

function mount(...args: Parameters<typeof mountStage>) {
  const mounted = mountStage(...args);
  cleanup = mounted.cleanup;
  return mounted;
}

/** Spread mm are about 2 px here; pointer positions land within a pixel. */
const near = (actual: number, expected: number) => expect(Math.abs(actual - expected)).toBeLessThan(1);

function photoZine() {
  const zine = createZine('t', 1);
  const photo = createPhotoElement('img', { x: 20, y: 40, width: 60, height: 60 });
  zine.spreads[1].elements.push(photo);
  return { zine, photo };
}

test('dragging a frame near a margin snaps it there and reports the new position', async () => {
  const { zine, photo } = photoZine();
  const { callbacks, surface, at } = mount(zine);
  await userEvent.dragAndDrop(surface, surface, { sourcePosition: at(50, 70), targetPosition: at(61, 70) });
  expect(callbacks.select).toHaveBeenCalledWith(photo.id);
  const [id, patch] = callbacks.change.mock.calls.at(-1)!;
  expect(id).toBe(photo.id);
  expect(patch.x).toBeCloseTo(30, 5); // the left margin, 1 mm away
  near(patch.y, 40);
});

test('holding Alt turns snapping off', async () => {
  const { zine } = photoZine();
  const { callbacks, surface, at } = mount(zine);
  await userEvent.keyboard('{Alt>}');
  await userEvent.dragAndDrop(surface, surface, { sourcePosition: at(50, 70), targetPosition: at(61, 70) });
  await userEvent.keyboard('{/Alt}');
  near(callbacks.change.mock.calls.at(-1)![1].x, 31);
});

test('a finished resize is reported as a frame in mm', () => {
  const { zine, photo } = photoZine();
  const { editor, callbacks } = mount(zine, { selectedId: photo.id });
  const transformer = editor.stage.findOne('Transformer') as Konva.Transformer;
  const proxy = transformer.nodes()[0];
  proxy.scaleX(2);
  transformer.fire('transformend');
  expect(callbacks.change).toHaveBeenCalledWith(photo.id, { x: -10, y: 40, width: 120, height: 60, rotation: 0 });
});

test('a resized text reports width but never height', () => {
  const zine = createZine('t', 1);
  const text = createTextElement({ text: 'a', x: 30, y: 30, width: 80 });
  zine.spreads[1].elements.push(text);
  const { editor, callbacks } = mount(zine, { selectedId: text.id });
  const transformer = editor.stage.findOne('Transformer') as Konva.Transformer;
  transformer.nodes()[0].scaleX(0.5);
  transformer.fire('transformend');
  const patch = callbacks.change.mock.calls[0][1];
  expect(Object.keys(patch).sort()).toEqual(['rotation', 'width', 'x', 'y']);
  expect(patch.width).toBeCloseTo(40, 5);
  expect(patch.x).toBeCloseTo(50, 5);
  expect(patch.y).toBeCloseTo(30, 5);
});

test('in crop mode, dragging moves the photo inside the frame and the wheel zooms', async () => {
  const { zine, photo } = photoZine();
  const assets = { images: new Map([['img', await solidBitmap(200, 100, '#00ff00')]]) };
  const { editor, callbacks, surface, at } = mount(zine, { selectedId: photo.id, mode: 'crop', assets });
  expect((editor.stage.findOne('Transformer') as Konva.Transformer).nodes()).toHaveLength(0);
  await userEvent.dragAndDrop(surface, surface, { sourcePosition: at(50, 70), targetPosition: at(40, 70) });
  const [id, crop] = callbacks.crop.mock.calls.at(-1)!;
  expect(id).toBe(photo.id);
  near(crop.offsetX, -10);
  near(crop.offsetY, 0);
  expect(callbacks.change).not.toHaveBeenCalled();
  expect(callbacks.endGesture).toHaveBeenCalledTimes(1);
  editor.stage.fire('wheel', { evt: new WheelEvent('wheel', { deltaY: -100, cancelable: true }) });
  expect(callbacks.crop.mock.calls.at(-1)![1].zoom).toBeCloseTo(1.1, 5);
});

test('in crop mode, a flipped photo follows the pointer too', async () => {
  const { zine, photo } = photoZine();
  photo.flipX = true;
  const assets = { images: new Map([['img', await solidBitmap(200, 100, '#00ff00')]]) };
  const { callbacks, surface, at } = mount(zine, { selectedId: photo.id, mode: 'crop', assets });
  await userEvent.dragAndDrop(surface, surface, { sourcePosition: at(50, 70), targetPosition: at(40, 75) });
  // Mirrored around the frame centre: moving the visible image left raises offsetX.
  const crop = callbacks.crop.mock.calls.at(-1)![1];
  near(crop.offsetX, 10);
  near(crop.offsetY, 5);
});

test('in crop mode, a rotated photo moves along the frame axes', async () => {
  const { zine, photo } = photoZine();
  photo.rotation = 90;
  const assets = { images: new Map([['img', await solidBitmap(200, 100, '#00ff00')]]) };
  const { callbacks, surface, at } = mount(zine, { selectedId: photo.id, mode: 'crop', assets });
  await userEvent.dragAndDrop(surface, surface, { sourcePosition: at(50, 70), targetPosition: at(40, 70) });
  // Turned 90° clockwise, the frame's y axis points left on screen.
  const crop = callbacks.crop.mock.calls.at(-1)![1];
  near(crop.offsetX, 0);
  near(crop.offsetY, 10);
});

test('in crop mode, pressing outside the photo ends cropping', async () => {
  const { zine, photo } = photoZine();
  const { callbacks, surface, at } = mount(zine, { selectedId: photo.id, mode: 'crop' });
  await userEvent.click(surface, { position: at(120, 150) });
  expect(callbacks.endCrop).toHaveBeenCalled();
});
