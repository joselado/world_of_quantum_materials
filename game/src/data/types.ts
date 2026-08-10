// Mirrors the shape of ../../../data/materials.json (the design-time reference
// for the full 10-type roster) -- this file is what the running game actually
// imports and type-checks against.

export type MoveClass =
  | 'trivial'
  | 'magnetic'
  | 'thermal'
  | 'localization'
  | 'gauge'
  | 'entanglement'
  | 'decoherence';

export type MaterialType =
  | 'trivial'
  | 'magnet'
  | 'topological'
  | 'qhe'
  | 'supercon'
  | 'classicalmag'
  | 'tensornet'
  | 'spinliquid'
  | 'defect'
  | 'adaptive';

export type CrystalVariant = 'shard' | 'cluster' | 'prism';

export interface Move {
  id: string;
  name: string;
  class: MoveClass;
  power: number;
}

export interface Material {
  name: string;
  type: MaterialType;
  color: number;
  variant: CrystalVariant;
  maxHp: number;
  moves: string[];
}

// Quantumness -> crit ("coherent hit") chance; Velocity -> which side acts
// first each round; Correlation -> defense (per DESIGN.md §3's attribute
// table). Only the player and the current world's opponent carry a live
// Stats block (see data/materials.ts's DEFAULT_STATS/enemyStatsForWorld) --
// ordinary wild/rival Material rows don't need their own, since opponent
// stats scale off the world number rather than the species.
export interface Stats {
  quantumness: number;
  velocity: number;
  correlation: number;
}
