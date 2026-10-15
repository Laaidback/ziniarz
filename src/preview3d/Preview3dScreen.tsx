import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LoadFailed } from '../app/LoadFailed';
import { routeHash } from '../app/route';
import { useZineView } from '../app/useZineView';
import { printLayout } from '../imposition/layout';
import { pageCount } from '../model/geometry';
import type { Zine } from '../model/types';
import { loadPrinterMargin, printSettingsFor } from '../print/printerMargin';
import type { RenderAssets } from '../render/assets';
import { renderPage } from '../render/renderPage';
import { createRenderQueue } from '../render/renderQueue';
import { closedBook, spreadCaption, turnPage, type BookState } from './book';
import type { ZineScene } from './scene';
import { clickTurnsForward, isClick, texturePxPerMm, turnForKey, type Point } from './view';

export function Preview3dScreen({ zineId }: { zineId: string }) {
  const view = useZineView(zineId);
  if (view.status === 'loading') return <main className="screen-message">Otwieranie zina…</main>;
  if (view.status === 'failed') return <LoadFailed message={view.message} />;
  return <PreviewWorkspace zine={view.zine} assets={view.assets} />;
}

function PreviewWorkspace({ zine, assets }: { zine: Zine; assets: RenderAssets }) {
  const container = useRef<HTMLDivElement>(null);
  const scene = useRef<ZineScene | null>(null);
  const book = useRef<BookState>(closedBook(zine.sheets));
  const pointerDown = useRef<Point | null>(null);
  const [spread, setSpread] = useState(0);
  const [drawn, setDrawn] = useState(0);
  const [failed, setFailed] = useState(false);
  const pages = pageCount(zine.sheets);
  // Page size as trimmed with the current print settings (printer margin remembered in this browser).
  const trimPage = useMemo(() => printLayout(printSettingsFor(zine.print, loadPrinterMargin())).trimPage, [zine]);

  useEffect(() => {
    let disposed = false;
    const queue = createRenderQueue();
    setDrawn(0);
    // three.js is loaded only when the preview opens, so the rest of the app stays small.
    import('./scene')
      .then(({ ZineScene }) => {
        if (disposed) return;
        const view = new ZineScene(container.current!, {
          pageWidth: trimPage.width,
          pageHeight: trimPage.height,
          book: book.current,
        });
        scene.current = view;
        for (let page = 1; page <= pages; page++) {
          queue.add(() => {
            if (disposed) return;
            view.setPageImage(page, renderPage(zine, page, assets, { pxPerMm: texturePxPerMm(), bleed: false }));
            setDrawn((count) => count + 1);
          });
        }
      })
      .catch(() => !disposed && setFailed(true));
    return () => {
      disposed = true;
      queue.clear();
      scene.current?.dispose();
      scene.current = null;
    };
  }, [zine, assets, pages, trimPage]);

  const turn = useCallback((forward: boolean) => {
    const next = turnPage(book.current, forward, performance.now());
    if (next === book.current) return;
    book.current = next;
    scene.current?.setBook(next);
    setSpread(next.turned);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const forward = turnForKey(event.key);
      if (forward === null) return;
      event.preventDefault();
      turn(forward);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [turn]);

  const leaves = 2 * zine.sheets;
  return (
    <div className="preview3d">
      <header className="screen-top">
        <a className="link-button" href={routeHash({ name: 'editor', zineId: zine.id })}>
          ← Wróć do edytora
        </a>
        <h1 className="editor-title">Podgląd 3D: {zine.title}</h1>
        <div className="toolbar">
          <button type="button" onClick={() => turn(false)} disabled={spread === 0}>
            ← Wstecz
          </button>
          <span className="preview-caption" aria-live="polite">
            {spreadCaption(spread, zine.sheets)}
          </span>
          <button type="button" onClick={() => turn(true)} disabled={spread === leaves}>
            Dalej →
          </button>
        </div>
        <a className="link-button" href={routeHash({ name: 'print', zineId: zine.id })}>
          Druk
        </a>
      </header>
      {failed ? (
        <p className="screen-message">Ta przeglądarka nie umie pokazać podglądu 3D. Spróbuj w aktualnym Chrome, Safari albo Firefoksie.</p>
      ) : (
        <div
          ref={container}
          className="preview3d-view"
          aria-label="Podgląd 3D zina"
          onPointerDown={(event) => (pointerDown.current = { x: event.clientX, y: event.clientY })}
          onPointerUp={(event) => {
            const down = pointerDown.current;
            pointerDown.current = null;
            if (!down || !isClick(down, { x: event.clientX, y: event.clientY })) return;
            const rect = event.currentTarget.getBoundingClientRect();
            turn(clickTurnsForward(event.clientX - rect.left, rect.width));
          }}
        />
      )}
      <p className="preview3d-help muted">
        {drawn < pages ? `Rysowanie stron: ${drawn} z ${pages}. ` : ''}
        Przeciągnij, żeby obrócić, kółkiem przybliż. Klik w prawą połowę albo strzałka w prawo przewraca dalej, w lewą
        albo strzałka w lewo wstecz.
      </p>
    </div>
  );
}
