import { describe, expect, test } from 'vitest';
import { createPhotoElement, createTextElement, createZine } from '../model/factory';
import { applyKeyCommand, fieldOwnsKey, isTypingTarget, keyCommand, type KeyLike } from './keyboard';
import { createEditorStore, selectedElement, selectZine } from './state/store';

const key = (k: string, mods: Partial<KeyLike> = {}): KeyLike => ({
  key: k,
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  ...mods,
});

describe('keyCommand', () => {
  test('Cmd and Ctrl shortcuts', () => {
    expect(keyCommand(key('z', { metaKey: true }))).toEqual({ type: 'undo' });
    expect(keyCommand(key('Z', { metaKey: true, shiftKey: true }))).toEqual({ type: 'redo' });
    expect(keyCommand(key('y', { ctrlKey: true }))).toEqual({ type: 'redo' });
    expect(keyCommand(key('c', { ctrlKey: true }))).toEqual({ type: 'copy' });
    expect(keyCommand(key('v', { metaKey: true }))).toEqual({ type: 'paste' });
    expect(keyCommand(key('d', { metaKey: true }))).toEqual({ type: 'duplicate' });
    expect(keyCommand(key('s', { metaKey: true }))).toBeNull();
  });

  test('arrows nudge by 1 mm, with Shift by 10 mm', () => {
    expect(keyCommand(key('ArrowLeft'))).toEqual({ type: 'nudge', dx: -1, dy: 0 });
    expect(keyCommand(key('ArrowDown', { shiftKey: true }))).toEqual({ type: 'nudge', dx: 0, dy: 10 });
  });

  test('other keys', () => {
    expect(keyCommand(key('Backspace'))).toEqual({ type: 'delete' });
    expect(keyCommand(key('Delete'))).toEqual({ type: 'delete' });
    expect(keyCommand(key('Escape'))).toEqual({ type: 'escape' });
    expect(keyCommand(key('PageUp'))).toEqual({ type: 'prevSpread' });
    expect(keyCommand(key('PageDown'))).toEqual({ type: 'nextSpread' });
    expect(keyCommand(key('a'))).toBeNull();
  });
});

const target = (tagName: string, extra: object = {}) => ({ tagName, ...extra }) as unknown as EventTarget;

test('isTypingTarget: text fields, selects and editable text only', () => {
  expect(isTypingTarget(target('INPUT'))).toBe(true);
  for (const type of ['text', 'search', 'number', 'email', 'url', 'tel', 'password']) {
    expect(isTypingTarget(target('INPUT', { type }))).toBe(true);
  }
  expect(isTypingTarget(target('TEXTAREA'))).toBe(true);
  expect(isTypingTarget(target('SELECT'))).toBe(true);
  expect(isTypingTarget(target('DIV', { isContentEditable: true }))).toBe(true);
  for (const type of ['checkbox', 'range', 'color', 'file', 'button']) {
    expect(isTypingTarget(target('INPUT', { type }))).toBe(false);
  }
  expect(isTypingTarget(target('BUTTON'))).toBe(false);
  expect(isTypingTarget(null)).toBe(false);
});

test('fieldOwnsKey: a slider keeps its arrows, other editor keys still work there', () => {
  const slider = target('INPUT', { type: 'range' });
  expect(fieldOwnsKey(slider, 'ArrowLeft')).toBe(true);
  expect(fieldOwnsKey(slider, 'ArrowUp')).toBe(true);
  for (const key of ['z', 'Delete', 'PageUp', 'PageDown', 'Enter']) expect(fieldOwnsKey(slider, key)).toBe(false);
  const checkbox = target('INPUT', { type: 'checkbox' });
  expect(fieldOwnsKey(checkbox, 'ArrowLeft')).toBe(false);
  expect(fieldOwnsKey(checkbox, 'Delete')).toBe(false);
  expect(fieldOwnsKey(target('INPUT', { type: 'text' }), 'Delete')).toBe(true);
});

describe('applyKeyCommand', () => {
  const deps = { measureText: () => 5, imageSize: () => ({ width: 10, height: 10 }) };

  test('nudge, delete and undo go to the store; nothing selected = not handled', () => {
    const store = createEditorStore(createZine('t', 1), deps);
    expect(applyKeyCommand(store, { type: 'nudge', dx: 1, dy: 0 })).toBe(false);
    store.getState().addElement(createTextElement({ x: 10 }));
    expect(applyKeyCommand(store, { type: 'nudge', dx: 10, dy: 0 })).toBe(true);
    expect(selectedElement(store.getState())?.x).toBe(20);
    expect(applyKeyCommand(store, { type: 'delete' })).toBe(true);
    expect(selectZine(store.getState()).spreads[0].elements).toEqual([]);
    applyKeyCommand(store, { type: 'undo' });
    expect(selectZine(store.getState()).spreads[0].elements).toHaveLength(1);
  });

  test('Escape leaves crop mode first, then deselects; Enter ends cropping', () => {
    const store = createEditorStore(createZine('t', 1), deps);
    store.getState().addElement(createPhotoElement('img'));
    store.getState().setMode('crop');
    expect(applyKeyCommand(store, { type: 'enter' })).toBe(true);
    expect(store.getState().mode).toBe('idle');
    expect(applyKeyCommand(store, { type: 'enter' })).toBe(false);
    store.getState().setMode('crop');
    applyKeyCommand(store, { type: 'escape' });
    expect(store.getState()).toMatchObject({ mode: 'idle' });
    expect(store.getState().selectedId).not.toBeNull();
    applyKeyCommand(store, { type: 'escape' });
    expect(store.getState().selectedId).toBeNull();
  });

  test('PageUp and PageDown change the spread', () => {
    const store = createEditorStore(createZine('t', 1), deps);
    applyKeyCommand(store, { type: 'nextSpread' });
    applyKeyCommand(store, { type: 'nextSpread' });
    applyKeyCommand(store, { type: 'nextSpread' });
    expect(store.getState().spread).toBe(2);
    applyKeyCommand(store, { type: 'prevSpread' });
    expect(store.getState().spread).toBe(1);
  });
});
