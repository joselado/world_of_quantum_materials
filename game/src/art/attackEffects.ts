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
const EFFECT_STYLE: Record<MoveClass, { color: number; shape: AttackShape }> = {
  trivial: { color: 0x4a90d9, shape: 'bolt' },
  magnetic: { color: 0xd94a4a, shape: 'ring' },
  thermal: { color: 0xff8844, shape: 'bolt' },
  localization: { color: 0x8a6ad9, shape: 'ring' },
  gauge: { color: 0xd9a24a, shape: 'burst' },
  entanglement: { color: 0x5ad9c9, shape: 'bolt' },
  decoherence: { color: 0x333333, shape: 'burst' },
};

const WINDUP_MS = 90;
const TRAVEL_MS: Record<AttackShape, number> = { bolt: 340, ring: 460, burst: 400 };
const IMPACT_MS = 260;

// Plays the full attack beat: a quick windup flash at the attacker, the
// travelling effect itself, and a shockwave burst on arrival -- alongside
// its sound (attack sfx on launch, an impact thud scaled by `powerRatio` on
// arrival) and a matching dip in the music so the hit reads clearly over the
// score. `onImpact` fires the moment the travelling effect lands (in time
// for BattleScene's HP-bar update/flashHit), not after the shockwave finishes
// decaying -- the shockwave itself is fire-and-forget.
export function playAttackEffect(
  scene: Phaser.Scene,
  moveClass: MoveClass,
  from: Point,
  to: Point,
  onImpact?: () => void,
  powerRatio = 1
) {
  const style = EFFECT_STYLE[moveClass];
  const totalMs = WINDUP_MS + TRAVEL_MS[style.shape] + IMPACT_MS;
  music.duck(totalMs);
  playAttackSfx(style.shape);

  playWindup(scene, style.color, from, () => {
    const land = () => {
      playImpactShockwave(scene, style.color, to);
      playImpactSfx(powerRatio);
      onImpact?.();
    };
    if (style.shape === 'ring') playRing(scene, style.color, from, to, land);
    else if (style.shape === 'burst') playBurst(scene, style.color, from, to, land);
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
