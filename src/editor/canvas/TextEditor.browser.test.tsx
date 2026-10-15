import { userEvent } from '@vitest/browser/context';
import Konva from 'konva';
import { expect, test } from 'vitest';
import { createTextElement, createZine } from '../../model/factory';
import type { TextElement } from '../../model/types';
import '../../app/app.css';
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

test('double-clicking a text that is not selected yet opens the text box', async () => {
  const zine = createZine('Lato', 1);
  const text = createTextElement({ text: 'Ala', x: 112, y: 30, width: 86, size: 24 });
  zine.spreads[0].elements.push(text);
  const { screen } = await openInEditor(zine);
  await expect.element(screen.getByRole('heading', { name: 'Lato' })).toBeVisible();
  const surface = document.querySelector('.spread-stage .konvajs-content') as HTMLElement;
  const stage = Konva.stages.find((s) => s.content === surface)!;
  await expect.poll(() => stage.findOne((n: Konva.Node) => n.id() === text.id)).toBeTruthy();
  const box = stage.findOne((n: Konva.Node) => n.id() === text.id)!.getClientRect();
  await userEvent.dblClick(surface, { position: { x: box.x + box.width / 2, y: box.y + box.height / 2 } });
  const editor = screen.getByRole('textbox', { name: 'Treść napisu' });
  await expect.element(editor).toBeVisible();
  await expect.element(editor).toHaveValue('Ala');
});
