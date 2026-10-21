import type { ReactNode } from 'react';
import { routeHash } from '../app/route';
import { useEditor, useEditorEnv } from './EditorContext';
import { InsertButtons } from './InsertButtons';
import { selectCanRedo, selectCanUndo } from './state/store';

interface TopBarProps {
  notesShown: boolean;
  onToggleNotes(): void;
  settingsShown: boolean;
  onToggleSettings(): void;
  /** Google Drive: "save to Drive" or the sync status. */
  cloud?: ReactNode;
}

export function TopBar({ notesShown, onToggleNotes, settingsShown, onToggleSettings, cloud }: TopBarProps) {
  const { store, zineId } = useEditorEnv();
  const title = useEditor((s) => s.history.present.title);
  const canUndo = useEditor(selectCanUndo);
  const canRedo = useEditor(selectCanRedo);
  const showGuides = useEditor((s) => s.showGuides);

  return (
    <header className="editor-top">
      <a className="link-button" href={routeHash({ name: 'home' })}>
        ← Ziny
      </a>
      <h1 className="editor-title">{title}</h1>
      <InsertButtons />
      <div className="toolbar">
        <button type="button" onClick={() => store.getState().undo()} disabled={!canUndo} title="Cofnij (⌘Z)">
          Cofnij
        </button>
        <button type="button" onClick={() => store.getState().redo()} disabled={!canRedo} title="Ponów (⇧⌘Z)">
          Ponów
        </button>
        <label className="toggle">
          <input
            type="checkbox"
            aria-label="Pokaż prowadnice"
            checked={showGuides}
            onChange={(event) => store.getState().setShowGuides(event.target.checked)}
          />
          Pokaż prowadnice
        </label>
        <button
          type="button"
          aria-pressed={settingsShown}
          onClick={onToggleSettings}
          title="Pokaż lub ukryj ustawienia zina, strony i zaznaczonego elementu"
        >
          Ustawienia
        </button>
        <button type="button" aria-pressed={notesShown} onClick={onToggleNotes} title="Pokaż lub ukryj notatnik">
          Notatnik
        </button>
      </div>
      <div className="toolbar">
        {cloud}
        <a className="link-button" href={routeHash({ name: 'preview3d', zineId })}>
          Podgląd 3D
        </a>
        <a className="link-button primary" href={routeHash({ name: 'print', zineId })}>
          Druk
        </a>
      </div>
    </header>
  );
}
