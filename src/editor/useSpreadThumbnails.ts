import { useEffect, useRef, useState } from 'react';
import type { Zine } from '../model/types';
import type { RenderAssets } from '../render/assets';
import { releaseCanvas } from '../render/canvasBytes';
import { renderSpread } from '../render/renderPage';
import { thumbnailKey } from './spreadLabels';

export const THUMB_PX_PER_MM = 0.7;
const CACHE_LIMIT = 300;
const DEBOUNCE_MS = 150;

/** PNG data URLs of every spread, redrawn shortly after a change; unchanged spreads come from a cache. */
export function useSpreadThumbnails(zine: Zine, assets: RenderAssets, version: number): string[] {
  const cache = useRef(new Map<string, string>());
  const [urls, setUrls] = useState<string[]>([]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (cache.current.size > CACHE_LIMIT) cache.current.clear();
      const next = zine.spreads.map((_, spread) => {
        const key = thumbnailKey(zine, spread, version);
        let url = cache.current.get(key);
        if (!url) {
          const canvas = renderSpread(zine, spread, assets, { pxPerMm: THUMB_PX_PER_MM });
          url = canvas.toDataURL('image/png');
          releaseCanvas(canvas);
          cache.current.set(key, url);
        }
        return url;
      });
      // Changes that draw nothing (notes, title) keep the list, so the thumbnails do not render again.
      setUrls((urls) => (urls.length === next.length && urls.every((url, i) => url === next[i]) ? urls : next));
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [zine, assets, version]);

  return urls;
}
