/**
 * What the notepad shows: every section as a grid of tiles ('all'), or one section as a page to
 * write on: the spread open in the editor ('spread', follows it) or the general notes ('general').
 */
export type NotesView = 'all' | 'spread' | 'general';

const KEY = 'ziniarz.notesView';

/** The notepad view remembered in this browser; the tiles by default. */
export function loadNotesView(): NotesView {
  try {
    const stored = localStorage.getItem(KEY);
    return stored === 'spread' || stored === 'general' ? stored : 'all';
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
