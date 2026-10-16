import { ensureFontsReady } from '../fonts/fontLoader';
import { createPhotoElement, createTextElement, createZine } from '../model/factory';
import type { Zine } from '../model/types';
import type { RenderAssets } from '../render/assets';

/** A deterministic "photo": diagonal gradient, stripes and circles, so a seam, a flip or a shift shows. */
async function patternBitmap(): Promise<ImageBitmap> {
  const canvas = new OffscreenCanvas(1200, 800);
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createLinearGradient(0, 0, 1200, 800);
  gradient.addColorStop(0, '#ff5f6d');
  gradient.addColorStop(1, '#6a5acd');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1200, 800);
  ctx.fillStyle = '#ffd166';
  for (let x = 0; x < 1200; x += 150) ctx.fillRect(x, 0, 40, 120);
  ctx.fillStyle = '#073b4c';
  for (const [x, y, r] of [
    [220, 420, 140],
    [600, 400, 90],
    [980, 560, 170],
  ]) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  return createImageBitmap(canvas);
}

export const SAMPLE_SHEETS = 3;

/**
 * The sample zine for the sheet PNGs and the render references: 3 sheets, text in the bundled
 * Inter (fonts loaded before returning), photos across the fold, into the bleed, rotated and flipped,
 * and a photo wrapping around the cover from the back to the front.
 * Changing it changes the references: refresh them on purpose (see CLAUDE.md).
 */
export async function sampleZine(): Promise<{ zine: Zine; assets: RenderAssets }> {
  const zine = createZine('Próbka', SAMPLE_SHEETS);
  zine.pages[1] = { background: '#fff4e0' };
  zine.pages[2] = { background: '#e8e2ff' };
  zine.pages[12] = { background: '#073b4c' };

  // Back cover (page 12, left half of spread 0, the outside cover), and a photo wrapping
  // around the spine from the back cover to the front, bleeding off the bottom.
  zine.spreads[0].elements.push(
    createPhotoElement('p', { x: 52.5, y: 130, width: 105, height: 21, crop: { offsetX: 0, offsetY: 0, zoom: 1.2 } }),
    createTextElement({ text: 'koniec', size: 17, x: 21.3, y: 67, width: 62.4, align: 'center', color: '#ffffff' }),
  );
  // Front cover (page 1, right half of spread 0).
  zine.spreads[0].elements.push(
    createPhotoElement('p', { x: 113.5, y: 42.3, width: 88, height: 63.4, rotation: -4, flipX: true }),
    createTextElement({ text: 'PRÓBKA', size: 28.4, bold: true, x: 126.3, y: 14.1, width: 62.4, align: 'center', letterSpacing: 80 }),
    createTextElement({ text: 'zin z żółtą łódką', size: 9.9, italic: true, x: 126.3, y: 119.8, width: 62.4, align: 'center' }),
  );
  // Pages 2–3: text on both sides, a photo bleeding off the outer edge of page 3.
  zine.spreads[1].elements.push(
    createTextElement({
      text: 'Zażółć gęślą jaźń. Pchnąć w tę łódź jeża lub ośm skrzyń fig.',
      size: 8.5,
      x: 14.2,
      y: 21.1,
      width: 76.6,
      lineHeight: 1.4,
    }),
    createPhotoElement('p', { x: 141.9, y: -3, width: 71.1, height: 85.5, crop: { offsetX: 14.4, offsetY: 0, zoom: 1.5 } }),
  );
  // Pages 4–5: coloured pages, a photo bleeding off the bottom of page 4, right-aligned text.
  zine.pages[4] = { background: '#d8f3dc' };
  zine.pages[5] = { background: '#ffe5ec' };
  zine.spreads[2].elements.push(
    createPhotoElement('p', { x: -3, y: 84.6, width: 108, height: 66.4 }),
    createTextElement({ text: 'Tekst do prawej\nw dwóch wierszach', size: 11.4, x: 119.2, y: 28.2, width: 76.6, align: 'right' }),
  );
  // Pages 8–9: large rotated text across the fold.
  zine.spreads[4].elements.push(
    createTextElement({ text: 'Grzbiet', size: 42.6, bold: true, x: 71, y: 56.4, width: 113.5, rotation: 12, color: '#ef476f' }),
  );
  // Pages 6–7, the centre spread: a photo across the fold, printed in one piece.
  zine.spreads[3].elements.push(
    createPhotoElement('p', { x: 21.3, y: 28.2, width: 167.4, height: 91.6 }),
    createTextElement({ text: 'Środek zina', size: 12.8, bold: true, x: 21.3, y: 126.9, width: 76.6, color: '#073b4c' }),
  );
  // Pages 10–11: a photo across the fold, printed on two different sheets.
  zine.spreads[5].elements.push(
    createPhotoElement('p', { x: 28.4, y: 28.2, width: 153.2, height: 91.6, opacity: 0.8 }),
    createTextElement({ text: 'Zdjęcie przez grzbiet, strony 10 i 11', size: 7.8, x: 21.3, y: 126.9, width: 62.4 }),
  );

  await ensureFontsReady(zine);
  return { zine, assets: { images: new Map([['p', await patternBitmap()]]) } };
}
