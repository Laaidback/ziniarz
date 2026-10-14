import { useEffect } from 'react';
import { applyKeyCommand, isTypingTarget, keyCommand } from './keyboard';
import type { EditorStore } from './state/store';

/** Editor shortcuts on the whole window, except while typing in a field or in a text frame. */
export function useEditorKeyboard(store: EditorStore): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target) || store.getState().mode === 'text') return;
      const command = keyCommand(event);
      if (command && applyKeyCommand(store, command)) event.preventDefault();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [store]);
}
