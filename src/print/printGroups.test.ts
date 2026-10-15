import { expect, test } from 'vitest';
import type { PrintSettings } from '../model/types';
import { printGroups } from './printGroups';

const base: PrintSettings = {
  bleed: true,
  cropMarks: true,
  foldMarks: true,
  rotateBacks: false,
  duplex: 'auto',
  manualReverseBacks: true,
};

const order = (group: ReturnType<typeof printGroups>[number]) =>
  group.sides.map((p) => `${p.side.sheet}${p.side.face[0]}${p.rotate180 ? 'R' : ''}`);

test('automatic duplex: one file, front and back of each sheet in turn', () => {
  const groups = printGroups(3, base);
  expect(groups.map((g) => g.suffix)).toEqual(['druk']);
  expect(order(groups[0])).toEqual(['0f', '0b', '1f', '1b', '2f', '2b']);
});

test('rotateBacks turns only the backs', () => {
  const groups = printGroups(2, { ...base, rotateBacks: true });
  expect(order(groups[0])).toEqual(['0f', '0bR', '1f', '1bR']);
});

test('manual duplex: fronts in order, backs reversed by default', () => {
  const groups = printGroups(3, { ...base, duplex: 'manual' });
  expect(groups.map((g) => g.suffix)).toEqual(['przody', 'tyly']);
  expect(order(groups[0])).toEqual(['0f', '1f', '2f']);
  expect(order(groups[1])).toEqual(['2b', '1b', '0b']);
});

test('manual duplex without reversing keeps the backs in sheet order', () => {
  const groups = printGroups(3, { ...base, duplex: 'manual', manualReverseBacks: false, rotateBacks: true });
  expect(order(groups[0])).toEqual(['0f', '1f', '2f']);
  expect(order(groups[1])).toEqual(['0bR', '1bR', '2bR']);
});

test('automatic duplex ignores manualReverseBacks', () => {
  const groups = printGroups(2, { ...base, manualReverseBacks: false });
  expect(order(groups[0])).toEqual(['0f', '0b', '1f', '1b']);
});
