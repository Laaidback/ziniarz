import { useEffect, useRef, useState } from 'react';
import { loadSpreadFonts } from '../../fonts/fontLoader';
import { useFontsVersion } from '../../fonts/useFontsVersion';
import { useEditor, useEditorEnv } from '../EditorContext';
import { pageAtPoint } from '../geometry/placement';
import { usePhotoInsert } from '../photoInsert';
import { findElement } from '../state/commands';
import { selectZine } from '../state/store';
import { EditorStage, type Viewport } from './EditorStage';
import { TextEditor } from './TextEditor';

/** React wrapper around EditorStage: passes store changes in, store actions out, and takes file drops. */
export function SpreadCanvas() {
  const { store, assets } = useEditorEnv();
  const photos = usePhotoInsert();
  const zine = useEditor(selectZine);
  const spread = useEditor((s) => s.spread);
  const selectedId = useEditor((s) => s.selectedId);
  const mode = useEditor((s) => s.mode);
  const showGuides = useEditor((s) => s.showGuides);
  const assetsVersion = useEditor((s) => s.assetsVersion);
  const fontsVersion = useFontsVersion();
  const host = useRef<HTMLDivElement>(null);
  const [editor, setEditor] = useState<EditorStage | null>(null);
  const [viewport, setViewport] = useState<Viewport | null>(null);

  useEffect(() => {
    const element = host.current!;
    const stage = new EditorStage(element, {
      select: (id, page) => store.getState().select(id, page),
      clickPage: (page) => store.getState().clickPage(page),
      change: (id, patch) => store.getState().updateElement(id, patch),
      crop: (id, crop) => store.getState().updateElement(id, { crop }, `crop:${id}`),
      doubleClick: (id) => {
        const state = store.getState();
        const target = findElement(selectZine(state), state.spread, id);
        if (!target) return;
        state.select(id);
        state.setMode(target.kind === 'text' ? 'text' : 'crop');
      },
      endCrop: () => store.getState().setMode('idle'),
      endGesture: () => store.getState().endMerge(),
    });
    const fit = () => {
      stage.resize(element.clientWidth, element.clientHeight);
      setViewport(stage.viewport());
    };
    const observer = new ResizeObserver(fit);
    observer.observe(element);
    fit();
    setEditor(stage);
    return () => {
      observer.disconnect();
      stage.destroy();
      setEditor(null);
    };
  }, [store]);

  useEffect(() => {
    editor?.update({ zine, spread, assets, selectedId, mode, showGuides, contentVersion: `${assetsVersion}:${fontsVersion}` });
  }, [editor, zine, spread, assets, selectedId, mode, showGuides, assetsVersion, fontsVersion]);

  // Fonts of this spread load in the background; when they arrive the text is measured again.
  useEffect(() => {
    void loadSpreadFonts(zine.spreads[spread]);
  }, [zine, spread]);
  useEffect(() => {
    if (fontsVersion > 0) store.getState().refreshTextHeights();
  }, [fontsVersion, store]);

  return (
    <div
      className="spread-canvas"
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes('Files')) event.preventDefault();
      }}
      onDrop={(event) => {
        event.preventDefault();
        const files = [...event.dataTransfer.files];
        if (!files.length || !editor) return;
        const point = editor.toSpreadMm(event.clientX, event.clientY);
        const page = pageAtPoint(spread, zine.sheets, point.x, point.y);
        photos.add(files, page);
      }}
    >
      <div ref={host} className="spread-stage" />
      {mode === 'text' && viewport && <TextEditor viewport={viewport} />}
    </div>
  );
}
