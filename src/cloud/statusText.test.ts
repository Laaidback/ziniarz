import { expect, test } from 'vitest';
import { CloudError } from './errors';
import { cloudStatusView } from './statusText';

const now = new Date('2026-10-21T12:00:00.000Z');
const change = { modifiedTime: '2026-10-21T11:50:00.000Z', modifiedBy: 'Ola', modifiedByMe: false };

test('status texts and buttons', () => {
  expect(cloudStatusView({ state: 'synced', change }, true, now)).toEqual({
    text: 'Zapisano na Dysku',
    tone: 'ok',
    action: null,
    detail: 'Ostatnia zmiana: Ola, 10 min temu',
  });
  expect(cloudStatusView({ state: 'pending' }, true, now).text).toBe('Zmiany czekają na zapis na Dysku');
  expect(cloudStatusView({ state: 'syncing' }, false, now).text).toBe('Zapisywanie na Dysku…');
  expect(cloudStatusView({ state: 'synced' }, false, now)).toMatchObject({ text: 'Zaloguj się, żeby zapisać na Dysku', action: 'signIn' });
  expect(cloudStatusView({ state: 'error', error: new CloudError('auth') }, true, now).action).toBe('signIn');
  expect(cloudStatusView({ state: 'remoteNewer', change }, true, now).action).toBe('load');
  expect(cloudStatusView({ state: 'conflict' }, true, now).action).toBe('choose');
  expect(cloudStatusView({ state: 'error', error: new CloudError('offline') }, true, now)).toMatchObject({
    text: 'Brak internetu, zapiszę później',
    action: 'retry',
  });
  expect(cloudStatusView({ state: 'error', error: new CloudError('notFound') }, true, now).action).toBe('relink');
  expect(cloudStatusView({ state: 'error', error: new CloudError('forbidden') }, true, now).action).toBeNull();
  expect(cloudStatusView(undefined, true, now).text).toBe('Na Dysku Google');
});
