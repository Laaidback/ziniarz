import Konva from 'konva';
import { konvaFontFamily, konvaFontStyle } from '../fonts/fontLoader';
import { BLEED, pageRect, pagesOfSpread, slotOfPage } from '../model/geometry';
import type { PhotoElement, TextElement, Zine, ZineElement } from '../model/types';
import type { RenderAssets } from './assets';
import { imagePlacement } from './photoGeometry';

export const PLACEHOLDER_COLOR = '#dddddd';
/** Konva name of every element node; its Konva id is the element id. */
export const ELEMENT_NODE_NAME = 'element';

export function ptToMm(points: number): number {
  return (points * 25.4) / 72;
}

export interface TextStyleMm {
  fontSize: number;
  letterSpacing: number;
  lineHeight: number;
}

/** Text metrics in mm, shared by the renderer and the editor's in-place text box. */
export function textStyleMm(element: TextElement): TextStyleMm {
  const fontSize = ptToMm(element.size);
  return { fontSize, letterSpacing: (element.letterSpacing / 1000) * fontSize, lineHeight: element.lineHeight };
}

/** The only Konva.Text configuration. Drawing and measuring both use it, so they always agree. */
export function createTextShape(element: TextElement): Konva.Text {
  const style = textStyleMm(element);
  return new Konva.Text({
    text: element.text,
    width: element.width,
    fontFamily: konvaFontFamily(element.fontFamilyId),
    fontSize: style.fontSize,
    fontStyle: konvaFontStyle(element),
    letterSpacing: style.letterSpacing,
    lineHeight: style.lineHeight,
    fill: element.color,
    align: element.align,
    wrap: 'word',
  });
}

/** Height of the wrapped text in mm (what `TextElement.height` should be). */
export function measureTextHeight(element: TextElement): number {
  const shape = createTextShape(element);
  const height = shape.height();
  shape.destroy();
  return height;
}

function photoNode(element: PhotoElement, assets: RenderAssets): Konva.Group {
  const { width, height } = element;
  const group = new Konva.Group({
    id: element.id,
    name: ELEMENT_NODE_NAME,
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
  // A flip mirrors the visible crop around the frame's vertical centre line:
  // with scaleX -1, image column u lands at x - u, so x = width - placed.x
  // puts column u at width - (placed.x + u), the mirror of its unflipped spot.
  group.add(
    new Konva.Image({
      image: bitmap,
      x: element.flipX ? width - placed.x : placed.x,
      y: placed.y,
      width: placed.width,
      height: placed.height,
      scaleX: element.flipX ? -1 : 1,
    }),
  );
  return group;
}

function textNode(element: TextElement): Konva.Group {
  const text = createTextShape(element);
  const height = text.height();
  const group = new Konva.Group({
    id: element.id,
    name: ELEMENT_NODE_NAME,
    x: element.x + element.width / 2,
    y: element.y + height / 2,
    offsetX: element.width / 2,
    offsetY: height / 2,
    rotation: element.rotation,
  });
  group.add(text);
  return group;
}

/** One element positioned by its centre: offset = half its size, so rotation turns it around the centre. */
export function buildElementNode(element: ZineElement, assets: RenderAssets): Konva.Group {
  return element.kind === 'photo' ? photoNode(element, assets) : textNode(element);
}

/** The single drawing of a spread, in spread millimetres (page backgrounds include bleed). */
export function buildSpreadGroup(zine: Zine, spreadIndex: number, assets: RenderAssets): Konva.Group {
  const group = new Konva.Group();
  for (const page of pagesOfSpread(spreadIndex, zine.sheets)) {
    const rect = pageRect(slotOfPage(page).side, BLEED);
    group.add(new Konva.Rect({ ...rect, fill: zine.pages[page]?.background ?? '#ffffff', name: 'page' }));
  }
  for (const element of zine.spreads[spreadIndex].elements) group.add(buildElementNode(element, assets));
  return group;
}
