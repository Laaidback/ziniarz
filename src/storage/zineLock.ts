import { DB_NAME } from './db';

/**
 * Tabs share one database, so the zine list in one tab must not delete photos or fonts a zine open
 * in another tab still needs. Every screen with a zine open (editor, print, 3D) holds this Web Lock
 * in shared mode; cleanup runs only when it can take it exclusively at once.
 */
export const OPEN_ZINE_LOCK = 'ziniarz-open-zine';

/** The lock guards one database; test databases get their own, so parallel test files do not block each other. */
export function openZineLockName(dbName: string): string {
  return dbName === DB_NAME ? OPEN_ZINE_LOCK : `${OPEN_ZINE_LOCK}:${dbName}`;
}

const browserLocks = (): LockManager | null => (typeof navigator !== 'undefined' && navigator.locks) || null;

/** Holds the shared lock until the returned function is called. Without Web Locks it does nothing. */
export function holdOpenZineLock(dbName: string, locks: LockManager | null = browserLocks()): () => void {
  if (!locks) return () => {};
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  locks.request(openZineLockName(dbName), { mode: 'shared' }, () => held).catch(() => {});
  return release;
}

/**
 * Runs `work` only while no tab has a zine of this database open, and says whether it ran.
 * Without Web Locks (old browsers) it just runs, as before.
 */
export async function whenNoZineIsOpen(
  dbName: string,
  work: () => Promise<unknown>,
  locks: LockManager | null = browserLocks(),
): Promise<boolean> {
  if (!locks) {
    await work();
    return true;
  }
  return locks.request(openZineLockName(dbName), { mode: 'exclusive', ifAvailable: true }, async (lock) => {
    if (!lock) return false;
    await work();
    return true;
  });
}
