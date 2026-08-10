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
