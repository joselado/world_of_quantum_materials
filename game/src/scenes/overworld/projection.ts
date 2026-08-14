import { project, LANE_PX, CANVAS_W, ProjectedPoint } from '../../art/perspective';

// Grid is deliberately fine-grained (many small tiles) rather than few large
// ones, so each arrow-key step moves the camera a small distance. TILE_SCALE
// shrinks every tile's footprint in world space; DRAW_DISTANCE_TILES and
// LANE_CLIP are widened by the inverse factor so the visible world (in
// screen terms) covers the same ground as before, just in smaller steps.
export const GRID_W = 27;
export const GRID_H = 50;
export const TILE_SCALE = 0.6;
// How far off-center an actor can stand and still be worth drawing, in
// tile-widths. The ground plane does not use this -- how wide the ground has
// to be painted to fill the frame depends on how far away it is (laneClipAt).
export const LANE_CLIP = 8.5;
export const DRAW_DISTANCE_TILES = 15;
// The fraction of DRAW_DISTANCE_TILES a world sprite is still drawn within
// (OverworldScene.updateWorldSprites) -- past it a crystal/pickup/landmark is
// too deep into the fog to read, so it is culled rather than painted as a
// speck. Exported because it is also the far edge of the player's field of
// vision, which is the northern bound OverworldScene's respawn placement has
// to stay beyond (its southern bound is CAMERA_BACK_TILES, below).
export const VISIBLE_DEPTH_FRACTION = 0.75;
// How far behind the player's own tile the camera sits, in tile-lengths.
// Every depth handed to projectTile is measured from the player's tile
// centre, and this is what turns that into the camera-relative depth the
// projection wants. It is the whole reason the avatar can be drawn on-screen
// standing on the tile the collision grid puts it on: at zero pullback the
// player's tile centre projects to the very bottom edge of the canvas, so the
// avatar would have to be drawn somewhere ahead of its own tile to be visible
// at all -- and would then overlap whatever is beyond the tile it can walk on.
export const CAMERA_BACK_TILES = 0.7;

// Tile lanes/depths are defined in grid-index units, measured from the
// player's own tile (lane 0, depth 0 is the tile the player stands on).
// Every projection goes through here so the world-space size of a tile
// (TILE_SCALE) and the camera's pullback behind the player
// (CAMERA_BACK_TILES) are applied consistently for both the ground mesh and
// the crystal sprites -- code drawing at depth must never apply the pullback
// itself on top of this.
export function projectTile(lane: number, depth: number): ProjectedPoint {
  return project(lane * TILE_SCALE, (depth + CAMERA_BACK_TILES) * TILE_SCALE);
}

// How far off-center the ground has to be painted, in tile-widths, for the
// row at this depth to reach both sides of the frame. A fixed lane window
// cannot do this job: the projection shrinks a tile-width toward the
// vanishing point, so one that fills the frame up close covers a narrowing
// wedge in the distance and leaves the far corners of the screen on bare
// backdrop. One tile of slack past the frame edge keeps the outermost tile's
// own width in play rather than ending exactly on it.
export function laneClipAt(depth: number): number {
  return CANVAS_W / 2 / (TILE_SCALE * LANE_PX * projectTile(0, depth).scale) + 1;
}
