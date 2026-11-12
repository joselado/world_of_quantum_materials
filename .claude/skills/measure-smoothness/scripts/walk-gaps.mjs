// How smooth a scene is: the gaps between the frames the browser shows,
// measured while walking (an overworld id) or standing (anything else), at
// this machine's speed or with its CPU slowed.
//
//   node walk-gaps.mjs ow1 ow10goal bt6r
//
//   THROTTLE=6     slow the page's CPU six times (Chrome's own throttling;
//                  the GPU is not slowed)
//   QUERY=scale=1  appended to the URL: `scale=1` pins the display scale,
//                  `vectors=phaser` turns the vector layers off
//   SECS=10        seconds measured per scene
//   OBJECTS=1      also time every object's own render call and list the
//                  costliest: how an object that is tessellated again on
//                  every frame is found. OBJECTS=leaves leaves containers
//                  out; ROWS=12 lists more of them
//   VIEW=1920x1080 the window
//
// A gap is what a player sees; a "busy stretch" in a CPU profile is not one
// (at a slowdown every frame runs into the next, and the profile shows one
// long stretch where the screen shows steady frames).
import { openGame, startScene, sleep } from './common.mjs';

const scenes = process.argv.slice(2);
if (!scenes.length) {
  console.error('usage: node walk-gaps.mjs <scene id>...   (title, hub, ow<N>, ow<N>mid, ow<N>goal, ow<N>panel, bt<N>, bt<N>r)');
  process.exit(2);
}
const [width, height] = (process.env.VIEW || '1920x1080').split('x').map(Number);
const SECS = Number(process.env.SECS || 10);
const THROTTLE = Number(process.env.THROTTLE || 1);
const { browser, page, errors, renderer } = await openGame({ width, height, query: process.env.QUERY || '', throttle: THROTTLE });
console.log(`renderer ${renderer.type} on ${renderer.gpu}, drawing buffer ${renderer.buffer}, CPU x${THROTTLE}${process.env.QUERY ? ', ' + process.env.QUERY : ''}`);
if (/swiftshader|llvmpipe|software/i.test(renderer.gpu) || renderer.type !== 'webgl') console.log('WARNING: this is not a real GPU; the numbers below are not what a player sees.');

for (const id of scenes) {
  await startScene(page, id);
  // At a slowdown a scene takes that much longer to finish building.
  await sleep(1000 * THROTTLE);
  const walking = /^ow\d+$/.test(id);
  await page.evaluate((objects) => {
    window.__gaps = [];
    window.__cost = {};
    window.__frames0 = window.__game.loop.frame;
    window.__run = true;
    let last = performance.now();
    const tick = (now) => {
      window.__gaps.push(now - last);
      last = now;
      if (window.__run) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    if (!objects) return;
    // Every object on the display list gets its own render call timed, and
    // the list is walked again twice a second for the ones made since.
    const key = (o) => `${o.type}${o.constructor.name !== o.type ? ' (' + o.constructor.name + ')' : ''}${o.commandBuffer ? ' cmds=' + o.commandBuffer.length : ''}${o.list ? ' children=' + o.list.length + ' (inclusive)' : ''} depth=${o.depth} in ${o.parentContainer ? 'a container at depth ' + o.parentContainer.depth : 'the scene'}`;
    const patch = (o) => {
      if (o.list) o.list.forEach(patch);
      if (o.__timed || typeof o.renderWebGL !== 'function') return;
      o.__timed = true;
      const render = o.renderWebGL;
      o.renderWebGL = function (...args) {
        const t0 = performance.now();
        render.apply(this, args);
        const k = key(this);
        const e = (window.__cost[k] = window.__cost[k] || [0, 0]);
        e[0] += performance.now() - t0;
        e[1] += 1;
      };
    };
    const sweep = () => {
      for (const s of window.__game.scene.getScenes(true)) s.children.list.forEach(patch);
      if (window.__run) setTimeout(sweep, 500);
    };
    sweep();
  }, !!process.env.OBJECTS);
  if (walking) await page.keyboard.down('ArrowUp');
  await sleep(SECS * 1000);
  if (walking) await page.keyboard.up('ArrowUp');
  const r = await page.evaluate(() => {
    window.__run = false;
    return { gaps: window.__gaps.slice(2), frames: window.__game.loop.frame - window.__frames0, cost: window.__cost };
  });
  const g = r.gaps.slice().sort((a, b) => a - b);
  const q = (p) => g[Math.min(g.length - 1, Math.floor(g.length * p))].toFixed(0);
  const over = (ms) => g.filter((x) => x > ms).length;
  console.log(
    `${id.padEnd(9)} ${walking ? 'walking ' : 'standing'} ${(1000 * g.length / g.reduce((a, b) => a + b, 0)).toFixed(1)} fps; gaps ms: median ${q(0.5)}, p95 ${q(0.95)}, p99 ${q(0.99)}, max ${g[g.length - 1].toFixed(0)}; over 20 ms: ${over(20)}, over 34: ${over(34)}, over 50: ${over(50)} of ${g.length}`
  );
  if (process.env.OBJECTS) {
    // OBJECTS=leaves leaves the containers out, whose time is their children's.
    const rows = Object.entries(r.cost).filter(([k]) => process.env.OBJECTS !== 'leaves' || !k.includes('(inclusive)')).map(([k, v]) => [k, v[0] / r.frames, v[1]]).sort((a, b) => b[1] - a[1]);
    console.log(`            every timed render call together: ${Object.entries(r.cost).filter(([k]) => !k.includes('(inclusive)')).reduce((s, [, v]) => s + v[0], 0) / r.frames > 0 ? (Object.entries(r.cost).filter(([k]) => !k.includes('(inclusive)')).reduce((s, [, v]) => s + v[0], 0) / r.frames).toFixed(2) : '0'} ms a frame`);
    for (const [k, ms, n] of rows.slice(0, Number(process.env.ROWS || 8))) console.log(`            ${ms.toFixed(2)} ms a frame, ${n} renders: ${k}`);
  }
}
if (errors.length) console.log('page errors:', errors.slice(0, 4));
await browser.close();
