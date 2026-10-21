import type { ZineCloudStatus } from './cloudStatus';
import { lastChangeText } from './sync';

/** A button next to the status: what the person can do about it. */
export type CloudStatusAction = 'signIn' | 'load' | 'choose' | 'relink' | 'retry';

export interface CloudStatusView {
  text: string;
  tone: 'ok' | 'busy' | 'alert' | 'quiet';
  /** Who changed the file last, and the full error, for the tooltip. */
  detail: string;
  action: CloudStatusAction | null;
}

/** What a linked zine's status says, in the editor and on its card. */
export function cloudStatusView(status: ZineCloudStatus | undefined, signedIn: boolean, now: Date = new Date()): CloudStatusView {
  const change = status?.change ? lastChangeText(status.change, now) : '';
  const view = (text: string, tone: CloudStatusView['tone'], action: CloudStatusAction | null = null, extra = '') => ({
    text,
    tone,
    action,
    detail: [extra, change].filter(Boolean).join('\n'),
  });
  if (status?.state === 'syncing') return view('Zapisywanie na Dysku…', 'busy');
  if (!signedIn || (status?.state === 'error' && status.error.kind === 'auth')) {
    return view('Zaloguj się, żeby zapisać na Dysku', 'alert', 'signIn');
  }
  switch (status?.state) {
    case undefined:
      return view('Na Dysku Google', 'quiet');
    case 'synced':
      return view('Zapisano na Dysku', 'ok');
    case 'pending':
      return view('Zmiany czekają na zapis na Dysku', 'busy');
    case 'remoteNewer':
      return view('Na Dysku jest nowsza wersja', 'alert', 'load');
    case 'conflict':
      return view('Zmiany tutaj i na Dysku', 'alert', 'choose');
    case 'error':
      switch (status.error.kind) {
        case 'offline':
          return view('Brak internetu, zapiszę później', 'alert', 'retry', status.error.message);
        case 'notFound':
          return view('Pliku nie ma już na Dysku', 'alert', 'relink', status.error.message);
        case 'forbidden':
          return view('Tylko do podglądu na Dysku', 'alert', null, status.error.message);
        case 'quota':
          return view('Na Dysku brakuje miejsca', 'alert', 'retry', status.error.message);
        default:
          return view('Nie zapisano na Dysku', 'alert', 'retry', status.error.message);
      }
  }
}

export const ACTION_LABELS: Record<CloudStatusAction, string> = {
  signIn: 'Zaloguj',
  load: 'Wczytaj',
  choose: 'Wybierz wersję',
  relink: 'Zapisz jako nowy plik',
  retry: 'Spróbuj jeszcze raz',
};
