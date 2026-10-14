import { describe, expect, it } from 'vitest';
import { findMissingFiles, findProblems, referencesIn } from '../../scripts/checkDist.mjs';

describe('referencesIn', () => {
  it('reads html attributes, css url() and import.meta.url assets, skipping external and data URLs', () => {
    expect(
      referencesIn('index.html', '<script src="./assets/a.js"></script><a href="https://example.com/">x</a>'),
    ).toEqual([['./assets/a.js', 'html']]);
    expect(referencesIn('assets/a.css', 'a{background:url("./f.woff2")} b{background:url(data:image/png;base64,AA)}')).toEqual([
      ['./f.woff2', 'css'],
    ]);
    expect(referencesIn('assets/a.js', 'new URL("f.woff2",import.meta.url)')).toEqual([['f.woff2', 'js']]);
  });
});

describe('findProblems', () => {
  it('accepts a fully relative build', () => {
    expect(
      findProblems({
        'index.html': '<script type="module" src="./assets/index.js"></script><link href="./assets/index.css">',
        'assets/index.css': 'a{background:url(./logo.png)}',
        'assets/index.js': 'const f=new URL("inter.woff2",import.meta.url);',
      }),
    ).toEqual([]);
  });

  it('reports root-absolute URLs in html, css and js', () => {
    const problems = findProblems({
      'index.html': '<script src="/assets/index.js"></script>',
      'assets/index.css': 'a{background:url(/assets/f.woff2)}',
      'assets/index.js': 'import("/assets/chunk.js")',
    });
    expect(problems).toHaveLength(3);
  });
});

describe('findMissingFiles', () => {
  it('resolves references next to the file that contains them', () => {
    const files = {
      'index.html': '<script src="./assets/index.js"></script>',
      'assets/index.js': 'new URL("inter.woff2",import.meta.url)',
    };
    expect(findMissingFiles(files, (p) => p === 'assets/index.js' || p === 'assets/inter.woff2')).toEqual([]);
    expect(findMissingFiles(files, (p) => p === 'assets/index.js')).toEqual([
      'assets/index.js: "inter.woff2" -> assets/inter.woff2 not found',
    ]);
  });
});
