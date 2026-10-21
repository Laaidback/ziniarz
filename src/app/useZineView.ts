import { useEffect, useRef, useState } from 'react';
import { openZineView, type ZineView } from '../editor/session';
import { releaseRenderAssets } from '../render/assets';
import { acquireOpenZineLock } from '../storage/zineLock';
import { useDb } from './dbContext';
import { errorMessage } from './notices';

export type ZineViewState =
  | { status: 'loading' }
  | { status: 'failed'; message: string }
  | ({ status: 'ready' } & ZineView);

/** Opens a zine for a read-only screen (print, 3D); its photos are released when the screen closes. */
export function useZineView(zineId: string): ZineViewState {
  const db = useDb();
  const [state, setState] = useState<ZineViewState>({ status: 'loading' });
  // Other tabs must not prune this zine's photos and fonts while it is shown; nor download a newer
  // version from Google Drive under it (the print screen saves its print options with the zine).
  const lockGranted = useRef<Promise<void>>(Promise.resolve());
  useEffect(() => {
    const lock = acquireOpenZineLock(db.name);
    lockGranted.current = lock.granted;
    return lock.release;
  }, [db]);
  useEffect(() => {
    let cancelled = false;
    let opened: ZineView | null = null;
    setState({ status: 'loading' });
    lockGranted.current.then(() => openZineView(db, zineId)).then(
      (view) => {
        opened = view;
        if (cancelled) releaseRenderAssets(view.assets);
        else setState({ status: 'ready', ...view });
      },
      (reason: unknown) => !cancelled && setState({ status: 'failed', message: errorMessage(reason) }),
    );
    return () => {
      cancelled = true;
      if (opened) releaseRenderAssets(opened.assets);
    };
  }, [db, zineId]);
  return state;
}
