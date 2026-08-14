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
  carveThickPath,
  inBounds,
  makeColorGrid,
  makeGrid,
  nearestWalkable,
  shuffled,
} from './shared';

const SEED_COUNT_MIN = 5;
const SEED_COUNT_MAX = 8;
// One tint per bulk phase, blended 0.6 over the biome's dark void ground by
// the renderer. Every entry is a saturated mid-value hue: distinct from each
// other (adjacent domains must read as different phases at a glance -- that
// contrast IS the world's physics) and all held well darker than the pale
// ice-blue walkable path, so the edge channel between two domains stays the
// brightest thing on screen. No pale or blue-white entries: a domain that
// blends toward the path's own color would read as walkable ground.
const DOMAIN_PALETTE = [0x2fae7d, 0xd96f4e, 0x5b6ed9, 0xc9a83a, 0xb44ac9, 0xc94a6a, 0x7a9a3a, 0x3a7a9a];

export function generateWorld3Map(gridW: number, gridH: number, start: GridPoint): GeneratedMap {
  const goalY = 1;
  const goal = { x: Math.round(gridW / 2) + (Math.random() < 0.5 ? -2 : 2), y: goalY };

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

  // Dilate once so the boundary reads as a real corridor (invariant A) even
  // right at a Voronoi vertex where three-plus domains meet at a point,
  // where the raw one-tile boundary would otherwise pinch to width 1.
  const walkable = makeGrid(gridW, gridH);
  for (let y = 0; y < gridH; y++) {
    for (let x = 0; x < gridW; x++) {
      if (!raw[y][x]) continue;
      walkable[y][x] = true;
      if (inBounds(x + 1, y, gridW, gridH)) walkable[y][x + 1] = true;
      if (inBounds(x - 1, y, gridW, gridH)) walkable[y][x - 1] = true;
      if (inBounds(x, y + 1, gridW, gridH)) walkable[y + 1][x] = true;
      if (inBounds(x, y - 1, gridW, gridH)) walkable[y - 1][x] = true;
    }
  }

  // Splice the three fixed landmark points into the boundary network --
  // none of them is guaranteed to already land on a domain wall.
  const splice = (p: GridPoint) => {
    if (walkable[p.y]?.[p.x]) return;
    const nearest = nearestWalkable(walkable, gridW, gridH, p);
    if (nearest) carveThickPath(walkable, gridW, gridH, p, nearest, 2);
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

  const regionColor = makeColorGrid(gridW, gridH);
  for (let y = 0; y < gridH; y++) {
    for (let x = 0; x < gridW; x++) {
      if (walkable[y][x]) continue;
      regionColor[y][x] = DOMAIN_PALETTE[domainId[y][x] % DOMAIN_PALETTE.length];
    }
  }

  return { walkable, start, goal, mid, regionColor, biomeOverride: makeColorGrid(gridW, gridH) };
}
