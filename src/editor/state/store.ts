import { createStore, type StoreApi } from 'zustand/vanilla';
import { pageAt, sideOfPage, spreadCount } from '../../model/geometry';
import { addSheet, removeSheet } from '../../model/sheets';
import type { PhotoCrop, TextElement, Zine, ZineElement } from '../../model/types';
import { clampCrop } from '../../render/photoGeometry';
import { cloneForPaste } from './clipboard';
import {
  addElement,
  findElement,
  mapElement,
  patchElement,
  removeElement,
  updateSpreadElements,
  type ElementPatch,
} from './commands';
import { breakMerge, canRedo, canUndo, createHistory, record, redo, replacePresent, undo, type History } from './history';
import { moveLayer, type LayerOp } from './layers';

export const MAX_CROP_ZOOM = 5;

/** Things the store needs from the browser; Node tests pass fakes. */
export interface EditorDeps {
  /** Height in mm of the wrapped text (render/buildSpread.ts measureTextHeight). */
  measureText(element: TextElement): number;
  /** Pixel size of a loaded image, for keeping the crop valid. */
  imageSize(imageId: string): { width: number; height: number } | undefined;
}

/** idle: select, move, resize. crop: move/zoom the photo inside its frame. text: typing in the frame. */
export type EditorMode = 'idle' | 'crop' | 'text';

export interface EditorState {
  history: History<Zine>;
  spread: number;
  selectedId: string | null;
  /**
   * Page last clicked on the current spread (on the page itself or on an element there): new
   * elements go there, and its settings are shown when nothing is selected.
   */
  activePage: number | null;
  mode: EditorMode;
  showGuides: boolean;
  /** Copied element (Cmd+C); pasting works on any spread of the open zine. */
  clipboard: ZineElement | null;
  /** Bumped when photos are added to the render assets, so canvases redraw. */
  assetsVersion: number;

  setSpread(index: number): void;
  /** `page`: the existing page under the pointer when selecting by a click on the canvas (becomes `activePage`). */
  select(id: string | null, page?: number | null): void;
  clickPage(page: number | null): void;
  setMode(mode: EditorMode): void;
  setShowGuides(show: boolean): void;
  /**
   * Any zine change as one undo step; `key` merges consecutive changes (typing, sliders) until
   * the interaction ends: endMerge, selecting, clicking a page, changing the mode or the spread.
   */
  edit(recipe: (zine: Zine) => Zine, key?: string): void;
  /** The current interaction ended (pointer up, blur, Enter): the next change is a new undo step. */
  endMerge(): void;
  addElement(element: ZineElement): void;
  updateElement(id: string, patch: ElementPatch, key?: string): void;
  deleteSelected(): void;
  nudgeSelected(dx: number, dy: number): void;
  copySelected(): void;
  paste(): void;
  duplicateSelected(): void;
  moveSelectedLayer(op: LayerOp): void;
  addSheet(): void;
  removeSheet(): void;
  undo(): void;
  redo(): void;
  /** Re-measures text heights after fonts load; no undo step. */
  refreshTextHeights(): void;
  assetsChanged(): void;
}

export type EditorStore = StoreApi<EditorState>;

export const selectZine = (state: EditorState): Zine => state.history.present;
export const selectCanUndo = (state: EditorState): boolean => canUndo(state.history);
export const selectCanRedo = (state: EditorState): boolean => canRedo(state.history);

export function selectedElement(state: EditorState): ZineElement | null {
  return state.selectedId ? (findElement(state.history.present, state.spread, state.selectedId) ?? null) : null;
}

const sameCrop = (a: PhotoCrop, b: PhotoCrop) => a.offsetX === b.offsetX && a.offsetY === b.offsetY && a.zoom === b.zoom;

/**
 * The spread to show after undo/redo turned `before` into `after`: the current one if it changed
 * (or the sheet count did), else the first spread whose elements changed, else the current one.
 */
function changedSpread(before: Zine, after: Zine, current: number): number {
  if (before.spreads.length !== after.spreads.length) return current;
  if (before.spreads[current]?.elements !== after.spreads[current]?.elements) return current;
  const index = after.spreads.findIndex((spread, i) => spread.elements !== before.spreads[i].elements);
  return index < 0 ? current : index;
}

export function createEditorStore(zine: Zine, deps: EditorDeps): EditorStore {
  /** Keeps derived fields true: text height from the text, photo crop covering the frame. */
  const normalize = (element: ZineElement): ZineElement => {
    if (element.kind === 'text') {
      const height = deps.measureText(element);
      return height === element.height ? element : { ...element, height };
    }
    const size = deps.imageSize(element.imageId);
    const wanted = { ...element.crop, zoom: Math.min(MAX_CROP_ZOOM, element.crop.zoom) };
    const crop = size ? clampCrop(element, wanted, size.width, size.height) : wanted;
    return sameCrop(crop, element.crop) ? element : { ...element, crop };
  };

  return createStore<EditorState>()((set, get) => {
    const zineOf = () => get().history.present;

    /** Applies a new history, shows `wanted` (or the nearest spread), and keeps the selection valid for it. */
    const settle = (
      history: History<Zine>,
      wanted = get().spread,
      activePage = wanted === get().spread ? get().activePage : null,
    ) => {
      const state = get();
      const spread = Math.min(wanted, spreadCount(history.present.sheets) - 1);
      const keep = state.selectedId !== null && findElement(history.present, spread, state.selectedId) !== undefined;
      set({
        history,
        spread,
        selectedId: keep ? state.selectedId : null,
        mode: keep ? state.mode : 'idle',
        activePage: spread === wanted ? activePage : null,
      });
    };

    /**
     * Adds or removes a sheet and keeps showing the current spread's content where it moved, with the
     * clicked page on the same side (the back cover keeps being the back cover, renumbered P ± 4).
     */
    const changeSheets = (change: (zine: Zine, spread: number) => Zine) => {
      const { history, spread, activePage } = get();
      const next = change(history.present, spread);
      if (next === history.present) return;
      const moved = next.spreads.indexOf(history.present.spreads[spread]);
      if (moved < 0) settle(record(history, next));
      else settle(record(history, next), moved, activePage === null ? null : pageAt(moved, sideOfPage(activePage), next.sheets));
    };

    /**
     * Undo/redo. When the sheet count changes, the clicked page stays on the same side of the spread
     * shown afterwards, renumbered like in changeSheets (the back cover keeps being the back cover).
     */
    const travel = (step: (history: History<Zine>) => History<Zine>) => {
      const { history: before, activePage } = get();
      const after = step(before);
      if (after === before) return;
      const wanted = changedSpread(before.present, after.present, get().spread);
      const { sheets } = after.present;
      if (sheets === before.present.sheets) settle(after, wanted);
      else {
        const spread = Math.min(wanted, spreadCount(sheets) - 1);
        settle(after, spread, activePage === null ? null : pageAt(spread, sideOfPage(activePage), sheets));
      }
      get().refreshTextHeights();
    };

    /** The history with merging ended, for actions that start a new interaction. */
    const unmerged = () => breakMerge(get().history);

    const edit = (recipe: (zine: Zine) => Zine, key?: string) => {
      const next = recipe(zineOf());
      if (next !== zineOf()) settle(record(get().history, next, key ?? null));
    };

    const current = () => selectedElement(get());
    const spreadElements = () => zineOf().spreads[get().spread].elements;

    return {
      history: createHistory(zine),
      spread: 0,
      selectedId: null,
      activePage: null,
      mode: 'idle',
      showGuides: true,
      clipboard: null,
      assetsVersion: 0,

      setSpread: (index) => {
        const spread = Math.max(0, Math.min(spreadCount(zineOf().sheets) - 1, index));
        set({ spread, selectedId: null, activePage: null, mode: 'idle', history: unmerged() });
      },
      select: (id, page = null) => {
        if (id === get().selectedId) {
          // The selected element clicked again, maybe on its other page: only the page follows.
          if (id !== null && page !== null && page !== get().activePage) set({ activePage: page });
          return;
        }
        set({ selectedId: id, mode: 'idle', activePage: id === null ? null : page, history: unmerged() });
      },
      clickPage: (page) => set({ selectedId: null, activePage: page, mode: 'idle', history: unmerged() }),
      setMode: (mode) => set({ mode, history: unmerged() }),
      setShowGuides: (showGuides) => set({ showGuides }),
      edit,
      endMerge: () => set({ history: unmerged() }),
      addElement: (element) => {
        edit((z) => addElement(z, get().spread, normalize(element)));
        set({ selectedId: element.id, mode: 'idle' });
      },
      updateElement: (id, patch, key) =>
        edit((z) => mapElement(z, get().spread, id, (e) => normalize(patchElement(e, patch))), key),
      deleteSelected: () => {
        const id = get().selectedId;
        if (id) edit((z) => removeElement(z, get().spread, id));
      },
      nudgeSelected: (dx, dy) => {
        const element = current();
        if (element) get().updateElement(element.id, { x: element.x + dx, y: element.y + dy });
      },
      copySelected: () => {
        const element = current();
        if (element) set({ clipboard: element });
      },
      paste: () => {
        const copied = get().clipboard;
        if (copied) get().addElement(cloneForPaste(copied, spreadElements()));
      },
      duplicateSelected: () => {
        const element = current();
        if (element) get().addElement(cloneForPaste(element, spreadElements()));
      },
      moveSelectedLayer: (op) => {
        const id = get().selectedId;
        if (id) edit((z) => updateSpreadElements(z, get().spread, (elements) => moveLayer(elements, id, op)));
      },
      addSheet: () => changeSheets(addSheet),
      removeSheet: () => changeSheets(removeSheet),
      undo: () => travel(undo),
      redo: () => travel(redo),
      refreshTextHeights: () => {
        const z = zineOf();
        let changed = false;
        const spreads = z.spreads.map((spread) => {
          const elements = spread.elements.map((e) => (e.kind === 'text' ? normalize(e) : e));
          if (elements.every((e, i) => e === spread.elements[i])) return spread;
          changed = true;
          return { ...spread, elements };
        });
        if (changed) set({ history: replacePresent(get().history, { ...z, spreads }) });
      },
      assetsChanged: () => set((state) => ({ assetsVersion: state.assetsVersion + 1 })),
    };
  });
}
