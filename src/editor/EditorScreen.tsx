import { useEffect, useState } from 'react';
import { useDb } from '../app/dbContext';
import { errorMessage, notify } from '../app/notices';
import { onPageHide } from '../app/onPageHide';
import { routeHash } from '../app/route';
import type { FontChoice } from '../fonts/fontChoices';
import { releaseRenderAssets, type RenderAssets } from '../render/assets';
import { measureTextHeight } from '../render/buildSpread';
import { saveZine } from '../storage/db';
import { holdOpenZineLock } from '../storage/zineLock';
import { SpreadCanvas } from './canvas/SpreadCanvas';
import { EditorContext, type EditorEnv } from './EditorContext';
import { HideButton } from './HideButton';
import { NotesPanel } from './NotesPanel';
import { loadColumnShown, saveColumnShown, type EditorColumn } from './columnVisibility';
import { PropertiesPanel } from './panels/PropertiesPanel';
import { PhotoInsertContext, usePhotoInsertState } from './photoInsert';
import { openEditorSession } from './session';
import { createAutosaver } from './state/autosave';
import { SpreadList } from './SpreadList';
import { createEditorStore, type EditorStore } from './state/store';
import { TopBar } from './TopBar';
import { useEditorKeyboard } from './useEditorKeyboard';

interface Loaded {
  store: EditorStore;
  assets: RenderAssets;
}

function EditorWorkspace({ env }: { env: EditorEnv }) {
  useEditorKeyboard(env.store);
  const photoInsert = usePhotoInsertState(env);
  const [notesShown, setNotesShown] = useState(() => loadColumnShown('notes'));
  const [settingsShown, setSettingsShown] = useState(() => loadColumnShown('settings'));
  const showColumn = (column: EditorColumn, shown: boolean) => {
    saveColumnShown(column, shown);
    (column === 'notes' ? setNotesShown : setSettingsShown)(shown);
  };

  // Autosave 500 ms after each change; leaving the editor or hiding the tab saves at once.
  useEffect(() => {
    const saver = createAutosaver((zine) => saveZine(env.db, zine), { onError: (error) => notify(errorMessage(error)) });
    const unsubscribe = env.store.subscribe((state, previous) => {
      if (state.history.present !== previous.history.present) saver.schedule(state.history.present);
    });
    const saveNow = () => void saver.flush();
    const stopListening = onPageHide(saveNow);
    return () => {
      unsubscribe();
      stopListening();
      saveNow();
    };
  }, [env.db, env.store]);

  // A file dropped beside the canvas would make the browser open it and leave the editor.
  useEffect(() => {
    const blockFileDrop = (event: DragEvent) => {
      const onFileInput = event.target instanceof HTMLInputElement && event.target.type === 'file';
      if (!onFileInput && event.dataTransfer?.types.includes('Files')) event.preventDefault();
    };
    window.addEventListener('dragover', blockFileDrop);
    window.addEventListener('drop', blockFileDrop);
    return () => {
      window.removeEventListener('dragover', blockFileDrop);
      window.removeEventListener('drop', blockFileDrop);
    };
  }, []);

  return (
    <EditorContext.Provider value={env}>
      <PhotoInsertContext.Provider value={photoInsert}>
        <div className={['editor', settingsShown && 'with-settings', notesShown && 'with-notes'].filter(Boolean).join(' ')}>
          <TopBar
            notesShown={notesShown}
            onToggleNotes={() => showColumn('notes', !notesShown)}
            settingsShown={settingsShown}
            onToggleSettings={() => showColumn('settings', !settingsShown)}
          />
          <aside className="editor-spreads">
            <SpreadList />
          </aside>
          <section className="editor-canvas">
            <SpreadCanvas />
          </section>
          {settingsShown && (
            <aside className="editor-panel" aria-label="Ustawienia">
              <div className="column-header">
                <span className="column-title">Ustawienia</span>
                <HideButton label="Schowaj ustawienia" onClick={() => showColumn('settings', false)} />
              </div>
              <PropertiesPanel />
            </aside>
          )}
          {notesShown && <NotesPanel onHide={() => showColumn('notes', false)} />}
        </div>
      </PhotoInsertContext.Provider>
    </EditorContext.Provider>
  );
}

export function EditorScreen({ zineId }: { zineId: string }) {
  const db = useDb();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [fonts, setFonts] = useState<FontChoice[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Other tabs must not prune this zine's photos and fonts while it is open.
  useEffect(() => holdOpenZineLock(db.name), [db]);

  useEffect(() => {
    let cancelled = false;
    let assets: RenderAssets | null = null;
    openEditorSession(db, zineId).then(
      (session) => {
        assets = session.assets;
        if (cancelled) {
          releaseRenderAssets(session.assets);
          return;
        }
        const store = createEditorStore(session.zine, {
          measureText: measureTextHeight,
          imageSize: (id) => {
            const bitmap = session.assets.images.get(id);
            return bitmap && { width: bitmap.width, height: bitmap.height };
          },
        });
        setFonts(session.fonts);
        setLoaded({ store, assets: session.assets });
      },
      (reason: unknown) => !cancelled && setError(errorMessage(reason)),
    );
    return () => {
      cancelled = true;
      if (assets) releaseRenderAssets(assets);
    };
  }, [db, zineId]);

  if (error) {
    return (
      <main className="screen-message">
        <p>{error}</p>
        <a className="link-button" href={routeHash({ name: 'home' })}>
          Wróć do listy zinów
        </a>
      </main>
    );
  }
  if (!loaded) return <main className="screen-message">Otwieranie zina…</main>;
  return <EditorWorkspace env={{ zineId, db, store: loaded.store, assets: loaded.assets, fonts, setFonts }} />;
}
