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
// (art/crystals.ts), its facet edges catching light and a few sparkle
// points twinkling on their own timings -- with a dark bust above it that
// the crystallization is still climbing, small hexagonal bond fragments
// growing up from the waist and thinning out as they rise. In place of a
// face, a slowly rotating hexagonal carbon ring, six haloed bonded
// sites -- the one motif every carbon nanostructure she mapped is built
// from -- with a single bright mote riding the ring itself: the
// delocalized pi electron such a ring shares among all six bonds.
// Silhouette: a wide angular diamond under a narrow bust, unlike any robed
// taper.
export function makeDresselhausAvatar(scene: Phaser.Scene, scale = 1): Phaser.GameObjects.Container {
  const S = 30 * scale;
  const teal = 0x4ad9a0;
  const crystalColor = 0x1e8a66;
  const cloakColor = 0x123028;
  const hot = 0xeafff4;

  const outer = scene.add.container(0, 0);

  // Ambient radiance -- concentric additive fills whose alpha falls off
  // outward, fading into the backdrop instead of ending at a disc edge.
  const glow = scene.add.graphics();
  glow.setBlendMode(Phaser.BlendModes.ADD);
  for (let i = 0; i < 6; i++) {
    const t = i / 5;
    glow.fillStyle(teal, 0.018 + 0.02 * t);
    glow.fillCircle(0, -S * 0.15, S * (0.9 - 0.55 * t));
  }
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

  // The crystal she is becoming, from the waist down: a point-down faceted
  // shard, its four faces shaded off the same base color the way
  // drawShardShape shades a wild crystal's, with bright facet edges running
  // from the core so the faces read as catching light rather than flat.
  const tip = { x: 0, y: S * 0.92 };
  const left = { x: -S * 0.5, y: S * 0.28 };
  const right = { x: S * 0.5, y: S * 0.28 };
  const waistL = { x: -S * 0.28, y: -S * 0.05 };
  const waistR = { x: S * 0.28, y: -S * 0.05 };
  const core = { x: 0, y: S * 0.32 };
  const crystal = scene.add.graphics();
  crystal.fillStyle(shade(crystalColor, 55), 1);
  crystal.fillTriangle(waistL.x, waistL.y, left.x, left.y, core.x, core.y);
  crystal.fillStyle(shade(crystalColor, 20), 1);
  crystal.fillTriangle(waistL.x, waistL.y, core.x, core.y, waistR.x, waistR.y);
  crystal.fillStyle(shade(crystalColor, -12), 1);
  crystal.fillTriangle(core.x, core.y, left.x, left.y, tip.x, tip.y);
  crystal.fillStyle(shade(crystalColor, -35), 1);
  crystal.fillPoints([core, tip, right, waistR], true);
  crystal.lineStyle(1.5, shade(crystalColor, -55), 1);
  crystal.strokePoints([waistL, left, tip, right, waistR], true);
  sway.add(crystal);

  // The light inside the crystal: bright edges out of the core, and a hot
  // core point, drawn additively over the facet fills.
  const facets = scene.add.graphics();
  facets.setBlendMode(Phaser.BlendModes.ADD);
  facets.lineStyle(1.2, shade(crystalColor, 85), 0.55);
  [left, right, tip, waistL, waistR].forEach((p) => facets.lineBetween(core.x, core.y, p.x, p.y));
  facets.fillStyle(hot, 0.35);
  facets.fillCircle(core.x, core.y, S * 0.1);
  facets.fillStyle(hot, 0.9);
  facets.fillCircle(core.x, core.y, S * 0.045);
  sway.add(facets);

  // Sparkle points on the lit facets, each a small additive four-ray star
  // pulsing on its own timing -- the same twinkle the wild-crystal shards
  // carry, so she visibly shares their vocabulary.
  const sparkleSpecs = [
    { x: -S * 0.26, y: S * 0.18, r: S * 0.07, duration: 1400, delay: 0 },
    { x: S * 0.16, y: S * 0.52, r: S * 0.055, duration: 1750, delay: 500 },
    { x: -S * 0.06, y: S * 0.72, r: S * 0.05, duration: 1550, delay: 900 },
  ];
  sparkleSpecs.forEach((spec) => {
    const star = scene.add.graphics();
    star.setBlendMode(Phaser.BlendModes.ADD);
    star.lineStyle(1, hot, 0.9);
    star.lineBetween(spec.x - spec.r, spec.y, spec.x + spec.r, spec.y);
    star.lineBetween(spec.x, spec.y - spec.r, spec.x, spec.y + spec.r);
    star.fillStyle(hot, 1);
    star.fillCircle(spec.x, spec.y, Math.max(0.8, spec.r * 0.3));
    sway.add(star);
    scene.tweens.add({
      targets: star,
      alpha: { from: 0.15, to: 1 },
      duration: spec.duration,
      delay: spec.delay,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  });

  // The bust the crystallization is still climbing -- dark, narrow against
  // the crystal's width, edged in teal.
  const bustPts = [
    { x: -S * 0.28, y: -S * 0.05 },
    { x: S * 0.28, y: -S * 0.05 },
    { x: S * 0.2, y: -S * 0.42 },
    { x: -S * 0.2, y: -S * 0.42 },
  ];
  const bust = scene.add.graphics();
  bust.fillStyle(cloakColor, 1);
  bust.fillPoints(bustPts, true);
  bust.lineStyle(1.5, teal, 0.7);
  bust.strokePoints(bustPts, true);
  sway.add(bust);

  // The crystallization front: partial hexagonal bond rings growing up the
  // bust from the waist, dense and bright where they meet the crystal and
  // thinning out as they rise, shimmering gently as the front advances.
  const front = scene.add.graphics();
  front.setBlendMode(Phaser.BlendModes.ADD);
  const partialHex = (cx: number, cy: number, r: number, edges: number, alpha: number) => {
    front.lineStyle(1, teal, alpha);
    for (let i = 0; i < edges; i++) {
      const a0 = (i * Math.PI * 2) / 6 + Math.PI / 6;
      const a1 = ((i + 1) * Math.PI * 2) / 6 + Math.PI / 6;
      front.lineBetween(cx + Math.cos(a0) * r, cy + Math.sin(a0) * r, cx + Math.cos(a1) * r, cy + Math.sin(a1) * r);
    }
  };
  partialHex(-S * 0.16, -S * 0.1, S * 0.08, 6, 0.8);
  partialHex(S * 0.05, -S * 0.09, S * 0.08, 6, 0.8);
  partialHex(S * 0.19, -S * 0.14, S * 0.07, 4, 0.6);
  partialHex(-S * 0.05, -S * 0.22, S * 0.07, 4, 0.45);
  partialHex(S * 0.1, -S * 0.28, S * 0.06, 3, 0.3);
  partialHex(-S * 0.13, -S * 0.33, S * 0.06, 2, 0.2);
  sway.add(front);
  scene.tweens.add({ targets: front, alpha: { from: 0.7, to: 1 }, duration: 2250, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

  // The hexagonal carbon ring in place of a face: six bonded sites, the
  // unit every nanostructure she mapped -- graphite sheet, nanotube,
  // fullerene -- is assembled from, slowly rotating, each site haloed. No
  // head behind it -- the ring alone is the head.
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
  const halos = scene.add.graphics();
  halos.setBlendMode(Phaser.BlendModes.ADD);
  for (let i = 0; i < 6; i++) {
    const ang = (i * Math.PI * 2) / 6;
    const x = Math.cos(ang) * ringR;
    const y = Math.sin(ang) * ringR;
    halos.fillStyle(teal, 0.3);
    halos.fillCircle(x, y, S * 0.1);
    hex.fillStyle(teal, 0.95);
    hex.fillCircle(x, y, S * 0.055);
  }
  texture.add(halos);
  texture.add(hex);
  sway.add(texture);
  scene.tweens.add({ targets: texture, angle: 360, duration: 6400, repeat: -1, ease: 'Linear' });

  // The delocalized pi electron: one bright mote riding the ring itself
  // (radius exactly the ring's), circling against the ring's own slow turn
  // -- carbon's shared electron, belonging to every bond at once.
  const pi = scene.add.container(0, headY);
  const halo = scene.add.graphics();
  halo.setBlendMode(Phaser.BlendModes.ADD);
  halo.fillStyle(teal, 0.35);
  halo.fillCircle(ringR, 0, S * 0.09);
  pi.add(halo);
  const electron = scene.add.graphics();
  electron.fillStyle(hot, 1);
  electron.fillCircle(ringR, 0, S * 0.045);
  pi.add(electron);
  sway.add(pi);
  scene.tweens.add({ targets: pi, angle: -360, duration: 2600, repeat: -1, ease: 'Linear' });

  return outer;
}
