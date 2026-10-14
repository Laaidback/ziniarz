import { expect, test } from 'vitest';
import { buildSfnt } from '../test/sfnt';
import { describeFontFile, fontMime, groupByFamily, readSfntNames, styleFromFileName } from './fontNames';

test('reads the family and the OS/2 bold and italic bits', () => {
  const data = buildSfnt({ names: { 1: 'Grotesk', 2: 'Bold Italic' }, fsSelection: 0x21 });
  expect(readSfntNames(data)).toEqual({ family: 'Grotesk', bold: true, italic: true });
});

test('prefers the legacy family name so light weights stay a separate family', () => {
  const data = buildSfnt({ names: { 1: 'Lato Light', 2: 'Regular', 16: 'Lato', 17: 'Light' }, fsSelection: 0x40, weight: 300 });
  expect(readSfntNames(data)).toEqual({ family: 'Lato Light', bold: false, italic: false });
});

test('without OS/2 the subfamily name decides the style', () => {
  expect(readSfntNames(buildSfnt({ names: { 1: 'Mono', 2: 'Italic' } }))).toEqual({ family: 'Mono', bold: false, italic: true });
});

test('anything that is not a TrueType/OpenType file gives null', () => {
  expect(readSfntNames(new TextEncoder().encode('hello world, not a font').buffer as ArrayBuffer)).toBeNull();
  expect(readSfntNames(new ArrayBuffer(2))).toBeNull();
});

test('style from file names', () => {
  expect(styleFromFileName('Lato-BoldItalic.woff2')).toEqual({ family: 'Lato', bold: true, italic: true });
  expect(styleFromFileName('PlayfairDisplay-Regular.ttf')).toEqual({ family: 'Playfair Display', bold: false, italic: false });
  expect(styleFromFileName('Comic_Neue.woff2')).toEqual({ family: 'Comic Neue', bold: false, italic: false });
  expect(styleFromFileName('Inter-SemiBoldItalic.woff2')).toEqual({ family: 'Inter SemiBold', bold: false, italic: true });
  expect(styleFromFileName('Space-Mono.woff2')).toEqual({ family: 'Space Mono', bold: false, italic: false });
});

test('weight words other than regular and bold stay part of the family name', () => {
  expect(styleFromFileName('Lato-Light.woff2')).toEqual({ family: 'Lato Light', bold: false, italic: false });
  expect(styleFromFileName('Lato-Black.woff2')).toEqual({ family: 'Lato Black', bold: false, italic: false });
  expect(styleFromFileName('Lato-Medium.woff2')).toEqual({ family: 'Lato Medium', bold: false, italic: false });
  expect(styleFromFileName('Inter-SemiBold.woff2')).toEqual({ family: 'Inter SemiBold', bold: false, italic: false });
  expect(styleFromFileName('Inter-ExtraBold.woff2')).toEqual({ family: 'Inter ExtraBold', bold: false, italic: false });
  expect(styleFromFileName('Lato-LightItalic.woff2')).toEqual({ family: 'Lato Light', bold: false, italic: true });
  expect(styleFromFileName('Lato-light.woff2')).toEqual({ family: 'Lato Light', bold: false, italic: false });
  expect(styleFromFileName('Lato-Bold.woff2')).toEqual({ family: 'Lato', bold: true, italic: false });
  expect(styleFromFileName('Lato-Book.woff2')).toEqual({ family: 'Lato', bold: false, italic: false });
});

test('describeFontFile reads tables for .ttf/.otf and the file name for .woff2', () => {
  const ttf = buildSfnt({ names: { 1: 'Grotesk', 2: 'Bold' }, fsSelection: 0x20 });
  expect(describeFontFile('whatever.ttf', ttf)).toEqual({ family: 'Grotesk', bold: true, italic: false, mime: 'font/ttf' });
  expect(describeFontFile('Lato-Italic.woff2', new ArrayBuffer(8))).toEqual({
    family: 'Lato',
    bold: false,
    italic: true,
    mime: 'font/woff2',
  });
  expect(describeFontFile('Broken-Bold.OTF', new ArrayBuffer(8))).toEqual({
    family: 'Broken',
    bold: true,
    italic: false,
    mime: 'font/otf',
  });
  expect(describeFontFile('notes.txt', new ArrayBuffer(8))).toBeNull();
  expect(fontMime('font.woff')).toBeNull();
});

test('groupByFamily ignores case and keeps first-seen order', () => {
  const item = (family: string) => ({ description: { family, bold: false, italic: false } });
  const groups = groupByFamily([item('Lato'), item('Inter'), item('lato')]);
  expect([...groups.keys()]).toEqual(['lato', 'inter']);
  expect(groups.get('lato')).toHaveLength(2);
});
