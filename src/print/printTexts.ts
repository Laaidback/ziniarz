import { sheetSides, type SheetSide } from '../imposition/imposition';
import type { PrintLayout } from '../imposition/layout';
import type { PrintSettings } from '../model/types';

export interface PreviewSheet {
  sheet: number;
  front: SheetSide;
  back: SheetSide;
}

/** Every sheet with both of its sides, in sheet order. */
export function previewSheets(sheets: number): PreviewSheet[] {
  const sides = sheetSides(sheets);
  return Array.from({ length: sheets }, (_, sheet) => ({
    sheet,
    front: sides.find((s) => s.sheet === sheet && s.face === 'front')!,
    back: sides.find((s) => s.sheet === sheet && s.face === 'back')!,
  }));
}

export function sideCaption(side: SheetSide): string {
  return `${side.face === 'front' ? 'przód' : 'tył'}: strony ${side.left} i ${side.right}`;
}

export function trimSizeText(layout: PrintLayout): string {
  const width = Math.round(layout.trimPage.width);
  const height = Math.round(layout.trimPage.height);
  return `Strona po przycięciu: ${width} × ${height} mm (${Math.round(layout.scale * 100)}% projektu)`;
}

/** What to choose in the browser's print dialog for these settings. */
export function printReminders(settings: PrintSettings): string[] {
  const actualSize = 'W oknie drukowania ustaw skalę „Rzeczywisty rozmiar” (100%), nie „Dopasuj do strony”.';
  if (settings.duplex === 'manual') {
    return [
      actualSize,
      'Najpierw wydrukuj plik z przodami. Potem włóż wydrukowane kartki z powrotem do podajnika i wydrukuj plik z tyłami.',
    ];
  }
  const edge = settings.rotateBacks ? 'dłuższej' : 'krótszej';
  return [actualSize, `Druk dwustronny: wybierz „odwracanie po ${edge} krawędzi”.`];
}

/** Button text for one of several ready files (manual duplex: fronts and backs). */
export function fileDownloadText(name: string): string {
  if (name.endsWith('-przody.pdf')) return `Pobierz przody (${name})`;
  if (name.endsWith('-tyly.pdf')) return `Pobierz tyły (${name})`;
  return `Pobierz ${name}`;
}
