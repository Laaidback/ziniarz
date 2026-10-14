import type { ReactNode } from 'react';
import { render } from 'vitest-browser-react';
import { ConfirmHost } from '../app/ConfirmHost';
import { DbContext } from '../app/dbContext';
import { NoticeList } from '../app/NoticeList';
import { EditorScreen } from '../editor/EditorScreen';
import { newId } from '../model/ids';
import type { Zine } from '../model/types';
import { loadZine, openZiniarzDb, saveZine, type ZiniarzDb } from '../storage/db';

/** Saves `zine` in a fresh test database and opens it in the full editor (with notices and dialogs). */
export async function openInEditor(zine: Zine, prepare?: (db: ZiniarzDb) => Promise<void>, extra?: ReactNode) {
  const db = await openZiniarzDb(`test-${newId()}`);
  await saveZine(db, zine);
  await prepare?.(db);
  const screen = render(
    <DbContext.Provider value={db}>
      <EditorScreen zineId={zine.id} />
      <NoticeList />
      <ConfirmHost />
      {extra}
    </DbContext.Provider>,
  );
  /** The zine as autosave left it in the database. */
  const stored = async () => (await loadZine(db, zine.id))!;
  return { db, screen, stored };
}
