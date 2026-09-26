import Phaser from 'phaser';
import { seededRandom } from './colors';

// The textures the spectacle moves draw with -- Landau's Analytic pair
// (art/attackAnalytics.ts) and Skłodowska-Curie's Ultimate pair
// (art/attackUltimates.ts). Every ordinary silhouette is a Graphics object
// redrawn per frame from flat fills, which is the right tool for a bolt or a
// ribbon; a beam of light, a burning rock, a plume of smoke or a shockwave
// need soft edges, a real radial falloff, grain and shading, none of which a
// flat fill has. These are painted once, on a canvas, with the 2D context's
// gradients and a little value noise, and then used as ordinary textures:
// tinted images, tile sprites and particle emitters. Painting happens at
// boot (TitleScene.create) rather than on the first cast, so no battle ever
// pays for it mid-turn; every play function still calls ensureFxTextures
// itself so a scene started directly (a headless check) finds them too.
//
// Every texture is white with its shape in the alpha channel, so a tint is
// the color: a white glow tinted a move's own class color, blended
// additively, is that class's light, and the same smoke puff tinted dark
// and blended normally is soot.
//
// These are plain canvas textures, not RenderTextures/DynamicTextures: the
// canvas is the source, so a lost WebGL context re-uploads them like any
// loaded image (scripts/component-check.mjs's context-loss test asserts
// the game owns no GPU-bound dynamic texture).
export const FX_TEX = {
  // Soft radial falloff: light, halos, flashes, fire and gas particles.
  glow: 'fx-glow',
  // A tighter, hotter point: sparks and embers.
  spark: 'fx-spark',
  // A soft-edged ring: shockwaves, dust rings, a disc's rim.
  ring: 'fx-ring',
  // A lumpy puff: smoke, dust and (tinted, additive) glowing gas.
  smoke: 'fx-smoke',
  // Three shaded rock chunks (ROCK_FRAMES): a meteor's body, its debris.
  rock: 'fx-rock',
  // A shaft of light, soft-edged, narrow at the top and flaring downward.
  column: 'fx-column',
  // A horizontal lens streak: the anamorphic flare a hot point throws.
  streak: 'fx-streak',
  // A starburst flare: bright core, thin rays, a faint ghost ring.
  flare: 'fx-flare',
  // Irregular radial rays: the burst behind an impact.
  rays: 'fx-rays',
  // Vertically streaked, tileable turbulence for a scrolling beam.
  flow: 'fx-flow',
} as const;

export const ROCK_FRAMES = ['r0', 'r1', 'r2'] as const;
// A rock frame's edge in pixels: large enough that a leveled meteor's body
// (several times a plain one's) stays crisp when it is drawn at that size.
const ROCK_PX = 160;

// The ring texture's crest sits at this fraction of its half-size, so an
// image sized with ringDisplaySize(r) puts its crest at radius r.
const RING_CREST = 0.78;
export function ringDisplaySize(r: number): number {
  return (r * 2) / RING_CREST;
}

// A rock frame's silhouette reaches about this fraction of its half-size.
const ROCK_FILL = 0.86;
export function rockDisplaySize(r: number): number {
  return (r * 2) / ROCK_FILL;
}

const FLOW_SIZE = 128;
export const FLOW_TEX_SIZE = FLOW_SIZE;

export function ensureFxTextures(scene: Phaser.Scene): void {
  const tm = scene.textures;
  if (tm.exists(FX_TEX.glow)) return;
  paint(tm, FX_TEX.glow, 128, 128, paintGlow);
  paint(tm, FX_TEX.spark, 32, 32, paintSpark);
  paint(tm, FX_TEX.ring, 256, 256, paintRing);
  paint(tm, FX_TEX.smoke, 128, 128, paintSmoke);
  const rock = paint(tm, FX_TEX.rock, ROCK_PX * ROCK_FRAMES.length, ROCK_PX, paintRocks);
  ROCK_FRAMES.forEach((name, i) => rock.add(name, 0, i * ROCK_PX, 0, ROCK_PX, ROCK_PX));
  paint(tm, FX_TEX.column, 64, 256, paintColumn);
  paint(tm, FX_TEX.streak, 256, 16, paintStreak);
  paint(tm, FX_TEX.flare, 128, 128, paintFlare);
  paint(tm, FX_TEX.rays, 256, 256, paintRays);
  paint(tm, FX_TEX.flow, FLOW_SIZE, FLOW_SIZE, paintFlow);
}

type Painter = (ctx: CanvasRenderingContext2D, w: number, h: number) => void;

function paint(tm: Phaser.Textures.TextureManager, key: string, w: number, h: number, painter: Painter): Phaser.Textures.CanvasTexture {
  const tex = tm.createCanvas(key, w, h);
  if (!tex) throw new Error(`fx texture ${key} could not be created`);
  painter(tex.getContext(), w, h);
  tex.refresh();
  return tex;
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smoothstep = (e0: number, e1: number, v: number) => {
  const x = clamp01((v - e0) / (e1 - e0));
  return x * x * (3 - 2 * x);
};

// Fills the canvas white, with `alphaAt` (0..1) deciding each pixel's alpha.
function perPixel(ctx: CanvasRenderingContext2D, w: number, h: number, alphaAt: (x: number, y: number) => number) {
  const img = ctx.createImageData(w, h);
  const d = img.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      d[i] = 255;
      d[i + 1] = 255;
      d[i + 2] = 255;
      d[i + 3] = Math.round(clamp01(alphaAt(x + 0.5, y + 0.5)) * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
}

// Periodic value noise on a `periodX` x `periodY` lattice of seeded random
// values, smoothly interpolated: sample it at coordinates in lattice units and
// it wraps at the period, which is what makes a texture tileable.
function makeNoise(seed: number, periodX: number, periodY: number): (x: number, y: number) => number {
  const rand = seededRandom(seed);
  const grid = new Float32Array(periodX * periodY);
  for (let i = 0; i < grid.length; i++) grid[i] = rand();
  const at = (ix: number, iy: number) => grid[(((iy % periodY) + periodY) % periodY) * periodX + (((ix % periodX) + periodX) % periodX)];
  return (x, y) => {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = smoothstep(0, 1, x - x0);
    const fy = smoothstep(0, 1, y - y0);
    const top = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * fx;
    const bottom = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * fx;
    return top + (bottom - top) * fy;
  };
}

// Several octaves of that noise summed, each twice the frequency and half the
// weight of the last: the lumpy detail of a cloud or a rock's grain.
function fbm(noise: (x: number, y: number) => number, x: number, y: number, octaves: number): number {
  let sum = 0;
  let amp = 0.5;
  let total = 0;
  for (let o = 0; o < octaves; o++) {
    sum += noise(x, y) * amp;
    total += amp;
    x *= 2;
    y *= 2;
    amp *= 0.5;
  }
  return sum / total;
}

function radial(ctx: CanvasRenderingContext2D, w: number, h: number, stops: [number, number][]) {
  const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  for (const [at, alpha] of stops) g.addColorStop(at, `rgba(255,255,255,${alpha})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function paintGlow(ctx: CanvasRenderingContext2D, w: number, h: number) {
  radial(ctx, w, h, [
    [0, 1],
    [0.15, 0.8],
    [0.35, 0.38],
    [0.6, 0.12],
    [0.85, 0.025],
    [1, 0],
  ]);
}

function paintSpark(ctx: CanvasRenderingContext2D, w: number, h: number) {
  radial(ctx, w, h, [
    [0, 1],
    [0.25, 0.7],
    [0.5, 0.2],
    [1, 0],
  ]);
}

function paintRing(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const half = w / 2;
  perPixel(ctx, w, h, (x, y) => {
    const d = Math.hypot(x - half, y - half) / half;
    const crest = Math.exp(-Math.pow((d - RING_CREST) / 0.075, 2));
    const halo = 0.3 * Math.exp(-Math.pow((d - RING_CREST) / 0.2, 2));
    return crest + halo;
  });
}

function paintSmoke(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const noise = makeNoise(11, 3, 3);
  const half = w / 2;
  perPixel(ctx, w, h, (x, y) => {
    const d = Math.hypot(x - half, y - half) / half;
    const body = smoothstep(1, 0.2, d);
    const n = fbm(noise, (x / w) * 3, (y / h) * 3, 4);
    return body * (0.3 + 0.9 * (n - 0.2));
  });
}

// Three irregular chunks, each lit from the upper left and falling to
// shadow at the lower right, with a few darker facets, a grain of noise and
// a dark rim -- enough shading for a rock to read as a solid rather than as
// a grey blob.
function paintRocks(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const rand = seededRandom(7);
  const noise = makeNoise(23, 8, 8);
  const size = h;
  const outline = (ox: number): { x: number; y: number }[] => {
    const cx = ox + size / 2;
    const cy = size / 2;
    const n = 11;
    return Array.from({ length: n }, (_, i) => {
      const ang = (i / n) * Math.PI * 2;
      const r = (size / 2) * ROCK_FILL * (0.72 + rand() * 0.28);
      return { x: cx + Math.cos(ang) * r, y: cy + Math.sin(ang) * r * 0.92 };
    });
  };
  const trace = (pts: { x: number; y: number }[]) => {
    ctx.beginPath();
    pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.closePath();
  };
  for (let f = 0; f < ROCK_FRAMES.length; f++) {
    const ox = f * size;
    const pts = outline(ox);
    ctx.save();
    trace(pts);
    ctx.clip();
    const grad = ctx.createLinearGradient(ox + size * 0.1, size * 0.08, ox + size * 0.9, size * 0.94);
    grad.addColorStop(0, '#d8d3cc');
    grad.addColorStop(0.45, '#8b847c');
    grad.addColorStop(1, '#2e2a27');
    ctx.fillStyle = grad;
    ctx.fillRect(ox, 0, size, size);
    for (let k = 0; k < 5; k++) {
      const cx = ox + size * (0.25 + rand() * 0.5);
      const cy = size * (0.25 + rand() * 0.5);
      const r = size * (0.15 + rand() * 0.25);
      ctx.fillStyle = `rgba(0,0,0,${0.1 + rand() * 0.2})`;
      ctx.beginPath();
      for (let v = 0; v < 4; v++) {
        const ang = rand() * Math.PI * 2;
        const px = cx + Math.cos(ang) * r;
        const py = cy + Math.sin(ang) * r;
        if (v === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    trace(pts);
    ctx.lineWidth = size * 0.026;
    ctx.strokeStyle = 'rgba(18,15,13,0.85)';
    ctx.stroke();
  }
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (d[i + 3] === 0) continue;
      const grain = 0.78 + 0.32 * fbm(noise, (x / size) * 8, (y / size) * 8, 3);
      d[i] = Math.min(255, d[i] * grain);
      d[i + 1] = Math.min(255, d[i + 1] * grain);
      d[i + 2] = Math.min(255, d[i + 2] * grain);
    }
  }
  ctx.putImageData(img, 0, 0);
}

// Narrow at the top, flaring toward the bottom, soft across its width: drawn
// from its top with origin (0.5, 0) it is a shaft falling from the sky, and
// from its bottom with origin (0.5, 1) a geyser rising off the ground.
function paintColumn(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const half = w / 2;
  perPixel(ctx, w, h, (x, y) => {
    const u = y / h;
    const width = 0.42 + 0.58 * u;
    const dx = Math.abs(x - half) / (half * width);
    return Math.pow(1 - clamp01(dx), 2.2);
  });
}

function paintStreak(ctx: CanvasRenderingContext2D, w: number, h: number) {
  perPixel(ctx, w, h, (x, y) => {
    const hx = Math.abs(x - w / 2) / (w / 2);
    const hy = Math.abs(y - h / 2) / (h / 2);
    return Math.pow(1 - clamp01(hx), 3.2) * Math.pow(1 - clamp01(hy), 1.6);
  });
}

function paintFlare(ctx: CanvasRenderingContext2D, w: number, h: number) {
  radial(ctx, w, h, [
    [0, 1],
    [0.08, 0.7],
    [0.22, 0.18],
    [0.5, 0.03],
    [1, 0],
  ]);
  const cx = w / 2;
  const cy = h / 2;
  ctx.globalCompositeOperation = 'lighter';
  const rays = 8;
  for (let i = 0; i < rays; i++) {
    const ang = (i / rays) * Math.PI * 2;
    const len = i % 2 === 0 ? w * 0.48 : w * 0.3;
    const grad = ctx.createLinearGradient(cx, cy, cx + Math.cos(ang) * len, cy + Math.sin(ang) * len);
    grad.addColorStop(0, 'rgba(255,255,255,0.7)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.strokeStyle = grad;
    ctx.lineWidth = i % 4 === 0 ? 2.4 : 1.4;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(ang) * len, cy + Math.sin(ang) * len);
    ctx.stroke();
  }
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.beginPath();
  ctx.arc(cx, cy, w * 0.31, 0, Math.PI * 2);
  ctx.stroke();
}

// Rays at irregular angles, each tapering with distance and none of them
// evenly spaced, so a burst never reads as a spoked wheel.
function paintRays(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const rand = seededRandom(31);
  const count = 13;
  const rays = Array.from({ length: count }, (_, i) => ({
    angle: (i / count) * Math.PI * 2 + (rand() - 0.5) * 0.35,
    halfWidth: 0.05 + rand() * 0.08,
    length: 0.7 + rand() * 0.3,
  }));
  const half = w / 2;
  perPixel(ctx, w, h, (x, y) => {
    const dx = x - half;
    const dy = y - half;
    const d = Math.hypot(dx, dy) / half;
    if (d > 1) return 0;
    const ang = Math.atan2(dy, dx);
    let a = 0;
    for (const ray of rays) {
      let da = Math.abs(ang - ray.angle) % (Math.PI * 2);
      if (da > Math.PI) da = Math.PI * 2 - da;
      const along = clamp01(1 - d / ray.length);
      const across = Math.exp(-Math.pow(da / ray.halfWidth, 2) * (1 + 3 * d));
      a = Math.max(a, across * Math.pow(along, 1.3));
    }
    return a * smoothstep(0, 0.06, d);
  });
}

// Streaks stretched along y over a soft-edged strip: scrolled through a tile
// sprite it is energy flowing along a beam. Periodic in both axes so the
// tiling shows no seam.
function paintFlow(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const noise = makeNoise(47, 6, 2);
  const half = w / 2;
  perPixel(ctx, w, h, (x, y) => {
    const n = fbm(noise, (x / w) * 6, (y / h) * 2, 3);
    const edge = Math.pow(1 - clamp01(Math.abs(x - half) / half), 1.4);
    return smoothstep(0.42, 0.8, n) * edge;
  });
}
