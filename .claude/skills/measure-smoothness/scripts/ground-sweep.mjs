// Looks for ground the terrain does not cover, and for ground that pops,
// while the camera moves forward through a world in small steps.
//
// The loop is asleep and stepped by hand at one pinned instant, with the same
// random rolls before every frame, so two runs of one scene list draw the
// same frames. Only the two ground layers stay on the camera. Each frame is
// drawn twice, over a magenta and over a green background: a pixel that
// differs between the two is one the ground does not cover, whatever its
// colour and however much haze lies over it. A pop is a frame whose change
// from the frame before is far above the sweep's median. The pop count is
// meant for the default step: at a coarse one a bright line near the bottom
// edge moves many pixels a frame and is counted (world 4's band channels at
// STEP=0.1).
//
//   node ground-sweep.mjs ow1 ow3 ow3mid ow3goal ...
//   STEP=0.02 TILES=3     the sweep: tiles a frame, and how far it goes
//   CAMX=0 CAMY=40        start at this column or row instead (walls are
//                         ignored, and CAMX=0 or the last column shows the
//                         margin columns past the grid's edge)
//   SAVE=dir              keep every frame and its uncovered pixels there
//   CMP=dir               compare every frame with the one saved there: how
//                         many pixels differ, and how many of those the saved
//                         frame had covered (a fix for uncovered ground should
//                         change no others), with the largest change
//   SHEET=dir FRAMES=a-b  save those frames stacked in one PNG, to look at
//   VERBOSE=1             one line a frame
//
// Exit 1 when a frame has uncovered ground, 2 when the control fails. The
// control scrolls the camera by eight pixels in each scene and requires the
// test to see the strip of background this leaves at the bottom. What stands
// behind the player (a tree, a column) hangs into that strip, so half of it
// is what the control asks for.
//
// The map of a scene depends on the scenes started before it, so a
// comparison of two builds needs the same scene list in the same order.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { openGame, startScene } from './common.mjs';

const scenes = process.argv.slice(2);
if (!scenes.length || scenes.some((id) => !/^ow\d+(mid|goal)?$/.test(id))) {
  console.error('usage: node ground-sweep.mjs ow<N> ow<N>mid ow<N>goal ...');
  process.exit(2);
}
const STEP = Number(process.env.STEP || 0.02);
const TILES = Number(process.env.TILES || 3);
const at = (v) => (v === undefined ? null : Number(v));
const CAMX = at(process.env.CAMX);
const CAMY = at(process.env.CAMY);
const { SAVE, CMP, SHEET } = process.env;
const FRAMES = (process.env.FRAMES || '0-9999').split('-').map(Number);
const VERBOSE = !!process.env.VERBOSE;
const CONTROL_PX = 8;
for (const d of [SAVE, SHEET]) if (d) fs.mkdirSync(d, { recursive: true });

const { browser, page, errors, renderer } = await openGame({ width: 854, height: 480, query: 'scale=1' });
console.log(`renderer ${renderer.type} on ${renderer.gpu}, buffer ${renderer.buffer}`);
if (renderer.type !== 'webgl') {
  console.error('The frames are read from the WebGL buffer, and this is the Canvas renderer.');
  await browser.close();
  process.exit(2);
}

// Draws the frame at camera row `camY` and returns what it shows.
const drawFrame = (camY, tileY, scroll, want) =>
  page.evaluate(
    ({ camY, tileY, scroll, want }) => {
      const g = window.__game;
      const gl = g.renderer.gl;
      const s = g.scene.getScenes(true)[0];
      const st = window.__sweep;
      const W = g.canvas.width;
      const H = g.canvas.height;
      const cam = s.cameras.main;
      const shot = (background) => {
        cam.setBackgroundColor(background);
        cam.scrollY = scroll;
        s.camPos.x = st.x0;
        s.camPos.y = camY;
        // As in a real step, the player's tile is the one being stepped onto.
        s.playerTile = { x: Math.round(st.x0), y: tileY };
        s.stepTarget = null;
        s.moving = false;
        // The same clock and the same rolls for every frame of every run. The
        // page's own generator is put back, so that the next scene's map does
        // not depend on how many frames this sweep drew.
        const random = Math.random;
        for (let k = 0; k < 2; k++) {
          let seed = 777;
          Math.random = () => {
            seed = (seed * 1664525 + 1013904223) >>> 0;
            return seed / 4294967296;
          };
          g.loop.step(st.T);
        }
        Math.random = random;
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        const px = new Uint8Array(W * H * 4);
        gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
        return px;
      };
      const px = shot('#ff00ff');
      const green = shot('#00ff00');
      cam.scrollY = 0;
      // GL rows count from the bottom; the mask and the box count from the top.
      const mask = new Uint8Array(W * H);
      const box = [W, -1, H, -1];
      let uncovered = 0, strength = 0, changed = 0;
      const prev = scroll ? null : st.prev;
      for (let q = 0; q < W * H; q++) {
        const p = q * 4;
        const sx = q % W;
        const sy = H - 1 - ((q / W) | 0);
        const d = Math.max(Math.abs(px[p] - green[p]), Math.abs(px[p + 1] - green[p + 1]), Math.abs(px[p + 2] - green[p + 2]));
        if (d > 0 && sy >= st.top) {
          uncovered++;
          mask[sy * W + sx] = 1;
          strength = Math.max(strength, d);
          box[0] = Math.min(box[0], sx);
          box[1] = Math.max(box[1], sx);
          box[2] = Math.min(box[2], sy);
          box[3] = Math.max(box[3], sy);
        }
        if (prev && Math.max(Math.abs(px[p] - prev[p]), Math.abs(px[p + 1] - prev[p + 1]), Math.abs(px[p + 2] - prev[p + 2])) > 24) changed++;
      }
      if (!scroll) st.prev = px;
      const b64 = (a) => {
        let bin = '';
        for (let k = 0; k < a.length; k += 32768) bin += String.fromCharCode.apply(null, a.subarray(k, k + 32768));
        return btoa(bin);
      };
      return { uncovered, strength, changed, box, px: want ? b64(px) : null, mask: want ? b64(mask) : null };
    },
    { camY, tileY, scroll, want }
  );

let withHoles = 0;
let controlFailed = 0;
let outsideTotal = 0;
let levelsMax = 0;
for (const [k, id] of scenes.entries()) {
  await startScene(page, id);
  const setup = await page.evaluate(
    async ({ CAMX, CAMY }) => {
      const g = window.__game;
      const s = g.scene.getScenes(true)[0];
      s.tweens.pauseAll();
      s.time.paused = true;
      g.loop.sleep();
      // update() shows sprites and prompts again on every frame, so they are
      // taken off the camera rather than hidden.
      const keep = new Set([s.worldGfx, s.frontGfx]);
      s.cameras.main.ignore(s.children.list.filter((o) => !keep.has(o)));
      if (CAMX !== null) s.camPos.x = CAMX;
      if (CAMY !== null) s.camPos.y = CAMY;
      // The ground starts where the draw distance ends. Above that row the
      // layer holds the horizon's haze, which is translucent on purpose.
      const proj = await import('/src/scenes/overworld/projection.ts');
      const top = Math.ceil(proj.projectTile(0, proj.DRAW_DISTANCE_TILES).y);
      window.__sweep = { x0: s.camPos.x, y0: s.camPos.y, T: 5000000, prev: null, top };
      return { W: g.canvas.width, H: g.canvas.height, x0: s.camPos.x, y0: s.camPos.y, top };
    },
    { CAMX, CAMY }
  );
  const { W, H } = setup;

  const control = await drawFrame(setup.y0, setup.y0, CONTROL_PX, false);
  const controlOk = control.uncovered >= (CONTROL_PX * W) / 2;
  if (!controlOk) controlFailed++;

  const n = Math.round(TILES / STEP);
  const rows = [];
  for (let i = 0; i <= n; i++) {
    const inSheet = !!SHEET && i >= FRAMES[0] && i <= FRAMES[1];
    const camY = setup.y0 - i * STEP;
    const f = await drawFrame(camY, setup.y0 - Math.ceil(i * STEP - 1e-9), 0, !!(SAVE || CMP || inSheet));
    const row = { i, camY, uncovered: f.uncovered, strength: f.strength, changed: f.changed, box: f.box };
    if (f.px) {
      const px = Buffer.from(f.px, 'base64');
      const mask = Buffer.from(f.mask, 'base64');
      // A scene named twice is two different maps, so the place in the list
      // is part of the name.
      const name = `${k}_${id}_${CAMX ?? 'c'}_${CAMY ?? 'c'}_${i}`;
      if (SAVE) {
        fs.writeFileSync(path.join(SAVE, `${name}.px.gz`), zlib.gzipSync(px, { level: 1 }));
        fs.writeFileSync(path.join(SAVE, `${name}.mask.gz`), zlib.gzipSync(mask, { level: 1 }));
      }
      if (CMP) {
        const ref = zlib.gunzipSync(fs.readFileSync(path.join(CMP, `${name}.px.gz`)));
        const refMask = zlib.gunzipSync(fs.readFileSync(path.join(CMP, `${name}.mask.gz`)));
        let differ = 0, outside = 0, levels = 0;
        const at = [];
        for (let q = 0; q < W * H; q++) {
          const p = q * 4;
          if (px[p] === ref[p] && px[p + 1] === ref[p + 1] && px[p + 2] === ref[p + 2]) continue;
          differ++;
          // The saved mask counts rows from the top, the pixels from the bottom.
          const sx = q % W;
          const sy = H - 1 - ((q / W) | 0);
          if (refMask[sy * W + sx]) continue;
          outside++;
          levels = Math.max(levels, Math.abs(px[p] - ref[p]), Math.abs(px[p + 1] - ref[p + 1]), Math.abs(px[p + 2] - ref[p + 2]));
          if (at.length < 6) at.push(`${sx},${sy}`);
        }
        row.differ = differ;
        row.outside = outside;
        row.levels = levels;
        row.at = at;
      }
      if (inSheet) row.px = f.px;
    }
    rows.push(row);
  }

  const holes = rows.filter((f) => f.uncovered > 0);
  const med = rows.map((f) => f.changed).sort((a, b) => a - b)[rows.length >> 1];
  const pops = rows.filter((f) => f.changed > 3 * med + 500);
  if (holes.length) withHoles++;
  let line = `${id.padEnd(8)} from ${setup.x0},${setup.y0}: ${rows.length} frames, ${holes.length} with uncovered ground (largest ${Math.max(0, ...holes.map((f) => f.uncovered))} px), pops ${pops.length}`;
  if (pops.length) line += ` at ${pops.map((f) => `${f.camY.toFixed(2)}(${f.changed})`).join(' ')}`;
  line += controlOk ? '' : `   CONTROL FAILED: ${control.uncovered} px seen of the ${CONTROL_PX * W} left bare`;
  if (CMP) {
    const d = rows.filter((f) => f.differ > 0);
    const outside = rows.reduce((a, f) => a + (f.outside || 0), 0);
    outsideTotal += outside;
    const levels = Math.max(0, ...rows.map((f) => f.levels || 0));
    levelsMax = Math.max(levelsMax, levels);
    line += `\n         against ${CMP}: ${d.length} frames differ, ${d.filter((f) => f.outside > 0).length} of them where the saved frame was covered (${outside} px, by ${levels} of 255 at most)`;
  }
  console.log(line);
  if (VERBOSE) {
    for (const f of rows) {
      let l = `   ${f.camY.toFixed(2)} uncovered ${f.uncovered}`;
      if (f.uncovered) l += ` x ${f.box[0]}-${f.box[1]} y ${f.box[2]}-${f.box[3]} strength ${f.strength}`;
      l += ` changed ${f.changed}`;
      if (CMP) l += ` differ ${f.differ}, where the saved frame was covered ${f.outside}${f.outside ? ` by ${f.levels} at ${f.at.join(' ')}` : ''}`;
      console.log(l);
    }
  }

  if (SHEET) {
    const frames = rows.filter((f) => f.px).map((f) => f.px);
    const sheet = await page.evaluate(
      ({ frames, W, H }) => {
        const c = document.createElement('canvas');
        c.width = W;
        c.height = (H + 2) * frames.length;
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#00ff00';
        ctx.fillRect(0, 0, c.width, c.height);
        frames.forEach((b64, k) => {
          const bin = atob(b64);
          const img = ctx.createImageData(W, H);
          for (let row = 0; row < H; row++) {
            const src = (H - 1 - row) * W * 4;
            for (let q = 0; q < W * 4; q++) img.data[row * W * 4 + q] = (q & 3) === 3 ? 255 : bin.charCodeAt(src + q);
          }
          ctx.putImageData(img, 0, k * (H + 2));
        });
        return c.toDataURL('image/png');
      },
      { frames, W, H }
    );
    fs.writeFileSync(path.join(SHEET, `${id}.png`), Buffer.from(sheet.split(',')[1], 'base64'));
  }
}
if (errors.length) console.log('page errors:', errors.slice(0, 4));
await browser.close();
if (CMP) console.log(`pixels that differ where the saved frames were covered: ${outsideTotal}, by ${levelsMax} of 255 at most`);
process.exit(controlFailed ? 2 : withHoles ? 1 : 0);
