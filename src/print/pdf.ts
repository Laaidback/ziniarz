import { PDFDocument } from 'pdf-lib';
import { ensureFontsReady } from '../fonts/fontLoader';
import { A4_LANDSCAPE, printLayout } from '../imposition/layout';
import { BLEED, PAGE_HEIGHT, PAGE_WIDTH, pageCount } from '../model/geometry';
import type { PrintSettings, Zine } from '../model/types';
import type { RenderAssets } from '../render/assets';
import { canvasToBytes, releaseCanvas } from '../render/canvasBytes';
import { renderPage } from '../render/renderPage';
import { fileSlug } from './fileName';
import { printGroups } from './printGroups';
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
  /** Stops the build (it rejects) before the next sheet side or page. */
  signal?: AbortSignal;
}

/** Imposed sheets for home duplex printing. Sheets are rendered one at a time to keep memory low. */
export async function buildSheetsPdf(job: SheetsPdfJob): Promise<PdfFile[]> {
  const { zine, assets, settings } = job;
  const dpi = job.dpi ?? PRINT_DPI;
  await ensureFontsReady(zine);
  const layout = printLayout(settings);
  const groups = printGroups(zine.sheets, settings);
  const total = groups.reduce((sum, group) => sum + group.sides.length, 0);
  const width = A4_LANDSCAPE.width * MM_TO_PT;
  const height = A4_LANDSCAPE.height * MM_TO_PT;
  let done = 0;
  const files: PdfFile[] = [];
  for (const group of groups) {
    const pdf = await PDFDocument.create();
    pdf.setTitle(zine.title);
    for (const { side, rotate180 } of group.sides) {
      job.signal?.throwIfAborted();
      const canvas = renderSheetSide(zine, side, assets, layout, {
        dpi,
        cropMarks: settings.cropMarks,
        foldMarks: settings.foldMarks,
        rotate180,
      });
      const image = await pdf.embedJpg(await canvasToBytes(canvas, 'image/jpeg', JPEG_QUALITY));
      releaseCanvas(canvas);
      pdf.addPage([width, height]).drawImage(image, { x: 0, y: 0, width, height });
      job.onProgress?.(++done, total);
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
  /** Stops the build (it rejects) before the next sheet side or page. */
  signal?: AbortSignal;
}

/** A6 pages in reading order, for review or sending. */
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
    job.signal?.throwIfAborted();
    const canvas = renderPage(zine, page, assets, { pxPerMm: mmToPx(dpi), bleed: job.bleed });
    const image = await pdf.embedJpg(await canvasToBytes(canvas, 'image/jpeg', JPEG_QUALITY));
    releaseCanvas(canvas);
    pdf.addPage([width, height]).drawImage(image, { x: 0, y: 0, width, height });
    job.onProgress?.(page, total);
  }
  return { name: `${fileSlug(zine.title)}-strony.pdf`, bytes: await pdf.save() };
}
