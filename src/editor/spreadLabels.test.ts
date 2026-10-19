import { expect, test } from 'vitest';
import { createTextElement, createZine } from '../model/factory';
import { removalMessage, spreadLabel, spreadName, thumbnailKey } from './spreadLabels';

test('spread labels: the cover is one spread, there is no separate back', () => {
  expect([0, 1, 2, 3].map((i) => spreadLabel(i, 2))).toEqual(['Okładka', '2–3', '4–5', '6–7']);
  expect([0, 1, 3].map((i) => spreadName(i, 2))).toEqual(['Okładka', 'Strony 2–3', 'Strony 6–7']);
});

test('removal message names the pages and says what goes away', () => {
  const pages = [4, 5, 6, 7];
  expect(removalMessage(pages, { content: true, notes: false })).toBe('Strony 4–7 mają treść, która zniknie. Usunąć kartkę?');
  expect(removalMessage(pages, { content: false, notes: true })).toBe(
    'Strony 4–7 mają notatki w notatniku, które znikną. Usunąć kartkę?',
  );
  expect(removalMessage(pages, { content: true, notes: true })).toBe(
    'Strony 4–7 mają treść i notatki w notatniku, które znikną. Usunąć kartkę?',
  );
});

test('thumbnail key changes with the spread, its page colours and the version only', () => {
  const zine = createZine('t', 2);
  const key = thumbnailKey(zine, 1, 0);
  expect(thumbnailKey({ ...zine, title: 'x' }, 1, 0)).toBe(key);
  expect(thumbnailKey({ ...zine, pages: { 5: { background: '#000' } } }, 1, 0)).toBe(key);
  expect(thumbnailKey({ ...zine, pages: { 3: { background: '#000' } } }, 1, 0)).not.toBe(key);
  expect(thumbnailKey(zine, 1, 1)).not.toBe(key);
  const edited = structuredClone(zine);
  edited.spreads[1].elements.push(createTextElement());
  expect(thumbnailKey(edited, 1, 0)).not.toBe(key);
  const cover = thumbnailKey(zine, 0, 0);
  expect(thumbnailKey({ ...zine, pages: { 8: { background: '#000' } } }, 0, 0)).not.toBe(cover);
  expect(thumbnailKey({ ...zine, pages: { 1: { background: '#000' } } }, 0, 0)).not.toBe(cover);
  expect(thumbnailKey({ ...zine, pages: { 2: { background: '#000' } } }, 0, 0)).toBe(cover);
});
