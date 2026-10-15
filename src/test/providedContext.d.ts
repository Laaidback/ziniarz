import 'vitest';

declare module 'vitest' {
  /** Values vite.config.ts hands to the tests (`test.provide`), read with `inject`. */
  export interface ProvidedContext {
    /** UPDATE_REFERENCES=1: the render reference test writes new reference PNGs instead of comparing. */
    updateReferences: boolean;
  }
}
