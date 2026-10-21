import { expect, test } from 'vitest';
import { decideSync, lastChangeText, timeAgo } from './sync';

test('decideSync: upload local changes, download remote ones, ask when both changed', () => {
  expect(decideSync(false, false)).toBe('none');
  expect(decideSync(true, false)).toBe('upload');
  expect(decideSync(false, true)).toBe('download');
  expect(decideSync(true, true)).toBe('conflict');
});

const now = new Date('2026-10-21T12:00:00.000Z');

test('timeAgo', () => {
  expect(timeAgo('2026-10-21T11:59:30.000Z', now)).toBe('przed chwilą');
  expect(timeAgo('2026-10-21T11:59:00.000Z', now)).toBe('1 min temu');
  expect(timeAgo('2026-10-21T11:15:00.000Z', now)).toBe('45 min temu');
  expect(timeAgo('2026-10-21T09:00:00.000Z', now)).toBe('3 godz. temu');
  expect(timeAgo('2026-10-19T09:00:00.000Z', now)).toMatch(/19 października 2026/);
  expect(timeAgo('nie data', now)).toBe('');
});

test('lastChangeText names the person, or "ty" for the signed-in one', () => {
  const change = { modifiedTime: '2026-10-21T11:50:00.000Z', modifiedBy: 'Ola', modifiedByMe: false };
  expect(lastChangeText(change, now)).toBe('Ostatnia zmiana: Ola, 10 min temu');
  expect(lastChangeText({ ...change, modifiedByMe: true }, now)).toBe('Ostatnia zmiana: ty, 10 min temu');
  expect(lastChangeText({ ...change, modifiedBy: null }, now)).toBe('Ostatnia zmiana: 10 min temu');
});
