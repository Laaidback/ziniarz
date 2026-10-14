import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useDb } from '../app/dbContext';
import { errorMessage, notify } from '../app/notices';
import { countOf } from '../app/plural';
import { navigate } from '../app/route';
import { whenSavesSettled } from '../editor/state/autosave';
import { clampSheets } from '../model/factory';
import { MAX_SHEETS, MIN_SHEETS } from '../model/geometry';
import type { Zine } from '../model/types';
import { pruneUnusedAssets } from '../storage/cleanup';
import { StorageFullError } from '../storage/db';
import { isNearlyFull, storageUsage, usageText, type StorageUsage } from '../storage/quota';
import { createNewZine, DEFAULT_SHEETS, importZinFile, listZinesForHome } from './homeActions';
import { ZineCard } from './ZineCard';

export function HomeScreen() {
  const db = useDb();
  const [zines, setZines] = useState<Zine[] | null>(null);
  const [usage, setUsage] = useState<StorageUsage | null>(null);
  const [title, setTitle] = useState('');
  // Kept as typed (it may be empty while retyping); the count used is clamped.
  const [sheetsText, setSheetsText] = useState(String(DEFAULT_SHEETS));
  const sheets = clampSheets(Number(sheetsText) || MIN_SHEETS);

  const reload = useCallback(async () => {
    const result = await listZinesForHome(db);
    setZines(result.zines);
    if (result.unreadable > 0) notify(`Nie da się otworzyć zinów: ${result.unreadable}. Odśwież stronę.`);
    setUsage(await storageUsage());
  }, [db]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      // Never prune while the editor may still be saving: a new photo would look unused.
      await whenSavesSettled();
      await pruneUnusedAssets(db).catch(() => {});
      if (!cancelled) await reload();
    })();
    return () => {
      cancelled = true;
    };
  }, [db, reload]);

  const create = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const zine = await createNewZine(db, title, sheets);
      navigate({ name: 'editor', zineId: zine.id });
    } catch (error) {
      notify(errorMessage(error));
    }
  };

  const load = async (file: File) => {
    try {
      await importZinFile(db, file);
      await reload();
    } catch (error) {
      notify(`Nie da się otworzyć tego pliku. ${errorMessage(error)}`);
    }
  };

  return (
    <main className="home">
      <header className="home-header">
        <h1>ZINIARZ</h1>
        <label className="file-button">
          Wczytaj plik .zin
          <input
            type="file"
            accept=".zin"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) void load(file);
            }}
          />
        </label>
      </header>

      <form className="new-zine" onSubmit={create} noValidate>
        <label>
          Tytuł
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Bez tytułu" />
        </label>
        <label>
          Kartki
          <input
            type="number"
            min={MIN_SHEETS}
            max={MAX_SHEETS}
            value={sheetsText}
            onChange={(event) => setSheetsText(event.target.value)}
            onBlur={() => setSheetsText(String(sheets))}
          />
        </label>
        <span className="muted">= {countOf(4 * sheets, 'strona', 'strony', 'stron')}</span>
        <button type="submit" className="primary">
          Nowy zin
        </button>
      </form>

      {zines === null ? (
        <p className="muted">Wczytywanie…</p>
      ) : zines.length === 0 ? (
        <p className="muted">Nie masz jeszcze żadnego zina.</p>
      ) : (
        <ul className="zine-grid">
          {zines.map((zine) => (
            <ZineCard key={zine.id} zine={zine} onChanged={reload} />
          ))}
        </ul>
      )}

      {usage && (
        <footer className="home-footer muted">
          {usageText(usage)}
          {isNearlyFull(usage) && <strong className="warning"> {new StorageFullError().message}</strong>}
        </footer>
      )}
    </main>
  );
}
