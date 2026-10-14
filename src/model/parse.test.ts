import { describe, expect, test } from 'vitest';
import { createPhotoElement, createTextElement, createZine, DEFAULT_MARGINS, DEFAULT_PRINT } from './factory';
import { parseZine, ZineFormatError } from './parse';
import { imageIdsOfZine } from './queries';

const roundTrip = (value: unknown) => JSON.parse(JSON.stringify(value));

describe('parseZine', () => {
  test('reads back a saved zine unchanged', () => {
    const zine = createZine('Lato', 5);
    zine.pages[3] = { background: '#ff0000' };
    zine.spreads[1].elements.push(createTextElement({ text: 'Hej' }), createPhotoElement('img-1'));
    expect(parseZine(roundTrip(zine))).toEqual(zine);
  });

  test('fills missing optional fields with defaults', () => {
    const raw = roundTrip(createZine('Lato', 2));
    delete raw.margins;
    delete raw.print;
    delete raw.fonts;
    delete raw.pages;
    delete raw.formatVersion;
    const zine = parseZine(raw);
    expect(zine.margins).toEqual(DEFAULT_MARGINS);
    expect(zine.print).toEqual(DEFAULT_PRINT);
    expect(zine.fonts).toEqual([]);
    expect(zine.pages).toEqual({});
    expect(zine.formatVersion).toBe(1);
  });

  test('fills missing element fields and drops unknown elements', () => {
    const raw = roundTrip(createZine('Lato', 1));
    raw.spreads[1].elements = [
      { kind: 'text', id: 't', x: 1, y: 2, width: 50, height: 0, rotation: 0, text: 'A' },
      { kind: 'sticker', id: 's' },
      { kind: 'photo', id: 'p' },
    ];
    const zine = parseZine(raw);
    expect(zine.spreads[1].elements).toHaveLength(1);
    expect(zine.spreads[1].elements[0]).toMatchObject({ kind: 'text', text: 'A', size: 12, lineHeight: 1.2 });
  });

  test('rejects files from a newer version', () => {
    const raw = roundTrip(createZine('Lato', 1));
    raw.formatVersion = 99;
    expect(() => parseZine(raw)).toThrow(ZineFormatError);
    try {
      parseZine(raw);
    } catch (e) {
      expect((e as ZineFormatError).reason).toBe('newer');
    }
  });

  test('rejects broken data', () => {
    expect(() => parseZine('nope')).toThrow(ZineFormatError);
    const raw = roundTrip(createZine('Lato', 2));
    raw.spreads.pop();
    expect(() => parseZine(raw)).toThrow(ZineFormatError);
  });
});

test('imageIdsOfZine lists photos of all spreads', () => {
  const zine = createZine('Lato', 1);
  zine.spreads[0].elements.push(createPhotoElement('a'));
  zine.spreads[2].elements.push(createPhotoElement('b'), createTextElement());
  expect([...imageIdsOfZine(zine)].sort()).toEqual(['a', 'b']);
});
