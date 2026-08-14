import Phaser from 'phaser';
import { shade } from './colors';

// Dresselhaus's avatar -- world 3's guardian: Mildred Dresselhaus, the
// experimentalist of nanostructured carbon. Her science is the guardian's
// own gift made literal: the same atoms, built into a different
// nanostructure, are a different material entirely (graphite, graphene, a
// nanotube, a fullerene -- all just carbon, rearranged), so understanding a
// defeated crystal's structure closely enough lets the player rebuild
// themselves into it. The avatar is a figure caught mid-transmutation: from
// the waist down she *is* a faceted crystal -- point-down, shaded facet by
// facet in the same vocabulary as the game's wild-crystal shards
// (art/crystals.ts) -- with a dark bust still emerging above it, and in
// place of a face, a slowly rotating hexagonal carbon ring, six bonded
// sites -- the one motif every carbon nanostructure she mapped is built
// from. Silhouette: a wide angular diamond under a narrow bust, unlike any
// robed taper. Orbit glyphs read '↻', the transmutation cycle.
export function makeDresselhausAvatar(scene: Phaser.Scene, scale = 1): Phaser.GameObjects.Container {
  const S = 30 * scale;
  const teal = 0x4ad9a0;
  const crystalColor = 0x1e8a66;
  const cloakColor = 0x123028;

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

  // The crystal he is becoming, from the waist down: a point-down faceted
  // shard, its four faces shaded off the same base color the way
  // drawShardShape shades a wild crystal's.
  const tip = { x: 0, y: S * 0.92 };
  const left = { x: -S * 0.5, y: S * 0.28 };
  const right = { x: S * 0.5, y: S * 0.28 };
  const waistL = { x: -S * 0.28, y: -S * 0.05 };
  const waistR = { x: S * 0.28, y: -S * 0.05 };
  const core = { x: 0, y: S * 0.32 };
  const crystal = scene.add.graphics();
  crystal.fillStyle(shade(crystalColor, 45), 1);
  crystal.fillTriangle(waistL.x, waistL.y, left.x, left.y, core.x, core.y);
  crystal.fillStyle(shade(crystalColor, 15), 1);
  crystal.fillTriangle(waistL.x, waistL.y, core.x, core.y, waistR.x, waistR.y);
  crystal.fillStyle(shade(crystalColor, -15), 1);
  crystal.fillTriangle(core.x, core.y, left.x, left.y, tip.x, tip.y);
  crystal.fillStyle(shade(crystalColor, -35), 1);
  crystal.fillPoints([core, tip, right, waistR], true);
  crystal.lineStyle(1.5, shade(crystalColor, -55), 1);
  crystal.strokePoints([waistL, left, tip, right, waistR], true);
  sway.add(crystal);

  // The bust still emerging above the waist -- the part of him not yet
  // transmuted -- narrow against the crystal's width.
  const bust = scene.add.graphics();
  bust.fillStyle(cloakColor, 1);
  bust.fillPoints(
    [
      { x: -S * 0.28, y: -S * 0.05 },
      { x: S * 0.28, y: -S * 0.05 },
      { x: S * 0.2, y: -S * 0.42 },
      { x: -S * 0.2, y: -S * 0.42 },
    ],
    true
  );
  bust.lineStyle(1.5, teal, 0.6);
  bust.strokePoints(
    [
      { x: -S * 0.28, y: -S * 0.05 },
      { x: S * 0.28, y: -S * 0.05 },
      { x: S * 0.2, y: -S * 0.42 },
      { x: -S * 0.2, y: -S * 0.42 },
    ],
    true
  );
  sway.add(bust);

  // The hexagonal carbon ring in place of a face: six bonded sites, the
  // unit every nanostructure she mapped -- graphite sheet, nanotube,
  // fullerene -- is assembled from, slowly rotating. No head behind it --
  // the ring alone is the head.
  const headY = -S * 0.68;
  const texture = scene.add.container(0, headY);
  const ringR = S * 0.26;
  const hex = scene.add.graphics();
  hex.lineStyle(1.6, teal, 0.95);
  hex.beginPath();
  for (let i = 0; i <= 6; i++) {
    const ang = (i * Math.PI * 2) / 6;
    const x = Math.cos(ang) * ringR;
    const y = Math.sin(ang) * ringR;
    if (i === 0) hex.moveTo(x, y);
    else hex.lineTo(x, y);
  }
  hex.strokePath();
  for (let i = 0; i < 6; i++) {
    const ang = (i * Math.PI * 2) / 6;
    hex.fillStyle(teal, 0.95);
    hex.fillCircle(Math.cos(ang) * ringR, Math.sin(ang) * ringR, S * 0.055);
  }
  texture.add(hex);
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
