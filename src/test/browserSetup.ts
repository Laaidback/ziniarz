import { setSystemFontAvailability } from '../fonts/systemFonts';

// Browser tests behave the same on a Mac (which has Ayuthaya) and on Linux CI (which does not):
// the system font counts as missing unless a test turns it back on (setSystemFontAvailability(id, null | true)).
setSystemFontAvailability('ayuthaya', false);
