import { EXPORT_FAILED, exportProgressText, type ExportStatus } from '../exportRunner';

export function ExportStatusView({ status, onRetry }: { status: ExportStatus; onRetry(): void }) {
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
    case 'finished':
      return <p className="export-status muted">Pobrano: {status.files.join(', ')}</p>;
  }
}
