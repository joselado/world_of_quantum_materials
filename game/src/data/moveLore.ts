import type { MoveClass } from './types';
import type { StoryLength } from './settings';

// What the quasiparticle a move throws actually *is*, in physics -- shown in
// the detail pane of the Lab's own Moves station (scenes/panels/
// hubStations.ts's showMovesPanel), beside that move's looping battle-effect
// animation, at whichever length the Settings station's Text Length row asks
// for (moveClassLoreFor below).
//
// Keyed by quasiparticle class rather than by move id on purpose: what a
// player is being told is the physics of the excitation, and two moves that
// throw the same excitation are throwing the same physics. A tunable move
// (Landau's Analytic pair, Skłodowska-Curie's Ultimates) therefore reads the
// entry for whichever class it is currently tuned to, which is the class it
// really carries into a fight (data/materials.ts's getTunedMoveClass).
//
// Written the same way STAT_LORE is (data/statLore.ts): the physics has to be
// right and it has to be readable at a glance in a panel, so each entry is one
// short paragraph pitched at the course's own level, saying what the
// excitation is and what makes it that rather than an ordinary one. No em
// dashes and no "--" anywhere here: this is text a player reads (STYLE.md's
// "Player-facing writing").
export const MOVE_CLASS_LORE: Record<MoveClass, string> = {
  phonon:
    'The lattice itself, ringing. Atoms in a crystal sit in a periodic array and are tied to their neighbours, so a displacement never stays local: it travels as a wave with a definite wavelength and frequency, and the energy in that wave arrives in fixed quanta. Every crystal has a lattice, so every crystal can be made to ring.',
  electron:
    'One electron added to, or removed from, the filled sea of occupied states. It never travels bare. The other electrons and the lattice rearrange around it as it goes, so what actually moves is the electron together with its dressing, carrying a mass and a lifetime of its own rather than those of an electron in free space.',
  magnon:
    'A spin wave in an ordered magnet. Neighbouring moments pay exchange energy to point differently, so tipping one cannot stay put: the tilt spreads as a wave in which every moment precesses a little out of step with the next. One quantum of that wave carries a single unit of spin away from the ordered state.',
  plasmon:
    'The whole electron liquid sloshing against the background of positive ions. Displace the electrons and the charge they leave behind pulls them straight back, so the gas rings at one characteristic frequency set by how dense it is. It exists only where charge is free to move, which is why a metal carries one and an insulator does not.',
  ferron:
    'A quantum of the wobbling electric polarization of a ferroelectric. The crystal has settled with its positive and negative charge centres offset, and that offset can oscillate and propagate the way a magnet\'s moments can, so the polarization carries waves of its own.',
  triplon:
    'In a magnet whose spins have paired off into singlets, the ground state is quiet and there is an energy gap above it. Break one pair into a triplet and you have paid that gap; the triplet then hops from pair to pair through the lattice. It carries one whole unit of spin and it stays in one piece, which is exactly what a spinon does not do.',
  electromagnon:
    'A spin wave that also moves charge. Where magnetic order and electric polarization are coupled to each other, waves of the two kinds mix, and the excitation that comes out can be driven by the electric field of light while still being a wave in the spins.',
  spinon:
    'Flip one spin in a quantum spin liquid and the disturbance does not stay a single object. It comes apart into two halves that wander off independently, each carrying half a unit of spin and no charge at all. An excitation carrying a fraction of what an electron carries is the signature of fractionalization.',
  chiral:
    'The edge of a Chern insulator carries current one way only. There is no counter propagating channel at that edge for an electron to scatter into, so an impurity cannot turn it around, and the flow survives disorder that would stop an ordinary metal.',
  helical:
    'Two edge channels running in opposite directions with spin locked to the direction of travel, so turning a moving electron around would also mean flipping its spin. Time reversal symmetry forbids that, which is why ordinary non magnetic disorder cannot backscatter it and a magnetic impurity can.',
  higgs:
    'The size of the order parameter, oscillating. A condensate is described by an amplitude and a phase, and the phase mode is the cheap one. Changing the amplitude means climbing the wall of the potential the state settled into, so it costs energy. In a superconductor this is the strength of the pairing itself breathing.',
  heavyFermion:
    'A conduction electron entangled with a localized magnetic moment. Screening that moment ties the two together, the bands flatten where they hybridize, and what comes out moves as though it weighed hundreds of times what a bare electron does.',
  vison:
    'A vortex in the emergent gauge field of a quantum spin liquid. It carries no spin and no charge, and the way to tell it is there is to take a spinon on a loop around it: the wavefunction comes back with its sign reversed.',
  chargedAnyon:
    'An excitation of a fractionally filled topological band that carries a fraction of an electron\'s charge. Exchanging two of them multiplies the wavefunction by a phase that is neither the plus one of bosons nor the minus one of fermions, which is something only two dimensions allow.',
  majorana:
    'A zero energy mode bound at the end of a topological superconductor, and its own antiparticle: creating one is the same operation as destroying it. Two of them share a single ordinary fermionic state between them, stored non locally, so nothing acting at one end alone can read out what that state is.',
  screening:
    'Surround something and it stops being visible from outside. A magnetic moment in a metal is wrapped in conduction electrons until, from a distance, its spin has gone; a stray charge is wrapped in mobile carriers until its field is cut off within a few atomic spacings; the soft mode of a broken symmetry can be soaked up the same way. What a cloud can hide depends on what its own carriers couple to. Let the wrapping finish and the sea it drew on settles back into a calm Fermi liquid around the bound moment; hold it where it can neither finish nor let go, at a quantum critical point, and it fluctuates at every scale at once.',
};

// The Brief versions, what the Moves station shows while the Settings
// station's Text Length row is on Brief (data/settings.ts's
// STORY_LENGTH_PRESETS). Each keeps what the excitation is and the one thing
// that sets it apart, in a bit over a third of the words. Same keys as
// MOVE_CLASS_LORE, so moveClassLoreFor below only chooses which table to read.
export const MOVE_CLASS_LORE_BRIEF: Partial<Record<MoveClass, string>> = {
  phonon:
    'The lattice itself, ringing. Atoms are tied to their neighbours, so a displacement travels as a wave, its energy in fixed quanta. Every crystal can ring.',
  electron:
    'One electron added to or removed from the filled sea, never bare: its dressing gives it its own mass and lifetime.',
  magnon:
    "A spin wave in an ordered magnet: exchange spreads one tipped moment's tilt, and each quantum carries one unit of spin.",
  plasmon:
    'The whole electron liquid sloshing against the positive ions, at a frequency set by its density. Metals carry one; insulators do not.',
  ferron:
    "A quantum of a ferroelectric's polarization wave: the offset between its charge centres, oscillating and travelling.",
  triplon:
    'In a magnet of singlet pairs, breaking one into a triplet costs an energy gap. The triplet hops pair to pair, one whole unit of spin.',
  electromagnon:
    "A spin wave that also moves charge: where magnetic order and polarization couple, light's electric field can drive it.",
  spinon:
    'One flipped spin in a spin liquid splits into two halves, each with half a unit of spin and no charge.',
  chiral:
    "A Chern insulator's edge carries current one way only: no channel runs back, so impurities cannot reverse it.",
  helical:
    'Two opposite edge channels, spin locked to direction. Turning around means flipping spin, so only magnetic impurities backscatter.',
  higgs:
    "The size of the order parameter, oscillating. Unlike the phase, the amplitude costs energy to change: a superconductor's pairing strength, breathing.",
  heavyFermion:
    'A conduction electron entangled with a local magnetic moment, moving as though hundreds of times heavier.',
  vison:
    "A spinless, chargeless vortex in a spin liquid's emergent gauge field. A spinon circling it changes sign.",
  chargedAnyon:
    "A fraction of an electron's charge in a fractionally filled topological band, with exchange statistics neither bosonic nor fermionic.",
  majorana:
    "A zero energy mode at a topological superconductor's end, its own antiparticle. Two share one fermionic state neither end can read alone.",
  screening:
    "Surround something and it stops being visible from outside. Conduction electrons wrap a magnetic moment until its spin is gone; mobile carriers cut off a stray charge's field. What a cloud hides depends on what its carriers couple to.",
};

// The paragraph the Moves station shows, picked by the Text Length setting,
// falling back to the full paragraph for a class with no Brief one.
export function moveClassLoreFor(moveClass: MoveClass, length: StoryLength): string {
  return (length === 'brief' ? MOVE_CLASS_LORE_BRIEF[moveClass] : undefined) ?? MOVE_CLASS_LORE[moveClass];
}
