import 'vitest';

declare module 'vitest' {
  /** Values vite.config.ts hands to the tests (`test.provide`), read with `inject`. */
  export interface ProvidedContext {
    /** UPDATE_REFERENCES=1: the render reference test writes new reference PNGs instead of comparing. */
    updateReferences: boolean;
    /** CI is set and REFERENCE_STRICT is not 1: the render reference test is skipped (informational in CI). */
    skipReferences: boolean;
  }
}
