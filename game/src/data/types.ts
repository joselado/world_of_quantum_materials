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
  | 'decoherence'
  // Curie's moves (§5, World 6): using one asks an analytic-equation
  // question first (data/quiz.ts's ANALYTIC_QUESTIONS) -- answering right
  // doubles the hit, answering wrong halves it. Not gated by
  // MOVE_COMPATIBILITY the way every other class is (see that table's own
  // comment) -- these are a technique the player learned, not a quasiparticle
  // a crystal's own physics has to host, so they're usable/purchasable from
  // any form.
  | 'analytic';

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

export type CrystalVariant = 'shard' | 'cluster' | 'prism' | 'layer' | 'twisted';

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
  // Set only for a Majorana-fused hybrid (data/materials.ts's
  // combineMaterials) -- both parents' own look, carried forward so
  // art/crystals.ts can render the fused crystal as an actual mixture
  // instead of just `color`'s flat blend. Optional so a hybrid `playerForm`
  // loaded from a save written before this field existed still round-trips
  // (JSON.parse just omits the key) and falls back to the ordinary
  // single-shape render rather than throwing.
  hybridParents?: {
    colorA: number;
    variantA: CrystalVariant;
    colorB: number;
    variantB: CrystalVariant;
  };
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
