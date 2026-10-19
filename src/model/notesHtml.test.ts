import { expect, test } from 'vitest';
import { MAX_NOTES_LENGTH, notesPreview, sanitizeNotes } from './notesHtml';

test('keeps bold, highlight, lines and line breaks, without attributes', () => {
  expect(sanitizeNotes('<div>Ala <b>ma</b> <strong>kota</strong></div><p><mark class="x">i psa</mark><br/></p>')).toBe(
    '<div>Ala <b>ma</b> <b>kota</b></div><p><mark>i psa</mark><br></p>',
  );
  expect(sanitizeNotes('<B STYLE="color:red">Duże</B>')).toBe('<b>Duże</b>');
});

test('drops scripts, styles and their content, event handlers, links and other tags', () => {
  expect(sanitizeNotes('a<script>alert(1)</script>b<style>p{}</style>c')).toBe('abc');
  expect(sanitizeNotes('<img src=x onerror="alert(1)">x')).toBe('x');
  expect(sanitizeNotes('<b onclick="alert(1)" title=\'>\'>t</b>')).toBe('<b>t</b>');
  expect(sanitizeNotes('<a href="javascript:alert(1)">link</a>')).toBe('link');
  expect(sanitizeNotes('<span style="background:red">kolor</span><font color=red>!</font>')).toBe('kolor!');
  expect(sanitizeNotes('<iframe src="x">ramka</iframe><svg><script>x</script></svg>ok')).toBe('ok');
  expect(sanitizeNotes('<!-- komentarz --><!DOCTYPE html>tekst')).toBe('tekst');
  expect(sanitizeNotes('<script>never closed')).toBe('');
});

test('plain text stays as it reads: escaped, line breaks kept', () => {
  expect(sanitizeNotes('a < b & c > d\ndruga linia')).toBe('a &lt; b &amp; c &gt; d\ndruga linia');
  expect(sanitizeNotes('<3 i <b')).toBe('&lt;3 i &lt;b');
  expect(sanitizeNotes('')).toBe('');
});

test('entities are read and written back safely', () => {
  expect(sanitizeNotes('&lt;script&gt;x&lt;/script&gt; &amp; &nbsp;&#261;&#x17C;')).toBe('&lt;script&gt;x&lt;/script&gt; &amp;  ąż');
  expect(sanitizeNotes('&unknown; &#0;')).toBe('&amp;unknown; ');
});

test('the result is well formed and sanitizing again changes nothing', () => {
  expect(sanitizeNotes('<b><mark>x</b> y</mark></div>')).toBe('<b><mark>x</mark></b> y');
  expect(sanitizeNotes('<div><b>niezamknięte')).toBe('<div><b>niezamknięte</b></div>');
  for (const input of ['<b><mark>x</b> y</mark>', 'a &lt; b<br>', '<p>x<script>y</script></p>&amp;', 'a < b']) {
    const once = sanitizeNotes(input);
    expect(sanitizeNotes(once)).toBe(once);
  }
});

test('runs in linear time, also on unclosed tags and quotes', () => {
  for (const piece of ['<a', '<a "', "<a '", '<a\t', '<!--', '<!', '</', '<b>', '&#', '&a', '<script']) {
    const input = piece.repeat(Math.ceil(100_000 / piece.length));
    const start = performance.now();
    sanitizeNotes(input);
    expect(performance.now() - start, piece).toBeLessThan(100);
  }
});

test('a tag that never closes leaves the rest as text', () => {
  expect(sanitizeNotes('x<b>y</b><a title="z')).toBe('x<b>y</b>&lt;a title="z');
  expect(sanitizeNotes('<b>a<i')).toBe('<b>a&lt;i</b>');
});

test('notes are cut at MAX_NOTES_LENGTH characters', () => {
  expect(sanitizeNotes('a'.repeat(MAX_NOTES_LENGTH + 10))).toHaveLength(MAX_NOTES_LENGTH);
});

test('closing tags of dropped elements are found case-insensitively on the original text', () => {
  // 'İ' becomes two characters in lower case: indices of a lower-cased copy would drift.
  expect(sanitizeNotes('İİİİ<script>x</SCRIPT>widać')).toBe('İİİİwidać');
  expect(sanitizeNotes('<style>a</stylex>b</style>c')).toBe('c');
  expect(sanitizeNotes('<script>x</script\n>po')).toBe('po');
});

test('notesPreview gives the plain text of the notes, line by line, without empty lines', () => {
  expect(notesPreview('')).toBe('');
  expect(notesPreview('Ala <b>ma</b> <mark>kota</mark>')).toBe('Ala ma kota');
  expect(notesPreview('Raz<div>dwa</div><div><br></div><p>trzy &amp; &lt;cztery&gt;</p>')).toBe('Raz\ndwa\ntrzy & <cztery>');
  expect(notesPreview('a<br><br>  b  ')).toBe('a\nb');
  expect(notesPreview('x'.repeat(1000))).toHaveLength(300);
});
