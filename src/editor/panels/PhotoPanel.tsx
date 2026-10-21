import type { PhotoElement } from '../../model/types';
import { useEditor, useEditorEnv } from '../EditorContext';
import type { ElementPatch } from '../state/commands';
import { MAX_CROP_ZOOM } from '../state/store';
import { LayerButtons } from './LayerButtons';
import { NumberField } from './NumberField';

export function PhotoPanel({ element }: { element: PhotoElement }) {
  const { store } = useEditorEnv();
  const mode = useEditor((s) => s.mode);
  const update = (patch: ElementPatch, key?: string) => store.getState().updateElement(element.id, patch, key);
  const endMerge = () => store.getState().endMerge();
  const transparency = Math.round((1 - element.opacity) * 100);

  return (
    <section className="panel">
      <h2>Zdjęcie</h2>
      <button type="button" aria-pressed={mode === 'crop'} onClick={() => store.getState().setMode(mode === 'crop' ? 'idle' : 'crop')}>
        Kadruj
      </button>
      {mode === 'crop' && (
        <p className="muted">Przeciągnij zdjęcie w ramce, kółkiem myszy przybliż. Enter albo klik obok kończy.</p>
      )}
      <label className="field">
        <span>Przybliżenie</span>
        <input
          type="range"
          aria-label="Przybliżenie"
          min={1}
          max={MAX_CROP_ZOOM}
          step={0.01}
          value={element.crop.zoom}
          onChange={(event) => update({ crop: { ...element.crop, zoom: Number(event.target.value) } }, `zoom:${element.id}`)}
          onPointerUp={endMerge}
          onBlur={endMerge}
        />
      </label>
      <label className="toggle">
        <input type="checkbox" checked={element.flipX} onChange={(event) => update({ flipX: event.target.checked })} />
        Odbij w poziomie
      </label>
      <label className="field">
        <span>Przezroczystość {transparency}%</span>
        <input
          type="range"
          aria-label="Przezroczystość"
          min={0}
          max={100}
          step={1}
          value={transparency}
          onChange={(event) => update({ opacity: 1 - Number(event.target.value) / 100 }, `opacity:${element.id}`)}
          onPointerUp={endMerge}
          onBlur={endMerge}
        />
      </label>
      <NumberField
        label="Obrót"
        unit="°"
        value={element.rotation}
        min={-360}
        max={360}
        disabled={element.locked}
        onChange={(rotation) => update({ rotation }, `rotation:${element.id}`)}
      />
      <LayerButtons />
    </section>
  );
}
