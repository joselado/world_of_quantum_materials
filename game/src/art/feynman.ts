import Phaser from 'phaser';
import { shade } from './colors';

// Feynman's own avatar -- world 7's guardian. Own file/builder per the
// convention set by art/noether.ts's makeNoetherAvatar, with no robe/cloak
// fill at all: Feynman's own physics is a diagrammatic technique (expand a
// many-body calculation as a picture built from vertices and connecting
// lines instead of writing it out term by term), and world 7's own course
// topic covers the tensor-network diagram notation that same idea takes in
// this course (session07.tex's "Tensor diagrams" section -- a tensor drawn
// as a point with legs, joining two legs meaning summing/contracting over
// that shared index) -- a real, direct kinship to Feynman diagrams' own
// vertices-and-propagators notation, so his avatar is built the same way:
// a floating construct of bright vertex points connected by straight
// propagator lines, no solid robe/cloak fill at all, with two small loop
// insertions (closed circles along a line, the diagrammatic signature of a
// higher-order correction) that pulse in turn.
//
// Drawn in local space centered on the chest/torso (0,0), same convention
// as every other avatar builder: an internal sway tween is baked in, so
// callers are free to layer their own position/bob tween on top.
export function makeFeynmanAvatar(scene: Phaser.Scene, scale = 1): Phaser.GameObjects.Container {
  const S = 30 * scale;
  const amber = 0xffa64a;
  const line = shade(amber, 10);

  const outer = scene.add.container(0, 0);

  const glow = scene.add.graphics();
  glow.setBlendMode(Phaser.BlendModes.ADD);
  glow.fillStyle(amber, 0.13);
  glow.fillCircle(0, -S * 0.15, S * 0.9);
  outer.add(glow);
  scene.tweens.add({
    targets: glow,
    alpha: { from: 0.55, to: 1 },
    scaleX: { from: 0.92, to: 1.1 },
    scaleY: { from: 0.92, to: 1.1 },
    duration: 1800,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });

  const sway = scene.add.container(0, 0);
  outer.add(sway);
  scene.tweens.add({ targets: sway, angle: { from: -2.5, to: 2.5 }, duration: 2600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

  // The vertex points a rough humanoid silhouette is built from -- shoulders,
  // hips, and a small "head" vertex up top, each one a diagram vertex rather
  // than a joint. Propagator lines connect them in a loose lattice (not just
  // an outline) so the construct reads as a diagram, not a wireframe body.
  const vertices = {
    head: { x: 0, y: -S * 0.68 },
    lShoulder: { x: -S * 0.32, y: -S * 0.28 },
    rShoulder: { x: S * 0.32, y: -S * 0.28 },
    chest: { x: 0, y: -S * 0.05 },
    lHip: { x: -S * 0.22, y: S * 0.5 },
    rHip: { x: S * 0.22, y: S * 0.5 },
    base: { x: 0, y: S * 0.82 },
  };
  const propagators: [keyof typeof vertices, keyof typeof vertices][] = [
    ['head', 'lShoulder'],
    ['head', 'rShoulder'],
    ['lShoulder', 'rShoulder'],
    ['lShoulder', 'chest'],
    ['rShoulder', 'chest'],
    ['chest', 'lHip'],
    ['chest', 'rHip'],
    ['lHip', 'rHip'],
    ['lHip', 'base'],
    ['rHip', 'base'],
  ];

  const diagram = scene.add.graphics();
  diagram.lineStyle(1.6, line, 0.75);
  propagators.forEach(([a, b]) => {
    diagram.beginPath();
    diagram.moveTo(vertices[a].x, vertices[a].y);
    diagram.lineTo(vertices[b].x, vertices[b].y);
    diagram.strokePath();
  });
  diagram.fillStyle(0xfff2d0, 1);
  Object.values(vertices).forEach((v) => diagram.fillCircle(v.x, v.y, S * 0.045));
  sway.add(diagram);

  // Two loop insertions -- small closed circles sitting on the torso and hip
  // propagators, the diagrammatic mark of a higher-order correction. Each
  // pulses on its own timing so they don't read as a single synchronized
  // blink.
  const loopSpecs: { on: [keyof typeof vertices, keyof typeof vertices]; t: number; r: number; duration: number; delay: number }[] = [
    { on: ['lShoulder', 'chest'], t: 0.5, r: S * 0.12, duration: 1500, delay: 0 },
    { on: ['chest', 'rHip'], t: 0.5, r: S * 0.1, duration: 1700, delay: 300 },
  ];
  loopSpecs.forEach((spec) => {
    const a = vertices[spec.on[0]];
    const b = vertices[spec.on[1]];
    const cx = a.x + (b.x - a.x) * spec.t;
    const cy = a.y + (b.y - a.y) * spec.t;
    const loop = scene.add.graphics();
    loop.lineStyle(1.4, amber, 0.85);
    loop.strokeCircle(cx, cy, spec.r);
    sway.add(loop);
    scene.tweens.add({
      targets: loop,
      alpha: { from: 0.35, to: 1 },
      scaleX: { from: 0.7, to: 1.15 },
      scaleY: { from: 0.7, to: 1.15 },
      duration: spec.duration,
      delay: spec.delay,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  });

  // A faint orbiting ring of small vertex dots in place of the other
  // guardians' orbiting glyphs -- external legs the diagram extends out
  // into, each on its own slow orbit.
  const orbit = scene.add.container(0, 0);
  for (let i = 0; i < 4; i++) {
    const ang = (i * Math.PI) / 2;
    const dot = scene.add.circle(Math.cos(ang) * S * 0.95, Math.sin(ang) * S * 0.95 - S * 0.05, S * 0.045, amber, 0.85);
    orbit.add(dot);
  }
  sway.add(orbit);
  scene.tweens.add({ targets: orbit, angle: 360, duration: 6000, repeat: -1, ease: 'Linear' });

  return outer;
}
