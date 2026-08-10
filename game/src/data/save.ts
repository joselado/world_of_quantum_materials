import type { Material, MaterialType, Stats } from './types';
import { PLAYER_MATERIAL, DEFAULT_STATS, MOVES } from './materials';
import { DEFAULT_ENCOUNTER_DENSITY, DEFAULT_FONT_SCALE } from './settings';

// Single localStorage-backed save slot (v1: one profile, no cloud sync --
// matches DESIGN.md §7). TitleScene reads this once at boot into the Phaser
// registry, the runtime source of truth every scene already reads/writes;
// persistFromRegistry() is then called after each registry mutation that
// should survive a reload (token pickup, move purchase, rival defeat,
// battle outcome) so the two never drift far apart.
const SAVE_KEY = 'qm-rpg-save-v1';

export interface DiscoveredMaterial {
  name: string;
  type: MaterialType;
}

export interface SaveData {
  qumatokens: number;
  unlockedMoves: string[];
  playerHp: number;
  rivalDefeated: Record<number, boolean>;
  discoveredMaterials: DiscoveredMaterial[];
  // Added alongside the stats/teleport/transmutation batch:
  playerStats: Stats;
  visitedWorlds: number[];
  defeatedMaterials: DiscoveredMaterial[];
  playerForm: Material | null; // null = still the default PLAYER_MATERIAL (Silicon)
  // Every hybrid the player has ever created with Majorana's combine panel
  // (data/materials.ts's combineMaterials, §5) -- playerForm round-trips a
  // whole Material object already, so the *current* hybrid survives a
  // reload for free, but this list is what lets the panel offer "become
  // again" for an earlier hybrid without recombining its two parents.
  hybridMaterials: Material[];
  // Mentor ids (WORLD_MENTORS' `id` field) the player has opened the panel
  // of at least once -- drives the Advisors pause-menu list
  // (OverworldScene.showAdvisorsPanel), which should only offer mentors
  // actually met rather than every mentor in the game.
  metMentors: string[];
  // Which contextual tutorial tips (data/tutorial.ts's TutorialTipId) have
  // already fired -- each one plays once, the first time its own feature
  // becomes relevant (HubScene.maybeShowLabTip, OverworldScene
  // .showTutorialTip), rather than one paged sequence up front. The
  // Enter-menu's "Tutorial" button replays the full set as a paged recap on
  // demand regardless of this list.
  tutorialTipsSeen: string[];
  // Title-screen toggle (TitleScene), "Superposition Mode" -- a testing/
  // exploration aid, not part of the normal progression. While on,
  // OverworldScene.create() re-levels the player's stats/moves/HP to match
  // enemyStatsForWorld() on every world entry, pre-seeds `visitedWorlds`
  // with every BUILT_WORLDS entry so Bloch's existing teleport hub (no
  // separate warp UI needed) can fold the player to any world immediately,
  // and Bohr/Majorana's panels offer every crystal/hybrid pairing rather
  // than only ones actually defeated.
  superpositionMode: boolean;
  // Enter-menu Settings panel (OverworldScene.showSettingsPanel): the
  // per-corridor-row chance a wild crystal spawns, one of data/settings.ts's
  // DENSITY_PRESETS. Only affects maps generated after the change (a fresh
  // world entry/regenerate), not the map the player is currently standing
  // on.
  encounterDensity: number;
  // Same Settings panel, second row: the multiplier ui/text.ts's fontPx()
  // applies to every scene's authored base px size, one of data/settings.ts's
  // FONT_SCALE_PRESETS. Unlike encounterDensity this takes effect immediately
  // (read live on every fontPx() call), not just on the next map generation.
  fontScale: number;
}

export function defaultSave(): SaveData {
  return {
    qumatokens: 0,
    unlockedMoves: [...PLAYER_MATERIAL.moves],
    playerHp: PLAYER_MATERIAL.maxHp,
    rivalDefeated: {},
    discoveredMaterials: [],
    playerStats: { ...DEFAULT_STATS },
    visitedWorlds: [],
    defeatedMaterials: [],
    playerForm: null,
    hybridMaterials: [],
    metMentors: [],
    tutorialTipsSeen: [],
    superpositionMode: false,
    encounterDensity: DEFAULT_ENCOUNTER_DENSITY,
    fontScale: DEFAULT_FONT_SCALE,
  };
}

// Wipes the save slot so the next loadSave() starts a fresh run --
// TitleScene's "New Game" reset button. Callers must also re-seed the
// registry (e.g. via scene.restart()) since this only clears localStorage.
export function clearSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // localStorage unavailable -- nothing to clear.
  }
}

export function hasSave(): boolean {
  try {
    return localStorage.getItem(SAVE_KEY) !== null;
  } catch {
    return false;
  }
}

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return defaultSave();
    const data: SaveData = { ...defaultSave(), ...JSON.parse(raw) };
    // Drop moves a prior version of the game unlocked but this version no
    // longer defines (e.g. a renamed/retired move id) -- otherwise every
    // panel that looks up MOVES[id] for an unlocked move crashes on an
    // old save.
    data.unlockedMoves = data.unlockedMoves.filter((id) => id in MOVES);
    return data;
  } catch {
    return defaultSave();
  }
}

// Minimal structural type instead of importing Phaser here, so this module
// stays a plain data/storage concern -- any object with `.get` (a real
// Phaser.Data.DataManager, in practice) works.
interface RegistryLike {
  get: (key: string) => unknown;
}

export function persistFromRegistry(registry: RegistryLike) {
  const data: SaveData = {
    qumatokens: (registry.get('qumatokens') as number) ?? 0,
    unlockedMoves: (registry.get('unlockedMoves') as string[]) ?? [...PLAYER_MATERIAL.moves],
    playerHp: (registry.get('playerHp') as number) ?? PLAYER_MATERIAL.maxHp,
    rivalDefeated: (registry.get('rivalDefeated') as Record<number, boolean>) ?? {},
    discoveredMaterials: (registry.get('discoveredMaterials') as DiscoveredMaterial[]) ?? [],
    playerStats: (registry.get('playerStats') as Stats) ?? { ...DEFAULT_STATS },
    visitedWorlds: (registry.get('visitedWorlds') as number[]) ?? [],
    defeatedMaterials: (registry.get('defeatedMaterials') as DiscoveredMaterial[]) ?? [],
    playerForm: (registry.get('playerForm') as Material | null) ?? null,
    hybridMaterials: (registry.get('hybridMaterials') as Material[]) ?? [],
    metMentors: (registry.get('metMentors') as string[]) ?? [],
    tutorialTipsSeen: (registry.get('tutorialTipsSeen') as string[]) ?? [],
    superpositionMode: (registry.get('superpositionMode') as boolean) ?? false,
    encounterDensity: (registry.get('encounterDensity') as number) ?? DEFAULT_ENCOUNTER_DENSITY,
    fontScale: (registry.get('fontScale') as number) ?? DEFAULT_FONT_SCALE,
  };
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    // localStorage unavailable (private browsing, quota) -- progress just
    // won't survive a reload this session.
  }
}
