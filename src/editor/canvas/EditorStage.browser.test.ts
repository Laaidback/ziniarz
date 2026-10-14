import { userEvent } from '@vitest/browser/context';
import type Konva from 'konva';
import { afterEach, expect, test } from 'vitest';
import { createPhotoElement, createTextElement, createZine } from '../../model/factory';
import { mountStage } from '../../test/stageHarness';
import { PHOTO_ANCHORS, TEXT_ANCHORS } from './EditorStage';

let cleanup = () => {};
afterEach(() => cleanup());

function mount(...args: Parameters<typeof mountStage>) {
  const mounted = mountStage(...args);
  cleanup = mounted.cleanup;
  return mounted;
}

function sample() {
  const zine = createZine('t', 1);
  const photo = createPhotoElement('missing', { x: 20, y: 40, width: 60, height: 60 });
  const text = createTextElement({ text: 'Napis', x: 178, y: 30, width: 88, size: 24 });
  zine.spreads[1].elements.push(photo, text);
  return { zine, photo, text };
}

const transformer = (stage: Konva.Stage) => stage.findOne('Transformer') as Konva.Transformer;

test('the spread with its bleed fits the box, centred', () => {
  const { editor } = mount(sample().zine);
  const { scale, originX, originY } = editor.viewport();
  expect(scale).toBeCloseTo((500 - 48) / 216, 5);
  expect(originX).toBeCloseTo((800 - 296 * scale) / 2, 5);
  expect(originY).toBeCloseTo((500 - 210 * scale) / 2, 5);
  const box = editor.stage.container().getBoundingClientRect();
  const point = editor.toSpreadMm(box.left + originX + 10 * scale, box.top + originY + 20 * scale);
  expect(point.x).toBeCloseTo(10, 5);
  expect(point.y).toBeCloseTo(20, 5);
});

test('clicking an element selects it', async () => {
  const { zine, photo } = sample();
  const { callbacks, surface, at } = mount(zine);
  await userEvent.click(surface, { position: at(50, 70) });
  expect(callbacks.select).toHaveBeenCalledWith(photo.id);
});

test('clicking an empty page reports the page; clicking outside reports null', async () => {
  const { callbacks, surface, at } = mount(sample().zine);
  await userEvent.click(surface, { position: at(100, 180) });
  expect(callbacks.clickPage).toHaveBeenLastCalledWith(2);
  await userEvent.click(surface, { position: at(250, 180) });
  expect(callbacks.clickPage).toHaveBeenLastCalledWith(3);
  await userEvent.click(surface, { position: at(100, -8) });
  expect(callbacks.clickPage).toHaveBeenLastCalledWith(null);
  expect(callbacks.select).not.toHaveBeenCalled();
});

test('double-clicking an element asks to edit it', async () => {
  const { zine, text } = sample();
  const { callbacks, surface, at } = mount(zine);
  await userEvent.dblClick(surface, { position: at(190, 34) });
  expect(callbacks.doubleClick).toHaveBeenCalledWith(text.id);
});

test('guides follow the switch; the missing page next to a cover is shaded', () => {
  const { zine } = sample();
  const { editor, view } = mount(zine);
  expect(editor.stage.find('.guide-margin')).toHaveLength(2);
  expect(editor.stage.find('.missing-page')).toHaveLength(0);
  editor.update({ ...view, showGuides: false, spread: 0 });
  expect(editor.stage.find('.guide-margin')).toHaveLength(0);
  expect(editor.stage.find('.missing-page')).toHaveLength(1);
});

test('a selected text gets side handles only, a photo gets all eight', () => {
  const { zine, photo, text } = sample();
  const { editor, view } = mount(zine, { selectedId: text.id });
  expect(transformer(editor.stage).enabledAnchors()).toEqual(TEXT_ANCHORS);
  expect(transformer(editor.stage).nodes()).toHaveLength(1);
  editor.update({ ...view, selectedId: photo.id });
  expect(transformer(editor.stage).enabledAnchors()).toEqual(PHOTO_ANCHORS);
  editor.update({ ...view, selectedId: null });
  expect(transformer(editor.stage).nodes()).toHaveLength(0);
});

test('while a text is being typed, its canvas node is hidden', () => {
  const { zine, text } = sample();
  const { editor } = mount(zine, { selectedId: text.id, mode: 'text' });
  const node = editor.stage.findOne((n: Konva.Node) => n.id() === text.id)!;
  expect(node.visible()).toBe(false);
  expect(transformer(editor.stage).nodes()).toHaveLength(0);
});
