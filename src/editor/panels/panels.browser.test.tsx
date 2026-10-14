import { expect, test } from 'vitest';
import { userEvent } from '@vitest/browser/context';
import { createPhotoElement, createTextElement, createZine } from '../../model/factory';
import type { PhotoElement, TextElement } from '../../model/types';
import { renderPanel } from '../../test/panelHarness';

const textOf = (zine: { spreads: { elements: unknown[] }[] }) => zine.spreads[0].elements[0] as TextElement;

test('with nothing selected: zine title and margins; typing the title is one undo step', async () => {
  const { screen, store, zine } = await renderPanel(createZine('Lato', 1));
  await screen.getByLabelText('Tytuł').fill('Jesień');
  expect(zine().title).toBe('Jesień');
  await screen.getByLabelText('Zewnętrzny').fill('12');
  expect(zine().margins.outer).toBe(12);
  store.getState().undo();
  store.getState().undo();
  expect(zine().title).toBe('Lato');
});

test('a clicked page shows its background colour; HEX and "Białe tło" change it', async () => {
  const { screen, zine } = await renderPanel(createZine('Lato', 1), (store) => store.getState().clickPage(1));
  await expect.element(screen.getByRole('heading', { name: 'Strona 1' })).toBeVisible();
  await screen.getByLabelText('Tło strony (HEX)').fill('#FF0000');
  expect(zine().pages[1]).toEqual({ background: '#ff0000' });
  await screen.getByRole('button', { name: 'Białe tło' }).click();
  expect(zine().pages[1]).toBeUndefined();
});

test('HEX can be typed character by character; 3-digit shorthand counts on Enter', async () => {
  const { screen, zine } = await renderPanel(createZine('Lato', 1), (store) => store.getState().clickPage(1));
  const hex = screen.getByLabelText('Tło strony (HEX)');
  await userEvent.clear(hex);
  await userEvent.type(hex, '#00ff00');
  expect(zine().pages[1]).toEqual({ background: '#00ff00' });
  await expect.element(hex).toHaveValue('#00ff00');
  await userEvent.clear(hex);
  await userEvent.type(hex, '#f00');
  expect(zine().pages[1]).toEqual({ background: '#00ff00' });
  await userEvent.keyboard('{Enter}');
  expect(zine().pages[1]).toEqual({ background: '#ff0000' });
  await expect.element(hex).toHaveValue('#ff0000');
});

test('text settings: size, colour swatch from the zine, alignment', async () => {
  const start = createZine('Lato', 1);
  start.pages[1] = { background: '#123456' };
  const { screen, zine } = await renderPanel(start, (store) => store.getState().addElement(createTextElement({ text: 'a' })));
  await screen.getByLabelText('Rozmiar').fill('24');
  expect(textOf(zine()).size).toBe(24);
  await screen.getByRole('button', { name: 'Kolor #123456' }).click();
  expect(textOf(zine()).color).toBe('#123456');
  await screen.getByRole('button', { name: 'Do środka' }).click();
  expect(textOf(zine()).align).toBe('center');
});

test('bold and italic are only offered when the family has those files', async () => {
  const { screen, zine } = await renderPanel(createZine('Lato', 1), (store) =>
    store.getState().addElement(createTextElement({ text: 'a', bold: true, italic: true })),
  );
  await expect.element(screen.getByRole('button', { name: 'Kursywa' })).toBeEnabled();
  await screen.getByLabelText('Font', { exact: true }).selectOptions('Oswald');
  expect(textOf(zine())).toMatchObject({ fontFamilyId: 'oswald', bold: true, italic: false });
  await expect.element(screen.getByRole('button', { name: 'Kursywa' })).toBeDisabled();
  await screen.getByLabelText('Font', { exact: true }).selectOptions('Archivo Black');
  expect(textOf(zine())).toMatchObject({ bold: false, italic: false });
  await expect.element(screen.getByRole('button', { name: 'Pogrubienie' })).toBeDisabled();
});

test('layer buttons reorder; the top element cannot go higher', async () => {
  const first = createTextElement({ text: 'a' });
  const second = createTextElement({ text: 'b' });
  const { screen, zine } = await renderPanel(createZine('Lato', 1), (store) => {
    store.getState().addElement(first);
    store.getState().addElement(second);
    store.getState().select(first.id);
  });
  await screen.getByRole('button', { name: 'Na wierzch' }).click();
  expect(zine().spreads[0].elements.map((e) => e.id)).toEqual([second.id, first.id]);
  await expect.element(screen.getByRole('button', { name: 'Wyżej' })).toBeDisabled();
});

test('photo settings: crop mode and mirroring', async () => {
  const { screen, store, zine } = await renderPanel(createZine('Lato', 1), (store) =>
    store.getState().addElement(createPhotoElement('img')),
  );
  await screen.getByRole('button', { name: 'Kadruj' }).click();
  expect(store.getState().mode).toBe('crop');
  await screen.getByLabelText('Odbij w poziomie').click();
  expect((zine().spreads[0].elements[0] as PhotoElement).flipX).toBe(true);
});
