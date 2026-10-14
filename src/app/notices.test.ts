import { beforeEach, expect, test } from 'vitest';
import { StorageFullError } from '../storage/db';
import { ZinFileError } from '../storage/zinFile';
import { dismissNotice, errorMessage, GENERIC_ERROR, noticeStore, notify } from './notices';

beforeEach(() => noticeStore.setState({ notices: [] }));

test('our errors keep their Polish message, others get a generic one', () => {
  expect(errorMessage(new StorageFullError())).toBe(new StorageFullError().message);
  expect(errorMessage(new ZinFileError('To nie jest plik zina.'))).toBe('To nie jest plik zina.');
  expect(errorMessage(new TypeError('x is undefined'))).toBe(GENERIC_ERROR);
  expect(errorMessage('boom')).toBe(GENERIC_ERROR);
});

test('notify adds a message once; dismissNotice removes it', () => {
  notify('A');
  notify('B');
  notify('A');
  const texts = noticeStore.getState().notices.map((n) => n.text);
  expect(texts).toEqual(['B', 'A']);
  dismissNotice(noticeStore.getState().notices[0].id);
  expect(noticeStore.getState().notices.map((n) => n.text)).toEqual(['A']);
});
