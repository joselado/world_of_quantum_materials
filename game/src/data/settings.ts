// Wild-encounter density presets for the Enter-menu's Settings panel
// (OverworldScene.showSettingsPanel) -- the player-facing knob on the
// per-corridor-row encounter roll generateMap() does at map-generation time.
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
// (see e.g. OverworldScene.showSettingsPanel's own comment) rather than
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
