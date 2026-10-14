import { expect, test } from 'vitest';

test('browser project has a canvas', () => {
  const canvas = document.createElement('canvas');
  expect(canvas.getContext('2d')).not.toBeNull();
});
