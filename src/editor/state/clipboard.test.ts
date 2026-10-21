import { expect, test } from 'vitest';
import { createPhotoElement } from '../../model/factory';
import { cloneForPaste, PASTE_OFFSET } from './clipboard';

test('a pasted copy gets a new id and a deep copy of the crop', () => {
  const photo = createPhotoElement('img', { x: 10, y: 20 });
  const copy = cloneForPaste(photo, []);
  expect(copy.id).not.toBe(photo.id);
  expect(copy).toMatchObject({ kind: 'photo', imageId: 'img', x: 10, y: 20 });
  expect(copy.kind === 'photo' && copy.crop).not.toBe(photo.crop);
});

test('the copy steps aside while it would cover an element exactly', () => {
  const photo = createPhotoElement('img', { x: 10, y: 20 });
  const shifted = createPhotoElement('img', { x: 10 + PASTE_OFFSET, y: 20 + PASTE_OFFSET });
  expect(cloneForPaste(photo, [photo])).toMatchObject({ x: 15, y: 25 });
  expect(cloneForPaste(photo, [photo, shifted])).toMatchObject({ x: 20, y: 30 });
});

test('a copy of a locked element is unlocked', () => {
  const photo = createPhotoElement('img', { locked: true });
  expect(cloneForPaste(photo, []).locked).toBe(false);
});
