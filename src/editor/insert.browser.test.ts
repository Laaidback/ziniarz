import { beforeEach, expect, test } from 'vitest';
import { noticeStore } from '../app/notices';
import { createTextElement, createZine } from '../model/factory';
import { newId } from '../model/ids';
import type { PhotoElement } from '../model/types';
import { measureTextHeight } from '../render/buildSpread';
import { getImage, openZiniarzDb } from '../storage/db';
import { insertPhotos, insertText } from './insert';
import { createEditorStore, selectedElement, selectZine } from './state/store';

async function pngFile(width: number, height: number, name = 'zdjecie.png'): Promise<File> {
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#336699';
  ctx.fillRect(0, 0, width, height);
  return new File([await canvas.convertToBlob({ type: 'image/png' })], name, { type: 'image/png' });
}

async function setup() {
  const db = await openZiniarzDb(`test-${newId()}`);
  const assets = { images: new Map<string, ImageBitmap>() };
  const store = createEditorStore(createZine('t', 1), {
    measureText: measureTextHeight,
    imageSize: (id) => assets.images.get(id),
  });
  store.getState().setSpread(1);
  return { db, assets, store };
}

beforeEach(() => noticeStore.setState({ notices: [] }));

test('a dropped photo fills the margin area of its page, keeping proportions', async () => {
  const env = await setup();
  await insertPhotos(env, [await pngFile(200, 100)], 3);
  const photo = selectZine(env.store.getState()).spreads[1].elements[0] as PhotoElement;
  expect(photo).toMatchObject({ kind: 'photo', x: 178, y: 83, width: 88, height: 44 });
  expect(await getImage(env.db, photo.imageId)).toBeDefined();
  expect(env.assets.images.get(photo.imageId)?.width).toBe(200);
  expect(env.store.getState().selectedId).toBe(photo.id);
});

test('several photos step aside; files that are not images are skipped with a message', async () => {
  const env = await setup();
  const text = new File(['hello'], 'notatki.txt', { type: 'text/plain' });
  await insertPhotos(env, [await pngFile(100, 100), text, await pngFile(100, 100)], null);
  const photos = selectZine(env.store.getState()).spreads[1].elements;
  expect(photos.map((p) => [p.x, p.y])).toEqual([
    [30, 61],
    [35, 66],
  ]);
  expect(noticeStore.getState().notices.map((n) => n.text)).toEqual(['Pominięto plików: 1 (to nie są obrazy).']);
});

test('"+ Napis" adds a frame across the margins of the clicked page, ready for typing', async () => {
  const { store } = await setup();
  store.getState().clickPage(3);
  insertText(store);
  expect(selectedElement(store.getState())).toMatchObject({ kind: 'text', text: 'Napis', x: 178, y: 30, width: 88 });
  expect(selectedElement(store.getState())!.height).toBeGreaterThan(0);
  expect(store.getState().mode).toBe('text');
});

test('after selecting an element, "+ Napis" and photos go to the page under its centre', async () => {
  const env = await setup();
  const { store } = env;
  const onRight = createTextElement({ text: 'b', x: 160, y: 40, width: 100 });
  store.getState().addElement(createTextElement({ text: 'a', x: 20, y: 40, width: 50 }));
  store.getState().addElement(onRight);
  store.getState().clickPage(2);
  store.getState().select(onRight.id);
  insertText(store);
  expect(selectedElement(store.getState())).toMatchObject({ kind: 'text', text: 'Napis', x: 178 });
  await insertPhotos(env, [await pngFile(200, 100)], null);
  expect(selectedElement(store.getState())).toMatchObject({ kind: 'photo', x: 178 });
});

test('an element whose centre is off the page falls back to the first page of the spread', async () => {
  const { store } = await setup();
  const outside = createTextElement({ text: 'b', x: 300, y: 40, width: 40 });
  store.getState().addElement(outside);
  store.getState().select(outside.id);
  insertText(store);
  expect(selectedElement(store.getState())).toMatchObject({ text: 'Napis', x: 30 });
});
