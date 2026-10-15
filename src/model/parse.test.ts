import { describe, expect, test } from 'vitest';
import {
  createPhotoElement,
  createTextElement,
  createZine,
  DEFAULT_MARGINS,
  DEFAULT_PRINT,
  FORMAT_VERSION,
} from './factory';
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
    expect(zine.formatVersion).toBe(FORMAT_VERSION);
  });

  test('the old printer margin is not kept', () => {
    const raw = roundTrip(createZine('Lato', 1));
    raw.print = { ...raw.print, printerMargin: 7 };
    expect(parseZine(raw).print).toEqual(DEFAULT_PRINT);
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
    expect(zine.spreads[1].elements[0]).toMatchObject({ kind: 'text', text: 'A', size: 9, lineHeight: 1.2 });
  });

  test('opens an A5 zine (format 1) converted to A6', () => {
    const raw = roundTrip(createZine('Stary', 1));
    raw.formatVersion = 1;
    raw.margins = { outer: 30, inner: 30, top: 30, bottom: 30 };
    raw.spreads[1].elements = [
      { kind: 'text', id: 't', x: 148, y: 210, width: 148, height: 0, rotation: 0, text: 'A', size: 12 },
    ];
    const zine = parseZine(raw);
    expect(zine.formatVersion).toBe(FORMAT_VERSION);
    expect(zine.margins.outer).toBeCloseTo(30 * (105 / 148), 9);
    expect(zine.margins.top).toBeCloseTo(30 * (148 / 210), 9);
    const text = zine.spreads[1].elements[0];
    expect(text.x).toBeCloseTo(105, 9);
    expect(text.y).toBeCloseTo(148, 9);
    expect(parseZine(roundTrip(zine))).toEqual(zine);
  });

  test('a zine without a version is an A5 zine', () => {
    const raw = roundTrip(createZine('Stary', 1));
    delete raw.formatVersion;
    raw.spreads[1].elements = [{ kind: 'text', id: 't', x: 296, y: 0, width: 0, height: 0, rotation: 0, text: 'A' }];
    expect(parseZine(raw).spreads[1].elements[0].x).toBeCloseTo(210, 9);
  });

  test('an A6 zine (format 2) is not converted again', () => {
    const zine = createZine('Nowy', 1);
    zine.spreads[1].elements.push(createTextElement({ x: 50, y: 60, width: 40 }));
    expect(parseZine(roundTrip(zine)).spreads[1].elements[0]).toMatchObject({ x: 50, y: 60, width: 40 });
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

  test('drops page styles for pages that do not exist', () => {
    const raw = roundTrip(createZine('Lato', 1)); // 4 pages
    raw.pages = {
      '': { background: '#111111' },
      '-1': { background: '#222222' },
      '0': { background: '#333333' },
      '2': { background: '#444444' },
      '4': { background: '#555555' },
      '5': { background: '#666666' },
    };
    expect(parseZine(raw).pages).toEqual({ 2: { background: '#444444' }, 4: { background: '#555555' } });
  });

  test('clamps photo opacity to 0..1', () => {
    const raw = roundTrip(createZine('Lato', 1));
    raw.spreads[0].elements.push(
      { ...createPhotoElement('a'), opacity: 5 },
      { ...createPhotoElement('b'), opacity: -2 },
      { ...createPhotoElement('c'), opacity: 0.4 },
    );
    const photos = parseZine(raw).spreads[0].elements;
    expect(photos.map((e) => (e.kind === 'photo' ? e.opacity : null))).toEqual([1, 0, 0.4]);
  });
});

test('imageIdsOfZine lists photos of all spreads', () => {
  const zine = createZine('Lato', 1);
  zine.spreads[0].elements.push(createPhotoElement('a'));
  zine.spreads[2].elements.push(createPhotoElement('b'), createTextElement());
  expect([...imageIdsOfZine(zine)].sort()).toEqual(['a', 'b']);
});
