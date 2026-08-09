import Phaser from 'phaser';
import { shade } from '../art/colors';
import { getBiome } from '../art/biomes';
import type { Biome } from '../art/biomes';
import { makeCrystal } from '../art/crystals';
import { makeToken } from '../art/tokens';
import { makeNoetherAvatar } from '../art/mentor';
import { playNoetherChime } from '../audio/sfx';
import { project, fogColor, HORIZON_Y, CANVAS_W, CANVAS_H, ProjectedPoint } from '../art/perspective';
import { PLAYER_MATERIAL, WORLD_NAMES, getWildPool, getRival, MOVES, SHOP_MOVE_IDS } from '../data/materials';
import { tokenColorForValue } from '../data/tokens';
import { getMaterialQuestion } from '../data/quiz';
import { encounterGreeting } from '../data/greetings';
import { persistFromRegistry } from '../data/save';
import type { DiscoveredMaterial } from '../data/save';
import type { Material, Move } from '../data/types';
import { generateWorldMap } from '../world/mapgen';
import type { GridPoint } from '../world/mapgen';
import { music } from '../audio/music';

// Snapshot of an in-progress map, stashed in the game registry so a round
// trip through BattleScene resumes exactly where the player left off instead
// of generating (and spawning onto) a brand new random map. Only cleared by
// an explicit world switch (Space), which is the one action meant to
// generate a fresh layout.
interface SavedMapState {
  world: number;
  playerTile: GridPoint;
  walkable: boolean[][];
  tokenTiles: number[][];
  encounterTiles: (Material | null)[][];
  flowerMap: boolean[][];
  goalTile: GridPoint;
  reachedGoal: boolean;
}

// Grid is deliberately fine-grained (many small tiles) rather than few large
// ones, so each arrow-key step moves the camera a small distance. TILE_SCALE
// shrinks every tile's footprint in world space; DRAW_DISTANCE_TILES and
// LANE_CLIP are widened by the inverse factor so the visible world (in
// screen terms) covers the same ground as before, just in smaller steps.
const GRID_W = 27;
const GRID_H = 50;
const TILE_SCALE = 0.6;
const LANE_CLIP = 8.5;
const DRAW_DISTANCE_TILES = 15;
const CRYSTAL_SIZE = 22;
const TOKEN_SIZE = 26;
const PLAYER_CRYSTAL_SIZE = 34;
const ENCOUNTER_CHANCE = 0.12;
const WALL_HEIGHT_PX = 30;
const QUIZ_CORRECT_MULTIPLIER = 1.5;
const QUIZ_WRONG_MULTIPLIER = 0.6;

// Worlds with a built overworld map -- Space cycles between these for
// testing, since only worlds 1 and 2 exist so far (see DESIGN.md roadmap).
const TESTABLE_WORLDS = [1, 2];

function shopCost(move: Move): number {
  return move.power * 5;
}

interface OverworldInitData {
  world?: number;
  regenerate?: boolean;
}

interface WorldSprite {
  x: number;
  y: number;
  size: number;
  container: Phaser.GameObjects.Container;
  label?: Phaser.GameObjects.Text;
  seed: number;
}

export class OverworldScene extends Phaser.Scene {
  private world = 1;
  private regenerate = false;
  private biome: Biome = getBiome(1);
  private moving = false;
  private playerTile = { x: 0, y: 0 };
  // Camera position tweens smoothly toward playerTile every move, giving a
  // continuous "world flows past a fixed camera" feel instead of a snap-cut
  // between grid cells.
  private camPos = { x: 0, y: 0 };
  private walkable: boolean[][] = [];
  private encounterTiles: (Material | null)[][] = [];
  private tokenTiles: number[][] = [];
  private flowerMap: boolean[][] = [];
  private goalTile: GridPoint = { x: 0, y: 0 };
  private reachedGoal = false;
  private qumatokens = 0;
  private crystalSprites: (WorldSprite & { material: Material })[] = [];
  private tokenSprites: WorldSprite[] = [];
  // 0 or 1 entries -- reuses the same WorldSprite projection/wander/bob
  // machinery as crystals and tokens (spawnNoetherSprite) so she's a visible,
  // wandering landmark standing at the goal tile rather than only appearing
  // once the player triggers her shop dialogue.
  private noetherSprites: WorldSprite[] = [];
  private worldGfx!: Phaser.GameObjects.Graphics;
  private player!: Phaser.GameObjects.Container;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private tokenText!: Phaser.GameObjects.Text;
  private goalText!: Phaser.GameObjects.Text;
  private dialogueActive = false;
  private dialogueContainer?: Phaser.GameObjects.Container;

  constructor() {
    super('Overworld');
  }

  init(data: OverworldInitData) {
    this.world = data?.world ?? 1;
    this.regenerate = data?.regenerate ?? false;
  }

  create() {
    this.moving = false;
    this.biome = getBiome(this.world);

    const state = this.game.registry;
    const saved = state.get('mapState') as SavedMapState | undefined;

    if (saved && saved.world === this.world && !this.regenerate) {
      this.restoreMap(saved);
    } else {
      this.generateMap();
    }
    this.camPos = { x: this.playerTile.x, y: this.playerTile.y };

    this.drawSky();
    this.worldGfx = this.add.graphics();
    this.spawnCrystalSprites();
    this.spawnTokenSprites();
    this.spawnNoetherSprite();
    music.play('overworld');

    this.qumatokens = (state.get('qumatokens') as number) || 0;

    const worldName = WORLD_NAMES[this.world] ?? `World ${this.world}`;
    this.add
      .text(8, 8, `World ${this.world} -- ${worldName}`, {
        fontSize: '16px',
        color: '#ffffff',
        backgroundColor: 'rgba(0,0,0,0.35)',
        padding: { x: 4, y: 2 },
      })
      .setDepth(50);
    this.add
      .text(8, 30, 'Up/Down: walk the path forward/back. Left/Right: step sideways.', {
        fontSize: '12px',
        color: '#eeeeee',
        backgroundColor: 'rgba(0,0,0,0.35)',
        padding: { x: 4, y: 2 },
      })
      .setDepth(50);
    this.add
      .text(8, 52, 'M: mute/unmute music. H: return to the Lab. Space: switch world (testing, skips gates).', {
        fontSize: '12px',
        color: '#eeeeee',
        backgroundColor: 'rgba(0,0,0,0.35)',
        padding: { x: 4, y: 2 },
      })
      .setDepth(50);
    this.tokenText = this.add
      .text(CANVAS_W - 8, 8, `Qumatokens: ${this.qumatokens}`, {
        fontSize: '14px',
        color: '#ffe066',
        backgroundColor: 'rgba(0,0,0,0.35)',
        padding: { x: 4, y: 2 },
      })
      .setOrigin(1, 0)
      .setDepth(50);
    this.goalText = this.add
      .text(CANVAS_W / 2, 90, 'You reached the far edge of this world!', {
        fontSize: '14px',
        color: '#ffffff',
        backgroundColor: 'rgba(0,0,0,0.5)',
        padding: { x: 6, y: 4 },
      })
      .setOrigin(0.5, 0)
      .setDepth(50)
      .setVisible(this.reachedGoal);

    // The player is a crystal too, not a trainer commanding one -- the
    // overworld avatar is just PLAYER_MATERIAL rendered the same way a wild
    // crystal is, floating and bobbing rather than walking.
    this.player = this.add.container(CANVAS_W / 2, 400);
    const playerShadow = this.add.ellipse(0, 34, 34, 11, 0x000000, 0.28);
    const playerCrystal = makeCrystal(this, PLAYER_CRYSTAL_SIZE, PLAYER_MATERIAL.color, PLAYER_MATERIAL.variant);
    this.player.add([playerShadow, playerCrystal]);
    this.player.setDepth(40);
    this.idleBob();

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.input.keyboard!.on('keydown-M', () => music.toggleMute());
    this.input.keyboard!.on('keydown-SPACE', () => this.switchWorld());
    this.input.keyboard!.on('keydown-H', () => this.scene.start('Hub'));

    // Defensive fallback only -- TitleScene normally seeds all of these
    // from localStorage (data/save.ts) before Overworld ever runs. Only
    // relevant if this scene is ever launched directly (ad hoc dev testing).
    if (state.get('qumatokens') === undefined) {
      state.set('qumatokens', 0);
      state.set('unlockedMoves', [...PLAYER_MATERIAL.moves]);
      state.set('playerHp', PLAYER_MATERIAL.maxHp);
      state.set('rivalDefeated', {});
      state.set('discoveredMaterials', []);
    }

    this.maybeAutoOpenGoalDialogue();
  }

  private switchWorld() {
    const idx = TESTABLE_WORLDS.indexOf(this.world);
    const next = TESTABLE_WORLDS[(idx + 1) % TESTABLE_WORLDS.length];
    this.scene.restart({ world: next, regenerate: true });
  }

  // Fresh random layout -- used on first load and whenever the player
  // explicitly switches worlds (Space), which is the one action meant to
  // reshuffle the map.
  private generateMap() {
    this.reachedGoal = false;
    this.playerTile = { x: Math.floor(GRID_W / 2), y: GRID_H - 5 };

    const wildPool = getWildPool(this.world);
    const map = generateWorldMap(GRID_W, GRID_H, this.playerTile);
    this.walkable = map.walkable;
    this.tokenTiles = map.tokens;
    this.goalTile = map.goal;

    this.encounterTiles = Array.from({ length: GRID_H }, () => Array(GRID_W).fill(null));
    this.flowerMap = Array.from({ length: GRID_H }, () => Array(GRID_W).fill(false));
    this.crystalSprites = [];
    this.tokenSprites = [];

    // Decoration (flowers / crystal glints) lives in the off-path terrain
    // beside the trail, not on the walkable tiles themselves.
    for (let y = 0; y < GRID_H; y++) {
      for (let x = 0; x < GRID_W; x++) {
        if (!this.walkable[y][x]) {
          this.flowerMap[y][x] = Math.random() < 0.16;
        }
      }
    }

    // One wild encounter roll per corridor row (not per tile) so encounter
    // density stays roughly constant regardless of how wide the corridor
    // is -- placed at a random column within that row's walkable band.
    map.rows.forEach((r) => {
      if (r.y === this.playerTile.y) return; // never spawn right on the player
      if (wildPool.length === 0 || Math.random() >= ENCOUNTER_CHANCE) return;
      const x = r.left + Math.floor(Math.random() * (r.right - r.left + 1));
      if (this.tokenTiles[r.y][x]) return;
      this.encounterTiles[r.y][x] = Phaser.Utils.Array.GetRandom(wildPool);
    });
  }

  // Round trip through BattleScene resumes here -- restores the exact
  // layout and player position saveMapState() captured right before the
  // battle started, instead of rolling a brand new map.
  private restoreMap(saved: SavedMapState) {
    this.playerTile = { ...saved.playerTile };
    this.walkable = saved.walkable;
    this.tokenTiles = saved.tokenTiles;
    this.encounterTiles = saved.encounterTiles;
    this.flowerMap = saved.flowerMap;
    this.goalTile = saved.goalTile;
    this.reachedGoal = saved.reachedGoal;
    this.crystalSprites = [];
    this.tokenSprites = [];
  }

  private saveMapState() {
    const saved: SavedMapState = {
      world: this.world,
      playerTile: { ...this.playerTile },
      walkable: this.walkable,
      tokenTiles: this.tokenTiles,
      encounterTiles: this.encounterTiles,
      flowerMap: this.flowerMap,
      goalTile: this.goalTile,
      reachedGoal: this.reachedGoal,
    };
    this.game.registry.set('mapState', saved);
  }

  private drawSky() {
    const g = this.add.graphics();
    g.fillGradientStyle(this.biome.skyTop, this.biome.skyTop, this.biome.skyBottom, this.biome.skyBottom, 1);
    g.fillRect(0, 0, CANVAS_W, HORIZON_Y);

    // Base ground haze fill so the far distance (beyond where individual
    // grid tiles are drawn) and the strip either side of the path still
    // read as ground, not void.
    g.fillStyle(fogColor(this.biome.ground, 1, this.biome.fogTarget), 1);
    g.fillRect(0, HORIZON_Y, CANVAS_W, CANVAS_H - HORIZON_Y);

    g.fillStyle(this.biome.hillColor, this.biome.hillAlpha);
    g.beginPath();
    g.moveTo(0, HORIZON_Y);
    for (let x = 0; x <= CANVAS_W; x += 32) {
      g.lineTo(x, HORIZON_Y - 20 - Math.sin(x * 0.012) * 12 - Math.sin(x * 0.035) * 6);
    }
    g.lineTo(CANVAS_W, HORIZON_Y);
    g.closePath();
    g.fillPath();

    if (this.biome.clouds) {
      [
        [90, 40],
        [230, 65],
        [400, 50],
        [530, 32],
      ].forEach(([x, y]) => this.drawCloud(x, y));
    }
  }

  private drawCloud(x: number, y: number) {
    const g = this.add.graphics();
    g.fillStyle(0xffffff, 0.85);
    g.fillEllipse(x, y, 50, 20);
    g.fillEllipse(x - 20, y + 5, 32, 16);
    g.fillEllipse(x + 20, y + 5, 32, 16);
  }

  private idleBob() {
    this.tweens.add({
      targets: this.player,
      y: '+=4',
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  update() {
    this.drawWorld();
    this.updateWorldSprites(this.crystalSprites);
    this.updateWorldSprites(this.tokenSprites);
    this.updateWorldSprites(this.noetherSprites);

    if (this.moving || this.dialogueActive) return;

    let dx = 0;
    let dy = 0;
    if (this.cursors.left.isDown) dx = -1;
    else if (this.cursors.right.isDown) dx = 1;
    else if (this.cursors.up.isDown) dy = -1;
    else if (this.cursors.down.isDown) dy = 1;

    this.tryMove(dx, dy);
  }

  private tryMove(dx: number, dy: number) {
    if (dx === 0 && dy === 0) return;

    const nx = Phaser.Math.Clamp(this.playerTile.x + dx, 0, GRID_W - 1);
    const ny = Phaser.Math.Clamp(this.playerTile.y + dy, 0, GRID_H - 1);
    if (nx === this.playerTile.x && ny === this.playerTile.y) return;
    if (!this.walkable[ny]?.[nx]) return;

    this.moving = true;
    this.playerTile = { x: nx, y: ny };

    this.tweens.add({
      targets: this.camPos,
      x: nx,
      y: ny,
      duration: 220,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        this.moving = false;
        this.maybeTriggerEncounter(nx, ny);
        this.maybeCollectToken(nx, ny);
        this.maybeReachGoal(nx, ny);
      },
    });

    this.stepBounce(dx);
  }

  private stepBounce(dx: number) {
    this.tweens.add({ targets: this.player, scaleY: 0.9, duration: 110, yoyo: true });
    if (dx !== 0) {
      this.tweens.add({ targets: this.player, angle: dx * 6, duration: 110, yoyo: true });
    }
  }

  // Tile lanes/depths are defined in grid-index units; every projection goes
  // through here so the world-space size of a tile (TILE_SCALE) is applied
  // consistently for both the ground mesh and the crystal sprites.
  private projectTile(lane: number, depth: number): ProjectedPoint {
    return project(lane * TILE_SCALE, depth * TILE_SCALE);
  }

  // Redrawn every frame from the current (possibly mid-tween) camera
  // position -- cheap at this grid size and what makes the world scroll
  // continuously rather than snapping tile-by-tile.
  private drawWorld() {
    const g = this.worldGfx;
    g.clear();

    const camX = this.camPos.x;
    const camY = this.camPos.y;
    const minY = Math.max(0, Math.floor(camY - DRAW_DISTANCE_TILES));
    const maxY = Math.min(GRID_H - 1, Math.floor(camY) + 1);

    for (let y = minY; y <= maxY; y++) {
      for (let x = 0; x < GRID_W; x++) {
        const laneL = x - camX - 0.5;
        const laneR = x - camX + 0.5;
        if (laneL > LANE_CLIP || laneR < -LANE_CLIP) continue;

        const depthFar = camY - y + 0.5;
        const depthNear = camY - y - 0.5;
        if (depthFar <= 0) continue;

        const pFL = this.projectTile(laneL, depthFar);
        const pFR = this.projectTile(laneR, depthFar);
        const pNR = this.projectTile(laneR, depthNear);
        const pNL = this.projectTile(laneL, depthNear);

        const depthRatio = Phaser.Math.Clamp(depthFar / DRAW_DISTANCE_TILES, 0, 1);
        const walkable = !!this.walkable[y]?.[x];
        const base = walkable ? this.biome.path : this.biome.ground;
        const color = fogColor(base, depthRatio, this.biome.fogTarget);

        g.fillStyle(color, 1);
        g.fillPoints([pFL, pFR, pNR, pNL], true);
        g.lineStyle(1, shade(color, -20), 0.3);
        g.strokePoints([pFL, pFR, pNR, pNL], true);

        if (!walkable) {
          this.drawWallFaces(g, x, y, pFL, pFR, pNR, pNL, color);
        } else if (depthRatio < 0.75 && this.flowerMap[y]?.[x]) {
          this.decorateTile(g, pFL, pFR, pNR, pNL);
        }
      }
    }
  }

  // Off-path tiles read as raised, solid blocks rather than just
  // differently-colored flat ground -- for every edge a wall tile shares
  // with a walkable neighbor, extrude a vertical face there (cheap
  // screen-space trick: shift the far end of the edge up by a fixed pixel
  // height scaled by that point's own perspective scale). Each face gets a
  // lit rim along its top edge and a darker mortar line partway up, so it
  // reads as a stacked stone block rather than a flat colored card.
  private drawWallFaces(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    pFL: ProjectedPoint,
    pFR: ProjectedPoint,
    pNR: ProjectedPoint,
    pNL: ProjectedPoint,
    topColor: number
  ) {
    const raise = (p: ProjectedPoint): ProjectedPoint => ({ ...p, y: p.y - WALL_HEIGHT_PX * p.scale });
    const lerp = (a: ProjectedPoint, b: ProjectedPoint, t: number) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    const face = (a: ProjectedPoint, b: ProjectedPoint, shadeAmount: number) => {
      const topA = raise(a);
      const topB = raise(b);

      g.fillStyle(shade(topColor, shadeAmount), 1);
      g.fillPoints([a, b, topB, topA], true);

      // Mortar line partway up the block for a bit of stacked-stone texture.
      const midA = lerp(a, topA, 0.5);
      const midB = lerp(b, topB, 0.5);
      g.lineStyle(1, shade(topColor, shadeAmount - 20), 0.55);
      g.lineBetween(midA.x, midA.y, midB.x, midB.y);

      g.lineStyle(1, shade(topColor, shadeAmount - 12), 0.4);
      g.strokePoints([a, b, topB, topA], true);

      // Bright rim along the top edge, as if lit from above.
      g.lineStyle(2, shade(topColor, shadeAmount + 55), 0.85);
      g.lineBetween(topA.x, topA.y, topB.x, topB.y);
    };

    if (this.walkable[y + 1]?.[x]) face(pNL, pNR, -18); // near edge, facing the camera
    if (this.walkable[y - 1]?.[x]) face(pFR, pFL, -42); // far edge
    if (this.walkable[y]?.[x - 1]) face(pFL, pNL, -28); // left edge
    if (this.walkable[y]?.[x + 1]) face(pNR, pFR, -28); // right edge
  }

  private decorateTile(
    g: Phaser.GameObjects.Graphics,
    pFL: { x: number; y: number },
    pFR: { x: number; y: number },
    pNR: { x: number; y: number },
    pNL: { x: number; y: number; scale: number }
  ) {
    const cx = (pFL.x + pFR.x + pNR.x + pNL.x) / 4;
    const cy = (pFL.y + pFR.y + pNR.y + pNL.y) / 4;
    const s = pNL.scale;

    if (this.biome.decoration === 'crystalGlints') {
      g.fillStyle(0x8fe8ff, 0.85);
      [0, 1, 2].forEach((i) => {
        const ang = (i * Math.PI * 2) / 3 - Math.PI / 2;
        g.fillCircle(cx + Math.cos(ang) * 2 * s, cy + Math.sin(ang) * 1.4 * s, 1.4 * s);
      });
      g.fillStyle(0xffffff, 0.9);
      g.fillCircle(cx, cy, 1 * s);
      return;
    }

    g.fillStyle(0xffffff, 0.9);
    [0, 1, 2, 3].forEach((i) => {
      const ang = (i * Math.PI) / 2;
      g.fillCircle(cx + Math.cos(ang) * 2.4 * s, cy + Math.sin(ang) * 1.6 * s, 1.8 * s);
    });
    g.fillStyle(0xffdd55, 1);
    g.fillCircle(cx, cy, 1.3 * s);
  }

  // One Container(+Text) per encounter/token tile, created once and
  // repositioned every frame in updateWorldSprites() -- unlike the ground (a
  // single Graphics mesh cheaply rebuilt from scratch each frame), a crystal
  // is a handful of shaded shapes plus sparkle tweens, too costly to
  // recreate every frame.
  private spawnCrystalSprites() {
    for (let y = 0; y < GRID_H; y++) {
      for (let x = 0; x < GRID_W; x++) {
        const material = this.encounterTiles[y]?.[x];
        if (!material) continue;

        const container = makeCrystal(this, CRYSTAL_SIZE, material.color, material.variant);
        container.setDepth(20);

        const label = this.add
          .text(0, 0, material.name, {
            fontSize: '11px',
            color: '#ffffff',
            backgroundColor: 'rgba(0,0,0,0.45)',
            padding: { x: 3, y: 1 },
          })
          .setOrigin(0.5, 1)
          .setDepth(21);

        this.crystalSprites.push({
          x,
          y,
          size: CRYSTAL_SIZE,
          material,
          container,
          label,
          seed: Math.random() * Math.PI * 2,
        });
      }
    }
  }

  // Qumatoken pickups live only at the dead end of branches -- shiny little
  // clouds (see art/tokens.ts), colored and labeled by value (1/5/10) so the
  // payout reads at a glance before the player walks all the way out there.
  private spawnTokenSprites() {
    for (let y = 0; y < GRID_H; y++) {
      for (let x = 0; x < GRID_W; x++) {
        const value = this.tokenTiles[y]?.[x];
        if (!value) continue;

        const container = makeToken(this, TOKEN_SIZE, tokenColorForValue(value));
        container.setDepth(19);

        const label = this.add
          .text(0, 0, `+${value}`, {
            fontSize: '12px',
            color: '#ffffff',
            backgroundColor: 'rgba(0,0,0,0.45)',
            padding: { x: 3, y: 1 },
          })
          .setOrigin(0.5, 1)
          .setDepth(20);

        this.tokenSprites.push({ x, y, size: TOKEN_SIZE, container, label, seed: Math.random() * Math.PI * 2 });
      }
    }
  }

  // Noether stands (floats) at world 1's goal tile as a visible landmark,
  // not just something that materializes once the shop dialogue opens --
  // the player sees and walks up to her, the same way a wild encounter is
  // seen coming rather than sprung from nowhere. Reuses the crystal/token
  // WorldSprite machinery (projection, wander, bob) so she scrolls and
  // fades with the rest of the world for free. World 1 only, matching
  // showNoetherShop's own "only world 1 has a mentor waiting" scope.
  private spawnNoetherSprite() {
    this.noetherSprites = [];
    if (this.world !== 1) return;

    const avatar = makeNoetherAvatar(this, 1.1);
    avatar.setDepth(20);

    const label = this.add
      .text(0, 0, 'Noether', {
        fontSize: '11px',
        color: '#ffe066',
        backgroundColor: 'rgba(0,0,0,0.45)',
        padding: { x: 3, y: 1 },
      })
      .setOrigin(0.5, 1)
      .setDepth(21);

    this.noetherSprites.push({
      x: this.goalTile.x,
      y: this.goalTile.y,
      size: 42,
      container: avatar,
      label,
      seed: Math.random() * Math.PI * 2,
    });
  }

  // Wanders each sprite a little around its home tile (small sinusoidal
  // drift + bob) rather than leaving it pinned dead-center, so tiles read as
  // living/glinting things instead of static map decoration. Shared by both
  // wild-encounter crystals and qumatoken pickups.
  private updateWorldSprites(sprites: WorldSprite[]) {
    const camX = this.camPos.x;
    const camY = this.camPos.y;
    const t = this.time.now;

    for (const c of sprites) {
      const wanderLane = Math.sin(t * 0.0012 + c.seed) * 0.18;
      const wanderDepth = Math.cos(t * 0.0009 + c.seed * 1.7) * 0.12;

      const lane = c.x - camX + wanderLane;
      const depth = camY - c.y + 0.5 + wanderDepth;
      const laneL = lane - 0.5;
      const laneR = lane + 0.5;

      const visible = depth > 0.15 && laneL <= LANE_CLIP && laneR >= -LANE_CLIP && depth / DRAW_DISTANCE_TILES < 0.75;
      c.container.setVisible(visible);
      c.label?.setVisible(visible);
      if (!visible) continue;

      const p = this.projectTile(lane, depth);
      const bob = Math.sin(t * 0.004 + c.seed * 2.3) * 3 * p.scale;

      c.container.setPosition(p.x, p.y + bob);
      c.container.setScale(p.scale);
      c.label?.setPosition(p.x, p.y + bob - c.size * p.scale - 4);
      c.label?.setScale(p.scale);
    }
  }

  private maybeTriggerEncounter(x: number, y: number) {
    const material = this.encounterTiles[y]?.[x];
    if (!material) return;

    this.encounterTiles[y][x] = null;
    const spriteIndex = this.crystalSprites.findIndex((c) => c.x === x && c.y === y);
    if (spriteIndex !== -1) {
      const [sprite] = this.crystalSprites.splice(spriteIndex, 1);
      sprite.container.destroy();
      sprite.label?.destroy();
    }

    this.recordDiscovery(material);

    // Saved now (tile already cleared) so that if the player fights, the
    // round trip through BattleScene resumes with this encounter gone.
    // "Let me pass" never triggers a scene change at all, so it doesn't
    // need this snapshot, but saving unconditionally is simplest.
    this.saveMapState();
    this.showEncounter(material);
  }

  // Adds a wild material to the Materialdex the Hub scene reads from, the
  // first time it's ever encountered (not per-battle) -- rival crystals
  // aren't real compounds, so they're never recorded here.
  private recordDiscovery(material: Material) {
    const discovered = (this.game.registry.get('discoveredMaterials') as DiscoveredMaterial[]) ?? [];
    if (discovered.some((m) => m.name === material.name)) return;
    this.game.registry.set('discoveredMaterials', [...discovered, { name: material.name, type: material.type }]);
    persistFromRegistry(this.game.registry);
  }

  // In-map dialogue for a wild encounter: one screen with the greeting and
  // (for materials with a quiz entry) the physics question together, or
  // straight to a fight/pass choice if there's no question yet. Deliberately
  // an overlay inside this scene rather than a separate scene -- asking a
  // question shouldn't feel like leaving the map.
  private showEncounter(material: Material) {
    this.dialogueActive = true;

    const panelY = 300;
    const container = this.add.container(0, 0).setDepth(100);
    this.dialogueContainer = container;

    const panel = this.add.rectangle(CANVAS_W / 2, panelY, 600, 300, 0x10101c, 0.94).setStrokeStyle(2, 0x444466);
    container.add(panel);

    const crystal = makeCrystal(this, 30, material.color, material.variant);
    crystal.setPosition(CANVAS_W / 2, panelY - 128);
    container.add(crystal);
    this.tweens.add({ targets: crystal, y: panelY - 120, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    const greeting = this.add
      .text(CANVAS_W / 2, panelY - 92, encounterGreeting(material), {
        fontSize: '12px',
        fontStyle: 'italic',
        color: '#cfd8ff',
        align: 'center',
        wordWrap: { width: 520 },
      })
      .setOrigin(0.5, 0);
    container.add(greeting);

    const question = getMaterialQuestion(material.name);
    if (question) {
      const prompt = this.add
        .text(CANVAS_W / 2, panelY - 52, question.prompt, {
          fontSize: '13px',
          color: '#ffe066',
          align: 'center',
          wordWrap: { width: 520 },
        })
        .setOrigin(0.5, 0);
      container.add(prompt);

      const options = Phaser.Utils.Array.Shuffle([
        { text: question.correct, correct: true },
        { text: question.incorrect, correct: false },
      ]);

      this.addDialogueButton(container, panelY + 4, options[0].text, () =>
        this.startBattle(material, options[0].correct ? QUIZ_CORRECT_MULTIPLIER : QUIZ_WRONG_MULTIPLIER)
      );
      this.addDialogueButton(container, panelY + 48, options[1].text, () =>
        this.startBattle(material, options[1].correct ? QUIZ_CORRECT_MULTIPLIER : QUIZ_WRONG_MULTIPLIER)
      );
      this.addDialogueButton(container, panelY + 100, 'Let me pass', () => this.closeDialogue());
    } else {
      this.addDialogueButton(container, panelY - 20, 'Fight!', () => this.startBattle(material, 1));
      this.addDialogueButton(container, panelY + 24, 'Let me pass', () => this.closeDialogue());
    }
  }

  private addDialogueButton(container: Phaser.GameObjects.Container, y: number, label: string, onClick: () => void) {
    return this.addDialogueButtonAt(container, CANVAS_W / 2, y, label, onClick, 480);
  }

  // Underlies addDialogueButton -- broken out so a footer row can place two
  // buttons side by side (Noether's "Farewell" / "Continue to World 2")
  // instead of stacking them, which would otherwise push the panel past the
  // bottom of the canvas.
  private addDialogueButtonAt(
    container: Phaser.GameObjects.Container,
    x: number,
    y: number,
    label: string,
    onClick: () => void,
    wrapWidth = 230
  ) {
    const btn = this.add
      .text(x, y, label, {
        fontSize: '13px',
        color: '#ffff88',
        backgroundColor: '#222244',
        padding: { x: 10, y: 5 },
        align: 'center',
        wordWrap: { width: wrapWidth },
      })
      .setOrigin(0.5, 0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', onClick);
    container.add(btn);
    return btn;
  }

  private startBattle(material: Material, attackMultiplier: number, isRival = false) {
    this.closeDialogue();
    this.scene.start('Battle', { wild: material, world: this.world, attackMultiplier, isRival });
  }

  // Closes whatever dialogue panel is open (wild encounter, the rival gate,
  // or Noether's shop) and lets the player carry on -- no scene change
  // either way.
  private closeDialogue() {
    this.dialogueContainer?.destroy(true);
    this.dialogueContainer = undefined;
    this.dialogueActive = false;
  }

  private isRivalDefeated(): boolean {
    const rivalDefeated = (this.game.registry.get('rivalDefeated') as Record<number, boolean>) ?? {};
    return !!rivalDefeated[this.world];
  }

  // Reopens Noether's shop every time this scene is (re)created with the
  // goal already reached -- both right after first stepping onto the goal
  // row and after any later round trip through BattleScene (a wild fight
  // fought near the goal, or the rival fight itself resolving). Keeps the
  // shop revisitable across multiple battles instead of a single one-shot
  // popup. Noether is reachable regardless of the rival gate -- gating her
  // shop behind the rival fight would strand the player needing bought
  // moves to beat a rival they can't reach Noether to prepare for; instead
  // the rival fight is what "Continue to World 2" triggers (see
  // tryAdvanceToWorld2), so the player can shop first, then fight, on their
  // own schedule.
  private maybeAutoOpenGoalDialogue() {
    if (this.world !== 1 || !this.reachedGoal || this.dialogueActive) return;
    this.showNoetherShop();
  }

  private tryAdvanceToWorld2() {
    if (this.isRivalDefeated()) {
      this.advanceToWorld(2);
      return;
    }
    this.closeDialogue();
    this.showRivalEncounter();
  }

  // The "beat the first rival crystal" gate DESIGN.md's world table lists
  // for world 1 -- triggered by "Continue to World 2" rather than
  // automatically on reaching the goal, so the player can shop with
  // Noether first. Same in-map dialogue pattern as a wild encounter, but
  // with no "let me pass" option, since a gate that can be skipped isn't
  // a gate.
  private showRivalEncounter() {
    const rival = getRival(this.world);
    if (!rival) {
      // Safety net for a world with no WORLD_RIVALS entry yet -- don't
      // strand the player behind a gate that can't open.
      this.showNoetherShop();
      return;
    }

    this.dialogueActive = true;

    const panelY = 300;
    const container = this.add.container(0, 0).setDepth(100);
    this.dialogueContainer = container;

    const panel = this.add.rectangle(CANVAS_W / 2, panelY, 600, 260, 0x10101c, 0.94).setStrokeStyle(2, 0xff6666);
    container.add(panel);

    const crystal = makeCrystal(this, 34, rival.color, rival.variant);
    crystal.setPosition(CANVAS_W / 2, panelY - 96);
    container.add(crystal);
    this.tweens.add({ targets: crystal, y: panelY - 86, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    const line = this.add
      .text(CANVAS_W / 2, panelY - 56, `${rival.name} blocks the path onward. "You don't get past me that easily."`, {
        fontSize: '12px',
        fontStyle: 'italic',
        color: '#ffb3b3',
        align: 'center',
        wordWrap: { width: 520 },
      })
      .setOrigin(0.5, 0);
    container.add(line);

    this.addDialogueButton(container, panelY - 4, 'Battle!', () => this.startBattle(rival, 1, true));
  }

  // Noether appears once the player beats world 1's rival, selling the
  // other early moves for qumatokens. Same in-map dialogue pattern as a wild
  // encounter, but with a mentor avatar and a shop list instead of a fight.
  private showNoetherShop() {
    this.dialogueActive = true;

    const panelY = 300;
    const container = this.add.container(0, 0).setDepth(100);
    this.dialogueContainer = container;

    const panel = this.add.rectangle(CANVAS_W / 2, panelY, 600, 340, 0x10101c, 0.94).setStrokeStyle(2, 0xffe066);
    container.add(panel);

    const avatar = makeNoetherAvatar(this);
    avatar.setPosition(CANVAS_W / 2, panelY - 105);
    container.add(avatar);
    this.tweens.add({ targets: avatar, y: panelY - 97, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    playNoetherChime();

    const intro = this.add
      .text(
        CANVAS_W / 2,
        panelY - 68,
        '"I am Noether. Every symmetry hides a conservation law -- and your qumatokens conserve rather well spent on new attacks."',
        { fontSize: '12px', fontStyle: 'italic', color: '#cfd8ff', align: 'center', wordWrap: { width: 520 } }
      )
      .setOrigin(0.5, 0);
    container.add(intro);

    this.renderShopMoves(container, panelY);
  }

  private renderShopMoves(container: Phaser.GameObjects.Container, panelY: number) {
    const unlocked = this.getUnlockedMoves();
    const forSale = SHOP_MOVE_IDS.filter((id) => !unlocked.includes(id));
    const tokens = (this.game.registry.get('qumatokens') as number) || 0;

    if (forSale.length === 0) {
      const text = this.add
        .text(CANVAS_W / 2, panelY - 20, "You've learned everything I can teach you here.", {
          fontSize: '13px',
          color: '#ffffff',
        })
        .setOrigin(0.5, 0);
      container.add(text);
    } else {
      forSale.forEach((id, i) => {
        const move = MOVES[id];
        const cost = shopCost(move);
        const affordable = tokens >= cost;
        const btn = this.addDialogueButton(container, panelY - 20 + i * 44, `${move.name} -- ${cost} qumatokens`, () => {
          if ((this.game.registry.get('qumatokens') as number) < cost) return;
          this.qumatokens -= cost;
          this.game.registry.set('qumatokens', this.qumatokens);
          this.tokenText.setText(`Qumatokens: ${this.qumatokens}`);
          this.game.registry.set('unlockedMoves', [...this.getUnlockedMoves(), id]);
          persistFromRegistry(this.game.registry);
          // Rebuild the whole panel so the purchased move disappears from
          // the list and the token total on display stays correct.
          this.dialogueContainer?.destroy(true);
          this.showNoetherShop();
        });
        if (!affordable) btn.setAlpha(0.5);
      });
    }

    // Fixed footer row (not stacked below the variable-length shop list) so
    // it never runs off the panel/canvas regardless of how many moves are
    // still for sale. This is the real, discoverable way to advance -- Space
    // is a dev-only shortcut that skips the rival gate entirely. The label
    // itself tells the player what will happen: fight the rival first, then
    // (once it's beaten) actually leave for world 2.
    const footerY = panelY + 120;
    const nextLabel = this.isRivalDefeated() ? 'Continue to World 2 ->' : 'Face the Rival ->';
    this.addDialogueButtonAt(container, CANVAS_W / 2 - 118, footerY, 'Farewell', () => this.closeDialogue());
    this.addDialogueButtonAt(container, CANVAS_W / 2 + 118, footerY, nextLabel, () => this.tryAdvanceToWorld2());
  }

  private advanceToWorld(world: number) {
    this.closeDialogue();
    this.scene.start('Overworld', { world, regenerate: true });
  }

  private getUnlockedMoves(): string[] {
    return (this.game.registry.get('unlockedMoves') as string[]) ?? [...PLAYER_MATERIAL.moves];
  }

  private maybeCollectToken(x: number, y: number) {
    const value = this.tokenTiles[y]?.[x];
    if (!value) return;

    this.tokenTiles[y][x] = 0;
    const spriteIndex = this.tokenSprites.findIndex((c) => c.x === x && c.y === y);
    if (spriteIndex !== -1) {
      const [sprite] = this.tokenSprites.splice(spriteIndex, 1);
      sprite.container.destroy();
      sprite.label?.destroy();
    }

    this.qumatokens += value;
    this.game.registry.set('qumatokens', this.qumatokens);
    this.tokenText.setText(`Qumatokens: ${this.qumatokens}`);
    persistFromRegistry(this.game.registry);
  }

  // The goal is a whole finish row (the corridor is wide), not a single
  // tile -- reaching it anywhere along that row counts.
  private maybeReachGoal(_x: number, y: number) {
    if (this.reachedGoal || y !== this.goalTile.y) return;
    this.reachedGoal = true;
    this.goalText.setVisible(true);
    this.saveMapState();
    this.maybeAutoOpenGoalDialogue();
  }
}
