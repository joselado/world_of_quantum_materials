// Tutorial content (DESIGN.md's onboarding pass). The first seven entries
// below are each shown once per save, the first time their own feature
// actually becomes relevant -- entering the Lab, taking your first steps,
// bumping into your first wild crystal, committing to your first fight,
// picking up your first qumatessence, meeting your first guardian, reaching
// your first goal (OverworldScene/HubScene's `showTutorialTip`/
// `maybeShowLabTip`) -- rather than one long paged popup dumped on the
// player before they've done anything. The rest cover a mechanic that's real
// and player-facing but has no single "first time this becomes relevant"
// moment worth interrupting play for (a guardian's own repeatable ability,
// the Lab's Settings station, the Story/Superposition Mode choice already
// made at the Title screen) -- they carry no contextual trigger and are only
// ever reached through the Tutorial station itself. `TUTORIAL_PAGES` is the
// same content in a fixed order (the seven contextual entries first, so the
// onboarding path still reads top to bottom), used by the Lab's Tutorial
// station (`scenes/panels/hubStations.ts`'s `showTutorialTopics`/
// `renderTutorialDetail`) as a list+detail panel: every topic's own title in
// a left-hand list, the selected one's full title/body in the right-hand
// pane. Kept as plain data so the copy can be edited without touching the
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
}

export type TutorialTipId =
  | 'lab'
  | 'controls'
  | 'encounter'
  | 'battle'
  | 'qumatessence'
  | 'guardian'
  | 'goal'
  | 'analyticUltimate'
  | 'moveLeveling'
  | 'passives'
  | 'statusEffects'
  | 'hybridFusion'
  | 'transmutation'
  | 'hostDoping'
  | 'teleport'
  | 'settings'
  | 'modes';

export const TUTORIAL_TIPS: Record<TutorialTipId, TutorialPage> = {
  lab: {
    title: 'Welcome to the Quantum Materials RPG',
    listLabel: 'Welcome',
    body:
      'A Decoherence is spreading through the material worlds. You are not a trainer catching creatures -- you are a crystal yourself, walking these worlds to master every phase of matter and stabilize it. This room is the Lab: Qumatex catalogs every crystal you discover, and the door leads to your first world. Your progress autosaves as you play, no button needed.',
  },
  controls: {
    title: 'Walking the Path',
    body:
      'Use the arrow keys to move: Up/Down step forward and back, Left/Right step sideways. Off-path ground is impassable -- told apart by its color, not by a wall you\'d see -- so watch where the walkable ground actually goes rather than holding one direction blindly. Press H or Enter any time to return to the Lab -- your moves, stats, abilities, tutorial, and settings all live as stations there, and every guardian you have met stands in the room to be clicked -- and M to mute or unmute the music.',
  },
  encounter: {
    title: 'Wild Encounters',
    body:
      'Walking into a wild crystal opens a dialogue. Many ask a short physics question -- answer correctly for a power boost this battle, wrong for a penalty, or choose "Let me pass" to skip the fight with no consequence either way.',
  },
  battle: {
    title: 'Battles',
    body:
      'Battles are turn-based -- whichever side has higher Velocity swings first each round. Pick a move from the panel on the right; every move is a real quasiparticle, and a defender with no natural way to host it takes double damage.',
  },
  qumatessence: {
    title: 'Qumatessence',
    body:
      'Winning battles and finding qumatessence pickups (the shiny clouds usually tucked at the end of a side path) earns you qumatessence -- the currency guardians use to sell you new moves and sharper stats.',
  },
  guardian: {
    title: 'Guardians',
    body:
      "Each world's guardian waits partway along the corridor: Noether sells moves and stat upgrades, Bloch teleports you between worlds you've visited, Dresselhaus lets you transmute into any crystal you've defeated. Once met, a guardian stands in the Lab -- click them there to reopen their panel any time.",
  },
  goal: {
    title: 'Reaching the Goal',
    body:
      "A gigantic boss crystal guards the far end of every world -- you can shop with that world's guardian first, but the only way onward is to beat the boss in the goal panel. Win, and the next world opens up.",
  },
  analyticUltimate: {
    title: 'Analytic & Ultimate Moves',
    listLabel: 'Analytic/Ultimate',
    body:
      "Laughlin (World 4) and Skłodowska-Curie (World 10) each sell two quiz-gated moves, tuned to whichever quasiparticle your current crystal form can host -- retune to a different hostable class any time you revisit them, free after the first time. In battle, one of Laughlin's Analytic moves asks a single physics question before it lands: answer right and the hit lands much harder, wrong and it barely lands at all. One of Skłodowska-Curie's Ultimate moves asks a whole streak of questions instead -- get every one right for the move's full force, miss even one and it does nothing that turn.",
  },
  moveLeveling: {
    title: "Feynman's Move Leveling",
    listLabel: 'Move Leveling',
    body:
      "Feynman (World 7) can level up any move you've already learned, from any guardian, through three tiers -- Double, Triple, and Infinite -- each hitting harder than the last. Picking a move spends qumatessence immediately, win or lose, then opens a streak of physics questions: answer every one right in a row and the move levels up for good; miss a single one and the attempt is lost, though the move stays exactly as strong as before. Each tier asks for a longer correct streak than the one before it.",
  },
  passives: {
    title: 'Passive Abilities',
    body:
      "Franklin (World 9) teaches passive abilities instead of moves -- once bought, a passive isn't chosen from the move menu each turn, it's simply active for a whole battle, working automatically in the background. Buy as many as you like, but only one can be active at a time; switch which one by revisiting Franklin, or check your current loadout any time from the Lab's Abilities station.",
  },
  statusEffects: {
    title: 'Status Effects',
    body:
      "Kondo (World 8) sells three self-buff techniques, each usable from any crystal form since they aren't tied to a quasiparticle at all. Casting one costs a turn like any move, then holds for several turns after: one shields you from incoming damage, one gives incoming hits a chance to miss you entirely, one heals you back a little each turn. Only one can be active in battle at a time -- switch which by revisiting Kondo -- and a pill under your HP bar shows the effect and how many turns it has left.",
  },
  hybridFusion: {
    title: 'Hybrid Fusion',
    body:
      "Majorana (World 5) fuses two crystals you've already defeated into a genuinely new hybrid material, and you become it the moment you fuse. Not every pairing fuses into something real -- browse by result to see which hybrids your current roster of defeated crystals can actually reach. Each hybrid result costs qumatessence to unlock the first time you fuse into it; every later fusion into that same result is free.",
  },
  transmutation: {
    title: 'Transmutation',
    body:
      "Dresselhaus (World 3) lets you rebuild your own crystal into any other crystal you've already defeated -- same atoms, different nanostructure, so you inherit that form's whole moveset and quasiparticle physics for as long as you wear it. Your HP still comes from the world you're in, not from which form you're wearing. Each crystal costs qumatessence to unlock the first time you become it; switching back and forth after that is free.",
  },
  hostDoping: {
    title: 'Doping In an Impurity',
    listLabel: 'Doping In',
    body:
      "Anderson (World 6) lets you dope in a crystal you've encountered as an impurity, without becoming it -- browsing hosts costs nothing. Committing to one opens a second step: pick one specific move from that host's own moveset to learn, spending qumatessence to do it. Only one impurity is doped in at a time; swapping to a different host doesn't erase a move you've already learned, it just changes which moves besides your own form's are currently usable.",
  },
  teleport: {
    title: 'Teleportation',
    body:
      "Bloch (World 2) instantly folds you to any world you've already visited -- pure travel, no new power gained. Reach him mid-corridor or, once you've met him, click his avatar in the Lab to reopen his panel any time. Each destination costs qumatessence to unlock the first time you travel there; every later trip to that same world is free.",
  },
  settings: {
    title: 'Settings',
    body:
      "The Lab's Settings station holds four knobs. Enemy Density controls how many wild encounters the next map you generate will have. Text Size and Music Style both apply immediately to whatever's already on screen. Difficulty scales every stat your opponents get, from an easier B.Sc. tier through the tuned M.Sc. default to a much tougher Ph.D. tier -- and unlike the other three, it applies starting with your very next battle, so it's meant to be adjusted mid-playthrough, not just picked once.",
  },
  modes: {
    title: 'Story Mode vs. Superposition Mode',
    listLabel: 'Game Modes',
    body:
      "You pick one of two modes at the Title screen before starting, each keeping its own separate save. Story Mode is the intended playthrough: start at World 1, defeat each world's rival to open the next one, and meet guardians as you actually reach them. Superposition Mode is a testing/exploration mode, not a first playthrough -- every guardian, transmutation, hybrid, and move is unlocked and every stat maxed out from the moment the save exists, and opponents draw from a flat, tier-scaled challenge instead of climbing world by world.",
  },
};

// Same tips, fixed display order, for the Lab's Tutorial station --
// object key order is insertion order for string keys, so this just mirrors
// how TUTORIAL_TIPS was written above (the seven contextual entries first).
export const TUTORIAL_PAGES: TutorialPage[] = Object.values(TUTORIAL_TIPS);

// Minimal structural type (mirrors data/save.ts's RegistryLike) so this
// stays a plain data module.
interface RegistryLike {
  get: (key: string) => unknown;
  set: (key: string, value: unknown) => void;
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
