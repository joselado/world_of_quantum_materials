// Regenerates the screenshots the player-facing docs embed.
//
// `README.md` and everything under `docs/` illustrate themselves with PNGs in
// the repo's top-level `screenshots/`. Those are the one part of the docs that
// cannot be kept true by reading them: a world's palette changes, a guardian is
// replaced, a panel is re-laid-out, and the prose gets updated while the picture
// beside it quietly goes on showing last month's game. This script is how they
// are brought back into line -- run it after any change that alters what the
// game looks like, the same way `npm run docs` is run after a change to the
// content tables.
//
// Usage (from game/): npm run shots
// Or a subset:        npm run shots -- worlds guardians
// Groups: title, hub, worlds, guardians, battle. No argument runs all of them.
//
// Every shot is taken at the game's own 854x480 canvas, so the images match what
// a player actually sees rather than a scaled-up capture. Each is driven into
// its state through the scene's own methods -- the same approach
// component-check.mjs takes -- rather than by clicking through the UI, so a shot
// is reproducible and does not depend on a run of play going a particular way.
//
// CHROME_BIN auto-detects Puppeteer's cached Chrome-for-Testing binary if unset.
// If the dev server isn't already up on :5173 this starts one and tears it down
// at the end.
//
// Not everything in `screenshots/` is regenerated here. A handful of shots
// depend on a battle reaching a particular moment (a type-mismatch hit landing,
// a victory banner, an analytic question mid-flight) and are not yet driven;
// `SHOT_GROUPS` below is the list of what this script does cover, and anything
// absent from it is still hand-captured. Adding one is a matter of driving the
// state and adding an entry.

import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GAME_DIR = process.env.GAME_DIR || path.resolve(__dirname, '..');
const REPO_DIR = path.resolve(GAME_DIR, '..');
const SHOT_DIR = path.join(REPO_DIR, 'screenshots');
const URL = process.env.QM_URL || 'http://localhost:5173/';
const CANVAS_W = 854;
const CANVAS_H = 480;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// The ten worlds, for the per-world overworld shots `docs/storyline.md` puts
// beside each world's own section. Names are only used in log output.
const WORLDS = [
  [1, 'The Mean Fields'],
  [2, 'The Stone Lattice'],
  [3, 'The Edge Cliffs'],
  [4, 'The Storm Flats'],
  [5, 'The Vortex Glacier'],
  [6, 'The Iron Steppe'],
  [7, 'The Entangled Web'],
  [8, 'The Screened Swamp'],
  [9, 'The Defect Scars'],
  [10, 'The Devouring Mirror'],
];

// Which world each guardian stands in, for the per-guardian panel shots
// `docs/guardians.md` embeds. Read off OverworldScene's WORLD_GUARDIANS.
const GUARDIANS = [
  [1, 'noether'],
  [2, 'bloch'],
  [3, 'dresselhaus'],
  [4, 'landau'],
  [5, 'majorana'],
  [6, 'kondo'],
  [7, 'feynman'],
  [8, 'anderson'],
  [9, 'franklin'],
  [10, 'curie'],
];

// The wild encounters README and docs/crystals.md illustrate, each chosen for
// the physics its question asks. Driven by name so the shot keeps showing the
// compound the surrounding prose talks about.
const ENCOUNTERS = [
  ['encounter', 'Nickel Oxide', 1],
  ['encounter-topological', 'Bi₂Te₃', 3],
  ['encounter-supercon', 'Aluminum', 5],
  ['encounter-tensornet', 'Herbertsmithite', 8],
];

const SHOT_GROUPS = ['title', 'hub', 'worlds', 'guardians', 'battle', 'encounters'];

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

async function main() {
  const started = Date.now();
  const log = (msg) => console.log(`[${new Date().toTimeString().slice(0, 8)}] ${msg}`);

  const requested = process.argv.slice(2).filter((a) => SHOT_GROUPS.includes(a));
  const groups = requested.length ? requested : SHOT_GROUPS;
  log(`Groups: ${groups.join(', ')}`);

  fs.mkdirSync(SHOT_DIR, { recursive: true });
  const CHROME_BIN = detectChromeBin();
  const server = await ensureDevServer(log);
  const browser = await puppeteer.launch({
    executablePath: CHROME_BIN,
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', `--window-size=${CANVAS_W},${CANVAS_H}`],
  });

  const written = [];
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: CANVAS_W, height: CANVAS_H });
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__game && window.__game.scene.getScenes(true).length, {
      timeout: 30000,
    });

    // A crop of the canvas rather than the whole frame, for the doc images that
    // show one element (a guardian's avatar) rather than a whole screen.
    const shootClip = async (name, clip) => {
      const file = path.join(SHOT_DIR, `${name}.png`);
      await page.screenshot({ path: file, clip });
      const kb = (fs.statSync(file).size / 1024).toFixed(0);
      written.push({ name, kb: Number(kb), min: 1 });
      log(`  wrote ${name}.png (${kb} kB, cropped)`);
    };

    const shoot = async (name) => {
      const file = path.join(SHOT_DIR, `${name}.png`);
      await page.screenshot({ path: file });
      const kb = (fs.statSync(file).size / 1024).toFixed(0);
      written.push({ name, kb: Number(kb) });
      log(`  wrote ${name}.png (${kb} kB)`);
    };

    // A save with everything unlocked, so panels show their full content
    // rather than a fresh save's empty states.
    const openUp = async () => {
      await page.evaluate(() => {
        const g = window.__game;
        g.registry.set('qumatessence', 900);
        g.registry.set('superposition', true);
      });
    };

    if (groups.includes('title')) {
      log('=== title ===');
      await page.evaluate(() => window.__game.scene.start('Title'));
      await sleep(1200);
      await shoot('title');
    }

    if (groups.includes('hub')) {
      log('=== hub ===');
      await openUp();
      await page.evaluate(() => window.__game.scene.start('Hub'));
      await sleep(1200);
      await shoot('hub');
      await shoot('docs-guardians-lab');
      // Qumatex, the Lab's materialdex station.
      const opened = await page.evaluate(async () => {
        const s = window.__game.scene.getScene('Hub');
        if (typeof s['showMaterialdex'] === 'function') {
          s['showMaterialdex']();
          return true;
        }
        return false;
      });
      await sleep(700);
      if (opened) await shoot('hub-materialdex');
      else log('  (skipped hub-materialdex -- no showMaterialdex on HubScene)');

      const settings = await page.evaluate(async () => {
        const g = window.__game;
        const sc = g.scene.getScene('Hub');
        sc['dialogueContainer']?.destroy(true);
        const mod = await import('/src/scenes/panels/hubStations.ts');
        if (!mod.showSettingsPanel) return false;
        mod.showSettingsPanel(sc);
        return true;
      });
      await sleep(700);
      if (settings) await shoot('settings');
      else log('  (skipped settings -- showSettingsPanel not reachable)');
    }

    if (groups.includes('worlds')) {
      log('=== worlds ===');
      for (const [world, name] of WORLDS) {
        await page.evaluate((w) => window.__game.scene.start('Overworld', { world: w }), world);
        await sleep(1400);
        // Dismiss the world-entry lore pages, then stand the player in the
        // middle of the map. Shot from the entrance, a world is mostly its own
        // back-exit sign and the "press Space to go back" prompt; from the
        // middle it is the terrain, which is what these images are for.
        await page.evaluate(async () => {
          const s = window.__game.scene.getScene('Overworld');
          for (let i = 0; i < 4; i++) {
            if (!s['dialogueActive']) break;
            s['closeDialogue']?.();
            await new Promise((r) => setTimeout(r, 120));
          }
          // Walk in with the scene's own movement rather than teleporting the
          // player tile: the camera follows the walk, and a tile set directly
          // leaves the view still framed on the entrance.
          for (let step = 0; step < 7; step++) {
            s['tryMove']?.(0, -1);
            await new Promise((r) => setTimeout(r, 170));
            if (s['dialogueActive']) break;
          }
          await new Promise((r) => setTimeout(r, 400));
          for (let i = 0; i < 3; i++) {
            if (!s['dialogueActive']) break;
            s['closeDialogue']?.();
            await new Promise((r) => setTimeout(r, 120));
          }
        });
        await sleep(700);
        log(`  world ${world} -- ${name}`);
        await shoot(`storyline-world-${world}`);
        if (world === 1) await shoot('overworld');
        // README illustrates the range of worlds with three of them under
        // their own names; the same frame is written twice rather than
        // captured twice, so the README and the storyline cannot drift apart.
        if (world === 4) await shoot('biome-landau');
        if (world === 7) await shoot('biome-network');
        if (world === 9) await shoot('biome-cracked');
      }
    }

    if (groups.includes('guardians')) {
      log('=== guardians ===');
      await openUp();
      for (const [world, id] of GUARDIANS) {
        await page.evaluate((w) => window.__game.scene.start('Overworld', { world: w }), world);
        await sleep(1300);
        const ok = await page.evaluate(async () => {
          const s = window.__game.scene.getScene('Overworld');
          for (let i = 0; i < 4; i++) {
            if (!s['dialogueActive']) break;
            s['closeDialogue']?.();
            await new Promise((r) => setTimeout(r, 120));
          }
          const mid = s['midTile'];
          s['playerTile'] = { x: mid.x, y: mid.y };
          s['maybeReachMiddle'](mid.x, mid.y);
          return s['dialogueActive'] === true;
        });
        // Short: several guardian panels play a looping move-preview effect
        // beside each move, and a capture taken mid-cycle puts a plume across
        // the panel's own text. Shooting while the panel has settled but the
        // previews have not yet ramped is the one reliably clean moment.
        await sleep(420);
        if (!ok) {
          log(`  (skipped ${id} -- panel did not open for world ${world})`);
          continue;
        }
        log(`  ${id} (world ${world})`);
        await shoot(`docs-guardians-${id}-panel`);
        // The avatar alone, cropped from the panel it heads: docs/guardians.md
        // shows each guardian's own art beside their section, and a full-panel
        // shot at that width reduces the avatar to a few pixels.
        await shootClip(`docs-guardians-${id}-avatar`, { x: 372, y: 24, width: 110, height: 80 });
        await shoot(`mentor-${id}`);
        // Bloch's panel is the one that looks materially different in
        // Superposition Mode, where every world is already reachable, and
        // README shows both.
        if (id === 'bloch') {
          await shoot('superposition-bloch');
          // docs/storyline.md heads its road section with the Qumatuomi map,
          // which is the right column of Bloch's own panel.
          await shootClip('docs-storyline-map', { x: 430, y: 100, width: 400, height: 200 });
        }
        // docs/hybrids.md illustrates fusion with Majorana's own panel.
        if (id === 'majorana') await shoot('docs-hybrids-majorana');
      }
    }

    if (groups.includes('encounters')) {
      log('=== encounters ===');
      for (const [name, compound, world] of ENCOUNTERS) {
        const shown = await page.evaluate(async ({ compound, world }) => {
          const g = window.__game;
          g.scene.start('Overworld', { world });
          await new Promise((r) => setTimeout(r, 1200));
          const s = g.scene.getScene('Overworld');
          for (let i = 0; i < 4; i++) {
            if (!s['dialogueActive']) break;
            s['closeDialogue']?.();
            await new Promise((r) => setTimeout(r, 120));
          }
          const mod = await import('/src/data/materials.ts');
          const mat = mod.findMaterialByName?.(compound);
          if (!mat || typeof s['showEncounter'] !== 'function') return false;
          s['showEncounter'](mat);
          return true;
        }, { compound, world });
        await sleep(800);
        if (shown) {
          log(`  ${compound}`);
          await shoot(name);
          if (name === 'encounter') await shoot('docs-crystals-encounter');
        } else {
          log(`  (skipped ${name} -- could not raise an encounter for ${compound})`);
        }
      }

      // A contextual tutorial tip, as README shows one.
      const tip = await page.evaluate(async () => {
        const g = window.__game;
        const s = g.scene.getScene('Overworld');
        s['dialogueContainer']?.destroy(true);
        const mod = await import('/src/data/tutorial.ts');
        const page0 = mod.TUTORIAL_TIPS?.['guardians'] ?? Object.values(mod.TUTORIAL_TIPS ?? {})[0];
        if (!page0 || typeof s['renderTutorialTipPopup'] !== 'function') return false;
        s['renderTutorialTipPopup'](page0.title, page0.body.split('\n\n'));
        return true;
      });
      await sleep(700);
      if (tip) await shoot('tutorial-tip');
      else log('  (skipped tutorial-tip -- could not raise a tip popup)');
    }

    if (groups.includes('battle')) {
      log('=== battle ===');
      const ok = await page.evaluate(async () => {
        const g = window.__game;
        g.scene.start('Overworld', { world: 1 });
        await new Promise((r) => setTimeout(r, 1100));
        const s = g.scene.getScene('Overworld');
        for (let i = 0; i < 4; i++) {
          if (!s['dialogueActive']) break;
          s['closeDialogue']?.();
          await new Promise((r) => setTimeout(r, 120));
        }
        const pool = s['encounterTiles']?.flat().filter(Boolean);
        if (!pool || !pool.length) return false;
        s['startBattle'](pool[0], 1, false);
        return true;
      });
      await sleep(1800);
      if (ok) await shoot('battle');
      else log('  (skipped battle -- no wild available to start one)');

      const boss = await page.evaluate(async () => {
        const g = window.__game;
        g.scene.start('Overworld', { world: 3 });
        await new Promise((r) => setTimeout(r, 1200));
        const s = g.scene.getScene('Overworld');
        for (let i = 0; i < 4; i++) {
          if (!s['dialogueActive']) break;
          s['closeDialogue']?.();
          await new Promise((r) => setTimeout(r, 120));
        }
        const rival = s['getWorldRival']?.();
        if (!rival) return false;
        s['startBattle'](rival, 1, true);
        return true;
      });
      await sleep(1900);
      if (boss) await shoot('battle-boss');
      else log('  (skipped battle-boss -- no rival resolved)');

      const analytic = await page.evaluate(async () => {
        const g = window.__game;
        const b = g.scene.getScene('Battle');
        if (!b || !b.scene.isActive()) return false;
        const mod = await import('/src/data/materials.ts');
        const move = mod.MOVES?.['skyfallBeam'];
        if (!move || typeof b['showAnalyticQuestion'] !== 'function') return false;
        b['showAnalyticQuestion'](move, () => {});
        return true;
      });
      await sleep(900);
      if (analytic) await shoot('battle-analytic-move');
      else log('  (skipped battle-analytic-move -- could not raise the question panel)');

      // The move menu on its own, as docs/quasiparticles.md shows it.
      const menu = await page.evaluate(async () => {
        const b = window.__game.scene.getScene('Battle');
        if (!b || !b.scene.isActive()) return false;
        b['dialogueContainer']?.destroy(true);
        return true;
      });
      await sleep(600);
      if (menu) await shootClip('docs-quasiparticles-movemenu', { x: 520, y: 330, width: 330, height: 150 });

      // A landed hit with no natural defense against it, and the victory
      // screen: both are moments a battle passes through rather than states it
      // rests in, so each is driven straight from the scene.
      // A fresh battle for these two rather than the one the question panel was
      // raised in: that panel is an anonymous container, so it cannot be closed
      // by name, and left standing it covers exactly what these two shots are
      // of -- the hit, and the victory banner underneath it.
      const freshBattle = async () => {
        return page.evaluate(async () => {
          const g = window.__game;
          g.scene.start('Overworld', { world: 1 });
          await new Promise((r) => setTimeout(r, 1200));
          const s = g.scene.getScene('Overworld');
          for (let i = 0; i < 4; i++) {
            if (!s['dialogueActive']) break;
            s['closeDialogue']?.();
            await new Promise((r) => setTimeout(r, 120));
          }
          const pool = s['encounterTiles']?.flat().filter(Boolean);
          if (!pool || !pool.length) return false;
          s['startBattle'](pool[0], 1, false);
          return true;
        });
      };

      const mismatch = (await freshBattle())
        ? await page.evaluate(async () => {
            const b = window.__game.scene.getScene('Battle');
            if (!b || typeof b['playerAttack'] !== 'function') return false;
            const mod = await import('/src/data/materials.ts');
            const compat = mod.MOVE_COMPATIBILITY?.[b['wild']?.type] ?? [];
            const own = mod.getBattleMoves?.(window.__game.registry) ?? ['phonon'];
            const mismatched = own.find((id) => {
              const cls = mod.MOVES?.[id]?.moveClass ?? mod.MOVES?.[id]?.class;
              return cls && !compat.includes(cls);
            });
            b['playerAttack'](mismatched ?? own[0]);
            return true;
          })
        : false;
      await sleep(900);
      if (mismatch) await shoot('battle-mismatch');
      else log('  (skipped battle-mismatch -- could not drive an attack)');

      // Won for real rather than by calling endBattle: a battle ended straight
      // from the outside leaves the loser standing at full HP behind the
      // banner, which is not what winning looks like.
      const victory = (await freshBattle())
        ? await page.evaluate(async () => {
            const b = window.__game.scene.getScene('Battle');
            if (!b || typeof b['playerAttack'] !== 'function') return false;
            const mod = await import('/src/data/materials.ts');
            const own = mod.getBattleMoves?.(window.__game.registry) ?? ['phonon'];
            // The shot is of the victory screen, not of a fair fight: the
            // player is stacked so the win lands inside the loop rather than
            // the capture timing out on a long trade.
            b['playerHp'] = b['playerMaxHp'] ?? 999;
            const strongest = own
              .slice()
              .sort((a, c) => (mod.MOVES?.[c]?.power ?? 0) - (mod.MOVES?.[a]?.power ?? 0))[0];
            for (let round = 0; round < 90; round++) {
              if ((b['opponentHp'] ?? 0) <= 0 || !b.scene.isActive()) break;
              if (!b['turnLock']) b['playerAttack'](strongest ?? own[0]);
              b['playerHp'] = b['playerMaxHp'] ?? 999;
              await new Promise((r) => setTimeout(r, 420));
            }
            return (b['opponentHp'] ?? 1) <= 0;
          })
        : false;
      await sleep(900);
      if (victory) await shoot('battle-victory');
      else log('  (skipped battle-victory -- could not reach the victory screen)');
    }
  } finally {
    await browser.close();
    teardownDevServer(server, log);
  }

  const wall = ((Date.now() - started) / 1000).toFixed(1);
  log('=== SUMMARY ===');
  // A PNG that comes out tiny is a black or empty frame -- a shot that "worked"
  // but captured nothing is the failure worth catching here, since the docs
  // would silently embed it.
  const suspicious = written.filter((w) => w.kb < (w.min ?? 5));
  for (const s of suspicious) log(`  SUSPICIOUS: ${s.name}.png is only ${s.kb} kB -- likely an empty frame`);
  log(`shots: wrote ${written.length} file(s) to screenshots/. Wall time: ${wall}s`);
  if (suspicious.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
