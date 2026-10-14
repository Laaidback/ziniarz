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

/**
 * Families uploaded to other zines that this zine does not have yet ("użyj fontu z innego zina").
 * Skips empty families and any whose name (ignoring case) the zine already has, so the list never
 * offers a second "Lato" next to the zine's own.
 */
export async function otherZineFamilies(db: ZiniarzDb, zine: Zine): Promise<FontChoice[]> {
  const ownIds = new Set(zine.fonts);
  const ownNames = new Set<string>();
  for (const id of zine.fonts) {
    const family = await getFontFamily(db, id);
    if (family) ownNames.add(family.name.toLowerCase());
  }
  const families = (await listFontFamilies(db))
    .filter((family) => !ownIds.has(family.id) && !ownNames.has(family.name.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name, 'pl'));
  const choices = await Promise.all(families.map((family) => choiceOf(db, family)));
  return choices.filter((choice) => choice.styles.length > 0);
}
