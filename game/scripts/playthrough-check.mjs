// Full, slow, real end-to-end playthrough check for world_of_quantum_materials:
// boots a fresh save, then walks a headless-Chrome-driven session all the way
// from World 1 through beating World 10's rival (the real finale panel,
// OverworldScene.showFinalePanel()) -- BFS-pathfinding each generated map,
// fighting every encounter and rival with whatever moves are unlocked,
// bouncing to the Lab between rival attempts to shop (weighted toward actual
// guardian-shop purchases, not just window-shopping), and occasionally taking
// a Bloch side-trip to an earlier world. Losing individual battles is fine
// and expected -- the question this answers is whether the whole chain is
// completable at all, not whether it's completable perfectly.
//
// Run scripts/component-check.mjs FIRST when chasing a bug -- it's ~100x
// faster and catches most individual-mechanism regressions directly. Reach
// for this script for the question component-check can't answer: does a
// full run actually reach the finale, and if not, exactly where does it get
// stuck. See dev_notes/DEVELOPMENT.md's "Full-playthrough and component
// checks" section for the fuller writeup.
//
// Usage (from game/): npm run playthrough-check
// Or directly: node scripts/playthrough-check.mjs
// Expect this to take anywhere from ~20 minutes to over an hour -- each
// rival attempt (battle + Lab shopping detour) is ~20-30s, worlds 1-10 each
// allow up to 15 attempts before being reported as a real blocker, and later
// worlds' steeper difficulty curve (see balance-sim's own two-phase growth
// comment) plus occasional headless-Chrome crash-recovery (see below) both
// add time. Not something to run inline in a tight loop -- kick it off in
// the background and check the log/summary when it's done.

import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GAME_DIR = process.env.GAME_DIR || path.resolve(__dirname, '..');
const URL = process.env.QM_URL || 'http://localhost:5173/';
const GRID_W = 27;
const GRID_H = 50;
// Screenshots/logs from a run -- gitignored, not meant to be committed.
const SHOT_DIR = path.join(GAME_DIR, '.check-artifacts');
fs.mkdirSync(SHOT_DIR, { recursive: true });

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

function bfs(walkable, start, goal) {
  const key = (p) => `${p.x},${p.y}`;
  if (start.x === goal.x && start.y === goal.y) return [start];
  const visited = new Set([key(start)]);
  const prev = new Map();
  const queue = [start];
  const dirs = [
    { dx: 1, dy: 0 },
    { dx: -1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: 0, dy: -1 },
  ];
  while (queue.length) {
    const cur = queue.shift();
    if (cur.x === goal.x && cur.y === goal.y) {
      const path = [cur];
      let k = key(cur);
      while (prev.has(k)) {
        const p = prev.get(k);
        path.unshift(p);
        k = key(p);
      }
      return path;
    }
    for (const { dx, dy } of dirs) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      if (nx < 0 || nx >= GRID_W || ny < 0 || ny >= GRID_H) continue;
      if (!walkable[ny]?.[nx]) continue;
      const nk = `${nx},${ny}`;
      if (visited.has(nk)) continue;
      visited.add(nk);
      prev.set(nk, cur);
      queue.push({ x: nx, y: ny });
    }
  }
  return null;
}

async function main() {
  const logLines = [];
  const log = (msg) => {
    const line = `[${new Date().toISOString().slice(11, 19)}] ${msg}`;
    console.log(line);
    logLines.push(line);
  };

  const CHROME_BIN = detectChromeBin();
  const serverHandle = await ensureDevServer(log);

  let browser = await puppeteer.launch({
    executablePath: CHROME_BIN,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    headless: true,
  });
  let page = await browser.newPage();
  const consoleErrors = [];

  async function wirePage() {
    await page.setViewport({ width: 854, height: 480 });
    page.on('console', (msg) => {
      // Chrome's console text for a failed resource load has no URL in it
      // ("Failed to load resource: the server responded with a status of
      // 404 (Not Found)"), so a favicon.ico substring filter can never
      // match it -- the response/requestfailed listeners below are the
      // URL-aware, authoritative source for bad resource loads, so this
      // generic message is dropped here entirely rather than risk masking
      // (or wrongly flagging) a real one.
      if (msg.text().startsWith('Failed to load resource:')) return;
      if (msg.type() === 'error' && !msg.text().includes('favicon.ico')) {
        consoleErrors.push(msg.text());
        log(`[console.error] ${msg.text()}`);
      }
    });
    page.on('pageerror', (err) => {
      consoleErrors.push(String(err));
      log(`[pageerror] ${err}`);
    });
    page.on('response', (res) => {
      if (res.status() >= 400 && !res.url().includes('favicon.ico')) {
        consoleErrors.push(`HTTP ${res.status()} ${res.url()}`);
      }
    });
    page.on('requestfailed', (req) => {
      if (!req.url().includes('favicon.ico')) {
        consoleErrors.push(`request failed: ${req.url()} (${req.failure()?.errorText})`);
      }
    });
  }
  await wirePage();

  // Headless Chrome here falls back to software WebGL (SwiftShader) --
  // console warns as much on boot -- which is far more prone to renderer
  // crashes under repeated Phaser scene create/destroy churn (many Battle
  // scenes in a row) than real GPU rendering would be. That's an artifact of
  // this sandboxed environment, not the game itself, so rather than treat a
  // crashed tab as a playthrough failure, relaunch the browser and resume
  // from the persisted save (data/save.ts) -- a real player closing and
  // reopening the game exercises the exact same save/resume path anyway.
  let browserRelaunches = 0;
  async function relaunchBrowser() {
    browserRelaunches++;
    log(`  !!! Browser/page appears dead -- relaunching (attempt ${browserRelaunches}) and resuming from the persisted save...`);
    try {
      await browser.close();
    } catch (e) {
      /* already dead */
    }
    browser = await puppeteer.launch({
      executablePath: CHROME_BIN,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      headless: true,
    });
    page = await browser.newPage();
    await wirePage();
    await page.goto(URL);
    await page.waitForSelector('canvas');
    await sleep(1200);
    // Deliberately NOT clearing localStorage -- resuming, not starting over.
    await page.keyboard.press('Space'); // Title -> Hub (Continue, since a save exists)
    for (let i = 0; i < 20; i++) {
      if ((await getActiveScenes()).includes('Hub')) break;
      await sleep(300);
    }
  }

  // ---- page-context helpers ----
  const getActiveScenes = () =>
    page.evaluate(() => window.__game.scene.getScenes(true).map((s) => s.scene.key));

  // HubScene's own native panels (showPanel, station shops) only ever set
  // `dialogueContainer`, not `dialogueActive` -- that field is only written
  // by the shared guardian-panel files (GuardianPanelHost), which HubScene
  // also implements. OverworldScene always sets both together. Checking
  // `dialogueContainer` presence is therefore the one signal that correctly
  // means "a panel is open, don't try to act on the room/map" in both scenes.
  const readActiveDialogueState = () =>
    page.evaluate(() => {
      const active = window.__game.scene.getScenes(true);
      for (const s of active) {
        if (s.scene.key === 'Overworld' || s.scene.key === 'Hub') {
          return { sceneKey: s.scene.key, dialogueActive: !!s['dialogueContainer'] };
        }
      }
      return null;
    });

  const readOverworldState = () =>
    page.evaluate(() => {
      const s = window.__game.scene.getScene('Overworld');
      if (!s || !window.__game.scene.isActive('Overworld')) return null;
      return {
        world: s['world'],
        playerTile: s['playerTile'],
        goalTile: s['goalTile'],
        midTile: s['midTile'],
        walkable: s['walkable'],
        moving: s['moving'],
        dialogueActive: s['dialogueActive'],
        reachedGoal: s['reachedGoal'],
      };
    });

  const stepOverworld = (dx, dy) =>
    page.evaluate(
      ({ dx, dy }) => {
        const s = window.__game.scene.getScene('Overworld');
        s['tryMove'](dx, dy);
      },
      { dx, dy }
    );

  // The pass interaction, driven the way a player drives it: read the gate the
  // player is standing at, then commit. Arrival at a pass does nothing on its
  // own, so this press is the only thing that ever challenges a rival or
  // crosses into the next world.
  const pressAtGate = () =>
    page.evaluate(() => {
      const s = window.__game.scene.getScene('Overworld');
      const gate = s['gateAtPlayer']();
      if (gate !== 'forward') return { pressed: false };
      const rd = window.__game.registry.get('rivalDefeated') || {};
      const state = rd[s['world']] ? 'open' : 'shut';
      s['confirmGate']();
      return { pressed: true, state };
    });

  const waitNotMoving = async (timeoutMs = 3000) => {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const ow = await readOverworldState();
      if (!ow || !ow.moving) return true;
      await sleep(60);
    }
    return false;
  };

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

  const hubHasPanel = () =>
    page.evaluate(() => {
      const s = window.__game.scene.getScene('Hub');
      return !!(s && s['dialogueContainer']);
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

  const PRIORITY = [
    'The Decoherence is stabilized',
    'Battle!',
    'Next ->',
    'Onward',
    'Got it',
    'Fight!',
    'Return to the Lab',
    'Farewell',
    'Close',
  ];

  // Repeatedly resolves whatever dialogue/tip/taunt/lore panel is open using
  // the priority list above, until dialogueActive clears or a Battle scene
  // appears. Returns { outcome: 'clear'|'battle'|'stuck', clicked: string[] }.
  const EXIT_LIKE = ['Close', 'Farewell', 'Cancel', 'Not yet', '[ Close ]'];

  async function diagnoseStuckDialogue(label) {
    const dump = await page.evaluate(() => {
      const activeScenes = window.__game.scene.getScenes(true).map((sc) => sc.scene.key);
      // Read from whichever scene is ACTUALLY active, not always Overworld
      // -- an inactive scene instance can carry harmless stale
      // dialogueContainer/dialogueActive state left over from before its
      // last scene.start() (Phaser reuses scene instances; that state gets
      // reset at the top of the next create()), and reading it here would
      // misleadingly suggest the stuck panel is showing when it's really
      // just leftover, not currently rendered.
      const key = activeScenes.includes('Overworld') ? 'Overworld' : activeScenes.includes('Hub') ? 'Hub' : null;
      const s = key ? window.__game.scene.getScene(key) : null;
      const c = s ? s['dialogueContainer'] : null;
      return {
        activeScenes,
        readFrom: key,
        world: s && key === 'Overworld' ? s['world'] : null,
        dialogueContainerPresent: !!c,
        containerTexts: c ? c.list.filter((o) => o.text).map((o) => o.text) : null,
      };
    });
    log(`  !!! ${label}: ${JSON.stringify(dump)}`);
    await page.screenshot({ path: `${SHOT_DIR}/repeat-diag.png` });
  }

  // Resolves whatever panel is currently open by clicking through it one
  // button at a time. `clicked` is the full history this call has produced
  // so far; the last two entries being identical means the previous click
  // was a no-op (e.g. "Next ->" already on a list's last page) -- a real
  // player would notice and try something else, so once that happens this
  // excludes the repeated button and prefers an exit-shaped one instead of
  // blindly re-clicking it. Only truly gives up (stuck-repeating) if even
  // avoiding the repeated button can't make progress for many rounds.
  async function resolveDialogues() {
    const clicked = [];
    let noProgressRounds = 0;
    for (let i = 0; i < 40; i++) {
      const scenes = await getActiveScenes();
      if (scenes.includes('Battle')) return { outcome: 'battle', clicked };
      const dstate = await readActiveDialogueState();
      if (!dstate || !dstate.dialogueActive) return { outcome: 'clear', clicked };

      const lastTwoSame = clicked.length >= 2 && clicked[clicked.length - 1] === clicked[clicked.length - 2];
      const avoid = lastTwoSame ? clicked[clicked.length - 1] : null;

      let clickedThisRound = null;
      if (avoid) {
        const texts = await listInteractiveTexts();
        const candidates = texts.filter((t) => t !== avoid && t !== 'Let me pass' && t.trim().length > 0);
        const preferred = candidates.find((t) => EXIT_LIKE.some((e) => t === e || t.includes(e)));
        const pick = preferred || candidates.find((t) => PRIORITY.some((p) => t === p || t.startsWith(p))) || candidates[0];
        if (pick) {
          const r = await clickText([pick]);
          clickedThisRound = r.clicked;
        }
      } else {
        const result = await clickText(PRIORITY);
        clickedThisRound = result.clicked;
        if (!clickedThisRound) {
          const alt = (result.available || []).filter((t) => t !== 'Let me pass' && t.trim().length > 0);
          if (alt.length) {
            const r2 = await clickText([alt[0]]);
            clickedThisRound = r2.clicked;
          }
        }
      }

      if (!clickedThisRound) {
        log('  resolveDialogues STUCK -- no clickable buttons found.');
        await page.screenshot({ path: `${SHOT_DIR}/stuck-dialogue.png` });
        return { outcome: 'stuck', clicked };
      }

      clicked.push(clickedThisRound);
      log(avoid ? `  clicked (avoiding no-op "${avoid}"): "${clickedThisRound}"` : `  clicked: "${clickedThisRound}"`);

      noProgressRounds = clicked.length >= 2 && clicked[clicked.length - 1] === clicked[clicked.length - 2] ? noProgressRounds + 1 : 0;
      if (noProgressRounds >= 3) {
        await diagnoseStuckDialogue(`REPEAT DIAGNOSTIC (no progress for ${noProgressRounds} rounds, last click "${clickedThisRound}")`);
        if (noProgressRounds >= 8) {
          log('  !!! Giving up on this dialogue -- no real progress even after avoiding no-op buttons.');
          return { outcome: 'stuck-repeating', clicked };
        }
      }
      await sleep(500);
    }
    return { outcome: 'stuck', clicked };
  }

  async function resolveBattle() {
    let rounds = 0;
    let lastLog = '';
    let isRival = false;
    while (rounds++ < 60) {
      const st = await page.evaluate(() => {
        const s = window.__game.scene.getScene('Battle');
        if (!s || !window.__game.scene.isActive('Battle')) return null;
        return {
          turnLock: s['turnLock'],
          playerHp: s['playerHp'],
          opponentHp: s['opponentHp'],
          moveIds: s['currentMoveIds'],
          isRival: s['isRival'],
          world: s['world'],
        };
      });
      if (!st) return { outcome: 'scene-gone', rounds, isRival };
      isRival = st.isRival;
      if (rounds === 1) log(`  battle start: world ${st.world}, isRival=${st.isRival}, moveIds=${JSON.stringify(st.moveIds)}`);
      if (st.playerHp <= 0 || st.opponentHp <= 0) {
        lastLog = st.playerHp <= 0 ? 'LOST' : 'WON';
        break;
      }
      if (!st.turnLock) {
        if (!st.moveIds || st.moveIds.length === 0) {
          log(`  !!! NO USABLE MOVES -- getBattleMoves returned empty. This is a real progression blocker.`);
          await page.screenshot({ path: `${SHOT_DIR}/no-moves.png` });
          return { outcome: 'no-moves', rounds };
        }
        await page.evaluate((moveId) => {
          const s = window.__game.scene.getScene('Battle');
          try {
            s['playerAttack'](moveId);
          } catch (e) {
            console.error('playerAttack threw: ' + e);
          }
        }, st.moveIds[0]);
      }
      await sleep(550);
    }
    if (rounds >= 60) {
      log('  !!! battle did not resolve within 60 rounds -- possible stuck battle');
      await page.screenshot({ path: `${SHOT_DIR}/battle-timeout.png` });
      return { outcome: 'timeout', rounds, isRival };
    }
    // Dismiss the victory/defeat summary (endBattle's keydown-SPACE-once handler)
    await sleep(900);
    await page.keyboard.press('Space');
    await sleep(500);
    return { outcome: lastLog, rounds, isRival };
  }

  // A few undirected steps in whatever world we currently stand in,
  // fighting anything encountered -- used both for Bloch side-trips to an
  // earlier world (below) and could be reused for ordinary wandering.
  // Doesn't aim for the goal, just exercises movement/encounters/battle in
  // a world the main loop isn't otherwise walking through right now.
  async function wanderAndFight(steps) {
    for (let i = 0; i < steps; i++) {
      const scenes = await getActiveScenes();
      if (scenes.includes('Battle')) {
        const result = await resolveBattle();
        log(`  [revisit] battle ${result.outcome} (round ${result.rounds})`);
        continue;
      }
      const dstate = await readActiveDialogueState();
      if (dstate?.sceneKey !== 'Overworld') return; // left this world already
      if (dstate.dialogueActive) {
        await resolveDialogues();
        continue;
      }
      const ow = await readOverworldState();
      if (!ow) return;
      const dirs = [
        { dx: 1, dy: 0 },
        { dx: -1, dy: 0 },
        { dx: 0, dy: 1 },
        { dx: 0, dy: -1 },
      ];
      const walkableDirs = dirs.filter(
        ({ dx, dy }) => ow.walkable[ow.playerTile.y + dy]?.[ow.playerTile.x + dx]
      );
      if (walkableDirs.length === 0) return;
      const { dx, dy } = walkableDirs[Math.floor(Math.random() * walkableDirs.length)];
      await stepOverworld(dx, dy);
      await waitNotMoving(3000);
    }
  }

  // Simulates a player bouncing back to the Lab and poking around rather
  // than always making the single optimal purchase -- picks mostly-random
  // available buttons (occasionally backing out early, same as a real
  // player browsing), which naturally wanders into Noether's shop, Guardians
  // list, etc. and buys whatever's affordable it happens to click, without
  // hand-coding each guardian's own shop layout. "Travel to World N" (Bloch,
  // once met) and "Guardians" get extra weight so a real playthrough's habit
  // of occasionally revisiting an earlier world to grind gets exercised
  // deliberately rather than left to pure chance.
  async function randomHubVisit(maxActions = 12) {
    log('  -> Detour to the Lab...');
    await page.keyboard.press('Enter');
    await sleep(700);
    let scenes = await getActiveScenes();
    if (!scenes.includes('Hub')) {
      log('  !!! Enter key from Overworld did not reach Hub');
      return false;
    }
    for (let i = 0; i < maxActions; i++) {
      const active = await getActiveScenes();
      if (!active.includes('Hub')) {
        // A random click (Bloch's teleport, most likely) took us to another
        // world's Overworld -- wander/fight there briefly, then come home.
        log('  [lab] left the Lab for another world -- wandering there briefly...');
        await wanderAndFight(3 + Math.floor(Math.random() * 4));
        await page.keyboard.press('Enter');
        await sleep(700);
        if (!(await getActiveScenes()).includes('Hub')) break;
        continue;
      }
      const texts = await listInteractiveTexts();
      const candidates = texts.filter(
        (t) => !t.startsWith('Enter World') && !t.startsWith('Back to World')
      );
      if (candidates.length === 0) break;
      const closeLike = candidates.filter((t) => ['Farewell', 'Close', 'Cancel', 'Not yet'].includes(t));
      // Every purchase button in every guardian shop includes "qumatessence"
      // in its own label (shopCost's convention, e.g. Noether's
      // `${label}: ${value} -> ${value+1} -- ${cost} qumatessence`) -- a
      // real player who bothers to open a shop mostly buys things rather
      // than window-shopping forever, so weight these heavily once visible.
      // Affordability is still enforced by the purchase handler itself
      // (a too-expensive click just no-ops), so this can't overspend.
      const purchaseLike = candidates.filter((t) => t.includes('qumatessence'));
      const weighted = [...candidates];
      candidates.forEach((t) => {
        if (t === 'Guardians' || t.startsWith('Travel to World')) weighted.push(t, t, t);
        if (t.includes('qumatessence')) weighted.push(t, t, t, t, t, t);
      });
      let pick;
      if (purchaseLike.length && Math.random() < 0.7) {
        pick = purchaseLike[Math.floor(Math.random() * purchaseLike.length)];
      } else if (Math.random() < 0.2 && closeLike.length) {
        pick = closeLike[Math.floor(Math.random() * closeLike.length)];
      } else {
        pick = weighted[Math.floor(Math.random() * weighted.length)];
      }
      await clickText([pick]);
      log(`  [lab] clicked: "${pick}"`);
      await sleep(350);
    }
    // Unwind any open panel stack before heading back (also covers landing
    // back in Hub with a leftover panel after a Bloch round trip).
    for (let i = 0; i < 12; i++) {
      if (!(await getActiveScenes()).includes('Hub')) break;
      if (!(await hubHasPanel())) break;
      const r = await clickText(['Farewell', 'Close', 'Cancel', 'Not yet']);
      if (!r.clicked) {
        const texts = await listInteractiveTexts();
        const alt = texts.find((t) => !t.startsWith('Enter World') && !t.startsWith('Back to World'));
        if (alt) await clickText([alt]);
        else break;
      }
      await sleep(350);
    }
    await sleep(300);
    if (!(await getActiveScenes()).includes('Hub')) return true;
    const r = await clickText(['Back to World', 'Enter World']);
    log(`  clicked: "${r.clicked}" (returning to world)`);
    await sleep(700);
    return true;
  }

  // ---- boot ----
  log('Booting fresh game...');
  await page.goto(URL);
  await page.waitForSelector('canvas');
  await sleep(1200);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('canvas');
  await sleep(1200);

  await page.keyboard.press('Space'); // Title -> Hub
  {
    const ok = await (async () => {
      for (let i = 0; i < 20; i++) {
        if ((await getActiveScenes()).includes('Hub')) return true;
        await sleep(300);
      }
      return false;
    })();
    if (!ok) {
      log('FAILED: never reached Hub after Title');
      await page.screenshot({ path: `${SHOT_DIR}/fail-boot.png` });
      await browser.close();
      return { success: false, reason: 'boot-failed', log: logLines };
    }
  }
  log('Reached Hub.');

  // A first-run Lab tip may auto-open (maybeShowLabTip) -- dismiss it.
  await resolveDialogues();

  const stats = {
    worldsCompleted: [],
    battlesWon: 0,
    battlesLost: 0,
    rivalRetries: {},
    labVisits: 0,
    totalSteps: 0,
  };

  let finaleReached = false;
  let currentRivalAttempts = 0;
  let lastKnownWorld = 0;
  const MAX_TOTAL_ITERATIONS = 6000;
  let iter = 0;
  let failure = null;
  let consecutiveErrors = 0;

  // A player realistically bounces to the Lab and back rather than only
  // shopping when truly desperate -- do a random Hub browse before the
  // very first world and after every rival loss (see randomHubVisit above).
  await randomHubVisit(10);
  stats.labVisits++;

  while (iter++ < MAX_TOTAL_ITERATIONS && !finaleReached && !failure) {
    try {
    const scenes = await getActiveScenes();

    if (scenes.includes('Battle')) {
      const result = await resolveBattle();
      if (result.outcome === 'WON') {
        stats.battlesWon++;
        log(`Battle WON (round ${result.rounds}).`);
      } else if (result.outcome === 'LOST') {
        stats.battlesLost++;
        log(`Battle LOST (round ${result.rounds}) -- healing and continuing (losses are acceptable).`);
        if (result.isRival) {
          const visited = await randomHubVisit(16);
          if (visited) stats.labVisits++;
        }
      } else {
        failure = { reason: `battle-${result.outcome}`, world: lastKnownWorld };
        log(`Battle ended abnormally: ${result.outcome}`);
      }
      consecutiveErrors = 0;
      continue;
    }

    const dstate = await readActiveDialogueState();

    if (dstate?.sceneKey === 'Hub') {
      if (dstate.dialogueActive) {
        const r = await resolveDialogues();
        if (r.clicked.some((c) => c === 'Return to the Lab')) {
          // shouldn't happen from Hub itself, but harmless
        }
        if (r.outcome === 'stuck' || r.outcome === 'stuck-repeating') {
          failure = { reason: `hub-dialogue-${r.outcome}`, world: lastKnownWorld, clicked: r.clicked.slice(-15) };
          log(`FAILED: Hub dialogue never resolved (${r.outcome}).`);
        }
        continue;
      }
      if (finaleReached) break;
      log('In Hub, entering/resuming world via door...');
      const r = await clickText(['Enter World', 'Back to World']);
      if (!r.clicked) {
        failure = { reason: 'no-door-button', available: r.available };
        log(`FAILED: no door button found. available=${JSON.stringify(r.available)}`);
        break;
      }
      log(`  clicked: "${r.clicked}"`);
      await sleep(700);
      continue;
    }

    if (dstate?.sceneKey === 'Overworld') {
      if (dstate.dialogueActive) {
        const before = await readOverworldState();
        const r = await resolveDialogues();
        if (r.clicked.some((c) => c.startsWith('The Decoherence is stabilized'))) {
          log('>>> World 10 rival defeated, finale triggered.');
        }
        if (r.clicked.some((c) => c === 'Return to the Lab')) {
          finaleReached = true;
          log('>>> FINALE PANEL DISMISSED -- game completed end to end.');
        }
        if (r.outcome === 'stuck' || r.outcome === 'stuck-repeating') {
          failure = { reason: `overworld-dialogue-${r.outcome}`, world: lastKnownWorld, clicked: r.clicked.slice(-15) };
          log(`FAILED: Overworld dialogue never resolved (${r.outcome}).`);
        }
        continue;
      }

      const ow = await readOverworldState();
      if (!ow) {
        await sleep(200);
        continue;
      }
      if (ow.world !== lastKnownWorld) {
        lastKnownWorld = ow.world;
        currentRivalAttempts = 0;
        log(`=== Entered World ${ow.world} ===`);
      }
      // The route ends at the pass mouth, one row south of the throat: the
      // throat is the rival's own tile while that world's rival still stands,
      // and nothing in either pass happens on arrival anyway. Reaching the
      // mouth, the bot presses -- challenging the guard, or crossing.
      const mouth = { x: ow.goalTile.x, y: ow.goalTile.y + 1 };
      if (ow.playerTile.y <= mouth.y) {
        const gate = await pressAtGate();
        if (gate.pressed) {
          if (gate.state === 'shut') {
            currentRivalAttempts++;
            stats.rivalRetries[ow.world] = (stats.rivalRetries[ow.world] || 0) + 1;
            if (currentRivalAttempts > 15) {
              failure = { reason: 'rival-unwinnable-after-15-attempts-with-shopping', world: ow.world };
              log(`FAILED: rival at world ${ow.world} not beaten after 15 attempts, each preceded by a Lab shopping detour.`);
            }
          } else {
            currentRivalAttempts = 0;
          }
        }
        await sleep(600);
        continue;
      }

      const path = bfs(ow.walkable, ow.playerTile, mouth);
      if (!path || path.length < 2) {
        failure = { reason: 'no-bfs-path', world: ow.world, playerTile: ow.playerTile, goalTile: mouth };
        log(`FAILED: BFS found no path from ${JSON.stringify(ow.playerTile)} to the pass mouth ${JSON.stringify(mouth)} in world ${ow.world}.`);
        await page.screenshot({ path: `${SHOT_DIR}/no-path-world${ow.world}.png` });
        break;
      }
      const [cur, next] = path;
      const dx = Math.sign(next.x - cur.x);
      const dy = Math.sign(next.y - cur.y);
      await stepOverworld(dx, dy);
      stats.totalSteps++;
      const moved = await waitNotMoving(3000);
      if (!moved) {
        failure = { reason: 'movement-hang', world: ow.world, tile: cur };
        log(`FAILED: movement never completed (still 'moving' after 3s) at ${JSON.stringify(cur)}.`);
      }
      continue;
    }

    // Neither Hub nor Overworld active and not in Battle -- unexpected.
    await sleep(300);
    } catch (e) {
      consecutiveErrors++;
      log(`  !!! iteration error (${consecutiveErrors} in a row): ${e.message || e}`);
      if (consecutiveErrors >= 3) {
        if (browserRelaunches >= 8) {
          failure = { reason: 'repeated-browser-crashes', world: lastKnownWorld, error: String(e.message || e) };
          log('FAILED: too many browser relaunches, giving up.');
          break;
        }
        try {
          await relaunchBrowser();
          consecutiveErrors = 0;
        } catch (e2) {
          log(`  !!! relaunch itself failed: ${e2.message || e2}`);
          await sleep(2000);
        }
      } else {
        await sleep(1500);
      }
    }
  }

  if (iter >= MAX_TOTAL_ITERATIONS && !finaleReached && !failure) {
    failure = { reason: 'iteration-budget-exhausted', world: lastKnownWorld };
    log('FAILED: exhausted iteration budget without reaching the finale.');
  }

  try {
    await page.screenshot({ path: `${SHOT_DIR}/final-state.png` });
  } catch (e) {
    log(`  (final screenshot failed: ${e.message || e})`);
  }

  const summary = {
    success: !!finaleReached,
    failure,
    lastKnownWorld,
    stats,
    consoleErrors,
  };

  log('=== SUMMARY ===');
  log(JSON.stringify(summary, null, 2));

  fs.writeFileSync(`${SHOT_DIR}/playthrough-log.txt`, logLines.join('\n'));
  fs.writeFileSync(`${SHOT_DIR}/playthrough-summary.json`, JSON.stringify(summary, null, 2));

  try {
    await browser.close();
  } catch (e) {
    // already dead, nothing to do
  }
  teardownDevServer(serverHandle, log);
  return summary;
}

main().then((s) => {
  process.exit(s.success ? 0 : 1);
}).catch((e) => {
  console.error('FATAL:', e);
  process.exit(2);
});
