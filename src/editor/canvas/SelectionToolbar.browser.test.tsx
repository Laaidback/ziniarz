import { userEvent } from '@vitest/browser/context';
import { expect, test } from 'vitest';
import '../../app/app.css';
import { createZine } from '../../model/factory';
import { openInEditor } from '../../test/editorHarness';

/** A zine with one new text on the cover, selected, not in typing mode. */
async function editorWithText() {
  const opened = await openInEditor(createZine('Lato', 1));
  const { screen } = opened;
  await screen.getByRole('button', { name: '+ Napis' }).click();
  await expect.element(screen.getByRole('textbox', { name: 'Treść napisu' })).toHaveFocus();
  // No toolbar while typing.
  expect(screen.getByRole('toolbar', { name: 'Zaznaczony element' }).query()).toBeNull();
  await userEvent.keyboard('{Escape}');
  await expect.element(screen.getByRole('toolbar', { name: 'Zaznaczony element' })).toBeVisible();
  return opened;
}

test('the trash throws the selected element away; undo brings it back', async () => {
  const { screen, stored } = await editorWithText();
  await screen.getByRole('button', { name: 'Wyrzuć' }).click();
  await expect.poll(async () => (await stored()).spreads[0].elements).toEqual([]);
  expect(screen.getByRole('toolbar', { name: 'Zaznaczony element' }).query()).toBeNull();
  await screen.getByRole('button', { name: 'Cofnij' }).click();
  await expect.poll(async () => (await stored()).spreads[0].elements).toHaveLength(1);
});

test('the lock keeps the element from the trash and the keyboard until unlocked', async () => {
  const { screen, stored } = await editorWithText();
  await screen.getByRole('button', { name: 'Zablokuj' }).click();
  await expect.element(screen.getByRole('button', { name: 'Wyrzuć' })).toBeDisabled();
  await expect.poll(async () => (await stored()).spreads[0].elements.map((e) => e.locked)).toEqual([true]);
  const { x } = (await stored()).spreads[0].elements[0];
  await userEvent.keyboard('{ArrowRight}{Backspace}');
  // Unlocking is the next change; autosave stores it with the element where it was.
  await screen.getByRole('button', { name: 'Odblokuj' }).click();
  await expect.poll(async () => (await stored()).spreads[0].elements.map((e) => [e.x, e.locked])).toEqual([[x, false]]);
  await screen.getByRole('button', { name: 'Wyrzuć' }).click();
  await expect.poll(async () => (await stored()).spreads[0].elements).toEqual([]);
});

test('a locked element shows "Usuń" and "Obrót" greyed out in the settings', async () => {
  const { screen } = await editorWithText();
  await screen.getByRole('button', { name: 'Zablokuj' }).click();
  await screen.getByRole('button', { name: 'Ustawienia', exact: true }).click();
  await expect.element(screen.getByRole('button', { name: 'Usuń' })).toBeDisabled();
  await expect.element(screen.getByRole('spinbutton', { name: 'Obrót' })).toBeDisabled();
});
