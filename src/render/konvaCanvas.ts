import Konva from 'konva';

/**
 * Draws Konva nodes into a new canvas of exactly width × height pixels.
 * Konva.pixelRatio is forced to 1 while the stage exists, so big export
 * canvases are not doubled on Retina screens.
 */
export function drawToCanvas(width: number, height: number, draw: (layer: Konva.Layer) => void): HTMLCanvasElement {
  const previous = Konva.pixelRatio;
  Konva.pixelRatio = 1;
  const stage = new Konva.Stage({ container: document.createElement('div'), width, height });
  try {
    const layer = new Konva.Layer({ listening: false });
    stage.add(layer);
    draw(layer);
    return stage.toCanvas({ pixelRatio: 1 });
  } finally {
    stage.destroy();
    Konva.pixelRatio = previous;
  }
}
