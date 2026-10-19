import { useCallback, useEffect, useState } from 'react';

export const NOTES_WIDTH_DEFAULT = 280;
export const NOTES_WIDTH_MIN = 220;
const NOTES_WIDTH_MAX = 720;
/** The notepad never takes more than this share of the window, so the canvas keeps its room. */
const NOTES_WIDTH_MAX_SHARE = 0.55;

const KEY = 'ziniarz.notesWidth';

/** Widest the notepad may be in a window this wide (never below the minimum). */
export function notesWidthMax(windowWidth: number): number {
  return Math.max(NOTES_WIDTH_MIN, Math.min(NOTES_WIDTH_MAX, Math.floor(windowWidth * NOTES_WIDTH_MAX_SHARE)));
}

export function clampNotesWidth(width: number, windowWidth: number): number {
  if (!Number.isFinite(width)) return NOTES_WIDTH_DEFAULT;
  return Math.round(Math.min(notesWidthMax(windowWidth), Math.max(NOTES_WIDTH_MIN, width)));
}

/** The notepad width remembered in this browser, as chosen (not yet fitted to the window). */
export function loadNotesWidth(): number {
  try {
    const saved = localStorage.getItem(KEY);
    const width = saved === null ? NaN : Number(saved);
    return Number.isFinite(width) ? width : NOTES_WIDTH_DEFAULT;
  } catch {
    return NOTES_WIDTH_DEFAULT; // storage blocked (private window, site data off)
  }
}

export function saveNotesWidth(width: number): void {
  try {
    localStorage.setItem(KEY, String(width));
  } catch {
    // Storage blocked: the choice lasts until the editor closes.
  }
}

export interface NotesWidth {
  /** Width in px, fitted to the window. */
  width: number;
  min: number;
  max: number;
  /** Sets the width (clamped), remembers it. */
  set(width: number): void;
  reset(): void;
}

/** The notepad width: remembered in this browser, kept inside its limits as the window resizes. */
export function useNotesWidth(): NotesWidth {
  const [chosen, setChosen] = useState(loadNotesWidth);
  const [windowWidth, setWindowWidth] = useState(() => window.innerWidth);
  useEffect(() => {
    const onResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const set = useCallback(
    (width: number) => {
      const next = clampNotesWidth(width, windowWidth);
      setChosen(next);
      saveNotesWidth(next);
    },
    [windowWidth],
  );
  const reset = useCallback(() => set(NOTES_WIDTH_DEFAULT), [set]);

  return { width: clampNotesWidth(chosen, windowWidth), min: NOTES_WIDTH_MIN, max: notesWidthMax(windowWidth), set, reset };
}
