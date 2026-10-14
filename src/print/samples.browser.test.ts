import { commands } from '@vitest/browser/context';
import { test } from 'vitest';
import { sheetSides } from '../imposition/imposition';
import { printLayout } from '../imposition/layout';
import { createPhotoElement, createTextElement, createZine } from '../model/factory';
import { canvasToBytes } from '../render/canvasBytes';
import { buildSheetsPdf } from './pdf';
import { renderSheetSide } from './sheetSide';
import { testPageZine } from './testPage';

// commands.writeFile resolves relative paths against the project root.
const OUT = 'test-output';

function base64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

async function gradientBitmap(): Promise<ImageBitmap> {
  const canvas = new OffscreenCanvas(1200, 800);
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createLinearGradient(0, 0, 1200, 800);
  gradient.addColorStop(0, '#ff5f6d');
  gradient.addColorStop(1, '#6a5acd');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1200, 800);
  return createImageBitmap(canvas);
}

test('write sample sheets and PDFs to test-output/', { timeout: 120_000 }, async () => {
  const zine = createZine('Próbka', 5);
  zine.pages[1] = { background: '#e8e2ff' };
  zine.spreads[0].elements.push(
    createTextElement({ text: 'PRÓBKA', size: 40, bold: true, x: 178, y: 30, width: 88, align: 'center', letterSpacing: 80 }),
  );
  zine.spreads[5].elements.push(
    createPhotoElement('g', { x: 40, y: 40, width: 216, height: 130 }),
    createTextElement({ text: 'Zdjęcie przez grzbiet, strony 10 i 11', size: 11, x: 30, y: 180, width: 88 }),
  );
  const assets = { images: new Map([['g', await gradientBitmap()]]) };

  const layout = printLayout(zine.print);
  for (const side of sheetSides(zine.sheets)) {
    const canvas = renderSheetSide(zine, side, assets, layout, { dpi: 100, cropMarks: true, foldMarks: true, rotate180: false });
    const name = `sheet-${side.sheet + 1}-${side.face}.png`;
    await commands.writeFile(`${OUT}/${name}`, base64(await canvasToBytes(canvas, 'image/png')), { encoding: 'base64' });
  }
  for (const file of await buildSheetsPdf({ zine, assets, settings: zine.print, dpi: 150 })) {
    await commands.writeFile(`${OUT}/${file.name}`, base64(file.bytes), { encoding: 'base64' });
  }
  const probe = testPageZine();
  for (const file of await buildSheetsPdf({ zine: probe, assets: { images: new Map() }, settings: probe.print, dpi: 150 })) {
    await commands.writeFile(`${OUT}/${file.name}`, base64(file.bytes), { encoding: 'base64' });
  }
});
