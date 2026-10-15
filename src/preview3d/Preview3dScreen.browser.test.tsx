import { userEvent } from '@vitest/browser/context';
import { expect, test, vi } from 'vitest';
import '../app/app.css';
import { createZine } from '../model/factory';
import { openScreen } from '../test/screenHarness';
import { renderPage } from '../render/renderPage';
import { Preview3dScreen, type DrawPage, type LoadScene } from './Preview3dScreen';
import { texturePxPerMm } from './view';

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

  await userEvent.keyboard('{Alt>}{ArrowRight}{/Alt}'); // Alt+arrow is left to the browser (back / forward)
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

const drawReal: DrawPage = (zine, page, assets) => renderPage(zine, page, assets, { pxPerMm: texturePxPerMm(), bleed: false });

test('a page that fails to draw stays blank and does not hold up the progress', async () => {
  const error = vi.spyOn(console, 'error').mockImplementation(() => {});
  const zine = createZine('Lato', 1);
  const drawPage: DrawPage = (z, page, assets) => {
    if (page === 2) throw new Error('canvas too big');
    return drawReal(z, page, assets);
  };
  const { screen } = await openScreen(zine, <Preview3dScreen zineId={zine.id} drawPage={drawPage} />);
  await expect.element(screen.getByText(/Rysowanie stron/)).toBeInTheDocument();
  await expect.poll(() => document.body.textContent, SLOW).not.toMatch(/Rysowanie stron/);
  expect(error).toHaveBeenCalledWith(expect.objectContaining({ message: 'canvas too big' }));
  error.mockRestore();
});

test('pages are drawn again after the WebGL context comes back', { timeout: 30_000 }, async () => {
  const zine = createZine('Lato', 1);
  const drawn: number[] = [];
  const drawPage: DrawPage = (z, page, assets) => {
    drawn.push(page);
    return drawReal(z, page, assets);
  };
  const { screen } = await openScreen(zine, <Preview3dScreen zineId={zine.id} drawPage={drawPage} />);
  await expect.poll(() => drawn.length, SLOW).toBe(4);
  const canvas = screen.getByLabelText('Podgląd 3D zina').element().querySelector('canvas')!;
  const lose = canvas.getContext('webgl2')!.getExtension('WEBGL_lose_context')!;
  lose.loseContext();
  await new Promise((resolve) => setTimeout(resolve, 50));
  lose.restoreContext();
  await expect.poll(() => drawn, SLOW).toEqual([1, 2, 3, 4, 1, 2, 3, 4]);
  await expect.poll(() => document.body.textContent, SLOW).not.toMatch(/Rysowanie stron/);
});

test('when the 3D code cannot be downloaded, the message points at the connection, not the browser', async () => {
  const error = vi.spyOn(console, 'error').mockImplementation(() => {});
  const zine = createZine('Lato', 1);
  const loadScene: LoadScene = () => Promise.reject(new TypeError('Failed to fetch dynamically imported module'));
  const { screen } = await openScreen(zine, <Preview3dScreen zineId={zine.id} loadScene={loadScene} />);
  await expect
    .element(screen.getByText('Nie udało się wczytać podglądu 3D. Sprawdź połączenie z internetem i odśwież stronę.'))
    .toBeVisible();
  expect(document.body.textContent).not.toMatch(/Rysowanie stron/);
  error.mockRestore();
});

test('when the browser cannot draw WebGL, it says so', async () => {
  const error = vi.spyOn(console, 'error').mockImplementation(() => {});
  const zine = createZine('Lato', 1);
  const loadScene: LoadScene = async () =>
    ({
      ZineScene: class {
        constructor() {
          throw new Error('Error creating WebGL context.');
        }
      },
    }) as unknown as Awaited<ReturnType<LoadScene>>;
  const { screen } = await openScreen(zine, <Preview3dScreen zineId={zine.id} loadScene={loadScene} />);
  await expect.element(screen.getByText(/Ta przeglądarka nie umie pokazać podglądu 3D/)).toBeVisible();
  error.mockRestore();
});
