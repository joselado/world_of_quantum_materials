// Colors reused for a shared UI role across multiple scene/panel files (a panel
// background, an "active/highlighted" accent, etc.), pulled here so the meaning
// stays defined in one place instead of the same hex repeated at every call site.
// A guardian's own identity color (their `art/<guardian>.ts` avatar plus their
// `scenes/panels/<guardian>.ts` panel) stays a literal in those two files instead --
// it never appears outside that pair, so there's nothing to share. Numeric constants
// are Phaser's `0xRRGGBB` fill/stroke color; the `_HEX` twins are the equivalent
// `'#RRGGBB'` CSS-style string Phaser text styles take.

// Dialogue/panel background fill, every guardian/reference/story panel.
export const PANEL_BG = 0x10101c;

// Active/highlighted gold accent: Noether's own color, reused system-wide for
// the in-battle analytic-question panel, world-finale panel, and
// BattleScene's boost halo/ring.
export const GOLD_ACCENT = 0xffe066;
export const GOLD_ACCENT_HEX = '#ffe066';

// Reference-station blue-grey (Lab's Moves/Stats/Abilities/Settings panels and
// their icons), also used broadly as muted/secondary text color. Deliberately
// distinct from the wild-encounter panel's own blue-grey (0x444466).
export const REFERENCE_BLUE_GREY = 0x8fa0c9;
export const REFERENCE_BLUE_GREY_HEX = '#8fa0c9';

// Tutorial panel/icon stroke.
export const TUTORIAL_CYAN = 0x5ad9ff;
export const TUTORIAL_CYAN_HEX = '#5ad9ff';

// Story-beat, start-door, and world-transition portal stroke, also the Lab's
// Story station panel/icon.
export const STORY_LAVENDER = 0xd9a5ff;
export const STORY_LAVENDER_HEX = '#d9a5ff';
