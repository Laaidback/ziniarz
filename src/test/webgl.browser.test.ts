import { expect, test } from 'vitest';

test('the test browser can draw with WebGL (SwiftShader in headless Chromium)', () => {
  const gl = document.createElement('canvas').getContext('webgl2');
  expect(gl).not.toBeNull();
});
