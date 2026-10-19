import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useEditorEnv } from './EditorContext';
import { HideButton } from './HideButton';
import { insertTextFrame } from './insert';
import { insertPlainText, selectedText, selectionBold, selectionMarked, toggleBold, toggleMark } from './notesFormat';

export const NOTES_PLACEHOLDER = 'Tu trzymaj teksty do zina. Wklejaj, poprawiaj i kopiuj do napisów.';

interface SelectionState {
  text: string;
  bold: boolean;
  marked: boolean;
}

const NOTHING: SelectionState = { text: '', bold: false, marked: false };

/**
 * The zine's notepad beside the canvas: text with bold and highlight, saved with the zine (no undo
 * step in the design history; the field has the browser's own undo). The editable element is not
 * controlled by React: it is filled once, and every input stores its (sanitized) HTML.
 */
export function NotesPanel({ onHide }: { onHide(): void }) {
  const { store } = useEditorEnv();
  const box = useRef<HTMLDivElement>(null);
  const [empty, setEmpty] = useState(() => store.getState().history.present.notes === '');
  const [selection, setSelection] = useState<SelectionState>(NOTHING);

  useLayoutEffect(() => {
    // Sanitized by setNotes and parseZine, so it holds only text, <b>, <mark>, <br>, <div>, <p>.
    box.current!.innerHTML = store.getState().history.present.notes;
  }, [store]);

  const readSelection = () => {
    const root = box.current;
    if (!root) return;
    const text = selectedText(root);
    const next = text ? { text, bold: selectionBold(root), marked: selectionMarked(root) } : NOTHING;
    setSelection((current) =>
      current.text === next.text && current.bold === next.bold && current.marked === next.marked ? current : next,
    );
  };

  useEffect(() => {
    document.addEventListener('selectionchange', readSelection);
    return () => document.removeEventListener('selectionchange', readSelection);
  }, []);

  const save = () => {
    const root = box.current!;
    const blank = root.textContent === '';
    setEmpty(blank);
    store.getState().setNotes(blank ? '' : root.innerHTML);
    readSelection();
  };

  const bold = () => {
    toggleBold(); // fires an input event, which saves
    readSelection();
  };
  const mark = () => {
    toggleMark(box.current!);
    save();
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
    const key = event.key.toLowerCase();
    if (key === 'b' && !event.shiftKey) {
      event.preventDefault();
      bold();
    } else if (key === 'h' && event.shiftKey) {
      event.preventDefault();
      mark();
    }
  };

  // Toolbar buttons must not take the focus, or the selection they act on would go away.
  const keepSelection = (event: { preventDefault(): void }) => event.preventDefault();

  return (
    <aside className="editor-notes" aria-labelledby="notes-heading">
      <div className="column-header">
        <h2 id="notes-heading" className="notes-heading">
          Notatnik
        </h2>
        <HideButton label="Schowaj notatnik" onClick={onHide} />
      </div>
      <div className="notes-tools" role="toolbar" aria-label="Formatowanie notatnika">
        <button
          type="button"
          className="notes-bold"
          aria-label="Pogrubienie"
          aria-pressed={selection.bold}
          title="Pogrubienie (⌘B)"
          disabled={!selection.text}
          onMouseDown={keepSelection}
          onClick={bold}
        >
          B
        </button>
        <button
          type="button"
          aria-label="Zaznaczenie"
          aria-pressed={selection.marked}
          title="Zaznaczenie markerem (⇧⌘H)"
          disabled={!selection.text}
          onMouseDown={keepSelection}
          onClick={mark}
        >
          <span className="notes-marker">Zaznaczenie</span>
        </button>
      </div>
      <div
        ref={box}
        className={empty ? 'notes-text is-empty' : 'notes-text'}
        role="textbox"
        aria-multiline="true"
        aria-label="Notatnik"
        aria-placeholder={NOTES_PLACEHOLDER}
        data-placeholder={NOTES_PLACEHOLDER}
        contentEditable
        suppressContentEditableWarning
        spellCheck
        onInput={save}
        onKeyDown={onKeyDown}
        onPaste={(event) => {
          event.preventDefault();
          insertPlainText(event.clipboardData.getData('text/plain'));
        }}
        onDrop={(event) => {
          // Dropped text comes in plain, like pasted text, where it was dropped.
          event.preventDefault();
          const text = event.dataTransfer.getData('text/plain');
          const at = document.caretRangeFromPoint?.(event.clientX, event.clientY);
          if (!text || !at) return;
          document.getSelection()?.removeAllRanges();
          document.getSelection()?.addRange(at);
          insertPlainText(text);
        }}
      />
      <button
        type="button"
        className="notes-insert"
        disabled={selection.text.trim() === ''}
        onMouseDown={keepSelection}
        onClick={() => insertTextFrame(store, selection.text.trim())}
      >
        Wstaw zaznaczenie jako napis
      </button>
    </aside>
  );
}
