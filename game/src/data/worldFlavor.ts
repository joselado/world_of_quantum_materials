// Bloch's own destination blurb (scenes/panels/bloch.ts) -- one short
// paragraph per world, in the same epic-plus-physics voice every guardian's
// own intro quote uses (e.g. Noether's "Every symmetry hides a conservation
// law..."), grounded in that world's own course topic (DESIGN.md's world-map
// table, cross-referenced against
// lecture_notes/tex_extended/sessions/sessionNN.tex). Distinct from
// worldLore.ts's two-page Decoherence-arc history (shown once, narrates an
// attack on that world's physics) and story.ts's STORY_BEATS (one-line
// transition beats between worlds): this blurb is neither narrative nor
// transitional, just a plain physics description of whichever destination is
// currently previewed in Bloch's own table/map, kept as plain data so the
// copy can be edited without touching panel code.
export const WORLD_FLAVOR: Record<number, string> = {
  1: "Left alone, the field's spins have no reason to point anywhere -- the Hamiltonian doesn't care. Then one mean-field interaction tips the balance, and the whole system commits to a single broken symmetry it can no longer see a reason to abandon.",
  2: "Every alcove here repeats its neighbor exactly, and Bloch's theorem takes that symmetry seriously: an electron built to respect it can't live in just one alcove. It spreads as a plane wave dressed by the lattice, labeled only by a crystal momentum, never a single site.",
  3: 'No single measurement inside an island tells you its phase -- only the Berry curvature, integrated over the whole filled band, and what falls out is always an integer. Where two integers disagree, the gap can only close at the border, and a protected edge channel is what that invariant looks like underfoot.',
  4: 'A field this strong bends every trajectory into a closed orbit, and only orbits enclosing a whole number of flux quanta are allowed. Electrons fill these Landau levels one flat, massively degenerate rung at a time -- the only current that survives runs along the edge.',
  5: "Two electrons that should repel each other condense into a single pair, and the whole superconducting wavefunction commits to one phase. Split a Bogoliubov quasiparticle's own particle-hole ambiguity far enough apart and each half becomes its own antiparticle -- a Majorana zero mode, real and unpaired.",
  6: "Push the Stoner criterion past its threshold and a magnetized ground state becomes cheaper, self-consistently, than a paramagnetic one. Tip a single spin out of that order and the disturbance doesn't stay put -- it propagates outward as a magnon, a coherent spin wave.",
  7: 'A generic many-body wavefunction here needs coefficients that scale exponentially with system size -- far more than any world could store. A ground state with only short-range entanglement obeys an area law instead, and a matrix product state captures it with a bond dimension that barely has to grow.',
  8: "A frustrated lattice refuses to order the way Magnon Plains does -- a spin fractionalizes into deconfined spinons instead, carrying the original moment's spin but none of its charge. Where a local moment survives long enough to meet a conduction sea, the two screen each other into a single Kondo singlet.",
  9: 'A pristine crystal only tells you what it can be; a broken one tells you what it actually is. Every impurity here rings the surrounding electron sea in Friedel oscillations that read off the Fermi surface itself, and where disorder piles up thick enough, Anderson localization traps the electrons without a single broken bond.',
  10: "Nothing here is fixed -- the terrain rewrites itself around whatever crystal you currently are, and its own guardian adapts live rather than defending one static form. Only a variational ansatz, a neural or tensor network trained fast enough to keep up, has any hope of describing either one.",
};
