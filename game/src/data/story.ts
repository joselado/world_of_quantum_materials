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
