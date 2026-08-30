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

// The spire habit's geometry: a prismatic body rising into a pointed
// termination. `apex` is the tip; `shoulderL`/`shoulderR` are where the
// termination's two roof facets meet the body's two prism faces; `front` tops
// the vertical front edge that splits those prism faces; `baseL`/`baseF`/
// `baseR` are where the body meets the ground.
interface SpireGeometry {
  apex: [number, number];
  shoulderL: [number, number];
  shoulderR: [number, number];
  front: [number, number];
  baseL: [number, number];
  baseF: [number, number];
  baseR: [number, number];
}

// Listed back to front: the two flanking spires lean away from a taller,
// upright central one that is drawn last and therefore stands in front of
// both. Their coordinates are shared with `CLUSTER_OUTLINE` below -- every
// apex and outward shoulder here is a vertex of that outline -- which is
// what keeps all three inside one silhouette.
// As wide as it is tall, near enough: a habit far taller than it is broad
// reads as a splinter rather than as a crystal, and every other habit in this
// file sits near a 1.3:1 box.
const SPIRE: SpireGeometry = {
  apex: [0.0, -0.68],
  shoulderL: [-0.46, -0.18],
  shoulderR: [0.48, -0.22],
  front: [0.02, -0.06],
  baseL: [-0.42, 0.6],
  baseF: [0.04, 0.68],
  baseR: [0.48, 0.58],
};

// The habit's own silhouette, walked clockwise from the base's left corner:
// up the left prism face, over the termination to the apex, down the right
// roof facet, and back along the base.
const SPIRE_OUTLINE: [number, number][] = [
  [-0.42, 0.6],
  [-0.46, -0.18],
  [0.0, -0.68],
  [0.48, -0.22],
  [0.48, 0.58],
  [0.04, 0.68],
];

// The spire habit: a single terminated crystal, tall and pointed, distinct
// from `prism`'s flat-topped column by having a termination at all. Every
// facet is lit from the upper left, matching every other shape in this file
// and the specular highlight `addHighlightAndSparkles` lays over them all.
//
// One body, like every other habit here: extra pieces in a crystal are
// reserved words -- two co-equal bodies mean a Majorana fusion, a small
// guest at the base means a dopant -- so a habit made of several spires
// spends a word the visual language has already given to something more
// important.
function drawSpireShape(g: Phaser.GameObjects.Graphics, size: number, color: number, stretch: Stretch = NO_STRETCH) {
  const P = ([x, y]: [number, number]) => ({ x: x * size * stretch.x, y: y * size * stretch.y });
  const outline = SPIRE_OUTLINE.map(P);

  g.fillStyle(shade(color, -50), 1);
  g.fillPoints(outline, true);

  const apex = P(SPIRE.apex), shL = P(SPIRE.shoulderL), shR = P(SPIRE.shoulderR), front = P(SPIRE.front);
  const baseL = P(SPIRE.baseL), baseF = P(SPIRE.baseF), baseR = P(SPIRE.baseR);

  g.fillStyle(shade(color, 46), 1);
  g.fillTriangle(apex.x, apex.y, front.x, front.y, shL.x, shL.y);

  g.fillStyle(shade(color, 16), 1);
  g.fillTriangle(apex.x, apex.y, shR.x, shR.y, front.x, front.y);

  g.fillStyle(shade(color, -6), 1);
  g.fillPoints([shL, front, baseF, baseL], true);

  g.fillStyle(shade(color, -34), 1);
  g.fillPoints([front, shR, baseR, baseF], true);

  g.lineStyle(1.5, shade(color, -46), 1);
  g.strokePoints([shL, front, shR], false);
  g.strokePoints([apex, front, baseF], false);

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
  // The top face is laid out first because every other point on the habit
  // hangs off one of its vertices. A hexagonal column is a single solid, so
  // its visible sides are the column's own faces dropping from the cap's
  // three front corners -- not a separate box for the cap to sit on. Sides
  // derived any other way leave the cap overhanging the body at the join,
  // and a crystal that reads as several pieces makes a composite-state claim
  // in this game (a fusion's co-equal bodies, a dopant's small guest), which
  // an ordinary compound must never make about itself.
  const topPts: { x: number; y: number }[] = [];
  for (let i = 0; i < 6; i++) {
    const ang = Phaser.Math.DegToRad(60 * i - 90);
    topPts.push(P(Math.cos(ang) * s * 0.55, -s * 0.25 + Math.sin(ang) * s * 0.32));
  }
  const [upper, upperRight, right, front, left, upperLeft] = topPts;
  const depth = s * 0.68;
  const drop = (pt: { x: number; y: number }) => ({ x: pt.x, y: pt.y + depth });
  const bRight = drop(right);
  const bFront = drop(front);
  const bLeft = drop(left);

  g.fillStyle(shade(color, 35), 1);
  g.fillPoints(topPts, true);
  g.fillStyle(shade(color, -5), 1);
  g.fillPoints([left, front, bFront, bLeft], true);
  g.fillStyle(shade(color, -30), 1);
  g.fillPoints([front, right, bRight, bFront], true);

  // Facet edges first, thin and only a little darker than the faces they
  // divide, then one heavy stroke around the whole habit -- stroking each
  // face as its own closed polygon would outline the cap separately from the
  // body and undo the point above.
  g.lineStyle(1, shade(color, -30), 0.9);
  g.strokePoints([left, front, right], false);
  g.strokePoints([front, bFront], false);

  g.lineStyle(2, shade(color, -50), 1);
  g.strokePoints([upperLeft, upper, upperRight, right, bRight, bFront, bLeft, left], true);
}

// A thin, flattened hexagonal sheet -- a single atomic layer floating in
// place rather than a solid faceted gem -- for 2D-material compounds
// (monolayer graphene, monolayer WTe2, CrI3, ...). A soft detached shadow
// underneath is what sells "floating": a solid crystal's shading implies a
// gem resting on the ground, this implies a sheet hovering above it.
function drawLayerShape(
  g: Phaser.GameObjects.Graphics,
  size: number,
  color: number,
  stretch: Stretch = NO_STRETCH,
  groundShadow = true
) {
  const s = size;
  const P = (x: number, y: number) => ({ x: x * stretch.x, y: y * stretch.y });
  if (groundShadow) {
    g.fillStyle(0x000000, 0.18);
    g.fillEllipse(0, s * 0.55 * stretch.y, s * 1.1 * stretch.x, s * 0.22 * stretch.y);
  }

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
  radiusScale: number,
  groundShadow = true
) {
  const s = size;
  const P = (x: number, y: number) => ({ x: x * stretch.x, y: y * stretch.y });
  if (groundShadow) {
    g.fillStyle(0x000000, 0.18);
    g.fillEllipse(0, s * 0.55 * stretch.y, s * 1.1 * stretch.x, s * 0.22 * stretch.y);
  }

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
// (e.g. every 'insulatingMagnet'-type cube) still read as visually distinct
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

// The same deep walk, pausing rather than killing. `setVisible(false)` hides
// a sprite but does nothing to the tweens animating it, so a culled crystal's
// sparkles keep being evaluated every frame for something nobody can see --
// and a Macro map at high density carries a couple of hundred of those at
// once. `pause()` holds elapsed time rather than resetting it, so a sparkle
// resumes on its own phase instead of jumping when the sprite comes back
// into view. Call it only when visibility actually flips: walking the tree
// every frame would cost more than the tweens do.
export function setTweensPausedDeep(
  scene: Pick<Phaser.Scene, 'tweens'>,
  obj: Phaser.GameObjects.GameObject,
  paused: boolean
) {
  for (const tween of scene.tweens.getTweensOf(obj)) {
    if (paused) tween.pause();
    else tween.resume();
  }
  if (obj instanceof Phaser.GameObjects.Container) {
    obj.each((child: Phaser.GameObjects.GameObject) => setTweensPausedDeep(scene, child, paused));
  }
}

// One `CrystalVariant`'s own habit, drawn into `g` centered on (0,0) -- the
// single place a variant name is turned into a shape, so `makeCrystal`'s
// ordinary render and `drawVariantShape`'s hybrid halves can never disagree
// about what a variant looks like. `shard` is the fallback as well as a
// variant in its own right: it is the habit a compound gets when its
// structure has no characteristic one.
//
// Every habit below is a single body -- extra pieces in a crystal are
// reserved words: two co-equal bodies mean a Majorana fusion
// (`drawHybridCrystal`), a small guest seated at the base means a dopant
// (`addDopant`) -- so a compound never draws as more than one solid on its
// own.
// Each habit's own drawing is written in whatever proportions that solid
// actually has, so the same `size` came out as a 55px spire and a 68px
// octahedron -- a quarter apart, which reads as one specimen mattering more
// than another when the roster is shown side by side. These factors even the
// *largest* dimension out, measured off rendered pixels rather than guessed,
// so `size` means the same thing to every habit. They are deliberately small:
// anything bigger than this would be redrawing a shape rather than scaling it,
// and a monolayer is genuinely wider than it is thick.
const HABIT_SCALE: Record<CrystalVariant, number> = {
  shard: 0.91,
  spire: 1.09,
  cubic: 1.0,
  octahedral: 0.88,
  rhombohedral: 1.0,
  tetragonal: 0.92,
  prism: 1.09,
  layer: 1.09,
  layerTriangle: 0.94,
  layerSquare: 0.97,
};

function drawSolidShape(
  g: Phaser.GameObjects.Graphics,
  size: number,
  color: number,
  variant: CrystalVariant,
  stretch: Stretch = NO_STRETCH,
  groundShadow = true
) {
  size *= HABIT_SCALE[variant] ?? 1;
  if (variant === 'spire') drawSpireShape(g, size, color, stretch);
  else if (variant === 'prism') drawPrismShape(g, size, color, stretch);
  else if (variant === 'cubic') drawCubicShape(g, size, color, stretch);
  else if (variant === 'octahedral') drawOctahedralShape(g, size, color, stretch);
  else if (variant === 'rhombohedral') drawRhombohedralShape(g, size, color, stretch);
  else if (variant === 'tetragonal') drawTetragonalShape(g, size, color, stretch);
  else if (variant === 'layer') drawLayerShape(g, size, color, stretch, groundShadow);
  else if (variant === 'layerTriangle') drawPlateShape(g, size, color, stretch, 3, 1.05, groundShadow);
  else if (variant === 'layerSquare') drawPlateShape(g, size, color, stretch, 4, 0.88, groundShadow);
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
    if (opts.dopant) addDopant(scene, container, size, hybridDopantAnchor(size, opts.hybrid, opts.dopant), opts.dopant);
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

  if (opts?.dopant) addDopant(scene, container, size, dopantAnchor(size, variant, stretch, rot, opts.dopant), opts.dopant);

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

// Anderson's doping mechanic (World 6, the Lab): the look of the guest
// crystal substituted into the player's own -- its color and habit, carried
// so the doped render can show *which* compound sits in the host lattice.
export interface DopantLook {
  color: number;
  variant: CrystalVariant;
}

export interface CrystalOptions {
  // Deterministic per-compound identity, normally the material's own name --
  // drives `jitterFor`'s hue/rotation/stretch variation. Ignored when
  // `hybrid` is set.
  seed?: string;
  hybrid?: HybridLook;
  // A doped-in guest (Anderson's mechanic): rendered by `addDopant` as one
  // small crystal seated in the host's base. Honoured on both the ordinary
  // and the hybrid render -- a fused player can be doped at the same time.
  dopant?: DopantLook;
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
// `drawHybridCrystal` fuses two of. 'spire' collapses to a plain shard here
// (its own multi-spire silhouette would crowd a shape that's already sharing
// space with a second parent's own shape); every other variant contributes
// the same habit it renders as on its own.
function drawVariantShape(g: Phaser.GameObjects.Graphics, size: number, color: number, variant: CrystalVariant) {
  drawSolidShape(g, size, color, variant === 'spire' ? 'shard' : variant);
}

// Majorana's hybridization mechanic (DESIGN.md §5): render a fused material
// as a visible mixture of both parents, not one flat blended color. Both
// parents' own silhouettes render off-center and additive-blended so the
// region where they overlap actually brightens into a shared "fusion" glow,
// split by a jagged glowing seam (the fusion boundary made literal) and
// finished with sparkles tinted in both parents' own colors rather than
// plain white. This is the composite whose pieces are co-equal: every
// `CrystalVariant` habit is a single body, and a dopant guest (`addDopant`)
// stays small and subordinate at the host's base, so two full-size offset
// bodies joined by a seam always mean a fusion. Reached via `makeCrystal`'s
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

// Where the dopant guest sits, in container space. On a solid host it tucks
// into the front of the base; on a floating plate host (the `layer*` habits)
// the base would put it under the sheet, on top of the hover shadow -- a
// separate object standing below rather than an atom in the sheet -- so
// there it seats into the plate's front rim instead. The anchor follows the
// host's own jitter stretch and rotation so the guest stays glued to the
// body it is substituted into.
const PLATE_HABITS: ReadonlySet<CrystalVariant> = new Set(['layer', 'layerTriangle', 'layerSquare']);

// The blocky habits bottom out higher than the pointed ones (cubic's base is
// at ~0.65 size, rhombohedral's ~0.62, against shard's ~0.82), so they get a
// higher, more centred seat -- one anchor for all solids left the guest
// hanging off a cube's corner with barely any overlap.
const SHALLOW_SEAT: ReadonlySet<CrystalVariant> = new Set(['cubic', 'rhombohedral']);

// A plate guest on a solid (or hybrid) host seats further inboard than a
// solid guest: edge-on, a plate is nearly flat, so at the solid-guest seat
// most of its footprint would sit off the host's face with sky showing
// between the two -- a separate object hovering beside the crystal rather
// than an atom in it. Pulled toward the centreline, the host body backs the
// plate's whole footprint and only its outer tip clears the silhouette.
function isPlateGuest(dopant: DopantLook): boolean {
  return PLATE_HABITS.has(dopant.variant);
}

function dopantAnchor(
  size: number,
  variant: CrystalVariant,
  stretch: Stretch,
  rotationRad: number,
  dopant: DopantLook
) {
  const plateGuest = isPlateGuest(dopant);
  const seat = PLATE_HABITS.has(variant)
    ? { x: 0.24, y: 0.12 }
    : SHALLOW_SEAT.has(variant)
      ? plateGuest
        ? { x: 0.06, y: 0.42 }
        : { x: 0.16, y: 0.5 }
      : plateGuest
        ? { x: 0.08, y: 0.56 }
        : { x: 0.2, y: 0.68 };
  const x = seat.x * stretch.x * size;
  const y = seat.y * stretch.y * size;
  const cos = Math.cos(rotationRad);
  const sin = Math.sin(rotationRad);
  return { x: x * cos - y * sin, y: x * sin + y * cos };
}

// A hybrid host carries no jitter and its two parent bodies sit at fixed
// offsets, so the seat is fixed too: at the fused body's base, or in the
// front rim when both parents are plates and there is no base to tuck into.
function hybridDopantAnchor(size: number, hybrid: HybridLook, dopant: DopantLook) {
  const bothPlates = PLATE_HABITS.has(hybrid.variantA) && PLATE_HABITS.has(hybrid.variantB);
  const seat = bothPlates
    ? { x: 0.2, y: 0.2 }
    : isPlateGuest(dopant)
      ? { x: 0.06, y: 0.5 }
      : { x: 0.16, y: 0.62 };
  return { x: seat.x * size, y: seat.y * size };
}

// Anderson's doping mechanic made visible: one small guest crystal seated in
// the host's base. Deliberately none of the fusion grammar
// (`drawHybridCrystal`) -- no second full-size body, no additive glow, no
// seam, no sparkles or motion of its own. A dopant is a single substituted
// atom: the host is still overwhelmingly itself, and that asymmetry of size
// and placement is what keeps "doped" from ever reading as "fused". The
// guest keeps its own color and habit (`drawSolidShape`; 'spire' collapses
// to a plain shard for the same reason it does in `drawVariantShape`, and a
// plate guest drops its detached hover shadow -- a substituted atom sits in
// the lattice, it doesn't float in front of it). It draws in front of the
// host, tilted so it reads as lodged in the lattice rather than standing
// beside it -- a solid guest leans a little, a plate guest tilts steeply
// enough to read as a wafer wedged diagonally into the host's face (and
// draws a touch larger, since an edge-on sheet carries far less visual mass
// than a solid at the same size) -- and takes no seed jitter: its identity
// is the doped compound's color and habit, nothing more.
const DOPANT_SCALE = 0.3;
const PLATE_DOPANT_SCALE = 0.34;

function addDopant(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  size: number,
  anchor: { x: number; y: number },
  dopant: DopantLook
) {
  const g = scene.add.graphics();
  const variant = dopant.variant === 'spire' ? 'shard' : dopant.variant;
  const plateGuest = isPlateGuest(dopant);
  drawSolidShape(g, size * (plateGuest ? PLATE_DOPANT_SCALE : DOPANT_SCALE), dopant.color, variant, NO_STRETCH, false);
  g.setPosition(anchor.x, anchor.y);
  g.setRotation(Phaser.Math.DegToRad(plateGuest ? -30 : -10));
  container.add(g);
}
