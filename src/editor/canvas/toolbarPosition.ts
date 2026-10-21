import { frameBounds } from '../../model/geometry';
import type { Frame } from '../../model/types';
import type { Viewport } from './EditorStage';

/** Size of the selection toolbar in px (its CSS takes these too). */
export const TOOLBAR_WIDTH = 80;
export const TOOLBAR_HEIGHT = 36;
/** Space between the frame and the toolbar, in px. */
export const TOOLBAR_GAP = 10;

/**
 * Where the selection toolbar goes in the canvas box (px): centred under the frame (the rotation
 * handle is above it), above the frame when there is no room below, and always inside the box.
 */
export function toolbarPosition(frame: Frame, viewport: Viewport, boxWidth: number, boxHeight: number): { left: number; top: number } {
  const { scale, originX, originY } = viewport;
  const bounds = frameBounds(frame);
  const top = originY + bounds.y * scale;
  const bottom = top + bounds.height * scale;
  const centre = originX + (bounds.x + bounds.width / 2) * scale;
  const below = bottom + TOOLBAR_GAP;
  const wanted = below + TOOLBAR_HEIGHT <= boxHeight ? below : top - TOOLBAR_GAP - TOOLBAR_HEIGHT;
  return {
    left: clamp(centre - TOOLBAR_WIDTH / 2, 0, boxWidth - TOOLBAR_WIDTH),
    top: clamp(wanted, 0, boxHeight - TOOLBAR_HEIGHT),
  };
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(Math.max(min, max), value));
