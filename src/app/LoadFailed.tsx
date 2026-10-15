import { routeHash } from './route';

/** A screen whose zine could not be opened: the reason and a way back to the list. */
export function LoadFailed({ message }: { message: string }) {
  return (
    <main className="screen-message">
      <p>{message}</p>
      <a className="link-button" href={routeHash({ name: 'home' })}>
        Wróć do listy zinów
      </a>
    </main>
  );
}
