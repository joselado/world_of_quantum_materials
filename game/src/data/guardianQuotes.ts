import type { StoryLength } from './settings';

// What each guardian says when their panel opens: the line beside the
// portrait at the top of every guardian panel (scenes/panels/guardianHeader.ts's
// renderGuardianHeader, called by each of the ten panels under scenes/panels/).
// Kept as plain data, like data/statLore.ts and data/worldFlavor.ts, so the
// copy can be edited without touching panel code, and so the Brief versions
// below can sit beside the full ones and be held to length by content-lint.
//
// Written in the same epic-plus-physics voice as the rest of the guardians'
// text: each line opens on the physics the guardian is named for and lands on
// what they sell. No em dashes and no "--" anywhere here: this is text a
// player reads (STYLE.md's "Player-facing writing"). The straight double
// quotes the line is shown in are added by guardianQuoteFor below, not
// written into the table.
export type GuardianQuoteId =
  | 'noether'
  | 'bloch'
  | 'dresselhaus'
  | 'landau'
  | 'majorana'
  | 'anderson'
  | 'feynman'
  | 'kondo'
  | 'franklin'
  | 'sklodowskaCurie';

export interface GuardianQuote {
  // What the guardian says in a Story Mode save.
  story: string;
  // What they say in a Superposition Mode save instead. Only the guardians
  // whose service is gated on progress in Story Mode (Bloch on worlds
  // visited, Dresselhaus on crystals defeated, Majorana on pairings reachable,
  // Anderson on hosts defeated) have one, telling the player everything is
  // already open; the rest say the same line in both modes.
  superposition?: string;
}

export const GUARDIAN_QUOTES: Record<GuardianQuoteId, GuardianQuote> = {
  noether: {
    story: 'I am Noether. Every symmetry hides a conservation law. Spend your qumatessence on a new attack, or a sharper stat.',
  },
  bloch: {
    story: 'I am Bloch. Name a world you have already touched, and I will fold you there.',
    superposition: 'I am Bloch. In superposition every world is already within reach: name any of them.',
  },
  dresselhaus: {
    story:
      "I am Dresselhaus. Carbon taught me that structure decides everything: the same atoms, built as graphite, a nanotube or a single sheet, make different materials entirely. Study a defeated crystal's structure closely enough and you can rebuild yourself into it, atoms and all, for a while.",
    superposition:
      'I am Dresselhaus. In superposition every nanostructure is within reach at once: become anything that exists, not only what you have already beaten.',
  },
  landau: {
    story:
      'Put a strong enough field on a two-dimensional electron gas and its whole band breaks into a ladder of flat levels, one fixed quantum of energy apart. Tell me the physics right and I will teach your crystal to strike by that ladder. Answer right and the hit climbs a rung and lands twice as hard. Answer wrong and it lands at half strength. Tell me which quasiparticle should carry it, too.',
  },
  majorana: {
    story: 'I am Majorana. Fuse two states you understand and see what phase they make together.',
    superposition: 'I am Majorana. In superposition every pairing is possible: fuse any two states that make physical sense.',
  },
  anderson: {
    story:
      'I am Anderson. Dope in a defeated quantum material as an impurity, and I teach you the one channel it opens. It works only while that impurity stays doped in. A new dopant replaces it. One impurity, placed on purpose, is a question. Enough of them, placed by no one, is a verdict. I teach the dose.',
    superposition:
      "I am Anderson. In superposition any quantum material can be doped in as an impurity. Pick one, and I'll teach you the channel it opens, active for as long as that impurity stays doped in; a new one replaces it.",
  },
  feynman: {
    story:
      'A tensor network and a Feynman diagram draw the same trick two ways: a vertex for every point, a line for every leg. Show me you understand a move you already carry, and I will draw a higher-order correction into it. Paid for whether it lands or not.',
  },
  kondo: {
    story:
      'I am Kondo. A cloud of conduction electrons wraps a magnetic moment until the moment is gone. That is my whole trade, and it generalizes: gather the right cloud and a blow carrying spin, or charge, or the tremor of a broken symmetry, arrives at half strength. A cloud screens one thing only. Learn all three if you like, then tell me which one to hold.',
  },
  franklin: {
    story:
      'Fire X-rays through a crystal full of defects and the sharp spots blur into rings. Every pore and dislocation leaves its mark in how the beam scatters. I can teach your crystal to scatter a blow the same way. A lesson needs room to hold, though: I sell that room slot by slot, and the heaviest lessons take all of it.',
  },
  sklodowskaCurie: {
    story:
      'I am Skłodowska-Curie, and I lead this circle of guardians: Noether, Bloch, Dresselhaus, Landau, Majorana, Anderson, Feynman, Kondo, Franklin, and I. Here is our last lesson. Answer three questions on the physics running through everything you have learned. Get all three right and your crystal strikes with a force none of the others can match. Miss even one and the blow lands nowhere at all. Tell me which quasiparticle carries it, too. A new one costs a lot to unlock, but once bought it is yours to wear again for free.',
  },
};

// A line this long or longer, in words, has a Brief sibling below; a shorter
// one is already brief and reads the same at both lengths. Read by
// content-lint (check 19), which requires the sibling above the threshold and
// holds every sibling that exists to the same ratios as the story screens.
export const BRIEF_QUOTE_MIN_WORDS = 30;

// The Brief versions, what the panel shows while the Settings station's Text
// Length row is on Brief (data/settings.ts's STORY_LENGTH_PRESETS). Each keeps
// the physics its guardian opens on and the one thing they sell, in about a
// third of the words; a guardian's line that is already short has no entry
// and reads the full line at both lengths. Same keys and shape as the table
// above, so guardianQuoteFor below only chooses which table to read.
export const GUARDIAN_QUOTES_BRIEF: Partial<Record<GuardianQuoteId, Partial<GuardianQuote>>> = {
  dresselhaus: {
    story: 'I am Dresselhaus. Structure decides everything, as carbon shows. Study a defeated crystal and become it.',
  },
  landau: {
    story:
      'A strong field breaks a two-dimensional electron gas into a ladder of flat levels. Strike by that ladder: answer right and the hit lands twice as hard, wrong and at half strength.',
  },
  anderson: {
    story: 'I am Anderson. Dope in a defeated quantum material as an impurity and learn the channel it opens.',
    superposition: 'I am Anderson. In superposition any quantum material can be your impurity; pick one and learn its channel.',
  },
  feynman: {
    story: 'Show me you understand a move you carry and I draw a higher-order correction into it, paid either way.',
  },
  kondo: {
    story:
      "I am Kondo. A cloud of conduction electrons screens a magnetic moment. The right cloud halves a blow carrying spin, charge, or a broken symmetry's tremor, nothing else.",
  },
  franklin: {
    story:
      "Defects blur a crystal's sharp X-ray spots into rings. I teach your crystal to scatter a blow that way. Lessons need room, sold slot by slot.",
  },
  sklodowskaCurie: {
    story:
      'I am Skłodowska-Curie, who leads this circle of guardians. Our last lesson: three questions on everything you have learned. All three right and your crystal strikes with unmatched force; miss one and it lands nowhere.',
  },
};

// The line a guardian's panel opens with, in the straight double quotes every
// panel shows it in, picked by the Text Length setting and by which mode's
// save is open. A guardian with no Superposition line says their Story line in
// both modes, and a line with no Brief sibling reads in full at both lengths.
export function guardianQuoteFor(id: GuardianQuoteId, length: StoryLength, superposition = false): string {
  const detailed = GUARDIAN_QUOTES[id];
  const brief = length === 'brief' ? GUARDIAN_QUOTES_BRIEF[id] : undefined;
  const line = superposition && detailed.superposition ? (brief?.superposition ?? detailed.superposition) : (brief?.story ?? detailed.story);
  return `"${line}"`;
}
