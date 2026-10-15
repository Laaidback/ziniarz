import type { Margins } from '../../model/types';
import { useEditor, useEditorEnv } from '../EditorContext';
import { setMargins, setTitle } from '../state/commands';
import { NumberField } from './NumberField';

const MARGINS: [keyof Margins, string][] = [
  ['outer', 'Zewnętrzny'],
  ['inner', 'Wewnętrzny (przy grzbiecie)'],
  ['top', 'Górny'],
  ['bottom', 'Dolny'],
];

export function ZinePanel() {
  const { store } = useEditorEnv();
  const title = useEditor((s) => s.history.present.title);
  const margins = useEditor((s) => s.history.present.margins);
  return (
    <section className="panel">
      <h2>Zin</h2>
      <label className="field">
        <span>Tytuł</span>
        <input
          aria-label="Tytuł"
          value={title}
          onChange={(event) => store.getState().edit((z) => setTitle(z, event.target.value), 'title')}
          onKeyDown={(event) => {
            if (event.key === 'Enter') store.getState().endMerge();
          }}
          onBlur={() => store.getState().endMerge()}
        />
      </label>
      <h3>Marginesy</h3>
      {MARGINS.map(([side, label]) => (
        <NumberField
          key={side}
          label={label}
          unit="mm"
          value={margins[side]}
          min={0}
          max={45}
          onChange={(value) => store.getState().edit((z) => setMargins(z, { ...z.margins, [side]: value }), `margin:${side}`)}
        />
      ))}
    </section>
  );
}
