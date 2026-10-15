/**
 * Calls `callback` when the page may be closed or frozen without warning (tab hidden, page left),
 * so pending autosaves can be written at once. Returns the function that stops listening.
 */
export function onPageHide(callback: () => void): () => void {
  const whenHidden = () => document.visibilityState === 'hidden' && callback();
  window.addEventListener('pagehide', callback);
  document.addEventListener('visibilitychange', whenHidden);
  return () => {
    window.removeEventListener('pagehide', callback);
    document.removeEventListener('visibilitychange', whenHidden);
  };
}
