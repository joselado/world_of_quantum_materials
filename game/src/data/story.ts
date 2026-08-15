// One line of Decoherence-arc flavor per world, shown right after that
// world's rival is beaten and before OverworldScene.advanceToWorld moves the
// player on (OverworldScene.crossPass) -- the connective tissue
// between the intro (data/tutorial.ts's first page) and the ending
// (OverworldScene.showFinalePanel), so the Decoherence plot is more than a
// line at the very start and the very end. Keyed by the world just beaten,
// not the one being entered.
export const STORY_BEATS: Partial<Record<number, string>> = {
  1: 'The two branches hold their choice. Somewhere past the standing stones, the Decoherence is still spreading -- and it is learning from every phase of matter you master.',
  2: "The colonnade's lattice symmetry holds again. Ahead, the ground breaks into flat dead domains with a single lit ledge running between them -- another shape the Decoherence hasn't figured out yet.",
  3: 'The seam holds, and the bulk stays where it is. Further on, the ground falls into flat glowing bands under a storm that never breaks -- untouched territory for whatever is unraveling these worlds.',
  4: "The flats' orbits lock back into their levels. Beyond them, an open glacier runs cold enough for zero resistance -- and for Majorana pairs to hide in plain sight.",
  5: 'The glacier stays superconducting. Out on the black iron sand beyond it, spin waves still ripple where they should be still -- the next front the Decoherence has opened.',
  6: 'The steppe falls quiet and ordered. Past it, an entire world is nothing but bonds and entanglement, hung in nothing at all -- if the Decoherence can unravel that, it can unravel anything.',
  7: 'The network holds its bonds. Past its last rung the lanes give onto black water that fractionalizes everything entering it -- spin liquids that never settle on an order of their own.',
  8: 'The water settles into something you can name again. Ahead the ground itself is scarred -- old burns closed over, and crust still open and glowing between them: defects and impurities, the Decoherence wearing through the material.',
  9: "The scars close. What's left is a world that re-forms around you as you walk and takes the ground back behind you -- adaptive, watching, the last and strangest phase of matter you'll face.",
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
  "It reached for every trick it had ever watched you land, and still came up short. It was never a plague loose in these nine worlds -- it was built out of your own play, trained to wear your own moves back at you, and you out-adapted your own reflection anyway. Every symmetry, every edge state, every fractional charge you fought to protect holds on its own now, with nothing left studying how to unmake it.";
