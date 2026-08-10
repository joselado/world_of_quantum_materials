import Phaser from 'phaser';
import { shade } from '../art/colors';
import { getBiome } from '../art/biomes';
import type { Biome } from '../art/biomes';
import { makeCrystal } from '../art/crystals';
import { makeToken } from '../art/tokens';
import { makeNoetherAvatar } from '../art/mentor';
import { makeBossCrystal } from '../art/boss';
import { makeBlochAvatar } from '../art/bloch';
import { makeBohrAvatar } from '../art/bohr';
import { makeDiracAvatar } from '../art/dirac';
import { makeMajoranaAvatar } from '../art/majorana';
import { makeCurieAvatar } from '../art/curie';
import { makeEinsteinAvatar } from '../art/einstein';
import { makeKondoAvatar } from '../art/kondo';
import { makeFeynmanAvatar } from '../art/feynman';
import { playMentorChime } from '../audio/sfx';
import { project, fogColor, HORIZON_Y, CANVAS_W, CANVAS_H, ProjectedPoint } from '../art/perspective';
import {
  PLAYER_MATERIAL,
  WORLD_NAMES,
  getWildPool,
  getRival,
  MOVES,
  SHOP_MOVE_IDS,
  compatibleMoves,
  getPlayerMaterial,
  getPlayerStats,
  getBattleMoves,
  findMaterialByName,
  statUpgradeCost,
  enemyStatsForWorld,
  DEFAULT_STATS,
} from '../data/materials';
import { tokenColorForValue } from '../data/tokens';
import { getMaterialQuestion } from '../data/quiz';
import { encounterGreeting } from '../data/greetings';
import { TUTORIAL_PAGES } from '../data/tutorial';
import { DENSITY_PRESETS, DEFAULT_ENCOUNTER_DENSITY } from '../data/settings';
import { persistFromRegistry } from '../data/save';
import type { DiscoveredMaterial } from '../data/save';
import type { Material, Move, Stats } from '../data/types';
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
  startTile: GridPoint;
  midTile: GridPoint;
  reachedGoal: boolean;
  reachedMiddle: boolean;
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
// Substantially bigger than a wild crystal (CRYSTAL_SIZE) or even the player
// (PLAYER_CRYSTAL_SIZE) -- the boss standing at the goal tile should read as
// gigantic at a glance (art/boss.ts's makeBossCrystal further composes
// several of these into one fused mass with its own aura on top).
const BOSS_CRYSTAL_SIZE = 70;
const WALL_HEIGHT_PX = 30;
const QUIZ_CORRECT_MULTIPLIER = 1.5;
const QUIZ_WRONG_MULTIPLIER = 0.6;

// Worlds with a built overworld map (biome + rival, where applicable) --
// Space cycles between these for testing, and it's also what bounds Bloch's
// teleport offers (a "visited" world the player can't actually walk isn't a
// real destination). All 10 worlds are built as of DESIGN.md's "full
// build-out" pass. Exported so data/integrity.ts can assert every entry here
// actually has a biome and a rival.
export const BUILT_WORLDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

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

// One entry per world with a mentor -- replaces the old per-mentor
// `spawnXSprite`/`this.world === N` branches with a single data-driven
// dispatch (spawnMentorSprite/openMentor), the same "reusable rather than
// per-world bespoke" approach the map generator and biome table already
// use. Noether/Bloch/Bohr keep their own bespoke panels (shop, teleport hub,
// transmutation) and set `open` explicitly; every mentor from Dirac onward
// leaves `open` unset and falls through to the shared showMentorLore panel
// instead (see DESIGN.md §5 -- their own mechanics are still an open design
// question, Noether stays the sole moves/stats seller). Leaving `open`
// unset rather than hand-writing `(s) => s.showMentorLore(WORLD_MENTORS[N]!)`
// per lore entry means there's no self-referencing world-number literal to
// forget updating if a world ever gets renumbered.
interface MentorDef {
  id: string;
  name: string;
  labelColor: string;
  strokeColor: number;
  quote: string;
  avatar: (scene: Phaser.Scene, scale?: number) => Phaser.GameObjects.Container;
  // Every mentor now stands mid-corridor ('middle', see DESIGN.md §5) so the
  // goal tile is free for that world's boss avatar (spawnBossSprite) --
  // 'start'/'goal' stay valid tile choices for a future mentor, but nothing
  // currently uses them.
  tile: 'goal' | 'start' | 'middle';
  open?: (scene: OverworldScene) => void;
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
  private startTile: GridPoint = { x: 0, y: 0 };
  private midTile: GridPoint = { x: 0, y: 0 };
  private reachedGoal = false;
  private reachedMiddle = false;
  private qumatokens = 0;
  private crystalSprites: (WorldSprite & { material: Material })[] = [];
  private tokenSprites: WorldSprite[] = [];
  // 0 or 1 entries -- reuses the same WorldSprite projection/wander/bob
  // machinery as crystals and tokens (spawnMentorSprite) so a mentor is a
  // visible, wandering landmark standing on the map rather than only
  // appearing once their dialogue triggers.
  private mentorSprites: WorldSprite[] = [];
  // 0 or 1 entries -- this world's rival/boss (if built), a purely visual
  // landmark standing at the goal tile now that mentors have moved to the
  // corridor's middle (see spawnBossSprite/art/boss.ts's makeBossCrystal).
  private bossSprites: WorldSprite[] = [];
  private worldGfx!: Phaser.GameObjects.Graphics;
  private player!: Phaser.GameObjects.Container;
  private playerCrystalGfx!: Phaser.GameObjects.Container;
  private playerMaterial!: Material;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private tokenText!: Phaser.GameObjects.Text;
  private goalText!: Phaser.GameObjects.Text;
  private dialogueActive = false;
  private dialogueContainer?: Phaser.GameObjects.Container;
  // Which section of Noether's panel is showing -- reset to 'moves' on
  // every fresh scene create so re-entering the world doesn't strand the
  // player on the stats tab.
  private shopTab: 'moves' | 'stats' = 'moves';
  // Which tutorial page (data/tutorial.ts's TUTORIAL_PAGES) is showing --
  // reset to 0 every time the tutorial is (re)opened, whether that's the
  // automatic first-run play or a manual replay from the Enter-menu.
  private tutorialIndex = 0;

  // One entry per world with a mentor (see MentorDef above). A static field
  // initializer is still lexically inside the class body, so `s.showX()`
  // below can call other private methods even though `s` is just a
  // same-typed parameter, not `this`.
  private static readonly WORLD_MENTORS: Partial<Record<number, MentorDef>> = {
    1: {
      id: 'noether',
      name: 'Noether',
      labelColor: '#ffe066',
      strokeColor: 0xffe066,
      quote: 'Every symmetry hides a conservation law.',
      avatar: makeNoetherAvatar,
      tile: 'middle',
      open: (s) => s.showNoetherShop(),
    },
    2: {
      id: 'bloch',
      name: 'Bloch',
      labelColor: '#8fe8ff',
      strokeColor: 0x4adde0,
      quote: 'Every crystal is a superposition of the worlds it has touched.',
      avatar: makeBlochAvatar,
      tile: 'middle',
      open: (s) => s.showBlochHub(),
    },
    3: {
      id: 'bohr',
      name: 'Bohr',
      labelColor: '#ffa64a',
      strokeColor: 0xffa64a,
      quote: 'Every crystal you have defeated is a state you now understand well enough to become.',
      avatar: makeBohrAvatar,
      tile: 'middle',
      open: (s) => s.showBohrPanel(),
    },
    4: {
      id: 'dirac',
      name: 'Dirac',
      labelColor: '#8fa0ff',
      strokeColor: 0x6a7fff,
      quote:
        "Put a Dirac fermion in a strong field and its Landau levels crowd toward zero energy differently than an ordinary electron's would -- graphene remembers its own relativity.",
      avatar: makeDiracAvatar,
      tile: 'middle',
    },
    5: {
      id: 'majorana',
      name: 'Majorana',
      labelColor: '#9fffb0',
      strokeColor: 0x4fd97a,
      quote: 'Split one fermion into two halves, each its own antiparticle, and see what a superconductor can hide at its edge.',
      avatar: makeMajoranaAvatar,
      tile: 'middle',
    },
    6: {
      id: 'curie',
      name: 'Curie',
      labelColor: '#d9e86a',
      strokeColor: 0xc9d84a,
      quote: 'Every magnet has a temperature where its order gives up -- above it, the same atoms, no memory of which way is up.',
      avatar: makeCurieAvatar,
      tile: 'middle',
    },
    7: {
      id: 'einstein',
      name: 'Einstein',
      labelColor: '#dfe6ec',
      strokeColor: 0xaeb8c4,
      quote: "I called it spooky at a distance. I was wrong to doubt it, but I was right that it deserved doubting.",
      avatar: makeEinsteinAvatar,
      tile: 'middle',
    },
    8: {
      id: 'kondo',
      name: 'Kondo',
      labelColor: '#ff8f6a',
      strokeColor: 0xe86a44,
      quote: 'A single stray spin, screened by a sea of conduction electrons until it all but disappears at low temperature.',
      avatar: makeKondoAvatar,
      tile: 'middle',
    },
    9: {
      id: 'feynman',
      name: 'Feynman',
      labelColor: '#ffb24a',
      strokeColor: 0xe89a3a,
      quote: 'Draw the diagram. Every defect is just an excitation that forgot how to propagate freely.',
      avatar: makeFeynmanAvatar,
      tile: 'middle',
    },
    // 10: none -- the finale is the final boss only, no mentor waiting there.
  };

  constructor() {
    super('Overworld');
  }

  init(data: OverworldInitData) {
    this.world = data?.world ?? 1;
    this.regenerate = data?.regenerate ?? false;
  }

  create() {
    this.moving = false;
    // Phaser reuses the same Scene instance across scene.start()/restart()
    // calls -- only init()/create() rerun, class field initializers don't --
    // so a dialogue left open when the player switches away (Space to
    // dev-cycle worlds, H to return to the Lab; both skip straight to
    // scene.start without closing whatever's open first) would otherwise
    // leave dialogueActive stuck true forever on this instance, freezing
    // movement (update()'s dialogueActive guard) and the pause menu on
    // every future visit. Any stale reference to the old (now-destroyed)
    // panel container needs clearing too.
    this.dialogueActive = false;
    this.dialogueContainer = undefined;
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
    this.spawnMentorSprite();
    this.spawnBossSprite();
    music.play(`overworld:${this.world}`);

    this.qumatokens = (state.get('qumatokens') as number) || 0;
    this.playerMaterial = getPlayerMaterial(state);
    this.applyDebugLeveling();
    this.shopTab = 'moves';
    this.recordVisit();

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
      .text(
        8,
        52,
        'M: mute/unmute music. H: return to the Lab. Enter: menu. Space: switch world (testing, skips gates).',
        {
          fontSize: '12px',
          color: '#eeeeee',
          backgroundColor: 'rgba(0,0,0,0.35)',
          padding: { x: 4, y: 2 },
        }
      )
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
    // overworld avatar is just the player's current form (playerMaterial,
    // Silicon by default or whatever Bohr transmuted them into) rendered
    // the same way a wild crystal is, floating and bobbing rather than
    // walking.
    this.player = this.add.container(CANVAS_W / 2, 400);
    const playerShadow = this.add.ellipse(0, 34, 34, 11, 0x000000, 0.28);
    this.playerCrystalGfx = makeCrystal(this, PLAYER_CRYSTAL_SIZE, this.playerMaterial.color, this.playerMaterial.variant);
    this.player.add([playerShadow, this.playerCrystalGfx]);
    this.player.setDepth(40);
    this.idleBob();

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.input.keyboard!.on('keydown-M', () => music.toggleMute());
    this.input.keyboard!.on('keydown-SPACE', () => this.switchWorld());
    this.input.keyboard!.on('keydown-H', () => this.scene.start('Hub'));
    this.input.keyboard!.on('keydown-ENTER', () => this.togglePauseMenu());

    // Defensive fallback only -- TitleScene normally seeds all of these
    // from localStorage (data/save.ts) before Overworld ever runs. Only
    // relevant if this scene is ever launched directly (ad hoc dev testing).
    if (state.get('qumatokens') === undefined) {
      state.set('qumatokens', 0);
      state.set('unlockedMoves', [...PLAYER_MATERIAL.moves]);
      state.set('playerHp', PLAYER_MATERIAL.maxHp);
      state.set('rivalDefeated', {});
      state.set('discoveredMaterials', []);
      state.set('playerStats', { ...DEFAULT_STATS });
      state.set('visitedWorlds', []);
      state.set('defeatedMaterials', []);
      state.set('playerForm', null);
      state.set('metMentors', []);
    }

    this.maybeAutoOpenGoalDialogue();
    this.maybeAutoOpenMiddleDialogue();
    this.maybeShowFirstTimeTutorial();
  }

  private isDebugMode(): boolean {
    return !!this.game.registry.get('debugMode');
  }

  // Debug mode (Title screen toggle, data/save.ts's `debugMode`): re-levels
  // the player to a fair footing for whatever world this scene just entered,
  // on every entry -- not just an explicit debug warp, so Continue-to-next-
  // world, Bloch's teleport, and the dev Space-cycle shortcut all stay
  // competitive too. A flat +2 over enemyStatsForWorld keeps the player
  // slightly ahead rather than exactly even. Also grants every move (so
  // there's always something to fight with regardless of what's been
  // bought) and a full heal.
  private applyDebugLeveling() {
    if (!this.isDebugMode()) return;
    const target = enemyStatsForWorld(this.world);
    const stats: Stats = {
      quantumness: target.quantumness + 2,
      velocity: target.velocity + 2,
      correlation: target.correlation + 2,
    };
    this.game.registry.set('playerStats', stats);
    this.game.registry.set('unlockedMoves', Object.keys(MOVES));
    this.game.registry.set('playerHp', this.playerMaterial.maxHp);
    persistFromRegistry(this.game.registry);
  }

  // First-run onboarding (data/tutorial.ts's TUTORIAL_PAGES): plays once,
  // the first time an Overworld scene is ever created for this save, then
  // never auto-triggers again -- the Enter-menu's "Tutorial" button is the
  // way to replay it after that. Guarded by dialogueActive so it never
  // stacks on top of a goal/start-tile mentor panel that just opened.
  private maybeShowFirstTimeTutorial() {
    if (this.dialogueActive) return;
    if (this.game.registry.get('tutorialSeen')) return;
    this.game.registry.set('tutorialSeen', true);
    persistFromRegistry(this.game.registry);
    this.showTutorial(0);
  }

  // Renders data/tutorial.ts's TUTORIAL_PAGES as a paged overlay -- Back/
  // Next to move between pages, Skip/Done to close early or at the last
  // page. Called both by the first-run auto-trigger above and by the
  // Enter-menu's "Tutorial" button, always starting over from page 0.
  private showTutorial(startIndex: number) {
    this.dialogueContainer?.destroy(true);
    this.dialogueActive = true;
    this.tutorialIndex = Phaser.Math.Clamp(startIndex, 0, TUTORIAL_PAGES.length - 1);
    this.renderTutorialPage();
  }

  private renderTutorialPage() {
    this.dialogueContainer?.destroy(true);

    const panelY = 300;
    const container = this.add.container(0, 0).setDepth(100);
    this.dialogueContainer = container;

    const panel = this.add.rectangle(CANVAS_W / 2, panelY, 560, 300, 0x10101c, 0.95).setStrokeStyle(2, 0x5ad9ff);
    container.add(panel);

    const page = TUTORIAL_PAGES[this.tutorialIndex];
    const counter = this.add
      .text(CANVAS_W / 2, panelY - 140, `TUTORIAL -- ${this.tutorialIndex + 1} / ${TUTORIAL_PAGES.length}`, {
        fontSize: '11px',
        color: '#5ad9ff',
      })
      .setOrigin(0.5, 0);
    container.add(counter);

    const title = this.add
      .text(CANVAS_W / 2, panelY - 116, page.title, { fontSize: '16px', color: '#ffffff', fontStyle: 'bold', align: 'center', wordWrap: { width: 500 } })
      .setOrigin(0.5, 0);
    container.add(title);

    const body = this.add
      .text(CANVAS_W / 2, panelY - 76, page.body, {
        fontSize: '12px',
        color: '#cfd8ff',
        align: 'center',
        wordWrap: { width: 500 },
        lineSpacing: 5,
      })
      .setOrigin(0.5, 0);
    container.add(body);

    const footerY = panelY + 110;
    const isFirst = this.tutorialIndex === 0;
    const isLast = this.tutorialIndex === TUTORIAL_PAGES.length - 1;

    if (!isFirst) {
      this.addDialogueButtonAt(container, CANVAS_W / 2 - 170, footerY, '<- Back', () => {
        this.tutorialIndex -= 1;
        this.renderTutorialPage();
      }, 130);
    }
    this.addDialogueButtonAt(container, CANVAS_W / 2, footerY, isLast ? 'Done' : 'Skip', () => this.closeDialogue(), 100);
    if (!isLast) {
      this.addDialogueButtonAt(container, CANVAS_W / 2 + 170, footerY, 'Next ->', () => {
        this.tutorialIndex += 1;
        this.renderTutorialPage();
      }, 130);
    }
  }

  private switchWorld() {
    const idx = BUILT_WORLDS.indexOf(this.world);
    const next = BUILT_WORLDS[(idx + 1) % BUILT_WORLDS.length];
    this.scene.restart({ world: next, regenerate: true });
  }

  // Fresh random layout -- used on first load and whenever the player
  // explicitly switches worlds (Space), which is the one action meant to
  // reshuffle the map.
  private generateMap() {
    this.reachedGoal = false;
    this.reachedMiddle = false;
    this.playerTile = { x: Math.floor(GRID_W / 2), y: GRID_H - 5 };

    const wildPool = getWildPool(this.world);
    const map = generateWorldMap(GRID_W, GRID_H, this.playerTile);
    this.walkable = map.walkable;
    this.tokenTiles = map.tokens;
    this.goalTile = map.goal;
    this.startTile = map.start;
    this.midTile = map.mid;

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
    const encounterChance = this.encounterChance();
    map.rows.forEach((r) => {
      if (r.y === this.playerTile.y) return; // never spawn right on the player
      if (wildPool.length === 0 || Math.random() >= encounterChance) return;
      const x = r.left + Math.floor(Math.random() * (r.right - r.left + 1));
      if (this.tokenTiles[r.y][x]) return;
      this.encounterTiles[r.y][x] = Phaser.Utils.Array.GetRandom(wildPool);
    });
  }

  // Enter-menu Settings panel (showSettingsPanel) knob: the per-corridor-row
  // chance a wild crystal spawns, one of data/settings.ts's DENSITY_PRESETS.
  // Read fresh at map-generation time rather than cached, so a mid-run
  // Settings change takes effect the next time a map is (re)generated.
  private encounterChance(): number {
    return (this.game.registry.get('encounterDensity') as number) ?? DEFAULT_ENCOUNTER_DENSITY;
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
    this.startTile = saved.startTile;
    this.midTile = saved.midTile;
    this.reachedGoal = saved.reachedGoal;
    this.reachedMiddle = saved.reachedMiddle;
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
      startTile: this.startTile,
      midTile: this.midTile,
      reachedGoal: this.reachedGoal,
      reachedMiddle: this.reachedMiddle,
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
    this.updateWorldSprites(this.mentorSprites);
    this.updateWorldSprites(this.bossSprites);

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
        this.maybeReachMiddle(nx, ny);
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

    // World 4 (QHE/Landau levels): short parallel field-line strokes with a
    // small quantized-orbit ring, evoking magnetic field lines threading the
    // terrain.
    if (this.biome.decoration === 'fieldLines') {
      g.lineStyle(1, 0x9fd8ff, 0.8);
      [-2.4, 0, 2.4].forEach((off) => {
        g.lineBetween(cx - 2.2 * s + off * s, cy - 1.6 * s, cx - 2.2 * s + off * s, cy + 1.6 * s);
      });
      g.lineStyle(1, 0xffffff, 0.7);
      g.strokeCircle(cx, cy, 1.6 * s);
      return;
    }

    // World 7 (entanglement/tensor networks): a small graph -- a few nodes
    // joined by bond lines, matching the biome's "bonds as paths" theme.
    if (this.biome.decoration === 'networkNodes') {
      const pts = [
        { x: cx - 2 * s, y: cy + 1 * s },
        { x: cx, y: cy - 1.8 * s },
        { x: cx + 2 * s, y: cy + 1 * s },
      ];
      g.lineStyle(1, 0xc9a8f0, 0.75);
      g.lineBetween(pts[0].x, pts[0].y, pts[1].x, pts[1].y);
      g.lineBetween(pts[1].x, pts[1].y, pts[2].x, pts[2].y);
      g.lineBetween(pts[0].x, pts[0].y, pts[2].x, pts[2].y);
      g.fillStyle(0xffffff, 0.9);
      pts.forEach((p) => g.fillCircle(p.x, p.y, 1.1 * s));
      return;
    }

    // World 6 (classical magnetism/magnons): concentric ripple rings, as if
    // a magnon wave just passed through the grass.
    if (this.biome.decoration === 'ripples') {
      g.lineStyle(1, 0xfff3c9, 0.75);
      [1.2, 2.2].forEach((r) => g.strokeCircle(cx, cy, r * s));
      return;
    }

    // World 9 (excitations/defects): a jagged crack in the ground, the
    // world's "cracked/glitching" theme made literal.
    if (this.biome.decoration === 'cracks') {
      g.lineStyle(1.4, 0xff8a5a, 0.85);
      g.beginPath();
      g.moveTo(cx - 2.4 * s, cy - 1.4 * s);
      g.lineTo(cx - 0.6 * s, cy - 0.2 * s);
      g.lineTo(cx + 0.8 * s, cy - 1 * s);
      g.lineTo(cx + 2.4 * s, cy + 1.4 * s);
      g.strokePath();
      return;
    }

    // World 8 (spin liquid/Kondo): soft overlapping fog wisps rather than a
    // sharp shape, matching the "fractionalizes on contact" foggy theme.
    if (this.biome.decoration === 'mistMotes') {
      g.fillStyle(0xdfe6df, 0.28);
      [
        [-1.6, 0],
        [1.6, 0.4],
        [0, -0.6],
      ].forEach(([ox, oy]) => g.fillEllipse(cx + ox * s, cy + oy * s, 3.2 * s, 1.6 * s));
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

  // This world's mentor (if any) stands (floats) mid-corridor as a visible
  // landmark, not just something that materializes once its dialogue opens
  // -- the player sees and walks up to them, the same way a wild encounter
  // is seen coming rather than sprung from nowhere. Every mentor uses
  // `tile: 'middle'` now (see WORLD_MENTORS/DESIGN.md §5), freeing the goal
  // tile for that world's boss (spawnBossSprite below); 'start'/'goal'
  // remain valid lookups here for any future mentor that wants them. Reuses
  // the crystal/token WorldSprite machinery (projection, wander, bob) so
  // they scroll and fade with the rest of the world for free.
  private spawnMentorSprite() {
    this.mentorSprites = [];
    const mentor = OverworldScene.WORLD_MENTORS[this.world];
    if (!mentor) return;

    const avatar = mentor.avatar(this, 1.1);
    avatar.setDepth(20);

    const label = this.add
      .text(0, 0, mentor.name, {
        fontSize: '11px',
        color: mentor.labelColor,
        backgroundColor: 'rgba(0,0,0,0.45)',
        padding: { x: 3, y: 1 },
      })
      .setOrigin(0.5, 1)
      .setDepth(21);

    const tile = mentor.tile === 'start' ? this.startTile : mentor.tile === 'middle' ? this.midTile : this.goalTile;
    this.mentorSprites.push({ x: tile.x, y: tile.y, size: 42, container: avatar, label, seed: Math.random() * Math.PI * 2 });
  }

  // This world's rival/boss (getRival), standing at the goal tile as a
  // gigantic, unmissable-from-a-distance landmark -- purely visual (no
  // world has a WORLD_RIVALS gap, so this always finds one for a built
  // world). The actual fight still only starts from "Face the Rival" in the
  // goal gate panel (showGatePanel/showRivalEncounter); walking up to this
  // sprite doesn't trigger anything on its own, same as a mentor sprite.
  private spawnBossSprite() {
    this.bossSprites = [];
    const boss = getRival(this.world);
    if (!boss) return;

    const avatar = makeBossCrystal(this, BOSS_CRYSTAL_SIZE, boss.color, boss.variant);
    avatar.setDepth(20);

    const label = this.add
      .text(0, 0, boss.name, {
        fontSize: '12px',
        fontStyle: 'bold',
        color: '#ff8f8f',
        backgroundColor: 'rgba(0,0,0,0.5)',
        padding: { x: 4, y: 2 },
      })
      .setOrigin(0.5, 1)
      .setDepth(21);

    this.bossSprites.push({
      x: this.goalTile.x,
      y: this.goalTile.y,
      size: BOSS_CRYSTAL_SIZE,
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

  // Reopens this world's goal gate panel (showGatePanel -- no mentor stands
  // here anymore, see WORLD_MENTORS' `tile: 'middle'`) every time this scene
  // is (re)created with the goal already reached -- both right after first
  // stepping onto the goal row and after any later round trip through
  // BattleScene (a wild fight fought near the goal, or the rival fight
  // itself resolving). Keeps the panel revisitable across multiple battles
  // instead of a single one-shot popup. Since the mentor is mid-corridor,
  // reached well before the goal, the player always has a chance to shop/
  // prep before ever facing the boss waiting here; the rival fight is what
  // "Continue to World N+1" triggers (see tryAdvanceToNextWorld).
  private maybeAutoOpenGoalDialogue() {
    if (!this.reachedGoal || this.dialogueActive) return;
    this.openGoalMentorPanel();
  }

  // Looks up this world's goal-tile mentor (if any) in WORLD_MENTORS and
  // opens their panel. No mentor currently uses `tile: 'goal'` -- every
  // mentor stands mid-corridor now (see WORLD_MENTORS) -- so this always
  // falls through to showGatePanel() in practice, which is exactly what a
  // world needs at its goal: a way to trigger the rival gate, or reaching
  // the goal would be a dead end with no way onward. Left branching on
  // `tile === 'goal'` rather than calling showGatePanel() directly so a
  // future mentor can still choose to stand at the goal instead.
  private openGoalMentorPanel() {
    const mentor = OverworldScene.WORLD_MENTORS[this.world];
    if (mentor?.tile === 'goal') {
      this.openMentor(mentor);
      return;
    }
    this.showGatePanel();
  }

  // Opens a mentor's panel and records the first time this mentor is met,
  // so the Advisors pause-menu list (showAdvisorsPanel) grows as the player
  // reaches each world's middle tile -- regardless of which panel that
  // mentor actually shows (shop, teleport hub, transmutation, or lore).
  // `open` is only set on Noether/Bloch/Bohr, whose panels are bespoke;
  // every other mentor falls through to the shared lore panel.
  private openMentor(mentor: MentorDef) {
    const met = (this.game.registry.get('metMentors') as string[]) ?? [];
    if (!met.includes(mentor.id)) {
      this.game.registry.set('metMentors', [...met, mentor.id]);
      persistFromRegistry(this.game.registry);
    }
    (mentor.open ?? ((s: OverworldScene) => s.showMentorLore(mentor)))(this);
  }

  // Every world's goal panel now that no mentor stands there (they've all
  // moved mid-corridor) -- the boss looming at this same tile (spawnBossSprite)
  // is what's actually guarding the way, this panel is just enough text plus
  // the shared footer to reach the rival gate, so no built world is ever a
  // dead end.
  private showGatePanel() {
    this.dialogueActive = true;

    const panelY = 300;
    const container = this.add.container(0, 0).setDepth(100);
    this.dialogueContainer = container;

    const panel = this.add.rectangle(CANVAS_W / 2, panelY, 500, 200, 0x10101c, 0.94).setStrokeStyle(2, 0x8fa0c9);
    container.add(panel);

    const text = this.add
      .text(CANVAS_W / 2, panelY - 60, 'The path onward is still guarded.', {
        fontSize: '14px',
        color: '#ffffff',
        align: 'center',
      })
      .setOrigin(0.5, 0);
    container.add(text);

    this.renderShopFooter(container, panelY - 60);
  }

  // Every built world (1-10) can be advanced past once its rival is
  // defeated, except the last one -- there's no World 11 to start, so
  // beating world 10's rival shows the finale instead of trying to.
  private tryAdvanceToNextWorld() {
    if (this.isRivalDefeated()) {
      if (this.world >= Math.max(...BUILT_WORLDS)) {
        this.closeDialogue();
        this.showFinalePanel();
        return;
      }
      this.advanceToWorld(this.world + 1);
      return;
    }
    this.closeDialogue();
    this.showRivalEncounter();
  }

  // Shown once the last built world's rival is beaten -- a real ending
  // rather than a dead "Continue to World 11" button pointing at a world
  // that doesn't exist.
  private showFinalePanel() {
    this.dialogueActive = true;

    const panelY = 240;
    const container = this.add.container(0, 0).setDepth(100);
    this.dialogueContainer = container;

    const panel = this.add.rectangle(CANVAS_W / 2, panelY, 600, 220, 0x10101c, 0.96).setStrokeStyle(2, 0xffe066);
    container.add(panel);

    const title = this.add
      .text(CANVAS_W / 2, panelY - 80, 'The Decoherence is stabilized.', {
        fontSize: '18px',
        color: '#ffe066',
        fontStyle: 'bold',
        align: 'center',
      })
      .setOrigin(0.5, 0);
    container.add(title);

    const body = this.add
      .text(
        CANVAS_W / 2,
        panelY - 44,
        "You mastered every phase of matter the model could throw at you. Thanks for playing.",
        { fontSize: '13px', color: '#cfd8ff', align: 'center', wordWrap: { width: 480 } }
      )
      .setOrigin(0.5, 0);
    container.add(body);

    this.addDialogueButtonAt(
      container,
      CANVAS_W / 2,
      panelY + 60,
      'Return to the Lab',
      () => {
        this.closeDialogue();
        this.scene.start('Hub');
      },
      260
    );
  }

  // The "beat the world's rival crystal" gate DESIGN.md's world table lists
  // per world -- triggered by "Continue to World N+1" rather than
  // automatically on reaching the goal, so the player can prepare with the
  // goal mentor first. Same in-map dialogue pattern as a wild encounter,
  // but with no "let me pass" option, since a gate that can be skipped
  // isn't a gate.
  private showRivalEncounter() {
    const rival = getRival(this.world);
    if (!rival) {
      // Safety net for a world with no WORLD_RIVALS entry yet -- don't
      // strand the player behind a gate that can't open.
      this.openGoalMentorPanel();
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

  // Noether appears once the player reaches world 1's middle tile, selling
  // the other early moves and stat upgrades for qumatokens, in two tabs of
  // the same panel. Same in-map dialogue pattern as a wild encounter, but
  // with a mentor avatar and a shop list instead of a fight.
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
    playMentorChime();

    const intro = this.add
      .text(
        CANVAS_W / 2,
        panelY - 68,
        '"I am Noether. Every symmetry hides a conservation law -- spend your qumatokens on a new attack, or a sharper stat."',
        { fontSize: '12px', fontStyle: 'italic', color: '#cfd8ff', align: 'center', wordWrap: { width: 520 } }
      )
      .setOrigin(0.5, 0);
    container.add(intro);

    this.renderShopTabs(container, panelY);
    if (this.shopTab === 'moves') this.renderShopMoves(container, panelY);
    else this.renderShopStats(container, panelY);
  }

  private renderShopTabs(container: Phaser.GameObjects.Container, panelY: number) {
    const y = panelY - 24;
    (['moves', 'stats'] as const).forEach((tab, i) => {
      const active = this.shopTab === tab;
      const btn = this.add
        .text(CANVAS_W / 2 + (i === 0 ? -45 : 45), y, tab === 'moves' ? 'Moves' : 'Stats', {
          fontSize: '11px',
          color: active ? '#ffe066' : '#8fa0c9',
          backgroundColor: active ? '#333355' : '#1a1a2e',
          padding: { x: 8, y: 3 },
        })
        .setOrigin(0.5, 0)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
          if (this.shopTab === tab) return;
          this.shopTab = tab;
          this.dialogueContainer?.destroy(true);
          this.showNoetherShop();
        });
      container.add(btn);
    });
  }

  private renderShopMoves(container: Phaser.GameObjects.Container, panelY: number) {
    const unlocked = this.getUnlockedMoves();
    const compatible = new Set(compatibleMoves(this.playerMaterial));
    const forSale = SHOP_MOVE_IDS.filter((id) => !unlocked.includes(id) && compatible.has(id));
    const tokens = (this.game.registry.get('qumatokens') as number) || 0;

    if (forSale.length === 0) {
      const text = this.add
        .text(CANVAS_W / 2, panelY + 8, "Nothing your current form can carry is left to teach.", {
          fontSize: '13px',
          color: '#ffffff',
          align: 'center',
          wordWrap: { width: 480 },
        })
        .setOrigin(0.5, 0);
      container.add(text);
    } else {
      forSale.forEach((id, i) => {
        const move = MOVES[id];
        const cost = shopCost(move);
        const affordable = tokens >= cost;
        const btn = this.addDialogueButton(container, panelY + 8 + i * 36, `${move.name} -- ${cost} qumatokens`, () => {
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

    this.renderFarewellFooter(container, panelY);
  }

  private renderShopStats(container: Phaser.GameObjects.Container, panelY: number) {
    const stats = getPlayerStats(this.game.registry);
    const tokens = (this.game.registry.get('qumatokens') as number) || 0;
    const rows: { key: keyof Stats; label: string }[] = [
      { key: 'quantumness', label: 'Quantumness (crit chance)' },
      { key: 'velocity', label: 'Velocity (turn order)' },
      { key: 'correlation', label: 'Correlation (defense)' },
    ];

    rows.forEach((row, i) => {
      const value = stats[row.key];
      const cost = statUpgradeCost(value);
      const affordable = tokens >= cost;
      const btn = this.addDialogueButton(
        container,
        panelY + 8 + i * 36,
        `${row.label}: ${value} -> ${value + 1} -- ${cost} qumatokens`,
        () => {
          const current = (this.game.registry.get('qumatokens') as number) || 0;
          if (current < cost) return;
          const updated = { ...getPlayerStats(this.game.registry), [row.key]: value + 1 };
          this.qumatokens = current - cost;
          this.game.registry.set('qumatokens', this.qumatokens);
          this.game.registry.set('playerStats', updated);
          this.tokenText.setText(`Qumatokens: ${this.qumatokens}`);
          persistFromRegistry(this.game.registry);
          this.dialogueContainer?.destroy(true);
          this.showNoetherShop();
        }
      );
      if (!affordable) btn.setAlpha(0.5);
    });

    this.renderFarewellFooter(container, panelY);
  }

  // Fixed footer row (not stacked below the variable-length content above
  // it) so it never runs off the panel/canvas. showGatePanel's only caller
  // now that mentors stand mid-corridor instead of at the goal (see
  // renderFarewellFooter below for the mentor-panel equivalent) -- this is
  // deliberately the *only* place "Face the Rival"/"Continue" appears, so
  // reaching it requires actually walking to the goal where that world's
  // boss is waiting (spawnBossSprite), not just meeting the mid-corridor
  // mentor. Space is a dev-only shortcut that skips the rival gate entirely.
  private renderShopFooter(container: Phaser.GameObjects.Container, panelY: number) {
    const footerY = panelY + 120;
    const rivalDefeated = this.isRivalDefeated();
    const isLastWorld = this.world >= Math.max(...BUILT_WORLDS);
    const nextLabel = !rivalDefeated
      ? 'Face the Rival ->'
      : isLastWorld
      ? 'The Decoherence is stabilized ->'
      : `Continue to World ${this.world + 1} ->`;
    this.addDialogueButtonAt(container, CANVAS_W / 2 - 118, footerY, 'Farewell', () => this.closeDialogue());
    this.addDialogueButtonAt(container, CANVAS_W / 2 + 118, footerY, nextLabel, () => this.tryAdvanceToNextWorld());
  }

  // Mid-corridor mentor panels (every one but the goal's showGatePanel) only
  // need a way to close -- see renderShopFooter's comment for why the
  // Face-the-Rival/Continue action doesn't belong here anymore.
  private renderFarewellFooter(container: Phaser.GameObjects.Container, panelY: number) {
    this.addDialogueButtonAt(container, CANVAS_W / 2, panelY + 120, 'Farewell', () => this.closeDialogue(), 260);
  }

  private advanceToWorld(world: number) {
    this.closeDialogue();
    this.scene.start('Overworld', { world, regenerate: true });
  }

  private getUnlockedMoves(): string[] {
    return (this.game.registry.get('unlockedMoves') as string[]) ?? [...PLAYER_MATERIAL.moves];
  }

  private getVisitedWorlds(): number[] {
    return (this.game.registry.get('visitedWorlds') as number[]) ?? [];
  }

  // Records the current world as visited the moment this scene is created
  // in it -- distinct from `rivalDefeated`, since Bloch's teleport should
  // offer anywhere the player has set foot, not just worlds they've beaten.
  private recordVisit() {
    const visited = this.getVisitedWorlds();
    if (visited.includes(this.world)) return;
    this.game.registry.set('visitedWorlds', [...visited, this.world]);
    persistFromRegistry(this.game.registry);
  }

  private getDefeatedMaterials(): DiscoveredMaterial[] {
    return (this.game.registry.get('defeatedMaterials') as DiscoveredMaterial[]) ?? [];
  }

  // Bloch stands at world 2's middle tile (see spawnMentorSprite/
  // WORLD_MENTORS) and folds the player to any other world they've already
  // visited and that actually has a built map (BUILT_WORLDS) -- offering an
  // unbuilt world would teleport the player somewhere with no map to stand
  // on. Ends in the plain "Farewell"-only renderFarewellFooter, not the
  // Face-the-Rival/Continue footer -- that stays exclusive to the goal
  // panel now that Bloch stands mid-corridor rather than at the goal.
  private showBlochHub() {
    this.dialogueActive = true;

    const destinations = this.getVisitedWorlds().filter((w) => BUILT_WORLDS.includes(w) && w !== this.world);
    // With only 3 built worlds this list could show at most 2 destinations,
    // comfortably fitting the avatar, full quote, rows, and footer inside a
    // fixed 340-tall panel. Now that all 10 are built, a well-traveled
    // player can see up to 9 -- which doesn't fit alongside the avatar
    // within the 480px canvas at any row spacing safely above a button's
    // own rendered height (~26px). Past a handful of destinations, drop the
    // avatar and shrink the intro instead of shrinking row spacing below
    // what's clickable (which would let adjacent rows overlap and misroute
    // a click to the wrong world).
    const compact = destinations.length > 5;

    const panelY = 240;
    const panelHeight = 440;
    const footerPanelY = panelY + 200 - 120; // renderFarewellFooter adds +120 back
    const container = this.add.container(0, 0).setDepth(100);
    this.dialogueContainer = container;

    const panel = this.add.rectangle(CANVAS_W / 2, panelY, 600, panelHeight, 0x10101c, 0.94).setStrokeStyle(2, 0x4adde0);
    container.add(panel);

    let introY: number;
    let rowsTop: number;
    if (!compact) {
      const avatar = makeBlochAvatar(this);
      avatar.setPosition(CANVAS_W / 2, panelY - 105);
      container.add(avatar);
      this.tweens.add({ targets: avatar, y: panelY - 97, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      introY = panelY - 68;
      rowsTop = panelY - 8;
    } else {
      introY = panelY - 195;
      rowsTop = panelY - 150;
    }
    playMentorChime();

    const intro = this.add
      .text(
        CANVAS_W / 2,
        introY,
        '"I am Bloch. Every crystal is a superposition of the worlds it has touched -- name one you have visited, and I will fold you there."',
        { fontSize: '12px', fontStyle: 'italic', color: '#cfd8ff', align: 'center', wordWrap: { width: 520 } }
      )
      .setOrigin(0.5, 0);
    container.add(intro);

    if (destinations.length === 0) {
      const text = this.add
        .text(CANVAS_W / 2, rowsTop, "You haven't mapped anywhere else yet.", { fontSize: '13px', color: '#ffffff' })
        .setOrigin(0.5, 0);
      container.add(text);
    } else {
      const spacing = compact ? 30 : 36;
      destinations.forEach((w, i) => {
        const name = WORLD_NAMES[w] ?? `World ${w}`;
        this.addDialogueButton(container, rowsTop + i * spacing, `Travel to World ${w} -- ${name}`, () =>
          this.advanceToWorld(w)
        );
      });
    }

    this.renderFarewellFooter(container, footerPanelY);
  }

  // Bohr stands at world 3's middle tile like every other mentor now (see
  // spawnMentorSprite/WORLD_MENTORS), triggered on reaching that row
  // (maybeAutoOpenMiddleDialogue). Lets the player transmute into any
  // crystal they've defeated -- the physics rationale being that beating
  // something is understanding it well enough to become it for a while.
  private showBohrPanel() {
    this.dialogueActive = true;

    const panelY = 300;
    const container = this.add.container(0, 0).setDepth(100);
    this.dialogueContainer = container;

    const panel = this.add.rectangle(CANVAS_W / 2, panelY, 600, 340, 0x10101c, 0.94).setStrokeStyle(2, 0xffa64a);
    container.add(panel);

    const avatar = makeBohrAvatar(this);
    avatar.setPosition(CANVAS_W / 2, panelY - 105);
    container.add(avatar);
    this.tweens.add({ targets: avatar, y: panelY - 97, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    playMentorChime();

    const intro = this.add
      .text(
        CANVAS_W / 2,
        panelY - 68,
        '"I am Bohr. Every crystal you have defeated is a state you now understand well enough to become, for a while."',
        { fontSize: '12px', fontStyle: 'italic', color: '#cfd8ff', align: 'center', wordWrap: { width: 520 } }
      )
      .setOrigin(0.5, 0);
    container.add(intro);

    const defeated = this.getDefeatedMaterials().slice(-3);
    if (defeated.length === 0) {
      const text = this.add
        .text(CANVAS_W / 2, panelY - 8, "You haven't defeated any crystals yet -- there is nothing to become.", {
          fontSize: '13px',
          color: '#ffffff',
          align: 'center',
          wordWrap: { width: 480 },
        })
        .setOrigin(0.5, 0);
      container.add(text);
    } else {
      defeated.forEach((m, i) => {
        const isCurrent = this.playerMaterial.name === m.name;
        const label = isCurrent ? `${m.name} (current form)` : `Become ${m.name}`;
        const btn = this.addDialogueButton(container, panelY - 8 + i * 36, label, () => {
          if (isCurrent) return;
          this.transmuteInto(m.name);
        });
        if (isCurrent) btn.setAlpha(0.5);
      });
    }

    this.addDialogueButtonAt(container, CANVAS_W / 2, panelY + 120, 'Farewell', () => this.closeDialogue(), 300);
  }

  private transmuteInto(name: string) {
    const material = findMaterialByName(name);
    if (!material) return;

    this.game.registry.set('playerForm', material);
    const clampedHp = Math.min((this.game.registry.get('playerHp') as number) ?? material.maxHp, material.maxHp);
    this.game.registry.set('playerHp', clampedHp);
    persistFromRegistry(this.game.registry);

    this.playerMaterial = material;
    this.redrawPlayerCrystal();

    // Rebuild the panel in place (dialogueActive already true from the open
    // showBohrPanel call) so the new form's "(current form)" tag updates.
    this.dialogueContainer?.destroy(true);
    this.showBohrPanel();
  }

  private redrawPlayerCrystal() {
    this.playerCrystalGfx.destroy();
    this.playerCrystalGfx = makeCrystal(this, PLAYER_CRYSTAL_SIZE, this.playerMaterial.color, this.playerMaterial.variant);
    this.player.add(this.playerCrystalGfx);
  }

  // Shared panel for every mentor from Dirac onward (see WORLD_MENTORS):
  // avatar + a topic-tied quote, no shop tabs -- Noether stays the sole
  // seller of moves/stats (DESIGN.md §5 records this as a deliberate,
  // temporary state, not a finished design). Ends in renderFarewellFooter,
  // not renderShopFooter -- these mentors stand mid-corridor now, so the
  // Face-the-Rival/Continue progression action stays exclusive to the goal
  // panel (showGatePanel), reached only once the player actually walks the
  // rest of the way to the boss waiting there.
  private showMentorLore(mentor: MentorDef) {
    this.dialogueActive = true;

    const panelY = 300;
    const container = this.add.container(0, 0).setDepth(100);
    this.dialogueContainer = container;

    const panel = this.add.rectangle(CANVAS_W / 2, panelY, 600, 280, 0x10101c, 0.94).setStrokeStyle(2, mentor.strokeColor);
    container.add(panel);

    const avatar = mentor.avatar(this);
    avatar.setPosition(CANVAS_W / 2, panelY - 90);
    container.add(avatar);
    this.tweens.add({ targets: avatar, y: panelY - 82, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    playMentorChime();

    const intro = this.add
      .text(CANVAS_W / 2, panelY - 44, `"${mentor.quote}"`, {
        fontSize: '12px',
        fontStyle: 'italic',
        color: '#cfd8ff',
        align: 'center',
        wordWrap: { width: 520 },
      })
      .setOrigin(0.5, 0);
    container.add(intro);

    const note = this.add
      .text(CANVAS_W / 2, panelY + 26, `${mentor.name} has nothing to teach you yet -- more to come.`, {
        fontSize: '11px',
        color: '#8fa0c9',
        align: 'center',
        wordWrap: { width: 480 },
      })
      .setOrigin(0.5, 0);
    container.add(note);

    this.renderFarewellFooter(container, panelY);
  }

  // Mirrors maybeAutoOpenGoalDialogue for the middle row every mentor now
  // stands on: reopens their panel both the first time the player reaches
  // the middle and again after every later round trip through BattleScene,
  // so it stays revisitable rather than a one-shot popup.
  private maybeAutoOpenMiddleDialogue() {
    if (!this.reachedMiddle || this.dialogueActive) return;
    const mentor = OverworldScene.WORLD_MENTORS[this.world];
    if (mentor?.tile === 'middle') this.openMentor(mentor);
  }

  // The Enter-key menu (DESIGN.md §4/§7 territory: quick access without
  // leaving the field) -- respects dialogueActive so it can't stack on top
  // of an encounter/shop panel already open, and only exists in the
  // overworld, not mid-battle.
  private togglePauseMenu() {
    if (this.dialogueActive) return;
    this.showPauseMenu();
  }

  private showPauseMenu() {
    this.dialogueActive = true;

    // Data-driven row list (rather than fixed hand-placed buttons) so an
    // optional row -- the debug-only "Warp" -- can be spliced in without
    // hand-recomputing every other button's y position.
    const rows: { label: string; onClick: () => void }[] = [
      {
        label: 'Return to Lab',
        onClick: () => {
          this.closeDialogue();
          this.scene.start('Hub');
        },
      },
      { label: 'View Moves', onClick: () => this.showMovesPanel() },
      { label: 'View Stats', onClick: () => this.showStatsPanel() },
      { label: 'Advisors', onClick: () => this.showAdvisorsPanel() },
      { label: 'Tutorial', onClick: () => this.showTutorial(0) },
      { label: 'Settings', onClick: () => this.showSettingsPanel() },
    ];
    if (this.isDebugMode()) {
      rows.push({ label: 'Warp (Debug)', onClick: () => this.showDebugWarpPanel() });
    }
    rows.push({ label: 'Close', onClick: () => this.closeDialogue() });

    // Vertically centered on the canvas (rather than a fixed panelY like
    // most other panels) and a tighter row spacing than the earlier
    // 5-6-row version needed, since the row count now regularly reaches 7-8
    // (Settings, and the debug-only Warp row) and a fixed low panelY would
    // otherwise push the panel's bottom edge past the canvas.
    const rowSpacing = 34;
    const panelY = CANVAS_H / 2;
    const panelHeight = 80 + rows.length * rowSpacing;
    const container = this.add.container(0, 0).setDepth(100);
    this.dialogueContainer = container;

    const panel = this.add.rectangle(CANVAS_W / 2, panelY, 320, panelHeight, 0x10101c, 0.95).setStrokeStyle(2, 0x8fa0c9);
    container.add(panel);

    const title = this.add
      .text(CANVAS_W / 2, panelY - panelHeight / 2 + 18, 'Menu', { fontSize: '15px', color: '#ffffff', fontStyle: 'bold' })
      .setOrigin(0.5, 0);
    container.add(title);

    const rowsTop = panelY - panelHeight / 2 + 54;
    rows.forEach((row, i) => {
      this.addDialogueButtonAt(container, CANVAS_W / 2, rowsTop + i * rowSpacing, row.label, row.onClick, 260);
    });
  }

  // Enter-menu "Settings" panel: currently just the one knob, wild-encounter
  // density (data/settings.ts's DENSITY_PRESETS, read by generateMap via
  // encounterChance()). One button cycles through the presets in place
  // (same rebuild-the-panel-on-click pattern as Noether's shop), rather than
  // a slider, since there are only four discrete steps.
  private showSettingsPanel() {
    this.dialogueContainer?.destroy(true);
    this.dialogueActive = true;

    const panelY = 300;
    const container = this.add.container(0, 0).setDepth(100);
    this.dialogueContainer = container;

    const panel = this.add.rectangle(CANVAS_W / 2, panelY, 380, 220, 0x10101c, 0.95).setStrokeStyle(2, 0x8fa0c9);
    container.add(panel);

    const title = this.add
      .text(CANVAS_W / 2, panelY - 90, 'Settings', { fontSize: '15px', color: '#ffffff', fontStyle: 'bold' })
      .setOrigin(0.5, 0);
    container.add(title);

    const currentIndex = this.encounterDensityIndex();
    const preset = DENSITY_PRESETS[currentIndex];
    this.addDialogueButtonAt(
      container,
      CANVAS_W / 2,
      panelY - 40,
      `Enemy Density: ${preset.label}`,
      () => {
        const next = DENSITY_PRESETS[(currentIndex + 1) % DENSITY_PRESETS.length];
        this.game.registry.set('encounterDensity', next.value);
        persistFromRegistry(this.game.registry);
        this.showSettingsPanel();
      },
      280
    );

    const hint = this.add
      .text(
        CANVAS_W / 2,
        panelY,
        'How often wild crystals appear along the path. Takes effect the next time a world map is generated (a fresh world entry or a rematch of one).',
        { fontSize: '11px', color: '#8fa0c9', align: 'center', wordWrap: { width: 330 }, lineSpacing: 4 }
      )
      .setOrigin(0.5, 0);
    container.add(hint);

    this.addDialogueButtonAt(container, CANVAS_W / 2, panelY + 70, 'Close', () => this.closeDialogue(), 260);
  }

  private encounterDensityIndex(): number {
    const value = this.encounterChance();
    const idx = DENSITY_PRESETS.findIndex((p) => p.value === value);
    if (idx !== -1) return idx;
    return DENSITY_PRESETS.findIndex((p) => p.value === DEFAULT_ENCOUNTER_DENSITY);
  }

  // Debug-mode-only (see applyDebugLeveling): jumps straight to any of the
  // 10 worlds from wherever the player currently is, regardless of
  // rivalDefeated progress -- the in-run counterpart to the Hub door's own
  // debug warp panel (HubScene.showWorldSelectPanel), for players who don't
  // want to backtrack to World 0 first.
  private showDebugWarpPanel() {
    this.dialogueContainer?.destroy(true);
    this.dialogueActive = true;

    const rowCount = 10;
    const panelHeight = 90 + rowCount * 30;
    const panelY = CANVAS_H / 2;
    const container = this.add.container(0, 0).setDepth(100);
    this.dialogueContainer = container;

    const panel = this.add
      .rectangle(CANVAS_W / 2, panelY, 360, panelHeight, 0x10101c, 0.96)
      .setStrokeStyle(2, 0xff4fd8);
    container.add(panel);

    const title = this.add
      .text(CANVAS_W / 2, panelY - panelHeight / 2 + 14, 'Debug: Warp to World', {
        fontSize: '14px',
        color: '#ff8fe0',
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 0);
    container.add(title);

    const rowsTop = panelY - panelHeight / 2 + 46;
    for (let w = 1; w <= rowCount; w++) {
      const name = WORLD_NAMES[w] ?? `World ${w}`;
      const label = w === this.world ? `World ${w} -- ${name} (current)` : `World ${w} -- ${name}`;
      const btn = this.addDialogueButtonAt(container, CANVAS_W / 2, rowsTop + (w - 1) * 30, label, () => {
        if (w === this.world) return;
        this.advanceToWorld(w);
      }, 320);
      if (w === this.world) btn.setAlpha(0.5);
    }

    this.addDialogueButtonAt(container, CANVAS_W / 2, rowsTop + rowCount * 30 + 8, 'Close', () => this.closeDialogue(), 260);
  }

  // Lists every mentor the player has met so far (registry `metMentors`,
  // grown by openMentor as middle tiles are reached), each row
  // reopening that mentor's own panel -- works from any world's scene, not
  // just the mentor's own, which is the whole point of putting this in the
  // Enter menu rather than only at their home tile.
  private showAdvisorsPanel() {
    this.dialogueContainer?.destroy(true);
    this.dialogueActive = true;

    const panelY = 300;
    const container = this.add.container(0, 0).setDepth(100);
    this.dialogueContainer = container;

    const panel = this.add.rectangle(CANVAS_W / 2, panelY, 320, 460, 0x10101c, 0.95).setStrokeStyle(2, 0xb98fea);
    container.add(panel);

    const title = this.add
      .text(CANVAS_W / 2, panelY - 210, 'Advisors', { fontSize: '15px', color: '#ffffff', fontStyle: 'bold' })
      .setOrigin(0.5, 0);
    container.add(title);

    const met = (this.game.registry.get('metMentors') as string[]) ?? [];
    const mentors = Object.values(OverworldScene.WORLD_MENTORS).filter(
      (m): m is MentorDef => !!m && met.includes(m.id)
    );

    if (mentors.length === 0) {
      const text = this.add
        .text(CANVAS_W / 2, panelY - 20, "You haven't met any advisors yet.", {
          fontSize: '13px',
          color: '#ffffff',
          align: 'center',
          wordWrap: { width: 260 },
        })
        .setOrigin(0.5, 0);
      container.add(text);
    } else {
      mentors.forEach((mentor, i) => {
        this.addDialogueButtonAt(
          container,
          CANVAS_W / 2,
          panelY - 170 + i * 32,
          mentor.name,
          () => {
            this.closeDialogue();
            this.openMentor(mentor);
          },
          260
        );
      });
    }

    this.addDialogueButtonAt(container, CANVAS_W / 2, panelY + 200, 'Close', () => this.closeDialogue(), 260);
  }

  private showMovesPanel() {
    this.dialogueContainer?.destroy(true);
    const battleMoves = new Set(getBattleMoves(this.game.registry));
    const lines = this.getUnlockedMoves().map((id) => {
      const move = MOVES[id];
      const usable = battleMoves.has(id);
      return `${move.name} (${move.class})${usable ? '' : ' -- not compatible with your current form'}`;
    });
    this.showInfoPanel('Your Moves', lines.join('\n'));
  }

  private showStatsPanel() {
    this.dialogueContainer?.destroy(true);
    const stats = getPlayerStats(this.game.registry);
    const body =
      `Quantumness: ${stats.quantumness}\nVelocity: ${stats.velocity}\nCorrelation: ${stats.correlation}\n\n` +
      `Qumatokens: ${this.qumatokens}\nCurrent form: ${this.playerMaterial.name}`;
    this.showInfoPanel('Your Stats', body);
  }

  private showInfoPanel(title: string, body: string) {
    this.dialogueActive = true;

    const panelY = 300;
    const container = this.add.container(0, 0).setDepth(100);
    this.dialogueContainer = container;

    const panel = this.add.rectangle(CANVAS_W / 2, panelY, 420, 300, 0x10101c, 0.95).setStrokeStyle(2, 0x8fa0c9);
    container.add(panel);

    const titleText = this.add
      .text(CANVAS_W / 2, panelY - 130, title, { fontSize: '15px', color: '#ffe066', fontStyle: 'bold' })
      .setOrigin(0.5, 0);
    container.add(titleText);

    const bodyText = this.add
      .text(CANVAS_W / 2, panelY - 95, body, {
        fontSize: '13px',
        color: '#cfd8ff',
        align: 'center',
        wordWrap: { width: 380 },
        lineSpacing: 6,
      })
      .setOrigin(0.5, 0);
    container.add(bodyText);

    this.addDialogueButtonAt(container, CANVAS_W / 2, panelY + 110, 'Close', () => this.closeDialogue(), 260);
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

  // Same "whole row counts, not a single tile" rule as maybeReachGoal,
  // applied to the mentor's mid-corridor row instead.
  private maybeReachMiddle(_x: number, y: number) {
    if (this.reachedMiddle || y !== this.midTile.y) return;
    this.reachedMiddle = true;
    this.saveMapState();
    this.maybeAutoOpenMiddleDialogue();
  }
}
