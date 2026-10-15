import type { PdfFile } from './pdf';

export type ExportStatus =
  | { kind: 'idle' }
  | { kind: 'running'; label: string; done: number; total: number }
  | { kind: 'failed'; label: string }
  | { kind: 'finished'; label: string; files: string[] }
  | ReadyStatus;

/**
 * Several files are built and wait for a click each: browsers ask before a second automatic
 * download, and a failed second download would leave the first one half of a pair.
 */
export interface ReadyStatus {
  kind: 'ready';
  label: string;
  files: PdfFile[];
  /** Names of the files downloaded so far. */
  saved: string[];
  /** The file whose last download failed. */
  saveFailed: string | null;
}

/** One download button's work: builds every file before anything is saved. */
export interface ExportTask {
  label: string;
  build(onProgress: (done: number, total: number) => void, signal: AbortSignal): Promise<PdfFile[]>;
}

export const EXPORT_FAILED = 'Nie udało się zrobić PDF-u. Nic nie zostało pobrane. Spróbuj jeszcze raz.';

/**
 * Builds all files of the task, reporting progress, and only then offers them, so a failure
 * part way never leaves a partial download. A single file is saved at once; several files
 * end in a 'ready' status, saved one by one with saveReadyFile. Resolves true on success.
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
  if (files.length > 1) {
    report({ kind: 'ready', label: task.label, files, saved: [], saveFailed: null });
    return true;
  }
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

/** Downloads one of the ready files (on its button click) and notes the result. */
export function saveReadyFile(status: ReadyStatus, file: PdfFile, save: (file: PdfFile) => void): ReadyStatus {
  try {
    save(file);
  } catch (e) {
    console.error(e);
    return { ...status, saveFailed: file.name };
  }
  const saved = status.saved.includes(file.name) ? status.saved : [...status.saved, file.name];
  return { ...status, saved, saveFailed: null };
}

export function readyFailedText(name: string): string {
  return `Nie udało się pobrać pliku ${name}. Spróbuj jeszcze raz.`;
}

export function exportProgressText(status: Extract<ExportStatus, { kind: 'running' }>): string {
  return status.total === 0
    ? `${status.label}: przygotowanie…`
    : `${status.label}: ${status.done} z ${status.total}`;
}
