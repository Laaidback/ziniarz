import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';

/** A 600 × 400 PNG drawn in the page, so the test needs no image file. */
async function photoPng(page: import('@playwright/test').Page): Promise<Buffer> {
  const dataUrl = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 400;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#3366cc';
    ctx.fillRect(0, 0, 600, 400);
    ctx.fillStyle = '#ffcc00';
    ctx.fillRect(150, 100, 300, 200);
    return canvas.toDataURL('image/png');
  });
  return Buffer.from(dataUrl.split(',')[1], 'base64');
}

test('a new 5-sheet zine with a photo and a text prints as 10 landscape A4 pages', async ({ page }) => {
  await page.goto('./');
  await page.getByLabel('Tytuł').fill('Lato');
  await page.getByLabel('Kartki').fill('5');
  await page.getByRole('button', { name: 'Nowy zin' }).click();
  await expect(page.getByRole('heading', { name: 'Lato' })).toBeVisible();

  await page.getByLabel('Wybierz zdjęcia').setInputFiles({ name: 'zdjecie.png', mimeType: 'image/png', buffer: await photoPng(page) });
  await expect(page.getByRole('heading', { name: 'Zdjęcie' })).toBeVisible();

  await page.getByRole('button', { name: '+ Napis' }).click();
  await page.keyboard.type('Cześć, lato!');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: 'Napis' })).toBeVisible();

  await page.getByRole('link', { name: 'Druk' }).click();
  await expect(page.getByRole('heading', { name: 'Druk: Lato' })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Kartka 1, przód: strony 20 i 1' })).toBeVisible();

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Pobierz PDF do druku' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('lato-druk.pdf');

  const pdf = await PDFDocument.load(await readFile(await file.path()));
  expect(pdf.getPageCount()).toBe(10);
  for (const pdfPage of pdf.getPages()) {
    const { width, height } = pdfPage.getSize();
    expect(width).toBeCloseTo(841.89, 1);
    expect(height).toBeCloseTo(595.28, 1);
  }
});

test('the 3D preview loads three.js on demand and turns pages', async ({ page }) => {
  await page.goto('./');
  await page.getByLabel('Tytuł').fill('Zima');
  await page.getByLabel('Kartki').fill('2');
  await page.getByRole('button', { name: 'Nowy zin' }).click();
  await page.getByRole('link', { name: 'Podgląd 3D' }).click();
  await expect(page.getByRole('heading', { name: 'Podgląd 3D: Zima' })).toBeVisible();
  await expect(page.getByLabel('Podgląd 3D zina').locator('canvas')).toBeVisible();
  await expect(page.getByText('Okładka')).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByText('Strony 2–3')).toBeVisible();
});
