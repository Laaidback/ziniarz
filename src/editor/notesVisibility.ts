const KEY = 'ziniarz.showNotes';

/** Whether the notepad column is shown; remembered in this browser, shown by default. */
export function loadNotesShown(): boolean {
  try {
    return localStorage.getItem(KEY) !== '0';
  } catch {
    return true; // storage blocked (private window, site data off)
  }
}

export function saveNotesShown(shown: boolean): void {
  try {
    localStorage.setItem(KEY, shown ? '1' : '0');
  } catch {
    // Storage blocked: the choice lasts until the editor closes.
  }
}
