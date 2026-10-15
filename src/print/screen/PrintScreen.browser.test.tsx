import { PDFDocument } from 'pdf-lib';
import { beforeEach, expect, test } from 'vitest';
import { createZine } from '../../model/factory';
import type { Zine } from '../../model/types';
import { openScreen } from '../../test/screenHarness';
import type { PdfExporter } from '../exporter';
import { EXPORT_FAILED } from '../exportRunner';
import { buildPagesPdf, buildSheetsPdf, type PdfFile, type SheetsPdfJob } from '../pdf';
import { PRINTER_MARGIN_KEY } from '../printerMargin';
import { PrintScreen } from './PrintScreen';

beforeEach(() => localStorage.removeItem(PRINTER_MARGIN_KEY));

/** Real PDFs at low resolution (fast); saved files are collected instead of downloaded. */
function testExporter(overrides: Partial<PdfExporter> = {}) {
  const saved: PdfFile[] = [];
  const exporter: PdfExporter = {
    sheets: (job) => buildSheetsPdf({ ...job, dpi: 20 }),
    pages: (job) => buildPagesPdf({ ...job, dpi: 20 }),
    save: (file) => saved.push(file),
    ...overrides,
  };
  return { exporter, saved };
}

async function openPrint(zine: Zine, exporter: PdfExporter) {
  return openScreen(zine, <PrintScreen zineId={zine.id} exporter={exporter} />);
}

const pageCountOf = async (file: PdfFile) => (await PDFDocument.load(file.bytes)).getPageCount();

test('shows the sheets, the trimmed size, the reminders and a way back', async () => {
  const zine = createZine('Lato', 5);
  const { screen } = await openPrint(zine, testExporter().exporter);
  await expect.element(screen.getByRole('heading', { name: 'Druk: Lato' })).toBeVisible();
  await expect.element(screen.getByRole('link', { name: '← Wróć do edytora' })).toHaveAttribute('href', `#/zin/${zine.id}`);
  await expect.element(screen.getByRole('img', { name: 'Kartka 1, przód: strony 20 i 1' })).toBeVisible();
  await expect.element(screen.getByRole('heading', { name: 'Kartka 5' })).toBeInTheDocument();
  await expect.element(screen.getByText('Strona po przycięciu: 132 × 187 mm (89% projektu)')).toBeVisible();
  await expect.element(screen.getByText(/„Rzeczywisty rozmiar”/)).toBeVisible();
  await expect.element(screen.getByText(/„odwracanie po krótszej krawędzi”/)).toBeVisible();
});

test('options change the size and are saved in the zine; the printer margin is remembered in the browser', async () => {
  const zine = createZine('Lato', 2);
  const { screen, stored } = await openPrint(zine, testExporter().exporter);
  await screen.getByRole('checkbox', { name: 'Linie cięcia' }).click();
  await screen.getByRole('checkbox', { name: 'Linia zgięcia' }).click();
  await expect.element(screen.getByText('Strona po przycięciu: 138 × 196 mm (94% projektu)')).toBeVisible();
  await screen.getByRole('spinbutton', { name: 'Margines drukarki' }).fill('35');
  await expect.element(screen.getByText('Strona po przycięciu: 116 × 165 mm (79% projektu)')).toBeVisible();
  expect(localStorage.getItem(PRINTER_MARGIN_KEY)).toBe('20');
  await expect.poll(async () => (await stored()).print).toMatchObject({ cropMarks: false, foldMarks: false, printerMargin: 20 });

  // Another zine opened in this browser starts with the remembered margin.
  screen.unmount();
  const other = createZine('Zima', 1);
  const second = await openPrint(other, testExporter().exporter);
  await expect.element(second.screen.getByRole('spinbutton', { name: 'Margines drukarki' })).toHaveValue(20);
});

test('automatic duplex downloads one PDF with every sheet side', async () => {
  const zine = createZine('Lato', 5);
  const { exporter, saved } = testExporter();
  const { screen } = await openPrint(zine, exporter);
  await screen.getByRole('button', { name: 'Pobierz PDF do druku' }).click();
  await expect.element(screen.getByText('Pobrano: lato-druk.pdf')).toBeVisible();
  expect(saved.map((f) => f.name)).toEqual(['lato-druk.pdf']);
  expect(await pageCountOf(saved[0])).toBe(10);
});

test('manual duplex: backs reversed by default, two PDFs, a different reminder', async () => {
  const zine = createZine('Lato', 3);
  const { exporter, saved } = testExporter();
  const { screen, stored } = await openPrint(zine, exporter);
  await screen.getByRole('radio', { name: /ręcznie/ }).click();
  await expect.element(screen.getByRole('checkbox', { name: 'Tyły w odwrotnej kolejności' })).toBeChecked();
  await expect.element(screen.getByText(/wydrukuj plik z tyłami/)).toBeVisible();
  await screen.getByRole('button', { name: 'Pobierz PDF-y do druku (przody i tyły)' }).click();
  await expect.element(screen.getByText('Pobrano: lato-przody.pdf, lato-tyly.pdf')).toBeVisible();
  expect(await Promise.all(saved.map(pageCountOf))).toEqual([3, 3]);
  await expect.poll(async () => (await stored()).print.duplex).toBe('manual');
});

test('a failed export downloads nothing, says so and can be retried', async () => {
  const zine = createZine('Lato', 1);
  let attempts = 0;
  const { exporter, saved } = testExporter({
    sheets: async (job) => {
      attempts++;
      if (attempts === 1) {
        job.onProgress?.(1, 2);
        throw new Error('out of memory');
      }
      return buildSheetsPdf({ ...job, dpi: 20 });
    },
  });
  const { screen } = await openPrint(zine, exporter);
  await screen.getByRole('button', { name: 'Pobierz PDF do druku' }).click();
  await expect.element(screen.getByRole('alert')).toHaveTextContent(EXPORT_FAILED);
  expect(saved).toEqual([]);
  await screen.getByRole('button', { name: 'Spróbuj jeszcze raz' }).click();
  await expect.element(screen.getByText('Pobrano: lato-druk.pdf')).toBeVisible();
  expect(saved).toHaveLength(1);
});

test('the test page and the pages PDF', async () => {
  const zine = createZine('Lato', 2);
  const { exporter, saved } = testExporter();
  const { screen } = await openPrint(zine, exporter);
  await expect
    .element(screen.getByRole('list', { name: 'Jak sprawdzić stronę próbną' }))
    .toHaveTextContent('Tył do góry nogami? Włącz „Obróć tyły o 180°”.');
  await screen.getByRole('button', { name: 'Pobierz stronę próbną' }).click();
  await expect.element(screen.getByText('Pobrano: strona-probna-druk.pdf')).toBeVisible();
  expect(await pageCountOf(saved[0])).toBe(4);
  await screen.getByRole('button', { name: 'Pobierz PDF stronami' }).click();
  await expect.element(screen.getByText('Pobrano: lato-strony.pdf')).toBeVisible();
  expect(await pageCountOf(saved[1])).toBe(8);
});

test('leaving the screen cancels a running export, which never downloads later', async () => {
  const zine = createZine('Lato', 1);
  let job: SheetsPdfJob | undefined;
  let finish = () => {};
  const { exporter, saved } = testExporter({
    sheets: (started) => {
      job = started;
      return new Promise((resolve) => (finish = () => resolve(buildSheetsPdf({ ...started, signal: undefined, dpi: 20 }))));
    },
  });
  const { screen } = await openPrint(zine, exporter);
  await screen.getByRole('button', { name: 'Pobierz PDF do druku' }).click();
  await expect.poll(() => job).toBeDefined();
  expect(job!.signal?.aborted).toBe(false);
  screen.unmount();
  expect(job!.signal?.aborted).toBe(true);
  finish();
  await new Promise((resolve) => setTimeout(resolve, 500));
  expect(saved).toEqual([]);
});
