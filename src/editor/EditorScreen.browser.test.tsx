import { render } from 'vitest-browser-react';
import { expect, test } from 'vitest';
import { DbContext } from '../app/dbContext';
import { createZine } from '../model/factory';
import { newId } from '../model/ids';
import type { Zine } from '../model/types';
import { listImageIds, openZiniarzDb } from '../storage/db';
import { openInEditor } from '../test/editorHarness';
import { chooseFiles } from '../test/files';
import { openZineLockHeld } from '../test/locks';
import { EditorScreen } from './EditorScreen';

test('opens a zine with its title, links to print and 3D, and nothing to undo yet', async () => {
  const zine = createZine('Lato', 5);
  const { screen } = await openInEditor(zine);
  await expect.element(screen.getByRole('heading', { name: 'Lato' })).toBeVisible();
  await expect.element(screen.getByRole('button', { name: 'Cofnij' })).toBeDisabled();
  await expect.element(screen.getByRole('link', { name: 'Druk' })).toHaveAttribute('href', `#/zin/${zine.id}/druk`);
  await expect.element(screen.getByRole('link', { name: 'Podgląd 3D' })).toHaveAttribute('href', `#/zin/${zine.id}/3d`);
  await expect.element(screen.getByRole('checkbox', { name: 'Pokaż prowadnice' })).toBeChecked();
});

test('an old stored zine without margins opens through parseZine', async () => {
  const { margins: _margins, ...old } = createZine('Stary', 1);
  const { screen } = await openInEditor(old as unknown as Zine);
  await expect.element(screen.getByRole('heading', { name: 'Stary' })).toBeVisible();
});

test('a missing zine shows a message and a way back', async () => {
  const db = await openZiniarzDb(`test-${newId()}`);
  const screen = render(
    <DbContext.Provider value={db}>
      <EditorScreen zineId="nope" />
    </DbContext.Provider>,
  );
  await expect.element(screen.getByText('Nie znaleziono tego zina. Może został usunięty.')).toBeVisible();
  await expect.element(screen.getByRole('link', { name: 'Wróć do listy zinów' })).toHaveAttribute('href', '#/');
});

test('"+ Napis" adds a text on the cover and autosave stores it', async () => {
  const zine = createZine('Lato', 1);
  const { screen, stored } = await openInEditor(zine);
  await screen.getByRole('button', { name: '+ Napis' }).click();
  await expect
    .poll(async () => (await stored()).spreads[0].elements.map((e) => e.kind === 'text' && [e.text, e.x, e.width]))
    .toEqual([['Napis', 178, 88]]);
  await expect.element(screen.getByRole('button', { name: 'Cofnij' })).toBeEnabled();
});

test('files dropped outside the canvas do not make the browser leave the editor', async () => {
  const { screen } = await openInEditor(createZine('Lato', 1));
  await expect.element(screen.getByRole('heading', { name: 'Lato' })).toBeVisible();
  const fire = (type: 'dragover' | 'drop', target: Element) => {
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(new File(['x'], 'zdjecie.png', { type: 'image/png' }));
    const event = new DragEvent(type, { dataTransfer, bubbles: true, cancelable: true });
    target.dispatchEvent(event);
    return event.defaultPrevented;
  };
  const heading = screen.getByRole('heading', { name: 'Lato' }).element();
  expect(fire('dragover', heading)).toBe(true);
  expect(fire('drop', heading)).toBe(true);
  screen.unmount();
  expect(fire('drop', document.body)).toBe(false);
});

test('while the editor is open it holds the open-zine lock, so no tab prunes its photos', async () => {
  const { db, screen } = await openInEditor(createZine('Lato', 1));
  await expect.poll(() => openZineLockHeld(db.name)).toBe(true);
  screen.unmount();
  await expect.poll(() => openZineLockHeld(db.name)).toBe(false);
});

async function bigPng(name: string): Promise<File> {
  const canvas = new OffscreenCanvas(2400, 1600);
  const ctx = canvas.getContext('2d')!;
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = `hsl(${i * 9}, 70%, 50%)`;
    ctx.fillRect(i * 60, 0, 60, 1600);
  }
  return new File([await canvas.convertToBlob({ type: 'image/png' })], name, { type: 'image/png' });
}

test('adding several photos shows how far it got, then places all of them', async () => {
  const zine = createZine('Lato', 1);
  const { screen, stored } = await openInEditor(zine);
  await expect.element(screen.getByRole('heading', { name: 'Lato' })).toBeVisible();
  const files = await Promise.all([bigPng('a.png'), bigPng('b.png'), bigPng('c.png')]);
  chooseFiles(screen.getByLabelText('Wybierz zdjęcia').element(), files);
  await expect.element(screen.getByRole('status')).toHaveTextContent(/^Dodawanie zdjęć [1-3] z 3…$/);
  await expect.poll(async () => (await stored()).spreads[0].elements.length, { timeout: 5000 }).toBe(3);
  await expect.element(screen.getByRole('status')).not.toBeInTheDocument();
});

test('leaving the editor stops adding photos', async () => {
  const zine = createZine('Lato', 1);
  const { screen, db } = await openInEditor(zine);
  await expect.element(screen.getByRole('heading', { name: 'Lato' })).toBeVisible();
  const files = await Promise.all([bigPng('a.png'), bigPng('b.png'), bigPng('c.png'), bigPng('d.png')]);
  chooseFiles(screen.getByLabelText('Wybierz zdjęcia').element(), files);
  await expect.element(screen.getByRole('status')).toHaveTextContent('Dodawanie zdjęć 1 z 4…');
  screen.unmount();
  // Long enough for all four to be stored if adding went on.
  await new Promise((resolve) => setTimeout(resolve, 3000));
  expect((await listImageIds(db)).length).toBeLessThanOrEqual(1);
});
