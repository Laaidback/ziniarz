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

const sectionOf = (spreadId: string) => document.querySelector<HTMLElement>(`[data-section="${spreadId}"]`);
const sectionList = () => document.querySelector<HTMLElement>('.notes-sections')!;
const thumbnails = (screen: Screen) => screen.getByRole('navigation', { name: 'Rozkładówki' });
const notesBox = (screen: Screen, name: string) => screen.getByRole('textbox', { name: `Notatki: ${name}` });
const notesElement = (screen: Screen, name: string) => notesBox(screen, name).element() as HTMLElement;

/** Whether `element` lies fully inside the visible part of the scrolling section list. */
function inView(element: HTMLElement): boolean {
  const list = sectionList().getBoundingClientRect();
  const box = element.getBoundingClientRect();
  return box.top >= list.top - 1 && box.bottom <= list.bottom + 1;
}

/** Waits until the section list stops scrolling (a smooth scroll may still be running). */
async function settled(): Promise<void> {
  let last = -1;
  while (sectionList().scrollTop !== last) {
    last = sectionList().scrollTop;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
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

test('"Całość" shows general notes and a section per spread, in order, as one document', async () => {
  const zine = zineWith(2, (z) => {
    z.notes = 'Ogólnie';
    z.spreadNotes = { [z.spreads[2].id]: '<b>Wiersz</b> o lecie' };
  });
  const { screen } = await openInEditor(zine);
  await expect.element(screen.getByRole('button', { name: 'Całość' })).toHaveAttribute('aria-pressed', 'true');
  await expect.element(notesBox(screen, 'Ogólne')).toHaveTextContent('Ogólnie');
  const titles = [...document.querySelectorAll('.notes-section-title')].map((t) => t.textContent);
  expect(titles).toEqual(['Ogólne', 'Okładkateraz', 'Strony 2–3', 'Strony 4–5', 'Strony 6–7']);
  await expect.element(notesBox(screen, 'Strony 4–5')).toHaveTextContent('Wiersz o lecie');
  expect(notesBox(screen, 'Strony 4–5').element().innerHTML).toBe('<b>Wiersz</b> o lecie');
  // Empty sections show a light hint and stay low.
  const empty = notesBox(screen, 'Strony 6–7');
  await expect.element(empty).toHaveAttribute('data-placeholder', 'Notatki do: Strony 6–7');
  await expect.element(empty).toHaveClass('is-empty');
  expect(empty.element().getBoundingClientRect().height).toBeLessThan(45);
});

test('typing in a spread section saves its notes without an undo step, and they come back after reopening', async () => {
  const zine = zineWith(2);
  const { db, screen, stored } = await openInEditor(zine);
  await notesBox(screen, 'Strony 2–3').click();
  await userEvent.keyboard('Tekst do 2–3');
  await expect.poll(async () => (await stored()).spreadNotes).toEqual({ [zine.spreads[1].id]: 'Tekst do 2–3' });
  await expect.element(screen.getByRole('button', { name: 'Cofnij' })).toBeDisabled();
  // Bold works in a spread section too.
  selectAllIn(notesElement(screen, 'Strony 2–3'));
  await userEvent.keyboard('{Control>}b{/Control}');
  await expect.poll(async () => (await stored()).spreadNotes[zine.spreads[1].id]).toBe('<b>Tekst do 2–3</b>');
  screen.unmount();

  const again = render(
    <DbContext.Provider value={db}>
      <EditorScreen zineId={zine.id} />
    </DbContext.Provider>,
  );
  await expect.element(again.getByRole('textbox', { name: 'Notatki: Strony 2–3' })).toHaveTextContent('Tekst do 2–3');
});

test('the open spread\'s section is highlighted and scrolls into view when the editor changes spread', async () => {
  const zine = zineWith(5);
  const { screen } = await openInEditor(zine);
  await expect.element(notesBox(screen, 'Okładka')).toBeVisible();
  const cover = sectionOf(zine.spreads[0].id)!;
  await expect.element(cover).toHaveClass('is-current');
  const far = zine.spreads[8];
  // Thumbnails render first; smooth scrolling waits for a free main thread.
  await expect.poll(() => document.querySelectorAll('.spread-thumb img').length, { timeout: 5000 }).toBe(10);
  expect(inView(sectionOf(far.id)!)).toBe(false);

  await thumbnails(screen).getByRole('button', { name: 'Strony 16–17' }).click();
  await expect.element(sectionOf(far.id)!).toHaveClass('is-current');
  await expect.element(cover).not.toHaveClass('is-current');
  await expect.poll(() => inView(sectionOf(far.id)!), { timeout: 5000 }).toBe(true);
  // The editor keeps the focus: the notepad does not take it.
  expect(document.activeElement?.closest('.editor-notes')).toBeNull();
  await expect.element(screen.getByText('teraz')).toBeVisible();

  // Not while typing in another section: a spread change does not move the notes away.
  const general = notesElement(screen, 'Ogólne');
  general.focus();
  await settled();
  sectionList().scrollTo({ top: 0 });
  await expect.poll(() => sectionList().scrollTop).toBe(0);
  (thumbnails(screen).getByRole('button', { name: 'Strony 18–19' }).element() as HTMLElement).click();
  await expect.element(sectionOf(zine.spreads[9].id)!).toHaveClass('is-current');
  await new Promise((resolve) => setTimeout(resolve, 300));
  expect(sectionList().scrollTop).toBe(0);
  expect(document.activeElement).toBe(general);
});

test('clicking a section heading in "Całość" opens that spread in the editor', async () => {
  const { screen } = await openInEditor(zineWith(3));
  await screen.getByRole('complementary', { name: 'Notatnik' }).getByRole('button', { name: 'Strony 6–7' }).click();
  await expect.element(thumbnails(screen).getByRole('button', { name: 'Strony 6–7' })).toHaveAttribute('aria-current', 'true');
});

test('"Ta rozkładówka" shows only the open spread\'s section, follows the editor and is remembered', async () => {
  const zine = zineWith(3, (z) => {
    z.spreadNotes = { [z.spreads[1].id]: 'Dwa', [z.spreads[2].id]: 'Cztery' };
  });
  const { db, screen } = await openInEditor(zine);
  await screen.getByRole('button', { name: 'Ta rozkładówka' }).click();
  await expect.element(screen.getByRole('button', { name: 'Ta rozkładówka' })).toHaveAttribute('aria-pressed', 'true');
  await expect.element(notesBox(screen, 'Okładka')).toBeVisible();
  await expect.element(notesBox(screen, 'Ogólne')).not.toBeInTheDocument();
  await expect.element(notesBox(screen, 'Strony 2–3')).not.toBeInTheDocument();
  // No "teraz" and no jump button: the only section is the open spread.
  await expect.element(screen.getByText('teraz')).not.toBeInTheDocument();

  await thumbnails(screen).getByRole('button', { name: 'Strony 2–3' }).click();
  await expect.element(notesBox(screen, 'Strony 2–3')).toHaveTextContent('Dwa');
  await expect.element(notesBox(screen, 'Okładka')).not.toBeInTheDocument();
  await userEvent.keyboard('{PageDown}');
  await expect.element(notesBox(screen, 'Strony 4–5')).toHaveTextContent('Cztery');
  expect(localStorage.getItem('ziniarz.notesView')).toBe('spread');
  screen.unmount();

  const again = render(
    <DbContext.Provider value={db}>
      <EditorScreen zineId={zine.id} />
    </DbContext.Provider>,
  );
  await expect.element(again.getByRole('button', { name: 'Ta rozkładówka' })).toHaveAttribute('aria-pressed', 'true');
  await expect.element(again.getByRole('textbox', { name: 'Notatki: Okładka' })).toBeVisible();
  await again.getByRole('button', { name: 'Całość' }).click();
  await expect.element(again.getByRole('textbox', { name: 'Notatki: Ogólne' })).toBeVisible();
  expect(localStorage.getItem('ziniarz.notesView')).toBe('all');
});

test('"Wstaw zaznaczenie jako napis" from another spread\'s section puts the text on that spread', async () => {
  const zine = zineWith(2, (z) => {
    z.spreadNotes = { [z.spreads[2].id]: 'Na czwartą' };
  });
  const { screen, stored } = await openInEditor(zine);
  await expect.element(thumbnails(screen).getByRole('button', { name: 'Okładka' })).toHaveAttribute('aria-current', 'true');
  selectAllIn(notesElement(screen, 'Strony 4–5'));
  await screen.getByRole('button', { name: 'Wstaw zaznaczenie jako napis' }).click();
  await expect.poll(async () => (await stored()).spreads[2].elements.map((e) => (e as TextElement).text)).toEqual(['Na czwartą']);
  expect((await stored()).spreads[0].elements).toEqual([]);
  await expect.element(thumbnails(screen).getByRole('button', { name: 'Strony 4–5' })).toHaveAttribute('aria-current', 'true');
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
  await expect.element(notesBox(screen, 'Strony 2–3')).toHaveTextContent('Zostaje');
  await expect.element(screen.getByText('Znika')).not.toBeInTheDocument();
});
