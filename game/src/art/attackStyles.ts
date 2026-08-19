import type { MoveClass } from '../data/types';
import type { AttackShape } from '../audio/sfx';

// Each move class gets its own particle-effect silhouette, one per ordinary
// move, so every quasiparticle reads differently in battle on shape alone
// (art/attackShapes.ts draws them; each entry's comment says what the shape
// is and which physics it pictures). Identity rides on silhouette, not tint,
// along four axes -- topology/count, path geometry (up-bow for most,
// straight is phonon's alone, down-bow heavyFermion's, mirrored double-bow
// majorana's, no path for the rings), timing signature (smooth, stutter,
// mid-flight snap, discrete steps, breathing, slow lumber), and rotation
// sense (continuous spin is vison's alone; flip and braid rotate only in
// discrete steps) -- with each shape owning at least one axis value
// exclusively. 'beam'/'eruption' are never picked from here -- they're only
// ever reached via ANALYTIC_SHAPES' per-move-id override below (BattleScene's
// resolveHit always supplies one for Landau's two moves), so no class needs
// its own `shape: 'beam' | 'eruption'` entry -- and 'burst' has no class
// mapped to it at all (it stays in the AttackShape union as a playable
// silhouette for overrides).
export const EFFECT_STYLE: Record<MoveClass, { color: number; shape: AttackShape }> = {
  // Electron Pulse -- a fast, focused shot: a single glowing head on the
  // standard up-bowed arc, trailing a comet tail.
  electron: { color: 0x4a90d9, shape: 'bolt' },
  // Magnon Wave -- a transverse sine ribbon snaking across the field, the
  // spin wave's smooth crest drifting toward the target.
  magnon: { color: 0xd94a4a, shape: 'wave' },
  // Phonon Beam -- a straight dotted line of lattice sites with one
  // longitudinal compression pulse running down it: the only shape with no
  // bow at all, since a phonon rides the rigid crystal axis. The weakest
  // move in the game, landing the smallest impact.
  phonon: { color: 0xff8844, shape: 'lattice' },
  // Spinon Swap -- a singlet bond stretched until it thins and snaps, the
  // far half flying on to the target while the near half recoils: two
  // spinons where a bond was. Asymmetric where majorana's split is not.
  spinon: { color: 0x5ad9c9, shape: 'sever' },
  // Triplon Surge -- a bright triplet packet hopping dimer pad to dimer pad
  // in discrete jumps with visible dwells: a confined excitation moving
  // through a paved dimer background, never a glide.
  triplon: { color: 0xd94a8a, shape: 'hop' },
  // Electromagnon Drive -- magnon's ribbon grown perpendicular dipole teeth
  // that alternate side with the wave phase: a spin wave carrying an
  // electric dipole along, bristly against magnon's smooth curve.
  electromagnon: { color: 0xc94ac0, shape: 'combwave' },
  // Chiral Current -- an edge rail stroked in along the bow, then bright
  // dashes streaming along it single-file, all one way: a one-way edge
  // channel where nothing backscatters.
  chiral: { color: 0xd9c14a, shape: 'rail' },
  // Helical Lock -- two continuous strands entwined about the flight axis,
  // 180 degrees out of phase with node dots at their crossings, one crest
  // pattern drifting forward and the other backward: the counter-propagating
  // spin-locked edge pair.
  helical: { color: 0x8a4ad9, shape: 'helix' },
  // Higgs Oscillation -- a condensate orb breathing about a thin static
  // reference circle (the order parameter's magnitude oscillating about the
  // condensate minimum), ending in one deep contraction released as the
  // impact. Pale icy blue, the superconductor family's own hue.
  higgs: { color: 0xbfe8ff, shape: 'swell' },
  // Anyon Braid -- two compact dots exchanging positions in discrete
  // half-turn swaps as they cross the field, each crossing flashing and
  // leaving a small arc of phase residue hanging behind: the statistics live
  // in the exchange, so the exchanges leave marks.
  chargedAnyon: { color: 0xd9a24a, shape: 'braid' },
  // Majorana Split -- the windup's core splits into two dim half-glows on
  // widely separated mirrored arcs (the set's only double bow) that
  // reconverge exactly at the target, recombination being the impact flash.
  majorana: { color: 0x333333, shape: 'split' },
  // Heavy Fermion Drag -- the slowest shape in the set: a large massive body
  // lumbering across on the one path that sags below the line, small
  // conduction-electron motes spiralling in as the mass is dressed on, and
  // the ordinary set's biggest landing thud.
  heavyFermion: { color: 0xd9962a, shape: 'mass' },
  // Ferron Switch -- a double-headed polarization needle snapping 180
  // degrees between up and down in discrete flips as it travels: bistable
  // like the polarization it carries, never a continuous spin. Lands locked
  // reversed, kicking two opposed arrowheads outward.
  ferron: { color: 0xd96a8a, shape: 'flip' },
  // Vison Loop -- a small constant-radius rotor spinning fast as it
  // translates (a Z2 flux carried across the field, never expanding);
  // continuous rotation belongs to this shape alone. The loop around the
  // target flashes and inverts on arrival.
  vison: { color: 0x4ac9a0, shape: 'vortex' },
  // Plasmon Resonance -- two chasing wavefronts expanding from the caster
  // toward the target, the collective charge mode's alternating
  // compressions; the double front is what separates it from the screening
  // self-buff's single caster-centred ring below.
  plasmon: { color: 0x4ad9ff, shape: 'ring' },
  // Kondo's three self-buff moves (Spin Screening, Charge Screening,
  // Symmetry Cloud) share one cast look -- a single expanding wavefront
  // ('buffring') reading as an effect enveloping the caster, tinted Kondo's
  // own rust-orange (WORLD_GUARDIANS[8].strokeColor).
  // BattleScene.resolveSelfBuff passes the caster's own anchor as both
  // `from` and `to`, so the ring centers on the caster instead of traveling
  // to the opponent. The ring is only the cast's beat: the per-channel
  // distinction is carried by the persistent aura the buff wraps around the
  // caster's crystal for its duration (art/screeningAuras.ts), so unlike
  // Landau's/Skłodowska-Curie's moves these need no per-move-id shape
  // override.
  screening: { color: 0xe86a44, shape: 'buffring' },
};

// Per-move-id shape overrides for Landau's two Analytic moves -- the one pair where
// both moves (`skyfallBeam`, `groundEruption`) want two distinct silhouettes
// (a falling beam, a ground eruption) rather than sharing whichever
// ordinary EFFECT_STYLE shape their currently-tuned quasiparticle carries.
export const ANALYTIC_SHAPES: Record<string, AttackShape> = {
  skyfallBeam: 'beam',
  groundEruption: 'eruption',
};

// Per-move-id shape overrides for Skłodowska-Curie's two Ultimate moves
// (§5, World 10) -- same pattern as ANALYTIC_SHAPES above, one entry per
// move id rather than per quasiparticle class, since `ultimateMeteor`/
// `ultimateNova` want their own multi-phase "summon" silhouettes
// (art/attackUltimates.ts's playMeteor/playNova) regardless of whichever
// class each is currently tuned to.
export const ULTIMATE_SHAPES: Record<string, AttackShape> = {
  ultimateMeteor: 'meteor',
  ultimateNova: 'nova',
};

// Resolves which shape a given (moveClass, shapeOverride) pair actually
// plays -- the same precedence playAttackEffect itself uses (an override
// always wins over the class's own default). Exported for
// art/moveEffectPreview.ts, which needs to know a move's shape up front (to
// look up its total duration) without importing EFFECT_STYLE itself.
export function resolveAttackShape(moveClass: MoveClass, shapeOverride?: AttackShape): AttackShape {
  return shapeOverride ?? EFFECT_STYLE[moveClass].shape;
}
