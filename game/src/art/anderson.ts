import Phaser from 'phaser';
import { shade } from './colors';

// Anderson's avatar -- world 9's guardian (disorder and localization). Own
// file, same convention as every other guardian (glow -> sway -> cloak ->
// head-motif -> orbit ring). Head motif: a scattered, irregular lattice of
// dim sites with one bright point pulsing at the center in place of a face --
// Anderson localization's own picture, a wave trapped by disorder instead of
// spreading freely -- rust/amber rather than any other guardian's palette.
export function makeAndersonAvatar(scene: Phaser.Scene, scale = 1): Phaser.GameObjects.Container {
  const S = 30 * scale;
  const rust = 0xc9884a;
  const cloakColor = 0x3a2a18;
  const skin = 0xe6cba8;

  const outer = scene.add.container(0, 0);

  const glow = scene.add.graphics();
  glow.setBlendMode(Phaser.BlendModes.ADD);
  glow.fillStyle(rust, 0.16);
  glow.fillCircle(0, -S * 0.15, S * 0.85);
  outer.add(glow);
  scene.tweens.add({
    targets: glow,
    alpha: { from: 0.55, to: 1 },
    scaleX: { from: 0.9, to: 1.1 },
    scaleY: { from: 0.9, to: 1.1 },
    duration: 1600,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });

  const sway = scene.add.container(0, 0);
  outer.add(sway);
  scene.tweens.add({ targets: sway, angle: { from: -2.7, to: 2.7 }, duration: 2400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

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
  cloak.lineStyle(1.5, shade(rust, -20), 0.6);
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

  // A disordered lattice of dim, irregularly placed sites, with one bright
  // point localized at the center -- Anderson localization's own picture in
  // place of a face: a wave trapped by disorder rather than spreading freely.
  const lattice = scene.add.graphics();
  const sites = [
    { x: -0.22, y: -0.14 },
    { x: 0.05, y: -0.22 },
    { x: 0.24, y: -0.05 },
    { x: -0.18, y: 0.1 },
    { x: 0.2, y: 0.16 },
    { x: -0.02, y: 0.22 },
    { x: -0.28, y: 0.02 },
    { x: 0.12, y: 0.02 },
  ];
  sites.forEach((p) => {
    lattice.fillStyle(shade(rust, -10), 0.55);
    lattice.fillCircle(p.x * S, headY + p.y * S, S * 0.045);
  });
  lattice.fillStyle(0xffffff, 0.95);
  lattice.fillCircle(0, headY, S * 0.08);
  sway.add(lattice);
  // The central localized point pulses in place, unlike the orbiting glyphs
  // around it -- reads as "trapped," not "propagating."
  scene.tweens.add({
    targets: lattice,
    alpha: { from: 0.65, to: 1 },
    duration: 900,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });

  const orbit = scene.add.container(0, 0);
  for (let i = 0; i < 4; i++) {
    const ang = (i * Math.PI) / 2;
    const spark = scene.add
      .text(Math.cos(ang) * S * 0.95, Math.sin(ang) * S * 0.95 - S * 0.1, '×', {
        fontSize: `${Math.round(S * 0.34)}px`,
        color: '#c9884a',
      })
      .setOrigin(0.5);
    orbit.add(spark);
  }
  sway.add(orbit);
  scene.tweens.add({ targets: orbit, angle: 360, duration: 4600, repeat: -1, ease: 'Linear' });

  return outer;
}
