import type { TextElement, Zine } from '../model/types';
import { fontFilesOfFamily, type FontFile, type ZiniarzDb } from '../storage/db';

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

/** Waits until every font style used by the zine's texts is loaded (missing ones resolve empty). */
export async function ensureFontsReady(zine: Zine): Promise<void> {
  const specs = new Set<string>();
  for (const spread of zine.spreads) {
    for (const e of spread.elements) {
      if (e.kind !== 'text') continue;
      specs.add(`${e.italic ? 'italic ' : ''}${e.bold ? 'bold ' : ''}16px "${cssFontFamily(e.fontFamilyId)}"`);
    }
  }
  await Promise.all([...specs].map((spec) => document.fonts.load(spec)));
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
