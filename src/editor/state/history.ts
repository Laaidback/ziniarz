export const HISTORY_LIMIT = 100;

/** Undo stack for one open zine, in memory only. */
export interface History<T> {
  past: T[];
  present: T;
  future: T[];
  /** Key of the last recorded change; a change with the same key merges into it. */
  lastKey: string | null;
}

export function createHistory<T>(present: T): History<T> {
  return { past: [], present, future: [], lastKey: null };
}

/**
 * Records `next` as a new undo step (at most HISTORY_LIMIT are kept). Consecutive changes with
 * the same non-null key (typing in a field, dragging a slider) merge into one step.
 */
export function record<T>(history: History<T>, next: T, key: string | null = null): History<T> {
  if (next === history.present) return history;
  if (key !== null && key === history.lastKey) return { ...history, present: next, future: [] };
  return { past: [...history.past, history.present].slice(-HISTORY_LIMIT), present: next, future: [], lastKey: key };
}

/** Ends merging: the next change is a new undo step even with the same key (a new interaction began). */
export function breakMerge<T>(history: History<T>): History<T> {
  return history.lastKey === null ? history : { ...history, lastKey: null };
}

/** Replaces the present without an undo step (derived data, such as re-measured text heights). */
export function replacePresent<T>(history: History<T>, next: T): History<T> {
  return { ...history, present: next };
}

export function undo<T>(history: History<T>): History<T> {
  if (history.past.length === 0) return history;
  return {
    past: history.past.slice(0, -1),
    present: history.past[history.past.length - 1],
    future: [history.present, ...history.future],
    lastKey: null,
  };
}

export function redo<T>(history: History<T>): History<T> {
  if (history.future.length === 0) return history;
  return {
    past: [...history.past, history.present],
    present: history.future[0],
    future: history.future.slice(1),
    lastKey: null,
  };
}

export const canUndo = (history: History<unknown>) => history.past.length > 0;
export const canRedo = (history: History<unknown>) => history.future.length > 0;
