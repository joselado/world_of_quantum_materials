import { blend } from '../../../art/colors';
import { fogColor } from '../../../art/perspective';

// The ground plane leans hard on aerial perspective: `fogColor`'s own blend
// caps out well short of the haze color, so pre-blend the rest of the way
// with a curve that starts biting close to the camera instead of only at
// the draw-distance edge. Every fill in the ground plane -- walkable floor,
// off-path terrain, and the base wash under both (sky.ts's drawSky) -- goes
// through here.
export function groundColor(base: number, depthRatio: number, target: number): number {
  return blend(fogColor(base, depthRatio, target), target, 0.4 * Math.pow(depthRatio, 0.9));
}
