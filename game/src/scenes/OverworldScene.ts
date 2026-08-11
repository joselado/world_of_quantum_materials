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
import { makeDresselhausAvatar } from '../art/dresselhaus';
import { makeLaughlinAvatar } from '../art/laughlin';
import { makeMajoranaAvatar } from '../art/majorana';
import { makeCurieAvatar } from '../art/curie';
import { makeKondoAvatar } from '../art/kondo';
import { makeAndersonAvatar } from '../art/anderson';
import { playGuardianChime } from '../audio/sfx';
import { project, fogColor, HORIZON_Y, CANVAS_W, CANVAS_H, ProjectedPoint } from '../art/perspective';
import {
  PLAYER_MATERIAL,
  WORLD_NAMES,
  getWildPool,
  getRival,
  MOVES,
  SHOP_MOVE_IDS,
  ANALYTIC_MOVE_IDS,
  KONDO_MOVE_IDS,
  compatibleMoves,
  getPlayerMaterial,
  getPlayerStats,
  getBattleMoves,
  findMaterialByName,
  allCrystals,
  isCompositeMaterial,
  combineMaterials,
  hybridRecipeResult,
  statUpgradeCost,
  enemyStatsForWorld,
  DEFAULT_STATS,
} from '../data/materials';
import { PASSIVES, LAUGHLIN_PASSIVE_IDS, BOHR_PASSIVE_IDS } from '../data/passives';
import { tokenColorForValue } from '../data/tokens';
import { getMaterialQuestion } from '../data/quiz';
import { encounterGreeting } from '../data/greetings';
import { TUTORIAL_PAGES, TUTORIAL_TIPS, hasSeenTip, markTipSeen } from '../data/tutorial';
import type { TutorialTipId } from '../data/tutorial';
import { STORY_BEATS } from '../data/story';
import { DENSITY_PRESETS, DEFAULT_ENCOUNTER_DENSITY, FONT_SCALE_PRESETS, DEFAULT_FONT_SCALE } from '../data/settings';
import { persistFromRegistry } from '../data/save';
import type { DiscoveredMaterial } from '../data/save';
import type { Material, MaterialType, Move, Stats } from '../data/types';
import { generateWorldMap } from '../world/mapgen';
import type { GridPoint } from '../world/mapgen';
import { fontPx, fontScale } from '../ui/text';
import { music } from '../audio/music';

// Snapshot of an in-progress map, stashed in the game registry so a round
// trip through BattleScene resumes exactly where the player left off instead
// of generating (and spawning onto) a brand new random map. Only cleared
// when the scene is (re)created with `regenerate: true` -- an explicit
// world change via the Hub door, Bloch's teleport, or a debug warp -- which
// is the one situation meant to generate a fresh layout.
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
// bounds Bloch's teleport offers (a "visited" world the player can't
// actually walk isn't a real destination), including the Superposition-Mode
// case where every one of them is marked visited from the start. All
// 10 worlds are built as of DESIGN.md's "full build-out" pass. Exported so
// data/integrity.ts can assert every entry here actually has a biome and a
// rival.
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

// One entry per world with a guardian -- replaces the old per-guardian
// `spawnXSprite`/`this.world === N` branches with a single data-driven
// dispatch (spawnGuardianSprite/openGuardian), the same "reusable rather than
// per-world bespoke" approach the map generator and biome table already
// use. Every guardian sets `open` explicitly: Noether (shop), Bloch
// (teleport hub), Dresselhaus (transmutation), Laughlin (passive abilities),
// Majorana (hybrid materials), Curie (analytic moves), Bohr (passive
// abilities), Kondo (screening moves), Anderson (impurity doping). A future
// guardian added with no mechanic yet can still leave `open` unset and fall
// through to the shared showGuardianLore panel below.
interface GuardianDef {
  id: string;
  name: string;
  labelColor: string;
  strokeColor: number;
  quote: string;
  avatar: (scene: Phaser.Scene, scale?: number) => Phaser.GameObjects.Container;
  // Every guardian now stands mid-corridor ('middle', see DESIGN.md §5) so the
  // goal tile is free for that world's boss avatar (spawnBossSprite) --
  // 'start'/'goal' stay valid tile choices for a future guardian, but nothing
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
  // machinery as crystals and tokens (spawnGuardianSprite) so a guardian is a
  // visible, wandering landmark standing on the map rather than only
  // appearing once their dialogue triggers.
  private guardianSprites: WorldSprite[] = [];
  // 0 or 1 entries -- this world's rival/boss (if built), a purely visual
  // landmark standing at the goal tile now that guardians have moved to the
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
  // Majorana's combine panel (§5): the first crystal picked, while the panel
  // rebuilds to ask for the second -- null means "no combine in progress,
  // show the initial pick list." Reset on every fresh scene create and every
  // closeDialogue() so a stale first pick can't survive a cancel-and-reopen.
  private majoranaSelection: string | null = null;
  // Dresselhaus's transmute list and Majorana's per-step combine list both
  // paginate (Superposition Mode's candidate pool is every crystal in the
  // game, far more than one panel can show at once) -- same reset rules as
  // majoranaSelection above, plus a reset whenever majoranaSelection itself
  // changes (see showMajoranaPanel) so switching steps starts back on page 0.
  private dresselhausPage = 0;
  private majoranaPage = 0;
  // Anderson's impurity-doping panel (§5, World 9): the host crystal picked
  // to "dope in," while the panel rebuilds to ask which one of its moves to
  // learn -- null means "no doping in progress, show the host pick list."
  // Same reset/pagination rules as majoranaSelection/majoranaPage above.
  private andersonSelection: string | null = null;
  private andersonPage = 0;
  // Bloch's teleport hub (§5, World 2): paginated for the same reason as
  // Dresselhaus/Majorana/Anderson above -- Superposition Mode pre-seeds every
  // built world as visited, so a well-traveled player is no longer the rare
  // case Bloch's own destination list has to handle, it's the common one
  // (up to 9 destinations at once). Same reset rules.
  private blochPage = 0;

  // One entry per world with a guardian (see GuardianDef above). A static field
  // initializer is still lexically inside the class body, so `s.showX()`
  // below can call other private methods even though `s` is just a
  // same-typed parameter, not `this`.
  private static readonly WORLD_GUARDIANS: Partial<Record<number, GuardianDef>> = {
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
      id: 'dresselhaus',
      name: 'Dresselhaus',
      labelColor: '#6ee8ba',
      strokeColor: 0x4ad9a0,
      quote: 'Every crystal you have defeated is a spin-orbit texture you now understand well enough to wear.',
      avatar: makeDresselhausAvatar,
      tile: 'middle',
      open: (s) => s.showDresselhausPanel(),
    },
    4: {
      id: 'laughlin',
      name: 'Laughlin',
      labelColor: '#8fa0ff',
      strokeColor: 0x6a7fff,
      quote:
        'Take an electron liquid in a strong enough field and it condenses into something new -- excite it, and the charge that peels off is a fraction of an electron, not a whole one.',
      avatar: makeLaughlinAvatar,
      tile: 'middle',
      open: (s) => s.showLaughlinPanel(),
    },
    5: {
      id: 'majorana',
      name: 'Majorana',
      labelColor: '#9fffb0',
      strokeColor: 0x4fd97a,
      quote: 'Split one fermion into two halves, each its own antiparticle, and see what a superconductor can hide at its edge.',
      avatar: makeMajoranaAvatar,
      tile: 'middle',
      open: (s) => s.showMajoranaPanel(),
    },
    6: {
      id: 'curie',
      name: 'Curie',
      labelColor: '#d9e86a',
      strokeColor: 0xc9d84a,
      quote: 'Every magnet has a temperature where its order gives up -- above it, the same atoms, no memory of which way is up.',
      avatar: makeCurieAvatar,
      tile: 'middle',
      open: (s) => s.showCuriePanel(),
    },
    7: {
      id: 'bohr',
      name: 'Bohr',
      labelColor: '#ffa64a',
      strokeColor: 0xffa64a,
      quote: 'Measure one half of an entangled pair and the other answers instantly -- not by any signal crossing the distance, but because the two were never separately real to begin with.',
      avatar: makeBohrAvatar,
      tile: 'middle',
      open: (s) => s.showBohrPanel(),
    },
    8: {
      id: 'kondo',
      name: 'Kondo',
      labelColor: '#ff8f6a',
      strokeColor: 0xe86a44,
      quote: 'A single stray spin, screened by a sea of conduction electrons until it all but disappears at low temperature.',
      avatar: makeKondoAvatar,
      tile: 'middle',
      open: (s) => s.showKondoPanel(),
    },
    9: {
      id: 'anderson',
      name: 'Anderson',
      labelColor: '#e8b27a',
      strokeColor: 0xc9884a,
      quote: 'Enough disorder and a wave stops spreading at all -- it localizes, trapped by the very randomness that surrounds it.',
      avatar: makeAndersonAvatar,
      tile: 'middle',
      open: (s) => s.showAndersonPanel(),
    },
    // 10: none -- the finale is the final boss only, no guardian waiting there.
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
    // so a dialogue left open when the player switches away (H to return to
    // the Lab, a debug warp, Bloch's teleport -- all skip straight to
    // scene.start without closing whatever's open first) would otherwise
    // leave dialogueActive stuck true forever on this instance, freezing
    // movement (update()'s dialogueActive guard) and the pause menu on
    // every future visit. Any stale reference to the old (now-destroyed)
    // panel container needs clearing too.
    this.dialogueActive = false;
    this.dialogueContainer = undefined;
    this.majoranaSelection = null;
    this.dresselhausPage = 0;
    this.majoranaPage = 0;
    this.andersonSelection = null;
    this.andersonPage = 0;
    this.blochPage = 0;
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
    this.spawnGuardianSprite();
    this.spawnBossSprite();
    music.play(`overworld:${this.world}`);

    this.qumatokens = (state.get('qumatokens') as number) || 0;
    this.playerMaterial = getPlayerMaterial(state);
    this.applySuperpositionLeveling();
    this.shopTab = 'moves';
    this.recordVisit();

    // Corner HUD block: world name stacked above the token counter (running
    // `y`, the name's own wordWrap-driven height advancing it) rather than
    // sharing one row, since a long world name (e.g. world 5's "Frozen
    // Zero-Resistance Caverns") or a big text-size setting can each push it
    // to wrap onto two lines and collide with a fixed-position counter. The
    // key-hint lines that used to live here (movement, M/H/Enter) were
    // dropped in favor of the Enter-menu's Tutorial pages, which already
    // cover all of it (data/tutorial.ts) -- a permanent on-screen reminder
    // was redundant with a replayable one, and doubled the overflow risk
    // every long world name or big text size already put on this corner.
    const worldName = WORLD_NAMES[this.world] ?? `World ${this.world}`;
    let hudY = 8;
    const worldNameText = this.add
      .text(8, hudY, `World ${this.world} -- ${worldName}`, {
        fontSize: fontPx(this, 16),
        color: '#ffffff',
        backgroundColor: 'rgba(0,0,0,0.35)',
        padding: { x: 4, y: 2 },
        wordWrap: { width: CANVAS_W - 16 },
      })
      .setDepth(50);
    hudY += worldNameText.height + 4;
    this.tokenText = this.add
      .text(CANVAS_W - 8, hudY, `Qumatokens: ${this.qumatokens}`, {
        fontSize: fontPx(this, 14),
        color: '#ffe066',
        backgroundColor: 'rgba(0,0,0,0.35)',
        padding: { x: 4, y: 2 },
      })
      .setOrigin(1, 0)
      .setDepth(50);
    this.goalText = this.add
      .text(CANVAS_W / 2, 90, 'You reached the far edge of this world!', {
        fontSize: fontPx(this, 14),
        color: '#ffffff',
        backgroundColor: 'rgba(0,0,0,0.5)',
        padding: { x: 6, y: 4 },
      })
      .setOrigin(0.5, 0)
      .setDepth(50)
      .setVisible(this.reachedGoal);

    // The player is a crystal too, not a trainer commanding one -- the
    // overworld avatar is just the player's current form (playerMaterial,
    // Silicon by default or whatever Dresselhaus transmuted them into) rendered
    // the same way a wild crystal is, floating and bobbing rather than
    // walking.
    this.player = this.add.container(CANVAS_W / 2, 400);
    const playerShadow = this.add.ellipse(0, 34, 34, 11, 0x000000, 0.28);
    this.playerCrystalGfx = makeCrystal(this, PLAYER_CRYSTAL_SIZE, this.playerMaterial.color, this.playerMaterial.variant, {
      seed: this.playerMaterial.name,
      hybrid: this.playerMaterial.hybridParents,
    });
    this.player.add([playerShadow, this.playerCrystalGfx]);
    this.player.setDepth(40);
    this.idleBob();

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.input.keyboard!.on('keydown-M', () => music.toggleMute());
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
      state.set('hybridMaterials', []);
      state.set('metGuardians', []);
      state.set('kondoActiveMove', null);
      state.set('laughlinPassivesUnlocked', []);
      state.set('laughlinActivePassive', null);
      state.set('bohrPassivesUnlocked', []);
      state.set('bohrActivePassive', null);
    }

    this.maybeAutoOpenGoalDialogue();
    this.maybeAutoOpenMiddleDialogue();
    // Same "don't stack on top of an already-open panel" guard the old
    // first-run tutorial used -- the player's starting tile is never on the
    // goal/middle row, so this only actually skips in practice if a future
    // change moves the start closer to either.
    if (!this.dialogueActive) this.showTutorialTip('controls');
  }

  private isSuperpositionMode(): boolean {
    return !!this.game.registry.get('superpositionMode');
  }

  // Superposition Mode (Title screen toggle, data/save.ts's `superpositionMode`):
  // re-levels the player to a fair footing for whatever world this scene
  // just entered, on every entry -- not just the Hub door's initial jump, so
  // Continue-to-next-world and Bloch's teleport stay competitive too. A flat
  // +2 over enemyStatsForWorld keeps the player slightly ahead rather than
  // exactly even. Also grants every move (so there's always something to
  // fight with regardless of what's been bought), a full heal, and marks
  // every built world visited so Bloch's teleport hub (showBlochHub, gated
  // on `visitedWorlds`) offers all of them immediately -- this is what makes
  // Bloch alone sufficient for world-to-world movement in this mode, with no
  // separate warp panel needed.
  private applySuperpositionLeveling() {
    if (!this.isSuperpositionMode()) return;
    const target = enemyStatsForWorld(this.world);
    const stats: Stats = {
      quantumness: target.quantumness + 2,
      velocity: target.velocity + 2,
      correlation: target.correlation + 2,
    };
    this.game.registry.set('playerStats', stats);
    this.game.registry.set('unlockedMoves', Object.keys(MOVES));
    this.game.registry.set('playerHp', this.playerMaterial.maxHp);
    const visited = this.getVisitedWorlds();
    const merged = Array.from(new Set([...visited, ...BUILT_WORLDS]));
    this.game.registry.set('visitedWorlds', merged);
    // Granting every move (above) would otherwise leave Kondo's three stuck
    // invisible in battle -- getBattleMoves only ever surfaces whichever one
    // is `kondoActiveMove`, and that field isn't touched by the "learn
    // everything" grant above. Only seed it if nothing's active yet, so a
    // player who already picked one via showKondoPanel keeps that choice
    // across re-levels.
    if (!this.game.registry.get('kondoActiveMove')) {
      this.game.registry.set('kondoActiveMove', KONDO_MOVE_IDS[0]);
    }
    // Laughlin/Bohr's passives (data/passives.ts): unlock every passive
    // outright (mirrors the unconditional unlockedMoves grant above -- there's
    // no per-form gate to respect the way ordinary moves have), but only seed
    // an active pick if nothing's chosen yet, same reasoning as
    // kondoActiveMove just above -- a deliberate pick made via
    // showLaughlinPanel/showBohrPanel should survive every later re-level.
    this.game.registry.set('laughlinPassivesUnlocked', [...LAUGHLIN_PASSIVE_IDS]);
    if (!this.game.registry.get('laughlinActivePassive')) {
      this.game.registry.set('laughlinActivePassive', LAUGHLIN_PASSIVE_IDS[0]);
    }
    this.game.registry.set('bohrPassivesUnlocked', [...BOHR_PASSIVE_IDS]);
    if (!this.game.registry.get('bohrActivePassive')) {
      this.game.registry.set('bohrActivePassive', BOHR_PASSIVE_IDS[0]);
    }
    persistFromRegistry(this.game.registry);
  }

  // Contextual onboarding (data/tutorial.ts's TUTORIAL_TIPS): each tip fires
  // once per save, the moment its own feature actually becomes relevant --
  // see the call sites in maybeTriggerEncounter (encounter), startBattle
  // (battle), maybeCollectToken (qumatoken), openGuardian (guardian), and
  // maybeAutoOpenGoalDialogue (goal), plus the 'controls' call right above
  // this method. `onClose` is whatever the caller was about to do next (open
  // the encounter panel, launch the battle, ...) -- it always still runs,
  // either immediately (tip already seen) or after the player dismisses the
  // popup (first time), so callers don't need their own seen/unseen branch.
  private showTutorialTip(id: TutorialTipId, onClose?: () => void) {
    if (hasSeenTip(this.game.registry, id)) {
      onClose?.();
      return;
    }
    markTipSeen(this.game.registry, id);
    persistFromRegistry(this.game.registry);
    this.renderTutorialTipPopup(TUTORIAL_TIPS[id], onClose);
  }

  // A single-page version of renderTutorialPage below (no counter/Back/Next,
  // just a "Got it" button) -- content laid out top-down first, panel sized/
  // inserted behind it afterward, same pattern as every other panel here.
  private renderTutorialTipPopup(page: (typeof TUTORIAL_TIPS)[TutorialTipId], onClose?: () => void) {
    this.dialogueContainer?.destroy(true);
    this.dialogueActive = true;

    const panelWidth = 520;
    const top = 60;
    const container = this.add.container(0, 0).setDepth(100);
    this.dialogueContainer = container;

    let y = top;
    const title = this.add
      .text(CANVAS_W / 2, y, page.title, {
        fontSize: fontPx(this, 16),
        color: '#ffffff',
        fontStyle: 'bold',
        align: 'center',
        wordWrap: { width: panelWidth - 60 },
      })
      .setOrigin(0.5, 0);
    container.add(title);
    y += title.height + 12;

    const body = this.add
      .text(CANVAS_W / 2, y, page.body, {
        fontSize: fontPx(this, 12),
        color: '#cfd8ff',
        align: 'center',
        wordWrap: { width: panelWidth - 60 },
        lineSpacing: 5,
      })
      .setOrigin(0.5, 0);
    container.add(body);
    y += body.height + 18;

    const gotIt = this.addDialogueButtonAt(
      container,
      CANVAS_W / 2,
      y,
      'Got it',
      () => {
        this.closeDialogue();
        onClose?.();
      },
      140
    );
    y += gotIt.height + 14;

    const panelHeight = y - top;
    const panel = this.add
      .rectangle(CANVAS_W / 2, top + panelHeight / 2, panelWidth, panelHeight, 0x10101c, 0.95)
      .setStrokeStyle(2, 0x5ad9ff);
    container.addAt(panel, 0);
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

  // Content is laid out top-down first (running `y`, each line's own
  // wordWrap-driven height advancing it), and the backing panel sized/
  // inserted behind everything afterward -- same pattern as
  // showSettingsPanel, needed here for the same reason: page title/body
  // length varies, and so does the text-size setting they're rendered at.
  private renderTutorialPage() {
    this.dialogueContainer?.destroy(true);

    const panelWidth = 560;
    const top = 34;
    const container = this.add.container(0, 0).setDepth(100);
    this.dialogueContainer = container;

    let y = top;

    const page = TUTORIAL_PAGES[this.tutorialIndex];
    const counter = this.add
      .text(CANVAS_W / 2, y, `TUTORIAL -- ${this.tutorialIndex + 1} / ${TUTORIAL_PAGES.length}`, {
        fontSize: fontPx(this, 11),
        color: '#5ad9ff',
      })
      .setOrigin(0.5, 0);
    container.add(counter);
    y += counter.height + 8;

    const title = this.add
      .text(CANVAS_W / 2, y, page.title, {
        fontSize: fontPx(this, 16),
        color: '#ffffff',
        fontStyle: 'bold',
        align: 'center',
        wordWrap: { width: panelWidth - 60 },
      })
      .setOrigin(0.5, 0);
    container.add(title);
    y += title.height + 12;

    const body = this.add
      .text(CANVAS_W / 2, y, page.body, {
        fontSize: fontPx(this, 12),
        color: '#cfd8ff',
        align: 'center',
        wordWrap: { width: panelWidth - 60 },
        lineSpacing: 5,
      })
      .setOrigin(0.5, 0);
    container.add(body);
    y += body.height + 18;

    const footerY = y;
    const isFirst = this.tutorialIndex === 0;
    const isLast = this.tutorialIndex === TUTORIAL_PAGES.length - 1;

    let footerHeight = 0;
    if (!isFirst) {
      const back = this.addDialogueButtonAt(
        container,
        CANVAS_W / 2 - 170,
        footerY,
        '<- Back',
        () => {
          this.tutorialIndex -= 1;
          this.renderTutorialPage();
        },
        130
      );
      footerHeight = Math.max(footerHeight, back.height);
    }
    const mid = this.addDialogueButtonAt(
      container,
      CANVAS_W / 2,
      footerY,
      isLast ? 'Done' : 'Skip',
      () => this.closeDialogue(),
      100
    );
    footerHeight = Math.max(footerHeight, mid.height);
    if (!isLast) {
      const next = this.addDialogueButtonAt(
        container,
        CANVAS_W / 2 + 170,
        footerY,
        'Next ->',
        () => {
          this.tutorialIndex += 1;
          this.renderTutorialPage();
        },
        130
      );
      footerHeight = Math.max(footerHeight, next.height);
    }
    y = footerY + footerHeight + 14;

    const panelHeight = y - top;
    const panel = this.add
      .rectangle(CANVAS_W / 2, top + panelHeight / 2, panelWidth, panelHeight, 0x10101c, 0.95)
      .setStrokeStyle(2, 0x5ad9ff);
    container.addAt(panel, 0);
  }

  // Fresh random layout -- used on first load and whenever the player
  // explicitly changes worlds (Hub door, Bloch's teleport, a debug warp),
  // which is the one action meant to reshuffle the map.
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
    this.updateWorldSprites(this.guardianSprites);
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

        if (walkable) {
          const color = fogColor(this.biome.path, depthRatio, this.biome.fogTarget);
          g.fillStyle(color, 1);
          g.fillPoints([pFL, pFR, pNR, pNL], true);
          g.lineStyle(1, shade(color, -20), 0.3);
          g.strokePoints([pFL, pFR, pNR, pNL], true);
          if (depthRatio < 0.75 && this.flowerMap[y]?.[x]) {
            this.decorateTile(g, pFL, pFR, pNR, pNL);
          }
        } else {
          this.drawOffPathTile(g, x, y, pFL, pFR, pNR, pNL, depthRatio);
        }
      }
    }
  }

  // Dispatches an off-path tile's look by the current biome's `wallTheme`
  // (art/biomes.ts) -- most biomes stay 'rock' (raised stacked-stone block,
  // the original look), but a few render terrain you can plausibly see is
  // impassable instead of a uniformly-colored wall: 'lava' (a flat glowing
  // molten crust), 'water' (a dark rippling frozen lake), 'void' (open sky
  // you'd fall through). Only 'rock' extrudes a solid block; the other three
  // are flush with the ground plane, since a wall of lava/water/open air
  // isn't a raised stone block.
  private drawOffPathTile(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    pFL: ProjectedPoint,
    pFR: ProjectedPoint,
    pNR: ProjectedPoint,
    pNL: ProjectedPoint,
    depthRatio: number
  ) {
    const theme = this.biome.wallTheme;
    if (theme === 'lava') {
      this.drawLavaTile(g, pFL, pFR, pNR, pNL, depthRatio);
      return;
    }
    if (theme === 'water') {
      this.drawWaterTile(g, pFL, pFR, pNR, pNL, depthRatio);
      return;
    }
    if (theme === 'void') {
      this.drawVoidTile(g, x, y, pFL, pFR, pNR, pNL, depthRatio);
      return;
    }

    const color = fogColor(this.biome.ground, depthRatio, this.biome.fogTarget);
    g.fillStyle(color, 1);
    g.fillPoints([pFL, pFR, pNR, pNL], true);
    g.lineStyle(1, shade(color, -20), 0.3);
    g.strokePoints([pFL, pFR, pNR, pNL], true);
    this.drawWallFaces(g, x, y, pFL, pFR, pNR, pNL, color);
  }

  // A flat, glowing molten crust (Defect Wastes, world 9) -- no extruded
  // block, since lava is a hazard you'd sink into, not a wall you'd bump
  // into. The crack/glow overlay is skipped past depthRatio 0.75 (same gate
  // `decorateTile` uses) so distant tiles stay a cheap flat fill rather than
  // paying the animated-detail cost for the couple hundred off-path tiles a
  // single frame can contain.
  private drawLavaTile(
    g: Phaser.GameObjects.Graphics,
    pFL: ProjectedPoint,
    pFR: ProjectedPoint,
    pNR: ProjectedPoint,
    pNL: ProjectedPoint,
    depthRatio: number
  ) {
    const crust = fogColor(this.biome.ground, depthRatio, this.biome.fogTarget);
    g.fillStyle(crust, 1);
    g.fillPoints([pFL, pFR, pNR, pNL], true);
    if (depthRatio > 0.75) return;

    const cx = (pFL.x + pFR.x + pNR.x + pNL.x) / 4;
    const cy = (pFL.y + pFR.y + pNR.y + pNL.y) / 4;
    const s = pNL.scale;
    const pulse = 0.55 + 0.45 * Math.sin(this.time.now / 260 + cx * 0.05 + cy * 0.03);

    g.fillStyle(0xff5a1a, 0.32 * pulse);
    g.fillPoints([pFL, pFR, pNR, pNL], true);

    g.lineStyle(1.6, 0xffcf4a, 0.7 * pulse);
    g.beginPath();
    g.moveTo(cx - 2.6 * s, cy - 1.2 * s);
    g.lineTo(cx - 0.4 * s, cy + 0.6 * s);
    g.lineTo(cx + 1.6 * s, cy - 0.8 * s);
    g.strokePath();

    g.fillStyle(0xfff0a0, 0.55 * pulse);
    g.fillCircle(cx, cy, 1.1 * s * pulse);
  }

  // A dark, rippling frozen lake (Frozen Caverns, world 5) -- flush with the
  // ground, same "not a wall block" reasoning as lava above.
  private drawWaterTile(
    g: Phaser.GameObjects.Graphics,
    pFL: ProjectedPoint,
    pFR: ProjectedPoint,
    pNR: ProjectedPoint,
    pNL: ProjectedPoint,
    depthRatio: number
  ) {
    const base = fogColor(this.biome.ground, depthRatio, this.biome.fogTarget);
    g.fillStyle(base, 1);
    g.fillPoints([pFL, pFR, pNR, pNL], true);
    if (depthRatio > 0.75) return;

    const cx = (pFL.x + pFR.x + pNR.x + pNL.x) / 4;
    const cy = (pFL.y + pFR.y + pNR.y + pNL.y) / 4;
    const s = pNL.scale;
    const shimmer = 0.4 + 0.35 * Math.sin(this.time.now / 420 + cx * 0.04);

    g.lineStyle(1, 0xcdeeff, 0.35 * shimmer);
    g.lineBetween(cx - 2.4 * s, cy - 0.4 * s, cx + 2.4 * s, cy - 0.9 * s);
    g.lineBetween(cx - 2 * s, cy + 0.6 * s, cx + 2 * s, cy + 0.2 * s);

    g.fillStyle(0xffffff, 0.2 * shimmer);
    g.fillEllipse(cx - 0.6 * s, cy - 0.5 * s, 2.4 * s, 0.6 * s);
  }

  // Open sky/chasm (Floating Islands, world 3) -- deliberately no ground
  // fill at all: the static sky/hill gradient `drawSky()` paints once behind
  // `worldGfx` shows through, so stepping off the island reads as open air
  // rather than a solid tile in a different color. Only the edge shared with
  // a walkable neighbor gets a glowing rail -- the drop-off itself -- since a
  // void tile with no walkable neighbor needs nothing drawn at all.
  private drawVoidTile(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    pFL: ProjectedPoint,
    pFR: ProjectedPoint,
    pNR: ProjectedPoint,
    pNL: ProjectedPoint,
    depthRatio: number
  ) {
    const edgeAlpha = 1 - depthRatio * 0.6;
    const rail = (a: ProjectedPoint, b: ProjectedPoint) => {
      g.lineStyle(6, 0xbfe3ff, 0.16 * edgeAlpha);
      g.lineBetween(a.x, a.y, b.x, b.y);
      g.lineStyle(2, 0xeaf6ff, 0.85 * edgeAlpha);
      g.lineBetween(a.x, a.y, b.x, b.y);
    };
    if (this.walkable[y + 1]?.[x]) rail(pNL, pNR);
    if (this.walkable[y - 1]?.[x]) rail(pFR, pFL);
    if (this.walkable[y]?.[x - 1]) rail(pFL, pNL);
    if (this.walkable[y]?.[x + 1]) rail(pNR, pFR);
  }

  // Off-path tiles read as raised, solid blocks rather than just
  // differently-colored flat ground -- for every edge a wall tile shares
  // with a walkable neighbor, extrude a vertical face there (cheap
  // screen-space trick: shift the far end of the edge up by a fixed pixel
  // height scaled by that point's own perspective scale). Each face gets a
  // lit rim along its top edge and a darker mortar line partway up, so it
  // reads as a stacked stone block rather than a flat colored card. Only
  // called for the 'rock' wallTheme (see `drawOffPathTile`) -- lava/water/
  // void render their own flush-with-the-ground look instead.
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

        const container = makeCrystal(this, CRYSTAL_SIZE, material.color, material.variant, {
          seed: material.name,
          hybrid: material.hybridParents,
        });
        container.setDepth(20);

        const label = this.add
          .text(0, 0, material.name, {
            fontSize: fontPx(this, 11),
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
            fontSize: fontPx(this, 12),
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

  // This world's guardian (if any) stands (floats) mid-corridor as a visible
  // landmark, not just something that materializes once its dialogue opens
  // -- the player sees and walks up to them, the same way a wild encounter
  // is seen coming rather than sprung from nowhere. Every guardian uses
  // `tile: 'middle'` now (see WORLD_GUARDIANS/DESIGN.md §5), freeing the goal
  // tile for that world's boss (spawnBossSprite below); 'start'/'goal'
  // remain valid lookups here for any future guardian that wants them. Reuses
  // the crystal/token WorldSprite machinery (projection, wander, bob) so
  // they scroll and fade with the rest of the world for free.
  private spawnGuardianSprite() {
    this.guardianSprites = [];
    const guardian = OverworldScene.WORLD_GUARDIANS[this.world];
    if (!guardian) return;

    const avatar = guardian.avatar(this, 1.1);
    avatar.setDepth(20);

    const label = this.add
      .text(0, 0, guardian.name, {
        fontSize: fontPx(this, 11),
        color: guardian.labelColor,
        backgroundColor: 'rgba(0,0,0,0.45)',
        padding: { x: 3, y: 1 },
      })
      .setOrigin(0.5, 1)
      .setDepth(21);

    const tile = guardian.tile === 'start' ? this.startTile : guardian.tile === 'middle' ? this.midTile : this.goalTile;
    this.guardianSprites.push({ x: tile.x, y: tile.y, size: 42, container: avatar, label, seed: Math.random() * Math.PI * 2 });
  }

  // This world's rival/boss (getRival), standing at the goal tile as a
  // gigantic, unmissable-from-a-distance landmark -- purely visual (no
  // world has a WORLD_RIVALS gap, so this always finds one for a built
  // world). The actual fight still only starts from "Face the Rival" in the
  // goal gate panel (showGatePanel/showRivalEncounter); walking up to this
  // sprite doesn't trigger anything on its own, same as a guardian sprite.
  private spawnBossSprite() {
    this.bossSprites = [];
    const boss = getRival(this.world);
    if (!boss) return;

    const avatar = makeBossCrystal(this, BOSS_CRYSTAL_SIZE, boss.color, boss.variant);
    avatar.setDepth(20);

    const label = this.add
      .text(0, 0, boss.name, {
        fontSize: fontPx(this, 12),
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
    this.showTutorialTip('encounter', () => this.showEncounter(material));
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
  // Content laid out top-down first (running `y`, each element's own height
  // advancing it), panel sized/inserted behind everything afterward -- same
  // pattern as showSettingsPanel/renderTutorialPage, needed here because
  // this is the single most-seen dialogue in the game and both the
  // greeting and the physics question vary in length per material.
  private showEncounter(material: Material) {
    this.dialogueActive = true;

    const panelWidth = 600;
    const contentWidth = panelWidth - 60;
    const top = 20;
    const container = this.add.container(0, 0).setDepth(100);
    this.dialogueContainer = container;

    const crystalY = top + 34;
    const crystal = makeCrystal(this, 30, material.color, material.variant, {
      seed: material.name,
      hybrid: material.hybridParents,
    });
    crystal.setPosition(CANVAS_W / 2, crystalY);
    container.add(crystal);
    this.tweens.add({ targets: crystal, y: crystalY + 8, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    let y = crystalY + 40;

    const greeting = this.add
      .text(CANVAS_W / 2, y, encounterGreeting(material), {
        fontSize: fontPx(this, 12),
        fontStyle: 'italic',
        color: '#cfd8ff',
        align: 'center',
        wordWrap: { width: contentWidth },
      })
      .setOrigin(0.5, 0);
    container.add(greeting);
    y += greeting.height + 14;

    const question = getMaterialQuestion(material.name);
    if (question) {
      const prompt = this.add
        .text(CANVAS_W / 2, y, question.prompt, {
          fontSize: fontPx(this, 13),
          color: '#ffe066',
          align: 'center',
          wordWrap: { width: contentWidth },
        })
        .setOrigin(0.5, 0);
      container.add(prompt);
      y += prompt.height + 14;

      const options = Phaser.Utils.Array.Shuffle([
        { text: question.correct, correct: true },
        { text: question.incorrect, correct: false },
      ]);

      const btn1 = this.addDialogueButton(container, y, options[0].text, () =>
        this.startBattle(material, options[0].correct ? QUIZ_CORRECT_MULTIPLIER : QUIZ_WRONG_MULTIPLIER)
      );
      y += btn1.height + 8;
      const btn2 = this.addDialogueButton(container, y, options[1].text, () =>
        this.startBattle(material, options[1].correct ? QUIZ_CORRECT_MULTIPLIER : QUIZ_WRONG_MULTIPLIER)
      );
      y += btn2.height + 8;
      const btn3 = this.addDialogueButton(container, y, 'Let me pass', () => this.closeDialogue());
      y += btn3.height;
    } else {
      const btn1 = this.addDialogueButton(container, y, 'Fight!', () => this.startBattle(material, 1));
      y += btn1.height + 8;
      const btn2 = this.addDialogueButton(container, y, 'Let me pass', () => this.closeDialogue());
      y += btn2.height;
    }
    y += top;

    const panelHeight = y - top;
    const panel = this.add
      .rectangle(CANVAS_W / 2, top + panelHeight / 2, panelWidth, panelHeight, 0x10101c, 0.94)
      .setStrokeStyle(2, 0x444466);
    container.addAt(panel, 0);
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
    wrapWidth = 230,
    fontSizePxOverride?: string
  ) {
    const btn = this.add
      .text(x, y, label, {
        fontSize: fontSizePxOverride ?? fontPx(this, 13),
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
    this.showTutorialTip('battle', () => {
      this.closeDialogue();
      this.scene.start('Battle', { wild: material, world: this.world, attackMultiplier, isRival });
    });
  }

  // Closes whatever dialogue panel is open (wild encounter, the rival gate,
  // or Noether's shop) and lets the player carry on -- no scene change
  // either way.
  private closeDialogue() {
    this.dialogueContainer?.destroy(true);
    this.dialogueContainer = undefined;
    this.dialogueActive = false;
    this.majoranaSelection = null;
    this.dresselhausPage = 0;
    this.majoranaPage = 0;
    this.andersonSelection = null;
    this.andersonPage = 0;
    this.blochPage = 0;
  }

  private isRivalDefeated(): boolean {
    const rivalDefeated = (this.game.registry.get('rivalDefeated') as Record<number, boolean>) ?? {};
    return !!rivalDefeated[this.world];
  }

  // Reopens this world's goal gate panel (showGatePanel -- no guardian stands
  // here anymore, see WORLD_GUARDIANS' `tile: 'middle'`) every time this scene
  // is (re)created with the goal already reached -- both right after first
  // stepping onto the goal row and after any later round trip through
  // BattleScene (a wild fight fought near the goal, or the rival fight
  // itself resolving). Keeps the panel revisitable across multiple battles
  // instead of a single one-shot popup. Since the guardian is mid-corridor,
  // reached well before the goal, the player always has a chance to shop/
  // prep before ever facing the boss waiting here; the rival fight is what
  // "Continue to World N+1" triggers (see tryAdvanceToNextWorld).
  private maybeAutoOpenGoalDialogue() {
    if (!this.reachedGoal || this.dialogueActive) return;
    this.showTutorialTip('goal', () => this.openGoalGuardianPanel());
  }

  // Looks up this world's goal-tile guardian (if any) in WORLD_GUARDIANS and
  // opens their panel. No guardian currently uses `tile: 'goal'` -- every
  // guardian stands mid-corridor now (see WORLD_GUARDIANS) -- so this always
  // falls through to showGatePanel() in practice, which is exactly what a
  // world needs at its goal: a way to trigger the rival gate, or reaching
  // the goal would be a dead end with no way onward. Left branching on
  // `tile === 'goal'` rather than calling showGatePanel() directly so a
  // future guardian can still choose to stand at the goal instead.
  private openGoalGuardianPanel() {
    const guardian = OverworldScene.WORLD_GUARDIANS[this.world];
    if (guardian?.tile === 'goal') {
      this.openGuardian(guardian);
      return;
    }
    this.showGatePanel();
  }

  // Opens a guardian's panel and records the first time this guardian is met,
  // so the Guardians pause-menu list (showGuardiansPanel) grows as the player
  // reaches each world's middle tile -- regardless of which panel that
  // guardian actually shows (shop, teleport hub, transmutation, or lore).
  // `open` is only set on Noether/Bloch/Dresselhaus, whose panels are bespoke;
  // every other guardian falls through to the shared lore panel.
  private openGuardian(guardian: GuardianDef) {
    const met = (this.game.registry.get('metGuardians') as string[]) ?? [];
    if (!met.includes(guardian.id)) {
      this.game.registry.set('metGuardians', [...met, guardian.id]);
      persistFromRegistry(this.game.registry);
    }
    this.showTutorialTip('guardian', () => (guardian.open ?? ((s: OverworldScene) => s.showGuardianLore(guardian)))(this));
  }

  // Every world's goal panel now that no guardian stands there (they've all
  // moved mid-corridor) -- the boss looming at this same tile (spawnBossSprite)
  // is what's actually guarding the way, this panel is just enough text plus
  // the shared footer to reach the rival gate, so no built world is ever a
  // dead end.
  private showGatePanel() {
    this.dialogueActive = true;

    const panelWidth = 500;
    const top = 40;
    const container = this.add.container(0, 0).setDepth(100);
    this.dialogueContainer = container;

    let y = top;

    const text = this.add
      .text(CANVAS_W / 2, y, 'The path onward is still guarded.', {
        fontSize: fontPx(this, 14),
        color: '#ffffff',
        align: 'center',
        wordWrap: { width: panelWidth - 60 },
      })
      .setOrigin(0.5, 0);
    container.add(text);
    y += text.height + 24;

    y = this.renderShopFooter(container, y);
    y += 16;

    const panelHeight = y - top;
    const panel = this.add
      .rectangle(CANVAS_W / 2, top + panelHeight / 2, panelWidth, panelHeight, 0x10101c, 0.94)
      .setStrokeStyle(2, 0x8fa0c9);
    container.addAt(panel, 0);
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
      this.closeDialogue();
      this.showStoryBeat(this.world);
      return;
    }
    this.closeDialogue();
    this.showRivalEncounter();
  }

  // Decoherence-arc flavor shown once per world, between beating that
  // world's rival and actually stepping into the next one -- the connective
  // tissue DESIGN.md's plot hook otherwise only surfaces at the very start
  // (the tutorial's first page) and the very end (showFinalePanel). Falls
  // straight through to advanceToWorld if a world has no STORY_BEATS entry,
  // so a missing beat is never a dead end.
  private showStoryBeat(completedWorld: number) {
    const line = STORY_BEATS[completedWorld];
    if (!line) {
      this.advanceToWorld(completedWorld + 1);
      return;
    }

    this.dialogueActive = true;
    const panelY = 260;
    const container = this.add.container(0, 0).setDepth(100);
    this.dialogueContainer = container;

    const panel = this.add.rectangle(CANVAS_W / 2, panelY, 560, 200, 0x10101c, 0.96).setStrokeStyle(2, 0xd9a5ff);
    container.add(panel);

    const text = this.add
      .text(CANVAS_W / 2, panelY - 70, line, {
        fontSize: fontPx(this, 13),
        color: '#e6d9ff',
        align: 'center',
        wordWrap: { width: 500 },
      })
      .setOrigin(0.5, 0);
    container.add(text);

    this.addDialogueButtonAt(
      container,
      CANVAS_W / 2,
      panelY + 60,
      'Onward',
      () => {
        this.closeDialogue();
        this.advanceToWorld(completedWorld + 1);
      },
      200
    );
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
        fontSize: fontPx(this, 16),
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
        { fontSize: fontPx(this, 13), color: '#cfd8ff', align: 'center', wordWrap: { width: 480 } }
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
  // goal guardian first. Same in-map dialogue pattern as a wild encounter,
  // but with no "let me pass" option, since a gate that can be skipped
  // isn't a gate.
  private showRivalEncounter() {
    const rival = getRival(this.world);
    if (!rival) {
      // Safety net for a world with no WORLD_RIVALS entry yet -- don't
      // strand the player behind a gate that can't open.
      this.openGoalGuardianPanel();
      return;
    }

    this.dialogueActive = true;

    const panelWidth = 600;
    const top = 20;
    const container = this.add.container(0, 0).setDepth(100);
    this.dialogueContainer = container;

    let y = top;

    const crystalY = y + 34;
    const crystal = makeCrystal(this, 34, rival.color, rival.variant, { seed: rival.name });
    crystal.setPosition(CANVAS_W / 2, crystalY);
    container.add(crystal);
    this.tweens.add({ targets: crystal, y: crystalY + 10, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    y = crystalY + 44;

    const line = this.add
      .text(CANVAS_W / 2, y, `${rival.name} blocks the path onward. "You don't get past me that easily."`, {
        fontSize: fontPx(this, 12),
        fontStyle: 'italic',
        color: '#ffb3b3',
        align: 'center',
        wordWrap: { width: panelWidth - 80 },
      })
      .setOrigin(0.5, 0);
    container.add(line);
    y += line.height + 16;

    const battleBtn = this.addDialogueButton(container, y, 'Battle!', () => this.startBattle(rival, 1, true));
    y += battleBtn.height;
    y += 20;

    const panelHeight = y - top;
    const panel = this.add
      .rectangle(CANVAS_W / 2, top + panelHeight / 2, panelWidth, panelHeight, 0x10101c, 0.94)
      .setStrokeStyle(2, 0xff6666);
    container.addAt(panel, 0);
  }

  // Noether appears once the player reaches world 1's middle tile, selling
  // the other early moves and stat upgrades for qumatokens, in two tabs of
  // the same panel. Same in-map dialogue pattern as a wild encounter, but
  // with a guardian avatar and a shop list instead of a fight.
  // Content laid out top-down first (running `y`, each element's own
  // height advancing it), panel sized/inserted behind everything
  // afterward -- same pattern as showSettingsPanel. The intro quote used
  // to sit at a fixed offset from the avatar that assumed a short 1-line
  // render; at a bigger text-size setting it wraps to 3-4 lines and would
  // otherwise run straight into the tabs/rows below it.
  private showNoetherShop() {
    this.dialogueActive = true;

    const panelWidth = 600;
    const top = 20;
    const container = this.add.container(0, 0).setDepth(100);
    this.dialogueContainer = container;

    let y = top;

    const avatarY = y + 42;
    const avatar = makeNoetherAvatar(this);
    avatar.setPosition(CANVAS_W / 2, avatarY);
    container.add(avatar);
    this.tweens.add({ targets: avatar, y: avatarY + 8, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    playGuardianChime();
    y = avatarY + 48;

    const intro = this.add
      .text(
        CANVAS_W / 2,
        y,
        '"I am Noether. Every symmetry hides a conservation law -- spend your qumatokens on a new attack, or a sharper stat."',
        { fontSize: fontPx(this, 11), fontStyle: 'italic', color: '#cfd8ff', align: 'center', wordWrap: { width: panelWidth - 80 } }
      )
      .setOrigin(0.5, 0);
    container.add(intro);
    y += intro.height + 10;

    y = this.renderShopTabs(container, y);
    y += 6;

    y = this.shopTab === 'moves' ? this.renderShopMoves(container, y) : this.renderShopStats(container, y);
    y += 8;
    y = this.renderFarewellFooter(container, y);
    y += 8;

    const panelHeight = y - top;
    const panel = this.add
      .rectangle(CANVAS_W / 2, top + panelHeight / 2, panelWidth, panelHeight, 0x10101c, 0.94)
      .setStrokeStyle(2, 0xffe066);
    container.addAt(panel, 0);
  }

  private renderShopTabs(container: Phaser.GameObjects.Container, y: number): number {
    let maxHeight = 0;
    (['moves', 'stats'] as const).forEach((tab, i) => {
      const active = this.shopTab === tab;
      const btn = this.add
        .text(CANVAS_W / 2 + (i === 0 ? -45 : 45), y, tab === 'moves' ? 'Moves' : 'Stats', {
          fontSize: fontPx(this, 11),
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
      maxHeight = Math.max(maxHeight, btn.height);
    });
    return y + maxHeight;
  }

  private renderShopMoves(container: Phaser.GameObjects.Container, y: number): number {
    const unlocked = this.getUnlockedMoves();
    const compatible = new Set(compatibleMoves(this.playerMaterial));
    const forSale = SHOP_MOVE_IDS.filter((id) => !unlocked.includes(id) && compatible.has(id));
    const tokens = (this.game.registry.get('qumatokens') as number) || 0;

    if (forSale.length === 0) {
      const text = this.add
        .text(CANVAS_W / 2, y, "Nothing your current form can carry is left to teach.", {
          fontSize: fontPx(this, 13),
          color: '#ffffff',
          align: 'center',
          wordWrap: { width: 480 },
        })
        .setOrigin(0.5, 0);
      container.add(text);
      return y + text.height;
    }

    forSale.forEach((id) => {
      const move = MOVES[id];
      const cost = shopCost(move);
      const affordable = tokens >= cost;
      const btn = this.addDialogueButton(container, y, `${move.name} -- ${cost} qumatokens`, () => {
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
      y += btn.height + 3;
    });
    return y;
  }

  private renderShopStats(container: Phaser.GameObjects.Container, y: number): number {
    const stats = getPlayerStats(this.game.registry);
    const tokens = (this.game.registry.get('qumatokens') as number) || 0;
    const rows: { key: keyof Stats; label: string }[] = [
      { key: 'quantumness', label: 'Quantumness (crit chance)' },
      { key: 'velocity', label: 'Velocity (turn order)' },
      { key: 'correlation', label: 'Correlation (defense)' },
    ];

    rows.forEach((row) => {
      const value = stats[row.key];
      const cost = statUpgradeCost(value);
      const affordable = tokens >= cost;
      const btn = this.addDialogueButton(
        container,
        y,
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
      y += btn.height + 3;
    });
    return y;
  }

  // Fixed footer row (not stacked below the variable-length content above
  // it) so it never runs off the panel/canvas. showGatePanel's only caller
  // now that guardians stand mid-corridor instead of at the goal (see
  // renderFarewellFooter below for the guardian-panel equivalent) -- this is
  // deliberately the *only* place "Face the Rival"/"Continue" appears, so
  // reaching it requires actually walking to the goal where that world's
  // boss is waiting (spawnBossSprite), not just meeting the mid-corridor
  // guardian. Bloch's teleport, once Superposition Mode has pre-seeded every
  // world as visited, is the one path that still bypasses this gate
  // entirely (see applySuperpositionLeveling/rivalDefeated above).
  // Takes/returns the actual y the footer should render at (and ends at)
  // rather than deriving it from a fixed offset off a panel-center constant
  // -- callers now build their content top-down with a running `y` and
  // hand that straight in, so a footer never lands on top of whatever
  // variable-length content is above it.
  private renderShopFooter(container: Phaser.GameObjects.Container, footerY: number): number {
    const rivalDefeated = this.isRivalDefeated();
    const isLastWorld = this.world >= Math.max(...BUILT_WORLDS);
    const nextLabel = !rivalDefeated
      ? 'Face the Rival ->'
      : isLastWorld
      ? 'The Decoherence is stabilized ->'
      : `Continue to World ${this.world + 1} ->`;
    const a = this.addDialogueButtonAt(container, CANVAS_W / 2 - 118, footerY, 'Farewell', () => this.closeDialogue());
    const b = this.addDialogueButtonAt(container, CANVAS_W / 2 + 118, footerY, nextLabel, () => this.tryAdvanceToNextWorld());
    return footerY + Math.max(a.height, b.height);
  }

  // Mid-corridor guardian panels (every one but the goal's showGatePanel) only
  // need a way to close -- see renderShopFooter's comment for why the
  // Face-the-Rival/Continue action doesn't belong here anymore.
  private renderFarewellFooter(container: Phaser.GameObjects.Container, footerY: number): number {
    const btn = this.addDialogueButtonAt(container, CANVAS_W / 2, footerY, 'Farewell', () => this.closeDialogue(), 260);
    return footerY + btn.height;
  }

  // Curie stands at world 6's middle tile (WORLD_GUARDIANS) and sells the
  // analytic-class moves (data/materials.ts's ANALYTIC_MOVE_IDS, currently
  // Skyfall Beam/Ground Eruption) -- kept out of Noether's own shop
  // (SHOP_MOVE_IDS excludes them, see materials.ts's comment) so Curie is
  // their one source. Mirrors showNoetherShop's layout/structure, minus the
  // Moves/Stats tabs since she only ever has one thing to sell.
  private showCuriePanel() {
    this.dialogueActive = true;

    const panelWidth = 600;
    const top = 20;
    const container = this.add.container(0, 0).setDepth(100);
    this.dialogueContainer = container;

    let y = top;

    const avatarY = y + 45;
    const avatar = makeCurieAvatar(this);
    avatar.setPosition(CANVAS_W / 2, avatarY);
    container.add(avatar);
    this.tweens.add({ targets: avatar, y: avatarY + 8, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    playGuardianChime();
    y = avatarY + 55;

    const intro = this.add
      .text(
        CANVAS_W / 2,
        y,
        '"I am Curie. Learn the analytic side of the physics and I will teach you to strike by it -- answer right and the hit lands twice as hard, answer wrong and it barely lands at all."',
        { fontSize: fontPx(this, 11), fontStyle: 'italic', color: '#cfd8ff', align: 'center', wordWrap: { width: panelWidth - 80 } }
      )
      .setOrigin(0.5, 0);
    container.add(intro);
    y += intro.height + 14;

    y = this.renderCurieMoves(container, y);
    y += 8;
    y = this.renderFarewellFooter(container, y);
    y += 8;

    const panelHeight = y - top;
    const panel = this.add
      .rectangle(CANVAS_W / 2, top + panelHeight / 2, panelWidth, panelHeight, 0x10101c, 0.94)
      .setStrokeStyle(2, 0xc9d84a);
    container.addAt(panel, 0);
  }

  private renderCurieMoves(container: Phaser.GameObjects.Container, y: number): number {
    const unlocked = this.getUnlockedMoves();
    const compatible = new Set(compatibleMoves(this.playerMaterial));
    const forSale = ANALYTIC_MOVE_IDS.filter((id) => !unlocked.includes(id) && compatible.has(id));
    const tokens = (this.game.registry.get('qumatokens') as number) || 0;

    if (forSale.length === 0) {
      const text = this.add
        .text(CANVAS_W / 2, y, 'You already carry every analytic technique I can teach.', {
          fontSize: fontPx(this, 13),
          color: '#ffffff',
          align: 'center',
          wordWrap: { width: 480 },
        })
        .setOrigin(0.5, 0);
      container.add(text);
      return y + text.height;
    }

    forSale.forEach((id) => {
      const move = MOVES[id];
      const cost = shopCost(move);
      const affordable = tokens >= cost;
      const btn = this.addDialogueButton(container, y, `${move.name} -- ${cost} qumatokens`, () => {
        if ((this.game.registry.get('qumatokens') as number) < cost) return;
        this.qumatokens -= cost;
        this.game.registry.set('qumatokens', this.qumatokens);
        this.tokenText.setText(`Qumatokens: ${this.qumatokens}`);
        this.game.registry.set('unlockedMoves', [...this.getUnlockedMoves(), id]);
        persistFromRegistry(this.game.registry);
        this.dialogueContainer?.destroy(true);
        this.showCuriePanel();
      });
      if (!affordable) btn.setAlpha(0.5);
      y += btn.height + 3;
    });
    return y;
  }

  // Kondo stands at world 8's middle tile (WORLD_GUARDIANS) and sells the
  // three screening-class moves (data/materials.ts's KONDO_MOVE_IDS --
  // Screening Cloud/Heavy Fermion Drag/Kondo Breakdown, kept out of
  // Noether's and Curie's own lists so Kondo is their one source). Mirrors
  // showCuriePanel's layout, but with a 3-entry list where each bought move
  // gets its own "buy" or "switch active" row instead of Curie's flat
  // buy-only list -- see renderKondoMoves below for why: only one of the
  // three can ever be usable in battle at a time (registry/save
  // `kondoActiveMove`), so this panel is also the only place that switches
  // it, not just the one that sells them.
  private showKondoPanel() {
    this.dialogueActive = true;

    const panelWidth = 600;
    const top = 20;
    const container = this.add.container(0, 0).setDepth(100);
    this.dialogueContainer = container;

    let y = top;

    const avatarY = y + 42;
    const avatar = makeKondoAvatar(this);
    avatar.setPosition(CANVAS_W / 2, avatarY);
    container.add(avatar);
    this.tweens.add({ targets: avatar, y: avatarY + 8, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    playGuardianChime();
    y = avatarY + 48;

    const intro = this.add
      .text(
        CANVAS_W / 2,
        y,
        '"I am Kondo. A stray spin resolves into one of several scattering channels once conduction electrons screen it -- learn a channel, then tell me which one to tune. Only one can be tuned at a time; come back if you want a different one."',
        { fontSize: fontPx(this, 11), fontStyle: 'italic', color: '#cfd8ff', align: 'center', wordWrap: { width: panelWidth - 80 } }
      )
      .setOrigin(0.5, 0);
    container.add(intro);
    y += intro.height + 14;

    y = this.renderKondoMoves(container, y);
    y += 8;
    y = this.renderFarewellFooter(container, y);
    y += 8;

    const panelHeight = y - top;
    const panel = this.add
      .rectangle(CANVAS_W / 2, top + panelHeight / 2, panelWidth, panelHeight, 0x10101c, 0.94)
      .setStrokeStyle(2, 0xe86a44);
    container.addAt(panel, 0);
  }

  // Two sections, not Curie's flat buy-only list: still-unbought Kondo
  // moves the player's current form can host (same shopCost/afford/dim
  // treatment as every other shop) followed by every already-bought Kondo
  // move with a "make active"/dimmed-"(active)" row -- same dimmed-current
  // convention Dresselhaus/Majorana's "(current form)"/"(current form) again"
  // rows already use. Buying the very first Kondo move auto-activates it
  // (see the buy handler below) so a purchase is never immediately invisible
  // in battle; buying a second or third on top of an already-active one does
  // not -- switching between two-or-more already-bought moves is always its
  // own explicit "Make active" click.
  private renderKondoMoves(container: Phaser.GameObjects.Container, y: number): number {
    const unlocked = this.getUnlockedMoves();
    const compatible = new Set(compatibleMoves(this.playerMaterial));
    const forSale = KONDO_MOVE_IDS.filter((id) => !unlocked.includes(id) && compatible.has(id));
    const learned = KONDO_MOVE_IDS.filter((id) => unlocked.includes(id));
    const tokens = (this.game.registry.get('qumatokens') as number) || 0;
    const activeMove = (this.game.registry.get('kondoActiveMove') as string | null) ?? null;

    if (forSale.length === 0 && learned.length === 0) {
      // Names the actual unlock condition (a spin-liquid/defect form) rather
      // than reusing Noether's generic "nothing left to teach" line -- for
      // Kondo the gate is almost always "wrong current form," not "already
      // bought everything," so the empty state should say so.
      const text = this.add
        .text(
          CANVAS_W / 2,
          y,
          'Your current form has no local moment for me to screen -- come back wearing a spin liquid or a defect state.',
          {
            fontSize: fontPx(this, 13),
            color: '#ffffff',
            align: 'center',
            wordWrap: { width: 480 },
          }
        )
        .setOrigin(0.5, 0);
      container.add(text);
      return y + text.height;
    }

    forSale.forEach((id) => {
      const move = MOVES[id];
      const cost = shopCost(move);
      const affordable = tokens >= cost;
      const btn = this.addDialogueButton(container, y, `${move.name} -- ${cost} qumatokens`, () => {
        if ((this.game.registry.get('qumatokens') as number) < cost) return;
        this.qumatokens -= cost;
        this.game.registry.set('qumatokens', this.qumatokens);
        this.tokenText.setText(`Qumatokens: ${this.qumatokens}`);
        this.game.registry.set('unlockedMoves', [...this.getUnlockedMoves(), id]);
        // The very first Kondo move bought becomes active automatically --
        // "picked for the first time" happens right here, in this same
        // conversation with Kondo, so there's no dead-purchase state where a
        // freshly bought move shows up nowhere in battle. Switching between
        // two-or-more already-bought moves still always requires its own
        // explicit "Make active" click below.
        if (!this.game.registry.get('kondoActiveMove')) {
          this.game.registry.set('kondoActiveMove', id);
        }
        persistFromRegistry(this.game.registry);
        this.dialogueContainer?.destroy(true);
        this.showKondoPanel();
      });
      if (!affordable) btn.setAlpha(0.5);
      y += btn.height + 3;
    });

    if (learned.length > 0) {
      if (forSale.length > 0) y += 6;
      learned.forEach((id) => {
        const move = MOVES[id];
        const isActive = id === activeMove;
        const label = isActive ? `${move.name} (active)` : `Make ${move.name} active`;
        const btn = this.addDialogueButton(container, y, label, () => {
          if (isActive) return;
          this.game.registry.set('kondoActiveMove', id);
          persistFromRegistry(this.game.registry);
          this.dialogueContainer?.destroy(true);
          this.showKondoPanel();
        });
        if (isActive) btn.setAlpha(0.5);
        y += btn.height + 3;
      });
    }

    return y;
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

  // Laughlin stands at world 4's middle tile (WORLD_GUARDIANS) and sells
  // three passive abilities (data/passives.ts's LAUGHLIN_PASSIVE_IDS --
  // Fractional Guard, Anyon Echo, Edge Current) instead of moves: a
  // whole-battle always-on modifier picked once by visiting Laughlin, not
  // something chosen from the move menu each turn. Shares renderPassiveList
  // below with showBohrPanel -- see that method's own comment for why it
  // mirrors showKondoPanel's shape rather than Curie's flat buy-only list.
  private showLaughlinPanel() {
    this.dialogueActive = true;

    const panelWidth = 600;
    const top = 20;
    const container = this.add.container(0, 0).setDepth(100);
    this.dialogueContainer = container;

    let y = top;

    const avatarY = y + 42;
    const avatar = makeLaughlinAvatar(this);
    avatar.setPosition(CANVAS_W / 2, avatarY);
    container.add(avatar);
    this.tweens.add({ targets: avatar, y: avatarY + 8, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    playGuardianChime();
    y = avatarY + 48;

    const intro = this.add
      .text(
        CANVAS_W / 2,
        y,
        '"An excited fractional quantum Hall state answers a blow with only a fraction of its force. I can teach your crystal the same trick -- only one lesson holds at a time."',
        { fontSize: fontPx(this, 11), fontStyle: 'italic', color: '#cfd8ff', align: 'center', wordWrap: { width: panelWidth - 80 } }
      )
      .setOrigin(0.5, 0);
    container.add(intro);
    y += intro.height + 14;

    y = this.renderPassiveList(container, y, LAUGHLIN_PASSIVE_IDS, 'laughlinPassivesUnlocked', 'laughlinActivePassive', () =>
      this.showLaughlinPanel()
    );
    y += 8;
    y = this.renderFarewellFooter(container, y);
    y += 8;

    const panelHeight = y - top;
    const panel = this.add
      .rectangle(CANVAS_W / 2, top + panelHeight / 2, panelWidth, panelHeight, 0x10101c, 0.94)
      .setStrokeStyle(2, 0x6a7fff);
    container.addAt(panel, 0);
  }

  // Bohr stands at world 7's middle tile (WORLD_GUARDIANS) and sells three
  // passive abilities (data/passives.ts's BOHR_PASSIVE_IDS -- Correlated
  // Response, Nonlocal Correlation, Shared State), same shape as
  // showLaughlinPanel above -- see renderPassiveList's own comment.
  private showBohrPanel() {
    this.dialogueActive = true;

    const panelWidth = 600;
    const top = 20;
    const container = this.add.container(0, 0).setDepth(100);
    this.dialogueContainer = container;

    let y = top;

    const avatarY = y + 42;
    const avatar = makeBohrAvatar(this);
    avatar.setPosition(CANVAS_W / 2, avatarY);
    container.add(avatar);
    this.tweens.add({ targets: avatar, y: avatarY + 8, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    playGuardianChime();
    y = avatarY + 48;

    const intro = this.add
      .text(
        CANVAS_W / 2,
        y,
        '"Measure one half of an entangled pair and the other answers instantly. I can teach your crystal to answer that way too -- only one bond holds at a time."',
        { fontSize: fontPx(this, 11), fontStyle: 'italic', color: '#cfd8ff', align: 'center', wordWrap: { width: panelWidth - 80 } }
      )
      .setOrigin(0.5, 0);
    container.add(intro);
    y += intro.height + 14;

    y = this.renderPassiveList(container, y, BOHR_PASSIVE_IDS, 'bohrPassivesUnlocked', 'bohrActivePassive', () =>
      this.showBohrPanel()
    );
    y += 8;
    y = this.renderFarewellFooter(container, y);
    y += 8;

    const panelHeight = y - top;
    const panel = this.add
      .rectangle(CANVAS_W / 2, top + panelHeight / 2, panelWidth, panelHeight, 0x10101c, 0.94)
      .setStrokeStyle(2, 0xffa64a);
    container.addAt(panel, 0);
  }

  // Shared by showLaughlinPanel/showBohrPanel -- both guardians sell a
  // three-passive kit with the same "buy several, only one active, switch
  // by a click" shape Kondo's three moves already use (renderKondoMoves),
  // just for a whole-battle passive instead of a move usable from the
  // battle menu: still-unbought passives (with a one-line description, since
  // a passive's effect isn't spelled out anywhere else the way a move's
  // physics-flavored name usually implies it) get a buy button, every
  // already-bought passive gets its own "Make `<name>` active" button or a
  // dimmed "`<name>` (active)" tag -- same dimmed-current convention every
  // other guardian panel uses. Unlike Kondo's moves, a passive is never
  // gated by MOVE_COMPATIBILITY (the same "player-learned technique, not a
  // quasiparticle a crystal has to host" reasoning as Curie's analytic
  // moves) -- every passive is always purchasable regardless of current
  // form, so there's no "wrong form" empty state to special-case here.
  // Buying the very first passive for a given guardian activates it
  // automatically, same reasoning as Kondo's first move.
  private renderPassiveList(
    container: Phaser.GameObjects.Container,
    y: number,
    passiveIds: string[],
    unlockedKey: string,
    activeKey: string,
    reopen: () => void
  ): number {
    const unlocked = (this.game.registry.get(unlockedKey) as string[]) ?? [];
    const forSale = passiveIds.filter((id) => !unlocked.includes(id));
    const learned = passiveIds.filter((id) => unlocked.includes(id));
    const active = (this.game.registry.get(activeKey) as string | null) ?? null;
    const tokens = (this.game.registry.get('qumatokens') as number) || 0;

    // The buy row's font size is capped well below the text-size setting's
    // full range (same reasoning as BattleScene's move-menu section headers,
    // STYLE.md's "Battle move menu") -- this panel has no shrink-to-fit
    // safety net the way showInfoPanel does, and a passive's name+cost label
    // at the setting's uncapped 'Large' preset wraps to two lines, which
    // combined with three buy rows and their own description line each was
    // enough to push the whole panel's Farewell button off the bottom of the
    // canvas the first time this was tried at the default preset already.
    const buttonScale = Math.min(fontScale(this), 1.3);
    const buttonPx = `${Math.round(12 * buttonScale)}px`;
    const descScale = Math.min(fontScale(this), 1.2);
    const descPx = `${Math.round(9 * descScale)}px`;

    forSale.forEach((id) => {
      const passive = PASSIVES[id];
      const affordable = tokens >= passive.cost;
      const btn = this.addDialogueButtonAt(
        container,
        CANVAS_W / 2,
        y,
        `${passive.name} -- ${passive.cost} qumatokens`,
        () => {
          if ((this.game.registry.get('qumatokens') as number) < passive.cost) return;
          this.qumatokens -= passive.cost;
          this.game.registry.set('qumatokens', this.qumatokens);
          this.tokenText.setText(`Qumatokens: ${this.qumatokens}`);
          this.game.registry.set(unlockedKey, [...unlocked, id]);
          if (!this.game.registry.get(activeKey)) {
            this.game.registry.set(activeKey, id);
          }
          persistFromRegistry(this.game.registry);
          this.dialogueContainer?.destroy(true);
          reopen();
        },
        480,
        buttonPx
      );
      if (!affordable) btn.setAlpha(0.5);
      y += btn.height + 2;
      const desc = this.add
        .text(CANVAS_W / 2, y, passive.description, {
          fontSize: descPx,
          color: '#8fa0c9',
          align: 'center',
          wordWrap: { width: 480 },
        })
        .setOrigin(0.5, 0);
      container.add(desc);
      y += desc.height + 4;
    });

    if (learned.length > 0) {
      if (forSale.length > 0) y += 6;
      learned.forEach((id) => {
        const passive = PASSIVES[id];
        const isActive = id === active;
        const label = isActive ? `${passive.name} (active)` : `Make ${passive.name} active`;
        const btn = this.addDialogueButton(container, y, label, () => {
          if (isActive) return;
          this.game.registry.set(activeKey, id);
          persistFromRegistry(this.game.registry);
          this.dialogueContainer?.destroy(true);
          reopen();
        });
        if (isActive) btn.setAlpha(0.5);
        y += btn.height + 3;
      });
    }

    return y;
  }

  // Bloch stands at world 2's middle tile (see spawnGuardianSprite/
  // WORLD_GUARDIANS) and folds the player to any other world they've already
  // visited and that actually has a built map (BUILT_WORLDS) -- offering an
  // unbuilt world would teleport the player somewhere with no map to stand
  // on. Ends in the plain "Farewell"-only renderFarewellFooter, not the
  // Face-the-Rival/Continue footer -- that stays exclusive to the goal
  // panel now that Bloch stands mid-corridor rather than at the goal.
  // Destinations paginate via renderPagedButtons (same helper Dresselhaus/
  // Majorana/Anderson use) -- with only a handful of built worlds this used
  // to just shrink the row font/drop the avatar past 5 destinations, but
  // Superposition Mode pre-seeding every world as visited made a 9-
  // destination list the common case rather than a rare one, and no amount
  // of font shrinking keeps 9 full rows plus avatar/quote/footer inside the
  // 480px canvas -- capping the row *count* per page is the only fix that
  // actually bounds the height.
  // Content laid out top-down first (running `y`), panel sized/inserted
  // behind everything afterward -- same pattern as showSettingsPanel.
  private showBlochHub() {
    this.dialogueActive = true;

    const destinations = this.getVisitedWorlds().filter((w) => BUILT_WORLDS.includes(w) && w !== this.world);

    const panelWidth = 600;
    const top = 20;
    const container = this.add.container(0, 0).setDepth(100);
    this.dialogueContainer = container;

    let y = top;

    const avatarY = y + 55;
    const avatar = makeBlochAvatar(this);
    avatar.setPosition(CANVAS_W / 2, avatarY);
    container.add(avatar);
    this.tweens.add({ targets: avatar, y: avatarY + 8, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    y = avatarY + 65;
    playGuardianChime();

    const intro = this.add
      .text(
        CANVAS_W / 2,
        y,
        '"I am Bloch. Every crystal is a superposition of the worlds it has touched -- name one you have visited, and I will fold you there."',
        {
          fontSize: fontPx(this, 12),
          fontStyle: 'italic',
          color: '#cfd8ff',
          align: 'center',
          wordWrap: { width: panelWidth - 80 },
        }
      )
      .setOrigin(0.5, 0);
    container.add(intro);
    y += intro.height + 14;

    if (destinations.length === 0) {
      const text = this.add
        .text(CANVAS_W / 2, y, "You haven't mapped anywhere else yet.", { fontSize: fontPx(this, 13), color: '#ffffff' })
        .setOrigin(0.5, 0);
      container.add(text);
      y += text.height;
    } else {
      const items = destinations.map((w) => ({ world: w, name: WORLD_NAMES[w] ?? `World ${w}` }));
      y = this.renderPagedButtons(
        container,
        y,
        items,
        this.blochPage,
        4,
        (d) => `Travel to World ${d.world} -- ${d.name}`,
        (d) => this.advanceToWorld(d.world),
        (page) => {
          this.blochPage = page;
          this.dialogueContainer?.destroy(true);
          this.showBlochHub();
        }
      );
    }
    y += 8;

    y = this.renderFarewellFooter(container, y);
    y += 12;

    const panelHeight = y - top;
    const panel = this.add
      .rectangle(CANVAS_W / 2, top + panelHeight / 2, panelWidth, panelHeight, 0x10101c, 0.94)
      .setStrokeStyle(2, 0x4adde0);
    container.addAt(panel, 0);
  }

  // Shared pager for candidate-crystal lists (Dresselhaus's transmute list,
  // Majorana's two combine-pick steps, Anderson's host list, Bloch's
  // destination list) -- Superposition Mode's candidate pool (or, for
  // Bloch, every world pre-marked visited) is far bigger than one panel can
  // show at once, so this renders one page of buttons plus Prev/Next
  // controls when there's more than a page's worth. `page`/`onPageChange`
  // are the caller's own page field and setter (each panel keeps its own
  // independent page number), and `onPageChange` is expected to rebuild the
  // whole panel in place (same "destroy container, re-call showXPanel"
  // pattern every other in-panel action already uses).
  //
  // `maxPerPage` is a ceiling, not the actual row count: row height (and
  // therefore how many rows actually fit before the panel runs off the
  // canvas) grows with the Settings panel's own text-size preset
  // (ui/text.ts's fontScale) -- the *default* preset is already 1.5x, not
  // 1x, and a fixed 4-row page overflowed the canvas at that default once
  // Bloch's destination list started routinely hitting 9 entries
  // (Superposition Mode pre-seeding every world as visited). So this
  // measures one sample row at the current scale first and shrinks the
  // actual per-page row count to whatever still fits above both this
  // function's own Prev/Next/page-label row and the caller's own trailing
  // content (its Farewell/Close button) -- reserved space, not exact
  // measurement, but conservative enough that no caller has overflowed
  // since (verified via headless-Chromium bounds checks at every font-scale
  // preset, see DEVELOPMENT.md's "Verifying UI changes" section).
  private renderPagedButtons<T extends { name: string }>(
    container: Phaser.GameObjects.Container,
    y: number,
    items: T[],
    page: number,
    maxPerPage: number,
    labelFor: (item: T) => string,
    onPick: (item: T) => void,
    onPageChange: (page: number) => void,
    isDim?: (item: T) => boolean
  ): number {
    const sample = this.add.text(-1000, -1000, 'Sample', { fontSize: fontPx(this, 13), padding: { x: 10, y: 5 } });
    const rowH = sample.height + 6;
    sample.destroy();
    const reservedTail = rowH * 2; // caller's own footer button + margin below this function's return
    const reservedControls = rowH * 2; // this function's own Prev/Next row + page label, reserved whether or not they end up showing
    const available = CANVAS_H - y - reservedTail - reservedControls;
    const fitPerPage = Math.max(1, Math.floor(available / rowH));
    const perPage = Math.min(maxPerPage, fitPerPage);

    const totalPages = Math.max(1, Math.ceil(items.length / perPage));
    const clampedPage = Phaser.Math.Clamp(page, 0, totalPages - 1);
    const pageItems = items.slice(clampedPage * perPage, clampedPage * perPage + perPage);
    pageItems.forEach((item) => {
      const btn = this.addDialogueButton(container, y, labelFor(item), () => onPick(item));
      if (isDim?.(item)) btn.setAlpha(0.5);
      y += btn.height + 6;
    });
    if (totalPages > 1) {
      const prev = this.addDialogueButtonAt(
        container,
        CANVAS_W / 2 - 90,
        y,
        '<- Prev',
        () => {
          if (clampedPage > 0) onPageChange(clampedPage - 1);
        },
        140
      );
      if (clampedPage === 0) prev.setAlpha(0.35);
      const next = this.addDialogueButtonAt(
        container,
        CANVAS_W / 2 + 90,
        y,
        'Next ->',
        () => {
          if (clampedPage < totalPages - 1) onPageChange(clampedPage + 1);
        },
        140
      );
      if (clampedPage === totalPages - 1) next.setAlpha(0.35);
      y += Math.max(prev.height, next.height) + 6;
      const pageLabel = this.add
        .text(CANVAS_W / 2, y, `Page ${clampedPage + 1}/${totalPages}`, { fontSize: fontPx(this, 11), color: '#8fa0c9' })
        .setOrigin(0.5, 0);
      container.add(pageLabel);
      y += pageLabel.height + 4;
    }
    return y;
  }

  // Dresselhaus stands at world 3's middle tile like every other guardian (see
  // spawnGuardianSprite/WORLD_GUARDIANS), triggered on reaching that row
  // (maybeAutoOpenMiddleDialogue). Lets the player transmute into any
  // crystal they've defeated -- the physics rationale being that beating
  // something is understanding it well enough to become it for a while.
  // Superposition Mode replaces "defeated" with every crystal in the game
  // (allCrystals()), paginated via renderPagedButtons since that pool is
  // far bigger than the normal handful of recent defeats.
  // Content laid out top-down first (running `y`), panel sized/inserted
  // behind everything afterward -- same pattern as showSettingsPanel.
  private showDresselhausPanel() {
    this.dialogueActive = true;

    const panelWidth = 600;
    const top = 20;
    const container = this.add.container(0, 0).setDepth(100);
    this.dialogueContainer = container;

    let y = top;

    const avatarY = y + 55;
    const avatar = makeDresselhausAvatar(this);
    avatar.setPosition(CANVAS_W / 2, avatarY);
    container.add(avatar);
    this.tweens.add({ targets: avatar, y: avatarY + 8, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    playGuardianChime();
    y = avatarY + 65;

    const superposition = this.isSuperpositionMode();
    const intro = this.add
      .text(
        CANVAS_W / 2,
        y,
        superposition
          ? '"I am Dresselhaus. In superposition every spin texture is within reach at once -- become anything that exists, not only what you have already beaten."'
          : '"I am Dresselhaus. Every crystal you have defeated is a spin-orbit texture you now understand well enough to wear, for a while."',
        { fontSize: fontPx(this, 12), fontStyle: 'italic', color: '#cfd8ff', align: 'center', wordWrap: { width: panelWidth - 80 } }
      )
      .setOrigin(0.5, 0);
    container.add(intro);
    y += intro.height + 14;

    // Excludes hybrid-recipe results and inherently doped/alloyed compounds
    // (isCompositeMaterial) either way -- becoming a mixed/fused state is
    // Majorana's mechanic, not this one, even for the ones that are also
    // ordinary wild encounters.
    const candidates: { name: string }[] = superposition
      ? allCrystals()
          .filter((m) => !isCompositeMaterial(m.name))
          .sort((a, b) => a.name.localeCompare(b.name))
      : this.getDefeatedMaterials()
          .filter((m) => !isCompositeMaterial(m.name))
          .slice(-3);
    if (candidates.length === 0) {
      const text = this.add
        .text(CANVAS_W / 2, y, "You haven't defeated any crystals yet -- there is nothing to become.", {
          fontSize: fontPx(this, 13),
          color: '#ffffff',
          align: 'center',
          wordWrap: { width: 480 },
        })
        .setOrigin(0.5, 0);
      container.add(text);
      y += text.height;
    } else {
      y = this.renderPagedButtons(
        container,
        y,
        candidates,
        this.dresselhausPage,
        4,
        (m) => (this.playerMaterial.name === m.name ? `${m.name} (current form)` : `Become ${m.name}`),
        (m) => {
          if (this.playerMaterial.name === m.name) return;
          this.transmuteInto(m.name);
        },
        (page) => {
          this.dresselhausPage = page;
          this.dialogueContainer?.destroy(true);
          this.showDresselhausPanel();
        },
        (m) => this.playerMaterial.name === m.name
      );
    }
    y += 8;

    const closeBtn = this.addDialogueButtonAt(container, CANVAS_W / 2, y, 'Farewell', () => this.closeDialogue(), 300);
    y += closeBtn.height + 12;

    const panelHeight = y - top;
    const panel = this.add
      .rectangle(CANVAS_W / 2, top + panelHeight / 2, panelWidth, panelHeight, 0x10101c, 0.94)
      .setStrokeStyle(2, 0x4ad9a0);
    container.addAt(panel, 0);
  }

  // Sets the player's current crystal form to `material` and persists it --
  // shared by Dresselhaus's ordinary transmutation (transmuteInto, looks the
  // form up by name in WORLD_CRYSTALS) and Majorana's hybrid panel
  // (becomeHybrid, whose synthesized Material was never in WORLD_CRYSTALS to
  // look up by name in the first place). Doesn't heal -- HP is only clamped
  // down to the new form's maxHp if it's lower, same as it always has been.
  private applyPlayerForm(material: Material) {
    this.game.registry.set('playerForm', material);
    const clampedHp = Math.min((this.game.registry.get('playerHp') as number) ?? material.maxHp, material.maxHp);
    this.game.registry.set('playerHp', clampedHp);
    persistFromRegistry(this.game.registry);

    this.playerMaterial = material;
    this.redrawPlayerCrystal();
  }

  private transmuteInto(name: string) {
    const material = findMaterialByName(name);
    if (!material) return;
    this.applyPlayerForm(material);

    // Rebuild the panel in place (dialogueActive already true from the open
    // showDresselhausPanel call) so the new form's "(current form)" tag updates.
    this.dialogueContainer?.destroy(true);
    this.showDresselhausPanel();
  }

  private redrawPlayerCrystal() {
    this.playerCrystalGfx.destroy();
    this.playerCrystalGfx = makeCrystal(this, PLAYER_CRYSTAL_SIZE, this.playerMaterial.color, this.playerMaterial.variant, {
      seed: this.playerMaterial.name,
      hybrid: this.playerMaterial.hybridParents,
    });
    this.player.add(this.playerCrystalGfx);
  }

  private getHybridMaterials(): Material[] {
    return (this.game.registry.get('hybridMaterials') as Material[]) ?? [];
  }

  // Majorana stands at world 5's middle tile (WORLD_GUARDIANS) and lets the
  // player fuse two crystals they've already defeated into a new
  // topological hybrid (data/materials.ts's combineMaterials), becoming it
  // immediately via the same applyPlayerForm helper Dresselhaus's transmutation
  // uses. A two-step pick (this.majoranaSelection holds the first choice
  // while the panel rebuilds for the second) rather than one list of every
  // pair, since the pair count grows quadratically with how many crystals
  // are shown and a two-step flow reads more like an actual choice anyway.
  // Earlier hybrids get their own "become again" section sourced from the
  // separate `hybridMaterials` list -- kept apart from the defeated-crystal
  // list used to *create* new ones so a hybrid can never be fed back in as
  // an ingredient (that would compound the 1.5x multiplier every time).
  // Superposition Mode replaces "defeated" with every crystal in the game
  // (allCrystals()) as the ingredient pool, paginated (renderPagedButtons)
  // at both steps since that pool is far bigger than a normal defeat count.
  private showMajoranaPanel() {
    this.dialogueActive = true;

    const panelWidth = 600;
    const top = 20;
    const container = this.add.container(0, 0).setDepth(100);
    this.dialogueContainer = container;

    let y = top;

    const avatarY = y + 55;
    const avatar = makeMajoranaAvatar(this);
    avatar.setPosition(CANVAS_W / 2, avatarY);
    container.add(avatar);
    this.tweens.add({ targets: avatar, y: avatarY + 8, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    playGuardianChime();
    y = avatarY + 65;

    const superposition = this.isSuperpositionMode();
    const intro = this.add
      .text(
        CANVAS_W / 2,
        y,
        superposition
          ? '"I am Majorana. In superposition every pairing is already possible -- fuse any two states that make physical sense together, defeated or not."'
          : '"I am Majorana. Fuse two states you already understand and see what phase they make together -- a magnet and a superconductor, say, become something with edges neither one had alone."',
        { fontSize: fontPx(this, 12), fontStyle: 'italic', color: '#cfd8ff', align: 'center', wordWrap: { width: panelWidth - 80 } }
      )
      .setOrigin(0.5, 0);
    container.add(intro);
    y += intro.height + 14;

    const hybrids = this.getHybridMaterials().slice(-3);
    if (hybrids.length > 0) {
      hybrids.forEach((h) => {
        const isCurrent = this.playerMaterial.name === h.name;
        const label = isCurrent ? `${h.name} (current form)` : `Become ${h.name} again`;
        const btn = this.addDialogueButton(container, y, label, () => {
          if (isCurrent) return;
          this.becomeHybrid(h);
        });
        if (isCurrent) btn.setAlpha(0.5);
        y += btn.height + 6;
      });
      y += 8;
    }

    // Every world's wild pool is a single main type (world 5 is all
    // 'supercon', world 6 all 'classicalmag', ...), so a same-world-only
    // recency window (Dresselhaus's `slice(-3)`, fine there since any single
    // defeated crystal is a valid transmute target) would make Majorana's
    // paired requirement nearly unreachable -- the player's last few
    // defeats right before reaching him are almost always all the same
    // type. `pool` is the *whole* `defeatedMaterials` history normally (an
    // earlier world's magnet still counts) or, in Superposition Mode, every
    // crystal in the game -- either way filtered for combinability first,
    // then paginated for display rather than an arbitrary recency cap.
    const pool: { name: string; type: MaterialType }[] = superposition ? allCrystals() : this.getDefeatedMaterials();
    const isCombinable = (m: { name: string; type: MaterialType }) =>
      pool.some((other) => other.name !== m.name && hybridRecipeResult(m.name, other.name));
    const combinable = pool.filter(isCombinable).sort((a, b) => a.name.localeCompare(b.name));
    if (this.majoranaSelection === null) {
      if (combinable.length < 2) {
        const text = this.add
          .text(
            CANVAS_W / 2,
            y,
            "None of the crystals you've defeated pair into a known hybrid recipe yet -- Majorana only knows specific real pairings (e.g. Aluminum + Indium Arsenide, or two Graphenes together).",
            { fontSize: fontPx(this, 13), color: '#ffffff', align: 'center', wordWrap: { width: 480 } }
          )
          .setOrigin(0.5, 0);
        container.add(text);
        y += text.height;
      } else {
        const label = this.add
          .text(CANVAS_W / 2, y, 'Combine which crystal?', {
            fontSize: fontPx(this, 12),
            color: '#9fffb0',
            align: 'center',
          })
          .setOrigin(0.5, 0);
        container.add(label);
        y += label.height + 6;
        y = this.renderPagedButtons(
          container,
          y,
          combinable,
          this.majoranaPage,
          4,
          (m) => m.name,
          (m) => {
            this.majoranaSelection = m.name;
            this.majoranaPage = 0;
            this.dialogueContainer?.destroy(true);
            this.showMajoranaPanel();
          },
          (page) => {
            this.majoranaPage = page;
            this.dialogueContainer?.destroy(true);
            this.showMajoranaPanel();
          }
        );
      }
    } else {
      const first = this.majoranaSelection;
      const label = this.add
        .text(CANVAS_W / 2, y, `Combine ${first} with...`, {
          fontSize: fontPx(this, 12),
          color: '#9fffb0',
          align: 'center',
          wordWrap: { width: 480 },
        })
        .setOrigin(0.5, 0);
      container.add(label);
      y += label.height + 6;
      const partners = pool
        .filter((m) => m.name !== first && hybridRecipeResult(first, m.name))
        .sort((a, b) => a.name.localeCompare(b.name));
      y = this.renderPagedButtons(
        container,
        y,
        partners,
        this.majoranaPage,
        4,
        (m) => m.name,
        (m) => this.createHybrid(first, m.name),
        (page) => {
          this.majoranaPage = page;
          this.dialogueContainer?.destroy(true);
          this.showMajoranaPanel();
        }
      );
      const cancelBtn = this.addDialogueButton(container, y, 'Never mind', () => {
        this.majoranaSelection = null;
        this.majoranaPage = 0;
        this.dialogueContainer?.destroy(true);
        this.showMajoranaPanel();
      });
      y += cancelBtn.height + 6;
    }
    y += 8;

    const closeBtn = this.addDialogueButtonAt(container, CANVAS_W / 2, y, 'Farewell', () => this.closeDialogue(), 300);
    y += closeBtn.height + 12;

    const panelHeight = y - top;
    const panel = this.add
      .rectangle(CANVAS_W / 2, top + panelHeight / 2, panelWidth, panelHeight, 0x10101c, 0.94)
      .setStrokeStyle(2, 0x4fd97a);
    container.addAt(panel, 0);
  }

  private becomeHybrid(hybrid: Material) {
    this.applyPlayerForm(hybrid);
    this.dialogueContainer?.destroy(true);
    this.showMajoranaPanel();
  }

  // findMaterialByName only searches WORLD_CRYSTALS -- both names passed in
  // here always come from getDefeatedMaterials(), which only ever records
  // real wild crystals (never a rival, never an earlier hybrid), so this
  // should never actually miss; the early return is just defensive.
  private createHybrid(nameA: string, nameB: string) {
    this.majoranaSelection = null;
    const a = findMaterialByName(nameA);
    const b = findMaterialByName(nameB);
    if (!a || !b) {
      this.dialogueContainer?.destroy(true);
      this.showMajoranaPanel();
      return;
    }

    const hybrid = combineMaterials(a, b);
    const existing = this.getHybridMaterials();
    if (!existing.some((m) => m.name === hybrid.name)) {
      this.game.registry.set('hybridMaterials', [...existing, hybrid]);
    }
    this.becomeHybrid(hybrid);
  }

  // Anderson stands at world 9's middle tile (WORLD_GUARDIANS) and lets the
  // player "dope in" a crystal they've encountered (or, in Superposition
  // Mode, any crystal in the game) as an impurity, then learn one specific
  // move from its moveset -- an Anderson-impurity take on the same idea
  // Dresselhaus/Majorana explore differently: Dresselhaus becomes the whole state,
  // Majorana fuses two states together, Anderson borrows just one
  // excitation channel from a state without becoming it. The learned move
  // is a completely ordinary entry in `unlockedMoves` -- MOVE_COMPATIBILITY
  // still gates whether it actually shows up in the battle move menu
  // (getBattleMoves), which is the point: an impurity's channel only
  // manifests in combat once the player's own current form can physically
  // host it. Two-step pick (this.andersonSelection holds the host while the
  // panel rebuilds to ask which of its moves to learn), paginated at the
  // host-pick step via renderPagedButtons -- same shape as Majorana's
  // combine flow, minus a second pagination pass since a host's moveset is
  // always small (crystal() only ever assigns two).
  private showAndersonPanel() {
    this.dialogueActive = true;

    const panelWidth = 600;
    const top = 20;
    const container = this.add.container(0, 0).setDepth(100);
    this.dialogueContainer = container;

    let y = top;

    const avatarY = y + 55;
    const avatar = makeAndersonAvatar(this);
    avatar.setPosition(CANVAS_W / 2, avatarY);
    container.add(avatar);
    this.tweens.add({ targets: avatar, y: avatarY + 8, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    playGuardianChime();
    y = avatarY + 65;

    const superposition = this.isSuperpositionMode();
    const intro = this.add
      .text(
        CANVAS_W / 2,
        y,
        superposition
          ? '"I am Anderson. In superposition every crystal is available to dope in as an impurity -- pick one, and I will teach you the single channel it opens."'
          : '"I am Anderson. Dope in a crystal you have encountered as an impurity, and I will teach you the one channel it opens in your own lattice -- whether it ever fires depends on what your own physics can carry."',
        { fontSize: fontPx(this, 12), fontStyle: 'italic', color: '#cfd8ff', align: 'center', wordWrap: { width: panelWidth - 80 } }
      )
      .setOrigin(0.5, 0);
    container.add(intro);
    y += intro.height + 14;

    const pool: { name: string }[] = superposition ? allCrystals() : this.getDefeatedMaterials();

    if (this.andersonSelection === null) {
      if (pool.length === 0) {
        const text = this.add
          .text(CANVAS_W / 2, y, "You haven't encountered any crystals yet -- there is nothing to dope in.", {
            fontSize: fontPx(this, 13),
            color: '#ffffff',
            align: 'center',
            wordWrap: { width: 480 },
          })
          .setOrigin(0.5, 0);
        container.add(text);
        y += text.height;
      } else {
        const label = this.add
          .text(CANVAS_W / 2, y, 'Dope in which crystal?', {
            fontSize: fontPx(this, 12),
            color: '#e8b27a',
            align: 'center',
          })
          .setOrigin(0.5, 0);
        container.add(label);
        y += label.height + 6;
        const sorted = pool.slice().sort((a, b) => a.name.localeCompare(b.name));
        y = this.renderPagedButtons(
          container,
          y,
          sorted,
          this.andersonPage,
          4,
          (m) => m.name,
          (m) => {
            this.andersonSelection = m.name;
            this.andersonPage = 0;
            this.dialogueContainer?.destroy(true);
            this.showAndersonPanel();
          },
          (page) => {
            this.andersonPage = page;
            this.dialogueContainer?.destroy(true);
            this.showAndersonPanel();
          }
        );
      }
    } else {
      const host = findMaterialByName(this.andersonSelection);
      const unlocked = this.getUnlockedMoves();
      const learnable = host ? host.moves.filter((id) => !unlocked.includes(id)) : [];
      const label = this.add
        .text(CANVAS_W / 2, y, `Learn which move from ${this.andersonSelection}?`, {
          fontSize: fontPx(this, 12),
          color: '#e8b27a',
          align: 'center',
          wordWrap: { width: 480 },
        })
        .setOrigin(0.5, 0);
      container.add(label);
      y += label.height + 6;

      if (learnable.length === 0) {
        const text = this.add
          .text(CANVAS_W / 2, y, `You already carry every move ${this.andersonSelection} has to offer.`, {
            fontSize: fontPx(this, 13),
            color: '#ffffff',
            align: 'center',
            wordWrap: { width: 480 },
          })
          .setOrigin(0.5, 0);
        container.add(text);
        y += text.height + 6;
      } else {
        learnable.forEach((id) => {
          const move = MOVES[id];
          const btn = this.addDialogueButton(container, y, `${move.name} (Pwr ${move.power})`, () => this.learnImpurityMove(id));
          y += btn.height + 6;
        });
      }
      const cancelBtn = this.addDialogueButton(container, y, 'Never mind', () => {
        this.andersonSelection = null;
        this.andersonPage = 0;
        this.dialogueContainer?.destroy(true);
        this.showAndersonPanel();
      });
      y += cancelBtn.height + 6;
    }
    y += 8;

    const closeBtn = this.addDialogueButtonAt(container, CANVAS_W / 2, y, 'Farewell', () => this.closeDialogue(), 300);
    y += closeBtn.height + 12;

    const panelHeight = y - top;
    const panel = this.add
      .rectangle(CANVAS_W / 2, top + panelHeight / 2, panelWidth, panelHeight, 0x10101c, 0.94)
      .setStrokeStyle(2, 0xc9884a);
    container.addAt(panel, 0);
  }

  // Learns one move from the doped-in host's moveset -- just an ordinary
  // append to `unlockedMoves` (see showAndersonPanel's comment for why this
  // needs no special-case handling anywhere else: MOVE_COMPATIBILITY
  // already gates whether it's actually usable).
  private learnImpurityMove(moveId: string) {
    const unlocked = this.getUnlockedMoves();
    if (!unlocked.includes(moveId)) {
      this.game.registry.set('unlockedMoves', [...unlocked, moveId]);
      persistFromRegistry(this.game.registry);
    }
    this.andersonSelection = null;
    this.andersonPage = 0;
    this.dialogueContainer?.destroy(true);
    this.showAndersonPanel();
  }

  // Fallback panel for a guardian left without a bespoke `open` handler
  // (see WORLD_GUARDIANS -- every current guardian sets one, but a future
  // guardian added before its own mechanic is built can leave `open` unset
  // and land here instead): avatar + a topic-tied quote, no shop tabs. Ends
  // in renderFarewellFooter, not renderShopFooter -- every guardian stands
  // mid-corridor, so the Face-the-Rival/Continue progression action stays
  // exclusive to the goal panel (showGatePanel), reached only once the
  // player actually walks the rest of the way to the boss waiting there.
  // Content laid out top-down first (running `y`), panel sized/inserted
  // behind everything afterward -- same pattern as showSettingsPanel.
  private showGuardianLore(guardian: GuardianDef) {
    this.dialogueActive = true;

    const panelWidth = 600;
    const top = 20;
    const container = this.add.container(0, 0).setDepth(100);
    this.dialogueContainer = container;

    let y = top;

    const avatarY = y + 40;
    const avatar = guardian.avatar(this);
    avatar.setPosition(CANVAS_W / 2, avatarY);
    container.add(avatar);
    this.tweens.add({ targets: avatar, y: avatarY + 8, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    playGuardianChime();
    y = avatarY + 50;

    const intro = this.add
      .text(CANVAS_W / 2, y, `"${guardian.quote}"`, {
        fontSize: fontPx(this, 12),
        fontStyle: 'italic',
        color: '#cfd8ff',
        align: 'center',
        wordWrap: { width: panelWidth - 80 },
      })
      .setOrigin(0.5, 0);
    container.add(intro);
    y += intro.height + 14;

    const note = this.add
      .text(CANVAS_W / 2, y, `${guardian.name} has nothing to teach you yet -- more to come.`, {
        fontSize: fontPx(this, 11),
        color: '#8fa0c9',
        align: 'center',
        wordWrap: { width: 480 },
      })
      .setOrigin(0.5, 0);
    container.add(note);
    y += note.height + 16;

    y = this.renderFarewellFooter(container, y);
    y += 12;

    const panelHeight = y - top;
    const panel = this.add
      .rectangle(CANVAS_W / 2, top + panelHeight / 2, panelWidth, panelHeight, 0x10101c, 0.94)
      .setStrokeStyle(2, guardian.strokeColor);
    container.addAt(panel, 0);
  }

  // Mirrors maybeAutoOpenGoalDialogue for the middle row every guardian now
  // stands on: reopens their panel both the first time the player reaches
  // the middle and again after every later round trip through BattleScene,
  // so it stays revisitable rather than a one-shot popup.
  private maybeAutoOpenMiddleDialogue() {
    if (!this.reachedMiddle || this.dialogueActive) return;
    const guardian = OverworldScene.WORLD_GUARDIANS[this.world];
    if (guardian?.tile === 'middle') this.openGuardian(guardian);
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

    // Data-driven row list (rather than fixed hand-placed buttons) so rows
    // can be added without hand-recomputing every other button's y position.
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
      { label: 'Guardians', onClick: () => this.showGuardiansPanel() },
      { label: 'Tutorial', onClick: () => this.showTutorial(0) },
      { label: 'Settings', onClick: () => this.showSettingsPanel() },
      { label: 'Close', onClick: () => this.closeDialogue() },
    ];

    // Content built top-down at local y (running `y`, each row's own
    // height advancing it -- row count regularly reaches 7-8 with Settings
    // and the debug-only Warp row, and a fixed per-row spacing tuned for
    // one font size either overlapped rows or ran short at another), then
    // the whole container shifted so the result lands vertically centered
    // on the canvas -- simpler than pre-computing a height to center
    // around when that height depends on live button measurements.
    const container = this.add.container(0, 0).setDepth(100);
    this.dialogueContainer = container;

    const top = 20;
    let y = top;

    const panelWidth = 320;
    const title = this.add
      .text(CANVAS_W / 2, y, 'Menu', { fontSize: fontPx(this, 15), color: '#ffffff', fontStyle: 'bold' })
      .setOrigin(0.5, 0);
    container.add(title);
    y += title.height + 16;

    rows.forEach((row) => {
      const btn = this.addDialogueButtonAt(container, CANVAS_W / 2, y, row.label, row.onClick, 260);
      y += btn.height + 6;
    });
    y += top;

    const panelHeight = y - top;
    const panel = this.add
      .rectangle(CANVAS_W / 2, top + panelHeight / 2, panelWidth, panelHeight, 0x10101c, 0.95)
      .setStrokeStyle(2, 0x8fa0c9);
    container.addAt(panel, 0);

    container.y = Math.max(0, Math.round((CANVAS_H - panelHeight) / 2)) - top;
  }

  // Enter-menu "Settings" panel: wild-encounter density (data/settings.ts's
  // DENSITY_PRESETS, read by generateMap via encounterChance()) and text
  // size (FONT_SCALE_PRESETS, read live by every fontPx() call). Each is a
  // button that cycles through its presets in place (same rebuild-the-panel
  // pattern as Noether's shop), rather than a slider, since both have only
  // a handful of discrete steps. Content is laid out top-down first, each
  // element's own (font-scale-dependent) height advancing a running `y`,
  // and the backing panel rectangle is sized/inserted behind everything
  // afterward -- a fixed panel height would either clip or float away from
  // the content once text size itself is one of the settings being edited.
  private showSettingsPanel() {
    this.dialogueContainer?.destroy(true);
    this.dialogueActive = true;

    // As wide as the canvas comfortably allows and hint copy kept to a
    // single short clause each -- both settings rows plus their hints plus
    // title/close still have to fit inside CANVAS_H (480) even at the
    // Extra Large text-size preset (3x base), which leaves very little
    // vertical slack once every line is ~3x taller than it used to be.
    const panelWidth = CANVAS_W - 60;
    const contentWidth = panelWidth - 60;
    const top = 14;
    const container = this.add.container(0, 0).setDepth(100);
    this.dialogueContainer = container;

    let y = top;

    const title = this.add
      .text(CANVAS_W / 2, y, 'Settings', { fontSize: fontPx(this, 15), color: '#ffffff', fontStyle: 'bold' })
      .setOrigin(0.5, 0);
    container.add(title);
    y += title.height + 8;

    const densityIndex = this.encounterDensityIndex();
    const densityPreset = DENSITY_PRESETS[densityIndex];
    const densityBtn = this.addDialogueButtonAt(
      container,
      CANVAS_W / 2,
      y,
      `Enemy Density: ${densityPreset.label}`,
      () => {
        const next = DENSITY_PRESETS[(densityIndex + 1) % DENSITY_PRESETS.length];
        this.game.registry.set('encounterDensity', next.value);
        persistFromRegistry(this.game.registry);
        this.showSettingsPanel();
      },
      contentWidth
    );
    y += densityBtn.height + 4;

    const densityHint = this.add
      .text(CANVAS_W / 2, y, 'Takes effect on the next map.', {
        fontSize: fontPx(this, 11),
        color: '#8fa0c9',
        align: 'center',
        wordWrap: { width: contentWidth },
        lineSpacing: 4,
      })
      .setOrigin(0.5, 0);
    container.add(densityHint);
    y += densityHint.height + 10;

    const fontIndex = this.fontScaleIndex();
    const fontPreset = FONT_SCALE_PRESETS[fontIndex];
    const fontBtn = this.addDialogueButtonAt(
      container,
      CANVAS_W / 2,
      y,
      `Text Size: ${fontPreset.label}`,
      () => {
        const next = FONT_SCALE_PRESETS[(fontIndex + 1) % FONT_SCALE_PRESETS.length];
        this.game.registry.set('fontScale', next.value);
        persistFromRegistry(this.game.registry);
        this.showSettingsPanel();
      },
      contentWidth
    );
    y += fontBtn.height + 4;

    const fontHint = this.add
      .text(CANVAS_W / 2, y, 'Applies immediately.', {
        fontSize: fontPx(this, 11),
        color: '#8fa0c9',
        align: 'center',
        wordWrap: { width: contentWidth },
        lineSpacing: 4,
      })
      .setOrigin(0.5, 0);
    container.add(fontHint);
    y += fontHint.height + 10;

    const closeBtn = this.addDialogueButtonAt(container, CANVAS_W / 2, y, 'Close', () => this.closeDialogue(), 260);
    y += closeBtn.height + 8;

    const panelHeight = y - top;
    const panel = this.add
      .rectangle(CANVAS_W / 2, top + panelHeight / 2, panelWidth, panelHeight, 0x10101c, 0.95)
      .setStrokeStyle(2, 0x8fa0c9);
    container.addAt(panel, 0);
  }

  private encounterDensityIndex(): number {
    const value = this.encounterChance();
    const idx = DENSITY_PRESETS.findIndex((p) => p.value === value);
    if (idx !== -1) return idx;
    return DENSITY_PRESETS.findIndex((p) => p.value === DEFAULT_ENCOUNTER_DENSITY);
  }

  private fontScaleIndex(): number {
    const value = (this.game.registry.get('fontScale') as number) ?? DEFAULT_FONT_SCALE;
    const idx = FONT_SCALE_PRESETS.findIndex((p) => p.value === value);
    if (idx !== -1) return idx;
    return FONT_SCALE_PRESETS.findIndex((p) => p.value === DEFAULT_FONT_SCALE);
  }

  // Lists every guardian the player has met so far (registry `metGuardians`,
  // grown by openGuardian as middle tiles are reached), each row
  // reopening that guardian's own panel -- works from any world's scene, not
  // just the guardian's own, which is the whole point of putting this in the
  // Enter menu rather than only at their home tile. In Superposition Mode
  // every guardian lists immediately regardless of `metGuardians` -- "access to
  // every guardian from the beginning" (the whole point of the mode) would
  // otherwise still be gated behind physically walking up to each one first,
  // even though every guardian's own panel already works correctly when
  // opened from anywhere (openGuardian doesn't touch `this.world`).
  // Content laid out top-down first (running `y`), panel sized/inserted
  // behind everything afterward -- same pattern as showSettingsPanel. Row
  // count grows with how many of up to 10 guardians have been met, so a
  // fixed per-row spacing (tuned for the old single font size) either
  // overlapped rows or ran the panel past the canvas once text got bigger.
  private showGuardiansPanel() {
    this.dialogueContainer?.destroy(true);
    this.dialogueActive = true;

    const panelWidth = 340;
    const top = 20;
    const container = this.add.container(0, 0).setDepth(100);
    this.dialogueContainer = container;

    let y = top;

    const title = this.add
      .text(CANVAS_W / 2, y, 'Guardians', { fontSize: fontPx(this, 15), color: '#ffffff', fontStyle: 'bold' })
      .setOrigin(0.5, 0);
    container.add(title);
    y += title.height + 14;

    const met = (this.game.registry.get('metGuardians') as string[]) ?? [];
    const superposition = this.isSuperpositionMode();
    const guardians = Object.values(OverworldScene.WORLD_GUARDIANS).filter(
      (m): m is GuardianDef => !!m && (superposition || met.includes(m.id))
    );

    if (guardians.length === 0) {
      const text = this.add
        .text(CANVAS_W / 2, y, "You haven't met any guardians yet.", {
          fontSize: fontPx(this, 13),
          color: '#ffffff',
          align: 'center',
          wordWrap: { width: panelWidth - 60 },
        })
        .setOrigin(0.5, 0);
      container.add(text);
      y += text.height + 14;
    } else {
      guardians.forEach((guardian) => {
        const btn = this.addDialogueButtonAt(
          container,
          CANVAS_W / 2,
          y,
          guardian.name,
          () => {
            this.closeDialogue();
            this.openGuardian(guardian);
          },
          260
        );
        y += btn.height + 6;
      });
    }

    const closeBtn = this.addDialogueButtonAt(container, CANVAS_W / 2, y, 'Close', () => this.closeDialogue(), 260);
    y += closeBtn.height + 12;

    const panelHeight = y - top;
    const panel = this.add
      .rectangle(CANVAS_W / 2, top + panelHeight / 2, panelWidth, panelHeight, 0x10101c, 0.95)
      .setStrokeStyle(2, 0xb98fea);
    container.addAt(panel, 0);
  }

  private showMovesPanel() {
    this.dialogueContainer?.destroy(true);
    const lines = getBattleMoves(this.game.registry).map((id) => {
      const move = MOVES[id];
      return `${move.name} -- Pwr ${move.power}`;
    });
    this.showInfoPanel('Your Moves', lines.join('\n'));
  }

  // Also the "checkable anytime" surface for Laughlin's/Bohr's current
  // passive loadout (data/passives.ts, DESIGN.md §5) -- their own panels
  // already tag locked/unlocked/active, but a player shouldn't have to walk
  // back to either guardian just to remember which passive is running.
  private showStatsPanel() {
    this.dialogueContainer?.destroy(true);
    const stats = getPlayerStats(this.game.registry);
    const laughlinActive = this.game.registry.get('laughlinActivePassive') as string | null;
    const bohrActive = this.game.registry.get('bohrActivePassive') as string | null;
    const body =
      `Quantumness: ${stats.quantumness} -- raises your crit chance\n` +
      `Velocity: ${stats.velocity} -- higher goes first each round\n` +
      `Correlation: ${stats.correlation} -- higher takes less damage\n\n` +
      `Qumatokens: ${this.qumatokens}\nCurrent form: ${this.playerMaterial.name}\n\n` +
      `Laughlin passive: ${laughlinActive ? PASSIVES[laughlinActive].name : 'None'}\n` +
      `Bohr passive: ${bohrActive ? PASSIVES[bohrActive].name : 'None'}\n\n` +
      'Raise any of these with qumatokens at Noether\'s shop.';
    this.showInfoPanel('Your Stats', body);
  }

  // Content laid out top-down first (running `y`), panel sized/inserted
  // behind everything afterward -- same pattern as showSettingsPanel. Body
  // length varies (View Moves grows with how many the player has unlocked,
  // up to all of MOVES), so a fixed panel height either clipped it or left
  // a lot of empty space depending on text-size setting and move count.
  private showInfoPanel(title: string, body: string) {
    this.dialogueActive = true;

    const panelWidth = 440;
    const top = 20;
    const container = this.add.container(0, 0).setDepth(100);
    this.dialogueContainer = container;

    let y = top;

    const titleText = this.add
      .text(CANVAS_W / 2, y, title, { fontSize: fontPx(this, 15), color: '#ffe066', fontStyle: 'bold' })
      .setOrigin(0.5, 0);
    container.add(titleText);
    y += titleText.height + 14;

    // View Moves' body grows with how many of MOVES' 7 the player has
    // unlocked (each line possibly tagged "incompatible", making it wrap
    // to 2 lines) -- shrink the font in whole-px steps, floor 9, rather
    // than letting a long body push the Close button off the canvas.
    const scale = fontScale(this);
    let bodyBase = 13;
    const bodyText = this.add
      .text(CANVAS_W / 2, y, body, {
        fontSize: `${Math.round(bodyBase * scale)}px`,
        color: '#cfd8ff',
        align: 'center',
        wordWrap: { width: panelWidth - 60 },
        lineSpacing: 6,
      })
      .setOrigin(0.5, 0);
    container.add(bodyText);
    const reservedBelow = 18 + 46 + 12; // gap + close-button estimate + bottom margin
    while (y + bodyText.height + reservedBelow > CANVAS_H - 10 && bodyBase > 9) {
      bodyBase -= 1;
      bodyText.setFontSize(`${Math.round(bodyBase * scale)}px`);
    }
    y += bodyText.height + 18;

    const closeBtn = this.addDialogueButtonAt(container, CANVAS_W / 2, y, 'Close', () => this.closeDialogue(), 260);
    y += closeBtn.height + 12;

    const panelHeight = y - top;
    const panel = this.add
      .rectangle(CANVAS_W / 2, top + panelHeight / 2, panelWidth, panelHeight, 0x10101c, 0.95)
      .setStrokeStyle(2, 0x8fa0c9);
    container.addAt(panel, 0);
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
    this.showTutorialTip('qumatoken');
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
  // applied to the guardian's mid-corridor row instead.
  private maybeReachMiddle(_x: number, y: number) {
    if (this.reachedMiddle || y !== this.midTile.y) return;
    this.reachedMiddle = true;
    this.saveMapState();
    this.maybeAutoOpenMiddleDialogue();
  }
}
