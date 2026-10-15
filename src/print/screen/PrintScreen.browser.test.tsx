import { PDFDocument } from 'pdf-lib';
import { expect, test, vi } from 'vitest';
import { createZine } from '../../model/factory';
import type { Zine } from '../../model/types';
import { openZineLockHeld } from '../../test/locks';
import { openScreen } from '../../test/screenHarness';
import type { PdfExporter } from '../exporter';
import { EXPORT_FAILED } from '../exportRunner';
import { buildPagesPdf, buildSheetsPdf, type PdfFile, type SheetsPdfJob } from '../pdf';
import { PrintScreen } from './PrintScreen';

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
  await expect.element(screen.getByText('Strona po przycięciu: 105 × 148 mm')).toBeVisible();
  await expect.element(screen.getByText(/„Rzeczywisty rozmiar”/)).toBeVisible();
  await expect.element(screen.getByText(/„odwracanie po krótszej krawędzi”/)).toBeVisible();
});

test('options are saved in the zine; there is no printer margin field', async () => {
  // An older zine still carries the printer margin in its print settings.
  const fresh = createZine('Lato', 2);
  const zine = { ...fresh, print: { ...fresh.print, printerMargin: 7 } } as unknown as Zine;
  const { screen, stored } = await openPrint(zine, testExporter().exporter);
  expect((await stored()).print).toHaveProperty('printerMargin', 7);
  await expect.element(screen.getByRole('checkbox', { name: 'Spady' })).toBeChecked();
  expect(screen.getByRole('spinbutton', { name: 'Margines drukarki' }).query()).toBeNull();
  await screen.getByRole('checkbox', { name: 'Linie cięcia' }).click();
  await screen.getByRole('checkbox', { name: 'Linia zgięcia' }).click();
  await expect.element(screen.getByText('Strona po przycięciu: 105 × 148 mm')).toBeVisible();
  await expect.poll(async () => (await stored()).print).toMatchObject({ cropMarks: false, foldMarks: false });
  expect((await stored()).print).not.toHaveProperty('printerMargin');
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

test('manual duplex: backs reversed by default, a different reminder, two PDFs downloaded by a click each', async () => {
  const zine = createZine('Lato', 3);
  const { exporter, saved } = testExporter();
  const { screen, stored } = await openPrint(zine, exporter);
  await screen.getByRole('radio', { name: /ręcznie/ }).click();
  await expect.element(screen.getByRole('checkbox', { name: 'Tyły w odwrotnej kolejności' })).toBeChecked();
  await expect.element(screen.getByText(/wydrukuj plik z tyłami/)).toBeVisible();
  await expect.element(screen.getByRole('button', { name: 'Przygotuj stronę próbną (przody i tyły)' })).toBeVisible();
  await screen.getByRole('button', { name: 'Przygotuj PDF-y do druku (przody i tyły)' }).click();
  await expect.element(screen.getByText('PDF do druku: gotowe. Pobierz każdy plik osobno.')).toBeVisible();
  expect(saved).toEqual([]); // both files are built, nothing is downloaded without a click

  await screen.getByRole('button', { name: 'Pobierz przody (lato-przody.pdf)' }).click();
  expect(saved.map((f) => f.name)).toEqual(['lato-przody.pdf']);
  await screen.getByRole('button', { name: 'Pobierz tyły (lato-tyly.pdf)' }).click();
  expect(saved.map((f) => f.name)).toEqual(['lato-przody.pdf', 'lato-tyly.pdf']);
  await expect.element(screen.getByText('Pobrano').nth(1)).toBeVisible();
  expect(await Promise.all(saved.map(pageCountOf))).toEqual([3, 3]);
  await expect.poll(async () => (await stored()).print.duplex).toBe('manual');
});

test('manual duplex: a download that fails names its file and can be clicked again', async () => {
  const error = vi.spyOn(console, 'error').mockImplementation(() => {});
  const zine = createZine('Lato', 1);
  const saved: string[] = [];
  let blocked = true;
  const { exporter } = testExporter({
    save: (file) => {
      if (blocked && file.name === 'lato-tyly.pdf') throw new Error('download blocked');
      saved.push(file.name);
    },
  });
  const { screen } = await openPrint(zine, exporter);
  await screen.getByRole('radio', { name: /ręcznie/ }).click();
  await screen.getByRole('button', { name: 'Przygotuj PDF-y do druku (przody i tyły)' }).click();
  await screen.getByRole('button', { name: 'Pobierz przody (lato-przody.pdf)' }).click();
  await screen.getByRole('button', { name: 'Pobierz tyły (lato-tyly.pdf)' }).click();
  await expect
    .element(screen.getByRole('alert'))
    .toHaveTextContent('Nie udało się pobrać pliku lato-tyly.pdf. Spróbuj jeszcze raz.');
  blocked = false;
  await screen.getByRole('button', { name: 'Pobierz tyły (lato-tyly.pdf)' }).click();
  await expect.element(screen.getByRole('alert')).not.toBeInTheDocument();
  expect(saved).toEqual(['lato-przody.pdf', 'lato-tyly.pdf']);
  error.mockRestore();
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

test('while the print screen is open it holds the open-zine lock', async () => {
  const { db, screen } = await openPrint(createZine('Lato', 1), testExporter().exporter);
  await expect.poll(() => openZineLockHeld(db.name)).toBe(true);
  screen.unmount();
  await expect.poll(() => openZineLockHeld(db.name)).toBe(false);
});

test('hiding the page saves the print options at once, without waiting for autosave', async () => {
  const zine = createZine('Lato', 1);
  const { screen, stored } = await openPrint(zine, testExporter().exporter);
  await screen.getByRole('checkbox', { name: 'Linie cięcia' }).click();
  window.dispatchEvent(new Event('pagehide'));
  await expect.poll(async () => (await stored()).print.cropMarks, { timeout: 250, interval: 20 }).toBe(false);

  await screen.getByRole('checkbox', { name: 'Linia zgięcia' }).click();
  const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
  try {
    document.dispatchEvent(new Event('visibilitychange'));
    await expect.poll(async () => (await stored()).print.foldMarks, { timeout: 250, interval: 20 }).toBe(false);
  } finally {
    visibility.mockRestore();
  }
});
