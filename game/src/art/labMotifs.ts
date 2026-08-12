import Phaser from 'phaser';
import { shade } from './colors';

// One small hand-drawn icon per Lab station (scenes/panels/hubStations.ts's
// six reference/settings stations, plus HubScene's own Qumatex and Save
// Point) -- the motif STYLE.md's "Lab panels" section describes, planted
// beside that station's own button out in the Lab room
// (HubScene.addStationRow) rather than inside the panel the button opens.
// Built from the same Phaser.GameObjects.Graphics primitive vocabulary as
// every other piece of art in this game (no external image assets, per
// STYLE.md). Every builder takes a fixed pixel `size` and returns a
// `Container` centered on its own (0,0) local origin -- callers position it,
// and never run it through ui/text.ts's fontPx()/fontScale(), since a
// decorative glyph's own size is art, not text (see ui/text.ts's own
// comment, and Qumatex's `crystalBlockH` in HubScene.ts for the established
// precedent). The door has no motif of its own -- plain text is enough to
// read as an exit.

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

export function makeSavePointMotif(scene: Phaser.Scene, size: number): Phaser.GameObjects.Container {
  const container = scene.add.container(0, 0);
  const color = 0xffe066;

  const halo = scene.add.ellipse(0, size * 0.38, size * 1.15, size * 0.42, color, 0.16);
  halo.setBlendMode(Phaser.BlendModes.ADD);
  container.add(halo);

  // A slim faceted spire (echoing the Save Point hotspot's own gold shard
  // icon) standing on a pooled glow, read as a beacon/rune marker rather
  // than a gem sitting on the ground.
  const g = scene.add.graphics();
  const top = { x: 0, y: -size * 0.58 };
  const left = { x: -size * 0.2, y: size * 0.02 };
  const right = { x: size * 0.2, y: size * 0.02 };
  const baseL = { x: -size * 0.1, y: size * 0.4 };
  const baseR = { x: size * 0.1, y: size * 0.4 };
  g.fillStyle(shade(color, 30), 1);
  g.fillTriangle(top.x, top.y, left.x, left.y, 0, top.y * 0.05);
  g.fillStyle(shade(color, -10), 1);
  g.fillTriangle(top.x, top.y, 0, top.y * 0.05, right.x, right.y);
  g.fillStyle(shade(color, -30), 1);
  g.fillPoints([left, baseL, baseR, right], true);
  g.lineStyle(1.5, shade(color, -50), 0.9);
  g.strokePoints([top, right, baseR, baseL, left], true);
  container.add(g);

  // A small etched rune ring floating over the spire's tip -- a diamond
  // inside a thin circle -- the "save" glyph.
  const rune = scene.add.graphics();
  rune.lineStyle(1.5, 0xffffff, 0.85);
  rune.strokeCircle(0, -size * 0.72, size * 0.16);
  const d = size * 0.08;
  rune.strokePoints(
    [
      { x: 0, y: -size * 0.72 - d },
      { x: d, y: -size * 0.72 },
      { x: 0, y: -size * 0.72 + d },
      { x: -d, y: -size * 0.72 },
    ],
    true
  );
  container.add(rune);

  scene.tweens.add({ targets: rune, alpha: { from: 0.5, to: 1 }, duration: 1400, yoyo: true, repeat: -1 });
  return container;
}

export function makeMovesMotif(scene: Phaser.Scene, size: number): Phaser.GameObjects.Container {
  const container = scene.add.container(0, 0);
  const color = 0xff9a4a; // Phonon Beam's own attack-effect orange, the one class every move class shares

  const glow = scene.add.circle(0, 0, size * 0.5, color, 0.14);
  glow.setBlendMode(Phaser.BlendModes.ADD);
  container.add(glow);

  // A jagged energy bolt, the same silhouette family art/attackEffects.ts's
  // bolt shape traces for Phonon Beam/Electron Pulse/Spinon Swap.
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
  const color = 0x8fa0c9;

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

export function makeGuardiansMotif(scene: Phaser.Scene, size: number): Phaser.GameObjects.Container {
  const container = scene.add.container(0, 0);
  const color = 0xb98fea; // matches showGuardiansPanel's own stroke

  // A tiny robed figure -- the same "floating haloed head over a cloak"
  // silhouette family every guardian avatar builder draws, simplified down
  // to icon size -- plus a small quote glyph, since this panel is where the
  // player revisits a guardian's own lesson.
  const g = scene.add.graphics();
  g.fillStyle(shade(color, -10), 0.95);
  g.fillTriangle(-size * 0.34, size * 0.5, size * 0.34, size * 0.5, 0, -size * 0.12);
  g.fillStyle(shade(color, 30), 1);
  g.fillCircle(0, -size * 0.32, size * 0.18);
  const halo = scene.add.circle(0, -size * 0.32, size * 0.28, 0xffffff, 0.18);
  halo.setBlendMode(Phaser.BlendModes.ADD);
  container.add(halo);
  container.add(g);

  const quote = scene.add
    .text(size * 0.3, size * 0.42, '”', { fontSize: `${Math.round(size * 0.6)}px`, color: '#ffffff' })
    .setOrigin(0.5);
  quote.setAlpha(0.8);
  container.add(quote);

  return container;
}

export function makeTutorialMotif(scene: Phaser.Scene, size: number): Phaser.GameObjects.Container {
  const container = scene.add.container(0, 0);
  const color = 0x5ad9ff; // matches the tutorial panels' own cyan stroke

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
  const color = 0x8fa0c9;

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
