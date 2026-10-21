/**
 * An in-memory stand-in for the parts of Google Drive's REST API Ziniarz uses, shared by unit tests
 * (through `fetch`) and the end-to-end test (through `handle`, behind Playwright's page.route).
 * The bearer token is the person's display name. Like the `drive.file` scope, a person reaches only
 * files the app created for them or files they picked (`pick`), and picking needs the file to be theirs
 * or shared with them (`share`).
 */

export interface FakeRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: Uint8Array | null;
}

export interface FakeResponse {
  status: number;
  headers: Record<string, string>;
  body: Uint8Array | string;
}

interface FakeFile {
  id: string;
  name: string;
  mimeType: string;
  parents: string[];
  bytes: Uint8Array;
  version: number;
  modifiedTime: string;
  modifiedBy: string;
  owner: string;
  trashed: boolean;
  sharedWith: Map<string, 'reader' | 'writer'>;
  appAccess: Set<string>;
}

interface Session {
  user: string;
  fileId: string | null;
  metadata: { name?: string; mimeType?: string; parents?: string[] };
}

const API = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function createFakeDriveServer() {
  const files = new Map<string, FakeFile>();
  const sessions = new Map<string, Session>();
  let nextId = 1;
  let clock = Date.parse('2026-10-21T10:00:00.000Z');
  let failures: { status: number; reason: string }[] = [];
  let offline = false;
  const requests: string[] = [];

  const json = (status: number, value: unknown, headers: Record<string, string> = {}): FakeResponse => ({
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(value),
  });
  const error = (status: number, reason: string) => json(status, { error: { code: status, errors: [{ reason }] } });

  const now = () => {
    clock += 60_000;
    return new Date(clock).toISOString();
  };

  const metaOf = (file: FakeFile, user: string) => ({
    id: file.id,
    name: file.name,
    version: String(file.version),
    modifiedTime: file.modifiedTime,
    trashed: file.trashed,
    lastModifyingUser: { displayName: file.modifiedBy, me: file.modifiedBy === user },
  });

  const canWrite = (file: FakeFile, user: string) => file.owner === user || file.sharedWith.get(user) === 'writer';

  const reachable = (id: string, user: string): FakeFile | null => {
    const file = files.get(id);
    return file && file.appAccess.has(user) ? file : null;
  };

  function handle(request: FakeRequest): FakeResponse {
    requests.push(`${request.method} ${request.url}`);
    const auth = request.headers.authorization ?? request.headers.Authorization ?? '';
    const user = auth.startsWith('Bearer ') ? decodeURIComponent(auth.slice(7)) : '';
    const failure = failures.shift();
    if (failure) return error(failure.status, failure.reason);
    if (!user) return error(401, 'authError');

    const url = new URL(request.url);
    const path = `${url.origin}${url.pathname}`;
    const body = () => JSON.parse(decoder.decode(request.body ?? new Uint8Array())) as Session['metadata'];

    // Finish an upload session: the bytes of a new or changed file.
    const sessionId = url.searchParams.get('upload_id');
    if (request.method === 'PUT' && sessionId) {
      const session = sessions.get(sessionId);
      if (!session) return error(404, 'notFound');
      sessions.delete(sessionId);
      const bytes = request.body ?? new Uint8Array();
      const modifiedTime = now();
      if (session.fileId === null) {
        const file: FakeFile = {
          id: `file-${nextId++}`,
          name: session.metadata.name ?? 'Bez nazwy',
          mimeType: session.metadata.mimeType ?? 'application/octet-stream',
          parents: session.metadata.parents ?? [],
          bytes,
          version: 1,
          modifiedTime,
          modifiedBy: session.user,
          owner: session.user,
          trashed: false,
          sharedWith: new Map(),
          appAccess: new Set([session.user]),
        };
        files.set(file.id, file);
        return json(200, metaOf(file, session.user));
      }
      const file = files.get(session.fileId)!;
      Object.assign(file, { bytes, version: file.version + 1, modifiedTime, modifiedBy: session.user });
      if (session.metadata.name) file.name = session.metadata.name;
      return json(200, metaOf(file, session.user));
    }

    const startSession = (fileId: string | null): FakeResponse => {
      const id = String(nextId++);
      sessions.set(id, { user, fileId, metadata: body() });
      return json(200, {}, { Location: `${UPLOAD}?uploadType=resumable&upload_id=${id}` });
    };

    if (path === UPLOAD && request.method === 'POST') return startSession(null);
    if (path.startsWith(`${UPLOAD}/`) && request.method === 'PATCH') {
      const file = reachable(decodeURIComponent(path.slice(UPLOAD.length + 1)), user);
      if (!file) return error(404, 'notFound');
      if (!canWrite(file, user)) return error(403, 'insufficientFilePermissions');
      return startSession(file.id);
    }

    if (path === API && request.method === 'GET') {
      // Only the folder lookup uses a query.
      const q = url.searchParams.get('q') ?? '';
      const name = /name='([^']*)'/.exec(q)?.[1];
      const found = [...files.values()].filter(
        (f) => f.mimeType === 'application/vnd.google-apps.folder' && f.name === name && !f.trashed && f.appAccess.has(user),
      );
      return json(200, { files: found.map((f) => ({ id: f.id })) });
    }
    if (path === API && request.method === 'POST') {
      const metadata = body();
      const file: FakeFile = {
        id: `folder-${nextId++}`,
        name: metadata.name ?? '',
        mimeType: metadata.mimeType ?? '',
        parents: [],
        bytes: new Uint8Array(),
        version: 1,
        modifiedTime: now(),
        modifiedBy: user,
        owner: user,
        trashed: false,
        sharedWith: new Map(),
        appAccess: new Set([user]),
      };
      files.set(file.id, file);
      return json(200, { id: file.id });
    }
    if (path.startsWith(`${API}/`) && request.method === 'GET') {
      const file = reachable(decodeURIComponent(path.slice(API.length + 1)), user);
      if (!file) return error(404, 'notFound');
      if (url.searchParams.get('alt') === 'media') {
        return { status: 200, headers: { 'Content-Type': file.mimeType }, body: file.bytes };
      }
      return json(200, metaOf(file, user));
    }
    return error(400, 'badRequest');
  }

  return {
    handle,
    /** Drive over `fetch`; the bearer token is the person's display name. */
    fetch: (async (input: RequestInfo | URL, init?: RequestInit) => {
        if (offline) throw new TypeError('Failed to fetch');
        const headers: Record<string, string> = {};
        new Headers(init?.headers).forEach((value, key) => (headers[key] = value));
        const raw = init?.body;
        const body =
          raw == null ? null : typeof raw === 'string' ? encoder.encode(raw) : new Uint8Array(raw as ArrayBuffer | Uint8Array);
        const response = handle({ method: init?.method ?? 'GET', url: String(input), headers, body });
        return new Response(response.body as BodyInit, { status: response.status, headers: response.headers });
    }) as typeof fetch,
    /** Shares a file like Drive's "Share" dialog; the person still has to pick it in Ziniarz. */
    share(fileId: string, user: string, role: 'reader' | 'writer' = 'writer') {
      files.get(fileId)!.sharedWith.set(user, role);
    },
    /** What the Google Picker does: gives the app access to a file the person can see. */
    pick(fileId: string, user: string): boolean {
      const file = files.get(fileId);
      if (!file || (file.owner !== user && !file.sharedWith.has(user))) return false;
      file.appAccess.add(user);
      return true;
    },
    /** Someone else changes the file on Drive. */
    replaceBytes(fileId: string, bytes: Uint8Array, user: string) {
      const file = files.get(fileId)!;
      Object.assign(file, { bytes, version: file.version + 1, modifiedTime: now(), modifiedBy: user });
    },
    trash(fileId: string) {
      files.get(fileId)!.trashed = true;
    },
    failNext(status: number, reason = '') {
      failures.push({ status, reason });
    },
    setOffline(value: boolean) {
      offline = value;
    },
    file(id: string) {
      return files.get(id);
    },
    zinFiles() {
      return [...files.values()].filter((f) => !f.mimeType.startsWith('application/vnd.google-apps'));
    },
    folder(name: string) {
      return [...files.values()].find((f) => f.mimeType === 'application/vnd.google-apps.folder' && f.name === name);
    },
    requests,
    reset() {
      files.clear();
      sessions.clear();
      failures = [];
      offline = false;
      requests.length = 0;
    },
  };
}

export type FakeDriveServer = ReturnType<typeof createFakeDriveServer>;
