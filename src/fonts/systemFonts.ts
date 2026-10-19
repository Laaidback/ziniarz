import { pickDefaultFontFamily, SYSTEM_FONTS, type SystemFont } from './fontChoices';

/**
 * Fonts taken from the user's computer through CSS local() (SYSTEM_FONTS): no files are bundled,
 * so whether a font exists is only known after asking the browser. detectSystemFonts() asks once
 * per page load and registers each found font as `zf-<id>`; the rest of the app reads the result.
 */

/** Registered FontFace of each system font found on this computer. */
const found = new Map<string, FontFace>();
const overrides = new Map<string, boolean>();
let detection: Promise<void> | null = null;

/** How long one local() lookup may take before the font counts as missing. */
const LOAD_TIMEOUT_MS = 3000;
const PROBE_TEXT = 'Zażółć gęślą jaźń WWmmiill 0123';

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
}

/** True when text in the family measures differently from both generic fallbacks, i.e. the font really draws. */
function drawsOwnGlyphs(family: string): boolean {
  const context = document.createElement('canvas').getContext('2d');
  if (!context) return true; // nothing to compare with: trust FontFace.load()
  const width = (font: string) => {
    context.font = font;
    return context.measureText(PROBE_TEXT).width;
  };
  return ['monospace', 'serif'].some((generic) => width(`40px "${family}", ${generic}`) !== width(`40px ${generic}`));
}

async function detectOne(font: SystemFont): Promise<FontFace | null> {
  const family = `zf-${font.id}`; // cssFontFamily (fontLoader.ts imports this module, so no import back)
  const source = font.localNames.map((name) => `local('${name}')`).join(', ');
  const face = new FontFace(family, source, { weight: '400', style: 'normal' });
  try {
    await withTimeout(face.load(), LOAD_TIMEOUT_MS);
  } catch {
    return null; // not installed: load() rejects and the face status is 'error'
  }
  if (face.status !== 'loaded') return null;
  document.fonts.add(face);
  const draws = drawsOwnGlyphs(family);
  if (!draws || overrides.get(font.id) === false) document.fonts.delete(face);
  return draws ? face : null;
}

/**
 * Looks for the system fonts once per page load (later calls return the same promise). Never
 * rejects: a font that cannot be found just stays unavailable.
 */
export function detectSystemFonts(): Promise<void> {
  if (detection) return detection;
  detection = (async () => {
    if (typeof FontFace === 'undefined' || typeof document === 'undefined') return;
    for (const font of SYSTEM_FONTS) {
      try {
        const face = await detectOne(font);
        if (face) found.set(font.id, face);
      } catch {
        // A browser that throws on local() simply has no system fonts here.
      }
    }
  })();
  return detection;
}

export function isSystemFontAvailable(id: string): boolean {
  return overrides.get(id) ?? found.has(id);
}

/** True when the font was really found and registered (ignores test overrides): its text needs no fallback files. */
export function isSystemFontRegistered(id: string): boolean {
  return found.has(id) && overrides.get(id) !== false;
}

/** Ids of the system fonts found on this computer (empty until detectSystemFonts() finishes). */
export function availableSystemFonts(): ReadonlySet<string> {
  return new Set(SYSTEM_FONTS.map((font) => font.id).filter(isSystemFontAvailable));
}

/** Font of a new text frame: Ayuthaya when this computer has it, otherwise Inter. */
export function defaultFontFamilyId(): string {
  return pickDefaultFontFamily(availableSystemFonts());
}

/**
 * For tests: pretend a system font is (or is not) installed; null goes back to what detection found.
 * false also takes a found font out of document.fonts, so texts draw in the fallback as on a computer
 * without it; true only changes the font list and the default (it cannot add glyphs that are not there).
 */
export function setSystemFontAvailability(id: string, available: boolean | null): void {
  if (available === null) overrides.delete(id);
  else overrides.set(id, available);
  const face = found.get(id);
  if (!face) return;
  if (available === false) document.fonts.delete(face);
  else if (!document.fonts.has(face)) document.fonts.add(face);
}
