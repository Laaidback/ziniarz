import { expect, test } from 'vitest';
import { createTextElement, createZine } from '../model/factory';
import { normalizeHex, swatches, usedColors } from './colors';

test('normalizeHex accepts short and long forms, with or without #', () => {
  expect(normalizeHex('#ABC')).toBe('#aabbcc');
  expect(normalizeHex('ff0000')).toBe('#ff0000');
  expect(normalizeHex(' #12ab9F ')).toBe('#12ab9f');
  expect(normalizeHex('red')).toBeNull();
  expect(normalizeHex('#12345')).toBeNull();
});

test('usedColors lists page backgrounds by page number, then text colours, once each', () => {
  const zine = createZine('t', 1);
  zine.pages[3] = { background: '#00FF00' };
  zine.pages[1] = { background: '#ff0000' };
  zine.spreads[1].elements.push(createTextElement({ color: '#ff0000' }), createTextElement({ color: '#123456' }));
  expect(usedColors(zine)).toEqual(['#ff0000', '#00ff00', '#123456']);
  expect(usedColors(zine, 2)).toHaveLength(2);
  expect(swatches(zine)).toEqual(['#000000', '#ffffff', '#ff0000', '#00ff00', '#123456']);
});
