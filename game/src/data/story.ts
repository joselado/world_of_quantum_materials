import type { StoryLength } from './settings';

// The narrator's liberation beat per world, shown right after that world's
// rival is beaten and before OverworldScene.advanceToWorld moves the player
// on (OverworldScene.crossPass): first the golem's release observed as a
// physical fact in that world's own physics vocabulary (its disorder
// anneals and the freed material rejoins its world), then a
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
  2: "The glass between the grains crystallizes, bay matching bay through the whole of the quartz, and a state can spread across all of it at once. The colonnade's lattice symmetry holds again. Ahead, the ground breaks into flat dead domains with lit ledges running between them: another shape the Decoherence hasn't figured out yet.",
  3: 'The disorder drains from the tarnished silver. Its currents take their first step in a very long time, spin welded to direction, walking straight past every flaw that used to stop them. The seam holds, and the bulk stays where it is. Further on, the ground falls into flat glowing bands under a storm that never breaks: untouched territory for whatever is unraveling these worlds.',
  4: "Order settles back through the slate-dark layers, sheet by sheet. Loops close where they could not close, and what stood in the pass carries a whole number again, exact and unshaken. The flats' orbits lock back into their levels. Beyond them, an open glacier runs cold enough for zero resistance, and for Majorana pairs to hide in plain sight.",
  5: 'The thousand weak links in the black ceramic fuse shut, grain into grain. The phase stops being a treaty between pieces and goes back to being one thing: a single wave with no seams to cross. The glacier stays superconducting. Out on the sea beyond it, spin waves still run down the coast, and the Decoherence has come to still them: the next front it has opened.',
  6: 'The boundaries in the iron let go, grain growing into grain, and the first wave to cross it in an age passes through without scattering and out along the coast. Past it lies a whole world of nothing but bonds and entanglement, hung in nothing at all. If the Decoherence can unravel that, it can unravel anything.',
  7: 'The fracture lines in the pale green mineral seal. The one state no piece was ever holding spreads back across every piece at once, whole exactly because it lives nowhere in particular. The network holds its bonds. Past its last rung the lanes give onto black water that fractionalizes everything entering it: spin liquids that never settle on an order of their own.',
  8: 'The stacking faults in the brown-black layers heal, seam by seam. What comes apart in it now travels: halves cross the whole crystal, with no boundary left to hold them in. The water goes back to resonating, every pairing at once and none of them chosen. Ahead the ground itself is scarred, old burns closed over and crust still open and glowing between them: defects and impurities, the Decoherence wearing through the material.',
  9: "The vacancies in the golem anneal out one by one, until too few holes are left to trap anything, and the states it held shut in their pockets spread across the whole crystal again. Whatever crystal it was, it rejoins the scars whole. What's left ahead is a world that re-forms around you as you walk and takes the ground back behind you: adaptive, watching, the last and strangest phase of matter you will face.",
};

// The Brief version of each beat above, roughly a third its length, read
// when the Settings station's Text Length row is on Brief. It keeps the
// beat's two moves, the release observed as physics and the look forward, and
// gives up the rest.
export const STORY_BEATS_BRIEF: Partial<Record<number, string>> = {
  1: "The silicon's grain boundaries let go, a thousand choices annealing into one. Ahead, the Decoherence spreads on, learning from every phase you master.",
  2: 'The glass between the grains crystallizes, bay matching bay. Ahead, the ground breaks into dead domains with lit ledges between them.',
  3: "The silver's disorder drains, and its currents walk past every flaw again. Ahead, bands glow under a storm that never breaks.",
  4: 'Order settles back through the slate-dark layers, and every loop closes again. Beyond lies a glacier cold enough for zero resistance.',
  5: 'The weak links in the black ceramic fuse shut into one seamless wave. Beyond, spin waves run down a broken coast.',
  6: "The iron's grain boundaries let go, and a wave crosses unscattered at last. Past it hangs a world made only of entanglement.",
  7: "The green mineral's fractures seal, and the state no piece holds spreads across all of it. Beyond lies black water, where spins never settle.",
  8: 'The stacking faults in the brown-black layers heal, and halves cross the whole crystal. Ahead the ground is scarred with defects and impurities.',
  9: "The golem's vacancies anneal out, and its trapped states spread across the whole crystal again. Ahead, a world re-forms around you, watching.",
};

// One line of world-specific flavor shown on the goal-tile banner
// (OverworldScene's `goalText`) once a world's far edge is reached, in
// place of a single generic line repeated across all ten worlds. Falls back
// to that generic line for a world with no entry here.
export const WORLD_GOAL_TEXT: Partial<Record<number, string>> = {
  1: 'You reached the far edge of the fields. The branches still hold.',
  2: 'You reached the end of the hall. The colonnade runs on past it, and the lattice still repeats.',
  3: 'You reached the last ledge. The seam still runs, unbroken.',
  4: 'You reached the last fork of the flats. The orbits still close.',
  5: 'You reached the far ice. The phase still holds.',
  6: 'You reached the end of the coast. The last swell still moves.',
  7: 'You reached the end of the tensor lanes. The rungs still hold.',
  8: 'You reached the far bank. The resonance still holds.',
  9: 'You reached the far scars. The hole is still just a hole.',
  10: "You reached the far edge of the shape it copied from you. It already knows you're here.",
};

// The goal-tile line for a world whose own line stops being true once its
// rival has fallen, shown in WORLD_GOAL_TEXT's place from then on. Worlds 1-9
// carry none: what their line says still holds after the fight. World 10's
// speaks of the Adapted as present, and what the banner captions once it has
// fallen is the cliff the road ends at, with every world lying below it
// (WORLDS.md section 4).
export const WORLD_GOAL_TEXT_FALLEN: Partial<Record<number, string>> = {
  10: 'You reached the end of the road. Every world lies below, and nothing is watching.',
};

export function worldGoalTextFor(world: number, rivalFallen: boolean): string | undefined {
  return (rivalFallen ? WORLD_GOAL_TEXT_FALLEN[world] : undefined) ?? WORLD_GOAL_TEXT[world];
}

// The arc's closing screen, shown by OverworldScene.showFinalePanel each time
// the player looks out from the cliff the last world's road ends at, once its
// rival has fallen. It is read standing at that edge with every world lying
// below, so it speaks from there: the view the Adapted had of what it trained
// on, what stays learned, and what nothing is measuring anymore. Kept here
// beside the beats rather than inline in that panel so the Lab's Story
// station (data/storyLog.ts) can close its own chronological reading with the
// same words the ending itself uses.
export const FINALE_TITLE = 'The Decoherence is stabilized.';

export const FINALE_BODY =
  'The road ends at this edge, and every world you walked lies below it at once. This is how the thing that trained on you saw them: all together, from above. The only way to stand here was to bring down what stood here first. Nothing was undone. What it learned stays learned, the light it cost does not come back, and a record never goes back into superposition. But a record holds only what was measured, and nothing is measuring now. Every symmetry, every edge state, every fractionalized spin down there holds on its own. The materials that held the passes are whole again, and home. And the one thing the map below does not show is the step you take next.';

// The ending at Brief length, the same beats as FINALE_BODY in under half
// the words.
export const FINALE_BODY_BRIEF =
  'The road ends here, with every world you walked lying below at once, the way the thing that trained on you saw them. Nothing was undone: what it learned stays learned, and the light it cost does not come back. But nothing is measuring now, and the step you take next is on no record.';

// The two screens between World 10's three finale stages
// (BattleScene.advanceFinaleStage, DESIGN.md §6), each shown once the stage
// before it is brought to zero and before the next form stands: the narrator
// on what has just happened, then the new form's own line. Keyed by the
// stage about to begin. The Adapted speaks here where no golem ever does
// after falling (WORLDS.md §6) because it is not a golem and nothing has
// fallen -- a record does not anneal, it re-forms -- so this is the taunt's
// own surface carried into the fight, not a post-battle one. No light returns
// and nothing is freed on either screen. The stage-3 screen carries the
// arc's bridging line: the copy of the player is classical and always was
// (no-cloning); what is quantum is the environment that did the measuring,
// entangled with everything it consumed, and each round it answers as one
// of them -- a sample of that mixed state, not a copy of the player.
export interface FinaleStage {
  title: string;
  body: string;
  button: string;
}

export const FINALE_STAGES: Record<2 | 3, FinaleStage> = {
  2: {
    title: 'The Model of You',
    body:
      'The form that was reshaping around your every blow goes still and comes apart, and nothing anneals. A golem\'s disorder anneals; this had none. It has stopped adapting because there is nothing left in you it has not seen. What steps out of the falling shards is not a compound and wears no compound\'s face. It is a network in the exact shape of your own crystal, every node lit in your own colour, standing where the golem stood, and it will not reshape again. A record has no reason to.\n\n"I have finished. This is you: your phase, your quasiparticles, nothing you were lent. Not the levels a guardian ground onto your moves. Not the impurity you carry. Not the clouds you were taught to raise. Just you, held exactly. And I hold exactly."',
    button: 'Face it',
  },
  3: {
    title: 'The Quantum Adapted',
    body:
      'The record breaks along no grain, because it has none, and when it is gone the pass is not empty. The nodes hang where they hung, but the air around them has thickened and is lit from inside: a smoke that does not rise, with sparks running through it and the network still burning in it like a filament.\n\nUnderstand what this is. To learn you, something had to measure you, and a measurement is not kept by the record. It is kept by the thing that did the measuring. That thing was never a copy of you. It is everything in these worlds that it consumed, entangled with you and with all of it at once, and no record can say which of them it is. Ask, and it answers as one. Ask again, and it has moved on, and answers as another.\n\n"You mistook the record for me. The record was only where I kept you. I am what kept it: every phase in these worlds, and all of them at once, and whichever excitation your lattice cannot carry, that is the one I will throw. There is no move you own that I have not eaten. Come. This is the last thing you teach me."',
    button: 'Battle!',
  },
};

// The Brief versions, each about a third of its Detailed sibling, keeping
// the same two beats: what just happened, then the new form's own line.
export const FINALE_STAGES_BRIEF: Record<2 | 3, FinaleStage> = {
  2: {
    title: 'The Model of You',
    body:
      'The form goes still and comes apart, and nothing anneals: a record does not. What steps out is a network in the exact shape of your own crystal, lit in your colour, and it will not reshape again.\n\n"I have finished. This is you: your phase, your quasiparticles, nothing you were lent. Not your levels, not your impurity, not your clouds. Just you, held exactly."',
    button: 'Face it',
  },
  3: {
    title: 'The Quantum Adapted',
    body:
      'The record breaks, and the pass fills with a smoke lit from inside, sparks running through it, the network still burning in it. To learn you, something had to measure you, and what did the measuring was never a copy of you: it is everything it consumed, entangled with all of it at once, answering as one of them each time you ask and never the same one twice running.\n\n"The record was only where I kept you. I am what kept it. Whatever your lattice cannot carry, that is what I throw."',
    button: 'Battle!',
  },
};

// The end-of-battle summary once the third stage falls, in place of the
// compound-keyed greeting and Materialdex blurb every other win shows: the
// last form was a sample of the environment, and a blurb about whichever
// compound it happened to be answering as would say the wrong thing about
// what was just beaten. Written twice like every other finale text.
export const FINALE_VICTORY_LINE =
  'The smoke thins and does not re-form. The sparks run out of links to cross, the network goes dark node by node, and the last colour left in it is your own. Nothing anneals here; nothing was ever a crystal. But nothing is answering anymore, either.';

export const FINALE_VICTORY_LINE_BRIEF =
  'The smoke thins and does not re-form. The network goes dark node by node, its last colour your own. Nothing anneals here, and nothing is answering anymore.';

// The end-of-battle summary when the player falls to the second or third
// stage, in place of a compound's defeat line and blurb: neither form is a
// compound, and the finale starts again from its first form on the next
// attempt, which this says in the narrator's voice. A fall to the first stage
// keeps the compound-keyed line, for whichever real compound the Adapted was
// wearing when it landed the blow.
export const FINALE_DEFEAT_LINE =
  'It has you again. What you tried is in the record now, with everything else, and the pass holds. Nothing here anneals and nothing here is freed. Walk back in, from the first form, and bring it something it has not seen.';

export const FINALE_DEFEAT_LINE_BRIEF =
  'It has you again, and the pass holds. Nothing here anneals. Walk back in, from the first form, with something it has not seen.';

export function finaleDefeatLineFor(length: StoryLength): string {
  return length === 'brief' ? FINALE_DEFEAT_LINE_BRIEF : FINALE_DEFEAT_LINE;
}

export function finaleStageFor(stage: 2 | 3, length: StoryLength): FinaleStage {
  return length === 'brief' ? FINALE_STAGES_BRIEF[stage] : FINALE_STAGES[stage];
}

export function finaleVictoryLineFor(length: StoryLength): string {
  return length === 'brief' ? FINALE_VICTORY_LINE_BRIEF : FINALE_VICTORY_LINE;
}

// The text a story screen reads, picked by the Text Length setting, falling
// back to the Detailed text when no Brief one exists.
export function storyBeatFor(world: number, length: StoryLength): string | undefined {
  return (length === 'brief' ? STORY_BEATS_BRIEF[world] : undefined) ?? STORY_BEATS[world];
}

export function finaleBodyFor(length: StoryLength): string {
  return length === 'brief' ? FINALE_BODY_BRIEF : FINALE_BODY;
}
