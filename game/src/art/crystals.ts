import Phaser from 'phaser';
import { shade } from './colors';
import type { CrystalVariant } from '../data/types';

// A single faceted gem, drawn centered on (0,0) in the Graphics object's own
// local space -- callers position/rotate it via the Graphics object's own
// transform rather than doing point-rotation math by hand.
function drawShardShape(g: Phaser.GameObjects.Graphics, size: number, color: number) {
  const top = { x: 0, y: -size };
  const upperLeft = { x: -size * 0.55, y: -size * 0.25 };
  const upperRight = { x: size * 0.55, y: -size * 0.25 };
  const bottom = { x: 0, y: size * 0.9 };
  const lowerLeft = { x: -size * 0.32, y: size * 0.55 };
  const lowerRight = { x: size * 0.32, y: size * 0.55 };
  const core = { x: 0, y: -size * 0.05 };

  g.fillStyle(shade(color, 45), 1);
  g.fillTriangle(top.x, top.y, upperLeft.x, upperLeft.y, core.x, core.y);

  g.fillStyle(shade(color, 15), 1);
  g.fillTriangle(top.x, top.y, core.x, core.y, upperRight.x, upperRight.y);

  g.fillStyle(shade(color, -15), 1);
  g.fillPoints([core, upperLeft, lowerLeft, bottom], true);

  g.fillStyle(shade(color, -35), 1);
  g.fillPoints([core, bottom, lowerRight, upperRight], true);

  g.lineStyle(2, shade(color, -55), 1);
  g.strokePoints([top, upperRight, lowerRight, bottom, lowerLeft, upperLeft], true);
}

// A layered hexagonal prism -- hex top face + two shaded side faces -- meant to
// read as "geometric, topological" rather than a single organic gem.
function drawPrismShape(g: Phaser.GameObjects.Graphics, size: number, color: number) {
  const s = size;
  const topPts: { x: number; y: number }[] = [];
  for (let i = 0; i < 6; i++) {
    const ang = Phaser.Math.DegToRad(60 * i - 90);
    topPts.push({ x: Math.cos(ang) * s * 0.55, y: -s * 0.25 + Math.sin(ang) * s * 0.32 });
  }
  g.fillStyle(shade(color, 35), 1);
  g.fillPoints(topPts, true);
  g.lineStyle(2, shade(color, -45), 1);
  g.strokePoints(topPts, true);

  const frontPts = [
    { x: -s * 0.45, y: -s * 0.05 },
    { x: s * 0.05, y: -s * 0.05 },
    { x: s * 0.05, y: s * 0.75 },
    { x: -s * 0.45, y: s * 0.6 },
  ];
  g.fillStyle(shade(color, -5), 1);
  g.fillPoints(frontPts, true);
  g.lineStyle(2, shade(color, -50), 1);
  g.strokePoints(frontPts, true);

  const sidePts = [
    { x: s * 0.05, y: -s * 0.05 },
    { x: s * 0.5, y: 0 },
    { x: s * 0.5, y: s * 0.7 },
    { x: s * 0.05, y: s * 0.75 },
  ];
  g.fillStyle(shade(color, -30), 1);
  g.fillPoints(sidePts, true);
  g.lineStyle(2, shade(color, -55), 1);
  g.strokePoints(sidePts, true);
}

// A thin, flattened hexagonal sheet -- a single atomic layer floating in
// place rather than a solid faceted gem -- for 2D-material compounds
// (monolayer graphene, monolayer WTe2, CrI3, ...). A soft detached shadow
// underneath is what sells "floating": a solid crystal's shading implies a
// gem resting on the ground, this implies a sheet hovering above it.
function drawLayerShape(g: Phaser.GameObjects.Graphics, size: number, color: number) {
  const s = size;
  g.fillStyle(0x000000, 0.18);
  g.fillEllipse(0, s * 0.55, s * 1.1, s * 0.22);

  const hexPts = (radius: number, yOff: number) => {
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i < 6; i++) {
      const ang = Phaser.Math.DegToRad(60 * i - 90);
      pts.push({ x: Math.cos(ang) * radius, y: yOff + Math.sin(ang) * radius * 0.34 });
    }
    return pts;
  };

  // A thin rim just below the top face -- enough thickness to read as a
  // sheet rather than a flat 2D sticker -- drawn first so the top face
  // overlaps it.
  const rim = hexPts(s * 0.8, s * 0.08);
  g.fillStyle(shade(color, -30), 0.95);
  g.fillPoints(rim, true);
  g.lineStyle(2, shade(color, -55), 1);
  g.strokePoints(rim, true);

  const top = hexPts(s * 0.8, 0);
  g.fillStyle(shade(color, 25), 0.85);
  g.fillPoints(top, true);
  g.lineStyle(2, shade(color, -35), 1);
  g.strokePoints(top, true);
}

// Two layer-shapes stacked with a rotational offset between them -- the
// moire mismatch between the two hex outlines is the whole point, for
// twisted-system compounds (twisted bilayer MoTe2, ...). Both faces render
// semi-transparent so the offset between them is actually visible rather
// than the top layer just occluding the bottom one.
function drawTwistedShape(g: Phaser.GameObjects.Graphics, size: number, color: number) {
  const s = size;
  g.fillStyle(0x000000, 0.18);
  g.fillEllipse(0, s * 0.6, s * 1.15, s * 0.22);

  const hexPts = (radius: number, yOff: number, rotDeg: number) => {
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i < 6; i++) {
      const ang = Phaser.Math.DegToRad(60 * i - 90 + rotDeg);
      pts.push({ x: Math.cos(ang) * radius, y: yOff + Math.sin(ang) * radius * 0.4 });
    }
    return pts;
  };

  const bottom = hexPts(s * 0.78, s * 0.14, -12);
  g.fillStyle(shade(color, -10), 0.55);
  g.fillPoints(bottom, true);
  g.lineStyle(2, shade(color, -45), 0.85);
  g.strokePoints(bottom, true);

  const top = hexPts(s * 0.78, -s * 0.1, 12);
  g.fillStyle(shade(color, 30), 0.6);
  g.fillPoints(top, true);
  g.lineStyle(2, shade(color, -25), 0.9);
  g.strokePoints(top, true);
}

// Builds a shiny crystal (a Container so it can be positioned/tweened as one
// unit) matching a material's `variant`: a single shard, a jagged cluster of
// three shards, a layered prism, a floating 2D sheet, or two twisted
// sheets -- plus a specular highlight and a few twinkling sparkles for the
// "shiny" look.
export function makeCrystal(
  scene: Phaser.Scene,
  size: number,
  color: number,
  variant: CrystalVariant
): Phaser.GameObjects.Container {
  const container = scene.add.container(0, 0);

  if (variant === 'cluster') {
    const left = scene.add.graphics();
    drawShardShape(left, size * 0.55, color);
    left.setPosition(-size * 0.4, size * 0.3);
    left.setRotation(Phaser.Math.DegToRad(-18));
    container.add(left);

    const right = scene.add.graphics();
    drawShardShape(right, size * 0.55, color);
    right.setPosition(size * 0.4, size * 0.32);
    right.setRotation(Phaser.Math.DegToRad(16));
    container.add(right);

    const main = scene.add.graphics();
    drawShardShape(main, size * 0.8, color);
    container.add(main);
  } else if (variant === 'prism') {
    const g = scene.add.graphics();
    drawPrismShape(g, size, color);
    container.add(g);
  } else if (variant === 'layer') {
    const g = scene.add.graphics();
    drawLayerShape(g, size, color);
    container.add(g);
  } else if (variant === 'twisted') {
    const g = scene.add.graphics();
    drawTwistedShape(g, size, color);
    container.add(g);
  } else {
    const g = scene.add.graphics();
    drawShardShape(g, size, color);
    container.add(g);
  }

  const highlight = scene.add.ellipse(-size * 0.18, -size * 0.4, size * 0.32, size * 0.16, 0xffffff, 0.55);
  highlight.setRotation(-0.4);
  container.add(highlight);

  const sparkleOffsets = [
    { x: size * 0.55, y: -size * 0.65 },
    { x: -size * 0.6, y: size * 0.1 },
    { x: size * 0.15, y: size * 0.8 },
  ];
  sparkleOffsets.forEach((p, i) => {
    const star = scene.add
      .text(p.x, p.y, '✦', { fontSize: `${Math.round(size * 0.3)}px`, color: '#ffffff' })
      .setOrigin(0.5);
    container.add(star);
    scene.tweens.add({
      targets: star,
      alpha: { from: 0.15, to: 1 },
      duration: 650 + i * 200,
      yoyo: true,
      repeat: -1,
      delay: i * 220,
    });
  });

  return container;
}
