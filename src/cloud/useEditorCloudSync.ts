import { useCallback, useEffect, useRef, useState } from 'react';
import { notify } from '../app/notices';
import { whenSavesSettled } from '../editor/state/autosave';
import type { EditorStore } from '../editor/state/store';
import type { ZiniarzDb } from '../storage/db';
import { chooseVersion, signInFromClick } from './cloudActions';
import { useCloud, useSignedIn, type CloudServices } from './CloudContext';
import { cloudStatusStore, setCloudStatus } from './cloudStatus';
import { linkToDrive, relinkAsNew, syncZine, type SyncResult } from './cloudSync';
import { cloudErrorOf } from './errors';
import { getLink } from './links';
import type { CloudStatusAction } from './statusText';

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
  /** Opens the zine again after its content was replaced by the version on Drive. */
  reopen(): void;
}

/**
 * Sends the open zine to Drive 10 s after the last change and when leaving the editor. It never replaces
 * the zine under the person's hands: a newer version on Drive shows "Wczytaj", changes on both sides ask.
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

  const titleNow = useCallback(() => store.getState().history.present.title, [store]);

  /** After a choice: a downloaded version means the open zine is out of date. */
  const settle = useCallback(
    async (result: SyncResult | null) => {
      if (result?.kind === 'conflict' && cloud) result = await chooseVersion(db, cloud, zineId, titleNow(), result.change);
      if (result?.kind === 'downloaded') latest.current.reopen();
    },
    [db, cloud, zineId, titleNow],
  );

  const sync = useCallback(
    async (allowDownload: boolean) => {
      if (!cloud) return;
      await latest.current.flushSaves();
      await settle(await syncZine(db, cloud.drive, zineId, { allowDownload }));
    },
    [db, cloud, zineId, settle],
  );

  // Send changes a while after the last one; leaving the editor sends them right away (in the background).
  useEffect(() => {
    if (!cloud || !linked) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = store.subscribe((state, previous) => {
      if (state.history.present === previous.history.present) return;
      setCloudStatus(zineId, { state: 'pending' });
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(() => void sync(false), cloudSyncTiming.delayMs);
    });
    return () => {
      unsubscribe();
      if (timer !== null) clearTimeout(timer);
      // The editor's own cleanup has started its last save; send once it is written.
      void whenSavesSettled().then(() => syncZine(db, cloud.drive, zineId, { allowDownload: false }));
    };
  }, [db, cloud, linked, store, zineId, sync]);

  // Signing in (or back in) sends what waited.
  useEffect(() => {
    if (cloud && linked && signedIn) {
      const state = cloudStatusStore.getState().zines[zineId]?.state;
      if (state === 'pending' || state === 'error') void sync(false);
    }
  }, [cloud, linked, signedIn, zineId, sync]);

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
          return sync(false);
        case 'load':
          return sync(true);
        case 'choose': {
          const change = cloudStatusStore.getState().zines[zineId]?.change;
          if (!change) return sync(false);
          await latest.current.flushSaves();
          return settle(await chooseVersion(db, cloud, zineId, titleNow(), change));
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
