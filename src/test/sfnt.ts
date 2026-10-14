export interface SfntOptions {
  /** name table entries by nameID (1 family, 2 subfamily, 16/17 typographic family/subfamily). */
  names: Record<number, string>;
  /** When set (or `weight` is set), an OS/2 table is written. Bit 0 italic, bit 5 bold, bit 6 regular. */
  fsSelection?: number;
  weight?: number;
}

function utf16be(text: string): Uint8Array {
  const out = new Uint8Array(text.length * 2);
  for (let i = 0; i < text.length; i++) {
    out[2 * i] = text.charCodeAt(i) >> 8;
    out[2 * i + 1] = text.charCodeAt(i) & 0xff;
  }
  return out;
}

/** A minimal TrueType file with only `name` (and optionally `OS/2`): enough for the name reader, not a real font. */
export function buildSfnt(options: SfntOptions): ArrayBuffer {
  const strings = Object.entries(options.names).map(([id, value]) => ({ id: Number(id), bytes: utf16be(value) }));
  const recordsLength = 6 + strings.length * 12;
  const nameLength = recordsLength + strings.reduce((sum, s) => sum + s.bytes.length, 0);
  const withOs2 = options.fsSelection !== undefined || options.weight !== undefined;
  const tables = [...(withOs2 ? [{ tag: 'OS/2', length: 78 }] : []), { tag: 'name', length: nameLength }];
  let offset = 12 + tables.length * 16;
  const placed = tables.map((table) => {
    const at = { ...table, offset };
    offset += table.length;
    return at;
  });
  const buffer = new ArrayBuffer(offset);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  view.setUint32(0, 0x00010000);
  view.setUint16(4, tables.length);
  placed.forEach((table, i) => {
    const record = 12 + i * 16;
    for (let c = 0; c < 4; c++) view.setUint8(record + c, table.tag.charCodeAt(c));
    view.setUint32(record + 8, table.offset);
    view.setUint32(record + 12, table.length);
  });
  for (const table of placed) {
    if (table.tag === 'OS/2') {
      view.setUint16(table.offset + 4, options.weight ?? 400);
      view.setUint16(table.offset + 62, options.fsSelection ?? 0x40);
      continue;
    }
    view.setUint16(table.offset + 2, strings.length);
    view.setUint16(table.offset + 4, recordsLength);
    let stringOffset = 0;
    strings.forEach((s, i) => {
      const record = table.offset + 6 + i * 12;
      view.setUint16(record, 3); // Windows
      view.setUint16(record + 2, 1); // Unicode BMP
      view.setUint16(record + 4, 0x409); // English (US)
      view.setUint16(record + 6, s.id);
      view.setUint16(record + 8, s.bytes.length);
      view.setUint16(record + 10, stringOffset);
      bytes.set(s.bytes, table.offset + recordsLength + stringOffset);
      stringOffset += s.bytes.length;
    });
  }
  return buffer;
}
