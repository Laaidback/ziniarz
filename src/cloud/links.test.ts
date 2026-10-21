import 'fake-indexeddb/auto';
import { openDB } from 'idb';
import { expect, test } from 'vitest';
import { createZine } from '../model/factory';
import { newId } from '../model/ids';
import { deleteZine, listZines, openZiniarzDb, saveZine, type DriveLink } from '../storage/db';
import { deleteLink, getLink, linkOfFile, listLinks, putLink } from './links';

const link = (zineId: string, fileId: string): DriveLink => ({
  zineId,
  fileId,
  revision: 'rev-1',
  syncedUpdatedAt: '2026-10-21T10:00:00.000Z',
  modifiedTime: '2026-10-21T10:00:00.000Z',
  modifiedBy: 'Ala',
  modifiedByMe: true,
});

test('links are stored by zine and found by file', async () => {
  const db = await openZiniarzDb(`test-${newId()}`);
  await putLink(db, link('z1', 'f1'));
  await putLink(db, link('z2', 'f2'));
  expect(await getLink(db, 'z1')).toEqual(link('z1', 'f1'));
  expect((await linkOfFile(db, 'f2'))?.zineId).toBe('z2');
  expect(await linkOfFile(db, 'nope')).toBeUndefined();
  await deleteLink(db, 'z1');
  expect((await listLinks(db)).map((l) => l.zineId)).toEqual(['z2']);
});

test('deleting a zine deletes its link', async () => {
  const db = await openZiniarzDb(`test-${newId()}`);
  const zine = createZine('A', 1);
  await saveZine(db, zine);
  await putLink(db, link(zine.id, 'f1'));
  await deleteZine(db, zine.id);
  expect(await listLinks(db)).toEqual([]);
});

test('a version 1 database is upgraded and keeps its zines', async () => {
  const name = `test-${newId()}`;
  const old = await openDB(name, 1, {
    upgrade(db) {
      db.createObjectStore('zines', { keyPath: 'id' });
      db.createObjectStore('images', { keyPath: 'id' });
      db.createObjectStore('fontFamilies', { keyPath: 'id' });
      db.createObjectStore('fontFiles', { keyPath: 'id' }).createIndex('byFamily', 'familyId');
    },
  });
  const zine = createZine('Stary', 1);
  await old.put('zines', zine);
  old.close();
  const db = await openZiniarzDb(name);
  expect((await listZines(db)).map((z) => z.title)).toEqual(['Stary']);
  await putLink(db, link(zine.id, 'f1'));
  expect(await getLink(db, zine.id)).toBeDefined();
});
