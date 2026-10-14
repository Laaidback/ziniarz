import { MAX_SHEETS, MIN_SHEETS, spreadCount } from './geometry';
import { newId } from './ids';
import type { Margins, PhotoElement, PrintSettings, Spread, TextElement, Zine } from './types';

export const FORMAT_VERSION = 1;
export const DEFAULT_MARGINS: Margins = { outer: 30, inner: 30, top: 30, bottom: 30 };
export const DEFAULT_PRINT: PrintSettings = {
  printerMargin: 4,
  bleed: true,
  cropMarks: true,
  foldMarks: true,
  rotateBacks: false,
  duplex: 'auto',
  manualReverseBacks: true,
};
/** Id of a built-in family (src/fonts/fontChoices.ts). */
export const DEFAULT_FONT_FAMILY = 'inter';

export function clampSheets(sheets: number): number {
  return Math.min(MAX_SHEETS, Math.max(MIN_SHEETS, Math.round(sheets)));
}

export function createSpread(): Spread {
  return { id: newId(), elements: [] };
}

export function createZine(title: string, sheets: number, now = new Date()): Zine {
  const count = clampSheets(sheets);
  const stamp = now.toISOString();
  return {
    formatVersion: FORMAT_VERSION,
    id: newId(),
    title,
    sheets: count,
    margins: { ...DEFAULT_MARGINS },
    spreads: Array.from({ length: spreadCount(count) }, () => createSpread()),
    pages: {},
    fonts: [],
    print: { ...DEFAULT_PRINT },
    createdAt: stamp,
    updatedAt: stamp,
  };
}

export function createTextElement(fields: Partial<Omit<TextElement, 'kind'>> = {}): TextElement {
  return {
    id: newId(),
    x: 0,
    y: 0,
    width: 88,
    height: 0,
    rotation: 0,
    text: '',
    fontFamilyId: DEFAULT_FONT_FAMILY,
    size: 12,
    bold: false,
    italic: false,
    letterSpacing: 0,
    lineHeight: 1.2,
    color: '#000000',
    align: 'left',
    ...fields,
    kind: 'text',
  };
}

export function createPhotoElement(
  imageId: string,
  fields: Partial<Omit<PhotoElement, 'kind' | 'imageId'>> = {},
): PhotoElement {
  return {
    id: newId(),
    x: 0,
    y: 0,
    width: 88,
    height: 150,
    rotation: 0,
    crop: { offsetX: 0, offsetY: 0, zoom: 1 },
    flipX: false,
    opacity: 1,
    ...fields,
    kind: 'photo',
    imageId,
  };
}
