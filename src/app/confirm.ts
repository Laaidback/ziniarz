import { createStore } from 'zustand/vanilla';

export interface ConfirmRequest {
  message: string;
  confirmLabel: string;
  answer(ok: boolean): void;
}

export const confirmStore = createStore<{ request: ConfirmRequest | null }>()(() => ({ request: null }));

/** Asks a yes/no question in a dialog (ConfirmHost). A new question cancels an open one. */
export function askConfirm(message: string, confirmLabel = 'Usuń'): Promise<boolean> {
  confirmStore.getState().request?.answer(false);
  return new Promise((resolve) => {
    const request: ConfirmRequest = {
      message,
      confirmLabel,
      answer: (ok) => {
        if (confirmStore.getState().request === request) confirmStore.setState({ request: null });
        resolve(ok);
      },
    };
    confirmStore.setState({ request });
  });
}
