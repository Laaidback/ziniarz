/**
 * Formatting in the notepad (a contentEditable element). Bold goes through execCommand, so the
 * browser's undo covers it; highlight wraps text in <mark> by hand, because hiliteColor would write
 * inline styles, which the stored notes do not keep (model/notesHtml.ts).
 */

/** The selection's range when it lies inside `root`. */
export function rangeIn(root: HTMLElement): Range | null {
  const selection = document.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  return root.contains(range.commonAncestorContainer) ? range : null;
}

/** Plain text of the selection inside `root` (line breaks kept), or ''. */
export function selectedText(root: HTMLElement): string {
  const range = rangeIn(root);
  return range && !range.collapsed ? (document.getSelection()?.toString() ?? '') : '';
}

function markAround(node: Node, root: HTMLElement): HTMLElement | null {
  for (let n = node.parentNode; n && n !== root; n = n.parentNode) {
    if (n.nodeName === 'MARK') return n as HTMLElement;
  }
  return null;
}

/** Text nodes with at least one selected character. */
function selectedTextNodes(root: HTMLElement, range: Range): Text[] {
  const nodes: Text[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
    if (!node.data || !range.intersectsNode(node)) continue;
    if (node === range.startContainer && range.startOffset >= node.length) continue;
    if (node === range.endContainer && range.endOffset === 0) continue;
    nodes.push(node);
  }
  return nodes;
}

/** Whether every selected character is highlighted. */
export function selectionMarked(root: HTMLElement): boolean {
  const range = rangeIn(root);
  if (!range || range.collapsed) return false;
  const nodes = selectedTextNodes(root, range);
  return nodes.length > 0 && nodes.every((node) => markAround(node, root));
}

/** Moves `node` out of `mark`: what lies before and after it stays highlighted in marks of its own. */
function unmark(mark: HTMLElement, node: Node): void {
  const part = document.createRange();
  const keep = (fragment: DocumentFragment, where: 'before' | 'after') => {
    if (!fragment.textContent && !fragment.querySelector('br')) return;
    const copy = document.createElement('mark');
    copy.append(fragment);
    if (where === 'before') mark.before(copy);
    else mark.after(copy);
  };
  part.setStart(mark, 0);
  part.setEndBefore(node);
  keep(part.extractContents(), 'before');
  part.setStartAfter(node);
  part.setEnd(mark, mark.childNodes.length);
  keep(part.extractContents(), 'after');
  mark.replaceWith(...mark.childNodes);
}

/** Joins neighbouring marks and removes empty ones. */
function tidyMarks(root: HTMLElement): void {
  for (const mark of root.querySelectorAll('mark')) {
    if (!mark.isConnected) continue;
    if (!mark.textContent && !mark.querySelector('br')) {
      mark.replaceWith(...mark.childNodes);
      continue;
    }
    while (mark.nextSibling?.nodeName === 'MARK') {
      const next = mark.nextSibling as HTMLElement;
      mark.append(...next.childNodes);
      next.remove();
    }
  }
}

/** Highlights the selected text, or removes the highlight when all of it is highlighted already. */
export function toggleMark(root: HTMLElement): void {
  const range = rangeIn(root);
  if (!range || range.collapsed) return;
  let { startContainer, startOffset, endContainer, endOffset } = range;
  // Split the end first: the start node keeps its offsets.
  if (endContainer instanceof Text && endOffset > 0 && endOffset < endContainer.length) endContainer.splitText(endOffset);
  if (startContainer instanceof Text && startOffset > 0 && startOffset < startContainer.length) {
    const rest = startContainer.splitText(startOffset);
    if (endContainer === startContainer) {
      endContainer = rest;
      endOffset -= startOffset;
    }
    startContainer = rest;
    startOffset = 0;
  }
  const exact = document.createRange();
  exact.setStart(startContainer, startOffset);
  exact.setEnd(endContainer, endOffset);
  const nodes = selectedTextNodes(root, exact);
  if (nodes.length === 0) return;

  if (nodes.every((node) => markAround(node, root))) {
    for (const node of nodes) {
      for (let mark = markAround(node, root); mark; mark = markAround(node, root)) unmark(mark, node);
    }
  } else {
    for (const node of nodes) {
      if (markAround(node, root)) continue;
      const mark = document.createElement('mark');
      node.before(mark);
      mark.append(node);
    }
  }
  tidyMarks(root);

  const last = nodes[nodes.length - 1];
  const selected = document.createRange();
  selected.setStart(nodes[0], 0);
  selected.setEnd(last, last.length);
  const selection = document.getSelection()!;
  selection.removeAllRanges();
  selection.addRange(selected);
}

/** Bold on or off for the selection, as <b> (not inline styles). */
export function toggleBold(): void {
  document.execCommand('styleWithCSS', false, 'false');
  document.execCommand('bold');
}

export function selectionBold(root: HTMLElement): boolean {
  return rangeIn(root) !== null && document.queryCommandState('bold');
}

/** Pastes plain text only, through the browser's editing so its undo covers it. */
export function insertPlainText(text: string): void {
  document.execCommand('insertText', false, text);
}
