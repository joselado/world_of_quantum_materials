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
// Groups: title, hub, worlds, guardians, battle, encounters. No argument runs
// all of them.
//
// Every shot is taken at the game's own 854x480 canvas, so the images match what
// a player actually sees rather than a scaled-up capture. Each is driven into
// its state through the scene's own methods -- the same approach
// component-check.mjs takes -- rather than by clicking through the UI, so a shot
// is reproducible and does not depend on a run of play going a particular way.
//
// Every group starts by seeding a mid-run Story Mode save straight into the
// registry (seedProgress below): materials defeated and discovered, every
// guardian met, tutorial tips consumed, a Kondo buff held, a Franklin passive
// active, an Anderson dopant in. A fresh save shows most guardian panels in
// their empty state ("You haven't defeated any materials yet..."), and the
// docs describe the populated panels a playing player actually uses, so the
// empty states would be the misleading capture, not the honest one. Story
// Mode rather than Superposition on purpose: Superposition strips the
// prices/unlock states the docs' own captions talk about. The one shot that
// wants Superposition Mode (superposition-bloch) flips the flag itself, last.
//
// CHROME_BIN auto-detects Puppeteer's cached Chrome-for-Testing binary if unset.
// If the dev server isn't already up on :5173 this starts one and tears it down
// at the end.
//
// Every file in `screenshots/` is written by this script -- nothing there is
// hand-captured, including the shots that depend on a battle reaching a
// particular moment (a type-mismatch hit landing, a victory banner, an
// analytic question mid-flight), each driven straight from the scene.
// `SHOT_GROUPS` below is the full list of what a run covers.

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
  [3, 'The Winding Borders'],
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
  [6, 'anderson'],
  [7, 'feynman'],
  [8, 'kondo'],
  [9, 'franklin'],
  [10, 'curie'],
];

// The wild encounters README and docs/crystals.md illustrate, each chosen for
// its compound (the question a compound asks is drawn from a pool, so alt
// text in the docs names the compound, never the question). Driven by name so
// the shot keeps showing the compound the surrounding prose talks about.
const ENCOUNTERS = [
  ['encounter', 'Nickel Oxide', 1],
  ['encounter-topological', 'Bi₂Te₃', 3],
  ['encounter-supercon', 'Aluminum', 5],
  ['encounter-tensornet', 'Herbertsmithite', 8],
  // docs/crystals.md's own encounter image -- a different compound from
  // README's Nickel Oxide, so the two docs don't show the same frame twice.
  ['docs-crystals-encounter', 'Yttrium Iron Garnet', 6],
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

    // A mid-run Story Mode save, written straight into the registry (the
    // runtime source of truth every scene reads -- see data/save.ts). Every
    // list a guardian panel shows is fed from here: defeats populate
    // Dresselhaus/Majorana/Anderson, discoveries populate Qumatex, met
    // guardians stand in the Lab, consumed tutorial tips keep one-time
    // popups from covering the actual capture. Material names go through
    // findMaterialByName so a renamed compound fails this script loudly
    // instead of silently seeding nothing. Idempotent -- called at the top
    // of every group, so a subset run (`npm run shots -- battle`) gets the
    // same state a full run does.
    const seedProgress = async () => {
      await page.evaluate(async () => {
        const g = window.__game;
        const mats = await import('/src/data/materials.ts');
        const tut = await import('/src/data/tutorial.ts');
        const mat = (name) => {
          const m = mats.findMaterialByName(name);
          if (!m) throw new Error(`seedProgress: no material named "${name}"`);
          return { name: m.name, type: m.type };
        };
        // Defeats chosen so Majorana's recipe list comes out populated:
        // Aluminum+Indium Arsenide, Graphene+Graphene, Iron+Lead, HgTe+CdTe
        // and Chromium+Bi₂Te₃ are all HYBRID_RECIPES pairs.
        const defeated = [
          'Nickel Oxide', 'Iron', 'Graphene', 'Bi₂Te₃', 'Chromium',
          'Aluminum', 'Indium Arsenide', 'Lead', 'HgTe', 'CdTe',
        ].map(mat);
        const discovered = [
          ...defeated,
          ...['Cobalt', 'Yttrium Iron Garnet', 'Herbertsmithite', 'Chromium Triiodide', 'Niobium Diselenide'].map(mat),
        ];
        g.registry.set('superpositionMode', false);
        // Explicitly back to Silicon and baseline stats: Superposition Mode
        // (the superposition-bloch block below flips it on once) randomizes
        // the player's form and re-levels stats on world entry, and those
        // writes would otherwise leak into every group seeded after it.
        g.registry.set('playerForm', null);
        g.registry.set('playerStats', { ...mats.DEFAULT_STATS });
        g.registry.set('qumatessence', 1250);
        g.registry.set('defeatedMaterials', defeated);
        g.registry.set('discoveredMaterials', discovered);
        // Partway down the road: worlds 7-10 stay masked ("???") in Bloch's
        // list and shrouded on his map, which is what Story Mode looks like.
        g.registry.set('visitedWorlds', [1, 2, 3, 4, 5, 6]);
        // WORLD_GUARDIANS' own ids -- note Skłodowska-Curie's is
        // 'sklodowskaCurie' (this file's GUARDIANS list says 'curie', but
        // that is only a filename stem).
        g.registry.set('metGuardians', ['noether', 'bloch', 'dresselhaus', 'landau', 'majorana', 'anderson', 'feynman', 'kondo', 'franklin', 'sklodowskaCurie']);
        g.registry.set('tutorialTipsSeen', Object.keys(tut.TUTORIAL_TIPS));
        g.registry.set('worldLoreSeen', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
        // Phonon Beam (the starter), Magnon Wave (learned from the Iron
        // dopant below), one Kondo buff, one of Landau's Analytic moves, one
        // of Skłodowska-Curie's Ultimates (whose phonon class is unlocked
        // below, so her panel shows the free-to-carry state its caption
        // describes). Deliberately NOT Electron Pulse: Noether's shot
        // illustrates the shop still offering it, exactly as
        // docs/guardians.md's prose says.
        g.registry.set('unlockedMoves', ['thermalFluctuation', 'magneticField', 'spinScreening', 'skyfallBeam', 'ultimateMeteor']);
        g.registry.set('kondoActiveMove', 'spinScreening');
        g.registry.set('passivesUnlocked', ['fractionalGuard', 'anyonEcho']);
        g.registry.set('activePassiveByOwner', { franklin: 'fractionalGuard' });
        g.registry.set('ultimateClassesUnlocked', { ultimateMeteor: ['phonon'] });
        // Tuned, not left untuned: an untuned Analytic move plays no
        // preview on Landau's stage at all, and the tuned state also shows
        // the carried-quasiparticle status the docs' prose walks through.
        g.registry.set('moveClassTuning', { skyfallBeam: 'phonon' });
        g.registry.set('moveLevels', { thermalFluctuation: 1 });
        g.registry.set('andersonDopant', 'Iron');
        g.registry.set('andersonUnlockedHosts', ['Iron']);
        g.registry.set('dresselhausUnlockedCrystals', ['Graphene']);
        g.registry.set('blochUnlockedWorlds', []);
        g.registry.set('majoranaUnlockedResults', []);
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
      await seedProgress();
      await page.evaluate(() => window.__game.scene.start('Hub'));
      await sleep(1200);
      // The seeded save has every tutorial tip consumed, so the Lab's
      // one-time welcome dialog does not cover the room: the shot is of the
      // stations and the met guardians standing along the upper corners.
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
      if (opened) {
        // Preview a *discovered* entry: the list opens on its first row,
        // which at 15/63 discovered is usually a "???" placeholder, and the
        // pane beside a placeholder shows no crystal and no physics note --
        // the two things this shot is of.
        await page.evaluate(() => {
          function walk(list, out) {
            for (const o of list) {
              if (o.input && typeof o.text === 'string' && o.text.startsWith('Aluminum')) out.push(o);
              if (o.list) walk(o.list, out);
            }
          }
          const s = window.__game.scene.getScene('Hub');
          const hits = [];
          s.children.list.forEach((o) => walk(o.list ?? [o], hits));
          hits[0]?.emit('pointerdown');
        });
        await sleep(500);
        await shoot('hub-materialdex');
      } else log('  (skipped hub-materialdex -- no showMaterialdex on HubScene)');

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
      await seedProgress();
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
      await seedProgress();
      for (const [world, id] of GUARDIANS) {
        await page.evaluate((w) => window.__game.scene.start('Overworld', { world: w }), world);
        await sleep(1300);
        const ok = await page.evaluate(async (guardianId) => {
          const s = window.__game.scene.getScene('Overworld');
          // Tear down every preview chain left by the previous panel:
          // a chain is keyed and remembers its scene, and this driver's
          // scene.start() restarts always reuse the one Overworld scene
          // instance, so a chain from the last panel still *looks* alive to
          // startMoveEffectPreview while its loop timer died with the
          // restart -- the new panel would retarget the dead chain and its
          // stage would never play. (A real player never hits this: panels
          // close through closeDialogue/Farewell, which stop chains
          // properly.)
          const fx = await import('/src/art/moveEffectPreview.ts');
          fx.stopMoveEffectPreview?.();
          for (let i = 0; i < 4; i++) {
            if (!s['dialogueActive']) break;
            s['closeDialogue']?.();
            await new Promise((r) => setTimeout(r, 120));
          }
          // Majorana's panel default-previews the first reachable hybrid;
          // docs/hybrids.md's caption talks through the HgTe/CdTe Quantum
          // Well specifically, so preselect it the same way a row click
          // would (the panel reads scene.majoranaPreview on open).
          if (guardianId === 'majorana') s['majoranaPreview'] = 'HgTe/CdTe Quantum Well';
          const mid = s['midTile'];
          s['playerTile'] = { x: mid.x, y: mid.y };
          s['maybeReachMiddle'](mid.x, mid.y);
          return s['dialogueActive'] === true;
        }, id);
        await sleep(600);
        if (!ok) {
          log(`  (skipped ${id} -- panel did not open for world ${world})`);
          continue;
        }
        log(`  ${id} (world ${world})`);
        // docs/guardians.md's per-guardian panel image and README's
        // mentor-<id> image are the same panel -- one captured frame written
        // to both names, so the two docs can never show two different
        // moments of it. Majorana's frame is additionally docs/hybrids.md's
        // illustration.
        const targets = [`docs-guardians-${id}-panel`, `mentor-${id}`];
        if (id === 'majorana') targets.push('docs-hybrids-majorana');
        // The stage-carrying panels (Noether, Feynman, Kondo, Landau,
        // Skłodowska-Curie) loop the selected move's own real battle effect
        // on a recessed stage, and the visible part of a play is a brief
        // window inside a couple-of-seconds loop -- a capture at any fixed
        // moment lands in the quiet stretch as often as not and shows an
        // empty stage. So: watch the stage region itself from inside the
        // page (Phaser's own snapshotArea; the encoded size of the region
        // jumps while an effect is drawn on it, and the region is small
        // enough that nothing else moves there) and freeze the game loop
        // (game.loop.sleep()) the moment a play is on stage, screenshot the
        // frozen frame, then wake the loop. The effect is clipped to its
        // stage (art/moveEffectPreview.ts), so a mid-play frame is clean
        // everywhere else. If no play shows within a few loops (Noether's
        // electron zap is a couple of frames long), the panel is shot as-is.
        // How large a jump (relative to the empty stage's own encoded size)
        // counts as "the effect is on stage now", per guardian:
        // Skłodowska-Curie's meteor builds from a faint summoning ring to a
        // whiteout impact, so a low threshold would freeze on the faint
        // ring; the others' plays are brief and never huge, so a high
        // threshold would miss them entirely. Calibrated against the
        // min/max sizes this block logs.
        // Thresholds sit just above the background's own flicker through the
        // translucent panel (the stage is not opaque) -- a false trigger
        // costs nothing, since a frame frozen on background flicker looks
        // the same as the settled panel.
        const STAGE_TRIGGER = { noether: 1.03, feynman: 1.5, kondo: 1.05, landau: 1.08, curie: 1.35 };
        const stagePanel = id in STAGE_TRIGGER;
        let frozen = false;
        if (stagePanel) {
          frozen = await page.evaluate(async (trigger) => {
            const g = window.__game;
            const sc = g.scene.getScene('Overworld');
            const findStage = (list) => {
              for (const o of list) {
                if (o.type === 'Rectangle' && o.width > 300 && o.height >= 90 && o.height <= 160) return o.getBounds();
                if (o.list) {
                  const r = findStage(o.list);
                  if (r) return r;
                }
              }
              return null;
            };
            const rect = findStage(sc['dialogueContainer']?.list ?? []);
            if (!rect) return false;
            const snap = () =>
              new Promise((res) =>
                g.renderer.snapshotArea(
                  Math.round(rect.x) + 2,
                  Math.round(rect.y) + 2,
                  Math.round(rect.width) - 4,
                  Math.round(rect.height) - 4,
                  (img) => res(img.src.length)
                )
              );
            // Running minimum as the "empty stage" baseline rather than the
            // first few samples -- the panel may open mid-play, in which
            // case the early samples ARE the effect and the quiet stretch
            // after them is what establishes empty.
            let min = Infinity;
            let max = 0;
            let samples = 0;
            const t0 = Date.now();
            while (Date.now() - t0 < 8000) {
              const s = await snap();
              samples += 1;
              min = Math.min(min, s);
              max = Math.max(max, s);
              if (samples > 3 && s > min * trigger) {
                g.loop.sleep();
                return { frozen: true, min, max };
              }
              await new Promise((r) => setTimeout(r, 70));
            }
            return { frozen: false, min, max };
          }, STAGE_TRIGGER[id]);
          log(`  stage sizes for ${id}: min ${frozen.min}, max ${frozen.max}${frozen.frozen ? '' : ' -- no play caught, shooting the settled panel'}`);
          frozen = frozen.frozen;
        }
        const chosen = await page.screenshot();
        for (const t of targets) {
          const file = path.join(SHOT_DIR, `${t}.png`);
          fs.writeFileSync(file, chosen);
          const kb = (fs.statSync(file).size / 1024).toFixed(0);
          written.push({ name: t, kb: Number(kb) });
          log(`  wrote ${t}.png (${kb} kB${frozen ? ', mid-play' : ''})`);
        }
        // The avatar alone, cropped from the panel it heads: docs/guardians.md
        // shows each guardian's own art beside their section, and a full-panel
        // shot at that width reduces the avatar to a few pixels. The portrait
        // stands in its own column at the panel's left edge, and the panels are
        // not all the same width, so the crop is taken off the panel's own
        // measured left edge rather than a fixed x.
        // Off the panel's own background rectangle (always child 0, inserted
        // with addAt after the content is laid out) rather than the container's
        // bounds: a Phaser Container takes no bounds from Graphics children,
        // and every guardian's avatar is pure Graphics, so the container would
        // report a left edge of 0.
        const panelLeft = await page.evaluate(() => {
          const sc = window.__game.scene.getScene('Overworld');
          return Math.round(sc['dialogueContainer'].list[0].getBounds().left);
        });
        // Starts a few px below the panel's own top edge: the panel
        // background is slightly translucent, and the world-name headline
        // behind it would otherwise show through as a text sliver along the
        // crop's top row.
        await shootClip(`docs-guardians-${id}-avatar`, { x: panelLeft + 22, y: 28, width: 166, height: 152 });
        // Wake the loop a freeze above put to sleep, so the next guardian's
        // world can actually start.
        if (frozen) await page.evaluate(() => window.__game.loop.wake());
      }

      // Bloch's panel is the one that looks materially different in
      // Superposition Mode -- every world named, every trip free, his intro
      // reworded -- and README shows the two side by side. Shot after the
      // Story Mode loop rather than inside it, because flipping the flag
      // mid-loop would leak Superposition leveling (stats, moves,
      // visitedWorlds) into every later Story Mode panel.
      log('  bloch again, in Superposition Mode');
      await page.evaluate(() => window.__game.registry.set('superpositionMode', true));
      await page.evaluate(() => window.__game.scene.start('Overworld', { world: 2 }));
      await sleep(1300);
      const superOk = await page.evaluate(async () => {
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
      await sleep(700);
      if (superOk) {
        await shoot('superposition-bloch');
        // docs/storyline.md heads its road section with the Qumatuomi map,
        // the right column of Bloch's own panel -- taken from the
        // Superposition open, where all ten regions are painted rather than
        // shrouded, since the storyline doc shows the whole road. The crop
        // is measured off the map's own container (the one child container
        // the panel positions in its right column) rather than fixed
        // coordinates, so a relaid-out panel moves the crop with it.
        const mapClip = await page.evaluate(() => {
          const sc = window.__game.scene.getScene('Overworld');
          const kids = sc['dialogueContainer'].list.filter((o) => o.type === 'Container' && o.x > 400 && o.y > 60);
          if (!kids.length) return null;
          const map = kids[0];
          return { x: Math.round(map.x), y: Math.round(map.y) };
        });
        if (mapClip) {
          await shootClip('docs-storyline-map', { x: mapClip.x - 165, y: mapClip.y - 78, width: 330, height: 152 });
        } else {
          log('  (skipped docs-storyline-map -- could not find the map container)');
        }
      } else {
        log('  (skipped superposition-bloch -- panel did not open)');
      }
      // Back to the Story Mode seed for any group still to run.
      await seedProgress();
    }

    if (groups.includes('encounters')) {
      log('=== encounters ===');
      await seedProgress();
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
          // The question is drawn at random from the compound's world pool, so
          // which one a shot catches is otherwise pure luck. Prefer a draw whose
          // question or answers actually carry a typeset formula (ui/mathtext.ts):
          // the panel's own rendering is what these shots illustrate, and a draw
          // that exercises it illustrates more of the panel than one that happens
          // not to. Whatever the last draw produced stands if none of them does --
          // plenty of real questions are prose-only.
          // Two signals, either of which means this draw is typeset. A formula
          // answer is an interactive container carrying its label's plain reading
          // on a `text` property (a plain answer is a Text object). A formula
          // prompt is a container of nothing but Text and Graphics -- the bobbing
          // crystal is a container too, and its own sparkles are Text, but it
          // always carries an Ellipse as well, which is what tells the two apart.
          const typeset = () => {
            const c = s['dialogueContainer'];
            if (!c) return false;
            return c.list.some((o) =>
              o.type === 'Container' &&
              (o.input
                ? typeof o.text === 'string'
                : (o.list || []).length > 0 && o.list.every((k) => k.type === 'Text' || k.type === 'Graphics'))
            );
          };
          for (let draw = 0; draw < 30; draw++) {
            s['showEncounter'](mat);
            if (typeset()) break;
          }
          return true;
        }, { compound, world });
        await sleep(800);
        if (shown) {
          log(`  ${compound}`);
          await shoot(name);
        } else {
          log(`  (skipped ${name} -- could not raise an encounter for ${compound})`);
        }
      }

      // A contextual tutorial tip, as README shows one -- the 'guardian'
      // topic (README's caption calls it the tip introducing the guardians),
      // over World 1 rather than whichever world the encounter loop ended on.
      const tip = await page.evaluate(async () => {
        const g = window.__game;
        g.scene.start('Overworld', { world: 1 });
        await new Promise((r) => setTimeout(r, 1200));
        const s = g.scene.getScene('Overworld');
        for (let i = 0; i < 4; i++) {
          if (!s['dialogueActive']) break;
          s['closeDialogue']?.();
          await new Promise((r) => setTimeout(r, 120));
        }
        s['dialogueContainer']?.destroy(true);
        const mod = await import('/src/data/tutorial.ts');
        const page0 = mod.TUTORIAL_TIPS?.['guardian'];
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
      await seedProgress();
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
        // Same preference the encounter shots use: the question is drawn at
        // random, so favor a draw that actually exercises the formula
        // typesetting this panel does (ui/mathtext.ts) rather than shooting
        // whichever one luck supplies. The panel has no bobbing crystal, so a
        // container of nothing but Text and Graphics is a typeset prompt and an
        // interactive one carrying a `text` property is a typeset answer.
        const panel = () => b.children.list.filter((o) => o.type === 'Container' && o.depth === 100).pop();
        const typeset = (c) =>
          !!c &&
          c.list.some((o) =>
            o.type === 'Container' &&
            (o.input
              ? typeof o.text === 'string'
              : (o.list || []).length > 0 && o.list.every((k) => k.type === 'Text' || k.type === 'Graphics'))
          );
        for (let draw = 0; draw < 30; draw++) {
          b['showAnalyticQuestion'](move, () => {});
          if (typeset(panel())) break;
          if (draw < 29) panel()?.destroy(true);
        }
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
      if (menu) await shootClip('docs-quasiparticles-movemenu', { x: 540, y: 278, width: 310, height: 196 });

      // A landed hit with no natural defense against it, and the victory
      // screen: both are moments a battle passes through rather than states it
      // rests in, so each is driven straight from the scene.
      // A fresh battle for these two rather than the one the question panel was
      // raised in: that panel is an anonymous container, so it cannot be closed
      // by name, and left standing it covers exactly what these two shots are
      // of -- the hit, and the victory banner underneath it.
      // `preferMismatch` starts the fight against Barium Titanate -- a World
      // 1 wild in its own right (a switchable polarization is spontaneous
      // symmetry breaking), and a ferroelectric with no magnetic order, so
      // the seeded save's Magnon Wave genuinely finds no host in it and the
      // shot shows the "no natural defense" double-damage hit README's
      // caption describes. Left to the random pool, most of World 1's wilds
      // are magnetic and host magnons fine.
      const freshBattle = async (preferMismatch) => {
        return page.evaluate(async (wantMismatch) => {
          const g = window.__game;
          g.scene.start('Overworld', { world: 1 });
          await new Promise((r) => setTimeout(r, 1200));
          const s = g.scene.getScene('Overworld');
          for (let i = 0; i < 4; i++) {
            if (!s['dialogueActive']) break;
            s['closeDialogue']?.();
            await new Promise((r) => setTimeout(r, 120));
          }
          let wild;
          if (wantMismatch) {
            const mod = await import('/src/data/materials.ts');
            wild = mod.findMaterialByName?.('Barium Titanate');
          }
          if (!wild) {
            const pool = s['encounterTiles']?.flat().filter(Boolean);
            if (!pool || !pool.length) return false;
            wild = pool[0];
          }
          s['startBattle'](wild, 1, false);
          return true;
        }, !!preferMismatch);
      };

      const mismatch = (await freshBattle(true))
        ? await page.evaluate(async () => {
            const b = window.__game.scene.getScene('Battle');
            if (!b || typeof b['playerAttack'] !== 'function') return false;
            const mod = await import('/src/data/materials.ts');
            // Magnon Wave into the ferroelectric wild freshBattle(true)
            // raised: a mismatch by construction (no magnetic order, no
            // magnon to host), so the hit lands at the double-damage "no
            // natural defense" moment this shot exists to show.
            const own = mod.getBattleMoves?.(window.__game.registry) ?? [];
            b['playerAttack'](own.includes('magneticField') ? 'magneticField' : own[0]);
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
            // Same ordinary-attacks-only filter as the mismatch drive above.
            const gated = new Set([...(mod.ANALYTIC_MOVE_IDS ?? []), ...(mod.ULTIMATE_MOVE_IDS ?? []), ...(mod.KONDO_MOVE_IDS ?? [])]);
            const own = (mod.getBattleMoves?.(window.__game.registry) ?? ['phonon']).filter((id) => !gated.has(id));
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
