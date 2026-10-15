import type { ReactNode } from 'react';
import { render } from 'vitest-browser-react';
import { DbContext } from '../app/dbContext';
import { NoticeList } from '../app/NoticeList';
import { newId } from '../model/ids';
import type { Zine } from '../model/types';
import { loadZine, openZiniarzDb, saveZine, type ZiniarzDb } from '../storage/db';

/** Saves `zine` in a fresh test database and renders `element` (a screen) with it, plus notices. */
export async function openScreen(zine: Zine, element: ReactNode, prepare?: (db: ZiniarzDb) => Promise<void>) {
  const db = await openZiniarzDb(`test-${newId()}`);
  await saveZine(db, zine);
  await prepare?.(db);
  const screen = render(
    <DbContext.Provider value={db}>
      {element}
      <NoticeList />
    </DbContext.Provider>,
  );
  /** The zine as it is now in the database. */
  const stored = async () => (await loadZine(db, zine.id))!;
  return { db, screen, stored };
}
