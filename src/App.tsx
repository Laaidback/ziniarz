import { useEffect, useState } from 'react';
import { ConfirmHost } from './app/ConfirmHost';
import { DbContext } from './app/dbContext';
import { NoticeList } from './app/NoticeList';
import { PlaceholderScreen } from './app/PlaceholderScreen';
import type { Route } from './app/route';
import { useRoute } from './app/useRoute';
import { EditorScreen } from './editor/EditorScreen';
import { HomeScreen } from './home/HomeScreen';
import { PrintScreen } from './print/screen/PrintScreen';
import { openZiniarzDb, type ZiniarzDb } from './storage/db';
import { requestPersistentStorage } from './storage/quota';

function Screen({ route }: { route: Route }) {
  switch (route.name) {
    case 'home':
      return <HomeScreen />;
    case 'editor':
      return <EditorScreen key={route.zineId} zineId={route.zineId} />;
    case 'print':
      return <PrintScreen key={route.zineId} zineId={route.zineId} />;
    case 'preview3d':
      return <PlaceholderScreen title="Podgląd 3D" zineId={route.zineId} />;
  }
}

export function App() {
  const route = useRoute();
  const [db, setDb] = useState<ZiniarzDb | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    openZiniarzDb().then(setDb, () => setFailed(true));
    void requestPersistentStorage();
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
      <Screen route={route} />
      <NoticeList />
      <ConfirmHost />
    </DbContext.Provider>
  );
}
