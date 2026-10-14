import { PDFDocument } from 'pdf-lib';
import { ensureFontsReady } from '../fonts/fontLoader';
import { sheetSides, type SheetSide } from '../imposition/imposition';
import { A4_LANDSCAPE, printLayout } from '../imposition/layout';
import { BLEED, PAGE_HEIGHT, PAGE_WIDTH, pageCount } from '../model/geometry';
import type { PrintSettings, Zine } from '../model/types';
import type { RenderAssets } from '../render/assets';
import { canvasToBytes, releaseCanvas } from '../render/canvasBytes';
import { renderPage } from '../render/renderPage';
import { fileSlug } from './fileName';
import { mmToPx, PRINT_DPI, renderSheetSide } from './sheetSide';

export const MM_TO_PT = 72 / 25.4;
const JPEG_QUALITY = 0.9;

export interface PdfFile {
  name: string;
  bytes: Uint8Array;
}

export interface SheetsPdfJob {
  zine: Zine;
  assets: RenderAssets;
  settings: PrintSettings;
  dpi?: number;
  onProgress?: (done: number, total: number) => void;
}

/** Imposed sheets for home duplex printing. Sheets are rendered one at a time to keep memory low. */
export async function buildSheetsPdf(job: SheetsPdfJob): Promise<PdfFile[]> {
  const { zine, assets, settings } = job;
  const dpi = job.dpi ?? PRINT_DPI;
  await ensureFontsReady(zine);
  const layout = printLayout(settings);
  const sides = sheetSides(zine.sheets);
  const backs = sides.filter((s) => s.face === 'back');
  const groups: { suffix: string; sides: SheetSide[] }[] =
    settings.duplex === 'auto'
      ? [{ suffix: 'druk', sides }]
      : [
          { suffix: 'przody', sides: sides.filter((s) => s.face === 'front') },
          { suffix: 'tyly', sides: settings.manualReverseBacks ? [...backs].reverse() : backs },
        ];

  const width = A4_LANDSCAPE.width * MM_TO_PT;
  const height = A4_LANDSCAPE.height * MM_TO_PT;
  let done = 0;
  const files: PdfFile[] = [];
  for (const group of groups) {
    const pdf = await PDFDocument.create();
    pdf.setTitle(zine.title);
    for (const side of group.sides) {
      const canvas = renderSheetSide(zine, side, assets, layout, {
        dpi,
        cropMarks: settings.cropMarks,
        foldMarks: settings.foldMarks,
        rotate180: settings.rotateBacks && side.face === 'back',
      });
      const image = await pdf.embedJpg(await canvasToBytes(canvas, 'image/jpeg', JPEG_QUALITY));
      releaseCanvas(canvas);
      pdf.addPage([width, height]).drawImage(image, { x: 0, y: 0, width, height });
      job.onProgress?.(++done, sides.length);
    }
    files.push({ name: `${fileSlug(zine.title)}-${group.suffix}.pdf`, bytes: await pdf.save() });
  }
  return files;
}

export interface PagesPdfJob {
  zine: Zine;
  assets: RenderAssets;
  bleed: boolean;
  dpi?: number;
  onProgress?: (done: number, total: number) => void;
}

/** A5 pages in reading order, unscaled, for review or sending. */
export async function buildPagesPdf(job: PagesPdfJob): Promise<PdfFile> {
  const { zine, assets } = job;
  const dpi = job.dpi ?? PRINT_DPI;
  await ensureFontsReady(zine);
  const bleed = job.bleed ? BLEED : 0;
  const width = (PAGE_WIDTH + bleed) * MM_TO_PT;
  const height = (PAGE_HEIGHT + 2 * bleed) * MM_TO_PT;
  const total = pageCount(zine.sheets);
  const pdf = await PDFDocument.create();
  pdf.setTitle(zine.title);
  for (let page = 1; page <= total; page++) {
    const canvas = renderPage(zine, page, assets, { pxPerMm: mmToPx(dpi), bleed: job.bleed });
    const image = await pdf.embedJpg(await canvasToBytes(canvas, 'image/jpeg', JPEG_QUALITY));
    releaseCanvas(canvas);
    pdf.addPage([width, height]).drawImage(image, { x: 0, y: 0, width, height });
    job.onProgress?.(page, total);
  }
  return { name: `${fileSlug(zine.title)}-strony.pdf`, bytes: await pdf.save() };
}
