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

export const DEFAULT_ENCOUNTER_DENSITY = DENSITY_PRESETS[1].value; // Normal

// UI text-size presets for the same Settings panel -- a multiplier applied
// to every scene's authored base px size via ui/text.ts's fontPx(), read
// live (no re-generation needed, unlike density above) so a change is
// visible the next time any panel/label redraws. The scale is relative to
// the game's authored base sizes, which on their own read too small to be
// comfortable: 'Normal' is 1.5x those, and 'Large' 2x. Every panel adapts
// its own size to the content it holds (see e.g. hubStations.ts's
// showSettingsPanel own comment) rather than assuming a fixed pixel size,
// so all three presets have to lay out -- verify layout-sensitive screens
// by screenshot after touching either this list or a panel's layout.
export interface FontScalePreset {
  label: string;
  value: number;
}

export const FONT_SCALE_PRESETS: FontScalePreset[] = [
  { label: 'Compact', value: 1 },
  { label: 'Normal', value: 1.5 },
  { label: 'Large', value: 2 },
];

// The preset a save that has never set one starts at, decided per device
// rather than fixed: a handheld (isHandheldDevice() below) is held at a
// screen a fraction the size of a laptop's, so it defaults to 'Large',
// while everything else defaults to 'Normal'. Read only where a value is
// absent -- a stored preset is the player's own choice on either kind of
// device and is never overridden by this.
export function defaultFontScale(): number {
  return isHandheldDevice() ? FONT_SCALE_PRESETS[2].value : FONT_SCALE_PRESETS[1].value;
}

// Same Settings panel, Presentation: which of audio/music.ts's two score tables
// (SCORES/"Classic", SCORES_MODERN/"Modern") MusicEngine.play() draws from,
// plus "Mute" for no score at all. Turning the music off is a setting rather
// than a key: it is a preference a player makes once and keeps, so it belongs
// where the other preferences are and it persists with them, instead of
// resetting every time the game boots. Unlike density/font scale this takes
// effect immediately -- picking a new value calls music.setStyle(), which
// restarts whatever's currently playing under the new table, or silences it.
// Sound effects are unaffected: this row is the music. Exported here (rather
// than repeated as a literal union in music.ts/save.ts) so all three files
// stay in sync from one source.
export type MusicStyle = 'classic' | 'modern' | 'mute';

export interface MusicStylePreset {
  label: string;
  value: MusicStyle;
}

export const MUSIC_STYLE_PRESETS: MusicStylePreset[] = [
  { label: 'Classic', value: 'classic' },
  { label: 'Modern', value: 'modern' },
  { label: 'Mute', value: 'mute' },
];

export const DEFAULT_MUSIC_STYLE = MUSIC_STYLE_PRESETS[0].value; // Classic -- the original soundtrack stays the default

// Same Settings panel, Gameplay: how hard the world curve hits, a
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
}

export const DIFFICULTY_TIER_PRESETS: DifficultyTierPreset[] = [
  { label: 'B.Sc.', value: 'bsc' },
  { label: 'M.Sc.', value: 'msc' },
  { label: 'Ph.D.', value: 'phd' },
];

export const DEFAULT_DIFFICULTY_TIER: DifficultyTier = DIFFICULTY_TIER_PRESETS[1].value; // M.Sc. -- the tuned default

// Same Settings panel, Gameplay: how big a world is. One multiplicative
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

// Same Settings panel, Presentation: whether the overworld draws the on-screen
// arrows (scenes/overworld/touchControls.ts) that let a player walk without a
// keyboard. Walking is the one thing a pointer alone could not do -- every
// other action in the game already has a click target -- so on a phone or a
// tablet the arrows are what make the game playable at all.
//
// Three values rather than a plain on/off, because the right answer is
// usually "whichever device this is": 'auto' asks the browser (isTouchDevice
// below) and turns them on for a touchscreen, while 'on'/'off' are the
// player's own override in either direction (a desktop player who wants to
// walk by mouse, a laptop with a touchscreen who does not want the arrows
// over the world).
export type TouchControlsMode = 'auto' | 'on' | 'off';

export interface TouchControlsPreset {
  label: string;
  value: TouchControlsMode;
}

export const TOUCH_CONTROLS_PRESETS: TouchControlsPreset[] = [
  { label: 'Auto', value: 'auto' },
  { label: 'On', value: 'on' },
  { label: 'Off', value: 'off' },
];

export const DEFAULT_TOUCH_CONTROLS: TouchControlsMode = TOUCH_CONTROLS_PRESETS[0].value; // Auto -- on for a touchscreen

// Whether this browser reports a touchscreen at all. Asked of the input
// stack (a coarse pointer that can touch), never of the user-agent string:
// what matters is whether a finger can reach the arrows, not which device
// name the browser claims.
export function isTouchDevice(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  if (navigator.maxTouchPoints > 0) return true;
  return typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
}

// Whether this is a handheld -- a screen a finger drives with no mouse to
// hover with, i.e. a phone or a tablet. Deliberately stricter than
// isTouchDevice() above, which the walking arrows want: a laptop with a
// touchscreen still has a hovering pointer and a screen read at arm's
// length, so it is a desktop as far as text size is concerned. Falls back
// to "not a handheld" where the media-query API is missing.
export function isHandheldDevice(): boolean {
  if (typeof window === 'undefined') return false;
  if (typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(pointer: coarse) and (hover: none)').matches;
}

// The one place the mode turns into a yes/no, so every scene asking "are the
// arrows up" gets the same answer.
export function touchControlsActive(mode: TouchControlsMode): boolean {
  if (mode === 'on') return true;
  if (mode === 'off') return false;
  return isTouchDevice();
}

// The Settings panel's own top-level grouping (scenes/panels/hubStations.ts's
// showSettingsPanel): the panel shows one category at a time, picked from a
// strip of category buttons under its title. Nine rows at that panel's own
// row height do not fit the canvas at the largest text-size preset -- a value
// plate alone is ~43px tall there, so no row is shorter than ~55px, and a row
// carrying a multi-line "when" runs to ~100px, once the panel's title, its
// Close button and its margins are paid for. Three categories is what keeps
// every value plate on screen and directly clickable, which is the property
// this panel is built around: a setting's whole range readable at a glance
// rather than cycled through one step at a time. The ceiling is measured
// height, not a row count: Presentation's four rows already reach 448 of the
// canvas's 480 pixels at Large, so measure before adding a fifth anywhere
// (STYLE.md's Settings panel section carries the current numbers).
export type SettingsCategoryId = 'gameplay' | 'story' | 'presentation';

export interface SettingsCategory {
  id: SettingsCategoryId;
  label: string;
}

export const SETTINGS_CATEGORIES: SettingsCategory[] = [
  { id: 'gameplay', label: 'Gameplay' },
  { id: 'story', label: 'Story' },
  { id: 'presentation', label: 'Presentation' },
];

export const DEFAULT_SETTINGS_CATEGORY: SettingsCategoryId = SETTINGS_CATEGORIES[0].id;

// The Story category's two rows: whether the contextual tutorial tips
// (data/tutorial.ts's TUTORIAL_TIPS, OverworldScene.showTutorialTip/
// HubScene.maybeShowLabTip) and the story screens (a world's entry lore, a
// rival's taunt, the beat between worlds) stop play to be read.
//
// Off suppresses the screen, not the content. Each screen's own trigger still
// fires where it always did: it marks itself seen, then hands straight back to
// whatever it was gating, so `tutorialTipsSeen`/`worldLoreSeen` fill in exactly
// as they do with the screens on, the Lab's Tutorial and Story stations unmask
// their topics on the same schedule, and the skipped text stays readable there.
// The switch is for a player who has read it all already, or who would rather
// not be stopped; turning it back on plays the screens still ahead of them
// rather than replaying the ones already passed.
//
// Labelled "Story Screens" and "Tutorial Tips" in the panel rather than plain
// "Story"/"Tutorial", so an Off plate can't be read as removing the story from
// the game or closing the station that holds it.
export interface ToggleSettingPreset {
  label: string;
  value: boolean;
}

export const ON_OFF_PRESETS: ToggleSettingPreset[] = [
  { label: 'On', value: true },
  { label: 'Off', value: false },
];

export const DEFAULT_TUTORIAL_TIPS = true;

// Story screens are the one setting whose default depends on which mode's
// save slot it belongs to. Superposition Mode is the everything-open testing/
// exploration slot -- it has no road to walk, so a save there starts with the
// screens off and the story left in its station for whoever wants it. A Story
// Mode save starts with them on, since being told the story as it happens is
// the point of that slot.
export function defaultStoryScreens(superposition: boolean): boolean {
  return !superposition;
}

// The one place each toggle turns into a yes/no, so every scene asking "does
// this screen play" gets the same answer. Minimal structural registry type
// (mirrors data/save.ts's and data/tutorial.ts's own) so this stays a plain
// data module.
interface RegistryLike {
  get: (key: string) => unknown;
}

export function tutorialTipsEnabled(registry: RegistryLike): boolean {
  const value = registry.get('tutorialTipsEnabled');
  return typeof value === 'boolean' ? value : DEFAULT_TUTORIAL_TIPS;
}

export function storyScreensEnabled(registry: RegistryLike): boolean {
  const value = registry.get('storyScreensEnabled');
  if (typeof value === 'boolean') return value;
  return defaultStoryScreens(!!registry.get('superpositionMode'));
}
