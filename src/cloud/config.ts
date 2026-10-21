/** Google ids for sign-in, the file picker and Drive, set at build time (README: "Dysk Google"). */
export interface GoogleConfig {
  clientId: string;
  apiKey: string;
  /** The Google Cloud project number: with the `drive.file` scope the picker grants access for this app. */
  appId: string;
}

/** The build's Google ids, or null when any is missing: then Ziniarz shows no Drive buttons. */
export function googleConfig(env: Partial<Record<keyof ImportMetaEnv, string>> = import.meta.env): GoogleConfig | null {
  const clientId = env.VITE_GOOGLE_CLIENT_ID?.trim();
  const apiKey = env.VITE_GOOGLE_API_KEY?.trim();
  const appId = env.VITE_GOOGLE_APP_ID?.trim();
  return clientId && apiKey && appId ? { clientId, apiKey, appId } : null;
}
