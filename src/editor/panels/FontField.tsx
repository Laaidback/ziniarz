import { useRef, useState } from 'react';
import { errorMessage, notify } from '../../app/notices';
import { loadFontChoices, otherZineFamilies } from '../../fonts/catalogue';
import { fitStyle, missingFontName, type FontChoice } from '../../fonts/fontChoices';
import { importFontFiles } from '../../fonts/fontImport';
import { konvaFontFamily, registerZineFonts } from '../../fonts/fontLoader';
import type { TextElement, Zine } from '../../model/types';
import { useEditor, useEditorEnv } from '../EditorContext';
import { addFontFamilies, replaceFontFamilies } from '../state/commands';
import { selectZine } from '../state/store';

/**
 * Font family of a text: built-in fonts and the zine's own. Uploading .ttf/.otf/.woff2 adds a family
 * to this zine; "Użyj fontu z innego zina" adds one that another zine uploaded. Switching keeps
 * bold/italic only when the family has them.
 */
export function FontField({ element }: { element: TextElement }) {
  const { db, store, fonts, setFonts } = useEditorEnv();
  const zine = useEditor(selectZine);
  const input = useRef<HTMLInputElement>(null);
  const [others, setOthers] = useState<FontChoice[] | null>(null);
  const offered = fonts.filter((font) => font.builtin || zine.fonts.includes(font.id));
  const missing = !offered.some((font) => font.id === element.fontFamilyId);

  const apply = (choice: FontChoice, key?: string) =>
    store.getState().updateElement(element.id, { fontFamilyId: choice.id, ...fitStyle(choice, element.bold, element.italic) }, key);

  /**
   * Adds families to the zine, swaps borrowed families for this zine's own copies, reloads the font
   * list and applies the first one to this text, all as one undo step.
   */
  const addFamilies = async (familyIds: string[], replaced: Record<string, string> = {}) => {
    const key = `fonts:${element.id}`; // the list change and applying the font merge into one undo step
    store.getState().edit((z) => addFontFamilies(replaceFontFamilies(z, replaced), familyIds), key);
    const updated: Zine = selectZine(store.getState());
    const choices = await loadFontChoices(db, updated);
    setFonts(choices);
    const first = choices.find((font) => font.id === familyIds[0]);
    if (first) apply(first, key);
    store.getState().endMerge();
  };

  const upload = async (files: File[]) => {
    try {
      const result = await importFontFiles(db, zine, files);
      if (result.skipped > 0) notify(`Pominięto plików: ${result.skipped} (to nie są fonty).`);
      if (result.familyIds.length > 0) await addFamilies(result.familyIds, result.replaced);
    } catch (error) {
      notify(errorMessage(error));
    }
  };

  const useOther = async (choice: FontChoice) => {
    try {
      await registerZineFonts(db, { ...zine, fonts: [choice.id] });
      await addFamilies([choice.id]);
      setOthers(null);
    } catch (error) {
      notify(errorMessage(error));
    }
  };

  return (
    <div className="font-field">
      <label className="field">
        <span>Font</span>
        <select
          aria-label="Font"
          value={element.fontFamilyId}
          onChange={(event) => {
            const choice = offered.find((font) => font.id === event.target.value);
            if (choice) apply(choice);
          }}
        >
          {offered.map((font) => (
            <option key={font.id} value={font.id} style={{ fontFamily: konvaFontFamily(font.id) }}>
              {font.name}
            </option>
          ))}
          {missing && <option value={element.fontFamilyId}>{missingFontName(element.fontFamilyId)}</option>}
        </select>
      </label>
      <div className="row">
        <button type="button" onClick={() => input.current?.click()}>
          Wgraj font…
        </button>
        <input
          ref={input}
          type="file"
          accept=".ttf,.otf,.woff2"
          multiple
          hidden
          aria-label="Wybierz pliki fontów"
          onChange={(event) => {
            const files = [...(event.target.files ?? [])];
            event.target.value = '';
            if (files.length) void upload(files);
          }}
        />
        <button
          type="button"
          onClick={() => otherZineFamilies(db, zine).then(setOthers, (error) => notify(errorMessage(error)))}
        >
          Użyj fontu z innego zina
        </button>
      </div>
      {others &&
        (others.length === 0 ? (
          <p className="muted">Inne ziny nie mają własnych fontów.</p>
        ) : (
          <ul className="font-others" aria-label="Fonty z innych zinów">
            {others.map((choice) => (
              <li key={choice.id}>
                <button type="button" onClick={() => void useOther(choice)}>
                  {choice.name}
                </button>
              </li>
            ))}
          </ul>
        ))}
    </div>
  );
}
