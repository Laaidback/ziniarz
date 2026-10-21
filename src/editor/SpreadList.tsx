import { useState } from 'react';
import { askConfirm } from '../app/confirm';
import { countOf } from '../app/plural';
import { useFontsVersion } from '../fonts/useFontsVersion';
import { canAddSheet, removalHasContent, removalHasNotes, removalNeedsConfirmation, sheetRemoval } from '../model/sheets';
import { useEditor, useEditorEnv } from './EditorContext';
import { thumbnailPxPerMm } from './columnWidth';
import { removalMessage, spreadLabel, spreadName } from './spreadLabels';
import { selectZine } from './state/store';
import { useSpreadThumbnails } from './useSpreadThumbnails';

/** `width` is the column's width in px; wider columns get sharper thumbnails. */
export function SpreadList({ width = 180 }: { width?: number }) {
  const { store, assets } = useEditorEnv();
  const zine = useEditor(selectZine);
  const current = useEditor((s) => s.spread);
  const assetsVersion = useEditor((s) => s.assetsVersion);
  const fontsVersion = useFontsVersion();
  const thumbnails = useSpreadThumbnails(
    zine,
    assets,
    assetsVersion * 10_000 + fontsVersion,
    thumbnailPxPerMm(width, window.devicePixelRatio),
  );
  const [hovering, setHovering] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const removal = sheetRemoval(zine, current);
  // Pages that "− kartka" would remove are highlighted while the button is hovered or the question is open.
  const doomed: number[] = (hovering || confirming) && removal ? removal.spreads : [];

  const removeSheet = async () => {
    if (!removal) return;
    let ok = true;
    if (removalNeedsConfirmation(zine, removal)) {
      setConfirming(true);
      const lost = { content: removalHasContent(zine, removal), notes: removalHasNotes(zine, removal) };
      ok = await askConfirm(removalMessage(removal.pages, lost), 'Usuń kartkę');
      setConfirming(false);
    }
    if (ok) store.getState().removeSheet();
  };

  return (
    <nav className="spread-list" aria-label="Rozkładówki">
      <ol>
        {zine.spreads.map((spread, index) => (
          <li key={spread.id}>
            <button
              type="button"
              className={['spread-thumb', index === current && 'current', doomed.includes(index) && 'doomed']
                .filter(Boolean)
                .join(' ')}
              aria-label={spreadName(index, zine.sheets)}
              aria-current={index === current ? 'true' : undefined}
              onClick={() => store.getState().setSpread(index)}
            >
              {thumbnails[index] ? <img src={thumbnails[index]} alt="" /> : <span className="thumb-empty" />}
              <span>{spreadLabel(index, zine.sheets)}</span>
            </button>
          </li>
        ))}
      </ol>
      {/* Pinned to the bottom of the column, so adding and removing sheets is always at hand. */}
      <div className="sheet-footer">
        <div className="sheet-buttons">
          <button type="button" onClick={() => store.getState().addSheet()} disabled={!canAddSheet(zine)}>
            + kartka
          </button>
          <button
            type="button"
            disabled={!removal}
            onClick={() => void removeSheet()}
            onMouseEnter={() => setHovering(true)}
            onMouseLeave={() => setHovering(false)}
            onFocus={() => setHovering(true)}
            onBlur={() => setHovering(false)}
          >
            − kartka
          </button>
        </div>
        <p className="muted sheet-count">
          {countOf(zine.sheets, 'kartka', 'kartki', 'kartek')} · {countOf(4 * zine.sheets, 'strona', 'strony', 'stron')}
        </p>
      </div>
    </nav>
  );
}
