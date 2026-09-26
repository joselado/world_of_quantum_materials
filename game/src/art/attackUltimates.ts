import Phaser from 'phaser';
import type { EffectAnchor } from './attackAnchors';
import { GROUND_DROP, GROUND_ASPECT, drawAnnulus, drawArcRing } from './attackShapes';
import { fxGraphics, fxImage, fxEmitter, fxRetire, fxCounter, FxSpout } from './attackFx';
import { ensureFxTextures, FX_TEX, ringDisplaySize, orbDisplaySize, shellDisplaySize } from './fxTextures';
import { layFlat, placeAt, groundAngle, QUANTITY_CAP, hot, energyGlobs } from './attackAnalytics';
import { blend, darken } from './colors';
import { CANVAS_W, CANVAS_H } from '../config/screen';

// Skłodowska-Curie's Ultimate pair (§5, World 10, ULTIMATE_SHAPES) -- the
// flashiest tier, a 4-6s "Final-Fantasy-style summon" sequence rather than a
// single travelling effect: a runic summon circle (Summon) builds up,
// something gathers/intensifies at the target (Charge), the actual strike
// lands (Impact -- fires `onImpact` right as this phase *begins*, not at its
// end, mirroring every other shape's `land()`), then decays away (Aftermath
// -- fires `onComplete` once, at the very end). Each phase is its own
// counter tween (art/attackFx.ts's fxCounter), chained via onComplete rather
// than one long tween, and each phase creates and destroys its own objects
// rather than reusing them across phases -- unlike art/attackShapes.ts's
// shapes, which only ever need one short tween and so never have to worry
// about that cleanup. What a phase leaves behind on purpose is its
// emitters' last particles: a trail of smoke hangs in the air over the
// impact, embers are still rising when the aftermath ends (fxRetire).
//
// Both are drawn with lit, textured material (art/fxTextures.ts) rather
// than flat fills: the meteor is a ball of energy -- a hot core under a
// roiling skin, lightning crackling off it, light streaming up off it and a
// shadow tightening on the floor as it comes down; the nova a core heated
// to a pale shade of the move's color inside an accretion disc, matter
// falling in as sparks; the strikes a fireball and a hemispherical front
// (meteor), a spherical shockwave (nova), dust, globs of energy under
// gravity, lens streaks and glowing gas. Everything is tinted the move's
// own currently-tuned quasiparticle color -- its light at full strength or
// pushed toward white where it is hottest, its dust the same color dulled
// -- since the mass being summoned is that quasiparticle itself, a ball of
// its energy rather than a stone it rides in on: a Magnon Meteor is a red
// ball under red light, an Electron Nova a blue core inside a blue disc.
// Nothing in a landing cast is plain white or grey.
//
// `whiff` (set when an Ultimate move fails its 3-question gate,
// BattleScene's resolveHit) takes the summoned mass apart instead of letting
// it strike: the Impact/Aftermath phases build the silhouette Charge left
// hanging over the target and disperse *that* -- desaturated, drifting
// outward, dying in mid-air with nothing ever reaching the ground and no
// shockwave, crystal flash or camera shake behind it -- so a failed cast
// reads as "it never landed" rather than as a weaker hit. Summon plays
// identically either way and Charge very nearly does, so the 3-question
// tension pays off the same regardless of the outcome; its one tell is the
// held strain (the meteor's tremble, the nova's core pulse) going slack
// across the hold beat, putting the outcome on screen a beat before the
// dissipation itself starts.
//
// Every phase here is purely target-side: it draws off the target's own
// `EffectAnchor` (resolved fresh each frame, art/attackAnchors.ts) and never
// reads the attacker's position at all -- a summoned meteor/nova arrives at
// the defender, it doesn't travel from the caster.
// Where an Ultimate's stage lies beyond its target: the point in the sky a
// meteor comes in from, and the floor a nova draws its energy up out of (an
// x span, and how far down the screen the floor reaches -- its top is the
// target's own floor line). A battle hands in its arena (BattleScene's
// ultimateStage, painted past the field's edges for its pulled-back camera)
// and a preview its stage (art/moveEffectPreview.ts), so the far point is
// the corner of whatever is being looked at; the default is a bare field.
export interface UltimateStage {
  far: { x: number; y: number };
  floor: { x0: number; x1: number; y1: number };
}
export const DEFAULT_ULTIMATE_STAGE: UltimateStage = {
  far: { x: -CANVAS_W * 0.16, y: -CANVAS_H * 0.18 },
  floor: { x0: -CANVAS_W * 0.2, x1: CANVAS_W * 1.2, y1: CANVAS_H * 1.2 },
};

const METEOR_SUMMON_MS = 1300;
const METEOR_CHARGE_MS = 2000;
const METEOR_IMPACT_MS = 900;
const METEOR_AFTERMATH_MS = 2000;
export const METEOR_TOTAL_MS = METEOR_SUMMON_MS + METEOR_CHARGE_MS + METEOR_IMPACT_MS + METEOR_AFTERMATH_MS; // 5200ms

const NOVA_SUMMON_MS = 1200;
const NOVA_CHARGE_MS = 1900;
const NOVA_IMPACT_MS = 850;
const NOVA_AFTERMATH_MS = 1800;
export const NOVA_TOTAL_MS = NOVA_SUMMON_MS + NOVA_CHARGE_MS + NOVA_IMPACT_MS + NOVA_AFTERMATH_MS; // 4900ms

// The Charge phase's own end state, shared with the phases either side of it:
// the whiff dissipation builds exactly the silhouette Charge left hanging
// over the target and pulls that apart, so the two have to agree on where the
// mass ends up and how big it is or the handover shows as a visible cut.
// (Where the meteor's ball is when it breaks up is wherever it had got to
// on its way in, left in `Shared` by Charge.)
const METEOR_BALL_R = 40;
const METEOR_RUNE_R = 58;
const NOVA_CORE_R = 32;
const NOVA_RING_FACTOR = 2.4;
// How far the nova's spherical shockwave travels before it has faded out,
// at scale 1: most of the field (FIELD_H/2 = 240, BattleScene.ts).
const NOVA_SHOCK_R = 280;
// The nova's accretion disc lies at this tilt to the camera.
const DISC_TILT = 0.32;

// The move's color at the intensities a meteor or a nova needs, so that
// everything a cast puts on screen -- its light, its gas, its dust -- is
// the tuned quasiparticle's color and never a generic white or grey: `hot`
// (art/attackAnalytics.ts) is the color pushed toward white for the hottest
// points (a core, a flash, the birth of a spark), `dustOf` the color lifted
// to the pale of a dust cloud, and `paleOf` the near-white of a dust ring.
// Only the whiff dissipation stays grey (FIZZLE_GREY), since a failed cast
// is the one that carries no quasiparticle any more.
const dustOf = (color: number) => blend(color, 0x9a938c, 0.5);
const paleOf = (color: number) => blend(color, 0xffffff, 0.55);

// A whiff draws in one flat grey across every phase it touches, rather than
// the move's own quasiparticle color: the point is that this cast carries no
// physics any more, and a single grey also keeps the Impact->Aftermath handover
// invisible, since the dissipation runs continuously across both.
const FIZZLE_GREY = 0x9a9a9a;

// Where each Charge phase stops growing and starts straining -- full size and
// position by this fraction of the phase, held there for the rest.
const HOLD_T = 0.82;

const clamp01 = (v: number) => Phaser.Math.Clamp(v, 0, 1);

// How much of that held strain survives at time `t`: all of it on a landing
// hit, decaying to nothing across the hold beat on a whiff, so the tremble
// (meteor) and core pulse (nova) that read as "about to blow" visibly go
// slack while the mass is still whole.
function strainAt(t: number, whiff: boolean): number {
  if (!whiff) return 1;
  return clamp01(1 - (t - HOLD_T) / (1 - HOLD_T));
}

// A rune that glows: art/attackShapes.ts's arc ring drawn twice, a wide
// faint pass under the crisp one, so the inscription reads as light on the
// floor (or in the air) rather than as a wire drawing.
function drawRune(g: Phaser.GameObjects.Graphics, color: number, x: number, y: number, r: number, spin: number, alpha: number, scale: number, flatten: number) {
  drawArcRing(g, color, x, y, r, spin, alpha * 0.3, scale * 3.2, flatten);
  drawArcRing(g, color, x, y, r, spin, alpha, scale, flatten);
}

// A whiff's dissipation runs as one continuous motion across BOTH the Impact
// and Aftermath phases rather than restarting halfway, so `p` here is
// progress through the pair (0 at the start of Impact, 1 at the end of
// Aftermath) rather than either phase's own tween value -- a fragment that
// has drifted 80px by the phase boundary carries on from 80px instead of
// snapping back to the middle. Each phase converts its own `t` with
// METEOR_FIZZLE_SPLIT/NOVA_FIZZLE_SPLIT below. The objects it draws with are
// built once, by Impact, and torn down by Aftermath -- `shared` carries them
// across the boundary.
const METEOR_FIZZLE_SPLIT = METEOR_IMPACT_MS / (METEOR_IMPACT_MS + METEOR_AFTERMATH_MS);
const NOVA_FIZZLE_SPLIT = NOVA_IMPACT_MS / (NOVA_IMPACT_MS + NOVA_AFTERMATH_MS);

interface Fizzle {
  draw(p: number): void;
  destroy(): void;
}
interface Shared {
  fizzle?: Fizzle;
  // Where the meteor's approach ended (playMeteorCharge), for the slam.
  contact?: MeteorContact;
  // The meteor's explosion, born by Impact and burning on through Aftermath.
  slam?: MeteorSlam;
  // The nova's core, halo and accretion disc, built by Charge and carried
  // through Impact into Aftermath so nothing at the centre is ever cut.
  novaCore?: NovaCore;
  // The nova's sphere, born by Impact and expanding on through Aftermath.
  blast?: NovaBlast;
}

// ---------------------------------------------------------------------------
// ultimateMeteor

// Summon: a rune inscribed on the ground under the target -- three
// counter-rotating arc segments at different radii, ticked with short radial
// dashes and orbited by bright motes, glowing over a pool of light and all
// squashed into the ground plane (GROUND_ASPECT) so it lies on the floor the
// crystal stands on rather than facing the camera. Sparks lift off the
// inscription as it is drawn and dust stirs off the floor inside it. Arcs
// rather than a polygon and spokes: a closed hexagon ringed by radiating
// lines reads as a wire wheel, while turning fragments read as something
// being inscribed.
function playMeteorSummon(scene: Phaser.Scene, color: number, to: EffectAnchor, onDone: () => void, depthOffset: number, scale: number, groundDrop: number) {
  ensureFxTextures(scene);
  const q = Math.min(scale, QUANTITY_CAP);
  const g = fxGraphics(scene, 58, depthOffset);
  const under = fxImage(scene, 58, depthOffset, FX_TEX.glow).setTint(color).setAlpha(0);
  const motes = fxEmitter(scene, 59, depthOffset, FX_TEX.spark, {
    emitting: false,
    lifespan: { min: 300, max: 600 },
    speed: { min: 5, max: 20 },
    angle: { min: 250, max: 290 },
    scale: { start: 0.45 * scale, end: 0 },
    alpha: { start: 1, end: 0 },
    tint: [hot(color), color],
  });
  const dust = fxEmitter(
    scene,
    58,
    depthOffset,
    FX_TEX.smoke,
    {
      emitting: false,
      lifespan: { min: 600, max: 1000 },
      speed: { min: 8, max: 26 },
      angle: { min: 250, max: 290 },
      gravityY: -20,
      rotate: { min: 0, max: 360 },
      scale: { start: 0.1 * scale, end: 0.35 * scale },
      alpha: { start: 0.18, end: 0 },
      tint: dustOf(color),
    },
    Phaser.BlendModes.NORMAL
  );
  const moteSpout = new FxSpout(motes);
  const dustSpout = new FxSpout(dust);
  fxCounter(scene, depthOffset, {
    from: 0,
    to: 1,
    duration: METEOR_SUMMON_MS,
    ease: 'Cubic.easeOut',
    onUpdate: (tw) => {
      const t = tw.getValue() ?? 0;
      const now = scene.time.now;
      const groundY = to.y + groundDrop;
      const r = (10 + t * 66) * scale;
      g.clear();
      drawAnnulus(g, color, to.x, groundY, r, 2.5 * scale, 0.3 + t * 0.6, GROUND_ASPECT);
      drawRune(g, color, to.x, groundY, r, t, 0.2 + t * 0.55, scale, GROUND_ASPECT);
      layFlat(under, to.x, groundY, (80 + 120 * t) * scale, 0.45 * t);
      const ang = t * 9;
      moteSpout.emit(now, to.x + Math.cos(ang) * r, groundY + Math.sin(ang) * r * GROUND_ASPECT, 40 * q);
      dustSpout.emitEach(now, 14 * q, () => ({
        x: to.x + (Math.random() - 0.5) * 2 * r,
        y: groundY + (Math.random() - 0.5) * 2 * r * GROUND_ASPECT,
      }));
    },
    onComplete: () => {
      g.destroy();
      under.destroy();
      fxRetire(scene, depthOffset, motes, 700);
      fxRetire(scene, depthOffset, dust, 1100);
      onDone();
    },
  });
}

// Lightning crackling off the ball: jagged polylines from its skin outward,
// re-rolled every ARC_MS by the phase drawing them so they flicker rather
// than hang. Each is an angle, a reach past the skin (in radii) and a
// lateral kink per segment.
const ARC_MS = 60;
const ARC_SEGMENTS = 4;
interface Arc {
  angle: number;
  reach: number;
  kinks: number[];
}
function rollArcs(n: number): Arc[] {
  return Array.from({ length: n }, () => ({
    angle: Math.random() * Math.PI * 2,
    reach: 0.5 + Math.random() * 0.9,
    kinks: Array.from({ length: ARC_SEGMENTS + 1 }, () => (Math.random() - 0.5) * 2),
  }));
}
function drawArc(g: Phaser.GameObjects.Graphics, color: number, pts: { x: number; y: number }[], alpha: number, scale: number) {
  const passes: [number, number, number][] = [
    [4 * scale, color, 0.35 * alpha],
    [1.5 * scale, hot(color), alpha],
  ];
  for (const [width, tint, a] of passes) {
    g.lineStyle(width, tint, a);
    g.beginPath();
    pts.forEach((p, i) => (i === 0 ? g.moveTo(p.x, p.y) : g.lineTo(p.x, p.y)));
    g.strokePath();
  }
}
function drawSkinArcs(g: Phaser.GameObjects.Graphics, color: number, x: number, y: number, r: number, arcs: Arc[], alpha: number, scale: number) {
  for (const arc of arcs) {
    const cos = Math.cos(arc.angle);
    const sin = Math.sin(arc.angle);
    const pts = arc.kinks.map((k, i) => {
      const along = r * (0.85 + (arc.reach * i) / ARC_SEGMENTS);
      const lateral = i === 0 || i === ARC_SEGMENTS ? 0 : k * r * 0.22;
      return { x: x + cos * along - sin * lateral, y: y + sin * along + cos * lateral };
    });
    drawArc(g, color, pts, alpha, scale);
  }
}

// The approach. The ball closes on the target from the stage's far point
// (UltimateStage.far -- out past the top-left of what a pulled-back battle
// camera sees, a preview stage's own corner) at a steady pace in depth, and
// is drawn in perspective: its apparent size and its progress across the
// screen both go as 1 / (1 + depth), so it hangs small and far for most of
// the phase and swells and sweeps in over the last stretch, the way a thing
// falling out of the sky does. METEOR_FAR_DEPTH is the depth it starts at,
// in units of the distance at which it is drawn at full size.
const METEOR_FAR_DEPTH = 7;
// Where in the phase a whiffed ball breaks up on the way in.
const METEOR_BREAK_T = 0.72;

// The ball's contact point at the end of the approach: its centre sits this
// many radii above the floor, so its underside is in the ground.
const METEOR_CONTACT_SINK = 0.45;

// What Charge leaves for Impact: where the ball is and how big, at contact
// on a landing cast or at the break-up on a whiff.
interface MeteorContact {
  x: number;
  y: number;
  r: number;
}

// The ball's apparent size at progress `t` of the approach (1 at contact),
// and how far across the screen it has come, from 0 at the far point to 1
// at the target: mostly the perspective law's own progress, so the close
// is a rush, blended with a steady drift (METEOR_DRIFT of the motion) so
// the ball is seen crossing the sky from its first frame rather than
// hanging at the far point until the last stretch.
const METEOR_DRIFT = 0.35;
function meteorSize(t: number): number {
  return 1 / (1 + (1 - t) * METEOR_FAR_DEPTH);
}
function meteorProgress(t: number): number {
  const s0 = meteorSize(0);
  const perspective = (meteorSize(t) - s0) / (1 - s0);
  return METEOR_DRIFT * t + (1 - METEOR_DRIFT) * perspective;
}

// Charge: the meteor comes in from deep space. A point of light appears far
// out at the stage's far point, with a lens flare so the eye catches it,
// and closes on the target over the whole phase (meteorSize/
// meteorProgress): a ball of the move's own energy -- a hot core under a
// roiling skin (two orb layers turning against each other) in a halo of
// its light, lightning crackling off it, sparks orbiting it -- stretched
// along its own motion by how fast it is going, shedding a trail of light
// that hangs in the air where it was left, while the rune under the target
// flickers faster and the ball's shadow on the floor comes up out of
// nothing as it nears. It arrives exactly as this phase ends, so that
// Impact's `onImpact` -- the damage, the crystal's flinch, the shake --
// fires on the frame of contact rather than before or after it: the
// swelling, accelerating close is what reads as a strike rather than a
// thing floating down.
//
// On a whiff the ball never arrives: at METEOR_BREAK_T of the phase it
// stalls where it is, its light goes out of it (strainAt), and Impact takes
// it apart there, still far out over the field.
function playMeteorCharge(
  scene: Phaser.Scene,
  color: number,
  to: EffectAnchor,
  whiff: boolean,
  onDone: () => void,
  depthOffset: number,
  scale: number,
  groundDrop: number,
  stage: UltimateStage,
  shared: Shared
) {
  const q = Math.min(scale, QUANTITY_CAP);
  const rune = fxGraphics(scene, 58, depthOffset);
  const arcs = fxGraphics(scene, 61, depthOffset);
  const under = fxImage(scene, 58, depthOffset, FX_TEX.glow).setTint(color).setAlpha(0);
  const shadow = fxImage(scene, 58, depthOffset, FX_TEX.glow, undefined, Phaser.BlendModes.MULTIPLY).setTint(0x000000).setAlpha(0);
  const halo = fxImage(scene, 59, depthOffset, FX_TEX.glow).setTint(color);
  const skin = fxImage(scene, 60, depthOffset, FX_TEX.orb).setTint(color);
  const skin2 = fxImage(scene, 60, depthOffset, FX_TEX.orb).setTint(blend(color, hot(color), 0.5));
  const core = fxImage(scene, 61, depthOffset, FX_TEX.glow).setTint(hot(color));
  const flare = fxImage(scene, 61, depthOffset, FX_TEX.flare).setTint(hot(color));
  const orbiters = Array.from({ length: 3 }, () => fxImage(scene, 61, depthOffset, FX_TEX.spark).setTint(hot(color)));
  // The trail: light shed where the ball is, left hanging there. Each
  // particle is born at the ball's current size.
  let trailSize = 0.1 * scale;
  const trail = fxEmitter(scene, 60, depthOffset, FX_TEX.glow, {
    emitting: false,
    lifespan: { min: 260, max: 520 },
    speed: { min: 4, max: 24 },
    angle: { min: 0, max: 360 },
    scale: { onEmit: () => trailSize, onUpdate: (_particle, _key, t, value) => value * (1 - 0.7 * t) },
    alpha: { start: 0.8, end: 0 },
    tint: [hot(color), color, darken(color, 60)],
  });
  const sparks = fxEmitter(scene, 61, depthOffset, FX_TEX.spark, {
    emitting: false,
    lifespan: { min: 200, max: 450 },
    speed: { min: 20, max: 120 },
    angle: { min: 0, max: 360 },
    scale: { start: 0.35 * scale, end: 0 },
    alpha: { start: 1, end: 0 },
    tint: [hot(color), color],
  });
  const trailSpout = new FxSpout(trail);
  const sparkSpout = new FxSpout(sparks);
  let skinArcs: Arc[] = [];
  let nextArcAt = 0;
  const motionAngle = Phaser.Math.RadToDeg(Math.atan2(to.y + groundDrop - stage.far.y, to.x - stage.far.x)) + 90;
  fxCounter(scene, depthOffset, {
    from: 0,
    to: 1,
    duration: METEOR_CHARGE_MS,
    // Linear: the perspective law below is the whole shaping of the approach.
    ease: 'Linear',
    onUpdate: (tw) => {
      const t = tw.getValue() ?? 0;
      const now = scene.time.now;
      const groundY = to.y + groundDrop;
      // A whiffed ball stalls at the break point; a landing one comes all
      // the way in.
      const tt = whiff ? Math.min(t, METEOR_BREAK_T) : t;
      const size = meteorSize(tt);
      const progress = meteorProgress(tt);
      const rFull = METEOR_BALL_R * scale;
      const r = Math.max(2, rFull * size);
      const contactX = to.x;
      const contactY = groundY - rFull * METEOR_CONTACT_SINK;
      const x = stage.far.x + (contactX - stage.far.x) * progress;
      const y = stage.far.y + (contactY - stage.far.y) * progress;
      // The light going out of a whiffed ball once it has stalled.
      const strain = whiff ? clamp01(1 - (t - METEOR_BREAK_T) / (1 - METEOR_BREAK_T)) : 1;
      const light = 0.5 + 0.5 * strain;
      const pulse = 0.75 + 0.25 * Math.sin(t * 40) * strain;
      // Stretched along its motion by its speed across the screen: the
      // perspective law's own rate, which is what makes the close a rush.
      const speed = whiff && t > METEOR_BREAK_T ? 0 : Math.min(1, (size * size * METEOR_FAR_DEPTH) / 3);
      const stretchY = 1 + 0.7 * speed;
      const stretchX = 1 - 0.22 * speed;
      const skinSize = orbDisplaySize(r);
      skin.setPosition(x, y).setDisplaySize(skinSize * stretchX, skinSize * stretchY).setAngle(motionAngle).setAlpha(0.95 * light);
      skin2.setPosition(x, y).setDisplaySize(skinSize * 0.82 * stretchX, skinSize * 0.82 * stretchY).setAngle(motionAngle + 180 - t * 90).setAlpha(0.35 * light);
      placeAt(halo, x, y, r * 4.4 * pulse + 6 * scale, (0.16 + 0.1 * size) * light);
      placeAt(core, x, y, r * 0.95 * pulse + 3 * scale, 0.4 * light);
      // The flare is what is seen while the ball is still a point: it
      // starts at a size of its own and grows with the ball.
      placeAt(flare, x, y, (14 * scale + r * 3.2) * (0.7 + 0.3 * pulse), (0.35 + 0.25 * size) * light * strain);
      flare.setAngle(t * 50);
      orbiters.forEach((spark, i) => {
        const ang = t * 11 + (i / orbiters.length) * Math.PI * 2;
        const orbR = r * 1.6;
        spark
          .setPosition(x + Math.cos(ang) * orbR, y + Math.sin(ang) * orbR * 0.55)
          .setDisplaySize(6 * scale * (0.4 + 0.6 * size), 6 * scale * (0.4 + 0.6 * size))
          .setAlpha(light * Math.min(1, size * 3));
      });

      if (now >= nextArcAt) {
        nextArcAt = now + ARC_MS;
        skinArcs = size > 0.2 ? rollArcs(Math.round(1 + 3 * size * strain)) : [];
      }
      arcs.clear();
      drawSkinArcs(arcs, color, x, y, r * (1 + 0.3 * speed), skinArcs, 0.7 * strain, scale);

      trailSize = (0.05 + 0.4 * size) * scale;
      trailSpout.emitEach(now, (60 + 500 * size) * q * light, () => ({ x: x + (Math.random() - 0.5) * r * 0.8, y: y + (Math.random() - 0.5) * r * 0.8 }));
      sparkSpout.emitEach(now, 40 * q * size * light, () => ({ x: x + (Math.random() - 0.5) * r, y: y + (Math.random() - 0.5) * r }));

      // Its shadow on the floor under the target, coming up out of nothing
      // as it nears.
      layFlat(shadow, to.x, groundY, rFull * 3.2 * (1.6 - 0.8 * size), 0.55 * size * size * strain);

      rune.clear();
      const flicker = 0.6 + 0.4 * Math.sin(t * (24 + 60 * size));
      const circleR = (METEOR_RUNE_R + Math.sin(t * 10) * 4) * scale;
      drawAnnulus(rune, color, to.x, groundY, circleR, 3 * scale, (0.35 + 0.45 * size) * flicker, GROUND_ASPECT);
      drawAnnulus(rune, hot(color), to.x, groundY, circleR * 1.3, 2 * scale, 0.3 * flicker, GROUND_ASPECT);
      layFlat(under, to.x, groundY, 200 * scale, 0.15 + 0.35 * flicker + 0.3 * size);
      shared.contact = { x, y, r };
    },
    onComplete: () => {
      [rune, arcs, under, shadow, halo, skin, skin2, core, flare, ...orbiters].forEach((o) => o.destroy());
      fxRetire(scene, depthOffset, trail, 600);
      fxRetire(scene, depthOffset, sparks, 500);
      onDone();
    },
  });
}

// The ball coming apart where it stalled on the way in: its light dies
// almost at once, the skin dims and shrinks in place behind a puff of grey
// vapour, and fragments of it fly outward on an ease-out (fast, then
// coasting) while sagging a little, turning and going out. The body and
// its fragments are drawn NORMAL rather than additive: a grey light added
// to the arena is next to nothing, where a solid grey ball going out reads
// -- what has left it is its light, carried by the halo dying. Everything
// stays in the air where it broke up -- ground contact is the language of
// a strike that landed, so a whiff never draws anything on the ground
// plane except the summon rune it is letting go of.
function startMeteorFizzle(scene: Phaser.Scene, at: MeteorContact, depthOffset: number, scale: number): Fizzle {
  const body = fxImage(scene, 60, depthOffset, FX_TEX.orb, undefined, Phaser.BlendModes.NORMAL).setTint(FIZZLE_GREY);
  const halo = fxImage(scene, 59, depthOffset, FX_TEX.glow).setTint(FIZZLE_GREY);
  const frags = Array.from({ length: 9 }, () => fxImage(scene, 60, depthOffset, FX_TEX.orb, undefined, Phaser.BlendModes.NORMAL).setTint(FIZZLE_GREY));
  const smoke = fxEmitter(
    scene,
    59,
    depthOffset,
    FX_TEX.smoke,
    {
      emitting: false,
      lifespan: { min: 1100, max: 1700 },
      speed: { min: 15, max: 55 },
      angle: { min: 0, max: 360 },
      gravityY: -12,
      rotate: { min: 0, max: 360 },
      scale: { start: 0.15 * scale, end: 0.5 * scale },
      alpha: { start: 0.3, end: 0 },
      tint: [0x77747a, 0x77747a],
    },
    Phaser.BlendModes.NORMAL
  );
  smoke.explode(Math.round(10 * Math.min(scale, QUANTITY_CAP)), at.x, at.y);
  // Sized against the ball as it was at the break, which is smaller than
  // a ball at contact by how far out it stalled.
  const k = at.r / (METEOR_BALL_R * scale);
  return {
    draw(p) {
      const fade = 1 - p;
      const y = at.y - p * 14 * scale * k;
      const r = at.r * (1 - p * 0.55);
      const size = orbDisplaySize(r);
      body.setPosition(at.x, y).setDisplaySize(size, size).setAngle(p * 40).setAlpha(clamp01(0.9 - p * 2));
      placeAt(halo, at.x, y, r * 3, 0.4 * Math.pow(fade, 1.5));
      frags.forEach((frag, i) => {
        const ang = (i / frags.length) * Math.PI * 2 + i * 0.7;
        const dist = Math.pow(p, 0.65) * (70 + (i % 3) * 26) * scale * k;
        const fragSize = orbDisplaySize(Math.max(0.6, (6 - (i % 3) * 1.4) * (1 - p * 0.5) * scale * k));
        frag
          .setPosition(at.x + Math.cos(ang) * dist, y + Math.sin(ang) * dist * 0.55 + p * p * 26 * scale * k)
          .setDisplaySize(fragSize, fragSize)
          .setAngle(p * 200 * (i % 2 ? 1 : -1) + i * 40)
          .setAlpha(0.9 * Math.pow(fade, 0.75));
      });
    },
    destroy() {
      [body, halo, ...frags].forEach((o) => o.destroy());
      fxRetire(scene, depthOffset, smoke, 1800);
    },
  };
}

// How far the slam's hemispherical front and its ground ring reach, at
// scale 1: most of the 854x480 field (FIELD_W/FIELD_H, BattleScene.ts), the
// "explosion fills the screen" beat the approach was building toward. The
// front's brightness is a function of how far it has travelled, gone
// entirely by this radius -- a blast wave fading with distance.
const METEOR_BLAST_R = 300;
// How long the slam's explosion lives, from contact: it builds across the
// Impact phase and burns on through most of the Aftermath, so the strike
// is not over in the frame it lands.
const METEOR_BLAST_MS = 2000;

// The slam's explosion, built by Impact on the frame of contact and drawn by
// both Impact and Aftermath against the clock it was born on, so the
// handover between the two phases is invisible: a fireball of the move's
// energy climbing out of the contact point and swelling as it rises -- a
// dome of light with a hotter heart, fed by glowing gas boiling up out of
// the point of contact for the first half of its life -- then burning down;
// the hemispherical front racing out under it at a blast wave's pace
// (radius as the two-fifths power of time, Sedov-Taylor) and fading with
// the distance it has travelled; the crater glowing, then cooling, embers
// lifting off it the whole while.
interface MeteorSlam {
  fireball: Phaser.GameObjects.Image;
  fireballCore: Phaser.GameObjects.Image;
  front: Phaser.GameObjects.Image;
  crater: Phaser.GameObjects.Image;
  gas: Phaser.GameObjects.Particles.ParticleEmitter;
  embers: Phaser.GameObjects.Particles.ParticleEmitter;
  gasSpout: FxSpout;
  emberSpout: FxSpout;
  start: number;
}

function startMeteorSlam(scene: Phaser.Scene, color: number, depthOffset: number, scale: number): MeteorSlam {
  const fireball = fxImage(scene, 60, depthOffset, FX_TEX.glow).setTint(color);
  const fireballCore = fxImage(scene, 61, depthOffset, FX_TEX.glow).setTint(hot(color));
  // The shell texture cropped to its upper half: a hemisphere standing on
  // the floor line, its base where the ground ring runs.
  const front = fxImage(scene, 60, depthOffset, FX_TEX.shell).setTint(color).setCrop(0, 0, 256, 128);
  const crater = fxImage(scene, 58, depthOffset, FX_TEX.glow).setTint(color);
  const gas = fxEmitter(scene, 60, depthOffset, FX_TEX.smoke, {
    emitting: false,
    lifespan: { min: 700, max: 1300 },
    speed: { min: 40, max: 200 },
    angle: { min: 200, max: 340 },
    gravityY: -80,
    rotate: { min: 0, max: 360 },
    scale: { start: 0.3 * scale, end: 1.2 * scale },
    alpha: { start: 0.6, end: 0 },
    tint: [hot(color), color, darken(color, 45)],
  });
  const embers = fxEmitter(scene, 61, depthOffset, FX_TEX.spark, {
    emitting: false,
    lifespan: { min: 600, max: 1200 },
    speed: { min: 20, max: 90 },
    angle: { min: 240, max: 300 },
    gravityY: -30,
    scale: { start: 0.45 * scale, end: 0 },
    alpha: { start: 1, end: 0 },
    tint: [hot(color), color],
  });
  return { fireball, fireballCore, front, crater, gas, embers, gasSpout: new FxSpout(gas), emberSpout: new FxSpout(embers), start: scene.time.now };
}

function drawMeteorSlam(slam: MeteorSlam, now: number, contact: MeteorContact, groundY: number, scale: number) {
  const q = clamp01((now - slam.start) / METEOR_BLAST_MS);
  const qq = Math.min(scale, QUANTITY_CAP);
  // The fireball climbs and swells over the first part of its life, holds,
  // then burns down.
  const climb = Phaser.Math.Easing.Sine.Out(clamp01(q / 0.6));
  const burn = q < 0.45 ? clamp01(q / 0.08) : Math.pow(1 - (q - 0.45) / 0.55, 1.2);
  placeAt(slam.fireball, contact.x, groundY - (30 + 150 * climb) * scale, (80 + 380 * climb) * scale, 0.55 * burn);
  const heart = q < 0.3 ? 1 : Math.pow(1 - (q - 0.3) / 0.7, 1.6);
  placeAt(slam.fireballCore, contact.x, groundY - (24 + 90 * climb) * scale, (50 + 200 * climb) * scale, 0.6 * heart);
  // The front: Sedov-Taylor over the first part of the blast, fading with
  // distance and gone at METEOR_BLAST_R.
  const fq = clamp01(q / 0.55);
  const travelled = Math.pow(fq, 0.4);
  const frontSize = shellDisplaySize(METEOR_BLAST_R * scale * travelled);
  slam.front.setPosition(contact.x, groundY).setDisplaySize(frontSize, frontSize).setAlpha(0.85 * Math.pow(1 - travelled, 1.3));
  layFlat(slam.crater, contact.x, groundY, 240 * scale, 0.8 * (q < 0.5 ? 1 : 1 - (q - 0.5) / 0.5));
  // Gas boils up out of the contact point for the first half of the blast;
  // embers lift off the crater the whole while, thinning as it cools.
  slam.gasSpout.emitEach(now, (q < 0.5 ? 140 : 0) * qq, () => ({ x: contact.x + (Math.random() - 0.5) * 40 * scale, y: groundY - 10 * scale }));
  slam.emberSpout.emitEach(now, 60 * qq * (1 - q), () => ({ x: contact.x + (Math.random() - 0.5) * 50 * scale, y: groundY - 4 }));
}

function endMeteorSlam(scene: Phaser.Scene, slam: MeteorSlam, depthOffset: number) {
  [slam.fireball, slam.fireballCore, slam.front, slam.crater].forEach((o) => o.destroy());
  fxRetire(scene, depthOffset, slam.gas, 1400);
  fxRetire(scene, depthOffset, slam.embers, 1300);
}

// Impact (`ultimateMeteor`): calls `onImpact()` immediately -- this phase
// begins on the frame the approach ends, so the ball's contact and the hit's
// own flinch, shake and damage land together -- then plays either the slam
// or, on a whiff, the ball coming apart where it stalled on the way in,
// which reads as "it never got there" rather than as a weaker version of
// the same boom. The slam's fast part is this phase's own: the ball
// flattens into the floor and is gone inside a blinding contact flash, a
// shockwave ring and a slower ring of dust race out across the floor, a
// burst of rays and a lens streak cross the point of contact, globs of the
// ball's own energy are thrown up under gravity to arc and fall back, with
// fire and a rolling cloud of dust. Its explosion (startMeteorSlam) is born
// here too and goes on building through the Aftermath. Every light here is
// ADD-blend and alpha-fades rather than an opaque fill, so the log text/HP
// bars (BattleScene, depth 0) still read through it even at this size, just
// brightened for a beat.
function playMeteorImpact(
  scene: Phaser.Scene,
  color: number,
  to: EffectAnchor,
  whiff: boolean,
  onImpact: () => void,
  onDone: () => void,
  depthOffset: number,
  scale: number,
  groundDrop: number,
  shared: Shared
) {
  onImpact();
  if (whiff) {
    const g = fxGraphics(scene, 60, depthOffset);
    const groundY0 = to.y + groundDrop;
    const fizzle = startMeteorFizzle(scene, shared.contact ?? { x: to.x, y: groundY0 - METEOR_BALL_R * scale * 3, r: METEOR_BALL_R * scale * 0.3 }, depthOffset, scale);
    shared.fizzle = fizzle;
    fxCounter(scene, depthOffset, {
      from: 0,
      to: 1,
      duration: METEOR_IMPACT_MS,
      // Linear: the dissipation is one motion spanning this phase and the
      // next (the fizzle's `p`), and shaping it here as well as inside the
      // helper would stall the fragments at the phase boundary and then
      // lurch them.
      ease: 'Linear',
      onUpdate: (tw) => {
        const t = tw.getValue() ?? 0;
        const groundY = to.y + groundDrop;
        g.clear();
        fizzle.draw(t * METEOR_FIZZLE_SPLIT);
        // The summon rune goes out along with the ball rather than being
        // cut off mid-pulse; it is the only thing a whiff ever draws on the
        // ground plane, and it is finished by the end of this phase.
        drawAnnulus(g, FIZZLE_GREY, to.x, groundY, METEOR_RUNE_R * scale, 3 * scale, 0.3 * (1 - t), GROUND_ASPECT);
      },
      onComplete: () => {
        g.destroy();
        onDone();
      },
    });
    return;
  }

  const q = Math.min(scale, QUANTITY_CAP);
  const groundY0 = to.y + groundDrop;
  const contact = shared.contact ?? { x: to.x, y: groundY0 - METEOR_BALL_R * scale * METEOR_CONTACT_SINK, r: METEOR_BALL_R * scale };
  const squash = fxImage(scene, 61, depthOffset, FX_TEX.orb).setTint(hot(color));
  const flash = fxImage(scene, 61, depthOffset, FX_TEX.glow).setTint(hot(color));
  const shock = fxImage(scene, 59, depthOffset, FX_TEX.ring).setTint(hot(color));
  const dustRing = fxImage(scene, 58, depthOffset, FX_TEX.ring, undefined, Phaser.BlendModes.NORMAL).setTint(paleOf(color));
  const rays = fxImage(scene, 60, depthOffset, FX_TEX.rays).setTint(color);
  const streak = fxImage(scene, 61, depthOffset, FX_TEX.streak).setTint(hot(color));
  const globs = energyGlobs(scene, 60, depthOffset, color, scale, groundY0, {
    lifespan: { min: 800, max: 1400 },
    speed: { min: 150, max: 420 },
    angle: { min: 215, max: 325 },
    gravityY: 700,
    size: 0.1,
  });
  const burst = fxEmitter(scene, 61, depthOffset, FX_TEX.spark, {
    emitting: false,
    lifespan: { min: 500, max: 1100 },
    speed: { min: 120, max: 380 },
    angle: { min: 200, max: 340 },
    gravityY: 260,
    scale: { start: 0.6 * scale, end: 0 },
    alpha: { start: 1, end: 0 },
    tint: [hot(color), color],
  });
  const fire = fxEmitter(scene, 60, depthOffset, FX_TEX.glow, {
    emitting: false,
    lifespan: { min: 300, max: 700 },
    speed: { min: 60, max: 220 },
    angle: { min: 200, max: 340 },
    gravityY: 120,
    scale: { start: 0.22 * scale, end: 0.04 },
    alpha: { start: 0.9, end: 0 },
    tint: [hot(color), color, darken(color, 70)],
  });
  const dust = fxEmitter(
    scene,
    58,
    depthOffset,
    FX_TEX.smoke,
    {
      emitting: false,
      lifespan: { min: 700, max: 1400 },
      speed: { min: 80, max: 260 },
      angle: groundAngle,
      gravityY: -10,
      rotate: { min: 0, max: 360 },
      scale: { start: 0.18 * scale, end: 0.8 * scale },
      alpha: { start: 0.6, end: 0 },
      tint: dustOf(color),
    },
    Phaser.BlendModes.NORMAL
  );
  globs.explode(Math.round(18 * q), contact.x, groundY0 - 6);
  burst.explode(Math.round(60 * q), contact.x, groundY0 - 6);
  fire.explode(Math.round(26 * q), contact.x, groundY0 - 6);
  dust.explode(Math.round(24 * q), contact.x, groundY0);
  const slam = startMeteorSlam(scene, color, depthOffset, scale);
  shared.slam = slam;
  slam.gas.explode(Math.round(16 * q), contact.x, groundY0 - 10 * scale);
  fxCounter(scene, depthOffset, {
    from: 0,
    to: 1,
    duration: METEOR_IMPACT_MS,
    // Linear, with each element shaped below: the fast part eases out on its
    // own and the explosion follows its own clock (drawMeteorSlam).
    ease: 'Linear',
    onUpdate: (tw) => {
      const t = tw.getValue() ?? 0;
      const tOut = Phaser.Math.Easing.Cubic.Out(t);
      const now = scene.time.now;
      const groundY = to.y + groundDrop;
      // The ball flattens into the floor and is gone inside the flash.
      const k = clamp01(t / 0.12);
      const squashSize = orbDisplaySize(contact.r);
      squash.setPosition(contact.x, Phaser.Math.Linear(contact.y, groundY - contact.r * 0.25, k)).setDisplaySize(squashSize * (1 + 1.6 * k), squashSize * (1 - 0.85 * k)).setAlpha(1 - k);
      placeAt(flash, contact.x, groundY - 10 * scale, (60 + 620 * tOut) * scale, 0.95 * Math.pow(1 - tOut, 1.5));
      layFlat(shock, contact.x, groundY, ringDisplaySize((16 + 300 * tOut) * scale), 0.9 * Math.pow(1 - tOut, 0.6));
      layFlat(dustRing, contact.x, groundY, ringDisplaySize((8 + 230 * tOut) * scale), 0.6 * Math.pow(1 - tOut, 0.7));
      layFlat(rays, contact.x, groundY, (80 + 640 * tOut) * scale, 0.75 * (1 - tOut));
      rays.setAngle(tOut * 14);
      streak.setPosition(contact.x, groundY - 8 * scale).setDisplaySize((240 + 700 * tOut) * scale, 10 * scale).setAlpha(0.9 * Math.pow(1 - tOut, 2));
      drawMeteorSlam(slam, now, contact, groundY, scale);
    },
    onComplete: () => {
      [squash, flash, shock, dustRing, rays, streak].forEach((o) => o.destroy());
      fxRetire(scene, depthOffset, globs, 1500);
      fxRetire(scene, depthOffset, burst, 1200);
      fxRetire(scene, depthOffset, fire, 800);
      fxRetire(scene, depthOffset, dust, 1500);
      onDone();
    },
  });
}

// Aftermath (`ultimateMeteor`): the explosion Impact set off going on
// building, holding and burning down (drawMeteorSlam), the crater cooling
// under it -- or, on a whiff, the last of the broken-up ball thinning out in
// mid-air, far from the ground. Ends by tearing down what the two phases
// shared and firing `onComplete` exactly once.
function playMeteorAftermath(
  scene: Phaser.Scene,
  color: number,
  to: EffectAnchor,
  whiff: boolean,
  onComplete: () => void,
  depthOffset: number,
  scale: number,
  groundDrop: number,
  shared: Shared
) {
  void color;
  if (whiff) {
    const fizzle = shared.fizzle;
    fxCounter(scene, depthOffset, {
      from: 0,
      to: 1,
      duration: METEOR_AFTERMATH_MS,
      ease: 'Linear',
      onUpdate: (tw) => {
        const t = tw.getValue() ?? 0;
        // Picks the break-up straight up where Impact left it and carries it
        // out to nothing -- no crater glow, no embers settling on the ground.
        fizzle?.draw(METEOR_FIZZLE_SPLIT + t * (1 - METEOR_FIZZLE_SPLIT));
      },
      onComplete: () => {
        fizzle?.destroy();
        shared.fizzle = undefined;
        onComplete();
      },
    });
    return;
  }

  const slam = shared.slam;
  const contact = shared.contact ?? { x: to.x, y: to.y, r: METEOR_BALL_R * scale };
  fxCounter(scene, depthOffset, {
    from: 0,
    to: 1,
    duration: METEOR_AFTERMATH_MS,
    ease: 'Linear',
    onUpdate: () => {
      if (slam) drawMeteorSlam(slam, scene.time.now, contact, to.y + groundDrop, scale);
    },
    onComplete: () => {
      if (slam) endMeteorSlam(scene, slam, depthOffset);
      shared.slam = undefined;
      onComplete();
    },
  });
}

// `ultimateMeteor` -- see the shared Ultimate-tier comment above for the
// phase/callback contract. Reads as a ball of energy falling out of deep
// space onto the target, distinct from playNova's outward-building blast.
// `groundDrop` is how far below `to` the floor lies (GROUND_DROP under a
// defender's centre in a battle; 0 on a preview stage, which hands in its
// floor line as `to` -- art/moveEffectPreview.ts), the same overridable
// floor Landau's eruption takes, since the strike is staged against the
// floor: the rune lies on it and the slam lands on it. `stage` is where the
// ball comes in from (UltimateStage).
export function playMeteor(
  scene: Phaser.Scene,
  color: number,
  to: EffectAnchor,
  whiff: boolean,
  onImpact: () => void,
  onComplete: () => void,
  depthOffset = 0,
  scale = 1,
  groundDrop = GROUND_DROP,
  stage: UltimateStage = DEFAULT_ULTIMATE_STAGE
) {
  const shared: Shared = {};
  playMeteorSummon(scene, color, to, () => {
    playMeteorCharge(scene, color, to, whiff, () => {
      playMeteorImpact(scene, color, to, whiff, onImpact, () => {
        playMeteorAftermath(scene, color, to, whiff, onComplete, depthOffset, scale, groundDrop, shared);
      }, depthOffset, scale, groundDrop, shared);
    }, depthOffset, scale, groundDrop, stage, shared);
  }, depthOffset, scale, groundDrop);
}
// ---------------------------------------------------------------------------
// ultimateNova

// Summon: the same runic-circle idea as playMeteorSummon, but standing
// upright around the target itself rather than lying flat on the ground --
// counter-rotating arc fragments building up around `to` over a growing
// starburst at its centre, sparks lifting off the inscription, reading as a
// vertical mandala rather than a ground rune.
function playNovaSummon(scene: Phaser.Scene, color: number, to: EffectAnchor, onDone: () => void, depthOffset = 0, scale = 1) {
  ensureFxTextures(scene);
  const q = Math.min(scale, QUANTITY_CAP);
  const g = fxGraphics(scene, 60, depthOffset);
  const flare = fxImage(scene, 60, depthOffset, FX_TEX.flare).setTint(hot(color)).setAlpha(0);
  const motes = fxEmitter(scene, 61, depthOffset, FX_TEX.spark, {
    emitting: false,
    lifespan: { min: 300, max: 600 },
    speed: { min: 5, max: 25 },
    angle: { min: 0, max: 360 },
    scale: { start: 0.45 * scale, end: 0 },
    alpha: { start: 1, end: 0 },
    tint: [hot(color), color],
  });
  const moteSpout = new FxSpout(motes);
  fxCounter(scene, depthOffset, {
    from: 0,
    to: 1,
    duration: NOVA_SUMMON_MS,
    ease: 'Cubic.easeOut',
    onUpdate: (tw) => {
      const t = tw.getValue() ?? 0;
      const now = scene.time.now;
      const r = (8 + t * 52) * scale;
      g.clear();
      drawAnnulus(g, color, to.x, to.y, r, 2.5 * scale, 0.3 + t * 0.5);
      drawRune(g, color, to.x, to.y, r, t, 0.2 + t * 0.5, scale, 1);
      placeAt(flare, to.x, to.y, (20 + 70 * t) * scale, 0.6 * t);
      flare.setAngle(t * 30);
      const ang = t * 9;
      moteSpout.emit(now, to.x + Math.cos(ang) * r, to.y + Math.sin(ang) * r, 45 * q);
    },
    onComplete: () => {
      g.destroy();
      flare.destroy();
      fxRetire(scene, depthOffset, motes, 700);
      onDone();
    },
  });
}

// Charge: the energy of the whole battlefield drawn up into the target --
// sparks born all over the visible floor (UltimateStage.floor, from the
// target's own floor line down to the bottom of the stage and across its
// width) each aimed at the core and arriving as its life ends, streaks of
// light climbing from floor points to the core on their own clocks, and
// the floor itself lit from beneath as it drains -- onto a brightening,
// pulsing core, while an accretion disc forms around it, lying at a tilt to
// the camera with arcs spinning in its plane, and a starburst grows at the
// centre: the inverse motion of playMeteorCharge's approach, so the two
// moves read as opposites (something arriving from outside vs. the ground
// itself gathering into one point before it blows back out) rather than
// variants of the same idea. The core's own growth (not the infall or its
// pulse, both still driven by raw `t`) saturates at HOLD_T of the phase and
// holds -- a "small -> big -> held, straining" beat, so the last stretch
// before Impact reads as a core visibly full and under pressure rather than
// one still visibly swelling right up to the cut.
function playNovaCharge(
  scene: Phaser.Scene,
  color: number,
  to: EffectAnchor,
  whiff: boolean,
  onDone: () => void,
  depthOffset: number,
  scale: number,
  groundDrop: number,
  stage: UltimateStage,
  shared: Shared
) {
  const q = Math.min(scale, QUANTITY_CAP);
  const g = fxGraphics(scene, 60, depthOffset);
  const disc = fxImage(scene, 59, depthOffset, FX_TEX.ring).setTint(color).setAlpha(0);
  const halo = fxImage(scene, 60, depthOffset, FX_TEX.glow).setTint(color).setAlpha(0);
  const core = fxImage(scene, 61, depthOffset, FX_TEX.glow).setTint(hot(color)).setAlpha(0);
  const flare = fxImage(scene, 61, depthOffset, FX_TEX.flare).setTint(hot(color)).setAlpha(0);
  // The floor the energy is drawn up out of: the whole visible floor, from
  // the target's own floor line down to the bottom of the stage and across
  // its full width (UltimateStage.floor), lit from beneath as it drains.
  const groundY0 = to.y + groundDrop;
  const floorY1 = Math.max(groundY0 + 1, stage.floor.y1);
  const floorPoint = () => ({ x: stage.floor.x0 + Math.random() * (stage.floor.x1 - stage.floor.x0), y: groundY0 + Math.random() * (floorY1 - groundY0) });
  const under = fxImage(scene, 58, depthOffset, FX_TEX.glow).setTint(color).setAlpha(0);
  // Each spark is born on the floor, aimed at the core on emit and given
  // exactly the speed that lands it there at the end of its life,
  // brightening from the move's color to its hot shade as it arrives.
  const infall = fxEmitter(scene, 61, depthOffset, FX_TEX.spark, {
    emitting: false,
    lifespan: { min: 600, max: 1200 },
    angle: { onEmit: (particle) => (particle ? Phaser.Math.RadToDeg(Math.atan2(to.y - particle.y, to.x - particle.x)) : 0) },
    speed: { onEmit: (particle) => (particle ? Math.hypot(to.x - particle.x, to.y - particle.y) / Math.max(0.05, particle.life / 1000) : 0) },
    scale: { start: 0.45 * scale, end: 0.14 * scale },
    alpha: { start: 0.2, end: 1 },
    tint: [color, hot(color)],
  });
  const infallSpout = new FxSpout(infall);
  // Streaks of light drawn in from the floor, each on its own clock,
  // respawning at a fresh floor point when it reaches the core.
  const streaks = Array.from({ length: 14 }, (_, i) => ({
    from: floorPoint(),
    phase: Math.random(),
    speed: 0.7 + Math.random() * 0.7,
    pale: i % 2 === 0,
    last: 0,
  }));
  fxCounter(scene, depthOffset, {
    from: 0,
    to: 1,
    duration: NOVA_CHARGE_MS,
    ease: 'Cubic.easeIn',
    onUpdate: (tw) => {
      const t = tw.getValue() ?? 0;
      const now = scene.time.now;
      const growT = Math.min(t / HOLD_T, 1);
      const coreR = (6 + growT * (NOVA_CORE_R - 6)) * scale;
      // Over the last stretch what is still coming in is drawn into the
      // core, so nothing is left mid-flight for Impact to cut.
      const gather = 1 - clamp01((t - 0.9) / 0.1);
      // The pulse flattens out across the hold beat on a whiff (strainAt) --
      // the same slack the meteor's tremble loses, so both Ultimates read as
      // having gone dead a moment before they come apart.
      const pulse = 0.7 + 0.3 * Math.sin(t * 36) * strainAt(t, whiff);
      g.clear();
      // Each streak runs its own rise on its own clock -- a line of light
      // climbing from a point on the floor to the core, brightening as it
      // arrives -- and respawns at another floor point when it gets there,
      // so the whole floor reads as feeding the core rather than one ring
      // contracting.
      for (const streak of streaks) {
        const cycle = t * streak.speed + streak.phase;
        const p = cycle % 1;
        if (Math.floor(cycle) !== streak.last) {
          streak.last = Math.floor(cycle);
          streak.from = floorPoint();
        }
        const along = Math.pow(p, 0.8);
        const hx = streak.from.x + (to.x - streak.from.x) * along;
        const hy = streak.from.y + (to.y - streak.from.y) * along;
        const tailF = Math.max(0, along - 0.06 - 0.08 * p);
        g.lineStyle(2 * scale, streak.pale ? hot(color) : color, 0.8 * p * gather);
        g.lineBetween(streak.from.x + (to.x - streak.from.x) * tailF, streak.from.y + (to.y - streak.from.y) * tailF, hx, hy);
      }
      // The floor lit from beneath, brightest under the target, as the
      // energy comes up out of it.
      layFlat(under, to.x, groundY0 + (floorY1 - groundY0) * 0.25, (stage.floor.x1 - stage.floor.x0) * 0.9, 0.12 + 0.3 * t * strainAt(t, whiff));
      const discR = coreR * NOVA_RING_FACTOR * 1.15;
      disc.setPosition(to.x, to.y).setDisplaySize(ringDisplaySize(discR), ringDisplaySize(discR) * DISC_TILT).setAlpha(0.45 * t);
      drawRune(g, color, to.x, to.y, discR, t * 2.5, 0.3 + 0.5 * t, scale, DISC_TILT);
      drawAnnulus(g, color, to.x, to.y, coreR * NOVA_RING_FACTOR, (2 + t * 3) * scale, 0.25 + t * 0.5);
      placeAt(halo, to.x, to.y, coreR * 6 * pulse, 0.35 + 0.35 * t);
      placeAt(core, to.x, to.y, coreR * 2.2 * pulse, 0.55 + t * 0.4);
      placeAt(flare, to.x, to.y, coreR * 4.5 * (0.5 + 0.5 * t), 0.35 + 0.55 * t);
      flare.setAngle(t * 60);
      infallSpout.emitEach(now, 110 * q * (0.4 + t) * gather, floorPoint);
    },
    onComplete: () => {
      [g, flare, under].forEach((o) => o.destroy());
      fxRetire(scene, depthOffset, infall, 1200);
      // The centre carries on into Impact and Aftermath (NovaCore).
      shared.novaCore = { core, halo, disc };
      onDone();
    },
  });
}

// The nova's counterpart to the meteor's break-up: Charge's infall run
// backwards. Everything it spent two seconds pulling in streams back out as
// streaks and sparks losing their light, the core shrinking behind them and
// the disc drifting off, with no flash and no rays -- what gathered at the
// target leaves again instead of going off there.
function startNovaFizzle(scene: Phaser.Scene, to: EffectAnchor, depthOffset: number, scale: number): Fizzle {
  const g = fxGraphics(scene, 61, depthOffset);
  const core = fxImage(scene, 61, depthOffset, FX_TEX.glow).setTint(FIZZLE_GREY);
  const disc = fxImage(scene, 59, depthOffset, FX_TEX.ring).setTint(FIZZLE_GREY);
  const sparks = fxEmitter(scene, 61, depthOffset, FX_TEX.spark, {
    emitting: false,
    lifespan: { min: 900, max: 1500 },
    speed: { min: 60, max: 220 },
    angle: { min: 0, max: 360 },
    scale: { start: 0.5 * scale, end: 0.1 * scale },
    alpha: { start: 0.9, end: 0 },
    tint: [FIZZLE_GREY, FIZZLE_GREY],
  });
  sparks.explode(Math.round(40 * Math.min(scale, QUANTITY_CAP)), to.x, to.y);
  return {
    draw(p) {
      const fade = 1 - p;
      g.clear();
      for (let i = 0; i < 14; i++) {
        const ang = (i / 14) * Math.PI * 2 + p * 0.9;
        const cos = Math.cos(ang);
        const sin = Math.sin(ang);
        const r = (NOVA_CORE_R * 0.7 + Math.pow(p, 0.7) * 120) * scale;
        const tail = r - Math.max(4, 16 - p * 9) * scale;
        g.lineStyle(2 * scale, i % 2 === 0 ? 0xcccccc : FIZZLE_GREY, 0.7 * Math.pow(fade, 0.75));
        g.lineBetween(to.x + cos * tail, to.y + sin * tail, to.x + cos * r, to.y + sin * r);
      }
      placeAt(core, to.x, to.y, NOVA_CORE_R * 2.2 * (1 - p * 0.6) * scale, 0.6 * Math.pow(fade, 1.4));
      const discR = (NOVA_CORE_R * NOVA_RING_FACTOR + Math.pow(p, 0.7) * 90) * scale;
      disc.setPosition(to.x, to.y).setDisplaySize(ringDisplaySize(discR), ringDisplaySize(discR) * DISC_TILT).setAlpha(0.35 * fade);
    },
    destroy() {
      [g, core, disc].forEach((o) => o.destroy());
      fxRetire(scene, depthOffset, sparks, 1600);
    },
  };
}

// The nova's centre, built by Charge and carried through Impact into
// Aftermath rather than rebuilt per phase, so the core never blinks and the
// accretion disc is the same ring that the blast blows outward as the
// sphere's equator.
interface NovaCore {
  core: Phaser.GameObjects.Image;
  halo: Phaser.GameObjects.Image;
  disc: Phaser.GameObjects.Image;
}

// How long the nova's sphere lives, from the strike: it grows across the
// Impact phase and on into the Aftermath, fading by distance as it goes.
const NOVA_BLAST_MS = 1500;

// The sphere: a dense body of the move's energy -- two orb layers turning
// against each other under a slowly turning plasma skin, with a hotter
// heart that dies faster than the rest -- under a limb of its own color and
// a hotter, thinner one just inside it for thickness, with the accretion
// disc blown out as a ring in the same tilted plane. Born by Impact on the
// frame of the strike and drawn by both Impact and Aftermath against the
// clock it was born on, so the handover between the phases is invisible.
interface NovaBlast {
  body: Phaser.GameObjects.Image;
  body2: Phaser.GameObjects.Image;
  plasma: Phaser.GameObjects.Image;
  heart: Phaser.GameObjects.Image;
  shell: Phaser.GameObjects.Image;
  shellHot: Phaser.GameObjects.Image;
  start: number;
}

function startNovaBlast(scene: Phaser.Scene, color: number, depthOffset: number): NovaBlast {
  return {
    body: fxImage(scene, 60, depthOffset, FX_TEX.orb).setTint(color),
    body2: fxImage(scene, 60, depthOffset, FX_TEX.orb).setTint(blend(color, hot(color), 0.35)),
    plasma: fxImage(scene, 60, depthOffset, FX_TEX.plasma).setTint(hot(color)),
    heart: fxImage(scene, 60, depthOffset, FX_TEX.glow).setTint(hot(color)),
    shell: fxImage(scene, 60, depthOffset, FX_TEX.shell).setTint(color),
    shellHot: fxImage(scene, 61, depthOffset, FX_TEX.shell).setTint(hot(color)),
    start: scene.time.now,
  };
}

// The sphere at time `now`: growing out of the centre at a blast wave's pace
// (radius as the two-fifths power of time, Sedov-Taylor: it leaps out and
// then slows), its brightness a function of how far it has travelled and
// gone entirely at NOVA_SHOCK_R -- a front that fades with distance rather
// than on a clock, so it fades at the same radius at any level. The disc it
// blows out starts at the radius Charge left it and rides the front once the
// front has passed it.
function drawNovaBlast(blast: NovaBlast, core: NovaCore | undefined, now: number, to: EffectAnchor, scale: number, discR0: number) {
  const q = clamp01((now - blast.start) / NOVA_BLAST_MS);
  const shockR = NOVA_SHOCK_R * scale * Math.pow(q, 0.4);
  const travelled = shockR / (NOVA_SHOCK_R * scale);
  const left = 1 - travelled;
  const bodySize = orbDisplaySize(shockR);
  blast.body.setPosition(to.x, to.y).setDisplaySize(bodySize, bodySize).setAngle(q * 40).setAlpha(0.9 * left);
  blast.body2.setPosition(to.x, to.y).setDisplaySize(bodySize * 0.94, bodySize * 0.94).setAngle(45 - q * 60).setAlpha(0.6 * Math.pow(left, 1.2));
  blast.plasma.setPosition(to.x, to.y).setDisplaySize(bodySize, bodySize).setAngle(q * 25).setAlpha(0.85 * Math.pow(left, 1.1));
  placeAt(blast.heart, to.x, to.y, shockR * 1.6, 0.6 * Math.pow(left, 2.2));
  const shellSize = shellDisplaySize(shockR);
  blast.shell.setPosition(to.x, to.y).setDisplaySize(shellSize, shellSize).setAlpha(0.95 * Math.pow(left, 1.3));
  const hotSize = shellDisplaySize(shockR * 0.9);
  blast.shellHot.setPosition(to.x, to.y).setDisplaySize(hotSize, hotSize).setAlpha(0.6 * Math.pow(left, 2.2));
  if (core) {
    const eqR = Math.max(shockR * 1.02, discR0);
    const eqSize = ringDisplaySize(eqR);
    core.disc.setPosition(to.x, to.y).setDisplaySize(eqSize, eqSize * DISC_TILT).setAlpha(0.45 * Math.pow(left, 1.6));
  }
}

function endNovaBlast(blast: NovaBlast) {
  [blast.body, blast.body2, blast.plasma, blast.heart, blast.shell, blast.shellHot].forEach((o) => o.destroy());
}

// Impact (`ultimateNova`): calls `onImpact()` immediately, then either the
// blast -- a flash, then the sphere (startNovaBlast) growing out of the
// centre while the core it grows from keeps burning and the disc is blown
// out with it, with a lens streak clean across the field, rays and sparks
// flung out in every direction and glowing gas billowing outward -- or, on
// a whiff, Charge's own infall run backwards: everything it gathered
// streaming back out and going dark instead of detonating. Every light
// ADD-blend and alpha-faded throughout, same reasoning as playMeteorImpact's
// own comment: brightens what's underneath for a beat rather than opaquely
// hiding it.
function playNovaImpact(
  scene: Phaser.Scene,
  color: number,
  to: EffectAnchor,
  whiff: boolean,
  onImpact: () => void,
  onDone: () => void,
  depthOffset: number,
  scale: number,
  shared: Shared
) {
  onImpact();
  if (whiff) {
    // The fizzle has a grey centre of its own; the lit one goes at once.
    const nc = shared.novaCore;
    if (nc) [nc.core, nc.halo, nc.disc].forEach((o) => o.destroy());
    shared.novaCore = undefined;
    const fizzle = startNovaFizzle(scene, to, depthOffset, scale);
    shared.fizzle = fizzle;
    fxCounter(scene, depthOffset, {
      from: 0,
      to: 1,
      duration: NOVA_IMPACT_MS,
      // Linear, for the same reason playMeteorImpact's whiff is (the outflow
      // spans this phase and the Aftermath as one motion).
      ease: 'Linear',
      onUpdate: (tw) => fizzle.draw((tw.getValue() ?? 0) * NOVA_FIZZLE_SPLIT),
      onComplete: onDone,
    });
    return;
  }

  const q = Math.min(scale, QUANTITY_CAP);
  const core = shared.novaCore;
  const discR0 = NOVA_CORE_R * NOVA_RING_FACTOR * 1.15 * scale;
  const flash = fxImage(scene, 61, depthOffset, FX_TEX.glow).setTint(hot(color));
  const streak = fxImage(scene, 61, depthOffset, FX_TEX.streak).setTint(hot(color));
  const rays = fxImage(scene, 60, depthOffset, FX_TEX.rays).setTint(color);
  const nebula = fxEmitter(scene, 59, depthOffset, FX_TEX.smoke, {
    emitting: false,
    lifespan: { min: 900, max: 1600 },
    speed: { min: 40, max: 170 },
    angle: { min: 0, max: 360 },
    rotate: { min: 0, max: 360 },
    scale: { start: 0.2 * scale, end: 0.7 * scale },
    alpha: { start: 0.4, end: 0 },
    tint: [hot(color), color, darken(color, 50)],
  });
  const sparks = fxEmitter(scene, 61, depthOffset, FX_TEX.spark, {
    emitting: false,
    lifespan: { min: 500, max: 1000 },
    speed: { min: 150, max: 480 },
    angle: { min: 0, max: 360 },
    scale: { start: 0.7 * scale, end: 0 },
    alpha: { start: 1, end: 0 },
    tint: [hot(color), color],
  });
  nebula.explode(Math.round(18 * q), to.x, to.y);
  sparks.explode(Math.round(80 * q), to.x, to.y);
  const blast = startNovaBlast(scene, color, depthOffset);
  shared.blast = blast;
  fxCounter(scene, depthOffset, {
    from: 0,
    to: 1,
    duration: NOVA_IMPACT_MS,
    // Linear, with the flash, rays and streak easing out on their own and
    // the sphere on its own clock (drawNovaBlast).
    ease: 'Linear',
    onUpdate: (tw) => {
      const t = tw.getValue() ?? 0;
      const tOut = Phaser.Math.Easing.Cubic.Out(t);
      const now = scene.time.now;
      placeAt(flash, to.x, to.y, (70 + 560 * tOut) * scale, 0.96 * Math.pow(1 - tOut, 2));
      streak.setPosition(to.x, to.y).setDisplaySize((300 + 900 * tOut) * scale, 12 * scale).setAlpha(0.9 * Math.pow(1 - tOut, 2.5));
      placeAt(rays, to.x, to.y, (100 + 700 * tOut) * scale, 0.6 * Math.pow(1 - tOut, 1.5));
      rays.setAngle(tOut * 25);
      drawNovaBlast(blast, core, now, to, scale, discR0);
      if (core) {
        // The core the blast grows from, still burning at its heart and
        // shrinking as its energy goes out into the sphere.
        placeAt(core.core, to.x, to.y, NOVA_CORE_R * 2.2 * scale * (1 - 0.5 * tOut), 0.9 * (1 - 0.6 * tOut));
        placeAt(core.halo, to.x, to.y, NOVA_CORE_R * 6 * scale, 0.7 * (1 - tOut));
      }
    },
    onComplete: () => {
      [flash, streak, rays].forEach((o) => o.destroy());
      fxRetire(scene, depthOffset, nebula, 1700);
      fxRetire(scene, depthOffset, sparks, 1100);
      onDone();
    },
  });
}

// Aftermath (`ultimateNova`): the sphere Impact set off going on out and
// fading by distance (drawNovaBlast), the core cooling from its hot shade
// into the move's own color and shrinking away, gas and sparks drifting out
// from where it was -- or, on a whiff, the tail of the outflow Impact
// started. Ends by tearing down what the phases shared and firing
// `onComplete` exactly once.
function playNovaAftermath(
  scene: Phaser.Scene,
  color: number,
  to: EffectAnchor,
  whiff: boolean,
  onComplete: () => void,
  depthOffset: number,
  scale: number,
  shared: Shared
) {
  if (whiff) {
    const fizzle = shared.fizzle;
    fxCounter(scene, depthOffset, {
      from: 0,
      to: 1,
      duration: NOVA_AFTERMATH_MS,
      ease: 'Linear',
      // Same continuation Impact's own whiff branch started -- the outflow
      // keeps going and thins to nothing.
      onUpdate: (tw) => fizzle?.draw(NOVA_FIZZLE_SPLIT + (tw.getValue() ?? 0) * (1 - NOVA_FIZZLE_SPLIT)),
      onComplete: () => {
        fizzle?.destroy();
        shared.fizzle = undefined;
        onComplete();
      },
    });
    return;
  }

  const q = Math.min(scale, QUANTITY_CAP);
  const core = shared.novaCore;
  const blast = shared.blast;
  const discR0 = NOVA_CORE_R * NOVA_RING_FACTOR * 1.15 * scale;
  const gas = fxEmitter(scene, 59, depthOffset, FX_TEX.smoke, {
    emitting: false,
    lifespan: { min: 800, max: 1400 },
    speed: { min: 20, max: 70 },
    angle: { min: 0, max: 360 },
    rotate: { min: 0, max: 360 },
    scale: { start: 0.2 * scale, end: 0.8 * scale },
    alpha: { start: 0.45, end: 0 },
    tint: [color, darken(color, 60)],
  });
  const sparks = fxEmitter(scene, 61, depthOffset, FX_TEX.spark, {
    emitting: false,
    lifespan: { min: 600, max: 1200 },
    speed: { min: 20, max: 90 },
    angle: { min: 0, max: 360 },
    scale: { start: 0.4 * scale, end: 0 },
    alpha: { start: 1, end: 0 },
    tint: [hot(color), color],
  });
  const gasSpout = new FxSpout(gas);
  const sparkSpout = new FxSpout(sparks);
  fxCounter(scene, depthOffset, {
    from: 0,
    to: 1,
    duration: NOVA_AFTERMATH_MS,
    ease: 'Linear',
    onUpdate: (tw) => {
      const t = tw.getValue() ?? 0;
      const now = scene.time.now;
      const ease = Phaser.Math.Easing.Sine.Out(t);
      if (blast) drawNovaBlast(blast, core, now, to, scale, discR0);
      if (core) {
        // Picks the core up at the size and brightness Impact left it and
        // cools it, its tint going from the hot shade to the move's own.
        core.core.setTint(blend(hot(color), color, ease));
        placeAt(core.core, to.x, to.y, NOVA_CORE_R * 1.1 * scale * (1 - ease), 0.36 * (1 - ease));
        core.halo.setAlpha(0);
      }
      const within = () => ({ x: to.x + (Math.random() - 0.5) * 60 * scale, y: to.y + (Math.random() - 0.5) * 60 * scale });
      gasSpout.emitEach(now, 40 * q * (1 - t), within);
      sparkSpout.emitEach(now, 30 * q * (1 - t), within);
    },
    onComplete: () => {
      if (core) [core.core, core.halo, core.disc].forEach((o) => o.destroy());
      if (blast) endNovaBlast(blast);
      shared.novaCore = undefined;
      shared.blast = undefined;
      fxRetire(scene, depthOffset, gas, 1500);
      fxRetire(scene, depthOffset, sparks, 1300);
      onComplete();
    },
  });
}

// `ultimateNova` -- see the shared Ultimate-tier comment above for the
// phase/callback contract. Reads as something collapsing inward then
// blowing back outward from the target's own position, distinct from
// playMeteor's mass falling in from above.
export function playNova(
  scene: Phaser.Scene,
  color: number,
  to: EffectAnchor,
  whiff: boolean,
  onImpact: () => void,
  onComplete: () => void,
  depthOffset = 0,
  scale = 1,
  groundDrop = GROUND_DROP,
  stage: UltimateStage = DEFAULT_ULTIMATE_STAGE
) {
  const shared: Shared = {};
  playNovaSummon(scene, color, to, () => {
    playNovaCharge(scene, color, to, whiff, () => {
      playNovaImpact(scene, color, to, whiff, onImpact, () => {
        playNovaAftermath(scene, color, to, whiff, onComplete, depthOffset, scale, shared);
      }, depthOffset, scale, shared);
    }, depthOffset, scale, groundDrop, stage, shared);
  }, depthOffset, scale);
}
