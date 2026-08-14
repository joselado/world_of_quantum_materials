import Phaser from 'phaser';
import { shade } from './colors';

// Franklin's avatar -- world 9's guardian (X-ray diffraction of pore/defect
// structure in disordered carbon, the real tie between Rosalind Franklin and
// "excitations and defects": porous/amorphous carbon scatters an X-ray beam
// into diffuse rings rather than the sharp spots a perfect crystal gives).
// A slim, upright experimenter holding her detector plate out in front of
// her like a shield -- which is also what her passives are: always-on
// defensive diffraction effects. The plate is a dark upright sheet of film,
// the rectangular format these images were actually exposed on, carrying the
// diffuse Debye-Scherrer ring pattern a disordered sample scatters into --
// concentric pulsing rings around a dim central beam spot, with a scatter of
// pore sites between them. Silhouette: a head and narrow shoulders over one
// hard-edged upright slab. The rectangle is doing real work at Lab scale,
// where these stand small and side by side: Kondo's screening shells are a
// disc by necessity (an enclosing cloud *is* that physics), so a round plate
// here would leave the two guardians sharing one outline and separable only
// by colour, which greyscale defeats.
//
// Drawn in local space centered on the chest/torso (0,0), same convention
// as every other avatar builder: an internal sway tween is baked in, so
// callers are free to layer their own position/bob tween on top.
export function makeFranklinAvatar(scene: Phaser.Scene, scale = 1): Phaser.GameObjects.Container {
  const S = 30 * scale;
  const lavender = 0xa878c9;
  const cloakColor = 0x2a2040;
  const skin = 0xe0d0c8;
  const headY = -S * 0.78;

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

  // The figure behind the plate: a narrow column robe and sloped shoulders,
  // most of it about to be covered -- only head, shoulders and the robe's
  // sides read past the disc, which is the intended silhouette.
  const figure = scene.add.graphics();
  figure.fillStyle(cloakColor, 1);
  figure.fillPoints(
    [
      { x: -S * 0.3, y: -S * 0.52 },
      { x: S * 0.3, y: -S * 0.52 },
      { x: S * 0.24, y: S * 0.7 },
      { x: -S * 0.24, y: S * 0.7 },
    ],
    true
  );
  figure.lineStyle(1.5, shade(lavender, -20), 0.6);
  figure.strokePoints(
    [
      { x: -S * 0.3, y: -S * 0.52 },
      { x: S * 0.3, y: -S * 0.52 },
      { x: S * 0.24, y: S * 0.7 },
      { x: -S * 0.24, y: S * 0.7 },
    ],
    true
  );
  sway.add(figure);

  const head = scene.add.graphics();
  head.fillStyle(shade(skin, 4), 1);
  head.fillCircle(0, headY, S * 0.26);
  // Sloped shoulders peeking out past the plate's top edge, so the head
  // reads as belonging to the figure rather than floating over the disc.
  head.fillStyle(cloakColor, 1);
  head.fillPoints(
    [
      { x: -S * 0.14, y: -S * 0.6 },
      { x: S * 0.14, y: -S * 0.6 },
      { x: S * 0.44, y: -S * 0.3 },
      { x: -S * 0.44, y: -S * 0.3 },
    ],
    true
  );
  head.lineStyle(1.3, shade(lavender, -15), 0.7);
  head.strokePoints(
    [
      { x: -S * 0.14, y: -S * 0.6 },
      { x: S * 0.14, y: -S * 0.6 },
      { x: S * 0.44, y: -S * 0.3 },
      { x: -S * 0.44, y: -S * 0.3 },
    ],
    true
  );
  sway.add(head);

  // The detector plate, held in front of the body: a dark upright sheet of
  // film, rimmed.
  const plateY = S * 0.18;
  const plateW = S * 1.02;
  const plateH = S * 1.22;
  const plate = scene.add.graphics();
  plate.fillStyle(0x191230, 1);
  plate.fillRect(-plateW / 2, plateY - plateH / 2, plateW, plateH);
  plate.lineStyle(1.6, shade(lavender, -15), 0.9);
  plate.strokeRect(-plateW / 2, plateY - plateH / 2, plateW, plateH);
  // The dim central beam spot and the pore sites -- the disordered sample's
  // own structure printed between the rings.
  plate.fillStyle(lavender, 0.55);
  plate.fillCircle(0, plateY, S * 0.05);
  [
    { x: 0.3, y: -0.12 },
    { x: -0.26, y: 0.2 },
    { x: 0.12, y: 0.32 },
    { x: -0.15, y: -0.28 },
    { x: 0.34, y: 0.18 },
  ].forEach((p) => {
    plate.fillStyle(shade(lavender, -10), 0.5);
    plate.fillCircle(p.x * S, plateY + p.y * S, S * 0.035);
  });
  // Two hands gripping the edges -- the plate is held out, not mounted.
  plate.fillStyle(shade(skin, 4), 1);
  plate.fillCircle(-plateW / 2, plateY - S * 0.28, S * 0.07);
  plate.fillCircle(plateW / 2, plateY - S * 0.28, S * 0.07);
  sway.add(plate);

  // Concentric diffraction rings on the plate -- the diffuse
  // Debye-Scherrer halo a disordered/amorphous material scatters an X-ray
  // beam into, in place of a perfect crystal's sharp spots. Each ring
  // pulses on its own offset timing so the pattern reads as actively
  // forming rather than a static bullseye.
  [0.18, 0.32, 0.47].forEach((r, i) => {
    const ring = scene.add.graphics();
    ring.setBlendMode(Phaser.BlendModes.ADD);
    ring.lineStyle(1.5, lavender, 0.8 - i * 0.18);
    ring.strokeCircle(0, plateY, S * r);
    sway.add(ring);
    scene.tweens.add({
      targets: ring,
      alpha: { from: 0.3, to: 0.95 },
      duration: 1100 + i * 260,
      delay: i * 180,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  });

  return outer;
}
