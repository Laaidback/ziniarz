import { expect, test, vi } from 'vitest';
import {
  EXPORT_FAILED,
  exportProgressText,
  runExport,
  saveReadyFile,
  type ExportStatus,
  type ExportTask,
} from './exportRunner';
import type { PdfFile } from './pdf';

const file = (name: string): PdfFile => ({ name, bytes: new Uint8Array([1]) });

test('reports progress, then saves a single file at once', async () => {
  const statuses: ExportStatus[] = [];
  const saved: string[] = [];
  const task: ExportTask = {
    label: 'PDF do druku',
    async build(onProgress) {
      onProgress(1, 2);
      expect(saved).toEqual([]); // nothing is downloaded while building
      onProgress(2, 2);
      return [file('a-druk.pdf')];
    },
  };
  const ok = await runExport(task, (s) => statuses.push(s), (f) => saved.push(f.name));
  expect(ok).toBe(true);
  expect(saved).toEqual(['a-druk.pdf']);
  expect(statuses).toEqual([
    { kind: 'running', label: 'PDF do druku', done: 0, total: 0 },
    { kind: 'running', label: 'PDF do druku', done: 1, total: 2 },
    { kind: 'running', label: 'PDF do druku', done: 2, total: 2 },
    { kind: 'finished', label: 'PDF do druku', files: ['a-druk.pdf'] },
  ]);
});

test('several files are only offered once all are built; each one is downloaded by its own click', async () => {
  const statuses: ExportStatus[] = [];
  const saved: string[] = [];
  const files = [file('a-przody.pdf'), file('a-tyly.pdf')];
  const task: ExportTask = { label: 'PDF do druku', build: async () => files };
  const ok = await runExport(task, (s) => statuses.push(s), (f) => saved.push(f.name));
  expect(ok).toBe(true);
  expect(saved).toEqual([]);
  const ready = statuses.at(-1)!;
  expect(ready).toEqual({ kind: 'ready', label: 'PDF do druku', files, saved: [], saveFailed: null });
  if (ready.kind !== 'ready') throw new Error('not ready');

  const afterBacks = saveReadyFile(ready, files[1], (f) => saved.push(f.name));
  expect(afterBacks).toMatchObject({ saved: ['a-tyly.pdf'], saveFailed: null });
  const again = saveReadyFile(afterBacks, files[1], (f) => saved.push(f.name));
  expect(again.saved).toEqual(['a-tyly.pdf']); // a second click downloads again, listed once
  expect(saved).toEqual(['a-tyly.pdf', 'a-tyly.pdf']);
});

test('a ready file whose download throws says which one, and a later click can retry', () => {
  const error = vi.spyOn(console, 'error').mockImplementation(() => {});
  const files = [file('a-przody.pdf'), file('a-tyly.pdf')];
  const ready = { kind: 'ready', label: 'PDF do druku', files, saved: ['a-przody.pdf'], saveFailed: null } as const;
  const failed = saveReadyFile({ ...ready, saved: [...ready.saved] }, files[1], () => {
    throw new Error('download blocked');
  });
  expect(failed).toMatchObject({ saved: ['a-przody.pdf'], saveFailed: 'a-tyly.pdf' });
  expect(error).toHaveBeenCalled();
  expect(saveReadyFile(failed, files[1], () => {})).toMatchObject({
    saved: ['a-przody.pdf', 'a-tyly.pdf'],
    saveFailed: null,
  });
  error.mockRestore();
});

test('a failure part way saves nothing and says so', async () => {
  const statuses: ExportStatus[] = [];
  const saved: string[] = [];
  const task: ExportTask = {
    label: 'PDF stronami',
    async build(onProgress) {
      onProgress(3, 20);
      throw new Error('canvas too big');
    },
  };
  const ok = await runExport(task, (s) => statuses.push(s), (f) => saved.push(f.name));
  expect(ok).toBe(false);
  expect(saved).toEqual([]);
  expect(statuses.at(-1)).toEqual({ kind: 'failed', label: 'PDF stronami' });
  expect(EXPORT_FAILED).toContain('Nic nie zostało pobrane');
});

test('a save that throws reports failure instead of staying running', async () => {
  const error = vi.spyOn(console, 'error').mockImplementation(() => {});
  const statuses: ExportStatus[] = [];
  const task: ExportTask = { label: 'PDF do druku', build: async () => [file('a.pdf')] };
  const ok = await runExport(task, (s) => statuses.push(s), () => {
    throw new Error('download blocked');
  });
  expect(ok).toBe(false);
  expect(statuses.at(-1)).toEqual({ kind: 'failed', label: 'PDF do druku' });
  expect(error).toHaveBeenCalled();
  error.mockRestore();
});

test('an export cancelled while building saves nothing and reports nothing more', async () => {
  const controller = new AbortController();
  const statuses: ExportStatus[] = [];
  const saved: string[] = [];
  const task: ExportTask = {
    label: 'PDF do druku',
    async build(onProgress, signal) {
      expect(signal).toBe(controller.signal);
      onProgress(1, 2);
      controller.abort(); // the screen was left
      onProgress(2, 2);
      return [file('a.pdf')];
    },
  };
  const ok = await runExport(task, (s) => statuses.push(s), (f) => saved.push(f.name), controller.signal);
  expect(ok).toBe(false);
  expect(saved).toEqual([]);
  expect(statuses).toEqual([
    { kind: 'running', label: 'PDF do druku', done: 0, total: 0 },
    { kind: 'running', label: 'PDF do druku', done: 1, total: 2 },
  ]);
});

test('a build stopped by the cancel is not reported or logged as a failure', async () => {
  const error = vi.spyOn(console, 'error').mockImplementation(() => {});
  const controller = new AbortController();
  const statuses: ExportStatus[] = [];
  const task: ExportTask = {
    label: 'PDF do druku',
    async build(_onProgress, signal) {
      controller.abort();
      signal.throwIfAborted();
      return [];
    },
  };
  const ok = await runExport(task, (s) => statuses.push(s), () => {}, controller.signal);
  expect(ok).toBe(false);
  expect(statuses.map((s) => s.kind)).toEqual(['running']);
  expect(error).not.toHaveBeenCalled();
  error.mockRestore();
});

test('progress text', () => {
  expect(exportProgressText({ kind: 'running', label: 'PDF do druku', done: 3, total: 10 })).toBe('PDF do druku: 3 z 10');
  expect(exportProgressText({ kind: 'running', label: 'PDF do druku', done: 0, total: 0 })).toBe('PDF do druku: przygotowanie…');
});
