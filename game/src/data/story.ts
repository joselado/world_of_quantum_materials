// The narrator's liberation beat per world, shown right after that world's
// rival is beaten and before OverworldScene.advanceToWorld moves the player
// on (OverworldScene.crossPass): first the golem's release observed as a
// physical fact in that world's own physics vocabulary (its disorder
// anneals and the freed material rejoins its world; World 9's flaw is the
// exception, having no coherence to lose and so nothing to free), then a
// line of connective tissue looking forward -- the bridge between the intro
// (data/tutorial.ts's first page) and the ending
// (OverworldScene.showFinalePanel), so the Decoherence plot is more than a
// line at the very start and the very end. The narrator is the only voice
// that speaks here: no post-battle golem dialogue surface exists, because a
// golem that understood or gave thanks would break WORLDS.md's "the golem
// never learns what it is." The release never relights anything either --
// the lost light is cost already paid, and stays paid. Keyed by the world
// just beaten, not the one being entered.
export const STORY_BEATS: Partial<Record<number, string>> = {
  1: 'The grain boundaries in the silicon let go, and a thousand separate choices anneal into one, held everywhere at once. What settles back into the fields is silicon again, whole. The branches hold their choice. Somewhere past the standing stones, the Decoherence is still spreading, and it is learning from every phase of matter you master.',
  2: "The glass between the grains crystallizes, bay matching bay through the whole of the quartz, and a state can spread across all of it at once. The colonnade's lattice symmetry holds again. Ahead, the ground breaks into flat dead domains with a single lit ledge running between them: another shape the Decoherence hasn't figured out yet.",
  3: 'The disorder drains from the tarnished silver. Its currents take their first step in a very long time, spin welded to direction, walking straight past every flaw that used to stop them. The seam holds, and the bulk stays where it is. Further on, the ground falls into flat glowing bands under a storm that never breaks: untouched territory for whatever is unraveling these worlds.',
  4: "Order settles back through the slate-dark layers, sheet by sheet. Loops close where they could not close, and what stood in the pass carries a whole number again, exact and unshaken. The flats' orbits lock back into their levels. Beyond them, an open glacier runs cold enough for zero resistance, and for Majorana pairs to hide in plain sight.",
  5: 'The thousand weak links in the black ceramic fuse shut, grain into grain. The phase stops being a treaty between pieces and goes back to being one thing: a single wave with no seams to cross. The glacier stays superconducting. Out on the black iron sand beyond it, spin waves still ripple where they should be still: the next front the Decoherence has opened.',
  6: 'The boundaries in the iron let go, grain growing into grain, and the first wave to cross it in an age passes through without scattering and out over the steppe. Past it lies a whole world of nothing but bonds and entanglement, hung in nothing at all. If the Decoherence can unravel that, it can unravel anything.',
  7: 'The fracture lines in the pale green mineral seal. The one state no piece was ever holding spreads back across every piece at once, whole exactly because it lives nowhere in particular. The network holds its bonds. Past its last rung the lanes give onto black water that fractionalizes everything entering it: spin liquids that never settle on an order of their own.',
  8: 'The stacking faults in the brown-black layers heal, seam by seam. What comes apart in it now travels: halves cross the whole crystal, with no boundary left to hold them in. The water settles into something you can name again. Ahead the ground itself is scarred, old burns closed over and crust still open and glowing between them: defects and impurities, the Decoherence wearing through the material.',
  9: "The flaw disperses, and the ground it borrowed goes back to being ground. There was nothing in it to free: the one thing on this road with no coherence to lose has none to be handed back. The scars close. What's left is a world that re-forms around you as you walk and takes the ground back behind you: adaptive, watching, the last and strangest phase of matter you will face.",
};

// One line of world-specific flavor shown on the goal-tile banner
// (OverworldScene's `goalText`) once a world's far edge is reached, in
// place of a single generic line repeated across all ten worlds. Falls back
// to that generic line for a world with no entry here.
export const WORLD_GOAL_TEXT: Partial<Record<number, string>> = {
  1: 'You reached the far edge of the fields. The branches still hold.',
  2: 'You reached the far end of the colonnade. The lattice still repeats.',
  3: 'You reached the last ledge. The seam still runs, unbroken.',
  4: 'You reached the last fork of the flats. The orbits still close.',
  5: 'You reached the far ice. The phase still holds.',
  6: 'You reached the far steppe. The last swell still moves.',
  7: 'You reached the end of the tensor lanes. The rungs still hold.',
  8: 'You reached the far bank. The resonance still holds.',
  9: 'You reached the far scars. The hole is still just a hole.',
  10: "You reached the end of the corridor. It already knows you're here.",
};

// The arc's closing screen, shown by OverworldScene.showFinalePanel once the
// last built world's rival falls. Kept here beside the beats rather than
// inline in that panel so the Lab's Story station (data/storyLog.ts) can
// close its own chronological reading with the same words the ending itself
// uses.
export const FINALE_TITLE = 'The Decoherence is stabilized.';

export const FINALE_BODY =
  "It reached for every trick it had ever watched you land, and still came up short. It was never a plague loose in these nine worlds. It was built out of your own play and trained to wear your own moves back at you, and you out-adapted your own reflection anyway. Every symmetry, every edge state, every fractional charge you fought to protect holds on its own now, with nothing left studying how to unmake it. And the golems are golems no longer. They were ground down holding their passes, and now that the grinding has stopped they are materials again: annealed, ordered, back in the worlds they could not save alone. What was learned about them stays learned, and the light it cost does not come back. But nothing is reading the record anymore, and everything that can still choose is choosing.";
