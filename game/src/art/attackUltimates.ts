import Phaser from 'phaser';
import type { EffectAnchor } from './attackAnchors';
import { GROUND_DROP, GROUND_ASPECT, drawBloom, drawAnnulus, drawArcRing, drawTaperedRays } from './attackShapes';
import { fxGraphics, fxCounter } from './attackFx';
import { fillDot } from './shapes';

// Skłodowska-Curie's Ultimate pair (§5, World 10, ULTIMATE_SHAPES) -- the
// flashiest tier, a 4-6s "Final-Fantasy-style summon" sequence rather than a
// single travelling effect: a runic summon circle (Summon) builds up,
// something gathers/intensifies at the target (Charge), the actual strike
// lands (Impact -- fires `onImpact` right as this phase *begins*, not at its
// end, mirroring every other shape's `land()`), then decays away (Aftermath
// -- fires `onComplete` once, at the very end). Each phase is its own
// counter tween (art/attackFx.ts's fxCounter), chained via onComplete rather than one long
// tween, and each phase creates and destroys its own Graphics objects rather
// than reusing one across phases -- unlike art/attackShapes.ts's shapes,
// which only ever need one short tween and so never have to worry about that
// cleanup. `whiff` (set when an Ultimate move fails its 3-question gate,
// BattleScene's resolveHit) takes the summoned mass apart instead of letting
// it strike: the Impact/Aftermath phases redraw the silhouette Charge left
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
// the whiff dissipation redraws exactly the silhouette Charge left hanging
// over the target and pulls that apart, so the two have to agree on where the
// mass ends up and how big it is or the handover shows as a visible cut.
const METEOR_HOVER_DY = -34;
const METEOR_MASS_R = 58;
const METEOR_ORBIT_FACTOR = 1.6;
const METEOR_RUNE_R = 58;
const NOVA_CORE_R = 32;
const NOVA_RING_FACTOR = 2.4;

// A whiff draws in one flat grey across every phase it touches, rather than
// the move's own quasiparticle color: the point is that this cast carries no
// physics any more, and a single grey also keeps the Impact->Aftermath handover
// invisible, since the dissipation runs continuously across both.
const FIZZLE_GREY = 0x9a9a9a;

// Where each Charge phase stops growing and starts straining -- full size and
// position by this fraction of the phase, held there for the rest.
const HOLD_T = 0.82;

// How much of that held strain survives at time `t`: all of it on a landing
// hit, decaying to nothing across the hold beat on a whiff, so the tremble
// (meteor) and core pulse (nova) that read as "about to blow" visibly go
// slack while the mass is still whole.
function strainAt(t: number, whiff: boolean): number {
  if (!whiff) return 1;
  return Phaser.Math.Clamp(1 - (t - HOLD_T) / (1 - HOLD_T), 0, 1);
}

// Summon (`ultimateMeteor`): a rune building up on the ground under the
// target -- three counter-rotating arc segments at different radii, ticked
// with short radial dashes and orbited by a few bright motes, all squashed
// into the ground plane (GROUND_ASPECT) so it lies on the floor the crystal
// stands on rather than facing the camera. Arcs rather than a polygon and
// spokes: a closed hexagon ringed by radiating lines reads as a wire wheel,
// while turning fragments read as something being inscribed.
function playMeteorSummon(scene: Phaser.Scene, color: number, to: EffectAnchor, onDone: () => void, depthOffset = 0, scale = 1) {
  const g = fxGraphics(scene, 58, depthOffset);
  fxCounter(scene, depthOffset, {
    from: 0,
    to: 1,
    duration: METEOR_SUMMON_MS,
    ease: 'Cubic.easeOut',
    onUpdate: (tw) => {
      const t = tw.getValue() ?? 0;
      const groundY = to.y + GROUND_DROP;
      const r = (10 + t * 66) * scale;
      g.clear();
      drawAnnulus(g, color, to.x, groundY, r, 2.5 * scale, 0.3 + t * 0.6, GROUND_ASPECT);
      drawArcRing(g, color, to.x, groundY, r, t, 0.2 + t * 0.55, scale, GROUND_ASPECT);
    },
    onComplete: () => {
      g.destroy();
      onDone();
    },
  });
}

// Charge (`ultimateMeteor`): a heavy glowing mass, ringed by orbiting debris
// chunks and a fire trail, descending from off the top of the screen to hang
// just above the target -- a bigger, heavier silhouette than playBeam's thin
// falling column (a meteor reads as a mass, not a shot), with the summon
// circle from the prior phase redrawn underneath, still pulsing. Its
// arrival/growth is driven by `growT`, not the raw tween `t` -- reaching full
// size and position by HOLD_T of the phase and holding there for the rest (mass
// still shimmering/orbiting on raw `t`, just no longer growing or falling)
// reads as "reared back and straining, about to blow" for that last stretch,
// the held-breath beat right before Impact's onImpact fires. onImpact itself
// stays at frame 0 of the Impact phase (mirrors every other shape's land()),
// so this hold -- not a delayed onImpact -- is what sells "suddenly explode"
// rather than "still visibly growing when it detonates".
function playMeteorCharge(
  scene: Phaser.Scene,
  color: number,
  to: EffectAnchor,
  whiff: boolean,
  onDone: () => void,
  depthOffset = 0,
  scale = 1
) {
  const mass = fxGraphics(scene, 60, depthOffset);
  const circle = fxGraphics(scene, 58, depthOffset);
  const originY = -60;
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
      const groundY = to.y + GROUND_DROP;
      // Punches into frame fast, then brakes into the hover: the mass is
      // full-size and in place by HOLD_T of the phase and strains there for
      // the rest, the held breath before Impact fires -- strain that goes
      // slack instead (strainAt) when the cast has already failed.
      const growT = Phaser.Math.Easing.Cubic.Out(Math.min(t / HOLD_T, 1));
      const tremble = Math.sin(t * 70) * 2.5 * scale * Math.max(0, (t - 0.6) / 0.4) * strainAt(t, whiff);
      const massX = to.x + tremble;
      const massY = Phaser.Math.Linear(originY, to.y + METEOR_HOVER_DY, growT);
      const massR = (14 + growT * (METEOR_MASS_R - 14)) * scale;
      mass.clear();
      for (let i = 0; i < 8; i++) {
        const ty = massY - i * 14;
        if (ty < originY) continue;
        mass.fillStyle(i % 2 === 0 ? 0xffffff : color, Math.max(0, 0.5 - i * 0.06));
        fillDot(mass, massX + Math.sin(t * 22 + i) * (6 - i * 0.4) * scale, ty, Math.max(2, massR * 0.5 - i * 2));
      }
      for (let i = 0; i < 5; i++) {
        const ang = t * 9 + (i / 5) * Math.PI * 2;
        const orbR = massR * METEOR_ORBIT_FACTOR;
        // Ember-bright rather than rock-brown: these draw additively, and an
        // additive dark brown against a bright sky adds up to nothing.
        mass.fillStyle(0xd9762a, 0.9);
        fillDot(mass, massX + Math.cos(ang) * orbR, massY + Math.sin(ang) * orbR * 0.6, 4 * scale);
      }
      // Kept translucent rather than a solid fill: additive at full strength
      // over a bright sky saturates to a flat white disc, while a softer
      // body lets the backdrop through and reads as a burning mass.
      drawBloom(mass, color, massX, massY, massR, 0.5);
      // Leading face heated by the fall -- the white core sits low in the
      // body rather than dead center, so it reads as a lit mass with a
      // direction of travel instead of a flat glowing ball.
      mass.fillStyle(0xffffff, 0.7);
      fillDot(mass, massX, massY + massR * 0.25, massR * 0.45);

      circle.clear();
      const pulse = 0.6 + 0.4 * Math.sin(t * 28);
      const circleR = (METEOR_RUNE_R + Math.sin(t * 10) * 4) * scale;
      drawAnnulus(circle, color, to.x, groundY, circleR, 3 * scale, 0.4 * pulse, GROUND_ASPECT);
      drawAnnulus(circle, 0xffffff, to.x, groundY, circleR * 1.3, 2 * scale, 0.3 * pulse, GROUND_ASPECT);
    },
    onComplete: () => {
      mass.destroy();
      circle.destroy();
      onDone();
    },
  });
}

// A whiff's dissipation runs as one continuous motion across BOTH the Impact
// and Aftermath phases rather than restarting halfway, so `p` here is
// progress through the pair (0 at the start of Impact, 1 at the end of
// Aftermath) rather than either phase's own tween value -- a fragment that
// has drifted 80px by the phase boundary carries on from 80px instead of
// snapping back to the middle. Each phase converts its own `t` with
// METEOR_FIZZLE_SPLIT/NOVA_FIZZLE_SPLIT below.
const METEOR_FIZZLE_SPLIT = METEOR_IMPACT_MS / (METEOR_IMPACT_MS + METEOR_AFTERMATH_MS);
const NOVA_FIZZLE_SPLIT = NOVA_IMPACT_MS / (NOVA_IMPACT_MS + NOVA_AFTERMATH_MS);

// The meteor's mass coming apart where Charge left it hanging: the white-hot
// core it was carrying dies almost at once, the body dims and thins in place,
// and the chunks fly outward on an ease-out (fast, then coasting) while
// sagging a little and shrinking. Everything stays well above the floor --
// ground contact is the language of a strike that landed, so a whiff never
// draws anything on the ground plane except the summon rune it is letting go
// of.
function drawMeteorFizzle(g: Phaser.GameObjects.Graphics, color: number, to: EffectAnchor, p: number, scale: number) {
  const fade = 1 - p;
  const hoverY = to.y + METEOR_HOVER_DY - p * 14 * scale;
  const cooling = Math.max(0, 1 - p * 3);
  drawBloom(g, color, to.x, hoverY, METEOR_MASS_R * (1 - p * 0.55) * scale, 0.5 * Math.pow(fade, 1.5));
  g.fillStyle(0xffffff, 0.55 * cooling);
  fillDot(g, to.x, hoverY, METEOR_MASS_R * 0.4 * cooling * scale);
  for (let i = 0; i < 9; i++) {
    const ang = (i / 9) * Math.PI * 2 + i * 0.7;
    const dist = Math.pow(p, 0.65) * (70 + (i % 3) * 26) * scale;
    const size = Math.max(0.6, (7 - (i % 3) * 1.6) * (1 - p * 0.7) * scale);
    g.fillStyle(i % 2 === 0 ? 0xcccccc : color, 0.8 * Math.pow(fade, 0.75));
    fillDot(g, to.x + Math.cos(ang) * dist, hoverY + Math.sin(ang) * dist * 0.55 + p * p * 26 * scale, size);
  }
}

// The nova's counterpart: Charge's infall run backwards. Everything it spent
// two seconds pulling in streams back out as streaks losing their light, the
// core shrinking behind them and the ring drifting off, with no white flash
// and no rays -- what gathered at the target leaves again instead of going
// off there.
function drawNovaFizzle(g: Phaser.GameObjects.Graphics, color: number, to: EffectAnchor, p: number, scale: number) {
  const fade = 1 - p;
  const cooling = Math.max(0, 1 - p * 3);
  for (let i = 0; i < 14; i++) {
    const ang = (i / 14) * Math.PI * 2 + p * 0.9;
    const cos = Math.cos(ang);
    const sin = Math.sin(ang);
    const r = (NOVA_CORE_R * 0.7 + Math.pow(p, 0.7) * 120) * scale;
    const tail = r - Math.max(4, (16 - p * 9)) * scale;
    g.lineStyle(2 * scale, i % 2 === 0 ? 0xcccccc : color, 0.7 * Math.pow(fade, 0.75));
    g.lineBetween(to.x + cos * tail, to.y + sin * tail, to.x + cos * r, to.y + sin * r);
  }
  drawBloom(g, color, to.x, to.y, NOVA_CORE_R * (1 - p * 0.6) * scale, 0.45 * Math.pow(fade, 1.4));
  g.fillStyle(0xffffff, 0.5 * cooling);
  fillDot(g, to.x, to.y, NOVA_CORE_R * 0.45 * cooling * scale);
  drawAnnulus(g, color, to.x, to.y, (NOVA_CORE_R * NOVA_RING_FACTOR + Math.pow(p, 0.7) * 90) * scale, 2 * scale, 0.35 * fade);
}

// Impact (`ultimateMeteor`): calls `onImpact()` immediately, then plays
// either the full heavy slam -- a blinding core flash, a shockwave ring and
// ground-crack rays big enough to reach most of the 854x480 field (FIELD_W/
// FIELD_H, BattleScene.ts) rather than staying pocket-sized, the "explosion
// fills the screen" beat the small-then-big charge above was building toward
// -- or, on a whiff, the hovering mass coming apart where it hangs, which
// reads as "it never got there" rather than as a weaker version of the same
// boom. Every shape here stays ADD-blend and alpha-fades with `t`
// like the rest of the file rather than an opaque fill, so the log text/HP
// bars (BattleScene, depth 0) still read through it even at this size, just
// brightened for a beat.
function playMeteorImpact(
  scene: Phaser.Scene,
  color: number,
  to: EffectAnchor,
  whiff: boolean,
  onImpact: () => void,
  onDone: () => void,
  depthOffset = 0,
  scale = 1
) {
  onImpact();
  const g = fxGraphics(scene, 60, depthOffset);
  fxCounter(scene, depthOffset, {
    from: 0,
    to: 1,
    duration: METEOR_IMPACT_MS,
    // Linear on a whiff: the dissipation is one motion spanning this phase
    // and the next (drawMeteorFizzle's `p`), and shaping it here as well as
    // inside the helper would stall the fragments at the phase boundary and
    // then lurch them.
    ease: whiff ? 'Linear' : 'Cubic.easeOut',
    onUpdate: (tw) => {
      const t = tw.getValue() ?? 0;
      const groundY = to.y + GROUND_DROP;
      g.clear();
      if (whiff) {
        // The summon rune goes out along with the mass rather than being cut
        // off mid-pulse; it is the only thing a whiff ever draws on the
        // ground plane, and it is finished by the end of this phase.
        drawMeteorFizzle(g, FIZZLE_GREY, to, t * METEOR_FIZZLE_SPLIT, scale);
        drawAnnulus(g, FIZZLE_GREY, to.x, groundY, METEOR_RUNE_R * scale, 3 * scale, 0.3 * (1 - t), GROUND_ASPECT);
        return;
      }
      drawBloom(g, 0xffffff, to.x, groundY, (26 + t * 130) * scale, 0.92 * Math.pow(1 - t, 1.6));
      drawAnnulus(g, color, to.x, groundY, (14 + t * 260) * scale, 5 * scale, 0.85 * (1 - t), GROUND_ASPECT);
      g.fillStyle(color, 0.5 * (1 - t));
      g.fillEllipse(to.x, groundY, (140 + t * 320) * scale, (140 + t * 320) * GROUND_ASPECT * scale);
      drawTaperedRays(g, color, to.x, groundY, 12, 24 * scale, (24 + t * 230) * scale, 3 * scale, 0.7 * (1 - t), GROUND_ASPECT);
    },
    onComplete: () => {
      g.destroy();
      onDone();
    },
  });
}

// Aftermath (`ultimateMeteor`): residual glow and rising embers/dissipating
// shards over the crater -- or, on a whiff, the last of the broken-up mass
// thinning out in mid-air, well clear of the ground. Ends by tearing down
// every Graphics object this phase created and firing `onComplete` exactly
// once.
function playMeteorAftermath(
  scene: Phaser.Scene,
  color: number,
  to: EffectAnchor,
  whiff: boolean,
  onComplete: () => void,
  depthOffset = 0,
  scale = 1
) {
  const g = fxGraphics(scene, 58, depthOffset);
  const spread = 60 * scale;
  const emberCount = 9;
  fxCounter(scene, depthOffset, {
    from: 0,
    to: 1,
    duration: METEOR_AFTERMATH_MS,
    ease: whiff ? 'Linear' : 'Sine.easeOut',
    onUpdate: (tw) => {
      const t = tw.getValue() ?? 0;
      const groundY = to.y + GROUND_DROP;
      g.clear();
      if (whiff) {
        // Picks the break-up straight up where Impact left it (see
        // drawMeteorFizzle's own comment on `p`) and carries it out to
        // nothing -- no crater glow, no embers settling on the ground.
        drawMeteorFizzle(g, FIZZLE_GREY, to, METEOR_FIZZLE_SPLIT + t * (1 - METEOR_FIZZLE_SPLIT), scale);
        return;
      }
      g.fillStyle(color, 0.35 * (1 - t));
      g.fillEllipse(to.x, groundY, 48 * 2 * (1 - t) * scale, 48 * 2 * GROUND_ASPECT * (1 - t) * scale);
      for (let i = 0; i < emberCount; i++) {
        const ang = -Math.PI / 2 + (i - (emberCount - 1) / 2) * 0.32;
        const dist = t * spread;
        g.fillStyle(i % 2 === 0 ? 0xffffff : color, (1 - t) * 0.75);
        fillDot(g, to.x + Math.cos(ang) * dist, groundY - t * 26 * scale + Math.sin(ang) * dist * 0.3, 2.5 * (1 - t * 0.6) * scale);
      }
    },
    onComplete: () => {
      g.destroy();
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
  playMeteorSummon(scene, color, to, () => {
    playMeteorCharge(scene, color, to, whiff, () => {
      playMeteorImpact(scene, color, to, whiff, onImpact, () => {
        playMeteorAftermath(scene, color, to, whiff, onComplete, depthOffset, scale);
      }, depthOffset, scale);
    }, depthOffset, scale);
  }, depthOffset, scale);
}

// Summon (`ultimateNova`): the same runic-circle idea as playMeteorSummon,
// but standing upright around the target itself rather than lying flat on
// the ground -- counter-rotating arc fragments building up around `to`,
// reading as a vertical mandala rather than a ground rune.
function playNovaSummon(scene: Phaser.Scene, color: number, to: EffectAnchor, onDone: () => void, depthOffset = 0, scale = 1) {
  const g = fxGraphics(scene, 60, depthOffset);
  fxCounter(scene, depthOffset, {
    from: 0,
    to: 1,
    duration: NOVA_SUMMON_MS,
    ease: 'Cubic.easeOut',
    onUpdate: (tw) => {
      const t = tw.getValue() ?? 0;
      const r = (8 + t * 52) * scale;
      g.clear();
      drawAnnulus(g, color, to.x, to.y, r, 2.5 * scale, 0.3 + t * 0.5);
      drawArcRing(g, color, to.x, to.y, r, t, 0.2 + t * 0.5, scale);
    },
    onComplete: () => {
      g.destroy();
      onDone();
    },
  });
}

// Charge (`ultimateNova`): particles converging INWARD toward a brightening,
// pulsing core -- the inverse motion of playMeteorCharge's falling mass, so
// the two moves read as opposites (something arriving from outside vs.
// something collapsing inward before it blows back out) rather than variants
// of the same idea. The core's own growth (not the converging particles or
// its pulse, both still driven by raw `t`) saturates at HOLD_T of the phase and
// holds -- same "small -> big -> held, straining" beat playMeteorCharge's
// growT gives the falling mass, so the last stretch before Impact reads as a
// core visibly full and under pressure rather than one still visibly
// swelling right up to the cut.
function playNovaCharge(
  scene: Phaser.Scene,
  color: number,
  to: EffectAnchor,
  whiff: boolean,
  onDone: () => void,
  depthOffset = 0,
  scale = 1
) {
  const g = fxGraphics(scene, 60, depthOffset);
  const motes = Array.from({ length: 14 }, (_, i) => ({
    angle: (i / 14) * Math.PI * 2,
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
      const growT = Math.min(t / HOLD_T, 1);
      const coreR = (6 + growT * (NOVA_CORE_R - 6)) * scale;
      g.clear();
      // Each mote runs its own infall on its own clock and respawns further
      // out when it reaches the core, so the swarm reads as matter falling
      // in continuously rather than as one shared ring contracting.
      for (const mote of motes) {
        const p = (t * mote.speed + mote.phase) % 1;
        const r = (1 - Math.pow(p, 0.8)) * mote.maxR * scale;
        const ang = mote.angle + t * 6;
        const cos = Math.cos(ang);
        const sin = Math.sin(ang);
        const tail = r + 8 * p * scale;
        g.lineStyle(2 * scale, mote.pale ? 0xffffff : color, 0.75 * p);
        g.lineBetween(to.x + cos * tail, to.y + sin * tail, to.x + cos * r, to.y + sin * r);
      }
      // The pulse flattens out across the hold beat on a whiff (strainAt) --
      // the same slack the meteor's tremble loses, so both Ultimates read as
      // having gone dead a moment before they come apart.
      const pulse = 0.7 + 0.3 * Math.sin(t * 36) * strainAt(t, whiff);
      drawBloom(g, color, to.x, to.y, coreR * pulse, 0.5 + t * 0.4);
      g.fillStyle(0xffffff, 0.55 + t * 0.35);
      fillDot(g, to.x, to.y, coreR * 0.5 * pulse);
      drawAnnulus(g, color, to.x, to.y, coreR * NOVA_RING_FACTOR, (2 + t * 3) * scale, 0.25 + t * 0.5);
    },
    onComplete: () => {
      g.destroy();
      onDone();
    },
  });
}

// Impact (`ultimateNova`): calls `onImpact()` immediately, then either a full
// outward energy-nova blast -- bright core flash, double expanding ring, and
// radiating rays reaching close to the field's own half-height (FIELD_H/2 =
// 240, BattleScene.ts) in every direction, big enough to read as filling most
// of the screen rather than a pocket-sized burst -- or, on a whiff, Charge's
// own infall run backwards: everything it gathered streaming back out and
// going dark instead of detonating
// ADD-blend and alpha-faded with `t` throughout, same reasoning as
// playMeteorImpact's own comment: brightens what's underneath for a beat
// rather than opaquely hiding it.
function playNovaImpact(
  scene: Phaser.Scene,
  color: number,
  to: EffectAnchor,
  whiff: boolean,
  onImpact: () => void,
  onDone: () => void,
  depthOffset = 0,
  scale = 1
) {
  onImpact();
  const g = fxGraphics(scene, 61, depthOffset);
  fxCounter(scene, depthOffset, {
    from: 0,
    to: 1,
    duration: NOVA_IMPACT_MS,
    // Linear on a whiff, for the same reason playMeteorImpact's is (the
    // outflow spans this phase and the Aftermath as one motion).
    ease: whiff ? 'Linear' : 'Cubic.easeOut',
    onUpdate: (tw) => {
      const t = tw.getValue() ?? 0;
      g.clear();
      if (whiff) {
        drawNovaFizzle(g, FIZZLE_GREY, to, t * NOVA_FIZZLE_SPLIT, scale);
        return;
      }
      drawBloom(g, 0xffffff, to.x, to.y, (22 + t * 110) * scale, 0.96 * Math.pow(1 - t, 1.6));
      drawAnnulus(g, color, to.x, to.y, (26 + t * 260) * scale, 5 * scale, 0.85 * (1 - t));
      drawAnnulus(g, 0xffffff, to.x, to.y, (14 + t * 190) * scale, 3 * scale, 0.5 * (1 - t));
      drawTaperedRays(g, color, to.x, to.y, 12, 14 * scale, (28 + t * 230) * scale, 3 * scale, 0.75 * (1 - t));
    },
    onComplete: () => {
      g.destroy();
      onDone();
    },
  });
}

// Aftermath (`ultimateNova`): dissipating shards radiating outward from the
// center plus a fading core glow -- or, on a whiff, the tail of the outflow
// Impact started. Ends by tearing down every Graphics object this phase
// created and firing `onComplete` exactly once.
function playNovaAftermath(
  scene: Phaser.Scene,
  color: number,
  to: EffectAnchor,
  whiff: boolean,
  onComplete: () => void,
  depthOffset = 0,
  scale = 1
) {
  const g = fxGraphics(scene, 58, depthOffset);
  const spread = 65 * scale;
  fxCounter(scene, depthOffset, {
    from: 0,
    to: 1,
    duration: NOVA_AFTERMATH_MS,
    ease: whiff ? 'Linear' : 'Sine.easeOut',
    onUpdate: (tw) => {
      const t = tw.getValue() ?? 0;
      g.clear();
      if (whiff) {
        // Same continuation Impact's own whiff branch started (see
        // drawNovaFizzle) -- the outflow keeps going and thins to nothing.
        drawNovaFizzle(g, FIZZLE_GREY, to, NOVA_FIZZLE_SPLIT + t * (1 - NOVA_FIZZLE_SPLIT), scale);
        return;
      }
      g.fillStyle(color, 0.35 * (1 - t));
      fillDot(g, to.x, to.y, 40 * (1 - t) * scale);
      const shards = 10;
      for (let i = 0; i < shards; i++) {
        const ang = (i / shards) * Math.PI * 2;
        const dist = t * spread;
        g.fillStyle(i % 2 === 0 ? 0xffffff : color, (1 - t) * 0.75);
        fillDot(g, to.x + Math.cos(ang) * dist, to.y + Math.sin(ang) * dist, 2.5 * (1 - t * 0.7) * scale);
      }
    },
    onComplete: () => {
      g.destroy();
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
  playNovaSummon(scene, color, to, () => {
    playNovaCharge(scene, color, to, whiff, () => {
      playNovaImpact(scene, color, to, whiff, onImpact, () => {
        playNovaAftermath(scene, color, to, whiff, onComplete, depthOffset, scale);
      }, depthOffset, scale);
    }, depthOffset, scale);
  }, depthOffset, scale);
}
