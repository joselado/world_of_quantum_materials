import type { Material, MaterialType, Stats } from './types';
import { PLAYER_MATERIAL, DEFAULT_STATS, MOVES } from './materials';

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
  // Mentor ids (WORLD_MENTORS' `id` field) the player has opened the panel
  // of at least once -- drives the Advisors pause-menu list
  // (OverworldScene.showAdvisorsPanel), which should only offer mentors
  // actually met rather than every mentor in the game.
  metMentors: string[];
  // Whether the first-run tutorial popup sequence has already played
  // (OverworldScene.maybeShowFirstTimeTutorial) -- true after the first
  // Overworld scene ever created, so it doesn't replay on every visit. The
  // Enter-menu's "Tutorial" button replays the same pages on demand
  // regardless of this flag.
  tutorialSeen: boolean;
  // Title-screen toggle (TitleScene). While on, OverworldScene.create()
  // re-levels the player's stats/moves/HP to match enemyStatsForWorld() on
  // every world entry, and both the Hub's door and the Enter-menu gain a
  // "Warp" option that jumps straight to any of the 10 worlds regardless of
  // rivalDefeated progress -- a testing/exploration aid, not part of the
  // normal progression.
  debugMode: boolean;
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
    metMentors: [],
    tutorialSeen: false,
    debugMode: false,
  };
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
    metMentors: (registry.get('metMentors') as string[]) ?? [],
    tutorialSeen: (registry.get('tutorialSeen') as boolean) ?? false,
    debugMode: (registry.get('debugMode') as boolean) ?? false,
  };
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    // localStorage unavailable (private browsing, quota) -- progress just
    // won't survive a reload this session.
  }
}
