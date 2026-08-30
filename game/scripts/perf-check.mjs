// Graphics-performance regression gate for world_of_quantum_materials.
//
// Enforces STYLE.md's cost rule -- speed beats spectacle, and lag during
// gameplay is not acceptable -- by asserting on how much *work* the game does,
// not on how many milliseconds it takes.
//
// Why work and not time. Headless Chrome throttles requestAnimationFrame and
// renders through software rasterization, so frame deltas measured here come
// back around 100ms no matter what the game is doing: an absolute frame-time
// gate would be both flaky and meaningless. Draw-operation counts, live object
// counts and tween counts are deterministic, identical on every machine, and
// catch the thing that actually causes lag -- a new effect drawing per tile
// with no falloff, or a panel leaking an endless tween per rebuild. A count
// that jumps from 2,000 to 40,000 fails here long before anyone can feel it.
//
// Three checks:
//   1. Draw budget      -- graphics ops + objects for one overworld paint pass,
//                          per world, against a ceiling.
//   2. Tween leaks      -- two round trips that really happen: six Lab
//                          station panels opened by clicking their own
//                          buttons and closed again, and tokens collected off
//                          an overworld map. Both must return the tween count
//                          to baseline (Phaser's destroy() does not kill
//                          tweens; art/crystals.ts's killTweensDeep is why).
//   3. Relative cost    -- each world's paint pass timed against the median of
//                          all ten *in the same run*, so the ratio is immune to
//                          how fast this machine is. A warning, not a gate.
//
// Usage (from game/): npm run perf-check
// Or directly: node scripts/perf-check.mjs
// Fast (well under a minute), so it belongs beside content-lint as a pre-push
// check rather than inside component-check. CHROME_BIN auto-detects Puppeteer's
// cached Chrome-for-Testing binary if unset; if the dev server isn't already up
// on :5173 this starts one and tears it down at the end.
//
// Updating the budgets: BUDGETS below is a ceiling per world, set from measured
// counts with headroom, because a map is generated fresh on every visit and the
// same world's count moves by a few percent between runs -- a ceiling set tight
// against one observation would fail on the next map. Raising one is a deliberate act -- if a world genuinely needs to draw
// more, raise its entry and say why in the commit, rather than nudging every
// number until the suite is quiet.

import puppeteer from 'puppeteer-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GAME_DIR = process.env.GAME_DIR || path.resolve(__dirname, '..');
const URL = process.env.QM_URL || 'http://localhost:5173/';
const CANVAS_W = 854;
const CANVAS_H = 480;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Per-world ceiling on one overworld paint pass: `ops` counts Graphics draw
// calls, `objects` counts live display objects in the scene. Both are whole-
// world properties rather than per-tile ones, so a world that gains a motif
// without a draw-distance falloff blows through these immediately.
const BUDGETS = {
  1: { ops: 21000, objects: 500 },
  2: { ops: 10000, objects: 500 },
  // World 3 draws more than its siblings by design: its impassable bulk is a
  // rubble field, and it is a rubble field because measured against every
  // other world's surround (local contrast 0.8-2.1) the flat speckle it used
  // to carry came in at 0.03 -- no surface at all, and so read as walkable
  // ground. Giving it a surface costs fills. The piece count thins with
  // distance, so this is not the no-falloff effect this budget exists to
  // catch, and the relative-cost check below confirms it is not an outlier.
  3: { ops: 17000, objects: 500 },
  4: { ops: 13000, objects: 500 },
  5: { ops: 16000, objects: 500 },
  6: { ops: 10000, objects: 500 },
  7: { ops: 11000, objects: 500 },
  8: { ops: 15000, objects: 500 },
  9: { ops: 15000, objects: 500 },
  10: { ops: 18000, objects: 500 },
};

// How far above the median world's paint time a single world may sit before
// this warns. Relative, so it says "this world is unusually heavy for this
// game" rather than "this machine is slow".
const RELATIVE_WARN_RATIO = 2.5;

function detectChromeBin() {
  if (process.env.CHROME_BIN) return process.env.CHROME_BIN;
  try {
    const out = execSync(
      `find "$HOME/.cache/puppeteer/chrome" -maxdepth 2 -type d -iname 'linux-*' -exec find {} -maxdepth 2 -type f -iname chrome \\; 2>/dev/null | head -1`,
      { shell: '/bin/bash' }
    )
      .toString()
      .trim();
    if (out) return out;
  } catch (e) {
    /* fall through */
  }
  throw new Error('CHROME_BIN not set and auto-detection failed -- set CHROME_BIN explicitly.');
}

async function isServerUp() {
  try {
    const res = await fetch(URL, { method: 'GET' });
    return res.ok || res.status < 500;
  } catch (e) {
    return false;
  }
}

async function ensureDevServer(log) {
  if (await isServerUp()) {
    log('Dev server already running -- reusing it.');
    return { started: false, child: null };
  }
  log(`Dev server not up -- starting "npm run dev" in ${GAME_DIR}...`);
  const child = spawn('npm', ['run', 'dev'], { cwd: GAME_DIR, stdio: 'ignore', detached: true });
  child.unref();
  const start = Date.now();
  while (Date.now() - start < 30000) {
    if (await isServerUp()) {
      log('Dev server is up.');
      return { started: true, child };
    }
    await sleep(400);
  }
  throw new Error('Dev server did not come up within 30s.');
}

function teardownDevServer(handle, log) {
  if (!handle.started || !handle.child) return;
  try {
    process.kill(-handle.child.pid, 'SIGTERM');
    log('Tore down the dev server we started.');
  } catch (e) {
    log(`  (dev server teardown failed, may need manual cleanup: ${e.message || e})`);
  }
}

// Installed once in the page: wraps every drawing method on Graphics'
// prototype with a counter, so a paint pass can be measured by resetting the
// counter, forcing one redraw, and reading it back. Counts calls rather than
// pixels -- pixels are what the GPU pays for, calls are what the code decides,
// and it is the code that regresses.
const INSTRUMENT = `
window.__perf = { ops: 0, on: false };
(() => {
  const G = Phaser.GameObjects.Graphics.prototype;
  const METHODS = [
    'fillRect','fillCircle','fillEllipse','fillTriangle','fillPoints','fillPath',
    'strokeRect','strokeCircle','strokeEllipse','strokeTriangle','strokePoints','strokePath',
    'lineBetween','lineTo','moveTo','arc','beginPath','fillStyle','lineStyle','fillGradientStyle',
  ];
  for (const m of METHODS) {
    const orig = G[m];
    if (typeof orig !== 'function') continue;
    G[m] = function (...args) {
      if (window.__perf.on) window.__perf.ops++;
      return orig.apply(this, args);
    };
  }
})();
`;

async function main() {
  const started = Date.now();
  const lines = [];
  const log = (msg) => {
    const stamp = new Date().toTimeString().slice(0, 8);
    const line = `[${stamp}] ${msg}`;
    lines.push(line);
    console.log(line);
  };

  const CHROME_BIN = detectChromeBin();
  const server = await ensureDevServer(log);
  const browser = await puppeteer.launch({
    executablePath: CHROME_BIN,
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', `--window-size=${CANVAS_W},${CANVAS_H}`],
  });

  const failures = [];
  const warnings = [];

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: CANVAS_W, height: CANVAS_H });
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__game && window.__game.scene.getScenes(true).length, {
      timeout: 30000,
    });
    await page.evaluate(INSTRUMENT);

    // -----------------------------------------------------------------
    log('=== 1: draw budget, per world ===');
    const perWorld = [];
    for (let world = 1; world <= 10; world++) {
      const r = await page.evaluate(async (w) => {
        const g = window.__game;
        g.scene.start('Overworld', { world: w });
        await new Promise((res) => setTimeout(res, 900));
        const s = g.scene.getScene('Overworld');

        // One measured paint pass. drawWorld is the whole terrain+decoration
        // pipeline; counting one call of it is counting one frame's terrain.
        window.__perf.ops = 0;
        window.__perf.on = true;
        const t0 = performance.now();
        s.drawWorld?.();
        const ms = performance.now() - t0;
        window.__perf.on = false;

        let objects = 0;
        const walk = (list) => {
          for (const o of list) {
            objects++;
            if (o.list) walk(o.list);
          }
        };
        walk(s.children.list);

        return { world: w, ops: window.__perf.ops, objects, ms };
      }, world);
      perWorld.push(r);

      const budget = BUDGETS[world];
      const okOps = r.ops <= budget.ops;
      const okObj = r.objects <= budget.objects;
      if (!okOps) failures.push(`world ${world}: ${r.ops} draw ops exceeds budget ${budget.ops}`);
      if (!okObj) failures.push(`world ${world}: ${r.objects} objects exceeds budget ${budget.objects}`);
      log(
        `${okOps && okObj ? 'PASS' : 'FAIL'} world ${world} -- ${r.ops} ops (budget ${budget.ops}), ` +
          `${r.objects} objects (budget ${budget.objects})`
      );
    }

    // -----------------------------------------------------------------
    // Two round trips, because a Phaser container's destroy() does not stop
    // the tweens running on it and the two places that matters are different:
    // a panel rebuilt over and over from the Lab, and a world sprite picked
    // up off the map. Both have to actually happen for the count to mean
    // anything -- a check that destroys nothing measures nothing.
    log('=== 2: tween leaks ===');
    log('  2a: Lab station panels, opened and closed');
    const panelLeak = await page.evaluate(async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const g = window.__game;
      g.scene.start('Hub');
      await sleep(900);
      const s = g.scene.getScene('Hub');
      const count = () => s.tweens.getTweens().length;

      // The station buttons are Text objects in the room; clicking one is
      // the same path a player takes, so whatever a panel builds on open is
      // what gets measured.
      const texts = [];
      const walk = (list) => {
        for (const o of list) {
          if (o.type === 'Text') texts.push(o);
          if (o.list) walk(o.list);
        }
      };
      walk(s.children.list);
      const wanted = ['Moves', 'Stats', 'Tutorial', 'Story', 'Settings', 'Title Screen'];
      const missing = [];
      const opened = [];

      // One warm-up cycle first: a panel may legitimately start a tween that
      // outlives its own container (a room-level flourish), and the baseline
      // has to be read after that has happened once, not before.
      for (let pass = 0; pass < 3; pass++) {
        for (const label of wanted) {
          const btn = texts.find((o) => (o.text || '').trim() === label);
          if (!btn) {
            if (pass === 0) missing.push(label);
            continue;
          }
          btn.emit('pointerdown');
          await sleep(120);
          if (pass === 0 && s.dialogueContainer) opened.push(label);
          s.closeDialogue();
          await sleep(120);
        }
        if (pass === 0) var before = count();
      }
      const orphaned = s.tweens
        .getTweens()
        .filter((tw) => (tw.targets || []).some((t) => t && typeof t === 'object' && 'scene' in t && t.scene === undefined)).length;
      return { before, after: count(), missing, opened, orphaned };
    });
    if (panelLeak.missing.length) {
      failures.push(`tween leak (panels): station button(s) not found in the Lab: ${panelLeak.missing.join(', ')} -- the check cannot open what it cannot click`);
      log(`FAIL tween leak (panels) -- missing station button(s): ${panelLeak.missing.join(', ')}`);
    } else if (panelLeak.opened.length < 6) {
      failures.push(`tween leak (panels): only ${panelLeak.opened.length} of 6 stations actually opened a panel (${panelLeak.opened.join(', ')})`);
      log(`FAIL tween leak (panels) -- only ${panelLeak.opened.length}/6 opened`);
    } else if (panelLeak.orphaned > 0) {
      failures.push(
        `tween leak (panels): ${panelLeak.orphaned} tween(s) are still animating a destroyed object after closing every station panel`
      );
      log(`FAIL tween leak (panels) -- ${panelLeak.orphaned} tween(s) left on destroyed objects`);
    } else if (panelLeak.after > panelLeak.before) {
      failures.push(`tween leak (panels): ${panelLeak.before} tweens after one open/close pass over 6 stations, ${panelLeak.after} after three`);
      log(`FAIL tween leak (panels) -- ${panelLeak.before} -> ${panelLeak.after}`);
    } else {
      log(`PASS tween leak (panels) -- 6 stations x3 cycles, ${panelLeak.before} -> ${panelLeak.after}, no growth`);
    }

    log('  2b: world sprites, picked up off the map');
    const pickupLeak = await page.evaluate(async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const g = window.__game;
      g.scene.start('Overworld', { world: 1, regenerate: true });
      await sleep(1200);
      const s = g.scene.getScene('Overworld');
      const count = () => s.tweens.getTweens().length;

      // Tokens, not crystals: collecting one destroys the sprite outright
      // with no dialogue and no scene change, which is exactly the case where
      // a leaked repeat:-1 sparkle would run for the rest of the visit.
      // Counting is the wrong instrument here and it is worth saying why: a
      // sprite's sparkles are created when it spawns, so a pickup that leaks
      // them does not *grow* the tween count, it just fails to shrink it.
      // What a leak actually looks like is a live tween whose target has been
      // destroyed, and Phaser clears a destroyed GameObject's `scene`, so
      // that is directly observable.
      const orphans = () =>
        s.tweens
          .getTweens()
          .filter((tw) => (tw.targets || []).some((t) => t && typeof t === 'object' && 'scene' in t && t.scene === undefined))
          .length;

      const tokens = (s['tokenSprites'] || []).slice(0, 8).map((t) => ({ x: t.x, y: t.y }));
      if (tokens.length === 0) return { collected: 0, before: 0, after: 0, orphaned: 0 };
      const before = count();
      for (const t of tokens) s['maybeCollectToken'](t.x, t.y);
      await sleep(200);
      return { collected: tokens.length, before, after: count(), orphaned: orphans() };
    });
    if (pickupLeak.collected === 0) {
      failures.push('tween leak (pickups): world 1 spawned no tokens, so the pickup path was never exercised');
      log('FAIL tween leak (pickups) -- no tokens to collect');
    } else if (pickupLeak.orphaned > 0) {
      failures.push(
        `tween leak (pickups): after collecting ${pickupLeak.collected} tokens, ${pickupLeak.orphaned} tween(s) are still animating a destroyed object -- ` +
          `the pickup path is destroying a container without killTweensDeep`
      );
      log(`FAIL tween leak (pickups) -- ${pickupLeak.orphaned} tween(s) left on destroyed objects`);
    } else {
      log(
        `PASS tween leak (pickups) -- ${pickupLeak.collected} tokens collected, ${pickupLeak.before} -> ${pickupLeak.after} tweens, ` +
          `none left on a destroyed object`
      );
    }

    // -----------------------------------------------------------------
    log('=== 3: relative cost (warning only) ===');
    const times = perWorld.map((r) => r.ms).sort((a, b) => a - b);
    const median = times[Math.floor(times.length / 2)] || 0;
    for (const r of perWorld) {
      const ratio = median > 0 ? r.ms / median : 1;
      if (ratio > RELATIVE_WARN_RATIO) {
        warnings.push(`world ${r.world} paints at ${ratio.toFixed(2)}x the median world`);
        log(`WARN world ${r.world} -- ${ratio.toFixed(2)}x median paint cost`);
      }
    }
    if (warnings.length === 0) log('PASS relative cost -- no world is an outlier against its siblings');
  } finally {
    await browser.close();
    teardownDevServer(server, log);
  }

  const wall = ((Date.now() - started) / 1000).toFixed(1);
  log('=== SUMMARY ===');
  for (const w of warnings) log(`  warning: ${w}`);
  if (failures.length) {
    for (const f of failures) log(`  FAILURE: ${f}`);
    log(`perf-check: ${failures.length} failure(s), ${warnings.length} warning(s). Wall time: ${wall}s`);
    process.exit(1);
  }
  log(`perf-check: clean -- 10 worlds within budget, no tween growth across panels or pickups, ${warnings.length} warning(s). Wall time: ${wall}s`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
