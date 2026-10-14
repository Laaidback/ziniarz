import type { Zine } from './types';

export function imageIdsOfZine(zine: Zine): Set<string> {
  const ids = new Set<string>();
  for (const spread of zine.spreads) {
    for (const element of spread.elements) {
      if (element.kind === 'photo') ids.add(element.imageId);
    }
  }
  return ids;
}
