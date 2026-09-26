// What a frame of each scene costs to render, under each renderer a player's
// machine might give the game, for world_of_quantum_materials.
//
// perf-check counts work (draw calls, objects, tweens) because a count is the
// same on every machine and can gate a push. This measures time and CPU
// instead, which no count can answer: how much of a core the title screen,
// the Lab, each world's overworld and each world's battle take while the
// player sits in them, and how many frames a machine without a GPU manages.
// It is an instrument, not a gate -- the numbers move with the machine and
// with whatever else it is running -- so compare two runs made one after the
// other on the same machine, never a run against a number written down weeks
// earlier.
//
// Three renderer modes, the three paths a player's machine can put the game on:
//   gpu          WebGL on the machine's own GPU (ANGLE over OpenGL). Headless
//                Chrome reaches the real GPU with --use-angle=gl --enable-gpu
//                --ignore-gpu-blocklist; the run prints the renderer string it
//                got, so a machine without one is visible as SwiftShader here.
//   swiftshader  WebGL rasterized on the CPU (SwiftShader). The game passes
//                a software WebGL over for its Canvas renderer (src/main.ts's
//                chooseRenderer), so no player lands here unless the URL asks
//                for WebGL; it is measured to show why. Pixel fill is the
//                whole cost here, so this is where stacked translucent layers
//                show.
//   canvas       The Canvas renderer, with art/canvasRenderer.ts's gradients
//                and tints -- what a machine without a usable GPU runs,
//                whether its browser offers software WebGL or none at all.
// The first two load the game with ?renderer=webgl, the last ?renderer=canvas.
//
// Per scene and mode it reports: fps; JavaScript ms per frame inside the game
// step, split into update (scene logic, including the overworld's per-frame
// terrain rebuild) and render (Phaser turning the display list into draw
// calls, where a Graphics object's re-tessellation lands); p95 of the step;
// and, on Linux, the CPU the renderer process and the GPU process burned per
// second of wall time (100% = one core). Frames are vsync-paced, so at 60fps
// the CPU columns are what a player's fan and battery feel.
//
// Math.random is pinned, so each scene is the same map, arena and roll on
// every run and in every mode.
//
// Usage (from game/): npm run frame-cost
//   QM_FRAME_MODES=gpu,swiftshader,canvas   modes to run (default: all three)
//   QM_FRAME_SCENES=title,hub,ow1,bt6r      scenes (default: all; owN = world N's
//                                           overworld, btN = world N's battle,
//                                           btNr = its rival fight)
//   QM_FRAME_SECS=4                          measured seconds per scene
//   QM_FRAME_JSON=path                       dump every row as JSON for diffing runs
//   QM_FRAME_PORT=5195                       its own dev server's port
// CHROME_BIN auto-detects Puppeteer's cached Chrome-for-Testing binary if unset.

import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GAME_DIR = path.resolve(__dirname, '..');
const PORT = Number(process.env.QM_FRAME_PORT || 5195);
const URL = `http://localhost:${PORT}/`;
const MODES = (process.env.QM_FRAME_MODES || 'gpu,swiftshader,canvas').split(',').map((m) => m.trim());
const SECS = Number(process.env.QM_FRAME_SECS || 4);
const JSON_OUT = process.env.QM_FRAME_JSON || null;
const SEED = 12345;

const ALL_SCENES = [
  'title',
  'hub',
  ...Array.from({ length: 10 }, (_, i) => `ow${i + 1}`),
  ...Array.from({ length: 10 }, (_, i) => `bt${i + 1}`),
  'bt6r',
  'bt10r',
];
const SCENES = process.env.QM_FRAME_SCENES ? process.env.QM_FRAME_SCENES.split(',').map((s) => s.trim()) : ALL_SCENES;

const MODE_ARGS = {
  gpu: ['--use-angle=gl', '--enable-gpu', '--ignore-gpu-blocklist'],
  swiftshader: ['--disable-gpu', '--enable-unsafe-swiftshader'],
  canvas: ['--disable-gpu'],
};
const MODE_RENDERER = { gpu: 'webgl', swiftshader: 'webgl', canvas: 'canvas' };

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
    const res = await fetch(URL);
    return res.ok || res.status < 500;
  } catch (e) {
    return false;
  }
}

async function startDevServer() {
  if (await isServerUp()) return null;
  const child = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], { cwd: GAME_DIR, stdio: 'ignore', detached: true });
  child.unref();
  const start = Date.now();
  while (Date.now() - start < 30000) {
    if (await isServerUp()) return child;
    await sleep(400);
  }
  throw new Error(`dev server did not come up on :${PORT} within 30s`);
}

// CPU ticks per Chrome process type, summed over the browser's process tree.
// Linux only; elsewhere the CPU columns read as blank.
function processTree(pid) {
  const out = [pid];
  try {
    const kids = execSync(`pgrep -P ${pid}`).toString().trim().split('\n').filter(Boolean).map(Number);
    for (const k of kids) out.push(...processTree(k));
  } catch (e) {
    /* no children */
  }
  return out;
}
function cpuTicks(pids) {
  const byType = {};
  for (const p of pids) {
    try {
      const stat = fs.readFileSync(`/proc/${p}/stat`, 'utf8');
      const fields = stat.slice(stat.lastIndexOf(')') + 2).split(' ');
      const cmd = fs.readFileSync(`/proc/${p}/cmdline`, 'utf8');
      const type = (cmd.match(/--type=([a-z-]+)/) || [null, 'browser'])[1];
      byType[type] = (byType[type] || 0) + Number(fields[11]) + Number(fields[12]);
    } catch (e) {
      /* process gone, or not Linux */
    }
  }
  return byType;
}
const CLK_TCK = 100;

function sceneStart(id) {
  if (id === 'title') return { key: 'Title', data: {} };
  if (id === 'hub') return { key: 'Hub', data: {} };
  const world = Number(id.slice(2).replace('r', ''));
  if (id.startsWith('ow')) return { key: 'Overworld', data: { world, regenerate: true } };
  return {
    key: 'Battle',
    data: {
      world,
      isRival: id.endsWith('r'),
      wild: { name: 'Iron', type: 'metal', color: 0x7a8a99, variant: 'shard', moves: ['tunnelStrike'] },
      attackMultiplier: 1,
    },
  };
}

async function runMode(chromeBin, mode) {
  const browser = await puppeteer.launch({
    executablePath: chromeBin,
    headless: 'new',
    args: ['--no-sandbox', ...MODE_ARGS[mode], '--window-size=854,480'],
  });
  const rows = [];
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 854, height: 480 });
    await page.evaluateOnNewDocument((seed) => {
      let s = seed >>> 0;
      Math.random = () => {
        s = (s + 0x6d2b79f5) >>> 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }, SEED);
    await page.goto(`${URL}?renderer=${MODE_RENDERER[mode]}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__game && window.__game.scene.getScenes(true).length, { timeout: 60000 });

    const renderer = await page.evaluate(() => {
      const r = window.__game.renderer;
      if (!r.gl) return 'Canvas renderer';
      const ext = r.gl.getExtension('WEBGL_debug_renderer_info');
      return `WebGL: ${ext ? r.gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : r.gl.getParameter(r.gl.RENDERER)}`;
    });
    console.log(`\n=== ${mode} -- ${renderer}`);

    // The game step, split where Phaser splits it: SceneManager.update runs
    // every scene's logic, SceneManager.render turns the display lists into
    // draw calls. Wrapped on the instance, around the TimeStep's callback.
    await page.evaluate(() => {
      const g = window.__game;
      const R = (window.__frame = { on: false, upd: [], ren: [], step: [] });
      const sm = g.scene;
      const update = sm.update.bind(sm);
      const render = sm.render.bind(sm);
      sm.update = (t, d) => {
        const a = performance.now();
        update(t, d);
        if (R.on) R.upd.push(performance.now() - a);
      };
      sm.render = (r) => {
        const a = performance.now();
        render(r);
        if (R.on) R.ren.push(performance.now() - a);
      };
      const step = g.loop.callback;
      g.loop.callback = (time, delta) => {
        const a = performance.now();
        step(time, delta);
        if (R.on) R.step.push(performance.now() - a);
      };
      // No wild encounter interrupts an overworld measurement.
      g.registry.set('encounterDensity', 0);
    });

    const pid = browser.process().pid;
    for (const id of SCENES) {
      const { key, data } = sceneStart(id);
      await page.evaluate(
        ({ key, data }) => {
          const g = window.__game;
          ['Title', 'Hub', 'Overworld', 'Battle'].forEach((k) => {
            if (g.scene.isActive(k) || g.scene.isSleeping(k)) g.scene.stop(k);
          });
          g.scene.start(key, data);
        },
        { key, data }
      );
      await page.waitForFunction((key) => window.__game.scene.isActive(key), { timeout: 30000 }, key);
      await sleep(2000);
      // The idle state a player sits in: no world-entry tip or panel open.
      await page.evaluate(() => {
        for (const s of window.__game.scene.getScenes(true)) {
          if (s.dialogueActive && typeof s.closeDialogue === 'function') s.closeDialogue();
        }
      });
      await sleep(600);

      const pids = processTree(pid);
      const before = cpuTicks(pids);
      await page.evaluate(() => {
        Object.assign(window.__frame, { on: true, upd: [], ren: [], step: [] });
      });
      const t0 = Date.now();
      await sleep(SECS * 1000);
      const R = await page.evaluate(() => {
        const R = window.__frame;
        R.on = false;
        return { upd: R.upd, ren: R.ren, step: R.step };
      });
      const wall = (Date.now() - t0) / 1000;
      const after = cpuTicks(processTree(pid));
      const cpu = (type) => (after[type] != null ? (after[type] - (before[type] || 0)) / CLK_TCK / wall : null);

      const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
      const p95 = (a) => {
        const s = [...a].sort((x, y) => x - y);
        return s.length ? s[Math.min(s.length - 1, Math.floor(0.95 * s.length))] : 0;
      };
      const row = {
        mode,
        scene: id,
        fps: R.step.length / wall,
        updateMs: mean(R.upd),
        renderMs: mean(R.ren),
        stepMs: mean(R.step),
        stepP95Ms: p95(R.step),
        rendererCpu: cpu('renderer'),
        gpuProcessCpu: cpu('gpu-process'),
      };
      rows.push(row);
      const pct = (v) => (v == null ? '   -' : `${Math.round(v * 100)}%`.padStart(4));
      console.log(
        `${id.padEnd(6)} fps ${row.fps.toFixed(1).padStart(5)} | js/frame update ${row.updateMs.toFixed(2).padStart(5)}ms ` +
          `render ${row.renderMs.toFixed(2).padStart(5)}ms (p95 step ${row.stepP95Ms.toFixed(1).padStart(4)}ms) | ` +
          `cpu renderer ${pct(row.rendererCpu)} gpu-process ${pct(row.gpuProcessCpu)}`
      );
    }
  } finally {
    await browser.close();
  }
  return rows;
}

async function main() {
  const chromeBin = detectChromeBin();
  const server = await startDevServer();
  const rows = [];
  try {
    for (const mode of MODES) {
      if (!MODE_ARGS[mode]) throw new Error(`unknown mode "${mode}" (gpu, swiftshader, canvas)`);
      rows.push(...(await runMode(chromeBin, mode)));
    }
  } finally {
    if (server) {
      try {
        process.kill(-server.pid, 'SIGTERM');
      } catch (e) {
        console.log(`(dev server on :${PORT} may need stopping by hand: ${e.message || e})`);
      }
    }
  }
  if (JSON_OUT) {
    fs.writeFileSync(JSON_OUT, JSON.stringify(rows, null, 1));
    console.log(`\nwrote ${rows.length} rows to ${JSON_OUT}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
