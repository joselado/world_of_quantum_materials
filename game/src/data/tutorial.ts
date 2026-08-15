// Tutorial content (DESIGN.md's onboarding pass). Every topic in the game
// lives in `TUTORIAL_TIPS` below, and the record's own declaration order is
// the canonical order the game reveals them in -- a fresh save meets them
// top to bottom, so the Lab's Tutorial station can list them in this order
// unchanged and a new topic just gets declared at the point of the
// playthrough that reveals it.
//
// Each entry's `unlock` says what reveals it, which is also what the
// Tutorial station gates on in Story Mode:
//   - `{ kind: 'tip' }`   a contextual popup that fires once per save the
//                         first time its own feature becomes relevant
//                         (OverworldScene's `showTutorialTip`, HubScene's
//                         `maybeShowLabTip`), rather than one long paged
//                         popup dumped on the player up front.
//   - `{ kind: 'guardian' }` a mechanic that belongs to one guardian's own
//                         repeatable panel, with no single "first time this
//                         becomes relevant" moment worth interrupting play
//                         for -- revealed by meeting that guardian
//                         (registry `metGuardians`), read in their panel
//                         rather than as a popup.
//   - `{ kind: 'always' }` something true of the save from the moment it
//                         exists (the mode picked at the Title screen, the
//                         Lab's Settings station).
//
// `visibleTutorialPages` applies that gate; Superposition Mode shows every
// topic, matching how it treats guardians and passives as unlocked from the
// start. Kept as plain data so the copy can be edited without touching the
// panel/paging/trigger code.
export interface TutorialPage {
  title: string;
  // Short label for the Tutorial station's left-hand list column, which is
  // only 200px wide (scenes/panels/listDetail.ts's `listDetailColumns`) and
  // trims an overlong row to an ellipsis rather than wrapping it
  // (`fitListLabel`) -- a handful of titles below read fine at full length
  // in the wide detail pane but would collapse to a near-identical trimmed
  // prefix as a list row, so those carry their own shorter `listLabel`
  // instead. Falls back to `title` when omitted.
  listLabel?: string;
  body: string;
  unlock: TutorialUnlock;
}

export type TutorialUnlock =
  | { kind: 'tip' }
  // `ids` are `OverworldScene.WORLD_GUARDIANS` ids; meeting any one of them
  // is enough, since a topic can cover two guardians' takes on the same
  // mechanic and either one can be reached first.
  | { kind: 'guardian'; ids: string[] }
  | { kind: 'always' };

export type TutorialTipId =
  | 'lab'
  | 'modes'
  | 'settings'
  | 'controls'
  | 'encounter'
  | 'battle'
  | 'qumatessence'
  | 'guardian'
  | 'goal'
  | 'teleport'
  | 'transmutation'
  | 'analyticMoves'
  | 'hybridFusion'
  | 'hostDoping'
  | 'moveLeveling'
  | 'statusEffects'
  | 'passives'
  | 'ultimateMoves';

export const TUTORIAL_TIPS: Record<TutorialTipId, TutorialPage> = {
  lab: {
    title: 'Welcome to the Quantum Materials RPG',
    listLabel: 'Welcome',
    unlock: { kind: 'tip' },
    body:
      'A Decoherence is spreading through the quantum material worlds. You are a crystal yourself, walking these worlds to master every phase of matter and stabilize it. This room is the Lab: Qumatex catalogs every crystal you discover, and the door leads to your first world. Your progress autosaves as you play, no button needed.',
  },
  modes: {
    title: 'Story Mode vs. Superposition Mode',
    listLabel: 'Game Modes',
    unlock: { kind: 'always' },
    body:
      "You pick one of two modes at the Title screen before starting, each keeping its own separate save. Story Mode is the intended playthrough: start at World 1, defeat each world's rival to open the next one, and meet guardians as you actually reach them. Superposition Mode is a testing/exploration mode, not a first playthrough -- every guardian, transmutation, hybrid, and move is unlocked and every stat maxed out from the moment the save exists, and opponents draw from a flat, tier-scaled challenge instead of climbing world by world.",
  },
  settings: {
    title: 'Settings',
    unlock: { kind: 'always' },
    body:
      "The Lab's Settings station holds four knobs. Enemy Density controls how many wild encounters the next map you generate will have. Text Size and Music Style both apply immediately to whatever's already on screen. Difficulty scales every stat your opponents get, from an easier B.Sc. tier through the tuned M.Sc. default to a much tougher Ph.D. tier -- and unlike the other three, it applies starting with your very next battle, so it's meant to be adjusted mid-playthrough, not just picked once.",
  },
  controls: {
    title: 'Walking the Path',
    unlock: { kind: 'tip' },
    body:
      'Use the arrow keys to move: Up/Down step forward and back, Left/Right step sideways. Off-path ground is impassable -- told apart by its color, not by a wall you\'d see -- so watch where the walkable ground actually goes rather than holding one direction blindly. Press H or Enter any time to return to the Lab -- your moves, stats, abilities, tutorial, and settings all live as stations there, and every guardian you have met stands in the room to be clicked -- and M to mute or unmute the music.',
  },
  encounter: {
    title: 'Wild Encounters',
    unlock: { kind: 'tip' },
    body:
      'Walking into a wild crystal opens a dialogue. Many ask a short physics question -- answer correctly for a power boost this battle, wrong for a penalty, or choose "Let me pass" to skip the fight with no consequence either way.',
  },
  battle: {
    title: 'Battles',
    unlock: { kind: 'tip' },
    body:
      'Battles are turn-based -- whichever side has higher Momentum swings first each round. Pick a move from the panel on the right; every move is a real quasiparticle, and a defender with no natural way to host it takes double damage.',
  },
  qumatessence: {
    title: 'Qumatessence',
    unlock: { kind: 'tip' },
    body:
      'Winning battles and finding qumatessence pickups (the shiny clouds usually tucked at the end of a side path) earns you qumatessence -- the currency guardians use to sell you new moves and sharper stats.',
  },
  guardian: {
    title: 'Guardians',
    unlock: { kind: 'tip' },
    body:
      "Each world's guardian waits partway along the corridor: Noether sells moves and stat upgrades, Bloch teleports you between worlds you've visited, Dresselhaus lets you transmute into any crystal you've defeated. Once met, a guardian stands in the Lab -- click them there to reopen their panel any time.",
  },
  goal: {
    title: 'Reaching the Goal',
    unlock: { kind: 'tip' },
    body:
      "Every world narrows into a pass at its far end, and a gigantic boss crystal stands in it, holding the way. You can shop with that world's guardian first -- but nothing happens just by walking up. Step to the mouth of the pass and press Space to challenge it. Win, and the pass clears: the next world shows through the gap, a board names it, and pressing Space there again takes you across.",
  },
  teleport: {
    title: 'Teleportation',
    unlock: { kind: 'guardian', ids: ['bloch'] },
    body:
      "Bloch (World 2) instantly folds you to any world you've already visited -- pure travel, no new power gained. Reach him mid-corridor or, once you've met him, click his avatar in the Lab to reopen his panel any time. Each destination costs qumatessence to unlock the first time you travel there; every later trip to that same world is free.",
  },
  transmutation: {
    title: 'Transmutation',
    unlock: { kind: 'guardian', ids: ['dresselhaus'] },
    body:
      "Dresselhaus (World 3) lets you rebuild your own crystal into any other crystal you've already defeated -- same atoms, different nanostructure, so you inherit that form's whole moveset and quasiparticle physics for as long as you wear it. Your HP still comes from the world you're in, not from which form you're wearing. Each crystal costs qumatessence to unlock the first time you become it; switching back and forth after that is free.",
  },
  analyticMoves: {
    title: 'Analytic Moves',
    unlock: { kind: 'guardian', ids: ['landau'] },
    body:
      "Landau (World 4) sells two quiz-gated Analytic moves, each carrying whichever quasiparticle your current crystal form can host -- buying one costs qumatessence once, and retuning it to a different hostable class any time you revisit him is free. In battle, an Analytic move asks a single physics question before it lands: answer right and the hit lands much harder, wrong and it barely lands at all.",
  },
  hybridFusion: {
    title: 'Hybrid Fusion',
    unlock: { kind: 'guardian', ids: ['majorana'] },
    body:
      "Majorana (World 5) fuses two crystals you've already defeated into a genuinely new hybrid material, and you become it the moment you fuse. Not every pairing fuses into something real -- browse by result to see which hybrids your current roster of defeated crystals can actually reach. Each hybrid result costs qumatessence to unlock the first time you fuse into it; every later fusion into that same result is free.",
  },
  hostDoping: {
    title: 'Doping In an Impurity',
    listLabel: 'Doping In',
    unlock: { kind: 'guardian', ids: ['anderson'] },
    body:
      "Anderson (World 6) lets you dope in a crystal you've encountered as an impurity, without becoming it -- browsing hosts costs nothing. Committing to one opens a second step: pick one specific move from that host's own moveset to learn, spending qumatessence to do it. Only one impurity is doped in at a time; swapping to a different host doesn't erase a move you've already learned, it just changes which moves besides your own form's are currently usable.",
  },
  moveLeveling: {
    title: "Feynman's Move Leveling",
    listLabel: 'Move Leveling',
    unlock: { kind: 'guardian', ids: ['feynman'] },
    body:
      "Feynman (World 7) can level up any move you've already learned, from any guardian, through three tiers -- Double, Triple, and Infinite -- each hitting harder than the last. Picking a move spends qumatessence immediately, win or lose, then opens a streak of physics questions: answer every one right in a row and the move levels up for good; miss a single one and the attempt is lost, though the move stays exactly as strong as before. Each tier asks for a longer correct streak than the one before it.",
  },
  statusEffects: {
    title: 'Status Effects',
    unlock: { kind: 'guardian', ids: ['kondo'] },
    body:
      "Kondo (World 8) sells three self-buff techniques, each usable from any crystal form since they aren't tied to a quasiparticle at all. Casting one costs a turn like any move, then holds for several turns after: one shields you from incoming damage, one gives incoming hits a chance to miss you entirely, one heals you back a little each turn. Only one can be active in battle at a time -- switch which by revisiting Kondo -- and a pill under your HP bar shows the effect and how many turns it has left.",
  },
  passives: {
    title: 'Passive Abilities',
    unlock: { kind: 'guardian', ids: ['franklin'] },
    body:
      "Franklin (World 9) teaches passive abilities instead of moves -- once bought, a passive isn't chosen from the move menu each turn, it's simply active for a whole battle, working automatically in the background. Buy as many as you like, but only one can be active at a time; switch which one by revisiting Franklin, or check your current loadout any time from the Lab's Abilities station.",
  },
  ultimateMoves: {
    title: 'Ultimate Moves',
    unlock: { kind: 'guardian', ids: ['sklodowskaCurie'] },
    body:
      "Skłodowska-Curie (World 10) sells two quiz-gated Ultimate moves, far stronger than anything else in the game and priced per quasiparticle: for each move, picking a class your form can host costs a large sum of qumatessence the first time, and also puts the move in your battle menu; retuning to a class you've already paid for is free. In battle an Ultimate move asks three physics questions in a row -- all correct for its full force, miss one and it does nothing that turn.",
  },
};

// Minimal structural type (mirrors data/save.ts's RegistryLike) so this
// stays a plain data module.
interface RegistryLike {
  get: (key: string) => unknown;
  set: (key: string, value: unknown) => void;
}

// Which topics the Lab's Tutorial station lists, in TUTORIAL_TIPS'
// declaration order (the order the game reveals them in). Story Mode shows
// only what the save has actually reached -- a topic the player hasn't been
// shown yet is absent from the list rather than listed locked, so the list
// filling in is itself part of the progression. Superposition Mode shows
// every topic, the same way it treats every guardian and passive as
// unlocked from the moment the save exists.
//
// Reading a topic here never marks it discovered: nothing on this path
// writes `tutorialTipsSeen`, so opening a page can't unlock its neighbours
// and can't suppress a contextual popup the player hasn't met yet.
export function visibleTutorialPages(registry: RegistryLike): TutorialPage[] {
  const entries = Object.entries(TUTORIAL_TIPS) as [TutorialTipId, TutorialPage][];
  if (registry.get('superpositionMode')) return entries.map(([, page]) => page);
  const met = (registry.get('metGuardians') as string[]) ?? [];
  return entries
    .filter(([id, page]) => {
      const unlock = page.unlock;
      switch (unlock.kind) {
        case 'always':
          return true;
        case 'tip':
          return hasSeenTip(registry, id);
        case 'guardian':
          return unlock.ids.some((guardianId) => met.includes(guardianId));
      }
    })
    .map(([, page]) => page);
}

export function hasSeenTip(registry: RegistryLike, id: TutorialTipId): boolean {
  const seen = (registry.get('tutorialTipsSeen') as string[]) ?? [];
  return seen.includes(id);
}

// Idempotent -- safe to call even if the tip's already marked seen.
export function markTipSeen(registry: RegistryLike, id: TutorialTipId): void {
  const seen = (registry.get('tutorialTipsSeen') as string[]) ?? [];
  if (seen.includes(id)) return;
  registry.set('tutorialTipsSeen', [...seen, id]);
}
