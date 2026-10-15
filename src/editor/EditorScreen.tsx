import { useEffect, useState } from 'react';
import { useDb } from '../app/dbContext';
import { errorMessage, notify } from '../app/notices';
import { routeHash } from '../app/route';
import type { FontChoice } from '../fonts/fontChoices';
import { releaseRenderAssets, type RenderAssets } from '../render/assets';
import { measureTextHeight } from '../render/buildSpread';
import { saveZine } from '../storage/db';
import { holdOpenZineLock } from '../storage/zineLock';
import { SpreadCanvas } from './canvas/SpreadCanvas';
import { EditorContext, type EditorEnv } from './EditorContext';
import { PropertiesPanel } from './panels/PropertiesPanel';
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

  // Autosave 500 ms after each change; leaving the editor or hiding the tab saves at once.
  useEffect(() => {
    const saver = createAutosaver((zine) => saveZine(env.db, zine), { onError: (error) => notify(errorMessage(error)) });
    const unsubscribe = env.store.subscribe((state, previous) => {
      if (state.history.present !== previous.history.present) saver.schedule(state.history.present);
    });
    const saveNow = () => void saver.flush();
    const saveWhenHidden = () => document.visibilityState === 'hidden' && saveNow();
    window.addEventListener('pagehide', saveNow);
    document.addEventListener('visibilitychange', saveWhenHidden);
    return () => {
      unsubscribe();
      window.removeEventListener('pagehide', saveNow);
      document.removeEventListener('visibilitychange', saveWhenHidden);
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
      <div className="editor">
        <TopBar />
        <aside className="editor-spreads">
          <SpreadList />
        </aside>
        <section className="editor-canvas">
          <SpreadCanvas />
        </section>
        <aside className="editor-panel">
          <PropertiesPanel />
        </aside>
      </div>
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
