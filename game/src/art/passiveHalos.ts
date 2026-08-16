import Phaser from 'phaser';
import { fillDot } from './shapes';

// Ground halos for Franklin's three passives (data/passives.ts's
// fractionalGuard/anyonEcho/edgeCurrent, world 9) -- each one visualizes its
// own diffraction/scattering physics directly, anchored to the crystal's
// ground shadow ellipse rather than wrapped around the crystal body, so it
// reads as a property of the defect-riddled lattice the crystal stands on,
// not an effect on the crystal itself. Drawn at a fixed `x`/`y` (the shadow
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
