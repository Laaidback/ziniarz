import { vi } from 'vitest';
import { EditorStage, type StageView } from '../editor/canvas/EditorStage';
import type { Zine } from '../model/types';

/** An EditorStage in an 800×500 box, spying callbacks, and helpers to turn spread mm into box pixels. */
export function mountStage(zine: Zine, view: Partial<StageView> = {}) {
  const container = document.createElement('div');
  container.style.cssText = 'width: 800px; height: 500px; position: relative';
  document.body.append(container);
  const callbacks = {
    select: vi.fn(),
    clickPage: vi.fn(),
    change: vi.fn(),
    crop: vi.fn(),
    doubleClick: vi.fn(),
    endCrop: vi.fn(),
    endGesture: vi.fn(),
    gesture: vi.fn(),
  };
  const editor = new EditorStage(container, callbacks);
  editor.resize(800, 500);
  const fullView: StageView = {
    zine,
    spread: 1,
    assets: { images: new Map() },
    selectedId: null,
    mode: 'idle',
    showGuides: true,
    ...view,
  };
  editor.update(fullView);
  const surface = container.querySelector('.konvajs-content') as HTMLElement;
  /** Box pixels of a point in spread mm (for userEvent `position`). */
  const at = (x: number, y: number) => {
    const v = editor.viewport();
    return { x: v.originX + x * v.scale, y: v.originY + y * v.scale };
  };
  const cleanup = () => {
    editor.destroy();
    container.remove();
  };
  return { editor, callbacks, surface, at, view: fullView, container, cleanup };
}
