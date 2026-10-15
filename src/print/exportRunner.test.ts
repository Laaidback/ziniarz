import { expect, test } from 'vitest';
import { EXPORT_FAILED, exportProgressText, runExport, type ExportStatus, type ExportTask } from './exportRunner';
import type { PdfFile } from './pdf';

const file = (name: string): PdfFile => ({ name, bytes: new Uint8Array([1]) });

test('reports progress, then hands over every file at the end', async () => {
  const statuses: ExportStatus[] = [];
  const saved: string[] = [];
  const task: ExportTask = {
    label: 'PDF do druku',
    async build(onProgress) {
      onProgress(1, 2);
      expect(saved).toEqual([]); // nothing is downloaded while building
      onProgress(2, 2);
      return [file('a-przody.pdf'), file('a-tyly.pdf')];
    },
  };
  const ok = await runExport(task, (s) => statuses.push(s), (f) => saved.push(f.name));
  expect(ok).toBe(true);
  expect(saved).toEqual(['a-przody.pdf', 'a-tyly.pdf']);
  expect(statuses).toEqual([
    { kind: 'running', label: 'PDF do druku', done: 0, total: 0 },
    { kind: 'running', label: 'PDF do druku', done: 1, total: 2 },
    { kind: 'running', label: 'PDF do druku', done: 2, total: 2 },
    { kind: 'finished', label: 'PDF do druku', files: ['a-przody.pdf', 'a-tyly.pdf'] },
  ]);
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

test('progress text', () => {
  expect(exportProgressText({ kind: 'running', label: 'PDF do druku', done: 3, total: 10 })).toBe('PDF do druku: 3 z 10');
  expect(exportProgressText({ kind: 'running', label: 'PDF do druku', done: 0, total: 0 })).toBe('PDF do druku: przygotowanie…');
});
