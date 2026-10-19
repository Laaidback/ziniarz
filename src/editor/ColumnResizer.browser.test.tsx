import { userEvent } from '@vitest/browser/context';
import { afterEach, expect, test } from 'vitest';
import '../app/app.css';
import { createZine } from '../model/factory';
import { openInEditor } from '../test/editorHarness';

afterEach(() => {
  localStorage.removeItem('ziniarz.notesWidth');
  localStorage.removeItem('ziniarz.spreadsWidth');
  localStorage.removeItem('ziniarz.settingsWidth');
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
  expect(document.body.classList.contains('resizing-column')).toBe(false);
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

// The spread list (left column, handle on its right edge) and the settings panel (handle on its left edge).

const spreads = () => document.querySelector<HTMLElement>('.editor-spreads')!;
const settings = () => document.querySelector<HTMLElement>('.editor-panel')!;
const widthOf = (el: HTMLElement) => Math.round(el.getBoundingClientRect().width);

async function openSpreads() {
  const opened = await openInEditor(createZine('Lato', 1));
  const handle = opened.screen.getByRole('separator', { name: 'Szerokość listy stron' });
  await expect.element(handle).toBeVisible();
  return { ...opened, handle };
}

async function openSettings() {
  localStorage.setItem('ziniarz.showSettings', '1');
  localStorage.setItem('ziniarz.showNotes', '0');
  const opened = await openInEditor(createZine('Lato', 1));
  const handle = opened.screen.getByRole('separator', { name: 'Szerokość ustawień' });
  await expect.element(handle).toBeVisible();
  return { ...opened, handle };
}

test('the spread list handle is a separator with its limits, on the right edge of the column', async () => {
  const { handle } = await openSpreads();
  const el = handle.element();
  expect(el.getAttribute('aria-orientation')).toBe('vertical');
  expect(el.getAttribute('aria-valuenow')).toBe('180');
  expect(el.getAttribute('aria-valuemin')).toBe('140');
  expect(el.getAttribute('aria-valuemax')).toBe('360');
  expect(el.getAttribute('tabindex')).toBe('0');
  expect(widthOf(spreads())).toBe(180);
  const bar = el.getBoundingClientRect();
  const column = spreads().getBoundingClientRect();
  expect(Math.abs(bar.left + bar.width / 2 - column.right)).toBeLessThan(3);
});

test('dragging the spread list handle right widens the list, scales its thumbnails and narrows the canvas', async () => {
  const { handle } = await openSpreads();
  await expect.poll(() => document.querySelectorAll('.spread-thumb img').length).toBe(2);
  const imageWidth = () => document.querySelector<HTMLElement>('.spread-thumb img')!.getBoundingClientRect().width;
  const imageBefore = imageWidth();
  const canvasBefore = canvasColumn().getBoundingClientRect().width;
  await dragTo(handle, spreads().getBoundingClientRect().right + 80);
  expect(widthOf(spreads())).toBeGreaterThan(240);
  expect(widthOf(spreads())).toBeLessThan(280);
  expect(imageWidth()).toBeGreaterThan(imageBefore + 60);
  const img = document.querySelector<HTMLImageElement>('.spread-thumb img')!;
  expect(img.getBoundingClientRect().width / img.getBoundingClientRect().height).toBeCloseTo(216 / 154, 1);
  expect(canvasColumn().getBoundingClientRect().width).toBeLessThan(canvasBefore - 60);
  expect(handle.element().getAttribute('aria-valuenow')).toBe(String(widthOf(spreads())));
  expect(document.body.classList.contains('resizing-column')).toBe(false);
});

test('the spread list stops at 360 px and at 140 px', async () => {
  const { handle } = await openSpreads();
  await dragTo(handle, 1000);
  expect(widthOf(spreads())).toBe(360);
  await dragTo(handle, -50);
  expect(widthOf(spreads())).toBe(140);
});

test('the spread list handle: ArrowRight widens by 20 px (Shift 60), ArrowLeft narrows, within the limits', async () => {
  const { handle } = await openSpreads();
  (handle.element() as HTMLElement).focus();
  await userEvent.keyboard('{ArrowRight}');
  expect(widthOf(spreads())).toBe(200);
  await userEvent.keyboard('{ArrowLeft}{ArrowLeft}');
  expect(widthOf(spreads())).toBe(160);
  await userEvent.keyboard('{Shift>}{ArrowRight}{/Shift}');
  expect(widthOf(spreads())).toBe(220);
  await userEvent.keyboard('{Shift>}{ArrowLeft}{ArrowLeft}{ArrowLeft}{/Shift}');
  expect(widthOf(spreads())).toBe(140);
  expect(handle.element().getAttribute('aria-valuenow')).toBe('140');
});

test('double click returns the spread list to 180 px, and the width is remembered', async () => {
  const first = await openSpreads();
  (first.handle.element() as HTMLElement).focus();
  await userEvent.keyboard('{Shift>}{ArrowRight}{/Shift}');
  expect(widthOf(spreads())).toBe(240);
  expect(localStorage.getItem('ziniarz.spreadsWidth')).toBe('240');
  first.screen.unmount();

  const second = await openSpreads();
  expect(widthOf(spreads())).toBe(240);
  await userEvent.dblClick(second.handle.element() as HTMLElement);
  expect(widthOf(spreads())).toBe(180);
  expect(localStorage.getItem('ziniarz.spreadsWidth')).toBe('180');
});

test('a stored spread list width outside the limits is clamped on load', async () => {
  localStorage.setItem('ziniarz.spreadsWidth', '5000');
  await openSpreads();
  expect(widthOf(spreads())).toBe(360);
});

test('the settings handle is a separator with its limits, on the left edge of the panel', async () => {
  const { handle } = await openSettings();
  const el = handle.element();
  expect(el.getAttribute('aria-orientation')).toBe('vertical');
  expect(el.getAttribute('aria-valuenow')).toBe('300');
  expect(el.getAttribute('aria-valuemin')).toBe('240');
  expect(el.getAttribute('aria-valuemax')).toBe('480');
  expect(el.getAttribute('tabindex')).toBe('0');
  expect(widthOf(settings())).toBe(300);
  const bar = el.getBoundingClientRect();
  const column = settings().getBoundingClientRect();
  expect(Math.abs(bar.left + bar.width / 2 - column.left)).toBeLessThan(3);
});

test('dragging the settings handle left widens the panel', async () => {
  const { handle } = await openSettings();
  const canvasBefore = canvasColumn().getBoundingClientRect().width;
  await dragTo(handle, settings().getBoundingClientRect().left - 60);
  expect(widthOf(settings())).toBeGreaterThan(340);
  expect(widthOf(settings())).toBeLessThan(380);
  expect(canvasColumn().getBoundingClientRect().width).toBeLessThan(canvasBefore - 40);
  expect(handle.element().getAttribute('aria-valuenow')).toBe(String(widthOf(settings())));
});

test('the settings panel stops at 480 px and at 240 px', async () => {
  const { handle } = await openSettings();
  await dragTo(handle, 5);
  expect(widthOf(settings())).toBe(480);
  await dragTo(handle, 1275);
  expect(widthOf(settings())).toBe(240);
});

test('the settings handle: ArrowLeft widens by 20 px (Shift 60), ArrowRight narrows', async () => {
  const { handle } = await openSettings();
  (handle.element() as HTMLElement).focus();
  await userEvent.keyboard('{ArrowLeft}');
  expect(widthOf(settings())).toBe(320);
  await userEvent.keyboard('{ArrowRight}{ArrowRight}');
  expect(widthOf(settings())).toBe(280);
  await userEvent.keyboard('{Shift>}{ArrowLeft}{/Shift}');
  expect(widthOf(settings())).toBe(340);
  await userEvent.keyboard('{Shift>}{ArrowRight}{ArrowRight}{ArrowRight}{/Shift}');
  expect(widthOf(settings())).toBe(240);
});

test('double click returns the settings panel to 300 px, and the width is remembered', async () => {
  const first = await openSettings();
  (first.handle.element() as HTMLElement).focus();
  await userEvent.keyboard('{Shift>}{ArrowLeft}{/Shift}');
  expect(widthOf(settings())).toBe(360);
  expect(localStorage.getItem('ziniarz.settingsWidth')).toBe('360');
  first.screen.unmount();

  const second = await openSettings();
  expect(widthOf(settings())).toBe(360);
  await userEvent.dblClick(second.handle.element() as HTMLElement);
  expect(widthOf(settings())).toBe(300);
});

test('a stored settings width outside the limits is clamped on load', async () => {
  localStorage.setItem('ziniarz.settingsWidth', '10');
  await openSettings();
  expect(widthOf(settings())).toBe(240);
});

test('wide columns cannot squeeze the canvas below 360 px', async () => {
  localStorage.setItem('ziniarz.settingsWidth', '480');
  localStorage.setItem('ziniarz.notesWidth', '720');
  localStorage.setItem('ziniarz.spreadsWidth', '360');
  localStorage.setItem('ziniarz.showSettings', '1');
  await openInEditor(createZine('Lato', 1));
  await expect.poll(() => document.querySelector('.editor-notes')).not.toBeNull();
  expect(canvasColumn().getBoundingClientRect().width).toBeGreaterThanOrEqual(360);
});

test('dragging one column stops where the canvas would drop below 360 px', async () => {
  localStorage.setItem('ziniarz.showSettings', '1');
  const { screen } = await openInEditor(createZine('Lato', 1));
  const handle = screen.getByRole('separator', { name: 'Szerokość ustawień' });
  await expect.element(handle).toBeVisible();
  await dragTo(handle, 5);
  // 1280 window - 360 canvas - 180 spread list - 280 notepad.
  expect(widthOf(settings())).toBe(460);
  expect(canvasColumn().getBoundingClientRect().width).toBeGreaterThanOrEqual(360);
});
