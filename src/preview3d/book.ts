
/** Duration of one page turn. */
export const TURN_MS = 600;
/** Thickness of one leaf (half a sheet), mm: keeps stacked pages from fighting for the same depth. */
export const PAPER_MM = 0.15;

export interface Turn {
  leaf: number;
  /** Angles in radians: 0 = lying on the right, π = turned to the left. */
  from: number;
  to: number;
  startedAt: number;
}

/**
 * The folded zine as rigid leaves hinged at the spine. Leaf `j` carries page 2j + 1 on its
 * front and 2j + 2 on its back; the leaves j and leaves − 1 − j are the two halves of one sheet.
 * `turned` leaves lie on the left, so the reader sees spread `turned`.
 */
export interface BookState {
  leaves: number;
  turned: number;
  turns: Turn[];
}

export function leafCount(sheets: number): number {
  return 2 * sheets;
}

export function leafPages(leaf: number): { front: number; back: number } {
  return { front: 2 * leaf + 1, back: 2 * leaf + 2 };
}

/** Which sheet (0 = outermost) a leaf is half of. */
export function sheetOfLeaf(leaf: number, leaves: number): number {
  return Math.min(leaf, leaves - 1 - leaf);
}

export function closedBook(sheets: number): BookState {
  return { leaves: leafCount(sheets), turned: 0, turns: [] };
}

export function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}

function restingAngle(state: BookState, leaf: number): number {
  return leaf < state.turned ? Math.PI : 0;
}

export function leafAngle(state: BookState, leaf: number, now: number): number {
  const turn = state.turns.find((t) => t.leaf === leaf);
  if (!turn) return restingAngle(state, leaf);
  const progress = (now - turn.startedAt) / TURN_MS;
  if (progress >= 1) return turn.to;
  if (progress <= 0) return turn.from;
  return turn.from + (turn.to - turn.from) * easeInOut(progress);
}

/** True while a leaf is still moving (the scene keeps drawing frames until then). */
export function isTurning(state: BookState, now: number): boolean {
  return state.turns.some((t) => now - t.startedAt < TURN_MS);
}

/** Starts turning the next leaf forward or the last turned leaf back; at either cover nothing happens. */
export function turnPage(state: BookState, forward: boolean, now: number): BookState {
  if (forward ? state.turned >= state.leaves : state.turned <= 0) return state;
  const leaf = forward ? state.turned : state.turned - 1;
  const turn: Turn = { leaf, from: leafAngle(state, leaf, now), to: forward ? Math.PI : 0, startedAt: now };
  return {
    ...state,
    turned: state.turned + (forward ? 1 : -1),
    turns: [...state.turns.filter((t) => t.leaf !== leaf && now - t.startedAt < TURN_MS), turn],
  };
}

/** Height of a leaf above the cover plane: right stack has leaf 0 on top, left stack the last turned leaf. */
export function leafLift(leaf: number, angle: number, leaves: number): number {
  const right = (leaves - 1 - leaf) * PAPER_MM;
  const left = leaf * PAPER_MM;
  return right + (left - right) * (angle / Math.PI);
}

/** What the reader sees with `turned` leaves turned: the front cover, two pages, or the back cover. */
export function spreadCaption(turned: number, sheets: number): string {
  if (turned === 0) return 'Okładka';
  if (turned === leafCount(sheets)) return 'Tył';
  return `Strony ${2 * turned}–${2 * turned + 1}`;
}
