// Input sweep for the procedural art builders.
//
// Every visual in this game is drawn by a builder function taking data as
// input (art/boss.ts, art/crystals.ts, art/attackEffects.ts, the per-guardian
// avatar files). Almost every call site feeds one of them a fixed,
// hand-checked entry, so a builder that chokes on some particular input is
// invisible until that one input happens to be used. World 10's Adapted is
// the exception and the reason this script exists: it picks a compound at
// random out of the whole roster (BattleScene.transmuteAdapted ->
// allCrystals()) and feeds it straight to makeBossCrystal, so it is the one
// place arbitrary material data reaches an art builder at runtime.
//
// So: call every builder over every input it can legitimately receive, and
// assert nothing throws. The domains are derived from the data tables
// themselves (allCrystals()/WORLD_RIVALS/MOVES at runtime, the CrystalVariant
// and MoveClass unions and the art/ avatar exports parsed out of the source
// here) rather than listed here, so new content is swept the day it lands.
//
// Two failure channels, because the bug this is modeled on had both shapes
// available and only one of them would have been caught by a try/catch:
//
//   1. a try/catch around each individual call, which attributes a
//      synchronous throw to the exact input that caused it; and
//   2. the page's own `pageerror`, which is the only way to see a throw
//      inside a tween/timer callback -- those fire from inside Phaser's game
//      step, long after the builder call returned, and they kill the
//      requestAnimationFrame loop rather than propagating to any caller.
//
// Hosting: the real modules, in a real Phaser scene, in a real browser --
// a blank scene added to the running game and driven through the dev
// server's own module transform (`import('/src/art/boss.ts')`). Phaser can't
// be imported into plain Node at all here (it reads `navigator` at module
// scope), and a stubbed scene object would be measuring the stub rather than
// Phaser. Scene tweens and timers run at `QM_ART_TIMESCALE` so a 5.2-second
// Ultimate sequence still gets played end to end, callbacks and all, without
// costing 5.2 seconds; the run asserts every effect's own impact callback
// actually fired, which is what proves the compression didn't just skip them.
//
// Usage (from game/): npm run art-sweep
//   QM_ART_PORT       dev-server port to use (default 5190)
//   QM_ART_TIMESCALE  tween/timer speed-up for the effect sweep (default 20)
//   QM_ART_BREAK      inject a deliberate fault to prove the sweep can fail:
//                     `sync` casts one effect with a move class that doesn't
//                     exist (channel 1), `async` throws from inside an impact
//                     callback, i.e. from a tween callback (channel 2)
// CHROME_BIN auto-detects Puppeteer's cached Chrome-for-Testing binary if
// unset, same as component-check.mjs. Picks its own port so it never
// disturbs a dev server another session is already running.

import puppeteer from 'puppeteer-core';
import ts from 'typescript';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GAME_DIR = process.env.GAME_DIR || path.resolve(__dirname, '..');
const PORT = process.env.QM_ART_PORT || '5190';
const URL = process.env.QM_URL || `http://localhost:${PORT}/`;
const TIMESCALE = Number(process.env.QM_ART_TIMESCALE || 20);
const BREAK = process.env.QM_ART_BREAK || '';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function detectChromeBin() {
  if (process.env.CHROME_BIN) return process.env.CHROME_BIN;
  const out = execSync(
    `find "$HOME/.cache/puppeteer/chrome" -maxdepth 2 -type d -iname 'linux-*' -exec find {} -maxdepth 2 -type f -iname chrome \\; 2>/dev/null | head -1`,
    { shell: '/bin/bash' }
  )
    .toString()
    .trim();
  if (!out) throw new Error('CHROME_BIN not set and auto-detection failed -- set CHROME_BIN explicitly.');
  return out;
}

async function isServerUp() {
  try {
    const res = await fetch(URL, { method: 'GET' });
    return res.ok || res.status < 500;
  } catch {
    return false;
  }
}

async function ensureDevServer(log) {
  if (await isServerUp()) {
    log(`Dev server already up on ${URL} -- reusing it.`);
    return { started: false, child: null };
  }
  log(`Starting a dev server on port ${PORT}...`);
  const child = spawn('npm', ['run', 'dev', '--', '--port', PORT, '--strictPort'], {
    cwd: GAME_DIR,
    stdio: 'ignore',
    detached: true,
  });
  child.unref();
  const start = Date.now();
  while (Date.now() - start < 40000) {
    if (await isServerUp()) {
      log('Dev server is up.');
      return { started: true, child };
    }
    await sleep(400);
  }
  throw new Error(`Dev server did not come up on port ${PORT} within 40s.`);
}

function teardownDevServer(handle, log) {
  if (!handle.started || !handle.child) return;
  try {
    process.kill(-handle.child.pid, 'SIGTERM');
    log('Tore down the dev server we started.');
  } catch (e) {
    log(`  (teardown failed, may need manual cleanup: ${e.message || e})`);
  }
}

// --- input domains read out of the source ------------------------------
//
// CrystalVariant/MoveClass are TypeScript string-literal unions, erased at
// runtime, so they can't be read off an imported module the way MOVES and
// allCrystals() can -- they're parsed here instead, for the same reason the
// list of avatar builders is: a hardcoded copy would stop covering the day
// someone adds a variant, a class or a guardian.

function unionLiterals(relPath, typeName) {
  const filePath = path.join(GAME_DIR, relPath);
  const sf = ts.createSourceFile(filePath, fs.readFileSync(filePath, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  for (const stmt of sf.statements) {
    if (!ts.isTypeAliasDeclaration(stmt) || stmt.name.getText(sf) !== typeName) continue;
    if (!ts.isUnionTypeNode(stmt.type)) throw new Error(`${typeName} in ${relPath} isn't a union type`);
    return stmt.type.types.map((m) => {
      if (ts.isLiteralTypeNode(m) && ts.isStringLiteralLike(m.literal)) return m.literal.text;
      throw new Error(`${typeName} union member isn't a string literal: ${m.getText(sf)}`);
    });
  }
  throw new Error(`type ${typeName} not found in ${relPath}`);
}

function avatarBuilders() {
  const artDir = path.join(GAME_DIR, 'src/art');
  const out = [];
  for (const file of fs.readdirSync(artDir).sort()) {
    if (!file.endsWith('.ts')) continue;
    const text = fs.readFileSync(path.join(artDir, file), 'utf8');
    for (const m of text.matchAll(/^export function (make\w*Avatar)\s*\(/gm)) {
      out.push({ module: `/src/art/${file}`, fn: m[1] });
    }
  }
  return out;
}

// --- the in-page sweep --------------------------------------------------
//
// Everything below runs inside the browser. `setup` imports the real modules
// through Vite's transform and parks a blank scene to draw into; each phase
// is a separate evaluate so a page error landing during it can be attributed
// to it from the Node side.

async function setup(page, { variants, moveClasses, avatars, timeScale }) {
  return page.evaluate(
    async (variants, moveClasses, avatars, timeScale) => {
      const game = window.__game;
      if (!game) throw new Error('window.__game is missing -- art-sweep needs a dev build.');

      // A blank scene of our own rather than drawing into Title: nothing
      // else is animating in it, so anything that throws came from a
      // builder we called.
      if (!game.scene.getScene('ArtSweep')) game.scene.add('ArtSweep', { create() {} }, true);
      for (const key of ['Title', 'Hub', 'Overworld', 'Battle']) {
        if (game.scene.getScene(key)?.scene.isActive()) game.scene.stop(key);
      }
      const scene = game.scene.getScene('ArtSweep');
      // Ultimate sequences run 5-7 real seconds each; the whole point of a
      // check like this is that it stays cheap enough to run reflexively, so
      // the scene's own clock and tween manager are sped up rather than the
      // sequences being cut short. Every callback still runs, in order.
      scene.tweens.timeScale = timeScale;
      scene.time.timeScale = timeScale;

      const [boss, crystals, effects, materials, ultimates] = await Promise.all([
        import('/src/art/boss.ts'),
        import('/src/art/crystals.ts'),
        import('/src/art/attackEffects.ts'),
        import('/src/data/materials.ts'),
        import('/src/art/attackUltimates.ts'),
      ]);
      const avatarMods = {};
      for (const a of avatars) {
        const mod = await import(/* @vite-ignore */ a.module);
        avatarMods[a.fn] = mod[a.fn];
      }

      // Every material any builder can legitimately be handed: the whole
      // wild roster (what the Adapted picks from), every world's fixed
      // rival, and the player's own starting form.
      const byName = new Map();
      for (const m of materials.allCrystals()) byName.set(m.name, m);
      for (const r of Object.values(materials.WORLD_RIVALS)) if (r) byName.set(r.name, r);
      byName.set(materials.PLAYER_MATERIAL.name, materials.PLAYER_MATERIAL);
      // Majorana's fusions: the material a player actually ends up holding
      // after a fuse, built by the game's own combineMaterials rather than
      // a hand-written stand-in, so the two-parent render path is swept over
      // every recipe the roster admits.
      const pool = materials.allCrystals();
      for (const combo of materials.combinableHybridResults(pool)) {
        const a = pool.find((m) => m.name === combo.a);
        const b = pool.find((m) => m.name === combo.b);
        if (a && b) {
          const fused = materials.combineMaterials(a, b);
          byName.set(`fused:${fused.name}`, fused);
        }
      }

      window.__artSweep = {
        scene,
        boss,
        crystals,
        effects,
        materials,
        ultimates,
        avatarMods,
        avatars,
        variants,
        moveClasses,
        // Every per-move-id shape override the game can supply, plus "no
        // override" -- read off the tables rather than listed, so a new
        // override is swept automatically.
        overrides: [undefined, ...new Set([...Object.values(effects.ANALYTIC_SHAPES), ...Object.values(effects.ULTIMATE_SHAPES)])],
        materialList: [...byName.values()],
        raf: () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
        wait: (ms) => new Promise((r) => setTimeout(r, ms)),
      };

      return {
        materials: byName.size,
        wilds: materials.allCrystals().length,
        variants: variants.length,
        moveClasses: moveClasses.length,
        overrides: window.__artSweep.overrides.length,
        avatars: avatars.length,
        moves: Object.keys(materials.MOVES).length,
      };
    },
    variants,
    moveClasses,
    avatars,
    timeScale
  );
}

// makeBossCrystal / makeCrystal over every material x every variant. Built
// in batches, held alive a couple of frames so their idle tweens actually
// tick, then torn down the way the game tears them down (killTweensDeep +
// destroy) so a thousand `repeat: -1` tweens don't pile up.
async function sweepCrystals(page, batchSize) {
  return page.evaluate(
    async (batchSize) => {
      const S = window.__artSweep;
      const failures = [];
      let built = 0;

      const cases = [];
      for (const m of S.materialList) {
        for (const variant of S.variants) {
          cases.push({ builder: 'makeBossCrystal', name: m.name, variant, color: m.color });
          cases.push({ builder: 'makeCrystal', name: m.name, variant, color: m.color, opts: null });
          cases.push({
            builder: 'makeCrystal',
            name: m.name,
            variant,
            color: m.color,
            opts: { seed: m.name, hybrid: m.hybridParents },
          });
        }
      }

      for (let i = 0; i < cases.length; i += batchSize) {
        const batch = cases.slice(i, i + batchSize);
        const objects = [];
        for (const c of batch) {
          try {
            const obj =
              c.builder === 'makeBossCrystal'
                ? S.boss.makeBossCrystal(S.scene, 30, c.color, c.variant)
                : S.crystals.makeCrystal(S.scene, 30, c.color, c.variant, c.opts ?? undefined);
            objects.push(obj);
            built++;
          } catch (e) {
            failures.push({ input: `${c.builder}(${c.name}, ${c.variant}${c.opts ? ', +opts' : ''})`, error: String(e && e.stack ? e.stack.split('\n')[0] : e) });
          }
        }
        await S.raf();
        for (const obj of objects) {
          S.crystals.killTweensDeep(S.scene, obj);
          obj.destroy(true);
        }
      }
      return { built, total: cases.length, failures };
    },
    batchSize
  );
}

// The ten per-guardian avatar builders. Only scale 1 is reached in game
// today (every scenes/panels/ call site takes the default), but scale is a
// real parameter of every one of these signatures, so it gets swept.
async function sweepAvatars(page) {
  return page.evaluate(async () => {
    const S = window.__artSweep;
    const failures = [];
    let built = 0;
    const objects = [];
    for (const a of S.avatars) {
      for (const scale of [0.6, 1, 1.6]) {
        try {
          const fn = S.avatarMods[a.fn];
          if (typeof fn !== 'function') throw new Error(`${a.fn} is not exported as a function by ${a.module}`);
          objects.push(fn(S.scene, scale));
          built++;
        } catch (e) {
          failures.push({ input: `${a.fn}(scale=${scale})`, error: String(e && e.stack ? e.stack.split('\n')[0] : e) });
        }
      }
    }
    await S.raf();
    await S.wait(120);
    for (const obj of objects) {
      S.crystals.killTweensDeep(S.scene, obj);
      obj.destroy(true);
    }
    return { built, total: S.avatars.length * 3, failures };
  });
}

// Every (move class x shape override x level) an effect can be cast with,
// through all three entry points: playAttackEffect (a real cast, depthOffset
// 0), and playFlightEffect/playTargetEffect (a guardian panel's detail-pane
// preview, which is what a positive depthOffset means -- art/attackFx.ts;
// which of the two a preview uses is decided by whether the shape's real
// cast crosses the field, so both are swept over every shape here rather
// than only over the ones a panel would really route to each). The class list is
// the full MoveClass union rather than each move's own authored class,
// because a tunable move carries whichever class the player retuned it to
// (data/materials.ts's getTunedMoveClass), so any class can arrive at any
// move's shape override.
//
// Every ordinary cast's onImpact and every Ultimate's onComplete is counted:
// an effect that never lands is a battle that never resolves, and counting
// them is also what proves the sped-up clock played the sequences rather
// than dropping them.
async function sweepEffects(page, batchSize, breakMode) {
  return page.evaluate(
    async (batchSize, breakMode) => {
      const S = window.__artSweep;
      const failures = [];

      const cases = [];
      for (const moveClass of S.moveClasses) {
        for (const shapeOverride of S.overrides) {
          for (const level of [0, 3]) {
            cases.push({ entry: 'playAttackEffect', moveClass, shapeOverride, level, depthOffset: 0 });
            cases.push({ entry: 'playFlightEffect', moveClass, shapeOverride, level, depthOffset: 1000 });
            cases.push({ entry: 'playTargetEffect', moveClass, shapeOverride, level, depthOffset: 1000 });
          }
        }
      }

      let expectedCallbacks = 0;
      let firedCallbacks = 0;

      for (let i = 0; i < cases.length; i += batchSize) {
        const batch = cases.slice(i, i + batchSize);
        let waitMs = 0;
        for (const c of batch) {
          const shape = S.effects.resolveAttackShape(c.moveClass, c.shapeOverride);
          const isUltimate = shape === 'meteor' || shape === 'nova';
          const flies = S.effects.travelsAcrossField(shape);
          const dur =
            c.entry === 'playAttackEffect' || (c.entry === 'playFlightEffect' && flies)
              ? S.effects.attackEffectTotalDurationMs(shape, c.level)
              : S.effects.targetEffectTotalDurationMs(shape, c.level);
          waitMs = Math.max(waitMs, dur);
          const from = S.effects.fixedAnchor(180, 240);
          const to = S.effects.fixedAnchor(600, 200);
          try {
            const moveClass = breakMode === 'sync' && c === cases[0] ? 'no-such-quasiparticle' : c.moveClass;
            if (c.entry === 'playAttackEffect') {
              // onImpact fires for every shape; onComplete only for the
              // Ultimates, which are the ones whose animation gates the turn.
              expectedCallbacks++;
              S.effects.playAttackEffect(
                S.scene,
                moveClass,
                from,
                to,
                () => {
                  firedCallbacks++;
                  if (breakMode === 'async' && c === cases[0]) throw new Error('QM_ART_BREAK async fault');
                },
                1,
                c.shapeOverride,
                undefined,
                false,
                c.depthOffset,
                c.level
              );
            } else if (c.entry === 'playFlightEffect') {
              // No callback of its own: a preview never gates anything on
              // the effect landing, and a non-travelling shape handed to
              // this entry point falls through to playTargetEffect inside.
              S.effects.playFlightEffect(S.scene, moveClass, from, to, c.shapeOverride, c.depthOffset, c.level);
            } else if (isUltimate) {
              expectedCallbacks++;
              S.effects.playTargetEffect(S.scene, moveClass, to, c.shapeOverride, () => {
                firedCallbacks++;
                if (breakMode === 'async' && c === cases[0]) throw new Error('QM_ART_BREAK async fault');
              }, c.depthOffset, c.level);
            } else {
              S.effects.playTargetEffect(S.scene, moveClass, to, c.shapeOverride, undefined, c.depthOffset, c.level);
            }
          } catch (e) {
            failures.push({
              input: `${c.entry}(${c.moveClass}, override=${c.shapeOverride ?? 'none'}, level=${c.level})`,
              error: String(e && e.stack ? e.stack.split('\n')[0] : e),
            });
          }
        }
        // The scene's clock and tweens run `timeScale` times faster, so the
        // wall-clock wait is the effect's own nominal duration divided by it.
        await S.wait(waitMs / S.scene.time.timeScale + 250);
      }

      // The per-batch wait is the effects' own nominal duration over the
      // sped-up clock, which a loaded machine can overrun by a frame or two.
      // Settle before reading the counters, so "a callback never fired" means
      // that and not "the box was busy" -- a flaky assertion is one nobody
      // trusts.
      for (let i = 0; i < 25 && firedCallbacks < expectedCallbacks; i++) await S.wait(200);

      S.effects.cancelPreviewFx();
      return { total: cases.length, failures, expectedCallbacks, firedCallbacks };
    },
    batchSize,
    breakMode
  );
}

// --- driver -------------------------------------------------------------

async function main() {
  const t0 = Date.now();
  const log = (msg) => console.log(msg);
  if (BREAK) log(`!! QM_ART_BREAK=${BREAK} -- a deliberate fault is injected; this run is a sensitivity control, not a check.`);

  const variants = unionLiterals('src/data/types.ts', 'CrystalVariant');
  const moveClasses = unionLiterals('src/data/types.ts', 'MoveClass');
  const avatars = avatarBuilders();

  const CHROME_BIN = detectChromeBin();
  const serverHandle = await ensureDevServer(log);

  const browser = await puppeteer.launch({
    executablePath: CHROME_BIN,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required', '--mute-audio'],
    headless: true,
  });

  const pageErrors = [];
  let phase = 'boot';
  let exitCode = 0;
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 854, height: 480 });
    // The channel a try/catch structurally cannot see: a throw inside a
    // tween or timer callback runs from Phaser's own game step, so it never
    // reaches the frame that called the builder -- it just kills the render
    // loop. This is the shape of failure this script exists for.
    page.on('pageerror', (err) => pageErrors.push({ phase, error: String(err).split('\n')[0] }));
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (!text.includes('favicon.ico') && !text.startsWith('Failed to load resource:')) pageErrors.push({ phase, error: text });
      }
    });

    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => !!window.__game && window.__game.isBooted, { timeout: 60000 });
    await sleep(800);

    phase = 'setup';
    const domain = await setup(page, { variants, moveClasses, avatars, timeScale: TIMESCALE });
    log(
      `Domain: ${domain.materials} materials (${domain.wilds} wild-roster crystals + rivals + player form + Majorana fusions) x ` +
        `${domain.variants} variants; ${domain.moveClasses} move classes x ${domain.overrides} shape overrides; ` +
        `${domain.avatars} guardian avatar builders; ${domain.moves} moves.`
    );

    const results = [];

    phase = 'crystals';
    const tC = Date.now();
    const crystalRes = await sweepCrystals(page, 60);
    results.push(['crystal builders', crystalRes.built, crystalRes.total, crystalRes.failures, Date.now() - tC]);
    log(`  crystal builders: ${crystalRes.built}/${crystalRes.total} built, ${crystalRes.failures.length} failed (${((Date.now() - tC) / 1000).toFixed(1)}s)`);
    await sleep(300);

    phase = 'avatars';
    const tA = Date.now();
    const avatarRes = await sweepAvatars(page);
    results.push(['guardian avatars', avatarRes.built, avatarRes.total, avatarRes.failures, Date.now() - tA]);
    log(`  guardian avatars: ${avatarRes.built}/${avatarRes.total} built, ${avatarRes.failures.length} failed (${((Date.now() - tA) / 1000).toFixed(1)}s)`);
    await sleep(300);

    phase = 'effects';
    const tE = Date.now();
    const effectRes = await sweepEffects(page, 24, BREAK);
    const cast = effectRes.total - effectRes.failures.length;
    results.push(['attack shapes + ultimates', cast, effectRes.total, effectRes.failures, Date.now() - tE]);
    log(
      `  attack shapes + ultimates: ${cast}/${effectRes.total} cast, ${effectRes.failures.length} failed, ` +
        `${effectRes.firedCallbacks}/${effectRes.expectedCallbacks} impact callbacks fired (${((Date.now() - tE) / 1000).toFixed(1)}s)`
    );
    await sleep(600);
    phase = 'settle';
    await sleep(600);

    // --- report ---------------------------------------------------------
    const buildFailures = results.flatMap(([label, , , failures]) => failures.map((f) => ({ label, ...f })));
    const callbacksMissing = effectRes.expectedCallbacks - effectRes.firedCallbacks;

    console.log('');
    if (buildFailures.length === 0 && pageErrors.length === 0 && callbacksMissing === 0) {
      const swept = results.reduce((n, r) => n + r[2], 0);
      console.log(`art-sweep: clean -- ${swept} builder inputs swept, no throw, no page error, every impact callback fired.`);
    } else {
      exitCode = 1;
      console.log(`art-sweep: ${buildFailures.length + pageErrors.length + (callbacksMissing ? 1 : 0)} issue(s) found:\n`);
      for (const f of buildFailures) console.log(`  - [${f.label}] ${f.input}\n      ${f.error}`);
      for (const e of pageErrors) console.log(`  - [page error during ${e.phase}] ${e.error}`);
      if (callbacksMissing) {
        console.log(`  - ${callbacksMissing} of ${effectRes.expectedCallbacks} effect impact callbacks never fired -- an effect that never lands is a turn that never resolves`);
      }
    }
  } finally {
    await browser.close();
    teardownDevServer(serverHandle, log);
  }
  console.log(`art-sweep: ${((Date.now() - t0) / 1000).toFixed(1)}s total.`);
  process.exit(exitCode);
}

main().catch((e) => {
  console.error(`art-sweep: harness error -- ${e && e.stack ? e.stack : e}`);
  process.exit(2);
});
