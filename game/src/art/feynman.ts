import Phaser from 'phaser';
import { shade } from './colors';

// Feynman's avatar -- world 9's mentor (excitations and defects, drawn as
// Feynman diagrams for those excitations). Own file, same convention as
// every other mentor (glow -> sway -> cloak -> head-motif -> orbit ring).
// Head motif: interlocking diagram squiggles (a photon propagator crossing
// two straight fermion lines) in place of a face, bright orange rather than
// any other mentor's palette.
export function makeFeynmanAvatar(scene: Phaser.Scene, scale = 1): Phaser.GameObjects.Container {
  const S = 30 * scale;
  const orange = 0xffb24a;
  const cloakColor = 0x3a2410;
  const skin = 0xe6cba8;

  const outer = scene.add.container(0, 0);

  const glow = scene.add.graphics();
  glow.setBlendMode(Phaser.BlendModes.ADD);
  glow.fillStyle(orange, 0.16);
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
  cloak.lineStyle(1.5, shade(orange, -20), 0.6);
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

  // A tiny Feynman diagram in place of a face: two straight fermion lines
  // crossed by a wavy photon propagator.
  const diagram = scene.add.graphics();
  diagram.lineStyle(1.4, orange, 0.9);
  diagram.beginPath();
  diagram.moveTo(-S * 0.24, headY - S * 0.18);
  diagram.lineTo(S * 0.24, headY + S * 0.18);
  diagram.strokePath();
  diagram.beginPath();
  diagram.moveTo(-S * 0.24, headY + S * 0.18);
  diagram.lineTo(S * 0.24, headY - S * 0.18);
  diagram.strokePath();

  diagram.lineStyle(1.2, 0xffffff, 0.85);
  diagram.beginPath();
  const steps = 8;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = -S * 0.2 + t * S * 0.4;
    const y = headY + Math.sin(t * Math.PI * 3) * S * 0.05;
    if (i === 0) diagram.moveTo(x, y);
    else diagram.lineTo(x, y);
  }
  diagram.strokePath();
  sway.add(diagram);

  const orbit = scene.add.container(0, 0);
  for (let i = 0; i < 4; i++) {
    const ang = (i * Math.PI) / 2;
    const spark = scene.add
      .text(Math.cos(ang) * S * 0.95, Math.sin(ang) * S * 0.95 - S * 0.1, '~', {
        fontSize: `${Math.round(S * 0.34)}px`,
        color: '#ffb24a',
      })
      .setOrigin(0.5);
    orbit.add(spark);
  }
  sway.add(orbit);
  scene.tweens.add({ targets: orbit, angle: 360, duration: 4600, repeat: -1, ease: 'Linear' });

  return outer;
}
