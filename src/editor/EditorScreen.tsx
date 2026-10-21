import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { useDb } from '../app/dbContext';
import { errorMessage, notify } from '../app/notices';
import { onPageHide } from '../app/onPageHide';
import { routeHash } from '../app/route';
import { chooseVersion } from '../cloud/cloudActions';
import { EditorCloudBar } from '../cloud/EditorCloudBar';
import { useCloud, type CloudServices } from '../cloud/CloudContext';
import { syncZine } from '../cloud/cloudSync';
import { getLink } from '../cloud/links';
import { useEditorCloudSync } from '../cloud/useEditorCloudSync';
import { parseZine } from '../model/parse';
import type { FontChoice } from '../fonts/fontChoices';
import { releaseRenderAssets, type RenderAssets } from '../render/assets';
import { measureTextHeight } from '../render/buildSpread';
import { loadZine, saveZine, type ZiniarzDb } from '../storage/db';
import { holdOpenZineLock } from '../storage/zineLock';
import { SpreadCanvas } from './canvas/SpreadCanvas';
import { EditorContext, type EditorEnv } from './EditorContext';
import { HideButton } from './HideButton';
import { NotesPanel } from './NotesPanel';
import { ColumnResizer } from './ColumnResizer';
import { useColumnWidths } from './columnWidth';
import { loadColumnShown, saveColumnShown, type EditorColumn } from './columnVisibility';
import { PropertiesPanel } from './panels/PropertiesPanel';
import { PhotoInsertContext, usePhotoInsertState } from './photoInsert';
import { openEditorSession } from './session';
import { createAutosaver, whenSavesSettled, type Autosaver } from './state/autosave';
import { SpreadList } from './SpreadList';
import { createEditorStore, type EditorStore } from './state/store';
import { TopBar } from './TopBar';
import { useEditorKeyboard } from './useEditorKeyboard';

interface Loaded {
  store: EditorStore;
  assets: RenderAssets;
}

function EditorWorkspace({ env, reopen }: { env: EditorEnv; reopen(): void }) {
  useEditorKeyboard(env.store);
  const saver = useRef<Autosaver | null>(null);
  const flushSaves = useCallback(async () => {
    await saver.current?.flush();
    await whenSavesSettled();
  }, []);
  const photoInsert = usePhotoInsertState(env);
  const [notesShown, setNotesShown] = useState(() => loadColumnShown('notes'));
  const [settingsShown, setSettingsShown] = useState(() => loadColumnShown('settings'));
  const widths = useColumnWidths({ spreads: true, settings: settingsShown, notes: notesShown });
  const showColumn = (column: EditorColumn, shown: boolean) => {
    saveColumnShown(column, shown);
    (column === 'notes' ? setNotesShown : setSettingsShown)(shown);
  };

  // Autosave 500 ms after each change; leaving the editor or hiding the tab saves at once.
  useEffect(() => {
    const autosaver = createAutosaver((zine) => saveZine(env.db, zine), { onError: (error) => notify(errorMessage(error)) });
    saver.current = autosaver;
    const unsubscribe = env.store.subscribe((state, previous) => {
      if (state.history.present !== previous.history.present) autosaver.schedule(state.history.present);
    });
    const saveNow = () => void autosaver.flush();
    const stopListening = onPageHide(saveNow);
    return () => {
      unsubscribe();
      stopListening();
      saveNow();
    };
  }, [env.db, env.store]);

  // After the autosave above, so leaving the editor sends its last save to Google Drive.
  const editorCloud = useEditorCloudSync({ db: env.db, zineId: env.zineId, store: env.store, flushSaves, reopen });

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
        <div
          className={['editor', settingsShown && 'with-settings', notesShown && 'with-notes'].filter(Boolean).join(' ')}
          style={
            {
              '--spreads-width': `${widths.spreads.width}px`,
              '--settings-width': `${widths.settings.width}px`,
              '--notes-width': `${widths.notes.width}px`,
            } as CSSProperties
          }
        >
          <TopBar
            notesShown={notesShown}
            onToggleNotes={() => showColumn('notes', !notesShown)}
            settingsShown={settingsShown}
            onToggleSettings={() => showColumn('settings', !settingsShown)}
            cloud={editorCloud && <EditorCloudBar zineId={env.zineId} editorCloud={editorCloud} />}
          />
          <aside className="editor-spreads">
            <div className="column-scroll">
              <SpreadList width={widths.spreads.width} />
            </div>
            <ColumnResizer
              side="right"
              label="Szerokość listy stron"
              value={widths.spreads.width}
              min={widths.spreads.min}
              max={widths.spreads.max}
              onChange={widths.spreads.set}
              onReset={widths.spreads.reset}
            />
          </aside>
          <section className="editor-canvas">
            <SpreadCanvas />
          </section>
          {settingsShown && (
            <aside className="editor-panel" aria-label="Ustawienia">
              <div className="column-scroll">
                <div className="column-header">
                  <span className="column-title">Ustawienia</span>
                  <HideButton label="Schowaj ustawienia" onClick={() => showColumn('settings', false)} />
                </div>
                <PropertiesPanel />
              </div>
              <ColumnResizer
                side="left"
                label="Szerokość ustawień"
                value={widths.settings.width}
                min={widths.settings.min}
                max={widths.settings.max}
                onChange={widths.settings.set}
                onReset={widths.settings.reset}
              />
            </aside>
          )}
          {notesShown && (
            <NotesPanel
              onHide={() => showColumn('notes', false)}
              resizer={
                <ColumnResizer
                  side="left"
                  label="Szerokość notatnika"
                  value={widths.notes.width}
                  min={widths.notes.min}
                  max={widths.notes.max}
                  onChange={widths.notes.set}
                  onReset={widths.notes.reset}
                />
              }
            />
          )}
        </div>
      </PhotoInsertContext.Provider>
    </EditorContext.Provider>
  );
}

/**
 * A zine saved on Google Drive takes the newer version from Drive before opening, or asks when both sides
 * changed. Without a token or internet it opens as it is in the browser; the top bar says so.
 */
async function syncBeforeOpening(db: ZiniarzDb, cloud: CloudServices | null, zineId: string): Promise<void> {
  if (!cloud || !cloud.auth.token() || !(await getLink(db, zineId))) return;
  await whenSavesSettled();
  const result = await syncZine(db, cloud.drive, zineId, { allowDownload: true });
  if (result.kind === 'conflict') {
    const raw = await loadZine(db, zineId);
    await chooseVersion(db, cloud, zineId, raw ? parseZine(raw).title : '', result.change);
  }
}

export function EditorScreen({ zineId }: { zineId: string }) {
  const db = useDb();
  const cloud = useCloud();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [fonts, setFonts] = useState<FontChoice[]>([]);
  const [error, setError] = useState<string | null>(null);
  // Bumped to open the zine again after its content came from Google Drive.
  const [opening, setOpening] = useState(0);
  const reopen = useCallback(() => {
    setLoaded(null);
    setOpening((n) => n + 1);
  }, []);

  // Other tabs must not prune this zine's photos and fonts while it is open.
  useEffect(() => holdOpenZineLock(db.name), [db]);

  useEffect(() => {
    let cancelled = false;
    let assets: RenderAssets | null = null;
    syncBeforeOpening(db, cloud, zineId)
      .catch(() => {}) // the zine opens as it is in the browser
      .then(() => (cancelled ? Promise.reject(new Error('cancelled')) : openEditorSession(db, zineId)))
      .then(
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
  }, [db, cloud, zineId, opening]);

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
  return <EditorWorkspace env={{ zineId, db, store: loaded.store, assets: loaded.assets, fonts, setFonts }} reopen={reopen} />;
}
