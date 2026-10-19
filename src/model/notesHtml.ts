/**
 * The notepad keeps a tiny HTML subset: text, bold (<b>), highlight (<mark>), line breaks and
 * lines (<br>, <div>, <p>). Everything else is dropped: other tags (their text stays), every
 * attribute, comments, and the content of scripts, styles and similar. Works on strings (no DOM),
 * so parseZine applies it in Node too; the output is well formed and sanitizing it again changes
 * nothing. Plain text comes out escaped and its line breaks stay (the notepad shows pre-wrap).
 */

const ALLOWED: Record<string, string> = { b: 'b', strong: 'b', mark: 'mark', div: 'div', p: 'p' };
/** Elements whose content is not text to show. */
const DROPPED_WITH_CONTENT = new Set([
  'script',
  'style',
  'template',
  'iframe',
  'object',
  'embed',
  'noscript',
  'noembed',
  'noframes',
  'textarea',
  'title',
  'svg',
  'math',
  'select',
  'head',
  'xmp',
  'plaintext',
]);

// Comment | declaration or processing instruction | tag (quoted attribute values may hold '>') | text | a lone '<'.
const TOKEN = /<!--[\s\S]*?(?:-->|$)|<[!?][^>]*>?|<(\/?)([a-zA-Z][^\s/>]*)((?:[^>"']|"[^"]*"|'[^']*')*)>|[^<]+|</g;

const NAMED: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

function decodeEntities(text: string): string {
  return text.replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (whole, name: string) => {
    if (name[0] !== '#') return NAMED[name.toLowerCase()] ?? whole;
    const code = name[1] === 'x' || name[1] === 'X' ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
    return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : '';
  });
}

const escapeText = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function sanitizeNotes(html: string): string {
  let out = '';
  const open: string[] = [];
  const lower = html.toLowerCase();
  TOKEN.lastIndex = 0;
  for (let match = TOKEN.exec(html); match; match = TOKEN.exec(html)) {
    const [token, slash, rawName] = match;
    if (rawName === undefined) {
      if (token === '<') out += '&lt;';
      else if (token[0] !== '<') out += escapeText(decodeEntities(token));
      continue; // comments and declarations are dropped
    }
    const name = rawName.toLowerCase();
    if (!slash && DROPPED_WITH_CONTENT.has(name)) {
      const end = lower.indexOf(`</${name}`, TOKEN.lastIndex);
      const close = end < 0 ? -1 : html.indexOf('>', end);
      TOKEN.lastIndex = close < 0 ? html.length : close + 1;
      continue;
    }
    if (name === 'br') {
      out += '<br>';
      continue;
    }
    const tag = ALLOWED[name];
    if (!tag) continue;
    if (!slash) {
      open.push(tag);
      out += `<${tag}>`;
      continue;
    }
    const at = open.lastIndexOf(tag);
    if (at < 0) continue; // a closing tag nothing opened
    while (open.length > at) out += `</${open.pop()}>`;
  }
  while (open.length) out += `</${open.pop()}>`;
  return out;
}
