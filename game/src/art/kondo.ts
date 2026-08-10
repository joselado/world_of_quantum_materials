import Phaser from 'phaser';
import { shade } from './colors';

// Kondo's avatar -- world 8's mentor (quantum magnetism/spinons/Kondo
// physics, a direct namesake match). Own file, same convention as every
// other mentor (glow -> sway -> cloak -> head-motif -> orbit ring). Head
// motif: a screening cloud swirling around a single central spin arrow --
// the Kondo effect itself -- deep red rather than any other mentor's
// palette.
export function makeKondoAvatar(scene: Phaser.Scene, scale = 1): Phaser.GameObjects.Container {
  const S = 30 * scale;
  const red = 0xff8f6a;
  const cloakColor = 0x3a1a14;
  const skin = 0xe6d2b8;

  const outer = scene.add.container(0, 0);

  const glow = scene.add.graphics();
  glow.setBlendMode(Phaser.BlendModes.ADD);
  glow.fillStyle(red, 0.15);
  glow.fillCircle(0, -S * 0.15, S * 0.85);
  outer.add(glow);
  scene.tweens.add({
    targets: glow,
    alpha: { from: 0.55, to: 1 },
    scaleX: { from: 0.9, to: 1.1 },
    scaleY: { from: 0.9, to: 1.1 },
    duration: 1800,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });

  const sway = scene.add.container(0, 0);
  outer.add(sway);
  scene.tweens.add({ targets: sway, angle: { from: -2.5, to: 2.5 }, duration: 2600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

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
  cloak.lineStyle(1.5, shade(red, -30), 0.6);
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

  // A central spin arrow, held fixed, with three small conduction-electron
  // motes swirling around it -- a local moment being screened, in place of
  // a face.
  const spin = scene.add.graphics();
  spin.lineStyle(2, red, 0.95);
  spin.beginPath();
  spin.moveTo(0, headY + S * 0.14);
  spin.lineTo(0, headY - S * 0.14);
  spin.strokePath();
  spin.fillStyle(red, 0.95);
  spin.fillTriangle(0, headY - S * 0.2, -S * 0.05, headY - S * 0.1, S * 0.05, headY - S * 0.1);
  sway.add(spin);

  const cloud = scene.add.container(0, headY);
  for (let i = 0; i < 3; i++) {
    const ang = (i * Math.PI * 2) / 3;
    const mote = scene.add.graphics();
    mote.fillStyle(shade(red, 20), 0.85);
    mote.fillCircle(Math.cos(ang) * S * 0.22, Math.sin(ang) * S * 0.22, S * 0.035);
    cloud.add(mote);
  }
  sway.add(cloud);
  scene.tweens.add({ targets: cloud, angle: 360, duration: 2600, repeat: -1, ease: 'Linear' });

  const orbit = scene.add.container(0, 0);
  for (let i = 0; i < 4; i++) {
    const ang = (i * Math.PI) / 2;
    const spark = scene.add
      .text(Math.cos(ang) * S * 0.95, Math.sin(ang) * S * 0.95 - S * 0.1, '⇄', {
        fontSize: `${Math.round(S * 0.3)}px`,
        color: '#ff8f6a',
      })
      .setOrigin(0.5);
    orbit.add(spark);
  }
  sway.add(orbit);
  scene.tweens.add({ targets: orbit, angle: -360, duration: 5000, repeat: -1, ease: 'Linear' });

  return outer;
}
