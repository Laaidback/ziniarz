import { sheetSides } from '../imposition/imposition';
import { createTextElement, createZine } from '../model/factory';
import { pageRect, PAGE_WIDTH, slotOfPage } from '../model/geometry';
import type { Zine } from '../model/types';

const SHEETS = 2;

/** How to read the printed test page; printed on its cover and shown under its download button. */
export function testPageInstructions(): string[] {
  const backs = sheetSides(SHEETS)
    .filter((s) => s.face === 'back')
    .map((s) => `${s.left} | ${s.right}`);
  return [
    'Złóż obie kartki na pół, kartka 2 w środku: strony mają iść od 1 do 8 i stać „↑ góra”.',
    '• Tył do góry nogami? Włącz „Obróć tyły o 180°”.',
    `• Na tyle kartki 1 mają być strony ${backs[0]}, na tyle kartki 2: ${backs[1]}. ` +
      'Przód i tył kartki pokazują różne numery kartki? Przełącz „tyły w odwrotnej kolejności”.',
    '• Coś ważnego ucięte przy krawędzi kartki? Zwiększ margines drukarki.',
  ];
}

/**
 * Two sheets (pages 1–8) with big page numbers, "↑ góra" and the sheet side, on light
 * grey pages so the bleed is visible. Two sheets, because with one a wrong back order
 * cannot show. Printed duplex and folded, it must read 1–8 the right way up.
 */
export function testPageZine(): Zine {
  const zine = createZine('Strona próbna', SHEETS);
  const sides = sheetSides(SHEETS);
  for (const side of sides) {
    const label = `kartka ${side.sheet + 1} · ${side.face === 'front' ? 'przód' : 'tył'}`;
    for (const page of [side.left, side.right]) {
      zine.pages[page] = { background: '#e6e6e6' };
      const slot = slotOfPage(page);
      const x = pageRect(slot.side, 0).x;
      zine.spreads[slot.spread].elements.push(
        createTextElement({ text: `${page}\n↑ góra`, size: 72, align: 'center', x, y: 45, width: PAGE_WIDTH, lineHeight: 1 }),
        createTextElement({ text: label, size: 16, align: 'center', x, y: 110, width: PAGE_WIDTH }),
      );
    }
  }
  zine.spreads[0].elements.push(
    createTextElement({
      text: testPageInstructions().join('\n'),
      size: 9,
      align: 'left',
      x: PAGE_WIDTH + 10,
      y: 135,
      width: PAGE_WIDTH - 20,
    }),
  );
  return zine;
}
