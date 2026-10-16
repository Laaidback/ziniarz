import Konva from 'konva';
import { BLEED, marginRect, PAGE_HEIGHT, PAGE_WIDTH, pageRect, pagesOfSpread, sideOfPage } from '../model/geometry';
import type { Zine } from '../model/types';

export const GUIDE_COLORS = { bleed: '#e5484d', margin: '#3e63dd', spine: 'rgba(0, 0, 0, 0.35)' };

/** Bleed (red dashed), margins (blue dashed) and the spine. `pxPerMm` keeps the lines 1 px wide on screen. */
export function buildGuidesGroup(zine: Zine, spread: number, pxPerMm: number): Konva.Group {
  const px = 1 / pxPerMm;
  const dash = [4 * px, 3 * px];
  const group = new Konva.Group({ listening: false });
  for (const page of pagesOfSpread(spread, zine.sheets)) {
    const side = sideOfPage(page);
    group.add(new Konva.Rect({ ...pageRect(side, BLEED), stroke: GUIDE_COLORS.bleed, strokeWidth: px, dash, name: 'guide-bleed' }));
    group.add(new Konva.Rect({ ...marginRect(zine.margins, side), stroke: GUIDE_COLORS.margin, strokeWidth: px, dash, name: 'guide-margin' }));
  }
  group.add(
    new Konva.Line({
      points: [PAGE_WIDTH, -BLEED, PAGE_WIDTH, PAGE_HEIGHT + BLEED],
      stroke: GUIDE_COLORS.spine,
      strokeWidth: px,
      name: 'guide-spine',
    }),
  );
  return group;
}
