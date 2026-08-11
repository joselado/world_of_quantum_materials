import Phaser from 'phaser';
import { makeCrystal } from './crystals';
import { shade } from './colors';
import type { CrystalVariant } from '../data/types';

// A world's rival/boss crystal (OverworldScene.spawnBossSprite), rendered as
// a fused mass of several shards clustered around an oversized core plus a
// slow-pulsing additive aura and orbiting embers -- reads as "gigantic and
// dangerous" at a glance, distinct from the single shared makeCrystal()
// silhouette every ordinary wild/rival crystal uses elsewhere. Purely a
// visual landmark standing at the world's goal tile; it doesn't add its own
// click handler -- the actual fight is still reached through the existing
// "Face the Rival" gate (OverworldScene.showRivalEncounter).
export function makeBossCrystal(
  scene: Phaser.Scene,
  size: number,
  color: number,
  variant: CrystalVariant
): Phaser.GameObjects.Container {
  const container = scene.add.container(0, 0);

  // Ambient danger aura, additive-blended so it actually glows rather than
  // reading as a flat colored disc.
  const aura = scene.add.graphics();
  aura.setBlendMode(Phaser.BlendModes.ADD);
  aura.fillStyle(color, 0.22);
  aura.fillCircle(0, 0, size * 1.3);
  aura.fillStyle(shade(color, 40), 0.16);
  aura.fillCircle(0, 0, size * 0.9);
  container.add(aura);
  scene.tweens.add({
    targets: aura,
    scaleX: { from: 0.88, to: 1.18 },
    scaleY: { from: 0.88, to: 1.18 },
    alpha: { from: 0.55, to: 1 },
    duration: 1700,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });

  // Satellite shards fused around a larger core -- "composed of multiple
  // pieces" rather than one plain scaled-up shard, so the silhouette alone
  // reads as bigger/more complex than any ordinary wild crystal.
  const satellites: { dx: number; dy: number; scale: number; shadeStep: number; rot: number }[] = [
    { dx: -0.62, dy: 0.22, scale: 0.5, shadeStep: -1, rot: -0.3 },
    { dx: 0.62, dy: 0.26, scale: 0.46, shadeStep: 1, rot: 0.25 },
    { dx: -0.32, dy: -0.58, scale: 0.42, shadeStep: 2, rot: -0.15 },
    { dx: 0.36, dy: -0.52, scale: 0.4, shadeStep: -2, rot: 0.18 },
  ];
  satellites.forEach((s) => {
    const shard = makeCrystal(scene, size * s.scale, shade(color, s.shadeStep * 16), variant);
    shard.setPosition(size * s.dx, size * s.dy);
    shard.setRotation(s.rot);
    container.add(shard);
  });

  const core = makeCrystal(scene, size, color, variant);
  container.add(core);

  // A ring of hot embers orbiting the whole mass -- the same "orbiting
  // motes" trick every guardian avatar uses (art/mentor.ts), but warmer/redder
  // to read as hostile rather than benevolent, and orbiting the much larger
  // radius a boss-sized crystal needs.
  const orbit = scene.add.container(0, 0);
  const emberCount = 6;
  for (let i = 0; i < emberCount; i++) {
    const ang = (i * Math.PI * 2) / emberCount;
    const ember = scene.add.circle(Math.cos(ang) * size * 1.05, Math.sin(ang) * size * 0.62, size * 0.05, 0xffcf6a, 0.95);
    ember.setBlendMode(Phaser.BlendModes.ADD);
    orbit.add(ember);
  }
  container.add(orbit);
  scene.tweens.add({ targets: orbit, angle: 360, duration: 6000, repeat: -1, ease: 'Linear' });

  return container;
}
