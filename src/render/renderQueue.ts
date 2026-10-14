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
  const waiting: RenderJob[] = [];
  let running = false;
  let idleWaiters: (() => void)[] = [];

  const settle = () => {
    for (const resolve of idleWaiters) resolve();
    idleWaiters = [];
  };

  const pump = () => {
    const job = waiting.shift();
    if (!job) {
      running = false;
      settle();
      return;
    }
    void (async () => {
      try {
        await job();
      } catch {
        // see the doc comment
      }
      setTimeout(pump, 0);
    })();
  };

  return {
    add(job) {
      waiting.push(job);
      if (!running) {
        running = true;
        setTimeout(pump, 0);
      }
      return () => {
        const index = waiting.indexOf(job);
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
