import { DEFAULT_FONT_FAMILY } from '../model/factory';

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
  /** A font installed on the computer, used through local() and never bundled (see SYSTEM_FONTS). */
  system?: boolean;
}

/** A font the app takes from the user's computer instead of shipping it (its license forbids redistribution). */
export interface SystemFont {
  id: string;
  /** Name in the font list when the computer has the font. */
  name: string;
  /** Name in the font list when a text uses the font but this computer does not have it. */
  missingName: string;
  /** Names for CSS local(), tried in order. */
  localNames: string[];
  styles: FontStyleKey[];
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

/** Default family of new texts when no preferred system font is installed; also the default when parsing old data. */
export const FALLBACK_FONT_FAMILY = DEFAULT_FONT_FAMILY;

/**
 * Fonts shipped with macOS. Never bundle or copy their files into the repo or the site: only local().
 * Regular only, so the bold and italic toggles stay disabled.
 */
export const SYSTEM_FONTS: SystemFont[] = [
  {
    id: 'ayuthaya',
    name: 'Ayuthaya (z macOS)',
    missingName: 'Ayuthaya (brak na tym komputerze)',
    localNames: ['Ayuthaya', 'Ayuthaya Regular'],
    styles: ['regular'],
  },
];

/** The system font new texts use when the computer has it. */
export const PREFERRED_FONT_FAMILY = 'ayuthaya';

export function systemFont(id: string): SystemFont | undefined {
  return SYSTEM_FONTS.find((font) => font.id === id);
}

/** Font of new text frames: the preferred system font when installed, otherwise Inter. */
export function pickDefaultFontFamily(availableSystemFonts: ReadonlySet<string>): string {
  return availableSystemFonts.has(PREFERRED_FONT_FAMILY) ? PREFERRED_FONT_FAMILY : FALLBACK_FONT_FAMILY;
}

/** Built-in choices for the font list: installed system fonts first, then the bundled ones. */
export function builtinFontChoices(availableSystemFonts: ReadonlySet<string>): FontChoice[] {
  const system = SYSTEM_FONTS.filter((font) => availableSystemFonts.has(font.id)).map(
    (font): FontChoice => ({ id: font.id, name: font.name, styles: font.styles, builtin: true, system: true }),
  );
  return [...system, ...BUILTIN_FONTS];
}

/** Label of a font a text uses but the list does not offer (a system font not installed here, or a removed upload). */
export function missingFontName(id: string): string {
  return systemFont(id)?.missingName ?? 'Brakujący font';
}

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
