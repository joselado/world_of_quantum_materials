import { worldName } from './materials';
import { getEpochUnlocked, allRivalsFallen } from './epochs';
import { STORY_BEATS, WORLD_GOAL_TEXT, FINALE_TITLE, FINALE_BODY, FINALE_STAGES, AFTER_STORY } from './story';
import { WORLD_LORE, RIVAL_TAUNTS, worldLoreScreens } from './worldLore';
import { TUTORIAL_TIPS } from './tutorial';
import type { TutorialTipId } from './tutorial';

// The Decoherence arc, collected in the order a playthrough delivers it, for
// the Lab's Story station (scenes/panels/hubStations.ts's showStoryLog). This
// module authors no story copy of its own: every body below is assembled from
// the surfaces that already carry it -- the opening the Lab itself gives
// (data/tutorial.ts's `lab` page), each world's two-page entry history
// (data/worldLore.ts's WORLD_LORE), its goal-tile line and rival taunt and
// the beat that follows the win (WORLD_GOAL_TEXT/RIVAL_TAUNTS/STORY_BEATS),
// and the ending (data/story.ts's FINALE_TITLE/FINALE_BODY) -- so re-reading
// a beat here and meeting it in play can never drift apart.
//
// It always reads the Detailed tables, whatever the Settings station's Text
// Length row says. The screens in play follow that row; this station is where
// the full text lives, the same way it keeps what Story Screens Off skips, so
// a player on Brief loses nothing by it.
//
// `STORY_LOG`'s own declaration order is the chronology: the premise, then
// each world's chapters in the order that world plays them (four per world;
// World 10 carries six: its reveal split in two, its pass, and the two
// screens between its finale's three stages, and no release), then the
// ending and the two after-story chapters. A new beat is added by declaring
// it at the point of the playthrough that reveals it.
//
// Bloch's destination blurbs (data/worldFlavor.ts) and each guardian's own
// intro quote are deliberately absent: neither is arc content -- the first is
// plain physics for a world being previewed, the second is a guardian
// teaching their own mechanic, which the Lab's Tutorial station already
// covers and their own avatar in the room reopens.
export interface StoryEntry {
  title: string;
  // Short label for the Story station's left-hand list column, which is only
  // 200px wide (scenes/panels/listDetail.ts's `listDetailColumns`) and trims
  // an overlong row to an ellipsis rather than wrapping it (`fitListLabel`).
  // Every chapter carries one: a full title names its world so the detail
  // pane stands on its own, while the list column reads as a numbered table
  // of contents, dropping the leading article that would otherwise cost
  // every row four characters of a column this narrow. Falls back to `title`
  // when omitted.
  listLabel?: string;
  body: string;
  // Which picture heads the chapter at the Story station (art/storyPlates.ts
  // keys its painters by this id). A chapter whose id has no painter shows
  // its text alone.
  plate: string;
  unlock: StoryUnlock;
}

// What the save must have reached for an entry to be readable. Each maps onto
// state the playthrough already persists (data/save.ts), so the station needs
// no progress field of its own:
//   - `tip`   the contextual popup that carries this beat has fired
//             (`tutorialTipsSeen`).
//   - `lore`  this world's entry lore screen has played (`worldLoreSeen`).
//   - `rival` this world's rival has been beaten (`rivalDefeated`). Also what
//             gates the pass chapter's taunt and goal line, which a player
//             meets a little earlier, on reaching the pass mouth -- nothing
//             persists that moment, and the whole pass sequence reads as one
//             chapter either way.
//   - `epoch` every rival has fallen in this epoch (data/epochs.ts): all ten
//             are down in it now, or a later epoch is unlocked, which it can
//             only be by this one having been cleared.
export type StoryUnlock =
  | { kind: 'tip'; id: TutorialTipId }
  | { kind: 'lore'; world: number }
  | { kind: 'rival'; world: number }
  | { kind: 'epoch'; epoch: 2 | 3 };

// A world's four chapters, in the order the world plays them: the history it
// opens with, the Decoherence's attack on that history, the pass at its far
// end (the goal line and the rival's two-part boast), and the release (the
// beat that follows the win and carries the player onward). The pass and the
// release are two chapters so that every chapter is about the same length:
// each is one screenful of the Story station's pane under its picture.
// `decoherence`/`pass` name the second and third chapters; worlds 1-9 keep
// the defaults, and World 10's own two are its reveal and the mirror standing
// at the end of it rather than one more world's physics under attack. A world
// with no beat (World 10, whose rival is not freed) has no release chapter.
function worldChapters(world: number, titles?: { decoherence?: string; pass?: string }): StoryEntry[] {
  const lore = WORLD_LORE[world]!;
  const taunt = RIVAL_TAUNTS[world]!;
  const beat = STORY_BEATS[world];
  const decoherence = titles?.decoherence ?? 'The Decoherence';
  const pass = titles?.pass ?? 'The Pass';
  const name = worldName(world);
  // The goal line runs on into the taunt's first part: both are the narrator
  // arriving at the pass, and a chapter is two paragraphs like every other.
  const goal = WORLD_GOAL_TEXT[world];
  const passBody = [goal ? `${goal} ${taunt.part1}` : taunt.part1, taunt.part2];
  const row = (chapter: string) => `${world}. ${chapter.replace(/^The /, '')}`;
  const chapters: StoryEntry[] = [
    { title: name, listLabel: row(name), body: lore.page1, plate: `${world}-history`, unlock: { kind: 'lore', world } },
    {
      title: `${name}: ${decoherence}`,
      listLabel: row(decoherence),
      body: lore.page2,
      plate: `${world}-decoherence`,
      unlock: { kind: 'lore', world },
    },
    {
      title: `${name}: ${pass}`,
      listLabel: row(pass),
      body: passBody.join('\n\n'),
      plate: `${world}-pass`,
      unlock: { kind: 'rival', world },
    },
  ];
  if (beat) {
    chapters.push({
      title: `${name}: The Release`,
      listLabel: row('Release'),
      body: beat,
      plate: `${world}-release`,
      unlock: { kind: 'rival', world },
    });
  }
  return chapters;
}

// World 10's page-2 reveal is four paragraphs, twice the length of every
// other lore page, and its re-read splits into two chapters at the page's own
// middle seam: the reveal itself (what has hunted you, and how it trained),
// then the measurement lesson the page closes on (what the teaching cost, and
// why nothing here can be freed). Each half is one chapter's length. The
// world-entry lore panel plays the same two halves as two screens
// (data/worldLore.ts's worldLoreScreens, which owns the seam), so re-reading
// and meeting the text in play cannot drift apart.
//
// The finale's own two later stages (data/story.ts's FINALE_STAGES, the
// screens BattleScene shows between the three fights) follow the pass
// chapter as chapters of their own, unlocked with it: nothing persists which
// stage a lost attempt reached, and the whole finale reads as one sequence
// either way.
function world10Chapters(): StoryEntry[] {
  const [history, reveal, pass] = worldChapters(10, { decoherence: 'The Reveal', pass: 'The Adapted' });
  const [, revealScreen, recordScreen] = worldLoreScreens(10, WORLD_LORE[10]!);
  const stage = (n: 2 | 3): StoryEntry => ({
    title: `${worldName(10)}: ${FINALE_STAGES[n].title}`,
    listLabel: `10. ${FINALE_STAGES[n].title.replace(/^The /, '')}`,
    body: FINALE_STAGES[n].body,
    plate: `10-stage${n}`,
    unlock: { kind: 'rival', world: 10 },
  });
  return [
    history,
    { ...reveal, body: revealScreen.paragraphs.join('\n\n'), plate: revealScreen.plate },
    {
      ...reveal,
      title: `${worldName(10)}: The Record`,
      listLabel: '10. Record',
      body: recordScreen.paragraphs.join('\n\n'),
      plate: recordScreen.plate,
    },
    pass,
    stage(2),
    stage(3),
  ];
}

export const STORY_LOG: StoryEntry[] = [
  {
    title: 'A Decoherence Is Spreading',
    listLabel: 'The Premise',
    body: TUTORIAL_TIPS.lab.body,
    plate: 'premise',
    unlock: { kind: 'tip', id: 'lab' },
  },
  ...worldChapters(1),
  ...worldChapters(2),
  ...worldChapters(3),
  ...worldChapters(4),
  ...worldChapters(5),
  ...worldChapters(6),
  ...worldChapters(7),
  ...worldChapters(8),
  ...worldChapters(9),
  ...world10Chapters(),
  {
    title: FINALE_TITLE,
    listLabel: 'The Ending',
    body: FINALE_BODY,
    plate: 'ending',
    // The finale panel opens at the pass once the last built world's rival
    // has fallen, so the ending and World 10's own pass and stage chapters
    // open together.
    unlock: { kind: 'rival', world: 10 },
  },
  // The after-story (data/story.ts's AFTER_STORY), one chapter per later
  // epoch, each readable once that epoch's ten rivals have all fallen.
  {
    title: AFTER_STORY[2].title,
    listLabel: 'After Epoch 2',
    body: AFTER_STORY[2].body,
    plate: 'after2',
    unlock: { kind: 'epoch', epoch: 2 },
  },
  {
    title: AFTER_STORY[3].title,
    listLabel: 'After Epoch 3',
    body: AFTER_STORY[3].body,
    plate: 'after3',
    unlock: { kind: 'epoch', epoch: 3 },
  },
];

// Minimal structural type (mirrors data/tutorial.ts's RegistryLike) so this
// stays a plain data module.
interface RegistryLike {
  get: (key: string) => unknown;
}

export interface StoryLogRow {
  entry: StoryEntry;
  reached: boolean;
}

// Every entry in STORY_LOG, each paired with whether the save has actually
// reached it. The whole arc is always listed, in chronological order -- an
// unreached chapter keeps its slot and is masked to "???" by the panel, the
// same checklist treatment Qumatex gives an undiscovered crystal, so the
// station shows how much road is left without saying what is on it.
// Superposition Mode reads everything, matching how it treats every guardian,
// passive and tutorial topic as unlocked from the moment the save exists.
//
// Reading a chapter here never marks it reached: nothing on this path writes
// `tutorialTipsSeen`/`worldLoreSeen`, so opening the premise can't suppress
// the Lab's own welcome popup and no chapter can unlock its neighbours.
export function storyLogIndex(registry: RegistryLike): StoryLogRow[] {
  const superposition = !!registry.get('superpositionMode');
  const tipsSeen = (registry.get('tutorialTipsSeen') as string[]) ?? [];
  const loreSeen = (registry.get('worldLoreSeen') as number[]) ?? [];
  const rivalDefeated = (registry.get('rivalDefeated') as Record<number, boolean>) ?? {};
  const epochUnlocked = getEpochUnlocked(registry);
  return STORY_LOG.map((entry) => {
    const unlock = entry.unlock;
    let reached: boolean;
    switch (unlock.kind) {
      case 'tip':
        reached = tipsSeen.includes(unlock.id);
        break;
      case 'lore':
        reached = loreSeen.includes(unlock.world);
        break;
      case 'rival':
        reached = !!rivalDefeated[unlock.world];
        break;
      case 'epoch':
        reached = epochUnlocked > unlock.epoch || (epochUnlocked === unlock.epoch && allRivalsFallen(registry, unlock.epoch));
        break;
    }
    return { entry, reached: superposition || reached };
  });
}
