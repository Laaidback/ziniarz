import { userEvent } from '@vitest/browser/context';
import { afterEach, expect, test } from 'vitest';
import '../app/app.css';
import { createZine } from '../model/factory';
import { openInEditor } from '../test/editorHarness';

afterEach(() => {
  localStorage.removeItem('ziniarz.notesWidth');
  localStorage.removeItem('ziniarz.showNotes');
  localStorage.removeItem('ziniarz.showSettings');
});

const notes = () => document.querySelector<HTMLElement>('.editor-notes')!;
const canvasColumn = () => document.querySelector<HTMLElement>('.editor-canvas')!;
const notesWidth = () => Math.round(notes().getBoundingClientRect().width);

async function openEditor() {
  const opened = await openInEditor(createZine('Lato', 1));
  const handle = opened.screen.getByRole('separator', { name: 'Szerokość notatnika' });
  await expect.element(handle).toBeVisible();
  return { ...opened, handle };
}

/** Drags the handle with the mouse so that its centre ends at `x`. */
async function dragTo(handle: { element(): Element }, x: number) {
  const bar = handle.element().getBoundingClientRect();
  const y = bar.top + bar.height / 2;
  await userEvent.dragAndDrop(handle.element() as HTMLElement, document.body, {
    sourcePosition: { x: bar.width / 2, y: bar.height / 2 },
    targetPosition: { x, y },
  });
}

test('the handle describes itself as a vertical separator with its limits', async () => {
  const { handle } = await openEditor();
  const el = handle.element();
  expect(el.getAttribute('aria-orientation')).toBe('vertical');
  expect(el.getAttribute('aria-valuenow')).toBe('280');
  expect(el.getAttribute('aria-valuemin')).toBe('220');
  expect(el.getAttribute('aria-valuemax')).toBe('704');
  expect(el.getAttribute('tabindex')).toBe('0');
  expect(notesWidth()).toBe(280);
});

test('dragging the handle left widens the notepad and the canvas column gives up the room', async () => {
  const { handle } = await openEditor();
  const canvasBefore = canvasColumn().getBoundingClientRect().width;
  const edge = notes().getBoundingClientRect().left;
  await dragTo(handle, edge - 100);
  expect(notesWidth()).toBeGreaterThan(340);
  expect(notesWidth()).toBeLessThan(420);
  expect(canvasColumn().getBoundingClientRect().width).toBeLessThan(canvasBefore - 60);
  expect(handle.element().getAttribute('aria-valuenow')).toBe(String(notesWidth()));
  expect(document.body.classList.contains('resizing-notes')).toBe(false);
});

test('dragging far left stops at the maximum, far right at the minimum', async () => {
  const { handle } = await openEditor();
  await dragTo(handle, 5);
  expect(notesWidth()).toBe(704);
  await dragTo(handle, 1275);
  expect(notesWidth()).toBe(220);
});

test('arrow keys change the width by 20 px, with Shift by 60 px, within the limits', async () => {
  const { handle } = await openEditor();
  (handle.element() as HTMLElement).focus();
  await userEvent.keyboard('{ArrowLeft}');
  expect(notesWidth()).toBe(300);
  await userEvent.keyboard('{ArrowRight}{ArrowRight}');
  expect(notesWidth()).toBe(260);
  await userEvent.keyboard('{Shift>}{ArrowLeft}{/Shift}');
  expect(notesWidth()).toBe(320);
  await userEvent.keyboard('{Shift>}{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}{/Shift}');
  expect(notesWidth()).toBe(220);
  expect(handle.element().getAttribute('aria-valuenow')).toBe('220');
});

test('double click returns to the default width', async () => {
  const { handle } = await openEditor();
  (handle.element() as HTMLElement).focus();
  await userEvent.keyboard('{Shift>}{ArrowLeft}{ArrowLeft}{/Shift}');
  expect(notesWidth()).toBe(400);
  await userEvent.dblClick(handle.element() as HTMLElement);
  expect(notesWidth()).toBe(280);
});

test('the width is remembered when the editor is opened again', async () => {
  const first = await openEditor();
  (first.handle.element() as HTMLElement).focus();
  await userEvent.keyboard('{Shift>}{ArrowLeft}{/Shift}');
  expect(notesWidth()).toBe(340);
  expect(localStorage.getItem('ziniarz.notesWidth')).toBe('340');
  first.screen.unmount();

  await openEditor();
  expect(notesWidth()).toBe(340);
});

test('a stored width outside the limits is clamped on load', async () => {
  localStorage.setItem('ziniarz.notesWidth', '5000');
  await openEditor();
  expect(notesWidth()).toBe(704);
});

test('the handle works with the settings panel shown', async () => {
  localStorage.setItem('ziniarz.showSettings', '1');
  const { handle } = await openEditor();
  (handle.element() as HTMLElement).focus();
  await userEvent.keyboard('{ArrowLeft}');
  expect(notesWidth()).toBe(300);
});
