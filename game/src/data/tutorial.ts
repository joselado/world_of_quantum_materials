// Tutorial content (DESIGN.md's onboarding pass). Each tip is shown once per
// save, the first time its own feature actually becomes relevant -- entering
// the Lab, taking your first steps, bumping into your first wild crystal,
// committing to your first fight, picking up your first qumatessence, meeting
// your first guardian, reaching your first goal (OverworldScene/HubScene's
// `showTutorialTip`/`maybeShowLabTip`) -- rather than one long paged popup
// dumped on the player before they've done anything. `TUTORIAL_PAGES` is the
// same content in a fixed order, still used for the Enter-menu's "Tutorial"
// button, which replays the whole set as one paged recap on demand
// (OverworldScene.showTutorial). Kept as plain data so the copy can be
// edited without touching the panel/paging/trigger code.
export interface TutorialPage {
  title: string;
  body: string;
}

export type TutorialTipId = 'lab' | 'controls' | 'encounter' | 'battle' | 'qumatessence' | 'guardian' | 'goal';

export const TUTORIAL_TIPS: Record<TutorialTipId, TutorialPage> = {
  lab: {
    title: 'Welcome to the Quantum Materials RPG',
    body:
      'A Decoherence is spreading through the material worlds. You are not a trainer catching creatures -- you are a crystal yourself, walking these worlds to master every phase of matter and stabilize it. This room is the Lab: the Materialdex catalogs every crystal you discover, the Save Point locks in your progress, and the door leads to your first world.',
  },
  controls: {
    title: 'Walking the Path',
    body:
      'Use the arrow keys to move: Up/Down walk the corridor forward and back, Left/Right step sideways. Off-path tiles are solid walls, so track the corridor as it bends instead of holding one direction. Press H any time to return to the Lab, Enter to open the menu (moves, stats, guardians), and M to mute or unmute the music.',
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
      'Winning battles and finding qumatessence pickups (the shiny clouds waiting at the dead ends of side paths) earns you qumatessence -- the currency guardians use to sell you new moves and sharper stats.',
  },
  guardian: {
    title: 'Guardians',
    body:
      "Each world's guardian waits partway along the corridor: Noether sells moves and stat upgrades, Bloch teleports you between worlds you've visited, Dresselhaus lets you transmute into any crystal you've defeated. Once met, revisit any of them from the Guardians panel.",
  },
  goal: {
    title: 'Reaching the Goal',
    body:
      "A gigantic boss crystal guards the far end of every world -- you can shop with that world's guardian first, but the only way onward is to beat the boss in the goal panel. Win, and the next world opens up.",
  },
};

// Same tips, fixed display order, for the Enter-menu's "Tutorial" button --
// object key order is insertion order for string keys, so this just mirrors
// how TUTORIAL_TIPS was written above.
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
