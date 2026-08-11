import Phaser from 'phaser';
import { shade } from './colors';

// Franklin's avatar -- world 9's guardian (X-ray diffraction of pore/defect
// structure in disordered carbon, the real tie between Rosalind Franklin and
// "excitations and defects": porous/amorphous carbon scatters an X-ray beam
// into a diffuse ring pattern rather than the sharp spots a perfect crystal
// gives). Own file, same convention as every other guardian (glow -> sway ->
// cloak -> head-motif -> orbit ring -- see art/noether.ts). Head motif: a
// disordered lattice of scattered sites (echoing Anderson's own defect
// motif, but read through diffraction rather than localization) surrounded
// by concentric diffraction rings standing in for a face -- a dusty
// amethyst/lavender palette, distinct from Anderson's rust/amber despite the
// shared defect/disorder theme.
export function makeFranklinAvatar(scene: Phaser.Scene, scale = 1): Phaser.GameObjects.Container {
  const S = 30 * scale;
  const lavender = 0xa878c9;
  const cloakColor = 0x2a2040;
  const skin = 0xe0d0c8;

  const outer = scene.add.container(0, 0);

  const glow = scene.add.graphics();
  glow.setBlendMode(Phaser.BlendModes.ADD);
  glow.fillStyle(lavender, 0.16);
  glow.fillCircle(0, -S * 0.15, S * 0.85);
  outer.add(glow);
  scene.tweens.add({
    targets: glow,
    alpha: { from: 0.55, to: 1 },
    scaleX: { from: 0.9, to: 1.1 },
    scaleY: { from: 0.9, to: 1.1 },
    duration: 1650,
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
  cloak.lineStyle(1.5, shade(lavender, -20), 0.6);
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

  // A disordered lattice of dim, irregularly placed sites -- the defect
  // structure being characterized -- standing in for a face, same
  // "scattered sites" idea as Anderson's own head motif but read through
  // diffraction rather than localization below.
  const lattice = scene.add.graphics();
  const sites = [
    { x: -0.22, y: -0.14 },
    { x: 0.05, y: -0.2 },
    { x: 0.22, y: -0.06 },
    { x: -0.16, y: 0.1 },
    { x: 0.18, y: 0.16 },
    { x: -0.02, y: 0.2 },
  ];
  sites.forEach((p) => {
    lattice.fillStyle(shade(lavender, -10), 0.5);
    lattice.fillCircle(p.x * S, headY + p.y * S, S * 0.04);
  });
  sway.add(lattice);

  // Concentric diffraction rings -- the diffuse Debye-Scherrer-style halo a
  // disordered/amorphous material scatters an X-ray beam into, in place of
  // the sharp spots a perfect single crystal would give. Each ring pulses on
  // its own offset timing so the whole motif reads as an actively forming
  // diffraction pattern rather than a static bullseye.
  [0.16, 0.26, 0.36].forEach((r, i) => {
    const ring = scene.add.graphics();
    ring.setBlendMode(Phaser.BlendModes.ADD);
    ring.lineStyle(1.5, lavender, 0.75 - i * 0.15);
    ring.strokeCircle(0, headY, S * r);
    sway.add(ring);
    scene.tweens.add({
      targets: ring,
      alpha: { from: 0.2, to: 0.9 },
      scaleX: { from: 0.9, to: 1.15 },
      scaleY: { from: 0.9, to: 1.15 },
      duration: 1100 + i * 260,
      delay: i * 180,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  });

  const orbit = scene.add.container(0, 0);
  for (let i = 0; i < 4; i++) {
    const ang = (i * Math.PI) / 2;
    const spark = scene.add
      .text(Math.cos(ang) * S * 0.95, Math.sin(ang) * S * 0.95 - S * 0.1, '◌', {
        fontSize: `${Math.round(S * 0.34)}px`,
        color: '#a878c9',
      })
      .setOrigin(0.5);
    orbit.add(spark);
  }
  sway.add(orbit);
  scene.tweens.add({ targets: orbit, angle: 360, duration: 5000, repeat: -1, ease: 'Linear' });

  return outer;
}
