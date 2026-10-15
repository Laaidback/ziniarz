import { commands } from '@vitest/browser/context';
import { beforeAll, inject, test } from 'vitest';
import { sheetSides } from '../imposition/imposition';
import { printLayout } from '../imposition/layout';
import type { Zine } from '../model/types';
import type { RenderAssets } from '../render/assets';
import { canvasToBytes } from '../render/canvasBytes';
import { base64ToBytes, bytesToBase64 } from '../test/base64';
import { compareImages, type RgbaImage } from '../test/imageCompare';
import { SAMPLE_SHEETS, sampleZine } from '../test/sampleZine';
import { renderSheetSide } from './sheetSide';

// Render references: every sheet side of the sample zine is compared with a committed PNG.
// Refresh them on purpose with `npm run test:update-references` and look at them before committing.
// commands.readFile / writeFile resolve paths against the project root.
const REFERENCES = 'src/print/__reference__';
const OUT = 'test-output/reference';
const DPI = 72;
const CHANNEL_TOLERANCE = 24;
const MAX_DIFFERING_SHARE = 0.005;

const update = inject('updateReferences');
let sample: { zine: Zine; assets: RenderAssets };

beforeAll(async () => {
  sample = await sampleZine();
});

async function decodePng(bytes: Uint8Array<ArrayBuffer>): Promise<RgbaImage> {
  const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }), {
    colorSpaceConversion: 'none',
    premultiplyAlpha: 'none',
  });
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

async function writePng(path: string, image: RgbaImage): Promise<void> {
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  canvas.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(image.data), image.width), 0, 0);
  await commands.writeFile(path, bytesToBase64(await canvasToBytes(canvas, 'image/png')), { encoding: 'base64' });
}

async function readReference(path: string): Promise<RgbaImage> {
  let base64: string;
  try {
    base64 = await commands.readFile(path, { encoding: 'base64' });
  } catch {
    throw new Error(`No reference ${path}. Run \`npm run test:update-references\` and look at the new PNGs before committing.`);
  }
  return decodePng(base64ToBytes(base64));
}

const sides = sheetSides(SAMPLE_SHEETS).map((side) => ({
  ...side,
  label: `sheet ${side.sheet + 1} ${side.face}`,
  file: `sheet-${side.sheet + 1}-${side.face}.png`,
}));

for (const side of sides) {
  test(`${side.label} matches its reference`, { timeout: 30_000 }, async () => {
    const { zine, assets } = sample;
    const layout = printLayout({ printerMargin: 4, bleed: true, cropMarks: true, foldMarks: true });
    const canvas = renderSheetSide(zine, side, assets, layout, { dpi: DPI, cropMarks: true, foldMarks: true, rotate180: false });
    const actual = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height);
    const referencePath = `${REFERENCES}/${side.file}`;

    if (update) {
      await writePng(referencePath, actual);
      return;
    }

    const expected = await readReference(referencePath);
    const { differing, total, diff } = compareImages(actual, expected, { channelTolerance: CHANNEL_TOLERANCE });
    if (differing / total <= MAX_DIFFERING_SHARE) return;

    const stem = `${OUT}/${side.file.replace(/\.png$/, '')}`;
    await writePng(`${stem}.actual.png`, actual);
    await writePng(`${stem}.diff.png`, diff);
    const percent = ((differing / total) * 100).toFixed(2);
    throw new Error(
      `${side.label} (${side.file}) differs from its reference in ${percent} % of pixels ` +
        `(${differing} of ${total}, limit ${MAX_DIFFERING_SHARE * 100} %). ` +
        `See ${stem}.actual.png and ${stem}.diff.png (differences in red). ` +
        'If the change is intended, run `npm run test:update-references` and commit the new PNGs.',
    );
  });
}
