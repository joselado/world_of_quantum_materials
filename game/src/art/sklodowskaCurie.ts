import Phaser from 'phaser';
import { shade } from './colors';

// Skłodowska-Curie's avatar -- world 10's guardian, the finale's own
// capstone (the Ultimate Move mechanic, §5). A radiant source: the tallest,
// narrowest figure in the roster, a spire-like gown tapering to a point,
// crowned by a fan of straight rays -- radiation drawn the way her own
// science drew it, emission streaming off a source -- which is also the
// shape of the Nova/Meteor ultimates she teaches. At her chest, a small
// crystal shard inside a pulsing ring: a Curie-temperature transition made
// visual, order turning on and off. The finale-only outer halo ring and the
// eight-point starburst orbit (double the usual four) mark her as the
// guardians' capstone rather than a mid-game stop. Own file, same
// convention as every other guardian.
export function makeSklodowskaCurieAvatar(scene: Phaser.Scene, scale = 1): Phaser.GameObjects.Container {
  const S = 30 * scale;
  const yellowGreen = 0xd9e86a;
  const cloakColor = 0x33361a;
  const skin = 0xe6d2b8;

  const outer = scene.add.container(0, 0);

  const glow = scene.add.graphics();
  glow.setBlendMode(Phaser.BlendModes.ADD);
  glow.fillStyle(yellowGreen, 0.15);
  glow.fillCircle(0, -S * 0.15, S * 0.85);
  outer.add(glow);
  scene.tweens.add({
    targets: glow,
    alpha: { from: 0.5, to: 1 },
    scaleX: { from: 0.88, to: 1.12 },
    scaleY: { from: 0.88, to: 1.12 },
    duration: 1700,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });

  // A finale-only outer halo, wider and slower than the inner glow above --
  // a second layer of light marking her as the guardians' capstone rather
  // than a mid-game stop.
  const halo = scene.add.graphics();
  halo.setBlendMode(Phaser.BlendModes.ADD);
  halo.lineStyle(2, yellowGreen, 0.35);
  halo.strokeCircle(0, -S * 0.15, S * 1.15);
  outer.add(halo);
  scene.tweens.add({
    targets: halo,
    alpha: { from: 0.2, to: 0.6 },
    scaleX: { from: 0.95, to: 1.08 },
    scaleY: { from: 0.95, to: 1.08 },
    duration: 2600,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });

  const sway = scene.add.container(0, 0);
  outer.add(sway);
  scene.tweens.add({ targets: sway, angle: { from: -2.6, to: 2.6 }, duration: 2500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

  const headY = -S * 0.62;

  // The spire gown: narrow at the shoulders and tapering to a single point
  // well below every other guardian's hem -- a stature, not a robe.
  const gown = scene.add.graphics();
  gown.fillStyle(cloakColor, 1);
  gown.fillPoints(
    [
      { x: -S * 0.3, y: -S * 0.36 },
      { x: S * 0.3, y: -S * 0.36 },
      { x: S * 0.13, y: S * 0.4 },
      { x: 0, y: S * 0.95 },
      { x: -S * 0.13, y: S * 0.4 },
    ],
    true
  );
  gown.lineStyle(1.5, shade(yellowGreen, -30), 0.7);
  gown.strokePoints(
    [
      { x: -S * 0.3, y: -S * 0.36 },
      { x: S * 0.3, y: -S * 0.36 },
      { x: S * 0.13, y: S * 0.4 },
      { x: 0, y: S * 0.95 },
      { x: -S * 0.13, y: S * 0.4 },
    ],
    true
  );
  sway.add(gown);

  const head = scene.add.graphics();
  head.fillStyle(shade(skin, 4), 1);
  head.fillCircle(0, headY, S * 0.24);
  sway.add(head);

  // The ray crown: seven straight rays fanning up and out from behind the
  // head, each tipped with a mote -- emission streaming off a radiant
  // source, pulsing together.
  const rays = scene.add.container(0, headY);
  const rayG = scene.add.graphics();
  rayG.setBlendMode(Phaser.BlendModes.ADD);
  for (let i = 0; i < 7; i++) {
    const ang = Phaser.Math.DegToRad(-150 + i * 20);
    const r0 = S * 0.32;
    const r1 = S * (i % 2 === 0 ? 0.62 : 0.52);
    rayG.lineStyle(1.5, yellowGreen, 0.85);
    rayG.beginPath();
    rayG.moveTo(Math.cos(ang) * r0, Math.sin(ang) * r0);
    rayG.lineTo(Math.cos(ang) * r1, Math.sin(ang) * r1);
    rayG.strokePath();
    rayG.fillStyle(yellowGreen, 0.9);
    rayG.fillCircle(Math.cos(ang) * r1, Math.sin(ang) * r1, S * 0.035);
  }
  rays.add(rayG);
  sway.add(rays);
  scene.tweens.add({
    targets: rays,
    alpha: { from: 0.45, to: 1 },
    duration: 1300,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });

  // At her chest, a small crystal shard inside a pulsing glow ring -- a
  // Curie-temperature transition made literal: the ring brightens and dims
  // as if the shard's order is turning on and off.
  const chestY = -S * 0.02;
  const shard = scene.add.graphics();
  shard.fillStyle(shade(yellowGreen, -10), 0.95);
  shard.fillPoints(
    [
      { x: 0, y: chestY - S * 0.13 },
      { x: S * 0.07, y: chestY },
      { x: 0, y: chestY + S * 0.13 },
      { x: -S * 0.07, y: chestY },
    ],
    true
  );
  sway.add(shard);

  const ring = scene.add.graphics();
  ring.setBlendMode(Phaser.BlendModes.ADD);
  ring.lineStyle(1.8, yellowGreen, 0.8);
  ring.strokeCircle(0, chestY, S * 0.2);
  sway.add(ring);
  scene.tweens.add({
    targets: ring,
    alpha: { from: 0.25, to: 0.9 },
    duration: 1300,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });

  // Eight-point starburst orbit (double the usual four) -- a denser halo of
  // sparks befitting the guardians' own capstone.
  const orbit = scene.add.container(0, 0);
  for (let i = 0; i < 8; i++) {
    const ang = (i * Math.PI) / 4;
    const spark = scene.add
      .text(Math.cos(ang) * S * 0.95, Math.sin(ang) * S * 0.95 - S * 0.1, '✦', {
        fontSize: `${Math.round(S * 0.2)}px`,
        color: '#d9e86a',
      })
      .setOrigin(0.5);
    orbit.add(spark);
  }
  sway.add(orbit);
  scene.tweens.add({ targets: orbit, angle: 360, duration: 5400, repeat: -1, ease: 'Linear' });

  return outer;
}
