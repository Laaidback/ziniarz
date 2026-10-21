import { copyOfZine } from '../home/homeActions';
import { parseZine } from '../model/parse';
import type { Zine } from '../model/types';
import { loadZine, saveZine, type ZiniarzDb } from '../storage/db';
import { whenNoZineIsOpen } from '../storage/zineLock';
import { bundleFromDb, readZin, replaceFromBundle, writeZin, ZinFileError } from '../storage/zinFile';
import { clearCloudStatus, setCloudStatus } from './cloudStatus';
import type { DriveClient, DriveFileMeta } from './driveApi';
import { CloudError, cloudErrorOf } from './errors';
import { deleteLink, getLink, linkOfFile, listLinks, putLink, type DriveLink } from './links';
import { decideSync, type LastChange } from './sync';

export type SyncResult =
  | { kind: 'notLinked' }
  | { kind: 'upToDate'; change: LastChange }
  | { kind: 'uploaded'; change: LastChange }
  /** The zine's content was replaced by the version on Drive: an open editor must reopen it. */
  | { kind: 'downloaded'; change: LastChange }
  /** Drive has a newer version and nothing changed here, but downloading was not allowed (open editor). */
  | { kind: 'remoteNewer'; change: LastChange }
  /** Both Drive and this browser have changes: the person chooses (resolveConflict). */
  | { kind: 'conflict'; change: LastChange }
  | { kind: 'failed'; error: CloudError };

export type ConflictChoice = 'theirs' | 'mine' | 'copy';

const changeOf = (meta: DriveFileMeta): LastChange => ({
  modifiedTime: meta.modifiedTime,
  modifiedBy: meta.modifiedBy,
  modifiedByMe: meta.modifiedByMe,
});

export const driveFileName = (zine: Zine) => `${zine.title}.zin`;

// One operation at a time per zine, in order, so two uploads never pass each other.
const queues = new Map<string, Promise<unknown>>();
function queued<T>(zineId: string, work: () => Promise<T>): Promise<T> {
  const previous = queues.get(zineId) ?? Promise.resolve();
  const next = previous.catch(() => {}).then(work);
  queues.set(zineId, next);
  void next.finally(() => queues.get(zineId) === next && queues.delete(zineId)).catch(() => {});
  return next;
}

async function loadParsed(db: ZiniarzDb, zineId: string): Promise<Zine | null> {
  const raw = await loadZine(db, zineId);
  return raw ? parseZine(raw) : null;
}

async function remember(db: ZiniarzDb, zineId: string, meta: DriveFileMeta, syncedUpdatedAt: string): Promise<LastChange> {
  const link: DriveLink = { zineId, fileId: meta.id, revision: meta.revision, syncedUpdatedAt, ...changeOf(meta) };
  await putLink(db, link);
  return changeOf(meta);
}

async function upload(db: ZiniarzDb, drive: DriveClient, zineId: string, fileId: string | null): Promise<LastChange> {
  const { bundle } = await bundleFromDb(db, zineId);
  const bytes = await writeZin(bundle);
  const name = driveFileName(bundle.zine);
  const meta = fileId === null ? await drive.create(name, bytes) : await drive.update(fileId, name, bytes);
  // The zine as sent: later changes (still being typed) stay "changed here".
  return remember(db, zineId, meta, bundle.zine.updatedAt);
}

async function readDriveZin(drive: DriveClient, fileId: string) {
  try {
    return await readZin(await drive.download(fileId));
  } catch (error) {
    if (error instanceof ZinFileError) throw new CloudError('other', error.message);
    throw error;
  }
}

async function download(db: ZiniarzDb, drive: DriveClient, zineId: string, meta: DriveFileMeta): Promise<LastChange> {
  const bundle = await readDriveZin(drive, meta.id);
  const zine = await replaceFromBundle(db, zineId, bundle);
  return remember(db, zineId, meta, zine.updatedAt);
}

function failed(zineId: string, error: unknown): SyncResult {
  const cloudError = cloudErrorOf(error);
  setCloudStatus(zineId, { state: 'error', error: cloudError });
  return { kind: 'failed', error: cloudError };
}

/** Saves a zine to a new file on Drive; a zine already there keeps its file (a double click). Throws CloudError. */
export function linkToDrive(db: ZiniarzDb, drive: DriveClient, zineId: string): Promise<LastChange> {
  return queued(zineId, async () => {
    const existing = await getLink(db, zineId);
    if (existing) return existing;
    setCloudStatus(zineId, { state: 'syncing' });
    try {
      const change = await upload(db, drive, zineId, null);
      setCloudStatus(zineId, { state: 'synced' }, change);
      return change;
    } catch (error) {
      clearCloudStatus(zineId);
      throw cloudErrorOf(error);
    }
  });
}

/** Brings a linked zine and its file on Drive together. Never throws: failures come back as `failed`. */
export function syncZine(db: ZiniarzDb, drive: DriveClient, zineId: string, options: { allowDownload: boolean }): Promise<SyncResult> {
  return queued(zineId, async (): Promise<SyncResult> => {
    try {
      const link = await getLink(db, zineId);
      const zine = await loadParsed(db, zineId);
      if (!link || !zine) {
        clearCloudStatus(zineId);
        return { kind: 'notLinked' };
      }
      setCloudStatus(zineId, { state: 'syncing' });
      const meta = await drive.meta(link.fileId);
      const change = changeOf(meta);
      switch (decideSync(zine.updatedAt !== link.syncedUpdatedAt, meta.revision !== link.revision)) {
        case 'none':
          setCloudStatus(zineId, { state: 'synced' }, change);
          return { kind: 'upToDate', change };
        case 'upload': {
          const uploaded = await upload(db, drive, zineId, link.fileId);
          setCloudStatus(zineId, { state: 'synced' }, uploaded);
          return { kind: 'uploaded', change: uploaded };
        }
        case 'download': {
          if (!options.allowDownload) {
            setCloudStatus(zineId, { state: 'remoteNewer' }, change);
            return { kind: 'remoteNewer', change };
          }
          const downloaded = await download(db, drive, zineId, meta);
          setCloudStatus(zineId, { state: 'synced' }, downloaded);
          return { kind: 'downloaded', change: downloaded };
        }
        case 'conflict':
          setCloudStatus(zineId, { state: 'conflict' }, change);
          return { kind: 'conflict', change };
      }
    } catch (error) {
      return failed(zineId, error);
    }
  });
}

/**
 * The person's answer to a conflict: take Drive's version, keep this one (overwriting Drive's), or keep
 * this one as a separate zine (not on Drive) and take Drive's. Returns the id of the copy, if any.
 */
export function resolveConflict(
  db: ZiniarzDb,
  drive: DriveClient,
  zineId: string,
  choice: ConflictChoice,
): Promise<{ result: SyncResult; copyId: string | null }> {
  return queued(zineId, async () => {
    let copyId: string | null = null;
    try {
      const link = await getLink(db, zineId);
      const zine = await loadParsed(db, zineId);
      if (!link || !zine) return { result: { kind: 'notLinked' } as SyncResult, copyId };
      setCloudStatus(zineId, { state: 'syncing' });
      if (choice === 'mine') {
        const change = await upload(db, drive, zineId, link.fileId);
        setCloudStatus(zineId, { state: 'synced' }, change);
        return { result: { kind: 'uploaded', change } as SyncResult, copyId };
      }
      const meta = await drive.meta(link.fileId);
      if (choice === 'copy') {
        const copy = copyOfZine(zine);
        await saveZine(db, copy);
        copyId = copy.id;
      }
      const change = await download(db, drive, zineId, meta);
      setCloudStatus(zineId, { state: 'synced' }, change);
      return { result: { kind: 'downloaded', change } as SyncResult, copyId };
    } catch (error) {
      return { result: failed(zineId, error), copyId };
    }
  });
}

/**
 * Opens a file picked on Drive and returns the zine to open in the editor. A file already on the list
 * gives its zine (the editor syncs it on opening, no second copy); a new one becomes a new zine (readZin
 * gives it a new id, so it never replaces a zine already here, one unlinked from the same file say). Throws CloudError.
 */
export async function openFromDrive(db: ZiniarzDb, drive: DriveClient, fileId: string): Promise<string> {
  const known = await linkOfFile(db, fileId);
  if (known && (await loadZine(db, known.zineId))) return known.zineId;
  try {
    const meta = await drive.meta(fileId);
    const bundle = await readDriveZin(drive, fileId);
    const zine = await replaceFromBundle(db, bundle.zine.id, bundle);
    const change = await remember(db, zine.id, meta, zine.updatedAt);
    setCloudStatus(zine.id, { state: 'synced' }, change);
    return zine.id;
  } catch (error) {
    throw cloudErrorOf(error);
  }
}

/** The zine stays only in this browser; the file on Drive is left as it is. */
export function unlinkFromDrive(db: ZiniarzDb, zineId: string): Promise<void> {
  return queued(zineId, async () => {
    await deleteLink(db, zineId);
    clearCloudStatus(zineId);
  });
}

/** The file is gone from Drive: save the zine to a new one. Throws CloudError. */
export async function relinkAsNew(db: ZiniarzDb, drive: DriveClient, zineId: string): Promise<LastChange> {
  await unlinkFromDrive(db, zineId);
  return linkToDrive(db, drive, zineId);
}

/**
 * Syncs every zine saved on Drive (the zine list does it on opening): sends changes made here, then
 * downloads newer versions, but only while no tab has a zine open (an editor would otherwise save its
 * older copy over them; editors wait for the lock). Stops between zines once `cancelled()`.
 * Returns whether any zine's content changed here.
 */
export async function syncLinkedZines(db: ZiniarzDb, drive: DriveClient, cancelled: () => boolean = () => false): Promise<boolean> {
  const newer: string[] = [];
  for (const link of await listLinks(db)) {
    if (cancelled()) return false;
    const result = await syncZine(db, drive, link.zineId, { allowDownload: false });
    if (result.kind === 'remoteNewer') newer.push(link.zineId);
  }
  let downloaded = false;
  await whenNoZineIsOpen(db.name, async () => {
    for (const zineId of newer) {
      if (cancelled()) return;
      if ((await syncZine(db, drive, zineId, { allowDownload: true })).kind === 'downloaded') downloaded = true;
    }
  });
  return downloaded;
}

