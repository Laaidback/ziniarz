export interface StorageUsage {
  usage: number;
  quota: number;
}

/** Above this share of the quota the zine list warns that space is running out. */
export const NEARLY_FULL = 0.9;

/** Asks the browser not to evict our data under storage pressure. Never throws. */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    return (await navigator.storage.persisted()) || (await navigator.storage.persist());
  } catch {
    return false;
  }
}

let persistence: Promise<boolean> | null = null;

/** requestPersistentStorage, asked once per page load (App asks at start; the zine list reads the answer). */
export function persistentStorage(): Promise<boolean> {
  persistence ??= requestPersistentStorage();
  return persistence;
}

/** For tests: the next persistentStorage() asks the browser again. */
export function forgetPersistentStorageAnswer(): void {
  persistence = null;
}

/** Shown on the zine list when the browser may evict our data. */
export const NOT_PERSISTENT_HINT = 'Przeglądarka może kiedyś usunąć ziny. Zapisuj co jakiś czas pliki .zin.';

export async function storageUsage(): Promise<StorageUsage | null> {
  try {
    const estimate = await navigator.storage?.estimate?.();
    return estimate?.usage !== undefined && estimate.quota ? { usage: estimate.usage, quota: estimate.quota } : null;
  } catch {
    return null;
  }
}

/** "0 B", "1,5 MB", "12 MB", "2 GB" (decimal units, Polish decimal comma). */
export function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000;
    unit++;
  }
  const text = unit === 0 ? String(Math.round(value)) : value.toLocaleString('pl-PL', { maximumFractionDigits: value < 10 ? 1 : 0 });
  return `${text} ${units[unit]}`;
}

export function usageText(usage: StorageUsage): string {
  return `Zajęte miejsce: ${formatBytes(usage.usage)} z ${formatBytes(usage.quota)}`;
}

export function isNearlyFull(usage: StorageUsage): boolean {
  return usage.usage / usage.quota >= NEARLY_FULL;
}
