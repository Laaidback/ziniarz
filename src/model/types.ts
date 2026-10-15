export type Side = 'left' | 'right';

export interface Margins {
  outer: number;
  inner: number;
  top: number;
  bottom: number;
}

export interface PageStyle {
  background: string;
}

export type DuplexMode = 'auto' | 'manual';

export interface PrintSettings {
  bleed: boolean;
  cropMarks: boolean;
  foldMarks: boolean;
  rotateBacks: boolean;
  duplex: DuplexMode;
  manualReverseBacks: boolean;
}

/** Frame in spread coordinates (mm). Rotation in degrees around the frame centre. */
export interface Frame {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

/** Photo position inside its frame: offset of the image centre from the frame centre (mm), zoom >= 1. */
export interface PhotoCrop {
  offsetX: number;
  offsetY: number;
  zoom: number;
}

export interface PhotoElement extends Frame {
  kind: 'photo';
  imageId: string;
  crop: PhotoCrop;
  flipX: boolean;
  opacity: number;
}

export type TextAlign = 'left' | 'center' | 'right' | 'justify';

/** Text frame: `width` is the wrap width, `height` is recomputed from the text by the renderer. */
export interface TextElement extends Frame {
  kind: 'text';
  text: string;
  fontFamilyId: string;
  /** Typographic points on the printed page. */
  size: number;
  bold: boolean;
  italic: boolean;
  /** Thousandths of an em. */
  letterSpacing: number;
  lineHeight: number;
  color: string;
  align: TextAlign;
}

export type ZineElement = PhotoElement | TextElement;

export interface Spread {
  id: string;
  /** Draw order: last element on top. */
  elements: ZineElement[];
}

export interface Zine {
  formatVersion: number;
  id: string;
  title: string;
  sheets: number;
  margins: Margins;
  /** Length = 2 * sheets + 1. Spread i holds pages 2i (left) and 2i + 1 (right). */
  spreads: Spread[];
  /** Page background by page number; missing = white. */
  pages: Record<number, PageStyle>;
  /** Ids of custom font families uploaded to this zine. */
  fonts: string[];
  print: PrintSettings;
  createdAt: string;
  updatedAt: string;
}
