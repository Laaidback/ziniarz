import { expect, test } from 'vitest';
import { sheetSides } from '../imposition/imposition';
import { pageCount, slotOfPage } from '../model/geometry';
import type { TextElement } from '../model/types';
import { testPageZine } from './testPage';

const texts = (zine: ReturnType<typeof testPageZine>) =>
  zine.spreads.flatMap((s) => s.elements).filter((e): e is TextElement => e.kind === 'text');

test('test page has two sheets so a wrong back order shows up', () => {
  const zine = testPageZine();
  expect(zine.sheets).toBe(2);
  expect(pageCount(zine.sheets)).toBe(8);
});

test('every page shows its number, "up" and its sheet side', () => {
  const zine = testPageZine();
  for (const side of sheetSides(zine.sheets)) {
    const label = `kartka ${side.sheet + 1} · ${side.face === 'front' ? 'przód' : 'tył'}`;
    for (const page of [side.left, side.right]) {
      const onSpread = zine.spreads[slotOfPage(page).spread].elements.filter((e): e is TextElement => e.kind === 'text');
      expect(onSpread.map((e) => e.text)).toContain(`${page}\n↑ góra`);
      expect(onSpread.map((e) => e.text)).toContain(label);
    }
  }
});

test('instructions name the backs that come from the imposition', () => {
  const zine = testPageZine();
  const all = texts(zine).map((e) => e.text).join('\n');
  for (const side of sheetSides(zine.sheets).filter((s) => s.face === 'back')) {
    expect(all).toContain(`${side.left} | ${side.right}`);
  }
  expect(all).toContain('„Obróć tyły o 180°”');
  expect(all).toContain('„tyły w odwrotnej kolejności”');
  expect(all).toContain('margines drukarki');
});
