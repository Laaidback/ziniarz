import { expect, test } from 'vitest';
import {
  closedBook,
  easeInOut,
  isTurning,
  leafAngle,
  leafCount,
  leafLift,
  leafPages,
  PAPER_MM,
  sheetOfLeaf,
  spreadCaption,
  TURN_MS,
  turnPage,
} from './book';

test('each sheet is two leaves, one on each side of the middle; every page is on one leaf', () => {
  expect(leafCount(5)).toBe(10);
  expect(leafPages(0)).toEqual({ front: 1, back: 2 });
  expect(leafPages(9)).toEqual({ front: 19, back: 20 });
  expect([0, 9].map((leaf) => sheetOfLeaf(leaf, 10))).toEqual([0, 0]);
  expect([4, 5].map((leaf) => sheetOfLeaf(leaf, 10))).toEqual([4, 4]);
  const pages = Array.from({ length: 10 }, (_, leaf) => leafPages(leaf)).flatMap((p) => [p.front, p.back]);
  expect(pages.sort((a, b) => a - b)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
});

test('the book opens on the cover, with every leaf lying on the right', () => {
  const book = closedBook(2);
  expect(book).toEqual({ leaves: 4, turned: 0, turns: [] });
  for (let leaf = 0; leaf < 4; leaf++) expect(leafAngle(book, leaf, 0)).toBe(0);
  expect(spreadCaption(book.turned, 2)).toBe('Okładka');
});

test('turning forward lifts the next leaf over the spine in 0.6 s', () => {
  const start = 1000;
  const book = turnPage(closedBook(2), true, start);
  expect(book.turned).toBe(1);
  expect(spreadCaption(book.turned, 2)).toBe('Strony 2–3');
  expect(leafAngle(book, 0, start)).toBe(0);
  expect(leafAngle(book, 0, start + TURN_MS / 2)).toBeCloseTo(Math.PI / 2);
  expect(leafAngle(book, 0, start + TURN_MS)).toBe(Math.PI);
  expect(leafAngle(book, 1, start + TURN_MS / 2)).toBe(0);
  expect(isTurning(book, start + TURN_MS / 2)).toBe(true);
  expect(isTurning(book, start + TURN_MS)).toBe(false);
});

test('turning back from the open spread brings the leaf back to the right', () => {
  let book = turnPage(closedBook(1), true, 0);
  book = turnPage(book, true, 1000);
  expect(spreadCaption(book.turned, 1)).toBe('Tył');
  book = turnPage(book, false, 5000);
  expect(book.turned).toBe(1);
  expect(leafAngle(book, 1, 5000)).toBe(Math.PI);
  expect(leafAngle(book, 1, 5000 + TURN_MS)).toBe(0);
});

test('nothing turns past the covers', () => {
  const closed = closedBook(1);
  expect(turnPage(closed, false, 0)).toBe(closed);
  const open = turnPage(turnPage(closed, true, 0), true, 0);
  expect(turnPage(open, true, 0)).toBe(open);
});

test('turning back mid-turn starts from where the leaf is, and old turns are dropped', () => {
  let book = turnPage(closedBook(2), true, 0);
  const mid = leafAngle(book, 0, TURN_MS / 2);
  book = turnPage(book, false, TURN_MS / 2);
  expect(book.turned).toBe(0);
  expect(leafAngle(book, 0, TURN_MS / 2)).toBeCloseTo(mid);
  expect(leafAngle(book, 0, TURN_MS * 2)).toBe(0);
  book = turnPage(book, true, 10_000);
  expect(book.turns).toHaveLength(1);
});

test('easing is smooth at both ends', () => {
  expect(easeInOut(0)).toBe(0);
  expect(easeInOut(0.5)).toBeCloseTo(0.5);
  expect(easeInOut(1)).toBe(1);
  expect(easeInOut(0.1)).toBeLessThan(0.1);
});

test('leaves stack by paper thickness: the top leaf is the next one to turn on each side', () => {
  const leaves = 4;
  // Right stack (not turned): leaf 0 on top.
  expect(leafLift(0, 0, leaves)).toBeCloseTo(3 * PAPER_MM);
  expect(leafLift(3, 0, leaves)).toBeCloseTo(0);
  // Left stack (turned): the last turned leaf on top.
  expect(leafLift(3, Math.PI, leaves)).toBeCloseTo(3 * PAPER_MM);
  expect(leafLift(0, Math.PI, leaves)).toBeCloseTo(0);
});
