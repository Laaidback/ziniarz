import { expect, test } from 'vitest';
import { breakMerge, canRedo, canUndo, createHistory, HISTORY_LIMIT, record, redo, replacePresent, undo } from './history';

test('undo and redo walk through recorded states', () => {
  let h = createHistory('a');
  h = record(h, 'b');
  h = record(h, 'c');
  h = undo(h);
  expect(h.present).toBe('b');
  h = undo(h);
  expect(h.present).toBe('a');
  expect(canUndo(h)).toBe(false);
  h = redo(h);
  expect(h.present).toBe('b');
  expect(canRedo(h)).toBe(true);
});

test('recording after an undo drops the redo branch', () => {
  let h = record(record(createHistory('a'), 'b'), 'c');
  h = record(undo(h), 'x');
  expect(h.future).toEqual([]);
  expect(undo(h).present).toBe('b');
});

test('changes with the same key merge into one step; other keys do not', () => {
  let h = createHistory('');
  h = record(h, 'A', 'title');
  h = record(h, 'Al', 'title');
  h = record(h, 'Ala', 'title');
  expect(undo(h).present).toBe('');
  h = record(h, 'Ala!', null);
  h = record(h, 'Ala!!', null);
  expect(undo(h).present).toBe('Ala!');
});

test('a key does not merge across an undo', () => {
  let h = record(record(createHistory(0), 1, 'k'), 2, 'k');
  h = undo(h);
  h = record(h, 5, 'k');
  expect(h.past).toEqual([0]);
});

test(`keeps at most ${HISTORY_LIMIT} undo steps`, () => {
  let h = createHistory(0);
  for (let i = 1; i <= 150; i++) h = record(h, i);
  expect(h.past).toHaveLength(HISTORY_LIMIT);
  expect(h.past[0]).toBe(50);
});

test('recording the same value or replacing the present adds no step', () => {
  const h = createHistory('a');
  expect(record(h, 'a')).toBe(h);
  expect(replacePresent(h, 'b')).toEqual({ past: [], present: 'b', future: [], lastKey: null });
});

test('breakMerge makes the next change with the same key a new step', () => {
  let h = record(createHistory(0), 1, 'k');
  h = breakMerge(h);
  h = record(h, 2, 'k');
  expect(h.past).toEqual([0, 1]);
});

test('breakMerge returns the same history when nothing is being merged', () => {
  const h = createHistory(0);
  expect(breakMerge(h)).toBe(h);
});
