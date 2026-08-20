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
    "Graphene's honeycomb lattice carries two atoms per unit cell, and its bands touch linearly at the K and K' points: electrons there behave as massless, relativistic (Dirac-like) particles instead of ordinary parabolic ones.",
  'Manganese Oxide':
    'MnO stays insulating even though a naive band picture would call its 3d electrons itinerant; Hubbard repulsion U splits the band into lower and upper Hubbard bands, opening a Mott gap and locking in antiferromagnetic order.',
  'Nickel Oxide':
    "Like MnO, NiO is a textbook Mott insulator: on-site Coulomb repulsion, not a conventional band gap, is what keeps its electrons from conducting, and mean-field Hubbard theory captures the resulting antiferromagnetic order.",
  'Gallium Nitride':
    "GaN is an ordinary doped semiconductor: its transport is governed by a single-particle band picture, with no symmetry breaking or topological structure involved.",
  'Magnesium Oxide':
    'MgO is a simple ionic band insulator, the textbook baseline against which topological insulators (a gapped spectrum for a very different reason) are usually contrasted.',
  // The ten rivals, and the one place the game states plainly what a golem is.
  // A rival's blurb is what BattleScene shows the moment it falls, so this is
  // the text a player reads ten times across the game, once per boss, each
  // time naming the specific order that boss lost. Kept as physics rather than
  // as accusation: the material says what happened to it, and the player
  // assembles the pattern (WORLDS.md section 6).
  'Polycrystalline Silicon Golem':
    "Silicon's electrons fill a conventional band structure right up to a gap: an ordinary semiconductor, no protected states or broken symmetry needed to explain it. Ground into grains, each one broke the symmetry on its own and in its own direction, so averaged over the whole body the order parameter is zero. A thousand commitments, summing to nothing decided.",
  'Polycrystalline Silica Golem':
    "Silica in grains, each one a small perfect lattice, with a film of glass at every boundary between them. Bloch's theorem needs the repetition to reach the edge of the solid, and here it stops at the edge of a grain: there is no crystal momentum for the body as a whole, no band that spans it, and nothing in it that can be labelled by k. Every grain still repeats. No two of them agree on where.",
  'Polycrystalline Bismuth Telluride Golem':
    "Bi₂Te₃'s topological surface state is protected by time reversal, and protection has a limit. Past a critical disorder strength the quantum spin Hall phase gives way to a trivial Anderson insulator: every state localized, no Kramers-protected channel anywhere in it. What is left still glows along the seam, and nothing along that seam has moved in a long time.",
  'Polycrystalline Manganese Bismuth Telluride Golem':
    "MnBi₂Te₄ quantizes from the inside: its own magnetic order stands in for an applied field. Real samples are riddled with Mn/Bi antisite disorder, and that disorder kills the quantization outright. Push it far enough and the extended states that carry the Chern number are gone, the invariant falls to zero, and the plateau is not noisy but absent. There is nothing left in it to count.",
  'Polycrystalline YBCO Golem':
    "Granular YBCO superconducts grain by grain, and the grain boundaries are Josephson weak links that can still lock the whole body to one phase. That agreement is real, and it is a treaty rather than an identity: it holds while the current stays small, the field stays low and the cold stays deep. It is the one thing on this road the Decoherence has not yet been able to take.",
  'Polycrystalline Iron Golem':
    "Polycrystalline iron is still a magnet: every grain keeps its order, and the domain walls slide as they always did. What the grains take is the magnon. A spin wave scatters at every boundary, its mean free path falls to the size of a grain, and the long-wavelength modes that carry order across a body no longer fit inside any part of this one.",
  'Polycrystalline Herbertsmithite Golem':
    "Herbertsmithite's kagome lattice frustrates every spin into never choosing, and its ground state is one long-range entangled whole. Each grain of this body is still a spin liquid, enormous on lattice scales, and the single system-wide state that made them one is gone. A spin liquid is locally featureless by design, so nothing inside it can tell the difference.",
  'Polycrystalline Ruthenium Trichloride Golem':
    "α-RuCl₃'s Kitaev bonds fractionalize a flipped spin into halves that travel apart, and travelling apart needs one coherent resonating background to travel through. Stacking faults and grain boundaries end that background. The halves are confined back into an ordinary whole flip at the first seam they reach. It still comes apart. It no longer gets anywhere.",
  // CrI3 itself is "just" a van der Waals ferromagnet, not multiferroic --
  // twisting two layers together is what's new, and even then this is a
  // theoretical proposal (noncollinear moiré spin textures inducing
  // magnetoelectric coupling), not yet an established experimental result,
  // so this overrides the type's fallback blurb to say so rather than assert
  // it as settled fact.
  'Twisted CrI₃':
    'Untwisted CrI₃ is only an ordinary van der Waals ferromagnet. Stacking two layers at a twist angle is predicted to create noncollinear moiré spin textures whose magnetoelectric coupling would host genuine electromagnons.',
  'HgTe/CdTe Quantum Well':
    'Neither HgTe nor CdTe is topological on its own, but thin a layer of (inverted-gap) HgTe between CdTe barriers to the right thickness and the bands invert, opening a gap that hides a protected helical edge state: the original Bernevig-Hughes-Zhang quantum spin Hall insulator.',
  'Y₂BaNiO₅':
    "This S=1 Heisenberg chain opens a Haldane gap rather than ordering; its ground state is adiabatically connected to the AKLT state, the exactly solvable valence-bond-solid wavefunction matrix product states were introduced to describe in the first place.",
  'YbRh₂Si₂':
    'A conduction electron entangling with a local Yb 4f-moment renormalizes into a quasiparticle hundreds of times heavier than a bare electron, and YbRh₂Si₂ sits right at the Kondo-lattice quantum critical point where that heavy Fermi liquid itself breaks down.',
  'Barium Titanate':
    "BaTiO₃'s Ti⁴⁺ ion sits off-center in its oxygen cage below ~120°C, giving the whole lattice a spontaneous, switchable electric polarization: the textbook ferroelectric, the electric analog of a ferromagnet's spontaneous moment.",
  GeTe:
    'A IV-VI semiconductor whose rhombohedral distortion gives it a robust, switchable polarization well above room temperature. Unlike BaTiO₃, its own strong spin-orbit coupling also locks that polarization to a Rashba-split spin texture.',
  Silver:
    "Silver's half-filled 5s conduction band gives it the sharpest, most tightly bound free-electron plasmon of any metal, the reason real plasmonic/nanophotonic devices are built on silver (and gold) rather than graphene, even though both share the same ordinary partially-filled-band physics.",
  Diamond:
    "Diamond's ~5.5 eV indirect gap is wide enough that no realistic doping or thermal excitation puts a carrier in the conduction band: the textbook covalent insulator, its own stiff sp³ lattice making it an exceptional phonon conductor even while it blocks charge transport entirely.",
  'Monolayer Boron Nitride':
    "hBN's own honeycomb lattice is nearly commensurate with graphene's, which is why real graphene devices are built on or encapsulated in it; individually just a wide-gap (~5.9 eV) insulator, but aligning it with graphene at a moiré angle is what opens the exotic flat-band physics of Rhombohedral Pentalayer Graphene/hBN Moiré.",
  'Yttrium Iron Garnet':
    'YIG is ferrimagnetic, not ferromagnetic (two magnetic sublattices order antiparallel with unequal moment), but its defining feature is having the lowest magnon damping of any known material, which is why nearly every real spin-wave-transport and magnon-BEC experiment is actually done in YIG.',
  'Bismuth Ferrite':
    "BiFeO₃ is the flagship room-temperature single-phase multiferroic: a large, switchable polarization (from the Bi³⁺ lone pair, not a Ti⁴⁺-style off-centering) coexists with G-type antiferromagnetic order carrying a spin cycloid, and their magnetoelectric coupling produces electromagnons actually observed in its THz/Raman spectrum, unlike Twisted CrI₃'s still-theoretical coupling.",
  'Hafnium Oxide':
    'Bulk HfO₂ is an ordinary centrosymmetric insulator, not ferroelectric at all, but a thin, strained film locks into a polar orthorhombic phase that switches, and this works in pristine, undoped epitaxial HfO₂ as well, not just in the more common dopant-stabilized version, which is what makes it the CMOS-compatible ferroelectric behind real FeRAM/FeFET devices.',
  'Lanthanum Decahydride':
    "LaH₁₀ superconducts up to roughly 250-260 K, but only under ~170 GPa of pressure, and its mechanism is still ordinary phonon-mediated BCS pairing, just driven to extremes by how light and strongly coupled hydrogen's own phonons are inside the hydride's clathrate cage.",
  'Uranium Ditelluride':
    'UTe₂ is the leading candidate spin-triplet superconductor: critical fields far beyond the ordinary Pauli limit and contested reports of broken time-reversal symmetry and chiral in-gap surface states point toward genuine topological pairing, though newer high-quality crystals have complicated that picture, leaving a real, still-open research question rather than settled physics.',
  'Cerium Cobalt Indide':
    "CeCoIn₅'s Ce 4f moments hybridize with its conduction electrons into quasiparticles roughly a hundred times an electron's bare mass: a heavy-fermion compound sitting right next to an antiferromagnetic quantum critical point, whose own T→0 ground state is actually an unconventional d-wave superconductor built from those heavy quasiparticles.",
  'Cerium Zirconate Pyrochlore':
    "Ce₂Zr₂O₇ shows no magnetic order or spin freezing down to tens of millikelvin; its Ce³⁺ dipole-octupole doublets on the pyrochlore lattice are read as evidence for a U(1) quantum spin ice, a quantum spin liquid with an emergent photon and gapped spinons rather than the Z2 gauge structure a vison-hosting spin liquid carries.",
  'Rhombohedral Pentalayer Graphene/hBN Moiré':
    'Five rhombohedrally-stacked graphene layers aligned to a hBN substrate host a flat, topologically nontrivial moiré band. At the right filling and displacement field, that band fractionalizes into a genuine fractional quantum anomalous Hall state at zero magnetic field (2023-2024 experiments), the same charged-anyon edge physics as Twisted Bilayer MoTe₂ by an entirely different route.',
  Tungsten:
    "Tungsten's partially filled 5d bands make it an ordinary band conductor, but it holds the record: the highest melting point of any elemental metal, no exotic order needed to explain it.",
  'Europium Oxide':
    "EuO's half-filled Eu²⁺ 4f⁷ shell gives it well-isolated localized moments; its magnetization-vs-temperature curve is the textbook test of Weiss/mean-field theory's Brillouin-function prediction, a distinct localized-moment derivation from Iron/Cobalt's itinerant Stoner picture, though both reach the same ordered magnetic state.",
  'Manganese Fluoride':
    "MnF₂'s strong single-ion anisotropy and simple ionic (superexchange-mediated) local moments make it the real-material realization of the mean-field Ising antiferromagnet: a third distinct route to classical magnetic order, alongside Nickel Oxide's Mott-insulating Hubbard-U picture and Chromium's itinerant spin-density-wave picture.",
  'Potassium Dihydrogen Phosphate':
    "KH₂PO₄ is an order-disorder ferroelectric: protons hop between two off-center sites in each O-H...O bond, described by a pseudospin (Ising-like) mean-field model, unlike Barium Titanate's displacive transition (an ion sliding continuously off-center). Same SSB, a different microscopic route.",
  'Titanium Diselenide':
    "1T-TiSe₂'s charge density wave (~200 K) breaks a continuous translational symmetry: a softened lattice/charge modulation opens a small gap, the textbook real-material CDW. Its low-energy mode is the ordinary lattice phonon. Unlike a magnon or Higgs mode, phonons stay gapless in every material, CDW included.",
  Bismuthene:
    "A honeycomb sheet of bismuth grown on silicon carbide, carrying the largest quantum spin Hall gap anyone has measured, close to 0.8 eV. Graphene has the same lattice and is technically a quantum spin Hall insulator too, but carbon's intrinsic spin-orbit coupling is minuscule; swap in atoms as heavy as bismuth and the same opposite-mass-per-spin construction opens a gap big enough for the helical edge to matter at room temperature.",
  Jacutingaite:
    'Pt₂HgSe₃ is a genuine mineral, first found in an iron ore body in Minas Gerais, and its monolayer is predicted to realize the Kane-Mele model almost exactly: a honeycomb lattice gapped by the intrinsic spin-orbit coupling of heavy platinum and mercury. The prediction comes with supporting measurements rather than a direct transport signature, so it sits a step behind Monolayer WTe₂ in how firmly established it is.',
  'Fe₃GeTe₂':
    'The itinerant one among the two-dimensional magnets: the same delocalized band electrons carry both its current and its magnetic moment, unlike the insulating chromium trihalides whose moments sit still on their ions. An isotropic two-dimensional magnet could not order at any finite temperature at all, and this one gets around that with strong uniaxial anisotropy. Gating a monolayer with an ionic liquid pushes its Curie temperature up to roughly room temperature.',
  'FePS₃':
    'The Ising member of the MPS₃ family: MnPS₃ is Heisenberg-like and NiPS₃ XY-like, while FePS₃ locks its spins hard along one axis, which is exactly the anisotropy a two-dimensional magnet needs before it can order at all. It orders antiferromagnetically near 118 K and keeps doing so down to a single layer, tracked there by a Raman mode that appears along with the order.',
  'Monolayer SnTe':
    "Ferroelectricity surviving all the way to the two-dimensional limit. A film one unit cell thick polarizes in the plane of the sheet rather than across it, and stays polarized up to about 270 K, above the temperature bulk SnTe's own distortion survives to. Its domains can be imaged and switched with the electric field from a scanning tunneling microscope tip.",
  Phosphorene:
    'Black phosphorus thinned to a single sheet, and the odd one out among two-dimensional materials: its puckered lattice gives neither a Dirac cone like graphene nor an isotropic parabola. Its direct gap climbs from roughly 0.3 eV in the bulk to around 2 eV in one layer, and its carrier masses are strongly anisotropic, light along the armchair direction and heavy along the zigzag one, so which way you send a current through it genuinely matters.',
};

const TYPE_FALLBACK_BLURBS: Record<MaterialType, string> = {
  metal:
    'An ordinary conductor: its electrons are well described by a single-particle picture, with no symmetry breaking or topological protection involved, and a partially filled band that can carry a plasmon.',
  insulator:
    'An ordinary gapped band compound whose gap is too wide to practically cross: no carriers go anywhere, and what is left to excite is the lattice itself.',
  semiconductor:
    'An ordinary gapped band compound with a narrow enough gap to dope or thermally excite carriers across: a single-particle picture, no symmetry breaking or topology involved.',
  metallicMagnet:
    'A magnet that also conducts: its moments order (ferro- or antiferromagnetically) on the same partially filled band that carries its current, so an ordinary band electron and a free-electron-gas plasmon travel alongside its spin waves, its magnons.',
  insulatingMagnet:
    'A magnet with a gap: its local moments order (ferro- or antiferromagnetically) through superexchange or a Hubbard-U picture, with no carriers underneath them, so its spin waves, its magnons, are the only excitation it has beyond the lattice itself.',
  quantumSpinLiquid:
    'Frustration keeps its spins from ever ordering, even at zero temperature; it stays in a highly entangled, fractionalized state instead, carrying spinons and (in a Z2 liquid) visons.',
  kondoHeavyFermion:
    'A conduction electron hybridizes with a local moment and comes out the other side mass-renormalized: a heavy-fermion quasiparticle, the Kondo-lattice compound the physics is named for.',
  superconductor:
    'Below its critical temperature, electrons pair into Cooper pairs and condense into a single phase-coherent state with zero DC resistance.',
  chernSuperconductor:
    "A superconductor whose pairing is itself topological (vortices or edges of a chiral condensate, or a superconductor-proximitized topological surface), which is what actually hosts a Majorana zero mode; an ordinary s-wave pairing alone doesn't.",
  chernInsulator:
    'Quantized Hall conductance set by a nonzero (integer) Chern number: whether from real Landau levels in a strong magnetic field or a zero-field anomalous Hall state, both are the same topological invariant, one chiral edge channel either way.',
  quantumSpinHall:
    'A gapped bulk (3D) or an engineered quantum-well/monolayer heterostructure (2D) alike, hiding a protected helical boundary state, robust to local perturbations that would kill an ordinary state: one direction of spin travels one way around the edge/surface, the other spin the other way.',
  fractionalChern:
    "Unlike an ordinary Chern insulator, its edge is a fractionalized chiral mode whose quanta are charged anyons: fractional charge, genuine braiding statistics, not free chiral fermions.",
  ferroelectric:
    "Electric dipoles order into a spontaneous, switchable polarization with no magnetic order involved at all: the electric analog of a ferromagnet, its own low-energy excitation (a ferron) the analog of a magnon.",
  multiferroic:
    'Magnetically ordered with an electric polarization coupled to that order: its spin waves (electromagnons) carry an electric-dipole activity an ordinary magnon never does.',
};

export function materialBlurb(material: { name: string; type: MaterialType }): string {
  return MATERIAL_BLURBS[material.name] ?? TYPE_FALLBACK_BLURBS[material.type];
}

// One epic-narrative-plus-physics blurb per `HYBRID_RECIPES` result
// (`data/materials.ts`), shown in Majorana's fuse panel below the two
// component crystals and the resulting hybrid's own render. A separate
// table from MATERIAL_BLURBS above (not an override of the three hybrid
// results -- Twisted CrI₃, HgTe/CdTe Quantum Well, Rhombohedral Pentalayer
// Graphene/hBN Moiré -- that already have a MATERIAL_BLURBS entry of their
// own) since that table's post-battle/Materialdex wording is deliberately
// dry and hedged (e.g. Twisted CrI₃'s still-theoretical multiferroicity),
// while this one is Majorana's own showman voice -- grounded in the same
// underlying physics fact, just told with more flourish. Twisted CrI₃ keeps
// the "predicted, not yet observed" hedge for the same reason the
// MATERIAL_BLURBS/DESIGN.md entries do; CrI₃/NbSe₂ is grounded by analogy to
// the confirmed NbSe₂/CrBr₃ heterostructure below rather than asserting the
// same result directly, since only NbSe₂/CrBr₃ is the actual observed pair
// (real-world grounding for both -- InAs/Al: the Copenhagen/Delft Majorana
// nanowire platform; Twisted Bilayer Graphene: Cao et al.'s magic-angle
// result; Fe/Pb: Nadj-Perge et al.'s iron chain on lead; NbSe₂/CrBr₃:
// Kezilebieke et al.'s topological heterostructure; HgTe/CdTe: König et
// al.'s original quantum spin Hall well; the graphene/hBN moiré result: the
// 2023-2024 zero-field fractional quantum anomalous Hall experiments -- kept
// out of the player-facing text itself, which stays flavor-plus-physics
// with no years or paper citations).
export const HYBRID_FUSION_LORE: Record<string, string> = {
  'InAs/Al Majorana Wire':
    'Cooper pairs meet spin-orbit coupling: each wire end splits a fermion clean in two.',
  'Twisted Bilayer Graphene':
    'Twist graphene against its own twin at the magic angle: flat bands birth superconductivity.',
  'CrI₃/NbSe₂ Topological-SC Heterostructure':
    'A van der Waals magnet layered on a superconductor warps its pairing topological.',
  'Cr-doped (Bi,Sb)₂Te₃':
    "Chromium seeds a topological insulator: symmetry breaks inside, one chiral edge remains.",
  'Fe/Pb Majorana Chain':
    'Iron atoms chained on lead braid magnetism into the pairing: Majorana modes wait at the ends.',
  'Twisted CrI₃':
    'Twist two CrI₃ sheets and their spins spiral: a polarization predicted, not yet confirmed.',
  'Twisted Bilayer MoTe₂':
    'Twist two MoTe₂ sheets until flat bands emerge: electrons fractionalize into charged anyons.',
  'NbSe₂/CrBr₃ Topological-SC Heterostructure':
    'A superconductor stacked with a ferromagnet warps its pairing into chiral Majorana edges.',
  '1T/1H-TaS₂ Heterostructure':
    'Two TaS₂ phases interfaced: one locks in moments, the other screens them with free electrons.',
  'HgTe/CdTe Quantum Well':
    'A thin inverted layer between ordinary barriers hides a protected edge neither parent had.',
  'Rhombohedral Pentalayer Graphene/hBN Moiré':
    'Five aligned graphene layers grow a flat band that fractures into charged anyons.',
};
