import Phaser from 'phaser';
import { shade } from './colors';

// Bohr's own avatar -- a robed figure crowned by a small Bohr-model atom
// (a nucleus with electrons on tilted elliptical shells) instead of a head,
// fitting his own historical role: defending quantum mechanics' completeness
// against the EPR paradox, world 7's own topic (entanglement). Own file/
// builder per the convention set by art/mentor.ts's makeNoetherAvatar.
//
// Drawn in local space centered on the chest/torso (0,0), same convention
// as makeNoetherAvatar/makeBlochAvatar: an internal sway tween is baked in,
// so callers are free to layer their own position/bob tween on top.
export function makeBohrAvatar(scene: Phaser.Scene, scale = 1): Phaser.GameObjects.Container {
  const S = 30 * scale;
  const amber = 0xffa64a;
  const robeColor = 0x3a2a20;

  const outer = scene.add.container(0, 0);

  const glow = scene.add.graphics();
  glow.setBlendMode(Phaser.BlendModes.ADD);
  glow.fillStyle(amber, 0.14);
  glow.fillCircle(0, -S * 0.2, S * 0.9);
  outer.add(glow);
  scene.tweens.add({
    targets: glow,
    alpha: { from: 0.6, to: 1 },
    scaleX: { from: 0.92, to: 1.1 },
    scaleY: { from: 0.92, to: 1.1 },
    duration: 1700,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });

  const sway = scene.add.container(0, 0);
  outer.add(sway);
  scene.tweens.add({ targets: sway, angle: { from: -2.5, to: 2.5 }, duration: 2500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

  // A tapered robe with no visible feet, same "floats" silhouette as the
  // other guardians.
  const robe = scene.add.graphics();
  robe.fillStyle(shade(robeColor, 12), 1);
  robe.fillPoints(
    [
      { x: -S * 0.46, y: -S * 0.05 },
      { x: S * 0.46, y: -S * 0.05 },
      { x: S * 0.3, y: S * 0.6 },
      { x: 0, y: S * 0.85 },
      { x: -S * 0.3, y: S * 0.6 },
    ],
    true
  );
  robe.lineStyle(1.5, amber, 0.5);
  robe.strokePoints(
    [
      { x: -S * 0.46, y: -S * 0.05 },
      { x: S * 0.46, y: -S * 0.05 },
      { x: S * 0.3, y: S * 0.6 },
      { x: 0, y: S * 0.85 },
      { x: -S * 0.3, y: S * 0.6 },
    ],
    true
  );
  sway.add(robe);

  // Bohr-model atom in place of a head: a bright nucleus with three tilted
  // elliptical shells, each carrying one orbiting electron at its own
  // speed -- reads as "an atom," not a face, at this size.
  const atomY = -S * 0.62;

  const nucleus = scene.add.graphics();
  nucleus.setBlendMode(Phaser.BlendModes.ADD);
  nucleus.fillStyle(0xfff2d0, 1);
  nucleus.fillCircle(0, atomY, S * 0.12);
  nucleus.fillStyle(amber, 0.4);
  nucleus.fillCircle(0, atomY, S * 0.22);
  sway.add(nucleus);

  const shellSpecs = [
    { rx: S * 0.42, ry: S * 0.16, tilt: 0.15, speed: 4200 },
    { rx: S * 0.42, ry: S * 0.16, tilt: -Math.PI / 3, speed: 5200 },
    { rx: S * 0.42, ry: S * 0.16, tilt: Math.PI / 3, speed: 6200 },
  ];

  shellSpecs.forEach((shell, i) => {
    const shellGfx = scene.add.graphics();
    shellGfx.setPosition(0, atomY);
    shellGfx.rotation = shell.tilt;
    shellGfx.lineStyle(1.2, amber, 0.55);
    shellGfx.strokeEllipse(0, 0, shell.rx * 2, shell.ry * 2);
    sway.add(shellGfx);

    const electron = scene.add.container(0, atomY);
    electron.rotation = shell.tilt;
    const dot = scene.add.circle(shell.rx, 0, 2.4, 0xffffff, 1);
    electron.add(dot);
    sway.add(electron);
    scene.tweens.add({
      targets: electron,
      rotation: shell.tilt + (i % 2 === 0 ? Math.PI * 2 : -Math.PI * 2),
      duration: shell.speed,
      repeat: -1,
      ease: 'Linear',
    });
  });

  return outer;
}
