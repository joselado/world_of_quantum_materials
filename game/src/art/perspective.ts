import { CANVAS_W, CANVAS_H } from '../config/screen';

// Over-the-shoulder pseudo-3D projection for the overworld: the camera sits
// behind and slightly above the player, always looking toward -y ("forward"
// on the path). Movement logic itself stays a plain 2D integer grid (see
// OverworldScene) -- this module only turns (lane offset, depth) into a
// screen point, the same trick classic pseudo-3D racing games use for roads.
// CANVAS_W/CANVAS_H themselves live in config/screen.ts (the single source
// of truth for the game's canvas size); re-exported here since every other
// scene/panel already imports its canvas size from this module.
export { CANVAS_W, CANVAS_H };
// The horizon line sits high in the frame: the camera looks down onto the
// ground plane, which owns roughly three quarters of the screen, and the sky
// is the remaining strip above it. Everything drawn at depth is measured
// against this line -- the mist band, the distant self and the ground wash
// are all sized from it (scenes/overworld/sky.ts), so it cannot be moved
// alone.
export const HORIZON_Y = 110;
export const FOCAL = 2.2;
export const LANE_PX = 150;

export interface ProjectedPoint {
  x: number;
  y: number;
  scale: number;
}

// `lane` is a signed offset in tile-widths from dead-center; `depth` is how
// far ahead of the camera the point is, in tile-lengths (0 = right at the
// camera plane, larger = closer to the horizon).
export function project(lane: number, depth: number): ProjectedPoint {
  const d = Math.max(0, depth);
  const scale = FOCAL / (FOCAL + d);
  return {
    x: CANVAS_W / 2 + lane * LANE_PX * scale,
    y: HORIZON_Y + scale * (CANVAS_H - HORIZON_Y),
    scale,
  };
}

// Blends a tile color toward a distant haze color as depth increases, so the
// path visibly recedes into the distance instead of looking like a flat wall
// of color at the horizon. `target` defaults to a pale sky blue but callers
// pass a biome-specific fog color (e.g. a dark cave haze) so the blend still
// looks right off the Mean Fields' own pale blue sky.
// Integer shift/mask arithmetic for the same reason art/colors.ts's `blend`
// uses it: this runs several times per tile across the whole visible grid
// every frame, and Phaser's Color helpers allocate on every call. Note the
// channels are deliberately *not* rounded here -- the shifts truncate, which
// is what this function has always produced and what the ground palette is
// tuned against, so rounding them would move every fogged tile by a value.
export function fogColor(base: number, depthRatio: number, target = 0xbfe3ff): number {
  const t = Math.max(0, Math.min(1, depthRatio)) * 0.6;
  const r1 = (base >> 16) & 255;
  const g1 = (base >> 8) & 255;
  const b1 = base & 255;
  const r = (((target >> 16) & 255) - r1) * t + r1;
  const g = (((target >> 8) & 255) - g1) * t + g1;
  const b = ((target & 255) - b1) * t + b1;
  return (r << 16) | (g << 8) | b;
}
