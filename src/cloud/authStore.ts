import { createStore } from 'zustand/vanilla';

/** Whether a Google token is at hand, so screens can sync after signing in and ask to sign in when it expires. */
export const cloudAuthStore = createStore<{ signedIn: boolean }>()(() => ({ signedIn: false }));

export function setSignedIn(signedIn: boolean): void {
  if (cloudAuthStore.getState().signedIn !== signedIn) cloudAuthStore.setState({ signedIn });
}
