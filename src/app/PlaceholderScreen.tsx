import { routeHash } from './route';

/** Screens that later plans build (print, 3D preview). */
export function PlaceholderScreen({ title, zineId }: { title: string; zineId: string }) {
  return (
    <main className="screen-message">
      <h1>{title}</h1>
      <p>Ten ekran jeszcze powstaje.</p>
      <a className="link-button" href={routeHash({ name: 'editor', zineId })}>
        Wróć do edytora
      </a>
    </main>
  );
}
