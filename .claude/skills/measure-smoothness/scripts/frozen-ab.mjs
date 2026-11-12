// The vector layers against Phaser's own drawing, on one frozen frame per
// scene, pixel by pixel.
//
//   node frozen-ab.mjs title hub ow1 ow2mid ow10goal ow1panel bt1 bt6r
//
// A scene is frozen (tweens and scene clock paused, the loop asleep and
// stepped by hand at one instant), drawn with the tessellation cache and the
// per-frame layers on, and read back; then the cache is turned off, every
// FastGraphics the scene holds is replaced by a plain Graphics, and the same
// instant is drawn and read again. A third frame with one object moved by a
// pixel is the control: a comparison that cannot see that proves nothing.
//
//   SCALE=2   the display scale the frames are drawn at (1 to 3)
//   ALLOW=2   differing pixels a scene may have and still pass: the cache
//             keeps an object's vertices as 32-bit floats before its
//             transform, so an edge through a pixel's centre can fall on the
//             other side, one pixel in an occasional frame of a moving object
import { openGame, startScene, sleep } from './common.mjs';

const scenes = process.argv.slice(2);
if (!scenes.length) {
  console.error('usage: node frozen-ab.mjs <scene id>...   (title, hub, ow<N>, ow<N>mid, ow<N>goal, ow<N>panel, bt<N>, bt<N>r)');
  process.exit(2);
}
const SCALE = Number(process.env.SCALE || 2);
const ALLOW = Number(process.env.ALLOW || 2);
const { browser, page, errors, renderer } = await openGame({ width: 854 * SCALE, height: 480 * SCALE, query: `scale=${SCALE}` });
console.log(`renderer ${renderer.type} on ${renderer.gpu}, drawing buffer ${renderer.buffer}`);
let failed = 0;
for (const id of scenes) {
  await startScene(page, id);
  const r = await page.evaluate(async () => {
    const g = window.__game;
    const gl = g.renderer.gl;
    const scenesNow = g.scene.getScenes(true);
    for (const sc of scenesNow) {
      sc.tweens.pauseAll();
      sc.time.paused = true;
    }
    g.loop.sleep();
    const T = g.loop.now + 16;
    const frame = (steps) => {
      for (let i = 0; i < steps; i++) g.loop.step(T);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      const px = new Uint8Array(g.canvas.width * g.canvas.height * 4);
      gl.readPixels(0, 0, g.canvas.width, g.canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, px);
      return px;
    };
    const diff = (a, b) => {
      let n = 0, max = 0;
      for (let i = 0; i < a.length; i += 4) {
        const d = Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2]));
        if (d) n++;
        if (d > max) max = d;
      }
      return { n, max };
    };
    // The cache takes eight objects a frame, on the second frame it sees
    // each unchanged: forty frames at one instant settle any scene.
    const on = frame(40);
    window.__vectorCache(false);
    let layers = 0;
    for (const sc of scenesNow) {
      for (const field of Object.keys(sc)) {
        const old = sc[field];
        if (!old || !old.constructor || old.constructor.name !== 'FastGraphics') continue;
        const plain = sc.add.graphics().setDepth(old.depth).setVisible(old.visible);
        sc.children.moveTo(plain, sc.children.getIndex(old));
        if (old.mask) plain.setMask(old.mask);
        old.setVisible(false);
        sc[field] = plain;
        layers++;
      }
    }
    const off = frame(2);
    // The control: the first visible vector object, one pixel to the right.
    let moved = null;
    const find = (o) => {
      if (moved) return;
      if (o.list) return o.list.forEach(find);
      if (o.visible && o.alpha > 0.5 && (o.type === 'Graphics' || o.type === 'Arc' || o.type === 'Polygon') && o.constructor.name !== 'FastGraphics' && (o.commandBuffer ? o.commandBuffer.length > 4 : true)) moved = o;
    };
    for (const sc of scenesNow) sc.children.list.forEach(find);
    let control = null;
    if (moved) {
      moved.x += 1;
      control = diff(off, frame(1)).n;
      moved.x -= 1;
    }
    return { ...diff(on, off), pixels: on.length / 4, layers, control };
  });
  const ok = r.n <= ALLOW && r.control !== 0;
  if (!ok) failed++;
  console.log(
    `${ok ? 'same  ' : 'DIFFER'} ${id.padEnd(9)} ${r.n} of ${r.pixels} pixels differ (largest by ${r.max} levels); per-frame layers swapped: ${r.layers}; control: ${r.control === null ? 'no object to move' : r.control + ' pixels changed'}`
  );
  await sleep(100);
}
if (errors.length) console.log('page errors:', errors.slice(0, 4));
await browser.close();
process.exit(failed ? 1 : 0);
