import Konva from 'konva';
import { BLEED, frameBounds, PAGE_HEIGHT, SPREAD_WIDTH } from '../../model/geometry';
import type { Frame, PhotoCrop, PhotoElement, Zine, ZineElement } from '../../model/types';
import type { RenderAssets } from '../../render/assets';
import { buildSpreadGroup, ELEMENT_NODE_NAME } from '../../render/buildSpread';
import { buildGuidesGroup, buildMissingPagesShade } from '../../render/guides';
import { imagePlacement } from '../../render/photoGeometry';
import { frameFromCentre, pageAtPoint } from '../geometry/placement';
import { snapBox, snapPoint, snapTargets, type SnapTargets } from '../geometry/snapping';
import type { EditorMode } from '../state/store';

export const STAGE_PADDING_PX = 24;
export const SNAP_DISTANCE_PX = 6;
export const MIN_FRAME_MM = 5;
export const CROP_WHEEL_STEP = 1.1;
const SELECTION_COLOR = '#2b6cff';
const SNAP_LINE_COLOR = '#e5487f';
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
  /** Changes when photos or fonts change in place (same `assets` object), so the spread is drawn again. */
  contentVersion?: string;
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
  private readonly snapLines = new Konva.Group();
  /** Invisible rectangle matching the selected frame; the Transformer edits it, not the photo itself. */
  private readonly proxy = new Konva.Rect();
  private readonly transformer: Konva.Transformer;
  private view: StageView | null = null;
  /** The view the element nodes in `content` were built from (see contentChanged). */
  private builtView: StageView | null = null;
  private viewportState: Viewport = { scale: 1, originX: 0, originY: 0 };
  /** True while a drag or a resize runs: store updates must not rebuild the nodes under the pointer. */
  private interacting = false;
  private dragTargets: SnapTargets | null = null;
  private cropDrag: { id: string; startX: number; startY: number; crop: PhotoCrop; rotation: number; flipX: boolean } | null = null;

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
      boundBoxFunc: (oldBox, newBox) => this.limitBox(oldBox, newBox),
      anchorDragBoundFunc: (_oldPos, newPos, event) => this.snapAnchor(newPos, event),
    });
    this.overlay.add(this.decorations, this.proxy, this.snapLines);
    this.tools.add(this.transformer);
    this.stage.add(this.content, this.overlay, this.tools);

    this.stage.on('click tap', (event) => this.handleClick(event));
    this.stage.on('dblclick dbltap', (event) => this.handleDoubleClick(event));
    this.content.on('dragstart', (event) => this.handleDragStart(event));
    this.content.on('dragmove', (event) => this.handleDragMove(event));
    this.content.on('dragend', (event) => this.handleDragEnd(event));
    this.transformer.on('transformstart', () => (this.interacting = true));
    this.transformer.on('transform', () => this.mirrorProxy());
    this.transformer.on('transformend', () => this.handleTransformEnd());
    this.stage.on('mousedown touchstart', (event) => this.handlePointerDown(event));
    this.stage.on('mousemove touchmove', () => this.handlePointerMove());
    this.stage.on('wheel', (event) => this.handleWheel(event));
    window.addEventListener('mouseup', this.endCropDrag);
    window.addEventListener('touchend', this.endCropDrag);
  }

  destroy(): void {
    window.removeEventListener('mouseup', this.endCropDrag);
    window.removeEventListener('touchend', this.endCropDrag);
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
    this.redraw(true);
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
    // The next update after the drag or resize ends redraws everything.
    if (!this.interacting) this.redraw();
  }

  /**
   * Whether the element nodes must be built again. Selecting alone must keep them: Konva fires
   * `dblclick` only when both clicks land on the same node, and the first click selects.
   */
  private contentChanged(view: StageView): boolean {
    const built = this.builtView;
    if (!built) return true;
    const hidden = (v: StageView) => (v.mode === 'text' ? v.selectedId : null);
    return (
      built.zine !== view.zine ||
      built.spread !== view.spread ||
      built.assets !== view.assets ||
      built.contentVersion !== view.contentVersion ||
      built.mode !== view.mode ||
      hidden(built) !== hidden(view)
    );
  }

  /** Rebuilds the spread only when its content changed; guides and selection always. */
  private redraw(force = false): void {
    const view = this.view;
    if (!view) return;
    if (force || this.contentChanged(view)) this.buildContent(view);
    this.decorations.destroyChildren();
    this.decorations.add(buildMissingPagesShade(view.zine, view.spread));
    if (view.showGuides) this.decorations.add(buildGuidesGroup(view.zine, view.spread, this.viewportState.scale));
    this.snapLines.destroyChildren();
    this.attachSelection();
    this.stage.batchDraw();
  }

  private buildContent(view: StageView): void {
    this.builtView = view;
    this.content.destroyChildren();
    const spread = buildSpreadGroup(view.zine, view.spread, view.assets);
    for (const node of spread.getChildren((child) => child.hasName(ELEMENT_NODE_NAME))) {
      node.draggable(view.mode === 'idle');
      node.dragDistance(3);
      if (view.mode === 'text' && node.id() === view.selectedId) node.visible(false);
    }
    this.content.add(spread);
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

  // --- moving -------------------------------------------------------------

  private handleDragStart(event: Konva.KonvaEventObject<DragEvent>): void {
    const node = event.target;
    if (!this.view || !node.hasName(ELEMENT_NODE_NAME)) return;
    this.interacting = true;
    this.dragTargets = snapTargets(this.view.zine, this.view.spread, node.id());
    if (node.id() !== this.view.selectedId) {
      this.transformer.nodes([]);
      this.callbacks.select(node.id());
    }
  }

  private handleDragMove(event: Konva.KonvaEventObject<DragEvent>): void {
    const node = event.target;
    if (!node.hasName(ELEMENT_NODE_NAME) || !this.dragTargets) return;
    const width = node.offsetX() * 2;
    const height = node.offsetY() * 2;
    if ((event.evt as MouseEvent | undefined)?.altKey) {
      this.drawSnapLines(null, null);
    } else {
      const box = frameBounds({ id: '', x: node.x() - width / 2, y: node.y() - height / 2, width, height, rotation: node.rotation() });
      const snap = snapBox(box, this.dragTargets, SNAP_DISTANCE_PX / this.viewportState.scale);
      node.position({ x: node.x() + snap.dx, y: node.y() + snap.dy });
      this.drawSnapLines(snap.lineX, snap.lineY);
    }
    if (node.id() === this.view?.selectedId) this.syncProxy(node);
  }

  private handleDragEnd(event: Konva.KonvaEventObject<DragEvent>): void {
    const node = event.target;
    if (!node.hasName(ELEMENT_NODE_NAME)) return;
    this.dragTargets = null;
    this.endInteraction();
    this.callbacks.change(node.id(), { x: node.x() - node.offsetX(), y: node.y() - node.offsetY() });
  }

  private endInteraction(): void {
    this.interacting = false;
    this.drawSnapLines(null, null);
  }

  private drawSnapLines(x: number | null, y: number | null): void {
    this.snapLines.destroyChildren();
    const px = 1 / this.viewportState.scale;
    const reach = 20;
    if (x !== null) {
      this.snapLines.add(
        new Konva.Line({ points: [x, -BLEED - reach, x, PAGE_HEIGHT + BLEED + reach], stroke: SNAP_LINE_COLOR, strokeWidth: px }),
      );
    }
    if (y !== null) {
      this.snapLines.add(
        new Konva.Line({ points: [-BLEED - reach, y, SPREAD_WIDTH + BLEED + reach, y], stroke: SNAP_LINE_COLOR, strokeWidth: px }),
      );
    }
    this.overlay.batchDraw();
  }

  // --- resizing and rotating -----------------------------------------------

  /** While the Transformer changes the proxy, the element follows it (stretched until the drop). */
  private mirrorProxy(): void {
    this.selectedNode()?.setAttrs({
      x: this.proxy.x(),
      y: this.proxy.y(),
      rotation: this.proxy.rotation(),
      scaleX: this.proxy.scaleX(),
      scaleY: this.proxy.scaleY(),
    });
  }

  private handleTransformEnd(): void {
    const element = this.selectedElement();
    this.endInteraction();
    if (!element) return;
    const p = this.proxy;
    const frame = frameFromCentre(p.x(), p.y(), p.width() * p.scaleX(), p.height() * p.scaleY(), p.rotation());
    // A text's height always comes from its text, so only width, position and rotation are kept.
    this.callbacks.change(
      element.id,
      element.kind === 'text' ? { x: frame.x, y: frame.y, width: frame.width, rotation: frame.rotation } : frame,
    );
  }

  private limitBox<T extends { width: number; height: number }>(oldBox: T, newBox: T): T {
    const min = MIN_FRAME_MM * this.viewportState.scale;
    return Math.abs(newBox.width) < min || Math.abs(newBox.height) < min ? oldBox : newBox;
  }

  /** Resize handles snap like dragged frames (not for rotated frames, not with Alt, not the rotation handle). */
  private snapAnchor(position: { x: number; y: number }, event: MouseEvent | undefined): { x: number; y: number } {
    const view = this.view;
    const element = this.selectedElement();
    if (!view || !element || event?.altKey || this.transformer.getActiveAnchor() === 'rotater' || element.rotation % 360 !== 0) {
      return position;
    }
    const { scale, originX, originY } = this.viewportState;
    const targets = snapTargets(view.zine, view.spread, element.id);
    const threshold = SNAP_DISTANCE_PX / scale;
    const x = snapPoint((position.x - originX) / scale, targets.xs, threshold);
    const y = snapPoint((position.y - originY) / scale, targets.ys, threshold);
    this.drawSnapLines(x.line, y.line);
    return { x: x.value * scale + originX, y: y.value * scale + originY };
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

  private handlePointerDown(event: Konva.KonvaEventObject<MouseEvent | TouchEvent>): void {
    if (this.view?.mode !== 'crop') return;
    const element = this.selectedElement();
    const point = this.pointerMm();
    if (element?.kind === 'photo' && point && elementNodeOf(event.target)?.id() === element.id) {
      this.cropDrag = { id: element.id, startX: point.x, startY: point.y, crop: { ...element.crop }, rotation: element.rotation, flipX: element.flipX };
    } else {
      this.callbacks.endCrop();
    }
  }

  private handlePointerMove(): void {
    const drag = this.cropDrag;
    const point = this.pointerMm();
    if (!drag || !point) return;
    // The crop offset lives in the frame's own (rotated) axes.
    const angle = (-drag.rotation * Math.PI) / 180;
    const dx = point.x - drag.startX;
    const dy = point.y - drag.startY;
    // A flipped photo is mirrored around the frame centre, so its x offset moves the other way.
    const flip = drag.flipX ? -1 : 1;
    this.callbacks.crop(drag.id, {
      ...drag.crop,
      offsetX: drag.crop.offsetX + flip * (dx * Math.cos(angle) - dy * Math.sin(angle)),
      offsetY: drag.crop.offsetY + dx * Math.sin(angle) + dy * Math.cos(angle),
    });
  }

  private readonly endCropDrag = (): void => {
    if (!this.cropDrag) return;
    this.cropDrag = null;
    this.callbacks.endGesture();
  };

  private handleWheel(event: Konva.KonvaEventObject<WheelEvent>): void {
    const element = this.selectedElement();
    if (this.view?.mode !== 'crop' || element?.kind !== 'photo') return;
    event.evt.preventDefault();
    const zoom = element.crop.zoom * (event.evt.deltaY < 0 ? CROP_WHEEL_STEP : 1 / CROP_WHEEL_STEP);
    this.callbacks.crop(element.id, { ...element.crop, zoom: Math.max(1, zoom) });
  }
}
