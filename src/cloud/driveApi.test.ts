import { beforeEach, expect, test } from 'vitest';
import { createFakeDriveServer } from '../test/fakeDriveServer';
import { createDriveClient, FOLDER_NAME, ZIN_MIME } from './driveApi';
import { CloudError } from './errors';

const server = createFakeDriveServer();
beforeEach(() => server.reset());

const clientOf = (user: string | null, onUnauthorized?: () => void) =>
  createDriveClient({ token: () => user, fetch: server.fetch, onUnauthorized });

const bytes = (...values: number[]) => new Uint8Array(values);

async function failure(promise: Promise<unknown>): Promise<CloudError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(CloudError);
    return error as CloudError;
  }
  throw new Error('expected a failure');
}

test('create puts the file in one "Ziniarz" folder and reports its version and author', async () => {
  const ala = clientOf('Ala');
  const first = await ala.create('lato.zin', bytes(1, 2, 3));
  const second = await ala.create('zima.zin', bytes(4));
  expect(first).toMatchObject({ name: 'lato.zin', revision: 'rev-1', modifiedBy: 'Ala', modifiedByMe: true });
  const folder = server.folder(FOLDER_NAME)!;
  expect(server.file(first.id)?.parents).toEqual([folder.id]);
  expect(server.file(second.id)?.parents).toEqual([folder.id]);
  expect(server.file(first.id)?.mimeType).toBe(ZIN_MIME);
  expect(server.requests.filter((r) => r.startsWith('POST https://www.googleapis.com/drive/v3/files?'))).toHaveLength(1);
});

test('update, meta and download', async () => {
  const ala = clientOf('Ala');
  const { id } = await ala.create('lato.zin', bytes(1));
  const updated = await ala.update(id, 'lato 2.zin', bytes(7, 8));
  expect(updated).toMatchObject({ id, name: 'lato 2.zin', revision: 'rev-2' });
  expect(await ala.meta(id)).toEqual(updated);
  expect(new Uint8Array(await ala.download(id))).toEqual(bytes(7, 8));
});

test('another person sees who changed the file', async () => {
  const { id } = await clientOf('Ala').create('lato.zin', bytes(1));
  server.share(id, 'Ola');
  expect(server.pick(id, 'Ola')).toBe(true);
  const meta = await clientOf('Ola').meta(id);
  expect(meta).toMatchObject({ modifiedBy: 'Ala', modifiedByMe: false });
});

test('errors become CloudError kinds', async () => {
  const ala = clientOf('Ala');
  const { id } = await ala.create('lato.zin', bytes(1));

  expect((await failure(clientOf(null).meta(id))).kind).toBe('auth');
  let unauthorized = 0;
  server.failNext(401, 'authError');
  expect((await failure(clientOf('Ala', () => unauthorized++).meta(id))).kind).toBe('auth');
  expect(unauthorized).toBe(1);

  server.failNext(403, 'storageQuotaExceeded');
  expect((await failure(ala.update(id, 'x', bytes(1)))).kind).toBe('quota');
  server.failNext(403, 'accessNotConfigured');
  expect(await failure(ala.meta(id))).toMatchObject({ kind: 'other', message: expect.stringContaining('Włącz Google Drive API') });
  server.failNext(403, 'userRateLimitExceeded');
  expect((await failure(ala.meta(id))).kind).toBe('other');
  server.failNext(500);
  expect((await failure(ala.meta(id))).kind).toBe('other');

  expect((await failure(ala.meta('nope'))).kind).toBe('notFound');
  server.setOffline(true);
  expect((await failure(ala.meta(id))).kind).toBe('offline');
  server.setOffline(false);

  server.trash(id);
  expect((await failure(ala.meta(id))).kind).toBe('notFound');
});

test('a reader cannot change a shared file', async () => {
  const { id } = await clientOf('Ala').create('lato.zin', bytes(1));
  server.share(id, 'Ola', 'reader');
  server.pick(id, 'Ola');
  expect((await failure(clientOf('Ola').update(id, 'x', bytes(2)))).kind).toBe('forbidden');
});

test('a failed folder lookup is tried again', async () => {
  const ala = clientOf('Ala');
  server.failNext(500);
  await failure(ala.create('a.zin', bytes(1)));
  expect((await ala.create('a.zin', bytes(1))).revision).toBe('rev-1');
});
