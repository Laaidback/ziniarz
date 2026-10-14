import { useState } from 'react';
import { useEditorEnv } from '../EditorContext';

interface Props {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange(value: number): void;
}

const format = (value: number) => String(Math.round(value * 100) / 100);

/**
 * Number input that only reports valid values in [min, max]; what is typed stays until the field loses focus.
 * Blur or Enter ends the undo step.
 */
export function NumberField({ label, value, min, max, step = 1, unit, onChange }: Props) {
  const { store } = useEditorEnv();
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <label className="field">
      <span>{label}</span>
      <span className="field-input">
        <input
          type="number"
          aria-label={label}
          value={draft ?? format(value)}
          min={min}
          max={max}
          step={step}
          onChange={(event) => {
            setDraft(event.target.value);
            const number = Number(event.target.value);
            if (event.target.value !== '' && Number.isFinite(number) && number >= min && number <= max) onChange(number);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') store.getState().endMerge();
          }}
          onBlur={() => {
            setDraft(null);
            store.getState().endMerge();
          }}
        />
        {unit && <span className="muted">{unit}</span>}
      </span>
    </label>
  );
}
