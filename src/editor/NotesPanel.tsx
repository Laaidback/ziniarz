import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useEditor, useEditorEnv } from './EditorContext';
import { HideButton } from './HideButton';
import { insertTextFrame } from './insert';
import { insertPlainText, rangeIn, selectedText, selectionBold, selectionMarked, toggleBold, toggleMark } from './notesFormat';
import { loadNotesView, saveNotesView, type NotesView } from './notesView';
import { spreadName } from './spreadLabels';
import type { EditorStore } from './state/store';

export const NOTES_PLACEHOLDER = 'Tu trzymaj teksty do zina. Wklejaj, poprawiaj i kopiuj do napisów.';
export const GENERAL_TITLE = 'Ogólne';

/** Section key of the general notes (Zine.notes); spread sections use their Spread.id. */
const GENERAL = 'general';

interface SelectionState {
  text: string;
  bold: boolean;
  marked: boolean;
  /** Section holding the selection. */
  section: string | null;
}

const NOTHING: SelectionState = { text: '', bold: false, marked: false, section: null };

const sameSelection = (a: SelectionState, b: SelectionState) =>
  a.text === b.text && a.bold === b.bold && a.marked === b.marked && a.section === b.section;

function storedNotes(store: EditorStore, section: string): string {
  const zine = store.getState().history.present;
  return section === GENERAL ? zine.notes : (zine.spreadNotes[section] ?? '');
}

function saveNotes(store: EditorStore, section: string, html: string): void {
  if (section === GENERAL) store.getState().setNotes(html);
  else store.getState().setSpreadNote(section, html);
}

interface SectionProps {
  section: string;
  title: string;
  label: string;
  placeholder: string;
  /** The spread open in the editor, highlighted in "Całość". */
  current?: boolean;
  /** Clicking the heading opens this spread in the editor. */
  onOpen?(): void;
  register(section: string, box: HTMLElement | null): void;
  onSaved(): void;
}

/**
 * One section of the notepad: a heading and its own editable text. The editable element is not
 * controlled by React: it is filled once from the store, and every input stores its (sanitized) HTML.
 */
function NotesSection({ section, title, label, placeholder, current = false, onOpen, register, onSaved }: SectionProps) {
  const { store } = useEditorEnv();
  const box = useRef<HTMLDivElement>(null);
  const [empty, setEmpty] = useState(() => storedNotes(store, section) === '');

  useLayoutEffect(() => {
    // Sanitized by setNotes, setSpreadNote and parseZine: only text, <b>, <mark>, <br>, <div>, <p>.
    box.current!.innerHTML = storedNotes(store, section);
    register(section, box.current);
    return () => register(section, null);
  }, [store, section, register]);

  const save = () => {
    const root = box.current!;
    const blank = root.textContent === '';
    setEmpty(blank);
    saveNotes(store, section, blank ? '' : root.innerHTML);
    onSaved();
  };

  return (
    <section className={current ? 'notes-section is-current' : 'notes-section'} data-section={section}>
      <h3 className="notes-section-title">
        {onOpen ? (
          <button type="button" className="notes-open" title="Pokaż tę rozkładówkę w edytorze" onClick={onOpen}>
            {title}
          </button>
        ) : (
          <span className="notes-section-name">{title}</span>
        )}
        {current && <span className="notes-now">teraz</span>}
      </h3>
      <div
        ref={box}
        className={empty ? 'notes-text is-empty' : 'notes-text'}
        role="textbox"
        aria-multiline="true"
        aria-label={label}
        aria-placeholder={placeholder}
        data-placeholder={placeholder}
        contentEditable
        suppressContentEditableWarning
        spellCheck
        onInput={save}
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
    </section>
  );
}

/**
 * The zine's notepad beside the canvas: a general section and one per spread, each with bold and
 * highlight, saved with the zine (no undo step in the design history; each field has the browser's
 * own undo). "Całość" shows every section as one document, "Ta rozkładówka" only the spread open in the editor.
 */
/** `resizer` is the width handle on the panel's left edge. */
export function NotesPanel({ onHide, resizer }: { onHide(): void; resizer?: ReactNode }) {
  const { store } = useEditorEnv();
  const spreads = useEditor((s) => s.history.present.spreads);
  const sheets = useEditor((s) => s.history.present.sheets);
  const current = useEditor((s) => s.spread);
  const [view, setView] = useState<NotesView>(loadNotesView);
  const [selection, setSelection] = useState<SelectionState>(NOTHING);
  const boxes = useRef(new Map<string, HTMLElement>());
  const list = useRef<HTMLDivElement>(null);
  const currentId = spreads[current]?.id;

  const [register] = useState(() => (section: string, box: HTMLElement | null) => {
    if (box) boxes.current.set(section, box);
    else boxes.current.delete(section);
  });

  /** The section holding the selection, with its editable element. */
  const selectionSection = (): [string, HTMLElement] | null => {
    for (const entry of boxes.current) if (rangeIn(entry[1])) return entry;
    return null;
  };

  const readSelection = () => {
    const found = selectionSection();
    const text = found ? selectedText(found[1]) : '';
    const next =
      found && text ? { text, bold: selectionBold(found[1]), marked: selectionMarked(found[1]), section: found[0] } : NOTHING;
    setSelection((now) => (sameSelection(now, next) ? now : next));
  };

  useEffect(() => {
    document.addEventListener('selectionchange', readSelection);
    return () => document.removeEventListener('selectionchange', readSelection);
  }, []);

  // In "Całość" the section of the spread opened in the editor scrolls into view, without taking the
  // focus, and not while the user types in another section.
  const shown = useRef({ spread: currentId, view });
  useEffect(() => {
    const before = shown.current;
    shown.current = { spread: currentId, view };
    if (view !== 'all' || (before.spread === currentId && before.view === view)) return;
    const container = list.current;
    const section = container?.querySelector<HTMLElement>(`[data-section="${CSS.escape(currentId ?? '')}"]`);
    if (!container || !section) return;
    const focused = document.activeElement;
    const typingElsewhere = [...boxes.current].some(([key, box]) => box === focused && key !== currentId);
    if (typingElsewhere) return;
    const top = section.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop;
    container.scrollTo({ top: Math.max(0, top - 4), behavior: 'smooth' });
  }, [currentId, view]);

  const chooseView = (next: NotesView) => {
    saveNotesView(next);
    setView(next);
  };

  const bold = () => {
    toggleBold(); // fires an input event, which saves
    readSelection();
  };
  const mark = () => {
    const found = selectionSection();
    if (!found) return;
    toggleMark(found[1]);
    saveNotes(store, found[0], found[1].textContent === '' ? '' : found[1].innerHTML);
    readSelection();
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

  /** Inserts the selection as a text frame on the spread it was written for (the open one for general notes). */
  const insert = () => {
    const text = selection.text.trim();
    if (selection.section !== null && selection.section !== GENERAL) {
      const state = store.getState();
      const index = state.history.present.spreads.findIndex((spread) => spread.id === selection.section);
      if (index >= 0 && index !== state.spread) state.setSpread(index);
    }
    insertTextFrame(store, text);
  };

  // Toolbar buttons must not take the focus, or the selection they act on would go away.
  const keepSelection = (event: { preventDefault(): void }) => event.preventDefault();

  const spreadSection = (index: number) => {
    const name = spreadName(index, sheets);
    return (
      <NotesSection
        key={spreads[index].id}
        section={spreads[index].id}
        title={name}
        label={`Notatki: ${name}`}
        placeholder={`Notatki do: ${name}`}
        current={view === 'all' && index === current}
        onOpen={view === 'all' ? () => store.getState().setSpread(index) : undefined}
        register={register}
        onSaved={readSelection}
      />
    );
  };

  return (
    <aside className="editor-notes" aria-labelledby="notes-heading">
      {resizer}
      <div className="column-header">
        <h2 id="notes-heading" className="notes-heading">
          Notatnik
        </h2>
        <HideButton label="Schowaj notatnik" onClick={onHide} />
      </div>
      <div className="notes-view" role="group" aria-label="Co pokazać w notatniku">
        <button type="button" aria-pressed={view === 'spread'} onClick={() => chooseView('spread')}>
          Ta rozkładówka
        </button>
        <button type="button" aria-pressed={view === 'all'} onClick={() => chooseView('all')}>
          Całość
        </button>
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
      <div ref={list} className={view === 'all' ? 'notes-sections' : 'notes-sections single'} onKeyDown={onKeyDown}>
        {view === 'all' && (
          <NotesSection
            key={GENERAL}
            section={GENERAL}
            title={GENERAL_TITLE}
            label={`Notatki: ${GENERAL_TITLE}`}
            placeholder={NOTES_PLACEHOLDER}
            register={register}
            onSaved={readSelection}
          />
        )}
        {view === 'all' ? spreads.map((_, index) => spreadSection(index)) : spreads[current] && spreadSection(current)}
      </div>
      <button
        type="button"
        className="notes-insert"
        disabled={selection.text.trim() === ''}
        onMouseDown={keepSelection}
        onClick={insert}
      >
        Wstaw zaznaczenie jako napis
      </button>
    </aside>
  );
}
