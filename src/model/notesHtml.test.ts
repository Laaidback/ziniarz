import { expect, test } from 'vitest';
import { sanitizeNotes } from './notesHtml';

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
