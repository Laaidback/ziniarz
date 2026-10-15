import { afterEach, expect, test } from 'vitest';
import { expectColor, pixel } from '../test/pixels';
import { closedBook, turnPage, TURN_MS } from './book';
import { ZineScene } from './scene';

let scene: ZineScene | null = null;
let container: HTMLDivElement | null = null;

afterEach(() => {
  scene?.dispose();
  container?.remove();
  scene = null;
});

function pageImage(left: string, right: string): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 90;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = left;
  ctx.fillRect(0, 0, 32, 90);
  ctx.fillStyle = right;
  ctx.fillRect(32, 0, 32, 90);
  return canvas;
}

/** Copies the WebGL picture right after drawing it (the drawing buffer is cleared once shown). */
function snapshot(target: ZineScene, now: number): HTMLCanvasElement {
  target.renderFrame(now);
  const copy = document.createElement('canvas');
  copy.width = target.canvas.width;
  copy.height = target.canvas.height;
  copy.getContext('2d')!.drawImage(target.canvas, 0, 0);
  return copy;
}

function open(sheets: number): ZineScene {
  container = document.createElement('div');
  container.style.cssText = 'width: 600px; height: 400px';
  document.body.append(container);
  scene = new ZineScene(container, { pageWidth: 138, pageHeight: 196, book: closedBook(sheets) });
  return scene;
}

test('the closed zine shows the cover on the right of the spine, the right way round', () => {
  const view = open(1);
  view.setPageImage(1, pageImage('#ff0000', '#0000ff'));
  const shot = snapshot(view, 0);
  const { width, height } = shot;
  expectColor(pixel(shot, width * 0.6, height / 2), [255, 0, 0]); // left half of page 1
  expectColor(pixel(shot, width * 0.8, height / 2), [0, 0, 255]); // right half of page 1
  expectColor(pixel(shot, width * 0.2, height / 2), [217, 217, 222]); // only the background left of the spine
});

test('after a turn, pages 2 and 3 lie open, page 2 the right way round', () => {
  const view = open(1);
  view.setPageImage(2, pageImage('#00ff00', '#ff00ff'));
  view.setPageImage(3, pageImage('#ffff00', '#ffff00'));
  view.setBook(turnPage(closedBook(1), true, 0));
  const shot = snapshot(view, TURN_MS);
  const { width, height } = shot;
  expectColor(pixel(shot, width * 0.2, height / 2), [0, 255, 0]);
  expectColor(pixel(shot, width * 0.4, height / 2), [255, 0, 255]);
  expectColor(pixel(shot, width * 0.7, height / 2), [255, 255, 0]);
});
