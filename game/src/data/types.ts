// The type system's sole source of truth -- there used to be a fuller
// repo-root data/materials.json "design-time reference" this mirrored, but it
// had drifted out of sync with real implementation decisions (a
// type-effectiveness chart and an "Impurity Scatter" move, both later
// deliberately dropped -- see materials.ts) and was removed rather than kept
// in sync by hand.

export type MoveClass =
  | 'trivial'
  | 'magnetic'
  // Phonon Beam's class -- lattice vibrations, the one quasiparticle every
  // crystal hosts regardless of type, so it's on every type's
  // MOVE_COMPATIBILITY list and never triggers the quasiparticle-mismatch
  // bonus.
  | 'phonon'
  | 'localization'
  | 'gauge'
  | 'entanglement'
  | 'decoherence'
  // Carries Electromagnon Pulse (multiferroic type only) -- the quasiparticle
  // a multiferroic hosts on top of its ordinary magnons, a spin wave that
  // picks up electric-dipole activity through magnon-phonon hybridization
  // (the magnetoelectric coupling itself).
  | 'magnetoelectric'
  // Kondo's three moves (§5, World 8): Screening Pulse, Scattering Drag,
  // Decoherence Cascade -- each deterministically inflicts one of three
  // 3-turn status effects on the defender (Screened/Localized/Decohered,
  // BattleScene's resolveHit) rather than dealing much raw damage itself.
  // This class is on every type's MOVE_COMPATIBILITY list (see
  // materials.ts) -- usable from any form, never mismatched, since these
  // deal in a generic scattering/decoherence process rather than a
  // quasiparticle tied to one specific type's band structure.
  | 'screening';

export type MaterialType =
  | 'trivial'
  | 'magnet'
  | 'topological'
  | 'qhe'
  | 'supercon'
  | 'classicalmag'
  // Entangled/fractionalized ground states -- covers both the exactly-
  // solvable dimerized/entangled textbook compounds (World 7) and the
  // spin-liquid candidates that never settle on a conventional order (World
  // 8); both worlds' crystals are physically the same quasiparticle family
  // (Spinon Swap), just at different points along that topic's teaching arc.
  | 'spinliquid'
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
