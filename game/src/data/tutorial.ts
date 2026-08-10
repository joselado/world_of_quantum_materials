// Tutorial popup content (DESIGN.md's onboarding pass): shown as a
// multi-page sequence the first time OverworldScene is ever created
// (OverworldScene.maybeShowFirstTimeTutorial), and replayable any time after
// via the Enter-menu's "Tutorial" button (OverworldScene.showTutorial). Kept
// as plain data so the copy can be edited without touching the panel/paging
// code in OverworldScene.
export interface TutorialPage {
  title: string;
  body: string;
}

export const TUTORIAL_PAGES: TutorialPage[] = [
  {
    title: 'Welcome to the Quantum Materials RPG',
    body:
      'A Decoherence is spreading through the material worlds. You are not a trainer catching creatures -- you are a crystal yourself, walking these worlds to master every phase of matter and stabilize it.',
  },
  {
    title: 'Walking the Path',
    body:
      'Use the arrow keys to move: Up/Down walk the corridor forward and back, Left/Right step sideways. Off-path tiles are solid walls, so track the corridor as it bends instead of holding one direction.',
  },
  {
    title: 'Wild Encounters',
    body:
      'Walking into a wild crystal opens a dialogue. Many ask a short physics question -- answer correctly for a power boost this battle, wrong for a penalty, or choose "Let me pass" to skip the fight with no consequence either way.',
  },
  {
    title: 'Battles',
    body:
      'Battles are turn-based -- whichever side has higher Velocity swings first each round. Pick a move from the panel on the right; every move is a real quasiparticle, and some are strong or weak against certain material types.',
  },
  {
    title: 'Qumatokens',
    body:
      'Winning battles and finding qumatoken pickups (the shiny clouds waiting at the dead ends of side paths) earns you qumatokens -- the currency mentors use to sell you new moves and sharper stats.',
  },
  {
    title: 'Mentors',
    body:
      "Each world's mentor waits partway along the corridor: Noether sells moves and stat upgrades, Bloch teleports you between worlds you've visited, Bohr lets you transmute into any crystal you've defeated. Once met, revisit any of them from the Advisors panel.",
  },
  {
    title: 'Reaching the Goal',
    body:
      "A gigantic boss crystal guards the far end of every world -- you can shop with that world's mentor first, but the only way onward is to beat the boss in the goal panel. Win, and the next world opens up.",
  },
  {
    title: 'The Lab',
    body:
      'Press H any time to return to World 0, the Lab. There you will find the Materialdex, a running catalog of every crystal you have discovered, and a Save Point to lock in your progress.',
  },
  {
    title: 'The Menu',
    body:
      'Press Enter any time to open the menu -- check your moves and stats, revisit your advisors, or replay this tutorial from the Tutorial button. Press M any time to mute or unmute the music.',
  },
];
