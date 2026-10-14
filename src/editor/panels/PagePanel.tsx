import { useEditor, useEditorEnv } from '../EditorContext';
import { setPageBackground } from '../state/commands';
import { ColorField } from './ColorField';

export function PagePanel({ page }: { page: number }) {
  const { store } = useEditorEnv();
  const background = useEditor((s) => s.history.present.pages[page]?.background ?? '#ffffff');
  return (
    <section className="panel">
      <h2>Strona {page}</h2>
      <ColorField
        label="Tło strony"
        value={background}
        onChange={(color) => store.getState().edit((zine) => setPageBackground(zine, page, color), `background:${page}`)}
      />
      <button type="button" onClick={() => store.getState().edit((zine) => setPageBackground(zine, page, null))}>
        Białe tło
      </button>
    </section>
  );
}
