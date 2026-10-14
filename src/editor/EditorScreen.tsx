import { useEffect, useState } from 'react';
import { useDb } from '../app/dbContext';
import { errorMessage, notify } from '../app/notices';
import { routeHash } from '../app/route';
import type { FontChoice } from '../fonts/fontChoices';
import { releaseRenderAssets, type RenderAssets } from '../render/assets';
import { measureTextHeight } from '../render/buildSpread';
import { saveZine } from '../storage/db';
import { SpreadCanvas } from './canvas/SpreadCanvas';
import { EditorContext, type EditorEnv } from './EditorContext';
import { openEditorSession } from './session';
import { createAutosaver } from './state/autosave';
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

  return (
    <EditorContext.Provider value={env}>
      <div className="editor">
        <TopBar />
        <aside className="editor-spreads" />
        <section className="editor-canvas">
          <SpreadCanvas />
        </section>
        <aside className="editor-panel" />
      </div>
    </EditorContext.Provider>
  );
}

export function EditorScreen({ zineId }: { zineId: string }) {
  const db = useDb();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [fonts, setFonts] = useState<FontChoice[]>([]);
  const [error, setError] = useState<string | null>(null);

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
