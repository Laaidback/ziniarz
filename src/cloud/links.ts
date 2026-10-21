import type { DriveLink, ZiniarzDb } from '../storage/db';

export type { DriveLink };

export function getLink(db: ZiniarzDb, zineId: string): Promise<DriveLink | undefined> {
  return db.get('driveLinks', zineId);
}

export function linkOfFile(db: ZiniarzDb, fileId: string): Promise<DriveLink | undefined> {
  return db.getFromIndex('driveLinks', 'byFile', fileId);
}

export function listLinks(db: ZiniarzDb): Promise<DriveLink[]> {
  return db.getAll('driveLinks');
}

export async function putLink(db: ZiniarzDb, link: DriveLink): Promise<void> {
  await db.put('driveLinks', link);
}

export async function deleteLink(db: ZiniarzDb, zineId: string): Promise<void> {
  await db.delete('driveLinks', zineId);
}
