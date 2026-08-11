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
  'HgTe/CdTe Quantum Well':
    'Neither HgTe nor CdTe is topological on its own -- but thin a layer of (inverted-gap) HgTe between CdTe barriers to the right thickness and the bands invert, opening a gap that hides a protected helical edge state: the original Bernevig-Hughes-Zhang quantum spin Hall insulator (König et al., Science 2007).',
  'Mn/Nb Shiba Chain':
    "A single magnetic Mn adatom on an ordinary s-wave superconductor like Nb binds a Yu-Shiba-Rusinov state inside the gap (Yazdani et al., Science 1997) -- the single-impurity precursor to the engineered many-impurity chains (like Fe/Pb) that host actual Majorana zero modes.",
  'Y₂BaNiO₅':
    "This S=1 Heisenberg chain opens a Haldane gap rather than ordering -- its ground state is adiabatically connected to the AKLT state, the exactly solvable valence-bond-solid wavefunction matrix product states were introduced to describe in the first place.",
  'YbRh₂Si₂':
    'A conduction electron entangling with a local Yb 4f-moment renormalizes into a quasiparticle hundreds of times heavier than a bare electron -- YbRh₂Si₂ sits right at the Kondo-lattice quantum critical point where that heavy Fermi liquid itself breaks down.',
  'Barium Titanate':
    "BaTiO₃'s Ti⁴⁺ ion sits off-center in its oxygen cage below ~120°C, giving the whole lattice a spontaneous, switchable electric polarization -- the textbook ferroelectric, the electric analog of a ferromagnet's spontaneous moment.",
  GeTe:
    'A IV-VI semiconductor whose rhombohedral distortion gives it a robust, switchable polarization well above room temperature -- unlike BaTiO₃, its own strong spin-orbit coupling also locks that polarization to a Rashba-split spin texture.',
};

const TYPE_FALLBACK_BLURBS: Record<MaterialType, string> = {
  metal:
    'An ordinary conductor -- its electrons are well described by a single-particle picture, with no symmetry breaking or topological protection involved, and a partially filled band that can carry a plasmon.',
  insulator:
    'An ordinary gapped band compound whose gap is too wide to practically cross -- carriers stay put, though the lattice itself can still self-trap a polaron.',
  semiconductor:
    'An ordinary gapped band compound with a narrow enough gap to dope or thermally excite carriers across -- a single-particle picture, no symmetry breaking or topology involved.',
  classicalMagnet:
    'Its magnetic moments order (ferro- or antiferromagnetically), whether reached via a mean-field/Hubbard-U picture or a classical itinerant one -- its low-energy excitations are spin waves, magnons.',
  quantumSpinLiquid:
    'Frustration keeps its spins from ever ordering, even at zero temperature -- it stays in a highly entangled, fractionalized state instead, carrying spinons and (in a Z2 liquid) visons.',
  kondoHeavyFermion:
    'A conduction electron hybridizes with a local moment and comes out the other side mass-renormalized -- a heavy-fermion quasiparticle, the Kondo-lattice compound the physics is named for.',
  superconductor:
    'Below its critical temperature, electrons pair into Cooper pairs and condense into a single phase-coherent state with zero DC resistance.',
  chernSuperconductor:
    "A superconductor whose pairing is itself topological -- vortices or edges of a chiral condensate, or a superconductor-proximitized topological surface -- which is what actually hosts a Majorana zero mode; an ordinary s-wave pairing alone doesn't.",
  chernInsulator:
    'Quantized Hall conductance set by a nonzero (integer) Chern number -- whether from real Landau levels in a strong magnetic field or a zero-field anomalous Hall state, both are the same topological invariant, one chiral edge channel either way.',
  quantumSpinHall:
    'A gapped bulk (3D) or an engineered quantum-well/monolayer heterostructure (2D) alike, hiding a protected helical boundary state, robust to local perturbations that would kill an ordinary state -- one direction of spin travels one way around the edge/surface, the other spin the other way.',
  fractionalChern:
    "Unlike an ordinary Chern insulator, its edge is a fractionalized chiral mode whose quanta are charged anyons -- fractional charge, genuine braiding statistics, not free chiral fermions.",
  ferroelectric:
    "Electric dipoles order into a spontaneous, switchable polarization with no magnetic order involved at all -- the electric analog of a ferromagnet, its own low-energy excitation (a ferron) the analog of a magnon.",
  multiferroic:
    'Magnetically ordered with an electric polarization coupled to that order -- its spin waves (electromagnons) carry an electric-dipole activity an ordinary magnon never does.',
  adaptive: 'Not a real material -- an adaptive model that learns and exploits whatever strategy is thrown at it.',
};

export function materialBlurb(material: { name: string; type: MaterialType }): string {
  return MATERIAL_BLURBS[material.name] ?? TYPE_FALLBACK_BLURBS[material.type];
}
