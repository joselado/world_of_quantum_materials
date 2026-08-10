import type { MaterialType } from './types';

// One physics-grounded blurb per real compound -- shown after a battle
// (BattleScene.endBattle, "tying the move/outcome to the real physics" per
// DESIGN.md §4) and collected in the Hub's Materialdex once a material has
// been seen (OverworldScene.recordDiscovery). Sourced from the same
// session01/session02 physics data/quiz.ts already draws its questions
// from. Materials without a dedicated entry fall back to a generic blurb
// keyed by MaterialType -- the same "not every world is filled in yet"
// pattern the per-world crystal/biome tables already use.
export const MATERIAL_BLURBS: Record<string, string> = {
  Graphene:
    "Graphene's honeycomb lattice carries two atoms per unit cell, and its bands touch linearly at the K and K' points -- electrons there behave as massless, relativistic (Dirac-like) particles instead of ordinary parabolic ones.",
  'Manganese Oxide':
    'MnO stays insulating even though a naive band picture would call its 3d electrons itinerant -- Hubbard repulsion U splits the band into lower and upper Hubbard bands, opening a Mott gap and locking in antiferromagnetic order.',
  'Nickel Oxide':
    "Like MnO, NiO is a textbook Mott insulator: on-site Coulomb repulsion, not a conventional band gap, is what keeps its electrons from conducting -- mean-field Hubbard theory captures the resulting antiferromagnetic order.",
  'Gallium Nitride':
    "GaN is an ordinary doped semiconductor -- its transport is governed by a single-particle band picture, with no symmetry breaking or topological structure involved.",
  'Magnesium Oxide':
    'MgO is a simple ionic band insulator, the textbook baseline against which topological insulators (a gapped spectrum for a very different reason) are usually contrasted.',
  'Rival Silicon':
    "Silicon's electrons fill a conventional band structure right up to a gap -- an ordinary semiconductor, no protected states or broken symmetry needed to explain it.",
  // CrI3 itself is "just" a van der Waals ferromagnet, not multiferroic --
  // twisting two layers together is what's new, and even then this is a
  // theoretical proposal (noncollinear moiré spin textures inducing
  // magnetoelectric coupling), not yet an established experimental result,
  // so this overrides the type's fallback blurb to say so rather than assert
  // it as settled fact.
  'Twisted CrI₃':
    'Untwisted CrI₃ is only an ordinary van der Waals ferromagnet -- stacking two layers at a twist angle is predicted to create noncollinear moiré spin textures whose magnetoelectric coupling would host genuine electromagnons.',
};

const TYPE_FALLBACK_BLURBS: Record<MaterialType, string> = {
  trivial:
    'An ordinary band insulator or metal -- its electrons are well described by a single-particle picture, with no symmetry breaking or topological protection involved.',
  magnet:
    'Its electrons order magnetically once interactions cross a critical strength -- mean-field theory (a Hubbard U opening a gap, or an ordered moment) is the right lens.',
  topological:
    'Its bulk gap hides a topologically protected edge or surface state, robust to local perturbations that would kill an ordinary state.',
  qhe: 'Under a strong magnetic field its electrons condense into quantized Landau levels, producing a Hall conductance quantized in units of e^2/h.',
  supercon:
    'Below its critical temperature, electrons pair into Cooper pairs and condense into a single phase-coherent state with zero DC resistance.',
  classicalmag:
    'Its magnetic moments order classically (ferro- or antiferromagnetically); its low-energy excitations are spin waves -- magnons.',
  tensornet:
    'Its ground state is highly entangled, resisting any simple product-state description -- exactly what tensor-network methods like MPS are built to represent.',
  spinliquid:
    'Frustration keeps its spins from ever ordering, even at zero temperature -- it stays in a highly entangled, fractionalized state instead.',
  defect: 'A localized defect or impurity binds its own resonance or bound state, distinct from the clean bulk around it.',
  adaptive: 'Not a real material -- an adaptive model that learns and exploits whatever strategy is thrown at it.',
  multiferroic:
    'Magnetically ordered with an electric polarization coupled to that order -- its spin waves (electromagnons) carry an electric-dipole activity an ordinary magnon never does.',
  chernInsulator:
    "Quantized Hall conductance even with no external magnetic field, from a nonzero Chern number baked into its own band structure rather than field-induced Landau levels.",
};

export function materialBlurb(material: { name: string; type: MaterialType }): string {
  return MATERIAL_BLURBS[material.name] ?? TYPE_FALLBACK_BLURBS[material.type];
}
