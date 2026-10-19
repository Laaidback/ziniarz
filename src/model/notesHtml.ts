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

const NAMED: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

function decodeEntities(text: string): string {
  return text.replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (whole, name: string) => {
    if (name[0] !== '#') return NAMED[name.toLowerCase()] ?? whole;
    const code = name[1] === 'x' || name[1] === 'X' ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
    return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : '';
  });
}

const escapeText = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Longest notes kept per section (characters of HTML); longer input is cut, never refused. */
export const MAX_NOTES_LENGTH = 200_000;

const isNameStart = (c: string | undefined) => c !== undefined && /[a-zA-Z]/.test(c);
const endsName = (c: string) => c === '>' || c === '/' || /\s/.test(c);

/** Where the content of a dropped element ends: after its closing tag (any case), or the end of the text. */
function afterClosingTag(html: string, name: string, from: number): number {
  const closing = new RegExp(`</${name}(?=[\\s/>])`, 'gi'); // names come from DROPPED_WITH_CONTENT
  closing.lastIndex = from;
  const match = closing.exec(html);
  if (!match) return html.length;
  const end = html.indexOf('>', match.index);
  return end < 0 ? html.length : end + 1;
}

/**
 * One pass over the text, so even hostile input (a .zin from someone else) takes linear time: on '<'
 * the tag is read up to its '>' (quoted attribute values may hold '>'); a tag that never closes
 * leaves the rest as text.
 */
export function sanitizeNotes(input: string): string {
  const html = input.length > MAX_NOTES_LENGTH ? input.slice(0, MAX_NOTES_LENGTH) : input;
  const text = (from: number, to: number) => escapeText(decodeEntities(html.slice(from, to)));
  let out = '';
  const open: string[] = [];
  let i = 0;
  while (i < html.length) {
    const lt = html.indexOf('<', i);
    if (lt < 0) {
      out += text(i, html.length);
      break;
    }
    out += text(i, lt);
    if (html.startsWith('<!--', lt)) {
      const end = html.indexOf('-->', lt + 4);
      i = end < 0 ? html.length : end + 3; // comments are dropped
      continue;
    }
    if (html[lt + 1] === '!' || html[lt + 1] === '?') {
      const end = html.indexOf('>', lt + 2);
      i = end < 0 ? html.length : end + 1; // declarations and processing instructions too
      continue;
    }
    const slash = html[lt + 1] === '/';
    let j = slash ? lt + 2 : lt + 1;
    if (!isNameStart(html[j])) {
      out += '&lt;'; // a lone '<'
      i = lt + 1;
      continue;
    }
    const nameStart = j;
    while (j < html.length && !endsName(html[j])) j++;
    const name = html.slice(nameStart, j).toLowerCase();
    let quote: string | null = null;
    for (; j < html.length; j++) {
      const c = html[j];
      if (quote) {
        if (c === quote) quote = null;
      } else if (c === '"' || c === "'") quote = c;
      else if (c === '>') break;
    }
    if (j >= html.length) {
      out += text(lt, html.length); // never closed: the rest is text
      break;
    }
    i = j + 1;
    if (!slash && DROPPED_WITH_CONTENT.has(name)) {
      i = afterClosingTag(html, name, i);
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
