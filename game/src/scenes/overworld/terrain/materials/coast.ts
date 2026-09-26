import Phaser from 'phaser';
import { blend } from '../../../../art/colors';
import { LANE_PX } from '../../../../art/perspective';
import type { ProjectedPoint } from '../../../../art/perspective';
import { fillPolygon } from '../../../../art/shapes';
import { isSeaTint } from '../../../../world/generators/world6';
import { TILE_SCALE } from '../../projection';
import type { AccentTile } from '../types';

// 'coast' (the Broken Coast, world 6): the two impassable surrounds of a
// coast walked along its beach, told apart by the tile's own region tint
// (world/generators/world6.ts writes SEA_TINT on every tile seaward of the
// beach and nothing on the rock).
//
// **The sea is the ordered medium and the swells are its magnons.** A spin
// wave is a precession passing through an ordered magnet, and seen from
// above its transverse component runs along the wave as a sinusoid: up, then
// down, then up. So the swells rolling in toward the beach are painted as
// travelling bands of the two signs of that component -- red for the spin
// tilted one way, blue for the other -- with a pale crest line where the
// tilt is largest one way and a dark trough line where it is largest the
// other. The bands move, because a magnon does: tip one spin and its
// neighbours lean to follow, and the tilt walks off across the whole sea as
// a wave.
//
// **The rock is the antiferromagnet.** A field of boulders in two greys, one
// per sublattice, each rock the opposite shade of its four neighbours, which
// is Néel order rock for rock: a checkerboard, but made of stone. Every so
// often the checkerboard slips by one rock along a seam: two like rocks meet
// there, and that is an antiferromagnetic domain wall -- an antiphase
// boundary -- drawn as the crack the rock field is broken along.
//
// Both are anchored to the grid (`gx`/`gy`), so a square is the same square
// from every camera position and a crest moves only because time passes.
// Every full-tile wash follows the tile's own outline (`fill`), the smoothed
// shoreline included; the strips a wave is painted in need a plain quad, so
// a shoreline tile takes the wave at its centre as one colour.
//
// The rock stands up off the ground plane the way the Stone Lattice's
// columns and the Mean Fields' trees do: each rock is its tile's outline
// pulled in toward the centre by a different amount at every corner, so it
// is an irregular boulder sitting in its own tile with dark ground showing
// between it and the next, its top lifted by its own height and its front
// faces dropped to the ground, drawn far-to-near so every rock occludes the
// one behind it. The plane itself stays flat (STYLE.md's "Overworld path");
// the height is the sprite's, not the terrain's.
const TILE_PX = TILE_SCALE * LANE_PX;

// The two sublattices. Held close together on purpose -- the pattern is the
// order, not a contrast -- and straddling the biome's own `ground` so the
// checkerboard dissolves into plain rock as the detail pass fades it.
const ROCK_A = 0x1e2328;
const ROCK_B = 0x3d444e;
const WALL = 0x06080a;
const WALL_LIP = 0x6a8f7c;
const FACET = 0x8fb8a0;
// How tall a rock stands, as a fraction of the tile's own width on screen,
// between the lowest and the highest, and how much darker its front faces
// are than its top: the aurora is overhead, so tops are lit and faces are
// not.
const ROCK_HEIGHT_MIN = 0.16;
const ROCK_HEIGHT_MAX = 0.42;
const FACE_SHADE = 0.55;
// How far in from its tile's outline a rock's corners are pulled, at the
// least and the most: the spread is what makes each rock its own shape, and
// the gap it leaves is the crevice the next rock is seen across.
const ROCK_INSET_MIN = 0.7;
const ROCK_INSET_MAX = 0.96;

// Open water under the aurora, and the two signs of the transverse spin the
// swells carry over it.
const SEA = 0x0a1a3a;
const SPIN_UP = 0xc4483a;
const SPIN_DOWN = 0x3d6fd6;
const CREST = 0xe4eeff;
const TROUGH = 0x030810;
// How strongly the two signs colour the water: the sea has to stay water
// underneath, dark and blue-black, with the spin read as light on it.
const SPIN_STRENGTH = 0.65;

// The magnon's wavelength, in tiles, and how long one wavelength takes to
// pass -- a property of the magnet rather than of the map, so it is not
// scaled with the world. The wave runs in toward the beach, so its fronts
// lie along the shore and roll onto it.
const WAVELENGTH = 5;
const PERIOD_MS = 4200;
// The sway that keeps a front from being perfectly straight: small, since a
// spin wave's fronts are plane and the wobble is only what makes water read
// as water. A function of the continuous row so a front joins up across
// tiles.
const SWAY = 0.35;
const swayAt = (y: number) => SWAY * Math.sin(y * 0.7);
// How many strips a tile's wave is painted in near the camera, and the
// detail levels below which fewer are enough.
const STRIPS_NEAR = 4;
const STRIPS_MID_DETAIL = 0.55;
const STRIPS_FAR_DETAIL = 0.3;

function hash(gx: number, gy: number, salt: number): number {
  const v = Math.sin(gx * 41.7 + gy * 289.1 + salt * 13.3) * 43758.5453;
  return v - Math.floor(v);
}

// Where the antiferromagnet's domains lie, as the parity each one's
// checkerboard is offset by. Seams run roughly across the rock every ten rows
// or so and along it far less often, each wandering rather than ruling a line,
// since a domain wall is a surface that finds its own shape.
function domainParity(gx: number, gy: number): number {
  const across = Math.floor((gy + 3 * Math.sin(gx * 0.31) + 0.8 * Math.sin(gx * 1.3)) / 10);
  const along = Math.floor((gx + 2.5 * Math.sin(gy * 0.23)) / 13);
  return (across + along) & 1;
}

function sublattice(gx: number, gy: number): number {
  return (gx + gy + domainParity(gx, gy)) & 1;
}

// The transverse spin at world point (x, y) at this moment: the phase of a
// wave travelling toward the beach (toward smaller x), swayed a little along
// the front.
function spinPhase(x: number, y: number, now: number): number {
  return (Math.PI * 2 * (-x - (now / PERIOD_MS) * WAVELENGTH)) / WAVELENGTH + swayAt(y);
}

// The column a given front (a crest at `offset` 0, a trough at
// WAVELENGTH / 2) stands on at row y, for the front `n` wavelengths along.
function frontCol(offset: number, n: number, y: number, now: number): number {
  return -(now / PERIOD_MS) * WAVELENGTH - n * WAVELENGTH - offset + (swayAt(y) * WAVELENGTH) / (Math.PI * 2);
}

function lerp(a: ProjectedPoint, b: ProjectedPoint, t: number): ProjectedPoint {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, scale: a.scale + (b.scale - a.scale) * t };
}

export function drawCoastAccent(g: Phaser.GameObjects.Graphics, tile: AccentTile) {
  if (tile.detail <= 0) return;
  if (isSeaTint(tile.regionTint)) drawSea(g, tile);
  else drawRock(g, tile);
}

// A rock's outline: the tile's own, with a vertex added at the middle of
// each side of a plain quad so there are corners to pull, and every vertex
// drawn in toward the centre by its own amount. Nothing crosses the tile's
// outline, so a rock on the beach's boundary still stops at the shoreline.
function boulder(fill: ProjectedPoint[], gx: number, gy: number): ProjectedPoint[] {
  const pts: ProjectedPoint[] = [];
  if (fill.length === 4) {
    for (let i = 0; i < 4; i++) {
      const p = fill[i];
      const q = fill[(i + 1) % 4];
      pts.push(p, lerp(p, q, 0.4 + 0.2 * hash(gx, gy, 30 + i)));
    }
  } else pts.push(...fill);
  let cx = 0;
  let cy = 0;
  for (const p of pts) {
    cx += p.x;
    cy += p.y;
  }
  cx /= pts.length;
  cy /= pts.length;
  return pts.map((p, i) => {
    const inset = ROCK_INSET_MIN + (ROCK_INSET_MAX - ROCK_INSET_MIN) * hash(gx, gy, 40 + i);
    return { x: cx + (p.x - cx) * inset, y: cy + (p.y - cy) * inset, scale: p.scale };
  });
}

function drawRock(g: Phaser.GameObjects.Graphics, tile: AccentTile) {
  const { fill, gx, gy, depth, haze, detail, s } = tile;
  const air = depth * 0.75;
  const lift = (ROCK_HEIGHT_MIN + (ROCK_HEIGHT_MAX - ROCK_HEIGHT_MIN) * hash(gx, gy, 1)) * TILE_PX * s;
  const top = sublattice(gx, gy) ? ROCK_B : ROCK_A;

  // The wall first, on the ground between the rocks, along whichever of this
  // tile's far and left edges a domain boundary runs down (the near and right
  // edges belong to the neighbours on those sides): a wide crack with a lit
  // lip. Only a plain quad has edges to draw along; a tile on the beach's own
  // boundary carries the slip without the crack.
  if (fill.length === 4) {
    const parity = domainParity(gx, gy);
    const crack = (a: ProjectedPoint, b: ProjectedPoint) => {
      g.lineStyle(3 + 4 * s, blend(WALL, haze, air), 0.95 * detail);
      g.lineBetween(a.x, a.y, b.x, b.y);
      g.lineStyle(1, blend(WALL_LIP, haze, air), 0.35 * detail);
      g.lineBetween(a.x, a.y + 2 + 2 * s, b.x, b.y + 2 + 2 * s);
    };
    if (domainParity(gx, gy - 1) !== parity) crack(fill[0], fill[1]);
    if (domainParity(gx - 1, gy) !== parity) crack(fill[0], fill[3]);
  }

  const base = boulder(fill, gx, gy);

  // The front faces: every edge of the outline that runs leftward is on the
  // rock's near side (the outline is wound far-left, far-right, near-right,
  // near-left), and each drops a face from the lifted top to the ground.
  g.fillStyle(blend(blend(top, 0x000000, FACE_SHADE), haze, air), detail);
  for (let i = 0; i < base.length; i++) {
    const p = base[i];
    const q = base[(i + 1) % base.length];
    if (q.x >= p.x - 0.5) continue;
    fillPolygon(g, [p, q, { x: q.x, y: q.y - lift, scale: q.scale }, { x: p.x, y: p.y - lift, scale: p.scale }]);
  }

  // The top, lifted whole, with one facet of it catching the aurora: the far
  // half of the top, drawn again a little lighter, so the rock has a lit
  // side and a shaded one rather than one flat colour.
  const raised = base.map((p) => ({ x: p.x, y: p.y - lift, scale: p.scale }));
  g.fillStyle(blend(top, haze, air), detail);
  fillPolygon(g, raised);
  let cy = 0;
  for (const p of raised) cy += p.y;
  cy /= raised.length;
  const facet = raised.filter((p) => p.y <= cy + 0.5);
  if (facet.length >= 3) {
    g.fillStyle(blend(FACET, haze, air), (0.08 + 0.1 * hash(gx, gy, 2)) * detail);
    fillPolygon(g, facet);
  }
}

function drawSea(g: Phaser.GameObjects.Graphics, tile: AccentTile) {
  const { fill, gx, gy, depth, haze, detail, now, s } = tile;
  const air = depth * 0.75;
  const spinColor = (phase: number) => blend(blend(SEA, blend(SPIN_DOWN, SPIN_UP, 0.5 + 0.5 * Math.cos(phase)), SPIN_STRENGTH), haze, air);

  if (fill.length !== 4) {
    g.fillStyle(spinColor(spinPhase(gx, gy, now)), detail);
    fillPolygon(g, fill);
    return;
  }

  // The tile's left edge lies at world column gx - 0.5 and its right edge at
  // gx + 0.5; each strip is one slice of that run, coloured by the spin at
  // its own centre, so the bands lie along the shore and step in toward it.
  const [fl, fr, nr, nl] = fill;
  const far = gy - 0.5;
  const left = gx - 0.5;
  const strips = detail > STRIPS_MID_DETAIL ? STRIPS_NEAR : detail > STRIPS_FAR_DETAIL ? 2 : 1;
  for (let i = 0; i < strips; i++) {
    const a = i / strips;
    const b = (i + 1) / strips;
    g.fillStyle(spinColor(spinPhase(left + (a + b) / 2, gy, now)), detail);
    fillPolygon(g, [lerp(fl, fr, a), lerp(fl, fr, b), lerp(nl, nr, b), lerp(nl, nr, a)]);
  }

  // The crest and the trough: where the spin tilts furthest the one way, a
  // pale line along the water, and half a wavelength on, where it tilts
  // furthest the other, a dark one. Each front is traced across the tile
  // from its far edge to its near one, through the column it actually
  // stands on at each row, clipped to the tile, so it joins up with the same
  // front in the tiles before and behind and rolls in toward the beach as
  // one line rather than stepping tile by tile.
  const at = (x: number, y: number): ProjectedPoint => lerp(lerp(fl, fr, x - left), lerp(nl, nr, x - left), y - far);
  const front = (offset: number, color: number, alpha: number, width: number) => {
    g.lineStyle(width, blend(color, haze, air), alpha * detail);
    // Every front that can stand inside this tile's column span on any of
    // its rows: the sway moves a front by at most its own bound either way.
    const bound = (SWAY * WAVELENGTH) / (Math.PI * 2);
    const base = frontCol(offset, 0, far, now) - (swayAt(far) * WAVELENGTH) / (Math.PI * 2);
    const nLo = Math.floor((base - bound - (left + 1)) / WAVELENGTH);
    const nHi = Math.ceil((base + bound - left) / WAVELENGTH);
    for (let n = nLo; n <= nHi; n++) {
      const pts: ProjectedPoint[] = [];
      let prev: { x: number; y: number } | null = null;
      for (let k = 0; k <= 2; k++) {
        const y = far + k / 2;
        const cur = { x: frontCol(offset, n, y, now), y };
        if (prev) {
          // The segment prev -> cur, clipped to the tile's column span.
          const dx = cur.x - prev.x;
          let t0 = 0;
          let t1 = 1;
          if (dx !== 0) {
            const ta = (left - prev.x) / dx;
            const tb = (left + 1 - prev.x) / dx;
            t0 = Math.max(0, Math.min(ta, tb));
            t1 = Math.min(1, Math.max(ta, tb));
          } else if (prev.x < left || prev.x > left + 1) {
            t1 = -1;
          }
          if (t1 > t0) {
            if (!pts.length || t0 > 0) pts.push(at(prev.x + dx * t0, prev.y + (cur.y - prev.y) * t0));
            pts.push(at(prev.x + dx * t1, prev.y + (cur.y - prev.y) * t1));
          }
        }
        prev = cur;
      }
      if (pts.length < 2) continue;
      g.beginPath();
      g.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
      g.strokePath();
    }
  };
  front(0, CREST, 0.8, 1.5 + 2 * s);
  front(WAVELENGTH / 2, TROUGH, 0.55, 1 + 2 * s);
}

// The sea as the battle arena's stand. A fight started beside the water
// faces out to sea, so the swells come toward the viewer, and each receding
// row of the stand is one band of the wave rather than a row of separate
// cells: the row is washed in the spin's colour at its own distance out, with
// the crest and trough lines lying along it. `row` counts up from the floor's
// edge, each row two tiles further out.
const STAND_ROW_TILES = 2;

export function drawSeaStandRow(
  g: Phaser.GameObjects.Graphics,
  cell: { top: number; bot: number; left: number; right: number },
  row: number,
  haze: number,
  air: number,
  detail: number,
  now: number
) {
  const near = row * STAND_ROW_TILES;
  const far = near + STAND_ROW_TILES;
  const spinColor = (phase: number) => blend(blend(SEA, blend(SPIN_DOWN, SPIN_UP, 0.5 + 0.5 * Math.cos(phase)), SPIN_STRENGTH), haze, air);
  // Two strips per row, so a band's colour turns over inside the row rather
  // than only between rows.
  for (let i = 0; i < 2; i++) {
    const a = i / 2;
    const b = (i + 1) / 2;
    const yTop = cell.bot + (cell.top - cell.bot) * b;
    const yBot = cell.bot + (cell.top - cell.bot) * a;
    g.fillStyle(spinColor(spinPhase(near + ((a + b) / 2) * STAND_ROW_TILES, 0, now)), detail);
    g.fillRect(cell.left, yTop, cell.right - cell.left, yBot - yTop);
  }
  const line = (offset: number, color: number, alpha: number, width: number) => {
    const base = frontCol(offset, 0, 0, now);
    for (let n = Math.floor((base - far) / WAVELENGTH); n <= Math.ceil((base - near) / WAVELENGTH); n++) {
      const x = base - n * WAVELENGTH;
      if (x < near || x >= far) continue;
      const y = cell.bot + ((cell.top - cell.bot) * (x - near)) / STAND_ROW_TILES;
      g.lineStyle(width, blend(color, haze, air), alpha * detail);
      g.lineBetween(cell.left, y, cell.right, y);
    }
  };
  line(0, CREST, 0.8, 1.5);
  line(WAVELENGTH / 2, TROUGH, 0.55, 1.2);
}
