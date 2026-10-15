import { EXPORT_FAILED, exportProgressText, readyFailedText, type ExportStatus } from '../exportRunner';
import type { PdfFile } from '../pdf';
import { fileDownloadText } from '../printTexts';

interface Props {
  status: ExportStatus;
  onRetry(): void;
  /** Downloads one of several ready files. */
  onSave(file: PdfFile): void;
}

export function ExportStatusView({ status, onRetry, onSave }: Props) {
  switch (status.kind) {
    case 'idle':
      return null;
    case 'running':
      return (
        <div className="export-status">
          <progress max={status.total || 1} value={status.done} aria-label="Postęp eksportu" />
          <span>{exportProgressText(status)}</span>
        </div>
      );
    case 'failed':
      return (
        <div className="export-status export-error" role="alert">
          <span>{EXPORT_FAILED}</span>
          <button type="button" onClick={onRetry}>
            Spróbuj jeszcze raz
          </button>
        </div>
      );
    case 'ready':
      return (
        <div className="export-status export-ready">
          <span>{status.label}: gotowe. Pobierz każdy plik osobno.</span>
          {status.files.map((file) => (
            <span key={file.name} className="export-file">
              <button type="button" onClick={() => onSave(file)}>
                {fileDownloadText(file.name)}
              </button>
              {status.saved.includes(file.name) && <span className="muted">Pobrano</span>}
            </span>
          ))}
          {status.saveFailed && (
            <span className="export-error" role="alert">
              {readyFailedText(status.saveFailed)}
            </span>
          )}
        </div>
      );
    case 'finished':
      return <p className="export-status muted">Pobrano: {status.files.join(', ')}</p>;
  }
}
