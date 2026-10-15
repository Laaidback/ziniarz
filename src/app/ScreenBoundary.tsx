import { Component, Suspense, type ReactNode } from 'react';
import { LoadFailed } from './LoadFailed';

/** Catches a screen whose lazily loaded code failed to download (offline, or a newer version was deployed). */
class LoadErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return <LoadFailed message="Nie udało się wczytać tej części aplikacji. Sprawdź połączenie i odśwież stronę." />;
  }
}

/** Wraps a lazily loaded screen: "Wczytywanie…" while its code downloads, a message if that fails. */
export function ScreenBoundary({ children }: { children: ReactNode }) {
  return (
    <LoadErrorBoundary>
      <Suspense fallback={<main className="screen-message">Wczytywanie…</main>}>{children}</Suspense>
    </LoadErrorBoundary>
  );
}
