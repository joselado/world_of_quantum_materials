// One line of Decoherence-arc flavor per world, shown right after that
// world's rival is beaten and before OverworldScene.advanceToWorld moves the
// player on (OverworldScene.tryAdvanceToNextWorld) -- the connective tissue
// between the intro (data/tutorial.ts's first page) and the ending
// (OverworldScene.showFinalePanel), so the Decoherence plot is more than a
// line at the very start and the very end. Keyed by the world just beaten,
// not the one being entered.
export const STORY_BEATS: Partial<Record<number, string>> = {
  1: 'The tutorial meadow steadies. Somewhere past the crystalline caves, the Decoherence is still spreading -- and it is learning from every phase of matter you master.',
  2: "The caves' lattice symmetry holds again. Ahead, the floating islands are cut through with one-way edges -- another shape the Decoherence hasn't figured out yet.",
  3: 'The islands stop drifting apart. Further on, quantized orbits ring the Landau terrain -- untouched territory for whatever is unraveling these worlds.',
  4: "The Landau terrain's orbits lock back into their levels. Beyond it, the caverns run cold enough for zero resistance -- and for Majorana pairs to hide in plain sight.",
  5: 'The caverns stay superconducting. Out on the windswept plains, spin waves still ripple where they should be still -- the next front the Decoherence has opened.',
  6: 'The plains fall quiet and ordered. Past them, an entire world is nothing but bonds and entanglement -- if the Decoherence can unravel that, it can unravel anything.',
  7: 'The network holds its bonds. Deeper in, a foggy forest fractionalizes everything that enters it -- spin liquids that never settle on an order of their own.',
  8: 'The forest resolves into something you can name again. Ahead, the world itself is cracked and glitching -- defects and impurities, the Decoherence wearing through the material.',
  9: "The cracks seal. What's left is a world built to look like you -- adaptive, watching, the last and strangest phase of matter you'll face.",
};

// One line of world-specific flavor shown on the goal-tile banner
// (OverworldScene's `goalText`) once a world's far edge is reached, in
// place of a single generic line repeated across all ten worlds. Falls back
// to that generic line for a world with no entry here.
export const WORLD_GOAL_TEXT: Partial<Record<number, string>> = {
  1: 'You reached the far edge of the Meadow. The branches still hold.',
  2: 'You reached the far end of the caves. The lattice still repeats.',
  3: 'You reached the far islands. The seam still runs, unbroken.',
  4: 'You reached the last fork of the Landau terrain. The orbits still close.',
  5: 'You reached the deepest cavern. The phase still holds.',
  6: 'You reached the far plains. The last swell still moves.',
  7: 'You reached the end of the tensor lanes. The rungs still hold.',
  8: 'You reached the far treeline. The resonance still holds.',
  9: 'You reached the far wastes. The hole is still just a hole.',
  10: "You reached the end of the corridor. It already knows you're here.",
};
