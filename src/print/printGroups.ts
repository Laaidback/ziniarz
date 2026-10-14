import { sheetSides, type SheetSide } from '../imposition/imposition';
import type { PrintSettings } from '../model/types';

export interface PrintedSide {
  side: SheetSide;
  rotate180: boolean;
}

/** One output PDF: its file name suffix and the sheet sides in print order. */
export interface PrintGroup {
  suffix: string;
  sides: PrintedSide[];
}

/**
 * Which sheet sides go into which PDF, in what order and which are turned 180°.
 * Automatic duplex: one file, front and back of each sheet in turn. Manual duplex:
 * all fronts, then all backs (reversed when the printer stacks pages face up).
 */
export function printGroups(sheets: number, settings: PrintSettings): PrintGroup[] {
  const printed = (side: SheetSide): PrintedSide => ({ side, rotate180: settings.rotateBacks && side.face === 'back' });
  const sides = sheetSides(sheets);
  if (settings.duplex === 'auto') return [{ suffix: 'druk', sides: sides.map(printed) }];
  const fronts = sides.filter((s) => s.face === 'front');
  const backs = sides.filter((s) => s.face === 'back');
  return [
    { suffix: 'przody', sides: fronts.map(printed) },
    { suffix: 'tyly', sides: (settings.manualReverseBacks ? [...backs].reverse() : backs).map(printed) },
  ];
}
