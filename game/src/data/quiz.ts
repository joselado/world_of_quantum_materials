// Pre-battle physics questions. A wild encounter draws from *that world's*
// own pool (WORLD_QUESTIONS[world], see getWorldQuestion below) -- worlds are
// the primary organizing unit, not materials, so that a world's own aggregate
// stays scoped to that world's own difficulty/topic (session NN.tex) with no
// leakage from a harder or off-topic world a shared material also happens to
// spawn in. A handful of materials additionally carry their own supplementary
// pool (MATERIAL_QUESTIONS) on top of their world's pool: getWorldQuestion
// coin-flips between the world's own pool and the fought material's pool
// whenever that material has one. This exists for two distinct reasons:
//   - A few materials (Barium Titanate, Herbertsmithite) spawn in two worlds
//     but their authored content is genuinely topic-uniform rather than
//     splittable along either world's own topic, so it lives as a bonus layer
//     usable in either world instead of being force-split.
//   - Every named hybrid-recipe result (WORLD_CRYSTALS[10]'s own wilds, e.g.
//     Cr-doped (Bi,Sb)₂Te₃) spawns *only* in World 10, and needs its own pool
//     so World 10's own picker (below) has a "material" side to coin-flip
//     against.
// Answering correctly multiplies the player's attack power for that battle
// (1.5x); answering wrong weakens it (0.6x); "let me pass" skips the battle
// entirely with no bonus or penalty (see OverworldScene.showEncounter).
//
// World 10 draws differently from worlds 1-9: since its wilds are hybrid
// results rather than a course topic of their own, getWorldQuestion(10, name)
// coin-flips between that hybrid's own MATERIAL_QUESTIONS pool and
// ML_LECTURE_QUESTIONS (session10.tex, the course's own machine-learning
// finale) instead of any WORLD_QUESTIONS bucket -- fitting, since World 10's
// rival ("The Adapted") is itself an adaptive AI.
//
// Content is sourced from lecture_notes/tex_extended/sessions/sessionNN.tex,
// matching each world to that world's own course topic (world 1 ->
// session01.tex, world 2 -> session02.tex, ... world 9 -> session09.tex --
// see CLAUDE.md's topic table); a handful of real materials genuinely
// off-syllabus (no session covers their specific topic, e.g. Silver's
// plasmonics or GeTe's ferroelectric Rashba coupling) are written straight
// from the compound's own real physics instead, noted inline where that's
// the case.

export interface MaterialQuestion {
  prompt: string;
  correct: string;
  incorrect: string;
}

// Analytic-move questions additionally carry the world number(s) whose course
// topic they belong to, so getAnalyticQuestion can restrict its pool to worlds
// the player has already visited (see the ANALYTIC_QUESTIONS comment below).
export interface AnalyticQuestion extends MaterialQuestion {
  worlds: number[];
}

// World 1 (session01.tex: mean-field Hubbard theory, Mott physics,
// spontaneous symmetry breaking).
export const WORLD_QUESTIONS: Record<number, MaterialQuestion[]> = {
  1: [
    // Nickel Oxide (NiO) -- Mott antiferromagnet, spontaneous symmetry breaking.
    {
      prompt: "Why does NiO order antiferromagnetically below its Néel point?",
      correct: 'U crosses a threshold, favoring opposite spins',
      incorrect: 'Spin-orbit coupling alone locks the spins',
    },
    {
      prompt: "Strictly speaking, spontaneous symmetry breaking (like NiO's magnetic order) is a rigorous statement about systems in what limit?",
      correct: 'The thermodynamic (infinite-size) limit',
      incorrect: 'The zero-temperature limit',
    },
    {
      prompt: "By the formal definition of a magnet, NiO's ordered state fails to be invariant under which operator?",
      correct: 'The time-reversal operator',
      incorrect: 'The parity (inversion) operator',
    },
    {
      prompt: 'The classic toy model for spontaneous symmetry breaking is the classical Ising ferromagnet. What are its two equally valid ground states?',
      correct: 'All spins up, or all spins down',
      incorrect: 'All spins along x, or along y',
    },
    {
      prompt: 'On a honeycomb Hubbard lattice, why is a finite critical U needed before an antiferromagnetic gap opens (unlike a simple chain)?',
      correct: 'Its density of states vanishes linearly there',
      incorrect: 'Its density of states diverges there',
    },
    {
      prompt: 'In the extended (infinite) 1D Hubbard chain, at what interaction strength does antiferromagnetic order first appear?',
      correct: 'Any U > 0: no threshold',
      incorrect: 'Only above a finite critical U_c',
    },
    // Chromium -- itinerant (nested-Fermi-surface) antiferromagnet, contrasted with MnO/NiO's Mott picture.
    {
      prompt: "Elemental chromium's spin-density-wave antiferromagnetism comes from Fermi-surface nesting. In this world's toy nested chain, what does that same mechanism do to the ordering threshold?",
      correct: 'It removes the threshold entirely: order turns on for any U > 0',
      incorrect: 'It raises the threshold to U_c = 4t, twice the dimer value',
    },
    {
      prompt: 'Why does the two-site Hubbard dimer need a finite threshold U_c = 2t before magnetization turns on, unlike the extended, perfectly nested chain?',
      correct: "Its small system lacks the chain's extensive, near-degenerate low-energy states",
      incorrect: 'Two sites are simply too few to ever support magnetism at all',
    },
    {
      prompt: 'In mean-field Hubbard theory, what symmetry does a nonzero magnetization m = ⟨n↑⟩ − ⟨n↓⟩ spontaneously break?',
      correct: 'Time-reversal symmetry',
      incorrect: 'Translational symmetry',
    },
    {
      prompt: 'The perfect-nesting argument that removes the ordering threshold for the extended chain was first introduced in this world for a different order. Which one?',
      correct: 'The charge density wave, from nearest-neighbor repulsion V',
      incorrect: 'Superconducting pairing, from an attractive U < 0',
    },
    {
      prompt: "Right at the nested chain's ordering threshold, how does its order parameter actually turn on as U grows from zero?",
      correct: 'Exponentially slowly, ~e^(-const/U), not linearly',
      incorrect: 'Discontinuously, jumping straight to its full value',
    },
    {
      prompt: "Elemental chromium is an itinerant (metallic) antiferromagnet, unlike MnO/NiO's Mott-insulating picture. What's the key mean-field difference between the two roads to magnetism?",
      correct: 'Nesting of an already-metallic Fermi surface, not a Mott gap from strong on-site U',
      incorrect: "Chromium's magnetism comes from strong on-site U, identical to MnO/NiO's mechanism",
    },
    // Iron -- itinerant ferromagnet, mean-field/Stoner half of its pool (the
    // rest, on magnon dispersion, lives in World 6's own pool below).
    {
      prompt: 'Why do iron and cobalt order magnetically while a comparable-U metal like aluminum or lead stays nonmagnetic?',
      correct: 'Their narrow d bands give a large density of states at E_F',
      incorrect: 'Their U is uniquely large among transition metals',
    },
    {
      prompt: 'In a self-consistently solved mean-field iron chain, what grows with U and pushes the spin-up and spin-down bands apart?',
      correct: 'The exchange splitting',
      incorrect: 'Spin-orbit coupling',
    },
    {
      prompt: "Iron's ferromagnetism is best described, in the itinerant/localized language, as...",
      correct: 'Itinerant magnetism: delocalized electrons near a Stoner instability',
      incorrect: 'Localized-moment magnetism from fully frozen charge',
    },
    // Cobalt -- itinerant ferromagnet, mean-field half of its pool (the
    // rest, on the Stoner criterion and the magnon Goldstone mode, lives in
    // World 6 below).
    {
      prompt: 'In the mean-field Hubbard model, which direction does the spontaneous exchange field point?',
      correct: 'Any direction in spin space: not fixed to z',
      incorrect: 'Always along the z axis, fixed by the Hamiltonian',
    },
    {
      prompt: 'Besides direct hopping between magnetic ions like cobalt, what other virtual process can flip an exchange coupling from antiferromagnetic to ferromagnetic?',
      correct: 'Hopping through a bridging ligand (superexchange)',
      incorrect: 'Simply increasing the direct hopping t',
    },
    {
      prompt: 'Itinerant, Stoner-type magnetism (as in cobalt) is the regime where...',
      correct: 'U is weak relative to the electronic bandwidth',
      incorrect: 'U is much larger than the bandwidth, freezing the charge',
    },
  ],

  // World 2 (session02.tex: symmetry operators, Bloch's theorem,
  // tight-binding bands, graphene's Dirac cone).
  2: [
    // Graphene -- honeycomb lattice, Dirac cone, tight-binding bands.
    {
      prompt: "Near its Dirac point, graphene's bands disperse as...",
      correct: 'E ∝ |k| (linear, Dirac-like)',
      incorrect: 'E ∝ k² (ordinary parabolic)',
    },
    {
      prompt: "How many orbitals does graphene's honeycomb lattice carry per unit cell?",
      correct: 'Two: one per sublattice (A, B)',
      incorrect: 'One, shared by the whole cell',
    },
    {
      prompt: "What is an electron's effective mass exactly at the tip of graphene's Dirac cone?",
      correct: 'Formally zero: massless',
      incorrect: 'Equal to the bare electron mass',
    },
    {
      prompt: "At how many inequivalent points of graphene's Brillouin zone do the bands touch at zero energy?",
      correct: 'Two: K and K′',
      incorrect: 'One, at the zone center Γ',
    },
    {
      prompt: "In graphene's honeycomb lattice, nearest-neighbor hopping connects...",
      correct: 'Only A sites to B sites',
      incorrect: 'A sites to A, and B sites to B',
    },
    {
      prompt: "Graphene's Fermi velocity v_F, in terms of hopping t and bond length a, is...",
      correct: 'v_F = 3ta / (2ħ)',
      incorrect: 'v_F = ta / ħ',
    },
    {
      prompt: 'Which graphene nanoribbon edge hosts a flat band of states pinned near zero energy?',
      correct: 'The zigzag edge',
      incorrect: 'The armchair edge',
    },
    {
      prompt: "As an armchair graphene nanoribbon gets wider, its confinement gap...",
      correct: 'Shrinks, roughly as 1/width',
      incorrect: 'Grows linearly with width',
    },
    // Gallium Nitride -- ordinary gapped semiconductor, Bloch's theorem basics.
    {
      prompt: "GaN is a 'trivial' insulator. What does that mean?",
      correct: 'Ordinary band gap, nothing topological',
      incorrect: 'A superconducting Cooper-pair gap',
    },
    {
      prompt: "Bloch's theorem says a periodic lattice Hamiltonian shares an eigenbasis with which operator?",
      correct: 'The translation operator',
      incorrect: 'The mirror (reflection) operator',
    },
    {
      prompt: 'For a simple 1D tight-binding chain with hopping t, the band dispersion ε(φ) as a function of Bloch phase φ is...',
      correct: 'ε(φ) = 2t cos(φ)',
      incorrect: 'ε(φ) = tφ² (a parabola)',
    },
    {
      prompt: 'In multi-orbital tight-binding band theory, what object diagonalizes the Hamiltonian at each fixed Bloch phase φ?',
      correct: 'The Bloch Hamiltonian H(φ)',
      incorrect: 'The density of states g(ω)',
    },
    {
      prompt: 'Ordinary semiconductors like GaN, near their band edges, are usually described by which dispersion shape?',
      correct: 'Parabolic bands, E ∝ k²',
      incorrect: 'Dirac (linear) bands, E ∝ |k|',
    },
    {
      prompt: 'Two symmetry operators can share a common eigenbasis with the Hamiltonian only if they satisfy which condition?',
      correct: 'They commute: [H, S] = 0',
      incorrect: 'They anticommute: {H, S} = 0',
    },
    // Magnesium Oxide -- ordinary wide-gap ionic insulator.
    {
      prompt: "How does MgO's insulating gap arise?",
      correct: 'Ordinary Bloch/tight-binding bands',
      incorrect: 'A Mott gap from strong Coulomb repulsion',
    },
    {
      prompt: "In one dimension, a crystal's Bloch phase (quasi-momentum) φ ranges over...",
      correct: '(−π, π], the first Brillouin zone',
      incorrect: '(0, ∞), unbounded',
    },
    {
      prompt: 'A large or divergent density of states right at the Fermi level means a material is...',
      correct: 'Sensitive: even weak interactions can drive an instability',
      incorrect: 'Essentially immune to interaction effects',
    },
    {
      prompt: "How many independent Bloch phases does a 2D crystal's translational symmetry produce?",
      correct: 'Two, φ_x and φ_y',
      incorrect: 'Three, one per spatial and spin direction',
    },
    {
      prompt: 'A perfectly flat band E(k) = const. produces what kind of density of states?',
      correct: 'A divergent density of states',
      incorrect: 'A vanishing density of states',
    },
    {
      prompt: "In an ordinary ionic insulator like MgO, a periodic potential can open a small gap where two folded bands would otherwise cross. What's this gap called?",
      correct: 'An anticrossing (minigap)',
      incorrect: 'A fully flat band',
    },
    // Indium Arsenide -- narrow-gap dopable semiconductor, symmetry operators/Bloch phase.
    {
      prompt: 'A unitary symmetry operator in quantum mechanics always has eigenvalues with...',
      correct: 'Unit modulus: a pure phase e^{iφ}',
      incorrect: 'An arbitrary, unconstrained real magnitude',
    },
    {
      prompt: "The Bloch phase φ, the translation operator's eigenvalue, is directly identified with...",
      correct: 'The crystal momentum k times the lattice constant a',
      incorrect: "The electron's total energy divided by ħ",
    },
    {
      prompt: "Because φ=0 and φ=2π label the same translation eigenvalue in each direction, a 2D crystal's Brillouin zone is topologically a...",
      correct: 'Torus',
      incorrect: 'Sphere',
    },
    {
      prompt: 'For a unit cell with several orbitals, the size of the Bloch Hamiltonian matrix H(φ) equals...',
      correct: 'The number of orbitals per unit cell',
      incorrect: 'The total number of unit cells in the crystal',
    },
    {
      prompt: "A band's group velocity v(k) = (1/ħ)∇_k E(k) physically tells you...",
      correct: 'How fast an electron at that k actually propagates',
      incorrect: 'How strongly interactions affect that k-state',
    },
    {
      prompt: 'The effective mass actually measured in transport or cyclotron-resonance experiments in a solid is set by...',
      correct: 'The curvature (second derivative) of the band dispersion',
      incorrect: 'The bare electron mass, unaffected by the crystal',
    },
    // Monolayer MoTe₂ (2H) -- semiconducting TMD monolayer, band structure/ARPES.
    {
      prompt: 'The density of states g(ω) of a band counts...',
      correct: 'How many electronic states sit at energy ω',
      incorrect: 'How fast electrons at energy ω are moving',
    },
    {
      prompt: "A material's Fermi surface is defined as...",
      correct: 'The set of k-points at the energy of the highest occupied state',
      incorrect: 'The single k-point where the dispersion is steepest',
    },
    {
      prompt: "Angle-resolved photoemission spectroscopy (ARPES) directly maps out a material's...",
      correct: "Band dispersion E(k), from ejected electrons' angle and energy",
      incorrect: 'Density of point-defect impurities',
    },
    {
      prompt: 'Re-describing a crystal with an artificially enlarged unit cell (band folding) turns one band into...',
      correct: 'Several bands, folded copies of the original',
      incorrect: 'A single flat, dispersionless band',
    },
    {
      prompt: 'Band unfolding computes a spectral function A(k,E) that tracks...',
      correct: "How much of a supercell eigenstate's weight sits at each original-cell momentum",
      incorrect: 'How many electrons occupy the unit cell at each energy',
    },
    {
      prompt: "Before writing a clean tight-binding Hamiltonian, a material's non-orthogonal atomic orbitals are first passed through...",
      correct: 'Löwdin orthogonalization, giving one Wannier-like orbital per site',
      incorrect: "A simple renormalization of the raw atomic orbitals' amplitude",
    },
    // HgTe -- symmetry operators, band-inversion-free basics (its own inverted
    // bulk order is what the World 10 HgTe/CdTe Quantum Well hybrid draws on).
    {
      prompt: "A Hamiltonian invariant under a symmetry operator S satisfies [H,S] = 0. What does that guarantee about H's eigenstates?",
      correct: 'They can always be chosen to simultaneously be eigenstates of S',
      incorrect: 'They must all share exactly the same eigenvalue of S',
    },
    {
      prompt: 'In the two-site mirror-symmetric hopping model, why do the bonding (c₁†+c₂†) and antibonding (c₁†−c₂†) states pick up mirror eigenvalues +1 and −1, without ever diagonalizing H?',
      correct: "It follows directly from the mirror's site-swap definition alone, no hopping amplitude needed",
      incorrect: "It requires first computing each state's hopping-amplitude-dependent energy",
    },
    {
      prompt: "A band's effective mass m* is defined via the curvature of its dispersion. What mass does a real transport or cyclotron-resonance experiment on a semiconductor like HgTe actually measure?",
      correct: 'That same curvature-defined effective mass, not the bare electron mass',
      incorrect: 'Always the literal bare electron mass, unaffected by the crystal',
    },
    {
      prompt: 'Which of the three archetypal dispersions (parabolic, Dirac, or flat) describes most ordinary semiconductors, before any band-inversion physics is added?',
      correct: 'Parabolic, E ∝ k²',
      incorrect: 'Dirac, E ∝ |k|',
    },
    {
      prompt: 'For an infinite chain, why does the translation operator T share an eigenbasis with the Hamiltonian?',
      correct: 'Because [H,T] = 0, they commute',
      incorrect: 'Because T is Hermitian, and every Hermitian operator commutes with H',
    },
    {
      prompt: 'On an N-site ring with full rotational symmetry, why can every eigenstate be chosen to carry exactly the same weight, 1/N, on each site, regardless of the hopping amplitudes chosen?',
      correct: 'Each such eigenstate is a uniform-modulus discrete Fourier mode fixed by the rotation symmetry alone',
      incorrect: 'Because hopping amplitudes always end up numerically equal in any real lattice',
    },
    // CdTe -- ordinary gapped semiconductor, rotational symmetry.
    {
      prompt: "On a 3-site ring with 120° rotational symmetry R (so R³ = 1), what values can the rotation eigenvalue's phase φ take?",
      correct: 'φ_n = 2πn/3, for n = 0, 1, 2',
      incorrect: "Any real value of φ, unconstrained by the ring's periodicity",
    },
    {
      prompt: 'Applying a 90° rotation to a p_x orbital produces a p_y orbital. What does that tell you about whether p_x is an eigenstate of that rotation?',
      correct: 'It is not an eigenstate: the rotation maps it to a genuinely different state',
      incorrect: 'It is automatically an eigenstate, since orbitals are eigenstates of every symmetry',
    },
    {
      prompt: "Few-site tight-binding rings, the toy models used to build up Bloch's theorem, have actually been realized in the lab. How?",
      correct: 'By positioning individual atoms with scanning tunnelling microscopy',
      incorrect: 'Only ever as abstract theoretical constructs, never built experimentally',
    },
    {
      prompt: "Near a tight-binding chain's two band extrema (φ = 0 and φ = π), the effective mass at the two extrema is...",
      correct: 'Opposite in sign at the two extrema',
      incorrect: 'The same sign and magnitude at both',
    },
    {
      prompt: "The statement [H,T] = 0 for a translation operator T requires the lattice's hoppings to depend only on...",
      correct: 'The distance between sites, not on absolute position',
      incorrect: 'The specific site index, which would break translational symmetry',
    },
    {
      prompt: 'A symmetry operator S being unitary follows from requiring that relabelling the reference frame preserve...',
      correct: 'The norm of every quantum state',
      incorrect: 'The total energy of the system, regardless of basis',
    },
    // Off-syllabus (no session covers these compounds' own specific topic --
    // written from real physics, kept in World 2 since that's where they spawn).
    {
      prompt: "What feature of silver's electronic structure gives it such a sharp plasmon resonance?",
      correct: 'A single, nearly free 5s conduction electron per atom with weak damping',
      incorrect: 'A half-filled d-band pinned near the Fermi level',
    },
    {
      prompt: "A metal's bulk plasma frequency scales with which quantity?",
      correct: 'The square root of its free-electron density',
      incorrect: 'The size of its band gap',
    },
    {
      prompt: 'Why do real plasmonic/nanophotonic devices favor silver (and gold) over an ordinary semiconductor?',
      correct: 'Their free carriers respond collectively at optical frequencies with low loss',
      incorrect: "Their band gap happens to match visible-light photon energies",
    },
    {
      prompt: "Which move class does a plasmon correspond to in this game's taxonomy?",
      correct: "Plasmon Pulse, hosted only by the 'metal' type",
      incorrect: 'Electron Pulse, hosted by every conducting type',
    },
    {
      prompt: 'Above its own bulk plasma frequency, how does a metal like silver behave toward light?',
      correct: 'It becomes transparent: the free-electron gas can no longer screen the field',
      incorrect: 'It becomes a perfect reflector',
    },
    {
      prompt: "What structurally distinguishes a 'metal' from a 'semiconductor' in this game's taxonomy?",
      correct: "A metal's band is only partially filled, so it can carry a plasmon a gapped semiconductor cannot",
      incorrect: 'A metal simply has a wider band gap than a semiconductor',
    },
    {
      prompt: "Diamond's ~5.5 eV gap is too wide for doping or thermal excitation to cross practically. Which type does that make it?",
      correct: 'Insulator',
      incorrect: 'Semiconductor',
    },
    {
      prompt: 'Which excitation does a wide-gap insulator like Diamond still carry, with no free carriers at all?',
      correct: 'A phonon, the quantized vibration of the lattice itself',
      incorrect: 'A plasmon, the collective mode of a free-electron gas',
    },
    {
      prompt: "Diamond's stiff sp³ covalent lattice gives it an unusually high...",
      correct: 'Thermal conductivity, carried by phonons',
      incorrect: 'Electrical conductivity, carried by free electrons',
    },
    {
      prompt: "Why can't an insulator like Diamond carry Electron Pulse in this game?",
      correct: 'Its gap is too wide for a band electron to be thermally or dopant-excited across',
      incorrect: 'It has no electrons in its valence band at all',
    },
    {
      prompt: "What kind of bonding holds Diamond's carbon lattice together?",
      correct: 'Covalent sp³ bonds, each carbon bonded to four neighbors',
      incorrect: 'Metallic bonding with delocalized electrons',
    },
    {
      prompt: 'Why does a wide-gap insulator carry so much of its heat as lattice vibration rather than as electrons?',
      correct: 'Its gap leaves almost no mobile carriers, so the phonons are what is left to carry it',
      incorrect: 'Its electrons are heavier than a metal\'s, so they carry heat more slowly',
    },
    {
      prompt: 'Why is hBN specifically the material real graphene devices are stacked on or encapsulated in?',
      correct: "Its own honeycomb lattice is nearly commensurate with graphene's",
      incorrect: "It's a metal, so it screens unwanted charge noise",
    },
    {
      prompt: "hBN's own ~5.9 eV gap rules out which move?",
      correct: 'Electron Pulse: too wide a gap for an ordinary band electron',
      incorrect: 'Phonon Beam: lattice vibrations need a narrower gap',
    },
    {
      prompt: 'What turns a Graphene + hBN pairing into a fractional Chern insulator instead of leaving both as ordinary compounds?',
      correct: 'Aligning them at the right stacking/moiré angle opens flat, topologically nontrivial bands',
      incorrect: 'Simply placing them in contact at any angle, no alignment required',
    },
    {
      prompt: 'hBN and graphite share the same layered honeycomb structure. What is the key electronic difference?',
      correct: "hBN's two sublattices are inequivalent (B vs. N), opening a large gap graphene's identical-atom sublattices don't have",
      incorrect: "hBN's layers are held together by covalent bonds instead of van der Waals forces",
    },
    {
      prompt: 'Which quasiparticle can a wide-gap insulator like hBN still host despite its gap?',
      correct: 'A phonon, which needs no carriers at all',
      incorrect: 'A plasmon, since a wide gap still permits free carriers',
    },
    {
      prompt: 'What does "rhombohedral" pentalayer graphene stacking refer to in the hBN-aligned hybrid recipe?',
      correct: 'An ABCCA-type stacking sequence of five graphene sheets',
      incorrect: 'A single graphene sheet twisted by exactly 60 degrees',
    },
  ],

  // World 3 (session03.tex: topological band theory, ℤ₂ invariant,
  // bulk-boundary correspondence, Kramers protection).
  3: [
    // Monolayer WTe₂ -- 2D quantum spin Hall insulator.
    {
      prompt: 'What is the key experimental fact about the quantum spin Hall effect in monolayer 1T′-WTe₂?',
      correct: 'It survives up to about 100 K',
      incorrect: 'It only appears within a millikelvin of absolute zero',
    },
    {
      prompt: "In a quantum spin Hall insulator, edge states are called 'helical' because...",
      correct: 'Spin-up and spin-down propagate in opposite directions along the same edge',
      incorrect: 'All spins propagate in the same direction, like a chiral edge',
    },
    {
      prompt: 'What mechanism naturally produces the opposite-sign mass needed for a quantum spin Hall state?',
      correct: 'Spin-orbit coupling',
      incorrect: 'An external magnetic field',
    },
    {
      prompt: "Why can't spin-mixing terms gap out the helical edge crossing of a quantum spin Hall insulator?",
      correct: "Kramers' theorem forces an exact degeneracy at time-reversal-invariant momenta",
      incorrect: 'The edge states are protected by a conserved total-spin quantum number',
    },
    {
      prompt: 'The topological invariant that survives generic spin-mixing and classifies quantum spin Hall insulators is...',
      correct: 'The ℤ₂ invariant ν',
      incorrect: 'The spin Chern number C_s',
    },
    {
      prompt: "For spin-1/2 electrons, why does Kramers' theorem force a twofold degeneracy at time-reversal-invariant momenta?",
      correct: 'The time-reversal operator squares to −1',
      incorrect: 'The time-reversal operator squares to +1',
    },
    // Bi₂Te₃ -- 3D bulk topological insulator.
    {
      prompt: 'Bi₂Te₃ is a genuine 3D bulk crystal, not a 2D monolayer like Monolayer WTe₂. Why does its surface still host the same kind of protected boundary state?',
      correct: "The bulk-boundary correspondence is a general topological argument, independent of the bulk's dimensionality",
      incorrect: '3D crystals are automatically given protected boundary states, regardless of band topology',
    },
    {
      prompt: "What robustness argument protects Bi₂Te₃'s helical surface state against generic disorder?",
      correct: 'Disorder that preserves time-reversal symmetry cannot gap the Kramers-protected crossing',
      incorrect: "Local disorder is simply screened out by the bulk's large dielectric constant",
    },
    {
      prompt: 'A nonzero ℤ₂ invariant (ν = 1) guarantees what about the number of protected Kramers pairs of edge/surface states?',
      correct: 'An odd number of Kramers pairs per edge',
      incorrect: 'An even number, which can always be gapped out in pairs',
    },
    {
      prompt: 'What happens if time-reversal-symmetry-breaking disorder (e.g. magnetic impurities) is added at a topological-insulator surface like Bi₂Te₃\'s?',
      correct: 'It opens a genuine gap in the surface spectrum, destroying the protection',
      incorrect: 'Nothing: the Kramers protection survives any perturbation whatsoever',
    },
    {
      prompt: "Kramers' theorem forces two time-reversed partner states at the same time-reversal-invariant momentum to be linearly independent. Why?",
      correct: 'Assuming they were proportional leads to |c|² = -1, impossible since T² = -1',
      incorrect: 'Because the Pauli exclusion principle forbids two electrons at the same momentum',
    },
    {
      prompt: "Why is Bi₂Te₃'s topological surface state called 'spin-momentum locked'?",
      correct: "An electron's spin direction is rigidly tied to its momentum direction on the surface Dirac cone",
      incorrect: 'Its spin flips randomly and independently of momentum, averaged over the surface',
    },
  ],

  // World 4 (session04.tex: quantum Hall effect, Landau levels, Chern
  // insulators, the Haldane model).
  4: [
    // Graphene (strong field) -- Dirac Landau levels.
    {
      prompt: "In a strong magnetic field, graphene's Landau level energies scale as...",
      correct: 'E_n ∝ √(nB): square root of both level index and field',
      incorrect: 'E_n ∝ nB: linear in level index and field',
    },
    {
      prompt: "Graphene's n = 0 Landau level, unlike every other level in the ladder, sits at...",
      correct: 'Exactly zero energy, pinned there regardless of B',
      incorrect: 'A field-dependent energy, just like all the other levels',
    },
    {
      prompt: "Why can graphene's quantum Hall plateaus survive up to roughly 100 K, and even room temperature in the best samples, while GaAs needs about 1 K?",
      correct: 'Dirac Landau levels sit roughly two orders of magnitude further apart in energy',
      incorrect: "Graphene's charge carriers are heavier, making the levels more robust",
    },
    {
      prompt: "Graphene's Landau levels come out as the square root of a harmonic-oscillator spectrum because the Dirac Hamiltonian itself isn't diagonal, but...",
      correct: 'Its square H² is, built from ladder operators aa† and a†a',
      incorrect: 'It can be diagonalized directly in momentum space with no further work',
    },
    {
      prompt: "Near the K point, the effective low-energy Hamiltonian used to derive graphene's Landau levels is...",
      correct: 'H₀ = v_F(p_x σ_x + p_y σ_y), a Dirac Hamiltonian',
      incorrect: 'H₀ = p²/2m, an ordinary parabolic Hamiltonian',
    },
    {
      prompt: "At a fixed magnetic field, graphene's Landau level spacing compared to a GaAs 2DEG's is...",
      correct: 'About two orders of magnitude larger',
      incorrect: 'Roughly the same size',
    },
    // MnBi₂Te₄ -- intrinsic zero-field Chern insulator, Haldane model.
    {
      prompt: 'Unlike Cr-doped (Bi,Sb)₂Te₃, where magnetism has to be doped in, MnBi₂Te₄ realizes the same zero-field quantized Hall conductance because its magnetism is...',
      correct: 'Intrinsic to its own crystal structure',
      incorrect: 'Induced only by an externally applied magnetic field',
    },
    {
      prompt: 'In a Haldane-type zero-field Chern insulator, what physically stands in for a magnetic field when the field is literally zero everywhere in the sample?',
      correct: 'A staggered flux pattern that averages to zero in space',
      incorrect: 'A weak but genuinely nonzero uniform field',
    },
    {
      prompt: "In the Haldane model, why does the imaginary second-neighbor (Haldane) hopping term open a topologically nontrivial gap while a simple staggered sublattice potential alone does not?",
      correct: "The Haldane term's Berry-curvature contributions from the two valleys add; the staggered potential's cancel",
      incorrect: "Both terms' valley contributions add the same way: the staggered potential is topological too",
    },
    {
      prompt: 'If a Chern-3 material borders ordinary vacuum (C=0), how many protected chiral edge modes appear at that interface?',
      correct: 'Exactly three',
      incorrect: 'Exactly one, regardless of the bulk Chern number',
    },
    {
      prompt: 'For a Haldane-type Chern insulator and the ordinary field-driven quantum Hall state to count as the same topological phase, what must hold true along the path connecting them?',
      correct: 'The bulk gap must stay open the whole way',
      incorrect: 'The magnetic field must pass through exactly zero at the midpoint',
    },
    {
      prompt: "Graphene bilayers twisted and aligned to a boron-nitride substrate reach zero-field quantized Hall conductance through a mechanism distinct from MnBi₂Te₄'s intrinsic magnetism, namely...",
      correct: 'Orbital magnetism (circulating currents), rather than spin/local-moment magnetism',
      incorrect: 'Doped-in paramagnetic impurities',
    },
    // Gallium Arsenide -- off-syllabus (session04 mentions GaAs only as a
    // 2DEG substrate, not for its own bulk physics); written from real physics.
    {
      prompt: 'In GaAs, the conduction-band minimum and valence-band maximum sit at...',
      correct: 'The same crystal momentum (Γ): a direct gap',
      incorrect: 'Different momenta, as in silicon: an indirect gap',
    },
    {
      prompt: "Why does GaAs's direct gap make it useful for LEDs and laser diodes in a way silicon isn't?",
      correct: 'An electron can recombine with a hole and emit a photon directly, without needing a phonon to conserve crystal momentum',
      incorrect: "GaAs's gap size happens to fall in the infrared range, which silicon's does not",
    },
    {
      prompt: 'What crystal structure does bulk GaAs adopt?',
      correct: 'Zinc blende: Ga and As each forming an FCC sublattice, offset by a quarter of the body diagonal',
      incorrect: 'Diamond structure, with every lattice site occupied by the same atom, like silicon',
    },
    {
      prompt: 'GaAs is classified as a III-V compound semiconductor because...',
      correct: "Gallium (group III) and arsenic (group V) atoms alternate on the lattice, averaging four valence electrons per atom, like silicon's own group IV",
      incorrect: "It's silicon doped with group III and group V dopant atoms",
    },
    {
      prompt: "GaAs's conduction-band electrons have a much smaller effective mass than silicon's. What real-world consequence does this have?",
      correct: 'Higher electron mobility, exploited in high-speed transistors for RF and microwave electronics',
      incorrect: 'Higher thermal conductivity, letting GaAs devices run hotter without heat spreaders',
    },
    {
      prompt: "Why does silicon dominate mainstream integrated-circuit manufacturing despite GaAs's higher electron mobility?",
      correct: 'Silicon has a stable native oxide (SiO₂) that makes an excellent MOSFET gate dielectric; GaAs has no comparable native oxide',
      incorrect: "GaAs's band gap is too small to suppress leakage current at room temperature",
    },
  ],

  // World 5 (session05.tex: BCS theory, Nambu/Bogoliubov-de Gennes,
  // Majorana fermions).
  5: [
    // Aluminum -- conventional s-wave superconductor.
    {
      prompt: 'What mediates the attractive electron pairing in a conventional superconductor like aluminum?',
      correct: 'Phonons (lattice vibrations)',
      incorrect: 'Magnons (spin fluctuations)',
    },
    {
      prompt: "Aluminum's on-site pairing Δ(k) = const. is even in k. What spin channel does this put it in?",
      correct: 'Spin-singlet (L = 0, s-wave)',
      incorrect: 'Spin-triplet (L = 1, p-wave)',
    },
    {
      prompt: 'Below its critical temperature, what does aluminum do to an external magnetic field (the Meissner effect)?',
      correct: 'Actively expels it from the bulk',
      incorrect: 'Tolerates it, same as above T_c',
    },
    {
      prompt: 'Why is the superconducting flux quantum Φ₀ = h/2e rather than h/e?',
      correct: 'Cooper pairs carry charge 2e',
      incorrect: 'Aluminum ions carry charge 2e',
    },
    {
      prompt: "Why does aluminum's s-wave gap survive strong non-magnetic disorder unscathed (Anderson's theorem)?",
      correct: 'Disorder preserves time-reversed pairing partners',
      incorrect: 'Phonons screen out the disorder potential',
    },
    {
      prompt: "What Chern number does aluminum's trivial s-wave pairing carry?",
      correct: 'C = 0',
      incorrect: 'C = ±2',
    },
    // Lead -- conventional s-wave superconductor, BCS mean field.
    {
      prompt: 'Mean-field BCS theory decouples the attractive interaction in which channel?',
      correct: 'The particle-particle (pairing) channel',
      incorrect: 'The particle-hole (density) channel',
    },
    {
      prompt: 'As the attractive interaction |U| grows, the self-consistent gap Δ...',
      correct: 'Grows monotonically from zero',
      incorrect: 'Jumps discontinuously at a threshold',
    },
    {
      prompt: 'The Nambu spinor pairs an ordinary electron operator at k with...',
      correct: 'A hole (creation) operator at −k, opposite spin',
      incorrect: 'A second electron operator at +k, same spin',
    },
    {
      prompt: 'Diagonalizing the reduced Bogoliubov-de Gennes block gives quasiparticle energies E(k) =...',
      correct: '±√(ε(k)² + |Δ(k)|²)',
      incorrect: '±(ε(k) + |Δ(k)|)',
    },
    {
      prompt: "A superconductor's ground state isn't an eigenstate of particle number N, but it does have a fixed...",
      correct: 'Fermion parity',
      incorrect: 'The exact number of Cooper pairs',
    },
    {
      prompt: "Unlike a magnetic (Zeeman) field, Rashba spin-orbit coupling leaves an s-wave gap like lead's...",
      correct: 'Essentially intact (time-reversal symmetric)',
      incorrect: 'Destroyed immediately',
    },
    // YBCO -- unconventional d-wave cuprate superconductor.
    {
      prompt: "YBCO's d-wave gap Δ(k) = Δ₀(cos kx − cos ky) vanishes exactly along...",
      correct: 'The Brillouin-zone diagonals, kx = ±ky',
      incorrect: 'The zone-boundary edges, kx = ±π',
    },
    {
      prompt: "Because its gap has nodes, YBCO's Fermi surface ends up...",
      correct: 'Gapped almost everywhere, gapless only at the nodes',
      incorrect: 'Fully gapped everywhere, like a plain s-wave metal',
    },
    {
      prompt: 'In the angular-momentum classification of pairing, d-wave order like YBCO\'s corresponds to...',
      correct: 'L = 2',
      incorrect: 'L = 0',
    },
    {
      prompt: "Is YBCO's Cooper pairing spin-singlet or spin-triplet?",
      correct: 'Spin-singlet (even parity)',
      incorrect: 'Spin-triplet (odd parity)',
    },
    {
      prompt: 'Cuprate high-T_c superconductors like YBCO can reach critical temperatures in the...',
      correct: 'Hundreds of kelvin range',
      incorrect: 'Single-digit kelvin range, like simple metals',
    },
    {
      prompt: 'What is believed to mediate the pairing attraction in cuprates like YBCO, instead of phonons?',
      correct: 'Antiferromagnetic magnon fluctuations',
      incorrect: 'The same phonon mechanism as conventional superconductors',
    },
    // Niobium -- conventional s-wave superconductor, type-II vortices.
    {
      prompt: 'What exchange (Zeeman) field strength closes the gap of an s-wave superconductor like niobium?',
      correct: 'J_c = Δ, equal to the gap itself',
      incorrect: 'J_c = 2Δ',
    },
    {
      prompt: "How does niobium's resistance behave right at T_c, compared to an ordinary metal cooling down?",
      correct: 'It drops suddenly to exactly zero',
      incorrect: 'It falls smoothly toward zero, same as a normal metal',
    },
    {
      prompt: 'In a type-II superconductor like niobium, where does the surviving magnetic field live once flux gets in?',
      correct: 'Confined to quantized vortices',
      incorrect: 'Spread uniformly through the bulk',
    },
    {
      prompt: "A uniform s-wave gap opens in niobium's spectrum precisely at momenta where...",
      correct: 'ε(k) = 0, the original normal-state Fermi surface',
      incorrect: 'k = 0, the center of the Brillouin zone',
    },
    {
      prompt: "In niobium's superconducting state, what's the energy cost to add or remove one whole Cooper pair, versus one lone unpaired electron?",
      correct: 'Zero for a pair; at least Δ for a lone electron',
      incorrect: 'The same cost, set by Δ, either way',
    },
    {
      prompt: 'Unlike ordinary non-magnetic disorder, magnetic disorder in a niobium sample...',
      correct: 'Pair-breaks locally, producing Yu-Shiba-Rusinov-like bound states',
      incorrect: 'Is screened out harmlessly, exactly like non-magnetic disorder',
    },
    // Tantalum Disulfide (1H) -- standalone metallic/superconducting TMD, nodal pairing.
    {
      prompt: 'Given one Fermi surface, unconventional nodal pairing (unlike a full s-wave gap) leaves the system...',
      correct: 'Gapped almost everywhere, but gapless at isolated nodal momenta',
      incorrect: 'Fully gapped everywhere, exactly like s-wave',
    },
    {
      prompt: "On a triangular lattice like 1H-TaS₂'s, nodal order shows six alternating-sign lobes around the Fermi surface. What angular-momentum channel is that?",
      correct: 'L = 3 (f-wave)',
      incorrect: 'L = 2 (d-wave)',
    },
    {
      prompt: 'Extended s-wave order is still L = 0, same symmetry as plain s-wave, but differs how?',
      correct: "It's nodal radially: positive near Γ, negative farther out",
      incorrect: "It's nodal angularly, alternating sign around the Fermi surface",
    },
    {
      prompt: 'Does a uniform pairing Δ still fully gap the Fermi surface on a triangular lattice, whatever the chemical potential?',
      correct: 'Yes: a constant Δ gaps it at any chemical potential',
      incorrect: 'No: uniform gapping only works on the square lattice',
    },
    {
      prompt: 'The superconducting gap Δ(k) can be expanded in an angular-momentum basis on the Fermi surface, directly analogous to...',
      correct: 'The spherical-harmonic expansion of an atomic orbital',
      incorrect: 'The Fourier expansion of a periodic lattice potential',
    },
    {
      prompt: 'In that same angular-momentum classification, which channel is spin-triplet pairing?',
      correct: 'L = 1 (p-wave)',
      incorrect: 'L = 2 (d-wave)',
    },
    // Lanthanum Decahydride -- off-syllabus (no session covers superhydride
    // superconductivity specifically); written from real physics.
    {
      prompt: 'What is unusual about the conditions LaH₁₀ needs to superconduct near room temperature?',
      correct: "It requires roughly 170 GPa of pressure, comparable to Earth's core",
      incorrect: 'It requires no special pressure, just standard laboratory conditions',
    },
    {
      prompt: "Is LaH₁₀'s superconducting mechanism conventional or unconventional?",
      correct: 'Conventional: ordinary phonon-mediated BCS (Migdal-Eliashberg) pairing',
      incorrect: 'Unconventional: d-wave pairing mediated by spin fluctuations',
    },
    {
      prompt: 'Why does hydrogen make such an effective phonon-mediated superconductor?',
      correct: 'Its light mass gives very high-frequency phonons, boosting the electron-phonon coupling',
      incorrect: 'Its heavy mass slows phonons enough to strengthen pairing',
    },
    {
      prompt: "What structural feature of LaH₁₀ hosts its hydrogen atoms?",
      correct: 'A clathrate-like cage of hydrogen surrounding each lanthanum atom',
      incorrect: 'A simple substitutional alloy with no distinct hydrogen sublattice',
    },
    {
      prompt: 'Does LaH₁₀ host a Majorana zero mode the way a chernSuperconductor does?',
      correct: "No: its pairing is ordinary and non-topological, so it stays plain 'superconductor'",
      incorrect: 'Yes, its extreme Tc implies topological pairing',
    },
    {
      prompt: "What quasiparticle is a superconducting condensate's own amplitude mode called?",
      correct: 'The Higgs mode',
      incorrect: 'The magnon',
    },
    // Uranium Ditelluride -- off-syllabus, candidate spin-triplet/chiral superconductor.
    {
      prompt: 'What pairing symmetry is UTe₂ the leading real-material candidate for?',
      correct: 'Spin-triplet pairing',
      incorrect: 'Ordinary s-wave singlet pairing',
    },
    {
      prompt: 'What kind of evidence points toward UTe₂ having genuinely topological (chiral) pairing?',
      correct: 'Contested reports of broken time-reversal symmetry and chiral in-gap surface states',
      incorrect: 'A universally agreed-upon, unambiguous vortex Majorana observation',
    },
    {
      prompt: "Why does this game classify UTe₂ as 'chernSuperconductor' rather than plain 'superconductor'?",
      correct: "As the leading candidate topological/triplet superconductor, it's the real material closest to that genuine topological-pairing physics",
      incorrect: 'Because its critical temperature is the highest of any known superconductor',
    },
    {
      prompt: "What is unusual about UTe₂'s upper critical field for an ordinary spin-singlet superconductor?",
      correct: 'It exceeds the ordinary Pauli paramagnetic limit by a wide margin',
      incorrect: 'It is suppressed to nearly zero by any applied field',
    },
    {
      prompt: "Is UTe₂'s topological/chiral nature experimentally settled?",
      correct: 'No: newer high-quality crystals have complicated the earlier time-reversal-breaking evidence',
      incorrect: 'Yes, it has been unambiguously confirmed by multiple independent groups',
    },
    {
      prompt: 'Which move class is unique to chernSuperconductor among every type in this game?',
      correct: 'Majorana Split, requiring genuine topological pairing',
      incorrect: 'Higgs Oscillation, since only chernSuperconductor hosts a condensate amplitude mode',
    },
  ],

  // World 6 (session06.tex: classical magnetism, magnons, the
  // Dzyaloshinskii-Moriya interaction, multiferroics).
  6: [
    // Iron -- ferromagnet, magnon dispersion/quasiparticle half of its pool
    // (the mean-field/Stoner half lives in World 1's own pool above).
    {
      prompt: "Near k=0, a ferromagnet's magnon dispersion behaves as...",
      correct: 'E(k) ∝ k²: quadratic',
      incorrect: 'E(k) ∝ |k|: linear',
    },
    {
      prompt: 'A magnon propagating through a ferromagnetic conductor like iron carries...',
      correct: 'Spin and energy, but no charge',
      incorrect: 'Charge and spin, like a conduction electron',
    },
    {
      prompt: 'The Holstein-Primakoff transformation maps spin operators exactly onto...',
      correct: 'Bosonic creation/annihilation operators',
      incorrect: 'Fermionic creation/annihilation operators',
    },
    // Cobalt -- Stoner-criterion and magnon Goldstone-mode half of its pool
    // (the rest lives in World 1's own pool above).
    {
      prompt: 'The Stoner criterion for a spontaneous ferromagnetic instability to develop is...',
      correct: 'U·D(E_F) ≥ 1',
      incorrect: 'U·D(E_F) ≤ 1',
    },
    {
      prompt: "Why does a ferromagnet's magnon energy vanish exactly at k=0?",
      correct: "It's the Goldstone mode of broken spin-rotation symmetry",
      incorrect: "It's protected by a nonzero Chern number",
    },
    {
      prompt: 'How much spin angular momentum does a single magnon carry?',
      correct: 'Exactly one unit (S=1)',
      incorrect: 'One-half unit (S=1/2), like an electron',
    },
    // Manganese Oxide (MnO) -- Mott-insulating antiferromagnet.
    {
      prompt: 'MnO conducts no charge, though its spins keep fluctuating. Why?',
      correct: 'Hubbard U opens a Mott gap',
      incorrect: 'An ordinary single-particle band gap',
    },
    {
      prompt: 'In the Hubbard model, repulsive on-site interaction (U > 0) mainly drives...',
      correct: 'Magnetism',
      incorrect: 'Superconductivity',
    },
    {
      prompt: "Even though a Mott insulator like MnO blocks charge transport, what excitation can still carry its spin and heat?",
      correct: 'Magnons',
      incorrect: 'Phonons',
    },
    {
      prompt: 'In mean-field Hubbard theory, the quantity m = ⟨n↑⟩ − ⟨n↓⟩ used to describe an ordered state like MnO\'s is called...',
      correct: 'The magnetization',
      incorrect: 'The charge-density-wave order parameter',
    },
    {
      prompt: 'In mean-field Hubbard theory on a lattice with repulsive U, the self-consistent solution favors which order over ferromagnetism?',
      correct: 'Antiferromagnetic order',
      incorrect: 'Ferromagnetic order',
    },
    {
      prompt: 'In the exactly-solved two-site Hubbard dimer, a toy model for Mott physics, the critical interaction U_c above which magnetization turns on is...',
      correct: 'U_c = 2t',
      incorrect: 'U_c = 4t',
    },
    // Chromium Triiodide (CrI₃) -- van der Waals ferromagnet, topological/DM magnons.
    {
      prompt: 'What has been experimentally observed at the magnon Dirac point of the van der Waals ferromagnet CrI₃?',
      correct: 'A magnon gap opening',
      incorrect: 'A vanishing gap, confirming gapless Dirac magnons',
    },
    {
      prompt: 'What ingredient, added on top of plain Heisenberg exchange, can give a magnon band structure a nonzero Chern number?',
      correct: 'A Dzyaloshinskii-Moriya (spin-orbit) term',
      incorrect: 'A larger nearest-neighbor exchange J alone',
    },
    {
      prompt: 'The Dzyaloshinskii-Moriya interaction couples neighboring spins via...',
      correct: 'A cross product, D·(S_i × S_j)',
      incorrect: 'A dot product, S_i · S_j',
    },
    {
      prompt: 'On a ribbon geometry, a topologically nontrivial magnon band structure hosts...',
      correct: 'Chiral edge magnon modes crossing the gap',
      incorrect: 'No edge states: topology only shows up in the bulk',
    },
    {
      prompt: 'What symmetry must be broken for Dzyaloshinskii-Moriya exchange to appear at all?',
      correct: 'Mirror symmetry',
      incorrect: 'Time-reversal symmetry',
    },
    {
      prompt: 'Unlike the chiral electronic edge states of a Chern insulator, chiral edge magnons carry...',
      correct: 'Spin and energy, but no charge current',
      incorrect: 'Charge current, just like electrons',
    },
    // Chromium Tribromide (CrBr₃) -- van der Waals ferromagnet.
    {
      prompt: 'A magnet like CrBr₃ that breaks time-reversal symmetry hosts which emergent excitation, as opposed to a quantum spin liquid?',
      correct: 'Magnons: spin-1, charge-neutral excitations',
      incorrect: 'Spinons: spin-1/2, charge-neutral excitations',
    },
    {
      prompt: 'What two quantities does the Stoner criterion multiply together to test for spontaneous magnetism?',
      correct: 'The interaction U and the density of states at the Fermi level D(E_F)',
      incorrect: 'The temperature T and the applied magnetic field B',
    },
    {
      prompt: 'At half filling, as U→∞ in a strongly-correlated self-consistent Hubbard chain, the magnetic moment per site saturates at...',
      correct: 'Exactly one Bohr magneton: a full localized spin-1/2',
      incorrect: 'It grows without bound as U increases',
    },
    {
      prompt: "Near k=0, how does an antiferromagnet's magnon dispersion behave, in contrast to a ferromagnet's quadratic E(k)∝k²?",
      correct: 'E(k) ∝ |k|: linear, Dirac-cone-like',
      incorrect: 'E(k) ∝ k²: also quadratic, same as the ferromagnet',
    },
    {
      prompt: 'The direct superexchange mechanism (J=4t²/U, from a single-orbital Hubbard model) always produces coupling that is...',
      correct: 'Antiferromagnetic, regardless of the sign of the hopping t',
      incorrect: 'Ferromagnetic, if the hopping t happens to be negative',
    },
    {
      prompt: 'CrBr₃ has been paired with the 2D superconductor NbSe₂ in a real heterostructure studied for...',
      correct: 'Proximity-induced exchange coupling relevant to topological superconductivity',
      incorrect: 'Making NbSe₂ itself ferromagnetic in bulk',
    },
    // Monolayer NiI₂ -- real observed noncollinear multiferroic.
    {
      prompt: 'Which real 2D material has been observed experimentally as a case of noncollinear order from competing exchange interactions?',
      correct: 'Monolayer NiI₂',
      incorrect: 'Monolayer CrI₃',
    },
    {
      prompt: 'In NiI₂, the noncollinear helical spin order arises from...',
      correct: 'Competing (J1-J2-type) exchange interactions, not lattice frustration',
      incorrect: 'Purely geometric frustration on a non-bipartite lattice',
    },
    {
      prompt: 'Real-world, monolayer NiI₂ is classified as a...',
      correct: "Type-II multiferroic: its ferroelectricity is magnetically induced",
      incorrect: 'Type-I multiferroic: independent magnetic and electric order',
    },
    {
      prompt: 'The J1-J2 spiral mechanism behind NiI₂-type noncollinear order can occur even on a lattice that is...',
      correct: 'Perfectly bipartite, such as a simple chain: no geometric frustration needed',
      incorrect: 'Only a non-bipartite lattice like triangular or kagome',
    },
    {
      prompt: 'An electromagnon, the kind of excitation hosted by NiI₂, is a spin wave that additionally...',
      correct: "Couples to an electric field via the material's magnetically-induced polarization",
      incorrect: 'Carries a net electric charge, unlike an ordinary magnon',
    },
    {
      prompt: 'Because NiI₂ is a magnetic (Mott) insulator, an electromagnon can still propagate through it carrying...',
      correct: 'Spin and energy, but no charge current',
      incorrect: 'Charge current, since it is still an electron-based excitation',
    },
    // Yttrium Iron Garnet -- off-syllabus (magnonics workhorse), real physics.
    {
      prompt: "Is YIG's magnetic order ferromagnetic or ferrimagnetic?",
      correct: 'Ferrimagnetic: two sublattices order antiparallel with unequal moment',
      incorrect: 'Ferromagnetic: all moments align exactly parallel',
    },
    {
      prompt: 'What property makes YIG the material of choice for real magnon-transport experiments?',
      correct: 'Exceptionally low magnon damping compared to any other known material',
      incorrect: 'An unusually large magnon energy gap',
    },
    {
      prompt: "What quasiparticle does YIG's magnetic order carry as its low-energy excitation?",
      correct: 'A magnon, a quantized spin wave',
      incorrect: 'A polaron, a self-trapped charge carrier',
    },
    {
      prompt: 'Why is YIG electrically insulating despite being magnetically ordered?',
      correct: 'Its Fe³⁺ ions are locally moment-bearing but the material has no itinerant conduction electrons',
      incorrect: 'Its magnon damping suppresses all electronic transport',
    },
    {
      prompt: 'A "magnon BEC" experiment, as done in YIG, refers to...',
      correct: 'A macroscopic population of magnons condensing into a single coherent quantum state',
      incorrect: 'Individual magnons decaying into ordinary phonons at low temperature',
    },
    {
      prompt: "How many chemically distinct magnetic sublattices does YIG's garnet structure carry?",
      correct: "Two, with unequal magnetic moment that don't cancel",
      incorrect: 'One, all Fe ions equivalent',
    },
    // Bismuth Ferrite (BiFeO₃) -- off-syllabus, real room-temperature multiferroic.
    {
      prompt: 'What two orders coexist in BiFeO₃, making it a multiferroic?',
      correct: 'Ferroelectric polarization and antiferromagnetic order',
      incorrect: 'Superconductivity and ferromagnetism',
    },
    {
      prompt: "What ion's lone pair drives BiFeO₃'s ferroelectric polarization, unlike BaTiO₃'s Ti⁴⁺ off-centering?",
      correct: 'The Bi³⁺ 6s² lone pair',
      incorrect: 'The Fe³⁺ 3d⁵ configuration',
    },
    {
      prompt: "What quasiparticle, unique to multiferroics in this game's taxonomy, has actually been observed in BiFeO₃'s spectrum?",
      correct: 'The electromagnon, a magnon-phonon hybrid with electric-dipole activity',
      incorrect: 'The ferron alone, with no magnon-phonon hybridization',
    },
    {
      prompt: "What is BiFeO₃'s magnetic order specifically called?",
      correct: 'G-type antiferromagnetic order with a superimposed spin cycloid',
      incorrect: 'Simple collinear ferromagnetic order',
    },
    {
      prompt: 'Why is BiFeO₃ called a room-temperature multiferroic, unlike many other multiferroics?',
      correct: 'Both its ferroelectric and magnetic transitions sit far above room temperature',
      incorrect: 'It only shows multiferroic coupling below liquid-helium temperature',
    },
    {
      prompt: "Compared to Twisted CrI₃'s predicted multiferroic coupling, BiFeO₃'s coupling is...",
      correct: 'An established experimental result, not just a theoretical prediction',
      incorrect: 'Also only theoretically predicted, never observed',
    },
  ],

  // World 7 (session07.tex: entanglement entropy, the area law, matrix
  // product states, tensor-network diagrams).
  7: [
    // Strontium Copper Borate -- Shastry-Sutherland dimerized spin liquid.
    {
      prompt: "The exactly solvable dimerized Heisenberg chain's ground state is a tensor product of what, one per bond?",
      correct: 'Singlets',
      incorrect: 'Triplets',
    },
    {
      prompt: "For the antiferromagnetic Heisenberg dimer's singlet ground state, what is the entanglement entropy between its two sites?",
      correct: 'log 2, the maximum a single spin-1/2 can carry',
      incorrect: 'Zero: singlets are unentangled',
    },
    {
      prompt: 'In the dimerized chain, why does the entanglement entropy stay fixed no matter how large subsystem A grows?',
      correct: 'Only the two bonds at the boundary are ever cut',
      incorrect: 'Entanglement decays exponentially with distance',
    },
    {
      prompt: 'This saturation of entanglement entropy with subsystem size, seen in the dimerized chain, is a hallmark of which general rule for gapped ground states?',
      correct: 'The area law',
      incorrect: 'The volume law',
    },
    {
      prompt: 'A product state with no entanglement at all has what kind of reduced density matrix ρ_A?',
      correct: 'A rank-one projector',
      incorrect: 'A maximally mixed matrix',
    },
    {
      prompt: 'For a matrix product state of bond dimension M, what is the maximum entanglement entropy it can represent across a bond?',
      correct: 'log M',
      incorrect: 'M itself',
    },
    // Thallium Copper Chloride -- quantum spin-dimer compound, MPS/DMRG.
    {
      prompt: 'The Jordan-Wigner transformation maps spin operators to fermionic operators plus what extra piece?',
      correct: 'A string operator counting parity to the left',
      incorrect: 'A simple phase factor of i',
    },
    {
      prompt: 'Storing a general L-site spin-1/2 wave function exactly requires how many coefficients?',
      correct: '2^L: exponential in system size',
      incorrect: 'L²: polynomial in system size',
    },
    {
      prompt: 'The matrix product state ansatz replaces those exponentially many coefficients with a parameter count that scales as...',
      correct: 'O(L M²), linear in system size',
      incorrect: 'O(M^L), still exponential',
    },
    {
      prompt: 'DMRG optimizes a matrix product state by minimizing the energy how many tensors at a time?',
      correct: 'One tensor at a time, sweeping through the chain',
      incorrect: 'All tensors at once, in one global solve',
    },
    {
      prompt: 'Compared to a plain MPS, what extra structure does MERA use to capture more entanglement, useful right at a critical point?',
      correct: 'A hierarchy of tensors across length scales',
      incorrect: 'A single very large bond dimension',
    },
    {
      prompt: "The 1D Heisenberg chain's exact ground-state energy per site in the thermodynamic limit, from the Bethe ansatz, is...",
      correct: '1/4 − ln 2 ≈ −0.443 J',
      incorrect: '−1/4 J exactly',
    },
    // Y₂BaNiO₅ -- real gapped S=1 Haldane-chain antiferromagnet.
    {
      prompt: "As a real gapped, one-dimensional S=1 antiferromagnetic chain, Y₂BaNiO₅'s ground-state entanglement entropy across a bipartition does what as the subsystem grows?",
      correct: 'Saturates at a fixed, subsystem-size-independent value (the area law)',
      incorrect: 'Grows linearly with subsystem size (a volume law)',
    },
    {
      prompt: "Because it's a gapped 1D chain, how large a matrix-product-state bond dimension is needed to represent Y₂BaNiO₅'s ground state well?",
      correct: 'A modest, fixed bond dimension, since S ≤ log M matches what the area law needs',
      incorrect: 'An exponentially large bond dimension, since 1D gapped states violate the area law',
    },
    {
      prompt: 'In tensor-network diagram notation, joining two legs between neighboring MPS tensors represents...',
      correct: 'Contracting (summing over) that shared index',
      incorrect: "Multiplying the two tensors' overall magnitudes together",
    },
    {
      prompt: 'DMRG optimizes an MPS ground state by treating each tensor as a variational parameter. At each step, what kind of problem does it solve for one tensor while holding the rest fixed?',
      correct: 'An ordinary linear eigenvalue problem',
      incorrect: 'A nonlinear optimization over all tensors simultaneously',
    },
    {
      prompt: "Right at a quantum critical point (unlike a gapped chain such as Y₂BaNiO₅'s own Haldane phase), how does entanglement entropy scale with subsystem size?",
      correct: 'Logarithmically, S(ℓ) = (c/3) log ℓ + const.',
      incorrect: 'It stays exactly constant, the same as the gapped case',
    },
    {
      prompt: 'PEPS, the natural 2D generalization of the MPS ansatz used for 1D chains like this one, is harder to optimize because...',
      correct: 'Contracting a general 2D tensor network is itself computationally hard, unlike 1D',
      incorrect: 'PEPS require exponentially many tensors as the system grows, unlike MPS',
    },
  ],

  // World 8 (session08.tex: frustrated magnetism, spinons, the parton
  // construction, RVB states, the Kondo lattice).
  8: [
    // α-Ruthenium Trichloride -- Kitaev spin liquid candidate, spinon/parton construction.
    {
      prompt: "Near a ferromagnet's fully polarized ground state, flipping one spin creates a magnon with ΔS = 1. What is the spin change of the analogous excitation in a quantum spin liquid, built by leaving one spin unpaired from an otherwise complete singlet covering?",
      correct: 'ΔS = 1/2, a spinon',
      incorrect: 'ΔS = 1, same as a magnon',
    },
    {
      prompt: 'Which two lattice geometries, built entirely out of triangles, are the standard hunting ground for frustration-driven quantum spin liquid physics?',
      correct: 'Triangular and kagome lattices',
      incorrect: 'Square and honeycomb lattices',
    },
    {
      prompt: "For the quantum Heisenberg dimer H = S₀·S₁, the unique ground state (unlike the classical Ising dimer's two degenerate states) is...",
      correct: 'A time-reversal-symmetric singlet',
      incorrect: 'One of two symmetry-broken, degenerate states',
    },
    {
      prompt: 'In the parton (Abrikosov-fermion) construction, each lattice spin is rewritten in terms of an auxiliary fermion that carries...',
      correct: 'Spin 1/2, but no electric charge',
      incorrect: 'Both spin and electric charge',
    },
    {
      prompt: 'The parton construction enlarges the local Hilbert space from 2 states to 4 per site. What must be imposed to remove the unphysical states?',
      correct: 'A single-occupancy constraint, one fermion per site',
      incorrect: 'A double-occupancy constraint, two fermions per site',
    },
    {
      prompt: "In the single-impurity Kondo problem, a magnetic impurity coupled to a metal's conduction electrons forms a ground state that is...",
      correct: 'A time-reversal-symmetric singlet with a conduction electron',
      incorrect: 'A ferromagnetically aligned, symmetry-broken state',
    },
    // YbMgGaO₄ -- quantum spin liquid candidate, RVB/gauge-field content.
    {
      prompt: 'The RVB (resonating valence bond) variational wavefunction is built by taking a BCS-paired state of auxiliary fermions and applying a...',
      correct: 'Gutzwiller projector onto singly-occupied sites',
      incorrect: 'Bogoliubov rotation onto the lower band',
    },
    {
      prompt: 'A fixed, static pattern of singlets covering a lattice, rather than a genuinely resonating superposition of all possible singlet pairings, is called a...',
      correct: 'Valence bond solid (VBS)',
      incorrect: 'Resonating valence bond (RVB) liquid',
    },
    {
      prompt: 'Breaking one singlet of a valence-bond-solid into its excited triplet partner produces a local excitation called a...',
      correct: 'Triplon, spin-1 like a magnon',
      incorrect: 'Spinon, spin-1/2',
    },
    {
      prompt: 'Under a local phase rotation of the auxiliary spinon fermions, the mean-field bond variable χ_ij picks up a relative phase. This makes χ_ij behave like a...',
      correct: 'Lattice gauge field link variable',
      incorrect: 'Ordinary, gauge-invariant order parameter',
    },
    {
      prompt: "A single flipped-flux plaquette in a quantum spin liquid's emergent gauge field is a topological defect called a...",
      correct: 'A vison',
      incorrect: 'A chargon',
    },
    {
      prompt: 'In the Kondo lattice, turning on the Kondo hybridization γ_K opens a gap where the flat localized-moment band would otherwise cross the dispersive conduction band, converting the metal into a...',
      correct: 'Kondo insulator (heavy-fermion insulator)',
      incorrect: 'Ordinary band insulator, unrelated to magnetism',
    },
    // Tantalum Disulfide (1T) -- CDW Mott/spin-liquid candidate phase.
    {
      prompt: 'Classical magnets (ferro-, antiferromagnets) break time-reversal symmetry and yield to mean-field theory. What makes a quantum spin liquid categorically different?',
      correct: 'No mean-field description in terms of the original spins exists; the ground state carries long-range entanglement',
      incorrect: 'It just orders at a lower critical temperature',
    },
    {
      prompt: 'On a triangular plaquette with antiferromagnetic coupling on all three bonds, why can no single classical spin configuration satisfy every bond at once?',
      correct: 'Any two spins can anti-align, but the third bond is left frustrated between two spins already antiparallel to each other',
      incorrect: 'One of the three bonds is secretly ferromagnetic',
    },
    {
      prompt: 'Fractionalizing an electron in a quantum spin liquid splits it into a charge-carrying piece and a spin-carrying piece. What are these two pieces called?',
      correct: 'A chargon and a spinon',
      incorrect: 'A polaron and a magnon',
    },
    {
      prompt: 'A valence bond solid (a fixed, static covering of the lattice by singlets) is not yet a genuine quantum spin liquid. Why not?',
      correct: 'Its excitations (triplons) are still spin-1, structurally the same as an ordinary magnon',
      incorrect: "It doesn't have a time-reversal-symmetric ground state",
    },
    {
      prompt: 'The RVB variational wavefunction is motivated by treating singlets on a frustrated lattice as analogous to which other well-known paired state?',
      correct: 'Cooper pairs in a BCS superconductor',
      incorrect: 'Landau levels in the quantum Hall effect',
    },
    {
      prompt: 'Diagonalizing the mean-field spinon Hamiltonian can produce three qualitatively different band structures. Which three?',
      correct: 'Gapless (spinon Fermi surface), gapped, or Dirac spinons',
      incorrect: 'Ferromagnetic, antiferromagnetic, or spiral spinons',
    },
    // YbRh₂Si₂ -- flagship Kondo-lattice heavy-fermion metal.
    {
      prompt: 'Unlike a Kondo insulator (SmB₆, or the 1T/1H-TaS₂ heterostructure), why does YbRh₂Si₂ remain a metal despite the same Kondo hybridization mechanism?',
      correct: 'Its Fermi level sits away from the hybridization gap, cutting through the heavy, renormalized bands',
      incorrect: 'Its Kondo coupling γ_K is exactly zero, so no hybridization occurs at all',
    },
    {
      prompt: "In the mean-field Kondo-lattice Hamiltonian, what does the flat, zero-energy f-fermion band represent physically for YbRh₂Si₂'s own local moments?",
      correct: 'The localized Yb 4f moments, auxiliary fermions carrying no hopping of their own',
      incorrect: "The itinerant conduction electrons' own unrenormalized band",
    },
    {
      prompt: "What happens to a conduction electron's effective mass as it hybridizes with YbRh₂Si₂'s flat, localized f-band, forming its heavy quasiparticles?",
      correct: 'It becomes strongly renormalized, effectively far heavier than a bare electron',
      incorrect: 'It stays exactly the bare electron mass, unaffected by hybridization',
    },
    {
      prompt: 'Growing the Kondo hybridization γ_K in the mean-field lattice Hamiltonian does what to the gap at the anti-crossing?',
      correct: 'Opens/grows it monotonically: the larger γ_K, the larger the gap',
      incorrect: 'Shrinks it, since stronger coupling favors a gapless metal',
    },
    {
      prompt: 'YbRh₂Si₂ is the flagship material for sitting almost exactly at the balance point of the Doniach competition. Between which two tendencies?',
      correct: 'A magnetically ordered heavy-fermion phase and a paramagnetic, Kondo-screened heavy-fermion phase',
      incorrect: 'A superconducting phase and an ordinary band-insulating phase',
    },
    {
      prompt: "Why does the game classify YbRh₂Si₂ as 'kondoHeavyFermion' rather than 'classicalMagnet', even though it eventually orders magnetically at very low temperature?",
      correct: 'Its heavy, Kondo-hybridized quasiparticles (not simple localized spins) carry that order and define the compound',
      incorrect: 'Because antiferromagnetism is impossible in any classicalMagnet-type material',
    },
    // Cerium Cobalt Indide -- off-syllabus, second Kondo-lattice flagship.
    {
      prompt: "What renormalizes a conduction electron into CeCoIn₅'s \"heavy\" quasiparticle?",
      correct: 'Hybridization with a local Ce 4f moment',
      incorrect: 'Ordinary phonon scattering at low temperature',
    },
    {
      prompt: "Roughly how much heavier is CeCoIn₅'s renormalized quasiparticle mass than a bare electron's?",
      correct: 'On the order of a hundred times',
      incorrect: 'Roughly twice',
    },
    {
      prompt: "What is CeCoIn₅'s own T→0 ground state?",
      correct: 'An unconventional (d-wave) superconductor built from its heavy quasiparticles',
      incorrect: 'A conventional band insulator',
    },
    {
      prompt: "Why does this game classify CeCoIn₅ as 'kondoHeavyFermion' rather than 'superconductor', despite its superconducting ground state?",
      correct: 'The Kondo-lattice heavy-fermion physics is what defines the compound; the pairing is a low-energy instability built on top of it',
      incorrect: "Because 'superconductor' is reserved only for elemental metals like Aluminum and Lead",
    },
    {
      prompt: 'What kind of phase transition is CeCoIn₅ famous for sitting right next to?',
      correct: 'An antiferromagnetic quantum critical point',
      incorrect: 'A structural (crystallographic) phase transition',
    },
    {
      prompt: 'Which quasiparticle, unique to the kondoHeavyFermion type, does CeCoIn₅ carry?',
      correct: 'A heavy fermion, the mass-renormalized conduction-electron/local-moment composite',
      incorrect: "A Higgs mode, the condensate's own amplitude oscillation",
    },
    // Cerium Zirconate Pyrochlore -- off-syllabus, quantum-spin-ice candidate.
    {
      prompt: 'Down to what temperature scale has Ce₂Zr₂O₇ shown no magnetic order or spin freezing?',
      correct: 'Tens of millikelvin',
      incorrect: 'Only down to about 100 K',
    },
    {
      prompt: "What lattice geometry hosts Ce₂Zr₂O₇'s frustrated magnetism?",
      correct: 'The pyrochlore lattice, a network of corner-sharing tetrahedra',
      incorrect: 'A simple square lattice',
    },
    {
      prompt: 'What gauge structure characterizes the "quantum spin ice" state Ce₂Zr₂O₇ is a candidate for?',
      correct: 'An emergent U(1) gauge field, with an emergent photon and gapped spinons',
      incorrect: "A Z2 gauge field, the same as α-RuCl₃'s Kitaev spin liquid",
    },
    {
      prompt: "Why does the game still group Ce₂Zr₂O₇ under quantumSpinLiquid despite its U(1) (not Z2) gauge structure?",
      correct: "It's a deliberate simplification, the same kind already made for triplon's confined-mode physics on this type",
      incorrect: 'Because U(1) and Z2 quantum spin liquids are physically identical',
    },
    {
      prompt: 'What effective magnetic degrees of freedom do Ce³⁺ ions carry in Ce₂Zr₂O₇?',
      correct: 'Dipole-octupole doublets',
      incorrect: 'Simple classical Ising spins',
    },
    {
      prompt: 'What move does a frustrated, never-ordering compound like Ce₂Zr₂O₇ carry that an ordinary classicalMagnet cannot?',
      correct: 'Spinon Swap, a fractionalized spin excitation',
      incorrect: 'Magnon Pulse, an ordinary collective spin wave',
    },
  ],

  // World 9 (session09.tex: linear response theory, the random phase
  // approximation, Friedel oscillations, Yu-Shiba-Rusinov defect states).
  9: [
    // Fe(Te,Se) -- topological superconductor hosting vortex Majorana bound states.
    {
      prompt: 'In a conventional s-wave superconductor, which type of point impurity pulls a genuine bound state into the gap?',
      correct: 'A magnetic impurity',
      incorrect: 'A non-magnetic impurity',
    },
    {
      prompt: "The Yu-Shiba-Rusinov bound-state energy depends on the impurity's exchange coupling J only through α = πν₀JS. What does that say about the sign of J?",
      correct: 'It is irrelevant: only J² and the spin S matter',
      incorrect: 'Only an antiferromagnetic (negative) J can break Cooper pairs',
    },
    {
      prompt: "As a magnetic impurity's coupling in an s-wave superconductor is tuned past α = πν₀JS = 1, what happens to its in-gap bound state?",
      correct: 'Its energy crosses zero: a genuine quantum phase transition',
      incorrect: 'It vanishes abruptly back into the gap edge',
    },
    {
      prompt: 'Below the Yu-Shiba-Rusinov zero-energy crossing, the superconductor-plus-impurity ground state has total spin S_tot = 0. What does that describe?',
      correct: 'Every Cooper pair intact, the impurity spin screened',
      incorrect: 'The impurity spin fully free, with one pair broken',
    },
    {
      prompt: "Anderson's theorem protects the s-wave gap from non-magnetic disorder. Why does that protection not apply to a chiral (p-wave) topological superconductor?",
      correct: 'Its pairing already breaks time-reversal symmetry on its own',
      incorrect: 'Its gap is too small for the theorem to apply',
    },
    {
      prompt: 'Inserting a single vacancy into a chiral topological superconductor (but not into a trivial s-wave one) produces what new feature?',
      correct: 'A sharp in-gap bound state from bulk-boundary correspondence',
      incorrect: 'A uniform shift of the whole gap edge',
    },
    // Niobium Diselenide -- Friedel oscillations, quasiparticle interference,
    // plus this world's own general defect/response-function content.
    {
      prompt: 'The density-of-states ripple that a single point impurity produces around itself in a metal is known as...',
      correct: 'Friedel oscillations',
      incorrect: 'Shubnikov-de Haas oscillations',
    },
    {
      prompt: 'The spatial wavelength of Friedel oscillations around a 1D metallic impurity is set by...',
      correct: 'π/k_F: half the Fermi wavelength',
      incorrect: 'The lattice constant, regardless of filling',
    },
    {
      prompt: 'In dimension d, how does the amplitude of Friedel oscillations decay with distance |x| from the impurity?',
      correct: 'Algebraically, as a power law ~1/|x|^d',
      incorrect: 'Exponentially, with a fixed correlation length',
    },
    {
      prompt: 'Raising the chemical potential (and hence k_F) of a metal does what to the Friedel-oscillation wavelength around an impurity?',
      correct: 'Shortens it: the oscillations speed up',
      incorrect: 'Lengthens it: the oscillations slow down',
    },
    {
      prompt: 'The static Lindhard function χ₀(q) develops a genuine singularity at the wavevector spanning occupied to empty states of equal energy across the Fermi surface. In 1D, this wavevector is...',
      correct: 'q = 2k_F',
      incorrect: 'q = k_F',
    },
    {
      prompt: 'STM imaging of the standing-wave ripples around surface impurities, used to map the Fermi surface indirectly, is called...',
      correct: 'Quasiparticle interference (QPI)',
      incorrect: 'Angle-resolved photoemission (ARPES)',
    },
    {
      prompt: 'Rayleigh-Schrödinger perturbation theory, as used to build response functions, is valid to first order under which condition?',
      correct: 'The unperturbed state is analytic in the coupling, away from degeneracies',
      incorrect: 'The unperturbed state must be exactly degenerate with another state',
    },
    {
      prompt: 'Switching on an arbitrarily weak impurity in a metal rotates the many-body ground state exactly orthogonal to the pristine one, in the thermodynamic limit. This effect is called...',
      correct: 'The orthogonality catastrophe',
      incorrect: 'The Kondo effect',
    },
    {
      prompt: 'In the bulk-boundary correspondence argument, a single vacancy (missing lattice site) can be thought of as...',
      correct: 'A boundary shrunk down to zero size',
      incorrect: 'A perturbation that only acts in momentum space',
    },
    {
      prompt: 'Whether a local defect preserves or breaks time-reversal symmetry is decided by...',
      correct: 'Whether it distinguishes spin up from spin down',
      incorrect: "Whether it breaks the lattice's translational symmetry",
    },
    {
      prompt: 'A localized defect level sitting deep inside a large insulating gap shows what spatial decay in its induced density change?',
      correct: 'A quick, non-oscillatory convergence to the bulk value',
      incorrect: 'A slow power-law oscillatory tail, as in a metal',
    },
    {
      prompt: 'The general object relating a perturbation applied at one point in a quantum material to what is measured elsewhere is called...',
      correct: 'The response function',
      incorrect: 'The partition function',
    },
    // Manganese -- itinerant local-moment magnet, RPA read of the Stoner instability.
    {
      prompt: "A classical mean-field magnet's susceptibility χ(T) diverges as 1/(T−T_c) approaching a ferromagnetic transition. What is the analogous form for an antiferromagnetic transition?",
      correct: '1/(T+T_c): an apparent divergence at a negative temperature',
      incorrect: '1/(T−T_c), identical to the ferromagnetic case',
    },
    {
      prompt: 'What does a diverging susceptibility actually tell you about a system?',
      correct: 'That an instability is coming, and which direction to push: not the full ordered state',
      incorrect: 'The complete microscopic structure of the ordered state that will form',
    },
    {
      prompt: "How does this world's RPA treatment locate the Stoner magnetic instability?",
      correct: 'By watching when the disordered (paramagnetic) response function itself diverges',
      incorrect: 'By writing down an ordered magnetic ansatz and solving it self-consistently',
    },
    {
      prompt: 'In the RPA response χ(q,ω) = χ₀/(1 − Uχ₀), what condition marks the actual magnetic instability?',
      correct: 'Uχ₀(q,0) = 1: the denominator vanishing',
      incorrect: 'χ₀(q,0) = 0: the numerator vanishing',
    },
    {
      prompt: 'For a Fermi surface with strong nesting, where does the bare spin response χ₀(q,0) actually peak, shifting the instability away from simple ferromagnetism?',
      correct: 'At the nesting wavevector Q, not at q = 0',
      incorrect: 'Always exactly at q = 0, regardless of nesting',
    },
    {
      prompt: 'RPA is described as a controlled approximation with a specific regime of validity. Which regime is that?',
      correct: 'Weakly to moderately correlated metals',
      incorrect: 'Strongly correlated Mott insulators, its primary intended regime',
    },
    // GeTe -- off-syllabus, ferroelectric Rashba semiconductor.
    {
      prompt: "What real-world property makes GeTe a 'ferroelectric Rashba semiconductor,' a combination BaTiO₃ doesn't have?",
      correct: 'Its polarization breaks inversion symmetry, Rashba-splitting its bands with a spin texture locked to the polarization direction',
      incorrect: 'Its ferroelectric polarization is carried entirely by magnetic Ge spins',
    },
    {
      prompt: "Compared to BaTiO₃'s ~120°C ferroelectric transition, GeTe's own transition temperature is...",
      correct: 'Much higher, roughly 700 K',
      incorrect: 'Much lower, only a few kelvin',
    },
    {
      prompt: "What structural distortion produces GeTe's ferroelectric polarization?",
      correct: 'Ge atoms displacing off-center within its rhombohedral, rocksalt-derived lattice',
      incorrect: 'An entirely disordered, amorphous atomic arrangement',
    },
    {
      prompt: "Reversing GeTe's ferroelectric polarization direction does what to its Rashba-split spin texture?",
      correct: 'Reverses it too: the two are locked together',
      incorrect: 'Nothing: the spin texture is fixed independent of polarization',
    },
    {
      prompt: "Why does the game classify GeTe as 'ferroelectric' rather than 'semiconductor', despite it being a genuine narrow-gap semiconductor?",
      correct: 'Its switchable spontaneous polarization is the more specific, defining property being taxonomized',
      incorrect: 'GeTe carries no band gap at all, ruling out semiconductor',
    },
    {
      prompt: 'What move can GeTe carry that a non-ferroelectric semiconductor like HgTe cannot?',
      correct: 'Ferron Pulse, tied to its switchable polarization order',
      incorrect: 'Plasmon Pulse, tied to a free electron gas',
    },
    // Hafnium Oxide -- off-syllabus, CMOS-compatible thin-film ferroelectric.
    {
      prompt: 'Is bulk, unstrained HfO₂ ferroelectric?',
      correct: 'No: its ordinary monoclinic phase is centrosymmetric and not ferroelectric',
      incorrect: 'Yes, ferroelectricity is intrinsic to HfO₂ in any form',
    },
    {
      prompt: "What stabilizes HfO₂'s ferroelectric polar orthorhombic phase in a pristine (undoped) sample?",
      correct: 'Strain from a thin, epitaxial film geometry',
      incorrect: 'A permanent applied electric field left on during growth',
    },
    {
      prompt: "Why is HfO₂'s ferroelectricity such a big deal for real electronics, unlike BaTiO₃'s?",
      correct: "It's compatible with standard CMOS silicon fabrication at nanometer thickness",
      incorrect: 'It has a much higher transition temperature than any oxide ferroelectric',
    },
    {
      prompt: "What quasiparticle does a ferroelectric like HfO₂ carry that an ordinary insulator's phonon spectrum doesn't host on its own?",
      correct: "A ferron, the polarization order's own quantized excitation",
      incorrect: 'A magnon, since ferroelectric order is magnetic in origin',
    },
    {
      prompt: "Does HfO₂'s ferroelectric phase require any magnetic order to be present?",
      correct: "No: ferroelectric order carries no magnetic order at all in this game's taxonomy",
      incorrect: 'Yes, magnetism is what couples to and stabilizes the polarization',
    },
    {
      prompt: "What technology is HfO₂'s ferroelectric phase the real basis for?",
      correct: 'FeRAM/FeFET nonvolatile memory devices',
      incorrect: 'High-Tc superconducting qubit junctions',
    },
  ],
};

// Materials that carry their own supplementary question pool on top of their
// world's pool (getWorldQuestion coin-flips between the two whenever the
// fought material has an entry here). Two distinct reasons a material ends
// up here -- see this file's top comment:
//   - Barium Titanate/Herbertsmithite spawn in two worlds each with content
//     too topic-uniform to split cleanly between them.
//   - Every other entry is a WORLD_CRYSTALS[10]-only hybrid-recipe result,
//     which needs its own pool as the "material" side of World 10's own
//     material-vs-ML-lecture picker (getWorldQuestion's world===10 branch).
export const MATERIAL_QUESTIONS: Record<string, MaterialQuestion[]> = {
  // Spawns in World 1 (mean-field SSB) and World 9 ("any type" world) --
  // its ferroelectric-structural content isn't mean-field-Hubbard-specific
  // nor defect-physics-specific, so it stays a bonus pool for either.
  'Barium Titanate': [
    {
      prompt: "What ionic displacement inside BaTiO₃'s perovskite unit cell produces its spontaneous electric polarization?",
      correct: 'The Ti⁴⁺ ion shifting off-center relative to its surrounding oxygen octahedron',
      incorrect: 'The Ba²⁺ ion migrating entirely out of the unit cell',
    },
    {
      prompt: 'Above roughly 120°C, BaTiO₃ loses its ferroelectric order and returns to its high-symmetry cubic phase. What kind of transition is this?',
      correct: 'A displacive ferroelectric (structural) phase transition',
      incorrect: 'A superconducting phase transition',
    },
    {
      prompt: 'What experimental signature distinguishes a ferroelectric like BaTiO₃ from an ordinary polar (but non-switchable) insulator?',
      correct: 'Its polarization can be reversed by an external electric field, tracing a hysteresis loop',
      incorrect: 'It conducts electricity freely once polarized',
    },
    {
      prompt: 'Cooling further below its cubic-to-tetragonal transition, how many more structural phase transitions does BaTiO₃ undergo?',
      correct: 'Two more: into orthorhombic, then rhombohedral phases',
      incorrect: 'None: the tetragonal phase persists all the way to absolute zero',
    },
    {
      prompt: 'BaTiO₃ is piezoelectric as well as ferroelectric. What does that mean?',
      correct: 'Applying mechanical stress to it generates an electric polarization, and vice versa',
      incorrect: 'It becomes ferromagnetic under mechanical stress',
    },
    {
      prompt: 'Real capacitors and piezoelectric transducers use BaTiO₃ specifically because of...',
      correct: 'Its very large dielectric permittivity and switchable polarization near its transition',
      incorrect: 'Its unusually high superconducting critical temperature',
    },
  ],

  // Spawns in World 7 (entanglement/tensor networks) and World 8 (frustrated
  // magnetism) -- genuinely kagome/quantum-spin-liquid content relevant to
  // both, not narrowly tensor-network-specific, so it stays a shared bonus pool.
  Herbertsmithite: [
    {
      prompt: "Why does mean-field theory fail for a quantum spin liquid like herbertsmithite's kagome moments?",
      correct: 'No order parameter for it to converge on',
      incorrect: 'The lattice has too much symmetry to break',
    },
    {
      prompt: "Unlike a conventional antiferromagnet, a quantum spin liquid's ground state does not do which of the following?",
      correct: 'Spontaneously break any symmetry',
      incorrect: 'Support long-range quantum entanglement',
    },
    {
      prompt: 'Which numerical method gives the leading quantitative evidence for spin-liquid physics on kagome and triangular lattices?',
      correct: 'Matrix product state / tensor-network methods',
      incorrect: 'Mean-field Hartree-Fock theory',
    },
    {
      prompt: "Herbertsmithite's local moments sit on which lattice geometry?",
      correct: 'A kagome lattice',
      incorrect: 'A honeycomb lattice',
    },
    {
      prompt: 'For a true quantum spin liquid, what does mean-field self-consistency return, since there is no symmetry-broken order to find?',
      correct: 'Zero',
      incorrect: 'A small but finite gap',
    },
    {
      prompt: "A quantum spin liquid's ground state is best described as...",
      correct: 'One enormous entangled object',
      incorrect: 'A simple pattern of ordered arrows',
    },
  ],

  // World-10-only hybrid-recipe results below (spawn nowhere else) -- each
  // pool anchors to whichever real session its own recipe's physics belongs
  // to (see each entry's own comment), even though it only ever gets asked
  // when that hybrid itself is fought in World 10.
  'Cr-doped (Bi,Sb)₂Te₃': [
    {
      prompt: 'What distinguishes the quantum anomalous Hall effect from the ordinary quantum Hall effect?',
      correct: 'No external magnetic field is needed',
      incorrect: 'It only occurs within a millikelvin of absolute zero',
    },
    {
      prompt: 'A nonzero Chern number, like the one realized in this material, requires which symmetry to be broken?',
      correct: 'Time-reversal symmetry',
      incorrect: 'Inversion symmetry',
    },
    {
      prompt: 'In a Chern insulator, the quantized Hall conductivity σ_xy is given by...',
      correct: 'C e²/h, with C the Chern number',
      incorrect: '(e²/h) times the bulk band gap',
    },
    {
      prompt: "Why can't a chiral edge current in a Chern insulator backscatter off a local impurity?",
      correct: "There's no counter-propagating state at the same edge to scatter into",
      incorrect: 'The impurity potential is too weak to couple to the edge state',
    },
    {
      prompt: 'What kind of mass term, when it opens a honeycomb Dirac gap, produces a genuine Chern insulator rather than a trivial one?',
      correct: 'A time-reversal-odd term, like the Haldane coupling',
      incorrect: 'A time-reversal-even staggered sublattice potential',
    },
    {
      prompt: 'The Haldane model achieves a quantized Hall conductivity using...',
      correct: 'Complex second-neighbor hoppings, with zero net magnetic flux',
      incorrect: 'A real, uniform magnetic field threading every unit cell',
    },
  ],

  'Twisted Bilayer MoTe₂': [
    {
      prompt: 'Twisted bilayer MoTe₂ realizes fractional quantum Hall physics...',
      correct: 'At zero external magnetic field',
      incorrect: 'Only under an applied field of several tesla',
    },
    {
      prompt: "What plays the role of a magnetic field in twisted MoTe₂'s topological flat bands?",
      correct: 'An emergent pseudo-magnetic field tied to lattice reconstruction',
      incorrect: 'A real magnetic field generated by ferromagnetic order',
    },
    {
      prompt: 'The Haldane model, the prototype for a zero-field Chern insulator, produces its quantized Hall conductance by adding...',
      correct: 'A purely imaginary second-neighbor hopping',
      incorrect: 'A real second-neighbor hopping of the same sign as the first',
    },
    {
      prompt: "Physically, the Haldane model's zero-field flux pattern is one that...",
      correct: 'Alternates sign between plaquettes, averaging to zero overall',
      incorrect: 'Is uniform and nonzero throughout the whole sample',
    },
    {
      prompt: 'A Haldane-type zero-field Chern insulator and the ordinary field-driven quantum Hall state are...',
      correct: 'Adiabatically connected: the same topological phase',
      incorrect: 'Fundamentally distinct phases separated by a phase transition',
    },
    {
      prompt: 'Besides moire materials like twisted MoTe₂, which real material realizes a zero-field quantized Hall conductance through genuine magnetism rather than a lattice pseudo-field?',
      correct: 'Chromium-doped (Bi,Sb)₂Te₃',
      incorrect: 'Pure, undoped bulk bismuth selenide (Bi₂Se₃)',
    },
  ],

  'Fe/Pb Majorana Chain': [
    {
      prompt: 'A Majorana fermion is algebraically defined by which condition on its operator γ?',
      correct: 'γ† = γ: it is its own antiparticle',
      incorrect: 'γ† = −γ',
    },
    {
      prompt: "In the Kitaev chain's topological phase, the two unpaired Majorana zero modes localize at...",
      correct: 'The two ends of the chain',
      incorrect: 'The exact center of the chain',
    },
    {
      prompt: 'The Kitaev chain hosts topological end Majoranas only when the chemical potential satisfies...',
      correct: '|μ| < 2t',
      incorrect: '|μ| > 2t',
    },
    {
      prompt: 'Braiding one Majorana zero mode around another acts on the ground-state manifold as...',
      correct: 'A non-commuting (non-Abelian) unitary',
      incorrect: 'A simple commuting phase: order never matters',
    },
    {
      prompt: 'Why must Kitaev-chain pairing sit on a bond rather than on-site?',
      correct: 'On-site pairing vanishes for spinless fermions (Pauli)',
      incorrect: 'On-site pairing would violate gauge symmetry',
    },
    {
      prompt: 'Engineering a Majorana-hosting topological superconductor from an ordinary s-wave one typically needs s-wave pairing plus...',
      correct: 'Spin-orbit coupling and an exchange (Zeeman) field',
      incorrect: 'Extra phonon coupling and higher pressure',
    },
  ],

  'Twisted Bilayer Graphene': [
    {
      prompt: "A superconductor's pairing is called 'unconventional' when the attractive channel is mediated by...",
      correct: 'Anything other than phonons',
      incorrect: 'Phonons, same as niobium or aluminum',
    },
    {
      prompt: 'For most unconventional superconductors, including twisted graphene, which quasiparticle mediates the pairing is...',
      correct: 'Still often an open research question',
      incorrect: 'Fully settled: it is always magnons',
    },
    {
      prompt: 'Twisted graphene trilayers have been observed to realize which two flavors of unconventional pairing, in different regimes?',
      correct: 'Field-induced spin-triplet order and nodal order',
      incorrect: 'Conventional s-wave and d-wave order, only',
    },
    {
      prompt: "Twisted graphene's field-induced triplet superconducting state requires simultaneously breaking...",
      correct: 'Time-reversal symmetry (magnetic) and gauge symmetry (SC)',
      incorrect: 'Only gauge symmetry, same as an ordinary s-wave SC',
    },
    {
      prompt: 'In that triplet state, why does pairing pick the triplet channel over the usual leading singlet channel?',
      correct: 'The exchange field splits the ↑/↓ Fermi surfaces, suppressing singlet pairing',
      incorrect: 'Triplet pairing always beats singlet pairing, field or no field',
    },
    {
      prompt: "In twisted graphene's nodal superconducting regime, where does the spectrum stay gapless?",
      correct: 'Wherever the Fermi surface crosses the nodal lines of the gap',
      incorrect: 'Nowhere: nodal order is still fully gapped',
    },
  ],

  'InAs/Al Majorana Wire': [
    {
      prompt: 'In the InAs/Al platform, what does the Zeeman field do to the Rashba-split bands at k = 0?',
      correct: 'Opens a gap there, leaving one effectively spinless Fermi surface',
      incorrect: 'Closes any existing gap, restoring two spin-degenerate Fermi surfaces',
    },
    {
      prompt: 'Any ordinary electron operator c can always be written as two Majorana operators via...',
      correct: 'γ_A = c + c†, γ_B = −i(c − c†)',
      incorrect: 'γ_A = c·c†, γ_B = c† − c·c†',
    },
    {
      prompt: 'Inverting that decomposition, the ordinary electron operator c is recovered as...',
      correct: 'c = ½(γ_A + iγ_B)',
      incorrect: 'c = ½(γ_A − iγ_B)',
    },
    {
      prompt: 'The effective wire pairing Δ(k) = 2iΔ sin k is manifestly odd in k, identifying it as...',
      correct: 'Effectively spinless p-wave (triplet-type) pairing',
      incorrect: 'Effectively spinless s-wave (singlet-type) pairing',
    },
    {
      prompt: 'Four well-separated Majorana zero modes recombine into how many ordinary fermionic modes, and what ground-state degeneracy?',
      correct: 'Two fermionic modes; a four-fold degenerate manifold',
      incorrect: 'Four fermionic modes; a sixteen-fold degenerate manifold',
    },
    {
      prompt: 'A Majorana-based qubit resists local decoherence because the encoded information is...',
      correct: 'Stored non-locally, split between spatially separated Majoranas',
      incorrect: "Stored locally, in a single Majorana's spin state",
    },
  ],

  'CrI₃/NbSe₂ Topological-SC Heterostructure': [
    {
      prompt: 'In the CrI₃/NbSe₂ heterostructure, which layer supplies the s-wave pairing, and which supplies the exchange field?',
      correct: 'NbSe₂ pairs; CrI₃ (van der Waals magnet) supplies the exchange field',
      incorrect: 'CrI₃ pairs; NbSe₂ supplies the exchange field',
    },
    {
      prompt: 'Engineering a topological superconductor this way requires breaking which two symmetries at once?',
      correct: 'Time-reversal symmetry (magnetism) and gauge symmetry (superconductivity)',
      incorrect: 'Only gauge symmetry: time-reversal must stay intact',
    },
    {
      prompt: "A trivial s-wave gap and this heterostructure's topological gap can look nearly identical in bulk spectroscopy. What actually tells them apart?",
      correct: 'Only the topological one hosts gapless boundary/edge modes',
      incorrect: 'Nothing: matching bulk spectra means matching topology',
    },
    {
      prompt: 'Chiral and p-wave superconductors needed for Majorana physics are rare in naturally occurring crystals, so platforms like this one are...',
      correct: 'Deliberately engineered heterostructures',
      incorrect: 'Naturally occurring bulk crystals, unmodified',
    },
    {
      prompt: 'An alternative recipe for the same physics starts from a quantum spin Hall edge (e.g. WTe₂) with ferromagnets on two segments. What do the ferromagnets do?',
      correct: 'Locally gap the helical edge modes by breaking time-reversal symmetry',
      incorrect: 'Locally enhance the edge conduction, doubling its velocity',
    },
    {
      prompt: 'In that QSH-edge recipe, the ungapped segment left between the two ferromagnets behaves as...',
      correct: 'An effectively spinless 1D channel',
      incorrect: 'An ordinary spin-degenerate 1D channel, unchanged',
    },
  ],

  'NbSe₂/CrBr₃ Topological-SC Heterostructure': [
    {
      prompt: 'Artificial topological superconductivity from s-wave pairing + spin-orbit coupling + an exchange field was experimentally realized in which real heterostructure?',
      correct: 'NbSe₂/CrBr₃ (Kezilebieke et al., Nature 588, 424, 2020)',
      incorrect: 'Twisted bilayer graphene, at the magic angle',
    },
    {
      prompt: 'As the exchange field J is dialed up across the topological transition, the small gap at k = 0...',
      correct: 'Closes near a critical J, then reopens with a different spin texture',
      incorrect: 'Grows monotonically larger and never closes',
    },
    {
      prompt: 'The effective chiral-p-wave-like order here emerges without needing which ingredient anywhere in the microscopic Hamiltonian?',
      correct: 'Any intrinsically unconventional pairing symmetry',
      incorrect: 'Any spin-orbit coupling at all',
    },
    {
      prompt: 'What specific role does Rashba spin-orbit coupling play in this recipe?',
      correct: 'Spin-momentum locking, splitting the bands in momentum',
      incorrect: 'Directly mediating the attractive pairing interaction',
    },
    {
      prompt: "Unlike the non-magnetic disorder protected by Anderson's theorem, the exchange field engineering this state...",
      correct: 'Deliberately breaks time-reversal symmetry',
      incorrect: 'Deliberately preserves time-reversal symmetry, like disorder does',
    },
  ],

  'Twisted CrI₃': [
    {
      prompt: 'Twisting a CrI₃ bilayer creates a moiré pattern of spatially varying exchange coupling. What kind of magnetic ground state does spatially competing coupling favor?',
      correct: 'A noncollinear, spatially winding spin texture',
      incorrect: 'A uniform collinear Néel state, unaffected by the moiré pattern',
    },
    {
      prompt: 'The Dzyaloshinskii-Moriya interaction (the spin-orbit term proposed to underlie moiré-induced multiferroicity in twisted CrI₃) favors neighboring spins rotated by roughly...',
      correct: '90°, promoting spiral order',
      incorrect: '180°, i.e. perfectly antiparallel',
    },
    {
      prompt: "Twisted CrI₃'s moiré-induced multiferroicity, per the mechanism proposed for it, is best described as...",
      correct: 'A theoretical prediction driven by the twist-induced DM interaction',
      incorrect: "A direct consequence of CrI₃'s ordinary bulk (untwisted) magnetic order",
    },
    {
      prompt: 'On a frustrated triangular lattice, where no spin assignment satisfies every antiferromagnetic bond, the mean-field compromise ground state is typically...',
      correct: 'A noncollinear 120° arrangement',
      incorrect: 'A collinear, fully antiparallel arrangement',
    },
    {
      prompt: 'Besides frustrated lattice geometry (triangular, kagome), what other mechanism can produce a spiral, noncollinear ground state?',
      correct: 'Competing first- and second-neighbor exchange (J1-J2 frustration)',
      incorrect: 'A single, uniform nearest-neighbor exchange J alone',
    },
    {
      prompt: "In a J1-J2 spiral magnet, the spiral's pitch angle is set by...",
      correct: 'The ratio J2/J1 of second- to first-neighbor coupling',
      incorrect: 'The total number of lattice sites in the sample',
    },
  ],

  '1T/1H-TaS₂ Heterostructure': [
    {
      prompt: 'In the Kondo lattice, many local moments compete to be screened by the same conduction-electron sea. What is the result?',
      correct: 'Screening electrons are shared fractionally between impurities, producing massive lattice-wide entanglement at total spin zero',
      incorrect: 'Each impurity independently forms its own isolated singlet, unaffected by the others',
    },
    {
      prompt: 'At zero Kondo hybridization (γ_K = 0), what does the auxiliary f-fermion band in the Kondo-lattice model look like?',
      correct: 'Perfectly flat at zero energy: these auxiliary fermions carry no hopping of their own',
      incorrect: 'Dispersive, with the same bandwidth as the conduction band',
    },
    {
      prompt: 'Turning on the Kondo hybridization γ_K where the flat localized-moment band would otherwise cross the dispersive conduction band produces...',
      correct: 'An anti-crossing: a gap that grows larger as the hybridization strength increases',
      incorrect: 'A sharper crossing point that stays exactly gapless',
    },
    {
      prompt: 'Beyond bulk SmB₆, the Kondo-insulator mechanism has been observed in an engineered two-dimensional van der Waals heterostructure stacking which two TaS₂ polytypes together?',
      correct: '1T-TaS₂ on 1H-TaS₂',
      incorrect: '1T-TaS₂ on 2H-MoS₂',
    },
    {
      prompt: 'In the Doniach picture, the Kondo coupling J_K favors a locally screened singlet. What does the competing direct exchange J between local moments favor instead?',
      correct: 'Magnetic correlations between the local moments',
      incorrect: 'An even larger Kondo hybridization gap',
    },
    {
      prompt: "The way the Kondo-insulator gap turns on with increasing Kondo coupling strength is described as qualitatively resembling the coupling-dependence of which other system's gap?",
      correct: "A superconductor's gap, as a function of the pairing interaction",
      incorrect: "An ordinary band insulator's gap, which is coupling-independent",
    },
  ],

  'Rhombohedral Pentalayer Graphene/hBN Moiré': [
    {
      prompt: 'What made the 2023-2024 pentalayer graphene/hBN result significant compared to earlier fractional quantum Hall observations?',
      correct: 'It showed fractionally quantized Hall plateaus with no applied magnetic field at all',
      incorrect: 'It required the strongest magnetic field ever applied in a lab',
    },
    {
      prompt: "How many graphene layers, stacked in what sequence, make up this hybrid's flat band?",
      correct: 'Five layers in rhombohedral (ABCCA-type) stacking',
      incorrect: 'Two layers twisted at the magic angle',
    },
    {
      prompt: "What role does the hBN substrate play in this hybrid's physics?",
      correct: 'Alignment with hBN opens the moiré superlattice that flattens the graphene bands',
      incorrect: 'hBN dopes free carriers directly into the graphene layers',
    },
    {
      prompt: "What are this compound's fractionally charged edge excitations called?",
      correct: 'Charged anyons, carrying genuine fractional braiding statistics',
      incorrect: 'Ordinary chiral fermions, just like an integer Chern insulator’s edge',
    },
    {
      prompt: "How does this compound's route to a fractional Chern insulator differ from Twisted Bilayer MoTe₂'s?",
      correct: 'An aligned heterostructure with a substrate, rather than a twist angle between two identical layers',
      incorrect: 'They reach the exact same physics through the exact same mechanism',
    },
    {
      prompt: 'Why does this compound only appear as a World 10 wild rather than an earlier world’s?',
      correct: "It's a HYBRID_RECIPES fusion result (Graphene + Monolayer Boron Nitride), and hybrid results live only in World 10",
      incorrect: 'Its main type has no earlier-world anchor of its own',
    },
  ],

  'HgTe/CdTe Quantum Well': [
    {
      prompt: 'The HgTe/CdTe quantum well was the first experimentally confirmed 2D topological insulator. Which theoretical model predicted it?',
      correct: 'The Bernevig-Hughes-Zhang (BHZ) model',
      incorrect: 'The Haldane model, using complex second-neighbor hopping',
    },
    {
      prompt: 'What structural change makes an HgTe/CdTe quantum well topological, inverting its band ordering?',
      correct: 'Growing the HgTe layer thicker than a critical thickness (~6.3 nm)',
      incorrect: 'Doping the well with magnetic chromium ions',
    },
    {
      prompt: "König et al.'s 2007 experiment confirmed the quantum spin Hall state in short HgTe/CdTe wells by measuring what?",
      correct: 'A conductance close to the quantized value 2e²/h from helical edge transport',
      incorrect: 'A quantized Hall conductance under a strong external magnetic field',
    },
    {
      prompt: 'Bulk CdTe is an ordinary gapped semiconductor, but bulk HgTe is a zero-gap semimetal with inverted band ordering. What does quantum-well confinement add that neither bulk parent has alone?',
      correct: "Above a critical thickness, confinement opens a gap while keeping HgTe's inverted band ordering",
      incorrect: 'Nothing changes electronically: the well is topological simply because it is thin',
    },
    {
      prompt: "What symmetry protects the HgTe/CdTe quantum well's helical edge states from backscattering off ordinary, non-magnetic disorder?",
      correct: "Time-reversal symmetry, via Kramers' theorem",
      incorrect: 'Charge conservation alone, regardless of time-reversal symmetry',
    },
    {
      prompt: 'Why does the game place HgTe/CdTe Quantum Well only in World 10 rather than in an earlier world?',
      correct: "It's a HYBRID_RECIPES fusion result of World 2's HgTe + CdTe, and hybrid results live only in World 10",
      incorrect: 'Because quantum wells are never considered real quantumSpinHall materials',
    },
  ],
};

// World 10's own pool, sourced from session10.tex (the course's machine-
// learning finale -- neural network quantum states, tensor networks
// repurposed as classifiers, ML inside DFT, phase classification, and
// Hamiltonian learning). Drawn only via getWorldQuestion's world===10 branch,
// coin-flipped against the fought hybrid's own MATERIAL_QUESTIONS pool --
// fitting, since World 10's rival ("The Adapted") is itself an adaptive AI.
export const ML_LECTURE_QUESTIONS: MaterialQuestion[] = [
  {
    prompt: 'A neural network quantum state (NNQS) replaces the exponentially many coefficients of a many-body wavefunction with...',
    correct: 'A neural network C_θ(s) that computes the coefficient from a spin configuration',
    incorrect: 'A single fixed matrix, the same size for every system',
  },
  {
    prompt: 'When training an NNQS to find a ground state, what quantity serves as the loss function?',
    correct: 'The variational energy E[θ] itself',
    incorrect: 'The classification accuracy on a labeled training set',
  },
  {
    prompt: "The variational energy E[θ] of any trial state |ψ_θ⟩, compared to the true ground-state energy E₀, always satisfies...",
    correct: 'E[θ] ≥ E₀',
    incorrect: 'E[θ] ≤ E₀',
  },
  {
    prompt: "Why is an NNQS's energy rewritten as a Monte Carlo average over configurations sampled from |C_θ(s)|², rather than evaluated directly as the exact ratio ⟨ψ_θ|H|ψ_θ⟩/⟨ψ_θ|ψ_θ⟩ in the spin-configuration basis?",
    correct: 'So it never requires summing over all 2^L configurations explicitly',
    incorrect: 'So the wavefunction no longer needs to be normalized',
  },
  {
    prompt: 'Compared to matrix product states and PEPS, an NNQS of a given architecture is...',
    correct: 'More expressive: MPS and PEPS sit inside the space of states an NNQS can reach',
    incorrect: 'Less expressive: it can only represent states an MPS can also represent',
  },
  {
    prompt: 'In quantum state tomography with a neural-network ansatz, what is the network trained to do?',
    correct: 'Maximize the likelihood of the observed measurement outcomes',
    incorrect: "Minimize the system's variational energy",
  },
  {
    prompt: 'Repurposing a matrix product state as an image classifier turns the classification task into a search for...',
    correct: 'A linear operator on the exponentially large tensor-product space of pixel vectors',
    incorrect: 'A single scalar threshold applied pixel by pixel',
  },
  {
    prompt: 'The tensor-network classifier applied to the Fashion-MNIST clothing dataset reaches roughly what test accuracy?',
    correct: 'About 89%, competitive with conventional neural networks',
    incorrect: 'About 50%, no better than random guessing',
  },
  {
    prompt: "The Hohenberg-Kohn theorem guarantees that a system's ground-state density n(r) uniquely determines...",
    correct: 'The external potential, and hence the full Hamiltonian and wavefunction',
    incorrect: 'Only the total electron number, nothing else',
  },
  {
    prompt: 'The Kohn-Sham construction replaces the real interacting electron system with...',
    correct: 'A fictitious non-interacting system reproducing the same density',
    incorrect: 'A classical charge distribution with no quantum kinetic energy',
  },
  {
    prompt: 'One way machine learning enters the Kohn-Sham self-consistency loop is by...',
    correct: 'Learning or augmenting the exchange-correlation functional v_xc',
    incorrect: 'Replacing the nuclear charge density with a fixed constant',
  },
  {
    prompt: 'Training a network to map atomic positions directly to the ground-state density, skipping the Kohn-Sham self-consistency loop entirely at inference time, is called...',
    correct: 'A machine learning potential',
    incorrect: 'The Hartree approximation',
  },
  {
    prompt: "In this world's 'easy' phase-classification example, the ferromagnetic Ising model, what makes the phase easy to read off even without a network?",
    correct: 'A simple local order parameter (the total magnetization) distinguishes the two phases',
    incorrect: 'The two phases always look visibly different in every snapshot',
  },
  {
    prompt: 'The Ising gauge theory is this world\'s "hard" phase-classification example because its two phases are distinguished by...',
    correct: 'No local order parameter at all: only a nonlocal, topological distinction',
    incorrect: 'A local order parameter that is simply harder to compute',
  },
  {
    prompt: "The Ising gauge theory's ground-state constraint (every plaquette product equal to +1) is satisfied by...",
    correct: 'An exponentially large, macroscopically degenerate set of configurations',
    incorrect: 'Exactly one configuration, up to a global spin flip',
  },
  {
    prompt: "What made the trained Ising-gauge-theory classifier's result genuinely useful, beyond succeeding where the local order parameter fails?",
    correct: 'It generalized correctly to system sizes it was never trained on',
    incorrect: 'It required training separately at every system size tested',
  },
  {
    prompt: 'Hamiltonian learning poses the inverse problem of...',
    correct: "Inferring a Hamiltonian's physical parameters from a measured observable",
    incorrect: 'Computing an observable from an already-known Hamiltonian',
  },
  {
    prompt: 'Since real experimental data to train a Hamiltonian-learning network is scarce, where does its training data actually come from?',
    correct: 'Simulated observables computed from many known Hamiltonians',
    incorrect: 'Randomly generated numbers with no physical basis',
  },
  {
    prompt: "Hamiltonian learning is described as the literal inverse of the ordinary forward problem in physics. What is that forward problem?",
    correct: "Starting from a known Hamiltonian and computing observables from it",
    incorrect: "BCS mean-field decoupling of an attractive interaction",
  },
];

// A world's own pool (WORLD_QUESTIONS), coin-flipped against the fought
// material's own bonus pool when it has one (see MATERIAL_QUESTIONS' own
// comment above). World 10 draws differently -- see this function's own
// world===10 branch and this file's top comment.
export function getWorldQuestion(world: number, materialName?: string): MaterialQuestion | undefined {
  const materialPool = materialName ? MATERIAL_QUESTIONS[materialName] : undefined;
  const useMaterialPool = !!materialPool && materialPool.length > 0 && Math.random() < 0.5;

  if (world === 10) {
    const pool = useMaterialPool ? materialPool! : ML_LECTURE_QUESTIONS;
    if (pool.length === 0) return undefined;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  const worldPool = WORLD_QUESTIONS[world] ?? [];
  const pool = useMaterialPool ? materialPool! : worldPool;
  if (pool.length === 0) return undefined;
  return pool[Math.floor(Math.random() * pool.length)];
}

// Landau's analytic moves (§5, World 4, BattleScene.showAnalyticQuestion):
// using `skyfallBeam` or `groundEruption` asks one of these before the hit
// resolves -- correct doubles the damage, wrong halves it. Unlike
// WORLD_QUESTIONS/MATERIAL_QUESTIONS above these aren't per-world or
// per-material trivia: each question names the specific equation/law it's
// asking about, since an analytic move is usable from any crystal form. Each
// entry's `worlds` tag lists the world number(s) whose course topic it
// belongs to (most fit one world; a few genuinely span two, e.g. graphene
// Landau levels sit in both world 2 and world 4), and getAnalyticQuestion
// draws only from questions tagged with a world the player has already
// visited -- so an early player is quizzed on early-world physics, not
// topics they haven't reached yet.
export const ANALYTIC_QUESTIONS: AnalyticQuestion[] = [
  {
    prompt: "Bloch's theorem writes a crystal electron's wavefunction as a plane wave times...",
    correct: 'A lattice-periodic function, u_k(r + R) = u_k(r)',
    incorrect: 'A second, independent plane wave',
    worlds: [2],
  },
  {
    prompt: 'For a 1D tight-binding chain with hopping t, the band dispersion E(k) is proportional to...',
    correct: '-2t cos(ka)',
    incorrect: '-2t sin(ka)',
    worlds: [2],
  },
  {
    prompt: 'The Stoner criterion for a spontaneous ferromagnetic instability is...',
    correct: 'U·D(E_F) ≥ 1',
    incorrect: 'U·D(E_F) ≤ 1',
    worlds: [1, 6],
  },
  {
    prompt: 'The energy of the n-th Landau level in a magnetic field B is...',
    correct: 'E_n = ħω_c(n + 1/2)',
    incorrect: 'E_n = ħω_c·n²',
    worlds: [4],
  },
  {
    prompt: "At zero temperature, the BCS gap Δ(0) relates to T_c as...",
    correct: 'Δ(0) ≈ 1.76 k_B T_c',
    incorrect: 'Δ(0) ≈ 0.5 k_B T_c',
    worlds: [5],
  },
  {
    prompt: 'The London equation relates a superconductor’s current density J to the magnetic field B via...',
    correct: '∇×J = -(n_s e² / m) B',
    incorrect: '∇·J = -(n_s e² / m) B',
    worlds: [5],
  },
  {
    prompt: 'A band’s Chern number is the integral, over the Brillouin zone, of...',
    correct: 'The Berry curvature, divided by 2π',
    incorrect: 'The band energy itself',
    worlds: [3],
  },
  {
    prompt: "Near k=0, a ferromagnet's magnon dispersion behaves as...",
    correct: 'E(k) ∝ k² (quadratic)',
    incorrect: 'E(k) ∝ |k| (linear)',
    worlds: [6],
  },
  {
    prompt: 'The von Neumann entanglement entropy of a density matrix ρ is defined as...',
    correct: 'S = -Tr(ρ log ρ)',
    incorrect: 'S = Tr(ρ²)',
    worlds: [7],
  },
  {
    prompt: 'The Kondo temperature T_K depends on the exchange coupling J roughly as...',
    correct: 'T_K ∝ exp(-1/(J·D(E_F))): exponentially small',
    incorrect: 'T_K ∝ J²: a simple power law',
    worlds: [8],
  },
  {
    prompt: 'In mean-field Hubbard theory, the order parameter m = ⟨n↑⟩ − ⟨n↓⟩ describes...',
    correct: 'The magnetization',
    incorrect: 'The charge-density-wave amplitude',
    worlds: [1],
  },
  {
    prompt: "Graphene's Fermi velocity, in terms of hopping t and bond length a, is...",
    correct: 'v_F = 3ta / (2ħ)',
    incorrect: 'v_F = ta / ħ',
    worlds: [2],
  },
  {
    prompt: 'In a Chern insulator, the quantized Hall conductivity σ_xy is given by...',
    correct: 'C e²/h, with C the Chern number',
    incorrect: '(e²/h) times the bulk band gap',
    worlds: [3],
  },
  {
    prompt: "In a strong field, graphene's Dirac Landau level energies scale with level index n and field B as...",
    correct: 'E_n ∝ √(nB)',
    incorrect: 'E_n ∝ nB',
    worlds: [2, 4],
  },
  {
    prompt: 'The Laughlin wavefunction, built by raising the filled-Landau-level Vandermonde factor to an odd power m, has filling factor...',
    correct: 'ν = 1/m',
    incorrect: 'ν = m',
    worlds: [4],
  },
  {
    prompt: 'The superconducting flux quantum Φ₀ equals...',
    correct: 'h/2e',
    incorrect: 'h/e',
    worlds: [5],
  },
  {
    prompt: 'The Dzyaloshinskii-Moriya interaction couples neighboring spins via...',
    correct: 'A cross product, D·(S_i × S_j)',
    incorrect: 'A dot product, S_i · S_j',
    worlds: [6],
  },
  {
    prompt: 'For a matrix product state of bond dimension M, the maximum entanglement entropy it can represent across a bond is...',
    correct: 'log M',
    incorrect: 'M itself',
    worlds: [7],
  },
  {
    prompt: "The 1D Heisenberg chain's exact ground-state energy per site in the thermodynamic limit, from the Bethe ansatz, is...",
    correct: 'J(1/4 − ln 2) ≈ −0.443 J',
    incorrect: '−1/4 J exactly',
    worlds: [8],
  },
  {
    prompt: "A magnetic impurity's Yu-Shiba-Rusinov in-gap bound state in an s-wave superconductor crosses zero energy exactly when α = πν₀JS equals...",
    correct: '1',
    incorrect: '0',
    worlds: [9, 5],
  },
  {
    prompt: 'Fermionic creation and annihilation operators obey the anticommutation relation...',
    correct: '{c_i, c_j†} = δ_ij',
    incorrect: '[c_i, c_j†] = δ_ij (a commutator)',
    worlds: [1],
  },
  {
    prompt: "The Hubbard model's interaction term is...",
    correct: 'U Σ_i n_i↑ n_i↓: an energy cost per doubly occupied site',
    incorrect: 'U Σ_i (n_i↑ + n_i↓): an energy cost per electron',
    worlds: [1],
  },
  {
    prompt: 'A half-filled band becomes a Mott insulator when...',
    correct: 'U is much larger than the bandwidth W',
    incorrect: 'U is much smaller than the bandwidth W',
    worlds: [1],
  },
  {
    prompt: 'The total bandwidth of a 1D nearest-neighbor tight-binding chain with hopping t is...',
    correct: '4t: the band runs from −2t to +2t',
    incorrect: '2t: the band runs from −t to +t',
    worlds: [2],
  },
  {
    prompt: "A band's Chern number can take values...",
    correct: 'Any integer: it is a topological invariant',
    incorrect: 'Any real number: it varies continuously',
    worlds: [3],
  },
  {
    prompt: 'By the bulk-boundary correspondence, the number of chiral edge modes of a Chern insulator equals...',
    correct: '|C|, the magnitude of the Chern number',
    incorrect: 'The number of filled bulk bands',
    worlds: [3],
  },
  {
    prompt: 'The degeneracy of a Landau level per unit area is...',
    correct: 'n_B = eB/h: one state per flux quantum h/e',
    incorrect: 'Independent of the magnetic field B',
    worlds: [4],
  },
  {
    prompt: 'The magnetic length l_B in a field B is...',
    correct: 'l_B = √(ħ/eB)',
    incorrect: 'l_B = √(eB/ħ)',
    worlds: [4],
  },
  {
    prompt: 'In terms of the normal-state dispersion ξ_k and gap Δ, the BCS quasiparticle energy is...',
    correct: 'E_k = √(ξ_k² + Δ²)',
    incorrect: 'E_k = ξ_k + Δ',
    worlds: [5],
  },
  {
    prompt: 'A Majorana operator γ is defined by the property...',
    correct: 'γ† = γ: it is its own antiparticle',
    incorrect: 'γ† = −γ',
    worlds: [5],
  },
  {
    prompt: 'Above T_C, the Curie-Weiss susceptibility of a ferromagnet behaves as...',
    correct: 'χ ∝ 1/(T − T_C)',
    incorrect: 'χ ∝ (T − T_C)',
    worlds: [6],
  },
  {
    prompt: "Near k=0, an antiferromagnet's magnon dispersion behaves as...",
    correct: 'E(k) ∝ |k| (linear)',
    incorrect: 'E(k) ∝ k² (quadratic)',
    worlds: [6],
  },
  {
    prompt: 'The ground state of a gapped 1D Hamiltonian has entanglement entropy that...',
    correct: 'Saturates to a constant: an area law',
    incorrect: 'Grows linearly with subsystem size: a volume law',
    worlds: [7],
  },
  {
    prompt: 'In terms of the Schmidt coefficients λ_i of a bipartition, the entanglement entropy is...',
    correct: 'S = −Σ_i λ_i² log λ_i²',
    incorrect: 'S = −Σ_i λ_i log λ_i',
    worlds: [7],
  },
  {
    prompt: 'A spinon, the fractionalized excitation of a 1D quantum magnet, carries...',
    correct: 'Spin 1/2 and no electric charge',
    incorrect: 'Spin 1/2 and charge e, like an electron',
    worlds: [8],
  },
  {
    prompt: 'Dilute magnetic impurities in a metal make the low-temperature resistivity...',
    correct: 'Rise logarithmically as T decreases: the Kondo effect',
    incorrect: 'Keep dropping monotonically toward zero',
    worlds: [8],
  },
  {
    prompt: 'In a 1D disordered chain, Anderson localization sets in...',
    correct: 'For arbitrarily weak disorder, all states localize',
    incorrect: 'Only above a critical disorder strength',
    worlds: [9],
  },
  {
    prompt: 'An Anderson-localized wavefunction decays away from its center r₀ as...',
    correct: 'exp(−|r − r₀|/ξ), with ξ the localization length',
    incorrect: 'A power law, 1/|r − r₀|²',
    worlds: [9],
  },
  {
    prompt: 'With α = πν₀JS, a classical magnetic impurity’s Yu-Shiba-Rusinov state in an s-wave gap Δ sits at energy...',
    correct: 'E = ±Δ(1 − α²)/(1 + α²)',
    incorrect: 'E = ±Δ(1 + α²)/(1 − α²)',
    worlds: [9, 5],
  },
];

export function getAnalyticQuestion(visitedWorlds: number[]): MaterialQuestion {
  const eligible = ANALYTIC_QUESTIONS.filter((q) => q.worlds.some((w) => visitedWorlds.includes(w)));
  const pool = eligible.length > 0 ? eligible : ANALYTIC_QUESTIONS;
  return pool[Math.floor(Math.random() * pool.length)];
}

// Feynman's move-leveling streak (§5, World 7) draws from the same
// visited-world-filtered ANALYTIC_QUESTIONS pool getAnalyticQuestion uses
// above, rather than Skłodowska-Curie's unrestricted ULTIMATE_QUESTIONS --
// World 7 has a course topic of its own (unlike World 10's topic-less
// finale), so the same "only quiz what a player could plausibly already
// know" restriction applies. Returns `count` questions in a row -- can run
// as long as 8 (the Infinite tier's own streak length), well past the pool a
// tight visited-world filter can leave early on, so unlike
// getUltimateQuestions this allows the pool to repeat overall, just never
// the same question twice back to back.
export function getAnalyticQuestions(visitedWorlds: number[], count: number): MaterialQuestion[] {
  const eligible = ANALYTIC_QUESTIONS.filter((q) => q.worlds.some((w) => visitedWorlds.includes(w)));
  const pool = eligible.length > 0 ? eligible : ANALYTIC_QUESTIONS;
  const questions: MaterialQuestion[] = [];
  for (let i = 0; i < count; i++) {
    let pick = pool[Math.floor(Math.random() * pool.length)];
    if (pool.length > 1) {
      while (pick === questions[questions.length - 1]) {
        pick = pool[Math.floor(Math.random() * pool.length)];
      }
    }
    questions.push(pick);
  }
  return questions;
}

// Skłodowska-Curie's two "Ultimate" moves (§5, World 10) -- using one asks
// 3 of these in a row, ALL must be correct or the move whiffs entirely (no
// partial-credit multiplier the way Analytic moves have). This is its own
// dedicated hard pool, deliberately not merged with WORLD_QUESTIONS/
// MATERIAL_QUESTIONS/ANALYTIC_QUESTIONS above -- full breadth across every
// world's topic, no visited-world restriction (unlike ANALYTIC_QUESTIONS),
// since World 10 has no course topic of its own and its guardian's own gate
// draws on everything the player has learned across every world, not one
// topic's worth, at a uniformly harder tier than any single world's own pool.
export const ULTIMATE_QUESTIONS: MaterialQuestion[] = [
  // -- World 1: second quantization, mean-field theory, Mott physics --
  {
    prompt: 'The mean-field decoupling of the Hubbard interaction U n↑n↓ reads...',
    correct: 'U(n↑⟨n↓⟩ + ⟨n↑⟩n↓ − ⟨n↑⟩⟨n↓⟩)',
    incorrect: 'U(n↑⟨n↓⟩ + ⟨n↑⟩n↓ + ⟨n↑⟩⟨n↓⟩)',
  },
  {
    prompt: 'At half filling and large U, the Hubbard model reduces to a Heisenberg antiferromagnet with superexchange...',
    correct: 'J = 4t²/U',
    incorrect: 'J = 2t²/U',
  },
  {
    prompt: "Spontaneously breaking a continuous symmetry guarantees, by Goldstone's theorem...",
    correct: 'A gapless mode: zero energy as k → 0',
    incorrect: 'A gapped mode, with gap set by the order parameter',
  },
  {
    prompt: "The two-site half-filled Hubbard dimer's mean-field antiferromagnetic order parameter m turns on...",
    correct: 'Only above a critical interaction U_c = 2t: m=0 below it, then m=√(1−4t²/U²) above',
    incorrect: 'Immediately at any U>0, growing smoothly from zero with no threshold',
  },
  {
    prompt:
      "Unlike the perfectly-nested 1D chain, the Hubbard antiferromagnet on graphene's honeycomb lattice orders only above a finite threshold U_c because...",
    correct:
      'Its density of states vanishes linearly at the Dirac point, D(E)∝|E|, suppressing the low-energy contribution that would otherwise drive an infinitesimal instability',
    incorrect: 'Its density of states diverges logarithmically at the Dirac point, the same nesting singularity the 1D chain has',
  },
  // -- World 2: symmetries, tight binding, Bloch, Dirac cones --
  {
    prompt: 'The total bandwidth of the 2D square-lattice nearest-neighbor tight-binding band, with hopping t, is...',
    correct: '8t: the band runs from −4t to +4t',
    incorrect: '4t: the band runs from −2t to +2t',
  },
  {
    prompt: 'Adding a staggered sublattice potential ±m to graphene...',
    correct: 'Opens a gap of 2m at both Dirac points',
    incorrect: 'Shifts the Dirac points in momentum but leaves them gapless',
  },
  {
    prompt: "Kramers' theorem guarantees every level is doubly degenerate when the time-reversal operator satisfies...",
    correct: 'T² = −1: half-integer spin',
    incorrect: 'T² = +1: integer spin',
  },
  {
    prompt: 'The 1D nearest-neighbor tight-binding chain H = t Σ_n (c_n†c_{n+1} + h.c.) has Bloch dispersion...',
    correct: 'ε_φ = 2t cos φ, ranging over [−2t, 2t]',
    incorrect: 'ε_φ = 4t cos φ, ranging over [−4t, 4t]',
  },
  {
    prompt: 'The effective mass tensor (1/m*)ᵢⱼ = (1/ħ²) ∂²E/∂kᵢ∂kⱼ, built from the curvature of the dispersion, matters because...',
    correct: 'It is the mass actually measured in transport and cyclotron-resonance experiments; the bare electron mass is not directly observable inside a solid',
    incorrect: 'It equals the bare electron mass measured directly by cyclotron resonance, since band curvature only renormalizes the group velocity, not the mass',
  },
  // -- World 3: topological band theory --
  {
    prompt: "Encircling one of graphene's Dirac points, the Bloch state picks up a Berry phase of...",
    correct: 'π',
    incorrect: '2π',
  },
  {
    prompt: 'Time reversal forces Ω(−k) = −Ω(k) on the Berry curvature, so a time-reversal-symmetric band has Chern number...',
    correct: 'Exactly zero, always',
    incorrect: 'Any even integer',
  },
  {
    prompt: 'The SSH chain hosts zero-energy edge states when...',
    correct: 'Intercell hopping exceeds intracell hopping, |w| > |v|',
    incorrect: 'Intracell hopping exceeds intercell hopping, |v| > |w|',
  },
  {
    prompt: 'For the two-band model H(k) = k_xσ_x + λk_yσ_y + mσ_z near a single gapped Dirac cone, the Chern number contributed by that one cone is...',
    correct:
      'C_Dirac = (1/2) sgn(m) sgn(λ): a half-integer, since a physical lattice always sums an even number of time-reversal-partnered cones to get an integer',
    incorrect: 'C_Dirac = sgn(m) sgn(λ), always an integer ±1 from a single cone alone',
  },
  {
    prompt:
      "Gapping graphene's Dirac points with an ordinary staggered sublattice potential, versus with the Haldane second-neighbor imaginary hopping, gives...",
    correct:
      "Sublattice potential: same-sign mass at K and K′ so the two points' Chern contributions cancel (C=0, trivial); Haldane coupling: mass flips sign between K and K′ relative to λ, so contributions add (C=±1, a Chern insulator)",
    incorrect: 'Sublattice potential: contributions add, giving a Chern insulator C=±1; Haldane coupling: contributions cancel, giving trivial C=0',
  },
  // -- World 4: quantum Hall, Landau levels, FQHE --
  {
    prompt: 'The Landau-level filling factor of a 2D electron gas with areal density n in field B is...',
    correct: 'ν = nh/(eB)',
    incorrect: 'ν = eB/(nh)',
  },
  {
    prompt: 'A quasiparticle of the ν = 1/m Laughlin state carries electric charge...',
    correct: 'e* = e/m',
    incorrect: 'e* = m·e',
  },
  {
    prompt: 'Exchanging two Laughlin quasiparticles at ν = 1/m produces the anyonic statistical phase...',
    correct: 'θ = π/m',
    incorrect: 'θ = 2π/m',
  },
  {
    prompt: 'Compared to an ordinary parabolic (Schrödinger) 2D electron gas, the Landau levels of Dirac (graphene-like) electrons in field B are...',
    correct: 'E_n = sgn(n)·v_F√(2ħB|n|), n=0,±1,±2,…: unequally spaced, growing as √B, with a genuine zero-energy level pinned at n=0',
    incorrect: 'E_n = ħω_c(n+1/2), just as in the parabolic case: equally spaced and growing linearly in B',
  },
  // -- World 5: BCS, Nambu, Majoranas --
  {
    prompt: 'BCS theory gives the critical temperature, in terms of the Debye frequency ω_D and coupling N₀V, as...',
    correct: 'k_B T_c ≈ 1.13 ħω_D exp(−1/(N₀V)): non-perturbative in V',
    incorrect: 'k_B T_c ∝ ħω_D (N₀V)²: second-order perturbation theory',
  },
  {
    prompt: 'The BCS ground state pairs electrons in the states...',
    correct: '(k↑, −k↓): zero total momentum, opposite spins',
    incorrect: '(k↑, k↓): equal momenta, opposite spins',
  },
  {
    prompt: "The two Majorana end modes of a topological Kitaev chain together encode...",
    correct: 'One ordinary fermion, delocalized between the two ends',
    incorrect: 'Two independent fermions, one bound to each end',
  },
  {
    prompt: 'In Andreev reflection at a normal-superconductor interface, a sub-gap electron comes back as...',
    correct: 'A hole retracing its path, with charge 2e entering the condensate',
    incorrect: 'A spin-flipped electron, with no charge crossing the interface',
  },
  // -- World 6: classical magnetism, magnons, DM --
  {
    prompt: "Thermal magnons deplete a 3D ferromagnet's magnetization at low T as...",
    correct: 'M(0) − M(T) ∝ T^(3/2): the Bloch law',
    incorrect: 'M(0) − M(T) ∝ T²',
  },
  {
    prompt: 'By the Mermin-Wagner theorem, a 2D Heisenberg ferromagnet with short-range interactions...',
    correct: 'Has no long-range order at any T > 0',
    incorrect: 'Orders below a finite T_C, like its 3D counterpart',
  },
  {
    prompt: "By Moriya's rules, the Dzyaloshinskii-Moriya vector D between two spins vanishes whenever...",
    correct: 'An inversion center sits at the bond midpoint',
    incorrect: 'The two spins are exactly antiparallel',
  },
  {
    prompt: 'By the Stoner criterion for the Hubbard model, a mean-field magnetic solution with m≠0 first appears once...',
    correct: 'U·D(E_F) ≥ 1: the interaction times the density of states at the Fermi level clears one',
    incorrect: 'U > t: the interaction strength exceeds the bare hopping amplitude',
  },
  {
    prompt: 'The superexchange coupling derived from a single-orbital Hubbard model at U≫t, J_ij = 4t_ij²/U...',
    correct: 'Is always positive (antiferromagnetic), regardless of the sign or geometry of t_ij',
    incorrect: 'Flips sign with t_ij, giving ferromagnetic coupling whenever the hopping t_ij is negative',
  },
  // -- World 7: entanglement, tensor networks, MPS --
  {
    prompt: 'A block of length ℓ in an infinite critical (gapless) 1D chain has entanglement entropy...',
    correct: 'S = (c/3) log ℓ: logarithmic, with c the central charge',
    incorrect: 'S ∝ ℓ: a volume law',
  },
  {
    prompt: 'The number of parameters in a matrix product state of N sites, local dimension d, bond dimension M, scales...',
    correct: 'Linearly in N: roughly N·d·M²',
    incorrect: 'Exponentially in N, like the full d^N Hilbert space',
  },
  {
    prompt: 'Tracing out half of an entangled pure state leaves a reduced density matrix that is...',
    correct: 'Mixed: Tr ρ² < 1',
    incorrect: 'Still pure: Tr ρ² = 1',
  },
  {
    prompt:
      'In the Jordan-Wigner map S_i⁺=c_i†K_i, S_i⁻=c_iK_i, S_i^z=n_i−1/2, K_i=exp(iπΣ_{j<i}n_j), the string operator K_i is required because...',
    correct:
      'Fermionic many-body wavefunctions are antisymmetric under exchange while spin wavefunctions are symmetric, so the string supplies the missing relative sign between sites',
    incorrect: 'It enforces the Pauli exclusion principle on the spin operators, which would otherwise allow double occupation of a site',
  },
  {
    prompt: 'Given a large enough bond dimension, a matrix product state can represent...',
    correct: 'Any L-site state exactly: successive SVDs with no truncation need at most M = d^(L/2) at the central cut',
    incorrect: 'Only area-law states: a volume-law state escapes the ansatz at any finite bond dimension',
  },
  // -- World 8: quantum magnetism, spinons, Kondo, heavy fermions --
  {
    prompt: "By Haldane's conjecture, the spin-1 Heisenberg antiferromagnetic chain is...",
    correct: 'Gapped, unlike the gapless spin-1/2 chain',
    incorrect: 'Gapless, just like the spin-1/2 chain',
  },
  {
    prompt: "Below the Kondo temperature, a magnetic impurity's spin is...",
    correct: 'Screened into a singlet by the conduction electrons',
    incorrect: 'Polarized ferromagnetically by the conduction sea',
  },
  {
    prompt: 'Neutron scattering on a spin-1/2 Heisenberg chain sees, instead of one sharp magnon...',
    correct: 'A broad two-spinon continuum: each spin flip fractionalizes',
    incorrect: 'A single sharp mode at twice the magnon energy',
  },
  {
    prompt: "A heavy-fermion metal's enormous quasiparticle mass shows up in the specific heat C = γT as...",
    correct: 'A Sommerfeld coefficient γ hundreds of times larger than in ordinary metals',
    incorrect: 'A vanishing Sommerfeld coefficient γ: the heavy carriers cannot respond',
  },
  // -- World 9: disorder, localization, impurities --
  {
    prompt: 'By the scaling theory of localization, a 3D disordered metal...',
    correct: 'Has a mobility edge: a genuine metal-insulator transition at finite disorder',
    incorrect: 'Localizes at arbitrarily weak disorder, like 1D and 2D',
  },
  {
    prompt: 'Friedel oscillations of the electron density around an impurity in a metal have wavevector...',
    correct: '2k_F: set by the sharp Fermi surface',
    incorrect: 'k_F',
  },
  {
    prompt: "By Anderson's theorem, the T_c of a conventional s-wave superconductor is...",
    correct: 'Insensitive to nonmagnetic impurities, but suppressed by magnetic ones',
    incorrect: 'Suppressed equally by any impurity, magnetic or not',
  },
  {
    prompt:
      'In the RPA (Bohm-Pines) treatment of the 3D electron gas, the plasmon dispersion at long wavelength, ω_pl(q)² = ω_p² + (3/5)v_F²q² + O(q⁴)...',
    correct: 'Survives at q=0 with ω_pl=ω_p, since the plasmon is a genuinely collective mode of the whole charge density',
    incorrect: 'Vanishes at q=0, exactly like the particle-hole continuum it is built out of',
  },
  {
    prompt: 'For the 2D square-lattice dispersion ε(k) = −2t(cos k_x + cos k_y) at half filling, the static Lindhard function χ₀(q,0)...',
    correct: 'Develops a massive divergence exactly at Q=(π,π), the perfect-nesting wavevector where ε(k+Q)=−ε(k) for every k',
    incorrect: 'Stays smooth and featureless in q, since a genuinely 2D Fermi surface cannot nest the way a 1D one does',
  },
  // -- Session 10: Machine Learning Quantum Materials -- World 10 itself
  // draws its own wild-encounter quizzing from ML_LECTURE_QUESTIONS above;
  // these harder session-10 questions live here instead, in Skłodowska-
  // Curie's own dedicated hard pool, alongside the Methods block below.
  {
    prompt:
      'Training a neural-network quantum state by minimizing the variational energy E[θ]=⟨ψ_θ|H|ψ_θ⟩/⟨ψ_θ|ψ_θ⟩ guarantees that E[θ]...',
    correct: 'Never undershoots the true ground-state energy E₀, hitting it exactly only if |ψ_θ⟩ reaches the true ground state',
    incorrect: 'Can undershoot E₀ if the network is expressive enough, since gradient descent has no lower bound',
  },
  {
    prompt:
      'In the variational hierarchy of many-body ansätze (NNQS, PEPS, matrix product states), a neural-network quantum state (NNQS) of a given architecture is...',
    correct: 'The most expressive of the three: PEPS states sit inside the states that NNQS can reach, and MPS inside PEPS in turn',
    incorrect: 'The least expressive of the three: MPS and PEPS can both reach states no NNQS of comparable size can represent',
  },
  {
    prompt:
      "Classifying the classical Ising gauge theory's low-T and high-T configurations by summing the spins (an ordinary magnetization order parameter)...",
    correct: 'Fails: the phases are topologically distinct with no local order parameter, whereas a CNN trained on labeled low-T/high-T configurations succeeds',
    incorrect: 'Works exactly as well as it does for the ordinary Ising model, since both are classical spin models on the same lattice',
  },
  {
    prompt:
      'Hamiltonian learning trains a neural network on synthetic (Hamiltonian → observable) pairs from many known models, then applies the trained network to...',
    correct: 'A real experimental observable, to infer the physical Hamiltonian parameters λ that produced it',
    incorrect: 'A known Hamiltonian, to predict the observable it would produce: the ordinary forward direction of the same calculation',
  },
  {
    prompt: 'Replacing the exchange-correlation functional in the Kohn-Sham loop with a machine-learned v_xc...',
    correct: "Still requires diagonalizing H_KS self-consistently at every iteration: learning v_xc doesn't remove the self-consistency loop",
    incorrect: 'Removes the need for the self-consistency loop entirely, since the learned v_xc is now exact',
  },
  // -- Methods & experimental probes: exact diagonalization, mean-field/DFT
  // self-consistency, ARPES, STM -- cross-cutting the numerical and
  // experimental toolkit itself rather than any one world's course topic,
  // fitting an any-topic pool the same way the questions above do.
  {
    prompt:
      'The dimension of the many-body Hilbert space for a chain of L spin-1/2 sites (and hence the number of coefficients needed to store its ground state exactly) grows as...',
    correct: 'd = 2^L: exponentially with system size',
    incorrect: 'd = L^2: only quadratically with system size',
  },
  {
    prompt: 'A mean-field or Kohn-Sham calculation is solved self-consistently by...',
    correct: 'Guessing a density/order parameter, building the Hamiltonian, diagonalizing it, and repeating until the guess stops changing',
    incorrect: 'Diagonalizing the full interacting Hamiltonian once, with no iteration needed',
  },
  {
    prompt: 'The Kohn-Sham construction makes DFT usable in practice by replacing the interacting many-body problem with...',
    correct: 'A fictitious system of non-interacting electrons chosen to reproduce the same ground-state density',
    incorrect: 'The same interacting Hamiltonian diagonalized exactly, just in a smaller basis set',
  },
  {
    prompt: "Angle-resolved photoemission spectroscopy (ARPES) maps a material's band dispersion E(k) by...",
    correct: 'Ejecting electrons with photons and using energy/momentum conservation on the emitted electron',
    incorrect: 'Scanning a fine metal tip across the surface and recording the tunneling current, as in STM',
  },
  {
    prompt: "Scanning tunneling microscopy (STM) measures a material's local electronic structure via...",
    correct: 'A tunneling current between a sharp metal tip and the sample surface, sensitive to the local density of states',
    incorrect: 'Energy and momentum conservation on a photon-ejected electron, as in ARPES',
  },
  {
    prompt:
      'Mean-field theory, the Kohn-Sham construction of DFT, and a variational tensor-network ansatz are all instances of the same underlying strategy:...',
    correct: 'Restricting the search for the ground state to a tractable family of trial states and minimizing the energy over that family',
    incorrect: 'Diagonalizing the exact many-body Hamiltonian in the full Hilbert space, just with a faster algorithm',
  },
];

// Returns `count` distinct random questions (no repeats within one draw) --
// BattleScene.showUltimateQuestions asks all of them in sequence, stopping
// early at the first wrong answer. Deliberately samples only from
// ULTIMATE_QUESTIONS, this guardian's own dedicated hard pool -- not unioned
// with WORLD_QUESTIONS/MATERIAL_QUESTIONS/ANALYTIC_QUESTIONS/
// ML_LECTURE_QUESTIONS above, so the Ultimate gate stays at its own
// uniformly hard tier regardless of which world's wilds it's compared to.
export function getUltimateQuestions(count: number): MaterialQuestion[] {
  const shuffled = [...ULTIMATE_QUESTIONS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}
