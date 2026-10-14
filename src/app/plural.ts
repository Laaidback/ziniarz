/** Polish plural: plural(1, 'strona', 'strony', 'stron'), 2–4 'strony', 5+ and 12–14 'stron'. */
export function plural(count: number, one: string, few: string, many: string): string {
  if (count === 1) return one;
  const tens = count % 100;
  const units = count % 10;
  return units >= 2 && units <= 4 && (tens < 12 || tens > 14) ? few : many;
}

/** "20 stron", "1 kartka", "24 strony". */
export function countOf(count: number, one: string, few: string, many: string): string {
  return `${count} ${plural(count, one, few, many)}`;
}
