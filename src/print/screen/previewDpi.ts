import { A4_LANDSCAPE } from '../../imposition/layout';

/** Lowest resolution of the preview images: an A4 side is 561 × 397 px. */
export const MIN_PREVIEW_DPI = 48;
/** Highest: a side about 1170 px wide on a Retina screen, still quick to draw. */
export const MAX_PREVIEW_DPI = 200;
/** Resolutions go up in these steps, so a slightly wider window never redraws. */
const STEP_DPI = 24;

/**
 * Resolution at which an A4 landscape side shown `cssWidth` px wide is sharp on a screen with
 * `pixelRatio` device pixels per px (2 on Retina): the image has at least as many pixels as the screen.
 */
export function previewDpi(cssWidth: number, pixelRatio: number): number {
  const ratio = pixelRatio > 0 ? pixelRatio : 1;
  const needed = (cssWidth * ratio * 25.4) / A4_LANDSCAPE.width;
  const stepped = Math.ceil(needed / STEP_DPI) * STEP_DPI;
  return Math.min(MAX_PREVIEW_DPI, Math.max(MIN_PREVIEW_DPI, stepped));
}
