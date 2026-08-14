import Phaser from 'phaser';
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
export const HORIZON_Y = 190;
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
export function fogColor(base: number, depthRatio: number, target = 0xbfe3ff): number {
  const c1 = Phaser.Display.Color.IntegerToColor(base);
  const c2 = Phaser.Display.Color.IntegerToColor(target);
  const t = Phaser.Math.Clamp(depthRatio, 0, 1) * 0.6;
  const r = Phaser.Math.Linear(c1.red, c2.red, t);
  const g = Phaser.Math.Linear(c1.green, c2.green, t);
  const b = Phaser.Math.Linear(c1.blue, c2.blue, t);
  return Phaser.Display.Color.GetColor(r, g, b);
}
