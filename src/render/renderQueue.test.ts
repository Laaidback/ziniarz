import { expect, test, vi } from 'vitest';
import { createRenderQueue } from './renderQueue';

const tick = () => new Promise((resolve) => setTimeout(resolve, 5));

test('jobs run one at a time, in order', async () => {
  const log: string[] = [];
  const queue = createRenderQueue();
  queue.add(async () => {
    log.push('a start');
    await tick();
    log.push('a end');
  });
  queue.add(() => void log.push('b'));
  expect(log).toEqual([]); // nothing runs synchronously
  await queue.idle();
  expect(log).toEqual(['a start', 'a end', 'b']);
});

test('the browser gets a turn between jobs', async () => {
  const log: string[] = [];
  const queue = createRenderQueue();
  queue.add(() => {
    log.push('a');
    setTimeout(() => log.push('browser turn'), 0);
  });
  queue.add(() => void log.push('b'));
  await queue.idle();
  expect(log).toEqual(['a', 'browser turn', 'b']);
});

test('cancelling one of two identical queued jobs drops only that entry', async () => {
  const log: string[] = [];
  const queue = createRenderQueue();
  queue.add(() => void log.push('first'));
  const job = () => void log.push('twice');
  const cancelFirst = queue.add(job);
  queue.add(job);
  cancelFirst();
  cancelFirst(); // a second call must not drop the other entry
  await queue.idle();
  expect(log).toEqual(['first', 'twice']);
});

test('a cancelled job never runs; clear drops everything waiting', async () => {
  const log: string[] = [];
  const queue = createRenderQueue();
  queue.add(() => void log.push('a'));
  const cancelB = queue.add(() => void log.push('b'));
  queue.add(() => void log.push('c'));
  cancelB();
  await queue.idle();
  expect(log).toEqual(['a', 'c']);

  queue.add(() => void log.push('d'));
  queue.clear();
  await queue.idle();
  expect(log).toEqual(['a', 'c']);
});

test('a failing job does not stop the next one', async () => {
  const error = vi.spyOn(console, 'error').mockImplementation(() => {});
  const log: string[] = [];
  const queue = createRenderQueue();
  queue.add(() => {
    throw new Error('broken page');
  });
  queue.add(() => void log.push('next'));
  await queue.idle();
  expect(log).toEqual(['next']);
  expect(error).toHaveBeenCalled();
  error.mockRestore();
});
