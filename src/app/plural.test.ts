import { expect, test } from 'vitest';
import { countOf, plural } from './plural';

test('Polish plural forms', () => {
  const forms = [1, 2, 4, 5, 12, 14, 20, 22, 24, 25, 112].map((n) => plural(n, 'strona', 'strony', 'stron'));
  expect(forms).toEqual(['strona', 'strony', 'strony', 'stron', 'stron', 'stron', 'stron', 'strony', 'strony', 'stron', 'stron']);
  expect(countOf(5, 'kartka', 'kartki', 'kartek')).toBe('5 kartek');
});
