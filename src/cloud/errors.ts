export type CloudErrorKind = 'offline' | 'auth' | 'cancelled' | 'notFound' | 'forbidden' | 'quota' | 'other';

const MESSAGES: Record<CloudErrorKind, string> = {
  offline: 'Brak internetu. Zapiszę na Dysku później.',
  auth: 'Zaloguj się do Google, żeby zapisać na Dysku.',
  cancelled: 'Logowanie do Google przerwane.',
  notFound: 'Tego pliku nie ma już na Dysku Google.',
  forbidden: 'Nie masz prawa zmieniać tego pliku na Dysku. Zmiany zostają w przeglądarce.',
  quota: 'Na Dysku Google brakuje miejsca.',
  other: 'Dysk Google nie odpowiada. Spróbuję później.',
};

/** A Google sign-in or Drive failure; the message is a Polish sentence for the user. */
export class CloudError extends Error {
  readonly kind: CloudErrorKind;
  constructor(kind: CloudErrorKind, message = MESSAGES[kind]) {
    super(message);
    this.name = 'CloudError';
    this.kind = kind;
  }
}

/** Errors whose message is already a Polish sentence (a full browser, a broken zine file). */
const USER_FACING = new Set(['StorageFullError', 'ZinFileError', 'ZineFormatError']);

export function cloudErrorOf(error: unknown): CloudError {
  if (error instanceof CloudError) return error;
  if (error instanceof Error && USER_FACING.has(error.name)) return new CloudError('other', error.message);
  return new CloudError('other');
}
