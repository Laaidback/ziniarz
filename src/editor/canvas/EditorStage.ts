import Konva from 'konva';
import { BLEED, PAGE_HEIGHT, SPREAD_WIDTH } from '../../model/geometry';
import type { Frame, PhotoCrop, PhotoElement, Zine, ZineElement } from '../../model/types';
import type { RenderAssets } from '../../render/assets';
import { buildSpreadGroup, ELEMENT_NODE_NAME } from '../../render/buildSpread';
import { buildGuidesGroup, buildMissingPagesShade } from '../../render/guides';
import { imagePlacement } from '../../render/photoGeometry';
import { pageAtPoint } from '../geometry/placement';
import type { EditorMode } from '../state/store';

export const STAGE_PADDING_PX = 24;
const SELECTION_COLOR = '#2b6cff';
export const TEXT_ANCHORS = ['middle-left', 'middle-right'];
export const PHOTO_ANCHORS = [
  'top-left',
  'top-center',
  'top-right',
  'middle-right',
  'bottom-right',
  'bottom-center',
  'bottom-left',
  'middle-left',
];

/** Everything the canvas shows; the React wrapper passes a new view after each store change. */
export interface StageView {
  zine: Zine;
  spread: number;
  assets: RenderAssets;
  selectedId: string | null;
  mode: EditorMode;
  showGuides: boolean;
}

/** What the canvas asks the store to do. */
export interface StageCallbacks {
  select(id: string): void;
  clickPage(page: number | null): void;
  /** After a drag, resize or rotation, in spread mm. */
  change(id: string, patch: Partial<Omit<Frame, 'id'>>): void;
  crop(id: string, crop: PhotoCrop): void;
  doubleClick(id: string): void;
  endCrop(): void;
  /** A crop drag ended: its `crop` calls were one gesture, so the next one is a new undo step. */
  endGesture(): void;
}

/** Where spread mm (0, 0) lies in the stage, and how many pixels one mm takes. */
export interface Viewport {
  scale: number;
  originX: number;
  originY: number;
}

function elementNodeOf(target: Konva.Node): Konva.Node | null {
  if (target.hasName(ELEMENT_NODE_NAME)) return target;
  return target.findAncestor(`.${ELEMENT_NODE_NAME}`) ?? null;
}

/**
 * The editor canvas, in plain Konva. The spread itself is drawn by the shared renderer
 * (buildSpreadGroup); this class only adds guides, selection, snapping and pointer handling.
 * Layers: `content` (spread, scaled to mm), `overlay` (guides, shade, snap lines, the selection
 * proxy; scaled, not listening) and `tools` (the Transformer; unscaled, it works in screen pixels).
 */
export class EditorStage {
  readonly stage: Konva.Stage;
  private readonly content = new Konva.Layer();
  private readonly overlay = new Konva.Layer({ listening: false });
  private readonly tools = new Konva.Layer();
  private readonly decorations = new Konva.Group();
  /** Invisible rectangle matching the selected frame; the Transformer edits it, not the photo itself. */
  private readonly proxy = new Konva.Rect();
  private readonly transformer: Konva.Transformer;
  private view: StageView | null = null;
  private viewportState: Viewport = { scale: 1, originX: 0, originY: 0 };

  constructor(
    container: HTMLDivElement,
    private readonly callbacks: StageCallbacks,
  ) {
    this.stage = new Konva.Stage({ container, width: Math.max(1, container.clientWidth), height: Math.max(1, container.clientHeight) });
    this.transformer = new Konva.Transformer({
      rotateEnabled: true,
      flipEnabled: false,
      keepRatio: true,
      shiftBehavior: 'inverted', // corners keep proportions; Shift frees them
      rotationSnaps: [0, 90, 180, 270],
      rotationSnapTolerance: 5,
      anchorSize: 9,
      borderStroke: SELECTION_COLOR,
      anchorStroke: SELECTION_COLOR,
      ignoreStroke: true,
    });
    this.overlay.add(this.decorations, this.proxy);
    this.tools.add(this.transformer);
    this.stage.add(this.content, this.overlay, this.tools);

    this.stage.on('click tap', (event) => this.handleClick(event));
    this.stage.on('dblclick dbltap', (event) => this.handleDoubleClick(event));
  }

  destroy(): void {
    this.stage.destroy();
  }

  /** Fits the spread with its bleed into the container, centred. */
  resize(width: number, height: number): void {
    this.stage.size({ width: Math.max(1, width), height: Math.max(1, height) });
    const fullWidth = SPREAD_WIDTH + 2 * BLEED;
    const fullHeight = PAGE_HEIGHT + 2 * BLEED;
    const scale = Math.max(
      0.1,
      Math.min((width - 2 * STAGE_PADDING_PX) / fullWidth, (height - 2 * STAGE_PADDING_PX) / fullHeight),
    );
    this.viewportState = {
      scale,
      originX: (width - SPREAD_WIDTH * scale) / 2,
      originY: (height - PAGE_HEIGHT * scale) / 2,
    };
    for (const layer of [this.content, this.overlay]) {
      layer.scale({ x: scale, y: scale });
      layer.position({ x: this.viewportState.originX, y: this.viewportState.originY });
    }
    this.rebuild();
  }

  viewport(): Viewport {
    return { ...this.viewportState };
  }

  /** Spread mm under a point in client (page) pixels, for file drops. */
  toSpreadMm(clientX: number, clientY: number): { x: number; y: number } {
    const box = this.stage.container().getBoundingClientRect();
    const { scale, originX, originY } = this.viewportState;
    return { x: (clientX - box.left - originX) / scale, y: (clientY - box.top - originY) / scale };
  }

  update(view: StageView): void {
    this.view = view;
    this.rebuild();
  }

  private rebuild(): void {
    const view = this.view;
    if (!view) return;
    this.content.destroyChildren();
    const spread = buildSpreadGroup(view.zine, view.spread, view.assets);
    for (const node of spread.getChildren((child) => child.hasName(ELEMENT_NODE_NAME))) {
      if (view.mode === 'text' && node.id() === view.selectedId) node.visible(false);
    }
    this.content.add(spread);
    this.decorations.destroyChildren();
    this.decorations.add(buildMissingPagesShade(view.zine, view.spread));
    if (view.showGuides) this.decorations.add(buildGuidesGroup(view.zine, view.spread, this.viewportState.scale));
    this.attachSelection();
    this.stage.batchDraw();
  }

  private selectedElement(): ZineElement | null {
    const view = this.view;
    if (!view?.selectedId) return null;
    return view.zine.spreads[view.spread]?.elements.find((e) => e.id === view.selectedId) ?? null;
  }

  private selectedNode(): Konva.Node | null {
    const id = this.view?.selectedId;
    if (!id) return null;
    return this.content.findOne((node: Konva.Node) => node.hasName(ELEMENT_NODE_NAME) && node.id() === id) ?? null;
  }

  private attachSelection(): void {
    const node = this.selectedNode();
    const element = this.selectedElement();
    if (!node || !element || this.view?.mode === 'text') {
      this.transformer.nodes([]);
      return;
    }
    this.syncProxy(node);
    if (this.view?.mode === 'crop' && element.kind === 'photo') {
      this.transformer.nodes([]);
      this.decorations.add(this.cropGhost(element));
      return;
    }
    this.transformer.enabledAnchors(element.kind === 'text' ? TEXT_ANCHORS : PHOTO_ANCHORS);
    this.transformer.nodes([this.proxy]);
    this.transformer.forceUpdate();
  }

  /** Element nodes are centred (offset = half size), so the proxy copies position, offset and rotation. */
  private syncProxy(node: Konva.Node): void {
    const width = node.offsetX() * 2;
    const height = node.offsetY() * 2;
    this.proxy.setAttrs({
      x: node.x(),
      y: node.y(),
      width,
      height,
      offsetX: width / 2,
      offsetY: height / 2,
      rotation: node.rotation(),
      scaleX: 1,
      scaleY: 1,
    });
  }

  private pointerMm(): { x: number; y: number } | null {
    return this.content.getRelativePointerPosition();
  }

  private handleClick(event: Konva.KonvaEventObject<MouseEvent>): void {
    const view = this.view;
    if (!view || event.target.getLayer() === this.tools) return;
    const node = elementNodeOf(event.target);
    if (node) {
      this.callbacks.select(node.id());
      return;
    }
    const point = this.pointerMm();
    this.callbacks.clickPage(point ? pageAtPoint(view.spread, view.zine.sheets, point.x, point.y) : null);
  }

  private handleDoubleClick(event: Konva.KonvaEventObject<MouseEvent>): void {
    const node = elementNodeOf(event.target);
    if (node && this.view?.mode === 'idle') this.callbacks.doubleClick(node.id());
  }

  // --- cropping ---------------------------------------------------------------

  /** The whole photo, faint, so the part outside the frame is visible while cropping. */
  private cropGhost(element: PhotoElement): Konva.Group {
    const group = new Konva.Group({
      x: element.x + element.width / 2,
      y: element.y + element.height / 2,
      offsetX: element.width / 2,
      offsetY: element.height / 2,
      rotation: element.rotation,
    });
    const bitmap = this.view?.assets.images.get(element.imageId);
    if (bitmap) {
      const placed = imagePlacement(element, element.crop, bitmap.width, bitmap.height);
      group.add(
        new Konva.Image({
          image: bitmap,
          opacity: 0.35,
          x: element.flipX ? element.width - placed.x : placed.x,
          y: placed.y,
          width: placed.width,
          height: placed.height,
          scaleX: element.flipX ? -1 : 1,
        }),
      );
    }
    group.add(
      new Konva.Rect({ width: element.width, height: element.height, stroke: SELECTION_COLOR, strokeWidth: 1 / this.viewportState.scale }),
    );
    return group;
  }
}
