import { userEvent } from '@vitest/browser/context';
import { expect, test } from 'vitest';
import { createZine } from '../../model/factory';
import type { TextElement } from '../../model/types';
import { openInEditor } from '../../test/editorHarness';

test('"+ Napis" opens the text box; typing changes the text and Escape ends editing', async () => {
  const { screen, stored } = await openInEditor(createZine('Lato', 1));
  await screen.getByRole('button', { name: '+ Napis' }).click();
  const box = screen.getByRole('textbox', { name: 'Treść napisu' });
  await expect.element(box).toHaveFocus();
  await expect.element(box).toHaveValue('Napis');
  await userEvent.keyboard('Ala ma kota');
  await expect.element(box).toHaveValue('Ala ma kota');
  await userEvent.keyboard('{Escape}');
  await expect.element(box).not.toBeInTheDocument();
  await expect.poll(async () => ((await stored()).spreads[0].elements[0] as TextElement).text).toBe('Ala ma kota');
  // Typing was one undo step on top of adding the frame.
  await screen.getByRole('button', { name: 'Cofnij' }).click();
  await expect.poll(async () => ((await stored()).spreads[0].elements[0] as TextElement).text).toBe('Napis');
});

test('a text frame left empty is removed', async () => {
  const { screen, stored } = await openInEditor(createZine('Lato', 1));
  const savedBefore = (await stored()).updatedAt;
  await screen.getByRole('button', { name: '+ Napis' }).click();
  const box = screen.getByRole('textbox', { name: 'Treść napisu' });
  await expect.element(box).toHaveFocus();
  await userEvent.keyboard('{Backspace}{Escape}');
  await expect.element(box).not.toBeInTheDocument();
  // Wait for a save made after the frame was added, so an empty list is not the untouched zine.
  await expect
    .poll(async () => {
      const zine = await stored();
      return { saved: zine.updatedAt !== savedBefore, elements: zine.spreads[0].elements };
    })
    .toEqual({ saved: true, elements: [] });
});
