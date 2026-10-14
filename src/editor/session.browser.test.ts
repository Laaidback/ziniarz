import { expect, test } from 'vitest';
import { createZine } from '../model/factory';
import { newId } from '../model/ids';
import { openZiniarzDb, saveZine } from '../storage/db';
import { openEditorSession } from './session';
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
