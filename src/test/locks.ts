import { openZineLockName } from '../storage/zineLock';

/** Whether some screen holds the open-zine lock of this database (shared mode). */
export async function openZineLockHeld(dbName: string): Promise<boolean> {
  const { held = [] } = await navigator.locks.query();
  return held.some((lock) => lock.name === openZineLockName(dbName) && lock.mode === 'shared');
}
