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
// cone). Materials without an entry here go straight to battle (see
// getMaterialQuestion) -- world 10 has no wild pool at all (adaptive final
// boss only), so it needs no entries here either. Not every question below
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
      prompt: 'If the chemical potential in a GaAs 2DEG sits between the 2nd and 3rd Landau level, the Hall conductance locks onto...',
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
      incorrect: 'Total spin',
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
  // Herbertsmithite is also a world-8 (spinliquid) wild crystal
  // (materials.ts's WORLD_CRYSTALS[8]) -- getMaterialQuestion keys purely by
  // name, so this single pool is shared by both encounters rather than
  // duplicated. Intentional, not a gap: it's genuinely the same real
  // compound in both worlds, and this pool is already kagome/quantum-spin-
  // liquid content generically relevant to world 8's own topic, not
  // narrowly tensor-network-specific.
  Herbertsmithite: [
    {
      prompt: "Why does mean-field theory fail for a quantum spin liquid like herbertsmithite's kagome moments?",
      correct: 'No order parameter for it to converge on',
      incorrect: 'The lattice has too much symmetry to break',
    },
    {
      prompt: "Unlike a conventional antiferromagnet, a quantum spin liquid's ground state does not break which symmetry?",
      correct: 'Time-reversal symmetry',
      incorrect: 'Translational symmetry',
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
  'NV-Diamond': [
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
      correct: 'π/k_F -- twice the Fermi wavelength',
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
  ],
};

export function getMaterialQuestion(materialName: string): MaterialQuestion | undefined {
  const pool = MATERIAL_QUESTIONS[materialName];
  if (!pool || pool.length === 0) return undefined;
  return pool[Math.floor(Math.random() * pool.length)];
}
