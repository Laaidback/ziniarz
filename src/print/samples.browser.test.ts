import { commands } from '@vitest/browser/context';
import { test } from 'vitest';
import { sheetSides } from '../imposition/imposition';
import { printLayout } from '../imposition/layout';
import { canvasToBytes } from '../render/canvasBytes';
import { bytesToBase64 } from '../test/base64';
import { sampleZine } from '../test/sampleZine';
import { buildSheetsPdf } from './pdf';
import { renderSheetSide } from './sheetSide';
import { testPageZine } from './testPage';

// commands.writeFile resolves relative paths against the project root.
const OUT = 'test-output';

test('write sample sheets and PDFs to test-output/', { timeout: 120_000 }, async () => {
  const { zine, assets } = await sampleZine();

  const layout = printLayout(zine.print);
  for (const side of sheetSides(zine.sheets)) {
    const canvas = renderSheetSide(zine, side, assets, layout, { dpi: 100, cropMarks: true, foldMarks: true, rotate180: false });
    const name = `sheet-${side.sheet + 1}-${side.face}.png`;
    await commands.writeFile(`${OUT}/${name}`, bytesToBase64(await canvasToBytes(canvas, 'image/png')), { encoding: 'base64' });
  }
  for (const file of await buildSheetsPdf({ zine, assets, settings: zine.print, dpi: 150 })) {
    await commands.writeFile(`${OUT}/${file.name}`, bytesToBase64(file.bytes), { encoding: 'base64' });
  }
  const probe = testPageZine();
  for (const file of await buildSheetsPdf({ zine: probe, assets: { images: new Map() }, settings: probe.print, dpi: 150 })) {
    await commands.writeFile(`${OUT}/${file.name}`, bytesToBase64(file.bytes), { encoding: 'base64' });
  }
});
