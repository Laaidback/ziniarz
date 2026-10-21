const loading = new Map<string, Promise<void>>();

/** Loads a Google script once; a failed load is tried again next time. */
export function loadScript(src: string): Promise<void> {
  let promise = loading.get(src);
  if (!promise) {
    promise = new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        script.remove();
        loading.delete(src);
        reject(new Error(`Could not load ${src}`));
      };
      document.head.append(script);
    });
    loading.set(src, promise);
  }
  return promise;
}
