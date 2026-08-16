// World 3 (topological band theory, protected edge states): the grid is
// partitioned into several colored "domains" (a Voronoi cell per random
// seed point -- each domain a distinct bulk topological phase), and the
// only walkable ground is the boundary strip between two domains of
// different color -- the player only ever travels along a domain wall,
// never through a domain's own interior, the same way a protected edge
// state only lives at the boundary between two topologically distinct
// bulk phases. `start`/`goal`/`mid` are spliced into that boundary network
// with a short carved connector wherever a domain interior happens to sit
// on top of them.

import {
  GeneratedMap,
  GridPoint,
  WorldScale,
  carveThickPath,
  inBounds,
  makeColorGrid,
  makeGrid,
  nearestWalkable,
  shuffled,
} from './shared';

// How many bulk phases the world is partitioned into -- a count, so it is the
// same at every world size and the domains themselves grow with the map. A
// bigger world is a coarser phase diagram walked further, not a finer one.
//
// This world is deliberately the narrow one. The edge state is the only place
// you can stand, and widening the seam into a field would say the bulk is
// walkable, which is the opposite of what bulk-boundary correspondence means.
// So what opens this world up is the *number* of seams rather than their
// width: a finely divided phase diagram is a network of walls with junctions
// in it, and at a junction the player genuinely chooses which boundary to
// follow north. Freedom without a single extra tile of walkable bulk.
const SEED_COUNT_MIN = 8;
const SEED_COUNT_MAX = 11;
// How wide the edge channel between two domains is opened to, in tiles. The
// raw Voronoi boundary is one tile, so this is delivered by dilating it -- see
// the dilation pass below.
const EDGE_WIDTH = 3;
// One tint per bulk phase, blended 0.6 over the biome's own ground by the
// renderer, and the tint is *information*: it is how the player tells one
// phase from the next, and how the surround knows how much rubble to stand up
// on a tile (materials/deadFloor.ts reads the invariant back out of it).
//
// The palette is grouped by topological invariant, three entries to a group,
// so a tint's index carries both which domain it is and what that domain's
// invariant is. Every entry is dark and desaturated, well under the lit seam
// the player walks: a gapped bulk is matter that is present, extended and
// inert, so it is drawn dead against the one live thing in the world. Two
// families, teal and ochre, interleaved within each group so adjacent domains
// reliably differ -- they must, since the only walkable ground here is the
// boundary where two different ones meet, and a seam with no change across it
// would leave the player navigating by nothing.
const DOMAIN_PALETTE = [
  // invariant 0 -- trivial
  0x3f5a55, 0x6b5a3c, 0x4a6b63,
  // invariant 1
  0x7d6a47, 0x35504c, 0x5a4c33,
  // invariant 2
  0x557a70, 0x8a7454, 0x46605a,
];
// How many bulk phases the palette above describes, per invariant.
const TINTS_PER_INVARIANT = 3;

// The invariant a domain tint stands for -- the renderer's half of the
// convention above, exported so the two cannot drift apart. Returns 0 for a
// tint this world never issued, since an unknown phase is best drawn as the
// trivial one rather than as nothing at all.
export function invariantOfTint(tint: number): number {
  const index = DOMAIN_PALETTE.indexOf(tint);
  return index < 0 ? 0 : Math.floor(index / TINTS_PER_INVARIANT);
}

export function generateWorld3Map(gridW: number, gridH: number, start: GridPoint, scale: WorldScale): GeneratedMap {
  const goalY = 1;
  const goalOffset = scale.tiles(2);
  const goal = { x: Math.round(gridW / 2) + (Math.random() < 0.5 ? -goalOffset : goalOffset), y: goalY };

  const seedCount = SEED_COUNT_MIN + Math.floor(Math.random() * (SEED_COUNT_MAX - SEED_COUNT_MIN + 1));
  const seeds: GridPoint[] = Array.from({ length: seedCount }, () => ({
    x: Math.floor(Math.random() * gridW),
    y: Math.floor(Math.random() * (start.y - goalY + 1)) + goalY,
  }));

  // Nearest-seed assignment (a Euclidean Voronoi partition) -- cheap at this
  // grid size (gridW*gridH*seedCount comparisons) and gives smooth, roughly
  // straight domain walls rather than needing an explicit growth simulation.
  const domainId = Array.from({ length: gridH }, () => Array(gridW).fill(-1));
  for (let y = 0; y < gridH; y++) {
    for (let x = 0; x < gridW; x++) {
      let best = 0;
      let bestDist = Infinity;
      for (let i = 0; i < seeds.length; i++) {
        const dx = x - seeds[i].x;
        const dy = y - seeds[i].y;
        const d = dx * dx + dy * dy;
        if (d < bestDist) {
          bestDist = d;
          best = i;
        }
      }
      domainId[y][x] = best;
    }
  }

  // Raw boundary: any tile with a 4-neighbor in a different domain. Voronoi
  // cell walls are dual to a connected Delaunay triangulation, so this
  // boundary network is itself connected across the whole grid (barring a
  // seed placement degenerate enough to strand a corner, which the retry
  // loop in mapgen.ts catches via the reachability check).
  const raw = makeGrid(gridW, gridH);
  for (let y = 0; y < gridH; y++) {
    for (let x = 0; x < gridW; x++) {
      const here = domainId[y][x];
      const differs =
        (inBounds(x + 1, y, gridW, gridH) && domainId[y][x + 1] !== here) ||
        (inBounds(x - 1, y, gridW, gridH) && domainId[y][x - 1] !== here) ||
        (inBounds(x, y + 1, gridW, gridH) && domainId[y + 1][x] !== here) ||
        (inBounds(x, y - 1, gridW, gridH) && domainId[y - 1][x] !== here);
      if (differs) raw[y][x] = true;
    }
  }

  // Dilate the one-tile boundary out to the world's own edge width, so the
  // seam reads as a real corridor (invariant A) even right at a Voronoi vertex
  // where three-plus domains meet at a point and the raw boundary pinches to
  // width 1. The radius is what the width asks for: a Manhattan-disc dilation
  // by r opens a 2r+1-wide channel, and rounding is generous rather than
  // sparing, since this is the only walkable ground in the world.
  const dilateRadius = Math.max(1, Math.round((scale.tiles(EDGE_WIDTH) - 1) / 2));
  const walkable = makeGrid(gridW, gridH);
  for (let y = 0; y < gridH; y++) {
    for (let x = 0; x < gridW; x++) {
      if (!raw[y][x]) continue;
      for (let dy = -dilateRadius; dy <= dilateRadius; dy++) {
        const span = dilateRadius - Math.abs(dy);
        for (let dx = -span; dx <= span; dx++) {
          if (inBounds(x + dx, y + dy, gridW, gridH)) walkable[y + dy][x + dx] = true;
        }
      }
    }
  }

  // Splice the three fixed landmark points into the boundary network --
  // none of them is guaranteed to already land on a domain wall.
  const splice = (p: GridPoint) => {
    if (walkable[p.y]?.[p.x]) return;
    const nearest = nearestWalkable(walkable, gridW, gridH, p);
    if (nearest) carveThickPath(walkable, gridW, gridH, p, nearest, scale.tiles(2));
    else walkable[p.y][p.x] = true;
  };
  splice(start);
  splice(goal);

  const midY = Math.round((start.y + goalY) / 2);
  let mid: GridPoint | null = null;
  for (let r = 0; r < gridH && !mid; r++) {
    for (const y of [midY - r, midY + r]) {
      if (y < goalY || y > start.y) continue;
      for (const x of shuffled(Array.from({ length: gridW }, (_, i) => i))) {
        if (walkable[y][x]) {
          mid = { x, y };
          break;
        }
      }
      if (mid) break;
    }
  }
  if (!mid) mid = { x: start.x, y: midY };
  splice(mid);

  // A Manhattan disc tapers to a single tile at the far end of its own
  // reach, and an interior domain wall always ends at a Voronoi vertex where
  // the walls branching off it fill that taper back in. A wall running down
  // the very edge of the grid has nothing beside it to do that, so the seam
  // can come out one tile wide there -- and since the seam is the only
  // walkable ground in this world, such a row is a single-file crossing
  // rather than a corridor (invariant A). Widen any row the ground touches on
  // exactly one tile back out to two.
  for (let y = 0; y < gridH; y++) {
    let only = -1;
    let count = 0;
    for (let x = 0; x < gridW && count < 2; x++) {
      if (walkable[y][x]) {
        count++;
        only = x;
      }
    }
    if (count !== 1) continue;
    const partner = only + 1 < gridW ? only + 1 : only - 1;
    if (inBounds(partner, y, gridW, gridH)) walkable[y][partner] = true;
  }

  const regionColor = makeColorGrid(gridW, gridH);
  for (let y = 0; y < gridH; y++) {
    for (let x = 0; x < gridW; x++) {
      if (walkable[y][x]) continue;
      regionColor[y][x] = DOMAIN_PALETTE[domainId[y][x] % DOMAIN_PALETTE.length];
    }
  }

  return { walkable, start, goal, mid, regionColor, biomeOverride: makeColorGrid(gridW, gridH) , featureCores: [] };
}
