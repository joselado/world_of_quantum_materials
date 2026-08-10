import Phaser from 'phaser';
import { shade } from './colors';

// Bloch's own avatar -- a hooded traveler whose whole upper body is a
// Bloch sphere (a wireframe globe with a state vector arrow), since Bloch's
// gift is folding space between the worlds the player has already mapped.
// Own file/builder per the convention set by art/mentor.ts's
// makeNoetherAvatar -- not a shared parameterized mentor builder.
//
// Drawn in local space centered on the chest/torso (0,0), same convention
// as makeNoetherAvatar: an internal sway tween is baked in, so callers are
// free to layer their own position/bob tween on top.
export function makeBlochAvatar(scene: Phaser.Scene, scale = 1): Phaser.GameObjects.Container {
  const S = 30 * scale;
  const teal = 0x4adde0;
  const cloakColor = 0x1c3a44;

  const outer = scene.add.container(0, 0);

  const glow = scene.add.graphics();
  glow.setBlendMode(Phaser.BlendModes.ADD);
  glow.fillStyle(teal, 0.14);
  glow.fillCircle(0, -S * 0.1, S * 0.9);
  outer.add(glow);
  scene.tweens.add({
    targets: glow,
    alpha: { from: 0.6, to: 1 },
    scaleX: { from: 0.92, to: 1.08 },
    scaleY: { from: 0.92, to: 1.08 },
    duration: 1900,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });

  const sway = scene.add.container(0, 0);
  outer.add(sway);
  scene.tweens.add({ targets: sway, angle: { from: -2, to: 2 }, duration: 2800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

  // A tapered hooded cloak with no visible feet, same "floats, doesn't
  // stand" silhouette as Noether's robe.
  const cloak = scene.add.graphics();
  cloak.fillStyle(shade(cloakColor, 10), 1);
  cloak.fillPoints(
    [
      { x: -S * 0.48, y: -S * 0.1 },
      { x: S * 0.48, y: -S * 0.1 },
      { x: S * 0.3, y: S * 0.6 },
      { x: 0, y: S * 0.85 },
      { x: -S * 0.3, y: S * 0.6 },
    ],
    true
  );
  cloak.lineStyle(1.5, teal, 0.6);
  cloak.strokePoints(
    [
      { x: -S * 0.48, y: -S * 0.1 },
      { x: S * 0.48, y: -S * 0.1 },
      { x: S * 0.3, y: S * 0.6 },
      { x: 0, y: S * 0.85 },
      { x: -S * 0.3, y: S * 0.6 },
    ],
    true
  );
  sway.add(cloak);

  // The head is replaced entirely by a wireframe Bloch sphere: an equator,
  // a tilted meridian, and a state-vector arrow pointing off-axis (a
  // superposition, not a pure up/down state) -- Bloch's whole gift
  // (folding between worlds) is that state living in more than one place
  // at once.
  const sphereY = -S * 0.62;
  const R = S * 0.4;

  const sphereFill = scene.add.graphics();
  sphereFill.fillStyle(shade(cloakColor, 30), 0.5);
  sphereFill.fillCircle(0, sphereY, R);
  sway.add(sphereFill);

  const wire = scene.add.graphics();
  wire.setBlendMode(Phaser.BlendModes.ADD);
  wire.lineStyle(1.5, teal, 0.9);
  wire.strokeCircle(0, sphereY, R);
  wire.lineStyle(1.2, teal, 0.55);
  wire.strokeEllipse(0, sphereY, R * 2, R * 0.7);
  wire.strokeEllipse(0, sphereY, R * 1.1, R * 2);
  sway.add(wire);

  const axis = scene.add.graphics();
  axis.lineStyle(1, teal, 0.4);
  axis.lineBetween(0, sphereY - R * 1.15, 0, sphereY + R * 1.15);
  sway.add(axis);

  const vectorAngle = -Math.PI * 0.32;
  const arrow = scene.add.graphics();
  arrow.setBlendMode(Phaser.BlendModes.ADD);
  arrow.lineStyle(2, 0xffffff, 0.95);
  arrow.lineBetween(0, sphereY, Math.cos(vectorAngle) * R, sphereY + Math.sin(vectorAngle) * R);
  arrow.fillStyle(0xffffff, 1);
  arrow.fillCircle(Math.cos(vectorAngle) * R, sphereY + Math.sin(vectorAngle) * R, 3);
  sway.add(arrow);
  scene.tweens.add({ targets: wire, angle: 360, duration: 6000, repeat: -1, ease: 'Linear' });

  // A ring of small orbiting waypoint marks -- the worlds Bloch can fold
  // the player toward -- around the whole figure, echoing Noether's
  // conserved-quantity motes but reading as destinations, not sparkles.
  const orbit = scene.add.container(0, 0);
  for (let i = 0; i < 3; i++) {
    const ang = (i * Math.PI * 2) / 3;
    const mark = scene.add
      .text(Math.cos(ang) * S * 0.95, Math.sin(ang) * S * 0.95 - S * 0.1, '◇', {
        fontSize: `${Math.round(S * 0.3)}px`,
        color: '#8fe8ff',
      })
      .setOrigin(0.5);
    orbit.add(mark);
  }
  sway.add(orbit);
  scene.tweens.add({ targets: orbit, angle: -360, duration: 6500, repeat: -1, ease: 'Linear' });

  return outer;
}
