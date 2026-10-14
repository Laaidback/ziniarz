import Konva from 'konva';
import { konvaFontFamily, konvaFontStyle } from '../fonts/fontLoader';
import { BLEED, pageRect, pagesOfSpread, slotOfPage } from '../model/geometry';
import type { PhotoElement, TextElement, Zine } from '../model/types';
import type { RenderAssets } from './assets';
import { imagePlacement } from './photoGeometry';

export const PLACEHOLDER_COLOR = '#dddddd';

export function ptToMm(points: number): number {
  return (points * 25.4) / 72;
}

function photoNode(element: PhotoElement, assets: RenderAssets): Konva.Group {
  const { width, height } = element;
  const group = new Konva.Group({
    x: element.x + width / 2,
    y: element.y + height / 2,
    offsetX: width / 2,
    offsetY: height / 2,
    rotation: element.rotation,
    opacity: element.opacity,
    clip: { x: 0, y: 0, width, height },
  });
  const bitmap = assets.images.get(element.imageId);
  if (!bitmap) {
    group.add(new Konva.Rect({ width, height, fill: PLACEHOLDER_COLOR }));
    return group;
  }
  const placed = imagePlacement(element, element.crop, bitmap.width, bitmap.height);
  group.add(
    new Konva.Image({
      image: bitmap,
      x: element.flipX ? placed.x + placed.width : placed.x,
      y: placed.y,
      width: placed.width,
      height: placed.height,
      scaleX: element.flipX ? -1 : 1,
    }),
  );
  return group;
}

function textNode(element: TextElement): Konva.Group {
  const fontSize = ptToMm(element.size);
  const text = new Konva.Text({
    text: element.text,
    width: element.width,
    fontFamily: konvaFontFamily(element.fontFamilyId),
    fontSize,
    fontStyle: konvaFontStyle(element),
    letterSpacing: (element.letterSpacing / 1000) * fontSize,
    lineHeight: element.lineHeight,
    fill: element.color,
    align: element.align,
    wrap: 'word',
  });
  const height = text.height();
  const group = new Konva.Group({
    x: element.x + element.width / 2,
    y: element.y + height / 2,
    offsetX: element.width / 2,
    offsetY: height / 2,
    rotation: element.rotation,
  });
  group.add(text);
  return group;
}

/** The single drawing of a spread, in spread millimetres (page backgrounds include bleed). */
export function buildSpreadGroup(zine: Zine, spreadIndex: number, assets: RenderAssets): Konva.Group {
  const group = new Konva.Group();
  for (const page of pagesOfSpread(spreadIndex, zine.sheets)) {
    const rect = pageRect(slotOfPage(page).side, BLEED);
    group.add(new Konva.Rect({ ...rect, fill: zine.pages[page]?.background ?? '#ffffff' }));
  }
  for (const element of zine.spreads[spreadIndex].elements) {
    group.add(element.kind === 'photo' ? photoNode(element, assets) : textNode(element));
  }
  return group;
}
