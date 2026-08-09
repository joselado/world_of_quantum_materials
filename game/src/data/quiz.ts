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
// Content is sourced from lecture_notes/tex_extended/sessions/session01.tex
// (mean-field theory, Mott insulators, Hubbard U, spontaneous symmetry
// breaking) and session02.tex (Bloch's theorem, tight-binding bands,
// graphene's Dirac cone) -- the session1/2 material the world 1/2 overworld
// maps draw their wild pools from. Only materials with an entry here get a
// quiz; others go straight to battle (see getMaterialQuestion), the same
// "not every world is filled in yet" pattern the per-world crystal/biome
// tables already use. Not every question below is literally a property of
// the named compound's own crystal structure (e.g. the honeycomb-lattice or
// Ising-ferromagnet questions in Nickel Oxide's pool) -- some are the
// general Hubbard-model/symmetry-breaking physics session01 actually covers,
// used as flavor for the topic the material represents, the same way the
// original single-question versions already did.

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
};

export function getMaterialQuestion(materialName: string): MaterialQuestion | undefined {
  const pool = MATERIAL_QUESTIONS[materialName];
  if (!pool || pool.length === 0) return undefined;
  return pool[Math.floor(Math.random() * pool.length)];
}
