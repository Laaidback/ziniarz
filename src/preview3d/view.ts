import { PAGE_HEIGHT } from '../model/geometry';

export const TEXTURE_HEIGHT_PX = 1024;
/** Pointer movement (px) under which a press and release counts as a click, not an orbit drag. */
export const CLICK_TOLERANCE_PX = 5;

export interface Point {
  x: number;
  y: number;
}

/** Resolution of page textures: a page without bleed is TEXTURE_HEIGHT_PX high. */
export function texturePxPerMm(): number {
  return TEXTURE_HEIGHT_PX / PAGE_HEIGHT;
}

export function isClick(down: Point, up: Point): boolean {
  return Math.hypot(up.x - down.x, up.y - down.y) <= CLICK_TOLERANCE_PX;
}

/** `x` from the left edge of the view of `width` px. */
export function clickTurnsForward(x: number, width: number): boolean {
  return x >= width / 2;
}

export type KeyPress = Pick<KeyboardEvent, 'key' | 'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey'>;

/**
 * true = forward, false = back, null = not a page-turning key. Arrows with a modifier are
 * left to the browser (Alt+← goes back, Cmd+← too on a Mac).
 */
export function turnForKey(press: KeyPress): boolean | null {
  if (press.altKey || press.ctrlKey || press.metaKey || press.shiftKey) return null;
  if (press.key === 'ArrowRight') return true;
  if (press.key === 'ArrowLeft') return false;
  return null;
}

/** Camera distance at which a `width` × `height` object fills the view with some room around it. */
export function fitDistance(width: number, height: number, fovDeg: number, aspect: number, room = 1.15): number {
  const half = Math.tan(((fovDeg / 2) * Math.PI) / 180);
  return Math.max(height / 2 / half, width / 2 / (half * aspect)) * room;
}
