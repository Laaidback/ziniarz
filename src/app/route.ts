export type Route =
  | { name: 'home' }
  | { name: 'editor'; zineId: string }
  | { name: 'print'; zineId: string }
  | { name: 'preview3d'; zineId: string };

/** Hash routes, because GitHub Pages serves the app from a sub-path with no server routing. */
export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#/, '');
  const match = /^\/zin\/([^/]+)(?:\/(druk|3d))?\/?$/.exec(path);
  if (!match) return { name: 'home' };
  let zineId: string;
  try {
    zineId = decodeURIComponent(match[1]);
  } catch {
    return { name: 'home' }; // a mistyped `%` in the address
  }
  if (match[2] === 'druk') return { name: 'print', zineId };
  if (match[2] === '3d') return { name: 'preview3d', zineId };
  return { name: 'editor', zineId };
}

export function routeHash(route: Route): string {
  if (route.name === 'home') return '#/';
  const base = `#/zin/${encodeURIComponent(route.zineId)}`;
  if (route.name === 'print') return `${base}/druk`;
  if (route.name === 'preview3d') return `${base}/3d`;
  return base;
}

export function navigate(route: Route): void {
  window.location.hash = routeHash(route);
}
