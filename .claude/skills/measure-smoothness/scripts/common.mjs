// Shared by the two instruments of the measure-smoothness skill: a headless
// Chrome on this machine's real GPU, pointed at the running dev server, with
// the game seeded so that nothing opens on its own while a scene is measured.
import { createRequire } from 'node:module';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const GAME_DIR = process.env.GAME_DIR || path.resolve(HERE, '../../../../game');
const require = createRequire(path.join(GAME_DIR, 'package.json'));
const puppeteer = require('puppeteer-core');

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const URL_BASE = process.env.QM_URL || 'http://localhost:5173/';

// Headless Chrome falls back to a software WebGL unless it is told to use
// the GPU through Vulkan, and on a software WebGL the game picks its Canvas
// renderer and stays at display scale 1: a different game from the one a
// player's machine runs. QM_GPU_ARGS replaces these flags on another machine.
const GPU_ARGS = (process.env.QM_GPU_ARGS || '--use-angle=vulkan --enable-features=Vulkan --enable-gpu --ignore-gpu-blocklist').split(/\s+/).filter(Boolean);

function chromeBin() {
  if (process.env.CHROME_BIN) return process.env.CHROME_BIN;
  const found = execSync(
    `find "$HOME/.cache/puppeteer/chrome" -maxdepth 2 -type d -iname 'linux-*' -exec find {} -maxdepth 2 -type f -iname chrome \\; 2>/dev/null | head -1`,
    { shell: '/bin/bash' }
  ).toString().trim();
  if (!found) throw new Error('CHROME_BIN is not set and no cached Chrome was found.');
  return found;
}

// Opens the game at `width`x`height` with `query` appended to the URL, and
// returns the page, a CDP session and the errors the page has thrown so far.
export async function openGame({ width, height, query = '', throttle = 1 }) {
  const browser = await puppeteer.launch({
    executablePath: chromeBin(),
    headless: 'new',
    args: ['--no-sandbox', ...GPU_ARGS, '--autoplay-policy=no-user-gesture-required', `--window-size=${width},${height}`],
  });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 300)));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/favicon/.test(m.text())) errors.push(m.text().slice(0, 200));
  });
  await page.setViewport({ width, height });
  // The same map, wilds and rolls on every run.
  await page.evaluateOnNewDocument(() => {
    let s = 12345;
    Math.random = () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  });
  await page.goto(`${URL_BASE}${URL_BASE.includes('?') ? '&' : '?'}${query || 'x=1'}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__game && window.__game.scene.getScenes(true).length, { timeout: 60000 });
  const renderer = await page.evaluate(async () => {
    const g = window.__game;
    // Nothing that opens by itself: every tip and world story seen, every
    // guardian met (an unmet one opens its panel when the player reaches it,
    // which is half a second of building text, not a frame of walking), and
    // no wild crystal to walk into.
    const tut = await import('/src/data/tutorial.ts');
    g.registry.set('tutorialTipsSeen', Object.keys(tut.TUTORIAL_TIPS));
    g.registry.set('worldLoreSeen', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    g.registry.set('metGuardians', ['noether', 'bloch', 'dresselhaus', 'landau', 'kondo', 'majorana', 'anderson', 'franklin', 'feynman', 'sklodowskaCurie']);
    g.registry.set('encounterDensity', 0);
    const gl = g.renderer.gl;
    const info = gl && gl.getExtension('WEBGL_debug_renderer_info');
    return {
      type: g.renderer.type === 2 ? 'webgl' : 'canvas',
      gpu: gl ? String(info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)) : 'none',
      buffer: `${g.canvas.width}x${g.canvas.height}`,
    };
  });
  const cdp = await page.createCDPSession();
  if (throttle > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
  return { browser, page, cdp, errors, renderer };
}

// Starts the scene an id names, with every other scene stopped:
//   title, hub, ow<N> (world N at its entrance), ow<N>mid, ow<N>goal (a few
//   tiles before the guardian or the rival), ow<N>panel (the guardian's panel
//   open), bt<N> (a wild battle), bt<N>r (the rival's).
export async function startScene(page, id) {
  const world = Number(id.replace(/\D/g, '')) || 1;
  const start =
    id === 'title' ? ['Title', {}]
    : id === 'hub' ? ['Hub', {}]
    : id.startsWith('ow') ? ['Overworld', { world, regenerate: true }]
    : ['Battle', { world, isRival: id.endsWith('r'), wild: { name: 'Iron', type: 'metal', color: 0x7a8a99, variant: 'shard', moves: ['tunnelStrike'] }, attackMultiplier: 1 }];
  await page.evaluate(([key, data]) => {
    const g = window.__game;
    g.loop.wake();
    if (window.__vectorCache) window.__vectorCache(true);
    for (const k of ['Title', 'Hub', 'Overworld', 'Battle']) if (g.scene.isActive(k) || g.scene.isSleeping(k)) g.scene.stop(k);
    g.scene.start(key, data);
  }, start);
  await sleep(id.startsWith('bt') ? 5500 : 3000);
  await page.evaluate((id) => {
    const s = window.__game.scene.getScenes(true)[0];
    if (s.dialogueActive && s.closeDialogue && !/panel$/.test(id)) s.closeDialogue();
    const stand = (m, back) => {
      s.playerTile = { x: m.x, y: m.y + back };
      s.camPos.x = m.x;
      s.camPos.y = m.y + back;
      s.stepTarget = null;
      s.moving = false;
    };
    if (/mid$/.test(id)) stand(s.midTile, 2);
    if (/goal$/.test(id)) stand(s.goalTile, 3);
    if (/panel$/.test(id)) {
      if (s.dialogueActive) s.closeDialogue();
      s.constructor['WORLD_GUARDIANS'][s.world].open(s);
    }
  }, id);
  await sleep(600);
}
