import { lazy, useEffect, useState } from 'react';
import { ConfirmHost } from './app/ConfirmHost';
import { CloudContext, defaultCloudServices } from './cloud/CloudContext';
import { ConflictHost } from './cloud/ConflictHost';
import { DbContext } from './app/dbContext';
import { NoticeList } from './app/NoticeList';
import { routeHash, type Route } from './app/route';
import { ScreenBoundary } from './app/ScreenBoundary';
import { useRoute } from './app/useRoute';
import { HomeScreen } from './home/HomeScreen';
import { Preview3dScreen } from './preview3d/Preview3dScreen';
import { openZiniarzDb, type ZiniarzDb } from './storage/db';
import { persistentStorage } from './storage/quota';

// The editor and the print screen (with pdf-lib) download on first use, keeping the first load small.
const EditorScreen = lazy(() => import('./editor/EditorScreen').then((m) => ({ default: m.EditorScreen })));
const PrintScreen = lazy(() => import('./print/screen/PrintScreen').then((m) => ({ default: m.PrintScreen })));

function Screen({ route }: { route: Route }) {
  switch (route.name) {
    case 'home':
      return <HomeScreen />;
    case 'editor':
      return <EditorScreen key={route.zineId} zineId={route.zineId} />;
    case 'print':
      return <PrintScreen key={route.zineId} zineId={route.zineId} />;
    case 'preview3d':
      return <Preview3dScreen key={route.zineId} zineId={route.zineId} />;
  }
}

export function App() {
  const route = useRoute();
  const [db, setDb] = useState<ZiniarzDb | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    openZiniarzDb().then(setDb, () => setFailed(true));
    void persistentStorage();
  }, []);

  if (failed) {
    return (
      <main className="screen-message">
        Ta przeglądarka nie pozwala zapisywać zinów. Wyłącz tryb prywatny albo użyj innej przeglądarki.
      </main>
    );
  }
  if (!db) return <main className="screen-message">Wczytywanie…</main>;
  return (
    <DbContext.Provider value={db}>
      <CloudContext.Provider value={defaultCloudServices()}>
        <ScreenBoundary key={routeHash(route)}>
          <Screen route={route} />
        </ScreenBoundary>
        <NoticeList />
        <ConfirmHost />
        <ConflictHost />
      </CloudContext.Provider>
    </DbContext.Provider>
  );
}
