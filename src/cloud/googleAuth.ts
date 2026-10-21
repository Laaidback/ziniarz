import { setSignedIn } from './authStore';
import { CloudError } from './errors';
import { loadScript } from './scripts';

/** Signing in to Google for Drive. `signIn` opens Google's window, so call it only from a click. */
export interface CloudAuth {
  /** A valid token, or null. */
  token(): string | null;
  /** Loads Google's script ahead of a click, so `signIn` can open its window at once (Safari blocks late windows). */
  prepare(): void;
  /** Returns a valid token, asking the person to sign in when there is none. Throws CloudError. */
  signIn(): Promise<string>;
  /** Drops a token Google rejected. */
  forget(): void;
}

export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const GIS_URL = 'https://accounts.google.com/gsi/client';
const STORAGE_KEY = 'ziniarz.googleToken';
/** A token is treated as expired a minute early, so a slow upload does not run out halfway. */
const EARLY_MS = 60_000;

interface TokenResponse {
  access_token?: string;
  expires_in?: number | string;
  error?: string;
}

interface TokenClient {
  requestAccessToken(options?: { prompt?: string }): void;
}

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2: {
          initTokenClient(config: {
            client_id: string;
            scope: string;
            callback(response: TokenResponse): void;
            error_callback?(error: { type?: string }): void;
          }): TokenClient;
          hasGrantedAllScopes(response: TokenResponse, ...scopes: string[]): boolean;
        };
      };
    };
  }
}

interface StoredToken {
  token: string;
  expiresAt: number;
}

function readStored(): StoredToken | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? 'null') as StoredToken | null;
    return value && typeof value.token === 'string' && typeof value.expiresAt === 'number' ? value : null;
  } catch {
    return null;
  }
}

function writeStored(value: StoredToken | null): void {
  try {
    if (value) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // private mode: the token lives only in memory
  }
}

/**
 * Google Identity Services token client. The token is kept in memory and in sessionStorage (this tab only),
 * so reloading the page does not ask again; it lasts about an hour, then the next sign-in needs a click.
 */
export function createGoogleAuth(clientId: string, now: () => number = Date.now): CloudAuth {
  let current: StoredToken | null = readStored();
  let expiryTimer: ReturnType<typeof setTimeout> | null = null;
  let client: TokenClient | null = null;
  let pending: { resolve(token: string): void; reject(error: unknown): void } | null = null;

  const valid = () => (current && current.expiresAt - EARLY_MS > now() ? current.token : null);

  const set = (value: StoredToken | null) => {
    current = value;
    writeStored(value);
    if (expiryTimer !== null) clearTimeout(expiryTimer);
    expiryTimer = null;
    setSignedIn(valid() !== null);
    if (value) expiryTimer = setTimeout(() => setSignedIn(valid() !== null), Math.max(0, value.expiresAt - EARLY_MS - now()));
  };
  set(valid() ? current : null);

  const settle = (outcome: { token: string } | { error: CloudError }) => {
    const waiting = pending;
    pending = null;
    if (!waiting) return;
    if ('token' in outcome) waiting.resolve(outcome.token);
    else waiting.reject(outcome.error);
  };

  const ready = async (): Promise<TokenClient> => {
    if (client) return client;
    try {
      await loadScript(GIS_URL);
    } catch {
      throw new CloudError('offline', 'Nie da się połączyć z Google. Sprawdź internet.');
    }
    const oauth2 = window.google?.accounts?.oauth2;
    if (!oauth2) throw new CloudError('other');
    client = oauth2.initTokenClient({
      client_id: clientId,
      scope: DRIVE_SCOPE,
      callback(response) {
        if (!response.access_token || response.error) {
          settle({ error: new CloudError('cancelled') });
        } else if (!oauth2.hasGrantedAllScopes(response, DRIVE_SCOPE)) {
          settle({ error: new CloudError('cancelled', 'Zaznacz w oknie Google dostęp do plików Ziniarza na Dysku.') });
        } else {
          set({ token: response.access_token, expiresAt: now() + Number(response.expires_in ?? 3600) * 1000 });
          settle({ token: response.access_token });
        }
      },
      error_callback(error) {
        settle({
          error:
            error.type === 'popup_failed_to_open'
              ? new CloudError('cancelled', 'Przeglądarka zablokowała okno logowania Google. Pozwól tej stronie otwierać okienka.')
              : new CloudError('cancelled'),
        });
      },
    });
    return client;
  };

  const request = (tokenClient: TokenClient) =>
    new Promise<string>((resolve, reject) => {
      pending?.reject(new CloudError('cancelled'));
      pending = { resolve, reject };
      // An empty prompt asks for consent only the first time.
      tokenClient.requestAccessToken({ prompt: '' });
    });

  return {
    token: valid,
    prepare() {
      void ready().catch(() => {});
    },
    signIn() {
      const token = valid();
      if (token) return Promise.resolve(token);
      // Loaded already: open Google's window within the click itself.
      if (client) return request(client);
      return ready().then(request);
    },
    forget() {
      set(null);
    },
  };
}
