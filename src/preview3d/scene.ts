import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { releaseCanvas } from '../render/canvasBytes';
import { isTurning, leafAngle, leafLift, leafPages, type BookState } from './book';
import { fitDistance } from './view';

const FOV = 35;
const BACKGROUND = '#d9d9de';
/** Thin outline around each leaf, so white pages stay apart from each other. */
const EDGE_COLOR = '#b4b4ba';

export interface SceneOptions {
  /** Trimmed page size in mm. */
  pageWidth: number;
  pageHeight: number;
  book: BookState;
}

/**
 * The three.js side of the 3D preview, kept thin: leaves are hinged groups at the spine
 * (x = 0), each with the front page facing the viewer and the back page facing away.
 * Angles and stacking come from book.ts; this class only draws them. Frames are drawn only
 * when something changes (a turn, the camera, a new page image), not in an endless loop.
 */
export class ZineScene {
  readonly canvas: HTMLCanvasElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly controls: OrbitControls;
  private readonly leaves: THREE.Group[] = [];
  private readonly materials = new Map<number, THREE.MeshBasicMaterial>();
  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly edgeMaterial = new THREE.LineBasicMaterial({ color: EDGE_COLOR });
  private readonly resizeObserver: ResizeObserver;
  private book: BookState;
  private frame = 0;
  private disposed = false;

  constructor(
    private readonly container: HTMLElement,
    private readonly options: SceneOptions,
  ) {
    this.book = options.book;
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.canvas = this.renderer.domElement;
    container.append(this.canvas);
    this.scene.background = new THREE.Color(BACKGROUND);
    this.camera = new THREE.PerspectiveCamera(FOV, 1, 10, 20_000);
    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true;
    this.controls.enablePan = false;
    this.controls.rotateSpeed = 0.5;
    this.controls.addEventListener('change', () => this.invalidate());
    this.buildLeaves();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    this.resetCamera();
  }

  private material(page: number): THREE.MeshBasicMaterial {
    let material = this.materials.get(page);
    if (!material) {
      // Pushed back a little in depth, so the leaf outline drawn in the same plane stays visible.
      material = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        side: THREE.FrontSide,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1,
      });
      this.materials.set(page, material);
    }
    return material;
  }

  private buildLeaves(): void {
    const { pageWidth: w, pageHeight: h } = this.options;
    // Front: x 0…w facing +z. Back: drawn at x −w…0 and turned half round, so it lands on 0…w facing −z.
    const front = new THREE.PlaneGeometry(w, h).translate(w / 2, 0, 0);
    const back = new THREE.PlaneGeometry(w, h).translate(-w / 2, 0, 0);
    const edges = new THREE.EdgesGeometry(front);
    this.geometries.push(front, back, edges);
    for (let leaf = 0; leaf < this.book.leaves; leaf++) {
      const pages = leafPages(leaf);
      const group = new THREE.Group();
      group.add(new THREE.Mesh(front, this.material(pages.front)));
      const backMesh = new THREE.Mesh(back, this.material(pages.back));
      backMesh.rotation.y = Math.PI;
      group.add(backMesh);
      group.add(new THREE.LineSegments(edges, this.edgeMaterial));
      this.leaves.push(group);
      this.scene.add(group);
    }
    this.placeLeaves(performance.now());
  }

  private placeLeaves(now: number): void {
    this.leaves.forEach((group, leaf) => {
      const angle = leafAngle(this.book, leaf, now);
      group.rotation.y = -angle; // negative: the leaf lifts towards the viewer while it turns
      group.position.z = leafLift(leaf, angle, this.book.leaves);
    });
  }

  private resize(): void {
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(width, height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.invalidate();
  }

  /** Looks at the open spread from the front, slightly from above. */
  resetCamera(): void {
    const { pageWidth: w, pageHeight: h } = this.options;
    const distance = fitDistance(2 * w, h, FOV, this.camera.aspect);
    this.camera.position.set(0, 0.15 * distance, distance);
    this.controls.target.set(0, 0, 0);
    this.controls.minDistance = distance * 0.3;
    this.controls.maxDistance = distance * 3;
    this.controls.update();
  }

  setBook(book: BookState): void {
    this.book = book;
    this.invalidate();
  }

  /** Puts a rendered page on its leaf. The canvas is freed once the GPU has it. */
  setPageImage(page: number, image: HTMLCanvasElement): void {
    const texture = new THREE.CanvasTexture(image);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    texture.onUpdate = () => releaseCanvas(image);
    const material = this.material(page);
    material.map?.dispose();
    material.map = texture;
    material.needsUpdate = true;
    this.invalidate();
  }

  /** Draws one frame now; keeps drawing on the next frames while a leaf turns or the camera glides. */
  renderFrame(now = performance.now()): void {
    this.placeLeaves(now);
    const cameraMoving = this.controls.update();
    this.renderer.render(this.scene, this.camera);
    if (cameraMoving || isTurning(this.book, now)) this.invalidate();
  }

  /** Asks for a frame on the next animation frame (once, however often it is called). */
  invalidate(): void {
    if (this.frame || this.disposed) return;
    this.frame = requestAnimationFrame((now) => {
      this.frame = 0;
      this.renderFrame(now);
    });
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.resizeObserver.disconnect();
    this.controls.dispose();
    for (const material of this.materials.values()) {
      material.map?.dispose();
      material.dispose();
    }
    this.edgeMaterial.dispose();
    for (const geometry of this.geometries) geometry.dispose();
    this.renderer.dispose();
    this.canvas.remove();
  }
}
