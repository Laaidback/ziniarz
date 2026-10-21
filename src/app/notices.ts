import { createStore } from 'zustand/vanilla';

export interface Notice {
  id: number;
  text: string;
}

export const GENERIC_ERROR = 'Coś poszło nie tak. Spróbuj jeszcze raz.';

/** Errors whose message is already a Polish sentence for the user. */
const USER_FACING = new Set([
  'StorageFullError',
  'ZinFileError',
  'ZineFormatError',
  'ImageImportError',
  'FontImportError',
  'ZineNotFoundError',
  'CloudError',
]);

/** What to tell the user about an error: our own messages as they are, anything else a generic sentence. */
export function errorMessage(error: unknown): string {
  return error instanceof Error && USER_FACING.has(error.name) ? error.message : GENERIC_ERROR;
}

export const noticeStore = createStore<{ notices: Notice[] }>()(() => ({ notices: [] }));

let nextId = 1;

/** Shows a message at the top of the screen until the user closes it. The same text is shown once. */
export function notify(text: string): void {
  noticeStore.setState((s) => ({ notices: [...s.notices.filter((n) => n.text !== text), { id: nextId++, text }] }));
}

export function dismissNotice(id: number): void {
  noticeStore.setState((s) => ({ notices: s.notices.filter((n) => n.id !== id) }));
}
