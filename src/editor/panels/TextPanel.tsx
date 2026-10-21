import { canToggle } from '../../fonts/fontChoices';
import type { TextAlign, TextElement } from '../../model/types';
import { useEditorEnv } from '../EditorContext';
import type { ElementPatch } from '../state/commands';
import { ColorField } from './ColorField';
import { FontField } from './FontField';
import { LayerButtons } from './LayerButtons';
import { NumberField } from './NumberField';

const ALIGNS: [TextAlign, string][] = [
  ['left', 'Do lewej'],
  ['center', 'Do środka'],
  ['right', 'Do prawej'],
  ['justify', 'Wyjustuj'],
];

const LINE_YS = [3, 6.5, 10, 13.5];
const FULL = 14;
const SHORT = 9;

/** Four lines: long and short alternating, the short ones placed by the alignment (all long for justify). */
function AlignIcon({ align }: { align: TextAlign }) {
  return (
    <svg className="align-icon" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      {LINE_YS.map((y, i) => {
        const length = align === 'justify' || i % 2 === 0 ? FULL : SHORT;
        const x1 = align === 'left' || align === 'justify' ? 1 : align === 'right' ? 15 - length : 8 - length / 2;
        return <line key={y} x1={x1} x2={x1 + length} y1={y} y2={y} />;
      })}
    </svg>
  );
}

export function TextPanel({ element }: { element: TextElement }) {
  const { store, fonts } = useEditorEnv();
  const update = (patch: ElementPatch, key?: string) => store.getState().updateElement(element.id, patch, key);
  const family = fonts.find((font) => font.id === element.fontFamilyId);
  const key = (field: string) => `${field}:${element.id}`;

  return (
    <section className="panel">
      <h2>Napis</h2>
      <button type="button" onClick={() => store.getState().setMode('text')}>
        Edytuj tekst
      </button>
      <FontField element={element} />
      <NumberField label="Rozmiar" unit="pt" value={element.size} min={4} max={400} onChange={(size) => update({ size }, key('size'))} />
      <div className="row">
        <button
          type="button"
          aria-pressed={element.bold}
          disabled={!family || !canToggle(family, element, 'bold')}
          onClick={() => update({ bold: !element.bold })}
        >
          Pogrubienie
        </button>
        <button
          type="button"
          aria-pressed={element.italic}
          disabled={!family || !canToggle(family, element, 'italic')}
          onClick={() => update({ italic: !element.italic })}
        >
          Kursywa
        </button>
      </div>
      <NumberField
        label="Kerning"
        unit="‰ em"
        value={element.letterSpacing}
        min={-200}
        max={1000}
        step={10}
        onChange={(letterSpacing) => update({ letterSpacing }, key('letterSpacing'))}
      />
      <NumberField
        label="Interlinia"
        unit="×"
        value={element.lineHeight}
        min={0.5}
        max={4}
        step={0.05}
        onChange={(lineHeight) => update({ lineHeight }, key('lineHeight'))}
      />
      <ColorField label="Kolor tekstu" value={element.color} onChange={(color) => update({ color }, key('color'))} />
      <div className="align-buttons" role="group" aria-label="Wyrównanie">
        {ALIGNS.map(([align, label]) => (
          <button key={align} type="button" aria-pressed={element.align === align} onClick={() => update({ align })}>
            <AlignIcon align={align} />
            {label}
          </button>
        ))}
      </div>
      <NumberField label="Obrót" unit="°" value={element.rotation} min={-360} max={360} onChange={(rotation) => update({ rotation }, key('rotation'))} />
      <LayerButtons />
    </section>
  );
}
