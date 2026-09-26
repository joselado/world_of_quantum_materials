import Phaser from 'phaser';
import { seededRandom } from './colors';

// The textures the spectacle moves draw with -- Landau's Analytic pair
// (art/attackAnalytics.ts) and Skłodowska-Curie's Ultimate pair
// (art/attackUltimates.ts). Every ordinary silhouette is a Graphics object
// redrawn per frame from flat fills, which is the right tool for a bolt or a
// ribbon; a beam of light, a ball of energy, a plume of smoke or a shockwave
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
// and blended normally is soot. Even the orb's roiling skin and the shell's
// limb are carried in alpha alone, so a meteor's body tinted a class color
// is a ball of that class's light (the summoned mass is the quasiparticle
// itself) and a shell tinted the same is a shockwave of it.
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
  // A ball of energy: a solid hot core under a roiling, mottled skin with a
  // bright limb -- a meteor's body, and the globs an impact or an eruption
  // throws. Mottled rather than radially even, so a spin shows on it.
  orb: 'fx-orb',
  // A hollow sphere seen from outside: a faint interior brightening toward
  // a crisp limb, the way a translucent shell is brightest where the line
  // of sight runs along it -- a nova's spherical shockwave.
  shell: 'fx-shell',
  // A disc of dense plasma: bright filaments webbed through it, so a sphere
  // wearing it reads as made of energy rather than of one smooth light.
  plasma: 'fx-plasma',
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

// The ring texture's crest sits at this fraction of its half-size, so an
// image sized with ringDisplaySize(r) puts its crest at radius r.
const RING_CREST = 0.78;
export function ringDisplaySize(r: number): number {
  return (r * 2) / RING_CREST;
}

// The shell's limb sits at this fraction of its half-size; sized with
// shellDisplaySize(r) its limb is at radius r.
const SHELL_CREST = 0.8;
export function shellDisplaySize(r: number): number {
  return (r * 2) / SHELL_CREST;
}

// The orb's skin reaches about this fraction of its half-size; sized with
// orbDisplaySize(r) it is a ball of radius r.
const ORB_FILL = 0.88;
export function orbDisplaySize(r: number): number {
  return (r * 2) / ORB_FILL;
}
// The orb is painted at this edge: large enough that a leveled meteor's body
// (several times a plain one's) keeps its skin's detail at that size.
const ORB_PX = 192;

const FLOW_SIZE = 128;
export const FLOW_TEX_SIZE = FLOW_SIZE;

export function ensureFxTextures(scene: Phaser.Scene): void {
  const tm = scene.textures;
  if (tm.exists(FX_TEX.glow)) return;
  paint(tm, FX_TEX.glow, 128, 128, paintGlow);
  paint(tm, FX_TEX.spark, 32, 32, paintSpark);
  paint(tm, FX_TEX.ring, 256, 256, paintRing);
  paint(tm, FX_TEX.smoke, 128, 128, paintSmoke);
  paint(tm, FX_TEX.orb, ORB_PX, ORB_PX, paintOrb);
  paint(tm, FX_TEX.shell, 256, 256, paintShell);
  paint(tm, FX_TEX.plasma, ORB_PX, ORB_PX, paintPlasma);
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
// weight of the last: the lumpy detail of a cloud or an orb's roiling skin.
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

// A ball of energy: a solid core, a skin that roils -- value noise eating
// into the alpha more and more toward the edge, so the surface is mottled
// and a spin shows on it -- and a slightly brighter limb, so the ball has a
// skin rather than fading out like a glow. The inner half is left solid
// and the limb kept faint so that a small glob of it still reads as a ball
// of light rather than as a bubble. Painted large (ORB_PX) so a leveled
// meteor's body keeps the mottling at several times a plain size.
function paintOrb(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const noise = makeNoise(29, 5, 5);
  const half = w / 2;
  perPixel(ctx, w, h, (x, y) => {
    const d = Math.hypot(x - half, y - half) / half;
    const body = smoothstep(ORB_FILL + 0.06, ORB_FILL - 0.1, d);
    const n = fbm(noise, (x / w) * 5, (y / h) * 5, 4);
    const roil = 1 - 0.7 * smoothstep(0.42, 0.85, d) * clamp01(0.72 - n) * 1.8;
    const limb = 0.12 * Math.exp(-Math.pow((d - ORB_FILL + 0.06) / 0.07, 2));
    return body * (clamp01(roil) + limb);
  });
}

// A disc of dense plasma: ridged value noise (bright where the noise
// crosses its middle, dark either side of it) contrast-stretched into
// filaments, inside the orb's own soft edge. Turned slowly over the orb
// layers it is the sphere's roiling skin.
function paintPlasma(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const noise = makeNoise(53, 6, 6);
  const half = w / 2;
  perPixel(ctx, w, h, (x, y) => {
    const d = Math.hypot(x - half, y - half) / half;
    const edge = smoothstep(ORB_FILL + 0.04, ORB_FILL - 0.12, d);
    const n = fbm(noise, (x / w) * 6, (y / h) * 6, 4);
    const ridged = 1 - Math.abs(2 * n - 1);
    const veins = smoothstep(0.55, 0.95, ridged);
    return edge * (0.25 + 0.75 * veins);
  });
}

// A hollow sphere: a faint interior that brightens toward the limb (the
// line of sight runs through more of a thin shell the nearer the edge it
// passes), a crisp crest at the limb itself, and a soft halo just outside
// it. Sized with shellDisplaySize(r) it is a sphere of radius r.
function paintShell(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const half = w / 2;
  perPixel(ctx, w, h, (x, y) => {
    const d = Math.hypot(x - half, y - half) / half;
    const inside = smoothstep(SHELL_CREST + 0.02, SHELL_CREST - 0.04, d);
    const interior = (0.07 + 0.3 * Math.pow(clamp01(d / SHELL_CREST), 3)) * inside;
    const crest = Math.exp(-Math.pow((d - SHELL_CREST) / 0.05, 2));
    const halo = 0.28 * Math.exp(-Math.pow((d - SHELL_CREST) / 0.13, 2));
    return interior + crest + halo;
  });
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
