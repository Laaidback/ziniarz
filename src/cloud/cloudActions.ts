import { notify } from '../app/notices';
import type { ZiniarzDb } from '../storage/db';
import type { CloudServices } from './CloudContext';
import { resolveConflict, type ConflictChoice, type SyncResult } from './cloudSync';
import { askConflict } from './conflict';
import { cloudErrorOf } from './errors';
import type { LastChange } from './sync';

/** Signs in (from a click); tells the person when it did not work. Returns whether there is a token now. */
export async function signInFromClick(cloud: CloudServices): Promise<boolean> {
  try {
    await cloud.auth.signIn();
    return true;
  } catch (error) {
    notify(cloudErrorOf(error).message);
    return false;
  }
}

/**
 * Applies the answer to a conflict and tells the person where a copy went or what failed.
 * "theirs" and "copy" download into the zine: never call them with the zine open in an editor.
 */
export async function applyChoice(
  db: ZiniarzDb,
  cloud: CloudServices,
  zineId: string,
  title: string,
  choice: ConflictChoice,
): Promise<SyncResult> {
  const { result, copyId } = await resolveConflict(db, cloud.drive, zineId, choice);
  if (copyId) notify(`Twoja wersja jest na liście zinów jako „${title} (kopia)”.`);
  if (result.kind === 'failed') notify(result.error.message);
  return result;
}

/** Asks which version to keep and applies the answer; null when the person chose "not now". Same caution. */
export async function chooseVersion(
  db: ZiniarzDb,
  cloud: CloudServices,
  zineId: string,
  title: string,
  change: LastChange,
): Promise<SyncResult | null> {
  const choice = await askConflict(title, change);
  return choice && applyChoice(db, cloud, zineId, title, choice);
}
