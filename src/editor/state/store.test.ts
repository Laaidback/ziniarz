import { describe, expect, test } from 'vitest';
import { createPhotoElement, createTextElement, createZine } from '../../model/factory';
import type { PhotoElement, TextElement } from '../../model/types';
import { setTitle } from './commands';
import { createEditorStore, type EditorState, MAX_CROP_ZOOM, selectCanRedo, selectCanUndo, selectedElement, selectZine } from './store';

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
    expect(s()).toMatchObject({ spread: 3, selectedId: null, activePage: null });
  });

  test('removing a sheet keeps the current spread index valid; undo brings it back', () => {
    const { s, zine } = setup(2);
    s().setSpread(3);
    s().removeSheet();
    expect(zine().sheets).toBe(1);
    expect(s().spread).toBe(1);
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

  test('selecting by a click on the canvas remembers the page clicked; selecting otherwise forgets it', () => {
    const { s } = setup();
    const a = createPhotoElement('img');
    s().addElement(a);
    s().select(null);
    s().setMode('crop');
    s().select(a.id, 3);
    expect(s()).toMatchObject({ selectedId: a.id, activePage: 3, mode: 'idle' });
    s().setMode('crop');
    s().select(a.id, 2); // the same element clicked on its other page: only the page changes
    expect(s()).toMatchObject({ selectedId: a.id, activePage: 2, mode: 'crop' });
    s().select(a.id); // e.g. a double click opening it: the page stays
    expect(s().activePage).toBe(2);
    s().select(null);
    expect(s()).toMatchObject({ selectedId: null, activePage: null });
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

describe('undo steps end with the interaction', () => {
  type Between = (s: () => EditorState, id: string) => void;
  const typeTwice = (between: Between) => {
    const { s, zine } = setup();
    const text = createTextElement({ text: '' });
    s().addElement(text);
    s().updateElement(text.id, { text: 'A' }, `text:${text.id}`);
    between(s, text.id);
    s().updateElement(text.id, { text: 'AB' }, `text:${text.id}`);
    s().undo();
    return (zine().spreads[0].elements[0] as TextElement).text;
  };

  test('without a break, the same key merges', () => {
    expect(typeTwice(() => {})).toBe('');
  });

  test.each([
    ['select', (s, id) => (s().select(null), s().select(id))],
    ['clickPage', (s, id) => (s().clickPage(1), s().select(id))],
    ['setSpread', (s, id) => (s().setSpread(0), s().select(id))],
    ['setMode', (s) => (s().setMode('text'), s().setMode('idle'))],
    ['endMerge', (s) => s().endMerge()],
  ] satisfies [string, Between][])('%s ends the merge', (_name, between) => {
    expect(typeTwice(between)).toBe('A');
  });

  test('an edit that changes nothing records no step', () => {
    const { s } = setup();
    const history = s().history;
    s().edit((z) => setTitle(z, 'Zin'), 'title');
    expect(s().history).toBe(history);
  });
});

describe('undo and redo', () => {
  test('show the spread the change was on', () => {
    const { s, zine } = setup();
    s().setSpread(1);
    s().addElement(createTextElement({ text: 'a' }));
    s().setSpread(3);
    s().undo();
    expect(s().spread).toBe(1);
    expect(zine().spreads[1].elements).toEqual([]);
    s().setSpread(3);
    s().redo();
    expect(s().spread).toBe(1);
  });

  test('stay on the current spread when the change is there or on no spread', () => {
    const { s } = setup();
    s().setSpread(2);
    s().addElement(createTextElement({ text: 'a' }));
    s().edit((z) => setTitle(z, 'Nowy'));
    s().undo();
    expect(s().spread).toBe(2);
    s().undo();
    expect(s().spread).toBe(2);
  });

  test('re-measure text heights', () => {
    let lines = 1;
    const store = createEditorStore(createZine('t', 1), { ...deps, measureText: () => lines * 5 });
    const text = createTextElement({ text: 'a' });
    store.getState().addElement(text);
    store.getState().updateElement(text.id, { text: 'b' });
    lines = 3;
    store.getState().undo();
    expect(selectZine(store.getState()).spreads[0].elements[0]).toMatchObject({ text: 'a', height: 15 });
    expect(selectCanRedo(store.getState())).toBe(true);
    store.getState().redo();
    expect(selectZine(store.getState()).spreads[0].elements[0]).toMatchObject({ text: 'b', height: 15 });
  });
});

test('a clicked back cover stays the back cover when a sheet is added or removed', () => {
  const { s, zine } = setup(2);
  s().clickPage(8);
  s().addSheet();
  expect(zine().sheets).toBe(3);
  expect(s()).toMatchObject({ spread: 0, activePage: 12 });
  s().removeSheet();
  s().removeSheet();
  expect(zine().sheets).toBe(1);
  expect(s()).toMatchObject({ spread: 0, activePage: 4 });
});

test('a clicked front cover stays page 1', () => {
  const { s } = setup(2);
  s().clickPage(1);
  s().addSheet();
  expect(s()).toMatchObject({ spread: 0, activePage: 1 });
});

test('undo and redo of removing a sheet renumber a clicked back cover', () => {
  const { s, zine } = setup(3);
  s().clickPage(12);
  s().removeSheet();
  expect(s()).toMatchObject({ spread: 0, activePage: 8 });
  s().undo();
  expect(zine().sheets).toBe(3);
  expect(s()).toMatchObject({ spread: 0, activePage: 12 });
  s().redo();
  expect(zine().sheets).toBe(2);
  expect(s()).toMatchObject({ spread: 0, activePage: 8 });
});

test('undo of adding a sheet renumbers a clicked back cover', () => {
  const { s, zine } = setup(2);
  s().clickPage(8);
  s().addSheet();
  expect(s().activePage).toBe(12);
  s().undo();
  expect(zine().sheets).toBe(2);
  expect(s()).toMatchObject({ spread: 0, activePage: 8 });
});

test('a clicked front cover stays page 1 through adding a sheet and undo', () => {
  const { s } = setup(2);
  s().clickPage(1);
  s().addSheet();
  s().undo();
  expect(s()).toMatchObject({ spread: 0, activePage: 1 });
});

test('a clicked inside page moves with its spread', () => {
  const { s } = setup(3);
  s().setSpread(5);
  s().clickPage(11);
  s().removeSheet();
  expect(s()).toMatchObject({ spread: 3, activePage: 7 });
});

test('adding a sheet on an inside spread stays on it', () => {
  const { s, zine } = setup(2);
  s().setSpread(1);
  const current = zine().spreads[1];
  s().addSheet();
  expect(zine().spreads[s().spread]).toBe(current);
});

test('removing a sheet before the current spread follows it to its new index', () => {
  const { s, zine } = setup(3);
  s().setSpread(5);
  const current = zine().spreads[5];
  s().removeSheet();
  expect(zine().sheets).toBe(2);
  expect(zine().spreads[s().spread]).toBe(current);
});

describe('notes', () => {
  test('setNotes changes the zine without an undo step; the same text changes nothing', () => {
    const { s, zine } = setup();
    const before = zine();
    s().setNotes('Ala ma kota');
    expect(zine().notes).toBe('Ala ma kota');
    expect(zine()).not.toBe(before);
    expect(selectCanUndo(s())).toBe(false);
    const after = zine();
    s().setNotes('Ala ma kota');
    expect(zine()).toBe(after);
  });

  test('setNotes keeps only the safe HTML subset', () => {
    const { s, zine } = setup();
    s().setNotes('<b onclick="x()">Ala</b><script>alert(1)</script> <mark>kot</mark>');
    expect(zine().notes).toBe('<b>Ala</b> <mark>kot</mark>');
  });

  test('undo and redo of the design never change the notes', () => {
    const { s, zine } = setup();
    s().setNotes('pierwsze');
    s().addElement(createTextElement({ text: 'a' }));
    s().setNotes('drugie');
    s().addElement(createTextElement({ text: 'b' }));
    s().setNotes('trzecie');
    s().undo();
    expect(zine().spreads[0].elements).toHaveLength(1);
    expect(zine().notes).toBe('trzecie');
    s().undo();
    expect(zine().spreads[0].elements).toHaveLength(0);
    expect(zine().notes).toBe('trzecie');
    s().setNotes('czwarte');
    s().redo();
    s().redo();
    expect(zine().spreads[0].elements).toHaveLength(2);
    expect(zine().notes).toBe('czwarte');
  });

  test('design changes keep the latest notes, also merged ones and sheet changes', () => {
    const { s, zine } = setup();
    const text = createTextElement({ text: '' });
    s().addElement(text);
    s().updateElement(text.id, { text: 'A' }, `text:${text.id}`);
    s().setNotes('notatka');
    s().updateElement(text.id, { text: 'Al' }, `text:${text.id}`);
    expect(zine().notes).toBe('notatka');
    s().addSheet();
    expect(zine().notes).toBe('notatka');
    s().setNotes('nowa');
    s().undo();
    s().undo();
    expect(zine().notes).toBe('nowa');
    expect((zine().spreads[0].elements[0] as TextElement).text).toBe('');
  });
});
