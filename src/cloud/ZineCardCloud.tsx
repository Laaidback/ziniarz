import { askConfirm } from '../app/confirm';
import { useDb } from '../app/dbContext';
import { notify } from '../app/notices';
import type { Zine } from '../model/types';
import type { DriveLink } from '../storage/db';
import { chooseVersion, signInFromClick } from './cloudActions';
import { useCloud } from './CloudContext';
import { cloudStatusStore } from './cloudStatus';
import { linkToDrive, relinkAsNew, syncZine, unlinkFromDrive } from './cloudSync';
import { CloudStatusLine } from './CloudStatusLine';
import { cloudErrorOf } from './errors';
import type { CloudStatusAction } from './statusText';

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
    } else if (action === 'choose') {
      const change = cloudStatusStore.getState().zines[zine.id]?.change;
      if (change) await chooseVersion(db, cloud, zine.id, zine.title, change);
    } else {
      const result = await syncZine(db, cloud.drive, zine.id, { allowDownload: true });
      if (result.kind === 'conflict') await chooseVersion(db, cloud, zine.id, zine.title, result.change);
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
