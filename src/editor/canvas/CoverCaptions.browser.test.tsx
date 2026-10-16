import { expect, test } from 'vitest';
import '../../app/app.css';
import { createZine } from '../../model/factory';
import { openInEditor } from '../../test/editorHarness';

test('the cover says which half is the back and which the front; other spreads do not', async () => {
  const { screen } = await openInEditor(createZine('Lato', 2));
  const back = screen.getByText('tył', { exact: true });
  const front = screen.getByText('przód', { exact: true });
  await expect.element(back).toBeVisible();
  await expect.element(front).toBeVisible();
  const backBox = back.element().getBoundingClientRect();
  const frontBox = front.element().getBoundingClientRect();
  expect(backBox.right).toBeLessThan(frontBox.left);
  // Below the spread with its bleed, inside the canvas area.
  const stage = document.querySelector('.spread-stage')!.getBoundingClientRect();
  expect(backBox.bottom).toBeLessThanOrEqual(stage.bottom);

  await screen.getByRole('navigation', { name: 'Rozkładówki' }).getByRole('button', { name: 'Strony 2–3' }).click();
  await expect.element(screen.getByText('tył', { exact: true })).not.toBeInTheDocument();
  await expect.element(screen.getByText('przód', { exact: true })).not.toBeInTheDocument();
});
