// Procedural overworld layout: a wide walkable "corridor" from the player's
// start tile to a goal row near the far edge of the grid, whose center drifts
// left/right as it goes (the turns), plus a handful of short dead-end
// branches forking off its edges. Regenerated (fresh Math.random calls)
// every time a fresh map is requested, so the map is a little different each
// time the game loads -- and identical in shape for every world, since only
// the biome skin (see art/biomes.ts) differs per world.

import { pickTokenValue } from '../data/tokens';

export interface GridPoint {
  x: number;
  y: number;
}

export interface CorridorRow {
  y: number;
  left: number;
  right: number;
}

export interface WorldMap {
  walkable: boolean[][]; // [y][x] -- corridor tiles and branch tiles
  tokens: number[][]; // [y][x] -- qumatoken value at the dead end of each branch, 0 = none
  rows: CorridorRow[]; // corridor rows start-to-goal, for row-based encounter placement
  start: GridPoint;
  goal: GridPoint;
}

const CORRIDOR_HALF_WIDTH = 3; // corridor is 2*half+1 = 7 tiles wide
const MIN_STRAIGHT_ROWS = 2;
const DRIFT_CHANCE = 0.45;
const BRANCH_CHANCE = 0.14;
const MIN_BRANCH_LEN = 3;
const MAX_BRANCH_LEN = 6;

function key(x: number, y: number): string {
  return `${x},${y}`;
}

function makeGrid(gridW: number, gridH: number): boolean[][] {
  return Array.from({ length: gridH }, () => Array(gridW).fill(false));
}

function makeNumberGrid(gridW: number, gridH: number): number[][] {
  return Array.from({ length: gridH }, () => Array(gridW).fill(0));
}

function shuffled<T>(arr: T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// A band, narrow relative to the grid, whose center wanders left/right as it
// climbs toward the goal row -- deliberately narrow/frequent enough that
// walking straight (holding just one direction key) eventually runs off the
// edge of the corridor, forcing the player to actually track the bend
// sideways to keep making forward progress, rather than being able to reach
// the goal in a straight line.
function buildCorridor(start: GridPoint, gridW: number, goalY: number): CorridorRow[] {
  const minCenter = CORRIDOR_HALF_WIDTH;
  const maxCenter = gridW - 1 - CORRIDOR_HALF_WIDTH;
  const rows: CorridorRow[] = [];

  let center = Math.min(maxCenter, Math.max(minCenter, start.x));
  let y = start.y;
  let straight = 0;

  while (true) {
    const left = Math.max(0, center - CORRIDOR_HALF_WIDTH);
    const right = Math.min(gridW - 1, center + CORRIDOR_HALF_WIDTH);
    rows.push({ y, left, right });
    if (y <= goalY) break;

    if (straight >= MIN_STRAIGHT_ROWS && Math.random() < DRIFT_CHANCE && minCenter < maxCenter) {
      const dir = Math.random() < 0.5 ? -1 : 1;
      const step = Math.random() < 0.3 ? 2 : 1;
      center = Math.min(maxCenter, Math.max(minCenter, center + dir * step));
      straight = 0;
    } else {
      straight += 1;
    }
    y -= 1;
  }

  return rows;
}

// Short, mostly-straight self-avoiding walk off a corridor edge tile that
// never rejoins the corridor (or any other branch) -- a dead end by
// construction, since `occupied` already contains every corridor and
// previously-built branch tile, so the walk can only head outward.
function buildBranch(root: GridPoint, gridW: number, gridH: number, occupied: Set<string>): GridPoint[] {
  const length = MIN_BRANCH_LEN + Math.floor(Math.random() * (MAX_BRANCH_LEN - MIN_BRANCH_LEN + 1));
  const dirs = shuffled([
    { dx: 1, dy: 0 },
    { dx: -1, dy: 0 },
    { dx: 0, dy: -1 },
    { dx: 0, dy: 1 },
  ]);
  const cells: GridPoint[] = [];
  let { x, y } = root;

  for (let i = 0; i < length; i++) {
    let moved = false;
    for (const d of dirs) {
      const nx = x + d.dx;
      const ny = y + d.dy;
      if (nx < 0 || nx > gridW - 1 || ny < 0 || ny >= gridH) continue;
      if (occupied.has(key(nx, ny))) continue;
      x = nx;
      y = ny;
      cells.push({ x, y });
      occupied.add(key(x, y));
      moved = true;
      break;
    }
    if (!moved) break;
    if (Math.random() < 0.4) dirs.reverse();
  }

  return cells;
}

export function generateWorldMap(gridW: number, gridH: number, start: GridPoint): WorldMap {
  const goalY = 1;
  const rows = buildCorridor(start, gridW, goalY);

  const walkable = makeGrid(gridW, gridH);
  const tokens = makeNumberGrid(gridW, gridH);
  const occupied = new Set<string>();

  rows.forEach((r) => {
    for (let x = r.left; x <= r.right; x++) {
      walkable[r.y][x] = true;
      occupied.add(key(x, r.y));
    }
  });

  rows.forEach((r, i) => {
    if (i < 2 || i > rows.length - 3) return; // no branches right by the start or goal
    (['left', 'right'] as const).forEach((side) => {
      if (Math.random() >= BRANCH_CHANCE) return;
      const edgeX = side === 'left' ? r.left : r.right;
      const branch = buildBranch({ x: edgeX, y: r.y }, gridW, gridH, occupied);
      if (branch.length < 2) return;
      branch.forEach((b) => {
        walkable[b.y][b.x] = true;
      });
      // The qumatoken sits at the dead end, not scattered along the branch --
      // an explicit reason to walk all the way to the end rather than turning
      // back partway.
      const tip = branch[branch.length - 1];
      tokens[tip.y][tip.x] = pickTokenValue();
    });
  });

  const goalRow = rows[rows.length - 1];
  const goal = { x: Math.round((goalRow.left + goalRow.right) / 2), y: goalRow.y };

  return { walkable, tokens, rows, start, goal };
}
