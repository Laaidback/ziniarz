import { useCallback, useEffect, useRef, useState } from 'react';
import { notify } from '../app/notices';
import { whenSavesSettled } from '../editor/state/autosave';
import type { EditorStore } from '../editor/state/store';
import type { ZiniarzDb } from '../storage/db';
import { applyChoice, signInFromClick } from './cloudActions';
import { useCloud, useSignedIn, type CloudServices } from './CloudContext';
import { cloudStatusStore, setCloudStatus } from './cloudStatus';
import { linkToDrive, relinkAsNew, syncZine, type ConflictChoice } from './cloudSync';
import { askConflict } from './conflict';
import { cloudErrorOf } from './errors';
import { getLink } from './links';
import type { CloudStatusAction } from './statusText';
import type { LastChange } from './sync';

/** Changes go to Drive `delayMs` after the last one (and when leaving the editor); tests shorten it. */
export const cloudSyncTiming = { delayMs: 10_000 };

export interface EditorCloud {
  cloud: CloudServices;
  /** Whether the zine is saved on Drive (null while finding out). */
  linked: boolean | null;
  saveToDrive(): Promise<void>;
  act(action: CloudStatusAction): Promise<void>;
}

interface Options {
  db: ZiniarzDb;
  zineId: string;
  store: EditorStore;
  /** Writes pending autosaves now; every Drive step starts from the zine as saved in the browser. */
  flushSaves(): Promise<void>;
  /**
   * Closes the editor and opens the zine again, taking the version on Drive on the way (EditorScreen):
   * with a conflict choice, that choice. Downloads happen only there, never under a live editor.
   */
  reopen(choice?: ConflictChoice): void;
}

/**
 * Sends the open zine to Drive 10 s after the last change and when leaving the editor. It never replaces
 * the zine under the person's hands: a newer version on Drive shows "Wczytaj", changes on both sides ask,
 * and taking Drive's version reopens the editor.
 */
export function useEditorCloudSync({ db, zineId, store, flushSaves, reopen }: Options): EditorCloud | null {
  const cloud = useCloud();
  const signedIn = useSignedIn();
  const [linked, setLinked] = useState<boolean | null>(null);
  const latest = useRef({ flushSaves, reopen });
  latest.current = { flushSaves, reopen };

  useEffect(() => {
    let cancelled = false;
    void getLink(db, zineId).then((link) => !cancelled && setLinked(link !== undefined));
    return () => {
      cancelled = true;
    };
  }, [db, zineId]);

  /** Asks which version to keep. Keeping this one uploads in place; the others reopen the editor. */
  const choose = useCallback(
    async (change: LastChange) => {
      if (!cloud) return;
      const title = store.getState().history.present.title;
      const choice = await askConflict(title, change);
      if (choice === 'mine') {
        await latest.current.flushSaves();
        await applyChoice(db, cloud, zineId, title, 'mine');
      } else if (choice) {
        latest.current.reopen(choice);
      }
    },
    [db, cloud, zineId, store],
  );

  const sync = useCallback(async () => {
    if (!cloud) return;
    await latest.current.flushSaves();
    const result = await syncZine(db, cloud.drive, zineId, { allowDownload: false });
    if (result.kind === 'conflict') await choose(result.change);
  }, [db, cloud, zineId, choose]);

  // Send changes a while after the last one; leaving the editor sends them right away (in the background).
  useEffect(() => {
    if (!cloud || !linked) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = store.subscribe((state, previous) => {
      if (state.history.present === previous.history.present) return;
      setCloudStatus(zineId, { state: 'pending' });
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(() => void sync(), cloudSyncTiming.delayMs);
    });
    return () => {
      unsubscribe();
      if (timer !== null) clearTimeout(timer);
      // The editor's own cleanup has started its last save; send once it is written.
      void whenSavesSettled().then(() => syncZine(db, cloud.drive, zineId, { allowDownload: false }));
    };
  }, [db, cloud, linked, store, zineId, sync]);

  // Signing in (or back in) sends what waited and finds out about newer versions on Drive.
  // (With a token at hand the editor synced before opening.)
  const wasSignedIn = useRef(signedIn);
  useEffect(() => {
    if (cloud && linked && signedIn && !wasSignedIn.current) void sync();
    if (linked !== null) wasSignedIn.current = signedIn;
  }, [cloud, linked, signedIn, sync]);

  if (!cloud) return null;
  return {
    cloud,
    linked,
    async saveToDrive() {
      if (!(await signInFromClick(cloud))) return;
      await latest.current.flushSaves();
      try {
        await linkToDrive(db, cloud.drive, zineId);
        setLinked(true);
        notify('Zin jest na Dysku Google. Udostępnisz go z listy zinów przyciskiem „Pokaż na Dysku”.');
      } catch (error) {
        notify(cloudErrorOf(error).message);
      }
    },
    async act(action) {
      switch (action) {
        case 'signIn':
          await signInFromClick(cloud);
          return;
        case 'retry':
          return sync();
        case 'load':
          // Opening again takes the newer version (or asks, if something changed here meanwhile).
          latest.current.reopen();
          return;
        case 'choose': {
          const change = cloudStatusStore.getState().zines[zineId]?.change;
          return change ? choose(change) : sync();
        }
        case 'relink':
          await latest.current.flushSaves();
          try {
            await relinkAsNew(db, cloud.drive, zineId);
          } catch (error) {
            notify(cloudErrorOf(error).message);
          }
      }
    },
  };
}
