import { userEvent } from '@vitest/browser/context';
import { render } from 'vitest-browser-react';
import { afterEach, expect, test } from 'vitest';
import '../app/app.css';
import { DbContext } from '../app/dbContext';
import { createTextElement, createZine } from '../model/factory';
import type { TextElement, Zine } from '../model/types';
import { openInEditor } from '../test/editorHarness';
import { EditorScreen } from './EditorScreen';

afterEach(() => localStorage.removeItem('ziniarz.showNotes'));

const notepad = () => document.querySelector<HTMLElement>('[role="textbox"][aria-label="Notatnik"]')!;

/** Selects `text` (its first occurrence, maybe across formatting) inside the notepad, as a mouse would. */
function selectInNotes(text: string): void {
  const root = notepad();
  const nodes: Text[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) nodes.push(node as Text);
  const at = nodes.map((n) => n.data).join('').indexOf(text);
  if (at < 0) throw new Error(`"${text}" is not in the notepad`);
  /** Text node and offset of a character position in the joined text. */
  const locate = (position: number, end: boolean): [Text, number] => {
    let offset = position;
    for (const node of nodes) {
      if (offset < node.length || (end && offset === node.length)) return [node, offset];
      offset -= node.length;
    }
    throw new Error('outside the notepad');
  };
  root.focus();
  const range = document.createRange();
  range.setStart(...locate(at, false));
  range.setEnd(...locate(at + text.length, true));
  document.getSelection()!.removeAllRanges();
  document.getSelection()!.addRange(range);
}

function selectAllNotes(): void {
  const root = notepad();
  root.focus();
  const range = document.createRange();
  range.selectNodeContents(root);
  document.getSelection()!.removeAllRanges();
  document.getSelection()!.addRange(range);
}

/** Opens a zine with these notes, once the notepad is there. */
async function openWithNotes(notes: string) {
  const opened = await openInEditor(zineWithNotes(notes));
  await expect.element(opened.screen.getByRole('textbox', { name: 'Notatnik' })).toBeVisible();
  return opened;
}

function zineWithNotes(notes: string): Zine {
  const zine = createZine('Lato', 1);
  zine.notes = notes;
  return zine;
}

test('the notepad starts empty with a hint; typing is saved and comes back after reopening', async () => {
  const zine = createZine('Lato', 1);
  const { db, screen, stored } = await openInEditor(zine);
  const box = screen.getByRole('textbox', { name: 'Notatnik' });
  await expect.element(screen.getByRole('heading', { name: 'Notatnik' })).toBeVisible();
  await expect.element(box).toHaveAttribute('data-placeholder', 'Tu trzymaj teksty do zina. Wklejaj, poprawiaj i kopiuj do napisów.');
  await expect.element(box).toHaveAttribute('spellcheck', 'true');
  await box.click();
  await userEvent.keyboard('Ala ma kota');
  await expect.poll(async () => (await stored()).notes).toBe('Ala ma kota');
  // Notes are not a design change: nothing to undo.
  await expect.element(screen.getByRole('button', { name: 'Cofnij' })).toBeDisabled();
  screen.unmount();

  const again = render(
    <DbContext.Provider value={db}>
      <EditorScreen zineId={zine.id} />
    </DbContext.Provider>,
  );
  await expect.element(again.getByRole('textbox', { name: 'Notatnik' })).toHaveTextContent('Ala ma kota');
});

test('"Notatnik" in the top bar hides and shows the column, and the choice is remembered', async () => {
  const zine = createZine('Lato', 1);
  const { db, screen } = await openInEditor(zine);
  const toggle = screen.getByRole('button', { name: 'Notatnik', exact: true });
  await expect.element(toggle).toHaveAttribute('aria-pressed', 'true');
  const canvas = document.querySelector<HTMLElement>('.editor-canvas')!;
  const narrow = canvas.clientWidth;
  await toggle.click();
  await expect.element(toggle).toHaveAttribute('aria-pressed', 'false');
  await expect.element(screen.getByRole('textbox', { name: 'Notatnik' })).not.toBeInTheDocument();
  // The canvas takes the space back and the stage follows it.
  await expect.poll(() => canvas.clientWidth).toBe(narrow + 280);
  await expect.poll(() => document.querySelector<HTMLCanvasElement>('.spread-stage canvas')!.clientWidth).toBe(narrow + 280);
  screen.unmount();

  const again = render(
    <DbContext.Provider value={db}>
      <EditorScreen zineId={zine.id} />
    </DbContext.Provider>,
  );
  const toggleAgain = again.getByRole('button', { name: 'Notatnik', exact: true });
  await expect.element(toggleAgain).toHaveAttribute('aria-pressed', 'false');
  await expect.element(again.getByRole('textbox', { name: 'Notatnik' })).not.toBeInTheDocument();
  await toggleAgain.click();
  await expect.element(again.getByRole('textbox', { name: 'Notatnik' })).toBeVisible();
  expect(localStorage.getItem('ziniarz.showNotes')).toBe('1');

  // "Schowaj" in the notepad's own header hides it the same way.
  await again.getByRole('button', { name: 'Schowaj notatnik' }).click();
  await expect.element(again.getByRole('textbox', { name: 'Notatnik' })).not.toBeInTheDocument();
  await expect.element(toggleAgain).toHaveAttribute('aria-pressed', 'false');
  expect(localStorage.getItem('ziniarz.showNotes')).toBe('0');
});

test('"Wstaw zaznaczenie jako napis" adds the selected plain text as a selected frame, in one undo step', async () => {
  const { screen, stored } = await openWithNotes('<div><b>Tytuł</b></div><div>Ala <mark>ma</mark> kota</div>');
  const insert = screen.getByRole('button', { name: 'Wstaw zaznaczenie jako napis' });
  await expect.element(insert).toBeDisabled();
  selectAllNotes();
  await expect.element(insert).toBeEnabled();
  await insert.click();
  await expect
    .poll(async () => (await stored()).spreads[0].elements.map((e) => (e as TextElement).text))
    .toEqual(['Tytuł\nAla ma kota']);
  // Selected, not opened for typing; the canvas panel shows the text settings.
  await expect.element(screen.getByRole('textbox', { name: 'Treść napisu' })).not.toBeInTheDocument();
  await screen.getByRole('button', { name: 'Cofnij' }).click();
  await expect.poll(async () => (await stored()).spreads[0].elements).toEqual([]);
  await expect.element(screen.getByRole('button', { name: 'Cofnij' })).toBeDisabled();
});

test('editor shortcuts do nothing while typing in the notepad', async () => {
  const zine = createZine('Lato', 1);
  zine.spreads[0].elements.push(createTextElement({ text: 'Napis', x: 120, y: 30 }));
  const { screen, stored } = await openInEditor(zine);
  await screen.getByRole('button', { name: '+ Napis' }).click();
  await userEvent.keyboard('{Escape}');
  await expect.poll(async () => (await stored()).spreads[0].elements).toHaveLength(2);
  const box = screen.getByRole('textbox', { name: 'Notatnik' });
  await box.click();
  await userEvent.keyboard('abc');
  for (const keys of ['{Meta>}z{/Meta}', '{Control>}z{/Control}', '{Meta>}{Shift>}z{/Shift}{/Meta}', '{Meta>}d{/Meta}']) {
    await userEvent.keyboard(keys);
  }
  await userEvent.keyboard('{Backspace}{Delete}{ArrowLeft}{PageDown}{Escape}');
  await expect.element(box).toHaveFocus();
  // The new frame is still there, still the only change to undo, and nothing was duplicated.
  const elements = (await stored()).spreads[0].elements;
  expect(elements).toHaveLength(2);
  await expect.element(screen.getByRole('navigation', { name: 'Rozkładówki' }).getByRole('button').first()).toHaveAttribute(
    'aria-current',
    'true',
  );
});

test('bold and highlight toggle on the selection, also with shortcuts, and are saved', async () => {
  const { screen, stored } = await openWithNotes('Ala ma kota');
  const bold = screen.getByRole('button', { name: 'Pogrubienie' });
  const marker = screen.getByRole('button', { name: 'Zaznaczenie', exact: true });
  selectInNotes('ma');
  await expect.element(bold).toHaveAttribute('aria-pressed', 'false');
  await bold.click();
  await expect.element(bold).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(async () => (await stored()).notes).toBe('Ala <b>ma</b> kota');
  await bold.click();
  await expect.poll(async () => (await stored()).notes).toBe('Ala ma kota');

  selectInNotes('kota');
  await marker.click();
  await expect.element(marker).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(async () => (await stored()).notes).toBe('Ala ma <mark>kota</mark>');
  selectInNotes('ot');
  await expect.element(marker).toHaveAttribute('aria-pressed', 'true');
  await marker.click();
  await expect.poll(async () => (await stored()).notes).toBe('Ala ma <mark>k</mark>ot<mark>a</mark>');

  selectInNotes('Ala ma k');
  await userEvent.keyboard('{Control>}{Shift>}h{/Shift}{/Control}');
  await expect.poll(async () => (await stored()).notes).toBe('<mark>Ala ma k</mark>ot<mark>a</mark>');
  selectInNotes('Ala');
  await userEvent.keyboard('{Control>}b{/Control}');
  await expect.poll(async () => (await stored()).notes).toBe('<mark><b>Ala</b> ma k</mark>ot<mark>a</mark>');
});

test('pasting into the notepad inserts plain text only', async () => {
  const { stored } = await openWithNotes('Ala kota');
  selectInNotes('Ala ');
  const data = new DataTransfer();
  data.setData('text/html', '<span style="color:red"><b>ma</b></span> <a href="x">link</a>');
  data.setData('text/plain', 'ma link\ni coś');
  notepad().dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
  await expect.poll(() => notepad().innerText).toBe('ma link\ni cośkota');
  await expect.poll(async () => (await stored()).notes).not.toBe('Ala kota');
  const notes = (await stored()).notes;
  expect(notes).not.toMatch(/<b>|<a|style|span/);
});

test('copying from the notepad into a text frame gives plain text', async () => {
  const { screen, stored } = await openWithNotes('<b>Ala</b> <mark>ma</mark> kota');
  selectAllNotes();
  await userEvent.copy();
  await screen.getByRole('button', { name: '+ Napis' }).click();
  const frame = screen.getByRole('textbox', { name: 'Treść napisu' });
  await expect.element(frame).toHaveFocus();
  await userEvent.paste();
  await expect.element(frame).toHaveValue('Ala ma kota');
  await userEvent.keyboard('{Escape}');
  await expect.poll(async () => ((await stored()).spreads[0].elements[0] as TextElement).text).toBe('Ala ma kota');
});
