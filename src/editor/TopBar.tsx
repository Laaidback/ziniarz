import { routeHash } from '../app/route';
import { useEditor, useEditorEnv } from './EditorContext';
import { selectCanRedo, selectCanUndo } from './state/store';

export function TopBar() {
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
            checked={showGuides}
            onChange={(event) => store.getState().setShowGuides(event.target.checked)}
          />
          Pokaż prowadnice
        </label>
      </div>
      <div className="toolbar">
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
