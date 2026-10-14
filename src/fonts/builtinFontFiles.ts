import interLatin400 from '@fontsource/inter/files/inter-latin-400-normal.woff2?url';
import interLatinExt400 from '@fontsource/inter/files/inter-latin-ext-400-normal.woff2?url';
import interLatin700 from '@fontsource/inter/files/inter-latin-700-normal.woff2?url';
import interLatinExt700 from '@fontsource/inter/files/inter-latin-ext-700-normal.woff2?url';
import interLatin400Italic from '@fontsource/inter/files/inter-latin-400-italic.woff2?url';
import interLatinExt400Italic from '@fontsource/inter/files/inter-latin-ext-400-italic.woff2?url';
import interLatin700Italic from '@fontsource/inter/files/inter-latin-700-italic.woff2?url';
import interLatinExt700Italic from '@fontsource/inter/files/inter-latin-ext-700-italic.woff2?url';
import loraLatin400 from '@fontsource/lora/files/lora-latin-400-normal.woff2?url';
import loraLatinExt400 from '@fontsource/lora/files/lora-latin-ext-400-normal.woff2?url';
import loraLatin700 from '@fontsource/lora/files/lora-latin-700-normal.woff2?url';
import loraLatinExt700 from '@fontsource/lora/files/lora-latin-ext-700-normal.woff2?url';
import loraLatin400Italic from '@fontsource/lora/files/lora-latin-400-italic.woff2?url';
import loraLatinExt400Italic from '@fontsource/lora/files/lora-latin-ext-400-italic.woff2?url';
import loraLatin700Italic from '@fontsource/lora/files/lora-latin-700-italic.woff2?url';
import loraLatinExt700Italic from '@fontsource/lora/files/lora-latin-ext-700-italic.woff2?url';
import playfairDisplayLatin400 from '@fontsource/playfair-display/files/playfair-display-latin-400-normal.woff2?url';
import playfairDisplayLatinExt400 from '@fontsource/playfair-display/files/playfair-display-latin-ext-400-normal.woff2?url';
import playfairDisplayLatin700 from '@fontsource/playfair-display/files/playfair-display-latin-700-normal.woff2?url';
import playfairDisplayLatinExt700 from '@fontsource/playfair-display/files/playfair-display-latin-ext-700-normal.woff2?url';
import playfairDisplayLatin400Italic from '@fontsource/playfair-display/files/playfair-display-latin-400-italic.woff2?url';
import playfairDisplayLatinExt400Italic from '@fontsource/playfair-display/files/playfair-display-latin-ext-400-italic.woff2?url';
import playfairDisplayLatin700Italic from '@fontsource/playfair-display/files/playfair-display-latin-700-italic.woff2?url';
import playfairDisplayLatinExt700Italic from '@fontsource/playfair-display/files/playfair-display-latin-ext-700-italic.woff2?url';
import ebGaramondLatin400 from '@fontsource/eb-garamond/files/eb-garamond-latin-400-normal.woff2?url';
import ebGaramondLatinExt400 from '@fontsource/eb-garamond/files/eb-garamond-latin-ext-400-normal.woff2?url';
import ebGaramondLatin700 from '@fontsource/eb-garamond/files/eb-garamond-latin-700-normal.woff2?url';
import ebGaramondLatinExt700 from '@fontsource/eb-garamond/files/eb-garamond-latin-ext-700-normal.woff2?url';
import ebGaramondLatin400Italic from '@fontsource/eb-garamond/files/eb-garamond-latin-400-italic.woff2?url';
import ebGaramondLatinExt400Italic from '@fontsource/eb-garamond/files/eb-garamond-latin-ext-400-italic.woff2?url';
import ebGaramondLatin700Italic from '@fontsource/eb-garamond/files/eb-garamond-latin-700-italic.woff2?url';
import ebGaramondLatinExt700Italic from '@fontsource/eb-garamond/files/eb-garamond-latin-ext-700-italic.woff2?url';
import spaceMonoLatin400 from '@fontsource/space-mono/files/space-mono-latin-400-normal.woff2?url';
import spaceMonoLatinExt400 from '@fontsource/space-mono/files/space-mono-latin-ext-400-normal.woff2?url';
import spaceMonoLatin700 from '@fontsource/space-mono/files/space-mono-latin-700-normal.woff2?url';
import spaceMonoLatinExt700 from '@fontsource/space-mono/files/space-mono-latin-ext-700-normal.woff2?url';
import spaceMonoLatin400Italic from '@fontsource/space-mono/files/space-mono-latin-400-italic.woff2?url';
import spaceMonoLatinExt400Italic from '@fontsource/space-mono/files/space-mono-latin-ext-400-italic.woff2?url';
import spaceMonoLatin700Italic from '@fontsource/space-mono/files/space-mono-latin-700-italic.woff2?url';
import spaceMonoLatinExt700Italic from '@fontsource/space-mono/files/space-mono-latin-ext-700-italic.woff2?url';
import oswaldLatin400 from '@fontsource/oswald/files/oswald-latin-400-normal.woff2?url';
import oswaldLatinExt400 from '@fontsource/oswald/files/oswald-latin-ext-400-normal.woff2?url';
import oswaldLatin700 from '@fontsource/oswald/files/oswald-latin-700-normal.woff2?url';
import oswaldLatinExt700 from '@fontsource/oswald/files/oswald-latin-ext-700-normal.woff2?url';
import caveatLatin400 from '@fontsource/caveat/files/caveat-latin-400-normal.woff2?url';
import caveatLatinExt400 from '@fontsource/caveat/files/caveat-latin-ext-400-normal.woff2?url';
import caveatLatin700 from '@fontsource/caveat/files/caveat-latin-700-normal.woff2?url';
import caveatLatinExt700 from '@fontsource/caveat/files/caveat-latin-ext-700-normal.woff2?url';
import archivoBlackLatin400 from '@fontsource/archivo-black/files/archivo-black-latin-400-normal.woff2?url';
import archivoBlackLatinExt400 from '@fontsource/archivo-black/files/archivo-black-latin-ext-400-normal.woff2?url';

/** One weight/style of a bundled font, split by fontsource into a Latin and a Latin Extended file (Polish letters). */
export interface BuiltinFontFile {
  familyId: string;
  bold: boolean;
  italic: boolean;
  latin: string;
  latinExt: string;
}

// unicode-range values copied from the @fontsource CSS files.
export const LATIN_RANGE =
  'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
export const LATIN_EXT_RANGE =
  'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF';

/** Must list exactly the styles named in BUILTIN_FONTS (fontChoices.ts); a test checks it. */
export const BUILTIN_FONT_FILES: BuiltinFontFile[] = [
  { familyId: 'inter', bold: false, italic: false, latin: interLatin400, latinExt: interLatinExt400 },
  { familyId: 'inter', bold: true, italic: false, latin: interLatin700, latinExt: interLatinExt700 },
  { familyId: 'inter', bold: false, italic: true, latin: interLatin400Italic, latinExt: interLatinExt400Italic },
  { familyId: 'inter', bold: true, italic: true, latin: interLatin700Italic, latinExt: interLatinExt700Italic },
  { familyId: 'lora', bold: false, italic: false, latin: loraLatin400, latinExt: loraLatinExt400 },
  { familyId: 'lora', bold: true, italic: false, latin: loraLatin700, latinExt: loraLatinExt700 },
  { familyId: 'lora', bold: false, italic: true, latin: loraLatin400Italic, latinExt: loraLatinExt400Italic },
  { familyId: 'lora', bold: true, italic: true, latin: loraLatin700Italic, latinExt: loraLatinExt700Italic },
  { familyId: 'playfair-display', bold: false, italic: false, latin: playfairDisplayLatin400, latinExt: playfairDisplayLatinExt400 },
  { familyId: 'playfair-display', bold: true, italic: false, latin: playfairDisplayLatin700, latinExt: playfairDisplayLatinExt700 },
  { familyId: 'playfair-display', bold: false, italic: true, latin: playfairDisplayLatin400Italic, latinExt: playfairDisplayLatinExt400Italic },
  { familyId: 'playfair-display', bold: true, italic: true, latin: playfairDisplayLatin700Italic, latinExt: playfairDisplayLatinExt700Italic },
  { familyId: 'eb-garamond', bold: false, italic: false, latin: ebGaramondLatin400, latinExt: ebGaramondLatinExt400 },
  { familyId: 'eb-garamond', bold: true, italic: false, latin: ebGaramondLatin700, latinExt: ebGaramondLatinExt700 },
  { familyId: 'eb-garamond', bold: false, italic: true, latin: ebGaramondLatin400Italic, latinExt: ebGaramondLatinExt400Italic },
  { familyId: 'eb-garamond', bold: true, italic: true, latin: ebGaramondLatin700Italic, latinExt: ebGaramondLatinExt700Italic },
  { familyId: 'space-mono', bold: false, italic: false, latin: spaceMonoLatin400, latinExt: spaceMonoLatinExt400 },
  { familyId: 'space-mono', bold: true, italic: false, latin: spaceMonoLatin700, latinExt: spaceMonoLatinExt700 },
  { familyId: 'space-mono', bold: false, italic: true, latin: spaceMonoLatin400Italic, latinExt: spaceMonoLatinExt400Italic },
  { familyId: 'space-mono', bold: true, italic: true, latin: spaceMonoLatin700Italic, latinExt: spaceMonoLatinExt700Italic },
  { familyId: 'oswald', bold: false, italic: false, latin: oswaldLatin400, latinExt: oswaldLatinExt400 },
  { familyId: 'oswald', bold: true, italic: false, latin: oswaldLatin700, latinExt: oswaldLatinExt700 },
  { familyId: 'caveat', bold: false, italic: false, latin: caveatLatin400, latinExt: caveatLatinExt400 },
  { familyId: 'caveat', bold: true, italic: false, latin: caveatLatin700, latinExt: caveatLatinExt700 },
  { familyId: 'archivo-black', bold: false, italic: false, latin: archivoBlackLatin400, latinExt: archivoBlackLatinExt400 },
];
