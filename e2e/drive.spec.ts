import { expect, test, type Page } from '@playwright/test';
import { createFakeDriveServer } from '../src/test/fakeDriveServer';
import { installFakeGoogle } from './fakeGoogle';

/** Texts of every zine in the page's IndexedDB, by zine title. */
function zineTexts(page: Page): Promise<Record<string, string[]>> {
  return page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const open = indexedDB.open('ziniarz');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const all = open.result.transaction('zines').objectStore('zines').getAll();
          all.onsuccess = () => {
            const result: Record<string, string[]> = {};
            for (const zine of all.result as { title: string; spreads: { elements: { kind: string; text?: string }[] }[] }[]) {
              result[zine.title] = zine.spreads.flatMap((s) => s.elements.filter((e) => e.kind === 'text').map((e) => e.text ?? ''));
            }
            open.result.close();
            resolve(result);
          };
        };
      }),
  );
}

test('two people work on one zine through Google Drive, one after the other', async ({ browser }) => {
  const server = createFakeDriveServer();
  const alasContext = await browser.newContext();
  const olasContext = await browser.newContext();
  await installFakeGoogle(alasContext, server, 'Ala');
  const ola = await installFakeGoogle(olasContext, server, 'Ola');
  const alasPage = await alasContext.newPage();
  const olasPage = await olasContext.newPage();

  // Ala makes a zine and saves it to Drive from the editor.
  await alasPage.goto('./');
  await alasPage.getByLabel('Tytuł').fill('Wspólny zin');
  await alasPage.getByLabel('Kartki').fill('2');
  await alasPage.getByRole('button', { name: 'Nowy zin' }).click();
  await expect(alasPage.getByRole('heading', { name: 'Wspólny zin' })).toBeVisible();
  await alasPage.getByRole('button', { name: 'Zapisz na Dysku' }).click();
  await expect(alasPage.getByText('Zapisano na Dysku')).toBeVisible();
  const [file] = server.zinFiles();
  expect(file.name).toBe('Wspólny zin.zin');
  await alasPage.getByRole('link', { name: '← Ziny' }).click();
  await expect(alasPage.getByRole('link', { name: 'Pokaż na Dysku' })).toHaveAttribute('href', `https://drive.google.com/file/d/${file.id}/view`);

  // Ala shares the file with Ola on Drive; Ola opens it in her Ziniarz and adds a text.
  server.share(file.id, 'Ola');
  ola.picks.push(file.id);
  await olasPage.goto('./');
  await olasPage.getByRole('button', { name: 'Otwórz z Dysku Google' }).click();
  await expect(olasPage.getByRole('heading', { name: 'Wspólny zin' })).toBeVisible();
  await expect(olasPage.getByText('Zapisano na Dysku')).toBeVisible();
  await olasPage.getByRole('button', { name: '+ Napis' }).click();
  await olasPage.keyboard.type('Od Oli');
  await olasPage.keyboard.press('Escape');
  await expect(olasPage.getByText('Zmiany czekają na zapis na Dysku')).toBeVisible();
  // Leaving the editor sends the change at once.
  await olasPage.getByRole('link', { name: '← Ziny' }).click();
  await expect.poll(() => server.file(file.id)?.version).toBe(2);
  expect(server.file(file.id)?.modifiedBy).toBe('Ola');

  // Ala's list takes the newer version; her editor shows Ola's text.
  await alasPage.reload();
  await expect.poll(async () => (await zineTexts(alasPage))['Wspólny zin']).toEqual(['Od Oli']);
  await alasPage.getByRole('link', { name: 'Otwórz', exact: true }).click();
  await expect(alasPage.getByRole('heading', { name: 'Wspólny zin' })).toBeVisible();
  await expect(alasPage.getByText('Zapisano na Dysku')).toHaveAttribute('title', /Ostatnia zmiana: Ola/);

  await alasContext.close();
  await olasContext.close();
});
