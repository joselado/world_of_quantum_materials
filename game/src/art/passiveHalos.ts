import Phaser from 'phaser';
import { fillDot } from './shapes';

// Ground halos for Franklin's five passives (data/passives.ts's
// fractionalGuard/anyonEcho/edgeCurrent/lastScattering/fullReflection,
// world 9) -- each one visualizes its own diffraction/scattering physics
// directly, anchored to the crystal's ground shadow ellipse rather than
// wrapped around the crystal body, so it reads as a property of the
// defect-riddled lattice the crystal stands on, not an effect on the crystal
// itself. A crystal can hold several at once (up to three one-slot ones,
// data/passives.ts's PASSIVE_MAX_SLOTS), drawn one after the other around the same shadow, so
// each halo keeps to its own band of the ellipse -- the rim itself, a ring
// just outside it, a ring offset to one side, a wide diffuse glow -- rather
// than all five competing for the same radius. Drawn at a fixed `x`/`y` (the shadow
// ellipse's own center) sized off `rx`/`ry` (the shadow ellipse's own
// half-width/half-height) so the halo scales with whatever shadow it's
// echoing -- BattleScene's full-size ground shadow, or franklin.ts's smaller
// panel-preview one. Deliberately calmer than BattleScene's addBoostHalo
// (concentric glow rings + rotating spikes + rising embers, a flashy
// "temporary bonus" aura) -- a passive is an always-on background trait, not
// a per-turn boost, so each halo here is either fully static or moves with a
// slow, subtle pulse, and stays in Franklin's own lavender/purple family
// (never gold) so the two effects can't be confused if both happen to be on
// screen at once (a passive can be active during a boosted turn).
export function drawFranklinPassiveHalo(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  x: number,
  y: number,
  passiveId: string,
  rx: number,
  ry: number,
  alpha = 1
): void {
  if (passiveId === 'fractionalGuard') drawDiffractionShadowHalo(scene, container, x, y, rx, ry, alpha);
  else if (passiveId === 'anyonEcho') drawSatelliteReflectionHalo(scene, container, x, y, rx, ry, alpha);
  else if (passiveId === 'edgeCurrent') drawAmorphousHalo(scene, container, x, y, rx, ry, alpha);
  else if (passiveId === 'lastScattering') drawLastScatteringHalo(scene, container, x, y, rx, ry, alpha);
  else if (passiveId === 'fullReflection') drawFullReflectionHalo(scene, container, x, y, rx, ry, alpha);
}

// Diffraction Shadow (fractionalGuard) -- "a defect-riddled lattice scatters
// and attenuates an incoming blow, the way porous carbon attenuates an X-ray
// beam." A powder/polycrystalline sample's own diffraction rings are spotty
// rather than the clean continuous rings a single crystal gives -- so this
// reads as a ring of small dim scattered spots around the shadow, at a
// deterministic (not per-frame-random) jitter so the pattern is stable
// rather than flickering, and static -- the defects it represents don't move.
function drawDiffractionShadowHalo(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  x: number,
  y: number,
  rx: number,
  ry: number,
  alpha: number
): void {
  const g = scene.add.graphics();
  const spotCount = 16;
  for (let i = 0; i < spotCount; i++) {
    const ang = (i / spotCount) * Math.PI * 2;
    // A fixed, deterministic pseudo-jitter (not Math.random()) so the same
    // spot pattern renders identically every time this halo is drawn.
    const jitter = (Math.sin(i * 12.9898) * 0.5 + 0.5) * 0.5 + 0.5;
    const rMult = 1.1 + jitter * 0.35;
    g.fillStyle(0x6a5a80, (0.35 + jitter * 0.35) * alpha);
    fillDot(g, x + Math.cos(ang) * rx * rMult, y + Math.sin(ang) * ry * rMult, 1.5 + jitter * 1.5);
  }
  container.add(g);
}

// Satellite Reflection (anyonEcho) -- "a critical hit throws off a secondary
// diffraction peak." A satellite reflection in a diffraction pattern is a
// second, weaker spot sitting just beside the main one -- so this reads as a
// second, fainter ring offset to one side of the shadow, echoing its shape.
// Static, like the fixed offset a real satellite peak sits at.
function drawSatelliteReflectionHalo(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  x: number,
  y: number,
  rx: number,
  ry: number,
  alpha: number
): void {
  const g = scene.add.graphics();
  // `rx`/`ry` are the main shadow's own half-width/half-height, so a
  // same-scale echo needs `* 2` to turn back into strokeEllipse's own
  // width/height (full diameter) convention -- a secondary peak reads
  // smaller than the main one, so this ring sits at 0.8x that size, offset
  // just far enough to read as beside the main shadow rather than centered
  // on top of it.
  const offsetX = rx * 0.85;
  const satW = rx * 2 * 0.8;
  const satH = ry * 2 * 0.8;
  g.lineStyle(2, 0xc9a8ff, 0.6 * alpha);
  g.strokeEllipse(x + offsetX, y, satW, satH);
  g.lineStyle(1, 0xc9a8ff, 0.3 * alpha);
  g.strokeEllipse(x + offsetX, y, satW * 1.15, satH * 1.15);
  container.add(g);
}

// Amorphous Halo (edgeCurrent) -- "a diffuse, defect-broadened halo softens
// the quasiparticle-mismatch double damage." An amorphous solid's own
// diffraction pattern has no sharp Bragg peaks at all, just one or two broad
// diffuse rings (literally called an "amorphous halo" in X-ray diffraction)
// -- so this is a soft, additive-blended glow with no hard edge, the only
// one of the three that moves, breathing on a slow (3.2s), subtle pulse far
// calmer than addBoostHalo's fast 500ms one.
function drawAmorphousHalo(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  x: number,
  y: number,
  rx: number,
  ry: number,
  alpha: number
): void {
  const g = scene.add.graphics();
  g.setBlendMode(Phaser.BlendModes.ADD);
  g.fillStyle(0x9a7ad9, 0.14 * alpha);
  g.fillEllipse(x, y, rx * 2.8, ry * 2.8);
  g.fillStyle(0xb89af0, 0.12 * alpha);
  g.fillEllipse(x, y, rx * 2.1, ry * 2.1);
  container.add(g);
  scene.tweens.add({
    targets: g,
    alpha: { from: 0.55, to: 1 },
    scaleX: { from: 0.95, to: 1.1 },
    scaleY: { from: 0.95, to: 1.1 },
    duration: 3200,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });
}

// Last Scattering (lastScattering) -- "an attenuated beam never drops to
// nothing." Beer-Lambert attenuation falls off exponentially and never
// reaches zero, so this is three thin rings stepping outward from the
// shadow's rim and fading with each step, the way transmitted intensity
// falls through successive layers -- and, at the front of the rim, one small
// bright point that breathes on a slow pulse but never dims below a floor:
// the last of the beam, always getting through. The rings sit tight to the
// rim (1.0x-1.3x), inside Diffraction Shadow's spot ring, so the two stack
// without touching.
function drawLastScatteringHalo(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  x: number,
  y: number,
  rx: number,
  ry: number,
  alpha: number
): void {
  const rings = scene.add.graphics();
  const steps = [1.0, 1.15, 1.3];
  steps.forEach((mult, i) => {
    rings.lineStyle(1, 0xc9a8ff, (0.55 - i * 0.18) * alpha);
    rings.strokeEllipse(x, y, rx * 2 * mult, ry * 2 * mult);
  });
  container.add(rings);

  const spark = scene.add.graphics();
  spark.fillStyle(0xe8dcff, 0.9 * alpha);
  fillDot(spark, x, y + ry, 2.2);
  spark.fillStyle(0xc9a8ff, 0.35 * alpha);
  fillDot(spark, x, y + ry, 4.5);
  container.add(spark);
  scene.tweens.add({
    targets: spark,
    alpha: { from: 1, to: 0.6 },
    duration: 2600,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });
}

// Full Reflection (fullReflection) -- "below the critical angle a beam
// reflects entirely off the surface." Total external reflection turns a
// surface into a mirror for a grazing X-ray beam, so the shadow's own rim is
// drawn as a polished edge: a bright sheen along its far rim, a fainter twin
// along its near rim, and a glint where the beam grazes in at the left. The
// sheen shimmers on a slow pulse (a mirror catching the light), never
// brighter than the crystal itself. Drawn on the rim itself, inside every
// other halo's band.
function drawFullReflectionHalo(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  x: number,
  y: number,
  rx: number,
  ry: number,
  alpha: number
): void {
  const sheen = scene.add.graphics();
  // Two arcs hugging the ellipse: the far rim (top half, bright) and the
  // near rim (bottom half, fainter) -- sampled along the ellipse itself so
  // they follow whatever shadow they are echoing.
  const arc = (from: number, to: number, width: number, color: number, a: number) => {
    sheen.lineStyle(width, color, a * alpha);
    sheen.beginPath();
    const n = 24;
    for (let i = 0; i <= n; i++) {
      const t = from + ((to - from) * i) / n;
      const px = x + Math.cos(t) * rx * 1.04;
      const py = y + Math.sin(t) * ry * 1.04;
      if (i === 0) sheen.moveTo(px, py);
      else sheen.lineTo(px, py);
    }
    sheen.strokePath();
  };
  // The far rim's sheen, with a soft glow just outside it so it reads on a
  // dark stage as well as on a lit field; the near rim's twin is thinner.
  arc(Math.PI * 1.12, Math.PI * 1.88, 3, 0xf0e8ff, 0.9);
  arc(Math.PI * 0.2, Math.PI * 0.8, 1.5, 0xc9a8ff, 0.5);
  const glow = scene.add.graphics();
  glow.setBlendMode(Phaser.BlendModes.ADD);
  glow.lineStyle(5, 0xc9a8ff, 0.22 * alpha);
  glow.beginPath();
  for (let i = 0; i <= 24; i++) {
    const t = Math.PI * 1.12 + ((Math.PI * 0.76) * i) / 24;
    const px = x + Math.cos(t) * rx * 1.1;
    const py = y + Math.sin(t) * ry * 1.1;
    if (i === 0) glow.moveTo(px, py);
    else glow.lineTo(px, py);
  }
  glow.strokePath();
  container.add(glow);
  // The glint: where the grazing beam meets the mirror, at the left rim.
  sheen.fillStyle(0xffffff, 0.85 * alpha);
  fillDot(sheen, x - rx * 1.04, y, 2.2);
  sheen.fillStyle(0xe8dcff, 0.3 * alpha);
  fillDot(sheen, x - rx * 1.04, y, 5);
  container.add(sheen);
  scene.tweens.add({
    targets: sheen,
    alpha: { from: 0.7, to: 1 },
    duration: 2400,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });
}
