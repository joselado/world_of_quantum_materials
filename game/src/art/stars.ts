import Phaser from 'phaser';
import { blend } from './colors';
import { CANVAS_W } from './perspective';

// The starfield the last four worlds carry (WORLDS.md section 1's "The
// stars"), and what it is doing is telling the player what the final enemy is
// before the game says so. A machine-learning model is a network -- nodes and
// the weights between them -- so the sky assembles one across four worlds, and
// by the time it is finished the player has been looking at a picture of World
// 10's boss for three worlds:
//
//   7  The Entangled Web    scattered     faint unconnected points
//   8  The Screened Swamp   first links   strange connections between a few
//   9  The Defect Scars     occluded      cloud hides part of the pattern
//  10  The Devouring Mirror the network   every point joined
//
// Three rules hold it together, and all three are structural rather than
// decorative:
//
// **The stages only ever add.** A link drawn in World 8 is still there in
// World 10 -- one thing being built across four worlds, not four different
// skies. A link that came and went would read as weather.
//
// **World 7's points stay unconnected.** That world's ground is already nodes
// joined by bonds (its lanes and cross-link rungs), so a connected sky above
// it would restate the terrain and read as tensor networks rather than as the
// enemy.
//
// **The pattern is fixed.** Every position and every link is authored, not
// rolled, so the network is the same one in every session -- a player who
// looks up in World 10 is seeing the sky they saw in World 7 finished, and a
// re-rolled one could not be.

// The nodes, in a normalised box: x across the full frame, y down the strip of
// sky above the mist. Authored in a loose arc rather than a grid or an even
// scatter -- a grid reads as a screen and an even scatter reads as a texture,
// and this has to read as something that has been *built*.
const NODES: [number, number][] = [
  [0.05, 0.62],
  [0.11, 0.28],
  [0.17, 0.78],
  [0.23, 0.45],
  [0.29, 0.14],
  [0.33, 0.66],
  [0.38, 0.36],
  [0.44, 0.72],
  [0.47, 0.2],
  [0.52, 0.5],
  [0.57, 0.82],
  [0.61, 0.3],
  [0.66, 0.6],
  [0.7, 0.12],
  [0.74, 0.42],
  [0.78, 0.74],
  [0.83, 0.26],
  [0.87, 0.55],
  [0.91, 0.36],
  [0.95, 0.68],
  [0.4, 0.55],
  [0.63, 0.46],
];

// The connections that appear in World 8: few, long, and crossing each other
// -- lines no constellation would draw, which is the whole point. They are
// what the player is meant to notice as wrong.
const FIRST_LINKS: [number, number][] = [
  [1, 6],
  [4, 9],
  [8, 14],
  [11, 17],
  [3, 10],
];

// What World 10 adds to finish it. Together with FIRST_LINKS every node is
// joined to at least two others, so the sky reads as one connected network
// rather than as a constellation with some spare stars around it.
const NETWORK_LINKS: [number, number][] = [
  [0, 1],
  [0, 2],
  [1, 3],
  [2, 3],
  [2, 5],
  [3, 6],
  [4, 6],
  [5, 7],
  [5, 20],
  [6, 20],
  [7, 9],
  [8, 11],
  [9, 12],
  [9, 21],
  [10, 12],
  [11, 21],
  [12, 14],
  [13, 16],
  [14, 21],
  [14, 17],
  [15, 17],
  [16, 18],
  [17, 19],
  [18, 19],
  [20, 9],
  [13, 11],
  [15, 12],
];

// Where the strip of usable sky is: nearly all of it, down to just above the
// horizon line. The field is drawn *under* the mist band (scenes/overworld/
// sky.ts), so how far a star fades is the atmosphere's answer, not this
// module's -- which is what puts the network in the world's air instead of on
// the front of the frame, and what lets it use the whole sky rather than the
// strip above the mist. The corner HUD plates own the top few rows at both
// ends, so the pattern is authored to keep its own centre of mass below them.
const BAND_TOP = 6;
const BAND_FLOOR_LIFT = 22;
// A last touch of fade at the very floor, so a node never lands exactly on
// the horizon line, where it would read as a light on the ground.
const BAND_FADE = 10;

const STAR_LIGHT = 0xeef2ff;
const LINK_LIGHT = 0xb9c8ff;
// How far the field is carried into the live fog target. Stars are the one
// thing in the frame that is genuinely beyond the atmosphere, so they take
// only a little of it -- but not none, or they sit in front of the sky.
const STAR_DROWN = 0.25;
// Per-node twinkle. Slow, shallow and out of phase, so the field breathes
// rather than flickering.
const TWINKLE_RATE = 0.0009;
const TWINKLE_DEPTH = 0.3;

export interface StarSky {
  g: Phaser.GameObjects.Graphics;
  /** The world the player is standing in. */
  world: number;
  /** The horizon line, which the band is measured up from. */
  horizonY: number;
  /** The live fog colour everything else in the frame is hazing toward. */
  target: number;
  /** The scene clock, driving the twinkle and World 9's drifting cloud. */
  now: number;
}

// The first world that carries any of this, and the one that carries all of
// it. Between them the stages only add.
export const STARS_FROM_WORLD = 7;
export const STARS_COMPLETE_WORLD = 10;

function nodeAt(i: number, o: StarSky): { x: number; y: number; fade: number } {
  const [nx, ny] = NODES[i];
  const floor = o.horizonY - BAND_FLOOR_LIFT;
  const y = BAND_TOP + ny * (floor - BAND_TOP);
  // Fades into the mist over the last stretch of the band rather than
  // stopping at a line, so the field has no floor of its own.
  const fade = Phaser.Math.Clamp((floor - y) / BAND_FADE, 0, 1) * 0.35 + 0.65;
  return { x: nx * CANVAS_W, y, fade };
}

// World 9's occlusion: cloud drifting across the pattern so that what is being
// assembled cannot be seen whole. It is the only stage that takes something
// away, and it takes it away by covering, never by unbuilding -- the links
// under it are still there, which is what makes the world after it land.
function drawOcclusion(o: StarSky) {
  const drift = (o.now * 0.004) % (CANVAS_W + 500);
  const floor = o.horizonY - BAND_FLOOR_LIFT;
  [
    { x: drift - 250, w: 300, h: 26, y: 0.3 },
    { x: drift - 620, w: 380, h: 30, y: 0.62 },
  ].forEach((bank) => {
    const cy = BAND_TOP + bank.y * (floor - BAND_TOP);
    // Nested ellipses rather than one, so the bank has no edge: a hard-edged
    // occluder reads as a shape drawn over the stars instead of as air in
    // front of them.
    [1, 0.72, 0.45].forEach((f, i) => {
      o.g.fillStyle(o.target, 0.3 - i * 0.06);
      o.g.fillEllipse(bank.x, cy, bank.w * f, bank.h * f);
    });
  });
}

export function drawStarNetwork(o: StarSky) {
  if (o.world < STARS_FROM_WORLD) return;
  const g = o.g;
  const star = blend(STAR_LIGHT, o.target, STAR_DROWN);
  const link = blend(LINK_LIGHT, o.target, STAR_DROWN);

  // Links first, so a node always sits on top of every line that reaches it
  // -- a network is points joined by weights, not lines with points buried
  // under them.
  const complete = o.world >= STARS_COMPLETE_WORLD;
  const links = complete ? FIRST_LINKS.concat(NETWORK_LINKS) : o.world > STARS_FROM_WORLD ? FIRST_LINKS : [];
  // The finished network's weights carry visibly more than the first strange
  // connections did. In World 8 a link is something the player half-notices
  // and is not sure they saw; in World 10 the thing is switched on, and the
  // sky has to be readable as one connected object at a glance for the reveal
  // to land at all.
  links.forEach(([a, b]) => {
    const pa = nodeAt(a, o);
    const pb = nodeAt(b, o);
    g.lineStyle(complete ? 1.2 : 1, link, (complete ? 0.5 : 0.36) * Math.min(pa.fade, pb.fade));
    g.lineBetween(pa.x, pa.y, pb.x, pb.y);
  });

  NODES.forEach((_, i) => {
    const p = nodeAt(i, o);
    const twinkle = 1 - TWINKLE_DEPTH * (0.5 + 0.5 * Math.sin(o.now * TWINKLE_RATE + i * 1.7));
    // The finished network's nodes carry more light than the scattered ones
    // did: what was a field of ordinary stars in World 7 is a thing that is
    // switched on by World 10.
    const lit = complete ? 1 : 0.72;
    g.fillStyle(star, 0.9 * p.fade * twinkle * lit);
    g.fillCircle(p.x, p.y, complete ? 1.9 : 1.3);
    // A soft halo on the finished network only, which is the difference
    // between points in a sky and nodes that are doing something.
    if (complete) {
      g.fillStyle(star, 0.16 * p.fade * twinkle);
      g.fillCircle(p.x, p.y, 4.2);
    }
  });

  if (o.world === 9) drawOcclusion(o);
}
