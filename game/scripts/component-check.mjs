// Fast, component-level test suite for world_of_quantum_materials.
//
// Unlike playthrough-check.mjs (which walks every world tile-by-tile and
// fights every encounter -- thorough but slow), this suite jumps directly
// into scenes/states via window.__game.scene.start(...) and scene-private
// fields, so each test takes a couple of minutes instead of tens of minutes
// to an hour-plus. Run this FIRST while iterating on a bug -- it catches
// most regressions in individual mechanisms (world-entry dialogue chains,
// battle round-trips, guardian panels, rival gates, save/boot resilience)
// far faster than a full playthrough, which is better reserved for the
// question this suite can't answer: whether the whole 1-10 chain actually
// completes. A SEPARATE file from playthrough-check.mjs -- do not import/
// edit that file from here. See dev_notes/DEVELOPMENT.md's "Full-playthrough
// and component checks" section for the fuller writeup (headless-Chrome
// gotchas, when to reach for which script, how to read a failure).
//
// Usage (from game/): npm run component-check
// Or directly: node scripts/component-check.mjs
// CHROME_BIN auto-detects Puppeteer's cached Chrome-for-Testing binary if
// unset (see detectChromeBin() below) -- set it explicitly if that ever
// stops finding the right binary. If the dev server isn't already up on
// :5173, starts `npm run dev` itself and tears it down at the end -- an
// already-running server is left alone and untouched.

import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GAME_DIR = process.env.GAME_DIR || path.resolve(__dirname, '..');
const URL = process.env.QM_URL || 'http://localhost:5173/';
// Screenshots/logs from a run -- gitignored, not meant to be committed.
const SHOT_DIR = path.join(GAME_DIR, '.check-artifacts');
fs.mkdirSync(SHOT_DIR, { recursive: true });
const CANVAS_W = 854;
const CANVAS_H = 480;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

// ---------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------
async function main() {
  const wallStart = Date.now();
  const logLines = [];
  const log = (msg) => {
    const line = `[${new Date().toISOString().slice(11, 19)}] ${msg}`;
    console.log(line);
    logLines.push(line);
  };

  const CHROME_BIN = detectChromeBin();
  const serverHandle = await ensureDevServer(log);

  const browser = await puppeteer.launch({
    executablePath: CHROME_BIN,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    headless: true,
  });
  const page = await browser.newPage();
  await page.setViewport({ width: CANVAS_W, height: CANVAS_H });

  const consoleErrors = []; // { t: epoch-ms, text }
  page.on('console', (msg) => {
    // Chrome's console text for a failed resource load is a generic
    // "Failed to load resource: the server responded with a status of 404
    // (Not Found)" string with no URL in it, so a favicon.ico substring
    // filter can never match it -- the response/requestfailed listeners
    // below are the URL-aware, authoritative source for bad resource
    // loads instead, so this generic message is dropped here entirely
    // rather than risk masking (or wrongly flagging) a real one.
    if (msg.text().startsWith('Failed to load resource:')) return;
    if (msg.type() === 'error' && !msg.text().includes('favicon.ico')) {
      consoleErrors.push({ t: Date.now(), text: msg.text() });
    }
  });
  page.on('pageerror', (err) => {
    consoleErrors.push({ t: Date.now(), text: String(err) });
  });
  // favicon.ico 404s are expected (this dev server serves no favicon) and
  // benign -- every other resource failing is a real finding.
  page.on('response', (res) => {
    if (res.status() >= 400 && !res.url().includes('favicon.ico')) {
      consoleErrors.push({ t: Date.now(), text: `HTTP ${res.status()} ${res.url()}` });
    }
  });
  page.on('requestfailed', (req) => {
    if (!req.url().includes('favicon.ico')) {
      consoleErrors.push({ t: Date.now(), text: `request failed: ${req.url()} (${req.failure()?.errorText})` });
    }
  });

  // ---- page-context helpers ----
  const getActiveScenes = () =>
    page.evaluate(() => window.__game.scene.getScenes(true).map((s) => s.scene.key));

  // The one gotcha called out for direct (non-in-scene) scene transitions:
  // scene.start() from outside a scene doesn't stop whatever's running, so
  // every jump explicitly stops all four top-level scenes first.
  const jumpToScene = (key, data) =>
    page.evaluate(
      ({ key, data }) => {
        const g = window.__game;
        ['Title', 'Hub', 'Overworld', 'Battle'].forEach((k) => {
          if (g.scene.isActive(k) || g.scene.isSleeping(k)) g.scene.stop(k);
        });
        g.scene.start(key, data);
      },
      { key, data }
    );

  const listInteractiveTexts = () =>
    page.evaluate(() => {
      function walk(list, out) {
        for (const obj of list) {
          if (obj.input && typeof obj.text === 'string') out.push(obj.text);
          if (obj.list) walk(obj.list, out);
        }
      }
      const all = [];
      window.__game.scene.getScenes(true).forEach((sc) => walk(sc.children.list, all));
      return all;
    });

  const clickText = (matchList) =>
    page.evaluate((matchList) => {
      function walk(list, out) {
        for (const obj of list) {
          if (obj.input && typeof obj.text === 'string') out.push(obj);
          if (obj.list) walk(obj.list, out);
        }
      }
      const all = [];
      window.__game.scene.getScenes(true).forEach((sc) => walk(sc.children.list, all));
      for (const wanted of matchList) {
        const found = all.find((o) => o.text === wanted || o.text.startsWith(wanted));
        if (found) {
          found.emit('pointerdown');
          return { clicked: found.text };
        }
      }
      return { clicked: null, available: all.map((o) => o.text) };
    }, matchList);

  // OverworldScene always sets dialogueActive and dialogueContainer
  // together (unlike HubScene, whose own native panels only ever set
  // dialogueContainer -- not relevant here since every test in this suite
  // only opens dialogues on Overworld), so dialogueActive alone is a
  // reliable "is a panel open" signal for every check below.
  const readOverworldDialogueActive = () =>
    page.evaluate(() => {
      const s = window.__game.scene.getScene('Overworld');
      if (!s || !window.__game.scene.isActive('Overworld')) return null;
      return !!s['dialogueActive'];
    });

  const dumpOverworldDialogue = () =>
    page.evaluate(() => {
      const s = window.__game.scene.getScene('Overworld');
      const c = s ? s['dialogueContainer'] : null;
      return {
        world: s ? s['world'] : null,
        dialogueActive: s ? s['dialogueActive'] : null,
        containerTexts: c ? c.list.filter((o) => typeof o.text === 'string').map((o) => o.text) : null,
      };
    });

  const resetRegistryOnly = () =>
    page.evaluate(() => {
      window.__game.registry.reset();
      localStorage.clear();
    });

  const freshBoot = async () => {
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForSelector('canvas');
    await sleep(700);
  };

  // Priority-order clicker used by the world-entry test: prefer the
  // known lore/tip-page buttons, else click the first available button
  // that isn't 'Let me pass' (a door-confirm dialogue, never appropriate
  // to click while resolving an entry sequence).
  async function clickEntryDialogueOnce() {
    // 'Farewell' is included (ahead of the generic fallback) so the
    // enterFrom:'goal' entry variant -- which can land on the gate panel
    // mid-chain, offering 'Farewell'/'Face the Rival ->' -- closes out
    // rather than the fallback's "click whatever's first" logic risking a
    // click into 'Face the Rival ->' and accidentally starting a full
    // battle, which is no longer just testing entry-dialogue termination.
    const priority = ['Next ->', 'Onward', 'Got it', 'Farewell'];
    const r = await clickText(priority);
    if (r.clicked) return r.clicked;
    const alt = (r.available || []).filter((t) => t !== 'Let me pass' && t.trim().length > 0);
    if (alt.length) {
      const r2 = await clickText([alt[0]]);
      return r2.clicked;
    }
    return null;
  }

  // Clicks through whatever Overworld dialogue is currently open (lore,
  // tutorial tips, gate/story-beat panels, ...) up to maxClicks times,
  // stopping as soon as dialogueActive clears. Shared by every test that
  // needs to get past an entry sequence before doing its own thing, and by
  // Test 1 itself, which grades exactly this loop's outcome.
  async function resolveOverworldDialogue(maxClicks = 15, intervalMs = 280) {
    const clicks = [];
    let active = await readOverworldDialogueActive();
    if (active === null) return { cleared: false, clicks, reason: 'overworld-not-active' };
    for (let i = 0; i < maxClicks && active; i++) {
      const clicked = await clickEntryDialogueOnce();
      if (!clicked) return { cleared: false, clicks, reason: 'no-button' };
      clicks.push(clicked);
      await sleep(intervalMs);
      active = await readOverworldDialogueActive();
      // A click landed us outside Overworld entirely (e.g. into a Battle)
      // -- that's not "dialogue cleared," it's a different, unintended
      // path; fail explicitly rather than reading a null as "not active."
      if (active === null) return { cleared: false, clicks, reason: 'left-overworld-scene' };
    }
    return { cleared: !active, clicks, reason: active ? 'exhausted' : null };
  }

  const errorsInWindow = (fromT, toT) =>
    consoleErrors.filter((e) => e.t >= fromT && e.t <= toT).map((e) => e.text);

  // ---- test-result bookkeeping ----
  const results = [];
  async function runTest(name, fn) {
    const t0 = Date.now();
    let pass = false;
    let detail = '';
    try {
      const r = await fn();
      pass = r === undefined ? true : !!r.pass;
      detail = r && r.detail ? r.detail : '';
    } catch (e) {
      pass = false;
      detail = `threw: ${e && e.stack ? e.stack : e}`;
    }
    const t1 = Date.now();
    const errs = errorsInWindow(t0, t1);
    if (errs.length) {
      pass = false;
      detail += (detail ? ' | ' : '') + `console errors: ${JSON.stringify(errs)}`;
    }
    const line = `${pass ? 'PASS' : 'FAIL'} [${((t1 - t0) / 1000).toFixed(1)}s] ${name}${detail ? ' -- ' + detail : ''}`;
    log(line);
    results.push({ name, pass, detail, ms: t1 - t0 });
    return pass;
  }

  // =====================================================================
  // Test 1: world-entry dialogue termination
  // =====================================================================
  async function waitOverworldActive(world) {
    for (let i = 0; i < 20; i++) {
      const active = await readOverworldDialogueActive();
      if (active !== null) return true;
      await sleep(50);
    }
    return false;
  }

  // Plain case: a totally fresh save, entering a world for the first time
  // via an external (out-of-scene) jump straight to its start tile -- the
  // shape Test 1's own per-world/per-repeat loop below uses.
  async function testWorldEntry(world, iteration, extraData = {}, label = '') {
    await resetRegistryOnly();
    await jumpToScene('Overworld', { world, regenerate: true, ...extraData });
    if (!(await waitOverworldActive(world))) {
      return { pass: false, detail: `${label}world ${world}: Overworld scene never became active after jump` };
    }
    const r = await resolveOverworldDialogue(15);
    if (!r.cleared) {
      const dump = await dumpOverworldDialogue();
      await page.screenshot({ path: `${SHOT_DIR}/fail-world-entry-w${world}-i${iteration}.png` });
      return {
        pass: false,
        detail: `${label}world ${world} iter ${iteration}: dialogueActive stuck (${r.reason}) after clicks=${JSON.stringify(
          r.clicks
        )} dump=${JSON.stringify(dump)}`,
      };
    }
    return {
      pass: true,
      detail: `${label}world ${world} iter ${iteration}: cleared in ${r.clicks.length} click(s) [${r.clicks.join(', ')}]`,
    };
  }

  // Exercises a longer entry chain than the plain case: landing via the
  // backward door (`enterFrom: 'goal'`) puts the player on the goal row
  // before create() runs, so once the world-entry lore is dismissed,
  // finishEntry's maybeAutoOpenGoalDialogue() immediately chains into the
  // goal tip and gate panel too (lore x2 -> goal tip -> gate panel, all
  // synchronously sequential via dialogueContainer?.destroy(true), never
  // two chains open at once). This does NOT reproduce -- and isn't
  // designed to reproduce -- the full bot's intermittent stuck-repeat,
  // which would need a second entry chain to start while one is already
  // live (e.g. a scene re-start arriving mid-panel); that condition isn't
  // exercised anywhere in this suite and remains an open, unreproduced gap
  // (see the report this test suite was built for).
  async function testWorldEntryFromGoal(world, iteration) {
    return testWorldEntry(world, iteration, { enterFrom: 'goal' }, 'enterFrom=goal, ');
  }

  // Re-enters the same world a second time in the same session (no
  // registry.reset() in between, so lore/tip flags are already marked
  // seen) -- exercises the "already seen, should be a near-instant no-op"
  // path rather than only ever testing the fresh-save first-visit case.
  async function testWorldReentry(world) {
    await resetRegistryOnly();
    await jumpToScene('Overworld', { world, regenerate: true });
    if (!(await waitOverworldActive(world))) return { pass: false, detail: `world ${world}: first entry never active` };
    const first = await resolveOverworldDialogue(15);
    if (!first.cleared) {
      return { pass: false, detail: `world ${world}: first entry itself got stuck (${first.reason}), can't test re-entry` };
    }
    // Re-enter without resetting the registry -- lore/tips are already
    // marked seen, so this should clear with few or zero clicks.
    await jumpToScene('Overworld', { world, regenerate: true });
    if (!(await waitOverworldActive(world))) return { pass: false, detail: `world ${world}: re-entry never active` };
    const second = await resolveOverworldDialogue(15);
    if (!second.cleared) {
      const dump = await dumpOverworldDialogue();
      await page.screenshot({ path: `${SHOT_DIR}/fail-world-reentry-w${world}.png` });
      return {
        pass: false,
        detail: `world ${world}: re-entry got stuck (${second.reason}) after clicks=${JSON.stringify(second.clicks)} dump=${JSON.stringify(
          dump
        )}`,
      };
    }
    return { pass: true, detail: `world ${world}: re-entry cleared in ${second.clicks.length} click(s) [${second.clicks.join(', ')}]` };
  }

  // =====================================================================
  // Test 2: battle round-trip
  // =====================================================================
  const WILD_TYPES = ['metal', 'insulator', 'semiconductor', 'classicalMagnet', 'superconductor', 'chernInsulator'];
  const WILD_COLORS = [0x7a8a99, 0xb8c4cc, 0x5a7ca6, 0xc97a3a, 0x7fd1e8, 0xc9d94a];

  async function resolveBattleLoop(label) {
    let rounds = 0;
    while (rounds++ < 40) {
      const st = await page.evaluate(() => {
        const s = window.__game.scene.getScene('Battle');
        if (!s || !window.__game.scene.isActive('Battle')) return null;
        return {
          turnLock: s['turnLock'],
          playerHp: s['playerHp'],
          opponentHp: s['opponentHp'],
          moveIds: s['currentMoveIds'],
        };
      });
      if (!st) return { outcome: 'scene-gone', rounds };
      if (st.playerHp <= 0 || st.opponentHp <= 0) {
        return { outcome: st.playerHp <= 0 ? 'LOST' : 'WON', rounds };
      }
      if (!st.turnLock) {
        if (!st.moveIds || st.moveIds.length === 0) {
          await page.screenshot({ path: `${SHOT_DIR}/fail-battle-${label}-no-moves.png` });
          return { outcome: 'no-moves', rounds };
        }
        await page.evaluate((moveId) => {
          const s = window.__game.scene.getScene('Battle');
          s['playerAttack'](moveId);
        }, st.moveIds[0]);
      }
      await sleep(550);
    }
    await page.screenshot({ path: `${SHOT_DIR}/fail-battle-${label}-timeout.png` });
    return { outcome: 'timeout', rounds };
  }

  async function testBattleRoundTrip(i) {
    const world = 1 + Math.floor(Math.random() * 10);
    const type = WILD_TYPES[Math.floor(Math.random() * WILD_TYPES.length)];
    const idx = WILD_TYPES.indexOf(type);
    const color = WILD_COLORS[idx];
    const isRival = Math.random() < 0.3;

    // BattleScene reads playerHp as `Math.min(saved, playerMaxHp)` -- a
    // loss leaves it at 0, which is falsy and heals back to full on the
    // next read, but any small nonzero leftover from an earlier iteration
    // would silently carry over and cripple this one. Setting it
    // explicitly (randomized within a spread that sometimes exceeds max,
    // sometimes doesn't, so the clamp itself gets exercised too) makes
    // each iteration a genuinely independent, reproducibly-randomized
    // starting condition instead of an accidental function of run order.
    const startHp = 40 + Math.floor(Math.random() * 260);
    await page.evaluate((hp) => window.__game.registry.set('playerHp', hp), startHp);

    await jumpToScene('Battle', {
      wild: { name: `Test Foe ${i}`, type, color, variant: 'shard', moves: ['tunnelStrike'] },
      world,
      attackMultiplier: 1,
      isRival,
    });

    // give the scene a beat to construct its move menu
    let ready = false;
    for (let j = 0; j < 20; j++) {
      const active = await getActiveScenes();
      if (active.includes('Battle')) {
        ready = true;
        break;
      }
      await sleep(50);
    }
    if (!ready) return { pass: false, detail: `iter ${i}: Battle scene never became active (world ${world}, type ${type}, startHp ${startHp})` };

    const result = await resolveBattleLoop(`i${i}`);
    if (result.outcome !== 'WON' && result.outcome !== 'LOST') {
      return {
        pass: false,
        detail: `iter ${i}: battle ended abnormally (${result.outcome}) after ${result.rounds} rounds, world ${world}, type ${type}, isRival ${isRival}, startHp ${startHp}`,
      };
    }

    await sleep(900);
    await page.keyboard.press('Space');
    await sleep(500);

    const scenesAfter = await getActiveScenes();
    if (scenesAfter.includes('Battle')) {
      await page.screenshot({ path: `${SHOT_DIR}/fail-battle-i${i}-leftover.png` });
      return {
        pass: false,
        detail: `iter ${i}: Battle scene still active after Space dismissal (${result.outcome}, ${result.rounds} rounds). scenes=${JSON.stringify(
          scenesAfter
        )}`,
      };
    }
    if (!scenesAfter.includes('Overworld')) {
      await page.screenshot({ path: `${SHOT_DIR}/fail-battle-i${i}-no-overworld.png` });
      return {
        pass: false,
        detail: `iter ${i}: did not return to Overworld after battle (${result.outcome}). scenes=${JSON.stringify(scenesAfter)}`,
      };
    }
    return {
      pass: true,
      detail: `iter ${i}: ${result.outcome} in ${result.rounds} rounds (world ${world}, type ${type}, isRival ${isRival}, startHp ${startHp}), clean return to Overworld`,
    };
  }

  // =====================================================================
  // Test 3: guardian panel open/close round-trip
  // =====================================================================
  async function testGuardianPanel(world) {
    await resetRegistryOnly();
    await jumpToScene('Overworld', { world, regenerate: true });
    if (!(await waitOverworldActive(world))) return { pass: false, detail: `world ${world}: Overworld never active` };

    const entry = await resolveOverworldDialogue(15);
    if (!entry.cleared) {
      return {
        pass: false,
        detail: `world ${world}: entry sequence never cleared (${entry.reason}), can't reach guardian test. clicks=${JSON.stringify(entry.clicks)}`,
      };
    }

    // Walk the player onto the guardian's middle row and trigger the
    // same "reached this row" path tryMove's onComplete uses, rather than
    // duplicating its open logic here.
    const openResult = await page.evaluate(() => {
      const s = window.__game.scene.getScene('Overworld');
      const mid = s['midTile'];
      s['playerTile'] = { x: mid.x, y: mid.y };
      s['maybeReachMiddle'](mid.x, mid.y);
      return { dialogueActive: s['dialogueActive'] };
    });
    if (!openResult.dialogueActive) {
      return { pass: false, detail: `world ${world}: maybeReachMiddle did not open any panel (dialogueActive stayed false) -- guardian may be missing from WORLD_GUARDIANS` };
    }

    const closeClicks = [];
    let stillActive = true;
    for (let i = 0; i < 6; i++) {
      stillActive = await readOverworldDialogueActive();
      if (!stillActive) break;
      const r = await clickText(['Got it', 'Farewell', 'Close']);
      if (!r.clicked) {
        const dump = await dumpOverworldDialogue();
        await page.screenshot({ path: `${SHOT_DIR}/fail-guardian-w${world}.png` });
        return {
          pass: false,
          detail: `world ${world}: no Got it/Farewell/Close button found. closeClicks=${JSON.stringify(closeClicks)} dump=${JSON.stringify(dump)}`,
        };
      }
      closeClicks.push(r.clicked);
      await sleep(280);
    }
    stillActive = await readOverworldDialogueActive();
    if (stillActive) {
      const dump = await dumpOverworldDialogue();
      await page.screenshot({ path: `${SHOT_DIR}/fail-guardian-w${world}-stuck.png` });
      return { pass: false, detail: `world ${world}: guardian panel still open after ${closeClicks.length} closing clicks. dump=${JSON.stringify(dump)}` };
    }

    const met = await page.evaluate(() => window.__game.registry.get('metGuardians'));
    return {
      pass: true,
      detail: `world ${world}: opened+closed in ${closeClicks.length} click(s) [${closeClicks.join(', ')}], metGuardians=${JSON.stringify(met)}`,
    };
  }

  // =====================================================================
  // Test 4: rival gate round-trip
  // =====================================================================
  // "Loss path": a fresh, unleveled level-1 player (registry.reset()'s
  // defaults) facing a full rival almost always loses -- this deliberately
  // exercises that branch (the gate re-offering 'Face the Rival ->' so the
  // fight can be retried), not the win branch. See testRivalGateWinPath and
  // testRivalGateActualWin below for the "rival defeated" / "actually WON"
  // branches, which this function structurally cannot reach on its own.
  async function testRivalGate(world) {
    await resetRegistryOnly();
    await jumpToScene('Overworld', { world, regenerate: true });
    if (!(await waitOverworldActive(world))) return { pass: false, detail: `world ${world}: Overworld never active` };

    const entry = await resolveOverworldDialogue(15);
    if (!entry.cleared) {
      return { pass: false, detail: `world ${world}: entry sequence never cleared (${entry.reason}). clicks=${JSON.stringify(entry.clicks)}` };
    }

    // Jump the player to the goal row and trigger the same reach-goal path
    // tryMove's onComplete uses.
    const reachResult = await page.evaluate(() => {
      const s = window.__game.scene.getScene('Overworld');
      const goal = s['goalTile'];
      s['playerTile'] = { x: goal.x, y: goal.y };
      s['maybeReachGoal'](goal.x, goal.y);
      return { dialogueActive: s['dialogueActive'] };
    });
    if (!reachResult.dialogueActive) {
      return { pass: false, detail: `world ${world}: maybeReachGoal did not open the gate panel` };
    }

    // Click through: possible one-time 'Got it' tip, then 'Face the Rival ->',
    // then the two-part taunt ('Next ->' then 'Battle!').
    const clicks = [];
    let reachedBattle = false;
    for (let i = 0; i < 8; i++) {
      const scenes = await getActiveScenes();
      if (scenes.includes('Battle')) {
        reachedBattle = true;
        break;
      }
      const r = await clickText(['Got it', 'Face the Rival ->', 'Next ->', 'Battle!']);
      if (!r.clicked) {
        const dump = await dumpOverworldDialogue();
        await page.screenshot({ path: `${SHOT_DIR}/fail-rivalgate-w${world}-preBattle.png` });
        return { pass: false, detail: `world ${world}: stuck before reaching Battle. clicks=${JSON.stringify(clicks)} dump=${JSON.stringify(dump)}` };
      }
      clicks.push(r.clicked);
      await sleep(350);
    }
    if (!reachedBattle) {
      const scenes = await getActiveScenes();
      return { pass: false, detail: `world ${world}: never reached Battle scene after 8 clicks. clicks=${JSON.stringify(clicks)} scenes=${JSON.stringify(scenes)}` };
    }

    const result = await resolveBattleLoop(`rival-w${world}`);
    if (result.outcome !== 'WON' && result.outcome !== 'LOST') {
      return { pass: false, detail: `world ${world}: rival battle ended abnormally (${result.outcome}) after ${result.rounds} rounds. clicks=${JSON.stringify(clicks)}` };
    }
    await sleep(900);
    await page.keyboard.press('Space');
    await sleep(600);

    const scenesAfter = await getActiveScenes();
    if (!scenesAfter.includes('Overworld') || scenesAfter.includes('Battle')) {
      await page.screenshot({ path: `${SHOT_DIR}/fail-rivalgate-w${world}-afterBattle.png` });
      return { pass: false, detail: `world ${world}: did not return cleanly to Overworld after rival battle (${result.outcome}). scenes=${JSON.stringify(scenesAfter)}` };
    }

    // Read ground truth from the registry rather than trusting our own
    // outcome parse, then re-open the gate panel and check the offered
    // button matches.
    const rivalDefeated = await page.evaluate((w) => {
      const rd = window.__game.registry.get('rivalDefeated') || {};
      return !!rd[w];
    }, world);

    const gateDump = await page.evaluate(() => {
      const s = window.__game.scene.getScene('Overworld');
      s['showGatePanel']();
      const c = s['dialogueContainer'];
      return c ? c.list.filter((o) => typeof o.text === 'string').map((o) => o.text) : [];
    });

    const expectSubstr = !rivalDefeated
      ? 'Face the Rival'
      : world >= 10
      ? 'The Decoherence is stabilized'
      : `Continue to World ${world + 1}`;
    const found = gateDump.some((t) => t.includes(expectSubstr));
    if (!found) {
      await page.screenshot({ path: `${SHOT_DIR}/fail-rivalgate-w${world}-wrongbutton.png` });
      return {
        pass: false,
        detail: `world ${world}: gate panel after battle (${result.outcome}, rivalDefeated=${rivalDefeated}) expected a button containing "${expectSubstr}" but got ${JSON.stringify(
          gateDump
        )}`,
      };
    }

    return {
      pass: true,
      detail: `world ${world} (loss path): rival battle ${result.outcome} (${result.rounds} rounds), rivalDefeated=${rivalDefeated}, gate correctly offers "${expectSubstr}"`,
    };
  }

  // Pre-sets rivalDefeated so the gate panel offers 'Continue to World N+1
  // ->' (or 'The Decoherence is stabilized ->' for World 10) without
  // needing to actually win a fight -- exercises tryAdvanceToNextWorld's
  // win branch, showStoryBeat/showFinalePanel, and (for a mid world) lands
  // on the next world via advanceToWorld's in-scene scene.start, so the
  // next world's own entry-dialogue chain gets resolved through the same
  // in-scene transition path a real winning playthrough uses (an external
  // page-level scene jump, used everywhere else in this suite, never
  // exercises that path).
  async function testRivalGateWinPath(world) {
    const isLastWorld = world >= 10;
    await resetRegistryOnly();
    await jumpToScene('Overworld', { world, regenerate: true });
    if (!(await waitOverworldActive(world))) return { pass: false, detail: `world ${world}: Overworld never active` };

    const entry = await resolveOverworldDialogue(15);
    if (!entry.cleared) {
      return { pass: false, detail: `world ${world}: entry sequence never cleared (${entry.reason}). clicks=${JSON.stringify(entry.clicks)}` };
    }

    await page.evaluate((w) => {
      const rd = window.__game.registry.get('rivalDefeated') || {};
      window.__game.registry.set('rivalDefeated', { ...rd, [w]: true });
    }, world);

    const reachResult = await page.evaluate(() => {
      const s = window.__game.scene.getScene('Overworld');
      const goal = s['goalTile'];
      s['playerTile'] = { x: goal.x, y: goal.y };
      s['maybeReachGoal'](goal.x, goal.y);
      return { dialogueActive: s['dialogueActive'] };
    });
    if (!reachResult.dialogueActive) {
      return { pass: false, detail: `world ${world}: maybeReachGoal did not open the gate panel (rivalDefeated preset)` };
    }

    // Deterministic click sequence (each button only ever appears once, in
    // this order): the one-time 'Got it' goal tip, then the gate's
    // continue/finale button, then (mid-world only) the story beat's
    // 'Onward', or (World 10 only) the finale's 'Return to the Lab'. Kept
    // as explicit priority-per-step rather than one open-ended loop,
    // because the mid-world path's button labels ('Onward', 'Got it')
    // overlap with the NEXT world's own fresh entry-dialogue buttons once
    // advanceToWorld's in-scene scene.start fires -- an open-ended loop
    // here could silently consume clicks meant for verification below.
    const expectLabel = isLastWorld ? 'The Decoherence is stabilized' : `Continue to World ${world + 1}`;
    const clicks = [];
    const step1 = await clickText(['Got it']);
    if (step1.clicked) {
      clicks.push(step1.clicked);
      await sleep(300);
    }
    const step2 = await clickText([expectLabel]);
    if (!step2.clicked) {
      await page.screenshot({ path: `${SHOT_DIR}/fail-rivalgate-winpath-w${world}.png` });
      return { pass: false, detail: `world ${world}: gate panel did not offer "${expectLabel}". clicks so far=${JSON.stringify(clicks)}, available=${JSON.stringify(step2.available)}` };
    }
    clicks.push(step2.clicked);
    await sleep(350);

    if (!isLastWorld) {
      const step3 = await clickText(['Onward']);
      if (!step3.clicked) {
        await page.screenshot({ path: `${SHOT_DIR}/fail-rivalgate-winpath-w${world}-storybeat.png` });
        return { pass: false, detail: `world ${world}: story beat panel did not offer 'Onward'. clicks=${JSON.stringify(clicks)}, available=${JSON.stringify(step3.available)}` };
      }
      clicks.push(step3.clicked);
      await sleep(350);
    } else {
      const step3 = await clickText(['Return to the Lab']);
      if (!step3.clicked) {
        await page.screenshot({ path: `${SHOT_DIR}/fail-rivalgate-winpath-w${world}-finale.png` });
        return { pass: false, detail: `world ${world}: finale panel did not offer 'Return to the Lab'. clicks=${JSON.stringify(clicks)}, available=${JSON.stringify(step3.available)}` };
      }
      clicks.push(step3.clicked);
      await sleep(500);
    }

    if (isLastWorld) {
      // World 10 win -> showFinalePanel -> 'Return to the Lab' -> Hub.
      const active = await getActiveScenes();
      if (!active.includes('Hub') || active.includes('Overworld')) {
        await page.screenshot({ path: `${SHOT_DIR}/fail-rivalgate-winpath-w${world}-hub.png` });
        return { pass: false, detail: `world ${world}: finale did not return to Hub cleanly. clicks=${JSON.stringify(clicks)} scenes=${JSON.stringify(active)}` };
      }
      return { pass: true, detail: `world ${world} (finale win path): clicks=[${clicks.join(', ')}], landed cleanly in Hub` };
    }

    // Mid-world win -> showStoryBeat -> 'Onward' -> advanceToWorld (in-scene
    // scene.start) -> next world's own fresh entry-dialogue chain, which
    // must also resolve cleanly.
    const nextWorldEntry = await resolveOverworldDialogue(15);
    const nextWorldNum = await page.evaluate(() => window.__game.scene.getScene('Overworld')?.['world']);
    if (nextWorldNum !== world + 1) {
      return { pass: false, detail: `world ${world}: expected to land in world ${world + 1} via advanceToWorld, got ${nextWorldNum}. clicks=${JSON.stringify(clicks)}` };
    }
    if (!nextWorldEntry.cleared) {
      await page.screenshot({ path: `${SHOT_DIR}/fail-rivalgate-winpath-w${world}-nextentry.png` });
      return {
        pass: false,
        detail: `world ${world}: won and advanced to world ${nextWorldNum}, but ITS entry dialogue (reached via in-scene advanceToWorld, not an external jump) got stuck (${nextWorldEntry.reason}). clicks=${JSON.stringify(
          nextWorldEntry.clicks
        )}`,
      };
    }
    return {
      pass: true,
      detail: `world ${world} (win path): clicks=[${clicks.join(', ')}], advanced to world ${nextWorldNum} via in-scene transition, its entry cleared in ${nextWorldEntry.clicks.length} click(s)`,
    };
  }

  // At least one rival fight actually fought to a real WON outcome (every
  // other rival-gate test either loses honestly or pre-sets rivalDefeated
  // rather than winning it) -- boosts the player's own defense stat well
  // past MAX_STAT (data/balance.ts's resolveHitDamage/defenseFactor floors
  // incoming damage at 10% of nominal, not zero, however high Correlation
  // goes) and gives it a massive HP buffer on top, so the outcome is
  // deterministic from that buffer alone rather than hoping variance/crit
  // rolls happen to favor a level-1 player against a full rival.
  async function testRivalGateActualWin(world) {
    await resetRegistryOnly();
    await jumpToScene('Overworld', { world, regenerate: true });
    if (!(await waitOverworldActive(world))) return { pass: false, detail: `world ${world}: Overworld never active` };
    const entry = await resolveOverworldDialogue(15);
    if (!entry.cleared) {
      return { pass: false, detail: `world ${world}: entry sequence never cleared (${entry.reason})` };
    }
    await page.evaluate(() => {
      window.__game.registry.set('playerHp', 999999);
      window.__game.registry.set('playerStats', { quantumness: 30, velocity: 30, correlation: 99999 });
    });

    const reachResult = await page.evaluate(() => {
      const s = window.__game.scene.getScene('Overworld');
      const goal = s['goalTile'];
      s['playerTile'] = { x: goal.x, y: goal.y };
      s['maybeReachGoal'](goal.x, goal.y);
      return { dialogueActive: s['dialogueActive'] };
    });
    if (!reachResult.dialogueActive) return { pass: false, detail: `world ${world}: maybeReachGoal did not open the gate panel` };

    const clicks = [];
    let reachedBattle = false;
    for (let i = 0; i < 8; i++) {
      if ((await getActiveScenes()).includes('Battle')) {
        reachedBattle = true;
        break;
      }
      const r = await clickText(['Got it', 'Face the Rival ->', 'Next ->', 'Battle!']);
      if (!r.clicked) return { pass: false, detail: `world ${world}: stuck before Battle. clicks=${JSON.stringify(clicks)}` };
      clicks.push(r.clicked);
      await sleep(350);
    }
    if (!reachedBattle) return { pass: false, detail: `world ${world}: never reached Battle. clicks=${JSON.stringify(clicks)}` };

    const result = await resolveBattleLoop(`actualwin-w${world}`);
    if (result.outcome !== 'WON') {
      await page.screenshot({ path: `${SHOT_DIR}/fail-rivalgate-actualwin-w${world}.png` });
      return { pass: false, detail: `world ${world}: boosted player still did not WIN (got ${result.outcome} after ${result.rounds} rounds) -- possible real battle-balance/logic issue, not just harness randomness` };
    }
    await sleep(900);
    await page.keyboard.press('Space');
    await sleep(600);
    const scenesAfter = await getActiveScenes();
    if (!scenesAfter.includes('Overworld') || scenesAfter.includes('Battle')) {
      await page.screenshot({ path: `${SHOT_DIR}/fail-rivalgate-actualwin-w${world}-after.png` });
      return { pass: false, detail: `world ${world}: did not return cleanly to Overworld after an actual WON rival battle. scenes=${JSON.stringify(scenesAfter)}` };
    }
    const rivalDefeated = await page.evaluate((w) => !!(window.__game.registry.get('rivalDefeated') || {})[w], world);
    if (!rivalDefeated) {
      return { pass: false, detail: `world ${world}: battle resolved WON but registry rivalDefeated[${world}] was not set` };
    }
    return { pass: true, detail: `world ${world}: actually WON in ${result.rounds} rounds, rivalDefeated correctly recorded, clean return to Overworld` };
  }

  // =====================================================================
  // Test 4d: World 10's Adapted actually transmuting, once per move class
  // =====================================================================
  // The Adapted is the only opponent that rebuilds its own sprite and
  // nameplate mid-fight: every player Attack/Analytic/Ultimate move that
  // resolves against a living one triggers BattleScene.transmuteAdapted.
  // That swap runs from inside a tween's onComplete -- inside Phaser's own
  // game step -- so anything it throws kills the requestAnimationFrame loop
  // outright and the canvas freezes on its last frame, rather than merely
  // stalling a turn. `game.loop.frame` is what tells those two apart, and a
  // frozen loop is what this test is really watching for; runTest's own
  // pageerror capture covers the throw itself.
  //
  // Test 4's World 10 loss path never reaches a single transmute -- the
  // fresh-save player dies to that rival before any of its own hits resolve
  // -- so this drives the fight directly and keeps both sides alive, which
  // is the only way a player hit lands on a *living* Adapted repeatedly.
  // Ultimates are worth their own case because that branch defers
  // checkEndOrContinue (and so the transmute) to the summon animation's
  // completion instead of running it inline.
  const ADAPTED_WILD = { name: 'The Adapted', type: 'topological', color: 0x9b7bd4, variant: 'shard', moves: ['tunnelStrike'] };
  const SWAPS_PER_MOVE = 3;

  async function waitTurnFree(ms) {
    for (let i = 0; i < Math.ceil(ms / 100); i++) {
      const st = await page.evaluate(() => {
        const s = window.__game.scene.getScene('Battle');
        return s && window.__game.scene.isActive('Battle') ? { lock: s['turnLock'] } : null;
      });
      if (!st) return 'scene-gone';
      if (!st.lock) return 'free';
      await sleep(100);
    }
    return 'stuck';
  }

  async function testAdaptedTransmute(moveId) {
    await resetRegistryOnly();
    await jumpToScene('Battle', { wild: ADAPTED_WILD, world: 10, attackMultiplier: 1, isRival: true });

    let ready = false;
    for (let i = 0; i < 20; i++) {
      if ((await getActiveScenes()).includes('Battle')) { ready = true; break; }
      await sleep(50);
    }
    if (!ready) return { pass: false, detail: `${moveId}: Battle scene never became active` };

    const names = [];
    for (let swap = 1; swap <= SWAPS_PER_MOVE; swap++) {
      const free = await waitTurnFree(9000);
      if (free !== 'free') return { pass: false, detail: `${moveId}: swap ${swap}: turn never freed up (${free}) -- names so far ${JSON.stringify(names)}` };

      // Top both sides back up so neither side can win before the next
      // transmute -- a dead Adapted returns through endBattle instead.
      const before = await page.evaluate(() => {
        const g = window.__game;
        const s = g.scene.getScene('Battle');
        s['playerHp'] = s['playerMaxHp'];
        s['opponentHp'] = s['opponentMaxHp'];
        s['updateBars']();
        return { frame: g.loop.frame, name: s['adaptedForm'] ? s['adaptedForm'].name : null };
      });

      await page.evaluate((m) => window.__game.scene.getScene('Battle')['playerAttack'](m), moveId);
      // Long enough to cover the glow's rise+fall, the fixed turn gap and an
      // Ultimate's much longer summon animation ahead of the swap.
      await sleep(3500);

      const after = await page.evaluate(() => {
        const g = window.__game;
        const s = g.scene.getScene('Battle');
        return {
          frame: g.loop.frame,
          active: g.scene.isActive('Battle'),
          name: s && s['adaptedForm'] ? s['adaptedForm'].name : null,
          plateName: s && s['opponentPlate'] ? 'present' : 'missing',
        };
      });

      if (after.frame === before.frame) {
        await page.screenshot({ path: `${SHOT_DIR}/fail-adapted-${moveId}-frozen.png` });
        return {
          pass: false,
          detail: `${moveId}: swap ${swap}: game loop stopped advancing (frame stuck at ${after.frame}) -- the canvas is frozen, not merely stalled. form=${after.name}`,
        };
      }
      if (!after.active) return { pass: false, detail: `${moveId}: swap ${swap}: battle ended before the transmute could be observed` };
      if (!after.name || after.name === before.name) {
        return { pass: false, detail: `${moveId}: swap ${swap}: opponent did not take a new form (still ${JSON.stringify(after.name)})` };
      }
      if (after.plateName !== 'present') {
        return { pass: false, detail: `${moveId}: swap ${swap}: opponent nameplate missing after the rebuild` };
      }
      names.push(after.name);
    }

    const settled = await waitTurnFree(9000);
    if (settled !== 'free') return { pass: false, detail: `${moveId}: turn never freed up after the last transmute (${settled})` };

    return { pass: true, detail: `${moveId}: ${names.length} transmutes, loop kept running, forms ${JSON.stringify(names)}` };
  }

  // =====================================================================
  // Test 5: fresh-save and corrupt-save boot
  // =====================================================================
  async function bootAndReachTitle() {
    await page.reload();
    await page.waitForSelector('canvas');
    await sleep(900);
    const scenes = await getActiveScenes();
    return scenes;
  }

  async function testBootScenario(label, setupFn) {
    await setupFn();
    const scenes = await bootAndReachTitle();
    if (!scenes.includes('Title')) {
      await page.screenshot({ path: `${SHOT_DIR}/fail-boot-${label}.png` });
      return { pass: false, detail: `${label}: Title scene not active after boot. scenes=${JSON.stringify(scenes)}` };
    }
    // Proceed into Hub (Continue or New Game, whichever the save state offers)
    await page.keyboard.press('Space');
    let reachedHub = false;
    for (let i = 0; i < 20; i++) {
      if ((await getActiveScenes()).includes('Hub')) {
        reachedHub = true;
        break;
      }
      await sleep(200);
    }
    if (!reachedHub) {
      await page.screenshot({ path: `${SHOT_DIR}/fail-boot-${label}-hub.png` });
      return { pass: false, detail: `${label}: never reached Hub after Title -> Space` };
    }
    return { pass: true, detail: `${label}: booted to Title then Hub cleanly` };
  }

  // =====================================================================
  // Run everything
  // =====================================================================
  log('Booting page for the first time...');
  await page.goto(URL);
  await page.waitForSelector('canvas');
  await sleep(900);

  log('=== Test 1: world-entry dialogue termination (worlds 1-10, 2x each, plain start-tile entry) ===');
  const REPEATS = 2;
  for (let world = 1; world <= 10; world++) {
    for (let iter = 1; iter <= REPEATS; iter++) {
      await runTest(`world-entry w${world} #${iter}`, () => testWorldEntry(world, iter));
    }
  }

  log('=== Test 1b: world-entry via enterFrom=goal (panel-stacking candidate) ===');
  for (const world of [1, 5, 10]) {
    for (let iter = 1; iter <= 2; iter++) {
      await runTest(`world-entry(goal) w${world} #${iter}`, () => testWorldEntryFromGoal(world, iter));
    }
  }

  log('=== Test 1c: world re-entry (already-seen lore/tips, no registry reset) ===');
  for (const world of [2, 6, 9]) {
    await runTest(`world-reentry w${world}`, () => testWorldReentry(world));
  }

  log('=== Test 2: battle round-trip (3 randomized iterations) ===');
  // Seed the registry with a real boot first (Title -> Hub) so playerHp/
  // playerStats/unlockedMoves are populated the way a real player's would
  // be, then jump Battle-to-Battle directly for speed.
  await freshBoot();
  await page.keyboard.press('Space');
  for (let i = 0; i < 20; i++) {
    if ((await getActiveScenes()).includes('Hub')) break;
    await sleep(200);
  }
  // Dismiss any first-run Lab tip.
  for (let i = 0; i < 5; i++) {
    const s = await page.evaluate(() => {
      const sc = window.__game.scene.getScene('Hub');
      return !!(sc && sc['dialogueContainer']);
    });
    if (!s) break;
    await clickText(['Got it', 'Close', 'Farewell']);
    await sleep(250);
  }
  for (let i = 1; i <= 3; i++) {
    await runTest(`battle round-trip #${i}`, () => testBattleRoundTrip(i));
  }

  log('=== Test 3: guardian panel open/close round-trip (worlds 1-10) ===');
  for (let world = 1; world <= 10; world++) {
    await runTest(`guardian panel w${world}`, () => testGuardianPanel(world));
  }

  log('=== Test 4: rival gate round-trip -- loss path (worlds 1, 10) ===');
  for (const world of [1, 10]) {
    await runTest(`rival gate (loss) w${world}`, () => testRivalGate(world));
  }

  log('=== Test 4b: rival gate round-trip -- win path, preset rivalDefeated (world 5 mid, world 10 finale) ===');
  await runTest('rival gate (win path) w5 -> story beat -> world 6', () => testRivalGateWinPath(5));
  await runTest('rival gate (win path) w10 -> finale panel -> Hub', () => testRivalGateWinPath(10));

  log('=== Test 4c: rival gate round-trip -- actually WON battle (world 3, boosted defense) ===');
  await runTest('rival gate (actual win) w3', () => testRivalGateActualWin(3));

  log('=== Test 4d: World 10 Adapted transmutation (attack / analytic / ultimate) ===');
  for (const moveId of ['tunnelStrike', 'skyfallBeam', 'ultimateMeteor']) {
    await runTest(`adapted transmute via ${moveId}`, () => testAdaptedTransmute(moveId));
  }

  log('=== Test 5: fresh-save and corrupt-save boot ===');
  await runTest('boot: fresh save', () =>
    testBootScenario('fresh', async () => {
      await page.evaluate(() => localStorage.clear());
    })
  );
  await runTest('boot: corrupt JSON save', () =>
    testBootScenario('corrupt-json', async () => {
      await page.evaluate(() => localStorage.setItem('qm-rpg-save-v1', '{ this is not valid JSON'));
    })
  );
  await runTest('boot: minimal/old-shape save', () =>
    testBootScenario('old-shape', async () => {
      await page.evaluate(() => localStorage.setItem('qm-rpg-save-v1', JSON.stringify({ qumatessence: 5 })));
    })
  );

  // ---- summary ----
  const passCount = results.filter((r) => r.pass).length;
  const failCount = results.length - passCount;
  const wallMs = Date.now() - wallStart;

  log('=== SUMMARY ===');
  log(`${passCount}/${results.length} passed, ${failCount} failed. Wall time: ${(wallMs / 1000).toFixed(1)}s`);
  const failures = results.filter((r) => !r.pass);
  if (failures.length) {
    log('Failures:');
    failures.forEach((f) => log(`  - ${f.name}: ${f.detail}`));
  }

  fs.writeFileSync(`${SHOT_DIR}/component-tests-log.txt`, logLines.join('\n'));
  fs.writeFileSync(
    `${SHOT_DIR}/component-tests-summary.json`,
    JSON.stringify({ passCount, failCount, wallMs, results }, null, 2)
  );

  await browser.close();
  teardownDevServer(serverHandle, log);

  return failCount === 0;
}

main()
  .then((ok) => process.exit(ok ? 0 : 1))
  .catch((e) => {
    console.error('FATAL:', e);
    process.exit(2);
  });
