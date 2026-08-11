import Phaser from 'phaser';
import { shade } from './colors';

// Dresselhaus's avatar -- world 3's guardian (topological band theory: the
// Dresselhaus effect -- bulk-inversion-asymmetry spin-orbit coupling -- is
// the real ingredient that locks spin to momentum in models like BHZ, the
// route an ordinary band structure actually takes into a topological one).
// Own file, same convention as every other guardian (glow -> sway -> cloak ->
// head-motif -> orbit ring). Head motif: a ring of small spin arrows, each
// locked tangent to its own position on the ring rather than all pointing
// the same way -- a spin-momentum-locked texture in place of a face, fitting
// the guardian whose gift lets the player lock onto (become) any crystal
// they've understood well enough to defeat.
export function makeDresselhausAvatar(scene: Phaser.Scene, scale = 1): Phaser.GameObjects.Container {
  const S = 30 * scale;
  const teal = 0x4ad9a0;
  const cloakColor = 0x123028;
  const skin = 0xe6d2b8;

  const outer = scene.add.container(0, 0);

  const glow = scene.add.graphics();
  glow.setBlendMode(Phaser.BlendModes.ADD);
  glow.fillStyle(teal, 0.15);
  glow.fillCircle(0, -S * 0.15, S * 0.85);
  outer.add(glow);
  scene.tweens.add({
    targets: glow,
    alpha: { from: 0.55, to: 1 },
    scaleX: { from: 0.9, to: 1.1 },
    scaleY: { from: 0.9, to: 1.1 },
    duration: 1950,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });

  const sway = scene.add.container(0, 0);
  outer.add(sway);
  scene.tweens.add({ targets: sway, angle: { from: -2.3, to: 2.3 }, duration: 2800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

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
  cloak.lineStyle(1.5, teal, 0.6);
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

  // A spin-momentum-locked texture: six small arrows on a ring around the
  // head, each rotated tangent to its own position (a hedgehog-like winding,
  // the actual shape a Dresselhaus/Rashba-split band's spin texture traces
  // in momentum space) rather than a face.
  const texture = scene.add.container(0, headY);
  const ringR = S * 0.26;
  for (let i = 0; i < 6; i++) {
    const ang = (i * Math.PI * 2) / 6;
    const arrow = scene.add.graphics();
    arrow.lineStyle(1.6, teal, 0.95);
    arrow.beginPath();
    arrow.moveTo(-S * 0.08, 0);
    arrow.lineTo(S * 0.08, 0);
    arrow.strokePath();
    arrow.fillStyle(teal, 0.95);
    arrow.fillTriangle(S * 0.09, 0, S * 0.03, -S * 0.045, S * 0.03, S * 0.045);
    arrow.setPosition(Math.cos(ang) * ringR, Math.sin(ang) * ringR);
    arrow.rotation = ang + Math.PI / 2;
    texture.add(arrow);
  }
  sway.add(texture);
  scene.tweens.add({ targets: texture, angle: 360, duration: 6400, repeat: -1, ease: 'Linear' });

  const orbit = scene.add.container(0, 0);
  for (let i = 0; i < 4; i++) {
    const ang = (i * Math.PI) / 2;
    const spark = scene.add
      .text(Math.cos(ang) * S * 0.95, Math.sin(ang) * S * 0.95 - S * 0.1, '↻', {
        fontSize: `${Math.round(S * 0.3)}px`,
        color: '#4ad9a0',
      })
      .setOrigin(0.5);
    orbit.add(spark);
  }
  sway.add(orbit);
  scene.tweens.add({ targets: orbit, angle: -360, duration: 5300, repeat: -1, ease: 'Linear' });

  return outer;
}
