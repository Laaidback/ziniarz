import { askConfirm } from '../app/confirm';
import { useDb } from '../app/dbContext';
import { notify } from '../app/notices';
import type { Zine } from '../model/types';
import type { DriveLink } from '../storage/db';
import { whenNoZineIsOpen } from '../storage/zineLock';
import { applyChoice, signInFromClick } from './cloudActions';
import { useCloud } from './CloudContext';
import { cloudStatusStore } from './cloudStatus';
import { linkToDrive, relinkAsNew, syncZine, unlinkFromDrive } from './cloudSync';
import { askConflict } from './conflict';
import { CloudStatusLine } from './CloudStatusLine';
import { cloudErrorOf } from './errors';
import type { CloudStatusAction } from './statusText';
import type { LastChange } from './sync';

const OPEN_ELSEWHERE = 'Ten zin jest otwarty w innej karcie. Zamknij go tam i spróbuj jeszcze raz.';

/** Google Drive on a zine card: save to Drive, or the status with "show on Drive" and "unlink". */
export function ZineCardCloud({ zine, link, onChanged }: { zine: Zine; link: DriveLink | undefined; onChanged(): void }) {
  const db = useDb();
  const cloud = useCloud();
  if (!cloud) return null;

  const save = async () => {
    if (!(await signInFromClick(cloud))) return;
    try {
      await linkToDrive(db, cloud.drive, zine.id);
      notify(`Zin „${zine.title}” jest na Dysku Google. Udostępnisz go przyciskiem „Pokaż na Dysku”.`);
    } catch (error) {
      notify(cloudErrorOf(error).message);
    }
    onChanged();
  };

  if (!link) {
    return (
      <button type="button" onPointerEnter={cloud.prepare} onFocus={cloud.prepare} onClick={() => void save()}>
        Zapisz na Dysku Google
      </button>
    );
  }

  /** Downloads only while no tab has a zine open: an editor there would save its older copy over it. */
  const download = async (work: () => Promise<unknown>) => {
    if (!(await whenNoZineIsOpen(db.name, work))) notify(OPEN_ELSEWHERE);
  };

  const choose = async (change: LastChange) => {
    const choice = await askConflict(zine.title, change);
    if (choice === 'mine') await applyChoice(db, cloud, zine.id, zine.title, 'mine');
    else if (choice) await download(() => applyChoice(db, cloud, zine.id, zine.title, choice));
  };

  const act = async (action: CloudStatusAction) => {
    if (action === 'signIn') {
      await signInFromClick(cloud);
      return;
    }
    if (action === 'relink') {
      try {
        await relinkAsNew(db, cloud.drive, zine.id);
      } catch (error) {
        notify(cloudErrorOf(error).message);
      }
    } else {
      const known = action === 'choose' ? cloudStatusStore.getState().zines[zine.id]?.change : undefined;
      const result = known ? ({ kind: 'conflict', change: known } as const) : await syncZine(db, cloud.drive, zine.id, { allowDownload: false });
      if (result.kind === 'conflict') await choose(result.change);
      else if (result.kind === 'remoteNewer') await download(() => syncZine(db, cloud.drive, zine.id, { allowDownload: true }));
    }
    onChanged();
  };

  const unlink = async () => {
    const ok = await askConfirm(
      `Odłączyć „${zine.title}” od Dysku Google? Zin zostanie w tej przeglądarce, a plik na Dysku bez zmian.`,
      'Odłącz',
    );
    if (!ok) return;
    await unlinkFromDrive(db, zine.id);
    onChanged();
  };

  return (
    <>
      <CloudStatusLine zineId={zine.id} onAction={(action) => void act(action)} />
      <a className="link-button" href={cloud.fileUrl(link.fileId)} target="_blank" rel="noopener noreferrer">
        Pokaż na Dysku
      </a>
      <button type="button" onClick={() => void unlink()}>
        Odłącz od Dysku
      </button>
    </>
  );
}
