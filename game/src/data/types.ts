// The type system's sole source of truth -- there used to be a fuller
// repo-root data/materials.json "design-time reference" this mirrored, but it
// had drifted out of sync with real implementation decisions (a
// type-effectiveness chart and an "Impurity Scatter" move, both later
// deliberately dropped -- see materials.ts) and was removed rather than kept
// in sync by hand.

export type MoveClass =
  | 'trivial'
  | 'magnetic'
  | 'thermal'
  | 'localization'
  | 'gauge'
  | 'entanglement'
  | 'decoherence'
  // Carries Electromagnon Pulse (multiferroic type only) -- the quasiparticle
  // a multiferroic hosts on top of its ordinary magnons, a spin wave that
  // picks up electric-dipole activity through magnon-phonon hybridization
  // (the magnetoelectric coupling itself).
  | 'magnetoelectric'
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
  | 'adaptive'
  // Magnetically ordered with an additional electric polarization coupled to
  // it (electromagnon-hosting) -- distinct from a plain classicalmag/magnet,
  // which has no such magnetoelectric coupling.
  | 'multiferroic'
  // A 2D state with quantized Hall conductance at zero external field from a
  // nonzero Chern number of its bands (as opposed to 'qhe', reserved here for
  // field-driven Landau-level physics) -- shares 'topological'/'qhe''s gauge
  // quasiparticle family (edge modes, and anyons where the state is
  // fractional) rather than hosting a class of its own.
  | 'chernInsulator';

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
