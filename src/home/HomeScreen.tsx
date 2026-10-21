import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { useDb } from '../app/dbContext';
import { signInFromClick } from '../cloud/cloudActions';
import { useCloud, useSignedIn } from '../cloud/CloudContext';
import { openFromDrive, syncLinkedZines } from '../cloud/cloudSync';
import { cloudErrorOf } from '../cloud/errors';
import { listLinks } from '../cloud/links';
import { errorMessage, notify } from '../app/notices';
import { countOf } from '../app/plural';
import { navigate } from '../app/route';
import { whenSavesSettled } from '../editor/state/autosave';
import { clampSheets } from '../model/factory';
import { MAX_SHEETS, MIN_SHEETS } from '../model/geometry';
import type { Zine } from '../model/types';
import { pruneUnusedAssets } from '../storage/cleanup';
import { StorageFullError, type DriveLink } from '../storage/db';
import { holdOpenZineLock, whenNoZineIsOpen } from '../storage/zineLock';
import {
  isNearlyFull,
  NOT_PERSISTENT_HINT,
  persistentStorage,
  storageUsage,
  usageText,
  type StorageUsage,
} from '../storage/quota';
import { createNewZine, DEFAULT_SHEETS, importZinFile, listZinesForHome } from './homeActions';
import { ZineCard } from './ZineCard';

/** The browser updates its used-space figure a little after a write, so it is read again later too. */
const USAGE_RECHECKS_MS = [1500, 5000];

/** Used space, read now and again a little later; `refresh` after every change to the list. */
function useStorageUsage() {
  const [usage, setUsage] = useState<StorageUsage | null>(null);
  const timers = useRef<number[]>([]);
  const mounted = useRef(true);
  const refresh = useCallback(() => {
    const read = () => void storageUsage().then((value) => mounted.current && setUsage(value));
    read();
    timers.current.forEach((timer) => clearTimeout(timer));
    timers.current = USAGE_RECHECKS_MS.map((ms) => window.setTimeout(read, ms));
  }, []);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      timers.current.forEach((timer) => clearTimeout(timer));
    };
  }, []);
  return { usage, refresh };
}

export function HomeScreen() {
  const db = useDb();
  const cloud = useCloud();
  const signedIn = useSignedIn();
  const [zines, setZines] = useState<Zine[] | null>(null);
  const [links, setLinks] = useState<Map<string, DriveLink>>(new Map());
  const { usage, refresh: refreshUsage } = useStorageUsage();
  const [persistent, setPersistent] = useState(true);
  const [listFailed, setListFailed] = useState(false);
  const [title, setTitle] = useState('');
  // Kept as typed (it may be empty while retyping); the count used is clamped.
  const [sheetsText, setSheetsText] = useState(String(DEFAULT_SHEETS));
  const sheets = clampSheets(Number(sheetsText) || MIN_SHEETS);

  /** Never rejects: a failure shows a message instead of the list. */
  const reload = useCallback(async () => {
    try {
      const result = await listZinesForHome(db);
      const stored = cloud ? await listLinks(db) : [];
      setLinks(new Map(stored.map((link) => [link.zineId, link])));
      setZines(result.zines);
      setListFailed(false);
      if (result.unreadable > 0) notify(`Nie da się otworzyć zinów: ${result.unreadable}. Odśwież stronę.`);
    } catch {
      setListFailed(true);
      return;
    }
    refreshUsage();
  }, [db, cloud, refreshUsage]);

  useEffect(() => {
    let cancelled = false;
    void persistentStorage().then((granted) => !cancelled && setPersistent(granted));
    return () => {
      cancelled = true;
    };
  }, []);

  // Cleanup takes the same lock as the Drive sync below, which waits for it.
  const pruned = useRef<Promise<void>>(Promise.resolve());
  useEffect(() => {
    let cancelled = false;
    pruned.current = (async () => {
      // Never prune while the editor may still be saving (a new photo would look unused),
      // nor while any tab has a zine open: it may need photos and fonts its saved copy does not list yet.
      await whenSavesSettled();
      await whenNoZineIsOpen(db.name, () => pruneUnusedAssets(db)).catch(() => {});
      if (!cancelled) await reload();
    })();
    return () => {
      cancelled = true;
    };
  }, [db, reload]);

  // Zines saved on Google Drive: send changes made here, take newer versions (again after signing in).
  useEffect(() => {
    if (!cloud || !signedIn) return;
    let cancelled = false;
    void (async () => {
      await pruned.current;
      const changed = await syncLinkedZines(db, cloud.drive).catch(() => false);
      if (changed && !cancelled) await reload();
    })();
    return () => {
      cancelled = true;
    };
  }, [db, cloud, signedIn, reload]);

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
    // Until the imported zine is saved its photos belong to no zine: keep other tabs from pruning them.
    const release = holdOpenZineLock(db.name);
    try {
      await importZinFile(db, file);
      await reload();
    } catch (error) {
      notify(`Nie da się otworzyć tego pliku. ${errorMessage(error)}`);
    } finally {
      release();
    }
  };

  const openFromDriveClick = async () => {
    if (!cloud || !(await signInFromClick(cloud))) return;
    const token = cloud.auth.token();
    let fileId: string | null = null;
    try {
      fileId = token && (await cloud.pickFile(token));
    } catch (error) {
      notify(cloudErrorOf(error).message);
    }
    if (!fileId) return;
    // Until the downloaded zine is saved its photos belong to no zine: keep other tabs from pruning them.
    const release = holdOpenZineLock(db.name);
    try {
      // A conflict (the zine was on the list with changes of its own) is asked about in the editor.
      const { zineId, result } = await openFromDrive(db, cloud.drive, fileId);
      if (result.kind === 'failed') notify(result.error.message);
      navigate({ name: 'editor', zineId });
    } catch (error) {
      notify(`Nie da się otworzyć tego pliku. ${cloudErrorOf(error).message}`);
    } finally {
      release();
    }
  };

  return (
    <main className="home">
      <header className="home-header">
        <h1>ZINIARZ</h1>
        {cloud && (
          <button type="button" onPointerEnter={cloud.prepare} onFocus={cloud.prepare} onClick={() => void openFromDriveClick()}>
            Otwórz z Dysku Google
          </button>
        )}
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

      {listFailed ? (
        <p className="warning">Nie udało się wczytać listy zinów. Odśwież stronę.</p>
      ) : zines === null ? (
        <p className="muted">Wczytywanie…</p>
      ) : zines.length === 0 ? (
        <p className="muted">Nie masz jeszcze żadnego zina.</p>
      ) : (
        <ul className="zine-grid">
          {zines.map((zine) => (
            <ZineCard key={zine.id} zine={zine} link={links.get(zine.id)} onChanged={reload} />
          ))}
        </ul>
      )}

      {(usage || !persistent) && (
        <footer className="home-footer muted">
          {!persistent && <p className="storage-hint">{NOT_PERSISTENT_HINT}</p>}
          {usage && (
            <p>
              {usageText(usage)}
              {isNearlyFull(usage) && <strong className="warning"> {new StorageFullError().message}</strong>}
            </p>
          )}
        </footer>
      )}
    </main>
  );
}
