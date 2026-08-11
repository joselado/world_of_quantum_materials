import Phaser from 'phaser';
import { shade } from './colors';

// Skłodowska-Curie's avatar -- world 10's guardian, the finale's own
// capstone (the Ultimate Move mechanic, §5). Carries the Curie identity's
// own warm yellow-green palette and crystal-shard-with-a-pulsing-ring head
// motif (a Curie-temperature transition made visual), but with an added
// outer halo ring and a denser four-point starburst orbit befitting a
// finale guardian rather than a mid-game one. Own file, same convention as
// every other guardian (glow -> sway -> cloak -> head-motif -> orbit ring).
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

  const headY = -S * 0.55;

  const cloak = scene.add.graphics();
  cloak.fillStyle(cloakColor, 1);
  cloak.fillPoints(
    [
      { x: -S * 0.44, y: -S * 0.28 },
      { x: S * 0.44, y: -S * 0.28 },
      { x: S * 0.28, y: S * 0.58 },
      { x: 0, y: S * 0.85 },
      { x: -S * 0.28, y: S * 0.58 },
    ],
    true
  );
  cloak.lineStyle(1.5, shade(yellowGreen, -30), 0.6);
  cloak.strokePoints(
    [
      { x: -S * 0.44, y: -S * 0.28 },
      { x: S * 0.44, y: -S * 0.28 },
      { x: S * 0.28, y: S * 0.58 },
      { x: 0, y: S * 0.85 },
      { x: -S * 0.28, y: S * 0.58 },
    ],
    true
  );
  sway.add(cloak);

  const head = scene.add.graphics();
  head.fillStyle(shade(skin, 4), 1);
  head.fillCircle(0, headY, S * 0.38);
  sway.add(head);

  // A small crystal shard with a pulsing glow ring around it, standing in
  // for a face -- a Curie-temperature transition made literal: the ring
  // brightens and dims as if the shard's order is turning on and off.
  const shard = scene.add.graphics();
  shard.fillStyle(shade(yellowGreen, -10), 0.95);
  shard.fillPoints(
    [
      { x: 0, y: headY - S * 0.16 },
      { x: S * 0.08, y: headY },
      { x: 0, y: headY + S * 0.16 },
      { x: -S * 0.08, y: headY },
    ],
    true
  );
  sway.add(shard);

  const ring = scene.add.graphics();
  ring.setBlendMode(Phaser.BlendModes.ADD);
  ring.lineStyle(2, yellowGreen, 0.8);
  ring.strokeCircle(0, headY, S * 0.24);
  sway.add(ring);
  scene.tweens.add({
    targets: ring,
    alpha: { from: 0.25, to: 0.9 },
    scaleX: { from: 0.85, to: 1.25 },
    scaleY: { from: 0.85, to: 1.25 },
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
