import Phaser from 'phaser';
import { shade } from './colors';
import { REFERENCE_BLUE_GREY, STORY_LAVENDER, TUTORIAL_CYAN } from '../ui/theme';

// One small hand-drawn icon per Lab station (scenes/panels/hubStations.ts's
// six reference/settings stations, plus HubScene's own Qumatex and the
// door onward) -- the
// motif STYLE.md's "Lab panels" section describes, planted beside that
// station's own button out in the Lab room (HubScene.addStationRow) rather
// than inside the panel the button opens.
// Built from the same Phaser.GameObjects.Graphics primitive vocabulary as
// every other piece of art in this game (no external image assets, per
// STYLE.md). Every builder takes a fixed pixel `size` and returns a
// `Container` centered on its own (0,0) local origin -- callers position it,
// and never run it through ui/text.ts's fontPx()/fontScale(), since a
// decorative glyph's own size is art, not text (see ui/text.ts's own
// comment, and Qumatex's `crystalBlockH` in HubScene.ts for the established
// precedent).

export function makeQumatexMotif(scene: Phaser.Scene, size: number): Phaser.GameObjects.Container {
  const container = scene.add.container(0, 0);
  const color = 0x9a6ad9; // matches Qumatex's own panel stroke

  // A small 2x2 grid of tiny faceted gems -- reads as "an indexed catalog of
  // crystals" at a glance, distinct from the panel's own detail pane, which
  // renders one full-size makeCrystal for whichever single compound is
  // currently selected.
  const g = scene.add.graphics();
  const cellR = size * 0.22;
  const cells = [
    { dx: -0.3, dy: -0.3, shadeStep: 25 },
    { dx: 0.3, dy: -0.3, shadeStep: -5 },
    { dx: -0.3, dy: 0.3, shadeStep: -25 },
    { dx: 0.3, dy: 0.3, shadeStep: 10 },
  ];
  cells.forEach(({ dx, dy, shadeStep }) => {
    const cx = dx * size;
    const cy = dy * size;
    const pts = [
      { x: cx, y: cy - cellR },
      { x: cx + cellR * 0.8, y: cy },
      { x: cx, y: cy + cellR },
      { x: cx - cellR * 0.8, y: cy },
    ];
    g.fillStyle(shade(color, shadeStep), 1);
    g.fillPoints(pts, true);
    g.lineStyle(1, shade(color, shadeStep - 35), 0.9);
    g.strokePoints(pts, true);
  });
  container.add(g);

  return container;
}

export function makeDoorMotif(scene: Phaser.Scene, size: number): Phaser.GameObjects.Container {
  const container = scene.add.container(0, 0);

  // A miniature of the walkable world-door's own archway (art/door.ts) --
  // same stone frame, same dark inset, same self-luminous lavender portal --
  // but freestanding, its glow spilling past the frame on every side rather
  // than set into a wall. A world's own door is a notch in terrain leading to
  // one fixed neighbour; a doorway standing in nothing is the Lab's, which
  // leads anywhere. Deliberately not a spiral or funnel: at this size a
  // spiral collapses into a whirlpool and reads as a hazard, and a tunnel
  // with a visible far end would put a view of an exterior in a room that has
  // none. The opening shows light, never scenery. The additive glow assumes
  // the Lab's own dark wall behind it.
  const halo = scene.add.circle(0, 0, size * 0.55, STORY_LAVENDER, 0.15);
  halo.setBlendMode(Phaser.BlendModes.ADD);
  container.add(halo);

  const g = scene.add.graphics();
  // Small corner radius: rounded much further, the frame stops reading as a
  // doorway and starts reading as one more gem.
  g.fillStyle(0x453f5e, 1);
  g.fillRoundedRect(-size * 0.32, -size * 0.52, size * 0.64, size * 1.04, size * 0.1);
  g.lineStyle(1, 0x7367a3, 1);
  g.strokeRoundedRect(-size * 0.32, -size * 0.52, size * 0.64, size * 1.04, size * 0.1);
  g.fillStyle(0x0d0b16, 1);
  g.fillRoundedRect(-size * 0.23, -size * 0.43, size * 0.46, size * 0.86, size * 0.07);
  container.add(g);

  const portal = scene.add.graphics();
  portal.setBlendMode(Phaser.BlendModes.ADD);
  portal.fillStyle(STORY_LAVENDER, 0.7);
  portal.fillEllipse(0, 0, size * 0.42, size * 0.74);
  portal.fillStyle(0xffffff, 0.45);
  portal.fillEllipse(0, 0, size * 0.21, size * 0.37);
  container.add(portal);
  // The one Lab motif that pulses: this station is a live passage rather than
  // a reference panel, and the walkable world-door it mirrors pulses too.
  scene.tweens.add({ targets: portal, alpha: { from: 0.7, to: 1 }, duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

  return container;
}

export function makeMovesMotif(scene: Phaser.Scene, size: number): Phaser.GameObjects.Container {
  const container = scene.add.container(0, 0);
  const color = 0xff9a4a; // Phonon Beam's own attack-effect orange, the one class every move class shares

  const glow = scene.add.circle(0, 0, size * 0.5, color, 0.14);
  glow.setBlendMode(Phaser.BlendModes.ADD);
  container.add(glow);

  // A jagged energy bolt standing for the bolt-class attacks (Phonon Beam/
  // Electron Pulse/Spinon Swap), in their shared attack-effect orange -- a
  // static icon reading as "an attack," not a copy of the battle animation.
  const g = scene.add.graphics();
  const pts = [
    { x: -size * 0.05, y: -size * 0.55 },
    { x: size * 0.18, y: -size * 0.08 },
    { x: -size * 0.02, y: -size * 0.02 },
    { x: size * 0.1, y: size * 0.55 },
    { x: -size * 0.22, y: size * 0.02 },
    { x: size * 0.02, y: -size * 0.06 },
  ];
  g.fillStyle(shade(color, 35), 1);
  g.fillPoints(pts, true);
  g.lineStyle(1.5, shade(color, -35), 1);
  g.strokePoints(pts, true);
  container.add(g);

  return container;
}

export function makeStatsMotif(scene: Phaser.Scene, size: number): Phaser.GameObjects.Container {
  const container = scene.add.container(0, 0);
  const color = REFERENCE_BLUE_GREY;

  // A small ascending bar chart -- three bars, tallest last -- read as "your
  // stats climbing," rather than a literal dial (a dial's needle position
  // would have nothing to point at here).
  const g = scene.add.graphics();
  const bars = [
    { x: -size * 0.32, h: size * 0.36, shadeStep: -10 },
    { x: 0, h: size * 0.58, shadeStep: 15 },
    { x: size * 0.32, h: size * 0.82, shadeStep: 35 },
  ];
  const barW = size * 0.22;
  const baseY = size * 0.46;
  bars.forEach(({ x, h, shadeStep }) => {
    g.fillStyle(shade(color, shadeStep), 1);
    g.fillRoundedRect(x - barW / 2, baseY - h, barW, h, 2);
    g.lineStyle(1, shade(color, shadeStep - 30), 0.8);
    g.strokeRoundedRect(x - barW / 2, baseY - h, barW, h, 2);
  });
  g.lineStyle(1, shade(color, -20), 0.6);
  g.lineBetween(-size * 0.46, baseY, size * 0.46, baseY);
  container.add(g);

  return container;
}

export function makeAbilitiesMotif(scene: Phaser.Scene, size: number): Phaser.GameObjects.Container {
  const container = scene.add.container(0, 0);
  const color = 0x8fa0ff; // PASSIVE_PILL_COLOR -- ties this motif to the same "always-on passive" tone battle uses

  const g = scene.add.graphics();
  const w = size * 0.5;
  const h = size * 0.62;
  const shieldPts = [
    { x: -w, y: -h * 0.75 },
    { x: 0, y: -h },
    { x: w, y: -h * 0.75 },
    { x: w, y: h * 0.1 },
    { x: 0, y: h },
    { x: -w, y: h * 0.1 },
  ];
  g.fillStyle(shade(color, -15), 1);
  g.fillPoints(shieldPts, true);
  g.fillStyle(shade(color, 20), 0.9);
  g.fillPoints(
    shieldPts.map((p) => ({ x: p.x * 0.62, y: p.y * 0.62 })),
    true
  );
  g.lineStyle(1.5, shade(color, -45), 1);
  g.strokePoints(shieldPts, true);
  container.add(g);

  const emblem = scene.add.circle(0, -h * 0.05, size * 0.1, 0xffffff, 0.85);
  container.add(emblem);

  return container;
}

export function makeTutorialMotif(scene: Phaser.Scene, size: number): Phaser.GameObjects.Container {
  const container = scene.add.container(0, 0);
  const color = TUTORIAL_CYAN; // matches the tutorial panels' own cyan stroke

  // A small open book -- two pages splayed from a center spine.
  const g = scene.add.graphics();
  const spineX = 0;
  const pageW = size * 0.42;
  const pageH = size * 0.58;
  g.fillStyle(shade(color, -25), 1);
  g.fillPoints(
    [
      { x: spineX, y: -pageH * 0.5 },
      { x: spineX - pageW, y: -pageH * 0.36 },
      { x: spineX - pageW, y: pageH * 0.5 },
      { x: spineX, y: pageH * 0.36 },
    ],
    true
  );
  g.fillStyle(shade(color, 20), 1);
  g.fillPoints(
    [
      { x: spineX, y: -pageH * 0.5 },
      { x: spineX + pageW, y: -pageH * 0.36 },
      { x: spineX + pageW, y: pageH * 0.5 },
      { x: spineX, y: pageH * 0.36 },
    ],
    true
  );
  g.lineStyle(1, shade(color, -45), 0.9);
  for (const dy of [-0.16, 0, 0.16]) {
    g.lineBetween(spineX - pageW * 0.7, dy * pageH, spineX - pageW * 0.15, dy * pageH + pageH * 0.05);
    g.lineBetween(spineX + pageW * 0.15, dy * pageH + pageH * 0.05, spineX + pageW * 0.7, dy * pageH);
  }
  g.lineStyle(1.5, shade(color, -55), 1);
  g.lineBetween(spineX, -pageH * 0.5, spineX, pageH * 0.5);
  container.add(g);

  return container;
}

export function makeSettingsMotif(scene: Phaser.Scene, size: number): Phaser.GameObjects.Container {
  const container = scene.add.container(0, 0);
  const color = REFERENCE_BLUE_GREY;

  // A small gear -- a ring of teeth plus a hub -- with a second, smaller
  // gear meshed at its lower-right so it still reads as "settings/tuning"
  // rather than a plain cog-shaped badge.
  const g = scene.add.graphics();
  const drawGear = (cx: number, cy: number, r: number, teeth: number, col: number) => {
    g.fillStyle(shade(col, -15), 1);
    for (let i = 0; i < teeth; i++) {
      const a = (i / teeth) * Math.PI * 2;
      const tx = cx + Math.cos(a) * r * 1.28;
      const ty = cy + Math.sin(a) * r * 1.28;
      g.fillCircle(tx, ty, r * 0.24);
    }
    g.fillStyle(shade(col, 10), 1);
    g.fillCircle(cx, cy, r);
    g.lineStyle(1.5, shade(col, -50), 1);
    g.strokeCircle(cx, cy, r);
    g.fillStyle(shade(col, -50), 1);
    g.fillCircle(cx, cy, r * 0.32);
  };
  drawGear(-size * 0.14, -size * 0.1, size * 0.32, 8, color);
  drawGear(size * 0.24, size * 0.24, size * 0.18, 6, shade(color, 20));
  container.add(g);

  return container;
}

export function makeTitleScreenMotif(scene: Phaser.Scene, size: number): Phaser.GameObjects.Container {
  const container = scene.add.container(0, 0);
  const color = STORY_LAVENDER;

  // The title card itself -- a lit plaque carrying the showcase crystal over
  // two menu lines. Deliberately not another archway: the door motif already
  // means "through here, into a world," and this station is the one way out
  // of the game rather than into any part of it.
  const g = scene.add.graphics();
  const w = size * 0.88;
  const h = size * 0.68;
  const r = size * 0.1;
  g.fillStyle(shade(color, -72), 1);
  g.fillRoundedRect(-w / 2, -h / 2, w, h, r);
  g.lineStyle(1.5, color, 0.9);
  g.strokeRoundedRect(-w / 2, -h / 2, w, h, r);

  const gemR = size * 0.16;
  const gemY = -h * 0.14;
  g.fillStyle(shade(color, 30), 1);
  g.fillPoints(
    [
      { x: 0, y: gemY - gemR },
      { x: gemR * 0.72, y: gemY },
      { x: 0, y: gemY + gemR },
      { x: -gemR * 0.72, y: gemY },
    ],
    true
  );

  // Two menu lines under it, the second dimmer, so the plaque reads as a
  // screen with choices on it rather than a framed picture.
  const barH = size * 0.055;
  g.fillStyle(color, 0.8);
  g.fillRect(-w * 0.26, h * 0.12, w * 0.52, barH);
  g.fillStyle(color, 0.45);
  g.fillRect(-w * 0.17, h * 0.28, w * 0.34, barH);
  container.add(g);

  return container;
}
