import { createStore } from 'zustand/vanilla';
import type { ConflictChoice } from './cloudSync';
import type { LastChange } from './sync';

export interface ConflictRequest {
  title: string;
  change: LastChange;
  answer(choice: ConflictChoice | null): void;
}

export const conflictStore = createStore<{ request: ConflictRequest | null }>()(() => ({ request: null }));

/** Asks which version of a zine to keep (ConflictHost); null means "not now". A new question cancels an open one. */
export function askConflict(title: string, change: LastChange): Promise<ConflictChoice | null> {
  conflictStore.getState().request?.answer(null);
  return new Promise((resolve) => {
    const request: ConflictRequest = {
      title,
      change,
      answer: (choice) => {
        if (conflictStore.getState().request === request) conflictStore.setState({ request: null });
        resolve(choice);
      },
    };
    conflictStore.setState({ request });
  });
}
