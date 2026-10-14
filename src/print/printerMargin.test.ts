import { expect, test } from 'vitest';
import { printLayout } from '../imposition/layout';
import { DEFAULT_PRINT } from '../model/factory';
import {
  clampPrinterMargin,
  loadPrinterMargin,
  MAX_PRINTER_MARGIN,
  PRINTER_MARGIN_KEY,
  printSettingsFor,
  savePrinterMargin,
  type KeyValueStore,
} from './printerMargin';

function memoryStore(initial: Record<string, string> = {}): KeyValueStore & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => {
      data[key] = value;
    },
  };
}

const throwing: KeyValueStore = {
  getItem: () => {
    throw new Error('SecurityError');
  },
  setItem: () => {
    throw new Error('QuotaExceededError');
  },
};

test('the margin is kept between 0 and 20 mm, rounded to 0.5 mm; nonsense becomes the default', () => {
  expect(clampPrinterMargin(4)).toBe(4);
  expect(clampPrinterMargin(-3)).toBe(0);
  expect(clampPrinterMargin(35)).toBe(MAX_PRINTER_MARGIN);
  expect(clampPrinterMargin(3.26)).toBe(3.5);
  expect(clampPrinterMargin(Number.NaN)).toBe(DEFAULT_PRINT.printerMargin);
});

test('even the largest margin with marks and bleed leaves a positive scale', () => {
  const layout = printLayout({ printerMargin: MAX_PRINTER_MARGIN, bleed: true, cropMarks: true, foldMarks: true });
  expect(layout.scale).toBeGreaterThan(0.5);
});

test('the remembered margin is saved and read back, clamped', () => {
  const store = memoryStore();
  expect(loadPrinterMargin(store)).toBeNull();
  savePrinterMargin(6.5, store);
  expect(store.data[PRINTER_MARGIN_KEY]).toBe('6.5');
  expect(loadPrinterMargin(store)).toBe(6.5);
  expect(loadPrinterMargin(memoryStore({ [PRINTER_MARGIN_KEY]: '99' }))).toBe(MAX_PRINTER_MARGIN);
  expect(loadPrinterMargin(memoryStore({ [PRINTER_MARGIN_KEY]: 'abc' }))).toBeNull();
});

test('a browser that refuses storage just forgets the margin', () => {
  expect(loadPrinterMargin(throwing)).toBeNull();
  expect(() => savePrinterMargin(5, throwing)).not.toThrow();
  expect(loadPrinterMargin(null)).toBeNull();
});

test('the remembered margin wins over the one stored in the zine', () => {
  const zinePrint = { ...DEFAULT_PRINT, printerMargin: 7, bleed: false };
  expect(printSettingsFor(zinePrint, 2)).toEqual({ ...zinePrint, printerMargin: 2 });
  expect(printSettingsFor(zinePrint, null)).toEqual(zinePrint);
  expect(printSettingsFor({ ...zinePrint, printerMargin: -5 }, null).printerMargin).toBe(0);
});
