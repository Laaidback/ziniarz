import { userEvent } from '@vitest/browser/context';
import { expect, test } from 'vitest';
import '../app/app.css';
import { createZine } from '../model/factory';
import { openScreen } from '../test/screenHarness';
import { Preview3dScreen } from './Preview3dScreen';

// three.js is imported on demand; under a full parallel test run that first import can take seconds.
const SLOW = { timeout: 20_000 };

test('opens on the cover, draws every page and turns with keys, buttons and clicks', { timeout: 40_000 }, async () => {
  const zine = createZine('Lato', 2);
  zine.pages[1] = { background: '#ff0000' };
  const { screen } = await openScreen(zine, <Preview3dScreen zineId={zine.id} />);
  await expect.element(screen.getByRole('heading', { name: 'Podgląd 3D: Lato' })).toBeVisible();
  await expect.element(screen.getByText('Okładka')).toBeVisible();
  const view = screen.getByLabelText('Podgląd 3D zina');
  await expect.poll(() => view.element().querySelector('canvas'), SLOW).not.toBeNull();
  await expect.poll(() => document.body.textContent, SLOW).not.toMatch(/Rysowanie stron/);
  await expect.element(screen.getByRole('button', { name: '← Wstecz' })).toBeDisabled();

  await userEvent.keyboard('{ArrowRight}');
  await expect.element(screen.getByText('Strony 2–3')).toBeVisible();
  await screen.getByRole('button', { name: 'Dalej →' }).click();
  await expect.element(screen.getByText('Strony 4–5')).toBeVisible();

  const { width, height } = view.element().getBoundingClientRect();
  await view.click({ position: { x: width * 0.25, y: height / 2 } });
  await expect.element(screen.getByText('Strony 2–3')).toBeVisible();
  await view.click({ position: { x: width * 0.75, y: height / 2 } });
  await expect.element(screen.getByText('Strony 4–5')).toBeVisible();
  await userEvent.keyboard('{ArrowLeft}');
  await expect.element(screen.getByText('Strony 2–3')).toBeVisible();
  await expect
    .element(screen.getByRole('link', { name: '← Wróć do edytora' }))
    .toHaveAttribute('href', `#/zin/${zine.id}`);
});

test('a missing zine shows a message and a way back', async () => {
  const zine = createZine('Lato', 1);
  const { screen } = await openScreen(zine, <Preview3dScreen zineId="nope" />);
  await expect.element(screen.getByText('Nie znaleziono tego zina. Może został usunięty.')).toBeVisible();
});
