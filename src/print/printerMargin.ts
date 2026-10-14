import { DEFAULT_PRINT } from '../model/factory';
import type { PrintSettings } from '../model/types';

/** localStorage key of the printer margin: it belongs to the printer, so it is remembered per browser. */
export const PRINTER_MARGIN_KEY = 'ziniarz.printerMargin';
export const MAX_PRINTER_MARGIN = 20;
const STEP = 0.5;

/** The part of `Storage` we use, so tests can pass a plain object. */
export type KeyValueStore = Pick<Storage, 'getItem' | 'setItem'>;

/** 0…20 mm in 0.5 mm steps; anything that is not a number becomes the default. 20 mm keeps the print scale well above zero. */
export function clampPrinterMargin(mm: number): number {
  if (!Number.isFinite(mm)) return DEFAULT_PRINT.printerMargin;
  return Math.min(MAX_PRINTER_MARGIN, Math.max(0, Math.round(mm / STEP) * STEP));
}

function browserStore(): KeyValueStore | null {
  try {
    return window.localStorage;
  } catch {
    return null; // storage blocked (privacy settings)
  }
}

/** The margin set earlier in this browser, or null when none was set (or storage is blocked). */
export function loadPrinterMargin(store: KeyValueStore | null = browserStore()): number | null {
  try {
    const raw = store?.getItem(PRINTER_MARGIN_KEY);
    if (raw == null || raw.trim() === '') return null;
    const value = Number(raw);
    return Number.isFinite(value) ? clampPrinterMargin(value) : null;
  } catch {
    return null;
  }
}

export function savePrinterMargin(mm: number, store: KeyValueStore | null = browserStore()): void {
  try {
    store?.setItem(PRINTER_MARGIN_KEY, String(clampPrinterMargin(mm)));
  } catch {
    // Not remembered; the zine still keeps its own copy.
  }
}

/**
 * Settings to print and preview with: the zine's own settings, except the printer margin,
 * which comes from this browser when it was set here (the zine copy is the fallback,
 * e.g. for a .zin file opened on another computer).
 */
export function printSettingsFor(zinePrint: PrintSettings, rememberedMargin: number | null): PrintSettings {
  return { ...zinePrint, printerMargin: rememberedMargin ?? clampPrinterMargin(zinePrint.printerMargin) };
}
