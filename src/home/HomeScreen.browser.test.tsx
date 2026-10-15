import { userEvent } from '@vitest/browser/context';
import { render } from 'vitest-browser-react';
import { afterEach, expect, test, vi } from 'vitest';
import { ConfirmHost } from '../app/ConfirmHost';
import { DbContext } from '../app/dbContext';
import { createPhotoElement, createZine } from '../model/factory';
import { newId } from '../model/ids';
import { listImageIds, listZines, openZiniarzDb, putImage, saveZine, type ZiniarzDb } from '../storage/db';
import { forgetPersistentStorageAnswer } from '../storage/quota';
import { holdOpenZineLock } from '../storage/zineLock';
import { chooseFiles } from '../test/files';
import { exportZinFile } from './homeActions';
import { HomeScreen } from './HomeScreen';

async function setup(prepare?: (db: ZiniarzDb) => Promise<void>) {
  const db = await openZiniarzDb(`test-${newId()}`);
  await prepare?.(db);
  const screen = render(
    <DbContext.Provider value={db}>
      <HomeScreen />
      <ConfirmHost />
    </DbContext.Provider>,
  );
  return { db, screen };
}

afterEach(() => {
  window.location.hash = '';
});

test('creating a zine saves it and opens the editor', async () => {
  const { db, screen } = await setup();
  await expect.element(screen.getByText('Nie masz jeszcze żadnego zina.')).toBeVisible();
  await screen.getByLabelText('Tytuł').fill('Lato');
  await screen.getByLabelText('Kartki').fill('6');
  await expect.element(screen.getByText('= 24 strony')).toBeVisible();
  await screen.getByRole('button', { name: 'Nowy zin' }).click();
  await expect.poll(async () => (await listZines(db)).map((z) => [z.title, z.sheets])).toEqual([['Lato', 6]]);
  const [zine] = await listZines(db);
  await expect.poll(() => window.location.hash).toBe(`#/zin/${zine.id}`);
});

test('the sheet count can be cleared and retyped; too many sheets are capped', async () => {
  const { db, screen } = await setup();
  const field = screen.getByLabelText('Kartki');
  await field.clear();
  await expect.element(field).toHaveValue(null);
  await userEvent.keyboard('8');
  await expect.element(field).toHaveValue(8);
  await expect.element(screen.getByText('= 32 strony')).toBeVisible();
  await field.fill('25');
  await expect.element(screen.getByText('= 80 stron')).toBeVisible();
  await userEvent.keyboard('{Enter}');
  await expect.poll(async () => (await listZines(db)).map((z) => z.sheets)).toEqual([20]);
});

test('leaving the sheet field shows the count that will be used', async () => {
  const { screen } = await setup();
  const field = screen.getByLabelText('Kartki');
  await field.fill('25');
  await screen.getByLabelText('Tytuł').click();
  await expect.element(field).toHaveValue(20);
  await field.clear();
  await screen.getByLabelText('Tytuł').click();
  await expect.element(field).toHaveValue(1);
});

test('if the list cannot be read, a message replaces the loading text', async () => {
  const { screen } = await setup(async (db) => db.close());
  await expect.element(screen.getByText('Nie udało się wczytać listy zinów. Odśwież stronę.')).toBeVisible();
  await expect.element(screen.getByText('Wczytywanie…')).not.toBeInTheDocument();
});

test('a zine can be duplicated and deleted after confirming', async () => {
  const { db, screen } = await setup((db) => saveZine(db, createZine('Lato', 5)));
  await expect.element(screen.getByRole('heading', { name: 'Lato', exact: true })).toBeVisible();
  await expect.element(screen.getByText('5 kartek · 20 stron')).toBeVisible();
  await screen.getByRole('button', { name: 'Powiel' }).click();
  await expect.element(screen.getByRole('heading', { name: 'Lato (kopia)' })).toBeVisible();

  await screen.getByRole('button', { name: 'Usuń' }).first().click();
  await screen.getByRole('dialog').getByRole('button', { name: 'Usuń' }).click();
  await expect.poll(async () => (await listZines(db)).length).toBe(1);
});

test('opening the list removes photos no zine uses', async () => {
  const { db, screen } = await setup(async (db) => {
    const zine = createZine('Ze zdjęciem', 1);
    zine.spreads[1].elements.push(createPhotoElement('used'));
    await saveZine(db, zine);
    const data = new ArrayBuffer(1);
    await putImage(db, { id: 'used', mime: 'image/jpeg', width: 1, height: 1, data });
    await putImage(db, { id: 'orphan', mime: 'image/jpeg', width: 1, height: 1, data });
  });
  await expect.element(screen.getByRole('heading', { name: 'Ze zdjęciem' })).toBeVisible();
  await expect.poll(() => listImageIds(db)).toEqual(['used']);
});

test('while a zine is open in another tab, the list deletes nothing', async () => {
  let release = () => {};
  try {
    const { db, screen } = await setup(async (db) => {
      release = holdOpenZineLock(db.name);
      await saveZine(db, createZine('Inny', 1));
      await putImage(db, { id: 'needed-elsewhere', mime: 'image/jpeg', width: 1, height: 1, data: new ArrayBuffer(1) });
    });
    await expect.element(screen.getByRole('heading', { name: 'Inny' })).toBeVisible();
    expect(await listImageIds(db)).toEqual(['needed-elsewhere']);
  } finally {
    release();
  }
});

const PERSIST_HINT = 'Przeglądarka może kiedyś usunąć ziny. Zapisuj co jakiś czas pliki .zin.';

test.each([
  [false, true],
  [true, false],
])('when the browser grants persistent storage: %s, the hint about saving .zin files shows: %s', async (granted, shown) => {
  forgetPersistentStorageAnswer();
  const persisted = vi.spyOn(navigator.storage, 'persisted').mockResolvedValue(false);
  const persist = vi.spyOn(navigator.storage, 'persist').mockResolvedValue(granted);
  try {
    const { screen } = await setup((db) => saveZine(db, createZine('Lato', 1)));
    await expect.element(screen.getByRole('heading', { name: 'Lato' })).toBeVisible();
    if (shown) await expect.element(screen.getByText(PERSIST_HINT)).toBeVisible();
    else await expect.poll(() => persist.mock.calls.length).toBe(1);
    if (!shown) await expect.element(screen.getByText(PERSIST_HINT)).not.toBeInTheDocument();
  } finally {
    persisted.mockRestore();
    persist.mockRestore();
    forgetPersistentStorageAnswer();
  }
});

test('the used space is read again after loading a .zin (the browser updates it a little later)', async () => {
  let grown = false;
  const estimate = vi
    .spyOn(navigator.storage, 'estimate')
    .mockImplementation(async () => ({ usage: grown ? 3_000_000 : 1_000_000, quota: 1_000_000_000 }));
  try {
    const source = await openZiniarzDb(`test-${newId()}`);
    const zine = createZine('Z pliku', 1);
    await saveZine(source, zine);
    const file = await exportZinFile(source, zine);
    const { screen } = await setup();
    await expect.element(screen.getByText('Zajęte miejsce: 1 MB z 1 GB')).toBeVisible();
    chooseFiles(screen.getByLabelText('Wczytaj plik .zin').element(), [new File([file.blob], 'z-pliku.zin')]);
    await expect.element(screen.getByRole('heading', { name: 'Z pliku' })).toBeVisible();
    grown = true;
    await expect.element(screen.getByText('Zajęte miejsce: 3 MB z 1 GB'), { timeout: 4000 }).toBeVisible();
  } finally {
    estimate.mockRestore();
  }
});
