import type { PdfFile } from './pdf';

export type ExportStatus =
  | { kind: 'idle' }
  | { kind: 'running'; label: string; done: number; total: number }
  | { kind: 'failed'; label: string }
  | { kind: 'finished'; label: string; files: string[] };

/** One download button's work: builds every file before anything is saved. */
export interface ExportTask {
  label: string;
  build(onProgress: (done: number, total: number) => void, signal: AbortSignal): Promise<PdfFile[]>;
}

export const EXPORT_FAILED = 'Nie udało się zrobić PDF-u. Nic nie zostało pobrane. Spróbuj jeszcze raz.';

/**
 * Builds all files of the task, reporting progress, and only then saves them, so a failure
 * part way never leaves a partial download. Resolves true when the files were saved.
 * Once `signal` is aborted (the screen was left) nothing is saved or reported any more.
 */
export async function runExport(
  task: ExportTask,
  report: (status: ExportStatus) => void,
  save: (file: PdfFile) => void,
  signal: AbortSignal = new AbortController().signal,
): Promise<boolean> {
  const update = (status: ExportStatus) => !signal.aborted && report(status);
  update({ kind: 'running', label: task.label, done: 0, total: 0 });
  let files: PdfFile[];
  try {
    files = await task.build((done, total) => update({ kind: 'running', label: task.label, done, total }), signal);
  } catch (e) {
    if (signal.aborted) return false;
    console.error(e);
    report({ kind: 'failed', label: task.label });
    return false;
  }
  if (signal.aborted) return false;
  try {
    for (const file of files) save(file);
  } catch (e) {
    console.error(e);
    report({ kind: 'failed', label: task.label });
    return false;
  }
  report({ kind: 'finished', label: task.label, files: files.map((f) => f.name) });
  return true;
}

export function exportProgressText(status: Extract<ExportStatus, { kind: 'running' }>): string {
  return status.total === 0
    ? `${status.label}: przygotowanie…`
    : `${status.label}: ${status.done} z ${status.total}`;
}
