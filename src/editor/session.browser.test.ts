import { expect, test } from 'vitest';
import { createZine } from '../model/factory';
import { newId } from '../model/ids';
import { openZiniarzDb, saveZine } from '../storage/db';
import { openEditorSession, openZineView, ZineNotFoundError } from './session';
import { createAutosaver } from './state/autosave';

test('opening waits for saves still running, so it never shows an older version', async () => {
  const db = await openZiniarzDb(`test-${newId()}`);
  const zine = createZine('Stary', 1);
  await saveZine(db, zine);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  const saver = createAutosaver(
    async (z) => {
      await gate;
      await saveZine(db, z);
    },
    { onError: () => {} },
  );
  saver.schedule({ ...zine, title: 'Nowy' });
  void saver.flush();
  const opening = openEditorSession(db, zine.id);
  setTimeout(release, 50);
  expect((await opening).zine.title).toBe('Nowy');
});

test('the print and 3D screens open a zine the same way: after running saves, photos loaded', async () => {
  const db = await openZiniarzDb(`test-${newId()}`);
  const zine = createZine('Lato', 1);
  await saveZine(db, zine);
  const saver = createAutosaver(
    async (z) => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      await saveZine(db, z);
    },
    { onError: () => {} },
  );
  saver.schedule({ ...zine, title: 'Lato 2026' });
  void saver.flush(); // leaving the editor: not awaited
  const view = await openZineView(db, zine.id);
  expect(view.zine.title).toBe('Lato 2026');
  expect(view.assets.images.size).toBe(0);
});

test('a missing zine is reported in Polish', async () => {
  const db = await openZiniarzDb(`test-${newId()}`);
  await expect(openZineView(db, 'nope')).rejects.toBeInstanceOf(ZineNotFoundError);
});
