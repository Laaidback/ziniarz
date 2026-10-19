import { useEffect, useRef, type KeyboardEvent, type PointerEvent } from 'react';

const STEP = 20;
const BIG_STEP = 60;
const DRAGGING_CLASS = 'resizing-column';

interface ColumnResizerProps {
  /** The edge of the column the bar sits on: dragging away from the column (and its arrow key) widens it. */
  side: 'left' | 'right';
  /** Accessible name, e.g. "Szerokość notatnika". */
  label: string;
  /** Current width in px, with the limits it can be dragged between. */
  value: number;
  min: number;
  max: number;
  onChange(width: number): void;
  /** Double click: back to the default width. */
  onReset(): void;
}

/** A bar on a side column's edge: drag it (or use the arrow keys) to make the column wider or narrower. */
export function ColumnResizer({ side, label, value, min, max, onChange, onReset }: ColumnResizerProps) {
  const drag = useRef<{ startX: number; startWidth: number } | null>(null);
  // Dragging towards the canvas narrows the column, away from it widens it.
  const widening = side === 'left' ? -1 : 1;

  // Never leave the page unselectable if the editor closes mid-drag.
  useEffect(() => () => document.body.classList.remove(DRAGGING_CLASS), []);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { startX: event.clientX, startWidth: value };
    document.body.classList.add(DRAGGING_CLASS);
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const start = drag.current;
    if (start) onChange(start.startWidth + widening * (event.clientX - start.startX));
  };
  const endDrag = () => {
    drag.current = null;
    document.body.classList.remove(DRAGGING_CLASS);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? BIG_STEP : STEP;
    const widenKey = side === 'left' ? 'ArrowLeft' : 'ArrowRight';
    const narrowKey = side === 'left' ? 'ArrowRight' : 'ArrowLeft';
    if (event.key === widenKey) onChange(value + step);
    else if (event.key === narrowKey) onChange(value - step);
    else if (event.key === 'Home') onChange(min);
    else if (event.key === 'End') onChange(max);
    else return;
    event.preventDefault();
  };

  return (
    <div
      className={`column-resizer edge-${side}`}
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      title="Przeciągnij, żeby zmienić szerokość (dwuklik: domyślna)"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onLostPointerCapture={endDrag}
      onDoubleClick={onReset}
      onKeyDown={onKeyDown}
    />
  );
}
