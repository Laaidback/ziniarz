import { downloadBlob } from '../home/download';
import { buildPagesPdf, buildSheetsPdf, type PagesPdfJob, type PdfFile, type SheetsPdfJob } from './pdf';

/** How the print screen builds and saves PDFs; tests pass a faster or failing one. */
export interface PdfExporter {
  sheets(job: SheetsPdfJob): Promise<PdfFile[]>;
  pages(job: PagesPdfJob): Promise<PdfFile>;
  save(file: PdfFile): void;
}

export function savePdf(file: PdfFile): void {
  downloadBlob(file.name, new Blob([file.bytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' }));
}

export const browserPdfExporter: PdfExporter = { sheets: buildSheetsPdf, pages: buildPagesPdf, save: savePdf };
