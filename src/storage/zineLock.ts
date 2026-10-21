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

/**
 * Asks for the shared lock and holds it until `release` is called. `granted` resolves once it is held:
 * while the zine list holds the lock exclusively (cleanup, or a download from Google Drive), a screen
 * waits for it before reading its zine, so it never shows a copy that is about to be replaced.
 * Without Web Locks it does nothing and `granted` is resolved.
 */
export function acquireOpenZineLock(
  dbName: string,
  locks: LockManager | null = browserLocks(),
): { release(): void; granted: Promise<void> } {
  if (!locks) return { release: () => {}, granted: Promise.resolve() };
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  let grant!: () => void;
  const granted = new Promise<void>((resolve) => (grant = resolve));
  locks
    .request(openZineLockName(dbName), { mode: 'shared' }, () => {
      grant();
      return held;
    })
    .catch(() => grant());
  return { release, granted };
}

/** Holds the shared lock until the returned function is called. Without Web Locks it does nothing. */
export function holdOpenZineLock(dbName: string, locks: LockManager | null = browserLocks()): () => void {
  return acquireOpenZineLock(dbName, locks).release;
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
