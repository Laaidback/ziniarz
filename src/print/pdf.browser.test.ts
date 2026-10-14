import { PDFDocument } from 'pdf-lib';
import { expect, test } from 'vitest';
import { createZine } from '../model/factory';
import { buildPagesPdf, buildSheetsPdf, MM_TO_PT } from './pdf';
import { testPageZine } from './testPage';

const assets = { images: new Map() };
const dpi = 30;

async function pagesOf(bytes: Uint8Array) {
  const pdf = await PDFDocument.load(bytes);
  return pdf.getPages().map((p) => p.getSize());
}

test('automatic duplex: one landscape A4 PDF, front and back of every sheet', async () => {
  const zine = createZine('Lato 2026', 5);
  const progress: number[] = [];
  const files = await buildSheetsPdf({ zine, assets, settings: zine.print, dpi, onProgress: (done) => progress.push(done) });
  expect(files.map((f) => f.name)).toEqual(['lato-2026-druk.pdf']);
  const sizes = await pagesOf(files[0].bytes);
  expect(sizes).toHaveLength(10);
  expect(sizes[0].width).toBeCloseTo(841.89, 1);
  expect(sizes[0].height).toBeCloseTo(595.28, 1);
  expect(progress).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
});

test('manual duplex: separate fronts and backs', async () => {
  const zine = createZine('Lato', 6);
  const files = await buildSheetsPdf({ zine, assets, settings: { ...zine.print, duplex: 'manual' }, dpi });
  expect(files.map((f) => f.name)).toEqual(['lato-przody.pdf', 'lato-tyly.pdf']);
  expect(await pagesOf(files[0].bytes)).toHaveLength(6);
  expect(await pagesOf(files[1].bytes)).toHaveLength(6);
});

test('pages PDF: A5 pages with outer bleed, in reading order', async () => {
  const zine = createZine('Lato', 5);
  const file = await buildPagesPdf({ zine, assets, bleed: true, dpi });
  expect(file.name).toBe('lato-strony.pdf');
  const sizes = await pagesOf(file.bytes);
  expect(sizes).toHaveLength(20);
  expect(sizes[0].width).toBeCloseTo(151 * MM_TO_PT, 1);
  expect(sizes[0].height).toBeCloseTo(216 * MM_TO_PT, 1);
});

test('test page prints as two sheets, front and back', async () => {
  const zine = testPageZine();
  const files = await buildSheetsPdf({ zine, assets, settings: zine.print, dpi });
  expect(await pagesOf(files[0].bytes)).toHaveLength(4);
});
