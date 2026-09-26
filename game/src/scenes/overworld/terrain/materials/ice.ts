import Phaser from 'phaser';
import { blend } from '../../../../art/colors';
import { fillPolygon } from '../../../../art/shapes';
import type { ProjectedPoint } from '../../../../art/perspective';
import { CAMERA_BACK_TILES, DRAW_DISTANCE_TILES, projectTile } from '../../projection';
import { hazeTarget } from '../../sky';
import type { FeatureCore } from '../../../../world/mapgen';
import type { AccentTile, TerrainView } from '../types';

// 'ice' (the Vortex Glacier, world 5): the frozen lake beyond the open sheet
// the player crosses, and the vortex pits punched through the sheet itself.
//
// The lake is a per-tile accent (drawIceAccent): still, faceted, and nothing
// else. A pit is drawn whole, once, by drawVortices -- after the tile pass
// and under the atmosphere (paint.ts's drawTerrain) -- because what is in it
// is one thing spanning every tile of its disc: an Abrikosov vortex. The
// order parameter vanishes in a small normal core, the flux the sheet has
// expelled from everywhere else threads through that core, and a persistent
// supercurrent circulates around it, densest at the core and decaying
// outward over the penetration depth. So the pit is a bowl darkening toward
// its centre; streamlines spiral in from its rim to its core, thinning
// outward; the whole pattern turns slowly and steadily -- a persistent
// current never slows -- in the same sense in every pit, since the trapped
// flux all points one way; and the core glows, the only light this world has
// (WORLDS.md section 2, world 5; STYLE.md's "Off-path terrain materials").
//
// Every point of it is generated on the ground plane, in tiles around the
// core, and projected with the tile projection (projectTile), so the swirl
// lies flat in the ice, foreshortens with the pit and stands still in the
// world as the camera moves. The pit's own tiles carry no facets under it
// (drawIceAccent returns on a tile inside a feature), so the streamlines are
// the only lines in the bowl.

// The bowl's radius is the punched radius less this, in tiles, so a lip of
// lake stays between the bowl and the sheet: the rim, lit by the contact rim
// the boundary already gets.
const BOWL_INSET = 0.5;
// The normal core, as a fraction of the pit's radius, with a floor so the
// smallest pit still has a core the glow can be seen in.
const CORE_FRACTION = 0.12;
const CORE_MIN = 0.35;
// The bowl: nested discs from the rim in, each a step darker, and the steps
// growing toward the core -- the outermost edge is the faintest, so it never
// reads as a second rim inside the real one, and the floor still falls away
// to a dark centre.
const BOWL_STEPS = 9;
const BOWL_DARK = 0x0a1620;
const BOWL_STEP_ALPHA_OUTER = 0.05;
const BOWL_STEP_ALPHA_INNER = 0.16;
// The circulating current: this many arms, each winding this far around
// per tile of radius, the whole pattern turning once in ROTATION_MS. The
// sign of the pitch and of the turn is the sign of the trapped flux, and
// the sheet was cooled in one field, so every pit shares both.
const ARMS = 4;
const ARM_PITCH = 1.4;
const ROTATION_MS = 12000;
// An arm's light decays outward from the core over this fraction of its
// length: the penetration depth in the pit's own units.
const PENETRATION = 0.65;
// Each arm is traced in this many buckets of this many segments, a bucket
// being the run of arm one line style covers.
const ARM_BUCKETS = 4;
const ARM_BUCKET_STEPS = 4;
// The streamlines are lit by the core, not lights themselves: their colour
// and alpha are held so that even at the core they stay below the walkable
// ice's own value, and well below the core, which is the one light here.
const ARM_LIGHT = 0xb8dcea;
const ARM_ALPHA = 0.6;
// Two faint closed streamlines between the arms, at these fractions of the
// bowl's radius.
const RING_FRACTIONS = [0.5, 0.82];
const RING_ALPHA = 0.18;
// Segments around a full circle, for the rings, the bowl's discs and the
// core.
const CIRCLE_STEPS = 28;
// The core: dark where the condensate is gone, with the trapped flux glowing
// in it -- the brightest point in the pit and brighter than the ice, since
// it is the only light this world has. The pulse is slow and shallow because
// trapped flux is trapped: it is not going anywhere, and it never goes out.
const CORE_DARK = 0x06101a;
const FLUX_GLOW = 0x8fe0f4;
const FLUX_BRIGHT = 0xecfaff;
const PULSE_MS = 1100;
// Where the pass stops drawing and how it fades before that -- the same span
// the per-tile detail pass uses (paint.ts's DETAIL_MAX_DEPTH and its fade), so
// a pit's vortex goes with the lake's facets rather than outlasting them.
const VORTEX_MAX_DEPTH = 0.75;
const VORTEX_FADE_FROM = VORTEX_MAX_DEPTH * 0.62;
// A ground point this close to the camera plane, or behind it, is clipped to
// the plane, where the projection pins it to the bottom of the frame -- which
// is where the ground it stands on leaves the frame too.
const NEAR_EPS = 0.05;

export function drawIceAccent(g: Phaser.GameObjects.Graphics, tile: AccentTile) {
  const { cx, cy, s, gx, gy, depth, haze, detail } = tile;
  if (detail <= 0) return;
  // A pit's tiles are the bowl drawVortices paints across them: no facets,
  // so the streamlines are the only lines inside it.
  if (tile.feature) return;
  const air = depth * 0.75;

  // The lake itself: a still, faceted sheet. Pale cleavage lines at a couple
  // of fixed orientations per tile, and no motion at all -- the glacier is
  // the world that pushes something invisible away from itself, not the world
  // that shimmers.
  const shimmer = 0.5 + 0.3 * Math.sin(gx * 1.7 + gy * 2.3);
  g.lineStyle(1, blend(0xcdeeff, haze, air), 0.3 * shimmer * detail);
  // Both cleavage lines in one path. They already share a stroke style, and a
  // lake is a few hundred tiles a frame, so issuing them as one path halves
  // the stroke calls the world makes without touching a pixel of it.
  g.beginPath();
  g.moveTo(cx - 2.6 * s, cy - 0.4 * s);
  g.lineTo(cx + 2.4 * s, cy - 1.1 * s);
  g.moveTo(cx - 2.2 * s, cy + 0.9 * s);
  g.lineTo(cx + 2.6 * s, cy + 0.3 * s);
  g.strokePath();
}

// A ground point on screen, and whether it had to be clipped to the camera
// plane to get there.
interface GroundPoint {
  p: ProjectedPoint;
  clipped: boolean;
}

// Every pit in view, each drawn whole. Depth is measured the way the tile
// pass measures a row -- the pit's centre row's far edge against the draw
// distance -- so the vortex fades over the same stretch as its lake.
export function drawVortices(view: TerrainView) {
  const haze = hazeTarget(view, view.biome);
  for (const pit of view.plan.features) {
    const depthFar = view.camY - pit.y + 0.5;
    // Wholly behind the camera: none of it is in frame.
    if (depthFar + pit.radius + CAMERA_BACK_TILES <= 0) continue;
    const depthRatio = Phaser.Math.Clamp(depthFar / DRAW_DISTANCE_TILES, 0, 1);
    const fade = Phaser.Math.Clamp((VORTEX_MAX_DEPTH - depthRatio) / (VORTEX_MAX_DEPTH - VORTEX_FADE_FROM), 0, 1);
    if (fade <= 0) continue;
    drawVortex(view, pit, haze, depthRatio, fade);
  }
}

function drawVortex(view: TerrainView, pit: FeatureCore, haze: number, depthRatio: number, fade: number) {
  const g = view.gfx;
  const { camX, camY, now } = view;
  const air = depthRatio * 0.75;
  const rOut = Math.max(0.6, pit.radius - BOWL_INSET);
  const rCore = Math.max(CORE_MIN, pit.radius * CORE_FRACTION);
  const armLen = rOut - rCore;
  // The core's own screen scale, for line widths.
  const s = projectTile(pit.x - camX, camY - pit.y).scale;

  // A point `r` tiles from the core at ground angle `theta`, on screen.
  const at = (r: number, theta: number): GroundPoint => {
    const lane = pit.x + r * Math.cos(theta) - camX;
    const depth = camY - (pit.y + r * Math.sin(theta));
    const near = NEAR_EPS - CAMERA_BACK_TILES;
    return { p: projectTile(lane, Math.max(near, depth)), clipped: depth < near };
  };
  const circle = (r: number): GroundPoint[] => {
    const pts: GroundPoint[] = [];
    for (let i = 0; i < CIRCLE_STEPS; i++) pts.push(at(r, (i / CIRCLE_STEPS) * Math.PI * 2));
    return pts;
  };

  // The bowl, rim to centre.
  const bowlColor = blend(BOWL_DARK, haze, air);
  for (let k = 0; k < BOWL_STEPS; k++) {
    const alpha = BOWL_STEP_ALPHA_OUTER + (BOWL_STEP_ALPHA_INNER - BOWL_STEP_ALPHA_OUTER) * (k / (BOWL_STEPS - 1));
    g.fillStyle(bowlColor, alpha * fade);
    fillPolygon(
      g,
      circle(rOut * (1 - k / BOWL_STEPS)).map((gp) => gp.p)
    );
  }

  // The closed streamlines, faint, lit a little more the nearer the core.
  const lightColor = blend(ARM_LIGHT, haze, air);
  const ringWidth = Math.max(0.6, s);
  for (const fraction of RING_FRACTIONS) {
    const r = rOut * fraction;
    const decay = Math.exp(-((r - rCore) / armLen) / PENETRATION);
    g.lineStyle(ringWidth, lightColor, RING_ALPHA * (0.5 + decay) * fade);
    tracePath(g, circle(r), true);
  }

  // The arms: each a spiral from the core out to the rim, brightest and
  // widest at the core, the whole set turning together.
  const spin = ((now % ROTATION_MS) / ROTATION_MS) * Math.PI * 2;
  for (let arm = 0; arm < ARMS; arm++) {
    const theta0 = spin + (arm * Math.PI * 2) / ARMS;
    for (let b = 0; b < ARM_BUCKETS; b++) {
      const t0 = b / ARM_BUCKETS;
      const t1 = (b + 1) / ARM_BUCKETS;
      const tm = (t0 + t1) / 2;
      const decay = Math.exp(-tm / PENETRATION);
      g.lineStyle((1.2 + 2 * (1 - tm)) * Math.max(0.7, s), lightColor, ARM_ALPHA * decay * fade);
      const pts: GroundPoint[] = [];
      for (let i = 0; i <= ARM_BUCKET_STEPS; i++) {
        const t = t0 + (t1 - t0) * (i / ARM_BUCKET_STEPS);
        const r = rCore + armLen * t;
        pts.push(at(r, theta0 + ARM_PITCH * (r - rCore)));
      }
      tracePath(g, pts, false);
    }
  }

  // The core: the normal region, the flux in it, and its lit edge.
  const pulse = 0.8 + 0.2 * Math.sin(now / PULSE_MS + pit.x * 0.4);
  g.fillStyle(blend(CORE_DARK, haze, air), 0.7 * fade);
  fillPolygon(
    g,
    circle(rCore).map((gp) => gp.p)
  );
  g.fillStyle(blend(FLUX_GLOW, haze, air), 0.85 * pulse * fade);
  fillPolygon(
    g,
    circle(rCore * 0.72).map((gp) => gp.p)
  );
  g.fillStyle(blend(FLUX_BRIGHT, haze, air), 0.95 * pulse * fade);
  fillPolygon(
    g,
    circle(rCore * 0.4).map((gp) => gp.p)
  );
  g.lineStyle(Math.max(0.8, 1.4 * s), blend(FLUX_BRIGHT, haze, air), 0.45 * fade);
  tracePath(g, circle(rCore), true);
}

// Strokes a run of ground points as one path, broken wherever two points in
// a row were clipped to the camera plane: a segment between two pinned
// points would run along the bottom of the frame rather than across ground.
function tracePath(g: Phaser.GameObjects.Graphics, pts: GroundPoint[], closed: boolean) {
  if (pts.length < 2) return;
  g.beginPath();
  g.moveTo(pts[0].p.x, pts[0].p.y);
  for (let i = 1; i < pts.length; i++) {
    if (pts[i].clipped && pts[i - 1].clipped) g.moveTo(pts[i].p.x, pts[i].p.y);
    else g.lineTo(pts[i].p.x, pts[i].p.y);
  }
  if (closed && !(pts[0].clipped && pts[pts.length - 1].clipped)) g.lineTo(pts[0].p.x, pts[0].p.y);
  g.strokePath();
}
