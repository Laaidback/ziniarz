import { expect, test } from 'vitest';
import { parseRoute, routeHash, type Route } from './route';

test('parses the four screens', () => {
  expect(parseRoute('')).toEqual({ name: 'home' });
  expect(parseRoute('#/')).toEqual({ name: 'home' });
  expect(parseRoute('#/zin/abc')).toEqual({ name: 'editor', zineId: 'abc' });
  expect(parseRoute('#/zin/abc/druk')).toEqual({ name: 'print', zineId: 'abc' });
  expect(parseRoute('#/zin/abc/3d/')).toEqual({ name: 'preview3d', zineId: 'abc' });
});

test('unknown paths go home', () => {
  expect(parseRoute('#/cokolwiek')).toEqual({ name: 'home' });
  expect(parseRoute('#/zin/abc/inne')).toEqual({ name: 'home' });
});

test('routeHash round-trips, ids are encoded', () => {
  const routes: Route[] = [
    { name: 'home' },
    { name: 'editor', zineId: 'a b' },
    { name: 'print', zineId: 'x' },
    { name: 'preview3d', zineId: 'x' },
  ];
  for (const route of routes) expect(parseRoute(routeHash(route))).toEqual(route);
  expect(routeHash({ name: 'editor', zineId: 'a b' })).toBe('#/zin/a%20b');
});
