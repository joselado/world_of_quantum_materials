import type { MoveClass } from '../data/types';
import type { AttackShape } from '../audio/sfx';

// Each move class gets a distinct particle-effect silhouette (not just a
// color swap) so different quasiparticles read differently in battle:
// bolt = a fast, focused shot (Phonon Beam, Electron Pulse, Spinon Swap,
// Triplon Surge, Chiral Current); ring = an expanding wave pulse (Magnon
// Pulse, Electromagnon Pulse, Plasmon Pulse, Ferron Pulse,
// Higgs Oscillation, Helical Current, Spin Screening); burst = many small
// particles converging/scattering (Anyon Braid, Majorana Split, Heavy
// Fermion Pulse, Vison Loop). 'beam'/'eruption' are never picked from here
// -- they're only ever reached via ANALYTIC_SHAPES' per-move-id override
// below (BattleScene's resolveHit always supplies one for Landau's two
// moves), so no class needs its own `shape: 'beam' | 'eruption'` entry.
export const EFFECT_STYLE: Record<MoveClass, { color: number; shape: AttackShape }> = {
  electron: { color: 0x4a90d9, shape: 'bolt' },
  magnon: { color: 0xd94a4a, shape: 'ring' },
  phonon: { color: 0xff8844, shape: 'bolt' },
  spinon: { color: 0x5ad9c9, shape: 'bolt' },
  // A dimer magnet's confined triplet mode -- a fast, focused shot like
  // Spinon Swap, tinted a distinct rose rather than spinon's teal.
  triplon: { color: 0xd94a8a, shape: 'bolt' },
  // Electromagnon Pulse -- a magnon-family excitation, so it shares
  // Magnon Pulse's expanding-ring silhouette, tinted the multiferroic
  // type's own magenta rather than magnon's red.
  electromagnon: { color: 0xc94ac0, shape: 'ring' },
  // A one-way edge current -- a fast, focused shot, golden rather than
  // Electron Pulse's blue.
  chiral: { color: 0xd9c14a, shape: 'bolt' },
  // A counter-propagating (two-way) edge pair -- an expanding ring rather
  // than chiral's single bolt, violet.
  helical: { color: 0x8a4ad9, shape: 'ring' },
  // A condensate's own amplitude oscillation -- an expanding ring, pale icy
  // blue (the superconductor family's own hue, lighter than plasmon's).
  higgs: { color: 0xbfe8ff, shape: 'ring' },
  // Fractional braiding statistics -- many small particles
  // converging/scattering.
  chargedAnyon: { color: 0xd9a24a, shape: 'burst' },
  majorana: { color: 0x333333, shape: 'burst' },
  // A mass-renormalized composite -- dense, converging/scattering particles,
  // tinted the kondoHeavyFermion type's own amber.
  heavyFermion: { color: 0xd9962a, shape: 'burst' },
  // The polarization order's own quantum -- an expanding ring like magnon's,
  // tinted the ferroelectric type's own rose.
  ferron: { color: 0xd96a8a, shape: 'ring' },
  // A Z2 gauge-flux vortex -- converging/scattering particles, teal-green.
  vison: { color: 0x4ac9a0, shape: 'burst' },
  // A collective charge oscillation reads as an expanding wave like Magnon
  // Pulse's ring, tinted an electric cyan instead of magnon's red.
  plasmon: { color: 0x4ad9ff, shape: 'ring' },
  // Kondo's three self-buff moves (Spin Screening, Charge Screening,
  // Symmetry Cloud) share one cast look -- an expanding ring reads as an
  // effect enveloping the caster, tinted Kondo's own rust-orange
  // (WORLD_GUARDIANS[8].strokeColor). BattleScene.resolveSelfBuff passes the
  // caster's own anchor as both `from` and `to`, so the ring centers on the
  // caster instead of traveling to the opponent. The ring is only the
  // cast's beat: the per-channel distinction is carried by the persistent
  // aura the buff wraps around the caster's crystal for its duration
  // (art/screeningAuras.ts), so unlike Landau's/Skłodowska-Curie's moves
  // these need no per-move-id shape override.
  screening: { color: 0xe86a44, shape: 'ring' },
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
