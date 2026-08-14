import Phaser from 'phaser';
import type { AttackShape } from '../audio/sfx';
import { latchAnchor, type EffectAnchor } from './attackAnchors';

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
export const TRAVEL_MS: Record<AttackShape, number> = {
  bolt: 340,
  ring: 460,
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
  g.fillCircle(x, y, r);
  g.fillStyle(color, 0.4 * alpha);
  g.fillCircle(x, y, r * 1.75);
  g.fillStyle(color, 0.18 * alpha);
  g.fillCircle(x, y, r * 2.75);
  g.fillStyle(color, 0.07 * alpha);
  g.fillCircle(x, y, r * 4);
}

// The same idea as drawGlow, for something that already has a body of its
// own (a meteor's mass, an explosion's core): one solid fill plus a single
// tight halo, rather than drawGlow's wide four-stop falloff -- that falloff
// is tuned for a small bright head, and at a radius of tens of pixels its
// outermost stop covers most of the field and washes the backdrop out.
export function drawBloom(g: Phaser.GameObjects.Graphics, color: number, x: number, y: number, r: number, alpha: number) {
  g.fillStyle(color, 0.26 * alpha);
  g.fillCircle(x, y, r * 1.5);
  g.fillStyle(color, alpha);
  g.fillCircle(x, y, r);
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
    g.fillCircle(x + Math.cos(ang) * r, y + Math.sin(ang) * r * flatten, 2.2 * scale);
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
  const g = scene.add.graphics().setDepth(59 + depthOffset).setBlendMode(Phaser.BlendModes.ADD);
  const sparks = 5;
  const seed = Math.random() * Math.PI * 2;
  scene.tweens.addCounter({
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
        g.fillCircle(at.x + Math.cos(ang) * r, at.y + Math.sin(ang) * r, 2.5 * scale);
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
// field. The apex always bows upward (a thrown thing rises before it
// arrives, and every player attack already runs bottom-left to top-right, so
// bowing the other way would fight the geometry). Bow height is a fraction
// of the span, clamped so a short pane-sized preview still curves and a
// full-field shot doesn't balloon; it takes only a fraction of a leveled
// cast's `scale`, since path geometry is not stroke weight and a 3.5x arc
// would leave the frame. `to` is resolved by the caller every frame, so the
// path re-aims as the target moves.
function arcPoint(origin: Direction, to: EffectAnchor, s: number, scale: number): Direction {
  const dx = to.x - origin.x;
  const dy = to.y - origin.y;
  const len = Math.hypot(dx, dy) || 1;
  // The perpendicular (-dy, dx) points down-field for a left-to-right shot
  // and up-field for a right-to-left one; flipping on the x sign makes the
  // apex go up either way.
  const sign = dx > 0 ? -1 : 1;
  const nx = (-dy / len) * sign;
  const ny = (dx / len) * sign;
  const bow = Phaser.Math.Clamp(0.14 * len, 12, 36) * Math.min(scale, 1.5) * 4 * s * (1 - s);
  return { x: origin.x + dx * s + nx * bow, y: origin.y + dy * s + ny * bow };
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
  const g = scene.add.graphics().setDepth(60 + depthOffset).setBlendMode(Phaser.BlendModes.ADD);
  const origin = latchAnchor(from);
  scene.tweens.addCounter({
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
        g.fillCircle(q.x, q.y, (5 - k * 0.4) * scale);
      }
      const head = arcPoint(origin, to, p, scale);
      drawGlow(g, color, head.x, head.y, 4 * scale, 1);
      g.fillStyle(0xffffff, 0.6);
      g.fillCircle(head.x, head.y, 1.8 * scale);
    },
    onComplete: () => {
      g.destroy();
      onImpact?.(arrivalDirection(origin, to, scale));
    },
  });
}

// Which way a travelling shape was moving as it landed -- the last short
// step of its own curve, normalized.
function arrivalDirection(origin: Direction, to: EffectAnchor, scale: number): Direction {
  const a = arcPoint(origin, to, 0.9, scale);
  const b = arcPoint(origin, to, 1, scale);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: dx / len, y: dy / len };
}

// An expanding wave leaving the caster, nudged a little toward whatever it
// was aimed at -- one soft-edged wavefront (drawAnnulus) with a fainter
// white echo chasing it, rather than a set of hard wire circles. Both
// anchors are read once, at launch (the aim), and never again -- the ring
// belongs entirely to the attacker's side of the field after that. Kondo's
// self-buff moves pass the caster's own anchor as both `from` and `to`
// (BattleScene.resolveSelfBuff), which collapses the nudge and centers the
// ring on the caster. `Cubic.easeOut` on the radius is what makes it read as
// a wave -- fast expansion decelerating as it spreads.
export function playRing(
  scene: Phaser.Scene,
  color: number,
  from: EffectAnchor,
  to: EffectAnchor,
  onImpact?: () => void,
  depthOffset = 0,
  scale = 1
) {
  const g = scene.add.graphics().setDepth(60 + depthOffset).setBlendMode(Phaser.BlendModes.ADD);
  const originX = Phaser.Math.Linear(from.x, to.x, 0.12);
  const originY = Phaser.Math.Linear(from.y, to.y, 0.12);
  scene.tweens.addCounter({
    from: 0,
    to: 1,
    duration: TRAVEL_MS.ring,
    ease: 'Cubic.easeOut',
    onUpdate: (tw) => {
      const t = tw.getValue() ?? 0;
      g.clear();
      const r = (12 + t * 58) * scale;
      drawAnnulus(g, color, originX, originY, r, 3 * scale, Math.pow(1 - t, 1.2));
      g.lineStyle(2 * scale, 0xffffff, (1 - t) * 0.35);
      g.strokeCircle(originX, originY, r * 0.78);
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
  const g = scene.add.graphics().setDepth(60 + depthOffset).setBlendMode(Phaser.BlendModes.ADD);
  const origin = latchAnchor(from);
  const seeds = Array.from({ length: BURST_PARTICLES }, () => ({
    phase: Math.random() * Math.PI * 2,
    radius: 0.7 + Math.random() * 0.6,
    size: 0.75 + Math.random() * 0.5,
  }));
  scene.tweens.addCounter({
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
        g.fillCircle(c.x + Math.cos(ang) * r, c.y + Math.sin(ang) * r, 3.5 * s.size * scale);
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
// purpose -- Laughlin's own request was "a beam falling from the sky,"
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
  scale = 1
) {
  const g = scene.add.graphics().setDepth(60 + depthOffset).setBlendMode(Phaser.BlendModes.ADD);
  const sun = scene.add.graphics().setDepth(59 + depthOffset).setBlendMode(Phaser.BlendModes.ADD);
  const originY = -40;
  scene.tweens.addCounter({
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
        g.fillCircle(sx, sy, (3.2 - i * 0.22) * scale);
      }
      // Once the head is down, a pool of light spreading across the ground
      // where the column meets it, with a few licks curling back up.
      if (fall >= 1) {
        const q = Math.min(1, (t - 1 / 1.3) / (1 - 1 / 1.3));
        const groundY = to.y + GROUND_DROP;
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
// Substantially flashier than the other move classes on purpose (Laughlin's
// own request): an expanding double shockwave ring on the ground, a bright
// geyser core punching straight up through the shards, and nearly double the
// shard count spread wider than an ordinary burst.
export function playEruption(
  scene: Phaser.Scene,
  color: number,
  to: EffectAnchor,
  onImpact?: (dir?: Direction) => void,
  depthOffset = 0,
  scale = 1
) {
  const g = scene.add.graphics().setDepth(60 + depthOffset).setBlendMode(Phaser.BlendModes.ADD);
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
  scene.tweens.addCounter({
    from: 0,
    to: 1,
    duration: TRAVEL_MS.eruption,
    ease: 'Cubic.easeOut',
    onUpdate: (tw) => {
      const t = tw.getValue() ?? 0;
      const groundY = to.y + GROUND_DROP;
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
// shape that landed knows one (a travelling bolt/burst hands over its own
// arrival heading, a beam comes down, an eruption comes up) -- debris then
// throws into the hemisphere *away* from it, the way a real strike splashes.
// Without one (a ring, a self-buff) the spray stays evenly radial.
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
  const g = scene.add.graphics().setDepth(61 + depthOffset).setBlendMode(Phaser.BlendModes.ADD);
  const base = dir ? Math.atan2(-dir.y, -dir.x) : 0;
  const spread = dir ? IMPACT_SPLASH_ARC : Math.PI;
  const shards = Array.from({ length: IMPACT_SHARDS }, (_, i) => ({
    angle: base + ((i / (IMPACT_SHARDS - 1)) - 0.5) * 2 * spread + (Math.random() - 0.5) * 0.5,
    length: 0.6 + Math.random() * 0.8,
  }));
  scene.tweens.addCounter({
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
