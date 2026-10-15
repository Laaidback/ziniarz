import { useState } from 'react';
import type { PrintSettings } from '../../model/types';
import { clampPrinterMargin, MAX_PRINTER_MARGIN } from '../printerMargin';

interface Props {
  settings: PrintSettings;
  onChange(patch: Partial<PrintSettings>): void;
}

const format = (mm: number) => String(mm);

export function PrintOptions({ settings, onChange }: Props) {
  // Kept as typed while the field has focus; only valid numbers are reported.
  const [marginDraft, setMarginDraft] = useState<string | null>(null);
  return (
    <section className="panel">
      <h2>Ustawienia druku</h2>
      <label className="field">
        <span>Margines drukarki</span>
        <span className="field-input">
          <input
            type="number"
            aria-label="Margines drukarki"
            min={0}
            max={MAX_PRINTER_MARGIN}
            step={0.5}
            value={marginDraft ?? format(settings.printerMargin)}
            onChange={(event) => {
              setMarginDraft(event.target.value);
              const value = Number(event.target.value);
              if (event.target.value !== '' && Number.isFinite(value)) onChange({ printerMargin: clampPrinterMargin(value) });
            }}
            onBlur={() => setMarginDraft(null)}
          />
          <span className="muted">mm</span>
        </span>
        <span className="muted">Pas przy krawędzi kartki, na którym drukarka nie drukuje. Zapamiętany w tej przeglądarce.</span>
      </label>
      <Toggle label="Spady" checked={settings.bleed} onChange={(bleed) => onChange({ bleed })} />
      <Toggle label="Linie cięcia" checked={settings.cropMarks} onChange={(cropMarks) => onChange({ cropMarks })} />
      <Toggle label="Linia zgięcia" checked={settings.foldMarks} onChange={(foldMarks) => onChange({ foldMarks })} />
      <Toggle
        label="Obróć tyły o 180°"
        hint="Dla drukarek, które odwracają kartkę tylko po dłuższej krawędzi."
        checked={settings.rotateBacks}
        onChange={(rotateBacks) => onChange({ rotateBacks })}
      />
      <fieldset className="panel-group">
        <legend>Druk dwustronny</legend>
        <label className="toggle">
          <input type="radio" name="duplex" checked={settings.duplex === 'auto'} onChange={() => onChange({ duplex: 'auto' })} />
          automatycznie (jeden PDF)
        </label>
        <label className="toggle">
          <input
            type="radio"
            name="duplex"
            checked={settings.duplex === 'manual'}
            onChange={() => onChange({ duplex: 'manual' })}
          />
          ręcznie (osobno przody i tyły)
        </label>
        {settings.duplex === 'manual' && (
          <Toggle
            label="Tyły w odwrotnej kolejności"
            hint="Zależy od tego, jak drukarka odkłada kartki. Sprawdzisz to na stronie próbnej."
            checked={settings.manualReverseBacks}
            onChange={(manualReverseBacks) => onChange({ manualReverseBacks })}
          />
        )}
      </fieldset>
    </section>
  );
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange(value: boolean): void }) {
  return (
    <div className="panel-group">
      <label className="toggle">
        <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
        {label}
      </label>
      {hint && <span className="muted">{hint}</span>}
    </div>
  );
}
