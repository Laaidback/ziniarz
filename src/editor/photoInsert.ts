import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { errorMessage, notify } from '../app/notices';
import type { EditorEnv } from './EditorContext';
import { insertPhotos } from './insert';

export interface InsertProgress {
  current: number;
  total: number;
}

/** Adding photos in the open editor: stopped when the editor closes, with progress for the top bar. */
export interface PhotoInsert {
  add(files: File[], page: number | null): void;
  progress: InsertProgress | null;
}

export const PhotoInsertContext = createContext<PhotoInsert | null>(null);

export function usePhotoInsert(): PhotoInsert {
  const value = useContext(PhotoInsertContext);
  if (!value) throw new Error('PhotoInsertContext is missing');
  return value;
}

export function insertProgressText({ current, total }: InsertProgress): string {
  return `Dodawanie zdjęć ${current} z ${total}…`;
}

/** For the editor workspace: leaving the editor aborts adding (it stops before the next file). */
export function usePhotoInsertState(env: Pick<EditorEnv, 'db' | 'store' | 'assets'>): PhotoInsert {
  const [progress, setProgress] = useState<InsertProgress | null>(null);
  const controller = useRef<AbortController | null>(null);
  const latestJob = useRef(0);
  useEffect(() => {
    const current = new AbortController();
    controller.current = current;
    return () => current.abort();
  }, []);

  const add = useCallback(
    (files: File[], page: number | null) => {
      const signal = controller.current?.signal;
      if (!signal || signal.aborted) return;
      const job = ++latestJob.current;
      const mine = () => !signal.aborted && job === latestJob.current;
      insertPhotos(env, files, page, {
        signal,
        onProgress: (current, total) => mine() && setProgress({ current, total }),
      })
        .catch((error: unknown) => !signal.aborted && notify(errorMessage(error)))
        .finally(() => mine() && setProgress(null));
    },
    [env],
  );
  return useMemo(() => ({ add, progress }), [add, progress]);
}
