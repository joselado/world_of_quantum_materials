// Greyscale legibility check: do the crystals and the HP bars still read
// against whatever is drawn behind them, in all ten worlds?
//
// The squint test, made mechanical. It drives the real game in headless
// Chrome to a rival battle in each world, screenshots the arena, drains the
// colour, shrinks the frame, and measures how much value each gameplay
// element carries against the backdrop it stands on -- then compares that
// against how much contrast the backdrop manages on its own at the same
// scale. A colour check waves through the failure that matters (an element
// surviving on hue alone and vanishing in value); greyscale is what catches
// it.
//
// It measures rendered pixels only. It imports no biome table, no palette,
// no layout constant -- every region it measures is read off the live scene
// objects, and every value off the screenshot -- so it cannot restate the
// intent it exists to check.
//
// Usage (from game/): npm run greyscale-check
//   QM_GREY_WORLDS=1,5,9   measure a subset instead of all ten
//   QM_GREY_JSON=path.json also write the raw table, so two runs can be diffed
//   QM_GREY_SEED=12345     PRNG seed pinned into the page (default 20250814)
// CHROME_BIN auto-detects Puppeteer's cached Chrome-for-Testing binary if
// unset, same as component-check.mjs. Picks its own port so it never
// disturbs a dev server another session is already running.
//
// ---------------------------------------------------------------------
// The metric
// ---------------------------------------------------------------------
// Three frames are captured per arena, from the same live battle:
//   A  the full frame, as a player sees it
//   B  backdrop only (every object from the opponent crystal onward hidden)
//   C  the same frame with only the two crystals hidden
// A-vs-C gives each crystal's exact painted footprint without knowing
// anything about how the art is drawn; B gives the value of the backdrop
// *behind and around* every element, uncontaminated by other UI.
//
// Each frame becomes a luminance map (Rec.709 luma on sRGB bytes) and is
// box-downscaled 8x (854x480 -> 107x60 cells) -- the squint. For an element
// covering cell set E:
//
//   salience(E) = mean over c in E of | L_A(c) - L_B(c) |
//
// i.e. how much the element changes the value of the frame where it is
// drawn, in greyscale units (0-255). Measured per cell against the exact
// backdrop it covers, so nothing the backdrop was already doing at that spot
// is credited to the element; and as a mean absolute deviation, so an
// element that is half bright and half dark still scores as the loud thing
// it is.
//
// That number alone would be a threshold with no reference, so the backdrop
// is asked what it manages unaided at the same scale. Writing L_B*(c) for
// the mean of frame B over the 7x7 cell neighbourhood of c -- the local
// value of the backdrop there -- the element's own cell shape is slid across
// every position of frame B and scored as mean |L_B(c) - L_B*(c)|: how far
// a patch of backdrop stands off its own surroundings. Ridgelines, haze
// bands and decorative background crystals score what they are worth, while
// a smooth gradient scores near zero, which is right -- a gradient is not a
// thing competing to be found. An element passes when it clears both:
//
//   salience >= FLOOR                     absolute value separation
//   salience >= RATIO * p95(backdrop)     louder than the backdrop's busiest
//
// FLOOR guards the case of a backdrop so flat that anything beats it;
// RATIO guards the case of a backdrop so busy that everything competes.
// Both numbers, and the margin against each, are printed per element per
// world -- a threshold nobody can see the margin on is a threshold nobody
// can tune.
//
// ---------------------------------------------------------------------
// The controls
// ---------------------------------------------------------------------
// A check that passes everything proves nothing, so every run also measures
// three deliberately perturbed versions of each arena it just passed, in the
// same live battle, and grades itself on all three:
//   flat   the backdrop is flooded with a flat grey at the crystals' own
//          measured mean luminance. NEGATIVE control: this must still PASS.
//          Matching the mean does not hide a high-contrast object -- a
//          crystal on a flat field is easier to find, not harder -- so a
//          check that fails here is reacting to the frame having changed
//          rather than to legibility.
//   crowd  the backdrop is given gameplay's own value range and gameplay's
//          own scale of local contrast. POSITIVE control: every element must
//          FAIL. This is over-decoration itself -- the handsome backdrop that
//          competes -- and is what the relative arm of the gate exists for.
//   fade   the whole gameplay layer drops to alpha 0.05. POSITIVE control:
//          every element must FAIL. The other end -- elements that have lost
//          their own contrast -- and what the absolute arm exists for.
// A positive control that slips through means the instrument is blind, which
// is a worse result than a legibility failure and is reported as such.

import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { spawn, execSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GAME_DIR = process.env.GAME_DIR || path.resolve(__dirname, '..');
const PORT = process.env.QM_GREY_PORT || '5191';
const URL = process.env.QM_URL || `http://localhost:${PORT}/`;
const SEED = Number(process.env.QM_GREY_SEED || 20250814);
const JSON_OUT = process.env.QM_GREY_JSON || '';
const WORLDS = (process.env.QM_GREY_WORLDS || '1,2,3,4,5,6,7,8,9,10')
  .split(',')
  .map((s) => Number(s.trim()))
  .filter((n) => n >= 1 && n <= 10);

const SHOT_DIR = path.join(GAME_DIR, '.check-artifacts', 'greyscale');
fs.mkdirSync(SHOT_DIR, { recursive: true });

// ---- the tunables, all in one place ----
const DOWNSCALE = 8; // 854x480 -> 107x60. The squint.
const BAND = 3; // cell radius of the neighbourhood that counts as "around here"
const MIN_COVERAGE = 0.5; // a cell belongs to an element if it is half covered
const FLOOR = 20; // greyscale units (0-255) of value separation
const RATIO = 1.6; // multiples of the backdrop's own p95 contrast
const HP_FRACTION = 0.6; // bars are measured part-drained, the mid-fight case
const FADE_ALPHA = 0.05; // how far the faded-gameplay control drops the layer
const SETTLE_MS = 1200; // after the battle scene starts, before freezing it

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// =====================================================================
// PNG decoding -- Chrome's screenshots, without a dependency
// =====================================================================
function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
  let pos = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const body = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      bitDepth = body[8];
      colorType = body[9];
      interlace = body[12];
    } else if (type === 'IDAT') {
      idat.push(body);
    } else if (type === 'IEND') {
      break;
    }
    pos += 12 + len;
  }
  if (bitDepth !== 8) throw new Error(`unsupported PNG bit depth ${bitDepth}`);
  if (interlace !== 0) throw new Error('interlaced PNG unsupported');
  const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[colorType];
  if (!channels) throw new Error(`unsupported PNG colour type ${colorType}`);

  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const out = Buffer.alloc(height * stride);
  let rp = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[rp++];
    const line = raw.subarray(rp, rp + stride);
    rp += stride;
    const o = y * stride;
    const up = o - stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? out[o + x - channels] : 0;
      const b = y > 0 ? out[up + x] : 0;
      const c = x >= channels && y > 0 ? out[up + x - channels] : 0;
      let v = line[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      } else if (filter !== 0) throw new Error(`unsupported PNG filter ${filter}`);
      out[o + x] = v & 0xff;
    }
  }
  return { width, height, channels, data: out };
}

// Rec.709 luma on the sRGB bytes -- apparent lightness, which is what a
// squint is judging, rather than linear-light intensity.
function luminance(img) {
  const { width, height, channels, data } = img;
  const lum = new Float32Array(width * height);
  for (let i = 0, p = 0; i < lum.length; i++, p += channels) {
    lum[i] =
      channels <= 2 ? data[p] : 0.2126 * data[p] + 0.7152 * data[p + 1] + 0.0722 * data[p + 2];
  }
  return lum;
}

// Box-average downscale: every output cell is the plain mean of the pixels
// under it, so a bright speck is diluted exactly the way a squint dilutes it.
function downscale(lum, width, height, f) {
  const cw = Math.ceil(width / f);
  const ch = Math.ceil(height / f);
  const cells = new Float32Array(cw * ch);
  for (let cy = 0; cy < ch; cy++) {
    for (let cx = 0; cx < cw; cx++) {
      let sum = 0;
      let n = 0;
      for (let y = cy * f; y < Math.min((cy + 1) * f, height); y++) {
        for (let x = cx * f; x < Math.min((cx + 1) * f, width); x++) {
          sum += lum[y * width + x];
          n++;
        }
      }
      cells[cy * cw + cx] = sum / n;
    }
  }
  return { cw, ch, cells };
}

// =====================================================================
// Regions
// =====================================================================
// Painted footprint of whatever differs between two full-res frames inside
// a box -- how each crystal's exact silhouette is recovered from A vs C
// without knowing anything about how the art is drawn.
function diffMask(lumA, lumB, width, height, box, threshold = 8) {
  const mask = new Uint8Array(width * height);
  let count = 0;
  const x0 = Math.max(0, Math.floor(box.x));
  const y0 = Math.max(0, Math.floor(box.y));
  const x1 = Math.min(width, Math.ceil(box.x + box.w));
  const y1 = Math.min(height, Math.ceil(box.y + box.h));
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = y * width + x;
      if (Math.abs(lumA[i] - lumB[i]) > threshold) {
        mask[i] = 1;
        count++;
      }
    }
  }
  return { mask, count };
}

function rectMask(rect, width, height) {
  const mask = new Uint8Array(width * height);
  let count = 0;
  const x0 = Math.max(0, Math.floor(rect.x));
  const y0 = Math.max(0, Math.floor(rect.y));
  const x1 = Math.min(width, Math.ceil(rect.x + rect.w));
  const y1 = Math.min(height, Math.ceil(rect.y + rect.h));
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      mask[y * width + x] = 1;
      count++;
    }
  }
  return { mask, count };
}

// A full-res mask becomes the set of reduced cells it actually occupies. If
// nothing reaches half coverage (a thin element, e.g. a 6px-tall HP bar
// landing across a cell boundary), the best-covered cells are taken instead,
// so a region is never empty.
function maskCells(mask, width, height, f, cw, ch) {
  const cover = new Float32Array(cw * ch);
  for (let y = 0; y < height; y++) {
    const cy = (y / f) | 0;
    for (let x = 0; x < width; x++) {
      if (mask[y * width + x]) cover[cy * cw + ((x / f) | 0)] += 1;
    }
  }
  const cellArea = f * f;
  let cells = [];
  for (let i = 0; i < cover.length; i++) if (cover[i] / cellArea >= MIN_COVERAGE) cells.push(i);
  if (!cells.length) {
    let best = 0;
    for (let i = 0; i < cover.length; i++) best = Math.max(best, cover[i]);
    if (best > 0) for (let i = 0; i < cover.length; i++) if (cover[i] >= best * 0.999) cells.push(i);
  }
  return cells;
}

// The element's shape as (dx, dy) offsets from its own bounding box --
// reusable at any position, which is how the same measurement gets slid
// across the backdrop as a distractor.
function shapeOf(cells, cw) {
  const xs = cells.map((i) => i % cw);
  const ys = cells.map((i) => (i / cw) | 0);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return {
    offsets: cells.map((i) => ({ dx: (i % cw) - minX, dy: ((i / cw) | 0) - minY })),
    w: Math.max(...xs) - minX + 1,
    h: Math.max(...ys) - minY + 1,
    minX,
    minY,
  };
}

// Box mean over a (2r+1)-cell neighbourhood, clamped at the edges: the
// value of "the place around here". Run over the backdrop-only frame, it is
// the local value of the backdrop at every cell -- which is what an element
// has to depart from to be found.
function localMean(cells, cw, ch, r) {
  const out = new Float32Array(cw * ch);
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      let sum = 0;
      let n = 0;
      for (let yy = Math.max(0, y - r); yy <= Math.min(ch - 1, y + r); yy++) {
        for (let xx = Math.max(0, x - r); xx <= Math.min(cw - 1, x + r); xx++) {
          sum += cells[yy * cw + xx];
          n++;
        }
      }
      out[y * cw + x] = sum / n;
    }
  }
  return out;
}

// salience = mean over the element's own cells of how much the element
// changes the value there: the frame with it, against the backdrop it
// covers. Per cell against the exact backdrop rather than against one
// number for the whole element, so nothing the backdrop was already doing
// at that spot -- a ridge edge, a gradient, a vignette corner -- is credited
// to the element. A boss silhouette straddling the horizon is scored on how
// far it stands off the sky and the ground it actually covers, not on the
// fact that sky and ground differ.
function salienceOf(cells, fg, backdrop) {
  let sum = 0;
  for (const c of cells) sum += Math.abs(fg[c] - backdrop[c]);
  return sum / cells.length;
}

// What this element's own shape scores when it is nothing but backdrop,
// everywhere it could sit: the same statistic run on the backdrop against
// its own local mean. A smooth gradient scores near zero; a ridge edge, a
// haze band, a decorative background crystal score what they are worth.
// This is the distribution the relative threshold is measured against.
function backdropDistribution(shape, bg, backdropLocal, cw, ch) {
  const hp = new Float32Array(cw * ch);
  for (let i = 0; i < hp.length; i++) hp[i] = Math.abs(bg[i] - backdropLocal[i]);
  const vals = [];
  for (let oy = 0; oy + shape.h <= ch; oy++) {
    for (let ox = 0; ox + shape.w <= cw; ox++) {
      let sum = 0;
      for (const o of shape.offsets) sum += hp[(oy + o.dy) * cw + ox + o.dx];
      vals.push(sum / shape.offsets.length);
    }
  }
  vals.sort((a, b) => a - b);
  const q = (p) => vals[Math.min(vals.length - 1, Math.floor(p * vals.length))];
  return { p50: q(0.5), p95: q(0.95), p99: q(0.99), max: vals[vals.length - 1], n: vals.length };
}

// =====================================================================
// One arena, measured
// =====================================================================
// Where the four gameplay elements actually are, worked out once from the
// unsabotaged frames so every later measurement of the same arena scores
// the same cells. `frames` are the three raw PNG buffers; `geom` is what the
// live scene reported about where its own objects are.
function deriveRegions(frames, geom) {
  const imgA = decodePng(frames.full);
  const imgB = decodePng(frames.backdrop);
  const imgC = decodePng(frames.noCrystals);
  const { width, height } = imgA;
  const lumA = luminance(imgA);
  const lumB = luminance(imgB);
  const lumC = luminance(imgC);
  const harnessErrors = [];

  // Crystal footprints, recovered from A vs C inside a generous box around
  // each anchor. If painted art reaches outside its box, the out-of-box
  // check below trips rather than the crystal being silently clipped.
  const boxes = {
    playerCrystal: crystalBox(geom.playerAnchor, width, height),
    opponentCrystal: crystalBox(geom.opponentAnchor, width, height),
  };
  const masks = {
    playerCrystal: diffMask(lumA, lumC, width, height, boxes.playerCrystal),
    opponentCrystal: diffMask(lumA, lumC, width, height, boxes.opponentCrystal),
    playerHpBar: rectMask(geom.playerHpBar, width, height),
    opponentHpBar: rectMask(geom.opponentHpBar, width, height),
  };

  // Structural assertion 1: hiding the crystals must change the frame ONLY
  // inside the two boxes. A stray difference outside means either the box is
  // too small for the art it has to contain, or hiding a crystal moved
  // something else -- either way the footprints below are wrong, and that is
  // a broken harness, not a legibility failure.
  let strayPixels = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (Math.abs(lumA[i] - lumC[i]) <= 8) continue;
      const inBox = Object.values(boxes).some(
        (b) => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h
      );
      if (!inBox) strayPixels++;
    }
  }
  if (strayPixels > 0) {
    harnessErrors.push(
      `hiding the crystals changed ${strayPixels} pixel(s) outside both crystal boxes -- widen crystalBox() or check what else the hide touched`
    );
  }

  for (const [name, m] of Object.entries(masks)) {
    if (!m.count) {
      harnessErrors.push(`${name}: empty footprint -- nothing painted where the scene said it was`);
      continue;
    }
    // Structural assertion 2: the backdrop-only frame must genuinely lack
    // this element. If A and B agree where the element sits, the "hide
    // everything from the crystals onward" rule stopped covering the whole
    // gameplay layer and the backdrop reference is contaminated.
    let diffSum = 0;
    let diffN = 0;
    for (let i = 0; i < m.mask.length; i++) {
      if (!m.mask[i]) continue;
      diffSum += Math.abs(lumA[i] - lumB[i]);
      diffN++;
    }
    if (diffSum / diffN < 2) {
      harnessErrors.push(
        `${name}: backdrop-only frame is identical (mean |A-B| = ${(diffSum / diffN).toFixed(
          2
        )}) where this element is drawn -- the gameplay-layer hide rule is broken`
      );
    }
  }
  return { masks, width, height, harnessErrors };
}

function measureArena(frames, regions) {
  const { masks, width, height } = regions;
  const lumA = luminance(decodePng(frames.full));
  const lumB = luminance(decodePng(frames.backdrop));
  const redA = downscale(lumA, width, height, DOWNSCALE);
  const redB = downscale(lumB, width, height, DOWNSCALE);
  const { cw, ch } = redA;

  const backdropLocal = localMean(redB.cells, cw, ch, BAND);
  const elements = {};
  for (const [name, m] of Object.entries(masks)) {
    if (!m.count) continue;
    const cells = maskCells(m.mask, width, height, DOWNSCALE, cw, ch);
    const shape = shapeOf(cells, cw);
    const sal = salienceOf(cells, redA.cells, redB.cells);
    const bg = backdropDistribution(shape, redB.cells, backdropLocal, cw, ch);
    const need = Math.max(FLOOR, RATIO * bg.p95);
    elements[name] = {
      salience: round2(sal),
      backdropP50: round2(bg.p50),
      backdropP95: round2(bg.p95),
      backdropMax: round2(bg.max),
      floorMargin: round2(sal / FLOOR),
      ratioMargin: round2(sal / (RATIO * bg.p95)),
      margin: round2(sal / need),
      need: round2(need),
      pass: sal >= need,
      cells: cells.length,
      pixels: m.count,
    };
  }

  // Value zoning, reported rather than gated: STYLE.md gives the darkest
  // darks and brightest brights to gameplay, so how close the backdrop's own
  // extremes come to gameplay's is the number that says whether an arena is
  // about to break that rule.
  const gameplayCells = new Set();
  for (const m of Object.values(masks)) {
    for (const c of maskCells(m.mask, width, height, DOWNSCALE, cw, ch)) gameplayCells.add(c);
  }
  let gMin = Infinity;
  let gMax = -Infinity;
  for (const c of gameplayCells) {
    gMin = Math.min(gMin, redA.cells[c]);
    gMax = Math.max(gMax, redA.cells[c]);
  }
  let bMin = Infinity;
  let bMax = -Infinity;
  for (let i = 0; i < redB.cells.length; i++) {
    bMin = Math.min(bMin, redB.cells[i]);
    bMax = Math.max(bMax, redB.cells[i]);
  }
  const zoning = {
    gameplayDarkest: round2(gMin),
    gameplayBrightest: round2(gMax),
    backdropDarkest: round2(bMin),
    backdropBrightest: round2(bMax),
    backdropOwnsDarkest: bMin < gMin,
    backdropOwnsBrightest: bMax > gMax,
  };

  return { elements, zoning, reduced: redA };
}

// Generous box around a crystal anchor: wide enough for the boss golem's
// silhouette (which reaches far past its nominal size), narrow enough that
// the two never meet. Verified per run by the stray-pixel assertion above
// rather than trusted.
function crystalBox(anchor, width, height) {
  const x = Math.max(0, anchor.x - 115);
  const y = Math.max(0, anchor.y - 135);
  return {
    x,
    y,
    w: Math.min(width, anchor.x + 115) - x,
    h: Math.min(height, anchor.y + 95) - y,
  };
}

const round2 = (v) => (v === null || v === undefined ? null : Math.round(v * 100) / 100);

// The reduced greyscale frame exactly as the metric saw it, written back out
// as a greyscale PNG. Worth opening when a number surprises you -- it is
// literally the squint -- and one glance at it also confirms the decoder
// above did its job, since a mis-decoded frame comes back as garbage.
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return ~c >>> 0;
}

function pngChunk(type, body) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(body.length);
  const typed = Buffer.concat([Buffer.from(type, 'ascii'), body]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typed));
  return Buffer.concat([len, typed, crc]);
}

function writeGreyPng(file, reduced) {
  const { cw, ch, cells } = reduced;
  const raw = Buffer.alloc(ch * (cw + 1));
  for (let y = 0; y < ch; y++) {
    raw[y * (cw + 1)] = 0; // no per-row filter
    for (let x = 0; x < cw; x++) {
      raw[y * (cw + 1) + 1 + x] = Math.max(0, Math.min(255, Math.round(cells[y * cw + x])));
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(cw, 0);
  ihdr.writeUInt32BE(ch, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 0; // greyscale
  fs.writeFileSync(
    file,
    Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      pngChunk('IHDR', ihdr),
      pngChunk('IDAT', zlib.deflateSync(raw)),
      pngChunk('IEND', Buffer.alloc(0)),
    ])
  );
}

// =====================================================================
// Harness plumbing (shape borrowed from component-check.mjs)
// =====================================================================
function detectChromeBin() {
  if (process.env.CHROME_BIN) return process.env.CHROME_BIN;
  const out = execSync(
    `find "$HOME/.cache/puppeteer/chrome" -maxdepth 2 -type d -iname 'linux-*' -exec find {} -maxdepth 2 -type f -iname chrome \\; 2>/dev/null | head -1`,
    { shell: '/bin/bash' }
  )
    .toString()
    .trim();
  if (out) return out;
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
    log(`Dev server already running on ${URL} -- reusing it.`);
    return { started: false, child: null };
  }
  log(`Starting "npm run dev -- --port ${PORT}" in ${GAME_DIR}...`);
  const child = spawn('npm', ['run', 'dev', '--', '--port', PORT, '--strictPort'], {
    cwd: GAME_DIR,
    stdio: 'ignore',
    detached: true,
  });
  child.unref();
  const start = Date.now();
  while (Date.now() - start < 40000) {
    if (await isServerUp()) {
      log('Dev server is up.');
      return { started: true, child };
    }
    await sleep(400);
  }
  throw new Error(`Dev server did not come up on ${URL} within 40s.`);
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
  const wallStart = Date.now();
  const logLines = [];
  const log = (msg) => {
    const line = `[${new Date().toISOString().slice(11, 19)}] ${msg}`;
    console.log(line);
    logLines.push(line);
  };

  const CHROME_BIN = detectChromeBin();
  const serverHandle = await ensureDevServer(log);

  const browser = await puppeteer.launch({
    executablePath: CHROME_BIN,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    headless: true,
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 854, height: 480 });

  const pageErrors = [];
  page.on('pageerror', (err) => pageErrors.push(String(err)));
  page.on('console', (msg) => {
    if (msg.type() === 'error' && !msg.text().startsWith('Failed to load resource:')) {
      pageErrors.push(msg.text());
    }
  });

  // ---- page-context helpers ----
  const getActiveScenes = () =>
    page.evaluate(() => window.__game.scene.getScenes(true).map((s) => s.scene.key));

  const jumpToScene = (key, data) =>
    page.evaluate(
      ({ key, data }) => {
        const g = window.__game;
        ['Title', 'Hub', 'Overworld', 'Battle'].forEach((k) => {
          if (g.scene.isActive(k) || g.scene.isSleeping(k)) g.scene.stop(k);
        });
        g.scene.start(key, data);
      },
      { key, data }
    );

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

  // Every source of per-run randomness the arena can see -- the map, the
  // World 9 rival roll -- pinned to the same stream before every jump, so
  // two runs measure the same ten arenas. (The ridgelines are already
  // seeded off the world number in the game itself.)
  const pinRandom = (seed) =>
    page.evaluate((seed) => {
      let a = seed >>> 0;
      Math.random = () => {
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }, seed);

  const capture = async () => Buffer.from(await page.screenshot({ type: 'png' }));

  // The gameplay layer is every display-list object from the opponent
  // crystal onward: the arena backdrop is drawn first and in full before
  // any combatant exists, so that index is the seam between "what is drawn
  // behind" and "what has to read against it". Both structural assertions
  // in measureArena() exist to catch this rule going stale.
  const setGameplayLayer = (prop, value) =>
    page.evaluate(
      ({ prop, value }) => {
        const s = window.__game.scene.getScene('Battle');
        const list = s.children.list;
        const start = list.indexOf(s['opponentCrystal']);
        if (start < 0) throw new Error('opponent crystal is not on the display list');
        for (let i = start; i < list.length; i++) list[i][prop](value);
        return list.length - start;
      },
      { prop, value }
    );

  const setCrystalsVisible = (v) =>
    page.evaluate((v) => {
      const s = window.__game.scene.getScene('Battle');
      s['playerCrystal'].setVisible(v);
      s['opponentCrystal'].setVisible(v);
    }, v);

  // Three frames of the same arena. A repaint beat after each visibility
  // change, because the screenshot is taken from whatever the compositor
  // last drew.
  async function captureFrames() {
    const full = await capture();
    await setGameplayLayer('setVisible', false);
    await sleep(140);
    const backdrop = await capture();
    await setGameplayLayer('setVisible', true);
    await setCrystalsVisible(false);
    await sleep(140);
    const noCrystals = await capture();
    await setCrystalsVisible(true);
    await sleep(140);
    return { full, backdrop, noCrystals };
  }

  // ---- reaching a rival battle ----
  const readOverworldDialogueActive = () =>
    page.evaluate(() => {
      const s = window.__game.scene.getScene('Overworld');
      if (!s || !window.__game.scene.isActive('Overworld')) return null;
      return !!s['dialogueActive'];
    });

  async function resolveOverworldDialogue(maxClicks = 15) {
    let active = await readOverworldDialogueActive();
    for (let i = 0; i < maxClicks && active; i++) {
      const r = await clickText(['Next ->', 'Onward', 'Got it', 'Farewell']);
      if (!r.clicked) {
        const alt = (r.available || []).filter((t) => t !== 'Let me pass' && t.trim().length > 0);
        if (!alt.length) return false;
        await clickText([alt[0]]);
      }
      await sleep(260);
      active = await readOverworldDialogueActive();
      if (active === null) return false;
    }
    return !active;
  }

  // The real gate route rather than a synthesised opponent: reach the goal,
  // face that world's own rival, so the opponent is the boss-sized sprite
  // this check exists to worry about, wearing the material the game itself
  // chose for that world.
  async function reachRivalBattle(world) {
    await page.evaluate(() => {
      window.__game.registry.reset();
      localStorage.clear();
    });
    await pinRandom(SEED + world);
    await jumpToScene('Overworld', { world, regenerate: true });
    let live = false;
    for (let i = 0; i < 30; i++) {
      if ((await readOverworldDialogueActive()) !== null) {
        live = true;
        break;
      }
      await sleep(60);
    }
    if (!live) throw new Error(`world ${world}: Overworld never became active`);
    if (!(await resolveOverworldDialogue())) throw new Error(`world ${world}: entry dialogue never cleared`);

    const opened = await page.evaluate(() => {
      const s = window.__game.scene.getScene('Overworld');
      const goal = s['goalTile'];
      s['playerTile'] = { x: goal.x, y: goal.y };
      s['maybeReachGoal'](goal.x, goal.y);
      return !!s['dialogueActive'];
    });
    if (!opened) throw new Error(`world ${world}: the gate panel never opened`);

    for (let i = 0; i < 8; i++) {
      if ((await getActiveScenes()).includes('Battle')) break;
      const r = await clickText(['Got it', 'Face the Rival ->', 'Next ->', 'Battle!']);
      if (!r.clicked) throw new Error(`world ${world}: stuck before the battle started`);
      await sleep(320);
    }
    if (!(await getActiveScenes()).includes('Battle')) throw new Error(`world ${world}: never reached the Battle scene`);
    await sleep(SETTLE_MS);

    // Freeze the arena, and keep both sides alive for however long the
    // captures take. A fresh save's max HP at World 10 is low enough that
    // the rival can end the fight before anything is measured, so both
    // sides get a buffer -- and the bars are left part-drained, which is
    // the mid-fight frame a player actually spends the battle looking at.
    const geom = await page.evaluate((frac) => {
      const s = window.__game.scene.getScene('Battle');
      s['playerMaxHp'] = 99999;
      s['opponentMaxHp'] = 99999;
      s['playerHp'] = 99999;
      s['opponentHp'] = 99999;
      s['updateBars']();
      const bounds = (o) => {
        const b = o.getBounds();
        return { x: b.x, y: b.y, w: b.width, h: b.height };
      };
      // Bar footprints are read at full health -- that rectangle is the
      // whole bar, including the part that empties -- then the bars are
      // drained to the fraction the frames are captured at.
      const geom = {
        playerAnchor: { x: s['playerCrystal'].x, y: s['playerCrystal'].y },
        opponentAnchor: { x: s['opponentCrystal'].x, y: s['opponentCrystal'].y },
        playerHpBar: bounds(s['playerHpBar']),
        opponentHpBar: bounds(s['opponentHpBar']),
        opponentName: s['wild'] ? s['wild'].name : '?',
        playerName: s['playerMaterial'] ? s['playerMaterial'].name : '?',
        isRival: !!s['isRival'],
      };
      s['playerHp'] = Math.round(99999 * frac);
      s['opponentHp'] = Math.round(99999 * frac);
      s['updateBars']();
      // Idle bob and backdrop drift rewound to phase zero and held there,
      // so the frame is the same frame on every run.
      s.tweens.getTweens().forEach((t) => {
        try {
          t.seek(0);
        } catch (e) {
          /* a tween that cannot seek is still paused below */
        }
        t.pause();
      });
      return geom;
    }, HP_FRACTION);
    await sleep(200);
    return geom;
  }

  // ---- the controls, applied to the live battle ----
  // Both sabotages paint into the backdrop the same way: an object inserted
  // into the display list just before the combatants, so it is backdrop by
  // the same rule everything else uses and the backdrop-only frame picks it
  // up too.
  // Negative control: the backdrop flooded with a flat grey at the crystals'
  // own measured mean luminance. It must NOT fail -- a high-contrast object
  // on a flat field is easier to find, not harder -- which is what proves
  // the check is measuring legibility rather than merely noticing that the
  // frame changed.
  const applyFlat = (grey, alpha) =>
    page.evaluate(
      ({ grey, alpha }) => {
        const s = window.__game.scene.getScene('Battle');
        const c = (grey << 16) | (grey << 8) | grey;
        const rect = s.add.rectangle(0, 0, s.scale.width, s.scale.height, c, alpha).setOrigin(0, 0);
        s.children.moveTo(rect, s.children.list.indexOf(s['opponentCrystal']));
        window.__greySab = [rect];
      },
      { grey, alpha }
    );

  // Positive control: the over-decoration failure itself. The backdrop is
  // given gameplay's own value range and gameplay's own scale of local
  // contrast -- a busy, handsome backdrop that competes -- and every element
  // must fail.
  const applyCrowd = (lo, hi) =>
    page.evaluate(
      ({ lo, hi }) => {
        const s = window.__game.scene.getScene('Battle');
        const g = s.add.graphics();
        let a = 987654321 >>> 0;
        const rnd = () => {
          a = (a + 0x6d2b79f5) | 0;
          let t = Math.imul(a ^ (a >>> 15), 1 | a);
          t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
          return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
        const B = 40;
        for (let y = 0; y < s.scale.height; y += B) {
          for (let x = 0; x < s.scale.width; x += B) {
            const v = Math.round(lo + rnd() * (hi - lo));
            g.fillStyle((v << 16) | (v << 8) | v, 1);
            g.fillRect(x, y, B, B);
          }
        }
        s.children.moveTo(g, s.children.list.indexOf(s['opponentCrystal']));
        window.__greySab = [g];
      },
      { lo, hi }
    );

  const clearSabotage = () =>
    page.evaluate(() => {
      (window.__greySab || []).forEach((o) => o.destroy());
      window.__greySab = null;
    });

  // ---- run ----
  log(`Booting ${URL} ...`);
  await page.goto(URL);
  await page.waitForSelector('canvas');
  await sleep(900);

  const rows = [];
  const problems = [];
  for (const world of WORLDS) {
    const t0 = Date.now();
    let geom;
    try {
      geom = await reachRivalBattle(world);
    } catch (e) {
      log(`FAIL world ${world}: ${e.message || e}`);
      problems.push(`world ${world}: could not reach a battle -- ${e.message || e}`);
      continue;
    }

    const baseFrames = await captureFrames();
    const regions = deriveRegions(baseFrames, geom);
    const base = measureArena(baseFrames, regions);
    fs.writeFileSync(path.join(SHOT_DIR, `w${world}-arena.png`), baseFrames.full);
    writeGreyPng(path.join(SHOT_DIR, `w${world}-squint.png`), base.reduced);

    // Both controls are aimed at values measured off the frame just
    // captured -- the crystals' own mean, and gameplay's own value range --
    // rather than taken from any palette table.
    const lumBase = luminance(decodePng(baseFrames.full));
    let sum = 0;
    let n = 0;
    for (const name of ['playerCrystal', 'opponentCrystal']) {
      const m = regions.masks[name];
      for (let i = 0; i < m.mask.length; i++)
        if (m.mask[i]) {
          sum += lumBase[i];
          n++;
        }
    }
    const crystalGrey = Math.round(sum / Math.max(1, n));

    await applyFlat(crystalGrey, 0.94);
    await sleep(160);
    const flat = measureArena(await captureFrames(), regions);
    await clearSabotage();
    await sleep(120);

    await applyCrowd(Math.round(base.zoning.gameplayDarkest), Math.round(base.zoning.gameplayBrightest));
    await sleep(160);
    const crowd = measureArena(await captureFrames(), regions);
    await clearSabotage();
    await sleep(120);

    await setGameplayLayer('setAlpha', FADE_ALPHA);
    await sleep(160);
    const faded = measureArena(await captureFrames(), regions);
    await setGameplayLayer('setAlpha', 1);

    const names = ['playerCrystal', 'opponentCrystal', 'playerHpBar', 'opponentHpBar'];
    const survivors = (r) => names.filter((k) => r.elements[k] && r.elements[k].pass);
    const failed = names.filter((k) => base.elements[k] && !base.elements[k].pass);
    const row = {
      world,
      opponent: geom.opponentName,
      player: geom.playerName,
      crystalGrey,
      base: base.elements,
      zoning: base.zoning,
      flat: flat.elements,
      crowd: crowd.elements,
      fade: faded.elements,
      verdict: failed.length ? 'FAIL' : 'PASS',
      flatHeld: survivors(flat).length === names.length,
      crowdCaught: survivors(crowd).length === 0,
      fadeCaught: survivors(faded).length === 0,
      seconds: Math.round((Date.now() - t0) / 100) / 10,
    };
    rows.push(row);

    for (const h of regions.harnessErrors) problems.push(`HARNESS world ${world}: ${h}`);

    log(
      `world ${world} vs ${geom.opponentName} [${row.seconds}s] ${row.verdict} -- ` +
        names.map((k) => `${short(k)} ${fmt(base.elements[k])}`).join('  ') +
        `  | controls: flat ${row.flatHeld ? 'held' : `LOST (${names.filter((k) => !flat.elements[k]?.pass).join(',')})`}` +
        `, crowd ${row.crowdCaught ? 'caught' : `SURVIVED (${survivors(crowd).join(',')})`}` +
        `, fade ${row.fadeCaught ? 'caught' : `SURVIVED (${survivors(faded).join(',')})`}`
    );
    for (const k of failed) {
      const e = base.elements[k];
      problems.push(
        `world ${world}: ${k} salience ${e.salience} < required ${e.need} (floor ${FLOOR}, ${RATIO} x backdrop p95 ${e.backdropP95})`
      );
    }
    if (!row.flatHeld) {
      problems.push(
        `world ${world}: the flat negative control failed the check -- it is reacting to the frame changing, not to legibility`
      );
    }
    if (!row.crowdCaught) {
      problems.push(
        `world ${world}: the crowded-backdrop control passed the check on ${survivors(crowd).join(', ')} -- the instrument is blind there`
      );
    }
    if (!row.fadeCaught) {
      problems.push(
        `world ${world}: the faded-gameplay control passed the check on ${survivors(faded).join(', ')} -- the instrument is blind there`
      );
    }
  }

  // ---- report ----
  log('');
  log('=== per-world salience (greyscale units of value separation, 0-255) ===');
  log('world  playerCrystal   oppCrystal      playerHpBar     oppHpBar        bdrop-p95  verdict');
  for (const r of rows) {
    const cell = (k) => {
      const e = r.base[k];
      return e ? `${e.salience.toFixed(1)}/x${e.margin.toFixed(2)}`.padEnd(16) : '--'.padEnd(16);
    };
    const p95 = Math.max(...['playerCrystal', 'opponentCrystal', 'playerHpBar', 'opponentHpBar'].map((k) => r.base[k]?.backdropP95 ?? 0));
    log(
      `  ${String(r.world).padEnd(4)} ${cell('playerCrystal')}${cell('opponentCrystal')}${cell('playerHpBar')}${cell('opponentHpBar')}${p95
        .toFixed(2)
        .padEnd(11)}${r.verdict}`
    );
  }
  log('  (salience / margin over the gate; a margin of x1.00 is exactly on the line)');
  log('');
  log('=== value zoning (reported, not gated): does the backdrop reach past gameplay? ===');
  log('world  gameplay dark..bright   backdrop dark..bright   backdrop owns');
  for (const r of rows) {
    const z = r.zoning;
    const owns = [z.backdropOwnsDarkest ? 'darkest' : '', z.backdropOwnsBrightest ? 'brightest' : '']
      .filter(Boolean)
      .join('+') || '-';
    log(
      `  ${String(r.world).padEnd(4)} ${`${z.gameplayDarkest.toFixed(1)}..${z.gameplayBrightest.toFixed(1)}`.padEnd(23)} ${`${z.backdropDarkest.toFixed(
        1
      )}..${z.backdropBrightest.toFixed(1)}`.padEnd(23)} ${owns}`
    );
  }

  log('');
  log('=== controls (per world, all four elements) ===');
  log('world  flat backdrop (must hold)  crowded backdrop (must fail)  faded gameplay (must fail)');
  for (const r of rows) {
    const worst = (o) => Math.min(...['playerCrystal', 'opponentCrystal', 'playerHpBar', 'opponentHpBar'].map((k) => o[k]?.margin ?? 0));
    const best = (o) => Math.max(...['playerCrystal', 'opponentCrystal', 'playerHpBar', 'opponentHpBar'].map((k) => o[k]?.margin ?? 0));
    log(
      `  ${String(r.world).padEnd(4)} ${`${r.flatHeld ? 'held' : 'LOST'} (worst x${worst(r.flat).toFixed(2)})`.padEnd(26)} ` +
        `${`${r.crowdCaught ? 'caught' : 'SURVIVED'} (best x${best(r.crowd).toFixed(2)})`.padEnd(29)} ` +
        `${r.fadeCaught ? 'caught' : 'SURVIVED'} (best x${best(r.fade).toFixed(2)})`
    );
  }

  const flatHeld = rows.filter((r) => r.flatHeld).length;
  const crowdCaught = rows.filter((r) => r.crowdCaught).length;
  const fadeCaught = rows.filter((r) => r.fadeCaught).length;
  const passed = rows.filter((r) => r.verdict === 'PASS').length;

  log('');
  log('=== SUMMARY ===');
  log(`gate: salience >= max(${FLOOR}, ${RATIO} x backdrop p95), downscale ${DOWNSCALE}x, band ${BAND} cells`);
  log(`${passed}/${rows.length} arenas legible.`);
  log(
    `controls: flat backdrop held in ${flatHeld}/${rows.length}, crowded backdrop caught in ${crowdCaught}/${rows.length}, faded gameplay caught in ${fadeCaught}/${rows.length}.`
  );
  if (pageErrors.length) problems.push(`page errors: ${JSON.stringify(pageErrors.slice(0, 5))}`);
  if (problems.length) {
    log('Problems:');
    problems.forEach((p) => log(`  - ${p}`));
  }
  log(`Wall time: ${((Date.now() - wallStart) / 1000).toFixed(1)}s. Frames in ${SHOT_DIR}.`);

  fs.writeFileSync(path.join(SHOT_DIR, 'greyscale-check-log.txt'), logLines.join('\n'));
  if (JSON_OUT) {
    fs.writeFileSync(
      JSON_OUT,
      JSON.stringify({ seed: SEED, downscale: DOWNSCALE, band: BAND, floor: FLOOR, ratio: RATIO, rows }, null, 2)
    );
    log(`Raw table written to ${JSON_OUT}.`);
  }

  await browser.close();
  teardownDevServer(serverHandle, log);
  return problems.length === 0 && rows.length === WORLDS.length;
}

const short = (k) =>
  ({ playerCrystal: 'plyCry', opponentCrystal: 'oppCry', playerHpBar: 'plyBar', opponentHpBar: 'oppBar' })[k];
const fmt = (e) => (e ? `${e.salience.toFixed(1)}(x${e.margin.toFixed(2)})` : 'n/a');

main()
  .then((ok) => process.exit(ok ? 0 : 1))
  .catch((e) => {
    console.error('FATAL:', e);
    process.exit(2);
  });
