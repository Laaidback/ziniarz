/** What the notepad shows: the current spread's section only, or every section ("Całość"). */
export type NotesView = 'spread' | 'all';

const KEY = 'ziniarz.notesView';

/** The notepad view remembered in this browser; "Całość" by default. */
export function loadNotesView(): NotesView {
  try {
    return localStorage.getItem(KEY) === 'spread' ? 'spread' : 'all';
  } catch {
    return 'all'; // storage blocked (private window, site data off)
  }
}

export function saveNotesView(view: NotesView): void {
  try {
    localStorage.setItem(KEY, view);
  } catch {
    // Storage blocked: the choice lasts until the editor closes.
  }
}
