export type SyncAction = 'none' | 'upload' | 'download' | 'conflict';

/**
 * What to do with a zine saved on Drive: `localChanged` means the zine changed since the last sync
 * (its `updatedAt` differs from the link's), `remoteChanged` that the file on Drive did (its version differs).
 */
export function decideSync(localChanged: boolean, remoteChanged: boolean): SyncAction {
  if (localChanged) return remoteChanged ? 'conflict' : 'upload';
  return remoteChanged ? 'download' : 'none';
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/** "przed chwilą", "5 min temu", "3 godz. temu", or the date for anything older than a day. */
export function timeAgo(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  const ms = now.getTime() - then.getTime();
  if (Number.isNaN(ms)) return '';
  if (ms < MINUTE) return 'przed chwilą';
  if (ms < HOUR) return `${Math.floor(ms / MINUTE)} min temu`;
  if (ms < 24 * HOUR) return `${Math.floor(ms / HOUR)} godz. temu`;
  return then.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Who changed the file on Drive last, as Drive reports it; `me` is the signed-in person. */
export interface LastChange {
  modifiedTime: string;
  modifiedBy: string | null;
  modifiedByMe: boolean;
}

/** "Ostatnia zmiana: Ola, 10 min temu". */
export function lastChangeText(change: LastChange, now: Date = new Date()): string {
  const who = change.modifiedByMe ? 'ty' : change.modifiedBy;
  const when = timeAgo(change.modifiedTime, now);
  return `Ostatnia zmiana: ${[who, when].filter(Boolean).join(', ')}`;
}
