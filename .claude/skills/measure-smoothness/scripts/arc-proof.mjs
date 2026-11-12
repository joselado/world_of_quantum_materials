// The arc rule (art/arcs.ts) against Phaser's hundred points.
//
//   node arc-proof.mjs [out.png]
//
// frozen-ab.mjs cannot see this rule, since both of its frames are drawn
// under it. This builds the same art twice in one frozen frame, once with the
// rule on and once with `window.__sizedArcs(false)`, a whole number of game
// pixels apart, and counts the pixels that differ between the two crops:
// every guardian avatar, a sheet of circles of radius 1 to 120 (filled,
// stroked thin, and with an arc), thick strokes on small circles (where a
// polyline's joins turn through the largest angles), and on purpose one case
// the rule is known to fail, a small circle enlarged six times. Each pair is
// built from the same random seed, so what differs is the arcs alone.
//
//   SCALE=3   the display scale the frame is drawn at
//
// Read the percentages for a regression (an avatar far above its usual one to
// three percent of drawn pixels) and look at the picture: left half the rule,
// right half Phaser's count.
import { openGame, startScene, sleep } from './common.mjs';

const SCALE = Number(process.env.SCALE || 3);
const { browser, page, errors } = await openGame({ width: 854 * SCALE, height: 480 * SCALE, query: `scale=${SCALE}` });
await startScene(page, 'title');
const lines = await page.evaluate(async (SCALE) => {
  const g = window.__game;
  const gl = g.renderer.gl;
  const s = g.scene.getScene('Title');
  for (const o of s.children.list.slice()) o.setVisible(false);
  s.tweens.pauseAll();
  s.time.paused = true;
  g.loop.sleep();
  const T = g.loop.now + 16;
  s.add.rectangle(427, 240, 854, 480, 0x20203a, 1).setDepth(1000);

  // A Text names its texture with random digits, and a pair built from one
  // seed would ask for the same name twice.
  const textures = s.sys.textures;
  const addCanvas = textures.addCanvas;
  let renamed = 0;
  textures.addCanvas = function (key, source, skipCache) {
    return addCanvas.call(this, this.exists(key) ? `${key}-${renamed++}` : key, source, skipCache);
  };

  let seed = 1;
  Math.random = () => {
    seed = (seed + 0x6d2b79f5) >>> 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  // Builds the same thing with the rule on at x and off at x + DX.
  const DX = 427;
  let pair = 0;
  const twice = (build) => {
    pair++;
    for (const [on, dx] of [[true, 0], [false, DX]]) {
      seed = 1000 + pair;
      window.__sizedArcs(on);
      build(dx);
    }
    window.__sizedArcs(true);
  };
  const cells = [];

  const names = ['noether', 'bloch', 'dresselhaus', 'landau', 'kondo', 'majorana', 'anderson', 'franklin', 'feynman', 'sklodowskaCurie'];
  for (let i = 0; i < names.length; i++) {
    const mod = await import(`/src/art/${names[i]}.ts`);
    const make = Object.values(mod).find((f) => typeof f === 'function' && /^make\w+Avatar$/.test(f.name));
    const x = 50 + (i % 5) * 82;
    const y = 62 + Math.floor(i / 5) * 112;
    twice((dx) => make(s, 1.6).setPosition(x + dx, y).setDepth(1001));
    cells.push({ name: names[i], x: x - 41, y: y - 56, w: 82, h: 112 });
  }

  let cx = 6;
  for (const rad of [1, 1.5, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 60, 90, 120]) {
    const shown = Math.min(rad, 40);
    const w = Math.ceil(shown * 2 + 8);
    if (cx + w > 420) break;
    const x = cx + w / 2;
    cx += w;
    twice((dx) => {
      const gr = s.add.graphics().setDepth(1001).setPosition(x + dx, 290).setScale(shown / rad);
      gr.fillStyle(0xffd060, 0.6);
      gr.fillCircle(0, 0, rad);
      gr.lineStyle(Math.max(1, rad * 0.08), 0xffffff, 1);
      gr.strokeCircle(0, 0, rad * 0.8);
      gr.lineStyle(1.5, 0x60d0ff, 1);
      gr.beginPath();
      gr.arc(0, 0, rad * 0.5, 0.3, 2.1, false);
      gr.strokePath();
    });
    cells.push({ name: `circle r=${rad}`, x: Math.floor(x - w / 2), y: 245, w, h: 90 });
  }

  // Thick strokes on small circles, opaque and translucent, and a pie slice.
  cx = 10;
  for (const [rad, width] of [[4, 3], [5, 4], [6, 5], [8, 4], [10, 5], [12, 3], [12, 5]]) {
    const w = Math.ceil((rad + width) * 2 + 8);
    const x = cx + w / 2;
    cx += w;
    twice((dx) => {
      const gr = s.add.graphics().setDepth(1001).setPosition(x + dx, 370);
      gr.lineStyle(width, 0xffffff, 1);
      gr.strokeCircle(0, 0, rad);
      gr.lineStyle(width, 0xff6080, 0.5);
      gr.beginPath();
      gr.arc(0, 30, rad, Math.PI, Math.PI * 2.2, false);
      gr.strokePath();
      gr.fillStyle(0x80ffb0, 0.7);
      gr.beginPath();
      gr.moveTo(0, 62);
      gr.arc(0, 62, rad, -0.4, 2.2, false);
      gr.closePath();
      gr.fillPath();
    });
    cells.push({ name: `r=${rad}, stroke ${width}`, x: Math.floor(x - w / 2), y: 350, w, h: 100 });
  }

  // The known failure: a small circle enlarged six times.
  twice((dx) => {
    const gr = s.add.graphics().setDepth(1001).setPosition(375 + dx, 420).setScale(6);
    gr.lineStyle(0.5, 0xffffff, 1);
    gr.strokeCircle(0, 0, 6);
    gr.fillStyle(0xff80a0, 0.5);
    gr.fillCircle(0, 0, 4);
  });
  cells.push({ name: 'r=6 enlarged 6x (fails)', x: 335, y: 380, w: 80, h: 80 });

  s.tweens.pauseAll();
  for (let i = 0; i < 4; i++) g.loop.step(T);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  const W = g.canvas.width;
  const H = g.canvas.height;
  const px = new Uint8Array(W * H * 4);
  gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
  const at = (x, y) => ((H - 1 - y) * W + x) * 4;
  const out = [];
  for (const c of cells) {
    let n = 0, strong = 0, max = 0, drawn = 0;
    for (let y = c.y * SCALE; y < (c.y + c.h) * SCALE; y++) {
      for (let x = c.x * SCALE; x < (c.x + c.w) * SCALE; x++) {
        const a = at(x, y);
        const b = at(x + DX * SCALE, y);
        const d = Math.max(Math.abs(px[a] - px[b]), Math.abs(px[a + 1] - px[b + 1]), Math.abs(px[a + 2] - px[b + 2]));
        if (px[a] !== 0x20 || px[a + 1] !== 0x20 || px[a + 2] !== 0x3a) drawn++;
        if (d) n++;
        if (d > 24) strong++;
        if (d > max) max = d;
      }
    }
    out.push(`${c.name.padEnd(24)} ${String(n).padStart(6)} of ${String(drawn).padStart(6)} drawn pixels differ (${((100 * n) / Math.max(1, drawn)).toFixed(2)}%), ${String(strong).padStart(5)} by more than 24 levels, largest ${max}`);
  }
  return out;
}, SCALE);
await sleep(200);
if (process.argv[2]) await page.screenshot({ path: process.argv[2] });
console.log(lines.join('\n'));
if (errors.length) console.log('page errors:', errors.slice(0, 3));
await browser.close();
