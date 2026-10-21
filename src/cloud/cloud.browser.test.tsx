import { render } from 'vitest-browser-react';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { ConfirmHost } from '../app/ConfirmHost';
import { DbContext } from '../app/dbContext';
import { NoticeList } from '../app/NoticeList';
import { noticeStore } from '../app/notices';
import { HomeScreen } from '../home/HomeScreen';
import { createZine } from '../model/factory';
import { newId } from '../model/ids';
import { parseZine } from '../model/parse';
import type { Zine } from '../model/types';
import { listZines, loadZine, openZiniarzDb, saveZine, type ZiniarzDb } from '../storage/db';
import { bundleFromDb, writeZin } from '../storage/zinFile';
import { openInEditor } from '../test/editorHarness';
import { fakeCloud } from '../test/fakeCloud';
import { createFakeDriveServer } from '../test/fakeDriveServer';
import { CloudContext, type CloudServices } from './CloudContext';
import { cloudStatusStore } from './cloudStatus';
import { linkToDrive } from './cloudSync';
import { conflictStore } from './conflict';
import { ConflictHost } from './ConflictHost';
import { createDriveClient } from './driveApi';
import { getLink } from './links';
import { cloudSyncTiming } from './useEditorCloudSync';

const server = createFakeDriveServer();
const alasDrive = createDriveClient({ token: () => 'Ala', fetch: server.fetch });

beforeEach(() => {
  server.reset();
  cloudSyncTiming.delayMs = 100;
});

afterEach(() => {
  window.location.hash = '';
  cloudStatusStore.setState({ zines: {} });
  noticeStore.setState({ notices: [] });
  conflictStore.getState().request?.answer(null);
});

let clock = Date.parse('2026-10-21T12:00:00.000Z');
const stamp = () => new Date((clock += 1000)).toISOString();

const zineNamed = (title: string): Zine => ({ ...createZine(title, 2), updatedAt: stamp() });

async function renderHome(cloud: CloudServices | null, prepare?: (db: ZiniarzDb) => Promise<void>) {
  const db = await openZiniarzDb(`test-${newId()}`);
  await prepare?.(db);
  const screen = render(
    <DbContext.Provider value={db}>
      <CloudContext.Provider value={cloud}>
        <HomeScreen />
        <NoticeList />
        <ConfirmHost />
        <ConflictHost />
      </CloudContext.Provider>
    </DbContext.Provider>,
  );
  return { db, screen };
}

/** A .zin file of another zine, as someone else would save it to Drive. */
async function zinBytesOf(zine: Zine): Promise<Uint8Array> {
  const db = await openZiniarzDb(`test-${newId()}`);
  await saveZine(db, zine);
  return writeZin((await bundleFromDb(db, zine.id)).bundle);
}

const titleIn = async (db: ZiniarzDb, id: string) => parseZine(await loadZine(db, id)).title;

test('without Google ids there are no Drive buttons', async () => {
  const { screen } = await renderHome(null, (db) => saveZine(db, zineNamed('Lato')));
  await expect.element(screen.getByRole('heading', { name: 'Lato' })).toBeVisible();
  await expect.element(screen.getByRole('button', { name: 'Otwórz z Dysku Google' })).not.toBeInTheDocument();
  await expect.element(screen.getByRole('button', { name: 'Zapisz na Dysku Google' })).not.toBeInTheDocument();
});

test('a zine card saves the zine to Drive after signing in, shows it on Drive and unlinks it', async () => {
  const { services, signIns } = fakeCloud(server, 'Ala', { signedIn: false });
  const zine = zineNamed('Lato');
  const { db, screen } = await renderHome(services, (db) => saveZine(db, zine));

  await screen.getByRole('button', { name: 'Zapisz na Dysku Google' }).click();
  await expect.element(screen.getByText('Zapisano na Dysku')).toBeVisible();
  expect(signIns.count).toBe(1);
  const [file] = server.zinFiles();
  expect(file.name).toBe('Lato.zin');
  await expect
    .element(screen.getByRole('link', { name: 'Pokaż na Dysku' }))
    .toHaveAttribute('href', `https://drive.google.com/file/d/${file.id}/view`);

  await screen.getByRole('button', { name: 'Odłącz od Dysku' }).click();
  await screen.getByRole('dialog').getByRole('button', { name: 'Odłącz' }).click();
  await expect.element(screen.getByRole('button', { name: 'Zapisz na Dysku Google' })).toBeVisible();
  expect(await getLink(db, zine.id)).toBeUndefined();
  expect(server.zinFiles()).toHaveLength(1);
});

test('deleting a zine on Drive says the file stays there', async () => {
  const { services } = fakeCloud(server, 'Ala');
  const zine = zineNamed('Lato');
  const { screen } = await renderHome(services, async (db) => {
    await saveZine(db, zine);
    await linkToDrive(db, alasDrive, zine.id);
  });
  await screen.getByRole('button', { name: 'Usuń' }).click();
  await expect.element(screen.getByText('Usunąć zin „Lato”? Tego nie da się cofnąć. Plik na Dysku Google zostanie.')).toBeVisible();
});

test('"Otwórz z Dysku Google" opens a shared zine in the editor', async () => {
  const alas = await openZiniarzDb(`test-${newId()}`);
  const shared = zineNamed('Wspólny');
  await saveZine(alas, shared);
  await linkToDrive(alas, alasDrive, shared.id);
  const fileId = (await getLink(alas, shared.id))!.fileId;
  server.share(fileId, 'Ola');

  const { services, picks } = fakeCloud(server, 'Ola');
  picks.push(fileId);
  const { db, screen } = await renderHome(services);
  await screen.getByRole('button', { name: 'Otwórz z Dysku Google' }).click();
  await expect.poll(async () => (await listZines(db)).map((z) => z.title)).toEqual(['Wspólny']);
  const [opened] = await listZines(db);
  await expect.poll(() => window.location.hash).toBe(`#/zin/${opened.id}`);
  expect((await getLink(db, opened.id))?.fileId).toBe(fileId);
});

test('the list sends waiting changes once signed in', async () => {
  const { services } = fakeCloud(server, 'Ala', { signedIn: false });
  const zine = zineNamed('Lato');
  const { screen } = await renderHome(services, async (db) => {
    await saveZine(db, zine);
    await linkToDrive(db, alasDrive, zine.id);
    await saveZine(db, { ...zine, title: 'Lato 2', updatedAt: stamp() });
  });
  await expect.element(screen.getByText('Zaloguj się, żeby zapisać na Dysku')).toBeVisible();
  await screen.getByRole('button', { name: 'Zaloguj', exact: true }).click();
  await expect.poll(() => server.zinFiles()[0]?.name).toBe('Lato 2.zin');
  await expect.element(screen.getByText('Zapisano na Dysku')).toBeVisible();
});

test('the editor saves a zine to Drive and sends changes a while after the last one', async () => {
  const { services } = fakeCloud(server, 'Ala');
  const zine = zineNamed('Lato');
  const { screen } = await openInEditor(zine, undefined, undefined, services);
  await screen.getByRole('button', { name: 'Zapisz na Dysku' }).click();
  await expect.element(screen.getByText('Zapisano na Dysku')).toBeVisible();
  const [file] = server.zinFiles();
  expect(file.version).toBe(1);

  await screen.getByRole('button', { name: '+ Napis' }).click();
  await expect.poll(() => server.file(file.id)?.version).toBe(2);
  await expect.element(screen.getByText('Zapisano na Dysku')).toBeVisible();
});

test('leaving the editor sends the last changes', async () => {
  const { services } = fakeCloud(server, 'Ala');
  cloudSyncTiming.delayMs = 60_000;
  const zine = zineNamed('Lato');
  const { screen } = await openInEditor(zine, (db) => linkToDrive(db, alasDrive, zine.id).then(() => {}), undefined, services);
  await screen.getByRole('button', { name: '+ Napis' }).click();
  await expect.element(screen.getByText('Zmiany czekają na zapis na Dysku')).toBeVisible();
  screen.unmount();
  await expect.poll(() => server.zinFiles()[0]?.version).toBe(2);
});

async function editorWithConflict() {
  const { services } = fakeCloud(server, 'Ala');
  const zine = zineNamed('Moja wersja');
  const opened = await openInEditor(
    zine,
    async (db) => {
      await linkToDrive(db, alasDrive, zine.id);
      const fileId = (await getLink(db, zine.id))!.fileId;
      server.replaceBytes(fileId, await zinBytesOf(zineNamed('Wersja Oli')), 'Ola');
      await saveZine(db, { ...zine, title: 'Moja wersja!', updatedAt: stamp() });
    },
    undefined,
    services,
  );
  await expect.element(opened.screen.getByRole('dialog', { name: 'Dwie wersje zina' })).toBeVisible();
  await expect.element(opened.screen.getByText('Ostatnia zmiana: Ola', { exact: false })).toBeVisible();
  return { ...opened, zine };
}

test('opening a zine changed both here and on Drive asks; "copy" keeps both', async () => {
  const { db, screen, zine } = await editorWithConflict();
  await screen.getByRole('button', { name: /Zapisz moją jako kopię/ }).click();
  await expect.element(screen.getByRole('heading', { name: 'Wersja Oli' })).toBeVisible();
  expect(await titleIn(db, zine.id)).toBe('Wersja Oli');
  const titles = (await listZines(db)).map((z) => z.title).sort();
  expect(titles).toEqual(['Moja wersja! (kopia)', 'Wersja Oli']);
});

test('"keep mine" overwrites the version on Drive', async () => {
  const { screen } = await editorWithConflict();
  await screen.getByRole('button', { name: /Zostaw moją/ }).click();
  await expect.element(screen.getByRole('heading', { name: 'Moja wersja!' })).toBeVisible();
  await expect.poll(() => server.zinFiles()[0]?.name).toBe('Moja wersja!.zin');
});

test('a conflict found while editing asks, and "take Drive\'s" reopens the zine with it', async () => {
  const { services } = fakeCloud(server, 'Ala');
  const zine = zineNamed('Lato');
  const { db, screen } = await openInEditor(zine, (db) => linkToDrive(db, alasDrive, zine.id).then(() => {}), undefined, services);
  await expect.element(screen.getByText('Zapisano na Dysku')).toBeVisible();
  const fileId = (await getLink(db, zine.id))!.fileId;
  server.replaceBytes(fileId, await zinBytesOf(zineNamed('Od Oli')), 'Ola');

  await screen.getByRole('button', { name: '+ Napis' }).click();
  await screen.getByRole('button', { name: /Weź wersję z Dysku/ }).click();
  await expect.element(screen.getByRole('heading', { name: 'Od Oli' })).toBeVisible();
  expect(await titleIn(db, zine.id)).toBe('Od Oli');
  expect(noticeStore.getState().notices).toEqual([]);
});
