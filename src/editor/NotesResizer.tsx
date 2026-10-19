import { useEffect, useRef, type KeyboardEvent, type PointerEvent } from 'react';
import type { NotesWidth } from './notesWidth';

const STEP = 20;
const BIG_STEP = 60;
const DRAGGING_CLASS = 'resizing-notes';

/** A bar on the notepad's left edge: drag it (or use the arrow keys) to make the notepad wider or narrower. */
export function NotesResizer({ width, min, max, set, reset }: NotesWidth) {
  const drag = useRef<{ startX: number; startWidth: number } | null>(null);

  // Never leave the page unselectable if the editor closes mid-drag.
  useEffect(() => () => document.body.classList.remove(DRAGGING_CLASS), []);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { startX: event.clientX, startWidth: width };
    document.body.classList.add(DRAGGING_CLASS);
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const start = drag.current;
    if (start) set(start.startWidth + (start.startX - event.clientX)); // dragging left widens
  };
  const endDrag = () => {
    drag.current = null;
    document.body.classList.remove(DRAGGING_CLASS);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? BIG_STEP : STEP;
    if (event.key === 'ArrowLeft') set(width + step);
    else if (event.key === 'ArrowRight') set(width - step);
    else if (event.key === 'Home') set(min);
    else if (event.key === 'End') set(max);
    else return;
    event.preventDefault();
  };

  return (
    <div
      className="notes-resizer"
      role="separator"
      aria-orientation="vertical"
      aria-label="Szerokość notatnika"
      aria-valuenow={width}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      title="Przeciągnij, żeby zmienić szerokość notatnika (dwuklik: domyślna)"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onLostPointerCapture={endDrag}
      onDoubleClick={reset}
      onKeyDown={onKeyDown}
    />
  );
}
