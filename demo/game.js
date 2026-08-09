// Quantum Materials RPG -- minimal World 1 prototype.
// All visuals are drawn procedurally with Phaser's Graphics API (faceted crystal
// shapes, a chibi trainer sprite) -- no external image assets, so the demo stays
// a single self-contained file. See ../DESIGN.md for the full plan and
// ../data/materials.json for the data model this will eventually be driven by.

const GRID_W = 15;
const GRID_H = 10;

// Isometric (diamond) projection for the overworld -- movement itself stays on
// a plain 2D integer grid (see OverworldScene), only the on-screen position of
// each tile/sprite is projected through this to get a pseudo-3D look.
const ISO_TILE_W = 48;
const ISO_TILE_H = 24;
const ISO_ORIGIN_X = 260;
const ISO_ORIGIN_Y = 70;

function isoToScreen(x, y) {
  return {
    x: ISO_ORIGIN_X + (x - y) * (ISO_TILE_W / 2),
    y: ISO_ORIGIN_Y + (x + y) * (ISO_TILE_H / 2),
  };
}

const COLORS = {
  grass: 0x2e7d32,
  tallgrass: 0x1b5e20,
  player: 0x4a90d9,
};

// Small hardcoded subset of ../data/materials.json, enough for one demo battle.
const MOVES = {
  disorderPulse: { name: 'Disorder Pulse', class: 'disorder', power: 9 },
  tunnelStrike: { name: 'Tunnel Strike', class: 'trivial', power: 8 },
  thermalFluctuation: { name: 'Thermal Fluctuation', class: 'thermal', power: 9 },
  fluxTwist: { name: 'Flux Twist', class: 'gauge', power: 7 },
};

const TYPE_CHART = {
  disorder: { trivial: 1.5, magnet: 1.5, topological: 0.5 },
  thermal: { magnet: 1.5 },
  gauge: {},
};

const PLAYER_MATERIAL = {
  name: 'Free Fermion',
  type: 'trivial',
  color: 0x4a90d9,
  variant: 'shard',
  maxHp: 30,
  moves: ['disorderPulse', 'tunnelStrike'],
};

const WILD_POOL = [
  {
    name: 'Broken-Symmetry Magnet',
    type: 'magnet',
    color: 0xd94a4a,
    variant: 'cluster',
    maxHp: 26,
    moves: ['thermalFluctuation'],
  },
  {
    name: 'Chern Flicker',
    type: 'topological',
    color: 0x4ad9a0,
    variant: 'prism',
    maxHp: 24,
    moves: ['fluxTwist'],
  },
];

function effectiveness(moveClass, defenderType) {
  return (TYPE_CHART[moveClass] && TYPE_CHART[moveClass][defenderType]) || 1.0;
}

// ---- Procedural art helpers -------------------------------------------------

function shade(colorInt, amount) {
  const c = Phaser.Display.Color.IntegerToColor(colorInt);
  if (amount >= 0) c.brighten(amount);
  else c.darken(-amount);
  return c.color;
}

// A single faceted gem, drawn centered on (0,0) in the Graphics object's own
// local space -- callers position/rotate it via the Graphics object's own
// transform rather than doing point-rotation math by hand.
function drawShardShape(g, size, color) {
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
function drawPrismShape(g, size, color) {
  const s = size;
  const topPts = [];
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

// Builds a shiny crystal (a Container so it can be positioned/tweened as one
// unit) matching a material's `variant`: a single shard, a jagged cluster of
// three shards, or a layered prism -- plus a specular highlight and a few
// twinkling sparkles for the "shiny" look.
function makeCrystal(scene, size, color, variant) {
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

// A small cartoon ("chibi") trainer: colored outfit, skin-tone head, dark
// spiky hair, dot eyes, a smile -- used for the overworld player sprite.
function makeChibiTrainer(scene, bodyColor) {
  const container = scene.add.container(0, 0);
  const g = scene.add.graphics();

  g.fillStyle(bodyColor, 1);
  g.fillRoundedRect(-9, -3, 18, 17, 5);
  g.lineStyle(1.5, shade(bodyColor, -40), 1);
  g.strokeRoundedRect(-9, -3, 18, 17, 5);

  g.fillStyle(0xffe0bd, 1);
  g.fillCircle(0, -12, 8.5);
  g.lineStyle(1.2, 0xd1a373, 1);
  g.strokeCircle(0, -12, 8.5);

  g.fillStyle(0x3b2a20, 1);
  g.fillCircle(0, -17, 6);
  g.fillTriangle(-7, -16, -2, -25, 1, -16);
  g.fillTriangle(7, -16, 2, -25, -1, -16);

  g.fillStyle(0x222222, 1);
  g.fillCircle(-3, -12, 1.2);
  g.fillCircle(3, -12, 1.2);

  g.lineStyle(1.2, 0x8a5a2a, 1);
  g.beginPath();
  g.arc(0, -10.5, 2.6, Phaser.Math.DegToRad(20), Phaser.Math.DegToRad(160), false);
  g.strokePath();

  const shadow = scene.add.ellipse(0, 15, 16, 6, 0x000000, 0.25);
  container.add(shadow);
  container.add(g);
  return container;
}

// Draws one diamond tile centered at isometric screen position (sx, sy).
function drawIsoTile(scene, sx, sy, color) {
  const g = scene.add.graphics();
  const hw = ISO_TILE_W / 2;
  const hh = ISO_TILE_H / 2;
  const pts = [
    { x: sx, y: sy - hh },
    { x: sx + hw, y: sy },
    { x: sx, y: sy + hh },
    { x: sx - hw, y: sy },
  ];
  g.fillStyle(color, 1);
  g.fillPoints(pts, true);
  g.lineStyle(1, shade(color, -25), 0.5);
  g.strokePoints(pts, true);
}

function decorateIsoTile(scene, sx, sy, isTallGrass) {
  const g = scene.add.graphics();
  if (isTallGrass) {
    g.fillStyle(shade(COLORS.tallgrass, 30), 1);
    for (let i = 0; i < 3; i++) {
      const bx = sx - 6 + i * 6;
      g.fillTriangle(bx - 1.5, sy + 5, bx + 1.5, sy + 5, bx, sy - 6);
    }
  } else if (Math.random() < 0.22) {
    g.fillStyle(0xffffff, 0.9);
    [0, 1, 2, 3].forEach((i) => {
      const ang = (i * Math.PI) / 2;
      g.fillCircle(sx + Math.cos(ang) * 2.4, sy + Math.sin(ang) * 1.6, 1.8);
    });
    g.fillStyle(0xffdd55, 1);
    g.fillCircle(sx, sy, 1.3);
  }
}

// ---- Scenes ------------------------------------------------------------------

class OverworldScene extends Phaser.Scene {
  constructor() {
    super('Overworld');
  }

  create() {
    this.moving = false;
    this.playerTile = { x: 3, y: 4 };

    this.add.rectangle(320, 240, 640, 480, shade(COLORS.grass, -55));

    // Decide grass first, then paint diamond tiles back-to-front (ascending
    // x+y "diagonal") so nearer tiles correctly draw over farther ones.
    this.grassMap = [];
    for (let y = 0; y < GRID_H; y++) {
      this.grassMap.push(new Array(GRID_W).fill(false));
    }
    for (let y = 0; y < GRID_H; y++) {
      for (let x = 0; x < GRID_W; x++) {
        const isStart = x === this.playerTile.x && y === this.playerTile.y;
        this.grassMap[y][x] = !isStart && Math.random() < 0.28;
      }
    }

    const maxDiagonal = GRID_W + GRID_H - 2;
    for (let d = 0; d <= maxDiagonal; d++) {
      for (let x = 0; x < GRID_W; x++) {
        const y = d - x;
        if (y < 0 || y >= GRID_H) continue;
        const { x: sx, y: sy } = isoToScreen(x, y);
        const isTallGrass = this.grassMap[y][x];
        drawIsoTile(this, sx, sy, isTallGrass ? COLORS.tallgrass : COLORS.grass);
        decorateIsoTile(this, sx, sy, isTallGrass);
      }
    }

    this.add.text(8, 8, 'World 1 -- Tutorial Meadow', { fontSize: '16px', color: '#ffffff' });
    this.add.text(8, 26, 'Arrow keys to move. Watch out for the tall grass.', {
      fontSize: '12px',
      color: '#cccccc',
    });

    const start = isoToScreen(this.playerTile.x, this.playerTile.y);
    this.player = makeChibiTrainer(this, COLORS.player);
    this.player.setPosition(start.x, start.y - ISO_TILE_H / 2);

    this.cursors = this.input.keyboard.createCursorKeys();

    const state = this.game.registry;
    if (!state.get('playerHp')) {
      state.set('playerHp', PLAYER_MATERIAL.maxHp);
    }
  }

  update() {
    if (this.moving) return;

    let dx = 0;
    let dy = 0;
    if (this.cursors.left.isDown) dx = -1;
    else if (this.cursors.right.isDown) dx = 1;
    else if (this.cursors.up.isDown) dy = -1;
    else if (this.cursors.down.isDown) dy = 1;

    if (dx === 0 && dy === 0) return;

    const nx = Phaser.Math.Clamp(this.playerTile.x + dx, 0, GRID_W - 1);
    const ny = Phaser.Math.Clamp(this.playerTile.y + dy, 0, GRID_H - 1);
    if (nx === this.playerTile.x && ny === this.playerTile.y) return;

    this.moving = true;
    this.playerTile = { x: nx, y: ny };

    const dest = isoToScreen(nx, ny);
    this.tweens.add({
      targets: this.player,
      x: dest.x,
      y: dest.y - ISO_TILE_H / 2,
      duration: 140,
      onComplete: () => {
        this.moving = false;
        this.maybeTriggerEncounter(nx, ny);
      },
    });
  }

  maybeTriggerEncounter(x, y) {
    const onTallGrass = this.grassMap && this.grassMap[y][x];
    if (onTallGrass && Math.random() < 0.2) {
      const wild = Phaser.Utils.Array.GetRandom(WILD_POOL);
      this.scene.start('Battle', { wild });
    }
  }
}

class BattleScene extends Phaser.Scene {
  constructor() {
    super('Battle');
  }

  init(data) {
    this.wild = data.wild;
  }

  create() {
    this.drawBackground();

    this.playerHp = this.game.registry.get('playerHp') || PLAYER_MATERIAL.maxHp;
    this.opponentHp = this.wild.maxHp;
    this.turnLock = false;

    // Opponent (top-right)
    this.add.text(400, 48, this.wild.name, {
      fontSize: '14px',
      color: '#ffffff',
      backgroundColor: 'rgba(0,0,0,0.35)',
      padding: { x: 4, y: 2 },
    });
    this.add.rectangle(400, 70, 104, 12, 0x222222, 0.55).setOrigin(0, 0.5);
    this.opponentHpBar = this.add.rectangle(400, 70, 100, 8, 0x33cc33).setOrigin(0, 0.5);

    const opponentCrystal = makeCrystal(this, 50, this.wild.color, this.wild.variant);
    opponentCrystal.setPosition(460, 150);
    this.bobCrystal(opponentCrystal, 150);

    // Player (bottom-left)
    const playerCrystal = makeCrystal(this, 55, PLAYER_MATERIAL.color, PLAYER_MATERIAL.variant);
    playerCrystal.setPosition(180, 345);
    this.bobCrystal(playerCrystal, 345);

    this.add.text(130, 403, PLAYER_MATERIAL.name, {
      fontSize: '14px',
      color: '#ffffff',
      backgroundColor: 'rgba(0,0,0,0.35)',
      padding: { x: 4, y: 2 },
    });
    this.add.rectangle(130, 425, 104, 12, 0x222222, 0.55).setOrigin(0, 0.5);
    this.playerHpBar = this.add.rectangle(130, 425, 100, 8, 0x33cc33).setOrigin(0, 0.5);

    this.logText = this.add.text(20, 440, `A wild ${this.wild.name} appeared!`, {
      fontSize: '14px',
      color: '#ffffff',
      backgroundColor: 'rgba(0,0,0,0.45)',
      padding: { x: 8, y: 6 },
      wordWrap: { width: 600 },
    });

    this.buttons = [];
    PLAYER_MATERIAL.moves.forEach((moveId, i) => {
      const move = MOVES[moveId];
      const btn = this.add
        .text(20 + i * 160, 210, `[ ${move.name} ]`, {
          fontSize: '14px',
          color: '#ffff88',
          backgroundColor: '#222244',
          padding: { x: 6, y: 4 },
        })
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.playerAttack(moveId));
      this.buttons.push(btn);
    });

    this.updateBars();
  }

  drawBackground() {
    const g = this.add.graphics();
    g.fillGradientStyle(0xbfe3ff, 0xbfe3ff, 0x8fc7ea, 0x8fc7ea, 1);
    g.fillRect(0, 0, 640, 260);
    g.fillGradientStyle(0x9fd88a, 0x9fd88a, 0x6fae5a, 0x6fae5a, 1);
    g.fillRect(0, 260, 640, 220);

    this.drawCloud(90, 40);
    this.drawCloud(230, 70);
    this.drawCloud(540, 35);

    this.add.ellipse(460, 195, 120, 28, 0x2f5a26, 0.35);
    this.add.ellipse(180, 392, 130, 30, 0x2f5a26, 0.35);
  }

  drawCloud(x, y) {
    const g = this.add.graphics();
    g.fillStyle(0xffffff, 0.85);
    g.fillEllipse(x, y, 46, 20);
    g.fillEllipse(x - 18, y + 4, 30, 16);
    g.fillEllipse(x + 18, y + 4, 30, 16);
  }

  bobCrystal(container, baseY) {
    this.tweens.add({
      targets: container,
      y: baseY - 6,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  updateBars() {
    this.opponentHpBar.width = Math.max(0, (this.opponentHp / this.wild.maxHp) * 100);
    this.playerHpBar.width = Math.max(0, (this.playerHp / PLAYER_MATERIAL.maxHp) * 100);
  }

  playerAttack(moveId) {
    if (this.turnLock) return;
    this.turnLock = true;

    const move = MOVES[moveId];
    const mult = effectiveness(move.class, this.wild.type);
    const dmg = Math.round(move.power * mult * Phaser.Math.FloatBetween(0.85, 1.15));
    this.opponentHp = Math.max(0, this.opponentHp - dmg);
    this.updateBars();

    const effText = mult > 1 ? ' It was super effective!' : mult < 1 ? ' It was not very effective...' : '';
    this.logText.setText(`You used ${move.name}! (${dmg} dmg)${effText}`);

    if (this.opponentHp <= 0) {
      this.endBattle(true);
      return;
    }

    this.time.delayedCall(700, () => this.opponentAttack());
  }

  opponentAttack() {
    const moveId = Phaser.Utils.Array.GetRandom(this.wild.moves);
    const move = MOVES[moveId];
    const mult = effectiveness(move.class, PLAYER_MATERIAL.type);
    const dmg = Math.round(move.power * mult * Phaser.Math.FloatBetween(0.85, 1.15));
    this.playerHp = Math.max(0, this.playerHp - dmg);
    this.updateBars();

    this.logText.setText(`Wild ${this.wild.name} used ${move.name}! (${dmg} dmg)`);
    this.game.registry.set('playerHp', this.playerHp);

    if (this.playerHp <= 0) {
      this.endBattle(false);
      return;
    }

    this.turnLock = false;
  }

  endBattle(won) {
    this.buttons.forEach((b) => b.destroy());
    this.logText.setText(
      (won ? `You defeated the ${this.wild.name}!` : `Your Free Fermion was overwhelmed...`) +
        '\nPress SPACE to return to the meadow.'
    );

    if (won) {
      this.game.registry.set('playerHp', this.playerHp);
    } else {
      this.game.registry.set('playerHp', PLAYER_MATERIAL.maxHp);
    }

    this.input.keyboard.once('keydown-SPACE', () => this.scene.start('Overworld'));
  }
}

const config = {
  type: Phaser.AUTO,
  width: 640,
  height: 480,
  parent: 'game',
  backgroundColor: '#111111',
  scene: [OverworldScene, BattleScene],
};

new Phaser.Game(config);
