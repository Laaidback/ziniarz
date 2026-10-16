import { beforeEach, expect, test } from 'vitest';
import { noticeStore } from '../app/notices';
import { createTextElement, createZine, DEFAULT_MARGINS } from '../model/factory';
import { PAGE_WIDTH, SPREAD_WIDTH } from '../model/geometry';
import { newId } from '../model/ids';
import type { PhotoElement } from '../model/types';
import { measureTextHeight } from '../render/buildSpread';
import { getImage, openZiniarzDb } from '../storage/db';
import { HEIC_SKIPPED, insertPhotos, insertText } from './insert';
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

// Margin areas with the default margins: left page x 12…98, right page x 112…198, y 14…137.
const LEFT_MARGIN_X = DEFAULT_MARGINS.outer;
const RIGHT_MARGIN_X = PAGE_WIDTH + DEFAULT_MARGINS.inner;
const MARGIN_WIDTH = PAGE_WIDTH - DEFAULT_MARGINS.outer - DEFAULT_MARGINS.inner;

test('a dropped photo fills the margin area of its page, keeping proportions', async () => {
  const env = await setup();
  await insertPhotos(env, [await pngFile(200, 100)], 3);
  const photo = selectZine(env.store.getState()).spreads[1].elements[0] as PhotoElement;
  expect(photo).toMatchObject({ kind: 'photo', x: RIGHT_MARGIN_X, y: 54, width: MARGIN_WIDTH, height: 43 });
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
    [12, 32.5],
    [17, 37.5],
  ]);
  expect(noticeStore.getState().notices.map((n) => n.text)).toEqual(['Pominięto plików: 1 (to nie są obrazy).']);
});

test('"+ Napis" adds a frame across the margins of the clicked page, ready for typing', async () => {
  const { store } = await setup();
  store.getState().clickPage(3);
  insertText(store);
  expect(selectedElement(store.getState())).toMatchObject({ kind: 'text', text: 'Napis', x: RIGHT_MARGIN_X, y: DEFAULT_MARGINS.top, width: MARGIN_WIDTH });
  expect(selectedElement(store.getState())!.height).toBeGreaterThan(0);
  expect(store.getState().mode).toBe('text');
});

test('after selecting an element, "+ Napis" and photos go to the page under its centre', async () => {
  const env = await setup();
  const { store } = env;
  const onRight = createTextElement({ text: 'b', x: 120, y: 40, width: 60 });
  store.getState().addElement(createTextElement({ text: 'a', x: 20, y: 40, width: 50 }));
  store.getState().addElement(onRight);
  store.getState().clickPage(2);
  store.getState().select(onRight.id);
  insertText(store);
  expect(selectedElement(store.getState())).toMatchObject({ kind: 'text', text: 'Napis', x: RIGHT_MARGIN_X });
  await insertPhotos(env, [await pngFile(200, 100)], null);
  expect(selectedElement(store.getState())).toMatchObject({ kind: 'photo', x: RIGHT_MARGIN_X });
});

test('an element whose centre is off the page falls back to the first page of the spread', async () => {
  const { store } = await setup();
  const outside = createTextElement({ text: 'b', x: 300, y: 40, width: 40 });
  store.getState().addElement(outside);
  store.getState().select(outside.id);
  insertText(store);
  expect(selectedElement(store.getState())).toMatchObject({ text: 'Napis', x: LEFT_MARGIN_X });
});

test('progress is reported per file, and an aborted insert stops before the next file', async () => {
  const env = await setup();
  const controller = new AbortController();
  const progress: [number, number][] = [];
  const files = [await pngFile(100, 100), await pngFile(100, 100), await pngFile(100, 100)];
  await insertPhotos(env, files, null, {
    signal: controller.signal,
    onProgress: (current, total) => {
      progress.push([current, total]);
      if (current === 2) controller.abort();
    },
  });
  expect(progress).toEqual([
    [1, 3],
    [2, 3],
  ]);
  expect(selectZine(env.store.getState()).spreads[1].elements).toHaveLength(1);
  expect(env.assets.images.size).toBe(1);
});

test('an insert aborted while a photo is being read adds nothing more and keeps no bitmap', async () => {
  const env = await setup();
  const controller = new AbortController();
  const done = insertPhotos(env, [await pngFile(2000, 2000)], null, { signal: controller.signal });
  controller.abort();
  await done;
  expect(selectZine(env.store.getState()).spreads[1].elements).toEqual([]);
  expect(env.assets.images.size).toBe(0);
  expect(noticeStore.getState().notices).toEqual([]);
});

test('HEIC photos the browser cannot read get their own message', async () => {
  const env = await setup();
  const heic = new File([new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112])], 'IMG_0001.HEIC', { type: 'image/heic' });
  const heif = new File([new Uint8Array([1, 2, 3])], 'zdjecie.heif');
  const text = new File(['hello'], 'notatki.txt', { type: 'text/plain' });
  await insertPhotos(env, [heic, heif, text], null);
  expect(noticeStore.getState().notices.map((n) => n.text)).toEqual([
    HEIC_SKIPPED,
    'Pominięto plików: 1 (to nie są obrazy).',
  ]);
  expect(HEIC_SKIPPED).toBe("Zdjęć HEIC (z iPhone'a) przeglądarka nie odczyta. Zapisz je jako JPG i dodaj jeszcze raz.");
});

test('after clicking the right half of a photo across the spread, "+ Napis" goes to the right page', async () => {
  const { store } = await setup();
  const wide = createTextElement({ text: 'szeroki', x: 0, y: 40, width: SPREAD_WIDTH });
  store.getState().addElement(wide);
  store.getState().clickPage(2);
  store.getState().select(wide.id, 3);
  expect(store.getState().activePage).toBe(3);
  insertText(store);
  expect(selectedElement(store.getState())).toMatchObject({ text: 'Napis', x: RIGHT_MARGIN_X });
});

test('on the cover "+ Napis" goes to the front, or to the back cover once it was clicked', async () => {
  const { store } = await setup();
  store.getState().setSpread(0);
  insertText(store);
  expect(selectedElement(store.getState())).toMatchObject({ text: 'Napis', x: RIGHT_MARGIN_X });
  store.getState().clickPage(4);
  insertText(store);
  expect(selectedElement(store.getState())).toMatchObject({ text: 'Napis', x: LEFT_MARGIN_X });
});
