import Phaser from 'phaser';
import { shade } from './colors';

// Noether's own avatar -- a small cartoon deity floating in a flowing
// golden robe with no visible feet, haloed, with wide welcoming sleeves and
// a ring of conserved-quantity motes orbiting her. Specific to Noether
// (unlike the generic faceted crystal look shared by every wild material)
// so a mentor reads as a distinct, benevolent presence rather than another
// encounter.
// Later mentors follow the same rule: their own builder in their own file
// (art/bloch.ts's makeBlochAvatar, art/bohr.ts's makeBohrAvatar, and any
// future ones per DESIGN.md §5) rather than reusing this one.
//
// Drawn in local space centered on the chest/torso (0,0); the returned
// container also wraps a slow rotation sway internally, so callers are free
// to layer their own position/bob tween on top (as OverworldScene already
// does for the panel-intro float) without the two tweens fighting.
export function makeNoetherAvatar(scene: Phaser.Scene, scale = 1): Phaser.GameObjects.Container {
  const S = 30 * scale;
  const gold = 0xffe066;
  const robeColor = 0xfff3d0;
  const skin = 0xffe9c2;

  const outer = scene.add.container(0, 0);

  // Soft ambient radiance behind everything -- the "presence" a plain robe
  // silhouette wouldn't read on its own.
  const glow = scene.add.graphics();
  glow.setBlendMode(Phaser.BlendModes.ADD);
  glow.fillStyle(gold, 0.14);
  glow.fillCircle(0, -S * 0.15, S * 0.85);
  outer.add(glow);
  scene.tweens.add({
    targets: glow,
    alpha: { from: 0.6, to: 1 },
    scaleX: { from: 0.92, to: 1.08 },
    scaleY: { from: 0.92, to: 1.08 },
    duration: 1800,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });

  // Everything below sways gently, like a figure adrift rather than a fixed
  // sprite -- a slow rotation, independent of any position/bob tween a
  // caller adds to `outer`.
  const sway = scene.add.container(0, 0);
  outer.add(sway);
  scene.tweens.add({ targets: sway, angle: { from: -2.5, to: 2.5 }, duration: 2600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

  const headY = -S * 0.55;

  // Wide flowing sleeves first (behind the robe body), a welcoming
  // wing-like silhouette rather than plain draped arms.
  const sleeves = scene.add.graphics();
  sleeves.fillStyle(shade(robeColor, -10), 0.95);
  sleeves.fillPoints(
    [
      { x: -S * 0.45, y: -S * 0.15 },
      { x: -S * 1.15, y: S * 0.15 },
      { x: -S * 0.8, y: S * 0.55 },
      { x: -S * 0.3, y: S * 0.35 },
    ],
    true
  );
  sleeves.fillPoints(
    [
      { x: S * 0.45, y: -S * 0.15 },
      { x: S * 1.15, y: S * 0.15 },
      { x: S * 0.8, y: S * 0.55 },
      { x: S * 0.3, y: S * 0.35 },
    ],
    true
  );
  sway.add(sleeves);

  // Robe: a tapered gown with no visible feet, ending in a soft point --
  // reads as floating rather than standing.
  const robe = scene.add.graphics();
  robe.fillStyle(shade(robeColor, 10), 1);
  robe.fillPoints(
    [
      { x: -S * 0.5, y: -S * 0.3 },
      { x: S * 0.5, y: -S * 0.3 },
      { x: S * 0.32, y: S * 0.55 },
      { x: 0, y: S * 0.85 },
      { x: -S * 0.32, y: S * 0.55 },
    ],
    true
  );
  robe.fillStyle(shade(robeColor, -20), 0.6);
  robe.fillTriangle(-S * 0.5, -S * 0.3, 0, S * 0.85, -S * 0.32, S * 0.55);
  robe.lineStyle(1.5, shade(gold, -20), 0.7);
  robe.strokePoints(
    [
      { x: -S * 0.5, y: -S * 0.3 },
      { x: S * 0.5, y: -S * 0.3 },
      { x: S * 0.32, y: S * 0.55 },
      { x: 0, y: S * 0.85 },
      { x: -S * 0.32, y: S * 0.55 },
    ],
    true
  );
  sway.add(robe);

  // Halo, then head, then a small bun and face on top.
  const halo = scene.add.graphics();
  halo.setBlendMode(Phaser.BlendModes.ADD);
  halo.lineStyle(2.5, gold, 0.9);
  halo.strokeCircle(0, headY, S * 0.62);
  halo.lineStyle(5, gold, 0.3);
  halo.strokeCircle(0, headY, S * 0.62);
  sway.add(halo);

  const head = scene.add.graphics();
  head.fillStyle(shade(skin, 10), 1);
  head.fillCircle(0, headY, S * 0.4);
  head.fillStyle(shade(skin, -30), 1);
  head.fillEllipse(-S * 0.34, headY - S * 0.05, S * 0.28, S * 0.5);
  sway.add(head);

  const bun = scene.add.graphics();
  bun.fillStyle(shade(gold, -10), 1);
  bun.fillCircle(0, headY - S * 0.52, S * 0.16);
  sway.add(bun);

  const face = scene.add.graphics();
  face.fillStyle(0x2a2018, 1);
  face.fillCircle(-S * 0.14, headY, S * 0.045);
  face.fillCircle(S * 0.14, headY, S * 0.045);
  face.lineStyle(1.5, 0x2a2018, 0.8);
  face.beginPath();
  face.arc(0, headY + S * 0.06, S * 0.16, Phaser.Math.DegToRad(20), Phaser.Math.DegToRad(160), false);
  face.strokePath();
  sway.add(face);

  // A ring of small motes orbiting the whole figure -- conserved quantities
  // circling their theorem's namesake.
  const orbit = scene.add.container(0, 0);
  for (let i = 0; i < 4; i++) {
    const ang = (i * Math.PI) / 2;
    const spark = scene.add
      .text(Math.cos(ang) * S * 0.95, Math.sin(ang) * S * 0.95 - S * 0.1, '✦', {
        fontSize: `${Math.round(S * 0.32)}px`,
        color: '#ffffff',
      })
      .setOrigin(0.5);
    orbit.add(spark);
  }
  sway.add(orbit);
  scene.tweens.add({ targets: orbit, angle: 360, duration: 5000, repeat: -1, ease: 'Linear' });

  return outer;
}
