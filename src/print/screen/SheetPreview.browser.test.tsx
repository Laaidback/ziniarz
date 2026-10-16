import { render } from 'vitest-browser-react';
import { expect, test } from 'vitest';
import { createZine } from '../../model/factory';
import '../../app/app.css';
import { SheetPreview } from './SheetPreview';

const assets = { images: new Map() };

/** True when the image has at least as many pixels as the screen shows it with (it is not stretched). */
const sharp = (image: HTMLImageElement) => image.naturalWidth > 0 && image.naturalWidth >= image.clientWidth * devicePixelRatio;

test('shows every sheet; the first sheet is drawn front and back, sharp at its size', async () => {
  const zine = createZine('Lato', 5);
  const screen = render(<SheetPreview zine={zine} assets={assets} settings={zine.print} />);
  for (let sheet = 1; sheet <= 5; sheet++) {
    await expect.element(screen.getByRole('heading', { name: `Kartka ${sheet}` })).toBeInTheDocument();
  }
  const front = screen.getByRole('img', { name: 'Kartka 1, przód: strony 20 i 1' });
  await expect.element(front).toBeVisible();
  await expect.element(screen.getByRole('img', { name: 'Kartka 1, tył: strony 2 i 19' })).toBeVisible();
  const image = front.element() as HTMLImageElement;
  await expect.poll(() => sharp(image)).toBe(true);
  expect(image.src).toMatch(/^data:image\/jpeg/);
});

test('changing the layout settings redraws the sides', async () => {
  const zine = createZine('Lato', 1);
  const screen = render(<SheetPreview zine={zine} assets={assets} settings={zine.print} />);
  const front = screen.getByRole('img', { name: 'Kartka 1, przód: strony 4 i 1' });
  await expect.element(front).toBeVisible();
  const before = (front.element() as HTMLImageElement).src;
  screen.rerender(<SheetPreview zine={zine} assets={assets} settings={{ ...zine.print, cropMarks: false, foldMarks: false }} />);
  await expect.poll(() => (front.element() as HTMLImageElement).src).not.toBe(before);
});

test('a wide preview is drawn with more pixels, so it is not blurry', async () => {
  const zine = createZine('Lato', 1);
  const screen = render(
    <div style={{ width: 2400 }}>
      <SheetPreview zine={zine} assets={assets} settings={zine.print} />
    </div>,
  );
  const front = screen.getByRole('img', { name: 'Kartka 1, przód: strony 4 i 1' });
  await expect.element(front).toBeVisible();
  const image = front.element() as HTMLImageElement;
  expect(image.clientWidth).toBeGreaterThan(1000);
  await expect.poll(() => sharp(image)).toBe(true);
});
