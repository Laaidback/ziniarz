export type RenderJob = () => void | Promise<void>;

export interface RenderQueue {
  /** Queues a job; the returned function drops it if it has not started yet. */
  add(job: RenderJob): () => void;
  /** Drops every job that has not started. */
  clear(): void;
  /** Resolves when the queue is empty and nothing runs. */
  idle(): Promise<void>;
}

/**
 * Runs rendering jobs one at a time, giving the browser a turn (setTimeout 0) before
 * each, so previews drawn in the background never freeze clicks and typing.
 * A failing job is skipped; it must show its own fallback.
 */
export function createRenderQueue(): RenderQueue {
  // Each queued job gets its own entry so cancelling never mistakes one for another.
  const waiting: { job: RenderJob }[] = [];
  let running = false;
  let idleWaiters: (() => void)[] = [];

  const settle = () => {
    for (const resolve of idleWaiters) resolve();
    idleWaiters = [];
  };

  const pump = () => {
    const entry = waiting.shift();
    if (!entry) {
      running = false;
      settle();
      return;
    }
    void (async () => {
      try {
        await entry.job();
      } catch (e) {
        console.error(e);
      }
      setTimeout(pump, 0);
    })();
  };

  return {
    add(job) {
      const entry = { job };
      waiting.push(entry);
      if (!running) {
        running = true;
        setTimeout(pump, 0);
      }
      return () => {
        const index = waiting.indexOf(entry);
        if (index >= 0) waiting.splice(index, 1);
      };
    },
    clear() {
      waiting.length = 0;
    },
    idle() {
      if (!running) return Promise.resolve();
      return new Promise((resolve) => idleWaiters.push(resolve));
    },
  };
}
