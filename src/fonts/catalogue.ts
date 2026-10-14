import type { Zine } from '../model/types';
import { fontFilesOfFamily, getFontFamily, listFontFamilies, type FontFamily, type ZiniarzDb } from '../storage/db';
import { BUILTIN_FONTS, stylesOfFiles, type FontChoice } from './fontChoices';

async function choiceOf(db: ZiniarzDb, family: FontFamily): Promise<FontChoice> {
  return { id: family.id, name: family.name, styles: stylesOfFiles(await fontFilesOfFamily(db, family.id)), builtin: false };
}

/** Built-in families first, then the zine's own uploaded families in list order. */
export async function loadFontChoices(db: ZiniarzDb, zine: Zine): Promise<FontChoice[]> {
  const custom: FontChoice[] = [];
  for (const id of zine.fonts) {
    const family = await getFontFamily(db, id);
    if (family) custom.push(await choiceOf(db, family));
  }
  return [...BUILTIN_FONTS, ...custom];
}

/** Families uploaded to other zines that this zine does not list yet ("użyj fontu z innego zina"). */
export async function otherZineFamilies(db: ZiniarzDb, zine: Zine): Promise<FontChoice[]> {
  const own = new Set(zine.fonts);
  const families = (await listFontFamilies(db))
    .filter((family) => !own.has(family.id))
    .sort((a, b) => a.name.localeCompare(b.name, 'pl'));
  return Promise.all(families.map((family) => choiceOf(db, family)));
}
