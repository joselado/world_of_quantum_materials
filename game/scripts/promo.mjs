// Captures the promotional video, segment by segment, from the running game.
//
// The cut, its card and caption wording, and the reasoning behind every shot
// are in dev_notes/PROMO_VIDEO_BUILD_TASK.md; this script is its executable
// half. Each segment is driven into its state the way shots.mjs drives a
// screenshot -- seeding the registry and calling scene methods rather than
// clicking through the interface -- and then recorded frame by frame.
//
// Usage (from game/):  npm run promo                     every segment, 2x
//                      npm run promo -- road battle      named segments only
//                      npm run promo -- --scale=4 road   the final raster
//                      npm run promo -- --list           segment names
//                      npm run promo -- --audio          the music cues only
//
// Output goes to the repo's top-level promo/ (gitignored):
//   promo/segments/<name>/f0001.png   the frames
//   promo/segments/<name>.mp4         the frames as a 1920x1080 clip
//   promo/sheets/<name>.png           every fifteenth frame, eight across
//   promo/audio/<cue>.wav             the music cues (--audio)
//
// The frozen clock. Headless Chrome renders this game at a few frames per
// second, so the game's own loop is put to sleep after boot and advanced by
// hand, one thirtieth of a second of game time per frame, with a screenshot
// after each. Phaser's tweens read Date.now() rather than the loop's time, so
// the page's Date.now() is replaced by a virtual clock that advances with the
// steps; Math.random() is replaced by a seeded generator, reseeded at the top
// of every segment, so a segment recaptured alone comes out the same map, the
// same wild crystals and the same rolls. Every tween, bob and effect then runs
// at exactly 30 frames per second of game time no matter how slow the
// machine, and a segment is the same length on every run.
//
// The raster. The canvas is 854x480; a deviceScaleFactor alone yields a
// blurred upscale. The page's WebGL viewport and scissor calls are multiplied
// by the scale while the default framebuffer is bound (an offscreen
// framebuffer, a bake or a render texture, is drawn at its own size), the
// canvas's drawing buffer is set to the scale times its size while its CSS
// size stays put, every Text object is rasterized at the scale, and the
// bakes (art/bake.ts) keep that many texels per pixel.

import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawn, execSync, execFileSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GAME_DIR = process.env.GAME_DIR || path.resolve(__dirname, '..');
const REPO_DIR = path.resolve(GAME_DIR, '..');
const OUT_DIR = path.join(REPO_DIR, 'promo');
const URL = process.env.QM_URL || 'http://localhost:5173/';
const GAME_URL = `${URL}${URL.includes('?') ? '&' : '?'}renderer=webgl`;
const CANVAS_W = 854;
const CANVAS_H = 480;
const FPS = 30;
// The static ffmpeg imageio_ffmpeg ships; this machine has none on the path.
const FFMPEG =
  process.env.FFMPEG ||
  path.join(os.homedir(), 'apps/anaconda3/lib/python3.14/site-packages/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v7.0.2');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (msg) => console.log(`[${new Date().toTimeString().slice(0, 8)}] ${msg}`);

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

async function ensureDevServer() {
  if (await isServerUp()) {
    log('Dev server already running -- reusing it.');
    return { started: false, child: null };
  }
  log(`Dev server not up -- starting "npm run dev" in ${GAME_DIR}...`);
  const child = spawn('npm', ['run', 'dev'], { cwd: GAME_DIR, stdio: 'ignore', detached: true });
  child.unref();
  const start = Date.now();
  while (Date.now() - start < 30000) {
    if (await isServerUp()) return { started: true, child };
    await sleep(400);
  }
  throw new Error('Dev server did not come up within 30s.');
}

function teardownDevServer(handle) {
  if (!handle.started || !handle.child) return;
  try {
    process.kill(-handle.child.pid, 'SIGTERM');
  } catch (e) {
    log(`  (dev server teardown failed: ${e.message || e})`);
  }
}

function ffmpeg(args) {
  execFileSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'inherit' });
}

// ---------------------------------------------------------------------------
// In the page, before any of the game's code runs: the seeded Math.random, the
// virtual Date.now, and the scaled WebGL viewport.
// ---------------------------------------------------------------------------

function installPageHooks(scale) {
  // mulberry32: small, fast, and good enough for map generation and dice.
  let state = 0x9e3779b9;
  const rand = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  Math.random = rand;
  const realNow = Date.now.bind(Date);
  let frozenAt = null;
  let virtualMs = 0;
  Date.now = () => (frozenAt === null ? realNow() : frozenAt + virtualMs);
  window.__promoClock = {
    reseed(n) {
      state = n >>> 0;
    },

    freeze() {
      if (frozenAt === null) frozenAt = realNow();
    },
    advance(ms) {
      virtualMs += ms;
      return frozenAt + virtualMs;
    },
  };

  // Phaser sets a viewport before binding the target it is meant for as
  // often as after (a texture stamp sets the source's size, then binds the
  // destination), so whether a viewport is the screen's is only known when
  // something is drawn. The viewport and scissor are therefore recorded as
  // Phaser asks for them and applied at each draw: multiplied by the scale
  // while the screen is the bound target, as asked otherwise.
  const getContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
    const ctx = getContext.call(this, type, ...rest);
    if (!ctx || !/webgl/.test(type) || ctx.__promoScaled) return ctx;
    ctx.__promoScaled = true;
    const viewport = ctx.viewport.bind(ctx);
    const scissor = ctx.scissor.bind(ctx);
    // The context's own defaults: the whole canvas, at its logical size.
    let vp = [0, 0, this.width, this.height];
    let sc = [0, 0, this.width, this.height];
    let applied = null;
    ctx.viewport = (...a) => {
      vp = a;
      applied = null;
    };
    ctx.scissor = (...a) => {
      sc = a;
      applied = null;
    };
    const sync = () => {
      const k = ctx.getParameter(ctx.FRAMEBUFFER_BINDING) === null ? scale : 1;
      if (applied === k) return;
      viewport(vp[0] * k, vp[1] * k, vp[2] * k, vp[3] * k);
      scissor(sc[0] * k, sc[1] * k, sc[2] * k, sc[3] * k);
      applied = k;
    };
    for (const name of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced', 'clear', 'readPixels', 'copyTexImage2D', 'copyTexSubImage2D']) {
      const f = ctx[name];
      if (!f) continue;
      const bound = f.bind(ctx);
      ctx[name] = (...a) => {
        sync();
        return bound(...a);
      };
    }
    // Phaser flips a scissor box's y against the drawing buffer's height,
    // which it reads at boot and again on a scene start, either side of the
    // buffer being enlarged; it has to read the logical one both times.
    const logical = { drawingBufferWidth: this.width, drawingBufferHeight: this.height };
    for (const dim of Object.keys(logical)) Object.defineProperty(ctx, dim, { get: () => logical[dim] });
    const bindFramebuffer = ctx.bindFramebuffer.bind(ctx);
    ctx.bindFramebuffer = (...a) => {
      applied = null;
      return bindFramebuffer(...a);
    };
    return ctx;
  };
}

// ---------------------------------------------------------------------------
// In the page, after boot: the helpers every segment drives the game through.
// ---------------------------------------------------------------------------

async function installPromoHelpers(page, scale) {
  await page.evaluate(async (scale) => {
    const g = window.__game;
    const bake = await import('/src/art/bake.ts');
    bake.setBakeOutputScale(scale);
    g.loop.sleep();
    window.__promoClock.freeze();
    g.canvas.width = 854 * scale;
    g.canvas.height = 480 * scale;

    // Every Text object, the ones created mid-frame included, is rasterized
    // at the capture scale: the prototype's updateText is where a Text reads
    // its resolution, on creation and on every change.
    let textProto = null;
    const patchText = (o) => {
      if (textProto || o.type !== 'Text') return;
      textProto = Object.getPrototypeOf(o);
      const updateText = textProto.updateText;
      textProto.updateText = function () {
        if (this.style && this.style.resolution !== scale) this.style.resolution = scale;
        return updateText.call(this);
      };
    };
    const walk = (list, fn) => {
      for (const o of list) {
        fn(o);
        if (o.list) walk(o.list, fn);
      }
    };
    const allObjects = (fn) => {
      for (const sc of g.scene.getScenes(true)) walk(sc.children.list, fn);
    };
    allObjects(patchText);
    allObjects((o) => {
      if (o.type === 'Text' && o.style.resolution !== scale) o.setResolution(scale);
    });

    const DT = 1000 / 30;
    const P = {
      frame: 0,
      actions: {},
      // One frame: the segment's per-frame action (walking, say), then one
      // step of the game at exactly a thirtieth of a second.
      tick(action) {
        if (action) P.actions[action[0]](...action.slice(1));
        const now = window.__promoClock.advance(DT);
        const loop = g.loop;
        loop.now = now;
        loop.time = now;
        loop.rawDelta = DT;
        loop.delta = DT;
        loop.frame += 1;
        g.step(now, DT);
        P.frame += 1;
        if (!textProto) allObjects(patchText);
      },
      scene(key) {
        return g.scene.getScene(key);
      },
      // Stops every running scene and starts the one wanted, the way a
      // player's own scene change would, minus the transition.
      start(key, data) {
        for (const k of ['Title', 'Hub', 'Overworld', 'Battle']) {
          if (g.scene.isActive(k) || g.scene.isPaused(k) || g.scene.isSleeping(k)) g.scene.stop(k);
        }
        g.scene.start(key, data);
      },
      // Every Text object of a scene whose string passes `test`, in display
      // order, containers walked.
      texts(sceneKey, test) {
        const out = [];
        walk(g.scene.getScene(sceneKey).children.list, (o) => {
          if (o.type === 'Text' && test(o.text)) out.push(o);
        });
        return out;
      },
      click(sceneKey, text) {
        const hit = P.texts(sceneKey, (t) => t === text).find((o) => o.input) ?? P.texts(sceneKey, (t) => t === text)[0];
        if (!hit) throw new Error(`click: no text "${text}" in ${sceneKey}`);
        hit.emit('pointerdown', g.input.activePointer, 0, 0, { stopPropagation() {} });
        return true;
      },
    };
    // The clickable objects inside a scene's open dialogue, in display
    // order, and a press on the n-th of them.
    P.clickables = (sceneKey) => {
      const out = [];
      const root = g.scene.getScene(sceneKey).dialogueContainer;
      if (root) walk(root.list, (o) => o.input && o.input.enabled && out.push(o));
      return out;
    };
    P.clickNth = (sceneKey, n) => {
      const hit = P.clickables(sceneKey)[n];
      if (!hit) throw new Error(`clickNth: no clickable ${n} in ${sceneKey}'s dialogue`);
      hit.emit('pointerdown', g.input.activePointer, 0, 0, { stopPropagation() {} });
    };
    // Every two-answer question in the game (a wild's, Landau's, each of
    // Skłodowska-Curie's) shuffles its options through Phaser's
    // Utils.Array.Shuffle, as { text, correct } pairs. The shuffle is watched,
    // so the script knows which of the two buttons now on screen is the right
    // one. Phaser is reached through the module the game itself loaded.
    const phaserUrl = performance.getEntriesByType('resource').map((e) => e.name).find((n) => /\/deps\/phaser\.js/.test(n));
    const Phaser = (await import(phaserUrl)).default;
    const shuffle = Phaser.Utils.Array.Shuffle;
    P.lastOptions = null;
    Phaser.Utils.Array.Shuffle = (arr) => {
      const out = shuffle(arr);
      if (out.length === 2 && out.every((o) => o && typeof o.correct === 'boolean')) P.lastOptions = out.map((o) => ({ ...o }));
      return out;
    };
    // The visible clickable objects of a scene, in display order.
    P.visibleClickables = (sceneKey) => {
      const out = [];
      const visit = (list) => {
        for (const o of list) {
          if (o.visible === false) continue;
          if (o.input && o.input.enabled) out.push(o);
          if (o.list) visit(o.list);
        }
      };
      visit(g.scene.getScene(sceneKey).children.list);
      return out;
    };
    const press = (o) => o.emit('pointerdown', g.input.activePointer, 0, 0, { stopPropagation() {} });
    // Presses the right answer of the question panel just opened: its two
    // options are the panel's first two clickables, the panel being the last
    // thing added (the encounter's dialogue, or the battle's question panel).
    P.answerRight = (sceneKey) => {
      const opts = P.lastOptions;
      if (!opts) throw new Error('answerRight: no question has been shuffled');
      const idx = opts.findIndex((o) => o.correct);
      const s = g.scene.getScene(sceneKey);
      const clickables = s.dialogueContainer ? P.clickables(sceneKey) : P.visibleClickables(sceneKey).slice(-2);
      // Cleared before the press: answering one of Skłodowska-Curie's
      // questions opens the next one, and shuffles it, inside the press.
      P.lastOptions = null;
      press(clickables[idx]);
      return opts[idx].text;
    };
    // Presses the visible clickable Text whose string contains `part` (a
    // battle menu's move button, a panel's "Travel to" button).
    P.pressText = (sceneKey, part) => {
      const find = () => P.visibleClickables(sceneKey).find((o) => o.type === 'Text' && o.text.includes(part));
      let hit = find();
      // A paged list (the battle's move menu) is paged forward until it shows.
      for (let page = 0; !hit && page < 6; page++) {
        const next = P.visibleClickables(sceneKey).find((o) => o.type === 'Text' && o.text === '▶');
        if (!next) break;
        press(next);
        hit = find();
      }
      if (!hit) {
        const seen = P.visibleClickables(sceneKey).map((o) => (o.type === 'Text' ? JSON.stringify(o.text) : o.type));
        throw new Error(`pressText: nothing reading "${part}" in ${sceneKey} (clickable: ${seen.join(', ')})`);
      }
      press(hit);
    };
    // A wild encounter opened on `name`. Its question is drawn from a pool,
    // so the panel is redrawn, all inside one frame, until the prompt passes
    // `promptPattern`: the trailer shows a question about the compound
    // standing there, not one of the world's general ones.
    P.openEncounter = async (name, promptPattern) => {
      const mats = await import('/src/data/materials.ts');
      const quiz = await import('/src/data/quiz.ts');
      const material = mats.findMaterialByName(name);
      if (!material) throw new Error(`openEncounter: no material ${name}`);
      const s = g.scene.getScene('Overworld');
      const all = [...Object.values(quiz.WORLD_QUESTIONS).flat(), ...Object.values(quiz.MATERIAL_QUESTIONS).flat()];
      for (let tries = 0; tries < 50; tries++) {
        s.showEncounter(material);
        const right = P.lastOptions?.find((o) => o.correct)?.text;
        const prompt = all.find((q) => q.correct === right)?.prompt ?? '';
        if (!promptPattern || new RegExp(promptPattern).test(prompt)) return prompt;
        s.closeDialogue();
      }
      throw new Error(`openEncounter: no question matching ${promptPattern} in 50 draws`);
    };

    // Walking: the up key held down, the way a player walks, so a step that
    // arrives carries straight on into the next without a stop. Before each
    // step the tile ahead is checked, and a wild crystal or the edge of the
    // path is stepped around rather than walked into, so a walking shot never
    // turns into an encounter it did not ask for.
    P.actions.walk = () => {
      const s = g.scene.getScene('Overworld');
      if (!s || !g.scene.isActive('Overworld')) return;
      const keys = s.cursors;
      for (const k of ['up', 'down', 'left', 'right']) keys[k].isDown = false;
      if (s.dialogueActive) return;
      const from = s.stepTarget ?? s.playerTile;
      const free = (x, y) =>
        s.walkable[y]?.[x] && !s.encounterTiles[y]?.[x] && !(y === s.goalTile.y && !s.isRivalDefeated());
      if (free(from.x, from.y - 1)) keys.up.isDown = true;
      else {
        // Toward the side with more open path ahead of it.
        const open = (dx) => {
          let n = 0;
          for (let x = from.x + dx; free(x, from.y) && n < 12; x += dx) n += free(x, from.y - 1) ? 3 : 1;
          return n;
        };
        const l = open(-1);
        const r = open(1);
        if (l || r) keys[l > r ? 'left' : 'right'].isDown = true;
      }
    };
    P.actions.stand = () => {
      const s = g.scene.getScene('Overworld');
      if (s?.cursors) for (const k of ['up', 'down', 'left', 'right']) s.cursors[k].isDown = false;
    };
    window.__promo = P;
  }, scale);
}

// ---------------------------------------------------------------------------
// The recorder, node side.
// ---------------------------------------------------------------------------

class Recorder {
  constructor(page, scale) {
    this.page = page;
    this.scale = scale;
    this.name = null;
    this.count = 0;
    this.dir = null;
    this.renderMs = 0;
    this.shotMs = 0;
  }

  async begin(name, seed) {
    this.name = name;
    this.count = 0;
    this.renderMs = 0;
    this.shotMs = 0;
    this.dir = path.join(OUT_DIR, 'segments', name);
    fs.rmSync(this.dir, { recursive: true, force: true });
    fs.mkdirSync(this.dir, { recursive: true });
    await this.page.evaluate((s) => window.__promoClock.reseed(s), seed);
  }

  // Runs a function in the page with `__promo` as its first argument.
  async run(fn, arg) {
    return this.page.evaluate(`(${fn.toString()})(window.__promo, ${JSON.stringify(arg ?? null)})`);
  }

  async start(key, data, settle = 3) {
    await this.page.evaluate((k, d) => window.__promo.start(k, d), key, data ?? {});
    await this.skip(settle);
  }

  // Frames that advance the game without being recorded.
  async skip(n, action) {
    for (let i = 0; i < n; i++) await this.page.evaluate((a) => window.__promo.tick(a), action ?? null);
  }

  // Frames that are recorded. `action` is a per-frame helper name and
  // arguments, run before each step.
  async record(n, action) {
    for (let i = 0; i < n; i++) {
      const t0 = Date.now();
      await this.page.evaluate((a) => window.__promo.tick(a), action ?? null);
      const t1 = Date.now();
      this.count += 1;
      const file = path.join(this.dir, `f${String(this.count).padStart(4, '0')}.png`);
      await this.page.screenshot({ path: file, clip: { x: 0, y: 0, width: CANVAS_W, height: CANVAS_H }, optimizeForSpeed: true });
      this.renderMs += t1 - t0;
      this.shotMs += Date.now() - t1;
    }
  }

  // Records until `test` (run in the page with __promo) holds, at least
  // `min` and at most `max` frames, then `after` frames more.
  async recordUntil(test, { min = 0, max = 600, after = 0, action } = {}) {
    let n = 0;
    while (n < max) {
      await this.record(1, action);
      n += 1;
      if (n >= min && (await this.run(test))) break;
    }
    if (n >= max) log(`  (${this.name}: condition not met within ${max} frames)`);
    await this.record(after, action);
    return n;
  }

  // Closes the current segment and opens the next one on the same running
  // game, for a shot that carries straight on from the last.
  async split(name) {
    this.finish();
    this.name = name;
    this.count = 0;
    this.renderMs = 0;
    this.shotMs = 0;
    this.dir = path.join(OUT_DIR, 'segments', name);
    fs.rmSync(this.dir, { recursive: true, force: true });
    fs.mkdirSync(this.dir, { recursive: true });
  }

  // The clip and the contact sheet.
  finish() {
    const n = this.count;
    log(
      `  ${this.name}: ${n} frames (${(n / FPS).toFixed(2)} s), ` +
        `render ${(this.renderMs / Math.max(1, n)).toFixed(0)} ms/frame, screenshot ${(this.shotMs / Math.max(1, n)).toFixed(0)} ms/frame`
    );
    if (n === 0) return;
    const frames = path.join(this.dir, 'f%04d.png');
    ffmpeg([
      '-framerate', String(FPS), '-i', frames,
      '-vf', 'scale=1920:1080:flags=lanczos',
      '-c:v', 'libx264', '-crf', '18', '-pix_fmt', 'yuv420p',
      path.join(OUT_DIR, 'segments', `${this.name}.mp4`),
    ]);
    const sheets = path.join(OUT_DIR, 'sheets');
    fs.mkdirSync(sheets, { recursive: true });
    const rows = Math.max(1, Math.ceil(Math.ceil(n / 15) / 8));
    ffmpeg([
      '-framerate', String(FPS), '-i', frames,
      '-vf', `select='not(mod(n\\,15))',scale=320:-1,tile=8x${rows}`,
      '-frames:v', '1', '-update', '1',
      path.join(sheets, `${this.name}.png`),
    ]);
  }
}

// ---------------------------------------------------------------------------
// The save every segment starts from: settings that keep panels readable and
// popups away, and an otherwise fresh Story Mode run. A segment layers what
// its shot needs on top.
// ---------------------------------------------------------------------------

async function seedBase(rec, extra = {}) {
  await rec.page.evaluate(async (extra) => {
    const g = window.__game;
    const mats = await import('/src/data/materials.ts');
    const tut = await import('/src/data/tutorial.ts');
    const settings = await import('/src/data/settings.ts');
    const r = g.registry;
    r.set('superpositionMode', false);
    r.set('storyScreensEnabled', true);
    r.set('storyLength', 'brief');
    r.set('fontScale', settings.FONT_SCALE_PRESETS[1].value);
    r.set('tutorialTipsSeen', Object.keys(tut.TUTORIAL_TIPS));
    r.set('tutorialTipsEnabled', false);
    r.set('worldLoreSeen', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    r.set('musicStyle', 'mute');
    r.set('epoch', 1);
    r.set('epochUnlocked', 1);
    r.set('playerForm', null);
    r.set('playerStats', { ...mats.DEFAULT_STATS });
    // Zero reads as "full" when a battle opens (BattleScene's savedHp), so
    // no segment inherits the bruises of the one before it.
    r.set('playerHp', 0);
    r.set('rivalDefeated', {});
    r.set('visitedWorlds', [1]);
    r.set('metGuardians', []);
    r.set('defeatedMaterials', []);
    r.set('discoveredMaterials', []);
    const resolveMaterial = (v) => {
      if (typeof v !== 'string') return v;
      const m = mats.findMaterialByName(v);
      if (!m) throw new Error(`seed: no material named "${v}"`);
      return m;
    };
    for (const [k, v] of Object.entries(extra)) {
      if (k === 'playerForm') r.set(k, v === null ? null : resolveMaterial(v));
      else if (k === 'defeatedMaterials' || k === 'discoveredMaterials')
        r.set(k, v.map((n) => { const m = resolveMaterial(n); return { name: m.name, type: m.type }; }));
      else r.set(k, v);
    }
  }, extra);
}

// ---------------------------------------------------------------------------
// The segments. Each is one shot or a run of shots recorded into one clip; the
// timing table in the build task decides how long each runs.
// ---------------------------------------------------------------------------

const ALL_GUARDIANS = ['noether', 'bloch', 'dresselhaus', 'landau', 'majorana', 'anderson', 'feynman', 'kondo', 'franklin', 'sklodowskaCurie'];

// Puts the player `rowsBack` rows short of the world's pass, on the pass's
// column (or the nearest walkable tile of that row), camera with it.
// Opens the guardian standing at the world's middle, the way a returning
// player reopens one (every guardian is met in these seeds): stood on the
// middle row, the panel reopened. `preview` is set on the scene first, for the
// panels that preview a row of their list (Dresselhaus's crystal, Majorana's
// hybrid).
async function openGuardianPanel(rec, preview = {}) {
  const ok = await rec.run(async (P, preview) => {
    const s = P.scene('Overworld');
    const fx = await import('/src/art/moveEffectPreview.ts');
    fx.stopMoveEffectPreview();
    if (s.dialogueActive) s.closeDialogue();
    Object.assign(s, preview);
    const mid = s.midTile;
    s.playerTile = { x: mid.x, y: mid.y };
    s.camPos.x = mid.x;
    s.camPos.y = mid.y;
    s.reachedMiddle = true;
    s.maybeAutoOpenMiddleDialogue();
    return s.dialogueActive === true;
  }, preview);
  if (!ok) throw new Error('openGuardianPanel: the panel did not open');
}

// A battle against the first wild of a world's pool, started from that world
// the way an encounter starts one, the player a little faster than the wild
// so their pick is the first thing that happens.
async function startWildBattle(rec, world, speedRatio, foeName) {
  await rec.start('Overworld', { world });
  await rec.run(async (P, { world, foeName }) => {
    const mats = await import('/src/data/materials.ts');
    const foe = foeName ? mats.findMaterialByName(foeName) : mats.getWildPool(world)[0];
    P.actions.stand();
    P.scene('Overworld').startBattle(foe, 1);
  }, { world, foeName });
  await rec.skip(2);
  await rec.run((P, ratio) => {
    const b = P.scene('Battle');
    b.playerStats = { ...b.playerStats, velocity: b.enemyStats.velocity * ratio };
    b.drawTurnPreview();
  }, speedRatio);
  await rec.skip(18);
}

async function standBeforeGoal(rec, rowsBack) {
  await rec.run((P, rowsBack) => {
    const s = P.scene('Overworld');
    const goal = s.goalTile;
    const y = goal.y + rowsBack;
    const row = s.walkable[y];
    let x = goal.x;
    for (let d = 0; d < row.length && !row[x]; d++) x = goal.x + (d % 2 ? -1 : 1) * Math.ceil(d / 2);
    s.playerTile = { x, y };
    s.camPos.x = x;
    s.camPos.y = y;
  }, rowsBack);
}

const SEGMENTS = {
  // Ten worlds in order, a forward walk in each, 1.25 s apiece.
  async road(rec) {
    for (let world = 1; world <= 10; world++) {
      await seedBase(rec, {
        visitedWorlds: Array.from({ length: world }, (_, i) => i + 1),
        metGuardians: ALL_GUARDIANS,
        rivalDefeated: Object.fromEntries(Array.from({ length: world - 1 }, (_, i) => [i + 1, true])),
      });
      await rec.start('Overworld', { world });
      if (world === 10) await standBeforeGoal(rec, 7);
      await rec.skip(world === 10 ? 5 : 20, ['walk']);
      await rec.record(world % 2 ? 37 : 38, ['walk']);
    }
  },

  // Silicon walking the Mean Fields, ambushed by a wild Nickel Oxide, the
  // right answer picked, the cut into the boosted battle on the beat the
  // battle score starts; then, as its own segment, the fight's opening
  // exchange.
  async ambush(rec) {
    await seedBase(rec, { qumatessence: 140, metGuardians: ALL_GUARDIANS });
    await rec.start('Overworld', { world: 1 });
    await rec.skip(10, ['walk']);
    await rec.record(90, ['walk']);
    log(`  question: ${await rec.run(async (P) => {
      P.actions.stand();
      return P.openEncounter('Nickel Oxide', '\\bNiO\\b');
    })}`);
    await rec.record(180, ['stand']);
    log(`  answered: ${await rec.run((P) => P.answerRight('Overworld'))}`);
    await rec.recordUntil((P) => window.__game.scene.isActive('Battle'), { max: 10 });
    await rec.record(Math.max(0, 360 - rec.count));
    await rec.split('battle-open');
    await rec.run((P) => P.scene('Battle').playerAttack('thermalFluctuation'));
    await rec.record(150);
  },

  // The quasiparticle rule: Yttrium Iron Garnet, an insulating magnet, throws
  // a magnon into Bi₂Te₃, which has no magnetic order to host one, so the hit
  // lands double. The menu's 2x tag is held long enough to read first.
  async battle2x(rec) {
    await seedBase(rec, {
      playerForm: 'Yttrium Iron Garnet',
      unlockedMoves: ['thermalFluctuation', 'magneticField'],
      visitedWorlds: [1, 2, 3],
      playerStats: { quantumness: 1, velocity: 2, correlation: 3 },
    });
    await rec.start('Overworld', { world: 3 });
    await rec.run(async (P) => {
      const mats = await import('/src/data/materials.ts');
      P.scene('Overworld').startBattle(mats.findMaterialByName('Bi₂Te₃'), 1);
    });
    await rec.skip(2);
    // Faster than the wild, but not twice as fast: one pick a round, thrown
    // before the reply, so the double hit is the first thing that happens.
    await rec.run((P) => {
      const b = P.scene('Battle');
      b.playerStats = { ...b.playerStats, velocity: b.enemyStats.velocity * 1.5 };
      b.drawTurnPreview();
    });
    await rec.skip(18);
    await rec.record(45);
    await rec.run((P) => P.scene('Battle').playerAttack('magneticField'));
    await rec.record(135);
  },

  // Momentum: a crystal twice as fast as its opponent gets two picks a
  // round, the Turns row counting them down; then, as its own segment, the
  // finishing blow and the victory panel with its physics note.
  async momentum(rec) {
    await seedBase(rec, { qumatessence: 140 });
    await rec.start('Overworld', { world: 1 });
    await rec.run(async (P) => {
      const mats = await import('/src/data/materials.ts');
      P.scene('Overworld').startBattle(mats.findMaterialByName('Iron'), 1);
    });
    await rec.skip(2);
    // The wild's own stats carry a specimen roll, so the player's Momentum is
    // set against the rolled value, a little over twice it.
    await rec.run((P) => {
      const b = P.scene('Battle');
      b.playerStats = { ...b.playerStats, velocity: b.enemyStats.velocity * 2.2 };
      b.drawTurnPreview();
    });
    await rec.skip(18);
    log(`  hit order: ${JSON.stringify(await rec.run((P) => P.scene('Battle').currentHitOrder()))}`);
    const unlocked = (P) => !P.scene('Battle').turnLock;
    await rec.record(15);
    await rec.run((P) => P.scene('Battle').playerAttack('thermalFluctuation'));
    await rec.recordUntil(unlocked, { min: 10, max: 120, after: 8 });
    await rec.run((P) => P.scene('Battle').playerAttack('thermalFluctuation'));
    await rec.record(Math.max(0, 120 - rec.count));
    await rec.split('finish');
    await rec.recordUntil(unlocked, { max: 90, after: 6 });
    await rec.run((P) => {
      const b = P.scene('Battle');
      b.opponentHp = 1;
      b.updateBars();
      b.playerAttack('thermalFluctuation');
    });
    await rec.record(Math.max(0, 180 - rec.count));
  },

  // The Lab's Moves station playing six moves on its stage, two seconds
  // each. The station lists only what the current form can host, so the six
  // need four forms: Silicon (phonon), Yttrium Iron Garnet (an insulating
  // magnet, magnon), Herbertsmithite (a quantum spin liquid, spinon), and
  // Uranium Ditelluride (a chiral superconductor hosting chiral, Higgs and
  // Majorana excitations together).
  async moves(rec) {
    const picks = [
      [null, 'thermalFluctuation'],
      ['Yttrium Iron Garnet', 'magneticField'],
      ['Herbertsmithite', 'entanglementSwap'],
      ['Uranium Ditelluride', 'decoherenceWave'],
      ['Uranium Ditelluride', 'chiralCurrent'],
      ['Uranium Ditelluride', 'higgsOscillation'],
    ];
    for (const [form, id] of picks) {
      await seedBase(rec, {
        playerForm: form,
        metGuardians: ALL_GUARDIANS,
        unlockedMoves: ['thermalFluctuation', 'magneticField', 'entanglementSwap', 'decoherenceWave', 'chiralCurrent', 'higgsOscillation'],
      });
      await rec.start('Hub');
      const listed = await rec.run(async (P, id) => {
        const fx = await import('/src/art/moveEffectPreview.ts');
        fx.stopMoveEffectPreview();
        const sc = P.scene('Hub');
        sc.closeDialogue?.();
        sc.movesSelectedId = id;
        sc.movesPage = 0;
        const st = await import('/src/scenes/panels/hubStations.ts');
        st.showMovesPanel(sc);
        return sc.movesSelectedId;
      }, id);
      if (listed !== id) log(`  (moves: ${id} is not listed for ${form ?? 'Silicon'}, the panel shows ${listed})`);
      await rec.skip(4);
      await rec.record(60);
    }
    await rec.run(async () => (await import('/src/art/moveEffectPreview.ts')).stopMoveEffectPreview());
  },

  // Dresselhaus's panel, a defeated crystal previewed beside its price; then
  // the player wearing three of them in three worlds, each walking forward.
  async crystals(rec) {
    const defeated = ['Nickel Oxide', 'Graphene', 'Bi₂Te₃', 'Yttrium Iron Garnet', 'Iron', 'Chromium'];
    await seedBase(rec, { metGuardians: ALL_GUARDIANS, defeatedMaterials: defeated, discoveredMaterials: defeated, visitedWorlds: [1, 2, 3], qumatessence: 900 });
    await rec.start('Overworld', { world: 3 });
    await openGuardianPanel(rec, { dresselhausPreview: 'Graphene' });
    await rec.skip(4);
    await rec.record(105);
    for (const [form, world] of [['Graphene', 2], ['Bi₂Te₃', 3], ['Yttrium Iron Garnet', 6]]) {
      await seedBase(rec, { playerForm: form, metGuardians: ALL_GUARDIANS, visitedWorlds: Array.from({ length: world }, (_, i) => i + 1), qumatessence: 900 });
      await rec.start('Overworld', { world });
      await rec.skip(12, ['walk']);
      await rec.record(80, ['walk']);
    }
  },

  // Majorana's panel previewing the HgTe/CdTe Quantum Well; the hybrid walking
  // the Devouring Mirror in its aura among wild hybrids; a Helical Lock, the
  // quantum spin Hall edge mode, thrown into one of them.
  async hybrids(rec) {
    await seedBase(rec, { metGuardians: ALL_GUARDIANS, defeatedMaterials: ['HgTe', 'CdTe', 'Aluminum', 'Indium Arsenide'], visitedWorlds: [1, 2, 3, 4, 5], qumatessence: 2400 });
    await rec.start('Overworld', { world: 5 });
    await openGuardianPanel(rec, { majoranaPreview: 'HgTe/CdTe Quantum Well' });
    await rec.skip(4);
    await rec.record(120);
    const all = Array.from({ length: 10 }, (_, i) => i + 1);
    await seedBase(rec, {
      playerForm: 'HgTe/CdTe Quantum Well',
      metGuardians: ALL_GUARDIANS,
      visitedWorlds: all,
      unlockedMoves: ['thermalFluctuation', 'helicalCurrent'],
      playerStats: { quantumness: 4, velocity: 3, correlation: 4 },
    });
    await rec.start('Overworld', { world: 10 });
    await rec.skip(12, ['walk']);
    await rec.record(90, ['walk']);
    const foe = await rec.run(async (P) => {
      const mats = await import('/src/data/materials.ts');
      const pool = mats.getWildPool(10).filter((m) => m.name !== 'HgTe/CdTe Quantum Well');
      const pick = pool.find((m) => !mats.canHost(m.type, 'helical')) ?? pool[0];
      P.actions.stand();
      P.scene('Overworld').startBattle(pick, 1);
      return `${pick.name} (${pick.type}), hosts helical: ${mats.canHost(pick.type, 'helical')}`;
    });
    log(`  helical target: ${foe}`);
    await rec.skip(2);
    await rec.run((P) => {
      const b = P.scene('Battle');
      b.playerStats = { ...b.playerStats, velocity: b.enemyStats.velocity * 1.5 };
      b.drawTurnPreview();
    });
    await rec.skip(14);
    await rec.record(15);
    await rec.run((P) => P.scene('Battle').playerAttack('helicalCurrent'));
    await rec.record(75);
  },

  // The Lab, every guardian met, the ten of them standing in its corners.
  async lab(rec) {
    await seedBase(rec, { metGuardians: ALL_GUARDIANS, visitedWorlds: [1, 2, 3, 4, 5, 6], qumatessence: 900 });
    await rec.start('Hub');
    await rec.skip(4);
    await rec.record(150);
  },

  // Bloch's map, the visited worlds named and one ringed, and the fold to it.
  async bloch(rec) {
    await seedBase(rec, { metGuardians: ALL_GUARDIANS, visitedWorlds: [1, 2, 3, 4, 5, 6], blochUnlockedWorlds: [5], qumatessence: 900 });
    await rec.start('Overworld', { world: 2 });
    await openGuardianPanel(rec, { blochPreview: 5 });
    await rec.skip(4);
    await rec.record(80);
    await rec.run((P) => P.pressText('Overworld', 'Travel to'));
    await rec.record(40);
  },

  // A battle in a world of the storm, for the three guardians whose act is a
  // move: the form is Silicon, which hosts the phonon every one of them casts
  // as here.
  async landau(rec) {
    await seedBase(rec, {
      metGuardians: ALL_GUARDIANS,
      visitedWorlds: [1, 2, 3, 4],
      unlockedMoves: ['thermalFluctuation', 'skyfallBeam'],
      moveClassTuning: { skyfallBeam: 'phonon' },
      playerStats: { quantumness: 1, velocity: 3, correlation: 4 },
    });
    await startWildBattle(rec, 4, 1.5);
    await rec.record(10);
    await rec.run((P) => P.pressText('Battle', 'Lance'));
    await rec.record(90);
    log(`  answered: ${await rec.run((P) => P.answerRight('Battle'))}`);
    await rec.record(90);
  },

  async kondo(rec) {
    await seedBase(rec, {
      metGuardians: ALL_GUARDIANS,
      visitedWorlds: [1, 2, 3, 4, 5, 6, 7, 8],
      unlockedMoves: ['thermalFluctuation', 'spinScreening'],
      kondoActiveMove: 'spinScreening',
      playerStats: { quantumness: 4, velocity: 3, correlation: 4 },
    });
    await startWildBattle(rec, 4, 1.5);
    await rec.record(10);
    await rec.run((P) => P.pressText('Battle', 'Spin Screening'));
    await rec.record(80);
  },

  // The player's crystal with an impurity doped into its base: Anderson's
  // panel previewing it, then the doped crystal out on the map.
  async anderson(rec) {
    const defeated = ['Iron', 'Cobalt', 'Nickel Oxide', 'Chromium'];
    await seedBase(rec, {
      metGuardians: ALL_GUARDIANS,
      visitedWorlds: [1, 2, 3, 4, 5, 6],
      defeatedMaterials: defeated,
      discoveredMaterials: defeated,
      andersonDopant: 'Iron',
      andersonUnlockedHosts: ['Iron'],
      qumatessence: 900,
    });
    await rec.start('Overworld', { world: 6 });
    await openGuardianPanel(rec, { andersonHostPreview: 'Iron' });
    await rec.skip(4);
    await rec.record(50);
    await rec.run((P) => P.scene('Overworld').closeDialogue());
    await rec.skip(2);
    await rec.record(40, ['walk']);
  },

  // Three questions in a row, then the meteor out of the sky with the arena
  // camera pulling back.
  async curie(rec) {
    await seedBase(rec, {
      metGuardians: ALL_GUARDIANS,
      visitedWorlds: [1, 2, 3, 4],
      unlockedMoves: ['thermalFluctuation', 'ultimateMeteor'],
      playerStats: { quantumness: 4, velocity: 3, correlation: 4 },
    });
    await startWildBattle(rec, 4, 1.5);
    await rec.record(8);
    await rec.run((P) => P.pressText('Battle', 'Meteor'));
    for (const hold of [55, 30, 30]) {
      await rec.record(hold);
      log(`  answered: ${await rec.run((P) => P.answerRight('Battle'))}`);
    }
    await rec.recordUntil((P) => !!P.scene('Battle').children.list.find((o) => o.type === 'Text' && /Victory|Phonon Meteor!/.test(o.text)), { max: 300, after: 45 });
  },

  // World 3's golem end to end: the approach up the last rows, its taunt
  // page, and, as its own segment, the fight under the boss banner, Yttrium
  // Iron Garnet's magnon landing double on the Bi₂Te₃ golem as it did on the
  // wild.
  async boss(rec) {
    const golemSeed = {
      playerForm: 'Yttrium Iron Garnet',
      metGuardians: ALL_GUARDIANS,
      visitedWorlds: [1, 2, 3],
      rivalDefeated: { 1: true, 2: true },
      unlockedMoves: ['thermalFluctuation', 'magneticField'],
      playerStats: { quantumness: 1, velocity: 3, correlation: 3 },
      qumatessence: 600,
    };
    await seedBase(rec, golemSeed);
    await rec.start('Overworld', { world: 3 });
    await standBeforeGoal(rec, 9);
    await rec.skip(6);
    await rec.record(110, ['walk']);
    await rec.run((P) => {
      P.actions.stand();
      P.scene('Overworld').showRivalEncounter();
    });
    await rec.record(120, ['stand']);
    await rec.split('boss-fight');
    await rec.run((P) => P.scene('Overworld').startBattle(P.scene('Overworld').getWorldRival(), 1, true));
    // One pick a round, thrown first, so the golem's reply follows it.
    await rec.skip(2);
    await rec.run((P) => {
      const b = P.scene('Battle');
      b.playerStats = { ...b.playerStats, velocity: b.enemyStats.velocity * 1.5 };
      b.drawTurnPreview();
    });
    await rec.skip(18);
    await rec.record(12);
    await rec.run((P) => P.scene('Battle').playerAttack('magneticField'));
    await rec.record(168);
  },

  // The pass once its golem has fallen: the gap showing the next world's
  // colours and the crossing's fade, cut before the story screen.
  async pass(rec) {
    await seedBase(rec, {
      playerForm: 'Yttrium Iron Garnet',
      metGuardians: ALL_GUARDIANS,
      visitedWorlds: [1, 2, 3],
      rivalDefeated: { 1: true, 2: true, 3: true },
      qumatessence: 700,
    });
    await rec.start('Overworld', { world: 3, regenerate: true, enterFrom: 'goal' });
    await rec.skip(10);
    await rec.record(95);
    await rec.run((P) => P.scene('Overworld').crossPass());
    await rec.record(15);
  },

  // World 5's golem out on the ice, mid-fight: a spinon from Herbertsmithite,
  // a quantum spin liquid, into a superconductor that hosts no spinon.
  async boss5(rec) {
    await seedBase(rec, {
      playerForm: 'Herbertsmithite',
      metGuardians: ALL_GUARDIANS,
      visitedWorlds: [1, 2, 3, 4, 5],
      rivalDefeated: { 1: true, 2: true, 3: true, 4: true },
      unlockedMoves: ['thermalFluctuation', 'entanglementSwap'],
      playerStats: { quantumness: 4, velocity: 4, correlation: 4 },
    });
    await rec.start('Overworld', { world: 5 });
    await rec.run((P) => P.scene('Overworld').startBattle(P.scene('Overworld').getWorldRival(), 1, true));
    await rec.skip(20);
    await rec.record(8);
    await rec.run((P) => P.scene('Battle').playerAttack('entanglementSwap'));
    await rec.record(112);
  },

  // The Devouring Mirror: the corridor and its horizon, the Adapted standing
  // in the throat wearing the player's crystal; then the fight, the Adapted
  // reshaping into a compound that hosts each hit; then its later stages
  // under their own titles, ending on an Ultimate falling on the player.
  async finale(rec) {
    const seed = (epoch) => ({
      playerForm: 'Yttrium Iron Garnet',
      metGuardians: ALL_GUARDIANS,
      visitedWorlds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      rivalDefeated: Object.fromEntries(Array.from({ length: 9 }, (_, i) => [i + 1, true])),
      unlockedMoves: ['thermalFluctuation', 'magneticField'],
      playerStats: { quantumness: 6, velocity: 6, correlation: 6 },
      epoch,
      epochUnlocked: epoch,
      qumatessence: 1800,
    });
    const startFinaleBattle = async () => {
      await rec.run((P) => P.scene('Overworld').startBattle(P.scene('Overworld').getWorldRival(), 1, true));
      await rec.skip(2);
      await rec.run((P) => {
        const b = P.scene('Battle');
        b.playerStats = { ...b.playerStats, velocity: b.enemyStats.velocity * 1.5 };
        b.drawTurnPreview();
      });
      await rec.skip(18);
    };
    const unlocked = (P) => !P.scene('Battle').turnLock;
    const panelUp = (label) => eval(`(P) => !!P.visibleClickables('Battle').find((o) => o.type === 'Text' && o.text === ${JSON.stringify(label)})`);
    // The opponent's bar emptied by the next hit, which moves the finale on
    // to its next stage and raises that stage's panel.
    const finishStage = async (record) => {
      await (record ? rec.recordUntil(unlocked, { max: 150, after: 4 }) : untilSkip(unlocked));
      await rec.run((P) => {
        const b = P.scene('Battle');
        b.opponentHp = 1;
        b.updateBars();
        b.playerAttack('magneticField');
      });
    };
    const untilSkip = async (test, max = 300) => {
      for (let i = 0; i < max && !(await rec.run(test)); i++) await rec.skip(1);
    };

    await seedBase(rec, seed(1));
    await rec.start('Overworld', { world: 10 });
    await standBeforeGoal(rec, 14);
    await rec.skip(6);
    await rec.record(120, ['walk']);
    await rec.split('finale-stand');
    await rec.record(90, ['stand']);

    // Epoch 1: the Adapted wearing the player's crystal, reshaping on each
    // hit, then the second stage under its title.
    await rec.split('finale-fight');
    await startFinaleBattle();
    await rec.record(10);
    await rec.run((P) => P.scene('Battle').playerAttack('magneticField'));
    await rec.recordUntil(unlocked, { min: 20, max: 150, after: 6 });
    await rec.run((P) => P.scene('Battle').playerAttack('magneticField'));
    await rec.record(Math.max(0, 210 - rec.count));
    await rec.split('finale-model');
    await finishStage(true);
    // Half a second on each stage panel: its title registers, its story
    // text does not (the owner's call, PROMO_VIDEO_BUILD_TASK.md).
    await rec.recordUntil(panelUp('Face it'), { max: 200, after: 15 });
    await rec.run((P) => P.pressText('Battle', 'Face it'));
    await rec.record(90);

    // Epoch 3, where the last stage casts an Ultimate every turn: the first
    // two stages are passed off camera, and the recording picks up on the
    // third stage's panel.
    await rec.split('finale-quantum');
    await seedBase(rec, seed(3));
    await rec.start('Overworld', { world: 10 });
    await standBeforeGoal(rec, 2);
    await startFinaleBattle();
    await finishStage(false);
    await untilSkip(panelUp('Face it'));
    await rec.run((P) => P.pressText('Battle', 'Face it'));
    await finishStage(false);
    await untilSkip(panelUp('Battle!'));
    await rec.record(15);
    await rec.run((P) => P.pressText('Battle', 'Battle!'));
    await rec.recordUntil(unlocked, { max: 150, after: 4 });
    await rec.run((P) => P.scene('Battle').playerAttack('magneticField'));
    await rec.record(240);
  },

  // The title as a first-time player sees it, offering a New Game: the saves
  // the other segments' seeding has written are cleared first.
  async title(rec) {
    await seedBase(rec);
    await rec.run(() => localStorage.clear());
    await rec.start('Title');
    await rec.record(105);
  },

  // The title screen again, held under the end card.
  async close(rec) {
    await seedBase(rec);
    await rec.run(() => localStorage.clear());
    await rec.start('Title');
    await rec.skip(30);
    await rec.record(300);
  },
};

// ---------------------------------------------------------------------------
// The cut. One entry per piece, in order: a captured segment (trimmed to
// `from`/`to` seconds of its own clip), a card on black, or black. Captions
// are laid over a piece between `at` and `until`, seconds from the piece's
// start. Moving a beat is an edit here; the timeline, the captions and the
// music's seams are all derived from it.
// ---------------------------------------------------------------------------

const CUT = [
  { card: 'card-open', dur: 3 },
  { seg: 'road', captions: [['cap-road', 0.2, 5.0]] },
  { seg: 'title', captions: [['cap-title', 0.4, 3.5]] },
  { seg: 'ambush', captions: [['cap-ambush', 3.4, 8.9]] },
  { seg: 'battle-open', captions: [['cap-quasi', 0.3, 5.0]] },
  { seg: 'battle2x', captions: [['cap-double', 1.3, 6.0]] },
  { seg: 'momentum' },
  { seg: 'finish' },
  { seg: 'moves', captions: [['cap-moves', 0.3, 8.0]] },
  { card: 'card-crystal', dur: 2.5 },
  { seg: 'crystals', captions: [['cap-habit', 3.8, 11.3]] },
  { card: 'card-fuse', dur: 2.5 },
  { seg: 'hybrids' },
  { seg: 'lab', captions: [['over-guardians', 0.3, 5.0]] },
  { seg: 'bloch', captions: [['cap-bloch', 0.2, 4.0]] },
  { seg: 'landau', captions: [['cap-landau', 0.2, 6.3]] },
  { seg: 'kondo', captions: [['cap-kondo', 0.0, 3.0]] },
  { seg: 'anderson', captions: [['cap-anderson', 0.0, 3.0]] },
  { seg: 'curie', captions: [['cap-curie', 0.0, 4.0]] },
  { seg: 'boss', captions: [['cap-golem', 0.3, 4.0]] },
  { seg: 'boss-fight', captions: [['cap-poly', 0.3, 5.5]] },
  { seg: 'pass' },
  { seg: 'boss5' },
  { seg: 'finale', captions: [['cap-watched', 0.3, 4.0]] },
  { seg: 'finale-stand' },
  { seg: 'finale-fight', captions: [['cap-model', 2.0, 6.8]] },
  { seg: 'finale-model' },
  // Cut on the Ultimate's last light, before the defeat summary rises.
  { seg: 'finale-quantum', to: 7.2 },
  { black: 1.5 },
  { seg: 'close', captions: [['end', 0.6, 10.0]], fadeOutCaption: false },
];

// The music under the cut: each cue starts on the piece named, and runs to
// the next cue's start. The battle scores start hard, on the cut into battle;
// the overworld scores fade in. The close brings World 1's score back, as the
// title screen itself plays it.
const MUSIC = [
  ['w1-overworld', 'card-open', 0, 1.5, 0.6],
  ['w1-battle', 'ambush+9', 0.02, 1.0],
  ['w6-overworld', 'card-crystal', 1.0, 1.0],
  ['w4-battle', 'bloch', 0.3, 1.0],
  ['w10-overworld', 'finale', 0.5, 2.5],
  ['w1-overworld', 'close', 1.0, 2.5],
];

function clipSeconds(file) {
  // No ffprobe on this machine: the duration is read off ffmpeg's banner.
  let out = '';
  try {
    execFileSync(FFMPEG, ['-hide_banner', '-i', file], { stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    out = String(e.stderr);
  }
  const m = /Duration: (\d+):(\d+):([\d.]+)/.exec(out);
  if (!m) throw new Error(`no duration for ${file}`);
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

async function renderCards(browser) {
  const dir = path.join(OUT_DIR, 'cards');
  fs.mkdirSync(dir, { recursive: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  await page.goto(`file://${path.join(__dirname, 'promo-cards.html')}`);
  const ids = await page.$$eval('section', (els) => els.map((e) => e.id));
  for (const id of ids) {
    const el = await page.$(`#${id}`);
    await el.screenshot({ path: path.join(dir, `${id}.png`), omitBackground: true });
  }
  await page.close();
  log(`  ${ids.length} cards and captions`);
}

// Each piece is encoded on its own, captions burned in, to identical stream
// parameters, and the pieces are joined with the concat demuxer; the music is
// mixed from the cue table and muxed on last.
function assemble(name) {
  const dir = path.join(OUT_DIR, 'pieces');
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const cards = path.join(OUT_DIR, 'cards');
  const enc = ['-r', String(FPS), '-c:v', 'libx264', '-crf', '18', '-pix_fmt', 'yuv420p', '-an'];
  const starts = {};
  let t = 0;
  const list = [];
  for (const [i, piece] of CUT.entries()) {
    const out = path.join(dir, `p${String(i).padStart(2, '0')}.mp4`);
    let dur;
    if (piece.card) {
      dur = piece.dur;
      ffmpeg(['-loop', '1', '-t', String(dur), '-i', path.join(cards, `${piece.card}.png`),
        '-vf', `format=yuv420p,fade=t=in:st=0:d=0.3,fade=t=out:st=${dur - 0.3}:d=0.3`, ...enc, out]);
      starts[piece.card] = t;
    } else if (piece.black) {
      dur = piece.black;
      ffmpeg(['-f', 'lavfi', '-i', `color=c=black:s=1920x1080:r=${FPS}:d=${dur}`, ...enc, out]);
    } else {
      const src = path.join(OUT_DIR, 'segments', `${piece.seg}.mp4`);
      if (!fs.existsSync(src)) throw new Error(`segment ${piece.seg} has not been captured`);
      const from = piece.from ?? 0;
      const to = piece.to ?? clipSeconds(src);
      dur = to - from;
      const args = ['-ss', String(from), '-t', String(dur), '-i', src];
      const caps = piece.captions ?? [];
      let graph = '';
      let last = '0:v';
      caps.forEach(([id, at, until], k) => {
        args.push('-loop', '1', '-t', String(dur), '-i', path.join(cards, `${id}.png`));
        const fadeOut = piece.fadeOutCaption === false ? '' : `,fade=t=out:st=${until - 0.3}:d=0.3:alpha=1`;
        graph += `[${k + 1}:v]format=rgba,fade=t=in:st=${at}:d=0.3:alpha=1${fadeOut}[c${k}];`;
        graph += `[${last}][c${k}]overlay=enable='between(t,${at},${until})'[v${k}];`;
        last = `v${k}`;
      });
      if (caps.length) args.push('-filter_complex', graph.replace(/;$/, ''), '-map', `[${last}]`);
      ffmpeg([...args, ...enc, out]);
      starts[piece.seg] = t;
    }
    list.push(`file '${out}'`);
    t += dur;
  }
  const total = t;
  fs.writeFileSync(path.join(dir, 'list.txt'), list.join('\n') + '\n');
  const video = path.join(dir, 'video.mp4');
  ffmpeg(['-f', 'concat', '-safe', '0', '-i', path.join(dir, 'list.txt'), '-c', 'copy', video]);

  // The music: each cue cut to its slot plus its fade, faded, delayed to its
  // start and mixed. The battle scores are mixed hotter in the game than the
  // overworld ones, by about 3 dB, and are brought level here.
  const at = (key) => {
    const [k, plus] = key.split('+');
    if (!(k in starts)) throw new Error(`music cue on unknown piece ${k}`);
    return starts[k] + Number(plus ?? 0);
  };
  const cues = MUSIC.map(([file, key, fadeIn, fadeOut], i) => {
    const start = at(key);
    // A cue fades out across the next one's first moments; the last one
    // fades out to the end of the cut instead.
    const last = i + 1 === MUSIC.length;
    const end = last ? total : at(MUSIC[i + 1][1]);
    return { file, start, len: end - start + (last ? 0 : fadeOut), fadeIn, fadeOut };
  });
  const aargs = [];
  let agraph = '';
  cues.forEach((c, i) => {
    aargs.push('-i', path.join(OUT_DIR, 'audio', `${c.file}.wav`));
    const gain = /battle/.test(c.file) ? 0.72 : 1;
    agraph +=
      `[${i}:a]atrim=0:${c.len.toFixed(3)},asetpts=PTS-STARTPTS,volume=${gain},` +
      `afade=t=in:st=0:d=${c.fadeIn},afade=t=out:st=${(c.len - c.fadeOut).toFixed(3)}:d=${c.fadeOut},` +
      `adelay=${Math.round(c.start * 1000)}|${Math.round(c.start * 1000)}[a${i}];`;
  });
  agraph += `${cues.map((_, i) => `[a${i}]`).join('')}amix=inputs=${cues.length}:normalize=0:duration=longest,atrim=0:${total.toFixed(3)}[mix]`;
  const audio = path.join(dir, 'audio.wav');
  ffmpeg([...aargs, '-filter_complex', agraph, '-map', '[mix]', audio]);

  const final = path.join(OUT_DIR, `${name}.mp4`);
  ffmpeg(['-i', video, '-i', audio, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', '-shortest', final]);
  log(`  ${path.relative(REPO_DIR, final)}: ${total.toFixed(2)} s`);
  for (const c of cues) log(`    ${c.start.toFixed(2)} s  ${c.file}`);
}

// ---------------------------------------------------------------------------
// The music. The scores are procedural (src/audio/music.ts), so each cue is
// rendered offline through music.renderScore, the same mix the game plays,
// encoded to 16-bit PCM WAV in the page and carried out in chunks. A cue is
// rendered a couple of seconds longer than its slot so the assembly has room
// for its fades.
// ---------------------------------------------------------------------------

const CUES = [
  // [file, score, start s, end s, fade in s, fade out s]
  ['w1-overworld', 'overworld:1', 0, 28, 1.5, 0.6],
  ['w1-battle', 'battle:1', 28, 64, 0.02, 1.0],
  ['w6-overworld', 'overworld:6', 64, 95, 1.0, 1.0],
  ['w4-battle', 'battle:4', 95, 142, 0.3, 1.0],
  ['w10-overworld', 'overworld:10', 142, 172, 0.5, 3.0],
];

async function renderAudio(page) {
  const dir = path.join(OUT_DIR, 'audio');
  fs.mkdirSync(dir, { recursive: true });
  for (const [file, score, start, end] of CUES) {
    const seconds = end - start + 3;
    const size = await page.evaluate(
      async (score, seconds) => {
        const { music } = await import('/src/audio/music.ts');
        const buf = await music.renderScore(score, 'classic', seconds);
        const n = buf.length;
        const ch = [buf.getChannelData(0), buf.getChannelData(buf.numberOfChannels > 1 ? 1 : 0)];
        const out = new DataView(new ArrayBuffer(44 + n * 4));
        const str = (o, t) => [...t].forEach((c, i) => out.setUint8(o + i, c.charCodeAt(0)));
        str(0, 'RIFF');
        out.setUint32(4, 36 + n * 4, true);
        str(8, 'WAVEfmt ');
        out.setUint32(16, 16, true);
        out.setUint16(20, 1, true);
        out.setUint16(22, 2, true);
        out.setUint32(24, buf.sampleRate, true);
        out.setUint32(28, buf.sampleRate * 4, true);
        out.setUint16(32, 4, true);
        out.setUint16(34, 16, true);
        str(36, 'data');
        out.setUint32(40, n * 4, true);
        let peak = 0;
        for (let i = 0; i < n; i++) {
          for (let c = 0; c < 2; c++) {
            const v = Math.max(-1, Math.min(1, ch[c][i]));
            peak = Math.max(peak, Math.abs(v));
            out.setInt16(44 + i * 4 + c * 2, v * 32767, true);
          }
        }
        window.__promoWav = new Uint8Array(out.buffer);
        window.__promoPeak = peak;
        return window.__promoWav.length;
      },
      score,
      seconds
    );
    const chunks = [];
    const CHUNK = 1 << 20;
    for (let o = 0; o < size; o += CHUNK) {
      const b64 = await page.evaluate(
        (o, len) => {
          const part = window.__promoWav.subarray(o, o + len);
          let bin = '';
          for (let i = 0; i < part.length; i += 0x8000) bin += String.fromCharCode(...part.subarray(i, i + 0x8000));
          return btoa(bin);
        },
        o,
        CHUNK
      );
      chunks.push(Buffer.from(b64, 'base64'));
    }
    fs.writeFileSync(path.join(dir, `${file}.wav`), Buffer.concat(chunks));
    const peak = await page.evaluate(() => window.__promoPeak);
    log(`  ${file}.wav: ${score}, ${seconds} s, peak ${peak.toFixed(2)}`);
  }
}

// ---------------------------------------------------------------------------

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--list')) {
    console.log(Object.keys(SEGMENTS).join('\n'));
    return;
  }
  const scaleArg = argv.find((a) => a.startsWith('--scale='));
  const scale = scaleArg ? Number(scaleArg.split('=')[1]) : 2;
  const wanted = argv.filter((a) => !a.startsWith('--'));
  for (const w of wanted) if (!SEGMENTS[w]) throw new Error(`unknown segment "${w}" (try --list)`);
  if (argv.includes('--assemble')) {
    log('=== assemble ===');
    assemble(scale === 4 ? 'world_of_quantum_materials' : 'preview');
    return;
  }
  const names = wanted.length ? wanted : Object.keys(SEGMENTS);
  log(`Scale ${scale}x, segments: ${names.join(', ')}`);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const server = await ensureDevServer();
  const browser = await puppeteer.launch({
    executablePath: detectChromeBin(),
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', `--window-size=${CANVAS_W},${CANVAS_H}`, '--autoplay-policy=no-user-gesture-required'],
    protocolTimeout: 600000,
  });
  try {
    const page = await browser.newPage();
    page.on('pageerror', (e) => log(`  page error: ${e.message}`));
    await page.setViewport({ width: CANVAS_W, height: CANVAS_H, deviceScaleFactor: scale });
    await page.evaluateOnNewDocument(installPageHooks, scale);
    await page.goto(GAME_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__game && window.__game.scene.getScenes(true).length, { timeout: 60000 });
    await sleep(1500);
    await installPromoHelpers(page, scale);
    if (argv.includes('--cards')) {
      log('=== cards ===');
      await renderCards(browser);
    }
    if (argv.includes('--audio')) {
      log('=== audio ===');
      await renderAudio(page);
    }
    if ((argv.includes('--audio') || argv.includes('--cards')) && !wanted.length) return;
    const rec = new Recorder(page, scale);
    for (const name of names) {
      log(`=== ${name} ===`);
      // Seeded off the segment's name, so a segment draws the same map,
      // wilds and questions however the list around it changes.
      await rec.begin(name, [...name].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261));
      await SEGMENTS[name](rec);
      rec.finish();
    }
  } finally {
    await browser.close();
    teardownDevServer(server);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
