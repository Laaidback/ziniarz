import type { Spread, TextElement, Zine, ZineElement } from '../model/types';
import { fontFilesOfFamily, type FontFile, type ZiniarzDb } from '../storage/db';
import { BUILTIN_FONT_FILES, LATIN_EXT_RANGE, LATIN_RANGE } from './builtinFontFiles';
import { FALLBACK_FONT_FAMILY, systemFont } from './fontChoices';
import { detectSystemFonts, isSystemFontRegistered } from './systemFonts';

export class FontImportError extends Error {
  constructor() {
    super('Ten plik nie jest fontem.');
    this.name = 'FontImportError';
  }
}

/** FontFace of each registered uploaded file, so a replaced file can be taken out of document.fonts. */
const registered = new Map<string, FontFace>();

export function cssFontFamily(familyId: string): string {
  return `zf-${familyId}`;
}

/**
 * Konva quotes nothing here because ids have no spaces; unknown families fall back to sans-serif.
 * A system font (Ayuthaya) falls back to Inter first, so a zine opened on a computer without it
 * still looks like the app's own default. Also the CSS font-family of the text editor and font list.
 */
export function konvaFontFamily(familyId: string): string {
  if (systemFont(familyId)) return `${cssFontFamily(familyId)}, ${cssFontFamily(FALLBACK_FONT_FAMILY)}, sans-serif`;
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
  registered.set(file.id, face);
}

/** Removes the FontFace of an uploaded file that was replaced or deleted. Unknown ids are ignored. */
export function unregisterFontFile(fileId: string): void {
  const face = registered.get(fileId);
  if (!face) return;
  document.fonts.delete(face);
  registered.delete(fileId);
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
  await detectSystemFonts();
  const requests = new Map<string, Set<string>>();
  const request = (familyId: string, e: TextElement) => {
    const spec = `${e.italic ? 'italic ' : ''}${e.bold ? 'bold ' : ''}16px "${cssFontFamily(familyId)}"`;
    const chars = requests.get(spec) ?? new Set<string>();
    for (const char of e.text) chars.add(char);
    requests.set(spec, chars);
  };
  for (const e of elements) {
    if (e.kind !== 'text') continue;
    // A system font missing on this computer draws in Inter (konvaFontFamily), so load Inter's files.
    if (systemFont(e.fontFamilyId) && !isSystemFontRegistered(e.fontFamilyId)) request(FALLBACK_FONT_FAMILY, e);
    else request(e.fontFamilyId, e);
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
