import type { Zine } from '../../model/types';

export const AUTOSAVE_DELAY_MS = 500;

const inFlight = new Set<Promise<void>>();

/**
 * Resolves when every save started so far has finished. The zine list awaits it before
 * pruning unused photos, so a photo added just before leaving the editor is never deleted.
 */
export async function whenSavesSettled(): Promise<void> {
  await Promise.allSettled([...inFlight]);
}

export interface Autosaver {
  /** Saves `zine` AUTOSAVE_DELAY_MS after the last call. */
  schedule(zine: Zine): void;
  /** Saves a scheduled zine right away (leaving the editor). */
  flush(): Promise<void>;
}

export interface AutosaveOptions {
  delayMs?: number;
  /** Called for the first failed save in a row (e.g. storage full), not again until a save succeeds. */
  onError(error: unknown): void;
  now?: () => Date;
}

export function createAutosaver(save: (zine: Zine) => Promise<void>, options: AutosaveOptions): Autosaver {
  const delay = options.delayMs ?? AUTOSAVE_DELAY_MS;
  const now = options.now ?? (() => new Date());
  let pending: Zine | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let chain: Promise<void> = Promise.resolve();
  let failing = false;

  const run = (): Promise<void> => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    const zine = pending;
    pending = null;
    if (!zine) return chain;
    // One save at a time, in order, so an older version never lands after a newer one.
    const job = chain
      .then(() => save({ ...zine, updatedAt: now().toISOString() }))
      .then(
        () => {
          failing = false;
        },
        (error: unknown) => {
          if (!failing) options.onError(error);
          failing = true;
        },
      );
    chain = job;
    inFlight.add(job);
    void job.finally(() => inFlight.delete(job));
    return job;
  };

  return {
    schedule(zine) {
      pending = zine;
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(() => void run(), delay);
    },
    flush: run,
  };
}
