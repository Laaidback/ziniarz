import { useLayoutEffect, useRef } from 'react';
import { konvaFontFamily } from '../../fonts/fontLoader';
import { textStyleMm } from '../../render/buildSpread';
import { useEditor, useEditorEnv } from '../EditorContext';
import { selectedElement } from '../state/store';
import type { Viewport } from './EditorStage';

/**
 * In-place text editing: a transparent textarea over the frame, styled with the same mm metrics
 * as the renderer (textStyleMm). The canvas hides the text node meanwhile. Escape, Cmd+Enter or
 * clicking elsewhere ends editing; an empty text frame is removed.
 */
export function TextEditor({ viewport }: { viewport: Viewport }) {
  const { store } = useEditorEnv();
  const element = useEditor(selectedElement);
  const area = useRef<HTMLTextAreaElement>(null);
  const text = element?.kind === 'text' ? element : null;

  useLayoutEffect(() => {
    area.current?.focus();
    area.current?.select();
  }, [text?.id]);

  useLayoutEffect(() => {
    const node = area.current;
    if (!node) return;
    node.style.height = '0px';
    node.style.height = `${node.scrollHeight}px`;
  });

  if (!text) return null;

  const finish = () => {
    const state = store.getState();
    if (state.mode !== 'text') return;
    const current = selectedElement(state);
    if (current?.kind === 'text' && current.text.trim() === '') state.deleteSelected();
    store.getState().setMode('idle');
  };

  const { scale, originX, originY } = viewport;
  const style = textStyleMm(text);
  return (
    <textarea
      ref={area}
      className="text-editor"
      aria-label="Treść napisu"
      spellCheck={false}
      value={text.text}
      onChange={(event) => store.getState().updateElement(text.id, { text: event.target.value }, `text:${text.id}`)}
      onKeyDown={(event) => {
        if (event.key === 'Escape' || (event.key === 'Enter' && (event.metaKey || event.ctrlKey))) {
          event.preventDefault();
          finish();
        }
      }}
      onBlur={finish}
      style={{
        left: originX + text.x * scale,
        top: originY + text.y * scale,
        width: text.width * scale,
        transform: `rotate(${text.rotation}deg)`,
        fontFamily: konvaFontFamily(text.fontFamilyId),
        fontSize: style.fontSize * scale,
        fontWeight: text.bold ? 700 : 400,
        fontStyle: text.italic ? 'italic' : 'normal',
        letterSpacing: style.letterSpacing * scale,
        lineHeight: style.lineHeight,
        color: text.color,
        textAlign: text.align,
      }}
    />
  );
}
