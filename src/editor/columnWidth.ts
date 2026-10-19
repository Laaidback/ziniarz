import { useCallback, useEffect, useMemo, useState } from 'react';

/** The side columns of the editor whose width the user can change. */
export type WidthColumn = 'spreads' | 'settings' | 'notes';

interface ColumnLimits {
  /** localStorage key of the chosen width. */
  key: string;
  default: number;
  min: number;
  max: number;
  /** The column never takes more than this share of the window (1 = no extra limit). */
  maxShare: number;
}

export const COLUMN_LIMITS: Record<WidthColumn, ColumnLimits> = {
  spreads: { key: 'ziniarz.spreadsWidth', default: 180, min: 140, max: 360, maxShare: 1 },
  settings: { key: 'ziniarz.settingsWidth', default: 300, min: 240, max: 480, maxShare: 1 },
  notes: { key: 'ziniarz.notesWidth', default: 280, min: 220, max: 720, maxShare: 0.55 },
};

/** The columns left to right are never allowed to squeeze the canvas below this many px. */
export const CANVAS_MIN_WIDTH = 360;

/** Order in which shown columns give up room when the window cannot hold them all at the chosen widths. */
const SHRINK_ORDER: WidthColumn[] = ['notes', 'settings', 'spreads'];
const COLUMNS = Object.keys(COLUMN_LIMITS) as WidthColumn[];

/** A column's own limits in a window this wide (the maximum never drops below the minimum). */
function ownMax(column: WidthColumn, windowWidth: number): number {
  const { min, max, maxShare } = COLUMN_LIMITS[column];
  return Math.max(min, Math.min(max, Math.floor(windowWidth * maxShare)));
}

export function clampColumnWidth(column: WidthColumn, width: number, windowWidth: number): number {
  const limits = COLUMN_LIMITS[column];
  if (!Number.isFinite(width)) return limits.default;
  return Math.round(Math.min(ownMax(column, windowWidth), Math.max(limits.min, width)));
}

export interface FittedColumn {
  /** Width in px, fitted to the window and to the other shown columns. */
  width: number;
  min: number;
  max: number;
}

/**
 * The widths the shown columns really get. Each chosen width is clamped to its own limits; when
 * together they leave the canvas less than `CANVAS_MIN_WIDTH`, the notepad, then the settings, then the
 * spread list give up room (never below their minimum). A column's maximum is what the others leave it.
 */
export function fitColumnWidths(
  chosen: Record<WidthColumn, number>,
  shown: Record<WidthColumn, boolean>,
  windowWidth: number,
): Record<WidthColumn, FittedColumn> {
  const budget = windowWidth - CANVAS_MIN_WIDTH;
  const widths = {} as Record<WidthColumn, number>;
  for (const column of COLUMNS) widths[column] = clampColumnWidth(column, chosen[column], windowWidth);
  const shownColumns = COLUMNS.filter((column) => shown[column]);
  let overflow = shownColumns.reduce((sum, column) => sum + widths[column], 0) - budget;
  for (const column of SHRINK_ORDER) {
    if (overflow <= 0) break;
    if (!shown[column]) continue;
    const cut = Math.min(overflow, widths[column] - COLUMN_LIMITS[column].min);
    widths[column] -= cut;
    overflow -= cut;
  }
  const fitted = {} as Record<WidthColumn, FittedColumn>;
  for (const column of COLUMNS) {
    const others = shownColumns.filter((other) => other !== column).reduce((sum, other) => sum + widths[other], 0);
    const { min } = COLUMN_LIMITS[column];
    const max = Math.max(min, Math.min(ownMax(column, windowWidth), budget - others));
    fitted[column] = { width: Math.min(max, Math.max(min, widths[column])), min, max };
  }
  return fitted;
}

/** Device pixels per mm for the spread thumbnails in a list column this wide (stepped, so a drag does not redraw them all the time). */
export function thumbnailPxPerMm(columnWidth: number, devicePixelRatio: number): number {
  const thumbWidth = columnWidth - 41; // list padding, thumbnail padding and border, column border
  const wanted = (Math.max(thumbWidth, 1) * Math.max(devicePixelRatio, 1)) / 216; // the thumbnail shows 216 mm
  return Math.min(3.2, Math.max(0.8, Math.ceil(wanted / 0.4) * 0.4));
}

/** The width remembered in this browser, as chosen (not yet fitted to the window). */
export function loadColumnWidth(column: WidthColumn): number {
  const { key, default: fallback } = COLUMN_LIMITS[column];
  try {
    const saved = localStorage.getItem(key);
    const width = saved === null ? NaN : Number(saved);
    return Number.isFinite(width) ? width : fallback;
  } catch {
    return fallback; // storage blocked (private window, site data off)
  }
}

export function saveColumnWidth(column: WidthColumn, width: number): void {
  try {
    localStorage.setItem(COLUMN_LIMITS[column].key, String(width));
  } catch {
    // Storage blocked: the choice lasts until the editor closes.
  }
}

export interface ColumnWidth extends FittedColumn {
  /** Sets the width (clamped), remembers it. */
  set(width: number): void;
  reset(): void;
}

/**
 * The widths of the three side columns: remembered in this browser, kept inside their limits (and the
 * canvas's minimum) as the window resizes or columns are shown and hidden.
 */
export function useColumnWidths(shown: Record<WidthColumn, boolean>): Record<WidthColumn, ColumnWidth> {
  const [chosen, setChosen] = useState<Record<WidthColumn, number>>(() => ({
    spreads: loadColumnWidth('spreads'),
    settings: loadColumnWidth('settings'),
    notes: loadColumnWidth('notes'),
  }));
  const [windowWidth, setWindowWidth] = useState(() => window.innerWidth);
  useEffect(() => {
    const onResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const fitted = useMemo(
    () => fitColumnWidths(chosen, shown, windowWidth),
    // `shown` is a fresh object each render; its values are the inputs.
    [chosen, shown.spreads, shown.settings, shown.notes, windowWidth],
  );

  const setColumn = useCallback(
    (column: WidthColumn, width: number) => {
      const { min, max } = fitted[column];
      const rounded = Math.round(Math.min(max, Math.max(min, Number.isFinite(width) ? width : COLUMN_LIMITS[column].default)));
      setChosen((all) => ({ ...all, [column]: rounded }));
      saveColumnWidth(column, rounded);
    },
    [fitted],
  );

  return useMemo(() => {
    const result = {} as Record<WidthColumn, ColumnWidth>;
    for (const column of COLUMNS) {
      result[column] = {
        ...fitted[column],
        set: (width) => setColumn(column, width),
        reset: () => setColumn(column, COLUMN_LIMITS[column].default),
      };
    }
    return result;
  }, [fitted, setColumn]);
}
