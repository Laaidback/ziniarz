import type { ReactNode } from 'react';
import { render } from 'vitest-browser-react';
import { ConfirmHost } from '../app/ConfirmHost';
import { CloudContext, type CloudServices } from '../cloud/CloudContext';
import { ConflictHost } from '../cloud/ConflictHost';
import { DbContext } from '../app/dbContext';
import { NoticeList } from '../app/NoticeList';
import { EditorScreen } from '../editor/EditorScreen';
import { newId } from '../model/ids';
import type { Zine } from '../model/types';
import { loadZine, openZiniarzDb, saveZine, type ZiniarzDb } from '../storage/db';

/**
 * Saves `zine` in a fresh test database and opens it in the full editor (with notices and dialogs);
 * `cloud` gives it Google Drive (src/test/fakeCloud.ts).
 */
export async function openInEditor(
  zine: Zine,
  prepare?: (db: ZiniarzDb) => Promise<void>,
  extra?: ReactNode,
  cloud: CloudServices | null = null,
) {
  const db = await openZiniarzDb(`test-${newId()}`);
  await saveZine(db, zine);
  await prepare?.(db);
  const screen = render(
    <DbContext.Provider value={db}>
      <CloudContext.Provider value={cloud}>
        <EditorScreen zineId={zine.id} />
        <NoticeList />
        <ConfirmHost />
        <ConflictHost />
        {extra}
      </CloudContext.Provider>
    </DbContext.Provider>,
  );
  /** The zine as autosave left it in the database. */
  const stored = async () => (await loadZine(db, zine.id))!;
  return { db, screen, stored };
}
