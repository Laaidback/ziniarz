import {
  clampSheets,
  createPhotoElement,
  createTextElement,
  DEFAULT_MARGINS,
  DEFAULT_PRINT,
  FORMAT_VERSION,
} from './factory';
import { pageExists, spreadCount } from './geometry';
import { newId } from './ids';
import { A6_FORMAT_VERSION, migrateA5ToA6 } from './migrate';
import type { Frame, PageStyle, Spread, TextAlign, Zine, ZineElement } from './types';

export class ZineFormatError extends Error {
  constructor(
    readonly reason: 'invalid' | 'newer',
    message: string,
  ) {
    super(message);
    this.name = 'ZineFormatError';
  }
}

const invalid = () => new ZineFormatError('invalid', 'Plik zina jest uszkodzony.');

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const str = (v: unknown, fallback: string) => (typeof v === 'string' ? v : fallback);
const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback);
const ALIGNS: TextAlign[] = ['left', 'center', 'right', 'justify'];

function parseFrame(o: Obj): Frame {
  return {
    id: str(o.id, newId()),
    x: num(o.x, 0),
    y: num(o.y, 0),
    width: num(o.width, 50),
    height: num(o.height, 50),
    rotation: num(o.rotation, 0),
  };
}

function parseElement(v: unknown): ZineElement | null {
  if (!isObj(v)) return null;
  if (v.kind === 'photo') {
    if (typeof v.imageId !== 'string') return null;
    const crop = isObj(v.crop) ? v.crop : {};
    return createPhotoElement(v.imageId, {
      ...parseFrame(v),
      crop: {
        offsetX: num(crop.offsetX, 0),
        offsetY: num(crop.offsetY, 0),
        zoom: Math.max(1, num(crop.zoom, 1)),
      },
      flipX: bool(v.flipX, false),
      opacity: Math.min(1, Math.max(0, num(v.opacity, 1))),
    });
  }
  if (v.kind === 'text') {
    const d = createTextElement();
    return createTextElement({
      ...parseFrame(v),
      text: str(v.text, ''),
      fontFamilyId: str(v.fontFamilyId, d.fontFamilyId),
      size: num(v.size, d.size),
      bold: bool(v.bold, d.bold),
      italic: bool(v.italic, d.italic),
      letterSpacing: num(v.letterSpacing, d.letterSpacing),
      lineHeight: num(v.lineHeight, d.lineHeight),
      color: str(v.color, d.color),
      align: ALIGNS.includes(v.align as TextAlign) ? (v.align as TextAlign) : d.align,
    });
  }
  return null;
}

function parseSpread(v: unknown): Spread {
  if (!isObj(v) || !Array.isArray(v.elements)) throw invalid();
  return {
    id: str(v.id, newId()),
    elements: v.elements.map(parseElement).filter((e): e is ZineElement => e !== null),
  };
}

export function parseZine(input: unknown): Zine {
  if (!isObj(input)) throw invalid();
  const version = num(input.formatVersion, 1);
  if (version > FORMAT_VERSION) {
    throw new ZineFormatError('newer', 'Ten zin zapisała nowsza wersja ZINIARZA. Odśwież stronę i spróbuj jeszcze raz.');
  }
  // Format 1 had A5 pages; everything after this line reads A6 mm.
  const data = version < A6_FORMAT_VERSION ? migrateA5ToA6(input) : input;
  if (typeof data.id !== 'string' || typeof data.sheets !== 'number' || !Array.isArray(data.spreads)) {
    throw invalid();
  }
  const sheets = clampSheets(data.sheets);
  if (sheets !== data.sheets || data.spreads.length !== spreadCount(sheets)) throw invalid();

  const margins = isObj(data.margins) ? data.margins : {};
  const print = isObj(data.print) ? data.print : {};
  const pages: Record<number, PageStyle> = {};
  if (isObj(data.pages)) {
    for (const [key, value] of Object.entries(data.pages)) {
      const page = Number(key);
      if (Number.isInteger(page) && pageExists(page, sheets) && isObj(value) && typeof value.background === 'string') {
        pages[page] = { background: value.background };
      }
    }
  }
  const now = new Date().toISOString();

  return {
    formatVersion: FORMAT_VERSION,
    id: data.id,
    title: str(data.title, 'Bez tytułu'),
    sheets,
    margins: {
      outer: num(margins.outer, DEFAULT_MARGINS.outer),
      inner: num(margins.inner, DEFAULT_MARGINS.inner),
      top: num(margins.top, DEFAULT_MARGINS.top),
      bottom: num(margins.bottom, DEFAULT_MARGINS.bottom),
    },
    spreads: data.spreads.map(parseSpread),
    pages,
    fonts: Array.isArray(data.fonts) ? data.fonts.filter((f): f is string => typeof f === 'string') : [],
    print: {
      bleed: bool(print.bleed, DEFAULT_PRINT.bleed),
      cropMarks: bool(print.cropMarks, DEFAULT_PRINT.cropMarks),
      foldMarks: bool(print.foldMarks, DEFAULT_PRINT.foldMarks),
      rotateBacks: bool(print.rotateBacks, DEFAULT_PRINT.rotateBacks),
      duplex: print.duplex === 'manual' ? 'manual' : 'auto',
      manualReverseBacks: bool(print.manualReverseBacks, DEFAULT_PRINT.manualReverseBacks),
    },
    createdAt: str(data.createdAt, now),
    updatedAt: str(data.updatedAt, now),
  };
}
