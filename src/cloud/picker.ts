import type { GoogleConfig } from './config';
import { PICKABLE_MIMES } from './driveApi';
import { CloudError } from './errors';
import { loadScript } from './scripts';

const GAPI_URL = 'https://apis.google.com/js/api.js';

/* Minimal typings of the Google Picker API (https://developers.google.com/drive/picker). */
interface DocsView {
  setMimeTypes(mimes: string): DocsView;
  setIncludeFolders(include: boolean): DocsView;
  setOwnedByMe(owned: boolean): DocsView;
  setMode(mode: unknown): DocsView;
}
interface PickerBuilder {
  setOAuthToken(token: string): PickerBuilder;
  setDeveloperKey(key: string): PickerBuilder;
  setAppId(id: string): PickerBuilder;
  setLocale(locale: string): PickerBuilder;
  setTitle(title: string): PickerBuilder;
  addView(view: DocsView): PickerBuilder;
  setCallback(callback: (data: { action: string; docs?: { id: string }[] }) => void): PickerBuilder;
  build(): { setVisible(visible: boolean): void };
}
interface PickerApi {
  DocsView: new (viewId?: unknown) => DocsView;
  PickerBuilder: new () => PickerBuilder;
  ViewId: { DOCS: unknown };
  DocsViewMode: { LIST: unknown };
  Action: { PICKED: string; CANCEL: string };
}

declare global {
  interface Window {
    gapi?: { load(name: string, options: { callback(): void; onerror(): void }): void };
  }
}

let pickerApi: Promise<PickerApi> | null = null;

function loadPicker(): Promise<PickerApi> {
  pickerApi ??= loadScript(GAPI_URL)
    .then(
      () =>
        new Promise<PickerApi>((resolve, reject) => {
          window.gapi!.load('picker', {
            callback: () => resolve((window.google as unknown as { picker: PickerApi }).picker),
            onerror: () => reject(new Error('picker')),
          });
        }),
    )
    .catch(() => {
      pickerApi = null;
      throw new CloudError('offline', 'Nie da się połączyć z Google. Sprawdź internet.');
    });
  return pickerApi;
}

/** Loads the picker ahead of a click. */
export function preparePicker(): void {
  void loadPicker().catch(() => {});
}

/** Google's file picker for zine files (own and shared); the id of the picked file, or null. */
export async function pickZinFile(config: GoogleConfig, token: string): Promise<string | null> {
  const picker = await loadPicker();
  const mimes = PICKABLE_MIMES.join(',');
  const mine = new picker.DocsView(picker.ViewId.DOCS).setMimeTypes(mimes).setIncludeFolders(true).setMode(picker.DocsViewMode.LIST);
  const shared = new picker.DocsView(picker.ViewId.DOCS).setMimeTypes(mimes).setOwnedByMe(false).setMode(picker.DocsViewMode.LIST);
  return new Promise((resolve) => {
    new picker.PickerBuilder()
      .setOAuthToken(token)
      .setDeveloperKey(config.apiKey)
      .setAppId(config.appId)
      .setLocale('pl')
      .setTitle('Wybierz zina z Dysku Google')
      .addView(mine)
      .addView(shared)
      .setCallback((data) => {
        if (data.action === picker.Action.PICKED) resolve(data.docs?.[0]?.id ?? null);
        else if (data.action === picker.Action.CANCEL) resolve(null);
      })
      .build()
      .setVisible(true);
  });
}
