// Shared style constants for the marketing landing page. The landing deliberately uses a
// hardcoded, theme-independent palette (vivid orange / near-black / cream) so the
// color-blocked design reads identically regardless of the app's global light/dark toggle.
// Values mirror the Spanlyfy brand tokens in globals.css but are pinned as literal classes
// (Tailwind arbitrary values need underscores in place of spaces).

export const BG_BLACK = "bg-[hsl(20_14%_5%)]";
export const BG_ORANGE = "bg-[hsl(22_92%_52%)]";
export const BG_CREAM = "bg-[hsl(30_40%_99%)]";

export const TEXT_LIGHT = "text-[hsl(30_25%_96%)]";
export const TEXT_DARK = "text-[hsl(24_24%_12%)]";
export const TEXT_MUTED_LIGHT = "text-[hsl(30_10%_70%)]";
export const TEXT_MUTED_DARK = "text-[hsl(24_10%_42%)]";
export const TEXT_ORANGE = "text-[hsl(22_92%_52%)]";

export const BORDER_LIGHT = "border-white/15";
export const BORDER_DARK = "border-black/10";

// Outer section padding shared by every band.
export const SECTION_X = "px-6 sm:px-10 lg:px-16";
