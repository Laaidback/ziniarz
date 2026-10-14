import { createTextElement, createZine } from '../model/factory';
import { pageRect, PAGE_WIDTH, slotOfPage } from '../model/geometry';
import type { Zine } from '../model/types';

/**
 * One sheet (pages 1–4) with big page numbers and "↑ góra", on light grey pages so the
 * bleed is visible. Printed duplex and folded it must read 1, 2, 3, 4 the right way up.
 */
export function testPageZine(): Zine {
  const zine = createZine('Strona próbna', 1);
  for (let page = 1; page <= 4; page++) {
    zine.pages[page] = { background: '#e6e6e6' };
    const { spread, side } = slotOfPage(page);
    const left = pageRect(side, 0).x;
    zine.spreads[spread].elements.push(
      createTextElement({ text: `${page}\n↑ góra`, size: 72, align: 'center', x: left, y: 60, width: PAGE_WIDTH, lineHeight: 1 }),
    );
  }
  zine.spreads[0].elements.push(
    createTextElement({
      text: 'Tył do góry nogami? Włącz „Obróć tyły o 180°”.\nStrony 2 i 3 zamienione? Przełącz kolejność tyłów.',
      size: 9,
      align: 'center',
      x: PAGE_WIDTH + 10,
      y: 170,
      width: PAGE_WIDTH - 20,
    }),
  );
  return zine;
}
