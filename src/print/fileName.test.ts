import { expect, test } from 'vitest';
import { fileSlug } from './fileName';

test('fileSlug strips Polish letters and punctuation', () => {
  expect(fileSlug('Żółta łąka, część 2!')).toBe('zolta-laka-czesc-2');
  expect(fileSlug('   ')).toBe('zin');
});
