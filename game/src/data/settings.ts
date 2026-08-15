// Wild-encounter density presets for the Lab's Settings station
// (scenes/panels/hubStations.ts's showSettingsPanel) -- the player-facing knob on the
// per-corridor-row encounter roll generateMap() does at map-generation time,
// and through the population that roll produces, the ceiling respawns refill
// a walked world back toward (OverworldScene's respawnWild).
// Kept as plain data (rather than living in OverworldScene itself) so
// data/save.ts's default and OverworldScene's generation logic both read the
// same numbers without either file importing from the other.
export interface DensityPreset {
  label: string;
  value: number;
}

export const DENSITY_PRESETS: DensityPreset[] = [
  { label: 'Low', value: 0.08 },
  { label: 'Normal', value: 0.12 },
  { label: 'High', value: 0.22 },
  { label: 'Very High', value: 0.35 },
];

export const DEFAULT_ENCOUNTER_DENSITY = DENSITY_PRESETS[1].value; // Normal -- matches the old fixed ENCOUNTER_CHANCE

// UI text-size presets for the same Settings panel -- a multiplier applied
// to every scene's authored base px size via ui/text.ts's fontPx(), read
// live (no re-generation needed, unlike density above) so a change is
// visible the next time any panel/label redraws. 'Normal' is 1.5x the
// original pre-this-setting sizes (the game's default text was judged too
// small to read comfortably, but a full 2x default ran wide of what
// several fixed-size panels -- and BattleScene's move menu, a hard
// geometric box -- could actually hold without overlapping text). 2x is
// still offered as the top 'Large' preset for players who want it, since
// by then every panel has been made to adapt its own size to the content
// (see e.g. hubStations.ts's showSettingsPanel own comment) rather than
// assume a fixed pixel size -- verify layout-sensitive screens by
// screenshot after touching either this list or a panel's layout.
export interface FontScalePreset {
  label: string;
  value: number;
}

export const FONT_SCALE_PRESETS: FontScalePreset[] = [
  { label: 'Compact', value: 1 },
  { label: 'Normal', value: 1.5 },
  { label: 'Large', value: 2 },
];

export const DEFAULT_FONT_SCALE = FONT_SCALE_PRESETS[1].value; // Normal -- the new 1.5x default

// Same Settings panel, third row: which of audio/music.ts's two score
// tables (SCORES/"Classic", SCORES_MODERN/"Modern") MusicEngine.play() draws
// from. Unlike density/font scale this takes effect immediately -- picking a
// new value calls music.setStyle(), which restarts whatever's currently
// playing under the new table. Exported here (rather than repeated as a
// literal union in music.ts/save.ts) so all three files stay in sync from
// one source.
export type MusicStyle = 'classic' | 'modern';

export interface MusicStylePreset {
  label: string;
  value: MusicStyle;
}

export const MUSIC_STYLE_PRESETS: MusicStylePreset[] = [
  { label: 'Classic', value: 'classic' },
  { label: 'Modern', value: 'modern' },
];

export const DEFAULT_MUSIC_STYLE = MUSIC_STYLE_PRESETS[0].value; // Classic -- the original soundtrack stays the default

// Same Settings panel, fourth row: how hard the world curve hits, a
// multiplier applied to every stat data/balance.ts's enemyStatsForWorld
// returns (DIFFICULTY_MULTIPLIERS, that file). Named after
// game/scripts/balance-sim.mjs's own three simulated playtest archetypes
// rather than a plain Easy/Normal/Hard, since each tier's multiplier is
// tuned and verified (`npm run balance-sim`) against that archetype's own
// effort level -- M.Sc. ("the intended default") is what every other
// constant in balance.ts is already written against, so it's the one tier
// that leaves the curve unscaled. Unlike density/font/music above, this is
// meant to be revisited mid-playthrough (a fight going worse or better than
// expected), not just picked once -- BattleScene/OverworldScene both read it
// live from the registry on every battle/re-level, nothing needs a restart.
export type DifficultyTier = 'bsc' | 'msc' | 'phd';

export interface DifficultyTierPreset {
  label: string;
  value: DifficultyTier;
  // A one-line in-character gloss for the Settings panel -- flavor, not a
  // mechanics explanation (the panel's own hint line covers what actually
  // changes).
  blurb: string;
}

export const DIFFICULTY_TIER_PRESETS: DifficultyTierPreset[] = [
  { label: 'B.Sc.', value: 'bsc', blurb: "You handed in the problem set. Late. That's basically a pass." },
  { label: 'M.Sc.', value: 'msc', blurb: 'You understood the problem set. Mostly.' },
  { label: 'Ph.D.', value: 'phd', blurb: 'You ARE the problem set now.' },
];

export const DEFAULT_DIFFICULTY_TIER: DifficultyTier = DIFFICULTY_TIER_PRESETS[1].value; // M.Sc. -- the tuned default

// Same Settings panel, fifth row: how big a world is. One multiplicative
// factor applied to every length the overworld is built out of -- the grid
// itself, every corridor width, every branch/spur/spiral, every stretch
// measured in rows -- so a world keeps its shape and changes only its size
// (world/generators/shared.ts's WorldScale, scenes/overworld/projection.ts's
// active grid dimensions). Tile size on screen and draw distance are
// untouched, so a bigger world is a longer walk down a wider corridor rather
// than the same walk seen from further away.
//
// Named for the length scales a materials physicist actually works at, and
// spaced the way those names are: Meso is the tuned default every other
// mapgen constant is written against, Nano is a brisk run through the same
// world, and Macro is a genuinely large one -- three times the corridor in
// every direction, which is where the world stops fitting in a single view
// and starts being something the player crosses.
export type WorldSizeId = 'nano' | 'meso' | 'macro';

export interface WorldSizePreset {
  label: string;
  value: WorldSizeId;
  factor: number;
}

export const WORLD_SIZE_PRESETS: WorldSizePreset[] = [
  { label: 'Nano', value: 'nano', factor: 0.7 },
  { label: 'Meso', value: 'meso', factor: 1 },
  { label: 'Macro', value: 'macro', factor: 3 },
];

export const DEFAULT_WORLD_SIZE: WorldSizeId = WORLD_SIZE_PRESETS[1].value; // Meso -- the unscaled world

// The Meso grid, which every other size is this one times its own factor.
export const BASE_GRID_W = 27;
export const BASE_GRID_H = 50;

export function worldSizeFactor(id: WorldSizeId): number {
  return WORLD_SIZE_PRESETS.find((p) => p.value === id)?.factor ?? 1;
}

// The grid a given factor asks for. Both dimensions scale: a world that grew
// only longer would be the same corridor walked for longer, and the point of
// the setting is a bigger world, not a slower one.
export function gridDimsFor(factor: number): { w: number; h: number } {
  return { w: Math.round(BASE_GRID_W * factor), h: Math.round(BASE_GRID_H * factor) };
}
