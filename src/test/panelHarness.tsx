import { useState } from 'react';
import { render } from 'vitest-browser-react';
import { DbContext } from '../app/dbContext';
import { NoticeList } from '../app/NoticeList';
import { EditorContext } from '../editor/EditorContext';
import { PropertiesPanel } from '../editor/panels/PropertiesPanel';
import { createEditorStore, selectZine, type EditorStore } from '../editor/state/store';
import { BUILTIN_FONTS, type FontChoice } from '../fonts/fontChoices';
import { newId } from '../model/ids';
import type { Zine } from '../model/types';
import { measureTextHeight } from '../render/buildSpread';
import { openZiniarzDb } from '../storage/db';

/** The properties panel on its own, with a real store and a fresh test database. `fonts` is the font list it starts with. */
export async function renderPanel(zine: Zine, prepare?: (store: EditorStore) => void, initialFonts: FontChoice[] = BUILTIN_FONTS) {
  const db = await openZiniarzDb(`test-${newId()}`);
  const store = createEditorStore(zine, { measureText: measureTextHeight, imageSize: () => ({ width: 100, height: 100 }) });
  prepare?.(store);
  function Host() {
    const [fonts, setFonts] = useState<FontChoice[]>(initialFonts);
    return (
      <DbContext.Provider value={db}>
        <EditorContext.Provider value={{ zineId: zine.id, db, store, assets: { images: new Map() }, fonts, setFonts }}>
          <PropertiesPanel />
          <NoticeList />
        </EditorContext.Provider>
      </DbContext.Provider>
    );
  }
  const screen = render(<Host />);
  return { db, store, screen, zine: () => selectZine(store.getState()) };
}
