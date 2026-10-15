import { useEffect, useMemo, useRef, useState } from 'react';
import type { SheetSide } from '../../imposition/imposition';
import { printLayout, type PrintLayout } from '../../imposition/layout';
import type { PrintSettings, Zine } from '../../model/types';
import type { RenderAssets } from '../../render/assets';
import { releaseCanvas } from '../../render/canvasBytes';
import { createRenderQueue, type RenderQueue } from '../../render/renderQueue';
import { previewSheets, sideCaption } from '../printTexts';
import { renderSheetSide } from '../sheetSide';

/** Resolution of the preview images: an A4 side is 561 × 397 px. */
export const PREVIEW_DPI = 48;

interface Props {
  zine: Zine;
  assets: RenderAssets;
  settings: PrintSettings;
}

/**
 * Every sheet, front and back, as it comes out of the printer (backs are never shown turned:
 * "Obróć tyły o 180°" only undoes the turn of a long-edge printer). Each side is drawn
 * in the background the first time it scrolls into view, one side at a time.
 */
export function SheetPreview({ zine, assets, settings }: Props) {
  const queue = useMemo(() => createRenderQueue(), []);
  useEffect(() => () => queue.clear(), [queue]);
  const { bleed, cropMarks, foldMarks } = settings;
  const layout = useMemo(() => printLayout({ bleed, cropMarks, foldMarks }), [bleed, cropMarks, foldMarks]);
  const sheets = useMemo(() => previewSheets(zine.sheets), [zine.sheets]);
  const common = { zine, assets, layout, cropMarks, foldMarks, queue };
  return (
    <ol className="sheet-preview">
      {sheets.map(({ sheet, front, back }) => (
        <li key={sheet}>
          <h3>Kartka {sheet + 1}</h3>
          <div className="sheet-pair">
            <SheetSideImage side={front} {...common} />
            <SheetSideImage side={back} {...common} />
          </div>
        </li>
      ))}
    </ol>
  );
}

interface SideProps {
  zine: Zine;
  assets: RenderAssets;
  side: SheetSide;
  layout: PrintLayout;
  cropMarks: boolean;
  foldMarks: boolean;
  queue: RenderQueue;
}

function SheetSideImage({ zine, assets, side, layout, cropMarks, foldMarks, queue }: SideProps) {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '300px' },
    );
    observer.observe(ref.current!);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    const cancel = queue.add(() => {
      const canvas = renderSheetSide(zine, side, assets, layout, {
        dpi: PREVIEW_DPI,
        cropMarks,
        foldMarks,
        rotate180: false,
      });
      const next = canvas.toDataURL('image/jpeg', 0.85);
      releaseCanvas(canvas);
      if (!cancelled) setUrl(next);
    });
    return () => {
      cancelled = true;
      cancel();
    };
  }, [visible, zine, assets, side, layout, cropMarks, foldMarks, queue]);

  const label = `Kartka ${side.sheet + 1}, ${sideCaption(side)}`;
  return (
    <figure ref={ref} className="sheet-side">
      {url ? <img src={url} alt={label} /> : <div className="sheet-placeholder" aria-hidden="true" />}
      <figcaption>{sideCaption(side)}</figcaption>
    </figure>
  );
}
