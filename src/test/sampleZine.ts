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
 * Inter (fonts loaded before returning), photos across the fold, into the bleed, rotated and flipped.
 * Changing it changes the references: refresh them on purpose (see CLAUDE.md).
 */
export async function sampleZine(): Promise<{ zine: Zine; assets: RenderAssets }> {
  const zine = createZine('Próbka', SAMPLE_SHEETS);
  zine.pages[1] = { background: '#fff4e0' };
  zine.pages[2] = { background: '#e8e2ff' };
  zine.pages[12] = { background: '#073b4c' };

  // Cover (page 1, right half of spread 0).
  zine.spreads[0].elements.push(
    createPhotoElement('p', { x: 160, y: 60, width: 124, height: 90, rotation: -4, flipX: true }),
    createTextElement({ text: 'PRÓBKA', size: 40, bold: true, x: 178, y: 20, width: 88, align: 'center', letterSpacing: 80 }),
    createTextElement({ text: 'zin z żółtą łódką', size: 14, italic: true, x: 178, y: 170, width: 88, align: 'center' }),
  );
  // Pages 2–3: text on both sides, a photo bleeding off the outer edge of page 3.
  zine.spreads[1].elements.push(
    createTextElement({
      text: 'Zażółć gęślą jaźń. Pchnąć w tę łódź jeża lub ośm skrzyń fig.',
      size: 12,
      x: 20,
      y: 30,
      width: 108,
      lineHeight: 1.4,
    }),
    createPhotoElement('p', { x: 200, y: -3, width: 99, height: 120, crop: { offsetX: 20, offsetY: 0, zoom: 1.5 } }),
  );
  // Pages 4–5: coloured pages, a photo bleeding off the bottom of page 4, right-aligned text.
  zine.pages[4] = { background: '#d8f3dc' };
  zine.pages[5] = { background: '#ffe5ec' };
  zine.spreads[2].elements.push(
    createPhotoElement('p', { x: -3, y: 120, width: 151, height: 93 }),
    createTextElement({ text: 'Tekst do prawej\nw dwóch wierszach', size: 16, x: 168, y: 40, width: 108, align: 'right' }),
  );
  // Pages 8–9: large rotated text across the fold.
  zine.spreads[4].elements.push(
    createTextElement({ text: 'Grzbiet', size: 60, bold: true, x: 100, y: 80, width: 160, rotation: 12, color: '#ef476f' }),
  );
  // Pages 6–7, the centre spread: a photo across the fold, printed in one piece.
  zine.spreads[3].elements.push(
    createPhotoElement('p', { x: 30, y: 40, width: 236, height: 130 }),
    createTextElement({ text: 'Środek zina', size: 18, bold: true, x: 30, y: 180, width: 108, color: '#073b4c' }),
  );
  // Pages 10–11: a photo across the fold, printed on two different sheets.
  zine.spreads[5].elements.push(
    createPhotoElement('p', { x: 40, y: 40, width: 216, height: 130, opacity: 0.8 }),
    createTextElement({ text: 'Zdjęcie przez grzbiet, strony 10 i 11', size: 11, x: 30, y: 180, width: 88 }),
  );
  // Back cover (page 12, left half of the last spread).
  zine.spreads[6].elements.push(
    createTextElement({ text: 'koniec', size: 24, x: 30, y: 95, width: 88, align: 'center', color: '#ffffff' }),
  );

  await ensureFontsReady(zine);
  return { zine, assets: { images: new Map([['p', await patternBitmap()]]) } };
}
