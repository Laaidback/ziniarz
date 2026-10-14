import { useEffect } from 'react';
import { applyKeyCommand, fieldOwnsKey, keyCommand } from './keyboard';
import type { EditorStore } from './state/store';

/** Editor shortcuts on the whole window, except keys a focused field handles (typing, slider arrows) and while typing in a text frame. */
export function useEditorKeyboard(store: EditorStore): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (fieldOwnsKey(event.target, event.key) || store.getState().mode === 'text') return;
      const command = keyCommand(event);
      if (command && applyKeyCommand(store, command)) event.preventDefault();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [store]);
}
