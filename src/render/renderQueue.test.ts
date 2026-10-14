import { expect, test } from 'vitest';
import { createRenderQueue } from './renderQueue';

const tick = () => new Promise((resolve) => setTimeout(resolve, 5));

test('jobs run one at a time, in order, with a pause between them', async () => {
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
  const log: string[] = [];
  const queue = createRenderQueue();
  queue.add(() => {
    throw new Error('broken page');
  });
  queue.add(() => void log.push('next'));
  await queue.idle();
  expect(log).toEqual(['next']);
});
