// Checks that a production build can be served from any sub-path, as GitHub Pages does
// (https://user.github.io/repo/). Vite is configured with `base: './'`, so every URL in the
// output must be relative. Pure functions are exported for tests; the CLI is at the bottom.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, posix, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/** A URL that points at the server root (or another origin-relative place) instead of next to the file. */
function isRootAbsolute(url) {
  return url.startsWith('/') && !url.startsWith('//');
}

function isLocal(url) {
  return !/^(?:[a-z][a-z0-9+.-]*:|\/\/|#|data:)/i.test(url);
}

/**
 * Relative asset references found in one built file: `[url, kind]` pairs.
 * html: src/href attributes; css: url(...); js: new URL("...", import.meta.url).
 */
export function referencesIn(fileName, text) {
  const found = [];
  const add = (re, kind) => {
    for (const m of text.matchAll(re)) found.push([m[1], kind]);
  };
  if (fileName.endsWith('.html')) {
    add(/\b(?:src|href)\s*=\s*["']([^"']+)["']/g, 'html');
  } else if (fileName.endsWith('.css')) {
    add(/url\(\s*["']?([^"')]+?)["']?\s*\)/g, 'css');
  } else if (fileName.endsWith('.js')) {
    add(/new URL\(\s*["'`]([^"'`]+)["'`]\s*,\s*import\.meta\.url/g, 'js');
  }
  return found.filter(([url]) => isLocal(url) || isRootAbsolute(url));
}

/** Problems that would break the app under a sub-path. `files` maps a path inside dist to its text. */
export function findProblems(files) {
  const problems = [];
  for (const [name, text] of Object.entries(files)) {
    for (const [url] of referencesIn(name, text)) {
      if (isRootAbsolute(url)) problems.push(`${name}: absolute URL "${url}" (use a relative one)`);
    }
    if (name.endsWith('.js')) {
      for (const m of text.matchAll(/["'`](\/assets\/[^"'`]*)["'`]/g)) {
        problems.push(`${name}: hard-coded "${m[1]}"`);
      }
    }
  }
  return problems;
}

/** Local files that a build file points at but that are missing from dist. */
export function findMissingFiles(files, exists) {
  const missing = [];
  for (const [name, text] of Object.entries(files)) {
    for (const [url] of referencesIn(name, text)) {
      if (isRootAbsolute(url)) continue;
      const target = posix.normalize(posix.join(posix.dirname(name), url.split(/[?#]/)[0]));
      if (!exists(target)) missing.push(`${name}: "${url}" -> ${target} not found`);
    }
  }
  return missing;
}

function readTextFiles(dir) {
  const files = {};
  const walk = (current) => {
    for (const entry of readdirSync(current)) {
      const full = join(current, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(html|css|js)$/.test(entry)) {
        files[relative(dir, full).split(sep).join('/')] = readFileSync(full, 'utf8');
      }
    }
  };
  walk(dir);
  return files;
}

function main() {
  const dist = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
  if (!existsSync(join(dist, 'index.html'))) {
    console.error('dist/index.html not found. Run "npm run build" first.');
    process.exit(1);
  }
  const files = readTextFiles(dist);
  const problems = [...findProblems(files), ...findMissingFiles(files, (p) => existsSync(join(dist, p)))];
  if (problems.length > 0) {
    console.error(`check:dist found ${problems.length} problem(s):\n${problems.map((p) => `  ${p}`).join('\n')}`);
    process.exit(1);
  }
  console.log(`check:dist OK: ${Object.keys(files).length} files, all URLs relative and present.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
