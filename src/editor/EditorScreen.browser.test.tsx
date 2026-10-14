import { render } from 'vitest-browser-react';
import { expect, test } from 'vitest';
import { DbContext } from '../app/dbContext';
import { createZine } from '../model/factory';
import { newId } from '../model/ids';
import type { Zine } from '../model/types';
import { openZiniarzDb } from '../storage/db';
import { openInEditor } from '../test/editorHarness';
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
