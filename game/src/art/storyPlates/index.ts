import Phaser from 'phaser';
import type { PlatePainter } from './brush';
import { makeSlabPlate } from './slab';
import { PLATES as ARC } from './arc';
import { PLATES as WORLD_1 } from './world1';
import { PLATES as WORLD_2 } from './world2';
import { PLATES as WORLD_3 } from './world3';
import { PLATES as WORLD_4 } from './world4';
import { PLATES as WORLD_5 } from './world5';
import { PLATES as WORLD_6 } from './world6';
import { PLATES as WORLD_7 } from './world7';
import { PLATES as WORLD_8 } from './world8';
import { PLATES as WORLD_9 } from './world9';
import { PLATES as WORLD_10 } from './world10';

// The picture that heads a chapter at the Lab's Story station
// (scenes/panels/hubStations.ts's showStoryLog): a painting on a slab of rock
// wall, the way the oldest stories were kept. A rough-edged piece of stone,
// mottled and cracked, and on it a few earth pigments put on by hand: red
// ochre, yellow ochre, charcoal, chalk, and one earth in the hue the chapter's
// own world owns (WORLDS.md section 3). Strokes wobble, washes are thin enough
// for the rock to show through, and the paint is worn where the wall has
// flaked. Nothing is ruled, shaded or drawn in perspective.
//
// A plate is wide and low and reads left to right as time, which is the shape
// of the pane it sits in and of the text under it: what was, the event, what
// came of it.
//
// A plate shows a place and a mechanism. Only two bodies are ever painted:
// a golem standing in its pass, before it falls, and the crystal that walks
// these worlds, as a chalk lozenge (brush.ts). A release plate shows the
// mechanism restored and no body, since the freed material never lingers as a
// figure in the pass (WORLDS.md section 6). The swamp's water never shows a
// likeness, and the voice past the map is never painted: where it speaks,
// the rock stays bare. A plate keeps to its world's light as well: the rock
// darkens along the road (slab.ts), and no sun is painted for a world that
// has none.
//
// Every wobble is drawn from a generator seeded by the plate's id, so a plate
// is the same picture every time it is opened.
//
// Keyed by the chapter's `plate` id (data/storyLog.ts): `<world>-<chapter>`
// for a world's chapters, a bare word for the chapters that belong to no one
// world. The painters live one file per world beside this one, the brushes
// they share in brush.ts and the rock in slab.ts. A chapter with no painter
// shows no picture, and its text takes the whole pane.

export { STORY_PLATE_W, STORY_PLATE_H } from './slab';

const PLATE_PAINTERS: Record<string, PlatePainter> = {
  ...ARC,
  ...WORLD_1,
  ...WORLD_2,
  ...WORLD_3,
  ...WORLD_4,
  ...WORLD_5,
  ...WORLD_6,
  ...WORLD_7,
  ...WORLD_8,
  ...WORLD_9,
  ...WORLD_10,
};

// Which world's light a plate's rock is seen in (slab.ts): the world its id
// starts with. The premise is told in the Lab, world 0; the ending and the
// after-story are told from World 10's cliff.
export function storyPlateWorld(id: string): number {
  const world = parseInt(id, 10);
  if (!Number.isNaN(world)) return world;
  return id === 'premise' ? 0 : 10;
}

export function storyPlateIds(): string[] {
  return Object.keys(PLATE_PAINTERS);
}

// The plate for a chapter, drawn with its top-left corner at the container's
// origin, or undefined when the chapter has none.
export function makeStoryPlate(scene: Phaser.Scene, id: string | undefined): Phaser.GameObjects.Container | undefined {
  const paint = id ? PLATE_PAINTERS[id] : undefined;
  if (!id || !paint) return undefined;
  return makeSlabPlate(scene, id, paint, storyPlateWorld(id));
}
