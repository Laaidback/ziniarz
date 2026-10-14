import { createContext, useContext } from 'react';
import { useStore } from 'zustand';
import type { FontChoice } from '../fonts/fontChoices';
import type { RenderAssets } from '../render/assets';
import type { ZiniarzDb } from '../storage/db';
import type { EditorState, EditorStore } from './state/store';

/** The open zine's editor: store, database, loaded photos and the fonts the text panel offers. */
export interface EditorEnv {
  zineId: string;
  db: ZiniarzDb;
  store: EditorStore;
  assets: RenderAssets;
  fonts: FontChoice[];
  setFonts(fonts: FontChoice[]): void;
}

export const EditorContext = createContext<EditorEnv | null>(null);

export function useEditorEnv(): EditorEnv {
  const env = useContext(EditorContext);
  if (!env) throw new Error('EditorContext is missing');
  return env;
}

/** Subscribes to one value of the editor store. Selectors must return stable values (no new objects). */
export function useEditor<T>(selector: (state: EditorState) => T): T {
  return useStore(useEditorEnv().store, selector);
}
