import { createStore } from 'zustand/vanilla';
import type { CloudError } from './errors';
import type { LastChange } from './sync';

/** What the list and the editor show about a zine saved on Drive. */
export type CloudState =
  | { state: 'syncing' }
  | { state: 'synced' }
  /** Changes made here wait to be sent. */
  | { state: 'pending' }
  /** Someone saved a newer version on Drive; nothing changed here. */
  | { state: 'remoteNewer' }
  | { state: 'conflict' }
  | { state: 'error'; error: CloudError };

export type ZineCloudStatus = CloudState & { change?: LastChange };

export const cloudStatusStore = createStore<{ zines: Record<string, ZineCloudStatus> }>()(() => ({ zines: {} }));

/** Sets a zine's state; the last known change (who, when) stays unless a new one is given. */
export function setCloudStatus(zineId: string, state: CloudState, change?: LastChange): void {
  cloudStatusStore.setState((s) => {
    const previous = s.zines[zineId];
    return { zines: { ...s.zines, [zineId]: { ...state, change: change ?? previous?.change } } };
  });
}

export function clearCloudStatus(zineId: string): void {
  cloudStatusStore.setState((s) => {
    const { [zineId]: _removed, ...rest } = s.zines;
    return { zines: rest };
  });
}
