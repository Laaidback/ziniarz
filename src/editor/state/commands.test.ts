import { expect, test } from 'vitest';
import { createPhotoElement, createTextElement, createZine } from '../../model/factory';
import {
  addElement,
  addFontFamilies,
  findElement,
  mapElement,
  patchElement,
  removeElement,
  replaceFontFamilies,
  setMargins,
  setPageBackground,
  setTitle,
} from './commands';

test('add, find, patch and remove elements without touching other spreads', () => {
  const zine = createZine('t', 1);
  const text = createTextElement({ text: 'a' });
  const added = addElement(zine, 1, text);
  expect(zine.spreads[1].elements).toEqual([]);
  expect(added.spreads[0]).toBe(zine.spreads[0]);
  expect(findElement(added, 1, text.id)).toBe(text);
  const moved = mapElement(added, 1, text.id, (e) => patchElement(e, { x: 12 }));
  expect(findElement(moved, 1, text.id)?.x).toBe(12);
  expect(findElement(added, 1, text.id)?.x).toBe(0);
  expect(removeElement(moved, 1, text.id).spreads[1].elements).toEqual([]);
});

test('missing elements leave the zine untouched', () => {
  const zine = createZine('t', 1);
  expect(mapElement(zine, 1, 'nope', (e) => patchElement(e, { x: 1 }))).toBe(zine);
  expect(removeElement(zine, 1, 'nope')).toBe(zine);
  expect(findElement(zine, 7, 'nope')).toBeUndefined();
});

test('new elements go on top', () => {
  const photo = createPhotoElement('img');
  const text = createTextElement();
  const zine = addElement(addElement(createZine('t', 1), 1, photo), 1, text);
  expect(zine.spreads[1].elements.map((e) => e.id)).toEqual([photo.id, text.id]);
});

test('page background, margins, title', () => {
  const zine = setPageBackground(createZine('t', 1), 2, '#ff0000');
  expect(zine.pages[2]).toEqual({ background: '#ff0000' });
  expect(setPageBackground(zine, 2, null).pages).toEqual({});
  expect(setMargins(zine, { outer: 1, inner: 2, top: 3, bottom: 4 }).margins).toEqual({ outer: 1, inner: 2, top: 3, bottom: 4 });
  expect(setTitle(zine, 'Nowy').title).toBe('Nowy');
});

test('page background, margins and title return the same zine when nothing changes', () => {
  const zine = setPageBackground(createZine('t', 1), 2, '#ff0000');
  expect(setPageBackground(zine, 2, '#ff0000')).toBe(zine);
  expect(setPageBackground(zine, 3, null)).toBe(zine);
  expect(setMargins(zine, { ...zine.margins })).toBe(zine);
  expect(setTitle(zine, 't')).toBe(zine);
});

test('addFontFamilies skips families already on the list', () => {
  const zine = { ...createZine('t', 1), fonts: ['a'] };
  expect(addFontFamilies(zine, ['a', 'b', 'b']).fonts).toEqual(['a', 'b']);
  expect(addFontFamilies(zine, ['a'])).toBe(zine);
});

test('replaceFontFamilies swaps family ids in the font list and in texts', () => {
  const zine = { ...createZine('t', 1), fonts: ['old', 'other'] };
  const uses = createTextElement({ text: 'a', fontFamilyId: 'old' });
  const builtin = createTextElement({ text: 'b', fontFamilyId: 'inter' });
  zine.spreads[1].elements.push(uses, builtin);
  const next = replaceFontFamilies(zine, { old: 'new' });
  expect(next.fonts).toEqual(['new', 'other']);
  expect(next.spreads[1].elements.map((e) => (e.kind === 'text' ? e.fontFamilyId : null))).toEqual(['new', 'inter']);
  expect(next.spreads[0]).toBe(zine.spreads[0]);
  expect(replaceFontFamilies(zine, {})).toBe(zine);
});
