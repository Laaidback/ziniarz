import { expect, test } from 'vitest';
import { createTextElement } from '../../model/factory';
import { canMoveLayer, moveLayer } from './layers';

const [a, b, c] = ['a', 'b', 'c'].map((id) => createTextElement({ id }));
const ids = (elements: { id: string }[]) => elements.map((e) => e.id).join('');

test('moves an element to the front, forward, backward and to the back', () => {
  const elements = [a, b, c];
  expect(ids(moveLayer(elements, 'a', 'front'))).toBe('bca');
  expect(ids(moveLayer(elements, 'a', 'forward'))).toBe('bac');
  expect(ids(moveLayer(elements, 'c', 'backward'))).toBe('acb');
  expect(ids(moveLayer(elements, 'c', 'back'))).toBe('cab');
});

test('a move that changes nothing returns the same array', () => {
  const elements = [a, b, c];
  expect(moveLayer(elements, 'c', 'front')).toBe(elements);
  expect(moveLayer(elements, 'x', 'back')).toBe(elements);
  expect(canMoveLayer(elements, 'c', 'forward')).toBe(false);
  expect(canMoveLayer(elements, 'c', 'back')).toBe(true);
});
