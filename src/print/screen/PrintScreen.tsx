import { useEffect, useMemo, useRef, useState } from 'react';
import { useDb } from '../../app/dbContext';
import { LoadFailed } from '../../app/LoadFailed';
import { errorMessage, notify } from '../../app/notices';
import { routeHash } from '../../app/route';
import { useZineView } from '../../app/useZineView';
import { createAutosaver } from '../../editor/state/autosave';
import { printLayout } from '../../imposition/layout';
import type { PrintSettings, Zine } from '../../model/types';
import type { RenderAssets } from '../../render/assets';
import { saveZine } from '../../storage/db';
import { browserPdfExporter, type PdfExporter } from '../exporter';
import { runExport, saveReadyFile, type ExportStatus, type ExportTask } from '../exportRunner';
import type { PdfFile } from '../pdf';
import { loadPrinterMargin, printSettingsFor, savePrinterMargin } from '../printerMargin';
import { printReminders, trimSizeText } from '../printTexts';
import { testPageInstructions, testPageZine } from '../testPage';
import { ExportStatusView } from './ExportStatusView';
import { PrintOptions } from './PrintOptions';
import { SheetPreview } from './SheetPreview';

const NO_ASSETS: RenderAssets = { images: new Map() };

export function PrintScreen({ zineId, exporter = browserPdfExporter }: { zineId: string; exporter?: PdfExporter }) {
  const view = useZineView(zineId);
  if (view.status === 'loading') return <main className="screen-message">Otwieranie zina…</main>;
  if (view.status === 'failed') return <LoadFailed message={view.message} />;
  return <PrintWorkspace zine={view.zine} assets={view.assets} exporter={exporter} />;
}

interface WorkspaceProps {
  zine: Zine;
  assets: RenderAssets;
  exporter: PdfExporter;
}

function PrintWorkspace({ zine, assets, exporter }: WorkspaceProps) {
  const db = useDb();
  const [settings, setSettings] = useState(() => printSettingsFor(zine.print, loadPrinterMargin()));
  const [status, setStatus] = useState<ExportStatus>({ kind: 'idle' });
  const lastTask = useRef<ExportTask | null>(null);
  const layout = useMemo(() => printLayout(settings), [settings]);

  // The zine's content never changes here; only its print settings are saved (500 ms after a change, at once on leaving).
  const saver = useMemo(
    () => createAutosaver((next) => saveZine(db, next), { onError: (error) => notify(errorMessage(error)) }),
    [db],
  );
  useEffect(() => () => void saver.flush(), [saver]);

  // Leaving the screen cancels a running export, so it never downloads later in another screen.
  const alive = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    alive.current = controller;
    return () => controller.abort();
  }, []);

  const change = (patch: Partial<PrintSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    if (patch.printerMargin !== undefined) savePrinterMargin(patch.printerMargin);
    saver.schedule({ ...zine, print: next });
  };

  const run = (task: ExportTask) => {
    lastTask.current = task;
    if (!alive.current || alive.current.signal.aborted) return;
    void runExport(task, setStatus, (file) => exporter.save(file), alive.current.signal);
  };
  // Each of several ready files is downloaded by its own click.
  const saveReady = (file: PdfFile) => {
    if (status.kind === 'ready') setStatus(saveReadyFile(status, file, (f) => exporter.save(f)));
  };
  const busy = status.kind === 'running';
  const manual = settings.duplex === 'manual';

  return (
    <div className="print">
      <header className="screen-top">
        <a className="link-button" href={routeHash({ name: 'editor', zineId: zine.id })}>
          ← Wróć do edytora
        </a>
        <h1 className="editor-title">Druk: {zine.title}</h1>
        <a className="link-button" href={routeHash({ name: 'preview3d', zineId: zine.id })}>
          Podgląd 3D
        </a>
      </header>
      <aside className="print-side">
        <PrintOptions settings={settings} onChange={change} />
        <p className="print-size">{trimSizeText(layout)}</p>

        <section className="panel">
          <h2>Pobierz</h2>
          <ul className="reminders">
            {printReminders(settings).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <button
            type="button"
            className="primary"
            disabled={busy}
            onClick={() =>
              run({
                label: 'PDF do druku',
                build: (onProgress, signal) => exporter.sheets({ zine, assets, settings, onProgress, signal }),
              })
            }
          >
            {manual ? 'Przygotuj PDF-y do druku (przody i tyły)' : 'Pobierz PDF do druku'}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              run({
                label: 'PDF stronami',
                build: async (onProgress, signal) => [
                  await exporter.pages({ zine, assets, bleed: settings.bleed, onProgress, signal }),
                ],
              })
            }
          >
            Pobierz PDF stronami
          </button>
          <span className="muted">Strony A5 po kolei, do przejrzenia albo wysłania.</span>
          <ExportStatusView
            status={status}
            onRetry={() => lastTask.current && run(lastTask.current)}
            onSave={saveReady}
          />
        </section>

        <section className="panel">
          <h2>Strona próbna</h2>
          <span className="muted">
            Dwie kartki do sprawdzenia druku dwustronnego i marginesu drukarki, z bieżącymi ustawieniami.
          </span>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              run({
                label: 'Strona próbna',
                build: (onProgress, signal) =>
                  exporter.sheets({ zine: testPageZine(), assets: NO_ASSETS, settings, onProgress, signal }),
              })
            }
          >
            {manual ? 'Przygotuj stronę próbną (przody i tyły)' : 'Pobierz stronę próbną'}
          </button>
          <ul className="test-page-help" aria-label="Jak sprawdzić stronę próbną">
            {testPageInstructions().map((line) => (
              <li key={line}>{line.replace(/^• /, '')}</li>
            ))}
          </ul>
        </section>
      </aside>
      <section className="print-preview" aria-label="Podgląd arkuszy">
        <SheetPreview zine={zine} assets={assets} settings={settings} />
      </section>
    </div>
  );
}
