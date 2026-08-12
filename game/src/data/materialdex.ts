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
  'Polycrystalline Silicon Golem':
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
  'Y₂BaNiO₅':
    "This S=1 Heisenberg chain opens a Haldane gap rather than ordering -- its ground state is adiabatically connected to the AKLT state, the exactly solvable valence-bond-solid wavefunction matrix product states were introduced to describe in the first place.",
  'YbRh₂Si₂':
    'A conduction electron entangling with a local Yb 4f-moment renormalizes into a quasiparticle hundreds of times heavier than a bare electron -- YbRh₂Si₂ sits right at the Kondo-lattice quantum critical point where that heavy Fermi liquid itself breaks down.',
  'Barium Titanate':
    "BaTiO₃'s Ti⁴⁺ ion sits off-center in its oxygen cage below ~120°C, giving the whole lattice a spontaneous, switchable electric polarization -- the textbook ferroelectric, the electric analog of a ferromagnet's spontaneous moment.",
  GeTe:
    'A IV-VI semiconductor whose rhombohedral distortion gives it a robust, switchable polarization well above room temperature -- unlike BaTiO₃, its own strong spin-orbit coupling also locks that polarization to a Rashba-split spin texture.',
  Silver:
    "Silver's half-filled 5s conduction band gives it the sharpest, most tightly bound free-electron plasmon of any metal -- the reason real plasmonic/nanophotonic devices are built on silver (and gold) rather than graphene, even though both share the same ordinary partially-filled-band physics.",
  Diamond:
    "Diamond's ~5.5 eV indirect gap is wide enough that no realistic doping or thermal excitation puts a carrier in the conduction band -- the textbook covalent insulator, its own stiff sp³ lattice making it an exceptional phonon conductor even while it blocks charge transport entirely.",
  'Monolayer Boron Nitride':
    "hBN's own honeycomb lattice is nearly commensurate with graphene's, which is why real graphene devices are built on or encapsulated in it -- individually just a wide-gap (~5.9 eV) insulator, but aligning it with graphene at a moiré angle is what opens the exotic flat-band physics of Rhombohedral Pentalayer Graphene/hBN Moiré.",
  'Yttrium Iron Garnet':
    'YIG is ferrimagnetic, not ferromagnetic -- two magnetic sublattices order antiparallel with unequal moment -- but its defining feature is having the lowest magnon damping of any known material, which is why nearly every real spin-wave-transport and magnon-BEC experiment is actually done in YIG.',
  'Bismuth Ferrite':
    "BiFeO₃ is the flagship room-temperature single-phase multiferroic: a large, switchable polarization (from the Bi³⁺ lone pair, not a Ti⁴⁺-style off-centering) coexists with G-type antiferromagnetic order carrying a spin cycloid, and their magnetoelectric coupling produces electromagnons actually observed in its THz/Raman spectrum -- unlike Twisted CrI₃'s still-theoretical coupling.",
  'Hafnium Oxide':
    'Bulk HfO₂ is an ordinary centrosymmetric insulator, not ferroelectric at all -- but a thin, strained film locks into a polar orthorhombic phase that switches, and Cheema et al. (Nature, 2020) showed this works in pristine, undoped epitaxial HfO₂, not just the more common dopant-stabilized version, which is what makes it the CMOS-compatible ferroelectric behind real FeRAM/FeFET devices.',
  'Lanthanum Decahydride':
    "LaH₁₀ superconducts up to roughly 250-260 K -- but only under ~170 GPa of pressure, and its mechanism is still ordinary phonon-mediated BCS pairing, just driven to extremes by how light and strongly coupled hydrogen's own phonons are inside the hydride's clathrate cage.",
  'Uranium Ditelluride':
    'UTe₂ is the leading candidate spin-triplet superconductor: critical fields far beyond the ordinary Pauli limit and contested reports of broken time-reversal symmetry and chiral in-gap surface states point toward genuine topological pairing, though newer high-quality crystals have complicated that picture -- a real, still-open research question rather than settled physics.',
  'Cerium Cobalt Indide':
    "CeCoIn₅'s Ce 4f moments hybridize with its conduction electrons into quasiparticles roughly a hundred times an electron's bare mass -- a heavy-fermion compound sitting right next to an antiferromagnetic quantum critical point, whose own T→0 ground state is actually an unconventional d-wave superconductor built from those heavy quasiparticles.",
  'Cerium Zirconate Pyrochlore':
    "Ce₂Zr₂O₇ shows no magnetic order or spin freezing down to tens of millikelvin -- its Ce³⁺ dipole-octupole doublets on the pyrochlore lattice are read as evidence for a U(1) quantum spin ice, a quantum spin liquid with an emergent photon and gapped spinons rather than the Z2 gauge structure a vison-hosting spin liquid carries.",
  'Rhombohedral Pentalayer Graphene/hBN Moiré':
    'Five rhombohedrally-stacked graphene layers aligned to a hBN substrate host a flat, topologically nontrivial moiré band -- at the right filling and displacement field, that band fractionalizes into a genuine fractional quantum anomalous Hall state at zero magnetic field (2023-2024 experiments), the same charged-anyon edge physics as Twisted Bilayer MoTe₂ by an entirely different route.',
  Gold:
    "Gold's filled 5d shell and half-filled 6s conduction band make it the other flagship (with Silver) of visible-range plasmonics -- an ordinary partially-filled-band metal whose sharp, chemically inert plasmon resonance is why nanophotonics runs on gold nanoparticles as much as silver ones.",
  Platinum:
    "Platinum's partially filled 5d bands give it a good Fermi-level density of states and make it an excellent ordinary conductor and catalyst -- but those same d-electron interband transitions damp any plasmon response, so it carries Electron Pulse rather than Silver or Gold's Plasmon Pulse.",
  Copper:
    "Copper's half-filled 4s conduction band gives it the highest electrical conductivity of any non-precious metal -- the archetypal room-temperature conductor, and still plasmonically active (just lossier than silver or gold, thanks to its own interband d-band transitions).",
  Magnesium:
    "Magnesium is a nearly-free-electron divalent metal whose plasma frequency reaches into the ultraviolet, unlike the noble metals' visible-range plasmons -- one of the few elemental metals genuinely useful for UV plasmonics.",
  Tungsten:
    "Tungsten's partially filled 5d bands make it an ordinary band conductor, but it holds the record: the highest melting point of any elemental metal, no exotic order needed to explain it.",
  Titanium:
    "Titanium's partially filled 3d bands make it an ordinary transition-metal conductor -- its own d-electron interband transitions damp any plasmon response, so it stays a plain Electron Pulse host rather than a plasmonic one.",
  Zinc:
    "Zinc's filled 3d shell sits below a nearly-free 4s conduction band whose plasma frequency, like Magnesium's, reaches into the ultraviolet -- another elemental UV-plasmonic metal, not visible-range like silver or gold.",
  'Sodium Chloride':
    "NaCl is the textbook conventional insulator -- a wide ionic gap simply blocks electron propagation, no protected edge structure involved, and its own ionic lattice self-traps a polaron the way any ionic insulator does.",
  Sapphire:
    "Al₂O₃'s ~8.8 eV gap is wide enough that no realistic doping crosses it -- one of the hardest, most chemically inert insulating crystals known, an even more extreme version of Diamond's own wide-gap-insulator story.",
  'Lithium Fluoride':
    "LiF has the widest gap (~13.6 eV) of any alkali halide -- an even more strongly ionic, more strongly self-trapping textbook polaron host than Sodium Chloride.",
  'Calcium Fluoride':
    'CaF₂ is a fluorite-structure ionic insulator with a ~12 eV gap -- another textbook polaron host, its two fluoride ions per calcium giving the same wide-gap, no-free-carrier band picture as the alkali halides.',
  'Aluminum Nitride':
    "AlN's ~6.2 eV gap is wider than Gallium Nitride's own ~3.4 eV -- too wide for the doping that turns GaN into a working semiconductor, so it stays a true insulator instead.",
  Germanium:
    "Germanium's narrow ~0.67 eV indirect gap makes it Silicon's own group-IV sibling -- the original transistor material, an ordinary single-particle band semiconductor through and through.",
  'Indium Phosphide':
    'InP is a direct-gap (~1.35 eV) III-V semiconductor, a workhorse of high-speed electronics and photonics alongside Gallium Arsenide -- same ordinary band picture, no symmetry breaking or topology involved.',
  'Zinc Oxide':
    'ZnO is a wide direct-gap (~3.4 eV) II-VI semiconductor, easily doped n-type -- an ordinary band compound, its wide gap making it transparent to visible light while still conducting once doped.',
  'Indium Antimonide':
    'InSb has the narrowest gap (~0.17 eV) of the common III-V semiconductors, giving it extreme electron mobility -- still a plain single-particle band picture, just with an unusually small gap to cross.',
  'Lead Sulfide':
    'PbS is a narrow-gap (~0.41 eV) IV-VI semiconductor -- the natural mineral galena, an ordinary band picture in bulk (its quantum-confined nanocrystal form is a separate story).',
  'Silicon Carbide, 4H phase':
    "4H-SiC's wide (~3.2 eV) indirect gap and exceptional hardness and thermal conductivity make it the power-electronics workhorse alongside GaN -- still an ordinary band semiconductor, its toughness a materials-engineering virtue rather than a sign of exotic physics.",
  'Titanium Dioxide, rutile phase':
    "Rutile TiO₂'s ~3.0 eV gap is wide enough to make it a wide-gap oxide semiconductor -- famous for photocatalysis, but an ordinary single-particle band picture underneath.",
  'Boron Arsenide':
    'BAs has a moderate (~1.46 eV) indirect gap -- an otherwise ordinary III-V semiconductor, famous instead for a record-high thermal conductivity rivaling diamond.',
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
};

export function materialBlurb(material: { name: string; type: MaterialType }): string {
  return MATERIAL_BLURBS[material.name] ?? TYPE_FALLBACK_BLURBS[material.type];
}
