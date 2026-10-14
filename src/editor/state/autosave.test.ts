import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createZine } from '../../model/factory';
import type { Zine } from '../../model/types';
import { createAutosaver, whenSavesSettled } from './autosave';

const NOW = new Date('2026-10-14T12:00:00.000Z');

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

test('saves once, 500 ms after the last change, with a fresh updatedAt', async () => {
  const save = vi.fn(async (_zine: Zine) => {});
  const saver = createAutosaver(save, { onError: vi.fn(), now: () => NOW });
  const zine = createZine('A', 1);
  saver.schedule(zine);
  await vi.advanceTimersByTimeAsync(300);
  saver.schedule({ ...zine, title: 'B' });
  await vi.advanceTimersByTimeAsync(499);
  expect(save).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);
  expect(save).toHaveBeenCalledTimes(1);
  expect(save.mock.calls[0][0]).toMatchObject({ title: 'B', updatedAt: NOW.toISOString() });
});

test('flush saves right away and whenSavesSettled waits for it', async () => {
  let finish!: () => void;
  const save = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
  const saver = createAutosaver(save, { onError: vi.fn() });
  saver.schedule(createZine('A', 1));
  void saver.flush();
  await vi.advanceTimersByTimeAsync(0);
  expect(save).toHaveBeenCalledTimes(1);
  let settled = false;
  void whenSavesSettled().then(() => (settled = true));
  await vi.advanceTimersByTimeAsync(0);
  expect(settled).toBe(false);
  finish();
  await vi.advanceTimersByTimeAsync(0);
  expect(settled).toBe(true);
  await vi.advanceTimersByTimeAsync(1000);
  expect(save).toHaveBeenCalledTimes(1);
});

test('a failed save is reported and later saves still run', async () => {
  const onError = vi.fn();
  const save = vi.fn().mockRejectedValueOnce(new Error('full')).mockResolvedValue(undefined);
  const saver = createAutosaver(save, { onError });
  saver.schedule(createZine('A', 1));
  await saver.flush();
  expect(onError).toHaveBeenCalledTimes(1);
  saver.schedule(createZine('B', 1));
  await saver.flush();
  expect(save).toHaveBeenCalledTimes(2);
});

test('failures in a row are reported once, again only after a save has succeeded', async () => {
  const onError = vi.fn();
  const save = vi
    .fn()
    .mockRejectedValueOnce(new Error('full'))
    .mockRejectedValueOnce(new Error('full'))
    .mockResolvedValueOnce(undefined)
    .mockRejectedValueOnce(new Error('full'));
  const saver = createAutosaver(save, { onError });
  for (const title of ['A', 'B']) {
    saver.schedule(createZine(title, 1));
    await saver.flush();
  }
  expect(onError).toHaveBeenCalledTimes(1);
  for (const title of ['C', 'D']) {
    saver.schedule(createZine(title, 1));
    await saver.flush();
  }
  expect(save).toHaveBeenCalledTimes(4);
  expect(onError).toHaveBeenCalledTimes(2);
});

test('a second save waits until the first one has finished', async () => {
  const finishers: (() => void)[] = [];
  const save = vi.fn((_zine: Zine) => new Promise<void>((resolve) => finishers.push(resolve)));
  const saver = createAutosaver(save, { onError: vi.fn() });
  saver.schedule(createZine('A', 1));
  void saver.flush();
  await vi.advanceTimersByTimeAsync(0);
  saver.schedule(createZine('B', 1));
  void saver.flush();
  await vi.advanceTimersByTimeAsync(1000);
  expect(save).toHaveBeenCalledTimes(1);
  finishers[0]();
  await vi.advanceTimersByTimeAsync(0);
  expect(save).toHaveBeenCalledTimes(2);
  expect(save.mock.calls[1][0]).toMatchObject({ title: 'B' });
  finishers[1]();
  await whenSavesSettled();
});
