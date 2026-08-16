// Measures how much ground each world actually gives the player to stand on,
// which is what `MAPSHAPE_BUILD_TASK.md` is written against: a world should
// read as a place the player is standing in rather than a path they are being
// led down, and that turns out to be two measurable things rather than one.
//
//  - **mean row width** -- how much walkable floor an occupied row holds. The
//    Storm Flats' wideness is this number.
//  - **runs/row** -- how many disjoint walkable stretches a row holds, which
//    is what genuine route choice looks like once counted. The Entangled Web's
//    wideness is this number instead, at barely more floor than a corridor.
//
// A redone world is in band at a mean row width of at least 40% of the grid's
// own width, *or* runs/row >= 1.4; worlds 4 and 7 hit one each and both read
// as wide. The width half is a fraction rather than a tile count because a
// world is as wide as it is next to the grid it stands on: the same shape
// measures 8 tiles at Nano and 33 at Macro and is the same world at both.
// `fill` is kept in view as the ceiling rather than a target: WORLDS.md puts
// each world's identity in its impassable surround, so ground taken past World
// 4's ~48% starts eating the only place the world is allowed to look like
// itself.
//
// Deliberately no pass/fail and no exit code -- this is a reading, taken
// before and after a world's shape is changed, not an invariant.
// mapgen-check.mjs is the one that fails a build. Same esbuild-a-bundle
// approach it uses, and for the same reason: the generator side is plain TS
// with no Phaser import. Run via `npm run mapshape:measure`.

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
      "export { worldScale, reachableGround } from './src/world/generators/shared';",
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

const outFile = path.join(os.tmpdir(), `mapshape-measure-${process.pid}-${Date.now()}.mjs`);
fs.writeFileSync(outFile, built.outputFiles[0].text);
const { generateWorldMap, worldScale, reachableGround, gridDimsFor, WORLD_SIZE_PRESETS } = await import(`file://${outFile}`);
fs.unlinkSync(outFile);

const SAMPLES = 60;
// Which size to read at. Meso by default, since the band in the build task is
// quoted at Meso; pass a preset label to read another.
const wanted = (process.argv[2] ?? 'Meso').toLowerCase();
const preset = WORLD_SIZE_PRESETS.find((p) => p.label.toLowerCase() === wanted) ?? WORLD_SIZE_PRESETS[1];
const scale = worldScale(preset.factor);
const { w: gridW, h: gridH } = gridDimsFor(preset.factor);
// The tile OverworldScene actually drops the player on, not the grid's own
// corner: a world's shape is only what it is from where it is entered, and
// World 2's own history is that reading it from the wrong row said something
// entirely different about it.
const start = { x: Math.floor(gridW / 2), y: gridH - scale.tiles(5) };

function measure(world) {
  let fill = 0;
  let spanTotal = 0;
  let runsTotal = 0;
  let rowsTotal = 0;
  let offRoute = 0;
  const widths = [];

  for (let s = 0; s < SAMPLES; s++) {
    const map = generateWorldMap(gridW, gridH, start, world, scale, undefined);
    const ground = reachableGround(map.walkable, gridW, gridH, map.start);
    let walkable = 0;
    let reached = 0;

    for (let y = 0; y < gridH; y++) {
      let count = 0;
      let runs = 0;
      let min = Infinity;
      let max = -1;
      let prev = false;
      for (let x = 0; x < gridW; x++) {
        const open = map.walkable[y][x];
        if (ground[y][x]) reached++;
        if (open) {
          count++;
          if (x < min) min = x;
          if (x > max) max = x;
          if (!prev) runs++;
        }
        prev = open;
      }
      walkable += count;
      if (count === 0) continue;
      widths.push(count);
      spanTotal += max - min + 1;
      runsTotal += runs;
      rowsTotal++;
    }

    fill += walkable / (gridW * gridH);
    // Ground the chokepoint's row wall severed from the route -- scenery the
    // player can see and never walk to, which every placer already skips.
    offRoute += walkable ? 1 - reached / walkable : 0;
  }

  widths.sort((a, b) => a - b);
  return {
    fill: (100 * fill) / SAMPLES,
    mean: widths.reduce((a, b) => a + b, 0) / widths.length,
    median: widths[Math.floor(widths.length / 2)],
    span: spanTotal / rowsTotal,
    runs: runsTotal / rowsTotal,
    offRoute: (100 * offRoute) / SAMPLES,
  };
}

const WIDE_FRACTION = 0.4;
const MULTIPLE_ROUTES = 1.4;

console.log(`${preset.label} (${gridW}x${gridH}), start (${start.x}, ${start.y}), ${SAMPLES} maps per world\n`);
console.log('world   fill%   mean   of grid   span   runs/row   off-route%   in band');
for (let world = 1; world <= 10; world++) {
  const r = measure(world);
  const fraction = r.mean / gridW;
  console.log(
    String(world).padEnd(7) +
      r.fill.toFixed(1).padStart(5) +
      r.mean.toFixed(1).padStart(7) +
      `${(100 * fraction).toFixed(0)}%`.padStart(10) +
      r.span.toFixed(1).padStart(7) +
      r.runs.toFixed(2).padStart(11) +
      r.offRoute.toFixed(1).padStart(13) +
      (fraction >= WIDE_FRACTION || r.runs >= MULTIPLE_ROUTES ? '   yes' : '   no')
  );
}
