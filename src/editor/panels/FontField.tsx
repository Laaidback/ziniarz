import { fitStyle } from '../../fonts/fontChoices';
import { cssFontFamily } from '../../fonts/fontLoader';
import type { TextElement } from '../../model/types';
import { useEditor, useEditorEnv } from '../EditorContext';
import { selectZine } from '../state/store';

/** Font family of a text: built-in fonts and the zine's own. Switching keeps bold/italic only when the family has them. */
export function FontField({ element }: { element: TextElement }) {
  const { store, fonts } = useEditorEnv();
  const zine = useEditor(selectZine);
  const offered = fonts.filter((font) => font.builtin || zine.fonts.includes(font.id));
  const missing = !offered.some((font) => font.id === element.fontFamilyId);

  const choose = (id: string) => {
    const choice = offered.find((font) => font.id === id);
    if (choice) store.getState().updateElement(element.id, { fontFamilyId: id, ...fitStyle(choice, element.bold, element.italic) });
  };

  return (
    <div className="font-field">
      <label className="field">
        <span>Font</span>
        <select aria-label="Font" value={element.fontFamilyId} onChange={(event) => choose(event.target.value)}>
          {offered.map((font) => (
            <option key={font.id} value={font.id} style={{ fontFamily: `${cssFontFamily(font.id)}, sans-serif` }}>
              {font.name}
            </option>
          ))}
          {missing && <option value={element.fontFamilyId}>Brakujący font</option>}
        </select>
      </label>
    </div>
  );
}
