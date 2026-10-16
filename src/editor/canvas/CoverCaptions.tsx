import { BLEED, PAGE_HEIGHT, PAGE_WIDTH } from '../../model/geometry';
import type { Viewport } from './EditorStage';

/** Gap between the bottom bleed edge and the captions, px. Fits in STAGE_PADDING_PX with a 12 px font. */
const GAP_PX = 4;

/** "tył" and "przód" under the halves of the cover spread. Editor only: never drawn by the renderer. */
export function CoverCaptions({ viewport }: { viewport: Viewport }) {
  const { scale, originX, originY } = viewport;
  const top = originY + (PAGE_HEIGHT + BLEED) * scale + GAP_PX;
  return (
    <>
      <span className="cover-caption" style={{ left: originX + (PAGE_WIDTH / 2) * scale, top }}>
        tył
      </span>
      <span className="cover-caption" style={{ left: originX + PAGE_WIDTH * 1.5 * scale, top }}>
        przód
      </span>
    </>
  );
}
