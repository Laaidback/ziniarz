import { useCallback, useEffect, useRef, useState } from 'react';
import { LoadFailed } from '../app/LoadFailed';
import { routeHash } from '../app/route';
import { useZineView } from '../app/useZineView';
import { PAGE_HEIGHT, PAGE_WIDTH, pageCount } from '../model/geometry';
import type { Zine } from '../model/types';
import type { RenderAssets } from '../render/assets';
import { renderPage } from '../render/renderPage';
import { createRenderQueue } from '../render/renderQueue';
import { closedBook, spreadCaption, turnPage, type BookState } from './book';
import type { ZineScene } from './scene';
import { clickTurnsForward, isClick, texturePxPerMm, turnForKey, type Point } from './view';

/** Draws one page as a texture image; tests pass a failing or counting one. */
export type DrawPage = (zine: Zine, page: number, assets: RenderAssets) => HTMLCanvasElement;
/** Loads the three.js part; tests pass one that fails. */
export type LoadScene = () => Promise<typeof import('./scene')>;

const drawPageTexture: DrawPage = (zine, page, assets) =>
  renderPage(zine, page, assets, { pxPerMm: texturePxPerMm(), bleed: false });
// three.js is loaded only when the preview opens, so the rest of the app stays small.
const loadSceneModule: LoadScene = () => import('./scene');

/** The 3D book has the size of the trimmed A6 page. */
const TRIM_PAGE = { width: PAGE_WIDTH, height: PAGE_HEIGHT };

const LOAD_FAILED = 'Nie udało się wczytać podglądu 3D. Sprawdź połączenie z internetem i odśwież stronę.';
const WEBGL_FAILED =
  'Ta przeglądarka nie umie pokazać podglądu 3D. Spróbuj w aktualnym Chrome, Safari albo Firefoksie.';

interface PreviewProps {
  drawPage?: DrawPage;
  loadScene?: LoadScene;
}

export function Preview3dScreen({ zineId, ...rest }: { zineId: string } & PreviewProps) {
  const view = useZineView(zineId);
  if (view.status === 'loading') return <main className="screen-message">Otwieranie zina…</main>;
  if (view.status === 'failed') return <LoadFailed message={view.message} />;
  return <PreviewWorkspace zine={view.zine} assets={view.assets} {...rest} />;
}

function PreviewWorkspace({
  zine,
  assets,
  drawPage = drawPageTexture,
  loadScene = loadSceneModule,
}: { zine: Zine; assets: RenderAssets } & PreviewProps) {
  const container = useRef<HTMLDivElement>(null);
  const scene = useRef<ZineScene | null>(null);
  const book = useRef<BookState>(closedBook(zine.sheets));
  const pointerDown = useRef<Point | null>(null);
  const [spread, setSpread] = useState(0);
  const [drawn, setDrawn] = useState(0);
  // 'load': the three.js code did not download; 'webgl': the browser cannot draw 3D.
  const [failed, setFailed] = useState<'load' | 'webgl' | null>(null);
  const pages = pageCount(zine.sheets);

  useEffect(() => {
    let disposed = false;
    let round = 0;
    const queue = createRenderQueue();
    setDrawn(0);

    /** (Re)draws every page; a page that fails stays blank but still counts as done. */
    const drawPages = (view: ZineScene) => {
      const current = ++round;
      queue.clear();
      setDrawn(0);
      for (let page = 1; page <= pages; page++) {
        queue.add(() => {
          if (disposed || current !== round) return;
          try {
            view.setPageImage(page, drawPage(zine, page, assets));
          } catch (e) {
            console.error(e);
          }
          setDrawn((count) => count + 1);
        });
      }
    };

    loadScene().then(
      ({ ZineScene }) => {
        if (disposed) return;
        let view: ZineScene;
        try {
          view = new ZineScene(container.current!, {
            pageWidth: TRIM_PAGE.width,
            pageHeight: TRIM_PAGE.height,
            book: book.current,
            // Page images are not kept, so after a lost GPU context they are drawn again.
            onContextRestored: () => !disposed && drawPages(view),
          });
        } catch (e) {
          console.error(e);
          setFailed('webgl');
          return;
        }
        scene.current = view;
        drawPages(view);
      },
      (e: unknown) => {
        if (disposed) return;
        console.error(e);
        setFailed('load');
      },
    );
    return () => {
      disposed = true;
      queue.clear();
      scene.current?.dispose();
      scene.current = null;
    };
  }, [zine, assets, pages, drawPage, loadScene]);

  const turn = useCallback((forward: boolean) => {
    const next = turnPage(book.current, forward, performance.now());
    if (next === book.current) return;
    book.current = next;
    scene.current?.setBook(next);
    setSpread(next.turned);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const forward = turnForKey(event);
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
        <p className="screen-message">{failed === 'load' ? LOAD_FAILED : WEBGL_FAILED}</p>
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
        {drawn < pages && !failed ? `Rysowanie stron: ${drawn} z ${pages}. ` : ''}
        Przeciągnij, żeby obrócić, kółkiem przybliż. Klik w prawą połowę albo strzałka w prawo przewraca dalej, w lewą
        albo strzałka w lewo wstecz.
      </p>
    </div>
  );
}
