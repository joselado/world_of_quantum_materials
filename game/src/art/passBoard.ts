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

const PLANK_FILL = 0x2a2438;
const PLANK_EDGE = 0x6f628f;
const POST_FILL = 0x231e2e;

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

  // Two posts under the plank, planted at the container's own foot.
  const postW = size * 0.13;
  [-plankW * 0.3, plankW * 0.3].forEach((x) => {
    gfx.fillStyle(POST_FILL, 1);
    gfx.fillRect(x - postW / 2, plankTop + plankH * 0.6, postW, -plankTop - plankH * 0.6);
  });

  gfx.fillStyle(PLANK_FILL, 1);
  gfx.fillRect(-plankW / 2, plankTop, plankW, plankH);
  gfx.lineStyle(Math.max(1, size * 0.045), PLANK_EDGE, 1);
  gfx.strokeRect(-plankW / 2, plankTop, plankW, plankH);
  // A thin lamp along the plank's top edge, in the lavender every crossing
  // between worlds already wears. Self-luminous per the light rule -- nothing
  // in these worlds shines on a signpost.
  gfx.lineStyle(Math.max(1, size * 0.06), STORY_LAVENDER, 0.55);
  gfx.lineBetween(-plankW / 2, plankTop, plankW / 2, plankTop);

  label.setPosition(0, plankTop + plankH / 2);

  container.add([gfx, label]);
  return container;
}
