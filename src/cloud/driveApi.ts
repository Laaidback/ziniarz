import { CloudError } from './errors';

/** What Ziniarz needs to know about a zine file on Drive. */
export interface DriveFileMeta {
  id: string;
  name: string;
  /**
   * The file's current content revision (`headRevisionId`). Unlike Drive's `version` it does not change when
   * the file is only shared, moved or renamed, so those never look like someone else's changes.
   */
  revision: string;
  modifiedTime: string;
  modifiedBy: string | null;
  modifiedByMe: boolean;
}

/** The few Drive operations Ziniarz uses. `meta` and `download` fail with `notFound` for a trashed file. */
export interface DriveClient {
  /** Creates the file in the "Ziniarz" folder of the signed-in person's Drive. */
  create(name: string, bytes: Uint8Array): Promise<DriveFileMeta>;
  update(id: string, name: string, bytes: Uint8Array): Promise<DriveFileMeta>;
  meta(id: string): Promise<DriveFileMeta>;
  download(id: string): Promise<ArrayBuffer>;
}

/** Zine files on Drive; the picker also shows plain zip files (a .zin uploaded by hand). */
export const ZIN_MIME = 'application/x-ziniarz';
export const PICKABLE_MIMES = [ZIN_MIME, 'application/zip', 'application/x-zip-compressed', 'application/octet-stream'];
export const FOLDER_NAME = 'Ziniarz';
const FOLDER_MIME = 'application/vnd.google-apps.folder';

const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
const FIELDS = 'id,name,headRevisionId,modifiedTime,trashed,lastModifyingUser(displayName,me)';

interface RawMeta {
  id: string;
  name: string;
  headRevisionId?: string;
  modifiedTime: string;
  trashed?: boolean;
  lastModifyingUser?: { displayName?: string; me?: boolean };
}

function toMeta(raw: RawMeta): DriveFileMeta {
  if (raw.trashed) throw new CloudError('notFound');
  return {
    id: raw.id,
    name: raw.name,
    revision: raw.headRevisionId ?? '',
    modifiedTime: raw.modifiedTime,
    modifiedBy: raw.lastModifyingUser?.displayName || null,
    modifiedByMe: raw.lastModifyingUser?.me === true,
  };
}

async function errorOf(response: Response): Promise<CloudError> {
  let reason = '';
  try {
    const body = (await response.json()) as { error?: { errors?: { reason?: string }[] } };
    reason = body.error?.errors?.[0]?.reason ?? '';
  } catch {
    // no JSON body
  }
  if (response.status === 401) return new CloudError('auth');
  if (response.status === 404) return new CloudError('notFound');
  if (response.status === 403) {
    if (reason === 'storageQuotaExceeded' || reason === 'quotaExceeded') return new CloudError('quota');
    if (reason.endsWith('RateLimitExceeded') || reason === 'rateLimitExceeded') return new CloudError('other');
    return new CloudError('forbidden');
  }
  return new CloudError('other');
}

export interface DriveClientOptions {
  /** A valid access token, or null when the person has to sign in again. */
  token(): string | null;
  /** Called when Google rejects the token, so it is not used again. */
  onUnauthorized?(): void;
  fetch?: typeof fetch;
}

export function createDriveClient(options: DriveClientOptions): DriveClient {
  const doFetch = options.fetch ?? ((input, init) => fetch(input, init));
  let folderId: Promise<string> | null = null;

  const request = async (url: string, init: RequestInit = {}): Promise<Response> => {
    const token = options.token();
    if (!token) throw new CloudError('auth');
    let response: Response;
    try {
      response = await doFetch(url, { ...init, headers: { ...init.headers, Authorization: `Bearer ${token}` } });
    } catch {
      throw new CloudError('offline');
    }
    if (!response.ok) {
      const error = await errorOf(response);
      if (error.kind === 'auth') options.onUnauthorized?.();
      throw error;
    }
    return response;
  };

  const json = (metadata: object): RequestInit => ({
    headers: { 'Content-Type': 'application/json; charset=UTF-8' },
    body: JSON.stringify(metadata),
  });

  /** Resumable upload: the first request opens a session (its URL in `Location`), the second sends the bytes. */
  const upload = async (url: string, method: 'POST' | 'PATCH', metadata: object, bytes: Uint8Array): Promise<DriveFileMeta> => {
    const init = json(metadata);
    const session = await request(url, {
      method,
      body: init.body,
      headers: { ...init.headers, 'X-Upload-Content-Type': ZIN_MIME },
    });
    const location = session.headers.get('Location');
    if (!location) throw new CloudError('other');
    const done = await request(location, {
      method: 'PUT',
      headers: { 'Content-Type': ZIN_MIME },
      body: bytes as Uint8Array<ArrayBuffer>,
    });
    return toMeta((await done.json()) as RawMeta);
  };

  const findOrCreateFolder = async (): Promise<string> => {
    const q = `mimeType='${FOLDER_MIME}' and name='${FOLDER_NAME}' and trashed=false`;
    const found = await request(`${API}/files?q=${encodeURIComponent(q)}&fields=files(id)&spaces=drive`);
    const files = ((await found.json()) as { files?: { id: string }[] }).files ?? [];
    if (files.length > 0) return files[0].id;
    const created = await request(`${API}/files?fields=id`, { method: 'POST', ...json({ name: FOLDER_NAME, mimeType: FOLDER_MIME }) });
    return ((await created.json()) as { id: string }).id;
  };

  const folder = (): Promise<string> => {
    // A failed lookup is tried again next time.
    folderId ??= findOrCreateFolder().catch((error: unknown) => {
      folderId = null;
      throw error;
    });
    return folderId;
  };

  return {
    async create(name, bytes) {
      const parents = [await folder()];
      return upload(`${UPLOAD}/files?uploadType=resumable&fields=${FIELDS}`, 'POST', { name, mimeType: ZIN_MIME, parents }, bytes);
    },
    update(id, name, bytes) {
      return upload(`${UPLOAD}/files/${encodeURIComponent(id)}?uploadType=resumable&fields=${FIELDS}&supportsAllDrives=true`, 'PATCH', { name }, bytes);
    },
    async meta(id) {
      const response = await request(`${API}/files/${encodeURIComponent(id)}?fields=${FIELDS}&supportsAllDrives=true`);
      return toMeta((await response.json()) as RawMeta);
    },
    async download(id) {
      const response = await request(`${API}/files/${encodeURIComponent(id)}?alt=media&supportsAllDrives=true`);
      return response.arrayBuffer();
    },
  };
}
