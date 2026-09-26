import Phaser from 'phaser';
import type { EffectAnchor } from './attackAnchors';
import { GROUND_DROP, GROUND_ASPECT, TRAVEL_MS, type Direction } from './attackShapes';
import { fxGraphics, fxImage, fxTileSprite, fxEmitter, fxRetire, fxCounter, FxSpout } from './attackFx';
import { ensureFxTextures, FX_TEX, ROCK_FRAMES, FLOW_TEX_SIZE, ringDisplaySize } from './fxTextures';
import { blend, darken } from './colors';

// Landau's Analytic pair (§5, World 4, ANALYTIC_SHAPES): the beam that falls
// out of the sky (`skyfallBeam`, playBeam) and the fissure that opens under
// the target (`groundEruption`, playEruption). Both run on the same
// single-beat contract as every ordinary silhouette -- one counter tween
// over TRAVEL_MS, `onImpact` on its completion, the caller's impact
// shockwave after -- but neither takes an attacker anchor, since a beam
// from the sky and a crack in the floor don't originate at the caster, and
// both draw with lit, textured material rather than flat fills: soft
// columns of light, real smoke and dust, rock debris under gravity, a lens
// streak at the point of contact and the light each throws on the floor
// (art/fxTextures.ts). Both still take the move's own currently-tuned
// quasiparticle color, which is what every light here is tinted with.
//
// Everything is target-side and reads `to` fresh each frame; the floor is
// `groundDrop` below it (GROUND_DROP under a defender's centre in a battle,
// 0 on a preview stage that hands in its floor line -- see
// art/moveEffectPreview.ts).

const clamp01 = (v: number) => Phaser.Math.Clamp(v, 0, 1);

// Lays an image flat on the ground plane at (x, y), `w` wide and squashed to
// GROUND_ASPECT -- the same floor the crystals' own shadows sit on.
export function layFlat(img: Phaser.GameObjects.Image, x: number, y: number, w: number, alpha: number) {
  img.setPosition(x, y).setDisplaySize(w, w * GROUND_ASPECT).setAlpha(alpha);
}

// A square image centred on a point.
export function placeAt(img: Phaser.GameObjects.Image, x: number, y: number, size: number, alpha: number) {
  img.setPosition(x, y).setDisplaySize(size, size).setAlpha(alpha);
}

// A particle heading along the ground plane: out to the left or the right,
// within GROUND_SPREAD degrees of horizontal, so dust and debris that stay on
// the floor spread sideways across it rather than up the screen.
const GROUND_SPREAD = 22;
export const groundAngle: Phaser.Types.GameObjects.Particles.EmitterOpCustomEmitConfig = {
  onEmit: () => (Math.random() < 0.5 ? 0 : 180) + (Math.random() - 0.5) * 2 * GROUND_SPREAD,
};

// A tumbling rock: a random facing on emit, then a spin of its own each
// update, so no two chunks turn alike.
type Spinning = Phaser.GameObjects.Particles.Particle & { spin?: number };
export const tumble: Phaser.Types.GameObjects.Particles.EmitterOpCustomUpdateConfig = {
  onEmit: (particle) => {
    (particle as Spinning).spin = (Math.random() - 0.5) * 16;
    return Math.random() * 360;
  },
  onUpdate: (particle, _key, _t, value) => value + ((particle as Spinning).spin ?? 0),
};

// A leveled repeat's `scale` multiplies every size here, but particle counts
// and emission rates only up to this cap: a 3.5x repeat is three and a half
// times the size, not three and a half times the particles.
export const QUANTITY_CAP = 1.6;

// The floor, for a death zone: debris thrown up under gravity vanishes the
// frame it comes back down through the ground instead of falling on through
// the arena's floor.
export function belowGround(groundY: number): Phaser.Types.GameObjects.Particles.ParticleEmitterDeathZoneConfig {
  return { type: 'onEnter', source: new Phaser.Geom.Rectangle(-4000, groundY + 10, 8000, 4000) };
}

// ---------------------------------------------------------------------------
// skyfallBeam

// The sky origin, above the top of the frame, and where its glare sits: just
// inside the frame's top edge, so the source is seen and not only its shaft.
const BEAM_TOP = -60;
const BEAM_SUN_Y = 8;
// Where in the beat the head reaches the target...
const BEAM_STRIKE = 0.36;
// ...having taken this much of the beat to fall.
const BEAM_FALL = 0.14;
// Where the column starts dying.
const BEAM_FADE = 0.7;

// A column of light dropped straight down onto the target: a faint
// full-height haze and a spreading pool of light on the floor telegraph it
// while a starburst grows at the origin; then the head falls -- an outer
// shaft, turbulence scrolling down its length, a white core and a hot head
// throwing sparks -- lands, and burns on the spot: a ring races out across
// the floor, embers spray up out of the contact point and dust rolls away
// along the ground, until the shaft narrows and dies.
export function playBeam(
  scene: Phaser.Scene,
  color: number,
  to: EffectAnchor,
  onImpact?: (dir?: Direction) => void,
  depthOffset = 0,
  scale = 1,
  groundDrop = GROUND_DROP
) {
  ensureFxTextures(scene);
  const q = Math.min(scale, QUANTITY_CAP);
  const haze = fxImage(scene, 59, depthOffset, FX_TEX.column).setOrigin(0.5, 0).setTint(color).setAlpha(0);
  const outer = fxImage(scene, 60, depthOffset, FX_TEX.column).setOrigin(0.5, 0).setTint(color).setAlpha(0);
  const flow = fxTileSprite(scene, 60, depthOffset, FX_TEX.flow, FLOW_TEX_SIZE, FLOW_TEX_SIZE * 2).setOrigin(0.5, 0).setTint(color).setAlpha(0);
  const core = fxImage(scene, 61, depthOffset, FX_TEX.column).setOrigin(0.5, 0).setAlpha(0);
  const head = fxImage(scene, 61, depthOffset, FX_TEX.glow).setAlpha(0);
  const headStreak = fxImage(scene, 61, depthOffset, FX_TEX.streak).setAlpha(0);
  const sun = fxImage(scene, 59, depthOffset, FX_TEX.flare).setTint(color).setAlpha(0);
  const sunGlow = fxImage(scene, 59, depthOffset, FX_TEX.glow).setAlpha(0);
  const pool = fxImage(scene, 58, depthOffset, FX_TEX.glow).setTint(color).setAlpha(0);
  const ring = fxImage(scene, 58, depthOffset, FX_TEX.ring).setTint(color).setAlpha(0);
  const sparks = fxEmitter(scene, 61, depthOffset, FX_TEX.spark, {
    emitting: false,
    lifespan: { min: 240, max: 520 },
    speed: { min: 30, max: 150 },
    angle: { min: 0, max: 360 },
    gravityY: 260,
    scale: { start: 0.6 * scale, end: 0 },
    alpha: { start: 1, end: 0 },
    tint: [0xffffff, color],
  });
  const embers = fxEmitter(scene, 61, depthOffset, FX_TEX.spark, {
    emitting: false,
    lifespan: { min: 380, max: 820 },
    speed: { min: 60, max: 210 },
    angle: { min: 230, max: 310 },
    gravityY: 140,
    scale: { start: 0.55 * scale, end: 0 },
    alpha: { start: 1, end: 0 },
    tint: [0xffffff, color],
  });
  const dust = fxEmitter(
    scene,
    58,
    depthOffset,
    FX_TEX.smoke,
    {
      emitting: false,
      lifespan: { min: 500, max: 950 },
      speed: { min: 40, max: 150 },
      angle: groundAngle,
      gravityY: -12,
      rotate: { min: 0, max: 360 },
      scale: { start: 0.12 * scale, end: 0.45 * scale },
      alpha: { start: 0.3, end: 0 },
      tint: [0x6a6a78, 0x6a6a78],
    },
    Phaser.BlendModes.NORMAL
  );
  const sparkSpout = new FxSpout(sparks);
  const emberSpout = new FxSpout(embers);
  const dustSpout = new FxSpout(dust);
  let lastNow = scene.time.now;

  fxCounter(scene, depthOffset, {
    from: 0,
    to: 1,
    duration: TRAVEL_MS.beam,
    // Linear, with every phase shaped inside onUpdate: an eased counter
    // would spend the first third of the beat with the telegraph invisible.
    ease: 'Linear',
    onUpdate: (tw) => {
      const t = tw.getValue() ?? 0;
      const now = scene.time.now;
      const dt = Math.min(100, now - lastNow);
      lastNow = now;
      const groundY = to.y + groundDrop;
      const tele = clamp01(t / BEAM_STRIKE);
      const fall = clamp01((t - (BEAM_STRIKE - BEAM_FALL)) / BEAM_FALL);
      const landed = t >= BEAM_STRIKE;
      // 1 for as long as the beam burns on the target, dying to 0 after BEAM_FADE.
      const burn = landed ? 1 - clamp01((t - BEAM_FADE) / (1 - BEAM_FADE)) : 0;
      const flicker = 0.86 + 0.14 * Math.sin(t * 140) * Math.sin(t * 61 + 1);
      const headY = Phaser.Math.Linear(BEAM_TOP, to.y, Phaser.Math.Easing.Cubic.In(fall));

      haze.setPosition(to.x, BEAM_TOP).setDisplaySize((90 + 40 * tele) * scale, groundY - BEAM_TOP).setAlpha(0.4 * tele * (landed ? burn : 1));
      layFlat(pool, to.x, groundY, (120 + 100 * tele + 160 * burn) * scale, 0.35 * tele * (landed ? burn : 1) + 0.6 * burn);

      const sunA = landed ? burn : tele;
      placeAt(sun, to.x, BEAM_SUN_Y, (70 + 130 * tele) * scale, 0.9 * sunA);
      sun.setAngle(t * 40);
      placeAt(sunGlow, to.x, BEAM_SUN_Y, (90 + 170 * tele) * scale, 0.5 * sunA);

      if (fall > 0) {
        const colH = Math.max(1, headY - BEAM_TOP);
        const w = (1 + 0.15 * burn) * flicker;
        const colA = landed ? burn : 1;
        outer.setPosition(to.x, BEAM_TOP).setDisplaySize(60 * scale * w, colH).setAlpha(0.75 * colA);
        flow.setPosition(to.x, BEAM_TOP).setDisplaySize(50 * scale * w, colH).setAlpha(0.8 * colA);
        // A tile sprite's texture moves against its tilePosition, so
        // decreasing it runs the streaks down the shaft.
        flow.tilePositionY -= dt * 0.6;
        core.setPosition(to.x, BEAM_TOP).setDisplaySize(13 * scale * w, colH).setAlpha(0.95 * colA);
        placeAt(head, to.x, headY, (64 + 56 * burn) * scale * flicker, 0.95 * colA);
        headStreak.setPosition(to.x, headY).setDisplaySize((160 + 140 * burn) * scale, 9 * scale).setAlpha(0.85 * colA);
        if (!landed) sparkSpout.emit(now, to.x, headY, 90 * q);
      }
      if (landed) {
        const age = clamp01((t - BEAM_STRIKE) / (1 - BEAM_STRIKE));
        layFlat(ring, to.x, groundY, ringDisplaySize((12 + 130 * Phaser.Math.Easing.Cubic.Out(age)) * scale), 0.85 * (1 - age));
        emberSpout.emit(now, to.x + (Math.random() - 0.5) * 16 * scale, groundY, 110 * q * burn);
        if (age < 0.5) dustSpout.emit(now, to.x, groundY, 50 * q);
      }
    },
    onComplete: () => {
      [haze, outer, flow, core, head, headStreak, sun, sunGlow, pool, ring].forEach((o) => o.destroy());
      fxRetire(scene, depthOffset, sparks, 600);
      fxRetire(scene, depthOffset, embers, 900);
      fxRetire(scene, depthOffset, dust, 1000);
      onImpact?.({ x: 0, y: 1 });
    },
  });
}

// ---------------------------------------------------------------------------
// groundEruption

// Where in the beat the fissure has opened and the burst fires.
const ERUPT_OPEN = 0.2;
const CRACK_COUNT = 7;
const CRACK_SEGMENTS = 5;

// One crack: a jagged radial polyline out from the fissure's centre, in
// unsquashed ground coordinates (drawCracks lays it flat).
interface Crack {
  pts: { x: number; y: number }[];
}

// Seeded once per cast, so no two eruptions crack the floor alike.
function makeCracks(scale: number): Crack[] {
  return Array.from({ length: CRACK_COUNT }, (_, i) => {
    let ang = (i / CRACK_COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
    const len = (60 + Math.random() * 60) * scale;
    const pts = [{ x: 0, y: 0 }];
    for (let s = 1; s <= CRACK_SEGMENTS; s++) {
      ang += (Math.random() - 0.5) * 0.9;
      const r = (s / CRACK_SEGMENTS) * len;
      pts.push({ x: Math.cos(ang) * r, y: Math.sin(ang) * r });
    }
    return { pts };
  });
}

// Each crack drawn out to fraction `open` of its length, as a wide faint
// stroke under a thin bright one -- the glow of something molten showing
// through a split in the floor, rather than a wire drawn on it.
function drawCracks(g: Phaser.GameObjects.Graphics, color: number, cx: number, groundY: number, cracks: Crack[], open: number, alpha: number, scale: number) {
  if (alpha <= 0 || open <= 0) return;
  const hot = blend(color, 0xffffff, 0.6);
  const passes: [number, number, number][] = [
    [5 * scale, color, 0.3 * alpha],
    [1.6 * scale, hot, 0.95 * alpha],
  ];
  for (const [width, tint, a] of passes) {
    g.lineStyle(width, tint, a);
    for (const crack of cracks) {
      const reach = open * (crack.pts.length - 1);
      const whole = Math.floor(reach);
      g.beginPath();
      g.moveTo(cx, groundY);
      for (let i = 1; i <= whole && i < crack.pts.length; i++) g.lineTo(cx + crack.pts[i].x, groundY + crack.pts[i].y * GROUND_ASPECT);
      if (whole < crack.pts.length - 1) {
        const a0 = crack.pts[whole];
        const a1 = crack.pts[whole + 1];
        const f = reach - whole;
        g.lineTo(cx + a0.x + (a1.x - a0.x) * f, groundY + (a0.y + (a1.y - a0.y) * f) * GROUND_ASPECT);
      }
      g.strokePath();
    }
  }
}

// A fissure opening under the target: cracks race out across the floor over
// a growing underlight, then the floor blows -- a flash, a geyser of light
// with turbulence streaming up it and fire boiling off its top, rock chunks
// thrown up under gravity that tumble and fall back, embers, a ring of dust
// racing out along the ground and a dark plume of smoke rising and thinning
// as the geyser collapses.
export function playEruption(
  scene: Phaser.Scene,
  color: number,
  to: EffectAnchor,
  onImpact?: (dir?: Direction) => void,
  depthOffset = 0,
  scale = 1,
  groundDrop = GROUND_DROP
) {
  ensureFxTextures(scene);
  const q = Math.min(scale, QUANTITY_CAP);
  const cracks = makeCracks(scale);
  const g = fxGraphics(scene, 59, depthOffset);
  const under = fxImage(scene, 58, depthOffset, FX_TEX.glow).setTint(color).setAlpha(0);
  const flash = fxImage(scene, 61, depthOffset, FX_TEX.glow).setAlpha(0);
  const jet = fxImage(scene, 60, depthOffset, FX_TEX.column).setOrigin(0.5, 1).setTint(color).setAlpha(0);
  const jetFlow = fxTileSprite(scene, 60, depthOffset, FX_TEX.flow, FLOW_TEX_SIZE, FLOW_TEX_SIZE * 2).setOrigin(0.5, 1).setTint(color).setAlpha(0);
  const jetCore = fxImage(scene, 61, depthOffset, FX_TEX.column).setOrigin(0.5, 1).setAlpha(0);
  const dustRing = fxImage(scene, 58, depthOffset, FX_TEX.ring, undefined, Phaser.BlendModes.NORMAL).setTint(0xd9cfc4).setAlpha(0);
  const fire = fxEmitter(scene, 61, depthOffset, FX_TEX.glow, {
    emitting: false,
    lifespan: { min: 280, max: 600 },
    speed: { min: 130, max: 330 },
    angle: { min: 252, max: 288 },
    gravityY: 300,
    scale: { start: 0.16 * scale, end: 0.03 },
    alpha: { start: 0.95, end: 0 },
    tint: [0xffffff, color, darken(color, 60)],
  });
  const embers = fxEmitter(scene, 61, depthOffset, FX_TEX.spark, {
    emitting: false,
    lifespan: { min: 400, max: 900 },
    speed: { min: 120, max: 320 },
    angle: { min: 235, max: 305 },
    gravityY: 220,
    scale: { start: 0.55 * scale, end: 0 },
    alpha: { start: 1, end: 0 },
    tint: [0xffffff, color],
  });
  const rocks = fxEmitter(
    scene,
    60,
    depthOffset,
    FX_TEX.rock,
    {
      frame: [...ROCK_FRAMES],
      emitting: false,
      lifespan: { min: 700, max: 1100 },
      speed: { min: 140, max: 420 },
      angle: { min: 222, max: 318 },
      gravityY: 620,
      scale: { min: 0.12 * scale, max: 0.3 * scale },
      rotate: tumble,
      deathZone: belowGround(to.y + groundDrop),
    },
    Phaser.BlendModes.NORMAL
  );
  const smoke = fxEmitter(
    scene,
    59,
    depthOffset,
    FX_TEX.smoke,
    {
      emitting: false,
      lifespan: { min: 700, max: 1300 },
      speed: { min: 25, max: 80 },
      angle: { min: 250, max: 290 },
      gravityY: -45,
      rotate: { min: 0, max: 360 },
      scale: { start: 0.18 * scale, end: 0.9 * scale },
      alpha: { start: 0.5, end: 0 },
      tint: [0x6b6670, 0x6b6670],
    },
    Phaser.BlendModes.NORMAL
  );
  const dust = fxEmitter(
    scene,
    58,
    depthOffset,
    FX_TEX.smoke,
    {
      emitting: false,
      lifespan: { min: 500, max: 900 },
      speed: { min: 50, max: 170 },
      angle: groundAngle,
      rotate: { min: 0, max: 360 },
      scale: { start: 0.12 * scale, end: 0.5 * scale },
      alpha: { start: 0.35, end: 0 },
      tint: [0x8a817a, 0x8a817a],
    },
    Phaser.BlendModes.NORMAL
  );
  const fireSpout = new FxSpout(fire);
  const smokeSpout = new FxSpout(smoke);
  const emberSpout = new FxSpout(embers);
  let fired = false;
  let lastNow = scene.time.now;

  fxCounter(scene, depthOffset, {
    from: 0,
    to: 1,
    duration: TRAVEL_MS.eruption,
    ease: 'Linear',
    onUpdate: (tw) => {
      const t = tw.getValue() ?? 0;
      const now = scene.time.now;
      const dt = Math.min(100, now - lastNow);
      lastNow = now;
      const groundY = to.y + groundDrop;
      const open = Phaser.Math.Easing.Cubic.Out(clamp01(t / ERUPT_OPEN));
      // Progress since the burst.
      const age = clamp01((t - ERUPT_OPEN) / (1 - ERUPT_OPEN));
      const fade = 1 - age;

      g.clear();
      drawCracks(g, color, to.x, groundY, cracks, open, open * (0.4 + 0.6 * fade), scale);
      layFlat(under, to.x, groundY, (90 + 70 * open) * scale, 0.55 * open * (1 - 0.7 * age));

      if (t >= ERUPT_OPEN && !fired) {
        fired = true;
        rocks.explode(Math.round(18 * q), to.x, groundY - 4);
        fire.explode(Math.round(36 * q), to.x, groundY);
        embers.explode(Math.round(36 * q), to.x, groundY);
        dust.explode(Math.round(14 * q), to.x, groundY);
      }
      const flashA = age <= 0 ? 0 : Math.exp(-age * 9);
      placeAt(flash, to.x, groundY - 10 * scale, (140 + 300 * age) * scale, 0.9 * flashA);

      // The geyser rises and collapses inside the beat rather than freezing
      // at full height and fading.
      const jetH = 170 * Math.sin(Math.PI * clamp01(age / 0.85)) * scale;
      if (age > 0 && age < 0.85 && jetH > 1) {
        const w = 1 + 0.1 * Math.sin(t * 90);
        jet.setPosition(to.x, groundY).setDisplaySize(72 * scale * w, jetH).setAlpha(0.9);
        jetFlow.setPosition(to.x, groundY).setDisplaySize(60 * scale * w, jetH).setAlpha(0.8);
        // Increasing a tile sprite's tilePosition runs its texture upward.
        jetFlow.tilePositionY += dt * 0.7;
        jetCore.setPosition(to.x, groundY).setDisplaySize(22 * scale * w, jetH).setAlpha(0.95);
        fireSpout.emit(now, to.x + (Math.random() - 0.5) * 14 * scale, groundY - jetH * 0.4, 140 * q);
      } else {
        jet.setAlpha(0);
        jetFlow.setAlpha(0);
        jetCore.setAlpha(0);
      }

      layFlat(dustRing, to.x, groundY, ringDisplaySize((14 + 150 * Phaser.Math.Easing.Cubic.Out(age)) * scale), 0.55 * fade);
      if (age > 0) {
        smokeSpout.emit(now, to.x + (Math.random() - 0.5) * 24 * scale, groundY - 6, 70 * q * (1 - age * 0.5));
        emberSpout.emit(now, to.x, groundY, 30 * q * fade);
      }
    },
    onComplete: () => {
      [g, under, flash, jet, jetFlow, jetCore, dustRing].forEach((o) => o.destroy());
      fxRetire(scene, depthOffset, fire, 700);
      fxRetire(scene, depthOffset, embers, 1000);
      fxRetire(scene, depthOffset, rocks, 1200);
      fxRetire(scene, depthOffset, smoke, 1400);
      fxRetire(scene, depthOffset, dust, 1000);
      onImpact?.({ x: 0, y: -1 });
    },
  });
}
