// The type system's sole source of truth. `TAXONOMY.txt` in this same
// directory is the hand-edited design spec this file implements -- when a
// MaterialType/MoveClass changes here, check whether that file needs the
// matching edit (and vice versa: an edit to TAXONOMY.txt means this file and
// materials.ts's MOVE_COMPATIBILITY need reconciling to match it).

export type MoveClass =
  // Ordinary band electron -- Electron Pulse's class.
  | 'electron'
  // Collective spin wave -- Magnon Pulse's class.
  | 'magnon'
  // Lattice vibration -- Phonon Beam's class, the one quasiparticle every
  // crystal hosts regardless of type, so it's on every type's
  // MOVE_COMPATIBILITY list and never triggers the quasiparticle-mismatch
  // bonus.
  | 'phonon'
  // Lattice-dressed/self-trapped charge carrier -- Polaron Drag's class.
  // Strongest in ionic insulators/oxides, not a bare metal or a narrow-gap
  // semiconductor, so it's on 'insulator' rather than 'metal'/'semiconductor'.
  | 'polaron'
  // Fractionalized spin excitation -- Spinon Swap's class.
  | 'spinon'
  // Propagating S=1 excitation of a singlet/dimer (valence-bond) ground
  // state -- Triplon Surge's class. A *confined* mode, conceptually the
  // opposite of a spinon's fractionalization, but both live on
  // 'quantumSpinLiquid' here (a deliberate simplification, not a claim that
  // every quantum-spin-liquid candidate is literally dimerized).
  | 'triplon'
  // Carries Electromagnon Pulse (multiferroic type only) -- the quasiparticle
  // a multiferroic hosts on top of its ordinary magnons, a spin wave that
  // picks up electric-dipole activity through magnon-phonon hybridization
  // (the magnetoelectric coupling itself).
  | 'electromagnon'
  // One-way edge/surface mode of a Chern band -- no backscattering channel,
  // time-reversal broken. Chiral Current's class.
  | 'chiral'
  // Counter-propagating, spin-momentum-locked edge/surface pair protected by
  // time reversal (a Kramers pair) -- Helical Current's class. Distinct from
  // 'chiral': a helical channel can backscatter a Kramers partner into its
  // pair without breaking time-reversal symmetry, a chiral one has no
  // partner to backscatter into at all.
  | 'helical'
  // Amplitude oscillation of an ordered/paired condensate -- Higgs
  // Oscillation's class. Needs actual long-range order (pairing here), not
  // just a gap.
  | 'higgs'
  // Fractional-statistics excitation (bulk and edge) carrying fractional
  // charge -- Anyon Braid's class, fractional states only. Distinct from
  // 'chiral'/'helical': those are ordinary (non-fractionalized) free-fermion
  // edge channels, ordinary once you're on the edge; a charged anyon's
  // fractional charge and braiding statistics are the actually exotic part.
  | 'chargedAnyon'
  // Non-Abelian zero mode -- Majorana Split's class. Needs genuine
  // topological *pairing* (vortices/edges of a chiral superconductor, or a
  // superconductor-proximitized topological surface) -- a topological gap
  // alone (no superconductivity in the picture at all) does not host one.
  | 'majorana'
  // Mass-renormalized conduction-electron/local-moment composite -- Heavy
  // Fermion Pulse's class, the Kondo-lattice hybridization quasiparticle.
  | 'heavyFermion'
  // Quantized excitation of the polarization order parameter -- Ferron
  // Pulse's class, the ferroelectric analog of a magnon. Distinct from
  // 'electromagnon': a ferron needs no magnetic order at all, while an
  // electromagnon is specifically a magnon hybridized with the electric
  // polarization.
  | 'ferron'
  // Z2 gauge-flux (vortex) excitation of a Z2 spin liquid -- Vison Loop's
  // class, spinon's topological-order companion.
  | 'vison'
  // Collective charge-density oscillation of a free electron gas -- Plasmon
  // Pulse's class. Only 'metal' hosts it (a partially filled band is what
  // lets a free electron gas support one at all).
  | 'plasmon'
  // Kondo's three moves (§5, World 8): Screening Pulse, Scattering Drag,
  // Coherence Cascade -- self-buffs, not attacks. Each deterministically
  // applies one of three 3-turn buffs to the *caster's own* side
  // (Shielded/Evasive/Regenerating, BattleScene's resolveHit/
  // resolveSelfBuff) instead of dealing damage. Left out of every type's
  // MOVE_COMPATIBILITY list entirely (see materials.ts) rather than gated
  // by it -- a self-buff never hosts/mismatches, so it doesn't need a
  // compatibility entry to be usable from any form.
  | 'screening';

export type MaterialType =
  // Ordinary conduction-electron metal/semimetal -- no gap, no symmetry
  // breaking, no topological structure, and (unlike 'semiconductor'/
  // 'insulator') a partially filled band, which is what lets it carry a
  // plasmon.
  | 'metal'
  // A wide-gap band compound (MgO) -- same "ordinary single-particle band
  // picture, no symmetry breaking or topology" physics as 'semiconductor',
  // just too wide a gap to practically dope/excite across. Hosts 'polaron'
  // instead of 'plasmon'/'electron' -- self-trapped polarons are strongest
  // in exactly this kind of ionic insulator/oxide.
  | 'insulator'
  // An ordinary gapped band compound with a narrow enough gap to dope/
  // thermally excite carriers across (Si, GaN) -- unlike 'metal', no
  // partially-filled band to carry a plasmon; unlike 'insulator', the gap is
  // narrow enough for an ordinary band electron to still get through.
  | 'semiconductor'
  // Magnetically ordered, magnon-carrying -- covers both the mean-field/
  // Mott-Hubbard route into symmetry-broken order (topic 1: MnO, NiO,
  // Chromium) and the classical itinerant-ferromagnet route (topic 6: Iron,
  // Cobalt, CrI₃), since both are the same ordered-moment phase of matter
  // with the same low-energy excitation, just reached via a different
  // derivation.
  | 'classicalMagnet'
  // Frustrated/fractionalized -- never orders, even at zero temperature.
  // Hosts both spinon (the fractionalized excitation itself) and vison (its
  // topological-order companion) and triplon (a dimerized/valence-bond
  // quantum-paramagnet's own confined mode, grouped in here rather than a
  // separate class).
  | 'quantumSpinLiquid'
  // Hybridized f-electron/conduction-electron compound (YbRh₂Si₂) -- the
  // Kondo-lattice physics topic 8's own guardian (Kondo) is named for, kept
  // distinct from 'quantumSpinLiquid' even though it also hosts 'spinon'
  // (Kondo-breakdown/fractionalized-Fermi-liquid physics at the quantum
  // critical point) since its defining excitation is the heavy-fermion
  // composite, not a frustrated magnet's own ground state.
  | 'kondoHeavyFermion'
  // Cooper pairing -- ordinary (s-wave or otherwise non-topological)
  // superconductivity.
  | 'superconductor'
  // A chiral/topological superconductor -- genuine topological *pairing*
  // (vortices/edges of a chiral SC, or a superconductor-proximitized
  // topological surface), which is what actually hosts Majorana zero modes.
  // Kept distinct from plain 'superconductor': an ordinary s-wave
  // superconductor's pairing alone does not host one.
  | 'chernSuperconductor'
  // Quantized Hall conductance from a nonzero (integer) Chern number, one
  // chiral edge channel -- whether via real Landau levels in a field or a
  // zero-field anomalous-Hall state (both are the same topological
  // invariant, so field-driven and zero-field integer Chern states share
  // one type rather than two).
  | 'chernInsulator'
  // A protected helical (time-reversal-protected) boundary state -- a bulk
  // 3D topological insulator's own spin-momentum-locked surface Dirac cone
  // (Bi₂Te₃), a single bulk-derived monolayer's own quantum spin Hall state
  // (Monolayer WTe₂), and the engineered-heterostructure route into that
  // same physics (a quantum well whose *inverted* band ordering, not any
  // bulk crystal symmetry, opens the gap) all live here rather than getting
  // separate 3D/2D/engineered types -- the boundary physics (helical, not
  // chiral) is what the game's move roster actually cares about, not the
  // bulk dimensionality. No Majorana mode on its own (no superconducting
  // proximity) -- see 'chernSuperconductor' for that.
  | 'quantumSpinHall'
  // A fractional Chern insulator -- unlike ordinary 'chernInsulator', its
  // edge is a fractionalized chiral mode whose quanta are charged anyons
  // with genuine braiding statistics, not free chiral fermions.
  | 'fractionalChern'
  // Electric polarization order with no magnetic order at all -- hosts
  // 'ferron', the polarization order parameter's own quantized excitation,
  // the non-magnetic analog of 'classicalMagnet''s magnon.
  | 'ferroelectric'
  // Magnetically ordered *and* magnetoelectrically coupled -- hosts both an
  // ordinary magnon, 'ferron' (the polarization order's own excitation),
  // and 'electromagnon' (the two hybridized together), all three distinct.
  | 'multiferroic';

export type CrystalVariant = 'shard' | 'cluster' | 'prism' | 'layer' | 'twisted';

export interface Move {
  id: string;
  name: string;
  class: MoveClass;
  power: number;
  // One-line effect description, shown under each row of Kondo's shop
  // (scenes/panels/kondo.ts) the same way data/passives.ts's own
  // `description` field is shown under each of Franklin's own rows.
  // Optional -- only Kondo's three self-buff moves carry one, since every
  // other move's physics-flavored name plus its fixed power/class already
  // says what it does.
  description?: string;
}

export interface Material {
  name: string;
  // A short chemical-formula/acronym form (e.g. "MnO", "YIG"), for a spot
  // where the full descriptive `name` is too long -- optional, since it's
  // only worth authoring where a genuinely shorter, recognizable form
  // exists (data/materials.ts's `materialDisplayName` is the one place
  // that reads it today, for the Materialdex's "Name (ShortName)" line).
  // Not set for a compound where `name` already is that short form (e.g.
  // "YBCO", "Bi₂Te₃").
  shortName?: string;
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
