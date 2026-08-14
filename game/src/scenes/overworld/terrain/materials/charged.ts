import Phaser from 'phaser';
import { blend } from '../../../../art/colors';
import { CANVAS_W } from '../../../../art/perspective';
import { ellipseSteps } from '../../../../art/shapes';
import { DRAW_DISTANCE_TILES, GRID_W, projectTile } from '../../projection';
import type { AccentTile, TerrainView } from '../types';

// 'charged' (the Storm Flats, world 4): the ground the storm strikes. Fourth
// on the escalation spine, and the first impassable terrain in the game that
// would actively kill rather than merely block -- which the world says in one
// image, by hitting it while the player watches from the road.
//
// The storm is one event seen along its whole length: a bolt cracking down
// out of the dusk, the ground lighting where it lands, and the scorch it
// leaves behind. The tile accent below is the scorch; drawStormStrikes is the
// strike. Neither is decoration on the other.

// The scar a strike leaves: a short forked burn, its shape fixed per tile so
// the field reads as ground that has been hit many times rather than as a
// field of random sparks. Static -- everything that moves in this world is a
// strike.
export function drawChargedAccent(g: Phaser.GameObjects.Graphics, { cx, cy, s, gx, gy, depth, haze, detail }: AccentTile) {
  if (detail <= 0) return;

  const air = depth * 0.7;
  const lean = ((gx * 3 + gy * 5) % 5) / 4 - 0.5;
  g.lineStyle(1, blend(0x6f86c8, haze, air), 0.4 * detail);
  g.beginPath();
  g.moveTo(cx - 2.6 * s, cy + 1.4 * s);
  g.lineTo(cx + lean * 2 * s, cy);
  g.lineTo(cx + 0.6 * s, cy - 0.6 * s);
  g.lineTo(cx + 2.8 * s, cy - 1.6 * s);
  g.strokePath();
}

// The two strike slots, on deliberately incommensurate cycles so the storm
// never settles into a rhythm the player can predict. A strike is alive for a
// twentieth of its own cycle, which puts one flash on screen roughly every
// three seconds and leaves the frame dark between them: this is an event the
// world stages, not a texture, and a sky that flickers continuously would
// both compete with the fight for attention and be unpleasant to play under.
const STRIKE_SLOTS = [
  { seed: 11, period: 5200, phase: 0 },
  { seed: 47, period: 7100, phase: 2100 },
];
const STRIKE_LIFE = 0.05;
// How far ahead of the camera a strike may land, in tiles. Held inside the
// range the ground still resolves at: a flash on a row already drowned in
// haze is a bright speck on the horizon rather than a strike on terrain.
const STRIKE_MIN_DEPTH = 1.5;
const STRIKE_MAX_DEPTH = 10;
const BOLT_COLOR = 0xd8e2ff;
const GLOW_COLOR = 0xb9c8ff;

function hash(i: number): number {
  const s = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

// The storm, drawn after the atmosphere pass so a bolt reads as brighter than
// the air it crosses rather than being drowned by it. Every strike lands on an
// impassable tile: that is the whole message, and one on the road would say
// the opposite of what this world means. The flash is local to the tile it
// hits rather than a wash over the frame, so the route and the player's own
// crystal keep their own values through it.
export function drawStormStrikes(g: Phaser.GameObjects.Graphics, view: TerrainView) {
  for (const slot of STRIKE_SLOTS) {
    const t = (((view.now + slot.phase) % slot.period) + slot.period) % slot.period;
    if (t > slot.period * STRIKE_LIFE) continue;
    // Hard onset, decaying tail -- the shape of a discharge rather than of a
    // lamp being turned up.
    const flash = 1 - t / (slot.period * STRIKE_LIFE);
    const cycle = Math.floor((view.now + slot.phase) / slot.period);

    const gy = Math.round(
      view.camY - STRIKE_MIN_DEPTH - hash(slot.seed + cycle * 3.7 + 91) * (STRIKE_MAX_DEPTH - STRIKE_MIN_DEPTH)
    );
    const gx = strikeColumn(view, gy, hash(slot.seed + cycle * 3.7));
    if (gx < 0) continue;

    const depth = view.camY - gy;
    const p = projectTile(gx - view.camX, depth);
    if (p.x < -60 || p.x > CANVAS_W + 60) continue;
    // A discharge is self-luminous, so it takes only a light touch of the air
    // it crosses -- hazed at the rate the ground is, it would arrive at the
    // fog colour and stop being the brightest thing in the frame, which is the
    // one thing a strike has to be.
    const air = Phaser.Math.Clamp(depth / DRAW_DISTANCE_TILES, 0, 1) * 0.25;
    drawStrike(g, p.x, p.y, p.scale, flash, blend(BOLT_COLOR, view.biome.fogTarget, air), blend(GLOW_COLOR, view.biome.fogTarget, air), cycle);
  }
}

// Which column of a chosen row the bolt lands in: the impassable tile nearest
// a hashed starting point, searched outward along the row. Picking a column
// outright and dropping the cycle when it lands on the road would silence the
// storm exactly where the corridor is widest, which in this world is most of
// it; searching keeps the cadence while keeping the constraint absolute.
function strikeColumn(view: TerrainView, gy: number, seed: number): number {
  const row = view.plan.tiles[gy];
  if (!row) return -1;
  const from = Math.floor(seed * GRID_W);
  for (let step = 0; step < GRID_W; step++) {
    const dir = step % 2 ? -1 : 1;
    const gx = from + dir * Math.ceil(step / 2);
    if (row[gx]?.kind === 'charged') return gx;
  }
  return -1;
}

function drawStrike(
  g: Phaser.GameObjects.Graphics,
  tx: number,
  ty: number,
  scale: number,
  flash: number,
  bolt: number,
  glow: number,
  cycle: number
) {
  // The ground the strike is standing on, lit from above for as long as the
  // bolt lasts. World 4 still has a sky and light still arrives from it, so a
  // struck tile brightening is honest here in a way it would not be past
  // World 7. Three nested pools rather than one: light falling on a plane has
  // no edge, and a single ellipse is a spotlight decal.
  const r = 110 * scale;
  [
    { w: 3.4, h: 1.25, c: glow, a: 0.3 },
    { w: 1.9, h: 0.7, c: glow, a: 0.45 },
    { w: 0.8, h: 0.3, c: bolt, a: 0.85 },
  ].forEach((pool) => {
    g.fillStyle(pool.c, pool.a * flash);
    g.fillEllipse(tx, ty, r * pool.w, r * pool.h, ellipseSteps(r * pool.w, r * pool.h));
  });

  // The channel itself, from the top of the frame down onto that tile,
  // wandering less and less as it closes on where it lands. Traced twice: a
  // wide soft sheath and a thin hot core, which is what makes a stroked line
  // read as light rather than as wire.
  const SEGMENTS = 7;
  const path: { x: number; y: number }[] = [{ x: tx + (hash(cycle * 13 + 5) - 0.5) * 160, y: 0 }];
  for (let seg = 0; seg < SEGMENTS; seg++) {
    const left = SEGMENTS - seg;
    const prev = path[path.length - 1];
    path.push({
      x: prev.x + (tx - prev.x) / left + (hash(cycle * 13 + seg) - 0.5) * 30 * (left / SEGMENTS),
      y: prev.y + (ty - prev.y) / left,
    });
  }
  path.push({ x: tx, y: ty });

  for (const pass of [
    { w: 5, c: glow, a: 0.3 },
    { w: 1.5, c: bolt, a: 1 },
  ]) {
    g.lineStyle(pass.w, pass.c, pass.a * flash);
    g.strokePoints(path, false);
  }

  // One branch off the main channel, which is what makes a discharge read as
  // a discharge rather than as a crack in the screen. It dies in the air.
  const fork = path[4];
  g.lineStyle(1, bolt, 0.55 * flash);
  g.beginPath();
  g.moveTo(fork.x, fork.y);
  g.lineTo(fork.x + 26, fork.y + 22);
  g.lineTo(fork.x + 14, fork.y + 48);
  g.strokePath();
}
