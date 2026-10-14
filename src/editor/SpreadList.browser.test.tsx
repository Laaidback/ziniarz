import { expect, test } from 'vitest';
import { createTextElement, createZine } from '../model/factory';
import { openInEditor } from '../test/editorHarness';

const labels = ['Okładka', '2–3', '4–5', '6–7', 'Tył'];

test('lists spreads with thumbnails; clicking one makes it current', async () => {
  const { screen } = await openInEditor(createZine('Lato', 2));
  const list = screen.getByRole('navigation', { name: 'Rozkładówki' });
  for (const label of labels) await expect.element(list.getByRole('button', { name: label })).toBeVisible();
  await expect.poll(() => document.querySelectorAll('.spread-thumb img').length).toBe(5);
  await list.getByRole('button', { name: '4–5' }).click();
  await expect.element(list.getByRole('button', { name: '4–5' })).toHaveAttribute('aria-current', 'true');
});

test('"+ kartka" adds four pages after the current spread', async () => {
  const { screen, stored } = await openInEditor(createZine('Lato', 2));
  await screen.getByRole('button', { name: '+ kartka' }).click();
  await expect.element(screen.getByText('3 kartki · 12 stron')).toBeVisible();
  await expect.poll(async () => (await stored()).sheets).toBe(3);
});

test('"− kartka" removes empty pages at once', async () => {
  const { screen, stored } = await openInEditor(createZine('Lato', 2));
  await screen.getByRole('button', { name: '− kartka' }).click();
  await expect.poll(async () => (await stored()).sheets).toBe(1);
});

test('"− kartka" asks first when the pages have content, and highlights them', async () => {
  const zine = createZine('Lato', 2);
  zine.spreads[2].elements.push(createTextElement({ text: 'Treść' }));
  const { screen, stored } = await openInEditor(zine);
  const list = screen.getByRole('navigation', { name: 'Rozkładówki' });
  await list.getByRole('button', { name: '4–5' }).click();
  await screen.getByRole('button', { name: '− kartka' }).click();
  await expect.element(screen.getByRole('dialog')).toHaveTextContent('Strony 4–7 mają treść, która zniknie. Usunąć kartkę?');
  await expect.element(list.getByRole('button', { name: '4–5' })).toHaveClass('doomed');
  await expect.element(list.getByRole('button', { name: '6–7' })).toHaveClass('doomed');
  await screen.getByRole('button', { name: 'Usuń kartkę' }).click();
  await expect.poll(async () => (await stored()).sheets).toBe(1);
});
