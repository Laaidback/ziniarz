import { useFontsVersion } from '../../fonts/useFontsVersion';
import { measureTextHeight } from '../../render/buildSpread';
import { useEditor, useEditorEnv } from '../EditorContext';
import { selectedElement } from '../state/store';
import type { Viewport } from './EditorStage';
import { TOOLBAR_HEIGHT, TOOLBAR_WIDTH, toolbarPosition } from './toolbarPosition';

interface SelectionToolbarProps {
  viewport: Viewport;
  /** Size of the canvas box in px. */
  width: number;
  height: number;
  /** A drag, resize or rotation is running: the toolbar would stay behind, so it hides. */
  moving: boolean;
}

/** Lock and trash buttons next to the selected element, while it is selected and not being edited or moved. */
export function SelectionToolbar({ viewport, width, height, moving }: SelectionToolbarProps) {
  const { store } = useEditorEnv();
  const element = useEditor(selectedElement);
  const mode = useEditor((s) => s.mode);
  // Text is drawn as tall as it measures now (fonts may have loaded since the height was stored).
  useFontsVersion();
  if (!element || mode !== 'idle' || moving) return null;

  const frame = element.kind === 'text' ? { ...element, height: measureTextHeight(element) } : element;
  const { left, top } = toolbarPosition(frame, viewport, width, height);
  return (
    <div className="selection-toolbar" role="toolbar" aria-label="Zaznaczony element" style={{ left, top, width: TOOLBAR_WIDTH, height: TOOLBAR_HEIGHT }}>
      <button
        type="button"
        className={element.locked ? 'active' : undefined}
        aria-label={element.locked ? 'Odblokuj' : 'Zablokuj'}
        title={element.locked ? 'Odblokuj' : 'Zablokuj (nie da się przesunąć ani wyrzucić)'}
        onClick={() => store.getState().toggleLockSelected()}
      >
        {element.locked ? <LockClosedIcon /> : <LockOpenIcon />}
      </button>
      <button
        type="button"
        className="danger"
        aria-label="Wyrzuć"
        title={element.locked ? 'Odblokuj, żeby wyrzucić' : 'Wyrzuć (Backspace)'}
        disabled={element.locked}
        onClick={() => store.getState().deleteSelected()}
      >
        <TrashIcon />
      </button>
    </div>
  );
}

const ICON = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const;

function LockClosedIcon() {
  return (
    <svg {...ICON}>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

function LockOpenIcon() {
  return (
    <svg {...ICON}>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 7.75-1.4" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg {...ICON}>
      <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13M9 7V4h6v3" />
    </svg>
  );
}
