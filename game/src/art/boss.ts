import Phaser from 'phaser';
import { makeCrystal } from './crystals';
import { shade } from './colors';
import type { CrystalVariant } from '../data/types';

// A world's rival/boss crystal (OverworldScene.spawnBossSprite), rendered as
// a golem -- a humanoid silhouette (head, torso, two arms, two legs) built
// from `makeCrystal()` shards fused together, literalizing "polycrystalline"
// (each rival's own name, WORLD_RIVALS in data/materials.ts, now names a
// real compound's polycrystalline form) as many grains fused into one mass,
// plus a slow-pulsing additive aura and orbiting embers for "gigantic and
// dangerous." Distinct from the single shared makeCrystal() silhouette every
// ordinary wild/rival crystal uses elsewhere. Purely a visual landmark
// standing at the world's goal tile; it doesn't add its own click handler --
// the actual fight is still reached through the existing "Face the Rival"
// gate (OverworldScene.showRivalEncounter).
export function makeBossCrystal(
  scene: Phaser.Scene,
  size: number,
  color: number,
  variant: CrystalVariant
): Phaser.GameObjects.Container {
  const container = scene.add.container(0, 0);

  // Ambient danger aura, additive-blended so it actually glows rather than
  // reading as a flat colored disc -- sized for the golem's taller-than-wide
  // silhouette below.
  const aura = scene.add.graphics();
  aura.setBlendMode(Phaser.BlendModes.ADD);
  aura.fillStyle(color, 0.22);
  aura.fillCircle(0, 0, size * 1.4);
  aura.fillStyle(shade(color, 40), 0.16);
  aura.fillCircle(0, 0, size * 1.0);
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

  // Body shards, drawn before the torso so the torso's own bulk overlaps and
  // fuses their inner edges -- a head up top, two shoulder/arm shards bent
  // out to the sides with a smaller fist shard past each, and two wide leg
  // shards planted below, all shaded siblings of the same base color (via
  // `shade`). The silhouette this traces (narrow head, wide shoulders, a
  // planted stance) is what reads as "golem," not any single piece.
  // Each shard's own vertical half-extent (see art/crystals.ts's
  // drawShardShape et al.) is roughly its own `size`, so a limb's offset
  // `dy` plus its `scale` sets its actual top/bottom -- kept so the whole
  // golem's silhouette stays within about +/-1*size, matching every other
  // landmark's bounding box (OverworldScene.updateWorldSprites positions
  // this sprite's name label one `size` above center).
  const limbs: { dx: number; dy: number; scale: number; shadeStep: number; rot: number }[] = [
    { dx: 0, dy: -0.68, scale: 0.28, shadeStep: 3, rot: 0.05 }, // head
    { dx: -0.48, dy: -0.08, scale: 0.4, shadeStep: -1, rot: -0.2 }, // left shoulder/arm
    { dx: 0.48, dy: -0.08, scale: 0.4, shadeStep: 1, rot: 0.18 }, // right shoulder/arm
    { dx: -0.58, dy: 0.3, scale: 0.26, shadeStep: -2, rot: -0.28 }, // left fist
    { dx: 0.58, dy: 0.3, scale: 0.26, shadeStep: 2, rot: 0.25 }, // right fist
    { dx: -0.3, dy: 0.72, scale: 0.36, shadeStep: -1, rot: -0.1 }, // left leg
    { dx: 0.3, dy: 0.72, scale: 0.36, shadeStep: 1, rot: 0.1 }, // right leg
  ];
  limbs.forEach((s) => {
    const shard = makeCrystal(scene, size * s.scale, shade(color, s.shadeStep * 16), variant);
    shard.setPosition(size * s.dx, size * s.dy);
    shard.setRotation(s.rot);
    container.add(shard);
  });

  const torso = makeCrystal(scene, size * 0.95, color, variant);
  container.add(torso);

  // A ring of hot embers orbiting the whole golem -- the same "orbiting
  // motes" trick every guardian avatar uses (art/noether.ts), but warmer/redder
  // to read as hostile rather than benevolent, and traced tall rather than
  // wide to sweep past the head and legs alike.
  const orbit = scene.add.container(0, 0);
  const emberCount = 6;
  for (let i = 0; i < emberCount; i++) {
    const ang = (i * Math.PI * 2) / emberCount;
    const ember = scene.add.circle(Math.cos(ang) * size * 0.85, Math.sin(ang) * size * 1.05, size * 0.05, 0xffcf6a, 0.95);
    ember.setBlendMode(Phaser.BlendModes.ADD);
    orbit.add(ember);
  }
  container.add(orbit);
  scene.tweens.add({ targets: orbit, angle: 360, duration: 6000, repeat: -1, ease: 'Linear' });

  return container;
}
