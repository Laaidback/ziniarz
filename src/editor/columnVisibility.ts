/** Side columns of the editor that can be hidden from the top bar or their own "Schowaj" button. */
export type EditorColumn = 'notes' | 'settings';

const KEYS: Record<EditorColumn, string> = { notes: 'ziniarz.showNotes', settings: 'ziniarz.showSettings' };
/** The notepad is shown until hidden; the settings panel stays hidden until asked for. */
const SHOWN_BY_DEFAULT: Record<EditorColumn, boolean> = { notes: true, settings: false };

/** Whether the column is shown; remembered in this browser. */
export function loadColumnShown(column: EditorColumn): boolean {
  try {
    const saved = localStorage.getItem(KEYS[column]);
    return saved === null ? SHOWN_BY_DEFAULT[column] : saved === '1';
  } catch {
    return SHOWN_BY_DEFAULT[column]; // storage blocked (private window, site data off)
  }
}

export function saveColumnShown(column: EditorColumn, shown: boolean): void {
  try {
    localStorage.setItem(KEYS[column], shown ? '1' : '0');
  } catch {
    // Storage blocked: the choice lasts until the editor closes.
  }
}
