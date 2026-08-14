import { blend } from '../../../art/colors';
import { fogColor } from '../../../art/perspective';

// The ground plane leans hard on aerial perspective: `fogColor`'s own blend
// caps out well short of the haze color, so pre-blend the rest of the way.
// Every fill in the ground plane -- walkable floor, off-path terrain, and the
// base wash under both (sky.ts's drawSky) -- goes through here.
//
// The falloff is in two parts, and where the boundary sits is the whole
// point. Up close the curve is gentle, because each grid row paints as one
// flat fill: how fast the color moves *per row* is exactly how visibly the
// mid-distance terraces, and it terraces worst in the open-sky worlds, whose
// fog target sits far above their ground in value by design (STYLE.md's biome
// constraints). Past FOG_CLOSE the remaining blend is taken smoothly to
// total, so the deepest row drawn *is* the haze color -- that is the row the
// terrain sweep stops on (paint.ts's `deepestRow`), and land that arrives at
// the haze color exactly where it runs out hands off to the horizon band with
// no step for the band to cover, which is what lets everything above the
// horizon line be translucent (WORLDS.md section 4).
//
// Something has to be steep, since the blend must cross from nothing to total
// over one draw distance. Putting the steep part late is what makes it free:
// every row past this depth is inside the reach of drawHorizonBand's wash, so
// the rows carrying the fastest color change are rows already being painted
// over. That is a relation between two modules and not a coincidence -- the
// band's foot (sky.ts's HORIZON_BAND_FROM) is derived from this depth, and
// has to stay nearer the camera than it. A step is only hidden in proportion
// to the wash actually over it: the visible part is (1 - alpha) times the
// step, and the step itself scales with how far a world's ground sits from
// its haze target, which the Vortex Glacier at an open gate (icy dark ground,
// the Iron Steppe's cream air ahead) stretches further than anything else in
// the game.
export const FOG_CLOSE = 0.55;

export function groundColor(base: number, depthRatio: number, target: number): number {
  const near = 0.4 * Math.pow(depthRatio, 0.9);
  const close = smoothstep(Math.min(1, Math.max(0, (depthRatio - FOG_CLOSE) / (1 - FOG_CLOSE))));
  return blend(fogColor(base, depthRatio, target), target, near + (1 - near) * close);
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}
