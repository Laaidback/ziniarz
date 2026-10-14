import { describe, expect, test } from 'vitest';
import { createPhotoElement, createTextElement, createZine } from '../../model/factory';
import type { PhotoElement, TextElement } from '../../model/types';
import { createEditorStore, MAX_CROP_ZOOM, selectCanRedo, selectCanUndo, selectedElement, selectZine } from './store';

const deps = {
  measureText: (e: TextElement) => e.text.split('\n').length * 5,
  imageSize: () => ({ width: 200, height: 100 }),
};

function setup(sheets = 2) {
  const store = createEditorStore(createZine('Zin', sheets), deps);
  return { store, s: () => store.getState(), zine: () => selectZine(store.getState()) };
}

describe('elements', () => {
  test('addElement measures text, selects it, and undo/redo work', () => {
    const { s, zine } = setup();
    s().setSpread(1);
    const text = createTextElement({ text: 'a\nb' });
    s().addElement(text);
    expect(zine().spreads[1].elements[0]).toMatchObject({ id: text.id, height: 10 });
    expect(s().selectedId).toBe(text.id);
    expect(selectCanUndo(s())).toBe(true);
    s().undo();
    expect(zine().spreads[1].elements).toEqual([]);
    expect(s().selectedId).toBeNull();
    s().redo();
    expect(zine().spreads[1].elements).toHaveLength(1);
    expect(selectCanRedo(s())).toBe(false);
  });

  test('changes with the same key are one undo step', () => {
    const { s, zine } = setup();
    const text = createTextElement({ text: '' });
    s().addElement(text);
    for (const value of ['A', 'Al', 'Ala']) s().updateElement(text.id, { text: value }, `text:${text.id}`);
    expect((zine().spreads[0].elements[0] as TextElement).text).toBe('Ala');
    s().undo();
    expect((zine().spreads[0].elements[0] as TextElement).text).toBe('');
  });

  test('photo crops stay valid: zoom at most 5, the frame stays covered', () => {
    const { s, zine } = setup();
    const photo = createPhotoElement('img', { width: 100, height: 100 });
    s().addElement(photo);
    s().updateElement(photo.id, { crop: { offsetX: 999, offsetY: 0, zoom: 9 } });
    const crop = (zine().spreads[0].elements[0] as PhotoElement).crop;
    expect(crop.zoom).toBe(MAX_CROP_ZOOM);
    expect(crop.offsetX).toBe(450); // (200 * 5 - 100) / 2
  });

  test('delete, nudge, layers', () => {
    const { s, zine } = setup();
    const a = createTextElement({ text: 'a', x: 10 });
    const b = createTextElement({ text: 'b' });
    s().addElement(a);
    s().addElement(b);
    s().moveSelectedLayer('back');
    expect(zine().spreads[0].elements.map((e) => e.id)).toEqual([b.id, a.id]);
    s().select(a.id);
    s().nudgeSelected(1, -10);
    expect(selectedElement(s())).toMatchObject({ x: 11, y: -10 });
    s().deleteSelected();
    expect(zine().spreads[0].elements.map((e) => e.id)).toEqual([b.id]);
    expect(s().selectedId).toBeNull();
  });
});

describe('clipboard', () => {
  test('copy on one spread, paste on another, paste again steps aside', () => {
    const { s, zine } = setup();
    s().setSpread(1);
    const text = createTextElement({ text: 'x', x: 20, y: 30 });
    s().addElement(text);
    s().copySelected();
    s().setSpread(2);
    s().paste();
    s().paste();
    const pasted = zine().spreads[2].elements;
    expect(pasted.map((e) => [e.x, e.y])).toEqual([
      [20, 30],
      [25, 35],
    ]);
    expect(pasted[0].id).not.toBe(text.id);
    expect(s().selectedId).toBe(pasted[1].id);
  });

  test('duplicate selects the copy, 5 mm aside', () => {
    const { s, zine } = setup();
    s().addElement(createTextElement({ text: 'x', x: 20, y: 30 }));
    s().duplicateSelected();
    expect(zine().spreads[0].elements).toHaveLength(2);
    expect(selectedElement(s())).toMatchObject({ x: 25, y: 35 });
  });
});

describe('spreads and sheets', () => {
  test('setSpread clamps and clears the selection and the active page', () => {
    const { s } = setup(2);
    s().addElement(createTextElement());
    s().clickPage(1);
    s().setSpread(99);
    expect(s()).toMatchObject({ spread: 4, selectedId: null, activePage: null });
  });

  test('removing a sheet keeps the current spread index valid; undo brings it back', () => {
    const { s, zine } = setup(2);
    s().setSpread(4);
    s().removeSheet();
    expect(zine().sheets).toBe(1);
    expect(s().spread).toBe(2);
    s().undo();
    expect(zine().sheets).toBe(2);
    s().addSheet();
    expect(zine().sheets).toBe(3);
  });
});

describe('modes and selection', () => {
  test('selecting the already selected element keeps crop mode; another element ends it', () => {
    const { s } = setup();
    const a = createPhotoElement('img');
    const b = createPhotoElement('img');
    s().addElement(b);
    s().addElement(a);
    s().setMode('crop');
    s().select(a.id);
    expect(s().mode).toBe('crop');
    s().select(b.id);
    expect(s().mode).toBe('idle');
  });

  test('clicking a page deselects and remembers the page', () => {
    const { s } = setup();
    s().addElement(createTextElement());
    s().clickPage(1);
    expect(s()).toMatchObject({ selectedId: null, activePage: 1 });
  });
});

test('refreshTextHeights updates heights without an undo step', () => {
  let lines = 1;
  const store = createEditorStore(createZine('t', 1), { ...deps, measureText: () => lines * 5 });
  store.getState().addElement(createTextElement({ text: 'a' }));
  const pastLength = store.getState().history.past.length;
  lines = 3;
  store.getState().refreshTextHeights();
  expect(selectZine(store.getState()).spreads[0].elements[0].height).toBe(15);
  expect(store.getState().history.past.length).toBe(pastLength);
});
