import { worldName } from './materials';
import { STORY_BEATS, WORLD_GOAL_TEXT, FINALE_TITLE, FINALE_BODY } from './story';
import { WORLD_LORE, RIVAL_TAUNTS } from './worldLore';
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
// `STORY_LOG`'s own declaration order is the chronology: the premise, then
// each world's three chapters in the order that world plays them, then the
// ending. A new beat is added by declaring it at the point of the
// playthrough that reveals it.
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
export type StoryUnlock =
  | { kind: 'tip'; id: TutorialTipId }
  | { kind: 'lore'; world: number }
  | { kind: 'rival'; world: number };

// A world's three chapters: the history it opens with, the Decoherence's
// attack on that history, and the pass at its far end -- goal line, the
// rival's two-part boast, and the beat that carries the player onward, in the
// order the world plays them. `decoherence`/`pass` name the second and third
// chapters; worlds 1-9 keep the defaults, and World 10's own two are its
// reveal and the mirror standing at the end of it rather than one more
// world's physics under attack.
function worldChapters(world: number, titles?: { decoherence?: string; pass?: string }): StoryEntry[] {
  const lore = WORLD_LORE[world]!;
  const taunt = RIVAL_TAUNTS[world]!;
  const decoherence = titles?.decoherence ?? 'The Decoherence';
  const pass = titles?.pass ?? 'The Pass';
  const name = worldName(world);
  const passBody = [WORLD_GOAL_TEXT[world], taunt.part1, taunt.part2, STORY_BEATS[world]].filter(
    (part): part is string => !!part
  );
  const row = (chapter: string) => `${world}. ${chapter.replace(/^The /, '')}`;
  return [
    { title: name, listLabel: row(name), body: lore.page1, unlock: { kind: 'lore', world } },
    { title: `${name}: ${decoherence}`, listLabel: row(decoherence), body: lore.page2, unlock: { kind: 'lore', world } },
    { title: `${name}: ${pass}`, listLabel: row(pass), body: passBody.join('\n\n'), unlock: { kind: 'rival', world } },
  ];
}

export const STORY_LOG: StoryEntry[] = [
  {
    title: 'A Decoherence Is Spreading',
    listLabel: 'The Premise',
    body: TUTORIAL_TIPS.lab.body,
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
  ...worldChapters(10, { decoherence: 'The Reveal', pass: 'The Adapted' }),
  {
    title: FINALE_TITLE,
    listLabel: 'The Ending',
    body: FINALE_BODY,
    // The finale panel fires on the last built world's rival falling, so the
    // ending and World 10's own pass chapter open together.
    unlock: { kind: 'rival', world: 10 },
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
    }
    return { entry, reached: superposition || reached };
  });
}
