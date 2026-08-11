import Phaser from 'phaser';
import type { MoveClass } from '../data/types';
import { playAttackSfx, playImpactSfx, type AttackShape } from '../audio/sfx';
import { music } from '../audio/music';

interface Point {
  x: number;
  y: number;
}

// Each move class gets a distinct particle-effect silhouette (not just a
// color swap) so different quasiparticles read differently in battle:
// bolt = a fast, focused shot (Phonon Beam, Electron Pulse, Spinon Swap);
// ring = an expanding wave pulse (Magnon Pulse, Polaron Drag); burst = many
// small particles converging/scattering (Anyon Braid, Majorana Split).
// 'beam'/'eruption' are never picked from here -- they're only ever reached
// via ANALYTIC_SHAPES' per-move-id override below (BattleScene's resolveHit
// always supplies one for Curie's two moves), so no class needs its own
// `shape: 'beam' | 'eruption'` entry.
const EFFECT_STYLE: Record<MoveClass, { color: number; shape: AttackShape }> = {
  trivial: { color: 0x4a90d9, shape: 'bolt' },
  magnetic: { color: 0xd94a4a, shape: 'ring' },
  phonon: { color: 0xff8844, shape: 'bolt' },
  localization: { color: 0x8a6ad9, shape: 'ring' },
  gauge: { color: 0xd9a24a, shape: 'burst' },
  entanglement: { color: 0x5ad9c9, shape: 'bolt' },
  decoherence: { color: 0x333333, shape: 'burst' },
  // Electromagnon Pulse -- a magnon-family excitation, so it shares
  // Magnon Pulse's expanding-ring silhouette, tinted the multiferroic
  // type's own magenta rather than magnetic's red.
  magnetoelectric: { color: 0xc94ac0, shape: 'ring' },
  // Kondo's three moves (Screening Pulse, Scattering Drag, Decoherence
  // Cascade) share one look -- an expanding ring reads as a screening
  // cloud enveloping the target, tinted Kondo's own rust-orange
  // (WORLD_GUARDIANS[8].strokeColor). Three distinct move names and
  // status-effect log lines already read as three different moves without
  // three different silhouettes too, so unlike Curie's moves they need no
  // per-move-id shape override.
  screening: { color: 0xe86a44, shape: 'ring' },
};

// Per-move-id shape overrides for Curie's two moves -- the one pair where
// both moves (Skyfall Beam, Ground Eruption) want two distinct silhouettes
// (a falling beam, a ground eruption) rather than sharing whichever
// ordinary EFFECT_STYLE shape their currently-tuned quasiparticle carries.
export const ANALYTIC_SHAPES: Record<string, AttackShape> = {
  skyfallBeam: 'beam',
  groundEruption: 'eruption',
};

const WINDUP_MS = 90;
const TRAVEL_MS: Record<AttackShape, number> = { bolt: 340, ring: 460, burst: 400, beam: 520, eruption: 480 };
const IMPACT_MS = 260;

// Plays the full attack beat: a quick windup flash at the attacker, the
// travelling effect itself, and a shockwave burst on arrival -- alongside
// its sound (attack sfx on launch, an impact thud scaled by `powerRatio` on
// arrival) and a matching dip in the music so the hit reads clearly over the
// score. `onImpact` fires the moment the travelling effect lands (in time
// for BattleScene's HP-bar update/flashHit), not after the shockwave finishes
// decaying -- the shockwave itself is fire-and-forget. `shapeOverride` lets a
// caller pick a specific silhouette regardless of moveClass's usual one
// (BattleScene passes ANALYTIC_SHAPES[move.id] for Curie's two moves so
// Skyfall Beam and Ground Eruption read differently regardless of whichever
// quasiparticle each is currently tuned to).
export function playAttackEffect(
  scene: Phaser.Scene,
  moveClass: MoveClass,
  from: Point,
  to: Point,
  onImpact?: () => void,
  powerRatio = 1,
  shapeOverride?: AttackShape
) {
  const style = EFFECT_STYLE[moveClass];
  const shape = shapeOverride ?? style.shape;
  const totalMs = WINDUP_MS + TRAVEL_MS[shape] + IMPACT_MS;
  music.duck(totalMs);
  playAttackSfx(shape);

  playWindup(scene, style.color, from, () => {
    const land = () => {
      playImpactShockwave(scene, style.color, to);
      playImpactSfx(powerRatio);
      onImpact?.();
    };
    if (shape === 'ring') playRing(scene, style.color, from, to, land);
    else if (shape === 'burst') playBurst(scene, style.color, from, to, land);
    else if (shape === 'beam') playBeam(scene, style.color, to, land);
    else if (shape === 'eruption') playEruption(scene, style.color, to, land);
    else playBolt(scene, style.color, from, to, land);
  });
}

// A quick expanding/fading glow at the attacker's own position, right
// before the effect launches -- gives every attack a beat of anticipation
// instead of firing instantly.
function playWindup(scene: Phaser.Scene, color: number, at: Point, onDone: () => void) {
  const g = scene.add.graphics().setDepth(59).setBlendMode(Phaser.BlendModes.ADD);
  scene.tweens.addCounter({
    from: 0,
    to: 1,
    duration: WINDUP_MS,
    ease: 'Cubic.easeOut',
    onUpdate: (tw) => {
      const t = tw.getValue() ?? 0;
      g.clear();
      g.fillStyle(color, 0.5 * (1 - t));
      g.fillCircle(at.x, at.y, 4 + t * 22);
      g.lineStyle(2, 0xffffff, 0.85 * (1 - t));
      g.strokeCircle(at.x, at.y, 4 + t * 22);
    },
    onComplete: () => {
      g.destroy();
      onDone();
    },
  });
}

function playBolt(scene: Phaser.Scene, color: number, from: Point, to: Point, onImpact?: () => void) {
  const g = scene.add.graphics().setDepth(60).setBlendMode(Phaser.BlendModes.ADD);
  scene.tweens.addCounter({
    from: 0,
    to: 1,
    duration: TRAVEL_MS.bolt,
    ease: 'Cubic.easeIn',
    onUpdate: (tw) => {
      const t = tw.getValue() ?? 0;
      const x = Phaser.Math.Linear(from.x, to.x, t);
      const y = Phaser.Math.Linear(from.y, to.y, t);
      g.clear();
      g.lineStyle(8, color, 0.3);
      g.lineBetween(
        Phaser.Math.Linear(from.x, to.x, Math.max(0, t - 0.55)),
        Phaser.Math.Linear(from.y, to.y, Math.max(0, t - 0.55)),
        x,
        y
      );
      g.lineStyle(4, color, 0.9);
      g.lineBetween(
        Phaser.Math.Linear(from.x, to.x, Math.max(0, t - 0.3)),
        Phaser.Math.Linear(from.y, to.y, Math.max(0, t - 0.3)),
        x,
        y
      );
      g.fillStyle(color, 1);
      g.fillCircle(x, y, 8);
      g.fillStyle(0xffffff, 0.9);
      g.fillCircle(x, y, 3.5);
    },
    onComplete: () => {
      g.destroy();
      onImpact?.();
    },
  });
}

function playRing(scene: Phaser.Scene, color: number, from: Point, to: Point, onImpact?: () => void) {
  const g = scene.add.graphics().setDepth(60).setBlendMode(Phaser.BlendModes.ADD);
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
      g.lineStyle(4, color, 1 - t * 0.85);
      g.strokeCircle(originX, originY, 12 + t * 58);
      g.lineStyle(3, color, (1 - t) * 0.7);
      g.strokeCircle(originX, originY, 4 + t * 34);
      g.lineStyle(2, 0xffffff, (1 - t) * 0.5);
      g.strokeCircle(originX, originY, 20 + t * 46);
    },
    onComplete: () => {
      g.destroy();
      onImpact?.();
    },
  });
}

function playBurst(scene: Phaser.Scene, color: number, from: Point, to: Point, onImpact?: () => void) {
  const g = scene.add.graphics().setDepth(60).setBlendMode(Phaser.BlendModes.ADD);
  const n = 12;
  scene.tweens.addCounter({
    from: 0,
    to: 1,
    duration: TRAVEL_MS.burst,
    ease: 'Cubic.easeIn',
    onUpdate: (tw) => {
      const t = tw.getValue() ?? 0;
      g.clear();
      const cx = Phaser.Math.Linear(from.x, to.x, t);
      const cy = Phaser.Math.Linear(from.y, to.y, t);
      const spread = (1 - t) * 32 + t * 14;
      for (let i = 0; i < n; i++) {
        const ang = (i / n) * Math.PI * 2 + t * 3;
        g.fillStyle(color, 0.5 + t * 0.5);
        g.fillCircle(cx + Math.cos(ang) * spread, cy + Math.sin(ang) * spread, 3.5);
      }
    },
    onComplete: () => {
      g.destroy();
      onImpact?.();
    },
  });
}

// A thick column of light dropping straight down onto the target from off
// the top of the screen -- deliberately ignores `from` (the attacker's own
// position) since a beam falling out of the sky doesn't originate there.
// Telegraphs first (a faint, full-height column fades in before the bright
// head starts falling) so the "incoming" beat reads clearly, then the head
// travels the height of the field to land. Substantially flashier than the
// other move classes on purpose -- Curie's own request was "a beam falling
// from the sky," clearly reading as stronger than an ordinary hit: a pair of
// swirling side-rays orbit the main column, a radiant sun expands at the
// point of origin as the beam charges, and a trail of falling sparks chases
// the head down.
function playBeam(scene: Phaser.Scene, color: number, to: Point, onImpact?: () => void) {
  const g = scene.add.graphics().setDepth(60).setBlendMode(Phaser.BlendModes.ADD);
  const sun = scene.add.graphics().setDepth(59).setBlendMode(Phaser.BlendModes.ADD);
  const originY = -40;
  scene.tweens.addCounter({
    from: 0,
    to: 1,
    duration: TRAVEL_MS.beam,
    ease: 'Cubic.easeIn',
    onUpdate: (tw) => {
      const t = tw.getValue() ?? 0;
      const headY = Phaser.Math.Linear(originY, to.y, Math.min(1, t * 1.3));
      const pulse = 0.75 + 0.25 * Math.sin(t * 46);
      const swirl = Math.sin(t * 20) * 12;
      g.clear();
      // Wide, pulsing telegraph halo.
      g.fillStyle(color, 0.24 * t * pulse);
      g.fillRect(to.x - 34, originY, 68, to.y - originY);
      // Two side-rays swirling around the main column.
      g.fillStyle(color, 0.55 * t);
      g.fillRect(to.x - 24 + swirl, originY, 9, headY - originY);
      g.fillRect(to.x + 15 - swirl, originY, 9, headY - originY);
      // Main column, brighter/wider than the original.
      g.fillStyle(color, 0.97);
      g.fillRect(to.x - 15, originY, 30, headY - originY);
      // White-hot core.
      g.fillStyle(0xffffff, 1);
      g.fillRect(to.x - 5, originY, 10, headY - originY);
      // Falling sparks trailing the head.
      for (let i = 0; i < 7; i++) {
        const sy = headY - i * 16;
        if (sy < originY) continue;
        const sx = to.x + Math.sin(t * 34 + i * 1.7) * (14 - i);
        g.fillStyle(i % 2 === 0 ? 0xffffff : color, 0.85 - i * 0.11);
        g.fillCircle(sx, sy, 3.2 - i * 0.22);
      }
      // Radiant sun expanding at the point of origin as the beam charges.
      sun.clear();
      sun.fillStyle(0xffffff, 0.65 * (1 - t));
      sun.fillCircle(to.x, originY, 12 + t * 46);
      sun.lineStyle(2, color, 0.75 * (1 - t));
      sun.strokeCircle(to.x, originY, 18 + t * 58);
    },
    onComplete: () => {
      g.destroy();
      sun.destroy();
      onImpact?.();
    },
  });
}

// Shards bursting up and outward from a crack in the ground under the
// target -- also ignores `from`, since the eruption comes up from beneath
// the defender rather than travelling from the attacker. Substantially
// flashier than the other move classes on purpose (Curie's own request):
// an expanding double shockwave ring on the ground, a bright geyser core
// punching straight up through the shards, and nearly double the shard
// count spread wider than an ordinary burst.
function playEruption(scene: Phaser.Scene, color: number, to: Point, onImpact?: () => void) {
  const g = scene.add.graphics().setDepth(60).setBlendMode(Phaser.BlendModes.ADD);
  const n = 18;
  const groundY = to.y + 18;
  scene.tweens.addCounter({
    from: 0,
    to: 1,
    duration: TRAVEL_MS.eruption,
    ease: 'Cubic.easeOut',
    onUpdate: (tw) => {
      const t = tw.getValue() ?? 0;
      g.clear();
      // Expanding double shockwave ring on the ground.
      g.lineStyle(3, color, 0.85 * (1 - t));
      g.strokeCircle(to.x, groundY, 16 + t * 76);
      g.lineStyle(2, 0xffffff, 0.55 * (1 - t));
      g.strokeCircle(to.x, groundY, 10 + t * 54);
      // Brighter, wider crack glow.
      g.fillStyle(color, 0.65 * (1 - t));
      g.fillEllipse(to.x, groundY, 74 + t * 54, 22);
      // Bright geyser core punching straight up through the shards.
      const coreH = 96 * Math.min(1, t * 1.6);
      g.fillStyle(color, 0.55 * (1 - t * 0.5));
      g.fillRect(to.x - 11, groundY - coreH * 0.8, 22, coreH * 0.8);
      g.fillStyle(0xffffff, 0.9 * (1 - t * 0.5));
      g.fillRect(to.x - 4, groundY - coreH, 8, coreH);
      // Shards, nearly double the ordinary burst count and spread wider.
      for (let i = 0; i < n; i++) {
        const ang = -Math.PI / 2 + ((i / (n - 1)) - 0.5) * 2.3;
        const dist = t * 100;
        const px = to.x + Math.cos(ang) * dist * 0.6;
        const py = groundY + Math.sin(ang) * dist;
        g.fillStyle(i % 2 === 0 ? color : 0xffffff, 0.95 * (1 - t * 0.6));
        g.fillCircle(px, py, 5 - t * 1.6);
      }
    },
    onComplete: () => {
      g.destroy();
      onImpact?.();
    },
  });
}

// A bright flash plus radiating shards on arrival, common to every move
// class -- fire-and-forget (destroys itself once decayed, doesn't gate
// onImpact) so it layers on top of whatever BattleScene does with the hit
// (HP bar update, flashHit squash, camera shake) without delaying any of it.
function playImpactShockwave(scene: Phaser.Scene, color: number, at: Point) {
  const g = scene.add.graphics().setDepth(61).setBlendMode(Phaser.BlendModes.ADD);
  const shards = 8;
  scene.tweens.addCounter({
    from: 0,
    to: 1,
    duration: IMPACT_MS,
    ease: 'Cubic.easeOut',
    onUpdate: (tw) => {
      const t = tw.getValue() ?? 0;
      g.clear();
      g.fillStyle(0xffffff, 0.55 * (1 - t));
      g.fillCircle(at.x, at.y, 6 + t * 12);
      g.lineStyle(3, color, 0.8 * (1 - t));
      g.strokeCircle(at.x, at.y, 10 + t * 40);
      for (let i = 0; i < shards; i++) {
        const ang = (i / shards) * Math.PI * 2;
        const r0 = 8 + t * 6;
        const r1 = 8 + t * 32;
        g.lineStyle(2, color, 0.7 * (1 - t));
        g.lineBetween(at.x + Math.cos(ang) * r0, at.y + Math.sin(ang) * r0, at.x + Math.cos(ang) * r1, at.y + Math.sin(ang) * r1);
      }
    },
    onComplete: () => g.destroy(),
  });
}
