export type FontStyleKey = 'regular' | 'bold' | 'italic' | 'boldItalic';

export interface FontStyleFlags {
  bold: boolean;
  italic: boolean;
}

/** A font family the text panel can offer: built-in (bundled OFL fonts) or uploaded to the zine. */
export interface FontChoice {
  id: string;
  name: string;
  /** Styles the family has files for, in the order of STYLE_ORDER. */
  styles: FontStyleKey[];
  builtin: boolean;
}

const STYLE_ORDER: FontStyleKey[] = ['regular', 'bold', 'italic', 'boldItalic'];
const UPRIGHT: FontStyleKey[] = ['regular', 'bold'];

/** Bundled fonts (SIL Open Font License, all with Polish letters). The id is also the fontFamilyId of texts. */
export const BUILTIN_FONTS: FontChoice[] = [
  { id: 'inter', name: 'Inter', styles: STYLE_ORDER, builtin: true },
  { id: 'lora', name: 'Lora', styles: STYLE_ORDER, builtin: true },
  { id: 'playfair-display', name: 'Playfair Display', styles: STYLE_ORDER, builtin: true },
  { id: 'eb-garamond', name: 'EB Garamond', styles: STYLE_ORDER, builtin: true },
  { id: 'space-mono', name: 'Space Mono', styles: STYLE_ORDER, builtin: true },
  { id: 'oswald', name: 'Oswald', styles: UPRIGHT, builtin: true },
  { id: 'caveat', name: 'Caveat', styles: UPRIGHT, builtin: true },
  { id: 'archivo-black', name: 'Archivo Black', styles: ['regular'], builtin: true },
];

export function styleKey(bold: boolean, italic: boolean): FontStyleKey {
  if (bold && italic) return 'boldItalic';
  if (bold) return 'bold';
  return italic ? 'italic' : 'regular';
}

function flagsOf(key: FontStyleKey): FontStyleFlags {
  return { bold: key === 'bold' || key === 'boldItalic', italic: key === 'italic' || key === 'boldItalic' };
}

export function hasStyle(choice: FontChoice, bold: boolean, italic: boolean): boolean {
  return choice.styles.includes(styleKey(bold, italic));
}

/** A bold/italic toggle is enabled only when the family has the file the click would switch to. */
export function canToggle(choice: FontChoice, current: FontStyleFlags, which: 'bold' | 'italic'): boolean {
  const next = { ...current, [which]: !current[which] };
  return hasStyle(choice, next.bold, next.italic);
}

/** The closest style the family has: keep it when it exists, else drop italic, then bold. */
export function fitStyle(choice: FontChoice, bold: boolean, italic: boolean): FontStyleFlags {
  const tries: FontStyleFlags[] = [
    { bold, italic },
    { bold, italic: false },
    { bold: false, italic },
    { bold: false, italic: false },
  ];
  return tries.find((s) => hasStyle(choice, s.bold, s.italic)) ?? flagsOf(choice.styles[0] ?? 'regular');
}

export function stylesOfFiles(files: FontStyleFlags[]): FontStyleKey[] {
  const keys = new Set(files.map((f) => styleKey(f.bold, f.italic)));
  return STYLE_ORDER.filter((key) => keys.has(key));
}
