import Konva from 'konva';
import { BLEED, marginRect, PAGE_HEIGHT, PAGE_WIDTH, pageAt, pageExists, pageRect, pagesOfSpread, sideOfPage, type Rect } from '../model/geometry';
import type { Side, Zine } from '../model/types';

export const GUIDE_COLORS = { bleed: '#e5484d', margin: '#3e63dd', spine: 'rgba(0, 0, 0, 0.35)' };
/** Same grey as the editor's canvas background, so a missing page blends into it. */
export const MISSING_PAGE_COLOR = '#e8e8e8';
const FAR = 1000;

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

/** The half of the spread where `side` has no page, reaching far outwards (never past the spine). */
function missingSideRect(side: Side): Rect {
  return side === 'left'
    ? { x: -FAR, y: -FAR, width: FAR + PAGE_WIDTH, height: PAGE_HEIGHT + 2 * FAR }
    : { x: PAGE_WIDTH, y: -FAR, width: PAGE_WIDTH + FAR, height: PAGE_HEIGHT + 2 * FAR };
}

/** Greys out what lies on the non-existing page next to a cover (it is never printed). */
export function buildMissingPagesShade(zine: Zine, spread: number): Konva.Group {
  const group = new Konva.Group({ listening: false });
  for (const side of ['left', 'right'] as const) {
    if (pageExists(pageAt(spread, side, zine.sheets), zine.sheets)) continue;
    group.add(new Konva.Rect({ ...missingSideRect(side), fill: MISSING_PAGE_COLOR, opacity: 0.85, name: 'missing-page' }));
  }
  return group;
}
