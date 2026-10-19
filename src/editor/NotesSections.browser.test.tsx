import { userEvent } from '@vitest/browser/context';
import { render } from 'vitest-browser-react';
import { afterEach, expect, test } from 'vitest';
import '../app/app.css';
import { DbContext } from '../app/dbContext';
import { createZine } from '../model/factory';
import type { TextElement, Zine } from '../model/types';
import { openInEditor } from '../test/editorHarness';
import { EditorScreen } from './EditorScreen';

afterEach(() => localStorage.removeItem('ziniarz.notesView'));

type Screen = Awaited<ReturnType<typeof openInEditor>>['screen'];

const tileOf = (spreadId: string) => document.querySelector<HTMLElement>(`.notes-tile[data-section="${spreadId}"]`);
const tileList = () => document.querySelector<HTMLElement>('.notes-tiles')!;
const thumbnails = (screen: Screen) => screen.getByRole('navigation', { name: 'Rozkładówki' });
const notepad = (screen: Screen) => screen.getByRole('complementary', { name: 'Notatnik' });
const tile = (screen: Screen, name: string) =>
  notepad(screen).getByRole('group', { name: 'Kartki notatnika' }).getByRole('button', { name, exact: true });
const notesBox = (screen: Screen, name: string) => screen.getByRole('textbox', { name: `Notatki: ${name}` });
const notesElement = (screen: Screen, name: string) => notesBox(screen, name).element() as HTMLElement;

/** Whether `element` lies fully inside the visible part of the scrolling grid. */
function inView(element: HTMLElement): boolean {
  const list = tileList().getBoundingClientRect();
  const box = element.getBoundingClientRect();
  return box.top >= list.top - 1 && box.bottom <= list.bottom + 1;
}

/** Selects all text of a notepad field, as a mouse would. */
function selectAllIn(element: HTMLElement): void {
  element.focus();
  const range = document.createRange();
  range.selectNodeContents(element);
  document.getSelection()!.removeAllRanges();
  document.getSelection()!.addRange(range);
}

function zineWith(sheets: number, notes: (zine: Zine) => void = () => {}): Zine {
  const zine = createZine('Lato', sheets);
  notes(zine);
  return zine;
}

test('the notepad shows a tile per section, in order, with the start of its notes', async () => {
  const zine = zineWith(2, (z) => {
    z.notes = 'Ogólnie';
    z.spreadNotes = { [z.spreads[2].id]: '<b>Wiersz</b> o lecie<div>druga linia</div>' };
  });
  const { screen } = await openInEditor(zine);
  await expect.element(tile(screen, 'Ogólne')).toHaveTextContent('Ogólnie');
  const titles = [...document.querySelectorAll('.notes-tile-title')].map((t) => t.textContent);
  expect(titles).toEqual(['Ogólne', 'Okładkateraz', 'Strony 2–3', 'Strony 4–5', 'Strony 6–7']);
  // Plain text, line by line: no formatting in a tile.
  expect(tileOf(zine.spreads[2].id)!.querySelector('.notes-tile-text')!.textContent).toBe('Wiersz o lecie\ndruga linia');
  await expect.element(tile(screen, 'Strony 6–7')).toHaveTextContent('pusto');
  // The open spread's tile is marked; nothing to type into until a tile is opened.
  await expect.element(tile(screen, 'Okładka')).toHaveAttribute('aria-current', 'true');
  await expect.element(tile(screen, 'Strony 2–3')).not.toHaveAttribute('aria-current');
  expect(document.querySelectorAll('.editor-notes [role="textbox"]')).toHaveLength(0);
  await expect.element(screen.getByRole('button', { name: 'Wstaw zaznaczenie jako napis' })).not.toBeInTheDocument();
});

test('a tile opens its page and that spread; "Wszystkie" goes back to the tiles', async () => {
  const zine = zineWith(3, (z) => {
    z.spreadNotes = { [z.spreads[3].id]: 'Sześć' };
  });
  const { screen } = await openInEditor(zine);
  await tile(screen, 'Strony 6–7').click();
  await expect.element(thumbnails(screen).getByRole('button', { name: 'Strony 6–7' })).toHaveAttribute('aria-current', 'true');
  const box = notesBox(screen, 'Strony 6–7');
  await expect.element(box).toHaveTextContent('Sześć');
  // Ready to write: the caret is at the end of the notes.
  await expect.element(box).toHaveFocus();
  await userEvent.keyboard(' i siedem');
  await expect.element(box).toHaveTextContent('Sześć i siedem');
  await expect.element(tile(screen, 'Ogólne')).not.toBeInTheDocument();

  await notepad(screen).getByRole('button', { name: 'Wszystkie' }).click();
  await expect.element(tile(screen, 'Strony 6–7')).toHaveTextContent('Sześć i siedem');
  await expect.element(tile(screen, 'Strony 6–7')).toHaveAttribute('aria-current', 'true');
  expect(localStorage.getItem('ziniarz.notesView')).toBe('all');
});

test('typing on a spread page saves its notes without an undo step; the page is remembered', async () => {
  const zine = zineWith(2);
  const { db, screen, stored } = await openInEditor(zine);
  await tile(screen, 'Strony 2–3').click();
  await expect.element(notesBox(screen, 'Strony 2–3')).toHaveFocus();
  await userEvent.keyboard('Tekst do 2–3');
  await expect.poll(async () => (await stored()).spreadNotes).toEqual({ [zine.spreads[1].id]: 'Tekst do 2–3' });
  await expect.element(screen.getByRole('button', { name: 'Cofnij' })).toBeDisabled();
  // Bold works on a spread page too.
  selectAllIn(notesElement(screen, 'Strony 2–3'));
  await userEvent.keyboard('{Control>}b{/Control}');
  await expect.poll(async () => (await stored()).spreadNotes[zine.spreads[1].id]).toBe('<b>Tekst do 2–3</b>');
  expect(localStorage.getItem('ziniarz.notesView')).toBe('spread');
  screen.unmount();

  // Reopened, the notepad shows the page of the spread open in the editor (the cover).
  const again = render(
    <DbContext.Provider value={db}>
      <EditorScreen zineId={zine.id} />
    </DbContext.Provider>,
  );
  await expect.element(again.getByRole('textbox', { name: 'Notatki: Okładka' })).toBeVisible();
  await again.getByRole('navigation', { name: 'Rozkładówki' }).getByRole('button', { name: 'Strony 2–3' }).click();
  await expect.element(again.getByRole('textbox', { name: 'Notatki: Strony 2–3' })).toHaveTextContent('Tekst do 2–3');
});

test('a spread page follows the editor; the general page stays', async () => {
  const zine = zineWith(3, (z) => {
    z.notes = 'Wszędzie';
    z.spreadNotes = { [z.spreads[1].id]: 'Dwa', [z.spreads[2].id]: 'Cztery' };
  });
  const { screen } = await openInEditor(zine);
  await tile(screen, 'Okładka').click();
  await expect.element(notesBox(screen, 'Okładka')).toBeVisible();
  await thumbnails(screen).getByRole('button', { name: 'Strony 2–3' }).click();
  await expect.element(notesBox(screen, 'Strony 2–3')).toHaveTextContent('Dwa');
  await expect.element(notesBox(screen, 'Okładka')).not.toBeInTheDocument();
  await userEvent.keyboard('{PageDown}');
  await expect.element(notesBox(screen, 'Strony 4–5')).toHaveTextContent('Cztery');

  await notepad(screen).getByRole('button', { name: 'Wszystkie' }).click();
  await tile(screen, 'Ogólne').click();
  await expect.element(notesBox(screen, 'Ogólne')).toHaveTextContent('Wszędzie');
  // The editor stays where it was.
  await expect.element(thumbnails(screen).getByRole('button', { name: 'Strony 4–5' })).toHaveAttribute('aria-current', 'true');
  await thumbnails(screen).getByRole('button', { name: 'Strony 2–3' }).click();
  await expect.element(notesBox(screen, 'Ogólne')).toBeVisible();
  expect(localStorage.getItem('ziniarz.notesView')).toBe('general');
});

test('the open spread\'s tile scrolls into view when the editor changes spread', async () => {
  const zine = zineWith(10);
  const { screen } = await openInEditor(zine);
  await expect.element(tile(screen, 'Okładka')).toBeVisible();
  const far = zine.spreads[18];
  // Thumbnails render first; smooth scrolling waits for a free main thread.
  await expect.poll(() => document.querySelectorAll('.spread-thumb img').length, { timeout: 8000 }).toBe(20);
  expect(inView(tileOf(far.id)!)).toBe(false);

  await thumbnails(screen).getByRole('button', { name: 'Strony 36–37' }).click();
  await expect.element(tileOf(far.id)!).toHaveAttribute('aria-current', 'true');
  await expect.element(tileOf(zine.spreads[0].id)!).not.toHaveAttribute('aria-current');
  await expect.poll(() => inView(tileOf(far.id)!), { timeout: 5000 }).toBe(true);
  // The editor keeps the focus: the notepad does not take it.
  expect(document.activeElement?.closest('.editor-notes')).toBeNull();
  await expect.element(screen.getByText('teraz')).toBeVisible();
});

test('"Wstaw zaznaczenie jako napis" from the general page puts the text on the open spread', async () => {
  const zine = zineWith(2, (z) => {
    z.notes = 'Na drugą';
  });
  const { screen, stored } = await openInEditor(zine);
  await thumbnails(screen).getByRole('button', { name: 'Strony 2–3' }).click();
  await tile(screen, 'Ogólne').click();
  selectAllIn(notesElement(screen, 'Ogólne'));
  await screen.getByRole('button', { name: 'Wstaw zaznaczenie jako napis' }).click();
  await expect.poll(async () => (await stored()).spreads[1].elements.map((e) => (e as TextElement).text)).toEqual(['Na drugą']);
  expect((await stored()).spreads[0].elements).toEqual([]);
});

test('"− kartka" asks first when the removed spreads have notes, and the notes go with them', async () => {
  const zine = zineWith(2, (z) => {
    z.spreadNotes = { [z.spreads[1].id]: 'Zostaje', [z.spreads[3].id]: 'Znika' };
  });
  const { screen, stored } = await openInEditor(zine);
  await screen.getByRole('button', { name: '− kartka' }).click();
  await expect
    .element(screen.getByRole('dialog'))
    .toHaveTextContent('Strony 4–7 mają notatki w notatniku, które znikną. Usunąć kartkę?');
  await screen.getByRole('button', { name: 'Usuń kartkę' }).click();
  await expect.poll(async () => (await stored()).sheets).toBe(1);
  expect((await stored()).spreadNotes).toEqual({ [zine.spreads[1].id]: 'Zostaje' });
  await expect.element(tile(screen, 'Strony 2–3')).toHaveTextContent('Zostaje');
  await expect.element(screen.getByText('Znika')).not.toBeInTheDocument();
});
