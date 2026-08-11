// Pre-battle physics questions, keyed by material name (matches the `name`
// field crystal() rows carry in data/materials.ts). Each wild encounter can
// quiz the player before the fight: answering correctly boosts the player's
// attack for that battle, answering wrong weakens it, and "let me pass"
// skips the fight entirely with no bonus/penalty (see
// OverworldScene.showEncounter). Kept short -- these render as buttons in a
// small in-map dialogue, not a full page of text. Each material carries a
// pool of several questions (not just one), and getMaterialQuestion picks a
// random one per encounter, so re-fighting the same material doesn't always
// ask the same thing.
//
// Content is sourced from lecture_notes/tex_extended/sessions/sessionNN.tex,
// matching each material's world to that world's course topic (world 1 ->
// session01.tex, world 2 -> session02.tex, ... world 9 -> session09.tex --
// see CLAUDE.md's topic table). World 1/2 draw from session01.tex (mean-field
// theory, Mott insulators, Hubbard U, spontaneous symmetry breaking) and
// session02.tex (Bloch's theorem, tight-binding bands, graphene's Dirac
// cone). World 10's wilds (data/materials.ts's WORLD_CRYSTALS[10]) are real
// named hybrids/standalones rather than a session topic of their own, so
// each one draws from whichever session its own type/recipe anchors to
// (DESIGN.md's crystal-database table names each anchor) -- MnBi₂Te₄'s pool
// below draws from session04.tex (Chern insulators/QHE) for this reason.
// Materials without an entry here go straight to battle (see
// getMaterialQuestion). Not every question below
// is literally a property of the named compound's own crystal structure
// (e.g. the honeycomb-lattice or Ising-ferromagnet questions in Nickel
// Oxide's pool) -- some are the general physics that world's session file
// covers, used as flavor for the topic/type the material represents, the
// same way the original single-question versions already did.

export interface MaterialQuestion {
  prompt: string;
  correct: string;
  incorrect: string;
}

export const MATERIAL_QUESTIONS: Record<string, MaterialQuestion[]> = {
  Graphene: [
    {
      prompt: "Near its Dirac point, graphene's bands disperse as...",
      correct: 'E ∝ |k| (linear, Dirac-like)',
      incorrect: 'E ∝ k² (ordinary parabolic)',
    },
    {
      prompt: "How many orbitals does graphene's honeycomb lattice carry per unit cell?",
      correct: 'Two -- one per sublattice (A, B)',
      incorrect: 'One, shared by the whole cell',
    },
    {
      prompt: "What is an electron's effective mass exactly at the tip of graphene's Dirac cone?",
      correct: 'Formally zero -- massless',
      incorrect: 'Equal to the bare electron mass',
    },
    {
      prompt: "At how many inequivalent points of graphene's Brillouin zone do the bands touch at zero energy?",
      correct: 'Two -- K and K′',
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
  ],
  'Manganese Oxide': [
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
  ],
  'Nickel Oxide': [
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
      correct: 'Any U > 0 -- no threshold',
      incorrect: 'Only above a finite critical U_c',
    },
  ],
  'Gallium Nitride': [
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
  ],
  'Magnesium Oxide': [
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
      correct: 'Sensitive -- even weak interactions can drive an instability',
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
  ],
  // World 3 (topological band theory), sourced from session03.tex.
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
  'Tantalum Arsenide': [
    {
      prompt: 'What class of topological material is tantalum arsenide, whose low-energy quasiparticles are Weyl fermions?',
      correct: 'A topological semimetal',
      incorrect: 'A quantum spin Hall insulator',
    },
    {
      prompt: "Unlike a Chern insulator, a topological semimetal's bulk is...",
      correct: 'Gapless, not fully gapped',
      incorrect: 'Gapped everywhere, just like an insulator',
    },
    {
      prompt: "A filled band's contribution to the Hall conductivity is fixed by integrating which quantity over the Brillouin zone?",
      correct: 'The Berry curvature',
      incorrect: 'The density of states',
    },
    {
      prompt: "Why is a filled band's contribution to the Hall conductivity always quantized to an integer?",
      correct: 'The Brillouin zone is a closed, compact surface (a torus)',
      incorrect: "The band's dispersion is always linear near the Fermi level",
    },
    {
      prompt: 'What does the bulk-boundary correspondence say happens at an interface between two gapped phases with different Chern numbers?',
      correct: 'The bulk gap must close somewhere at the interface',
      incorrect: 'The interface stays gapped, just with a shifted Fermi level',
    },
    {
      prompt: 'In linear response theory, an observable is Taylor-expanded in which quantity?',
      correct: 'The perturbation strength λ',
      incorrect: "The system's temperature",
    },
  ],
  'Monolayer WTe₂': [
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
  ],
  // World 4 (QHE/Landau levels), sourced from session04.tex.
  'Gallium Arsenide': [
    {
      prompt: 'In a GaAs two-dimensional electron gas, the Landau level energies E_n = ħω_c(n+1/2) grow with magnetic field B as...',
      correct: 'Linearly in B',
      incorrect: 'As the square root of B',
    },
    {
      prompt: 'Why does the quantum Hall effect in GaAs typically need temperatures around 1 K rather than room temperature?',
      correct: 'Its Landau level spacing is only about a millielectronvolt',
      incorrect: 'GaAs has strong spin-orbit coupling that washes out the plateaus',
    },
    {
      prompt: 'Sweeping the magnetic field across a GaAs 2DEG once the quantum regime sets in, the Hall resistance...',
      correct: 'Steps through a staircase of sharp quantized plateaus',
      incorrect: 'Rises smoothly and continuously with B',
    },
    {
      prompt: 'If the chemical potential in a GaAs 2DEG sits between the n=1 and n=2 Landau levels, the Hall conductance locks onto...',
      correct: 'σ_xy = 2 e²/h',
      incorrect: 'σ_xy = 3 e²/h',
    },
    {
      prompt: 'In the Landau gauge A = (0, Bx, 0) used to solve the GaAs Landau problem, which momentum stays a good quantum number?',
      correct: 'p_y -- translations along y survive',
      incorrect: 'p_x -- translations along x survive',
    },
    {
      prompt: 'Despite being completely flat and dispersionless, each filled Landau level in a GaAs 2DEG carries what Chern number?',
      correct: 'C = 1',
      incorrect: 'C = 0',
    },
  ],
  'Graphene (strong field)': [
    {
      prompt: "In a strong magnetic field, graphene's Landau level energies scale as...",
      correct: 'E_n ∝ √(nB) -- square root of both level index and field',
      incorrect: 'E_n ∝ nB -- linear in level index and field',
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
      correct: 'Adiabatically connected -- the same topological phase',
      incorrect: 'Fundamentally distinct phases separated by a phase transition',
    },
    {
      prompt: 'Besides moire materials like twisted MoTe₂, which real material realizes a zero-field quantized Hall conductance through genuine magnetism rather than a lattice pseudo-field?',
      correct: 'Chromium-doped (Bi,Sb)₂Te₃',
      incorrect: 'Pure, undoped bulk bismuth selenide (Bi₂Se₃)',
    },
  ],
  // World 5 (superconductivity/Majorana), sourced from session05.tex.
  Aluminum: [
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
  ],
  Lead: [
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
  ],
  YBCO: [
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
  ],
  'Fe/Pb Majorana Chain': [
    {
      prompt: 'A Majorana fermion is algebraically defined by which condition on its operator γ?',
      correct: 'γ† = γ -- it is its own antiparticle',
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
      incorrect: 'A simple commuting phase -- order never matters',
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
  // World 6 (classical magnetism/magnons), sourced from session06.tex.
  Iron: [
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
      correct: 'Itinerant magnetism -- delocalized electrons near a Stoner instability',
      incorrect: 'Localized-moment magnetism from fully frozen charge',
    },
    {
      prompt: "Near k=0, a ferromagnet's magnon dispersion behaves as...",
      correct: 'E(k) ∝ k² -- quadratic',
      incorrect: 'E(k) ∝ |k| -- linear',
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
  ],
  Cobalt: [
    {
      prompt: 'The Stoner criterion for a spontaneous ferromagnetic instability to develop is...',
      correct: 'U·D(E_F) ≥ 1',
      incorrect: 'U·D(E_F) ≤ 1',
    },
    {
      prompt: 'In the mean-field Hubbard model, which direction does the spontaneous exchange field point?',
      correct: 'Any direction in spin space -- not fixed to z',
      incorrect: 'Always along the z axis, fixed by the Hamiltonian',
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
  'Chromium Triiodide': [
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
      incorrect: 'No edge states -- topology only shows up in the bulk',
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
  ],
  // World 7 (entanglement/tensor networks), sourced from session07.tex.
  // Herbertsmithite is also a world-8 wild crystal (materials.ts's
  // WORLD_CRYSTALS[8]) -- getMaterialQuestion keys purely by name, so this
  // single pool is shared by both encounters rather than duplicated.
  // Intentional, not a gap: it's genuinely the same real compound in both
  // worlds, and this pool is already kagome/quantum-spin-liquid content
  // generically relevant to world 8's own topic, not narrowly tensor-
  // network-specific.
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
  'Strontium Copper Borate': [
    {
      prompt: "The exactly solvable dimerized Heisenberg chain's ground state is a tensor product of what, one per bond?",
      correct: 'Singlets',
      incorrect: 'Triplets',
    },
    {
      prompt: "For the antiferromagnetic Heisenberg dimer's singlet ground state, what is the entanglement entropy between its two sites?",
      correct: 'log 2, the maximum a single spin-1/2 can carry',
      incorrect: 'Zero -- singlets are unentangled',
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
  ],
  'Thallium Copper Chloride': [
    {
      prompt: 'The Jordan-Wigner transformation maps spin operators to fermionic operators plus what extra piece?',
      correct: 'A string operator counting parity to the left',
      incorrect: 'A simple phase factor of i',
    },
    {
      prompt: 'Storing a general L-site spin-1/2 wave function exactly requires how many coefficients?',
      correct: '2^L -- exponential in system size',
      incorrect: 'L² -- polynomial in system size',
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
  ],
  // World 8 (quantum magnetism/spinons/Kondo), sourced from session08.tex.
  'α-Ruthenium Trichloride': [
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
  ],
  'YbMgGaO₄': [
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
  ],
  // World 9 (excitations and defects), sourced from session09.tex.
  'Fe(Te,Se)': [
    {
      prompt: 'In a conventional s-wave superconductor, which type of point impurity pulls a genuine bound state into the gap?',
      correct: 'A magnetic impurity',
      incorrect: 'A non-magnetic impurity',
    },
    {
      prompt: "The Yu-Shiba-Rusinov bound-state energy depends on the impurity's exchange coupling J only through α = πν₀JS. What does that say about the sign of J?",
      correct: 'It is irrelevant -- only J² and the spin S matter',
      incorrect: 'Only an antiferromagnetic (negative) J can break Cooper pairs',
    },
    {
      prompt: "As a magnetic impurity's coupling in an s-wave superconductor is tuned past α = πν₀JS = 1, what happens to its in-gap bound state?",
      correct: 'Its energy crosses zero -- a genuine quantum phase transition',
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
  ],
  'Niobium Diselenide': [
    {
      prompt: 'The density-of-states ripple that a single point impurity produces around itself in a metal is known as...',
      correct: 'Friedel oscillations',
      incorrect: 'Shubnikov-de Haas oscillations',
    },
    {
      prompt: 'The spatial wavelength of Friedel oscillations around a 1D metallic impurity is set by...',
      correct: 'π/k_F -- half the Fermi wavelength',
      incorrect: 'The lattice constant, regardless of filling',
    },
    {
      prompt: 'In dimension d, how does the amplitude of Friedel oscillations decay with distance |x| from the impurity?',
      correct: 'Algebraically, as a power law ~1/|x|^d',
      incorrect: 'Exponentially, with a fixed correlation length',
    },
    {
      prompt: 'Raising the chemical potential (and hence k_F) of a metal does what to the Friedel-oscillation wavelength around an impurity?',
      correct: 'Shortens it -- the oscillations speed up',
      incorrect: 'Lengthens it -- the oscillations slow down',
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
    // General defect-physics content from session09.tex, not specific to
    // Friedel oscillations/QPI -- grouped into this pool rather than a
    // separate one since Niobium Diselenide is world 9's other impurity-
    // physics compound.
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
  ],

  // World 2 (session02.tex: symmetries, Bloch's theorem, tight-binding).
  'Indium Arsenide': [
    {
      prompt: 'A unitary symmetry operator in quantum mechanics always has eigenvalues with...',
      correct: 'Unit modulus -- a pure phase e^{iφ}',
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
  ],
  'Monolayer MoTe₂ (2H)': [
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
  ],

  // World 5 (session05.tex: superconductivity, BCS, Nambu/BdG, Majoranas).
  Niobium: [
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
  ],
  'Tantalum Disulfide (1H)': [
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
      correct: "It's nodal radially -- positive near Γ, negative farther out",
      incorrect: "It's nodal angularly, alternating sign around the Fermi surface",
    },
    {
      prompt: 'Does a uniform pairing Δ still fully gap the Fermi surface on a triangular lattice, whatever the chemical potential?',
      correct: 'Yes -- a constant Δ gaps it at any chemical potential',
      incorrect: 'No -- uniform gapping only works on the square lattice',
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
  ],
  // Both real-material citations behind this pool are twisted graphene
  // TRILAYER experiments (Cao et al. and Kim et al., see the ★ Analytic
  // pool's Bethe-ansatz-adjacent citations note above), not magic-angle
  // bilayer physics -- Q1 is framed definitionally (what "unconventional"
  // means in this course) rather than as a claim about this material
  // specifically, and Q3 names the trilayer explicitly, so this pool never
  // asserts something only true of the trilayer platform as if it were this
  // (bilayer) crystal's own property.
  'Twisted Bilayer Graphene': [
    {
      prompt: "In this course's classification, a superconductor's pairing is called 'unconventional' when the attractive channel is mediated by...",
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
      incorrect: 'Nowhere -- nodal order is still fully gapped',
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
      incorrect: 'Only gauge symmetry -- time-reversal must stay intact',
    },
    {
      prompt: "A trivial s-wave gap and this heterostructure's topological gap can look nearly identical in bulk spectroscopy. What actually tells them apart?",
      correct: 'Only the topological one hosts gapless boundary/edge modes',
      incorrect: 'Nothing -- matching bulk spectra means matching topology',
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

  // World 6 (session06.tex: classical magnetism, magnons, DM interaction,
  // multiferroics) -- not every question below is literally a property of
  // the named compound's own crystal structure, same allowance this file's
  // header comment already establishes for Nickel Oxide's pool.
  'Chromium Tribromide': [
    {
      prompt: 'A magnet like CrBr₃ that breaks time-reversal symmetry hosts which emergent excitation, as opposed to a quantum spin liquid?',
      correct: 'Magnons -- spin-1, charge-neutral excitations',
      incorrect: 'Spinons -- spin-1/2, charge-neutral excitations',
    },
    {
      prompt: 'What two quantities does the Stoner criterion multiply together to test for spontaneous magnetism?',
      correct: 'The interaction U and the density of states at the Fermi level D(E_F)',
      incorrect: 'The temperature T and the applied magnetic field B',
    },
    {
      prompt: 'At half filling, as U→∞ in a strongly-correlated self-consistent Hubbard chain, the magnetic moment per site saturates at...',
      correct: 'Exactly one Bohr magneton -- a full localized spin-1/2',
      incorrect: 'It grows without bound as U increases',
    },
    {
      prompt: "Near k=0, how does an antiferromagnet's magnon dispersion behave, in contrast to a ferromagnet's quadratic E(k)∝k²?",
      correct: 'E(k) ∝ |k| -- linear, Dirac-cone-like',
      incorrect: 'E(k) ∝ k² -- also quadratic, same as the ferromagnet',
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
  ],
  'Twisted CrI₃': [
    {
      prompt: 'Twisting a CrI₃ bilayer creates a moiré pattern of spatially varying exchange coupling. What kind of magnetic ground state does spatially competing coupling favor?',
      correct: 'A noncollinear, spatially winding spin texture',
      incorrect: 'A uniform collinear Néel state, unaffected by the moiré pattern',
    },
    {
      prompt: 'The Dzyaloshinskii-Moriya interaction -- the spin-orbit term proposed to underlie moiré-induced multiferroicity in twisted CrI₃ -- favors neighboring spins rotated by roughly...',
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
  'Monolayer NiI₂': [
    {
      prompt: 'Which real 2D material does the session cite as an experimentally observed case of noncollinear order from competing exchange interactions?',
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
      correct: "Type-II multiferroic -- its ferroelectricity is magnetically induced",
      incorrect: 'Type-I multiferroic -- independent magnetic and electric order',
    },
    {
      prompt: 'The J1-J2 spiral mechanism behind NiI₂-type noncollinear order can occur even on a lattice that is...',
      correct: 'Perfectly bipartite, such as a simple chain -- no geometric frustration needed',
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
  ],

  // World 8 (session08.tex: frustrated magnetism, partons, RVB, Kondo lattice).
  'Tantalum Disulfide (1T)': [
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
      prompt: 'A valence bond solid -- a fixed, static covering of the lattice by singlets -- is not yet a genuine quantum spin liquid. Why not?',
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
  ],
  '1T/1H-TaS₂ Heterostructure': [
    {
      prompt: 'In the Kondo lattice, many local moments compete to be screened by the same conduction-electron sea. What is the result?',
      correct: 'Screening electrons are shared fractionally between impurities, producing massive lattice-wide entanglement at total spin zero',
      incorrect: 'Each impurity independently forms its own isolated singlet, unaffected by the others',
    },
    {
      prompt: 'At zero Kondo hybridization (γ_K = 0), what does the auxiliary f-fermion band in the Kondo-lattice model look like?',
      correct: 'Perfectly flat at zero energy -- these auxiliary fermions carry no hopping of their own',
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

  // World 10 (session04.tex: quantum Hall effect, Chern insulators,
  // Haldane model) -- MnBi₂Te₄ anchors to this session's own real-material
  // discussion of zero-field Chern insulators (DESIGN.md's crystal table),
  // not to a session of its own.
  'MnBi₂Te₄': [
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
      incorrect: "Both terms' valley contributions add the same way -- the staggered potential is topological too",
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
      prompt: "Graphene bilayers twisted and aligned to a boron-nitride substrate reach zero-field quantized Hall conductance through a mechanism distinct from MnBi₂Te₄'s intrinsic magnetism -- namely...",
      correct: 'Orbital magnetism (circulating currents), rather than spin/local-moment magnetism',
      incorrect: 'Doped-in paramagnetic impurities',
    },
  ],
};

export function getMaterialQuestion(materialName: string): MaterialQuestion | undefined {
  const pool = MATERIAL_QUESTIONS[materialName];
  if (!pool || pool.length === 0) return undefined;
  return pool[Math.floor(Math.random() * pool.length)];
}

// Curie's analytic moves (§5, World 6, BattleScene.showAnalyticQuestion):
// using Skyfall Beam or Ground Eruption asks one of these before the hit
// resolves -- correct doubles the damage, wrong halves it. One shared pool
// rather than per-world/per-material (unlike MATERIAL_QUESTIONS above),
// since an analytic move is usable from any crystal form, not tied to a
// single world's topic -- each question instead names the equation/law it's
// asking about directly. Same {prompt, correct, incorrect} shape.
export const ANALYTIC_QUESTIONS: MaterialQuestion[] = [
  {
    prompt: "Bloch's theorem writes a crystal electron's wavefunction as a plane wave times...",
    correct: 'A lattice-periodic function, u_k(r + R) = u_k(r)',
    incorrect: 'A second, independent plane wave',
  },
  {
    prompt: 'For a 1D tight-binding chain with hopping t, the band dispersion E(k) is proportional to...',
    correct: '-2t cos(ka)',
    incorrect: '-2t sin(ka)',
  },
  {
    prompt: 'The Stoner criterion for a spontaneous ferromagnetic instability is...',
    correct: 'U·D(E_F) ≥ 1',
    incorrect: 'U·D(E_F) ≤ 1',
  },
  {
    prompt: 'The energy of the n-th Landau level in a magnetic field B is...',
    correct: 'E_n = ħω_c(n + 1/2)',
    incorrect: 'E_n = ħω_c·n²',
  },
  {
    prompt: "At zero temperature, the BCS gap Δ(0) relates to T_c as...",
    correct: 'Δ(0) ≈ 1.76 k_B T_c',
    incorrect: 'Δ(0) ≈ 0.5 k_B T_c',
  },
  {
    prompt: 'The London equation relates a superconductor’s current density J to the magnetic field B via...',
    correct: '∇×J = -(n_s e² / m) B',
    incorrect: '∇·J = -(n_s e² / m) B',
  },
  {
    prompt: 'A band’s Chern number is the integral, over the Brillouin zone, of...',
    correct: 'The Berry curvature, divided by 2π',
    incorrect: 'The band energy itself',
  },
  {
    prompt: "Near k=0, a ferromagnet's magnon dispersion behaves as...",
    correct: 'E(k) ∝ k² (quadratic)',
    incorrect: 'E(k) ∝ |k| (linear)',
  },
  {
    prompt: 'The von Neumann entanglement entropy of a density matrix ρ is defined as...',
    correct: 'S = -Tr(ρ log ρ)',
    incorrect: 'S = Tr(ρ²)',
  },
  {
    prompt: 'The Kondo temperature T_K depends on the exchange coupling J roughly as...',
    correct: 'T_K ∝ exp(-1/(J·D(E_F))) -- exponentially small',
    incorrect: 'T_K ∝ J² -- a simple power law',
  },
  {
    prompt: 'In mean-field Hubbard theory, the order parameter m = ⟨n↑⟩ − ⟨n↓⟩ describes...',
    correct: 'The magnetization',
    incorrect: 'The charge-density-wave amplitude',
  },
  {
    prompt: "Graphene's Fermi velocity, in terms of hopping t and bond length a, is...",
    correct: 'v_F = 3ta / (2ħ)',
    incorrect: 'v_F = ta / ħ',
  },
  {
    prompt: 'In a Chern insulator, the quantized Hall conductivity σ_xy is given by...',
    correct: 'C e²/h, with C the Chern number',
    incorrect: '(e²/h) times the bulk band gap',
  },
  {
    prompt: "In a strong field, graphene's Dirac Landau level energies scale with level index n and field B as...",
    correct: 'E_n ∝ √(nB)',
    incorrect: 'E_n ∝ nB',
  },
  {
    prompt: 'The Laughlin wavefunction, built by raising the filled-Landau-level Vandermonde factor to an odd power m, has filling factor...',
    correct: 'ν = 1/m',
    incorrect: 'ν = m',
  },
  {
    prompt: 'The superconducting flux quantum Φ₀ equals...',
    correct: 'h/2e',
    incorrect: 'h/e',
  },
  {
    prompt: 'The Dzyaloshinskii-Moriya interaction couples neighboring spins via...',
    correct: 'A cross product, D·(S_i × S_j)',
    incorrect: 'A dot product, S_i · S_j',
  },
  {
    prompt: 'For a matrix product state of bond dimension M, the maximum entanglement entropy it can represent across a bond is...',
    correct: 'log M',
    incorrect: 'M itself',
  },
  {
    prompt: "The 1D Heisenberg chain's exact ground-state energy per site in the thermodynamic limit, from the Bethe ansatz, is...",
    correct: 'J(1/4 − ln 2) ≈ −0.443 J',
    incorrect: '−1/4 J exactly',
  },
  {
    prompt: "A magnetic impurity's Yu-Shiba-Rusinov in-gap bound state in an s-wave superconductor crosses zero energy exactly when α = πν₀JS equals...",
    correct: '1',
    incorrect: '0',
  },
];

export function getAnalyticQuestion(): MaterialQuestion {
  return ANALYTIC_QUESTIONS[Math.floor(Math.random() * ANALYTIC_QUESTIONS.length)];
}
