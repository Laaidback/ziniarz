import { expect, test } from 'vitest';
import { holdOpenZineLock, OPEN_ZINE_LOCK, openZineLockName, whenNoZineIsOpen } from './zineLock';

const DB = 'lock-test';

test("the app's database uses the plain lock name", () => {
  expect(openZineLockName('ziniarz')).toBe(OPEN_ZINE_LOCK);
  expect(openZineLockName(DB)).not.toBe(OPEN_ZINE_LOCK);
});

test('work waiting for no open zine is skipped while another tab holds the shared lock', async () => {
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  const acquired = new Promise<void>((resolve) => {
    void navigator.locks.request(openZineLockName(DB), { mode: 'shared' }, () => {
      resolve();
      return held;
    });
  });
  await acquired;
  let ran = false;
  expect(await whenNoZineIsOpen(DB, async () => (ran = true))).toBe(false);
  expect(ran).toBe(false);
  expect(await whenNoZineIsOpen('another-db', async () => {})).toBe(true);

  release();
  await held;
  await expect.poll(() => whenNoZineIsOpen(DB, async () => (ran = true))).toBe(true);
  expect(ran).toBe(true);
});

test('holdOpenZineLock holds the shared lock until released', async () => {
  const release = holdOpenZineLock(DB);
  await expect.poll(async () => (await navigator.locks.query()).held?.some((l) => l.name === openZineLockName(DB))).toBe(true);
  expect(await whenNoZineIsOpen(DB, async () => {})).toBe(false);
  release();
  await expect.poll(() => whenNoZineIsOpen(DB, async () => {})).toBe(true);
});

test('without Web Locks the work just runs', async () => {
  let ran = false;
  expect(await whenNoZineIsOpen(DB, async () => (ran = true), null)).toBe(true);
  expect(ran).toBe(true);
  holdOpenZineLock(DB, null)(); // does nothing, does not throw
});
