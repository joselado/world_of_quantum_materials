import Phaser from 'phaser';
import { blend, shade } from '../art/colors';
import { getBiome } from '../art/biomes';
import type { Biome } from '../art/biomes';
import { makeCrystal } from '../art/crystals';
import { makeToken } from '../art/tokens';
import { makeNoetherAvatar } from '../art/noether';
import { makeBossCrystal } from '../art/boss';
import { makeDoorSprite } from '../art/door';
import { makeBlochAvatar } from '../art/bloch';
import { makeFeynmanAvatar } from '../art/feynman';
import { makeDresselhausAvatar } from '../art/dresselhaus';
import { makeLaughlinAvatar } from '../art/laughlin';
import { makeMajoranaAvatar } from '../art/majorana';
import { makeSklodowskaCurieAvatar } from '../art/sklodowskaCurie';
import { makeKondoAvatar } from '../art/kondo';
import { makeAndersonAvatar } from '../art/anderson';
import { makeFranklinAvatar } from '../art/franklin';
import { playGuardianChime } from '../audio/sfx';
import { project, fogColor, HORIZON_Y, CANVAS_W, CANVAS_H, ProjectedPoint } from '../art/perspective';
import {
  PLAYER_MATERIAL,
  WORLD_NAMES,
  getWildPool,
  getRival,
  rollRival9Type,
  MOVES,
  KONDO_MOVE_IDS,
  getPlayerMaterial,
  enemyStatsForWorld,
  DEFAULT_STATS,
  allCrystals,
} from '../data/materials';
import { PASSIVES, PASSIVE_OWNERS } from '../data/passives';
import type { PassiveOwner } from '../data/passives';
import { tokenColorForValue } from '../data/tokens';
import { getWorldQuestion } from '../data/quiz';
import { encounterGreeting } from '../data/greetings';
import { TUTORIAL_TIPS, hasSeenTip, markTipSeen } from '../data/tutorial';
import type { TutorialTipId } from '../data/tutorial';
import { STORY_BEATS } from '../data/story';
import { DEFAULT_ENCOUNTER_DENSITY } from '../data/settings';
import { persistFromRegistry } from '../data/save';
import type { DiscoveredMaterial } from '../data/save';
import type { Material, MaterialType, Stats } from '../data/types';
import { generateWorldMap } from '../world/mapgen';
import type { GridPoint } from '../world/mapgen';
import { fontPx } from '../ui/text';
import { music } from '../audio/music';
import { showNoetherShop } from './panels/noether';
import { showSklodowskaCuriePanel } from './panels/sklodowskaCurie';
import { showKondoPanel } from './panels/kondo';
import { showLaughlinPanel } from './panels/laughlin';
import { showFeynmanPanel } from './panels/feynman';
import { showBlochHub } from './panels/bloch';
import { showDresselhausPanel } from './panels/dresselhaus';
import { showMajoranaPanel } from './panels/majorana';
import { showAndersonPanel } from './panels/anderson';
import { showFranklinPanel } from './panels/franklin';

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
  regionColor: (number | null)[][];
  biomeOverride: (number | null)[][];
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
// Bigger than the player (34) so a world door reads as a real structure, but
// well under the boss (70) it shares the goal tile with once that world's
// rival is beaten -- a doorway is a landmark, not a threat.
const DOOR_SPRITE_SIZE = 46;
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

interface OverworldInitData {
  world?: number;
  regenerate?: boolean;
  // Only meaningful together with regenerate: true -- lands the player on
  // the freshly generated map's goalTile instead of the default startTile.
  // The backward door (OverworldScene.returnToPreviousWorld) is the one
  // caller that sets this, so walking back into an earlier world arrives
  // from its far end (already at the reached goal) rather than its near one.
  enterFrom?: 'start' | 'goal';
  // Set by the Lab's Guardians station (scenes/panels/hubStations.ts) when
  // the player picks an already-met guardian from anywhere but that
  // guardian's own world -- opens that guardian's panel once this scene's
  // own create() finishes building the (freshly regenerated) map, the same
  // panel `openGuardian` would show if the player had walked up to them.
  openGuardian?: boolean;
}

interface WorldSprite {
  x: number;
  y: number;
  size: number;
  container: Phaser.GameObjects.Container;
  label?: Phaser.GameObjects.Text;
  seed: number;
  // Boss names (WORLD_RIVALS/RIVAL_9_NAMES) run much longer than any
  // ordinary wild/guardian/door name -- set on bossSprites only (see
  // spawnBossSprite) so updateWorldSprites keeps a long wrapped label's
  // rendered bounds fully on-canvas instead of letting its center-anchored
  // position (which follows the camera like everything else on the map)
  // push it past either edge.
  clampLabelToCanvas?: boolean;
}

// One entry per world with a guardian -- replaces the old per-guardian
// `spawnXSprite`/`this.world === N` branches with a single data-driven
// dispatch (spawnGuardianSprite/openGuardian), the same "reusable rather than
// per-world bespoke" approach the map generator and biome table already
// use. Every guardian sets `open` explicitly: Noether (shop), Bloch
// (teleport hub), Dresselhaus (transmutation), Laughlin (analytic moves),
// Majorana (hybrid materials), Anderson (impurity doping, World 6), Feynman
// (move-leveling, World 7), Kondo (self-buff moves), Franklin (passive
// abilities, World 9). World 10 hosts Skłodowska-Curie (Ultimate moves), the
// guardians' own capstone. A future guardian added with no mechanic yet can
// still leave `open` unset and fall through to the shared showGuardianLore
// panel below.
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
  world = 1;
  private regenerate = false;
  // 'start' (the default) spawns the player at the freshly generated map's
  // startTile, same as ever; 'goal' is set only by the backward door
  // (returnToPreviousWorld/advanceToWorld) so the player instead lands on
  // goalTile, arriving from that world's far end.
  private enterFrom: 'start' | 'goal' = 'start';
  // Consumed once at the end of the create() that follows -- see
  // OverworldInitData.openGuardian.
  private openGuardianOnEntry = false;
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
  // Per-tile mapgen decoration (world/mapgen.ts's WorldMap) -- `regionColor`
  // tints a tile (world 1's/3's/8's colored branches/domains), `biomeOverride`
  // swaps which world's whole biome table a tile renders with (world 9's
  // borrowed-look defect patches). Both null-filled (no override) for a world
  // whose generator doesn't use them.
  private regionColor: (number | null)[][] = [];
  private biomeOverride: (number | null)[][] = [];
  private reachedGoal = false;
  private reachedMiddle = false;
  // Public rather than private: read/written directly by the extracted
  // scenes/panels/*.ts guardian-panel modules (Noether/Laughlin/Kondo/
  // Skłodowska-Curie sell moves and stats for qumatessence), which live outside
  // this class and so can't reach a `private` field. Same reasoning applies
  // to every other field/method below marked public instead of private.
  qumatessence = 0;
  private crystalSprites: (WorldSprite & { material: Material })[] = [];
  private tokenSprites: WorldSprite[] = [];
  // 0 or 1 entries -- reuses the same WorldSprite projection/wander/bob
  // machinery as crystals and tokens (spawnGuardianSprite) so a guardian is a
  // visible, wandering landmark standing on the map rather than only
  // appearing once their dialogue triggers.
  private guardianSprites: WorldSprite[] = [];
  // 0 or 1 entries -- this world's rival/boss, while still undefeated, a
  // purely visual landmark standing at the goal tile now that guardians have
  // moved to the corridor's middle (see spawnBossSprite/art/boss.ts's
  // makeBossCrystal) -- spawnDoorSprites takes over that tile with a door
  // once the rival is beaten, so this stays empty from then on.
  private bossSprites: WorldSprite[] = [];
  // 1 or 2 entries -- a doorway landmark always standing at this world's
  // startTile (leading back to World N-1, or the Hub for World 1) and,
  // once this world's rival is beaten, a second one at goalTile (leading
  // onward to World N+1). See spawnDoorSprites/art/door.ts's makeDoorSprite.
  private doorSprites: WorldSprite[] = [];
  private worldGfx!: Phaser.GameObjects.Graphics;
  private player!: Phaser.GameObjects.Container;
  private playerCrystalGfx!: Phaser.GameObjects.Container;
  playerMaterial!: Material;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  tokenText!: Phaser.GameObjects.Text;
  private goalText!: Phaser.GameObjects.Text;
  dialogueActive = false;
  dialogueContainer?: Phaser.GameObjects.Container;
  // Which section of Noether's panel is showing -- reset to 'moves' on
  // every fresh scene create so re-entering the world doesn't strand the
  // player on the stats tab.
  shopTab: 'moves' | 'stats' = 'moves';
  // Majorana's combine panel (§5): the first crystal picked, while the panel
  // rebuilds to ask for the second -- null means "no combine in progress,
  // show the initial pick list." Reset on every fresh scene create and every
  // closeDialogue() so a stale first pick can't survive a cancel-and-reopen.
  majoranaSelection: string | null = null;
  // Dresselhaus's transmute list and Majorana's per-step combine list both
  // paginate (Superposition Mode's candidate pool is every crystal in the
  // game, far more than one panel can show at once) -- same reset rules as
  // majoranaSelection above, plus a reset whenever majoranaSelection itself
  // changes (see showMajoranaPanel) so switching steps starts back on page 0.
  dresselhausPage = 0;
  majoranaPage = 0;
  // Anderson's impurity-doping panel (§5, World 9): the host crystal picked
  // to "dope in," while the panel rebuilds to ask which one of its moves to
  // learn -- null means "no doping in progress, show the host pick list."
  // Same reset/pagination rules as majoranaSelection/majoranaPage above.
  andersonSelection: string | null = null;
  andersonPage = 0;
  // Paginates the second step's own learnable-move list (renderPagedButtons)
  // -- a host only ever offers 1-2 moves in practice, but a cost-suffixed
  // label at a large text-size preset still needs the same measured
  // shrink-to-fit protection every other candidate list gets, rather than
  // an unprotected fixed render. Same reset rules as andersonPage above.
  andersonMovePage = 0;
  // Bloch's teleport hub (§5, World 2): paginated for the same reason as
  // Dresselhaus/Majorana/Anderson above -- Superposition Mode pre-seeds every
  // built world as visited, so a well-traveled player is no longer the rare
  // case Bloch's own destination list has to handle, it's the common one
  // (up to 9 destinations at once). Same reset rules.
  blochPage = 0;
  // Feynman's move-leveling list (§5, World 7): paginated for the same
  // reason as Bloch/Dresselhaus/Majorana/Anderson above -- every move the
  // player has ever unlocked across the whole game (SHOP_MOVE_IDS plus
  // Laughlin's/Kondo's/Anderson's own) can outgrow one panel well before
  // Superposition Mode's "every crystal" case even comes into it. Same
  // reset rules.
  feynmanPage = 0;

  // One entry per world with a guardian (see GuardianDef above). Most `open`
  // callbacks call an imported scenes/panels/<guardian>.ts function with `s`
  // rather than a method on this class -- see CODEMAP.md's "Guardian
  // panels" section for which state/helpers had to become public so those
  // external modules can reach them.
  private static readonly WORLD_GUARDIANS: Partial<Record<number, GuardianDef>> = {
    1: {
      id: 'noether',
      name: "Noether's Currents",
      labelColor: '#ffe066',
      strokeColor: 0xffe066,
      quote: 'Every symmetry hides a conservation law.',
      avatar: makeNoetherAvatar,
      tile: 'middle',
      open: (s) => showNoetherShop(s),
    },
    2: {
      id: 'bloch',
      name: "Bloch's States",
      labelColor: '#8fe8ff',
      strokeColor: 0x4adde0,
      quote: 'Every crystal is a superposition of the worlds it has touched.',
      avatar: makeBlochAvatar,
      tile: 'middle',
      open: (s) => showBlochHub(s),
    },
    3: {
      id: 'dresselhaus',
      name: "Dresselhaus's Nanostructures",
      labelColor: '#6ee8ba',
      strokeColor: 0x4ad9a0,
      quote: 'Build the same atoms into a different nanostructure and you get a different material entirely.',
      avatar: makeDresselhausAvatar,
      tile: 'middle',
      open: (s) => showDresselhausPanel(s),
    },
    4: {
      id: 'laughlin',
      name: "Laughlin's Analytics",
      labelColor: '#8fa0ff',
      strokeColor: 0x6a7fff,
      quote:
        'Take an electron liquid in a strong enough field and it condenses into something new -- excite it, and the charge that peels off is a fraction of an electron, not a whole one. Answer my questions right and I will teach your crystal to strike by that same physics.',
      avatar: makeLaughlinAvatar,
      tile: 'middle',
      open: (s) => showLaughlinPanel(s),
    },
    5: {
      id: 'majorana',
      name: "Majorana's Fusion",
      labelColor: '#9fffb0',
      strokeColor: 0x4fd97a,
      quote: 'Split one fermion into two halves, each its own antiparticle, and see what a superconductor can hide at its edge.',
      avatar: makeMajoranaAvatar,
      tile: 'middle',
      open: (s) => showMajoranaPanel(s),
    },
    6: {
      id: 'anderson',
      name: "Anderson's Impurities",
      labelColor: '#e8b27a',
      strokeColor: 0xc9884a,
      quote: 'Enough disorder and a wave stops spreading at all -- it localizes, trapped by the very randomness that surrounds it.',
      avatar: makeAndersonAvatar,
      tile: 'middle',
      open: (s) => showAndersonPanel(s),
    },
    7: {
      id: 'feynman',
      name: "Feynman's Diagrammatics",
      labelColor: '#ffa64a',
      strokeColor: 0xffa64a,
      quote: 'A tensor network and a Feynman diagram draw the same trick two ways -- a vertex for every point, a line for every leg.',
      avatar: makeFeynmanAvatar,
      tile: 'middle',
      open: (s) => showFeynmanPanel(s),
    },
    8: {
      id: 'kondo',
      name: "Kondo's Clouds",
      labelColor: '#ff8f6a',
      strokeColor: 0xe86a44,
      quote: 'A single stray spin, screened by a sea of conduction electrons until it all but disappears at low temperature.',
      avatar: makeKondoAvatar,
      tile: 'middle',
      open: (s) => showKondoPanel(s),
    },
    9: {
      id: 'franklin',
      name: "Franklin's Scatterings",
      labelColor: '#c9a8e0',
      strokeColor: 0xa878c9,
      quote:
        'Fire X-rays through a defect-riddled crystal and the sharp spots blur into diffuse rings -- every pore and dislocation leaves its own signature in how the beam scatters. I can teach your crystal to scatter a blow the same way.',
      avatar: makeFranklinAvatar,
      tile: 'middle',
      open: (s) => showFranklinPanel(s),
    },
    10: {
      id: 'sklodowskaCurie',
      name: "Skłodowska-Curie's Experiments",
      labelColor: '#d9e86a',
      strokeColor: 0xc9d84a,
      quote:
        'I lead this circle of guardians, and here is our last lesson: answer three questions in a row on everything you have learned, and your crystal will strike with a force none of the others can match.',
      avatar: makeSklodowskaCurieAvatar,
      tile: 'middle',
      open: (s) => showSklodowskaCuriePanel(s),
    },
  };

  // The id/name/world triplet the Lab's Guardians station (HubScene, via
  // scenes/panels/hubStations.ts) needs to list a met guardian and warp to
  // their world -- everything else on GuardianDef (avatar builder, colors,
  // `open` callback) stays private to this class.
  static guardianRoster(): { id: string; name: string; world: number }[] {
    return Object.entries(OverworldScene.WORLD_GUARDIANS)
      .filter((entry): entry is [string, GuardianDef] => !!entry[1])
      .map(([world, guardian]) => ({ id: guardian.id, name: guardian.name, world: Number(world) }));
  }

  constructor() {
    super('Overworld');
  }

  init(data: OverworldInitData) {
    this.world = data?.world ?? 1;
    this.regenerate = data?.regenerate ?? false;
    this.enterFrom = data?.enterFrom ?? 'start';
    this.openGuardianOnEntry = data?.openGuardian ?? false;
  }

  create() {
    this.moving = false;
    // World 9's rival re-rolls every time the player reaches this world
    // (Hub door, Bloch's teleport, "Continue to World N+1," a debug warp --
    // every path that lands here goes through this same create()) --
    // clearing the cached value here forces resolveRival9Type()'s first
    // read this visit to roll fresh; it then stays cached (so the goal-tile
    // preview and the actual battle still agree) for the rest of this visit.
    if (this.world === 9) this.game.registry.remove('rival9Type');
    // Phaser reuses the same Scene instance across scene.start()/restart()
    // calls -- only init()/create() rerun, class field initializers don't --
    // so a dialogue left open when the player switches away (H or Enter to
    // return to the Lab, a debug warp, Bloch's teleport -- all skip straight
    // to scene.start without closing whatever's open first) would otherwise
    // leave dialogueActive stuck true forever on this instance, freezing
    // movement (update()'s dialogueActive guard) on every future visit. Any
    // stale reference to the old (now-destroyed) panel container needs
    // clearing too.
    this.dialogueActive = false;
    this.dialogueContainer = undefined;
    this.majoranaSelection = null;
    this.dresselhausPage = 0;
    this.majoranaPage = 0;
    this.andersonSelection = null;
    this.andersonPage = 0;
    this.andersonMovePage = 0;
    this.blochPage = 0;
    this.feynmanPage = 0;
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
    this.spawnDoorSprites();
    music.play(`overworld:${this.world}`);

    this.qumatessence = (state.get('qumatessence') as number) || 0;
    this.playerMaterial = getPlayerMaterial(state);
    this.applySuperpositionLeveling();
    this.shopTab = 'moves';
    this.recordVisit();

    // Corner HUD block: world name stacked above the token counter (running
    // `y`, the name's own wordWrap-driven height advancing it) rather than
    // sharing one row, since a long world name (e.g. world 5's "Frozen
    // Zero-Resistance Caverns") or a big text-size setting can each push it
    // to wrap onto two lines and collide with a fixed-position counter. No
    // permanent key-hint lines (movement, M/H/Enter) live here -- the Lab's
    // Tutorial station already covers all of it (data/tutorial.ts) as a
    // replayable recap, which a fixed on-screen reminder would only
    // duplicate while adding to the overflow risk every long world name or
    // big text size already puts on this corner.
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
      .text(CANVAS_W - 8, hudY, `Qumatessence: ${this.qumatessence}`, {
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
    this.input.keyboard!.on('keydown-H', () => this.returnToHub());
    this.input.keyboard!.on('keydown-ENTER', () => this.returnToHub());

    // Defensive fallback only -- TitleScene normally seeds all of these
    // from localStorage (data/save.ts) before Overworld ever runs. Only
    // relevant if this scene is ever launched directly (ad hoc dev testing).
    if (state.get('qumatessence') === undefined) {
      state.set('qumatessence', 0);
      state.set('unlockedMoves', [...PLAYER_MATERIAL.moves]);
      state.set('playerHp', PLAYER_MATERIAL.maxHp);
      state.set('rivalDefeated', {});
      state.set('discoveredMaterials', []);
      state.set('playerStats', { ...DEFAULT_STATS });
      state.set('visitedWorlds', []);
      state.set('defeatedMaterials', []);
      state.set('playerForm', null);
      state.set('metGuardians', []);
      state.set('kondoActiveMove', null);
      state.set('passivesUnlocked', []);
      state.set('activePassiveByOwner', {});
      state.set('moveClassTuning', {});
      state.set('ultimateClassesUnlocked', {});
      state.set('andersonDopant', null);
    }

    this.maybeAutoOpenGoalDialogue();
    this.maybeAutoOpenMiddleDialogue();
    // Same "don't stack on top of an already-open panel" guard the old
    // first-run tutorial used -- the player's starting tile is never on the
    // goal/middle row, so this only actually skips in practice if a future
    // change moves the start closer to either.
    if (!this.dialogueActive) this.showTutorialTip('controls');

    // Lab Guardians-station warp (OverworldInitData.openGuardian): reopen
    // this world's guardian once their world has finished (re)generating,
    // same panel `openGuardian` shows when walked up to directly.
    if (this.openGuardianOnEntry) {
      this.openGuardianOnEntry = false;
      const guardian = OverworldScene.WORLD_GUARDIANS[this.world];
      if (guardian) this.openGuardian(guardian);
    }
  }

  isSuperpositionMode(): boolean {
    return !!this.game.registry.get('superpositionMode');
  }

  // Superposition Mode (Title screen toggle, data/save.ts's `superpositionMode`):
  // re-levels the player to a fair footing for whatever world this scene
  // just entered, on every entry -- not just the Hub door's initial jump, so
  // Continue-to-next-world and Bloch's teleport stay competitive too. A flat
  // +2 over enemyStatsForWorld keeps the player slightly ahead rather than
  // exactly even. Also grants every move (so there's always something to
  // fight with regardless of what's been bought), a full heal, marks every
  // built world visited so Bloch's teleport hub (showBlochHub, gated on
  // `visitedWorlds`) offers all of them immediately -- this is what makes
  // Bloch alone sufficient for world-to-world movement in this mode, with no
  // separate warp panel needed -- and pre-fills the Hub's Materialdex with
  // every real compound in the game (`allCrystals()`) so it reads as fully
  // discovered rather than reflecting only what's actually been encountered.
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
    // Materialdex entries are a passive discovery log, not a player choice
    // (unlike kondoActiveMove/activePassiveByOwner below, there's no prior
    // pick here an overwrite could clobber), so this is unconditional and
    // re-set every re-level, same as unlockedMoves above.
    this.game.registry.set(
      'discoveredMaterials',
      allCrystals().map((material) => ({ name: material.name, type: material.type }))
    );
    // Granting every move (above) would otherwise leave Kondo's three stuck
    // invisible in battle -- getBattleMoves only ever surfaces whichever one
    // is `kondoActiveMove`, and that field isn't touched by the "learn
    // everything" grant above. Only seed it if nothing's active yet, so a
    // player who already picked one via showKondoPanel keeps that choice
    // across re-levels. Laughlin's and Skłodowska-Curie's tunable moves need
    // no equivalent seeding -- unlike an unset `kondoActiveMove` (which hides
    // a move from battle entirely), an unset `moveClassTuning` entry just
    // leaves that move untuned (getTunedMoveClass falls back to the move's
    // own always-safe default 'phonon' class), which is already a normal,
    // fully-usable state; and `unlockedMoves` above already grants both of
    // Skłodowska-Curie's Ultimate move ids directly (Object.keys(MOVES)), so
    // an unseeded `ultimateClassesUnlocked` doesn't block them either --
    // Superposition Mode's blanket grant bypasses her shop/unlock-cost path
    // entirely.
    if (!this.game.registry.get('kondoActiveMove')) {
      this.game.registry.set('kondoActiveMove', KONDO_MOVE_IDS[0]);
    }
    // Every passive owner's kit (data/passives.ts's PASSIVE_OWNERS): unlock
    // every passive outright (mirrors the unconditional unlockedMoves grant
    // above -- there's no per-form gate to respect the way ordinary moves
    // have), but only seed an active pick per owner if nothing's chosen yet
    // for that owner, same reasoning as kondoActiveMove just above -- a
    // deliberate pick made via showFranklinPanel should survive every later
    // re-level.
    this.game.registry.set('passivesUnlocked', Object.keys(PASSIVES));
    const activeByOwner = { ...((this.game.registry.get('activePassiveByOwner') as Partial<Record<PassiveOwner, string>>) ?? {}) };
    for (const owner of PASSIVE_OWNERS) {
      if (!activeByOwner[owner]) {
        activeByOwner[owner] = Object.values(PASSIVES).find((p) => p.owner === owner)?.id;
      }
    }
    this.game.registry.set('activePassiveByOwner', activeByOwner);
    persistFromRegistry(this.game.registry);
  }

  // Contextual onboarding (data/tutorial.ts's TUTORIAL_TIPS): each tip fires
  // once per save, the moment its own feature actually becomes relevant --
  // see the call sites in maybeTriggerEncounter (encounter), startBattle
  // (battle), maybeCollectToken (qumatessence), openGuardian (guardian), and
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

  // Fresh random layout -- used on first load and whenever the player
  // explicitly changes worlds (Hub door, Bloch's teleport, a debug warp),
  // which is the one action meant to reshuffle the map.
  private generateMap() {
    this.reachedGoal = false;
    this.reachedMiddle = false;
    this.playerTile = { x: Math.floor(GRID_W / 2), y: GRID_H - 5 };

    const wildPool = getWildPool(this.world);
    // World 10's own shape is dispatched by the player's current material
    // type (world/generators/world10.ts) -- every other world ignores this
    // param.
    const playerType = this.world === 10 ? getPlayerMaterial(this.game.registry).type : undefined;
    const map = generateWorldMap(GRID_W, GRID_H, this.playerTile, this.world, playerType);
    this.walkable = map.walkable;
    this.tokenTiles = map.tokens;
    this.goalTile = map.goal;
    this.startTile = map.start;
    this.midTile = map.mid;
    this.regionColor = map.regionColor;
    this.biomeOverride = map.biomeOverride;

    // The backward door (returnToPreviousWorld) lands the player on this
    // freshly generated map's goalTile instead of the corridor's south-edge
    // startTile -- walking in from the far end, already at the reached
    // goal, rather than re-walking the whole corridor. Overriding playerTile
    // here (after generateWorldMap already used the default south-edge
    // point to lay the corridor out) leaves map generation itself untouched.
    if (this.enterFrom === 'goal') {
      this.playerTile = { ...this.goalTile };
      this.reachedGoal = true;
    }

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

    // Landing via the backward door (enterFrom === 'goal', above) needs this
    // freshly generated layout snapshotted immediately, not just held in
    // memory -- a wild fight fought anywhere in this world (e.g. answering
    // "Face the Rival" from the goal panel that's about to auto-open) round
    // trips through BattleScene with no `regenerate` flag, and create()
    // restores from this saved snapshot rather than calling generateMap()
    // again; without saving here that restore would fall back to whatever
    // was saved for a *different* world and regenerate from the ordinary
    // south-edge startTile instead.
    if (this.enterFrom === 'goal') this.saveMapState();
  }

  // The Lab's Settings station (panels/hubStations.ts's showSettingsPanel)
  // knob: the per-corridor-row chance a wild crystal spawns, one of
  // data/settings.ts's DENSITY_PRESETS. Read fresh at map-generation time
  // rather than cached, so a mid-run Settings change takes effect the next
  // time a map is (re)generated.
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
    this.regionColor = saved.regionColor;
    this.biomeOverride = saved.biomeOverride;
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
      regionColor: this.regionColor,
      biomeOverride: this.biomeOverride,
      reachedGoal: this.reachedGoal,
      reachedMiddle: this.reachedMiddle,
    };
    this.game.registry.set('mapState', saved);
  }

  // Every path back to the Hub (H/Enter, the World 10 finale, stepping back
  // through World 1's own start door) goes through this rather than calling
  // `scene.start('Hub')` directly -- saveMapState() only fires at specific
  // event tiles (encounter/goal/middle) otherwise, so a player who simply
  // walks around and leaves without hitting one of those would find `mapState`
  // stale or (on a world visited for the first time) entirely absent, and the
  // Hub door's next "resume in place" attempt would silently regenerate a
  // fresh map instead (HubScene.canResumeWorld() checks this same `mapState`
  // key to decide whether its door/Enter-key promise a resume at all).
  private returnToHub() {
    this.saveMapState();
    this.scene.start('Hub');
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
    this.updateWorldSprites(this.doorSprites);

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
        // Repeat visits to the goal-door landmark reopen the gate panel too
        // (maybeReachGoal itself only auto-opens it the first time this
        // world's goal row is ever reached) -- tile-exact rather than
        // "whole row," since this is specifically "walked onto the door,"
        // not "reached the finish line."
        if (nx === this.goalTile.x && ny === this.goalTile.y) this.maybeAutoOpenGoalDialogue();
        this.maybeReachStartDoor(nx, ny);
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
        // World 9's defect patches (world/generators/world9.ts) tag a tile
        // with which world's biome table it should render with instead of
        // this scene's own -- every other world leaves this null.
        const overrideWorld = this.biomeOverride[y]?.[x];
        const tileBiome = overrideWorld != null ? getBiome(overrideWorld) : this.biome;
        const regionTint = this.regionColor[y]?.[x] ?? null;

        if (walkable) {
          let color = fogColor(tileBiome.path, depthRatio, tileBiome.fogTarget);
          if (regionTint != null) color = blend(color, regionTint, 0.55);
          g.fillStyle(color, 1);
          g.fillPoints([pFL, pFR, pNR, pNL], true);
          g.lineStyle(1, shade(color, -20), 0.3);
          g.strokePoints([pFL, pFR, pNR, pNL], true);
          if (depthRatio < 0.75 && this.flowerMap[y]?.[x]) {
            this.decorateTile(g, pFL, pFR, pNR, pNL);
          }
          if (Math.abs(x - this.midTile.x) <= 1 && Math.abs(y - this.midTile.y) <= 1) {
            this.drawMidHighlight(g, pFL, pFR, pNR, pNL, depthRatio);
          }
        } else {
          this.drawOffPathTile(g, x, y, pFL, pFR, pNR, pNL, depthRatio, tileBiome, regionTint);
        }
      }
    }
  }

  // The guardian chokepoint (invariant B, world/mapgen.ts's forceChokepoint)
  // gets its own floor treatment -- a soft pulsing glow over the same path
  // fill, in that world's own guardian color (WORLD_GUARDIANS' strokeColor,
  // the same per-guardian color coding every panel/pill already uses) --
  // covering `midTile` and its immediate neighbors so the forced pinch reads
  // as a deliberate gate the player is walking through, not an arbitrary
  // narrow spot.
  private drawMidHighlight(
    g: Phaser.GameObjects.Graphics,
    pFL: ProjectedPoint,
    pFR: ProjectedPoint,
    pNR: ProjectedPoint,
    pNL: ProjectedPoint,
    depthRatio: number
  ) {
    if (depthRatio > 0.9) return;
    const glowColor = OverworldScene.WORLD_GUARDIANS[this.world]?.strokeColor ?? 0xffe066;
    const pulse = 0.5 + 0.5 * Math.sin(this.time.now / 320);
    g.fillStyle(glowColor, 0.28 * pulse * (1 - depthRatio));
    g.fillPoints([pFL, pFR, pNR, pNL], true);
    g.lineStyle(1.5, glowColor, 0.6 * (1 - depthRatio));
    g.strokePoints([pFL, pFR, pNR, pNL], true);
  }

  // Dispatches an off-path tile's look by its own biome's `wallTheme`
  // (art/biomes.ts, resolved per-tile by `biomeOverride` -- see drawWorld)
  // -- most biomes stay 'rock' (raised stacked-stone block, the original
  // look), but a few render terrain you can plausibly see is impassable
  // instead of a uniformly-colored wall: 'lava' (a flat glowing molten
  // crust), 'water' (a dark rippling frozen lake), 'void' (open sky you'd
  // fall through). Only 'rock' extrudes a solid block; the other three are
  // flush with the ground plane, since a wall of lava/water/open air isn't
  // a raised stone block.
  //
  // A tile carrying a `regionColor` (world/mapgen.ts's Voronoi domains,
  // world3.ts) always renders as solid extruded ground tinted with that
  // color instead, regardless of `wallTheme` -- a domain interior is meant
  // to read as a distinct solid zone the player walks around, not whatever
  // hazard that biome's own off-path terrain happens to use (world 3's own
  // biome is `wallTheme: 'void'`, which would otherwise render every domain
  // as empty sky rather than a colored region).
  private drawOffPathTile(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    pFL: ProjectedPoint,
    pFR: ProjectedPoint,
    pNR: ProjectedPoint,
    pNL: ProjectedPoint,
    depthRatio: number,
    biome: Biome,
    regionTint: number | null
  ) {
    if (regionTint != null) {
      const color = blend(fogColor(biome.ground, depthRatio, biome.fogTarget), regionTint, 0.6);
      g.fillStyle(color, 1);
      g.fillPoints([pFL, pFR, pNR, pNL], true);
      g.lineStyle(1, shade(color, -20), 0.3);
      g.strokePoints([pFL, pFR, pNR, pNL], true);
      this.drawWallFaces(g, x, y, pFL, pFR, pNR, pNL, color);
      return;
    }

    const theme = biome.wallTheme;
    if (theme === 'lava') {
      this.drawLavaTile(g, pFL, pFR, pNR, pNL, depthRatio, biome);
      return;
    }
    if (theme === 'water') {
      this.drawWaterTile(g, pFL, pFR, pNR, pNL, depthRatio, biome);
      return;
    }
    if (theme === 'void') {
      this.drawVoidTile(g, x, y, pFL, pFR, pNR, pNL, depthRatio);
      return;
    }

    const color = fogColor(biome.ground, depthRatio, biome.fogTarget);
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
    depthRatio: number,
    biome: Biome
  ) {
    const crust = fogColor(biome.ground, depthRatio, biome.fogTarget);
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
    depthRatio: number,
    biome: Biome
  ) {
    const base = fogColor(biome.ground, depthRatio, biome.fogTarget);
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

  // Qumatessence pickups live only at the dead end of branches -- shiny little
  // clouds (see art/tokens.ts), colored by value tier (data/tokens.ts) and
  // labeled with the exact value so the payout reads at a glance before the
  // player walks all the way out there.
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

  // World 9's rival (an impurity/defect-bound resonance) has no fixed type --
  // it's re-rolled (data/materials.ts's rollRival9Type) every time the player
  // reaches World 9 (create()'s own `rival9Type` registry clear above forces
  // the first read below each visit to roll fresh) and then cached in the
  // registry/save for the rest of that visit, so the goal-tile boss preview
  // (spawnBossSprite) and the actual battle (showRivalEncounter) still agree
  // on which crystal it turned out to be within a single visit.
  private resolveRival9Type(): MaterialType {
    const cached = this.game.registry.get('rival9Type') as MaterialType | undefined;
    if (cached) return cached;
    const rolled = rollRival9Type();
    this.game.registry.set('rival9Type', rolled);
    persistFromRegistry(this.game.registry);
    return rolled;
  }

  private getWorldRival(): Material | undefined {
    return getRival(this.world, this.world === 9 ? this.resolveRival9Type() : undefined);
  }

  // This world's rival/boss (getWorldRival), standing at the goal tile as a
  // gigantic, unmissable-from-a-distance landmark -- purely visual (no
  // world has a WORLD_RIVALS gap, so this always finds one for a built
  // world). The actual fight still only starts from "Face the Rival" in the
  // goal gate panel (showGatePanel/showRivalEncounter); walking up to this
  // sprite doesn't trigger anything on its own, same as a guardian sprite.
  // Stops rendering once the rival is beaten -- a still-looming defeated
  // boss would read as unresolved, where the door spawnDoorSprites puts at
  // this same tile instead reads as "the way is open."
  private spawnBossSprite() {
    this.bossSprites = [];
    if (this.isRivalDefeated()) return;
    const boss = this.getWorldRival();
    if (!boss) return;

    const avatar = makeBossCrystal(this, BOSS_CRYSTAL_SIZE, boss.color, boss.variant);
    avatar.setDepth(20);

    // Wrapped and centered (not just single-line) since a polycrystalline-
    // golem name (e.g. "Polycrystalline Manganese Bismuth Telluride Golem")
    // runs far longer than any other landmark's label -- clampLabelToCanvas
    // below (updateWorldSprites) keeps the wrapped block's own rendered
    // bounds on-canvas regardless of where the camera puts this sprite.
    const label = this.add
      .text(0, 0, boss.name, {
        fontSize: fontPx(this, 12),
        fontStyle: 'bold',
        color: '#ff8f8f',
        backgroundColor: 'rgba(0,0,0,0.5)',
        padding: { x: 4, y: 2 },
        align: 'center',
        wordWrap: { width: 220, useAdvancedWrap: true },
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
      clampLabelToCanvas: true,
    });
  }

  // The doorway landmark at this world's startTile, always present (leading
  // back to World N-1, or the Lab for World 1), plus a second one at
  // goalTile once this world's rival is beaten (leading onward to World
  // N+1, standing in for the boss avatar -- spawnBossSprite stops rendering
  // its own avatar there once the rival is beaten). Purely visual, same as
  // a guardian or boss sprite -- walking onto either tile is what actually
  // opens the confirm panel that switches worlds (maybeReachStartDoor/
  // showStartDoorPanel for the start door, maybeReachGoal/
  // maybeAutoOpenGoalDialogue for the goal door).
  private spawnDoorSprites() {
    this.doorSprites = [];

    const startDoor = makeDoorSprite(this, DOOR_SPRITE_SIZE);
    startDoor.setDepth(20);
    const startLabel = this.add
      .text(0, 0, this.world === 1 ? 'Door to the Lab' : `Door to World ${this.world - 1}`, {
        fontSize: fontPx(this, 11),
        color: '#e6d9ff',
        backgroundColor: 'rgba(0,0,0,0.45)',
        padding: { x: 3, y: 1 },
      })
      .setOrigin(0.5, 1)
      .setDepth(21);
    // Drawn one row north of startTile itself (still guaranteed walkable --
    // world/mapgen.ts's buildCorridor never drifts the corridor's center
    // before MIN_STRAIGHT_ROWS=2 straight rows, so the row right above the
    // south edge is always centered on startTile.x too), not on top of it.
    // The forward-facing camera (updateWorldSprites' `depth = camY - c.y`)
    // never renders anything behind the player's own row, so a sprite
    // sitting exactly on startTile would only ever be visible while stacked
    // directly under the player's own crystal, standing on the same tile --
    // one row ahead puts it in front of the player at spawn and again every
    // time they walk back down to the start row. The trigger tile itself
    // (maybeReachStartDoor, below) stays at the real startTile -- moving it
    // to match the sprite would fire on the player's very first step away
    // from spawn instead of on walking back to it.
    this.doorSprites.push({
      x: this.startTile.x,
      y: this.startTile.y - 1,
      size: DOOR_SPRITE_SIZE,
      container: startDoor,
      label: startLabel,
      seed: Math.random() * Math.PI * 2,
    });

    if (!this.isRivalDefeated()) return;
    const isLastWorld = this.world >= Math.max(...BUILT_WORLDS);
    const goalDoor = makeDoorSprite(this, DOOR_SPRITE_SIZE);
    goalDoor.setDepth(20);
    const goalLabel = this.add
      .text(0, 0, isLastWorld ? 'The way is open' : `Door to World ${this.world + 1}`, {
        fontSize: fontPx(this, 11),
        color: '#e6d9ff',
        backgroundColor: 'rgba(0,0,0,0.45)',
        padding: { x: 3, y: 1 },
      })
      .setOrigin(0.5, 1)
      .setDepth(21);
    this.doorSprites.push({
      x: this.goalTile.x,
      y: this.goalTile.y,
      size: DOOR_SPRITE_SIZE,
      container: goalDoor,
      label: goalLabel,
      seed: Math.random() * Math.PI * 2,
    });
  }

  // Wanders each sprite a little around its home tile (small sinusoidal
  // drift + bob) rather than leaving it pinned dead-center, so tiles read as
  // living/glinting things instead of static map decoration. Shared by both
  // wild-encounter crystals and qumatessence pickups.
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
      // A clamped label (currently just a boss's own, see spawnBossSprite)
      // keeps its rendered half-width (label.width already reflects any
      // wordWrap) from pushing past either canvas edge, rather than staying
      // strictly centered on the sprite's own projected x like every other
      // landmark's shorter label.
      const labelX = c.clampLabelToCanvas && c.label ? Phaser.Math.Clamp(p.x, (c.label.width * p.scale) / 2, CANVAS_W - (c.label.width * p.scale) / 2) : p.x;
      c.label?.setPosition(labelX, p.y + bob - c.size * p.scale - 4);
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
  // first time it's ever encountered (not per-battle) -- only called from
  // maybeTriggerEncounter's ordinary wild-tile path, never from
  // showRivalEncounter, so a world's rival/boss is never recorded here.
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

    const question = getWorldQuestion(this.world);
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

  addDialogueButton(container: Phaser.GameObjects.Container, y: number, label: string, onClick: () => void) {
    return this.addDialogueButtonAt(container, CANVAS_W / 2, y, label, onClick, 480);
  }

  // Underlies addDialogueButton -- broken out so a footer row can place two
  // buttons side by side (Noether's "Farewell" / "Continue to World 2")
  // instead of stacking them, which would otherwise push the panel past the
  // bottom of the canvas.
  addDialogueButtonAt(
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
  closeDialogue() {
    this.dialogueContainer?.destroy(true);
    this.dialogueContainer = undefined;
    this.dialogueActive = false;
    this.majoranaSelection = null;
    this.dresselhausPage = 0;
    this.majoranaPage = 0;
    this.andersonSelection = null;
    this.andersonPage = 0;
    this.andersonMovePage = 0;
    this.blochPage = 0;
    this.feynmanPage = 0;
  }

  private isRivalDefeated(): boolean {
    const rivalDefeated = (this.game.registry.get('rivalDefeated') as Record<number, boolean>) ?? {};
    return !!rivalDefeated[this.world];
  }

  // Reopens this world's goal gate panel (showGatePanel -- no guardian stands
  // here anymore, see WORLD_GUARDIANS' `tile: 'middle'`) whenever the player
  // is currently standing on the already-reached goal row -- both right
  // after first stepping onto it, after any later round trip through
  // BattleScene (a wild fight fought near the goal, or the rival fight
  // itself resolving) with the player still there, on landing here via the
  // backward door's `enterFrom: 'goal'`, and on walking onto the goal-door
  // landmark again later (see tryMove's onComplete). Gated on the player's
  // *current* tile, not just the historical reachedGoal flag, so a battle
  // fought elsewhere in the world (after the goal was reached once) doesn't
  // pop this open out of nowhere on return -- the Guardians pause-menu list
  // (showGuardiansPanel) already covers deliberately revisiting from afar.
  // Since the guardian is mid-corridor, reached well before the goal, the
  // player always has a chance to shop/prep before ever facing the boss
  // waiting here; the rival fight is what "Continue to World N+1" triggers
  // (see tryAdvanceToNextWorld).
  private maybeAutoOpenGoalDialogue() {
    if (!this.reachedGoal || this.dialogueActive) return;
    if (this.playerTile.y !== this.goalTile.y) return;
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
  // moved mid-corridor) -- the boss looming at this same tile (spawnBossSprite,
  // replaced by a door once beaten) is what's actually guarding the way,
  // this panel is just enough text plus the shared footer to reach the
  // rival gate or continue onward, so no built world is ever a dead end.
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
        this.returnToHub();
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
    const rival = this.getWorldRival();
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
  renderFarewellFooter(container: Phaser.GameObjects.Container, footerY: number): number {
    const btn = this.addDialogueButtonAt(container, CANVAS_W / 2, footerY, 'Farewell', () => this.closeDialogue(), 260);
    return footerY + btn.height;
  }

  advanceToWorld(world: number, enterFrom: 'start' | 'goal' = 'start') {
    this.closeDialogue();
    this.scene.start('Overworld', { world, regenerate: true, enterFrom });
  }

  // A confirm step before actually leaving this world backward -- walking
  // onto the door standing at startTile (spawnDoorSprites, maybeReachStartDoor)
  // opens this rather than switching worlds immediately, so brushing the
  // tile while exploring near the south edge can't backtrack the player by
  // accident. Same dark rounded-rectangle-with-stroke panel treatment as
  // every other overworld dialogue, stroked lavender to match
  // showStoryBeat's own between-worlds panel.
  private showStartDoorPanel() {
    this.dialogueActive = true;

    const isFirstWorld = this.world === 1;
    const destination = isFirstWorld ? 'the Lab' : `World ${this.world - 1}`;

    const panelWidth = 480;
    const top = 160;
    const container = this.add.container(0, 0).setDepth(100);
    this.dialogueContainer = container;

    let y = top;

    const text = this.add
      .text(CANVAS_W / 2, y, `A doorway leads back to ${destination}.`, {
        fontSize: fontPx(this, 14),
        color: '#e6d9ff',
        align: 'center',
        wordWrap: { width: panelWidth - 60 },
      })
      .setOrigin(0.5, 0);
    container.add(text);
    y += text.height + 22;

    const a = this.addDialogueButtonAt(container, CANVAS_W / 2 - 118, y, 'Not yet', () => this.closeDialogue());
    const b = this.addDialogueButtonAt(
      container,
      CANVAS_W / 2 + 118,
      y,
      `Return to ${destination}`,
      () => this.returnToPreviousWorld()
    );
    y += Math.max(a.height, b.height);
    y += 16;

    const panelHeight = y - top;
    const panel = this.add
      .rectangle(CANVAS_W / 2, top + panelHeight / 2, panelWidth, panelHeight, 0x10101c, 0.94)
      .setStrokeStyle(2, 0xd9a5ff);
    container.addAt(panel, 0);
  }

  // Backward counterpart to tryAdvanceToNextWorld/advanceToWorld -- World 1's
  // door leads to the Hub (there is no World 0 overworld map to land on),
  // every other world's leads to World N-1, landing the player at that
  // world's own goalTile with reachedGoal already true (advanceToWorld's
  // `enterFrom: 'goal'`) rather than its startTile, so stepping back through
  // a door reads as walking in from the far end, not re-walking the whole
  // corridor.
  private returnToPreviousWorld() {
    this.closeDialogue();
    if (this.world === 1) {
      this.returnToHub();
      return;
    }
    this.advanceToWorld(this.world - 1, 'goal');
  }

  // The doorway standing at this world's startTile (spawnDoorSprites) opens
  // a confirm panel exactly when the player is standing on it -- tile-exact
  // rather than "whole row" like maybeReachGoal/maybeReachMiddle, since a
  // branch can wind back down to a tile on this same row away from the door
  // itself, and this needs to fire only right at the landmark. Never a
  // one-shot -- walking onto it always reopens the confirm panel, since the
  // confirmation step itself (not a "seen it once" flag) is what keeps a
  // brush against it from becoming an accidental backtrack.
  private maybeReachStartDoor(x: number, y: number) {
    if (this.dialogueActive) return;
    if (x !== this.startTile.x || y !== this.startTile.y) return;
    this.showStartDoorPanel();
  }

  getUnlockedMoves(): string[] {
    return (this.game.registry.get('unlockedMoves') as string[]) ?? [...PLAYER_MATERIAL.moves];
  }

  getVisitedWorlds(): number[] {
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

  getDefeatedMaterials(): DiscoveredMaterial[] {
    return (this.game.registry.get('defeatedMaterials') as DiscoveredMaterial[]) ?? [];
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
  // (Superposition Mode pre-seeding every world as visited). Row height
  // also isn't uniform across a page: a long, multi-word candidate label (a
  // crystal name like "Rhombohedral Pentalayer Graphene/hBN Moiré", or a
  // guardian-shop label with a cost suffix) can word-wrap to two lines at a
  // large text-size preset while a short one stays on one, so a fixed
  // per-row estimate can under-count how much vertical space a page
  // actually needs once it holds a realistic mix of long and short labels.
  // This measures every candidate's own label height for real (off-canvas,
  // destroyed immediately after) and packs each page until the next label
  // wouldn't fit -- reserving space above the caller's own trailing content
  // (its Farewell/Close button, and for Majorana's/Anderson's second step,
  // an extra "Never mind" cancel row above that) the same way a uniform
  // estimate did, but sizing each row from its actual rendered height
  // rather than a single short sample string. Packing runs twice: once
  // without reserving room for this function's own Prev/Next-and-page-label
  // row (a single shared row, not two stacked ones -- see below), and if
  // every item already fits on that one page, that's the real answer -- no
  // point reserving space for controls that will never actually render.
  // Only when the whole list doesn't fit on one page does a second pass
  // reserve that row's height too, since now it genuinely will show. This
  // matters most for a guardian whose avatar/intro text already leaves
  // little slack at the largest text-size preset (Majorana, Anderson): a
  // short candidate list that would fit together on one page must not be
  // needlessly split into two by a reservation for controls it doesn't
  // need. Verified via headless-Chromium bounds checks at every font-scale
  // preset, see DEVELOPMENT.md's "Verifying UI changes" section.
  renderPagedButtons<T extends { name: string }>(
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
    const reservedControls = rowH; // this function's own Prev/Next-and-page-label row (a single shared row, see below), reserved only once a second pass confirms it's actually needed

    // addDialogueButton's own default wrap width (480) -- matched here so
    // this measurement wraps exactly the way the real button below will.
    const measureRowHeight = (label: string) => {
      const t = this.add.text(-2000, -2000, label, {
        fontSize: fontPx(this, 13),
        padding: { x: 10, y: 5 },
        align: 'center',
        wordWrap: { width: 480 },
      });
      const h = t.height + 6;
      t.destroy();
      return h;
    };
    const rowHeights = items.map((item) => measureRowHeight(labelFor(item)));
    const pack = (available: number): T[][] => {
      const result: T[][] = [];
      let current: T[] = [];
      let used = 0;
      items.forEach((item, i) => {
        const h = rowHeights[i];
        if (current.length > 0 && (current.length >= maxPerPage || used + h > available)) {
          result.push(current);
          current = [];
          used = 0;
        }
        current.push(item);
        used += h;
      });
      result.push(current); // always at least one page, even for a short/empty list
      return result;
    };
    const withoutControls = pack(CANVAS_H - y - reservedTail);
    const pages = withoutControls.length <= 1 ? withoutControls : pack(CANVAS_H - y - reservedTail - reservedControls);

    const totalPages = pages.length;
    const clampedPage = Phaser.Math.Clamp(page, 0, totalPages - 1);
    const pageItems = pages[clampedPage];
    pageItems.forEach((item) => {
      const btn = this.addDialogueButton(container, y, labelFor(item), () => onPick(item));
      if (isDim?.(item)) btn.setAlpha(0.5);
      y += btn.height + 6;
    });
    if (totalPages > 1) {
      // Prev/Next and the "Page N/M" label share one row (rather than a
      // button row followed by a separate label row below it) -- this
      // alone reclaims a full row's height plus its trailing gap on every
      // paginated list, real margin a two-row layout was spending on
      // chrome rather than actual content, which matters most for a
      // guardian whose avatar/intro text already leaves little slack
      // before the canvas bottom at the largest text-size preset.
      const prev = this.addDialogueButtonAt(
        container,
        CANVAS_W / 2 - 170,
        y,
        '<- Prev',
        () => {
          if (clampedPage > 0) onPageChange(clampedPage - 1);
        },
        120
      );
      if (clampedPage === 0) prev.setAlpha(0.35);
      const next = this.addDialogueButtonAt(
        container,
        CANVAS_W / 2 + 170,
        y,
        'Next ->',
        () => {
          if (clampedPage < totalPages - 1) onPageChange(clampedPage + 1);
        },
        120
      );
      if (clampedPage === totalPages - 1) next.setAlpha(0.35);
      const controlsRowH = Math.max(prev.height, next.height);
      const pageLabel = this.add
        .text(CANVAS_W / 2, y, `Page ${clampedPage + 1}/${totalPages}`, { fontSize: fontPx(this, 11), color: '#8fa0c9' })
        .setOrigin(0.5, 0);
      pageLabel.setY(y + (controlsRowH - pageLabel.height) / 2);
      container.add(pageLabel);
      y += controlsRowH + 6;
    }
    return y;
  }

  // Sets the player's current crystal form to `material` and persists it --
  // shared by Dresselhaus's ordinary transmutation (transmuteInto, looks the
  // form up by name in WORLD_CRYSTALS) and Majorana's hybrid panel
  // (becomeHybrid, whose synthesized Material was never in WORLD_CRYSTALS to
  // look up by name in the first place). Doesn't heal -- HP is only clamped
  // down to the new form's maxHp if it's lower, same as it always has been.
  applyPlayerForm(material: Material) {
    this.game.registry.set('playerForm', material);
    const clampedHp = Math.min((this.game.registry.get('playerHp') as number) ?? material.maxHp, material.maxHp);
    this.game.registry.set('playerHp', clampedHp);
    persistFromRegistry(this.game.registry);

    this.playerMaterial = material;
    this.redrawPlayerCrystal();

    // World 10's map shape is dispatched by the player's own material type
    // (world/generators/world10.ts) -- transmuting (Dresselhaus) or fusing
    // (Majorana) while standing there needs the map regenerated immediately
    // to reflect the new form, via the same regenerate-map path the Hub
    // door/Bloch's teleport/the world doors already use. Anderson's dope
    // deliberately doesn't call applyPlayerForm at all (it only unlocks a
    // move, leaving playerForm/type untouched -- see CODEMAP.md), so it has
    // nothing to trigger here either.
    if (this.world === 10) {
      this.advanceToWorld(10, 'start');
    }
  }

  private redrawPlayerCrystal() {
    this.playerCrystalGfx.destroy();
    this.playerCrystalGfx = makeCrystal(this, PLAYER_CRYSTAL_SIZE, this.playerMaterial.color, this.playerMaterial.variant, {
      seed: this.playerMaterial.name,
      hybrid: this.playerMaterial.hybridParents,
    });
    this.player.add(this.playerCrystalGfx);
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
  // stands on: reopens their panel when the player is currently standing on
  // the middle row and it's already been reached -- the first time the
  // player arrives there, and again after a battle fought right on that row
  // -- rather than on every battle fought anywhere in the world.
  private maybeAutoOpenMiddleDialogue() {
    if (!this.reachedMiddle || this.dialogueActive) return;
    if (this.playerTile.y !== this.midTile.y) return;
    const guardian = OverworldScene.WORLD_GUARDIANS[this.world];
    if (guardian?.tile === 'middle') this.openGuardian(guardian);
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

    this.qumatessence += value;
    this.game.registry.set('qumatessence', this.qumatessence);
    this.tokenText.setText(`Qumatessence: ${this.qumatessence}`);
    persistFromRegistry(this.game.registry);
    this.showTutorialTip('qumatessence');
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
