import { expect, test } from 'vitest';
import { googleConfig } from './config';

test('googleConfig needs all three ids', () => {
  const env = { VITE_GOOGLE_CLIENT_ID: ' id ', VITE_GOOGLE_API_KEY: 'key', VITE_GOOGLE_APP_ID: '123' };
  expect(googleConfig(env)).toEqual({ clientId: 'id', apiKey: 'key', appId: '123' });
  expect(googleConfig({ ...env, VITE_GOOGLE_APP_ID: '' })).toBeNull();
  expect(googleConfig({})).toBeNull();
});
