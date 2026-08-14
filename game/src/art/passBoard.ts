import Phaser from 'phaser';
import { STORY_LAVENDER } from '../ui/theme';

// The signboard standing in a cleared pass, naming the world on the other
// side of it (OverworldScene.spawnGateSprites) -- a road sign, which reads as
// one only because every world is named as a place.
//
// Scenery, not interface: the name is a Text *inside* the returned container,
// so it is projected and depth-scaled with the posts it is nailed to and is
// unreadably small from across the world, resolving into a caption only as
// the player walks up to it. A landmark label riding above the sprite at a
// fixed screen size would be legible from anywhere and would compete with the
// horizon reveal, which is the one thing the board must not do.

// Where the posts meet the ground, in multiples of the `size` passed below.
export const BOARD_FOOT = 1;
// A few degrees off square. A signpost planted in ground reads as planted
// partly because it is never quite plumb, and a perfectly axis-aligned
// rectangle of text is the one thing an interface plate always is.
const BOARD_LEAN = -2.5;

const PLANK_FILL = 0x4a3b2e;
const PLANK_TOP = 0x6a5641;
const PLANK_EDGE = 0x2a2018;
const POST_FILL = 0x3a2e24;

export function makePassBoard(scene: Phaser.Scene, size: number, destination: string): Phaser.GameObjects.Container {
  const container = scene.add.container(0, 0);

  // The plank is sized to the name rather than the name wrapped to a fixed
  // plank: world names run from "Qumatex" to "The Splitting Hollow", and a
  // board whose text overflows its own board is worse than a wide board.
  const label = scene.add
    .text(0, 0, `To ${destination}`, {
      fontSize: `${Math.round(size * 0.3)}px`,
      color: '#efe6ff',
      fontStyle: 'bold',
      align: 'center',
    })
    .setOrigin(0.5, 0.5);

  const padX = size * 0.26;
  const padY = size * 0.2;
  const plankW = label.width + padX * 2;
  const plankH = label.height + padY * 2;
  const plankTop = -size * 1.5;

  const gfx = scene.add.graphics();

  // Two posts under the plank, planted at the container's own foot. Thick
  // enough to read as timber at the distance the board is meant to be read
  // from -- hairline legs under a dark rectangle read as a floating chip.
  const postW = size * 0.2;
  [-plankW * 0.28, plankW * 0.28].forEach((x) => {
    gfx.fillStyle(POST_FILL, 1);
    gfx.fillRect(x - postW / 2, plankTop + plankH * 0.7, postW, -plankTop - plankH * 0.7);
    gfx.lineStyle(Math.max(1, size * 0.03), PLANK_EDGE, 1);
    gfx.strokeRect(x - postW / 2, plankTop + plankH * 0.7, postW, -plankTop - plankH * 0.7);
  });

  // The plank, with a lighter strip along its top edge standing in for the
  // board's own thickness -- a flat filled rectangle is a label, a board with
  // a visible edge is an object.
  const thickness = plankH * 0.16;
  gfx.fillStyle(PLANK_TOP, 1);
  gfx.fillRect(-plankW / 2, plankTop, plankW, thickness);
  gfx.fillStyle(PLANK_FILL, 1);
  gfx.fillRect(-plankW / 2, plankTop + thickness, plankW, plankH - thickness);
  gfx.lineStyle(Math.max(1, size * 0.045), PLANK_EDGE, 1);
  gfx.strokeRect(-plankW / 2, plankTop, plankW, plankH);
  // A thin lamp along the plank's top edge, in the lavender every crossing
  // between worlds already wears. Self-luminous per the light rule -- nothing
  // in these worlds shines on a signpost.
  gfx.lineStyle(Math.max(1, size * 0.05), STORY_LAVENDER, 0.5);
  gfx.lineBetween(-plankW / 2, plankTop, plankW / 2, plankTop);

  label.setPosition(0, plankTop + thickness + (plankH - thickness) / 2);

  container.add([gfx, label]);
  container.setAngle(BOARD_LEAN);
  return container;
}
