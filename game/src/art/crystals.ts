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
export function drawShardShape(
  g: Phaser.GameObjects.Graphics,
  size: number,
  color: number,
  stretch: Stretch = NO_STRETCH
) {
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

// A blocky isometric cube -- top rhombus + two shaded side faces -- the
// "cubic" habit (pyrite, galena, fluorite). The blunt counterpart to
// `drawShardShape`'s angular point among art/boss.ts's golem grains, where a
// mass built only of points reads as spiky rather than heavy.
export function drawCubicShape(g: Phaser.GameObjects.Graphics, size: number, color: number, stretch: Stretch = NO_STRETCH) {
  const P = (x: number, y: number) => ({ x: x * stretch.x, y: y * stretch.y });
  const top = P(0, -size * 0.85);
  const left = P(-size * 0.55, -size * 0.45);
  const right = P(size * 0.55, -size * 0.45);
  const center = P(0, -size * 0.05);
  const bottomLeft = P(-size * 0.55, size * 0.25);
  const bottomRight = P(size * 0.55, size * 0.25);
  const bottom = P(0, size * 0.65);

  const topFace = [top, right, center, left];
  g.fillStyle(shade(color, 35), 1);
  g.fillPoints(topFace, true);
  g.lineStyle(2, shade(color, -45), 1);
  g.strokePoints(topFace, true);

  const leftFace = [left, center, bottom, bottomLeft];
  g.fillStyle(shade(color, -15), 1);
  g.fillPoints(leftFace, true);
  g.lineStyle(2, shade(color, -55), 1);
  g.strokePoints(leftFace, true);

  const rightFace = [center, right, bottomRight, bottom];
  g.fillStyle(shade(color, -35), 1);
  g.fillPoints(rightFace, true);
  g.lineStyle(2, shade(color, -55), 1);
  g.strokePoints(rightFace, true);
}

// One intergrown spire of the cluster habit below: a prismatic body rising
// out of the shared base into a pointed termination. `apex` is the tip;
// `shoulderL`/`shoulderR` are where the termination's two roof facets meet
// the body's two prism faces; `front` tops the vertical front edge that
// splits those prism faces; `baseL`/`baseF`/`baseR` are where the body meets
// the base. `lift` offsets every facet's shading together, so a spire
// standing behind another catches less of the light.
interface ClusterSpire {
  apex: [number, number];
  shoulderL: [number, number];
  shoulderR: [number, number];
  front: [number, number];
  baseL: [number, number];
  baseF: [number, number];
  baseR: [number, number];
  lift: number;
}

// Listed back to front: the two flanking spires lean away from a taller,
// upright central one that is drawn last and therefore stands in front of
// both. Their coordinates are shared with `CLUSTER_OUTLINE` below -- every
// apex and outward shoulder here is a vertex of that outline -- which is
// what keeps all three inside one silhouette.
const CLUSTER_SPIRES: ClusterSpire[] = [
  {
    apex: [-0.66, -0.34],
    shoulderL: [-0.74, 0.04],
    shoulderR: [-0.46, -0.1],
    front: [-0.6, 0.03],
    baseL: [-0.56, 0.74],
    baseF: [-0.5, 0.78],
    baseR: [-0.34, 0.72],
    lift: -6,
  },
  {
    apex: [0.62, -0.58],
    shoulderL: [0.4, -0.3],
    shoulderR: [0.72, -0.18],
    front: [0.57, -0.2],
    baseL: [0.32, 0.66],
    baseF: [0.52, 0.73],
    baseR: [0.64, 0.66],
    lift: -12,
  },
  {
    apex: [0.0, -0.95],
    shoulderL: [-0.3, -0.4],
    shoulderR: [0.32, -0.44],
    front: [0.02, -0.27],
    baseL: [-0.26, 0.7],
    baseF: [0.04, 0.79],
    baseR: [0.34, 0.68],
    lift: 0,
  },
];

// The whole habit's single outer silhouette, walked clockwise from the base's
// left corner: up the left spire, over its apex, down into the notch where it
// grows out of the central one, up to the central apex, down into the second
// notch, over the right spire, and back along the shared base.
const CLUSTER_OUTLINE: [number, number][] = [
  [-0.56, 0.74],
  [-0.74, 0.04],
  [-0.66, -0.34],
  [-0.46, -0.1],
  [-0.3, -0.4],
  [0.0, -0.95],
  [0.32, -0.44],
  [0.4, -0.3],
  [0.62, -0.58],
  [0.72, -0.18],
  [0.64, 0.66],
  [0.52, 0.73],
  [0.04, 0.79],
  [-0.5, 0.78],
];

// The cluster habit: three spires intergrown into one body on a shared base,
// the way a real specimen grows, so the richer "mineral" read the variant
// exists for costs it none of a single crystal's coherence. Every facet is
// lit from the upper left, matching every other shape in this file and the
// specular highlight `addHighlightAndSparkles` lays over them all.
//
// The whole silhouette is filled dark first and the spires are painted into
// it back to front, which is what makes this one body rather than three: the
// wedges the spires don't cover are the recesses where they intergrow, and
// the only outline stroked around the outside is the silhouette's own. Each
// spire's interior carries just its facet junctions -- the roof/body seam and
// the front edge -- so the faceting still reads at the 22px a wild encounter
// is drawn at.
function drawClusterShape(g: Phaser.GameObjects.Graphics, size: number, color: number, stretch: Stretch = NO_STRETCH) {
  const P = ([x, y]: [number, number]) => ({ x: x * size * stretch.x, y: y * size * stretch.y });
  const outline = CLUSTER_OUTLINE.map(P);

  g.fillStyle(shade(color, -50), 1);
  g.fillPoints(outline, true);

  CLUSTER_SPIRES.forEach((s) => {
    const apex = P(s.apex), shL = P(s.shoulderL), shR = P(s.shoulderR), front = P(s.front);
    const baseL = P(s.baseL), baseF = P(s.baseF), baseR = P(s.baseR);

    g.fillStyle(shade(color, 46 + s.lift), 1);
    g.fillTriangle(apex.x, apex.y, front.x, front.y, shL.x, shL.y);

    g.fillStyle(shade(color, 16 + s.lift), 1);
    g.fillTriangle(apex.x, apex.y, shR.x, shR.y, front.x, front.y);

    g.fillStyle(shade(color, s.lift - 6), 1);
    g.fillPoints([shL, front, baseF, baseL], true);

    g.fillStyle(shade(color, s.lift - 34), 1);
    g.fillPoints([front, shR, baseR, baseF], true);

    g.lineStyle(1.5, shade(color, -46), 1);
    g.strokePoints([shL, front, shR], false);
    g.strokePoints([apex, front, baseF], false);
  });

  g.lineStyle(2, shade(color, -58), 1);
  g.strokePoints(outline, true);
}

// A regular octahedron: two square pyramids meeting at a horizontal girdle,
// the {111} habit the tetrahedrally-bonded diamond family grows in (diamond
// itself, silicon, the zinc-blende semiconductors). Seen from just above the
// girdle, so both back-top facets and the two front-bottom ones are in view
// and the girdle itself crosses the body as a chevron -- without that
// crossing an octahedron collapses into the same tall diamond outline
// `drawShardShape` already owns.
function drawOctahedralShape(g: Phaser.GameObjects.Graphics, size: number, color: number, stretch: Stretch = NO_STRETCH) {
  const P = (x: number, y: number) => ({ x: x * size * stretch.x, y: y * size * stretch.y });
  const top = P(0, -1.0);
  const left = P(-0.74, -0.06);
  const right = P(0.74, -0.06);
  const front = P(0, 0.2);
  const back = P(0, -0.3);
  const bottom = P(0, 0.94);

  g.fillStyle(shade(color, 28), 1);
  g.fillTriangle(top.x, top.y, back.x, back.y, left.x, left.y);
  g.fillStyle(shade(color, 10), 1);
  g.fillTriangle(top.x, top.y, right.x, right.y, back.x, back.y);
  g.fillStyle(shade(color, 50), 1);
  g.fillTriangle(top.x, top.y, left.x, left.y, front.x, front.y);
  g.fillStyle(shade(color, 22), 1);
  g.fillTriangle(top.x, top.y, front.x, front.y, right.x, right.y);
  g.fillStyle(shade(color, -16), 1);
  g.fillTriangle(left.x, left.y, bottom.x, bottom.y, front.x, front.y);
  g.fillStyle(shade(color, -40), 1);
  g.fillTriangle(front.x, front.y, bottom.x, bottom.y, right.x, right.y);

  g.lineStyle(1.5, shade(color, -42), 1);
  g.strokePoints([left, back, right], false);
  g.strokePoints([top, front, bottom], false);
  g.lineStyle(2, shade(color, -52), 1);
  g.strokePoints([left, front, right], false);
  g.lineStyle(2, shade(color, -58), 1);
  g.strokePoints([top, right, bottom, left], true);
}

// A rhombohedron -- the leaning block every face of which is the same rhombus,
// the calcite habit, and the shape the R-3m/R3c trigonal compounds (Bi2Te3
// and its family, GeTe, BiFeO3) actually grow in. The lean is what tells it
// apart from `drawCubicShape` at a glance: a cube's side edges drop straight
// down, this one's all slide the same way, so no angle in the whole solid is
// a right angle.
function drawRhombohedralShape(g: Phaser.GameObjects.Graphics, size: number, color: number, stretch: Stretch = NO_STRETCH) {
  const P = (x: number, y: number) => ({ x: x * size * stretch.x, y: y * size * stretch.y });
  const tBack = P(0.1, -0.86);
  const tRight = P(0.78, -0.56);
  const tFront = P(0.3, -0.24);
  const tLeft = P(-0.38, -0.54);
  const bLeft = P(-0.6, 0.32);
  const bFront = P(0.08, 0.62);
  const bRight = P(0.56, 0.3);

  const topFace = [tBack, tRight, tFront, tLeft];
  g.fillStyle(shade(color, 38), 1);
  g.fillPoints(topFace, true);

  g.fillStyle(shade(color, -8), 1);
  g.fillPoints([tLeft, tFront, bFront, bLeft], true);

  g.fillStyle(shade(color, -34), 1);
  g.fillPoints([tFront, tRight, bRight, bFront], true);

  g.lineStyle(1.5, shade(color, -46), 1);
  g.strokePoints([tLeft, tFront, tRight], false);
  g.strokePoints([tFront, bFront], false);
  g.lineStyle(2, shade(color, -58), 1);
  g.strokePoints([tBack, tRight, bRight, bFront, bLeft, tLeft], true);
}

// A tetragonal bipyramid on a square prism -- the KDP habit, and the shape of
// the square-planed families: the ThCr2Si2 heavy fermions, the PbO-type iron
// chalcogenides, the tetragonal perovskite ferroelectrics, the layered
// cuprates. Its girdle is four-fold where `drawPrismShape`'s is six-fold, and
// it is capped by a pyramid where that one is cut flat.
function drawTetragonalShape(g: Phaser.GameObjects.Graphics, size: number, color: number, stretch: Stretch = NO_STRETCH) {
  const P = (x: number, y: number) => ({ x: x * size * stretch.x, y: y * size * stretch.y });
  const apex = P(0, -1.0);
  const gBack = P(0, -0.62);
  const gRight = P(0.56, -0.44);
  const gFront = P(0, -0.26);
  const gLeft = P(-0.56, -0.44);
  const bLeft = P(-0.56, 0.62);
  const bFront = P(0, 0.8);
  const bRight = P(0.56, 0.62);

  g.fillStyle(shade(color, 26), 1);
  g.fillTriangle(apex.x, apex.y, gBack.x, gBack.y, gLeft.x, gLeft.y);
  g.fillStyle(shade(color, 8), 1);
  g.fillTriangle(apex.x, apex.y, gRight.x, gRight.y, gBack.x, gBack.y);
  g.fillStyle(shade(color, 50), 1);
  g.fillTriangle(apex.x, apex.y, gLeft.x, gLeft.y, gFront.x, gFront.y);
  g.fillStyle(shade(color, 24), 1);
  g.fillTriangle(apex.x, apex.y, gFront.x, gFront.y, gRight.x, gRight.y);

  g.fillStyle(shade(color, -6), 1);
  g.fillPoints([gLeft, gFront, bFront, bLeft], true);
  g.fillStyle(shade(color, -32), 1);
  g.fillPoints([gFront, gRight, bRight, bFront], true);

  g.lineStyle(1.5, shade(color, -44), 1);
  g.strokePoints([gLeft, gBack, gRight], false);
  g.strokePoints([apex, gFront, bFront], false);
  g.lineStyle(2, shade(color, -52), 1);
  g.strokePoints([gLeft, gFront, gRight], false);
  g.lineStyle(2, shade(color, -58), 1);
  g.strokePoints([apex, gRight, bRight, bFront, bLeft, gLeft], true);
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

// The same thin floating plate `drawLayerShape` draws, cut to a different
// in-plane lattice: a triangle for the triangular-lattice monolayers
// (NiI2, ...), a square for the ones whose in-plane cell is four-sided (1T'
// WTe2, a zinc-blende (001) quantum well). Same grammar throughout -- detached
// ground shadow, a thin rim under a lit top face -- since what these share
// with the hexagonal sheet is being one monolayer, and all that differs is the
// shape of the cell.
function drawPlateShape(
  g: Phaser.GameObjects.Graphics,
  size: number,
  color: number,
  stretch: Stretch,
  corners: number,
  radiusScale: number
) {
  const s = size;
  const P = (x: number, y: number) => ({ x: x * stretch.x, y: y * stretch.y });
  g.fillStyle(0x000000, 0.18);
  g.fillEllipse(0, s * 0.55 * stretch.y, s * 1.1 * stretch.x, s * 0.22 * stretch.y);

  const plate = (radius: number, yOff: number) => {
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i < corners; i++) {
      const ang = Phaser.Math.DegToRad((360 / corners) * i - 90);
      pts.push(P(Math.cos(ang) * radius, yOff + Math.sin(ang) * radius * 0.34));
    }
    return pts;
  };

  const rim = plate(s * radiusScale, s * 0.08);
  g.fillStyle(shade(color, -30), 0.95);
  g.fillPoints(rim, true);
  g.lineStyle(2, shade(color, -55), 1);
  g.strokePoints(rim, true);

  const top = plate(s * radiusScale, 0);
  g.fillStyle(shade(color, 25), 0.85);
  g.fillPoints(top, true);
  g.lineStyle(2, shade(color, -35), 1);
  g.strokePoints(top, true);
}

// A compound's own per-instance look, derived once from a hash of its name
// (not re-rolled per render) -- a hue tint plus a rotation/stretch on the
// shape itself, so materials sharing one MaterialType's variant/base color
// (e.g. every 'classicalMagnet'-type cluster) still read as visually distinct
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

// Kills every tween targeting `obj` or any descendant of it, so a Container
// about to be destroyed (a panel rebuild, a battle-time crystal swap) leaves
// nothing ticking behind it. Needed because Phaser's own
// GameObject.destroy() does not touch tweens, and makeCrystal below hands
// out `repeat: -1` sparkle/glow tweens -- one per shard, plus the hybrid
// halo's -- that would otherwise keep animating a dead object forever, one
// more leaked set per rebuild. Every guardian panel's own
// `dialogueContainer?.destroy(true)` rebuild goes through this first
// (scenes/panels/), as does BattleScene's opponent-crystal swap. Typed
// against just the `tweens` manager so both a real Phaser.Scene and a
// GuardianPanelHost satisfy it.
export function killTweensDeep(scene: Pick<Phaser.Scene, 'tweens'>, obj: Phaser.GameObjects.GameObject) {
  scene.tweens.killTweensOf(obj);
  if (obj instanceof Phaser.GameObjects.Container) {
    obj.each((child: Phaser.GameObjects.GameObject) => killTweensDeep(scene, child));
  }
}

// One `CrystalVariant`'s own habit, drawn into `g` centered on (0,0) -- the
// single place a variant name is turned into a shape, so `makeCrystal`'s
// ordinary render and `drawVariantShape`'s hybrid halves can never disagree
// about what a variant looks like. `shard` is the fallback as well as a
// variant in its own right: it is the habit a compound gets when its
// structure has no characteristic one.
//
// Every habit below is a single body -- two separate pieces in one crystal
// mean a Majorana fusion and nothing else (`drawHybridCrystal`), so a
// compound never draws as more than one solid on its own.
function drawSolidShape(
  g: Phaser.GameObjects.Graphics,
  size: number,
  color: number,
  variant: CrystalVariant,
  stretch: Stretch = NO_STRETCH
) {
  if (variant === 'cluster') drawClusterShape(g, size, color, stretch);
  else if (variant === 'prism') drawPrismShape(g, size, color, stretch);
  else if (variant === 'cubic') drawCubicShape(g, size, color, stretch);
  else if (variant === 'octahedral') drawOctahedralShape(g, size, color, stretch);
  else if (variant === 'rhombohedral') drawRhombohedralShape(g, size, color, stretch);
  else if (variant === 'tetragonal') drawTetragonalShape(g, size, color, stretch);
  else if (variant === 'layer') drawLayerShape(g, size, color, stretch);
  else if (variant === 'layerTriangle') drawPlateShape(g, size, color, stretch, 3, 1.05);
  else if (variant === 'layerSquare') drawPlateShape(g, size, color, stretch, 4, 0.88);
  else drawShardShape(g, size, color, stretch);
}

// Builds a shiny crystal (a Container so it can be positioned/tweened as one
// unit) matching a material's `variant` -- one of `drawSolidShape`'s habits,
// plus a specular highlight and a few twinkling sparkles for the "shiny"
// look.
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

  const g = scene.add.graphics();
  drawSolidShape(g, size, drawColor, variant, stretch);
  g.setRotation(rot);
  container.add(g);

  if (!opts?.plain) {
    const stars = Array.from({ length: jitter?.sparkleCount ?? 3 }, () => ({ glyph: jitter?.sparkleGlyph ?? '✦' }));
    addHighlightAndSparkles(scene, container, size, stars);
  }

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
  // Draw the bare faceted shape with no specular highlight and no twinkling
  // sparkle glyphs -- for a crystal that is one component of a larger
  // composition (art/boss.ts's golem torso) rather than a whole material
  // presented on its own, where a dozen white stars would bury the
  // composition's own structure and read as decoration instead of mass.
  plain?: boolean;
}

function hexColor(n: number): string {
  return '#' + (n & 0xffffff).toString(16).padStart(6, '0');
}

function averageColor(a: number, b: number): number {
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
  return (Math.round((ar + br) / 2) << 16) | (Math.round((ag + bg) / 2) << 8) | Math.round((ab + bb) / 2);
}

// A parent's own habit at hybrid scale, unstretched -- the building block
// `drawHybridCrystal` fuses two of. 'cluster' collapses to a plain shard here
// (its own multi-spire silhouette would crowd a shape that's already sharing
// space with a second parent's own shape); every other variant contributes
// the same habit it renders as on its own.
function drawVariantShape(g: Phaser.GameObjects.Graphics, size: number, color: number, variant: CrystalVariant) {
  drawSolidShape(g, size, color, variant === 'cluster' ? 'shard' : variant);
}

// Majorana's hybridization mechanic (DESIGN.md §5): render a fused material
// as a visible mixture of both parents, not one flat blended color. Both
// parents' own silhouettes render off-center and additive-blended so the
// region where they overlap actually brightens into a shared "fusion" glow,
// split by a jagged glowing seam (the fusion boundary made literal) and
// finished with sparkles tinted in both parents' own colors rather than
// plain white. This is the one crystal in the game drawn from two separate
// pieces: every `CrystalVariant` habit is a single body, so two shapes in
// one crystal always mean a fusion. Reached via `makeCrystal`'s
// `opts.hybrid`, which every hybrid material carries (see `hybridParents` in
// data/types.ts).
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
