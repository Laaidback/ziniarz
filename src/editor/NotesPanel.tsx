import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { notesPreview } from '../model/notesHtml';
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
  register(section: string, box: HTMLElement | null): void;
  onSaved(): void;
}

/**
 * One page of the notepad: a heading and its own editable text. The editable element is not
 * controlled by React: it is filled once from the store, and every input stores its (sanitized) HTML.
 */
function NotesSection({ section, title, label, placeholder, register, onSaved }: SectionProps) {
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
    <section className="notes-section" data-section={section}>
      <h3 className="notes-section-title">{title}</h3>
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

interface TileProps {
  section: string;
  title: string;
  /** The spread open in the editor. */
  current?: boolean;
  onOpen(): void;
}

/** A small card in the notepad's grid: the section's name and the start of its notes; clicking opens it. */
function NotesTile({ section, title, current = false, onOpen }: TileProps) {
  const html = useEditor((s) =>
    section === GENERAL ? s.history.present.notes : (s.history.present.spreadNotes[section] ?? ''),
  );
  const preview = notesPreview(html);
  return (
    <button
      type="button"
      className={current ? 'notes-tile is-current' : 'notes-tile'}
      data-section={section}
      aria-label={title}
      aria-current={current ? 'true' : undefined}
      title="Otwórz notatki"
      onClick={onOpen}
    >
      <span className="notes-tile-title">
        {title}
        {current && <span className="notes-now">teraz</span>}
      </span>
      {preview ? <span className="notes-tile-text">{preview}</span> : <span className="notes-tile-empty">pusto</span>}
    </button>
  );
}

/**
 * The zine's notepad beside the canvas: a general section and one per spread, each with bold and
 * highlight, saved with the zine (no undo step in the design history; each field has the browser's
 * own undo). It shows every section as a grid of tiles; a tile opens its section as a page to write
 * on (a spread's tile also opens that spread in the editor, and its page then follows the editor).
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

  // In the grid the tile of the spread opened in the editor scrolls into view, without taking the focus.
  const shown = useRef({ spread: currentId, view });
  useEffect(() => {
    const before = shown.current;
    shown.current = { spread: currentId, view };
    if (view !== 'all' || (before.spread === currentId && before.view === view)) return;
    const container = list.current;
    const tile = container?.querySelector<HTMLElement>(`[data-section="${CSS.escape(currentId ?? '')}"]`);
    if (!container || !tile) return;
    const box = container.getBoundingClientRect();
    const at = tile.getBoundingClientRect();
    if (at.top >= box.top && at.bottom <= box.bottom) return;
    const top = at.top - box.top + container.scrollTop;
    container.scrollTo({
      top: Math.max(0, top - 4),
      behavior: before.view === view ? 'smooth' : 'auto',
    });
  }, [currentId, view]);

  // A page opened from its tile is ready to write on: the caret goes to the end of its notes.
  const focusPage = useRef(false);
  useEffect(() => {
    if (!focusPage.current || view === 'all') return;
    focusPage.current = false;
    const box = boxes.current.get(view === 'general' ? GENERAL : (currentId ?? ''));
    if (!box) return;
    box.focus();
    const range = document.createRange();
    range.selectNodeContents(box);
    range.collapse(false);
    document.getSelection()?.removeAllRanges();
    document.getSelection()?.addRange(range);
  });

  const chooseView = (next: NotesView) => {
    saveNotesView(next);
    setView(next);
  };

  const openPage = (next: 'spread' | 'general', spread?: number) => {
    if (spread !== undefined) store.getState().setSpread(spread);
    focusPage.current = true;
    chooseView(next);
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

  /** The page to write on: the general notes, or the notes of the spread open in the editor. */
  const page = () => {
    if (view === 'general') {
      return (
        <NotesSection
          key={GENERAL}
          section={GENERAL}
          title={GENERAL_TITLE}
          label={`Notatki: ${GENERAL_TITLE}`}
          placeholder={NOTES_PLACEHOLDER}
          register={register}
          onSaved={readSelection}
        />
      );
    }
    if (!spreads[current]) return null;
    const name = spreadName(current, sheets);
    return (
      <NotesSection
        key={spreads[current].id}
        section={spreads[current].id}
        title={name}
        label={`Notatki: ${name}`}
        placeholder={`Notatki do: ${name}`}
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
      {view === 'all' ? (
        <div ref={list} className="notes-tiles" role="group" aria-label="Kartki notatnika">
          <NotesTile section={GENERAL} title={GENERAL_TITLE} onOpen={() => openPage('general')} />
          {spreads.map((spread, index) => (
            <NotesTile
              key={spread.id}
              section={spread.id}
              title={spreadName(index, sheets)}
              current={index === current}
              onOpen={() => openPage('spread', index)}
            />
          ))}
        </div>
      ) : (
        <>
          <div className="notes-bar">
            <button
              type="button"
              className="notes-back"
              title="Wróć do wszystkich kartek"
              onClick={() => chooseView('all')}
            >
              <span aria-hidden="true">←</span> Wszystkie
            </button>
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
          </div>
          <div className="notes-page" onKeyDown={onKeyDown}>
            {page()}
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
        </>
      )}
    </aside>
  );
}
