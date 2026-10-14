import { useEffect, useState } from 'react';
import { askConfirm } from '../app/confirm';
import { useDb } from '../app/dbContext';
import { errorMessage, notify } from '../app/notices';
import { countOf } from '../app/plural';
import { routeHash } from '../app/route';
import type { Zine } from '../model/types';
import { renderCoverThumbnail } from './coverThumbnail';
import { downloadBlob } from './download';
import { duplicateZine, exportZinFile, removeZine } from './homeActions';

export function ZineCard({ zine, onChanged }: { zine: Zine; onChanged(): void }) {
  const db = useDb();
  const [cover, setCover] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    renderCoverThumbnail(db, zine).then(
      (url) => !cancelled && setCover(url),
      () => {}, // a missing cover is not worth a message
    );
    return () => {
      cancelled = true;
    };
  }, [db, zine]);

  const run = (action: () => Promise<unknown>) => () =>
    action().then(onChanged, (error: unknown) => notify(errorMessage(error)));

  const remove = async () => {
    if (await askConfirm(`Usunąć zin „${zine.title}”? Tego nie da się cofnąć.`)) await removeZine(db, zine.id);
  };

  const save = async () => {
    const file = await exportZinFile(db, zine);
    downloadBlob(file.name, file.blob);
  };

  const pages = 4 * zine.sheets;
  return (
    <li className="zine-card">
      <a className="zine-cover" href={routeHash({ name: 'editor', zineId: zine.id })} aria-label={`Otwórz ${zine.title}`}>
        {cover ? <img src={cover} alt="" /> : <span className="zine-cover-empty" />}
      </a>
      <h2>{zine.title}</h2>
      <p className="muted">
        {countOf(zine.sheets, 'kartka', 'kartki', 'kartek')} · {countOf(pages, 'strona', 'strony', 'stron')}
      </p>
      <div className="zine-card-buttons">
        <a className="link-button primary" href={routeHash({ name: 'editor', zineId: zine.id })}>
          Otwórz
        </a>
        <button type="button" onClick={run(() => duplicateZine(db, zine))}>
          Powiel
        </button>
        <button type="button" onClick={run(save)}>
          Zapisz plik .zin
        </button>
        <button type="button" className="danger" onClick={run(remove)}>
          Usuń
        </button>
      </div>
    </li>
  );
}
