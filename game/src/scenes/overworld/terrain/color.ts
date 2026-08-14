import { blend } from '../../../art/colors';
import { fogColor } from '../../../art/perspective';

// The ground plane leans hard on aerial perspective: `fogColor`'s own blend
// caps out well short of the haze color, so pre-blend the rest of the way.
// Every fill in the ground plane -- walkable floor, off-path terrain, and the
// base wash under both (sky.ts's drawSky) -- goes through here.
//
// The exponent is what shapes the falloff, and one end of it is fixed rather
// than chosen: at depthRatio 1 the blend is total, so the deepest row drawn
// *is* the haze color. That is the row the terrain sweep stops on
// (paint.ts's `deepestRow`), and land that arrives at the haze color exactly
// where it runs out hands off to the horizon band with no step for the band
// to cover -- which is what lets everything above the horizon line be
// translucent (WORLDS.md section 4).
//
// The exponent itself is held as low as that constraint allows, because it
// also sets how fast the color moves per row at the far end, where projected
// rows are only a few pixels tall. Each row is one flat fill, so a steep
// finish turns the last stretch of ground into visible terraces -- worst in
// the open-sky worlds, whose fog target sits far above their ground in value
// by design (STYLE.md's biome constraints).
export function groundColor(base: number, depthRatio: number, target: number): number {
  return blend(fogColor(base, depthRatio, target), target, Math.pow(depthRatio, 1.8));
}
