import interBold from '@fontsource/inter/files/inter-latin-700-normal.woff2?url';
import interRegular from '@fontsource/inter/files/inter-latin-400-normal.woff2?url';
import { expect, test } from 'vitest';
import { createTextElement, createZine } from '../../model/factory';
import type { TextElement } from '../../model/types';
import { putFontFamily, putFontFile } from '../../storage/db';
import { chooseFiles } from '../../test/files';
import { renderPanel } from '../../test/panelHarness';

async function fontFile(url: string, name: string): Promise<File> {
  return new File([await (await fetch(url)).arrayBuffer()], name);
}

const textOf = (zine: { spreads: { elements: unknown[] }[] }) => zine.spreads[0].elements[0] as TextElement;

test('uploaded files become a family of this zine and the text uses it', async () => {
  const { screen, zine } = await renderPanel(createZine('Lato', 1), (store) =>
    store.getState().addElement(createTextElement({ text: 'a' })),
  );
  chooseFiles(screen.getByLabelText('Wybierz pliki fontów').element(), [
    await fontFile(interRegular, 'Moja-Regular.woff2'),
    await fontFile(interBold, 'Moja-Bold.woff2'),
  ]);
  await expect.element(screen.getByLabelText('Font', { exact: true })).toHaveDisplayValue('Moja');
  expect(zine().fonts).toHaveLength(1);
  expect(textOf(zine()).fontFamilyId).toBe(zine().fonts[0]);
  await expect.element(screen.getByRole('button', { name: 'Pogrubienie' })).toBeEnabled();
  await expect.element(screen.getByRole('button', { name: 'Kursywa' })).toBeDisabled();
});

test('files that are not fonts are reported', async () => {
  const { screen, zine } = await renderPanel(createZine('Lato', 1), (store) =>
    store.getState().addElement(createTextElement({ text: 'a' })),
  );
  chooseFiles(screen.getByLabelText('Wybierz pliki fontów').element(), [new File(['x'], 'Zepsuty.ttf')]);
  await expect.element(screen.getByRole('alert')).toHaveTextContent('Pominięto plików: 1 (to nie są fonty).');
  expect(zine().fonts).toEqual([]);
});

test('"Użyj fontu z innego zina" adds a family uploaded elsewhere', async () => {
  const { screen, db, zine } = await renderPanel(createZine('Lato', 1), (store) =>
    store.getState().addElement(createTextElement({ text: 'a' })),
  );
  await putFontFamily(db, { id: 'inna', name: 'Inna' });
  const data = await (await fetch(interRegular)).arrayBuffer();
  await putFontFile(db, { id: 'inna-r', familyId: 'inna', bold: false, italic: false, mime: 'font/woff2', data });
  await screen.getByRole('button', { name: 'Użyj fontu z innego zina' }).click();
  await screen.getByRole('list', { name: 'Fonty z innych zinów' }).getByRole('button', { name: 'Inna' }).click();
  await expect.poll(() => textOf(zine()).fontFamilyId).toBe('inna');
  expect(zine().fonts).toEqual(['inna']);
});
