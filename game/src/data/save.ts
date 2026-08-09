import type { MaterialType } from './types';
import { PLAYER_MATERIAL } from './materials';

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
}

export function defaultSave(): SaveData {
  return {
    qumatokens: 0,
    unlockedMoves: [...PLAYER_MATERIAL.moves],
    playerHp: PLAYER_MATERIAL.maxHp,
    rivalDefeated: {},
    discoveredMaterials: [],
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
    return { ...defaultSave(), ...JSON.parse(raw) };
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
  };
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    // localStorage unavailable (private browsing, quota) -- progress just
    // won't survive a reload this session.
  }
}
