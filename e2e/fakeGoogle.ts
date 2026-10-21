import type { BrowserContext } from '@playwright/test';
import type { FakeDriveServer } from '../src/test/fakeDriveServer';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Upload-Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, OPTIONS',
  'Access-Control-Expose-Headers': 'Location',
};

/** Google Identity Services: signing in gives the person's name as the token at once. */
const gisScript = (user: string) => `
  window.google = window.google || {};
  window.google.accounts = {
    oauth2: {
      initTokenClient(config) {
        return {
          requestAccessToken() {
            setTimeout(() => config.callback({ access_token: ${JSON.stringify(user)}, expires_in: 3600 }), 0);
          },
        };
      },
      hasGrantedAllScopes() {
        return true;
      },
    },
  };
`;

/** The Google Picker: "picks" the next file the test queued (asking the fake Drive, which grants access). */
const pickerScript = (user: string) => `
  window.gapi = {
    load(name, options) {
      class DocsView {
        setMimeTypes() { return this; }
        setIncludeFolders() { return this; }
        setOwnedByMe() { return this; }
        setMode() { return this; }
      }
      class PickerBuilder {
        setOAuthToken() { return this; }
        setDeveloperKey() { return this; }
        setAppId() { return this; }
        setLocale() { return this; }
        setTitle() { return this; }
        addView() { return this; }
        setCallback(callback) { this.callback = callback; return this; }
        build() {
          const callback = this.callback;
          return {
            setVisible() {
              fetch('https://www.googleapis.com/__fake/pick?user=' + encodeURIComponent(${JSON.stringify(user)}))
                .then((response) => response.json())
                .then(({ id }) => callback(id ? { action: 'picked', docs: [{ id }] } : { action: 'cancel' }));
            },
          };
        }
      }
      window.google = window.google || {};
      window.google.picker = {
        DocsView,
        PickerBuilder,
        ViewId: { DOCS: 'docs' },
        DocsViewMode: { LIST: 'list' },
        Action: { PICKED: 'picked', CANCEL: 'cancel' },
      };
      options.callback();
    },
  };
`;

/**
 * Stands in for Google in one browser context (one person): the sign-in and picker scripts, and Drive's
 * REST API backed by `server`, shared between contexts. `picks` queues what the picker returns.
 */
export async function installFakeGoogle(context: BrowserContext, server: FakeDriveServer, user: string) {
  const picks: string[] = [];
  await context.route('https://accounts.google.com/gsi/client', (route) =>
    route.fulfill({ contentType: 'text/javascript', body: gisScript(user) }),
  );
  await context.route('https://apis.google.com/js/api.js', (route) =>
    route.fulfill({ contentType: 'text/javascript', body: pickerScript(user) }),
  );
  await context.route('https://www.googleapis.com/**', async (route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    if (request.url().startsWith('https://www.googleapis.com/__fake/pick')) {
      const id = picks.shift() ?? null;
      if (id) server.pick(id, user);
      return route.fulfill({ headers: CORS, contentType: 'application/json', body: JSON.stringify({ id }) });
    }
    const response = server.handle({
      method: request.method(),
      url: request.url(),
      headers: await request.allHeaders(),
      body: request.postDataBuffer() ? new Uint8Array(request.postDataBuffer()!) : null,
    });
    return route.fulfill({
      status: response.status,
      headers: { ...CORS, ...response.headers },
      body: typeof response.body === 'string' ? response.body : Buffer.from(response.body),
    });
  });
  return { picks };
}
