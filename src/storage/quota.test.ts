import { expect, test } from 'vitest';
import { formatBytes, isNearlyFull, usageText } from './quota';

test('formatBytes', () => {
  expect(formatBytes(0)).toBe('0 B');
  expect(formatBytes(999)).toBe('999 B');
  expect(formatBytes(1_500_000)).toBe('1,5 MB');
  expect(formatBytes(12_345_678)).toBe('12 MB');
  expect(formatBytes(2_000_000_000)).toBe('2 GB');
});

test('usage text and the nearly-full threshold', () => {
  expect(usageText({ usage: 1_500_000, quota: 2_000_000_000 })).toBe('Zajęte miejsce: 1,5 MB z 2 GB');
  expect(isNearlyFull({ usage: 89, quota: 100 })).toBe(false);
  expect(isNearlyFull({ usage: 90, quota: 100 })).toBe(true);
});
