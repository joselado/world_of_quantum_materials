// Generates every world's map many times over and independently re-verifies
// DESIGN.md/CODEMAP.md's two mapgen invariants (A: every walkable tile is
// part of an actual >=2-tile-wide block, not single-file; B: `mid` is a
// true articulation point between `start` and `goal`) rather than trusting
// mapgen.ts's own internal retry/verify pass -- a bug inside forceChokepoint
// or verifyChokepoint itself wouldn't be caught by that pass re-checking
// its own work. Every world is checked at every world size the Settings
// station offers, since the size factor multiplies every length the
// generators are written in.
//
// Bundles the generator side with esbuild (already a transitive dependency
// via vite) since those modules are plain TS with no Phaser import, unlike
// most of src/ -- see generators/shared.ts's own module comment. The bundle
// entry is written here rather than being a file in src/: what this script
// needs is mapgen plus the size presets and the scale helper, which is a
// combination only this script wants. Run via `npm run mapgen:check` (or
// directly with `node scripts/mapgen-check.mjs`).

import esbuild from 'esbuild';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const gameDir = path.resolve(__dirname, '..');

const built = await esbuild.build({
  stdin: {
    contents: [
      "export { generateWorldMap } from './src/world/mapgen';",
      "export { worldScale } from './src/world/generators/shared';",
      "export { WORLD_SIZE_PRESETS, gridDimsFor } from './src/data/settings';",
    ].join('\n'),
    resolveDir: gameDir,
    loader: 'ts',
  },
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'es2020',
  write: false,
});

const outFile = path.join(os.tmpdir(), `mapgen-check-${process.pid}-${Date.now()}.mjs`);
fs.writeFileSync(outFile, built.outputFiles[0].text);
const { generateWorldMap, worldScale, gridDimsFor, WORLD_SIZE_PRESETS } = await import(`file://${outFile}`);
fs.unlinkSync(outFile);

// Every size the Lab's Settings station offers (data/settings.ts's
// WORLD_SIZE_PRESETS), not just the default one: the invariants are what make
// a world walkable at all, and a world-size factor multiplies every length a
// generator is written in, so each size is its own geometry to prove.
const SIZES = WORLD_SIZE_PRESETS.map((preset) => {
  const dims = gridDimsFor(preset.factor);
  return {
    label: preset.label,
    scale: worldScale(preset.factor),
    gridW: dims.w,
    gridH: dims.h,
    start: { x: Math.floor(dims.w / 2), y: dims.h - Math.max(2, Math.round(5 * preset.factor)) },
  };
});
const ITERATIONS_PER_WORLD = 400;
const WORLD10_TYPES = [
  'metal',
  'semiconductor',
  'insulator',
  'classicalMagnet',
  'multiferroic',
  'ferroelectric',
  'quantumSpinLiquid',
  'kondoHeavyFermion',
  'superconductor',
  'chernSuperconductor',
  'quantumSpinHall',
  'chernInsulator',
  'fractionalChern',
  'adaptive',
  undefined,
];

function key(x, y) {
  return `${x},${y}`;
}

function reachable(walkable, gridW, gridH, from, to, blocked) {
  const seen = new Set([key(from.x, from.y)]);
  const stack = [from];
  while (stack.length) {
    const cur = stack.pop();
    if (cur.x === to.x && cur.y === to.y) return true;
    for (const [nx, ny] of [
      [cur.x + 1, cur.y],
      [cur.x - 1, cur.y],
      [cur.x, cur.y + 1],
      [cur.x, cur.y - 1],
    ]) {
      if (nx < 0 || nx >= gridW || ny < 0 || ny >= gridH) continue;
      const k = key(nx, ny);
      if (seen.has(k) || blocked?.has(k)) continue;
      if (!walkable[ny]?.[nx]) continue;
      seen.add(k);
      stack.push({ x: nx, y: ny });
    }
  }
  return false;
}

// Invariant A proxy: every walkable tile belongs to some straight run of
// >= 2 consecutive walkable tiles, horizontally or vertically -- a
// best-effort geometric check (see world/generators/shared.ts's own note:
// there's no false-positive-free generic test for "visually >= 2 wide" at
// branch tips/turns without knowing local path direction), reported as a
// rate rather than a hard pass/fail.
function narrowTileFraction(walkable, gridW, gridH) {
  let total = 0;
  let narrow = 0;
  for (let y = 0; y < gridH; y++) {
    for (let x = 0; x < gridW; x++) {
      if (!walkable[y][x]) continue;
      total++;
      const w = (xx, yy) => walkable[yy]?.[xx];
      const hasPair =
        (w(x - 1, y) && w(x, y)) ||
        (w(x, y) && w(x + 1, y)) ||
        (w(x, y - 1) && w(x, y)) ||
        (w(x, y) && w(x, y + 1));
      if (!hasPair) narrow++;
    }
  }
  return total === 0 ? 0 : narrow / total;
}

let failures = 0;
let totalNarrowFrac = 0;
let totalMaps = 0;

for (const size of SIZES) {
  const { gridW: GRID_W, gridH: GRID_H, start: START } = size;
  for (let world = 1; world <= 10; world++) {
  const types = world === 10 ? WORLD10_TYPES : [undefined];
  for (const playerType of types) {
    for (let i = 0; i < ITERATIONS_PER_WORLD; i++) {
      const map = generateWorldMap(GRID_W, GRID_H, START, world, size.scale, playerType);
      totalMaps++;

      const ok = reachable(map.walkable, GRID_W, GRID_H, map.start, map.goal);
      if (!ok) {
        failures++;
        console.error(`FAIL ${size.label} world ${world} (${playerType ?? 'n/a'}) iter ${i}: start cannot reach goal`);
        continue;
      }

      // Not a spec'd invariant, just a quality-of-life sanity check: the
      // guardian shouldn't be standing right on top of (or immediately
      // beside) the goal tile the boss/door occupies. Manhattan distance
      // alone would pass e.g. mid=(x,1)/goal=(x+2,1) -- same row, so
      // forceChokepoint's row-wall makes goal itself sit inside the
      // chokepoint gap -- so also fail outright on a shared row/column with
      // start or goal.
      const midToGoal = Math.abs(map.mid.x - map.goal.x) + Math.abs(map.mid.y - map.goal.y);
      if (midToGoal < 2 || map.mid.y === map.goal.y || map.mid.y === map.start.y) {
        failures++;
        console.error(`FAIL ${size.label} world ${world} (${playerType ?? 'n/a'}) iter ${i}: mid too close to goal/start (dist ${midToGoal}, mid.y=${map.mid.y}, goal.y=${map.goal.y}, start.y=${map.start.y})`);
      }

      const blocked = new Set([key(map.mid.x, map.mid.y)]);
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        blocked.add(key(map.mid.x + dx, map.mid.y + dy));
      }
      const stillReachable = reachable(map.walkable, GRID_W, GRID_H, map.start, map.goal, blocked);
      if (stillReachable) {
        failures++;
        console.error(`FAIL ${size.label} world ${world} (${playerType ?? 'n/a'}) iter ${i}: goal still reachable with mid removed -- not a real chokepoint`);
      }

      totalNarrowFrac += narrowTileFraction(map.walkable, GRID_W, GRID_H);
    }
  }
  }
  console.log(`${size.label} (${GRID_W}x${GRID_H}): done.`);
}

console.log(
  `Checked ${totalMaps} generated maps across all 10 worlds (World 10 across ${WORLD10_TYPES.length} player types) at ${SIZES.length} world sizes.`
);
console.log(`Average narrow-tile fraction (invariant A proxy, lower is better): ${((totalNarrowFrac / totalMaps) * 100).toFixed(2)}%`);
if (failures > 0) {
  console.error(`${failures} invariant failure(s).`);
  process.exit(1);
}
console.log('All maps passed reachability + chokepoint (invariant B) verification.');
