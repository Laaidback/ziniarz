import { useEffect, useState } from 'react';
import { normalizeHex, swatches } from '../colors';
import { useEditor, useEditorEnv } from '../EditorContext';
import { selectZine } from '../state/store';

interface Props {
  label: string;
  value: string;
  onChange(color: string): void;
}

/** Colour picker, HEX field and swatches of the colours already used in the zine. Blur, Enter or a swatch ends the undo step. */
export function ColorField({ label, value, onChange }: Props) {
  const { store } = useEditorEnv();
  const endMerge = () => store.getState().endMerge();
  const zine = useEditor(selectZine);
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <fieldset className="color-field">
      <legend>{label}</legend>
      <div className="row">
        <input
          type="color"
          aria-label={label}
          value={normalizeHex(value) ?? '#000000'}
          onChange={(e) => onChange(e.target.value)}
          onBlur={endMerge}
        />
        <input
          type="text"
          aria-label={`${label} (HEX)`}
          className="hex"
          maxLength={7}
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            const hex = normalizeHex(event.target.value);
            if (hex) onChange(hex);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') endMerge();
          }}
          onBlur={() => {
            setDraft(value);
            endMerge();
          }}
        />
      </div>
      <div className="swatches">
        {swatches(zine).map((color) => (
          <button
            key={color}
            type="button"
            className="swatch"
            style={{ background: color }}
            aria-label={`Kolor ${color}`}
            title={color}
            onClick={() => {
              onChange(color);
              endMerge();
            }}
          />
        ))}
      </div>
    </fieldset>
  );
}
