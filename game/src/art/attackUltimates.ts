import Phaser from 'phaser';
import type { EffectAnchor } from './attackAnchors';
import { GROUND_DROP, GROUND_ASPECT, drawAnnulus, drawArcRing } from './attackShapes';
import { fxGraphics, fxImage, fxEmitter, fxRetire, fxCounter, FxSpout } from './attackFx';
import { ensureFxTextures, FX_TEX, ROCK_FRAMES, ringDisplaySize, rockDisplaySize } from './fxTextures';
import { layFlat, placeAt, groundAngle, tumble, belowGround, QUANTITY_CAP } from './attackAnalytics';
import { blend, darken } from './colors';

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
// than flat fills: the meteor is a shaded rock with a molten leading face,
// a fire-and-smoke trail and a shadow tightening on the floor as it comes
// down; the nova a white-hot core inside an accretion disc, matter falling
// in as sparks; the strikes real shockwaves, dust, debris under gravity,
// lens streaks and glowing gas. Every light is tinted the move's own
// currently-tuned quasiparticle color.
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
const METEOR_SUMMON_MS = 1300;
const METEOR_CHARGE_MS = 2000;
const METEOR_IMPACT_MS = 900;
const METEOR_AFTERMATH_MS = 1000;
export const METEOR_TOTAL_MS = METEOR_SUMMON_MS + METEOR_CHARGE_MS + METEOR_IMPACT_MS + METEOR_AFTERMATH_MS; // 5200ms

const NOVA_SUMMON_MS = 1200;
const NOVA_CHARGE_MS = 1900;
const NOVA_IMPACT_MS = 850;
const NOVA_AFTERMATH_MS = 950;
export const NOVA_TOTAL_MS = NOVA_SUMMON_MS + NOVA_CHARGE_MS + NOVA_IMPACT_MS + NOVA_AFTERMATH_MS; // 4900ms

// The Charge phase's own end state, shared with the phases either side of it:
// the whiff dissipation builds exactly the silhouette Charge left hanging
// over the target and pulls that apart, so the two have to agree on where the
// mass ends up and how big it is or the handover shows as a visible cut.
const METEOR_HOVER_DY = -34;
const METEOR_MASS_R = 58;
const METEOR_ORBIT_FACTOR = 1.6;
const METEOR_RUNE_R = 58;
const NOVA_CORE_R = 32;
const NOVA_RING_FACTOR = 2.4;
// The nova's accretion disc lies at this tilt to the camera.
const DISC_TILT = 0.32;
// The heat of the meteor's leading face, blended into the move's own color.
const FACE_HEAT = 0xffc070;

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
function playMeteorSummon(scene: Phaser.Scene, color: number, to: EffectAnchor, onDone: () => void, depthOffset = 0, scale = 1) {
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
    tint: [0xffffff, color],
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
      tint: [0x7a7482, 0x7a7482],
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
      const groundY = to.y + GROUND_DROP;
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

// Charge: a rock the size of the target, its leading face heated white,
// wrapped in the move's own light and trailing fire and smoke, with small
// chunks orbiting it, descending from off the top of the screen to hang just
// above the target -- a mass, not a shot -- while its shadow tightens and
// darkens on the floor beneath and the summon circle keeps pulsing there.
// Its arrival/growth is driven by `growT`, not the raw tween `t` -- reaching
// full size and position by HOLD_T of the phase and holding there for the
// rest (mass still burning/orbiting/turning on raw `t`, just no longer
// growing or falling) reads as "reared back and straining, about to blow"
// for that last stretch, the held-breath beat right before Impact's onImpact
// fires. onImpact itself stays at frame 0 of the Impact phase (mirrors every
// other shape's land()), so this hold -- not a delayed onImpact -- is what
// sells "suddenly explode" rather than "still visibly growing when it
// detonates".
function playMeteorCharge(
  scene: Phaser.Scene,
  color: number,
  to: EffectAnchor,
  whiff: boolean,
  onDone: () => void,
  depthOffset = 0,
  scale = 1
) {
  const q = Math.min(scale, QUANTITY_CAP);
  const rune = fxGraphics(scene, 58, depthOffset);
  const under = fxImage(scene, 58, depthOffset, FX_TEX.glow).setTint(color).setAlpha(0);
  const shadow = fxImage(scene, 58, depthOffset, FX_TEX.glow, undefined, Phaser.BlendModes.MULTIPLY).setTint(0x000000).setAlpha(0);
  const rock = fxImage(scene, 60, depthOffset, FX_TEX.rock, ROCK_FRAMES[0], Phaser.BlendModes.NORMAL);
  const halo = fxImage(scene, 59, depthOffset, FX_TEX.glow).setTint(color);
  const face = fxImage(scene, 61, depthOffset, FX_TEX.glow).setTint(blend(color, FACE_HEAT, 0.55));
  const chunks = Array.from({ length: 5 }, (_, i) => fxImage(scene, 60, depthOffset, FX_TEX.rock, ROCK_FRAMES[1 + (i % 2)], Phaser.BlendModes.NORMAL));
  const fire = fxEmitter(scene, 60, depthOffset, FX_TEX.glow, {
    emitting: false,
    lifespan: { min: 320, max: 640 },
    speed: { min: 30, max: 110 },
    angle: { min: 250, max: 290 },
    gravityY: -90,
    scale: { start: 0.2 * scale, end: 0.03 },
    alpha: { start: 0.9, end: 0 },
    tint: [0xffffff, color, darken(color, 70)],
  });
  const smoke = fxEmitter(
    scene,
    59,
    depthOffset,
    FX_TEX.smoke,
    {
      emitting: false,
      lifespan: { min: 650, max: 1200 },
      speed: { min: 12, max: 45 },
      angle: { min: 250, max: 290 },
      gravityY: -40,
      rotate: { min: 0, max: 360 },
      scale: { start: 0.2 * scale, end: 0.8 * scale },
      alpha: { start: 0.38, end: 0 },
      tint: [0x5a545e, 0x5a545e],
    },
    Phaser.BlendModes.NORMAL
  );
  const sparks = fxEmitter(scene, 61, depthOffset, FX_TEX.spark, {
    emitting: false,
    lifespan: { min: 200, max: 450 },
    speed: { min: 40, max: 170 },
    angle: { min: 200, max: 340 },
    gravityY: 150,
    scale: { start: 0.4 * scale, end: 0 },
    alpha: { start: 1, end: 0 },
    tint: [0xffffff, color],
  });
  const fireSpout = new FxSpout(fire);
  const smokeSpout = new FxSpout(smoke);
  const sparkSpout = new FxSpout(sparks);
  // Fully off the top of the frame even at a leveled repeat's size.
  const originY = -60 - METEOR_MASS_R * scale;
  fxCounter(scene, depthOffset, {
    from: 0,
    to: 1,
    duration: METEOR_CHARGE_MS,
    // Linear, with the arrival shaped below -- an eased counter leaves the
    // mass loitering off the top of the screen for most of the phase and
    // then drops it all at once, which spends the hold beat before it can
    // be seen.
    ease: 'Linear',
    onUpdate: (tw) => {
      const t = tw.getValue() ?? 0;
      const now = scene.time.now;
      const groundY = to.y + GROUND_DROP;
      // Punches into frame fast, then brakes into the hover: the mass is
      // full-size and in place by HOLD_T of the phase and strains there for
      // the rest, the held breath before Impact fires -- strain that goes
      // slack instead (strainAt) when the cast has already failed.
      const growT = Phaser.Math.Easing.Cubic.Out(Math.min(t / HOLD_T, 1));
      const strain = strainAt(t, whiff);
      const tremble = Math.sin(t * 70) * 2.5 * scale * Math.max(0, (t - 0.6) / 0.4) * strain;
      const massX = to.x + tremble;
      const massY = Phaser.Math.Linear(originY, to.y + METEOR_HOVER_DY, growT);
      const massR = (14 + growT * (METEOR_MASS_R - 14)) * scale;
      const heat = 0.7 + 0.3 * Math.sin(t * 40) * strain;

      const bodySize = rockDisplaySize(massR);
      rock.setPosition(massX, massY).setDisplaySize(bodySize, bodySize).setAngle(t * 90 + tremble * 3);
      // The heated face sits low in the body, so it reads as a lit mass with
      // a direction of travel instead of a flat glowing ball.
      placeAt(halo, massX, massY + massR * 0.2, massR * 2.8, 0.18 + 0.12 * heat);
      placeAt(face, massX, massY + massR * 0.55, massR * 1.3, 0.6 * heat);
      chunks.forEach((chunk, i) => {
        const ang = t * 9 + (i / chunks.length) * Math.PI * 2;
        const orbR = massR * METEOR_ORBIT_FACTOR;
        const size = rockDisplaySize(4.5 * scale);
        chunk
          .setPosition(massX + Math.cos(ang) * orbR, massY + Math.sin(ang) * orbR * 0.6)
          .setDisplaySize(size, size)
          .setAngle(t * 300 + i * 70);
      });
      fireSpout.emitEach(now, 160 * q * (0.4 + 0.6 * growT), () => ({
        x: massX + (Math.random() - 0.5) * massR * 0.8,
        y: massY - massR * 0.3,
      }));
      smokeSpout.emitEach(now, 36 * q, () => ({ x: massX + (Math.random() - 0.5) * massR * 0.6, y: massY - massR * 0.7 }));
      sparkSpout.emitEach(now, 25 * q, () => ({ x: massX + (Math.random() - 0.5) * massR, y: massY + massR * 0.4 }));

      // The shadow the mass throws on the floor, wide and faint while it is
      // high, tightening and darkening as it comes down to hover.
      layFlat(shadow, to.x, groundY, massR * 2.8 * (1.6 - 0.6 * growT), 0.12 + 0.45 * growT);

      rune.clear();
      const pulse = 0.6 + 0.4 * Math.sin(t * 28);
      const circleR = (METEOR_RUNE_R + Math.sin(t * 10) * 4) * scale;
      drawAnnulus(rune, color, to.x, groundY, circleR, 3 * scale, 0.4 * pulse, GROUND_ASPECT);
      drawAnnulus(rune, 0xffffff, to.x, groundY, circleR * 1.3, 2 * scale, 0.3 * pulse, GROUND_ASPECT);
      layFlat(under, to.x, groundY, 200 * scale, 0.15 + 0.35 * pulse);
    },
    onComplete: () => {
      [rune, under, shadow, rock, halo, face, ...chunks].forEach((o) => o.destroy());
      fxRetire(scene, depthOffset, fire, 700);
      fxRetire(scene, depthOffset, smoke, 1300);
      fxRetire(scene, depthOffset, sparks, 500);
      onDone();
    },
  });
}

// The meteor's mass coming apart where Charge left it hanging: its light
// dies almost at once, the rock dims and shrinks in place behind a puff of
// grey smoke, and chunks of it fly outward on an ease-out (fast, then
// coasting) while sagging a little and tumbling. Everything stays well above
// the floor -- ground contact is the language of a strike that landed, so a
// whiff never draws anything on the ground plane except the summon rune it
// is letting go of.
function startMeteorFizzle(scene: Phaser.Scene, to: EffectAnchor, depthOffset: number, scale: number): Fizzle {
  const body = fxImage(scene, 60, depthOffset, FX_TEX.rock, ROCK_FRAMES[0], Phaser.BlendModes.NORMAL).setTint(FIZZLE_GREY);
  const halo = fxImage(scene, 59, depthOffset, FX_TEX.glow).setTint(FIZZLE_GREY);
  const frags = Array.from({ length: 9 }, (_, i) => fxImage(scene, 60, depthOffset, FX_TEX.rock, ROCK_FRAMES[i % ROCK_FRAMES.length], Phaser.BlendModes.NORMAL).setTint(FIZZLE_GREY));
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
      scale: { start: 0.2 * scale, end: 0.7 * scale },
      alpha: { start: 0.3, end: 0 },
      tint: [0x77747a, 0x77747a],
    },
    Phaser.BlendModes.NORMAL
  );
  smoke.explode(Math.round(10 * Math.min(scale, QUANTITY_CAP)), to.x, to.y + METEOR_HOVER_DY);
  return {
    draw(p) {
      const fade = 1 - p;
      const hoverY = to.y + METEOR_HOVER_DY - p * 14 * scale;
      const r = METEOR_MASS_R * (1 - p * 0.55) * scale;
      const size = rockDisplaySize(r);
      body.setPosition(to.x, hoverY).setDisplaySize(size, size).setAlpha(clamp01(1 - p * 2.2));
      placeAt(halo, to.x, hoverY, r * 3, 0.4 * Math.pow(fade, 1.5));
      frags.forEach((frag, i) => {
        const ang = (i / frags.length) * Math.PI * 2 + i * 0.7;
        const dist = Math.pow(p, 0.65) * (70 + (i % 3) * 26) * scale;
        const fragSize = rockDisplaySize(Math.max(0.6, (7 - (i % 3) * 1.6) * (1 - p * 0.5) * scale));
        frag
          .setPosition(to.x + Math.cos(ang) * dist, hoverY + Math.sin(ang) * dist * 0.55 + p * p * 26 * scale)
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

// Impact (`ultimateMeteor`): calls `onImpact()` immediately, then plays
// either the full heavy slam -- a blinding flash, a shockwave and a slower
// ring of dust racing out across the floor, a burst of rays, a lens streak
// across the point of contact, rock thrown up under gravity that tumbles and
// falls back, embers, fire and a rolling cloud of dust, over a crater left
// glowing -- big enough to reach most of the 854x480 field (FIELD_W/FIELD_H,
// BattleScene.ts), the "explosion fills the screen" beat the small-then-big
// charge above was building toward -- or, on a whiff, the hovering mass
// coming apart where it hangs, which reads as "it never got there" rather
// than as a weaker version of the same boom. Every light here is ADD-blend
// and alpha-fades with `t` rather than an opaque fill, so the log text/HP
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
  shared: Shared
) {
  onImpact();
  if (whiff) {
    const g = fxGraphics(scene, 60, depthOffset);
    const fizzle = startMeteorFizzle(scene, to, depthOffset, scale);
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
        const groundY = to.y + GROUND_DROP;
        g.clear();
        fizzle.draw(t * METEOR_FIZZLE_SPLIT);
        // The summon rune goes out along with the mass rather than being cut
        // off mid-pulse; it is the only thing a whiff ever draws on the
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
  const groundY0 = to.y + GROUND_DROP;
  const flash = fxImage(scene, 61, depthOffset, FX_TEX.glow);
  const shock = fxImage(scene, 59, depthOffset, FX_TEX.ring).setTint(color);
  const dustRing = fxImage(scene, 58, depthOffset, FX_TEX.ring, undefined, Phaser.BlendModes.NORMAL).setTint(0xd8ccc0);
  const rays = fxImage(scene, 60, depthOffset, FX_TEX.rays).setTint(color);
  const streak = fxImage(scene, 61, depthOffset, FX_TEX.streak);
  const crater = fxImage(scene, 58, depthOffset, FX_TEX.glow).setTint(color);
  const rocks = fxEmitter(
    scene,
    60,
    depthOffset,
    FX_TEX.rock,
    {
      frame: [...ROCK_FRAMES],
      emitting: false,
      lifespan: { min: 800, max: 1400 },
      speed: { min: 150, max: 420 },
      angle: { min: 215, max: 325 },
      gravityY: 700,
      scale: { min: 0.14 * scale, max: 0.36 * scale },
      rotate: tumble,
      deathZone: belowGround(groundY0),
    },
    Phaser.BlendModes.NORMAL
  );
  const embers = fxEmitter(scene, 61, depthOffset, FX_TEX.spark, {
    emitting: false,
    lifespan: { min: 500, max: 1100 },
    speed: { min: 120, max: 380 },
    angle: { min: 200, max: 340 },
    gravityY: 260,
    scale: { start: 0.6 * scale, end: 0 },
    alpha: { start: 1, end: 0 },
    tint: [0xffffff, color],
  });
  const fire = fxEmitter(scene, 60, depthOffset, FX_TEX.glow, {
    emitting: false,
    lifespan: { min: 300, max: 700 },
    speed: { min: 60, max: 220 },
    angle: { min: 200, max: 340 },
    gravityY: 120,
    scale: { start: 0.22 * scale, end: 0.04 },
    alpha: { start: 0.9, end: 0 },
    tint: [0xffffff, color, darken(color, 70)],
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
      tint: [0x7a716a, 0x7a716a],
    },
    Phaser.BlendModes.NORMAL
  );
  rocks.explode(Math.round(18 * q), to.x, groundY0 - 6);
  embers.explode(Math.round(60 * q), to.x, groundY0 - 6);
  fire.explode(Math.round(26 * q), to.x, groundY0 - 6);
  dust.explode(Math.round(24 * q), to.x, groundY0);
  fxCounter(scene, depthOffset, {
    from: 0,
    to: 1,
    duration: METEOR_IMPACT_MS,
    ease: 'Cubic.easeOut',
    onUpdate: (tw) => {
      const t = tw.getValue() ?? 0;
      const groundY = to.y + GROUND_DROP;
      placeAt(flash, to.x, groundY - 10 * scale, (60 + 620 * t) * scale, 0.95 * Math.pow(1 - t, 1.5));
      layFlat(shock, to.x, groundY, ringDisplaySize((16 + 300 * t) * scale), 0.9 * Math.pow(1 - t, 0.6));
      layFlat(dustRing, to.x, groundY, ringDisplaySize((8 + 230 * t) * scale), 0.6 * Math.pow(1 - t, 0.7));
      layFlat(rays, to.x, groundY, (80 + 640 * t) * scale, 0.75 * (1 - t));
      rays.setAngle(t * 14);
      streak.setPosition(to.x, groundY - 8 * scale).setDisplaySize((240 + 700 * t) * scale, 10 * scale).setAlpha(0.9 * Math.pow(1 - t, 2));
      layFlat(crater, to.x, groundY, 240 * scale, 0.8);
    },
    onComplete: () => {
      [flash, shock, dustRing, rays, streak, crater].forEach((o) => o.destroy());
      fxRetire(scene, depthOffset, rocks, 1500);
      fxRetire(scene, depthOffset, embers, 1200);
      fxRetire(scene, depthOffset, fire, 800);
      fxRetire(scene, depthOffset, dust, 1500);
      onDone();
    },
  });
}

// Aftermath (`ultimateMeteor`): the crater's glow cooling while smoke rises
// off it and the last embers drift up -- or, on a whiff, the last of the
// broken-up mass thinning out in mid-air, well clear of the ground. Ends by
// tearing down every object this phase created and firing `onComplete`
// exactly once.
function playMeteorAftermath(
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

  const q = Math.min(scale, QUANTITY_CAP);
  const crater = fxImage(scene, 58, depthOffset, FX_TEX.glow).setTint(color);
  const smoke = fxEmitter(
    scene,
    59,
    depthOffset,
    FX_TEX.smoke,
    {
      emitting: false,
      lifespan: { min: 900, max: 1500 },
      speed: { min: 15, max: 50 },
      angle: { min: 250, max: 290 },
      gravityY: -35,
      rotate: { min: 0, max: 360 },
      scale: { start: 0.2 * scale, end: 0.9 * scale },
      alpha: { start: 0.5, end: 0 },
      tint: [0x5c5560, 0x5c5560],
    },
    Phaser.BlendModes.NORMAL
  );
  const embers = fxEmitter(scene, 61, depthOffset, FX_TEX.spark, {
    emitting: false,
    lifespan: { min: 600, max: 1200 },
    speed: { min: 20, max: 80 },
    angle: { min: 240, max: 300 },
    gravityY: -30,
    scale: { start: 0.45 * scale, end: 0 },
    alpha: { start: 1, end: 0 },
    tint: [0xffffff, color],
  });
  const smokeSpout = new FxSpout(smoke);
  const emberSpout = new FxSpout(embers);
  fxCounter(scene, depthOffset, {
    from: 0,
    to: 1,
    duration: METEOR_AFTERMATH_MS,
    ease: 'Sine.easeOut',
    onUpdate: (tw) => {
      const t = tw.getValue() ?? 0;
      const now = scene.time.now;
      const groundY = to.y + GROUND_DROP;
      layFlat(crater, to.x, groundY, 240 * scale, 0.8 * (1 - t));
      smokeSpout.emitEach(now, 80 * q * (1 - t), () => ({ x: to.x + (Math.random() - 0.5) * 40 * scale, y: groundY - 4 }));
      emberSpout.emitEach(now, 45 * q * (1 - t), () => ({ x: to.x + (Math.random() - 0.5) * 50 * scale, y: groundY - 4 }));
    },
    onComplete: () => {
      crater.destroy();
      fxRetire(scene, depthOffset, smoke, 1600);
      fxRetire(scene, depthOffset, embers, 1300);
      onComplete();
    },
  });
}

// `ultimateMeteor` -- see the shared Ultimate-tier comment above for the
// phase/callback contract. Reads as a heavy mass falling from above and
// slamming the target, distinct from playNova's outward-building blast.
export function playMeteor(
  scene: Phaser.Scene,
  color: number,
  to: EffectAnchor,
  whiff: boolean,
  onImpact: () => void,
  onComplete: () => void,
  depthOffset = 0,
  scale = 1
) {
  const shared: Shared = {};
  playMeteorSummon(scene, color, to, () => {
    playMeteorCharge(scene, color, to, whiff, () => {
      playMeteorImpact(scene, color, to, whiff, onImpact, () => {
        playMeteorAftermath(scene, color, to, whiff, onComplete, depthOffset, scale, shared);
      }, depthOffset, scale, shared);
    }, depthOffset, scale);
  }, depthOffset, scale);
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
  const flare = fxImage(scene, 60, depthOffset, FX_TEX.flare).setTint(blend(color, 0xffffff, 0.4)).setAlpha(0);
  const motes = fxEmitter(scene, 61, depthOffset, FX_TEX.spark, {
    emitting: false,
    lifespan: { min: 300, max: 600 },
    speed: { min: 5, max: 25 },
    angle: { min: 0, max: 360 },
    scale: { start: 0.45 * scale, end: 0 },
    alpha: { start: 1, end: 0 },
    tint: [0xffffff, color],
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

// Charge: matter falling INWARD onto a brightening, pulsing core -- sparks
// streaming in from all around it, each on its own clock, and streaks of
// light drawn in behind them -- while an accretion disc forms around the
// core, lying at a tilt to the camera with arcs spinning in its plane, and a
// starburst grows at the centre: the inverse motion of playMeteorCharge's
// falling mass, so the two moves read as opposites (something arriving from
// outside vs. something collapsing inward before it blows back out) rather
// than variants of the same idea. The core's own growth (not the infall or
// its pulse, both still driven by raw `t`) saturates at HOLD_T of the phase
// and holds -- same "small -> big -> held, straining" beat
// playMeteorCharge's growT gives the falling mass, so the last stretch
// before Impact reads as a core visibly full and under pressure rather than
// one still visibly swelling right up to the cut.
function playNovaCharge(
  scene: Phaser.Scene,
  color: number,
  to: EffectAnchor,
  whiff: boolean,
  onDone: () => void,
  depthOffset = 0,
  scale = 1
) {
  const q = Math.min(scale, QUANTITY_CAP);
  const g = fxGraphics(scene, 60, depthOffset);
  const disc = fxImage(scene, 59, depthOffset, FX_TEX.ring).setTint(color).setAlpha(0);
  const halo = fxImage(scene, 60, depthOffset, FX_TEX.glow).setTint(color).setAlpha(0);
  const core = fxImage(scene, 61, depthOffset, FX_TEX.glow).setAlpha(0);
  const flare = fxImage(scene, 61, depthOffset, FX_TEX.flare).setTint(blend(color, 0xffffff, 0.5)).setAlpha(0);
  // Each spark is aimed at the core on emit and given exactly the speed
  // that lands it there at the end of its life, brightening from the
  // move's color to white as it arrives.
  const infall = fxEmitter(scene, 61, depthOffset, FX_TEX.spark, {
    emitting: false,
    lifespan: { min: 450, max: 900 },
    angle: { onEmit: (particle) => (particle ? Phaser.Math.RadToDeg(Math.atan2(to.y - particle.y, to.x - particle.x)) : 0) },
    speed: { onEmit: (particle) => (particle ? Math.hypot(to.x - particle.x, to.y - particle.y) / Math.max(0.05, particle.life / 1000) : 0) },
    scale: { start: 0.4 * scale, end: 0.12 * scale },
    alpha: { start: 0.25, end: 1 },
    tint: [color, 0xffffff],
  });
  const infallSpout = new FxSpout(infall);
  const streaks = Array.from({ length: 12 }, (_, i) => ({
    angle: (i / 12) * Math.PI * 2,
    phase: Math.random(),
    speed: 0.8 + Math.random() * 0.8,
    maxR: 50 + Math.random() * 40,
    pale: i % 2 === 0,
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
      // The pulse flattens out across the hold beat on a whiff (strainAt) --
      // the same slack the meteor's tremble loses, so both Ultimates read as
      // having gone dead a moment before they come apart.
      const pulse = 0.7 + 0.3 * Math.sin(t * 36) * strainAt(t, whiff);
      g.clear();
      // Each streak runs its own infall on its own clock and respawns
      // further out when it reaches the core, so the swarm reads as matter
      // falling in continuously rather than as one shared ring contracting.
      for (const streak of streaks) {
        const p = (t * streak.speed + streak.phase) % 1;
        const r = (1 - Math.pow(p, 0.8)) * streak.maxR * scale;
        const ang = streak.angle + t * 6;
        const cos = Math.cos(ang);
        const sin = Math.sin(ang);
        const tail = r + 8 * p * scale;
        g.lineStyle(2 * scale, streak.pale ? 0xffffff : color, 0.75 * p);
        g.lineBetween(to.x + cos * tail, to.y + sin * tail, to.x + cos * r, to.y + sin * r);
      }
      const discR = coreR * NOVA_RING_FACTOR * 1.15;
      disc.setPosition(to.x, to.y).setDisplaySize(ringDisplaySize(discR), ringDisplaySize(discR) * DISC_TILT).setAlpha(0.45 * t);
      drawRune(g, color, to.x, to.y, discR, t * 2.5, 0.3 + 0.5 * t, scale, DISC_TILT);
      drawAnnulus(g, color, to.x, to.y, coreR * NOVA_RING_FACTOR, (2 + t * 3) * scale, 0.25 + t * 0.5);
      placeAt(halo, to.x, to.y, coreR * 6 * pulse, 0.35 + 0.35 * t);
      placeAt(core, to.x, to.y, coreR * 2.2 * pulse, 0.55 + t * 0.4);
      placeAt(flare, to.x, to.y, coreR * 4.5 * (0.5 + 0.5 * t), 0.35 + 0.55 * t);
      flare.setAngle(t * 60);
      infallSpout.emitEach(now, 90 * q * (0.5 + t), () => {
        const r = (60 + Math.random() * 50) * scale;
        const ang = Math.random() * Math.PI * 2;
        return { x: to.x + Math.cos(ang) * r, y: to.y + Math.sin(ang) * r };
      });
    },
    onComplete: () => {
      [g, disc, halo, core, flare].forEach((o) => o.destroy());
      fxRetire(scene, depthOffset, infall, 900);
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

// Impact (`ultimateNova`): calls `onImpact()` immediately, then either the
// full outward blast -- a blinding flash, a white shockwave with a slower
// colored one behind it, a lens streak clean across the field, a burst of
// rays, sparks flung out in every direction and glowing gas billowing
// outward from the core, reaching close to the field's own half-height
// (FIELD_H/2 = 240, BattleScene.ts) so it reads as filling most of the
// screen rather than a pocket-sized burst -- or, on a whiff, Charge's own
// infall run backwards: everything it gathered streaming back out and going
// dark instead of detonating. Every light ADD-blend and alpha-faded with `t`
// throughout, same reasoning as playMeteorImpact's own comment: brightens
// what's underneath for a beat rather than opaquely hiding it.
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
  const flash = fxImage(scene, 61, depthOffset, FX_TEX.glow);
  const shock = fxImage(scene, 61, depthOffset, FX_TEX.ring);
  const shock2 = fxImage(scene, 60, depthOffset, FX_TEX.ring).setTint(color);
  const streak = fxImage(scene, 61, depthOffset, FX_TEX.streak);
  const rays = fxImage(scene, 60, depthOffset, FX_TEX.rays).setTint(color);
  const core = fxImage(scene, 61, depthOffset, FX_TEX.glow);
  const nebula = fxEmitter(scene, 59, depthOffset, FX_TEX.smoke, {
    emitting: false,
    lifespan: { min: 900, max: 1600 },
    speed: { min: 40, max: 170 },
    angle: { min: 0, max: 360 },
    rotate: { min: 0, max: 360 },
    scale: { start: 0.2 * scale, end: 0.7 * scale },
    alpha: { start: 0.4, end: 0 },
    tint: [0xffffff, color, darken(color, 50)],
  });
  const sparks = fxEmitter(scene, 61, depthOffset, FX_TEX.spark, {
    emitting: false,
    lifespan: { min: 500, max: 1000 },
    speed: { min: 150, max: 480 },
    angle: { min: 0, max: 360 },
    scale: { start: 0.7 * scale, end: 0 },
    alpha: { start: 1, end: 0 },
    tint: [0xffffff, color],
  });
  nebula.explode(Math.round(18 * q), to.x, to.y);
  sparks.explode(Math.round(80 * q), to.x, to.y);
  fxCounter(scene, depthOffset, {
    from: 0,
    to: 1,
    duration: NOVA_IMPACT_MS,
    ease: 'Cubic.easeOut',
    onUpdate: (tw) => {
      const t = tw.getValue() ?? 0;
      placeAt(flash, to.x, to.y, (70 + 560 * t) * scale, 0.96 * Math.pow(1 - t, 1.6));
      placeAt(shock, to.x, to.y, ringDisplaySize((20 + 250 * t) * scale), 0.9 * Math.pow(1 - t, 0.6));
      placeAt(shock2, to.x, to.y, ringDisplaySize((10 + 200 * t) * scale), 0.6 * Math.pow(1 - t, 0.8));
      streak.setPosition(to.x, to.y).setDisplaySize((300 + 900 * t) * scale, 12 * scale).setAlpha(0.9 * Math.pow(1 - t, 2));
      placeAt(rays, to.x, to.y, (100 + 700 * t) * scale, 0.7 * (1 - t));
      rays.setAngle(t * 25);
      placeAt(core, to.x, to.y, NOVA_CORE_R * 2.2 * scale * (1 - 0.5 * t), 0.9 * (1 - 0.6 * t));
    },
    onComplete: () => {
      [flash, shock, shock2, streak, rays, core].forEach((o) => o.destroy());
      fxRetire(scene, depthOffset, nebula, 1700);
      fxRetire(scene, depthOffset, sparks, 1100);
      onDone();
    },
  });
}

// Aftermath (`ultimateNova`): the remnant -- the core cooling from white
// into the move's own color and shrinking away, a last faint ring still
// widening, gas and sparks drifting out from where it was -- or, on a whiff,
// the tail of the outflow Impact started. Ends by tearing down every object
// this phase created and firing `onComplete` exactly once.
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
  const core = fxImage(scene, 60, depthOffset, FX_TEX.glow).setTint(color);
  const remnant = fxImage(scene, 59, depthOffset, FX_TEX.ring).setTint(color);
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
    tint: [0xffffff, color],
  });
  const gasSpout = new FxSpout(gas);
  const sparkSpout = new FxSpout(sparks);
  fxCounter(scene, depthOffset, {
    from: 0,
    to: 1,
    duration: NOVA_AFTERMATH_MS,
    ease: 'Sine.easeOut',
    onUpdate: (tw) => {
      const t = tw.getValue() ?? 0;
      const now = scene.time.now;
      placeAt(core, to.x, to.y, NOVA_CORE_R * 2.4 * scale * (1 - t), 0.6 * (1 - t));
      placeAt(remnant, to.x, to.y, ringDisplaySize((230 + 120 * t) * scale), 0.35 * (1 - t));
      const within = () => ({ x: to.x + (Math.random() - 0.5) * 60 * scale, y: to.y + (Math.random() - 0.5) * 60 * scale });
      gasSpout.emitEach(now, 40 * q * (1 - t), within);
      sparkSpout.emitEach(now, 30 * q * (1 - t), within);
    },
    onComplete: () => {
      core.destroy();
      remnant.destroy();
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
  scale = 1
) {
  const shared: Shared = {};
  playNovaSummon(scene, color, to, () => {
    playNovaCharge(scene, color, to, whiff, () => {
      playNovaImpact(scene, color, to, whiff, onImpact, () => {
        playNovaAftermath(scene, color, to, whiff, onComplete, depthOffset, scale, shared);
      }, depthOffset, scale, shared);
    }, depthOffset, scale);
  }, depthOffset, scale);
}
