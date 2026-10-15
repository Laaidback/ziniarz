import { expect, test } from 'vitest';
import { ensureFontsReady } from '../fonts/fontLoader';
import { PAGE_HEIGHT } from '../model/geometry';
import type { TextElement } from '../model/types';
import { measureTextHeight } from '../render/buildSpread';
import { testPageZine } from './testPage';

test('every text of the test page ends at least 5 mm above the bottom edge', async () => {
  const zine = testPageZine();
  await ensureFontsReady(zine);
  const texts = zine.spreads.flatMap((s) => s.elements).filter((e): e is TextElement => e.kind === 'text');
  for (const text of texts) {
    expect(text.y + measureTextHeight(text), text.text.slice(0, 30)).toBeLessThanOrEqual(PAGE_HEIGHT - 5);
  }
});
