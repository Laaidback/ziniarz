import type { Spread, TextElement, Zine, ZineElement } from '../model/types';
import { fontFilesOfFamily, type FontFile, type ZiniarzDb } from '../storage/db';
import { BUILTIN_FONT_FILES, LATIN_EXT_RANGE, LATIN_RANGE } from './builtinFontFiles';

export class FontImportError extends Error {
  constructor() {
    super('Ten plik nie jest fontem.');
    this.name = 'FontImportError';
  }
}

const registered = new Set<string>();

export function cssFontFamily(familyId: string): string {
  return `zf-${familyId}`;
}

/** Konva quotes nothing here because ids have no spaces; unknown families fall back to sans-serif. */
export function konvaFontFamily(familyId: string): string {
  return `${cssFontFamily(familyId)}, sans-serif`;
}

export function konvaFontStyle(style: Pick<TextElement, 'bold' | 'italic'>): string {
  return [style.italic ? 'italic' : '', style.bold ? 'bold' : ''].filter(Boolean).join(' ') || 'normal';
}

export async function registerFontFile(file: FontFile): Promise<void> {
  if (registered.has(file.id)) return;
  const face = new FontFace(cssFontFamily(file.familyId), file.data, {
    weight: file.bold ? '700' : '400',
    style: file.italic ? 'italic' : 'normal',
  });
  try {
    await face.load();
  } catch {
    throw new FontImportError();
  }
  document.fonts.add(face);
  registered.add(file.id);
}

let builtinsRegistered = false;

/**
 * Adds the bundled fonts to document.fonts. Nothing is downloaded yet: the browser
 * fetches a file when a text needs it (see loadTextFonts).
 */
export function registerBuiltinFonts(): void {
  if (builtinsRegistered) return;
  builtinsRegistered = true;
  for (const file of BUILTIN_FONT_FILES) {
    const descriptors = { weight: file.bold ? '700' : '400', style: file.italic ? 'italic' : 'normal' };
    for (const [url, unicodeRange] of [
      [file.latin, LATIN_RANGE],
      [file.latinExt, LATIN_EXT_RANGE],
    ]) {
      document.fonts.add(
        new FontFace(cssFontFamily(file.familyId), `url(${url}) format('woff2')`, { ...descriptors, unicodeRange }),
      );
    }
  }
}

/** Loads the font files the given texts need. The text matters: Polish letters live in the latin-ext files. */
async function loadTextFonts(elements: Iterable<ZineElement>): Promise<void> {
  registerBuiltinFonts();
  const requests = new Map<string, Set<string>>();
  for (const e of elements) {
    if (e.kind !== 'text') continue;
    const spec = `${e.italic ? 'italic ' : ''}${e.bold ? 'bold ' : ''}16px "${cssFontFamily(e.fontFamilyId)}"`;
    const chars = requests.get(spec) ?? new Set<string>();
    for (const char of e.text) chars.add(char);
    requests.set(spec, chars);
  }
  await Promise.all([...requests].map(([spec, chars]) => document.fonts.load(spec, [...chars].join('') || ' ')));
}

/** Waits until every font style used by the zine's texts is loaded (missing ones resolve empty). */
export async function ensureFontsReady(zine: Zine): Promise<void> {
  await loadTextFonts(zine.spreads.flatMap((s) => s.elements));
}

/** Same as ensureFontsReady for one spread (the editor calls it when a spread changes). */
export async function loadSpreadFonts(spread: Spread): Promise<void> {
  await loadTextFonts(spread.elements);
}

/** Registers every file of the zine's custom font families from the database, skipping corrupt files. Call before rendering. */
export async function registerZineFonts(db: ZiniarzDb, zine: Zine): Promise<void> {
  for (const familyId of zine.fonts) {
    for (const file of await fontFilesOfFamily(db, familyId)) {
      try {
        await registerFontFile(file);
      } catch {
        // One corrupt stored font file must not stop the others (or the zine) from loading.
      }
    }
  }
}
