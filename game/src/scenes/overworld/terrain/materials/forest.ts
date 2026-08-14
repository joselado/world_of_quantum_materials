import Phaser from 'phaser';
import { SUMMER_TREE, drawTree, hasTree } from '../../../../art/trees';
import type { AccentTile } from '../types';

// 'forest' (the Mean Fields, world 1): dense summer canopy. This is the
// gentlest impassable terrain in the game and the bottom of the escalation
// spine -- you just would not walk into it -- so it is drawn as a wood rather
// than as a hazard: no glow, no motion, nothing that suggests it would hurt.
// The tree sprites are shared with the Splitting Hollow (art/trees.ts).
export function drawForestAccent(g: Phaser.GameObjects.Graphics, tile: AccentTile) {
  if (!hasTree(tile.gx, tile.gy)) return;
  drawTree(g, tile, SUMMER_TREE);
}
