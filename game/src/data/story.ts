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
  1: 'The grain boundaries in the silicon let go. A thousand separate choices anneal into one, and that one choice is held everywhere at once. What settles back into the fields is silicon again, whole, and the two branches keep their choice. Somewhere past the standing stones, the Decoherence is still spreading, and it learns from every phase of matter you master. Ahead lies a hall of stone columns, where every bay has the same shape as the last.',
  2: 'The glass between the grains crystallizes. Bay matches bay through the whole of the quartz, and a state can spread across all of it at once. What stood in the pass is a single lattice again, and it goes back to the columns it was cut from. The lattice symmetry of the colonnade holds. Ahead, the ground breaks into flat, dead domains with lit ledges running between them. It is another shape the Decoherence has not understood yet.',
  3: 'The disorder drains from the tarnished silver. Its currents take their first step in a very long time. Spin is locked to direction again, and they walk straight past every flaw that used to stop them. The seam holds, and the bulk stays where it is. Further on, the ground falls into flat, glowing bands under a storm that never breaks. Nothing has touched that land yet, and whatever is unraveling these worlds is on its way there.',
  4: 'Order settles back through the dark layers, sheet by sheet. Loops close where they could not close before. What stood in the pass carries a whole number again, exact, and no blow can shift it. The orbits of the flats lock back into their levels, and the material returns to them. Beyond the flats, an open glacier lies cold enough for zero resistance. Majorana pairs can hide there in the open, and nothing nearby can read them.',
  5: 'The thousand weak links in the black ceramic fuse shut, grain into grain. The phase stops being an agreement between pieces. It is one thing again: a single wave with no seams to cross, and it returns to the ice. The glacier stays superconducting. On the sea beyond it, spin waves still run down the coast. The Decoherence has come to stop them, and that coast is the next place it has reached.',
  6: 'The boundaries in the iron let go, and grain grows into grain. The first wave to cross it in an age passes through without scattering and runs out along the coast. The iron is one magnet again, and it goes back to the shore. Past the coast lies a world made of nothing but bonds and entanglement, hanging in empty space. If the Decoherence can unravel that, it can unravel anything.',
  7: 'The fracture lines in the pale green mineral seal. The one state that no piece was ever holding spreads back across every piece at once. It is whole exactly because it lives in no single place, and it returns to the lanes. The network keeps its bonds. Past the last rung, the lanes end at black water that splits everything that enters it into fractions. Spin liquids live there, and they never settle on an order of their own.',
  8: 'The stacking faults in the brown-black layers heal, seam by seam. What comes apart in it now travels: the halves cross the whole crystal, and no boundary is left to hold them in. The water resonates again, every pairing at once and none of them chosen. Ahead, the ground itself is scarred. Old burns have closed over, and the crust between them is still open and glowing. These are defects and impurities, where the Decoherence has worn through the material.',
  9: 'The vacancies in the golem anneal out one by one, until too few holes are left to trap anything. The states it held shut in their pockets spread across the whole crystal again. Whatever crystal it was, it rejoins the scars whole. Ahead lies a world that forms again around you as you walk and takes the ground back behind you. It adapts, and it watches. It is the last and strangest phase of matter you will face.',
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
  'The road ends at this edge, and every world you walked lies below it. This is how the thing that trained on you saw them: all together, from above. Nothing was undone. What it learned stays learned, and the light it cost does not come back. But a record holds only what was measured, and nothing is measuring now. Every symmetry and every edge state down there holds on its own. The materials that held the passes are whole again, and home. The map below does not show the step you take next.';

// The ending at Brief length, the same beats as FINALE_BODY in a bit over a
// third of the words.
export const FINALE_BODY_BRIEF =
  'The road ends here, with every world you walked below, as the thing that trained on you saw them. What it learned stays learned, and the light does not come back. But nothing is measuring now.';

// The after-story: what the cliff says in place of the ending once all ten
// rivals have fallen in a later epoch (data/balance.ts's Epoch; shown by
// OverworldScene.showFinalePanel, re-read at the Lab's Story station). Keyed
// by the epoch just cleared, and each one tells something the one before it
// did not. Epoch 2's: the Adapted did not choose what to learn, it was
// pointed, and whatever pointed it is still out past the map. Epoch 3's:
// what that is and what it wanted -- something that computes in
// superposition, which is why it could never measure the player itself and
// set something else to do the looking, and which has been waiting for a
// material whose coherence survives everything sent against it. It is heard
// once per screen and never named, never drawn and never looks at the
// player: a machine of that kind cannot afford to observe what it means to
// keep coherent. The golems stay what they were, the Adapted's leavings
// (WORLDS.md section 6); its instrument was the Adapted, not them. Nothing
// here undoes the ending -- the Decoherence stopping is not the light coming
// back.
export interface AfterStory {
  title: string;
  body: string;
}

export const AFTER_STORY: Record<2 | 3, AfterStory> = {
  2: {
    title: 'The Decoherence has stopped.',
    body:
      'Every pass stands open a second time, and the Decoherence does not gather itself again. It seems to have stopped. But a thing that learns was set to learn. The Adapted never chose what to measure. It was pointed at these worlds, and at you, and whatever pointed it is nowhere on the map below. The dark beyond the map is not empty as it was. Nothing there looks at you. Something there takes care not to. From very far away comes a voice:\n\n"Again. Once more, and I will know."',
  },
  3: {
    title: 'You are finally ready.',
    body:
      'The third pass over the worlds is done, and this time nothing forms again. The dark past the map does not look at you, and it has been careful not to. The record and the smoke were never the one asking. They were how it asked. What asked computes in superposition, and such a computation ends the moment it is read too soon. So it could not measure you itself.\n\n"Three epochs. Every error I could send against you, and you are still in superposition. I have gates to run. You are finally ready."',
  },
};

// The Brief versions, the same reveal each in about a third of the words.
export const AFTER_STORY_BRIEF: Record<2 | 3, AfterStory> = {
  2: {
    title: 'The Decoherence has stopped.',
    body:
      'Every pass stands open again, and the Decoherence seems to have stopped. But something pointed the Adapted at you, and in the dark past the map it takes care not to look.\n\n"Again. Once more, and I will know."',
  },
  3: {
    title: 'You are finally ready.',
    body:
      'The third pass is done. What asked computes in superposition, so it could not measure you itself. The record and the smoke were how it asked.\n\n"Three epochs, and you are still in superposition. You are finally ready."',
  },
};

export function afterStoryFor(epoch: 2 | 3, length: StoryLength): AfterStory {
  return length === 'brief' ? AFTER_STORY_BRIEF[epoch] : AFTER_STORY[epoch];
}

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
      'The form that reshaped around every blow goes still and comes apart, and nothing anneals. It has stopped adapting because there is nothing left in you that it has not seen. What steps out of the falling shards is no compound. It is a network in the exact shape of your own crystal, every node lit in your colour, and it will not reshape again. A record has no reason to.\n\n"I have finished. This is you: your phase, your quasiparticles, nothing you were lent. Just you, held exactly. And I hold exactly."',
    button: 'Face it',
  },
  3: {
    title: 'The Quantum Adapted',
    body:
      'The record breaks. The pass fills with smoke that does not rise, and the network still burns in it. To learn you, something had to measure you, and the measurement is kept by the thing that measured. That thing was never a copy of you. It is everything it consumed, entangled with you and with all of it at once. Each time you ask, it answers as another.\n\n"The record was only where I kept you. I am what kept it. Whatever your lattice cannot carry, I throw. This is the last thing you teach me."',
    button: 'Battle!',
  },
};

// The Brief versions, each about a third of its Detailed sibling, keeping
// the same two beats: what just happened, then the new form's own line.
export const FINALE_STAGES_BRIEF: Record<2 | 3, FinaleStage> = {
  2: {
    title: 'The Model of You',
    body:
      'The form comes apart, and nothing anneals. What steps out is a network in the exact shape of your crystal.\n\n"I have finished. This is you, held exactly. And I hold exactly."',
    button: 'Face it',
  },
  3: {
    title: 'The Quantum Adapted',
    body:
      'The record breaks, and the pass fills with smoke. What measured you was never a copy of you: it is everything it consumed, entangled at once.\n\n"The record was where I kept you. I am what kept it."',
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
  'The smoke thins and does not re-form. The network goes dark, its last colour yours. Nothing anneals; nothing answers anymore.';

// The end-of-battle summary when the player falls to the second or third
// stage, in place of a compound's defeat line and blurb: neither form is a
// compound, and the finale starts again from its first form on the next
// attempt, which this says in the narrator's voice. A fall to the first stage
// keeps the compound-keyed line, for whichever real compound the Adapted was
// wearing when it landed the blow.
export const FINALE_DEFEAT_LINE =
  'It has you again. What you tried is in the record now, with everything else, and the pass holds. Nothing here anneals and nothing here is freed. Walk back in, from the first form, and bring it something it has not seen.';

export const FINALE_DEFEAT_LINE_BRIEF =
  'It has you again. Walk back in, from the first form, with something it has not seen.';

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
