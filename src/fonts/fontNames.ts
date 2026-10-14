export interface FontStyleName {
  family: string;
  bold: boolean;
  italic: boolean;
}

export interface FontDescription extends FontStyleName {
  mime: string;
}

const MIME: Record<string, string> = { ttf: 'font/ttf', otf: 'font/otf', woff2: 'font/woff2' };
const SFNT_VERSIONS = [0x00010000, 0x4f54544f /* OTTO */, 0x74727565 /* true */];

function utf16be(view: DataView, start: number, length: number): string {
  let text = '';
  for (let i = 0; i + 1 < length; i += 2) text += String.fromCharCode(view.getUint16(start + i));
  return text;
}

function latin1(view: DataView, start: number, length: number): string {
  let text = '';
  for (let i = 0; i < length; i++) text += String.fromCharCode(view.getUint8(start + i));
  return text;
}

/** Strings of the `name` table by nameID, preferring Windows English, then other Unicode, then Mac Roman. */
function readNameTable(view: DataView, offset: number): Map<number, string> {
  const count = view.getUint16(offset + 2);
  const stringBase = offset + view.getUint16(offset + 4);
  const best = new Map<number, { score: number; value: string }>();
  for (let i = 0; i < count; i++) {
    const record = offset + 6 + i * 12;
    const platform = view.getUint16(record);
    const encoding = view.getUint16(record + 2);
    const language = view.getUint16(record + 4);
    const nameId = view.getUint16(record + 6);
    const length = view.getUint16(record + 8);
    const start = stringBase + view.getUint16(record + 10);
    let entry: { score: number; value: string };
    if (platform === 3 && (encoding === 1 || encoding === 10)) {
      entry = { score: language === 0x409 ? 3 : 2, value: utf16be(view, start, length) };
    } else if (platform === 0) {
      entry = { score: 1, value: utf16be(view, start, length) };
    } else if (platform === 1 && encoding === 0) {
      entry = { score: 0, value: latin1(view, start, length) };
    } else {
      continue;
    }
    const previous = best.get(nameId);
    if (!previous || entry.score > previous.score) best.set(nameId, entry);
  }
  return new Map([...best].map(([id, entry]) => [id, entry.value]));
}

/**
 * Family and style of a TrueType/OpenType file. Uses the legacy family name (nameID 1) and the
 * OS/2 bold/italic bits, which are exactly the "regular, bold, italic, bold italic" grouping a
 * zine font family needs ("Lato Light" stays its own family). Returns null for anything else.
 */
export function readSfntNames(data: ArrayBuffer): FontStyleName | null {
  try {
    const view = new DataView(data);
    if (!SFNT_VERSIONS.includes(view.getUint32(0))) return null;
    const tables = new Map<string, number>();
    const count = view.getUint16(4);
    for (let i = 0; i < count; i++) {
      const record = 12 + i * 16;
      const tag = String.fromCharCode(
        view.getUint8(record),
        view.getUint8(record + 1),
        view.getUint8(record + 2),
        view.getUint8(record + 3),
      );
      tables.set(tag, view.getUint32(record + 8));
    }
    const nameOffset = tables.get('name');
    if (nameOffset === undefined) return null;
    const names = readNameTable(view, nameOffset);
    const family = (names.get(1) ?? names.get(16) ?? '').trim();
    if (!family) return null;
    const os2 = tables.get('OS/2');
    if (os2 !== undefined) {
      const fsSelection = view.getUint16(os2 + 62);
      return { family, bold: (fsSelection & 0x20) !== 0, italic: (fsSelection & 0x01) !== 0 };
    }
    const subfamily = (names.get(2) ?? '').toLowerCase();
    return { family, bold: subfamily.includes('bold'), italic: /italic|oblique/.test(subfamily) };
  } catch {
    return null; // truncated or corrupt file
  }
}

const WEIGHT_WORDS = /^(semi|demi|extra|ultra|black|heavy|light|thin|medium|bold)+$/i;
const PLAIN_STYLES = new Set(['', 'regular', 'normal', 'book', 'roman', 'bold']);

function prettyFamily(raw: string): string {
  const spaced = raw.replace(/[-_]+/g, ' ').trim();
  return (spaced.includes(' ') ? spaced : spaced.replace(/([a-z])([A-Z])/g, '$1 $2')) || 'Font';
}

/**
 * Fallback for WOFF2 (compressed tables): "Lato-BoldItalic.woff2" → Lato, bold, italic. Only regular,
 * bold and italic are styles; any other weight word ("Light", "SemiBold") stays in the family name
 * ("Lato Light"), like nameID 1 does for TTF/OTF, so a full set of weights never overwrites Regular/Bold.
 */
export function styleFromFileName(fileName: string): FontStyleName {
  const base = fileName.replace(/\.[^.]+$/, '');
  const cut = Math.max(base.lastIndexOf('-'), base.lastIndexOf('_'));
  const suffix = cut > 0 ? base.slice(cut + 1) : '';
  const italic = /italic|oblique/i.test(suffix);
  const weight = suffix.replace(/italic|oblique/gi, '');
  const plain = PLAIN_STYLES.has(weight.toLowerCase());
  if (suffix && (plain || WEIGHT_WORDS.test(weight))) {
    const family = prettyFamily(base.slice(0, cut));
    return plain
      ? { family, bold: weight.toLowerCase() === 'bold', italic }
      : { family: `${family} ${weight[0].toUpperCase()}${weight.slice(1)}`, bold: false, italic };
  }
  return { family: prettyFamily(base), bold: false, italic: false };
}

export function fontMime(fileName: string): string | null {
  const dot = fileName.lastIndexOf('.');
  return dot > 0 ? (MIME[fileName.slice(dot + 1).toLowerCase()] ?? null) : null;
}

/** Family and style of an uploaded font file, or null when it is not .ttf, .otf or .woff2. */
export function describeFontFile(fileName: string, data: ArrayBuffer): FontDescription | null {
  const mime = fontMime(fileName);
  if (!mime) return null;
  const fromTables = mime === 'font/woff2' ? null : readSfntNames(data);
  return { ...(fromTables ?? styleFromFileName(fileName)), mime };
}

/** Groups items by family name, ignoring case, in order of first appearance. */
export function groupByFamily<T extends { description: FontStyleName }>(items: T[]): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = item.description.family.toLowerCase();
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return groups;
}
