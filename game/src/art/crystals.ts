import Phaser from 'phaser';
import { hashSeed, hueShift, seededRandom, shade } from './colors';
import type { CrystalVariant } from '../data/types';

// Unit-square stretch applied on top of `size` -- lets a shape read as
// elongated/thin or squat/wide per-compound (see `jitterFor` below) without
// touching every x/y literal below by hand.
interface Stretch {
  x: number;
  y: number;
}
const NO_STRETCH: Stretch = { x: 1, y: 1 };

// A single faceted gem, drawn centered on (0,0) in the Graphics object's own
// local space -- callers position/rotate it via the Graphics object's own
// transform rather than doing point-rotation math by hand.
function drawShardShape(g: Phaser.GameObjects.Graphics, size: number, color: number, stretch: Stretch = NO_STRETCH) {
  const P = (x: number, y: number) => ({ x: x * stretch.x, y: y * stretch.y });
  const top = P(0, -size);
  const upperLeft = P(-size * 0.55, -size * 0.25);
  const upperRight = P(size * 0.55, -size * 0.25);
  const bottom = P(0, size * 0.9);
  const lowerLeft = P(-size * 0.32, size * 0.55);
  const lowerRight = P(size * 0.32, size * 0.55);
  const core = P(0, -size * 0.05);

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
function drawPrismShape(g: Phaser.GameObjects.Graphics, size: number, color: number, stretch: Stretch = NO_STRETCH) {
  const s = size;
  const P = (x: number, y: number) => ({ x: x * stretch.x, y: y * stretch.y });
  const topPts: { x: number; y: number }[] = [];
  for (let i = 0; i < 6; i++) {
    const ang = Phaser.Math.DegToRad(60 * i - 90);
    topPts.push(P(Math.cos(ang) * s * 0.55, -s * 0.25 + Math.sin(ang) * s * 0.32));
  }
  g.fillStyle(shade(color, 35), 1);
  g.fillPoints(topPts, true);
  g.lineStyle(2, shade(color, -45), 1);
  g.strokePoints(topPts, true);

  const frontPts = [P(-s * 0.45, -s * 0.05), P(s * 0.05, -s * 0.05), P(s * 0.05, s * 0.75), P(-s * 0.45, s * 0.6)];
  g.fillStyle(shade(color, -5), 1);
  g.fillPoints(frontPts, true);
  g.lineStyle(2, shade(color, -50), 1);
  g.strokePoints(frontPts, true);

  const sidePts = [P(s * 0.05, -s * 0.05), P(s * 0.5, 0), P(s * 0.5, s * 0.7), P(s * 0.05, s * 0.75)];
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
function drawLayerShape(g: Phaser.GameObjects.Graphics, size: number, color: number, stretch: Stretch = NO_STRETCH) {
  const s = size;
  const P = (x: number, y: number) => ({ x: x * stretch.x, y: y * stretch.y });
  g.fillStyle(0x000000, 0.18);
  g.fillEllipse(0, s * 0.55 * stretch.y, s * 1.1 * stretch.x, s * 0.22 * stretch.y);

  const hexPts = (radius: number, yOff: number) => {
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i < 6; i++) {
      const ang = Phaser.Math.DegToRad(60 * i - 90);
      pts.push(P(Math.cos(ang) * radius, yOff + Math.sin(ang) * radius * 0.34));
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
function drawTwistedShape(g: Phaser.GameObjects.Graphics, size: number, color: number, stretch: Stretch = NO_STRETCH) {
  const s = size;
  const P = (x: number, y: number) => ({ x: x * stretch.x, y: y * stretch.y });
  g.fillStyle(0x000000, 0.18);
  g.fillEllipse(0, s * 0.6 * stretch.y, s * 1.15 * stretch.x, s * 0.22 * stretch.y);

  const hexPts = (radius: number, yOff: number, rotDeg: number) => {
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i < 6; i++) {
      const ang = Phaser.Math.DegToRad(60 * i - 90 + rotDeg);
      pts.push(P(Math.cos(ang) * radius, yOff + Math.sin(ang) * radius * 0.4));
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

// A compound's own per-instance look, derived once from a hash of its name
// (not re-rolled per render) -- a hue tint plus a rotation/stretch on the
// shape itself, so materials sharing one MaterialType's variant/base color
// (e.g. every 'magnet'-type cluster) still read as visually distinct
// individuals rather than the same silhouette in a different brightness.
// Applied to the inner Graphics object(s), never the outer Container, so it
// survives whatever a caller does to the returned container afterward
// (world-sprite depth scaling, boss.ts's own per-satellite rotation, ...).
interface CompoundJitter {
  color: number;
  rotationRad: number;
  stretch: Stretch;
  sparkleGlyph: string;
  sparkleCount: number;
}

const SPARKLE_GLYPHS = ['✦', '✧', '❋', '✶'];

function jitterFor(seed: string, baseColor: number): CompoundJitter {
  const rng = seededRandom(hashSeed(seed));
  return {
    color: hueShift(baseColor, (rng() - 0.5) * 70),
    rotationRad: Phaser.Math.DegToRad((rng() - 0.5) * 36),
    stretch: { x: 0.76 + rng() * 0.52, y: 0.76 + rng() * 0.52 },
    sparkleGlyph: SPARKLE_GLYPHS[Math.floor(rng() * SPARKLE_GLYPHS.length)],
    sparkleCount: rng() > 0.6 ? 4 : 3,
  };
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
  variant: CrystalVariant,
  opts?: CrystalOptions
): Phaser.GameObjects.Container {
  const container = scene.add.container(0, 0);

  if (opts?.hybrid) {
    drawHybridCrystal(scene, container, size, opts.hybrid);
    return container;
  }

  // Per-compound identity (see `jitterFor`) -- omitted entirely for
  // decorative, non-Material crystals (UI hotspot icons, boss.ts's own
  // satellite shards, background outcrops) so their hand-tuned look is
  // unaffected.
  const jitter = opts?.seed ? jitterFor(opts.seed, color) : null;
  const drawColor = jitter?.color ?? color;
  const stretch = jitter?.stretch ?? NO_STRETCH;
  const rot = jitter?.rotationRad ?? 0;

  if (variant === 'cluster') {
    const left = scene.add.graphics();
    drawShardShape(left, size * 0.55, drawColor, stretch);
    left.setPosition(-size * 0.4, size * 0.3);
    left.setRotation(Phaser.Math.DegToRad(-18) + rot);
    container.add(left);

    const right = scene.add.graphics();
    drawShardShape(right, size * 0.55, drawColor, stretch);
    right.setPosition(size * 0.4, size * 0.32);
    right.setRotation(Phaser.Math.DegToRad(16) - rot);
    container.add(right);

    const main = scene.add.graphics();
    drawShardShape(main, size * 0.8, drawColor, stretch);
    main.setRotation(rot * 0.5);
    container.add(main);
  } else if (variant === 'prism') {
    const g = scene.add.graphics();
    drawPrismShape(g, size, drawColor, stretch);
    g.setRotation(rot);
    container.add(g);
  } else if (variant === 'layer') {
    const g = scene.add.graphics();
    drawLayerShape(g, size, drawColor, stretch);
    g.setRotation(rot);
    container.add(g);
  } else if (variant === 'twisted') {
    const g = scene.add.graphics();
    drawTwistedShape(g, size, drawColor, stretch);
    g.setRotation(rot);
    container.add(g);
  } else {
    const g = scene.add.graphics();
    drawShardShape(g, size, drawColor, stretch);
    g.setRotation(rot);
    container.add(g);
  }

  const stars = Array.from({ length: jitter?.sparkleCount ?? 3 }, () => ({ glyph: jitter?.sparkleGlyph ?? '✦' }));
  addHighlightAndSparkles(scene, container, size, stars);

  return container;
}

// Specular highlight + twinkling sparkles shared by every variant, including
// the hybrid look below (which passes each star its own parent-tinted color
// instead of the plain-white default, for a "brilliant" bicolor glitter).
function addHighlightAndSparkles(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  size: number,
  stars: { glyph: string; color?: string }[]
) {
  const highlight = scene.add.ellipse(-size * 0.18, -size * 0.4, size * 0.32, size * 0.16, 0xffffff, 0.55);
  highlight.setRotation(-0.4);
  container.add(highlight);

  const offsets = [
    { x: size * 0.55, y: -size * 0.65 },
    { x: -size * 0.6, y: size * 0.1 },
    { x: size * 0.15, y: size * 0.8 },
    { x: -size * 0.2, y: -size * 0.75 },
    { x: size * 0.62, y: size * 0.25 },
  ];
  stars.forEach((star, i) => {
    const p = offsets[i % offsets.length];
    const t = scene.add
      .text(p.x, p.y, star.glyph, { fontSize: `${Math.round(size * 0.3)}px`, color: star.color ?? '#ffffff' })
      .setOrigin(0.5);
    container.add(t);
    scene.tweens.add({
      targets: t,
      alpha: { from: 0.15, to: 1 },
      duration: 650 + i * 200,
      yoyo: true,
      repeat: -1,
      delay: i * 220,
    });
  });
}

// A player-created hybrid material's parent looks (Majorana's mechanic,
// DESIGN.md §5) -- the colors/variants `combineMaterials` (data/materials.ts)
// carries forward from both ingredients so the fused crystal can render as an
// actual mixture instead of one flat blended color.
export interface HybridLook {
  colorA: number;
  variantA: CrystalVariant;
  colorB: number;
  variantB: CrystalVariant;
}

export interface CrystalOptions {
  // Deterministic per-compound identity, normally the material's own name --
  // drives `jitterFor`'s hue/rotation/stretch variation. Ignored when
  // `hybrid` is set.
  seed?: string;
  hybrid?: HybridLook;
}

function hexColor(n: number): string {
  return '#' + (n & 0xffffff).toString(16).padStart(6, '0');
}

function averageColor(a: number, b: number): number {
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
  return (Math.round((ar + br) / 2) << 16) | (Math.round((ag + bg) / 2) << 8) | Math.round((ab + bb) / 2);
}

// A variant's own shape, single-color, no shadow/rim flourish beyond what the
// shape function already does -- the building block `drawHybridCrystal` fuses
// two of. 'cluster' collapses to a plain shard here (its usual three-shard
// silhouette would crowd a shape that's already sharing space with a second
// parent's own shape).
function drawVariantShape(g: Phaser.GameObjects.Graphics, size: number, color: number, variant: CrystalVariant) {
  if (variant === 'prism') drawPrismShape(g, size, color);
  else if (variant === 'layer') drawLayerShape(g, size, color);
  else if (variant === 'twisted') drawTwistedShape(g, size, color);
  else drawShardShape(g, size, color);
}

// Majorana's hybridization mechanic (DESIGN.md §5): render a fused material
// as a visible mixture of both parents, not one flat blended color. Both
// parents' own silhouettes render off-center and additive-blended so the
// region where they overlap actually brightens into a shared "fusion" glow,
// split by a jagged glowing seam (the fusion boundary made literal) and
// finished with sparkles tinted in both parents' own colors rather than
// plain white. Only reached via `makeCrystal`'s `opts.hybrid` -- a hybrid
// `Material` with no `hybridParents` (e.g. a `playerForm` loaded from a save
// written before this field existed) simply omits `hybrid` and falls back to
// the ordinary single-shape render instead of calling this at all.
function drawHybridCrystal(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  size: number,
  hybrid: HybridLook
) {
  const { colorA, variantA, colorB, variantB } = hybrid;
  const mixColor = averageColor(colorA, colorB);

  const glow = scene.add.graphics();
  // Additive blending is reserved for the halo/seam below, which are meant
  // to read as light -- applying it to the two shapes themselves washed out
  // to solid white against anything but a black background (the overworld's
  // sky is never black), so the shapes stay normal-blended and keep their
  // own parent color instead.
  glow.setBlendMode(Phaser.BlendModes.ADD);
  glow.fillStyle(mixColor, 0.35);
  glow.fillCircle(0, 0, size * 1.05);
  container.add(glow);
  scene.tweens.add({
    targets: glow,
    alpha: { from: 0.5, to: 1 },
    duration: 1400,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });

  const left = scene.add.graphics();
  drawVariantShape(left, size * 0.86, colorA, variantA);
  left.setPosition(-size * 0.22, size * 0.05);
  left.setRotation(Phaser.Math.DegToRad(-13));
  container.add(left);

  // Drawn second, on top, at less than full opacity -- the overlap with
  // `left` genuinely blends both parent colors together (normal alpha
  // compositing, not an additive wash), which is what actually sells
  // "mixture" rather than just two shapes glued side by side.
  const right = scene.add.graphics();
  drawVariantShape(right, size * 0.86, colorB, variantB);
  right.setPosition(size * 0.22, size * 0.02);
  right.setRotation(Phaser.Math.DegToRad(13));
  right.setAlpha(0.8);
  container.add(right);

  // The fusion boundary itself, drawn as a jagged bright seam rather than a
  // structural crack -- white-gold and additive so it reads as energy, not
  // damage.
  const seam = scene.add.graphics();
  seam.setBlendMode(Phaser.BlendModes.ADD);
  seam.lineStyle(2.5, 0xfff3c9, 0.9);
  seam.beginPath();
  seam.moveTo(0, -size * 0.95);
  seam.lineTo(-size * 0.12, -size * 0.3);
  seam.lineTo(size * 0.1, size * 0.05);
  seam.lineTo(-size * 0.08, size * 0.45);
  seam.lineTo(0, size * 0.9);
  seam.strokePath();
  container.add(seam);

  addHighlightAndSparkles(scene, container, size, [
    { glyph: '✦', color: hexColor(colorA) },
    { glyph: '✧', color: hexColor(colorB) },
    { glyph: '✶', color: '#ffffff' },
    { glyph: '✦', color: hexColor(colorB) },
    { glyph: '✧', color: hexColor(colorA) },
  ]);
}
