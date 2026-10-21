import { useEditor, useEditorEnv } from '../EditorContext';
import { canMoveLayer, type LayerOp } from '../state/layers';
import { selectedElement } from '../state/store';

const OPS: [LayerOp, string][] = [
  ['front', 'Na wierzch'],
  ['forward', 'Wyżej'],
  ['backward', 'Niżej'],
  ['back', 'Na spód'],
];

export function LayerButtons() {
  const { store } = useEditorEnv();
  const elements = useEditor((s) => s.history.present.spreads[s.spread].elements);
  const id = useEditor((s) => s.selectedId);
  const locked = useEditor((s) => selectedElement(s)?.locked ?? false);
  if (!id) return null;
  return (
    <div className="panel-group">
      <h3>Warstwa</h3>
      <div className="row">
        {OPS.map(([op, label]) => (
          <button key={op} type="button" disabled={!canMoveLayer(elements, id, op)} onClick={() => store.getState().moveSelectedLayer(op)}>
            {label}
          </button>
        ))}
      </div>
      <div className="row">
        <button type="button" onClick={() => store.getState().duplicateSelected()}>
          Powiel
        </button>
        <button
          type="button"
          className="danger"
          disabled={locked}
          title={locked ? 'Odblokuj, żeby usunąć' : undefined}
          onClick={() => store.getState().deleteSelected()}
        >
          Usuń
        </button>
      </div>
    </div>
  );
}
