import Phaser from 'phaser';
import { getBiome } from '../art/biomes';
import type { Biome } from '../art/biomes';
import { makeCrystal } from '../art/crystals';
import { makeToken } from '../art/tokens';
import { makeNoetherAvatar } from '../art/noether';
import { BOSS_FOOT, BOSS_SILHOUETTE_BOTTOM, BOSS_SILHOUETTE_TOP, makeBossCrystal } from '../art/boss';
import { DOOR_FOOT, makeDoorSprite } from '../art/door';
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
import { stopMoveEffectPreview } from '../art/moveEffectPreview';
import { project, CANVAS_W, CANVAS_H } from '../art/perspective';
import {
  CAMERA_BACK_TILES,
  DRAW_DISTANCE_TILES,
  GRID_H,
  GRID_W,
  LANE_CLIP,
  TILE_SCALE,
  projectTile,
} from './overworld/projection';
import { drawSky, forwardHazeBlend } from './overworld/sky';
import { buildTerrainPlan } from './overworld/terrain/plan';
import { drawTerrain } from './overworld/terrain/paint';
import type { TerrainPlan, TerrainView } from './overworld/terrain/types';
import {
  PLAYER_MATERIAL,
  worldName,
  getWildPool,
  getRival,
  rollRival9Type,
  MOVES,
  KONDO_MOVE_IDS,
  getPlayerMaterial,
  DEFAULT_STATS,
  allCrystals,
  isHybridMaterial,
} from '../data/materials';
import { wildHpForWorld, MAX_STAT } from '../data/balance';
import { PASSIVES, PASSIVE_OWNERS } from '../data/passives';
import type { PassiveOwner } from '../data/passives';
import { tokenColorForValue } from '../data/tokens';
import { getWorldQuestion } from '../data/quiz';
import { encounterGreeting } from '../data/greetings';
import { TUTORIAL_TIPS, hasSeenTip, markTipSeen } from '../data/tutorial';
import type { TutorialTipId } from '../data/tutorial';
import { STORY_BEATS, WORLD_GOAL_TEXT } from '../data/story';
import { WORLD_LORE, RIVAL_TAUNTS, hasSeenWorldLore, markWorldLoreSeen } from '../data/worldLore';
import type { WorldLore } from '../data/worldLore';
import { DEFAULT_ENCOUNTER_DENSITY } from '../data/settings';
import { persistFromRegistry } from '../data/save';
import type { DiscoveredMaterial } from '../data/save';
import type { Material, MaterialType } from '../data/types';
import { generateWorldMap } from '../world/mapgen';
import type { GridPoint } from '../world/mapgen';
import { fontPx, fontScale } from '../ui/text';
import { PANEL_BG, GOLD_ACCENT, GOLD_ACCENT_HEX, REFERENCE_BLUE_GREY, REFERENCE_BLUE_GREY_HEX, TUTORIAL_CYAN, STORY_LAVENDER } from '../ui/theme';
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
  vortexCores: GridPoint[];
  reachedGoal: boolean;
  reachedMiddle: boolean;
}

const CRYSTAL_SIZE = 22;
const TOKEN_SIZE = 26;
const PLAYER_CRYSTAL_SIZE = 34;
// A sprite's ground contact -- where its own shadow is drawn, in local px
// below its container origin, before the depth scale is applied. The
// projection puts this point on its tile's centre, so every landmark stands
// on its tile the same way the player's avatar does. Art that deliberately
// hovers with no contact point of its own (a qumatessence cloud, a guardian
// adrift) uses 0, which hangs it over the tile centre instead.
const CRYSTAL_FOOT = CRYSTAL_SIZE;
const PLAYER_FOOT = PLAYER_CRYSTAL_SIZE;
// Where the player's avatar plants its shadow on screen: the projection of
// its own tile centre, so the fixed on-screen avatar and the scrolling ground
// under it always agree about which tile the player is standing on.
const PLAYER_GROUND_Y = project(0, CAMERA_BACK_TILES * TILE_SCALE).y;
// Substantially bigger than a wild crystal (CRYSTAL_SIZE) or even the player
// (PLAYER_CRYSTAL_SIZE) -- the boss standing at the goal tile should read as
// gigantic at a glance (art/boss.ts's makeBossCrystal further composes
// several of these into one fused humanoid mass reaching
// BOSS_SILHOUETTE_TOP/BOTTOM multiples of this above and below its center,
// so the rendered golem stands well over twice this tall).
const BOSS_CRYSTAL_SIZE = 78;
// Bigger than the player (34) so a world door reads as a real structure, but
// well under the boss (78) it shares the goal tile with once that world's
// rival is beaten -- a doorway is a landmark, not a threat.
const DOOR_SPRITE_SIZE = 46;
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

// Superposition Mode's blanket "every guardian is already unlocked" grant --
// registry-only and world-independent, so it's shared by
// OverworldScene.applySuperpositionLeveling (re-applied on every world
// entry) and HubScene.create (which stands every guardian's own avatar in the
// Lab regardless of `metGuardians` in this mode, so each one's panel needs to
// be fully unlocked even on a save
// that has never yet stepped through a world door; without this, Kondo/
// Franklin/Noether/Laughlin/Feynman/Skłodowska-Curie/Bloch's Lab panels
// would show their ordinary locked/empty state until the first world entry
// applied this same grant). Call this before anything reads `playerForm`
// back out (`getPlayerMaterial`, world 10's own map-shape dispatch) --
// see both call sites' own placement, early in `create()`.
export function applySuperpositionUnlocks(registry: Phaser.Data.DataManager) {
  if (!registry.get('superpositionMode')) return;
  registry.set('unlockedMoves', Object.keys(MOVES));
  const visited = (registry.get('visitedWorlds') as number[]) ?? [];
  registry.set('visitedWorlds', Array.from(new Set([...visited, ...BUILT_WORLDS])));
  // Materialdex entries are a passive discovery log, not a player choice
  // (unlike the seed-only-if-unset picks below), so this is unconditional
  // and re-set every time this grant reapplies.
  registry.set(
    'discoveredMaterials',
    allCrystals().map((material) => ({ name: material.name, type: material.type }))
  );
  // Kondo's three self-buff moves are all granted above, but only one is
  // ever the active `kondoActiveMove` getBattleMoves actually surfaces --
  // seeded to a random one of the three (not always the same one) so a
  // fresh Superposition save doesn't always start on the same move. Only
  // seeded if nothing's chosen yet, so a deliberate pick made via
  // showKondoPanel survives every later re-application of this grant.
  if (!registry.get('kondoActiveMove')) {
    registry.set('kondoActiveMove', KONDO_MOVE_IDS[Math.floor(Math.random() * KONDO_MOVE_IDS.length)]);
  }
  // Same "unlock every item, seed one random active pick per owner" shape
  // for every passive owner's kit (today just Franklin's three).
  registry.set('passivesUnlocked', Object.keys(PASSIVES));
  const activeByOwner = { ...((registry.get('activePassiveByOwner') as Partial<Record<PassiveOwner, string>>) ?? {}) };
  for (const owner of PASSIVE_OWNERS) {
    if (!activeByOwner[owner]) {
      const ownerPassiveIds = Object.values(PASSIVES)
        .filter((p) => p.owner === owner)
        .map((p) => p.id);
      activeByOwner[owner] = ownerPassiveIds[Math.floor(Math.random() * ownerPassiveIds.length)];
    }
  }
  registry.set('activePassiveByOwner', activeByOwner);
  // Anderson's impurity slot: a random non-hybrid crystal doped in, same
  // seed-only-if-unset treatment as kondoActiveMove above.
  if (!registry.get('andersonDopant')) {
    const hostPool = allCrystals().filter((m) => !isHybridMaterial(m.name));
    registry.set('andersonDopant', hostPool[Math.floor(Math.random() * hostPool.length)].name);
  }
  // Dresselhaus (transmute into a crystal outright) and Majorana (fuse into
  // a hybrid) both drive the same single `playerForm` slot -- only one of
  // the two can seed a starting form, so this coin-flips which mechanic's
  // own candidate pool the seed comes from, then picks randomly within it.
  // Seeded only if the player hasn't already transmuted/fused for real
  // (`playerForm` still null).
  if (!registry.get('playerForm')) {
    const pool =
      Math.random() < 0.5
        ? allCrystals().filter((m) => !isHybridMaterial(m.name))
        : allCrystals().filter((m) => isHybridMaterial(m.name));
    registry.set('playerForm', pool[Math.floor(Math.random() * pool.length)]);
  }
  // Feynman: every move levels independently (`moveLevels`, keyed per move
  // id), with no single-active slot to default the way Kondo/Franklin/
  // Anderson/Dresselhaus-or-Majorana have -- "everything unlocked" for him
  // means every move already at max level rather than one random pick
  // among mutually-exclusive options. Unconditional, same as
  // unlockedMoves/discoveredMaterials/passivesUnlocked above -- there's no
  // deliberate lower-level pick here worth preserving.
  const maxedLevels: Partial<Record<string, number>> = {};
  Object.keys(MOVES).forEach((id) => {
    maxedLevels[id] = 3;
  });
  registry.set('moveLevels', maxedLevels);
  // Every stat pinned to MAX_STAT outright -- world-independent (unlike
  // Story Mode's own per-world re-leveling), so it belongs in this shared
  // grant rather than OverworldScene's own per-world leveling step. With
  // every stat already at its ceiling, there's no "this world is harder
  // than the last" progression left for the player's own side to track --
  // see enemyStatsForWorld's own Superposition-Mode branch for the matching
  // flat, difficulty-tier-scaled opponent baseline this pairs with.
  registry.set('playerStats', { quantumness: MAX_STAT, velocity: MAX_STAT, correlation: MAX_STAT });
  persistFromRegistry(registry);
}

interface OverworldInitData {
  world?: number;
  regenerate?: boolean;
  // Only meaningful together with regenerate: true -- lands the player on
  // the freshly generated map's goalTile instead of the default startTile.
  // The backward door (OverworldScene.returnToPreviousWorld) is the one
  // caller that sets this, so walking back into an earlier world arrives
  // from its far end (already at the reached goal) rather than its near one.
  enterFrom?: 'start' | 'goal';
}

interface WorldSprite {
  x: number;
  y: number;
  // Height of this sprite's art above its own container origin, in px before
  // the depth scale -- what the label rides on, not the art's overall size.
  size: number;
  // This sprite's ground contact below its container origin, in the same
  // units (see CRYSTAL_FOOT). updateWorldSprites lands it on the projected
  // centre of tile (x, y), so the sprite stands on that tile rather than
  // straddling its edge.
  foot: number;
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

// The interface every guardian-panel file (scenes/panels/<guardian>.ts,
// tunableMoveShop.ts, passiveList.ts) is written against instead of the
// concrete `OverworldScene` class -- both `OverworldScene` (a guardian met
// mid-walk) and `HubScene` (the same guardian reopened by clicking their own
// avatar in the Lab, see HubScene.spawnGuardianAvatars) implement it,
// so a panel opens identically -- same shop, same state -- regardless of
// which scene the player is actually standing in when they open it. Genuinely
// cross-cutting dialogue infrastructure (`addDialogueButton(At)`,
// `renderPagedButtons`, `renderFarewellFooter`, `closeDialogue`, the state
// accessors, `applyPlayerForm`) plus every guardian's own per-panel session
// field (pagination/selection state) -- see CODEMAP.md's "Guardian panels"
// section for the full duplication rationale between the two classes.
// Extends Phaser.Scene (both implementers already are one -- `add`/`tweens`/
// `game`/etc. come along for free) rather than redeclaring just the handful
// of Scene members panel files happen to touch, since several also pass
// `scene` straight through to Phaser.Scene-typed helpers (avatar builders,
// `fontPx`).
export interface GuardianPanelHost extends Phaser.Scene {
  dialogueActive: boolean;
  dialogueContainer?: Phaser.GameObjects.Container;
  addDialogueButton(container: Phaser.GameObjects.Container, y: number, label: string, onClick: () => void): Phaser.GameObjects.Text;
  addDialogueButtonAt(
    container: Phaser.GameObjects.Container,
    x: number,
    y: number,
    label: string,
    onClick: () => void,
    wrapWidth?: number,
    fontSizePxOverride?: string
  ): Phaser.GameObjects.Text;
  closeDialogue(): void;
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
  ): number;
  renderFarewellFooter(container: Phaser.GameObjects.Container, footerY: number): number;
  renderCancelFarewellFooter(
    container: Phaser.GameObjects.Container,
    footerY: number,
    cancelLabel: string,
    onCancel: () => void
  ): number;
  tokenText: Phaser.GameObjects.Text;
  qumatessence: number;
  playerMaterial: Material;
  applyPlayerForm(material: Material): void;
  getUnlockedMoves(): string[];
  getVisitedWorlds(): number[];
  getDefeatedMaterials(): DiscoveredMaterial[];
  isSuperpositionMode(): boolean;
  // Bloch-only: the world to exclude from (and, via advanceToWorld, travel
  // from) the destination list -- 0 for HubScene, since the Lab isn't a
  // built world and offering every visited world (never excluding one) is
  // correct there.
  world: number;
  advanceToWorld(world: number, enterFrom?: 'start' | 'goal'): void;
  // Noether-only.
  shopTab: 'moves' | 'stats';
  blochPage: number;
  dresselhausPage: number;
  majoranaPage: number;
  andersonPage: number;
  andersonSelection: string | null;
  andersonMovePage: number;
  feynmanPage: number;
  // Same convention as noetherMovePreview below, for Feynman's own
  // list+detail layout (scenes/panels/feynman.ts) -- holds the id of the
  // already-unlocked move currently previewed in its detail pane. Feynman
  // has no committed-choice field of its own: leveling a move writes
  // registry/save moveLevels straight from the detail pane's confirm button.
  feynmanPreview: string | null;
  // list+detail crystal-pick step (scenes/panels/listDetail.ts) without yet
  // being committed to -- distinct from andersonSelection above, which
  // records Anderson's *committed* host choice once the player has actually
  // confirmed it (Majorana has no such committed-choice field: its panel is
  // a single browse-by-result step, so majoranaPreview alone -- holding the
  // previewed *hybrid result's* name -- drives its whole detail pane). Null
  // means "nothing previewed yet," in which case the panel falls back to
  // previewing the first candidate on the current page. Reset alongside the
  // existing per-guardian fields on both OverworldScene.create()/
  // closeDialogue() and HubScene.closeDialogue().
  dresselhausPreview: string | null;
  andersonHostPreview: string | null;
  majoranaPreview: string | null;
  // Same "which row is currently previewed" convention as
  // dresselhausPreview/majoranaPreview above, for Noether's own Moves tab
  // list+detail layout (scenes/panels/noether.ts, STYLE.md's "Noether's
  // shop"), holding a move id rather than a crystal/hybrid-result name.
  // noetherMovePage paginates its own left column the same way
  // dresselhausPage/majoranaPage do. Same reset rules (scene create,
  // closeDialogue()) as every other per-guardian field above. Laughlin's and
  // Skłodowska-Curie's own panels (scenes/panels/laughlin.ts/
  // sklodowskaCurie.ts) have no preview/pagination field of their own --
  // each has exactly two fixed moves, always both rendered side by side
  // rather than browsed one at a time through a candidate list.
  noetherMovePreview: string | null;
  noetherMovePage: number;
  // Same convention as noetherMovePreview above, for Kondo's own list+detail
  // layout (scenes/panels/kondo.ts) -- holds one of KONDO_MOVE_IDS. Kondo's
  // own panel has no committed-choice field of its own (like Majorana, not
  // like Anderson's two-step pick): this preview field alone drives its
  // whole detail pane, while the actually-committed "which one is usable in
  // battle" choice lives in registry/save kondoActiveMove instead, set only
  // by the detail pane's own confirm button.
  kondoMovePreview: string | null;
  kondoMovePage: number;
  // Bloch's own table+map layout (scenes/panels/bloch.ts): which world
  // number is currently previewed (highlighted in the destination table AND
  // pulsing on the Qumatuomi map), independent of and reset the same way as
  // dresselhausPreview/majoranaPreview above. Null means "nothing previewed
  // yet," in which case the panel falls back to the first travelable
  // destination.
  blochPreview: number | null;
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
// The public projection of GuardianDef the Lab reads (OverworldScene.guardianRoster).
export interface GuardianRosterEntry {
  id: string;
  name: string;
  shortName: string;
  world: number;
  blurb: string;
  labelColor: string;
  avatar: (scene: Phaser.Scene, scale?: number) => Phaser.GameObjects.Container;
  open?: (scene: GuardianPanelHost) => void;
}

interface GuardianDef {
  id: string;
  name: string;
  // Surname alone, for the label under the guardian's own avatar in the Lab
  // (HubScene.spawnGuardianAvatars) -- one slot in the corner clusters is far
  // too narrow for the full "Noether's Currents" form the overworld sprite's
  // own label uses.
  shortName: string;
  labelColor: string;
  strokeColor: number;
  quote: string;
  // One-line "what they do" -- the same copy docs/guardians.md's own
  // roster table uses, surfaced in-game by the hover readout on that
  // guardian's own Lab avatar (HubScene.spawnGuardianAvatars) so the room
  // isn't ten unlabelled figures with no way to tell what each one offers
  // before clicking one.
  blurb: string;
  avatar: (scene: Phaser.Scene, scale?: number) => Phaser.GameObjects.Container;
  // Every guardian now stands mid-corridor ('middle', see DESIGN.md §5) so the
  // goal tile is free for that world's boss avatar (spawnBossSprite) --
  // 'start'/'goal' stay valid tile choices for a future guardian, but nothing
  // currently uses them.
  tile: 'goal' | 'start' | 'middle';
  open?: (scene: GuardianPanelHost) => void;
}

export class OverworldScene extends Phaser.Scene implements GuardianPanelHost {
  world = 1;
  private regenerate = false;
  // 'start' (the default) spawns the player at the freshly generated map's
  // startTile, same as ever; 'goal' is set only by the backward door
  // (returnToPreviousWorld/advanceToWorld) so the player instead lands on
  // goalTile, arriving from that world's far end.
  private enterFrom: 'start' | 'goal' = 'start';
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
  // Tiles world 5's generator placed as vortex cores; its off-path material
  // draws a pit at each (see world/generators/shared.ts's `vortexCores`).
  private vortexCores: GridPoint[] = [];
  // Whole-grid terrain classification and boundary geometry, built on demand
  // by terrainPlan() and dropped in create() once the map for this visit is in
  // place. Phaser reuses the same scene instance across every scene.start, so
  // a plan built for a previous visit would otherwise survive into the next
  // one; anything that ever mutates the grid mid-visit (destructible walls,
  // revealed terrain) has to drop it the same way.
  private terrainPlanCache?: TerrainPlan;
  // Per-frame memo for hazeTarget's forward blend, keyed by a biome's own fog
  // color: the blend factor only changes between frames, and world 9's defect
  // patches put several biomes on screen at once.
  private hazeBlend = 0;
  private hazeCache = new Map<number, number>();
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
  // Dresselhaus's transmute list and Majorana's hybrid-result list both
  // paginate (Superposition Mode's candidate pool is every crystal in the
  // game, far more than one panel can show at once). Reset on every fresh
  // scene create and every closeDialogue().
  dresselhausPage = 0;
  majoranaPage = 0;
  // Anderson's impurity-doping panel (§5, World 9): the host crystal picked
  // to "dope in," while the panel rebuilds to ask which one of its moves to
  // learn -- null means "no doping in progress, show the host pick list."
  // Same reset/pagination rules as dresselhausPage/majoranaPage above.
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
  feynmanPreview: string | null = null;
  // Which row is currently highlighted (not yet committed) in a list+detail
  // crystal-pick step's left column -- Dresselhaus's single step, Anderson's
  // host-pick step, and Majorana's own single browse-by-result step
  // (majoranaPreview holds the previewed *hybrid result's* name there). Same
  // reset rules as andersonSelection above.
  dresselhausPreview: string | null = null;
  andersonHostPreview: string | null = null;
  majoranaPreview: string | null = null;
  // Same reset rules as dresselhausPreview/majoranaPreview above -- see the
  // GuardianPanelHost interface's own comment on these fields.
  noetherMovePreview: string | null = null;
  noetherMovePage = 0;
  kondoMovePreview: string | null = null;
  kondoMovePage = 0;
  // Same reset rules as dresselhausPreview/majoranaPreview above -- see the
  // GuardianPanelHost interface's own comment on this field.
  blochPreview: number | null = null;

  // One entry per world with a guardian (see GuardianDef above). Most `open`
  // callbacks call an imported scenes/panels/<guardian>.ts function with `s`
  // rather than a method on this class -- see CODEMAP.md's "Guardian
  // panels" section for which state/helpers had to become public so those
  // external modules can reach them.
  private static readonly WORLD_GUARDIANS: Partial<Record<number, GuardianDef>> = {
    1: {
      id: 'noether',
      name: "Noether's Currents",
      shortName: 'Noether',
      labelColor: '#ffe066',
      strokeColor: 0xffe066,
      quote: 'Every symmetry hides a conservation law.',
      blurb: 'Sells ordinary moves and stat upgrades.',
      avatar: makeNoetherAvatar,
      tile: 'middle',
      open: (s) => showNoetherShop(s),
    },
    2: {
      id: 'bloch',
      name: "Bloch's States",
      shortName: 'Bloch',
      labelColor: '#8fe8ff',
      strokeColor: 0x4adde0,
      quote: 'Every crystal is a superposition of the worlds it has touched.',
      blurb: "Teleports you between worlds you've visited.",
      avatar: makeBlochAvatar,
      tile: 'middle',
      open: (s) => showBlochHub(s),
    },
    3: {
      id: 'dresselhaus',
      name: "Dresselhaus's Nanostructures",
      shortName: 'Dresselhaus',
      labelColor: '#6ee8ba',
      strokeColor: 0x4ad9a0,
      quote: 'Build the same atoms into a different nanostructure and you get a different material entirely.',
      blurb: 'Lets you transmute into a defeated crystal.',
      avatar: makeDresselhausAvatar,
      tile: 'middle',
      open: (s) => showDresselhausPanel(s),
    },
    4: {
      id: 'laughlin',
      name: "Laughlin's Analytics",
      shortName: 'Laughlin',
      labelColor: '#8fa0ff',
      strokeColor: 0x6a7fff,
      quote:
        'Take an electron liquid in a strong enough field and it condenses into something new -- excite it, and the charge that peels off is a fraction of an electron, not a whole one. Answer my questions right and I will teach your crystal to strike by that same physics.',
      blurb: 'Sells two quiz-gated Analytic moves.',
      avatar: makeLaughlinAvatar,
      tile: 'middle',
      open: (s) => showLaughlinPanel(s),
    },
    5: {
      id: 'majorana',
      name: "Majorana's Fusion",
      shortName: 'Majorana',
      labelColor: '#9fffb0',
      strokeColor: 0x4fd97a,
      quote: 'Split one fermion into two halves, each its own antiparticle, and see what a superconductor can hide at its edge.',
      blurb: 'Fuses two crystals into a hybrid state.',
      avatar: makeMajoranaAvatar,
      tile: 'middle',
      open: (s) => showMajoranaPanel(s),
    },
    6: {
      id: 'anderson',
      name: "Anderson's Impurities",
      shortName: 'Anderson',
      labelColor: '#e8b27a',
      strokeColor: 0xc9884a,
      quote: 'Enough disorder and a wave stops spreading at all -- it localizes, trapped by the very randomness that surrounds it.',
      blurb: 'Lets you dope in an impurity move.',
      avatar: makeAndersonAvatar,
      tile: 'middle',
      open: (s) => showAndersonPanel(s),
    },
    7: {
      id: 'feynman',
      name: "Feynman's Diagrammatics",
      shortName: 'Feynman',
      labelColor: '#ffa64a',
      strokeColor: 0xffa64a,
      quote: 'A tensor network and a Feynman diagram draw the same trick two ways -- a vertex for every point, a line for every leg.',
      blurb: 'Lets you level up a move you already know.',
      avatar: makeFeynmanAvatar,
      tile: 'middle',
      open: (s) => showFeynmanPanel(s),
    },
    8: {
      id: 'kondo',
      name: "Kondo's Clouds",
      shortName: 'Kondo',
      labelColor: '#ff8f6a',
      strokeColor: 0xe86a44,
      quote: 'A single stray spin, screened by a sea of conduction electrons until it all but disappears at low temperature.',
      blurb: 'Sells self-buff moves.',
      avatar: makeKondoAvatar,
      tile: 'middle',
      open: (s) => showKondoPanel(s),
    },
    9: {
      id: 'franklin',
      name: "Franklin's Scatterings",
      shortName: 'Franklin',
      labelColor: '#c9a8e0',
      strokeColor: 0xa878c9,
      quote:
        'Fire X-rays through a defect-riddled crystal and the sharp spots blur into diffuse rings -- every pore and dislocation leaves its own signature in how the beam scatters. I can teach your crystal to scatter a blow the same way.',
      blurb: 'Teaches always-on passive abilities.',
      avatar: makeFranklinAvatar,
      tile: 'middle',
      open: (s) => showFranklinPanel(s),
    },
    10: {
      id: 'sklodowskaCurie',
      name: "Skłodowska-Curie's Experiments",
      shortName: 'Skłodowska-Curie',
      labelColor: '#d9e86a',
      strokeColor: 0xc9d84a,
      quote:
        'I lead this circle of guardians, and here is our last lesson: answer three questions in a row on everything you have learned, and your crystal will strike with a force none of the others can match.',
      blurb: 'Teaches two quiz-gated Ultimate moves.',
      avatar: makeSklodowskaCurieAvatar,
      tile: 'middle',
      open: (s) => showSklodowskaCuriePanel(s),
    },
  };

  // Everything the Lab needs to stand a met guardian in the room as their own
  // clickable avatar (HubScene.spawnGuardianAvatars): who they are (id, both
  // name forms, world), how they draw and label (avatar builder, labelColor),
  // what they offer (blurb, the hover readout's second line), and how to open
  // them (`open`, the exact same callback the walk-up path uses, rather than
  // keeping a second dispatch table in sync with WORLD_GUARDIANS by hand).
  // Everything else on GuardianDef (strokeColor, quote, tile) stays private to
  // this class.
  static guardianRoster(): GuardianRosterEntry[] {
    return Object.entries(OverworldScene.WORLD_GUARDIANS)
      .filter((entry): entry is [string, GuardianDef] => !!entry[1])
      .map(([world, guardian]) => ({
        id: guardian.id,
        name: guardian.name,
        shortName: guardian.shortName,
        world: Number(world),
        blurb: guardian.blurb,
        labelColor: guardian.labelColor,
        avatar: guardian.avatar,
        open: guardian.open,
      }));
  }

  constructor() {
    super('Overworld');
  }

  init(data: OverworldInitData) {
    this.world = data?.world ?? 1;
    this.regenerate = data?.regenerate ?? false;
    this.enterFrom = data?.enterFrom ?? 'start';
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
    this.dresselhausPage = 0;
    this.majoranaPage = 0;
    this.andersonSelection = null;
    this.andersonPage = 0;
    this.andersonMovePage = 0;
    this.blochPage = 0;
    this.feynmanPage = 0;
    this.feynmanPreview = null;
    this.dresselhausPreview = null;
    this.andersonHostPreview = null;
    this.majoranaPreview = null;
    this.noetherMovePreview = null;
    this.noetherMovePage = 0;
    this.kondoMovePreview = null;
    this.kondoMovePage = 0;
    this.blochPreview = null;
    this.biome = getBiome(this.world);

    const state = this.game.registry;
    // Applied before any map generation or playerForm read below -- world
    // 10's own map-shape dispatch (generateMap) and `getPlayerMaterial` both
    // read `playerForm` straight from the registry, so this grant (which can
    // seed `playerForm` itself, see applySuperpositionUnlocks) has to land
    // first, not after.
    this.applySuperpositionLeveling();
    const saved = state.get('mapState') as SavedMapState | undefined;

    if (saved && saved.world === this.world && !this.regenerate) {
      this.restoreMap(saved);
    } else {
      this.generateMap();
    }
    this.terrainPlanCache = undefined;
    this.camPos = { x: this.playerTile.x, y: this.playerTile.y };

    drawSky(this, this.biome);
    this.worldGfx = this.add.graphics();
    this.spawnCrystalSprites();
    this.spawnTokenSprites();
    this.spawnGuardianSprite();
    this.spawnBossSprite();
    this.spawnDoorSprites();
    music.play(`overworld:${this.world}`);

    this.qumatessence = (state.get('qumatessence') as number) || 0;
    this.playerMaterial = getPlayerMaterial(state);
    this.shopTab = 'moves';
    this.recordVisit();

    // Corner HUD block: the world name (top-left) and the qumatessence
    // counter (top-right) sit on the same row, at the same y the Lab uses
    // for its own counter (HubScene.ts), so the overworld and the Lab put
    // the counter in the same on-screen spot. The counter's column is
    // reserved as a right-side gutter -- sized once from the widest
    // qumatessence string this text style could ever show, not measured
    // live off the current value -- and the world name's wrap width is
    // narrowed to stop short of it, so a long world name (e.g. world 5's
    // "The Splitting Hollow") or a big text-size setting wraps
    // downward onto a second line instead of running wide enough to
    // collide with the counter. No permanent key-hint lines for movement,
    // M, or H live in this corner -- the Lab's Tutorial station is the
    // canonical replayable recap for those (data/tutorial.ts), and a fixed
    // on-screen reminder here would just duplicate it while adding more
    // overflow risk to a corner that's already tight. The one deliberate
    // exception is the Enter hint in the opposite (bottom-right) corner --
    // Enter's world<->Lab shuttle is used far more often than the other
    // keys, so it stays visible on every screen rather than relying on the
    // one-time tip/replayable recap alone.
    const name = worldName(this.world);
    const essenceGutterProbe = this.add
      .text(0, 0, 'Qumatessence: 99999', { fontSize: fontPx(this, 14), padding: { x: 4, y: 2 } })
      .setVisible(false);
    const essenceGutter = essenceGutterProbe.width + 8;
    essenceGutterProbe.destroy();
    this.add
      .text(8, 8, `World ${this.world} -- ${name}`, {
        fontSize: fontPx(this, 16),
        color: '#ffffff',
        backgroundColor: 'rgba(0,0,0,0.35)',
        padding: { x: 4, y: 2 },
        wordWrap: { width: CANVAS_W - 16 - essenceGutter },
      })
      .setDepth(50);
    this.tokenText = this.add
      .text(CANVAS_W - 8, 8, `Qumatessence: ${this.qumatessence}`, {
        fontSize: fontPx(this, 14),
        color: GOLD_ACCENT_HEX,
        backgroundColor: 'rgba(0,0,0,0.35)',
        padding: { x: 4, y: 2 },
      })
      .setOrigin(1, 0)
      .setDepth(50);
    this.goalText = this.add
      .text(CANVAS_W / 2, 90, WORLD_GOAL_TEXT[this.world] ?? 'You reached the far edge of this world!', {
        fontSize: fontPx(this, 14),
        color: '#ffffff',
        backgroundColor: 'rgba(0,0,0,0.5)',
        padding: { x: 6, y: 4 },
        align: 'center',
        wordWrap: { width: CANVAS_W - 40 },
      })
      .setOrigin(0.5, 0)
      .setDepth(50)
      .setVisible(this.reachedGoal);
    this.add
      .text(CANVAS_W - 8, CANVAS_H - 8, 'Press Enter to go to the Lab', {
        fontSize: fontPx(this, 12),
        color: REFERENCE_BLUE_GREY_HEX,
        backgroundColor: 'rgba(0,0,0,0.35)',
        padding: { x: 4, y: 2 },
      })
      .setOrigin(1, 1)
      .setDepth(50);

    // The player is a crystal too, not a trainer commanding one -- the
    // overworld avatar is just the player's current form (playerMaterial,
    // Silicon by default or whatever Dresselhaus transmuted them into) rendered
    // the same way a wild crystal is, floating and bobbing rather than
    // walking.
    this.player = this.add.container(CANVAS_W / 2, PLAYER_GROUND_Y - PLAYER_FOOT);
    const playerShadow = this.add.ellipse(0, PLAYER_FOOT, 34, 11, 0x000000, 0.28);
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
      state.set('playerHp', wildHpForWorld(this.world));
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

    // Same "don't stack on top of an already-open panel" guard the old
    // first-run tutorial used -- the player's starting tile is never on the
    // goal/middle row, so this only actually skips in practice if a future
    // change moves the start closer to either.
    const finishEntry = () => {
      this.maybeAutoOpenGoalDialogue();
      this.maybeAutoOpenMiddleDialogue();
      if (!this.dialogueActive) this.showTutorialTip('controls');
    };
    // World lore is the more "establishing" content when both are due on
    // the same entry, so it plays first and finishEntry (the goal/middle
    // auto-dialogues, then the controls tip) only runs once it's dismissed.
    const lore = WORLD_LORE[this.world];
    if (lore && !hasSeenWorldLore(this.game.registry, this.world)) {
      this.showWorldLore(lore, finishEntry);
    } else {
      finishEntry();
    }
  }

  isSuperpositionMode(): boolean {
    return !!this.game.registry.get('superpositionMode');
  }

  // Superposition Mode (Title screen toggle, data/save.ts's `superpositionMode`):
  // re-levels the player to a full heal for whatever world this scene just
  // entered, on every entry -- not just the Hub door's initial jump, so
  // Continue-to-next-world and Bloch's teleport stay topped up too. Every
  // guardian's own blanket "already unlocked" grant -- moves, passives,
  // visited worlds, Materialdex, the random active picks for Kondo/Franklin/
  // Anderson/Dresselhaus-or-Majorana, Feynman's moves all maxed, and the
  // player's own stats all pinned to MAX_STAT -- lives in the shared
  // applySuperpositionUnlocks above BUILT_WORLDS, world-independent (no
  // "this world is harder than the last" progression left to re-level once
  // every stat is already at its ceiling), so HubScene.create applies it too,
  // on the Lab itself.
  private applySuperpositionLeveling() {
    if (!this.isSuperpositionMode()) return;
    applySuperpositionUnlocks(this.game.registry);
    this.game.registry.set('playerHp', wildHpForWorld(this.world));
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
      .rectangle(CANVAS_W / 2, top + panelHeight / 2, panelWidth, panelHeight, PANEL_BG, 0.95)
      .setStrokeStyle(2, TUTORIAL_CYAN);
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
    this.vortexCores = map.vortexCores;

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

    // Ground decoration is scattered over the walkable route itself
    // (terrain/decoration.ts): each world's motif is a property of the
    // ground it teaches with -- orbit rings, spin-wave ripples, cracks --
    // and belongs underfoot. Impassable tiles carry their material's own
    // accent instead (terrain/materials/), so decorating them too would
    // stack two treatments on one fill.
    for (let y = 0; y < GRID_H; y++) {
      for (let x = 0; x < GRID_W; x++) {
        if (this.walkable[y][x]) {
          this.flowerMap[y][x] = Math.random() < this.biome.decorationChance;
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
    this.vortexCores = saved.vortexCores;
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
      vortexCores: this.vortexCores,
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

  // Terrain rendering splits in two: reading the grid (overworld/terrain/
  // plan.ts) and projecting/painting it (overworld/terrain/paint.ts, every
  // frame). The read half is cached here for as long as the grid stands
  // still; create() drops the cache right after the map for this visit is in
  // place, which is mandatory rather than defensive: Phaser reuses the same
  // scene instance across every scene.start, so a plan built for the previous
  // visit would otherwise survive into the next one, and anything that ever
  // mutates the grid mid-visit has to drop it the same way.
  private terrainPlan(): TerrainPlan {
    if (!this.terrainPlanCache) {
      this.terrainPlanCache = buildTerrainPlan({
        walkable: this.walkable,
        regionColor: this.regionColor,
        biomeOverride: this.biomeOverride,
        vortexCores: this.vortexCores,
        flowerMap: this.flowerMap,
        midTile: this.midTile,
        biome: this.biome,
      });
    }
    return this.terrainPlanCache;
  }

  // Everything the terrain paint pass reads, gathered once per frame so the
  // drawing modules never reach back into this scene -- the same
  // written-against-an-interface split the guardian panels already use
  // (GuardianPanelHost). Assembled fresh every frame, since all of it except
  // the plan is camera- or clock-dependent.
  private terrainView(): TerrainView {
    return {
      gfx: this.worldGfx,
      plan: this.terrainPlan(),
      camX: this.camPos.x,
      camY: this.camPos.y,
      biome: this.biome,
      world: this.world,
      midTile: this.midTile,
      chokepointColor: OverworldScene.WORLD_GUARDIANS[this.world]?.strokeColor ?? GOLD_ACCENT,
      playerColor: this.playerMaterial.color,
      now: this.time.now,
      hazeBlend: this.hazeBlend,
      hazeCache: this.hazeCache,
    };
  }

  private drawWorld() {
    this.hazeBlend = forwardHazeBlend(this.world, this.isRivalDefeated(), this.camPos.y, this.goalTile.y);
    this.hazeCache.clear();
    drawTerrain(this.terrainView());
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
        // The same contact shadow the player's avatar and the boss golem
        // carry, at the same CRYSTAL_FOOT offset: it is what makes a floating
        // crystal read as hovering over one particular tile rather than
        // drifting at an unplaceable distance, which matters most right up
        // against the edge of the walkable region.
        const shadow = this.add.ellipse(0, CRYSTAL_FOOT, CRYSTAL_SIZE, CRYSTAL_SIZE * 0.32, 0x000000, 0.28);
        container.addAt(shadow, 0);
        container.setDepth(20);

        const label = this.add
          .text(0, 0, material.name, {
            fontSize: fontPx(this, 11),
            color: '#ffffff',
            backgroundColor: 'rgba(0,0,0,0.45)',
            padding: { x: 3, y: 1 },
          })
          .setOrigin(0.5, 1)
          .setDepth(22);

        this.crystalSprites.push({
          x,
          y,
          size: CRYSTAL_SIZE,
          foot: CRYSTAL_FOOT,
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
          .setDepth(22);

        // A qumatessence cloud hangs over its tile rather than resting on it,
        // so its own centre is what the tile's ground point carries.
        this.tokenSprites.push({ x, y, size: TOKEN_SIZE, foot: 0, container, label, seed: Math.random() * Math.PI * 2 });
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
      .setDepth(22);

    const tile = guardian.tile === 'start' ? this.startTile : guardian.tile === 'middle' ? this.midTile : this.goalTile;
    // A guardian is a figure adrift, not a standing one (see the sway/glow in
    // its avatar builder), so like a qumatessence cloud it hovers over its
    // tile's ground point instead of planting a contact on it.
    this.guardianSprites.push({ x: tile.x, y: tile.y, size: 42, foot: 0, container: avatar, label, seed: Math.random() * Math.PI * 2 });
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
      .setDepth(22);

    this.bossSprites.push({
      x: this.goalTile.x,
      y: this.goalTile.y,
      // The golem's head reaches BOSS_SILHOUETTE_TOP multiples of its own
      // size above its center, further than any other landmark's art does,
      // so the label rides that measured height rather than a bare
      // BOSS_CRYSTAL_SIZE -- which would put the name across its face.
      size: BOSS_CRYSTAL_SIZE * BOSS_SILHOUETTE_TOP,
      foot: BOSS_CRYSTAL_SIZE * BOSS_FOOT,
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
      .setDepth(22);
    // Drawn one row north of startTile itself (still guaranteed walkable --
    // world/mapgen.ts's buildCorridor never drifts the corridor's center
    // before MIN_STRAIGHT_ROWS=2 straight rows, so the row right above the
    // south edge is always centered on startTile.x too), not on top of it.
    // The camera looks forward from just behind the player, so a sprite
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
      foot: DOOR_SPRITE_SIZE * DOOR_FOOT,
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
      .setDepth(22);
    this.doorSprites.push({
      x: this.goalTile.x,
      y: this.goalTile.y,
      size: DOOR_SPRITE_SIZE,
      foot: DOOR_SPRITE_SIZE * DOOR_FOOT,
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
      const depth = camY - c.y + wanderDepth;
      const laneL = lane - 0.5;
      const laneR = lane + 0.5;

      const visible =
        depth + CAMERA_BACK_TILES > 0.15 &&
        laneL <= LANE_CLIP &&
        laneR >= -LANE_CLIP &&
        depth / DRAW_DISTANCE_TILES < 0.75;
      c.container.setVisible(visible);
      c.label?.setVisible(visible);
      if (!visible) continue;

      // `p` is the sprite's tile centre on the ground plane, so the art is
      // lifted by its own ground-contact offset to stand on that point rather
      // than being centred over it.
      const p = projectTile(lane, depth);
      const bob = Math.sin(t * 0.004 + c.seed * 2.3) * 3 * p.scale;
      const originY = p.y - c.foot * p.scale + bob;

      c.container.setPosition(p.x, originY);
      c.container.setScale(p.scale);
      // A clamped label (currently just a boss's own, see spawnBossSprite)
      // keeps its rendered half-width (label.width already reflects any
      // wordWrap) from pushing past either canvas edge, rather than staying
      // strictly centered on the sprite's own projected x like every other
      // landmark's shorter label.
      const labelX = c.clampLabelToCanvas && c.label ? Phaser.Math.Clamp(p.x, (c.label.width * p.scale) / 2, CANVAS_W - (c.label.width * p.scale) / 2) : p.x;
      c.label?.setPosition(labelX, originY - c.size * p.scale - 4);
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

    const question = getWorldQuestion(this.world, material.name);
    if (question) {
      const prompt = this.add
        .text(CANVAS_W / 2, y, question.prompt, {
          fontSize: fontPx(this, 13),
          color: GOLD_ACCENT_HEX,
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
      .rectangle(CANVAS_W / 2, top + panelHeight / 2, panelWidth, panelHeight, PANEL_BG, 0.94)
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
    stopMoveEffectPreview();
    this.dialogueContainer?.destroy(true);
    this.dialogueContainer = undefined;
    this.dialogueActive = false;
    this.dresselhausPage = 0;
    this.majoranaPage = 0;
    this.andersonSelection = null;
    this.andersonPage = 0;
    this.andersonMovePage = 0;
    this.blochPage = 0;
    this.feynmanPage = 0;
    this.feynmanPreview = null;
    this.dresselhausPreview = null;
    this.andersonHostPreview = null;
    this.majoranaPreview = null;
    this.noetherMovePreview = null;
    this.noetherMovePage = 0;
    this.kondoMovePreview = null;
    this.kondoMovePage = 0;
    this.blochPreview = null;
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
  // pop this open out of nowhere on return -- the Lab's own guardian avatars
  // already cover deliberately revisiting from afar.
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
  // so the Lab's own guardian gallery (HubScene.spawnGuardianAvatars) fills in
  // as the player reaches each world's middle tile -- regardless of which panel that
  // guardian actually shows (shop, teleport hub, transmutation, or lore).
  // Every guardian in WORLD_GUARDIANS sets `open`, pointing at that
  // guardian's own panel.
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
      .rectangle(CANVAS_W / 2, top + panelHeight / 2, panelWidth, panelHeight, PANEL_BG, 0.94)
      .setStrokeStyle(2, REFERENCE_BLUE_GREY);
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

  // World-entry lore (data/worldLore.ts's WORLD_LORE) -- a two-page history
  // of this world shown once per save the first time the player steps into
  // it (gated by hasSeenWorldLore/markWorldLoreSeen, its own save field
  // independent of visitedWorlds, see save.ts's worldLoreSeen comment).
  // Chained single-page panels rather than one scrolling page, the same
  // destroy-and-rebuild idiom renderTutorialTipPopup uses, since nothing
  // else in this file paginates body text (renderPagedButtons only
  // paginates candidate-list buttons). Each authored page is handed over as
  // its own paragraph list so a page too tall for CANVAS_H splits across
  // screens at a paragraph break instead of running off the canvas, and so
  // a page break never falls mid-paragraph or bridges the authored page
  // boundary. onDone runs once the last screen of page 2 is dismissed, so
  // create() doesn't need its own branch for "lore already seen" vs "lore
  // just finished."
  private showWorldLore(lore: WorldLore, onDone: () => void) {
    this.renderWorldLorePage(lore.page1.split('\n\n'), 'Next ->', () =>
      this.renderWorldLorePage(lore.page2.split('\n\n'), 'Onward', () => {
        markWorldLoreSeen(this.game.registry, this.world);
        persistFromRegistry(this.game.registry);
        this.closeDialogue();
        onDone();
      })
    );
  }

  // Renders as many of `paragraphs` as fit the canvas, then continues with
  // whatever is left over on a further screen; `lastLabel` is the button on
  // the screen that exhausts the list, intermediate screens read "Next ->".
  private renderWorldLorePage(paragraphs: string[], lastLabel: string, onDone: () => void) {
    this.dialogueContainer?.destroy(true);
    this.dialogueActive = true;

    const panelWidth = CANVAS_W - 40;
    const top = 16;
    const bottomMargin = 16;
    const container = this.add.container(0, 0).setDepth(100);
    this.dialogueContainer = container;

    // Capped like BattleScene.drawMoveMenu's own chromeScale/headerScale --
    // the Settings panel's 2x "Large" preset would otherwise make this
    // panel's multi-paragraph prose far taller than the fixed CANVAS_H, the
    // same fixed-budget problem that cap already solves for the move menu's
    // title/legend.
    const scale = Math.min(fontScale(this), 1.5);

    let y = top;
    const name = worldName(this.world);
    const title = this.add
      .text(CANVAS_W / 2, y, name, {
        fontSize: `${Math.round(15 * scale)}px`,
        color: '#ffffff',
        fontStyle: 'bold',
        align: 'center',
        wordWrap: { width: panelWidth - 60 },
      })
      .setOrigin(0.5, 0);
    container.add(title);
    y += title.height + 8;

    // Built before the body so the fit budget below can use the button's
    // real measured height. Its label and handler both depend on how much
    // of the list actually fits, so they're filled in once that's known --
    // the two labels are single-line at the same size, so setting the text
    // afterwards can't change the height already budgeted against.
    // fontSizePxOverride is capped the same way the body text is, otherwise
    // the button falls through to addDialogueButtonAt's own uncapped
    // default and eats into the margin the cap exists to protect.
    let onContinue = () => {};
    const btn = this.addDialogueButtonAt(
      container,
      CANVAS_W / 2,
      0,
      lastLabel,
      () => onContinue(),
      180,
      `${Math.round(13 * scale)}px`
    );

    const bodyBudget = CANVAS_H - bottomMargin - (12 + btn.height + 12) - y;
    let bodyPx = Math.round(11 * scale);
    const text = this.add
      .text(CANVAS_W / 2, y, paragraphs.join('\n\n'), {
        fontSize: `${bodyPx}px`,
        color: '#e6d9ff',
        align: 'center',
        wordWrap: { width: panelWidth - 60 },
        lineSpacing: 3,
      })
      .setOrigin(0.5, 0);
    container.add(text);

    let shown = paragraphs.length;
    while (shown > 1 && text.height > bodyBudget) {
      shown -= 1;
      text.setText(paragraphs.slice(0, shown).join('\n\n'));
    }
    // Floor-9px shrink-to-fit backstop, same as showInfoPanel's, for the
    // case a single paragraph is taller than the canvas on its own and
    // there's no break left to take.
    while (text.height > bodyBudget && bodyPx > 9) {
      bodyPx -= 1;
      text.setFontSize(`${bodyPx}px`);
    }
    y += text.height + 12;

    const rest = paragraphs.slice(shown);
    btn.setY(y);
    if (rest.length) {
      btn.setText('Next ->');
      onContinue = () => this.renderWorldLorePage(rest, lastLabel, onDone);
    } else {
      onContinue = onDone;
    }
    y += btn.height + 12;

    const panelHeight = y - top;
    const panel = this.add
      .rectangle(CANVAS_W / 2, top + panelHeight / 2, panelWidth, panelHeight, PANEL_BG, 0.96)
      .setStrokeStyle(2, STORY_LAVENDER);
    container.addAt(panel, 0);
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
    const container = this.add.container(0, 0).setDepth(100);
    this.dialogueContainer = container;

    // Capped the same way renderWorldLorePage caps its own prose -- these
    // beats wrap to several more lines at the Settings panel's 2x "Large"
    // preset than at the default, so the panel is sized to the text rather
    // than the text being trusted to fit a fixed box.
    const scale = Math.min(fontScale(this), 1.5);
    const padding = 30;
    const centerY = 260;

    const text = this.add
      .text(CANVAS_W / 2, 0, line, {
        fontSize: `${Math.round(13 * scale)}px`,
        color: '#e6d9ff',
        align: 'center',
        wordWrap: { width: 500 },
      })
      .setOrigin(0.5, 0);
    container.add(text);

    const btn = this.addDialogueButtonAt(
      container,
      CANVAS_W / 2,
      0,
      'Onward',
      () => {
        this.closeDialogue();
        this.advanceToWorld(completedWorld + 1);
      },
      200,
      `${Math.round(13 * scale)}px`
    );

    const panelHeight = padding + text.height + 18 + btn.height + padding;
    const top = Math.max(16, Math.round(centerY - panelHeight / 2));
    text.setY(top + padding);
    btn.setY(top + padding + text.height + 18);

    const panel = this.add
      .rectangle(CANVAS_W / 2, top + panelHeight / 2, 560, panelHeight, PANEL_BG, 0.96)
      .setStrokeStyle(2, STORY_LAVENDER);
    container.addAt(panel, 0);
  }

  // Shown once the last built world's rival is beaten -- a real ending
  // rather than a dead "Continue to World 11" button pointing at a world
  // that doesn't exist. Pays off World 10's reveal (WORLD_LORE[10].page2):
  // the Adapted was assembled from the player's own play, so beating it is
  // framed as out-adapting a mirror built from nine worlds of your own
  // choices, not defeating an outside enemy. Content laid out top-down
  // first, panel sized/inserted behind everything afterward -- same pattern
  // as showGuardianLore/showSettingsPanel.
  private showFinalePanel() {
    this.dialogueActive = true;

    const panelWidth = 600;
    const top = 40;
    const container = this.add.container(0, 0).setDepth(100);
    this.dialogueContainer = container;

    // Capped the same way renderWorldLorePage caps its own multi-paragraph
    // prose -- this panel's closing text is long enough that the full
    // uncapped fontScale (up to 2x at the "Large" preset) overflows the
    // fixed CANVAS_H.
    const scale = Math.min(fontScale(this), 1.5);

    let y = top;

    const title = this.add
      .text(CANVAS_W / 2, y, 'The Decoherence is stabilized.', {
        fontSize: `${Math.round(16 * scale)}px`,
        color: GOLD_ACCENT_HEX,
        fontStyle: 'bold',
        align: 'center',
        wordWrap: { width: panelWidth - 80 },
      })
      .setOrigin(0.5, 0);
    container.add(title);
    y += title.height + 16;

    const body = this.add
      .text(
        CANVAS_W / 2,
        y,
        "It reached for every trick it had ever watched you land, and still came up short. It was never a plague loose in these nine worlds -- it was built out of your own play, trained to wear your own moves back at you, and you out-adapted your own reflection anyway. Every symmetry, every edge state, every fractional charge you fought to protect holds on its own now, with nothing left studying how to unmake it.",
        { fontSize: `${Math.round(13 * scale)}px`, color: '#cfd8ff', align: 'center', wordWrap: { width: 480 } }
      )
      .setOrigin(0.5, 0);
    container.add(body);
    y += body.height + 16;

    const thanks = this.add
      .text(CANVAS_W / 2, y, 'Thanks for playing.', {
        fontSize: `${Math.round(12 * scale)}px`,
        color: REFERENCE_BLUE_GREY_HEX,
        align: 'center',
      })
      .setOrigin(0.5, 0);
    container.add(thanks);
    y += thanks.height + 20;

    const button = this.addDialogueButtonAt(
      container,
      CANVAS_W / 2,
      y,
      'Return to the Lab',
      () => {
        this.closeDialogue();
        this.returnToHub();
      },
      260,
      `${Math.round(13 * scale)}px`
    );
    y += button.height + top;

    const panelHeight = y - top;
    const panel = this.add
      .rectangle(CANVAS_W / 2, top + panelHeight / 2, panelWidth, panelHeight, PANEL_BG, 0.96)
      .setStrokeStyle(2, GOLD_ACCENT);
    container.addAt(panel, 0);
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

    // RIVAL_TAUNTS (data/worldLore.ts) gives most worlds a two-part taunt --
    // a narration+dialogue line, then a second that raises the stakes --
    // chained as two pages the same destroy-and-rebuild way showWorldLore
    // chains its own two pages above. A world with no entry yet (a future/
    // unbuilt world) falls back to the old single generic line so it's
    // never a dead end.
    const taunt = RIVAL_TAUNTS[this.world];
    if (taunt) {
      this.renderRivalTauntPage(rival, taunt.part1, 'Next ->', () =>
        this.renderRivalTauntPage(rival, taunt.part2, 'Battle!', () => this.startBattle(rival, 1, true))
      );
    } else {
      this.renderRivalTauntPage(
        rival,
        `${rival.name} blocks the path onward. "You don't get past me that easily."`,
        'Battle!',
        () => this.startBattle(rival, 1, true)
      );
    }
  }

  private renderRivalTauntPage(rival: Material, line: string, buttonLabel: string, onButton: () => void) {
    this.dialogueContainer?.destroy(true);
    this.dialogueActive = true;

    const panelWidth = 600;
    const top = 20;
    const container = this.add.container(0, 0).setDepth(100);
    this.dialogueContainer = container;

    let y = top;

    // Same makeBossCrystal golem spawnBossSprite renders standing at the goal
    // tile (and BattleScene renders as the opponent once the fight starts) --
    // the rival shouldn't revert to an ordinary plain-crystal look just
    // because this "Face the Rival" dialogue is up. Redrawn on every page
    // (rather than kept across the destroy-and-rebuild) so it's on screen
    // for both parts of the taunt, not just the first.
    // The golem's silhouette is taller than it is wide and asymmetric about
    // its own center (art/boss.ts's BOSS_SILHOUETTE_TOP/BOTTOM), so both the
    // headroom above it and the gap to the taunt text below come off those
    // two extents rather than a bare BOSS_CRYSTAL_SIZE -- the head clears
    // the panel's top border, and the contact shadow under its feet clears
    // the first line of text.
    const crystalY = y + BOSS_CRYSTAL_SIZE * BOSS_SILHOUETTE_TOP + 20;
    const crystal = makeBossCrystal(this, BOSS_CRYSTAL_SIZE, rival.color, rival.variant);
    crystal.setPosition(CANVAS_W / 2, crystalY);
    container.add(crystal);
    this.tweens.add({ targets: crystal, y: crystalY + 10, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    y = crystalY + BOSS_CRYSTAL_SIZE * BOSS_SILHOUETTE_BOTTOM + 20;

    // Capped the same way renderWorldLorePage's own body text is -- the
    // longer taunts (worlds 9/10) are long enough that the Settings panel's
    // 2x "Large" preset would push this text past the fixed CANVAS_H once
    // added to the crystal's own fixed headroom above.
    const scale = Math.min(fontScale(this), 1.5);
    const text = this.add
      .text(CANVAS_W / 2, y, line, {
        fontSize: `${Math.round(12 * scale)}px`,
        fontStyle: 'italic',
        color: '#ffb3b3',
        align: 'center',
        wordWrap: { width: panelWidth - 80 },
      })
      .setOrigin(0.5, 0);
    container.add(text);
    y += text.height + 16;

    // fontSizePxOverride capped the same way the taunt text above is (see
    // that comment) -- addDialogueButton itself has no override parameter,
    // so this goes through addDialogueButtonAt directly instead.
    const btn = this.addDialogueButtonAt(
      container,
      CANVAS_W / 2,
      y,
      buttonLabel,
      onButton,
      480,
      `${Math.round(13 * scale)}px`
    );
    y += btn.height;
    y += 20;

    const panelHeight = y - top;
    const panel = this.add
      .rectangle(CANVAS_W / 2, top + panelHeight / 2, panelWidth, panelHeight, PANEL_BG, 0.94)
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

  // Two-button variant for a guardian panel with a pending two-step pick
  // (Majorana's first-crystal choice, Anderson's dope-in choice) --
  // `cancelLabel`'s handler backs out of just the pending pick, Farewell
  // backs out of the whole panel, side by side in one row (same convention
  // renderShopFooter's Farewell/Continue row uses) rather than stacking two
  // separate footer rows.
  renderCancelFarewellFooter(
    container: Phaser.GameObjects.Container,
    footerY: number,
    cancelLabel: string,
    onCancel: () => void
  ): number {
    const a = this.addDialogueButtonAt(container, CANVAS_W / 2 - 118, footerY, cancelLabel, onCancel, 210);
    const b = this.addDialogueButtonAt(container, CANVAS_W / 2 + 118, footerY, 'Farewell', () => this.closeDialogue(), 210);
    return footerY + Math.max(a.height, b.height);
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
      .rectangle(CANVAS_W / 2, top + panelHeight / 2, panelWidth, panelHeight, PANEL_BG, 0.94)
      .setStrokeStyle(2, STORY_LAVENDER);
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
        .text(CANVAS_W / 2, y, `Page ${clampedPage + 1}/${totalPages}`, { fontSize: fontPx(this, 11), color: REFERENCE_BLUE_GREY_HEX })
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
  // look up by name in the first place). Doesn't heal -- HP is never
  // intrinsic to a crystal form at all (`data/balance.ts`'s `wildHpForWorld`,
  // driven purely by the player's current world), so transmuting/fusing only
  // ever clamps HP down if it's above that world's own cap, same as it
  // always has.
  applyPlayerForm(material: Material) {
    this.game.registry.set('playerForm', material);
    const worldMaxHp = wildHpForWorld(this.world);
    const clampedHp = Math.min((this.game.registry.get('playerHp') as number) ?? worldMaxHp, worldMaxHp);
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

    const avatarY = y + 42;
    const avatar = guardian.avatar(this);
    avatar.setPosition(CANVAS_W / 2, avatarY);
    container.add(avatar);
    this.tweens.add({ targets: avatar, y: avatarY + 8, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    playGuardianChime();
    y = avatarY + 48;

    const intro = this.add
      .text(CANVAS_W / 2, y, `"${guardian.quote}"`, {
        fontSize: fontPx(this, 11),
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
        color: REFERENCE_BLUE_GREY_HEX,
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
      .rectangle(CANVAS_W / 2, top + panelHeight / 2, panelWidth, panelHeight, PANEL_BG, 0.94)
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
