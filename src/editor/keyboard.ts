import type { EditorStore } from './state/store';

export const NUDGE_MM = 1;
export const NUDGE_SHIFT_MM = 10;

export type KeyCommand =
  | { type: 'undo' | 'redo' | 'delete' | 'copy' | 'paste' | 'duplicate' | 'escape' | 'enter' | 'prevSpread' | 'nextSpread' }
  | { type: 'nudge'; dx: number; dy: number };

export interface KeyLike {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

/** Editor shortcuts. Cmd on a Mac and Ctrl elsewhere both work. */
export function keyCommand(event: KeyLike): KeyCommand | null {
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  if (event.metaKey || event.ctrlKey) {
    if (key === 'z') return { type: event.shiftKey ? 'redo' : 'undo' };
    if (key === 'y') return { type: 'redo' };
    if (key === 'c') return { type: 'copy' };
    if (key === 'v') return { type: 'paste' };
    if (key === 'd') return { type: 'duplicate' };
    return null;
  }
  const step = event.shiftKey ? NUDGE_SHIFT_MM : NUDGE_MM;
  switch (key) {
    case 'Delete':
    case 'Backspace':
      return { type: 'delete' };
    case 'ArrowLeft':
      return { type: 'nudge', dx: -step, dy: 0 };
    case 'ArrowRight':
      return { type: 'nudge', dx: step, dy: 0 };
    case 'ArrowUp':
      return { type: 'nudge', dx: 0, dy: -step };
    case 'ArrowDown':
      return { type: 'nudge', dx: 0, dy: step };
    case 'Escape':
      return { type: 'escape' };
    case 'Enter':
      return { type: 'enter' };
    case 'PageUp':
      return { type: 'prevSpread' };
    case 'PageDown':
      return { type: 'nextSpread' };
    default:
      return null;
  }
}

const TEXT_INPUT_TYPES = new Set(['text', 'search', 'number', 'email', 'url', 'tel', 'password']);

interface FieldLike {
  tagName?: unknown;
  type?: unknown;
  isContentEditable?: boolean;
}

/** Keys typed into fields belong to the field, not to the editor. Checkboxes, sliders and buttons are not typed into. */
export function isTypingTarget(target: EventTarget | null): boolean {
  const element = target as FieldLike | null;
  if (!element || typeof element.tagName !== 'string') return false;
  if (element.isContentEditable === true) return true;
  if (element.tagName === 'INPUT') return TEXT_INPUT_TYPES.has(typeof element.type === 'string' ? element.type : 'text');
  return element.tagName === 'TEXTAREA' || element.tagName === 'SELECT';
}

/** Whether the focused field handles `key` itself: every key while typing, the arrows on a slider. */
export function fieldOwnsKey(target: EventTarget | null, key: string): boolean {
  if (isTypingTarget(target)) return true;
  const element = target as FieldLike | null;
  return element?.tagName === 'INPUT' && element.type === 'range' && key.startsWith('Arrow');
}

/** Runs a shortcut; returns false when it does nothing here (the browser keeps its default). */
export function applyKeyCommand(store: EditorStore, command: KeyCommand): boolean {
  const s = store.getState();
  switch (command.type) {
    case 'undo':
      s.undo();
      return true;
    case 'redo':
      s.redo();
      return true;
    case 'delete':
      if (!s.selectedId) return false;
      s.deleteSelected();
      return true;
    case 'copy':
      if (!s.selectedId) return false;
      s.copySelected();
      return true;
    case 'paste':
      if (!s.clipboard) return false;
      s.paste();
      return true;
    case 'duplicate':
      s.duplicateSelected();
      return true;
    case 'nudge':
      if (!s.selectedId) return false;
      s.nudgeSelected(command.dx, command.dy);
      return true;
    case 'escape':
      if (s.mode !== 'idle') s.setMode('idle');
      else s.select(null);
      return true;
    case 'enter':
      if (s.mode !== 'crop') return false;
      s.setMode('idle');
      return true;
    case 'prevSpread':
      s.setSpread(s.spread - 1);
      return true;
    case 'nextSpread':
      s.setSpread(s.spread + 1);
      return true;
  }
}
