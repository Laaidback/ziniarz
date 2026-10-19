import Konva from 'konva';
import { BLEED, marginRect, PAGE_HEIGHT, PAGE_WIDTH, pageRect, pagesOfSpread, sideOfPage } from '../model/geometry';
import type { Rect } from '../model/geometry';
import type { Side, Zine } from '../model/types';

export const GUIDE_COLORS = {
  bleed: '#e5484d',
  bleedZone: 'rgba(220, 60, 60, 0.06)',
  trim: '#9a9aa2',
  margin: '#3e63dd',
  spine: 'rgba(0, 0, 0, 0.35)',
};

/** The bleed outside the cut line of a page: strips along its top, bottom and outer edges (not the spine). */
function bleedZones(side: Side): Rect[] {
  const bleed = pageRect(side, BLEED);
  const outerX = side === 'left' ? -BLEED : 2 * PAGE_WIDTH;
  return [
    { x: bleed.x, y: -BLEED, width: bleed.width, height: BLEED },
    { x: bleed.x, y: PAGE_HEIGHT, width: bleed.width, height: BLEED },
    { x: outerX, y: 0, width: BLEED, height: PAGE_HEIGHT },
  ];
}

/**
 * Editor guides, never printed: the bleed lightly shaded with its red dashed edge, the cut line (the
 * page edge, where margins are measured from) as a thin grey line, margins (blue dashed) and the spine.
 * `pxPerMm` keeps the lines 1 px wide on screen.
 */
export function buildGuidesGroup(zine: Zine, spread: number, pxPerMm: number): Konva.Group {
  const px = 1 / pxPerMm;
  const dash = [4 * px, 3 * px];
  const group = new Konva.Group({ listening: false });
  for (const page of pagesOfSpread(spread, zine.sheets)) {
    const side = sideOfPage(page);
    for (const zone of bleedZones(side)) group.add(new Konva.Rect({ ...zone, fill: GUIDE_COLORS.bleedZone, name: 'guide-bleed-zone' }));
    group.add(new Konva.Rect({ ...pageRect(side, 0), stroke: GUIDE_COLORS.trim, strokeWidth: px, name: 'guide-trim' }));
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
