import { setSignedIn } from '../cloud/authStore';
import { createCloudServices, type CloudServices } from '../cloud/CloudContext';
import type { CloudAuth } from '../cloud/googleAuth';
import type { FakeDriveServer } from './fakeDriveServer';

/**
 * Drive services for one person on a fake Drive server: signing in always works at once, and the
 * picker returns the files in `picks` (in order; then null, like closing the picker), giving the
 * person access as Google's picker does.
 */
export function fakeCloud(server: FakeDriveServer, user: string, options: { signedIn?: boolean } = {}) {
  let token: string | null = options.signedIn === false ? null : user;
  const signIns = { count: 0 };
  const auth: CloudAuth = {
    token: () => token,
    prepare() {},
    async signIn() {
      signIns.count++;
      token = user;
      setSignedIn(true);
      return user;
    },
    forget() {
      token = null;
      setSignedIn(false);
    },
  };
  setSignedIn(token !== null);
  const picks: string[] = [];
  const services: CloudServices = createCloudServices(
    auth,
    async () => {
      const id = picks.shift() ?? null;
      if (id) server.pick(id, user);
      return id;
    },
    server.fetch,
  );
  return { services, picks, signIns };
}
