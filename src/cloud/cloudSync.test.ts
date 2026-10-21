import 'fake-indexeddb/auto';
import { beforeEach, expect, test } from 'vitest';
import { createTextElement, createZine } from '../model/factory';
import { newId } from '../model/ids';
import { parseZine } from '../model/parse';
import type { Zine } from '../model/types';
import { listZines, loadZine, openZiniarzDb, saveZine, type ZiniarzDb } from '../storage/db';
import { bundleFromDb, writeZin } from '../storage/zinFile';
import { createFakeDriveServer } from '../test/fakeDriveServer';
import { cloudStatusStore } from './cloudStatus';
import { linkToDrive, openFromDrive, relinkAsNew, resolveConflict, syncLinkedZines, syncZine, unlinkFromDrive } from './cloudSync';
import { createDriveClient } from './driveApi';
import { getLink } from './links';

const server = createFakeDriveServer();
beforeEach(() => {
  server.reset();
  cloudStatusStore.setState({ zines: {} });
});

const driveOf = (user: string) => createDriveClient({ token: () => user, fetch: server.fetch });
const ala = driveOf('Ala');
const ola = driveOf('Ola');

let clock = Date.parse('2026-10-21T12:00:00.000Z');
const stamp = () => new Date((clock += 1000)).toISOString();

async function setup(title = 'Lato'): Promise<{ db: ZiniarzDb; zine: Zine }> {
  const db = await openZiniarzDb(`test-${newId()}`);
  const zine = { ...createZine(title, 1), updatedAt: stamp() };
  await saveZine(db, zine);
  return { db, zine };
}

/** An edit as the editor's autosave makes it: new content and a new updatedAt. */
async function edit(db: ZiniarzDb, zineId: string, change: (zine: Zine) => void): Promise<void> {
  const zine = parseZine(await loadZine(db, zineId));
  change(zine);
  await saveZine(db, { ...zine, updatedAt: stamp() });
}

const titleIn = async (db: ZiniarzDb, id: string) => parseZine(await loadZine(db, id)).title;

async function linkedFile(db: ZiniarzDb, zineId: string): Promise<string> {
  await linkToDrive(db, ala, zineId);
  return (await getLink(db, zineId))!.fileId;
}

test('linkToDrive saves the zine as a .zin file and remembers the version', async () => {
  const { db, zine } = await setup();
  const change = await linkToDrive(db, ala, zine.id);
  const link = (await getLink(db, zine.id))!;
  expect(link).toMatchObject({ version: '1', syncedUpdatedAt: zine.updatedAt, modifiedBy: 'Ala', modifiedByMe: true });
  expect(server.file(link.fileId)?.name).toBe('Lato.zin');
  expect(change.modifiedBy).toBe('Ala');
  expect(cloudStatusStore.getState().zines[zine.id]).toMatchObject({ state: 'synced' });
});

test('nothing changed: nothing is sent', async () => {
  const { db, zine } = await setup();
  await linkToDrive(db, ala, zine.id);
  const before = server.requests.length;
  expect((await syncZine(db, ala, zine.id, { allowDownload: true })).kind).toBe('upToDate');
  expect(server.requests.slice(before).every((r) => r.startsWith('GET'))).toBe(true);
});

test('a change here is uploaded, with the new title as the file name', async () => {
  const { db, zine } = await setup();
  const fileId = await linkedFile(db, zine.id);
  await edit(db, zine.id, (z) => (z.title = 'Jesień'));
  expect((await syncZine(db, ala, zine.id, { allowDownload: false })).kind).toBe('uploaded');
  expect(server.file(fileId)).toMatchObject({ name: 'Jesień.zin', version: 2 });
  expect((await syncZine(db, ala, zine.id, { allowDownload: false })).kind).toBe('upToDate');
});

test('a change on Drive is downloaded into the same zine, or reported when downloading is not allowed', async () => {
  const { db, zine } = await setup();
  const fileId = await linkedFile(db, zine.id);
  // Ola's version, made elsewhere.
  const other = await setup('Wersja Oli');
  const { bundle } = await bundleFromDb(other.db, other.zine.id);
  server.replaceBytes(fileId, await writeZin(bundle), 'Ola');

  const reported = await syncZine(db, ala, zine.id, { allowDownload: false });
  expect(reported).toMatchObject({ kind: 'remoteNewer', change: { modifiedBy: 'Ola', modifiedByMe: false } });
  expect(await titleIn(db, zine.id)).toBe('Lato');
  expect(cloudStatusStore.getState().zines[zine.id]).toMatchObject({ state: 'remoteNewer', change: { modifiedBy: 'Ola' } });

  expect((await syncZine(db, ala, zine.id, { allowDownload: true })).kind).toBe('downloaded');
  expect(await titleIn(db, zine.id)).toBe('Wersja Oli');
  expect((await listZines(db)).length).toBe(1);
  expect((await syncZine(db, ala, zine.id, { allowDownload: true })).kind).toBe('upToDate');
});

async function conflictSetup() {
  const { db, zine } = await setup();
  const fileId = await linkedFile(db, zine.id);
  const other = await setup('Wersja Oli');
  server.replaceBytes(fileId, await writeZin((await bundleFromDb(other.db, other.zine.id)).bundle), 'Ola');
  await edit(db, zine.id, (z) => (z.title = 'Moja wersja'));
  expect((await syncZine(db, ala, zine.id, { allowDownload: true })).kind).toBe('conflict');
  expect(cloudStatusStore.getState().zines[zine.id]?.state).toBe('conflict');
  return { db, zine, fileId };
}

test('conflict, "theirs": the version on Drive replaces this one', async () => {
  const { db, zine, fileId } = await conflictSetup();
  const { result, copyId } = await resolveConflict(db, ala, zine.id, 'theirs');
  expect(result.kind).toBe('downloaded');
  expect(copyId).toBeNull();
  expect(await titleIn(db, zine.id)).toBe('Wersja Oli');
  expect(server.file(fileId)?.version).toBe(2);
});

test('conflict, "mine": this version overwrites the one on Drive', async () => {
  const { db, zine, fileId } = await conflictSetup();
  expect((await resolveConflict(db, ala, zine.id, 'mine')).result.kind).toBe('uploaded');
  expect(server.file(fileId)).toMatchObject({ name: 'Moja wersja.zin', version: 3, modifiedBy: 'Ala' });
  expect((await syncZine(db, ala, zine.id, { allowDownload: true })).kind).toBe('upToDate');
});

test('conflict, "copy": this version becomes a separate zine, the linked one takes Drive\'s', async () => {
  const { db, zine } = await conflictSetup();
  const { copyId } = await resolveConflict(db, ala, zine.id, 'copy');
  expect(await titleIn(db, zine.id)).toBe('Wersja Oli');
  expect(await titleIn(db, copyId!)).toBe('Moja wersja (kopia)');
  expect(await getLink(db, copyId!)).toBeUndefined();
});

test('opening a shared file creates a zine; opening it again reuses it', async () => {
  const alas = await setup('Wspólny');
  alas.zine.spreads[1].elements.push(createTextElement({ text: 'Cześć' }));
  await saveZine(alas.db, alas.zine);
  const fileId = await linkedFile(alas.db, alas.zine.id);
  server.share(fileId, 'Ola');
  server.pick(fileId, 'Ola');

  const olas = await openZiniarzDb(`test-${newId()}`);
  const opened = await openFromDrive(olas, ola, fileId);
  expect(opened.result.kind).toBe('downloaded');
  expect(opened.zineId).not.toBe(alas.zine.id);
  const zine = parseZine(await loadZine(olas, opened.zineId));
  expect(zine.title).toBe('Wspólny');
  expect(zine.spreads[1].elements).toHaveLength(1);

  const again = await openFromDrive(olas, ola, fileId);
  expect(again).toMatchObject({ zineId: opened.zineId, result: { kind: 'upToDate' } });
  expect((await listZines(olas)).length).toBe(1);

  // Ola's change reaches Ala.
  await edit(olas, opened.zineId, (z) => (z.title = 'Wspólny, poprawiony'));
  expect((await syncZine(olas, ola, opened.zineId, { allowDownload: true })).kind).toBe('uploaded');
  expect(await syncZine(alas.db, ala, alas.zine.id, { allowDownload: true })).toMatchObject({
    kind: 'downloaded',
    change: { modifiedBy: 'Ola', modifiedByMe: false },
  });
  expect(await titleIn(alas.db, alas.zine.id)).toBe('Wspólny, poprawiony');
});

test('a file that is not a zine gives a readable error', async () => {
  const { db, zine } = await setup();
  const fileId = await linkedFile(db, zine.id);
  server.replaceBytes(fileId, new Uint8Array([1, 2, 3]), 'Ola');
  const result = await syncZine(db, ala, zine.id, { allowDownload: true });
  expect(result).toMatchObject({ kind: 'failed', error: { message: 'To nie jest plik zina.' } });
  expect(await titleIn(db, zine.id)).toBe('Lato');
});

test('offline, signed out or a trashed file: the zine stays as it is and the failure is reported', async () => {
  const { db, zine } = await setup();
  const fileId = await linkedFile(db, zine.id);
  await edit(db, zine.id, (z) => (z.title = 'Zmiana'));

  server.setOffline(true);
  expect(await syncZine(db, ala, zine.id, { allowDownload: true })).toMatchObject({ kind: 'failed', error: { kind: 'offline' } });
  expect(cloudStatusStore.getState().zines[zine.id]).toMatchObject({ state: 'error', error: { kind: 'offline' } });
  server.setOffline(false);

  const signedOut = createDriveClient({ token: () => null, fetch: server.fetch });
  expect(await syncZine(db, signedOut, zine.id, { allowDownload: true })).toMatchObject({ kind: 'failed', error: { kind: 'auth' } });

  server.trash(fileId);
  expect(await syncZine(db, ala, zine.id, { allowDownload: true })).toMatchObject({ kind: 'failed', error: { kind: 'notFound' } });
  expect(await titleIn(db, zine.id)).toBe('Zmiana');

  await relinkAsNew(db, ala, zine.id);
  const link = (await getLink(db, zine.id))!;
  expect(link.fileId).not.toBe(fileId);
  expect(server.file(link.fileId)?.name).toBe('Zmiana.zin');
});

test('unlinking keeps the file on Drive and the zine here', async () => {
  const { db, zine } = await setup();
  const fileId = await linkedFile(db, zine.id);
  await unlinkFromDrive(db, zine.id);
  expect(await getLink(db, zine.id)).toBeUndefined();
  expect(server.file(fileId)).toBeDefined();
  expect((await syncZine(db, ala, zine.id, { allowDownload: true })).kind).toBe('notLinked');
  expect(cloudStatusStore.getState().zines[zine.id]).toBeUndefined();
});

test('syncs of one zine run one after another', async () => {
  const { db, zine } = await setup();
  const fileId = await linkedFile(db, zine.id);
  await edit(db, zine.id, (z) => (z.title = 'A'));
  const results = await Promise.all([
    syncZine(db, ala, zine.id, { allowDownload: false }),
    syncZine(db, ala, zine.id, { allowDownload: false }),
  ]);
  expect(results.map((r) => r.kind)).toEqual(['uploaded', 'upToDate']);
  expect(server.file(fileId)?.version).toBe(2);
});

test('syncLinkedZines uploads and downloads every linked zine', async () => {
  const { db, zine } = await setup('A');
  const fileA = await linkedFile(db, zine.id);
  const b = { ...createZine('B', 1), updatedAt: stamp() };
  await saveZine(db, b);
  await linkedFile(db, b.id);
  await edit(db, b.id, (z) => (z.title = 'B2'));
  const other = await setup('A od Oli');
  server.replaceBytes(fileA, await writeZin((await bundleFromDb(other.db, other.zine.id)).bundle), 'Ola');

  expect(await syncLinkedZines(db, ala)).toBe(true);
  expect(await titleIn(db, zine.id)).toBe('A od Oli');
  expect(server.zinFiles().map((f) => f.name).sort()).toEqual(['A.zin', 'B2.zin']);
  expect(await syncLinkedZines(db, ala)).toBe(false);
});
