import Phaser from 'phaser';
import type { AttackShape } from '../audio/sfx';
import { latchAnchor, type EffectAnchor } from './attackAnchors';
import { fxGraphics, fxCounter } from './attackFx';
import { fillDot } from './shapes';

// The single-beat shape family: a windup at the attacker, one travelling (or
// target-summoned) silhouette, and an impact shockwave at the target. Every
// function here draws from `EffectAnchor`s rather than fixed points, so each
// piece follows whichever crystal it belongs to on its own -- see
// art/attackAnchors.ts for the attacker/target independence rule these all
// obey, and art/attackEffects.ts for the timing/escalation engine that fires
// them. Skłodowska-Curie's Ultimate tier runs its own multi-phase sequence
// instead (art/attackUltimates.ts).

export const WINDUP_MS = 90;
// meteor/nova entries exist here purely so this Record type-checks against
// AttackShape (TypeScript forces every shape to have an entry) -- neither
// value is actually read: art/attackUltimates.ts's playMeteor/playNova
// manage their own internal multi-phase timeline (summon -> charge ->
// impact -> aftermath, see METEOR_TOTAL_MS/NOVA_TOTAL_MS there) rather than
// the flat WINDUP_MS + TRAVEL_MS[shape] + IMPACT_MS formula every other
// shape uses, since that formula doesn't scale to a multi-second sequence.
// Every single-beat shape keeps WINDUP_MS + its travel + IMPACT_MS within
// ~900ms; mass (550) is deliberately the slowest silhouette of the ordinary
// set, lattice/bolt the quickest.
export const TRAVEL_MS: Record<AttackShape, number> = {
  bolt: 340,
  lattice: 380,
  wave: 420,
  ring: 460,
  buffring: 460,
  flip: 440,
  combwave: 420,
  hop: 520,
  sever: 460,
  vortex: 400,
  rail: 480,
  helix: 440,
  swell: 460,
  mass: 550,
  braid: 460,
  split: 440,
  burst: 400,
  beam: 520,
  eruption: 480,
  meteor: 5200,
  nova: 4800,
};
export const IMPACT_MS = 260;

// How far below a crystal's own anchor the ground under it is -- where a
// ground-anchored effect (an eruption's crack and shockwave rings,
// art/attackUltimates.ts's meteor summon circle and slam, a self-buff ring's
// floor echo) plants itself. Matches where BattleScene draws each crystal's
// own ground shadow (46px below both the opponent's and the player's
// centers), so effects and shadows sit on one shared ground plane. Never
// multiplied by an effect's own `scale`: a bigger effect is still standing
// on the same floor.
export const GROUND_DROP = 46;
// Vertical squash for anything drawn lying on that ground plane, matching
// the ground shadows' own 120x28 / 130x30 proportions -- a circle on the
// floor seen from the battle's viewing angle.
export const GROUND_ASPECT = 0.28;

// Draws a soft radial falloff as a stack of concentric additive discs whose
// radii grow geometrically while their alphas roughly halve -- the cheap
// stand-in for a real gradient, since a Graphics fill is flat. Four discs is
// enough to read as a glow rather than as banding, and costs four primitives.
// `alpha` scales the whole stack, so a caller fades a glow by fading this.
export function drawGlow(g: Phaser.GameObjects.Graphics, color: number, x: number, y: number, r: number, alpha: number) {
  g.fillStyle(color, 0.9 * alpha);
  fillDot(g, x, y, r);
  g.fillStyle(color, 0.4 * alpha);
  fillDot(g, x, y, r * 1.75);
  g.fillStyle(color, 0.18 * alpha);
  fillDot(g, x, y, r * 2.75);
  g.fillStyle(color, 0.07 * alpha);
  fillDot(g, x, y, r * 4);
}

// The same idea as drawGlow, for something that already has a body of its
// own (a meteor's mass, an explosion's core): one solid fill plus a single
// tight halo, rather than drawGlow's wide four-stop falloff -- that falloff
// is tuned for a small bright head, and at a radius of tens of pixels its
// outermost stop covers most of the field and washes the backdrop out.
export function drawBloom(g: Phaser.GameObjects.Graphics, color: number, x: number, y: number, r: number, alpha: number) {
  g.fillStyle(color, 0.26 * alpha);
  fillDot(g, x, y, r * 1.5);
  g.fillStyle(color, alpha);
  fillDot(g, x, y, r);
}

// Draws one wavefront as a soft-edged annulus: three concentric strokes a
// few pixels apart, weighted so the edge falls off either side of the crest
// instead of reading as a wire circle. `flatten` squashes it into the ground
// plane (1 = a full circle facing the camera, GROUND_ASPECT = lying flat on
// the floor). Three stops rather than more: every stop is another line-style
// change plus a tessellated ellipse, and these run on every frame of every
// effect (several at once during a leveled cascade), so the cost is paid
// over and over.
const ANNULUS_WEIGHTS = [0.22, 0.7, 0.22];
// Segments per tessellated ground ellipse -- below Phaser's own default,
// which is finer than a ring this size needs.
const ELLIPSE_SEGMENTS = 20;
export function drawAnnulus(
  g: Phaser.GameObjects.Graphics,
  color: number,
  x: number,
  y: number,
  r: number,
  width: number,
  alpha: number,
  flatten = 1
) {
  for (let k = 0; k < ANNULUS_WEIGHTS.length; k++) {
    const rk = r + (k - 1) * width;
    if (rk <= 0) continue;
    g.lineStyle(width * 0.85, color, ANNULUS_WEIGHTS[k] * alpha);
    if (flatten === 1) g.strokeCircle(x, y, rk);
    else g.strokeEllipse(x, y, rk * 2, rk * 2 * flatten, ELLIPSE_SEGMENTS);
  }
}

// Draws a runic ring as three counter-rotating arc segments at different
// radii, ticked with short radial dashes and orbited by a few bright motes,
// rather than as a closed polygon with spokes -- turning fragments read as
// something being inscribed, a hexagon inside a wheel of spokes reads as a
// bicycle wheel. `flatten` lays it into the ground plane the same way
// drawAnnulus does; Phaser's own arc() only draws circular arcs, so the
// points are sampled by hand and squashed on the way out.
const ARC_RADII = [0.55, 0.75, 1];
const ARC_SPANS = [1.9, 1.4, 1.2];
const ARC_SPEEDS = [1.6, -1.1, 0.7];
const ARC_SAMPLES = 10;
export function drawArcRing(
  g: Phaser.GameObjects.Graphics,
  color: number,
  x: number,
  y: number,
  r: number,
  spin: number,
  alpha: number,
  scale: number,
  flatten = 1
) {
  if (alpha <= 0 || r <= 0) return;
  for (let a = 0; a < ARC_RADII.length; a++) {
    const rr = r * ARC_RADII[a];
    const start = spin * Math.PI * ARC_SPEEDS[a] + a * 2.1;
    g.lineStyle(2 * scale, a === 1 ? 0xffffff : color, alpha);
    g.beginPath();
    for (let i = 0; i <= ARC_SAMPLES; i++) {
      const ang = start + (i / ARC_SAMPLES) * ARC_SPANS[a];
      const px = x + Math.cos(ang) * rr;
      const py = y + Math.sin(ang) * rr * flatten;
      if (i === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.strokePath();
  }
  for (let i = 0; i < 6; i++) {
    const ang = -spin * Math.PI * 0.4 + (i / 6) * Math.PI * 2;
    const cos = Math.cos(ang);
    const sin = Math.sin(ang) * flatten;
    g.lineStyle(1.5 * scale, color, alpha * 0.8);
    g.lineBetween(x + cos * r * 0.88, y + sin * r * 0.88, x + cos * r, y + sin * r);
  }
  for (let i = 0; i < 4; i++) {
    const ang = spin * Math.PI * 1.3 + (i / 4) * Math.PI * 2;
    g.fillStyle(0xffffff, alpha);
    fillDot(g, x + Math.cos(ang) * r, y + Math.sin(ang) * r * flatten, 2.2 * scale);
  }
}

// Radiating slivers that taper to a point, replacing a fan of constant-width
// lines -- the same treatment playImpactShockwave gives its debris, at the
// scale a summon's ground-crack rays need.
export function drawTaperedRays(
  g: Phaser.GameObjects.Graphics,
  color: number,
  x: number,
  y: number,
  count: number,
  inner: number,
  outer: number,
  width: number,
  alpha: number,
  flatten = 1
) {
  if (alpha <= 0) return;
  g.fillStyle(color, alpha);
  for (let i = 0; i < count; i++) {
    const ang = (i / count) * Math.PI * 2 + 0.13;
    const cos = Math.cos(ang);
    const sin = Math.sin(ang);
    g.fillTriangle(
      x + cos * outer,
      y + sin * outer * flatten,
      x + cos * inner - sin * width,
      y + (sin * inner + cos * width) * flatten,
      x + cos * inner + sin * width,
      y + (sin * inner - cos * width) * flatten
    );
  }
}

// A gathering of sparks pulled inward to a brightening core at the
// attacker's own position, right before the effect launches -- an inhale, so
// the launch reads as something released rather than something appearing.
// Brightness peaks exactly on the handoff frame. Purely attacker-side: it
// resolves `at` fresh every frame and never looks at the target at all.
export function playWindup(
  scene: Phaser.Scene,
  color: number,
  at: EffectAnchor,
  onDone: () => void,
  depthOffset = 0,
  scale = 1
) {
  const g = fxGraphics(scene, 59, depthOffset);
  const sparks = 5;
  const seed = Math.random() * Math.PI * 2;
  fxCounter(scene, depthOffset, {
    from: 0,
    to: 1,
    duration: WINDUP_MS,
    ease: 'Sine.easeIn',
    onUpdate: (tw) => {
      const t = tw.getValue() ?? 0;
      g.clear();
      for (let i = 0; i < sparks; i++) {
        const ang = seed + (i / sparks) * Math.PI * 2 + t * 1.2;
        const r = (26 - t * 23) * scale;
        g.fillStyle(0xffffff, 0.2 + t * 0.7);
        fillDot(g, at.x + Math.cos(ang) * r, at.y + Math.sin(ang) * r, 2.5 * scale);
      }
      drawGlow(g, color, at.x, at.y, (2 + t * 5) * scale, 0.6 * t);
    },
    onComplete: () => {
      g.destroy();
      onDone();
    },
  });
}

// A direction, used to bias an impact's debris splash away from where the
// hit came in. Only ever produced by a travelling shape out of its own
// launch-latched origin and live destination, so it carries no live
// dependency on the attacker.
interface Direction {
  x: number;
  y: number;
}

// A point at parameter `s` (0 = launch, 1 = target) along a travelling
// shape's flight path: the straight line between the two, bowed
// perpendicular to it so the shot arcs rather than ruling a line across the
// field. The apex bows upward by default (a thrown thing rises before it
// arrives, and every player attack already runs bottom-left to top-right, so
// bowing the other way would fight the geometry). Bow height is a fraction
// of the span, clamped so a short pane-sized preview still curves and a
// full-field shot doesn't balloon; it takes only a fraction of a leveled
// cast's `scale`, since path geometry is not stroke weight and a 3.5x arc
// would leave the frame. `to` is resolved by the caller every frame, so the
// path re-aims as the target moves. `bow` multiplies the arc: 1 is the
// standard up-bow, a negative value sags below the line (mass's path alone),
// and split runs two heads at opposite signs for its mirrored double bow.
function arcPoint(origin: Direction, to: EffectAnchor, s: number, scale: number, bow = 1): Direction {
  const dx = to.x - origin.x;
  const dy = to.y - origin.y;
  const len = Math.hypot(dx, dy) || 1;
  // The perpendicular (-dy, dx) points down-field for a left-to-right shot
  // and up-field for a right-to-left one; flipping on the x sign makes the
  // apex go up either way.
  const sign = dx > 0 ? -1 : 1;
  const nx = (-dy / len) * sign;
  const ny = (dx / len) * sign;
  const bowH = Phaser.Math.Clamp(0.14 * len, 12, 36) * Math.min(scale, 1.5) * 4 * s * (1 - s) * bow;
  return { x: origin.x + dx * s + nx * bowH, y: origin.y + dy * s + ny * bowH };
}

// Head progress along that path. The `0.06` floor puts the projectile clear
// of the caster's own silhouette on the very first frame instead of hiding
// inside it, and the square term keeps the accelerating-shot feel.
function boltProgress(t: number): number {
  return 0.06 + 0.94 * t * t;
}

// Launch point of a travelling shape: sampled once, when the shape is fired.
// A projectile already in flight belongs to the field, not to the hand that
// threw it, so an attacker that moves afterward doesn't drag it -- while the
// destination stays live (read off `to` every frame below) so the shot still
// lands on the target rather than on the empty space it was aimed at.
//
// Drawn as a glowing head trailing a tapering comet tail: the tail is the
// head's own recent positions sampled back along the same curve, so it bends
// with the arc for free and narrows/fades toward its end rather than being a
// parallel-edged line. The tween itself runs Linear and the acceleration
// lives in `boltProgress` -- an eased counter would spend the first third of
// the travel moving the shot barely at all, leaving it invisible inside the
// caster.
const BOLT_TRAIL = 10;
// Path-parameter gap between successive trail samples -- close enough that
// consecutive samples overlap into one continuous tail rather than reading
// as a string of separate beads.
const BOLT_TRAIL_STEP = 0.022;
export function playBolt(
  scene: Phaser.Scene,
  color: number,
  from: EffectAnchor,
  to: EffectAnchor,
  onImpact?: (dir?: Direction) => void,
  depthOffset = 0,
  scale = 1
) {
  const g = fxGraphics(scene, 60, depthOffset);
  const origin = latchAnchor(from);
  fxCounter(scene, depthOffset, {
    from: 0,
    to: 1,
    duration: TRAVEL_MS.bolt,
    ease: 'Linear',
    onUpdate: (tw) => {
      const t = tw.getValue() ?? 0;
      const p = boltProgress(t);
      g.clear();
      for (let k = BOLT_TRAIL; k >= 1; k--) {
        const s = Math.max(0, p - k * BOLT_TRAIL_STEP);
        const q = arcPoint(origin, to, s, scale);
        g.fillStyle(color, 0.55 * Math.pow(1 - k / BOLT_TRAIL, 1.7));
        fillDot(g, q.x, q.y, (5 - k * 0.4) * scale);
      }
      const head = arcPoint(origin, to, p, scale);
      drawGlow(g, color, head.x, head.y, 4 * scale, 1);
      g.fillStyle(0xffffff, 0.6);
      fillDot(g, head.x, head.y, 1.8 * scale);
    },
    onComplete: () => {
      g.destroy();
      onImpact?.(arrivalDirection(origin, to, scale));
    },
  });
}

// Which way a travelling shape was moving as it landed -- the last short
// step of its own curve, normalized.
function arrivalDirection(origin: Direction, to: EffectAnchor, scale: number, bow = 1): Direction {
  const a = arcPoint(origin, to, 0.9, scale, bow);
  const b = arcPoint(origin, to, 1, scale, bow);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: dx / len, y: dy / len };
}

// An expanding wave leaving the caster, nudged a little toward whatever it
// was aimed at. Both anchors are read once, at launch (the aim), and never
// again -- the ring belongs entirely to the attacker's side of the field
// after that. `Cubic.easeOut` on the radius is what makes it read as a wave
// -- fast expansion decelerating as it spreads; each front carries a white
// crest stroke so the wave stays legible in greyscale. `fronts` picks
// between the two shapes built on this: Plasmon Resonance's 'ring' launches
// two chasing wavefronts (alternating charge compressions of the collective
// mode), while Kondo's screening self-buffs ('buffring') stay one wavefront
// with a fainter trailing echo, centred on the caster -- resolveSelfBuff passes
// the caster's own anchor as both `from` and `to`, which collapses the
// nudge. The single front is what keeps a buff's cast distinguishable from
// plasmon's attack even when both play centred (a detail pane's preview).
export function playRing(
  scene: Phaser.Scene,
  color: number,
  from: EffectAnchor,
  to: EffectAnchor,
  onImpact?: (dir?: Direction) => void,
  depthOffset = 0,
  scale = 1,
  fronts: 1 | 2 = 2
) {
  const g = fxGraphics(scene, 60, depthOffset);
  const originX = Phaser.Math.Linear(from.x, to.x, 0.12);
  const originY = Phaser.Math.Linear(from.y, to.y, 0.12);
  fxCounter(scene, depthOffset, {
    from: 0,
    to: 1,
    duration: TRAVEL_MS.ring,
    ease: 'Cubic.easeOut',
    onUpdate: (tw) => {
      const t = tw.getValue() ?? 0;
      g.clear();
      const r = (12 + t * 58) * scale;
      const fade = Math.pow(1 - t, 1.2);
      // Brightness floor while the wave is young, plus a white crest stroke
      // on each front -- an annulus alone peaks far below every other
      // silhouette in greyscale and vanishes over anything brighter than the
      // arena's darkest ground.
      const body = Math.min(1, fade + 0.35);
      drawAnnulus(g, color, originX, originY, r, 3 * scale, body);
      g.lineStyle(1.6 * scale, 0xffffff, 0.8 * fade);
      g.strokeCircle(originX, originY, r);
      if (fronts === 2) {
        const r2 = r - 20 * scale;
        if (r2 > 2) {
          drawAnnulus(g, color, originX, originY, r2, 3 * scale, body * 0.85);
          g.lineStyle(1.3 * scale, 0xffffff, 0.6 * fade);
          g.strokeCircle(originX, originY, r2);
        }
      } else {
        g.lineStyle(2 * scale, 0xffffff, (1 - t) * 0.45);
        g.strokeCircle(originX, originY, r * 0.78);
      }
    },
    onComplete: () => {
      g.destroy();
      onImpact?.();
    },
  });
}

// Same launch-latched origin / live destination / arced path as playBolt,
// but the thing travelling it is a loose cluster rather than a single head:
// the particles wind in as the cluster crosses the field, each keeping its
// own radius and drift so the swarm never collapses into an evenly-spaced
// wheel of dots. A soft glow at the cluster's center ties them together as
// one object.
const BURST_PARTICLES = 12;
export function playBurst(
  scene: Phaser.Scene,
  color: number,
  from: EffectAnchor,
  to: EffectAnchor,
  onImpact?: (dir?: Direction) => void,
  depthOffset = 0,
  scale = 1
) {
  const g = fxGraphics(scene, 60, depthOffset);
  const origin = latchAnchor(from);
  const seeds = Array.from({ length: BURST_PARTICLES }, () => ({
    phase: Math.random() * Math.PI * 2,
    radius: 0.7 + Math.random() * 0.6,
    size: 0.75 + Math.random() * 0.5,
  }));
  fxCounter(scene, depthOffset, {
    from: 0,
    to: 1,
    duration: TRAVEL_MS.burst,
    ease: 'Linear',
    onUpdate: (tw) => {
      const t = tw.getValue() ?? 0;
      const c = arcPoint(origin, to, boltProgress(t), scale);
      g.clear();
      drawGlow(g, color, c.x, c.y, 5 * scale, 0.3 + t * 0.25);
      const spread = ((1 - t) * 32 + t * 14) * scale;
      for (let i = 0; i < BURST_PARTICLES; i++) {
        const s = seeds[i];
        const ang = s.phase + (i / BURST_PARTICLES) * Math.PI * 2 + t * 3;
        const r = spread * s.radius;
        g.fillStyle(color, 0.5 + t * 0.5);
        fillDot(g, c.x + Math.cos(ang) * r, c.y + Math.sin(ang) * r, 3.5 * s.size * scale);
      }
    },
    onComplete: () => {
      g.destroy();
      onImpact?.(arrivalDirection(origin, to, scale));
    },
  });
}


// One strand of a transverse wave riding the flight arc: the arcPoint at
// path parameter `s`, displaced perpendicular to the chord by a sinusoid
// whose crests drift along the path at `phaseVel` (positive = toward the
// target, negative = back toward the caster). Shared by the wave, combwave
// and helix shapes -- the returned `off` is the signed displacement, which
// combwave reads for which side its dipole teeth stand on and helix reads
// to find where its two strands cross.
const WAVE_CYCLES = 3;
function wavePoint(
  origin: Direction,
  to: EffectAnchor,
  s: number,
  scale: number,
  t: number,
  phaseVel: number,
  amp: number
): { x: number; y: number; off: number } {
  const base = arcPoint(origin, to, s, scale);
  const dx = to.x - origin.x;
  const dy = to.y - origin.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const off = amp * Math.sin((s * WAVE_CYCLES - t * phaseVel) * Math.PI * 2);
  return { x: base.x + nx * off, y: base.y + ny * off, off };
}

// Magnon Wave: a transverse sine ribbon -- the flight path itself is the
// medium, a smooth crest snaking across the field with a bright envelope at
// the head. Same launch-latched origin / live destination as playBolt; the
// ribbon is the trailing window of the head's own path, each sample
// displaced perpendicular to the chord (wavePoint above), drawn as short
// segments whose alpha ramps toward the head so the wave reads as carried
// rather than painted on.
const WAVE_SEGMENTS = 16;
const WAVE_WINDOW = 0.5;
const WAVE_AMP = 10;
const WAVE_PHASE_VEL = 1.6;
export function playWave(
  scene: Phaser.Scene,
  color: number,
  from: EffectAnchor,
  to: EffectAnchor,
  onImpact?: (dir?: Direction) => void,
  depthOffset = 0,
  scale = 1
) {
  const g = fxGraphics(scene, 60, depthOffset);
  const origin = latchAnchor(from);
  fxCounter(scene, depthOffset, {
    from: 0,
    to: 1,
    duration: TRAVEL_MS.wave,
    ease: 'Linear',
    onUpdate: (tw) => {
      const t = tw.getValue() ?? 0;
      const p = boltProgress(t);
      const tail = Math.max(0, p - WAVE_WINDOW);
      g.clear();
      let prev = wavePoint(origin, to, tail, scale, t, WAVE_PHASE_VEL, WAVE_AMP * scale);
      for (let i = 1; i <= WAVE_SEGMENTS; i++) {
        const s = tail + ((p - tail) * i) / WAVE_SEGMENTS;
        const q = wavePoint(origin, to, s, scale, t, WAVE_PHASE_VEL, WAVE_AMP * scale);
        g.lineStyle(3 * scale, color, 0.85 * Math.pow(i / WAVE_SEGMENTS, 1.4));
        g.lineBetween(prev.x, prev.y, q.x, q.y);
        prev = q;
      }
      drawGlow(g, color, prev.x, prev.y, 4 * scale, 0.9);
      g.fillStyle(0xffffff, 0.6);
      fillDot(g, prev.x, prev.y, 1.6 * scale);
    },
    onComplete: () => {
      g.destroy();
      onImpact?.(arrivalDirection(origin, to, scale));
    },
  });
}

// Electromagnon Drive: Magnon Wave's ribbon grown teeth -- short
// perpendicular dipole ticks standing on the ribbon, each pointing outward
// past its own crest so they alternate side with the wave phase. Bristly
// against magnon's smooth curve; the teeth run at least as long as the
// ribbon's amplitude so they stay legible at preview-pane size.
const COMB_AMP = 7;
const COMB_TOOTH = 9;
export function playCombwave(
  scene: Phaser.Scene,
  color: number,
  from: EffectAnchor,
  to: EffectAnchor,
  onImpact?: (dir?: Direction) => void,
  depthOffset = 0,
  scale = 1
) {
  const g = fxGraphics(scene, 60, depthOffset);
  const origin = latchAnchor(from);
  fxCounter(scene, depthOffset, {
    from: 0,
    to: 1,
    duration: TRAVEL_MS.combwave,
    ease: 'Linear',
    onUpdate: (tw) => {
      const t = tw.getValue() ?? 0;
      const p = boltProgress(t);
      const tail = Math.max(0, p - WAVE_WINDOW);
      const dx = to.x - origin.x;
      const dy = to.y - origin.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      g.clear();
      let prev = wavePoint(origin, to, tail, scale, t, WAVE_PHASE_VEL, COMB_AMP * scale);
      for (let i = 1; i <= WAVE_SEGMENTS; i++) {
        const s = tail + ((p - tail) * i) / WAVE_SEGMENTS;
        const q = wavePoint(origin, to, s, scale, t, WAVE_PHASE_VEL, COMB_AMP * scale);
        const fade = Math.pow(i / WAVE_SEGMENTS, 1.4);
        g.lineStyle(2.5 * scale, color, 0.85 * fade);
        g.lineBetween(prev.x, prev.y, q.x, q.y);
        if (i % 2 === 0) {
          const side = q.off >= 0 ? 1 : -1;
          const tx = q.x + nx * side * COMB_TOOTH * scale;
          const ty = q.y + ny * side * COMB_TOOTH * scale;
          g.lineStyle(2 * scale, color, 0.8 * fade);
          g.lineBetween(q.x, q.y, tx, ty);
          g.fillStyle(0xffffff, 0.7 * fade);
          fillDot(g, tx, ty, 1.4 * scale);
        }
        prev = q;
      }
      drawGlow(g, color, prev.x, prev.y, 4 * scale, 0.9);
    },
    onComplete: () => {
      g.destroy();
      onImpact?.(arrivalDirection(origin, to, scale));
    },
  });
}

// Helical Lock: two continuous strands entwined about the flight axis, 180
// degrees out of phase, with white node dots where they cross. Both strands
// reuse the wave sampler with opposite phase velocity -- one crest pattern
// drifts toward the target while the other drifts back toward the caster,
// the counter-propagating edge pair the class is named for. Continuous
// ribbons with nodes and no residue, against braid's discrete point-dots.
export function playHelix(
  scene: Phaser.Scene,
  color: number,
  from: EffectAnchor,
  to: EffectAnchor,
  onImpact?: (dir?: Direction) => void,
  depthOffset = 0,
  scale = 1
) {
  const g = fxGraphics(scene, 60, depthOffset);
  const origin = latchAnchor(from);
  fxCounter(scene, depthOffset, {
    from: 0,
    to: 1,
    duration: TRAVEL_MS.helix,
    ease: 'Linear',
    onUpdate: (tw) => {
      const t = tw.getValue() ?? 0;
      const p = boltProgress(t);
      const tail = Math.max(0, p - WAVE_WINDOW);
      g.clear();
      let prevA = wavePoint(origin, to, tail, scale, t, WAVE_PHASE_VEL, WAVE_AMP * scale);
      let prevB = wavePoint(origin, to, tail, scale, t, -WAVE_PHASE_VEL, -WAVE_AMP * scale);
      for (let i = 1; i <= WAVE_SEGMENTS; i++) {
        const s = tail + ((p - tail) * i) / WAVE_SEGMENTS;
        const qA = wavePoint(origin, to, s, scale, t, WAVE_PHASE_VEL, WAVE_AMP * scale);
        const qB = wavePoint(origin, to, s, scale, t, -WAVE_PHASE_VEL, -WAVE_AMP * scale);
        const fade = Math.pow(i / WAVE_SEGMENTS, 1.4);
        g.lineStyle(2.5 * scale, color, 0.85 * fade);
        g.lineBetween(prevA.x, prevA.y, qA.x, qA.y);
        g.lineStyle(2.5 * scale, color, 0.8 * fade);
        g.lineBetween(prevB.x, prevB.y, qB.x, qB.y);
        // A node wherever the two strands cross between this sample and the last.
        if (Math.sign(qA.off - qB.off) !== Math.sign(prevA.off - prevB.off)) {
          g.fillStyle(0xffffff, 0.95 * fade);
          fillDot(g, (qA.x + qB.x) / 2, (qA.y + qB.y) / 2, 3 * scale);
        }
        prevA = qA;
        prevB = qB;
      }
      drawGlow(g, color, prevA.x, prevA.y, 3.5 * scale, 0.8);
    },
    onComplete: () => {
      g.destroy();
      onImpact?.(arrivalDirection(origin, to, scale));
    },
  });
}

// Higgs Oscillation: a soft condensate orb gliding to the target while a
// thin circle marks its equilibrium radius -- the filled amplitude breathes
// about that fixed reference twice en route (the order parameter's magnitude
// oscillating about the condensate minimum), then ends in one deep
// contraction whose release is the impact itself (the arrival spray stays
// evenly radial). The glide is linear and unaccelerated: the identity is in
// the breathing, not the flight, which is also what lets the centred preview
// (from === to) read the same standing still.
const SWELL_R = 11;
const SWELL_BREATHE_END = 0.82;
export function playSwell(
  scene: Phaser.Scene,
  color: number,
  from: EffectAnchor,
  to: EffectAnchor,
  onImpact?: (dir?: Direction) => void,
  depthOffset = 0,
  scale = 1
) {
  const g = fxGraphics(scene, 60, depthOffset);
  const origin = latchAnchor(from);
  fxCounter(scene, depthOffset, {
    from: 0,
    to: 1,
    duration: TRAVEL_MS.swell,
    ease: 'Linear',
    onUpdate: (tw) => {
      const t = tw.getValue() ?? 0;
      const c = arcPoint(origin, to, 0.04 + 0.96 * t, scale);
      let r: number;
      if (t < SWELL_BREATHE_END) {
        r = SWELL_R * scale * (1 + 0.42 * Math.sin((t / SWELL_BREATHE_END) * Math.PI * 4));
      } else {
        const v = (t - SWELL_BREATHE_END) / (1 - SWELL_BREATHE_END);
        r = SWELL_R * scale * (1 - 0.65 * v);
      }
      g.clear();
      drawBloom(g, color, c.x, c.y, r, 0.8);
      g.lineStyle(1.4 * scale, 0xffffff, 0.65);
      g.strokeCircle(c.x, c.y, SWELL_R * scale);
    },
    onComplete: () => {
      g.destroy();
      onImpact?.();
    },
  });
}

// Vison Loop: a Z2 flux carried across the field -- a small constant-radius
// rotor (a fast-spinning drawArcRing) that translates along the arc and
// never expands. Continuous rotation is this silhouette's own axis: no other
// shape spins smoothly (flip and braid rotate only in discrete steps). On
// arrival the loop around the target flashes and inverts -- a contracting
// annulus overlapping the expanding impact wavefront.
export function playVortex(
  scene: Phaser.Scene,
  color: number,
  from: EffectAnchor,
  to: EffectAnchor,
  onImpact?: (dir?: Direction) => void,
  depthOffset = 0,
  scale = 1
) {
  const g = fxGraphics(scene, 60, depthOffset);
  const origin = latchAnchor(from);
  fxCounter(scene, depthOffset, {
    from: 0,
    to: 1,
    duration: TRAVEL_MS.vortex,
    ease: 'Linear',
    onUpdate: (tw) => {
      const t = tw.getValue() ?? 0;
      const c = arcPoint(origin, to, boltProgress(t), scale);
      g.clear();
      drawGlow(g, color, c.x, c.y, 3 * scale, 0.5);
      drawArcRing(g, color, c.x, c.y, 12 * scale, t * 3.4, 0.95, scale * 0.8);
    },
    onComplete: () => {
      g.destroy();
      playVortexInversion(scene, color, to, depthOffset, scale);
      onImpact?.(arrivalDirection(origin, to, scale));
    },
  });
}

// The arrival's inverting loop -- fire-and-forget like playImpactShockwave,
// and spawned through fxGraphics/fxCounter so cancelling a preview wipes it
// with everything else.
function playVortexInversion(scene: Phaser.Scene, color: number, at: EffectAnchor, depthOffset: number, scale: number) {
  const g = fxGraphics(scene, 61, depthOffset);
  fxCounter(scene, depthOffset, {
    from: 0,
    to: 1,
    duration: 150,
    ease: 'Sine.easeIn',
    onUpdate: (tw) => {
      const t = tw.getValue() ?? 0;
      g.clear();
      drawAnnulus(g, color, at.x, at.y, (30 - t * 20) * scale, 2.5 * scale, 0.5 + 0.4 * t);
    },
    onComplete: () => g.destroy(),
  });
}

// Heavy Fermion Drag: the slowest shape in the set -- a large massive body
// lumbering across the field at constant speed on the one path that sags
// *below* the straight line (negative bow: too heavy to arc), with small
// conduction-electron motes spiralling into it as it goes, the mass being
// dressed on mid-flight. Lands with the ordinary set's biggest thud
// (IMPACT_EMPHASIS in art/attackEffects.ts).
const MASS_BOW = -0.9;
const MASS_MOTES = 6;
export function playMass(
  scene: Phaser.Scene,
  color: number,
  from: EffectAnchor,
  to: EffectAnchor,
  onImpact?: (dir?: Direction) => void,
  depthOffset = 0,
  scale = 1
) {
  const g = fxGraphics(scene, 60, depthOffset);
  const origin = latchAnchor(from);
  fxCounter(scene, depthOffset, {
    from: 0,
    to: 1,
    duration: TRAVEL_MS.mass,
    ease: 'Linear',
    onUpdate: (tw) => {
      const t = tw.getValue() ?? 0;
      const c = arcPoint(origin, to, 0.05 + 0.95 * t, scale, MASS_BOW);
      g.clear();
      for (let i = 0; i < MASS_MOTES; i++) {
        const cycle = (t * 1.7 + i / MASS_MOTES) % 1;
        const r = (30 - cycle * 24) * scale;
        const ang = i * 2.4 + t * 6;
        g.fillStyle(color, 0.25 + cycle * 0.6);
        fillDot(g, c.x + Math.cos(ang) * r, c.y + Math.sin(ang) * r, 2 * scale);
      }
      drawBloom(g, color, c.x, c.y, 15 * scale, 0.95);
      g.fillStyle(0xffffff, 0.35);
      fillDot(g, c.x, c.y, 3 * scale);
    },
    onComplete: () => {
      g.destroy();
      onImpact?.(arrivalDirection(origin, to, scale, MASS_BOW));
    },
  });
}

// Majorana Split: the windup's gathered core splits in two -- two dim
// half-glows travelling widely separated mirrored arcs (one bowed up, one
// bowed down, the set's only double bow) that reconverge exactly at the
// target, the recombination being the impact flash itself. Deliberately
// symmetric where sever is not: both halves arrive together, so no arrival
// direction is handed over and the landing spray stays evenly radial.
const SPLIT_BOWS = [1.7, -1.7];
const SPLIT_TRAIL = 8;
export function playSplit(
  scene: Phaser.Scene,
  color: number,
  from: EffectAnchor,
  to: EffectAnchor,
  onImpact?: (dir?: Direction) => void,
  depthOffset = 0,
  scale = 1
) {
  const g = fxGraphics(scene, 60, depthOffset);
  const origin = latchAnchor(from);
  fxCounter(scene, depthOffset, {
    from: 0,
    to: 1,
    duration: TRAVEL_MS.split,
    ease: 'Linear',
    onUpdate: (tw) => {
      const t = tw.getValue() ?? 0;
      const p = boltProgress(t);
      g.clear();
      for (const bow of SPLIT_BOWS) {
        for (let k = SPLIT_TRAIL; k >= 1; k--) {
          const s = Math.max(0, p - k * BOLT_TRAIL_STEP * 1.5);
          const q = arcPoint(origin, to, s, scale, bow);
          g.fillStyle(color, 0.45 * Math.pow(1 - k / SPLIT_TRAIL, 1.7));
          fillDot(g, q.x, q.y, (3.5 - k * 0.35) * scale);
        }
        const head = arcPoint(origin, to, p, scale, bow);
        drawGlow(g, color, head.x, head.y, 3 * scale, 0.75);
        g.fillStyle(0xffffff, 0.55);
        fillDot(g, head.x, head.y, 1.6 * scale);
      }
    },
    onComplete: () => {
      g.destroy();
      onImpact?.();
    },
  });
}

// Phonon Beam's medium: N sites sampled on the *straight* caster->target
// segment (the one flight path in the whole set with no bow at all -- a
// phonon rides the rigid crystal axis), each displaced longitudinally by an
// odd Gaussian profile centred on the travelling pulse, so sites bunch
// toward the pulse centre and brighten where compressed, relaxing behind it.
// Sites snap in staggered from the caster's side over the first beat of the
// travel. Strictly dots with a brightness pulse and no travelling head --
// rail is the stroked, bowed curve with dashes streaming on it.
const LATTICE_SITES = 9;
const LATTICE_SIGMA = 0.09;
export function drawLatticePulse(
  g: Phaser.GameObjects.Graphics,
  color: number,
  origin: Direction,
  to: EffectAnchor,
  pulseS: number,
  t: number,
  scale: number
) {
  const dx = to.x - origin.x;
  const dy = to.y - origin.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  for (let i = 0; i < LATTICE_SITES; i++) {
    const s = 0.08 + (0.88 * i) / (LATTICE_SITES - 1);
    const appear = Phaser.Math.Clamp((t - 0.02 - s * 0.16) * 12, 0, 1);
    if (appear <= 0) continue;
    const d = (s - pulseS) / LATTICE_SIGMA;
    const gauss = Math.exp(-0.5 * d * d);
    const disp = -Math.tanh(d) * gauss * 10 * scale;
    const x = origin.x + dx * s + ux * disp;
    const y = origin.y + dy * s + uy * disp;
    g.fillStyle(color, appear * (0.35 + 0.65 * gauss));
    fillDot(g, x, y, (2 + 1.6 * gauss) * scale);
    if (gauss > 0.55) drawGlow(g, color, x, y, 2.5 * scale, gauss * 0.5);
  }
}

// Phonon Beam: the lattice line snaps in, then one longitudinal compression
// pulse runs straight down it (drawLatticePulse above). The weakest move in
// the game lands the smallest impact (IMPACT_EMPHASIS in
// art/attackEffects.ts).
export function playLattice(
  scene: Phaser.Scene,
  color: number,
  from: EffectAnchor,
  to: EffectAnchor,
  onImpact?: (dir?: Direction) => void,
  depthOffset = 0,
  scale = 1
) {
  const g = fxGraphics(scene, 60, depthOffset);
  const origin = latchAnchor(from);
  fxCounter(scene, depthOffset, {
    from: 0,
    to: 1,
    duration: TRAVEL_MS.lattice,
    ease: 'Linear',
    onUpdate: (tw) => {
      const t = tw.getValue() ?? 0;
      const pulseS = Phaser.Math.Clamp((t - 0.15) / 0.85, 0, 1);
      g.clear();
      drawLatticePulse(g, color, origin, to, pulseS, t, scale);
    },
    onComplete: () => {
      g.destroy();
      const dx = to.x - origin.x;
      const dy = to.y - origin.y;
      const len = Math.hypot(dx, dy) || 1;
      onImpact?.({ x: dx / len, y: dy / len });
    },
  });
}

// A double-headed polarization needle: a shaft with a triangle head at both
// ends, the +P end bright white and the other dim, so a 180-degree reversal
// is visible rather than mapping the silhouette onto itself.
export function drawNeedle(
  g: Phaser.GameObjects.Graphics,
  color: number,
  x: number,
  y: number,
  angle: number,
  len: number,
  scale: number
) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const hx = x + cos * len;
  const hy = y + sin * len;
  const tx = x - cos * len;
  const ty = y - sin * len;
  const w = 4 * scale;
  const hlen = 6 * scale;
  g.lineStyle(2.5 * scale, color, 0.9);
  g.lineBetween(tx, ty, hx, hy);
  g.fillStyle(0xffffff, 0.95);
  g.fillTriangle(hx + cos * hlen, hy + sin * hlen, hx - sin * w, hy + cos * w, hx + sin * w, hy - cos * w);
  g.fillStyle(color, 0.55);
  g.fillTriangle(tx - cos * hlen, ty - sin * hlen, tx - sin * w, ty + cos * w, tx + sin * w, ty - cos * w);
}

// Ferron Switch: the needle travels the arc while snapping 180 degrees
// between up and down in discrete flips -- bistable like the polarization it
// carries, never a continuous spin (continuous rotation is vison's alone;
// flip and braid rotate only in steps). An odd number of flips, so it
// arrives locked reversed, and two opposed arrowheads kick outward on
// landing (playFlipKick). Standing still (the centred preview) it just
// snaps in place.
const FLIP_STATES = 4;
export function playFlip(
  scene: Phaser.Scene,
  color: number,
  from: EffectAnchor,
  to: EffectAnchor,
  onImpact?: (dir?: Direction) => void,
  depthOffset = 0,
  scale = 1
) {
  const g = fxGraphics(scene, 60, depthOffset);
  const origin = latchAnchor(from);
  fxCounter(scene, depthOffset, {
    from: 0,
    to: 1,
    duration: TRAVEL_MS.flip,
    ease: 'Linear',
    onUpdate: (tw) => {
      const t = tw.getValue() ?? 0;
      const c = arcPoint(origin, to, boltProgress(t), scale);
      const up = Math.floor(Math.min(t, 0.999) * FLIP_STATES) % 2 === 0;
      g.clear();
      drawGlow(g, color, c.x, c.y, 3 * scale, 0.4);
      drawNeedle(g, color, c.x, c.y, up ? -Math.PI / 2 : Math.PI / 2, 15 * scale, scale);
    },
    onComplete: () => {
      g.destroy();
      playFlipKick(scene, color, to, depthOffset, scale);
      onImpact?.(arrivalDirection(origin, to, scale));
    },
  });
}

// The landing's opposed arrowheads kicking outward -- fire-and-forget, and
// spawned through fxGraphics/fxCounter so cancelling a preview wipes it with
// everything else.
function playFlipKick(scene: Phaser.Scene, color: number, at: EffectAnchor, depthOffset: number, scale: number) {
  const g = fxGraphics(scene, 61, depthOffset);
  fxCounter(scene, depthOffset, {
    from: 0,
    to: 1,
    duration: 160,
    ease: 'Cubic.easeOut',
    onUpdate: (tw) => {
      const t = tw.getValue() ?? 0;
      const d = (6 + t * 18) * scale;
      const w = 4 * scale;
      const h = 7 * scale;
      const alpha = 0.9 * (1 - t);
      g.clear();
      g.fillStyle(0xffffff, alpha);
      g.fillTriangle(at.x, at.y - d - h, at.x - w, at.y - d, at.x + w, at.y - d);
      g.fillStyle(color, alpha);
      g.fillTriangle(at.x, at.y + d + h, at.x - w, at.y + d, at.x + w, at.y + d);
    },
    onComplete: () => g.destroy(),
  });
}

// A stroked span of the flight arc between path parameters s0..s1 -- the
// rail shape's drawing unit, for both the rail itself and its dashes.
const RAIL_SPAN_SAMPLES = 14;
function drawRailSpan(
  g: Phaser.GameObjects.Graphics,
  color: number,
  origin: Direction,
  to: EffectAnchor,
  s0: number,
  s1: number,
  scale: number,
  width: number,
  alpha: number
) {
  if (s1 <= s0 || alpha <= 0) return;
  const n = Math.max(2, Math.ceil(RAIL_SPAN_SAMPLES * (s1 - s0)));
  g.lineStyle(width, color, alpha);
  g.beginPath();
  for (let i = 0; i <= n; i++) {
    const q = arcPoint(origin, to, s0 + ((s1 - s0) * i) / n, scale);
    if (i === 0) g.moveTo(q.x, q.y);
    else g.lineTo(q.x, q.y);
  }
  g.strokePath();
}

// Chiral Current: an edge line strokes itself in along the bow, then bright
// dashes stream along it single-file, all one way -- nothing backscatters --
// with the rail fading away behind the last dash. Each dash lands as its own
// quick tick at the target just before the shared impact. A continuous glide
// on a drawn line, against hop's discrete jumps with no path; a stroked,
// bowed curve with travelling heads, against lattice's straight dots with
// none.
const RAIL_STROKE_T = 0.3;
const RAIL_DASHES = 3;
const RAIL_GAP = 0.12;
const RAIL_TICK = 0.07;
export function playRail(
  scene: Phaser.Scene,
  color: number,
  from: EffectAnchor,
  to: EffectAnchor,
  onImpact?: (dir?: Direction) => void,
  depthOffset = 0,
  scale = 1
) {
  const g = fxGraphics(scene, 60, depthOffset);
  const origin = latchAnchor(from);
  fxCounter(scene, depthOffset, {
    from: 0,
    to: 1,
    duration: TRAVEL_MS.rail,
    ease: 'Linear',
    onUpdate: (tw) => {
      const t = tw.getValue() ?? 0;
      g.clear();
      if (t < RAIL_STROKE_T) {
        const u = t / RAIL_STROKE_T;
        drawRailSpan(g, color, origin, to, 0, u, scale, 2 * scale, 0.7);
        const tip = arcPoint(origin, to, u, scale);
        drawGlow(g, color, tip.x, tip.y, 2.5 * scale, 0.7);
      } else {
        const v = (t - RAIL_STROKE_T) / (1 - RAIL_STROKE_T);
        const P = v * (1 + (RAIL_DASHES - 1) * RAIL_GAP + RAIL_TICK + 0.01);
        const sLast = Phaser.Math.Clamp(P - (RAIL_DASHES - 1) * RAIL_GAP, 0, 1);
        drawRailSpan(g, color, origin, to, sLast, 1, scale, 2 * scale, 0.7);
        drawRailSpan(g, color, origin, to, Math.max(0, sLast - 0.2), sLast, scale, 2 * scale, 0.25);
        for (let k = 0; k < RAIL_DASHES; k++) {
          const sk = P - k * RAIL_GAP;
          if (sk <= 0) continue;
          if (sk < 1) {
            drawRailSpan(g, 0xffffff, origin, to, Math.max(0, sk - 0.05), sk, scale, 3 * scale, 0.95);
            const head = arcPoint(origin, to, sk, scale);
            drawGlow(g, color, head.x, head.y, 2.5 * scale, 0.8);
          } else if (sk < 1 + RAIL_TICK) {
            const w = 1 - (sk - 1) / RAIL_TICK;
            g.fillStyle(0xffffff, 0.9 * w);
            fillDot(g, to.x, to.y, (1 + 3 * w) * scale);
            drawGlow(g, color, to.x, to.y, 3 * scale, 0.5 * w);
          }
        }
      }
    },
    onComplete: () => {
      g.destroy();
      onImpact?.(arrivalDirection(origin, to, scale));
    },
  });
}

// Triplon Surge: dimer pads (dot pairs) fade in along the path, then a
// bright triplet packet hops pad-to-pad in discrete jumps with visible
// dwells -- a hop, never a glide, and no drawn path at all. Each hop is its
// own small local arc; the packet brightens while it sits.
const HOP_PADS = 5;
const HOP_DWELL = 0.4;
export function playHop(
  scene: Phaser.Scene,
  color: number,
  from: EffectAnchor,
  to: EffectAnchor,
  onImpact?: (dir?: Direction) => void,
  depthOffset = 0,
  scale = 1
) {
  const g = fxGraphics(scene, 60, depthOffset);
  const origin = latchAnchor(from);
  const padS = (i: number) => 0.06 + (0.94 * i) / (HOP_PADS - 1);
  fxCounter(scene, depthOffset, {
    from: 0,
    to: 1,
    duration: TRAVEL_MS.hop,
    ease: 'Linear',
    onUpdate: (tw) => {
      const t = tw.getValue() ?? 0;
      const dx = to.x - origin.x;
      const dy = to.y - origin.y;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len;
      const uy = dy / len;
      g.clear();
      for (let i = 0; i < HOP_PADS; i++) {
        const a = Phaser.Math.Clamp((t - 0.03 * i) * 8, 0, 1) * 0.75;
        if (a <= 0) continue;
        const q = arcPoint(origin, to, padS(i), scale);
        g.fillStyle(color, a);
        fillDot(g, q.x - ux * 3.4 * scale, q.y - uy * 3.4 * scale, 2.4 * scale);
        fillDot(g, q.x + ux * 3.4 * scale, q.y + uy * 3.4 * scale, 2.4 * scale);
      }
      const u = Phaser.Math.Clamp((t - 0.16) / 0.84, 0, 1);
      const seg = Math.min(HOP_PADS - 1 - 1e-4, u * (HOP_PADS - 1));
      const k = Math.floor(seg);
      const h = seg - k;
      const jump = h < HOP_DWELL ? 0 : (h - HOP_DWELL) / (1 - HOP_DWELL);
      const je = 0.5 - Math.cos(Math.PI * jump) / 2;
      const a1 = arcPoint(origin, to, padS(k), scale);
      const a2 = arcPoint(origin, to, padS(k + 1), scale);
      const px = Phaser.Math.Linear(a1.x, a2.x, je);
      const py = Phaser.Math.Linear(a1.y, a2.y, je) - Math.sin(Math.PI * je) * 15 * scale;
      const bright = jump === 0 ? 0.7 + 0.3 * Math.sin((h / HOP_DWELL) * Math.PI) : 1;
      drawGlow(g, color, px, py, 3.5 * scale, 0.8 * bright);
      for (let m = 0; m < 3; m++) {
        const ang = -Math.PI / 2 + (m * Math.PI * 2) / 3;
        g.fillStyle(0xffffff, 0.75 * bright);
        fillDot(g, px + Math.cos(ang) * 3 * scale, py + Math.sin(ang) * 3 * scale, 1.5 * scale);
      }
    },
    onComplete: () => {
      g.destroy();
      onImpact?.(arrivalDirection(origin, to, scale));
    },
  });
}

// Spinon Swap: a glowing singlet bond stretches out from the caster, thins
// at its middle and snaps -- the far half flies on to the target while the
// near half recoils into the caster and fades. Two spinons where a bond was.
// Deliberately asymmetric (one head arrives) where split is symmetric (two
// arrive together). Two-phase inside the one tween: stretch until
// SEVER_SNAP_T, snap after.
const SEVER_SNAP_T = 0.42;
const SEVER_REACH = 0.55;
const SEVER_SEGS = 8;
export function playSever(
  scene: Phaser.Scene,
  color: number,
  from: EffectAnchor,
  to: EffectAnchor,
  onImpact?: (dir?: Direction) => void,
  depthOffset = 0,
  scale = 1
) {
  const g = fxGraphics(scene, 60, depthOffset);
  const origin = latchAnchor(from);
  fxCounter(scene, depthOffset, {
    from: 0,
    to: 1,
    duration: TRAVEL_MS.sever,
    ease: 'Linear',
    onUpdate: (tw) => {
      const t = tw.getValue() ?? 0;
      g.clear();
      if (t < SEVER_SNAP_T) {
        const u = Math.sin(((t / SEVER_SNAP_T) * Math.PI) / 2);
        const reach = SEVER_REACH * u;
        let prev = arcPoint(origin, to, 0, scale);
        for (let i = 1; i <= SEVER_SEGS; i++) {
          const s = (reach * i) / SEVER_SEGS;
          const q = arcPoint(origin, to, s, scale);
          const mid = Math.sin((i / SEVER_SEGS) * Math.PI);
          g.lineStyle(Math.max(0.5, (3 - 2.2 * mid * u) * scale), color, 0.9);
          g.lineBetween(prev.x, prev.y, q.x, q.y);
          prev = q;
        }
        drawGlow(g, color, origin.x, origin.y, 2.5 * scale, 0.5);
        drawGlow(g, color, prev.x, prev.y, 3 * scale, 0.7);
      } else {
        const v = (t - SEVER_SNAP_T) / (1 - SEVER_SNAP_T);
        const headS = SEVER_REACH + (1 - SEVER_REACH) * v * (2 - v);
        const tailS = Math.max(0, headS - (SEVER_REACH / 2) * (1 - 0.5 * v));
        drawRailSpan(g, color, origin, to, tailS, headS, scale, 2.5 * scale, 0.9);
        const head = arcPoint(origin, to, headS, scale);
        drawGlow(g, color, head.x, head.y, 3 * scale, 0.85);
        const recoil = (SEVER_REACH / 2) * (1 - v);
        drawRailSpan(g, color, origin, to, 0, recoil, scale, 2 * scale, 0.8 * (1 - v));
        drawGlow(g, color, origin.x, origin.y, 2.5 * scale, 0.5 * (1 - v));
        if (v < 0.25) {
          const snap = arcPoint(origin, to, SEVER_REACH / 2, scale);
          g.fillStyle(0xffffff, 0.9 * (1 - v / 0.25));
          fillDot(g, snap.x, snap.y, 3.5 * scale);
        }
      }
    },
    onComplete: () => {
      g.destroy();
      onImpact?.(arrivalDirection(origin, to, scale));
    },
  });
}

// Anyon Braid: two compact charge dots crossing the field while exchanging
// positions about the flight axis in discrete half-turn swaps -- rotation in
// steps, never continuous (vison's alone) -- each crossing flashing and
// leaving a small arc of phase residue hanging on the path behind them. The
// residue arcs are the record of the braiding (the statistics live in the
// exchange), which is also what separates the pair from helix's continuous
// ribbons: point-dots with discrete crossings and residue, against smooth
// strands with none.
const BRAID_EXCHANGES = 4;
const BRAID_DWELL = 0.35;
export function playBraid(
  scene: Phaser.Scene,
  color: number,
  from: EffectAnchor,
  to: EffectAnchor,
  onImpact?: (dir?: Direction) => void,
  depthOffset = 0,
  scale = 1
) {
  const g = fxGraphics(scene, 60, depthOffset);
  const origin = latchAnchor(from);
  fxCounter(scene, depthOffset, {
    from: 0,
    to: 1,
    duration: TRAVEL_MS.braid,
    ease: 'Linear',
    onUpdate: (tw) => {
      const t = tw.getValue() ?? 0;
      const c = arcPoint(origin, to, boltProgress(t), scale);
      const dx = to.x - origin.x;
      const dy = to.y - origin.y;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len;
      const uy = dy / len;
      const nx = -dy / len;
      const ny = dx / len;
      const seg = Math.min(BRAID_EXCHANGES - 1e-4, t * BRAID_EXCHANGES);
      const k = Math.floor(seg);
      const h = seg - k;
      const swap = h < BRAID_DWELL ? 0 : (h - BRAID_DWELL) / (1 - BRAID_DWELL);
      const phi = Math.PI * (k + swap);
      g.clear();
      for (let m = 0; m < BRAID_EXCHANGES; m++) {
        const tm = (m + BRAID_DWELL + (1 - BRAID_DWELL) * 0.5) / BRAID_EXCHANGES;
        if (t <= tm) break;
        const alpha = 0.8 * Math.max(0, 1 - (t - tm) * 1.2);
        if (alpha <= 0) continue;
        const q = arcPoint(origin, to, boltProgress(tm), scale);
        g.lineStyle(2 * scale, color, alpha);
        g.beginPath();
        g.arc(q.x, q.y, 7 * scale, Math.PI * 0.2 + m, Math.PI * 1.2 + m);
        g.strokePath();
      }
      const cosPhi = Math.cos(phi);
      const along = 4 * scale * Math.sin(phi);
      for (const sgn of [1, -1]) {
        const x = c.x + nx * 7 * scale * cosPhi * sgn + ux * along * sgn;
        const y = c.y + ny * 7 * scale * cosPhi * sgn + uy * along * sgn;
        drawGlow(g, color, x, y, 3 * scale, 0.7);
        g.fillStyle(color, 0.95);
        fillDot(g, x, y, 4 * scale);
      }
      if (Math.abs(cosPhi) < 0.25 && swap > 0) {
        g.fillStyle(0xffffff, 0.9);
        fillDot(g, c.x, c.y, 4 * scale);
      }
    },
    onComplete: () => {
      g.destroy();
      onImpact?.(arrivalDirection(origin, to, scale));
    },
  });
}

// One layer of a falling column of light, drawn as a filled path whose
// half-width varies down its own height rather than as an axis-aligned
// rectangle: it narrows at the sky end and flares toward the ground, with a
// slow travelling waist so the light reads as having air and movement in it.
// `sway` bows the whole layer sideways by a phase that also varies with
// height, which is what makes the two side-rays wrap around the main column
// instead of sliding past it. `x` is resolved from the live anchor on every
// call, so the whole column tracks the target.
const COLUMN_SAMPLES = 10;
function drawColumn(
  g: Phaser.GameObjects.Graphics,
  color: number,
  at: EffectAnchor,
  topY: number,
  bottomY: number,
  halfWidth: number,
  alpha: number,
  t: number,
  sway: number
) {
  if (bottomY <= topY || alpha <= 0) return;
  const span = bottomY - topY;
  const edge = (i: number, side: number) => {
    const u = i / (COLUMN_SAMPLES - 1);
    const w = halfWidth * (0.45 + 0.55 * Math.pow(u, 1.4)) + 3 * Math.sin(u * 7 + t * 9);
    const offset = sway * Math.sin(u * 3 + t * 20);
    return { x: at.x + offset + side * w, y: topY + u * span };
  };
  g.fillStyle(color, alpha);
  g.beginPath();
  const start = edge(0, -1);
  g.moveTo(start.x, start.y);
  for (let i = 1; i < COLUMN_SAMPLES; i++) {
    const p = edge(i, -1);
    g.lineTo(p.x, p.y);
  }
  for (let i = COLUMN_SAMPLES - 1; i >= 0; i--) {
    const p = edge(i, 1);
    g.lineTo(p.x, p.y);
  }
  g.closePath();
  g.fillPath();
}

// A jet of light rising from the ground: a tapered filled path, widest at
// its base and narrowing to a tip, with a slow wobble down its length. The
// vertical counterpart of drawColumn above, and the reason a geyser no
// longer needs a pair of axis-aligned rectangles.
const JET_SAMPLES = 8;
function drawJet(
  g: Phaser.GameObjects.Graphics,
  color: number,
  x: number,
  groundY: number,
  height: number,
  halfWidth: number,
  alpha: number,
  t: number
) {
  if (height <= 0 || alpha <= 0) return;
  const edge = (i: number, side: number) => {
    const u = i / (JET_SAMPLES - 1);
    const w = halfWidth * Math.pow(1 - u, 0.7) + 2 * Math.sin(u * 6 + t * 30);
    return { x: x + Math.sin(u * 4 + t * 12) * 3 + side * w, y: groundY - u * height };
  };
  g.fillStyle(color, alpha);
  g.beginPath();
  const start = edge(0, -1);
  g.moveTo(start.x, start.y);
  for (let i = 1; i < JET_SAMPLES; i++) {
    const p = edge(i, -1);
    g.lineTo(p.x, p.y);
  }
  for (let i = JET_SAMPLES - 1; i >= 0; i--) {
    const p = edge(i, 1);
    g.lineTo(p.x, p.y);
  }
  g.closePath();
  g.fillPath();
}

// A thick column of light dropping straight down onto the target from off
// the top of the screen -- takes no attacker anchor at all, since a beam
// falling out of the sky doesn't originate there. Telegraphs first (a faint,
// full-height column fades in before the bright head starts falling) so the
// "incoming" beat reads clearly, then the head travels the height of the
// field to land. Substantially flashier than the other move classes on
// purpose -- Landau's own request was "a beam falling from the sky,"
// clearly reading as stronger than an ordinary hit: a pair of swirling
// side-rays orbit the main column, a radiant sun expands at the point of
// origin as the beam charges, and a trail of falling sparks chases the head
// down.
export function playBeam(
  scene: Phaser.Scene,
  color: number,
  to: EffectAnchor,
  onImpact?: (dir?: Direction) => void,
  depthOffset = 0,
  scale = 1,
  // How far below `to` the floor the pool spreads across lies. GROUND_DROP
  // in a battle, where `to` is the defender's own centre and the floor is at
  // its feet; 0 when the caller has handed over the floor line itself and
  // there is no body standing on it (a panel's preview stage,
  // art/moveEffectPreview.ts), so the column lands on the ground rather than
  // ending in mid-air where a defender would have been.
  groundDrop = GROUND_DROP
) {
  const g = fxGraphics(scene, 60, depthOffset);
  const sun = fxGraphics(scene, 59, depthOffset);
  const originY = -40;
  fxCounter(scene, depthOffset, {
    from: 0,
    to: 1,
    duration: TRAVEL_MS.beam,
    // Linear, with the fall shaped inside onUpdate -- an eased counter
    // spends the whole first third of the travel with the column still
    // effectively off-screen and its telegraph invisible.
    ease: 'Linear',
    onUpdate: (tw) => {
      const t = tw.getValue() ?? 0;
      const fall = Math.min(1, t * 1.3);
      const headY = Phaser.Math.Linear(originY, to.y, fall);
      const pulse = 0.75 + 0.25 * Math.sin(t * 46);
      g.clear();
      // Wide, pulsing telegraph halo -- ramped in on the raw tween so it has
      // fully arrived by the time the head is a third of the way down,
      // rather than still fading up as the beam lands.
      drawColumn(g, color, to, originY, to.y, 34 * scale, 0.22 * Math.min(1, t * 2.5) * pulse, t, 0);
      // Two side-rays wrapping around the main column, their offset varying
      // down the column's own height so they visibly spiral rather than
      // sliding sideways as one rigid pair.
      drawColumn(g, color, to, originY, headY, 5 * scale, 0.5 * t, t, 20 * scale);
      drawColumn(g, color, to, originY, headY, 5 * scale, 0.5 * t, t, -20 * scale);
      // Main column, brighter/wider than the side-rays, flaring toward the
      // ground so it reads as a shaft of light with air in it.
      drawColumn(g, color, to, originY, headY, 15 * scale, 0.9, t, 0);
      // White-hot core.
      drawColumn(g, 0xffffff, to, originY, headY, 5 * scale, 0.95, t, 0);
      // Sparks shaken loose from the head, drifting back up the column.
      for (let i = 0; i < 7; i++) {
        const sy = headY - i * 16;
        if (sy < originY) continue;
        const sx = to.x + Math.sin(t * 34 + i * 1.7) * (14 - i) * scale;
        g.fillStyle(i % 2 === 0 ? 0xffffff : color, 0.85 - i * 0.11);
        fillDot(g, sx, sy, (3.2 - i * 0.22) * scale);
      }
      // Once the head is down, a pool of light spreading across the ground
      // where the column meets it, with a few licks curling back up.
      if (fall >= 1) {
        const q = Math.min(1, (t - 1 / 1.3) / (1 - 1 / 1.3));
        const groundY = to.y + groundDrop;
        g.fillStyle(color, 0.5 * (1 - q));
        g.fillEllipse(to.x, groundY, (20 + q * 40) * 2 * scale, (20 + q * 40) * 2 * GROUND_ASPECT * scale);
        for (let i = 0; i < 4; i++) {
          const side = i % 2 === 0 ? 1 : -1;
          const spread = (14 + i * 7 + q * 26) * scale * side;
          g.lineStyle(2.5 * scale, color, 0.6 * (1 - q));
          g.beginPath();
          g.moveTo(to.x, groundY);
          g.lineTo(to.x + spread * 0.6, groundY - 10 * scale);
          g.lineTo(to.x + spread, groundY - (18 + q * 14) * scale);
          g.strokePath();
        }
      }
      // Radiant sun expanding at the point of origin as the beam charges.
      sun.clear();
      drawBloom(sun, 0xffffff, to.x, originY, (12 + t * 46) * scale, 0.55 * (1 - t));
      drawAnnulus(sun, color, to.x, originY, (18 + t * 58) * scale, 3 * scale, 0.75 * (1 - t));
    },
    onComplete: () => {
      g.destroy();
      sun.destroy();
      onImpact?.({ x: 0, y: 1 });
    },
  });
}

// Shards bursting up and outward from a crack in the ground under the
// target -- also takes no attacker anchor, since the eruption comes up from
// beneath the defender rather than travelling from the attacker.
// Substantially flashier than the other move classes on purpose (Landau's
// own request): an expanding double shockwave ring on the ground, a bright
// geyser core punching straight up through the shards, and nearly double the
// shard count spread wider than an ordinary burst.
export function playEruption(
  scene: Phaser.Scene,
  color: number,
  to: EffectAnchor,
  onImpact?: (dir?: Direction) => void,
  depthOffset = 0,
  scale = 1,
  // Same floor-offset argument playBeam takes above, for the same reason:
  // GROUND_DROP below the defender in a battle, 0 when the caller's `to` is
  // already the floor line the crack opens in.
  groundDrop = GROUND_DROP
) {
  const g = fxGraphics(scene, 60, depthOffset);
  const n = 18;
  // Seeded once per cast: without the jitter the shards fly as an evenly
  // spaced string of identical dots on one common arc, which reads as
  // decoration rather than as debris.
  const shards = Array.from({ length: n }, (_, i) => ({
    angle: -Math.PI / 2 + ((i / (n - 1)) - 0.5) * 2.3 + (Math.random() - 0.5) * 0.4,
    speed: 0.65 + Math.random() * 0.7,
    size: 0.8 + Math.random() * 0.5,
    heavy: i % 3 !== 0,
  }));
  fxCounter(scene, depthOffset, {
    from: 0,
    to: 1,
    duration: TRAVEL_MS.eruption,
    ease: 'Cubic.easeOut',
    onUpdate: (tw) => {
      const t = tw.getValue() ?? 0;
      const groundY = to.y + groundDrop;
      g.clear();
      // Expanding shockwave rings spreading out across the floor.
      drawAnnulus(g, color, to.x, groundY, (16 + t * 76) * scale, 3 * scale, 0.85 * (1 - t), GROUND_ASPECT);
      drawAnnulus(g, 0xffffff, to.x, groundY, (10 + t * 54) * scale, 2.5 * scale, 0.5 * (1 - t), GROUND_ASPECT);
      // Crack glow opening in the ground.
      g.fillStyle(color, 0.65 * (1 - t));
      g.fillEllipse(to.x, groundY, (74 + t * 54) * scale, (74 + t * 54) * GROUND_ASPECT * scale);
      // Geyser jet: a tapered, wavering column that rises and collapses
      // within the beat rather than freezing at full height and fading.
      const coreH = 110 * Math.sin(Math.min(1, t * 1.25) * Math.PI) * scale;
      drawJet(g, color, to.x, groundY, coreH, 14 * scale, 0.55 * (1 - t * 0.4), t);
      drawJet(g, 0xffffff, to.x, groundY, coreH * 0.94, 5 * scale, 0.85 * (1 - t * 0.4), t);
      // Debris thrown up and out, the heavier pieces arcing over and falling
      // back rather than every piece flying straight forever.
      for (const shard of shards) {
        const dist = t * 100 * shard.speed * scale;
        const px = to.x + Math.cos(shard.angle) * dist * 0.6;
        const py = groundY + Math.sin(shard.angle) * dist + (shard.heavy ? 44 * t * t * scale : 0);
        const trail = (7 + shard.speed * 3) * scale;
        g.lineStyle((3 - t * 1.5) * shard.size * scale, shard.heavy ? color : 0xffffff, 0.95 * (1 - t * 0.6));
        g.lineBetween(px - Math.cos(shard.angle) * trail * 0.6, py - Math.sin(shard.angle) * trail, px, py);
      }
    },
    onComplete: () => {
      g.destroy();
      onImpact?.({ x: 0, y: -1 });
    },
  });
}

// A bright flash, a soft wavefront and a spray of debris on arrival, common
// to every move class -- fire-and-forget (destroys itself once decayed,
// doesn't gate onImpact) so it layers on top of whatever BattleScene does
// with the hit (HP bar update, flashHit squash, camera shake) without
// delaying any of it. Purely target-side, the mirror of playWindup above.
//
// The debris is seeded once per impact (angle jitter, length, so no two
// impacts spray the same way and none of them read as an evenly-spoked
// asterisk) and each piece draws as a tapering sliver rather than a line of
// constant width. `dir` is the direction the hit came in from, when the
// shape that landed knows one (a travelling head hands over its own
// arrival heading, a beam comes down, an eruption comes up) -- debris then
// throws into the hemisphere *away* from it, the way a real strike splashes.
// Without one (a ring, a self-buff, swell's release, split's symmetric
// recombination) the spray stays evenly radial.
const IMPACT_SHARDS = 10;
const IMPACT_SPLASH_ARC = 1.22; // ±70° around the rebound direction
export function playImpactShockwave(
  scene: Phaser.Scene,
  color: number,
  at: EffectAnchor,
  depthOffset = 0,
  scale = 1,
  dir?: Direction
) {
  const g = fxGraphics(scene, 61, depthOffset);
  const base = dir ? Math.atan2(-dir.y, -dir.x) : 0;
  const spread = dir ? IMPACT_SPLASH_ARC : Math.PI;
  const shards = Array.from({ length: IMPACT_SHARDS }, (_, i) => ({
    angle: base + ((i / (IMPACT_SHARDS - 1)) - 0.5) * 2 * spread + (Math.random() - 0.5) * 0.5,
    length: 0.6 + Math.random() * 0.8,
  }));
  fxCounter(scene, depthOffset, {
    from: 0,
    to: 1,
    duration: IMPACT_MS,
    ease: 'Cubic.easeOut',
    onUpdate: (tw) => {
      const t = tw.getValue() ?? 0;
      g.clear();
      drawGlow(g, 0xffffff, at.x, at.y, (5 + t * 9) * scale, 0.7 * Math.pow(1 - t, 2.2));
      drawAnnulus(g, color, at.x, at.y, (10 + t * 40) * scale, 3 * scale, 0.8 * (1 - t));
      for (const shard of shards) {
        const r1 = (8 + t * 34 * shard.length) * scale;
        const r0 = Math.max(0, r1 - 12 * shard.length * scale);
        const cos = Math.cos(shard.angle);
        const sin = Math.sin(shard.angle);
        const half = 1.25 * scale;
        g.fillStyle(color, 0.8 * Math.pow(1 - t, 2));
        g.fillTriangle(
          at.x + cos * r1,
          at.y + sin * r1,
          at.x + cos * r0 - sin * half,
          at.y + sin * r0 + cos * half,
          at.x + cos * r0 + sin * half,
          at.y + sin * r0 - cos * half
        );
      }
    },
    onComplete: () => g.destroy(),
  });
}
