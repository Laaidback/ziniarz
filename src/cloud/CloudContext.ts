import { createContext, useContext } from 'react';
import { useStore } from 'zustand';
import { cloudAuthStore } from './authStore';
import { googleConfig } from './config';
import { createDriveClient, type DriveClient } from './driveApi';
import { createGoogleAuth, type CloudAuth } from './googleAuth';
import { pickZinFile, preparePicker } from './picker';

/** Google sign-in, Drive and the file picker; tests give a fake Drive. */
export interface CloudServices {
  auth: CloudAuth;
  drive: DriveClient;
  /** Loads Google's scripts ahead of a click on a Drive button. */
  prepare(): void;
  /** Google's picker: the id of the zine file the person chose, or null. */
  pickFile(token: string): Promise<string | null>;
  /** The file's page on Drive (where the person shares it). */
  fileUrl(fileId: string): string;
}

export const driveFileUrl = (fileId: string) => `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/view`;

export function createCloudServices(auth: CloudAuth, pickFile: CloudServices['pickFile'], fetchFn?: typeof fetch, prepare = () => auth.prepare()): CloudServices {
  const drive = createDriveClient({ token: () => auth.token(), onUnauthorized: () => auth.forget(), fetch: fetchFn });
  return { auth, drive, prepare, pickFile, fileUrl: driveFileUrl };
}

let defaultServices: CloudServices | null | undefined;

/** The real Google services when the build has Google ids, else null (no Drive buttons). */
export function defaultCloudServices(): CloudServices | null {
  if (defaultServices === undefined) {
    const config = googleConfig();
    defaultServices = config
      ? createCloudServices(createGoogleAuth(config.clientId), (token) => pickZinFile(config, token), undefined, () => {
          defaultServices?.auth.prepare();
          preparePicker();
        })
      : null;
  }
  return defaultServices;
}

export const CloudContext = createContext<CloudServices | null>(null);

/** The Drive services, or null when this build has no Google ids. */
export function useCloud(): CloudServices | null {
  return useContext(CloudContext);
}

export function useSignedIn(): boolean {
  return useStore(cloudAuthStore, (s) => s.signedIn);
}
