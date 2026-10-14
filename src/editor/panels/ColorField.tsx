import { useEffect, useState } from 'react';
import { normalizeHex, swatches } from '../colors';
import { useEditor, useEditorEnv } from '../EditorContext';
import { selectZine } from '../state/store';

const FULL_HEX = /^#?[0-9a-f]{6}$/i;

interface Props {
  label: string;
  value: string;
  onChange(color: string): void;
}

/**
 * Colour picker, HEX field and swatches of the colours already used in the zine. Blur, Enter or a swatch ends the undo step.
 * While typing, only a full 6-digit HEX changes the colour; 3-digit shorthand ("#f00") counts on Enter or blur.
 */
export function ColorField({ label, value, onChange }: Props) {
  const { store } = useEditorEnv();
  const endMerge = () => store.getState().endMerge();
  const zine = useEditor(selectZine);
  const [draft, setDraft] = useState(value);
  // Follow outside changes (undo, swatches), but keep what is being typed when it already means this colour.
  useEffect(() => setDraft((d) => (normalizeHex(d) === value ? d : value)), [value]);
  const commitDraft = () => {
    const hex = normalizeHex(draft);
    if (hex && hex !== value) onChange(hex);
    setDraft(hex ?? value);
    endMerge();
  };
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
            if (hex && FULL_HEX.test(event.target.value.trim())) onChange(hex);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commitDraft();
          }}
          onBlur={commitDraft}
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
