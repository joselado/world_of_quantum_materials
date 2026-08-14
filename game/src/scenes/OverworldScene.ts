import Phaser from 'phaser';
import { blend } from '../art/colors';
import { BIOMES, getBiome } from '../art/biomes';
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
import { project, fogColor, HORIZON_Y, LANE_PX, CANVAS_W, CANVAS_H, ProjectedPoint } from '../art/perspective';
import { buildContourGrid, ContourPoint, MAX_OFFSET, TileContour } from '../art/contours';
import {
  PLAYER_MATERIAL,
  WORLD_NAMES,
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
  reachedGoal: boolean;
  reachedMiddle: boolean;
}

// What a tile's terrain actually is, once the grid has been read: 'path' is
// walkable trail, 'solid' plain impassable ground (rock-theme or
// region-tinted), and 'lava'/'water'/'void' the themes that lay an animated
// accent over that same ground (see drawOffPathTile).
type TerrainKind = 'path' | 'solid' | 'lava' | 'water' | 'void';

// One tile's terrain, resolved from the grid (walkable, regionColor,
// biomeOverride, flowerMap, midTile) into everything drawWorld needs that
// doesn't depend on where the camera currently is -- see
// OverworldScene.terrainPlan().
interface TerrainTile {
  kind: TerrainKind;
  biome: Biome;
  regionTint: number | null;
  decorate: boolean;
  midHighlight: boolean;
}

// Grid is deliberately fine-grained (many small tiles) rather than few large
// ones, so each arrow-key step moves the camera a small distance. TILE_SCALE
// shrinks every tile's footprint in world space; DRAW_DISTANCE_TILES and
// LANE_CLIP are widened by the inverse factor so the visible world (in
// screen terms) covers the same ground as before, just in smaller steps.
const GRID_W = 27;
const GRID_H = 50;
const TILE_SCALE = 0.6;
// How far off-center an actor can stand and still be worth drawing, in
// tile-widths. The ground plane does not use this -- how wide the ground has
// to be painted to fill the frame depends on how far away it is (laneClipAt).
const LANE_CLIP = 8.5;
const DRAW_DISTANCE_TILES = 15;
// The far quarter of the draw distance is painted as pure atmosphere by
// drawHorizonBand rather than left to the per-tile fog, which caps well short
// of the haze color and would otherwise let the deepest rows surface as a
// visible edge. It is also exactly where the detail passes (tile decoration,
// terrain accents, actor sprites) already stop, so the band covers only
// ground that had nothing left on it.
const HORIZON_BAND_FROM = 0.75;
// Thinnest projected row still worth painting, in screen pixels. The
// projection is asymptotic, so rows keep compressing toward the horizon long
// after they stop being resolvable; below a pixel they only alias and crawl
// as the camera moves, and the horizon band covers that strip instead.
const MIN_ROW_PX = 1;
// How far south of the goal row the next world's fog starts bleeding into
// this one's, in tiles, and how much of it has arrived by the goal row
// itself. Held under 1 so the world keeps some of its own air even standing
// at the gate; the fog target is applied in proportion to depth, so at the
// goal row this recolors the distance and leaves the ground underfoot alone.
const HAZE_INHERIT_TILES = 12;
const HAZE_INHERIT_MAX = 0.8;
// How far behind the player's own tile the camera sits, in tile-lengths.
// Every depth handed to projectTile is measured from the player's tile
// centre, and this is what turns that into the camera-relative depth the
// projection wants. It is the whole reason the avatar can be drawn on-screen
// standing on the tile the collision grid puts it on: at zero pullback the
// player's tile centre projects to the very bottom edge of the canvas, so the
// avatar would have to be drawn somewhere ahead of its own tile to be visible
// at all -- and would then overlap whatever is beyond the tile it can walk on.
const CAMERA_BACK_TILES = 0.7;
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
// Contact-shadow strength per band, darkest first (art/contours.ts's
// FLOOR_SHADOW_BANDS / SOLID_SHADOW_BANDS), and the depth past which the
// junction is too small on screen to be worth the extra fills.
const CONTACT_SHADOW_ALPHA = [0.24, 0.12];
const CONTACT_SHADOW_MAX_DEPTH = 0.7;
// The lit lip along the walkable side of the same boundary -- a pale edge
// against the darker mass beyond it, which also keeps the walkable region's
// own shape readable further into the distance than its fill alone would.
const CONTOUR_RIM_ALPHA = 0.3;
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
// entry) and HubScene.create (so the Lab's Guardians station, which lists
// every guardian regardless of `metGuardians` in this mode -- see
// hubStations.ts's showGuardiansPanel -- is fully unlocked even on a save
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
// mid-walk) and `HubScene` (the same guardian reopened from the Lab's
// Guardians station, see hubStations.ts's showGuardiansPanel) implement it,
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
  // Which candidate row is currently highlighted in the left column of a
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
interface GuardianDef {
  id: string;
  name: string;
  labelColor: string;
  strokeColor: number;
  quote: string;
  // One-line "what they do" -- the same copy docs/guardians.md's own
  // roster table uses, surfaced in-game by the Lab's Guardians station
  // (scenes/panels/hubStations.ts's showGuardiansPanel) so that list isn't
  // bare names with no way to tell them apart before opening one.
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
  // Whole-grid terrain classification, built on demand by terrainPlan() and
  // dropped in create() once the map for this visit is in place. Phaser
  // reuses the same scene instance across every scene.start, so a plan built
  // for a previous visit would otherwise survive into the next one; anything
  // that ever mutates the grid mid-visit (destructible walls, revealed
  // terrain) has to drop it the same way.
  private terrainPlanCache?: TerrainTile[][];
  // Smoothed walkable/impassable boundary geometry, built from the same grid
  // at the same time as terrainPlanCache and dropped alongside it. A tile away
  // from any boundary has no entry (null) and is drawn as a plain quad.
  private contourGrid: (TileContour | null)[][] = [];
  // Northernmost row the corridor reaches, resolved with the plan and dropped
  // alongside it (see findFarEdgeRow).
  private farEdgeRow = 0;
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

  // The id/name/world/blurb/`open` quintuplet the Lab's Guardians station
  // (HubScene, via scenes/panels/hubStations.ts's showGuardiansPanel) needs
  // to list a met guardian, show what they teach, and open their panel
  // directly -- everything else on GuardianDef (avatar builder, colors,
  // quote) stays private to this class. `open` is included so the Lab can
  // call the exact same callback the walk-up path uses, rather than keeping
  // a second dispatch table in sync with WORLD_GUARDIANS by hand.
  static guardianRoster(): { id: string; name: string; world: number; blurb: string; open?: (scene: GuardianPanelHost) => void }[] {
    return Object.entries(OverworldScene.WORLD_GUARDIANS)
      .filter((entry): entry is [string, GuardianDef] => !!entry[1])
      .map(([world, guardian]) => ({
        id: guardian.id,
        name: guardian.name,
        world: Number(world),
        blurb: guardian.blurb,
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
    this.contourGrid = [];
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
    // "Frozen Zero-Resistance Caverns") or a big text-size setting wraps
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
    const worldName = WORLD_NAMES[this.world] ?? `World ${this.world}`;
    const essenceGutterProbe = this.add
      .text(0, 0, 'Qumatessence: 99999', { fontSize: fontPx(this, 14), padding: { x: 4, y: 2 } })
      .setVisible(false);
    const essenceGutter = essenceGutterProbe.width + 8;
    essenceGutterProbe.destroy();
    this.add
      .text(8, 8, `World ${this.world} -- ${worldName}`, {
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
    g.fillStyle(this.groundColor(this.biome.ground, 1, this.biome.fogTarget), 1);
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

  // Tile lanes/depths are defined in grid-index units, measured from the
  // player's own tile (lane 0, depth 0 is the tile the player stands on).
  // Every projection goes through here so the world-space size of a tile
  // (TILE_SCALE) and the camera's pullback behind the player
  // (CAMERA_BACK_TILES) are applied consistently for both the ground mesh and
  // the crystal sprites.
  private projectTile(lane: number, depth: number): ProjectedPoint {
    return project(lane * TILE_SCALE, (depth + CAMERA_BACK_TILES) * TILE_SCALE);
  }

  // How far off-center the ground has to be painted, in tile-widths, for the
  // row at this depth to reach both sides of the frame. A fixed lane window
  // cannot do this job: the projection shrinks a tile-width toward the
  // vanishing point, so one that fills the frame up close covers a narrowing
  // wedge in the distance and leaves the far corners of the screen on bare
  // backdrop. One tile of slack past the frame edge keeps the outermost tile's
  // own width in play rather than ending exactly on it.
  private laneClipAt(depth: number): number {
    return CANVAS_W / 2 / (TILE_SCALE * LANE_PX * this.projectTile(0, depth).scale) + 1;
  }

  // Terrain rendering splits in two: reading the grid (this, cached for as
  // long as the grid stands still) and projecting/painting it (drawWorld,
  // every frame). Everything here is camera-independent, so the whole grid
  // is classified in one pass rather than just the currently-visible window
  // -- a shape that spans the window edge (a wall run, a traced boundary)
  // stays one continuous shape instead of being cut at whatever the camera
  // happened to see when the plan was built.
  private terrainPlan(): TerrainTile[][] {
    if (!this.terrainPlanCache) {
      this.terrainPlanCache = this.buildTerrainPlan();
      this.farEdgeRow = this.findFarEdgeRow();
      this.contourGrid = buildContourGrid(this.depthContinuedWalkable(), GRID_W, GRID_H);
    }
    return this.terrainPlanCache;
  }

  // The northernmost row the corridor reaches -- every generator paints its
  // last band on the goal row and leaves the rows north of it unwalkable, so
  // this is the last row that carries the path. It is the row the depth
  // margin (drawMarginRows) continues toward the horizon, the way the lateral
  // margin continues the grid's left/right edge column.
  private findFarEdgeRow(): number {
    for (let y = 0; y < GRID_H; y++) {
      for (let x = 0; x < GRID_W; x++) {
        if (this.walkable[y]?.[x]) return y;
      }
    }
    return 0;
  }

  // The walkability the contour trace sees: the real grid, with every row
  // north of the far edge row carrying that row's walkability instead of its
  // own. The trace treats out-of-grid as impassable, so without this the far
  // edge row's path tiles would be traced as bounded on their north side and
  // wear a boundary curve, contact shadow and rim light straight across a
  // road the depth margin then continues past them. Movement still collides
  // against the untouched `walkable` grid, so the repeated road is scenery:
  // the player leaves through the goal tile, not by walking up it.
  private depthContinuedWalkable(): boolean[][] {
    const edge = this.farEdgeRow;
    if (edge <= 0) return this.walkable;
    const out: boolean[][] = [];
    for (let y = 0; y < GRID_H; y++) out.push(y < edge ? [...this.walkable[edge]] : this.walkable[y]);
    return out;
  }

  private buildTerrainPlan(): TerrainTile[][] {
    const plan: TerrainTile[][] = [];
    for (let y = 0; y < GRID_H; y++) {
      const row: TerrainTile[] = [];
      for (let x = 0; x < GRID_W; x++) {
        // World 9's defect patches (world/generators/world9.ts) tag a tile
        // with which world's biome table it should render with instead of
        // this scene's own -- every other world leaves this null.
        const overrideWorld = this.biomeOverride[y]?.[x];
        const biome = overrideWorld != null ? getBiome(overrideWorld) : this.biome;
        const regionTint = this.regionColor[y]?.[x] ?? null;
        // A region tint outranks the biome's own wallTheme: a mapgen domain
        // (world/mapgen.ts's Voronoi regions, world3.ts) should read as a
        // distinct solid zone the player walks around, not as whatever
        // hazard terrain that biome's off-path tiles happen to use.
        const kind: TerrainKind = this.walkable[y]?.[x]
          ? 'path'
          : regionTint != null || biome.wallTheme === 'rock'
            ? 'solid'
            : biome.wallTheme;
        row.push({
          kind,
          biome,
          regionTint,
          decorate: !!this.flowerMap[y]?.[x],
          midHighlight: Math.abs(x - this.midTile.x) <= 1 && Math.abs(y - this.midTile.y) <= 1,
        });
      }
      plan.push(row);
    }
    return plan;
  }

  // Projects and paints the visible slice of the terrain plan every frame
  // from the current (possibly mid-tween) camera position -- what makes the
  // world scroll continuously rather than snapping tile-by-tile. Only the
  // projection, the depth-based fog/detail falloff, and the animated
  // (time-driven) accents are computed here; everything that depends on the
  // grid rather than the camera comes precomputed from terrainPlan().
  private drawWorld() {
    const g = this.worldGfx;
    g.clear();

    const plan = this.terrainPlan();
    const camX = this.camPos.x;
    const camY = this.camPos.y;
    this.hazeBlend = this.forwardHazeBlend();
    this.hazeCache.clear();
    // The deepest row drawn at all: where the depth fog saturates
    // (depthRatio 1), which is the same bound the depth margin runs to.
    const deepestRow = Math.floor(camY - DRAW_DISTANCE_TILES);
    const minY = Math.max(this.farEdgeRow, deepestRow);
    // Rows behind the player are still in frame -- the camera stands
    // CAMERA_BACK_TILES behind the player's tile, so the ground the player
    // has already walked over is what fills the bottom of the screen. The
    // per-tile near-plane test below is what actually stops the sweep.
    const maxY = Math.min(GRID_H - 1, Math.floor(camY) + 2);

    // Farthest first, so every nearer row paints over it.
    this.drawMarginRows(g, plan, camX, camY, deepestRow);

    for (let y = minY; y <= maxY; y++) {
      this.drawMarginColumns(g, plan[y], y, camX, camY);
      const laneClip = this.laneClipAt(camY - y + 0.5);
      for (let x = 0; x < GRID_W; x++) {
        const laneL = x - camX - 0.5;
        const laneR = x - camX + 0.5;
        if (laneL > laneClip || laneR < -laneClip) continue;

        const depthFar = camY - y + 0.5;
        const depthNear = camY - y - 0.5;
        if (depthFar + CAMERA_BACK_TILES <= 0) continue;

        const pFL = this.projectTile(laneL, depthFar);
        const pFR = this.projectTile(laneR, depthFar);
        const pNR = this.projectTile(laneR, depthNear);
        const pNL = this.projectTile(laneL, depthNear);

        const depthRatio = Phaser.Math.Clamp(depthFar / DRAW_DISTANCE_TILES, 0, 1);
        const tile = plan[y][x];
        const contour = this.contourGrid[y]?.[x] ?? null;
        const fill = contour ? this.projectContour(contour.outline, camX, camY) : [pFL, pFR, pNR, pNL];

        if (tile.kind === 'path') {
          let color = this.groundColor(tile.biome.path, depthRatio, this.walkableHazeTarget(tile.biome));
          if (tile.regionTint != null) color = blend(color, tile.regionTint, 0.55);
          g.fillStyle(color, 1);
          g.fillPoints(fill, true);
          if (contour) this.drawContactShadow(g, contour, tile.biome, camX, camY, depthRatio);
          if (depthRatio < 0.75 && tile.decorate) {
            this.decorateTile(g, pFL, pFR, pNR, pNL);
          }
          if (tile.midHighlight) {
            // The glow falls off radially from the guardian's own tile, so the
            // gate reads as a pool of light: at a uniform alpha the same nine
            // tiles read as a hard rectangle laid over a floor whose every
            // other edge curves.
            const spread = Math.hypot(x - this.midTile.x, y - this.midTile.y);
            this.drawMidHighlight(g, fill, depthRatio, 1 - 0.45 * spread);
          }
        } else {
          this.drawOffPathTile(g, tile, fill, contour, pFL, pFR, pNR, pNL, depthRatio);
        }
      }
    }
    this.drawDepthHaze(g);
  }

  // Projects a cached tile-space outline (art/contours.ts) at the current
  // camera position. Each call allocates its own array: Phaser's Graphics is
  // retained-mode, so the points handed to fillPoints are read again at flush
  // time and cannot be reused across draw calls within a frame.
  private projectContour(points: ContourPoint[], camX: number, camY: number): ProjectedPoint[] {
    const out: ProjectedPoint[] = [];
    for (const p of points) out.push(this.projectTile(p.x - camX, camY - p.y));
    return out;
  }

  // Columns just past the grid's left/right edges, drawn wherever the camera
  // stands close enough to an edge that the lane window reaches past it.
  // Each one continues its row's edge tile -- same biome, same region tint,
  // same terrain accent -- but always as impassable ground (an edge tile
  // that is walkable floor continues as its biome's off-path terrain, never
  // as more floor), so the world runs to the frame edge instead of stopping
  // on a stair-stepped strip of bare backdrop. Drawn before the row's real
  // tiles: the innermost margin column is widened by MAX_OFFSET under an
  // adjacent walkable tile so the boundary curve's vacated sliver is covered
  // in ground color, and the real fills then paint over the rest of the
  // overlap. No contour/contact-shadow work happens out here -- the real
  // grid-edge boundary is already part of the traced contour (the trace
  // treats out-of-grid as impassable), so the floor side keeps its usual
  // curve, shadow and rim.
  // `row` supplies the terrain and `y` the depth, which the depth margin
  // (drawMarginRows) separates: its rows lie past the grid's far edge and
  // take their terrain from the far edge row.
  private drawMarginColumns(g: Phaser.GameObjects.Graphics, row: TerrainTile[], y: number, camX: number, camY: number) {
    const depthFar = camY - y + 0.5;
    if (depthFar + CAMERA_BACK_TILES <= 0) return;
    const laneClip = this.laneClipAt(depthFar);
    for (let gx = Math.floor(camX - laneClip); gx < 0; gx++) {
      this.drawMarginTile(g, row[0], gx, y, camX, camY, gx === -1);
    }
    const rightEnd = Math.ceil(camX + laneClip);
    for (let gx = GRID_W; gx <= rightEnd; gx++) {
      this.drawMarginTile(g, row[GRID_W - 1], gx, y, camX, camY, gx === GRID_W);
    }
  }

  // Rows past the grid's far edge, drawn wherever the camera stands close
  // enough to that edge that the draw distance reaches beyond it -- the depth
  // counterpart of drawMarginColumns, so the ground plane runs to the horizon
  // instead of terminating on a strip of bare backdrop. Each one repeats the
  // far edge row (findFarEdgeRow) whole, terrain kind included, so the
  // walkable path repeats with it and the road continues past the world's own
  // end; the haze is what ends it. Two bounds keep that honest: the sweep
  // stops where the depth fog saturates (`deepestRow`, the same bound the
  // real rows use, beyond which nothing is distinguishable anyway and the
  // horizon band takes over), and it stops early on any row whose projected
  // thickness has fallen under a pixel, which would alias and crawl as the
  // camera moves. No contour, contact shadow or decoration out here: the far
  // edge row's own contour already runs unbroken into these rows (see
  // depthContinuedWalkable), and every repeat is far enough out that the
  // detail passes are already faded off.
  private drawMarginRows(
    g: Phaser.GameObjects.Graphics,
    plan: TerrainTile[][],
    camX: number,
    camY: number,
    deepestRow: number
  ) {
    const edge = plan[this.farEdgeRow];
    for (let gy = this.farEdgeRow - 1; gy >= deepestRow; gy--) {
      const depthFar = camY - gy + 0.5;
      const depthNear = camY - gy - 0.5;
      if (this.projectTile(0, depthNear).y - this.projectTile(0, depthFar).y < MIN_ROW_PX) break;

      this.drawMarginColumns(g, edge, gy, camX, camY);
      const depthRatio = Phaser.Math.Clamp(depthFar / DRAW_DISTANCE_TILES, 0, 1);
      const laneClip = this.laneClipAt(depthFar);
      for (let x = 0; x < GRID_W; x++) {
        const laneL = x - camX - 0.5;
        const laneR = x - camX + 0.5;
        if (laneL > laneClip || laneR < -laneClip) continue;

        const pFL = this.projectTile(laneL, depthFar);
        const pFR = this.projectTile(laneR, depthFar);
        const pNR = this.projectTile(laneR, depthNear);
        const pNL = this.projectTile(laneL, depthNear);
        const fill = [pFL, pFR, pNR, pNL];
        const tile = edge[x];

        if (tile.kind === 'path') {
          let color = this.groundColor(tile.biome.path, depthRatio, this.walkableHazeTarget(tile.biome));
          if (tile.regionTint != null) color = blend(color, tile.regionTint, 0.55);
          g.fillStyle(color, 1);
          g.fillPoints(fill, true);
        } else {
          this.drawOffPathTile(g, tile, fill, null, pFL, pFR, pNR, pNL, depthRatio);
        }
      }
    }
  }

  private drawMarginTile(
    g: Phaser.GameObjects.Graphics,
    edge: TerrainTile,
    gx: number,
    y: number,
    camX: number,
    camY: number,
    innermost: boolean
  ) {
    let laneL = gx - camX - 0.5;
    let laneR = gx - camX + 0.5;
    const laneClip = this.laneClipAt(camY - y + 0.5);
    if (laneL > laneClip || laneR < -laneClip) return;
    if (innermost && edge.kind === 'path') {
      if (gx < 0) laneR += MAX_OFFSET;
      else laneL -= MAX_OFFSET;
    }

    const depthFar = camY - y + 0.5;
    const depthNear = camY - y - 0.5;
    const depthRatio = Phaser.Math.Clamp(depthFar / DRAW_DISTANCE_TILES, 0, 1);
    const pFL = this.projectTile(laneL, depthFar);
    const pFR = this.projectTile(laneR, depthFar);
    const pNR = this.projectTile(laneR, depthNear);
    const pNL = this.projectTile(laneL, depthNear);
    const fill = [pFL, pFR, pNR, pNL];

    g.fillStyle(this.offPathColor(edge.biome, edge.regionTint, depthRatio), 1);
    g.fillPoints(fill, true);

    if (depthRatio <= 0.75) {
      const kind: TerrainKind =
        edge.kind !== 'path'
          ? edge.kind
          : edge.regionTint != null || edge.biome.wallTheme === 'rock'
            ? 'solid'
            : edge.biome.wallTheme;
      if (kind === 'lava') this.drawLavaAccent(g, fill, pFL, pFR, pNR, pNL);
      else if (kind === 'water') this.drawWaterAccent(g, pFL, pFR, pNR, pNL);
      else if (kind === 'void') this.drawVoidAccent(g, pFL, pFR, pNR, pNL);
    }
  }

  // A soft ambient-occlusion band hugging the walkable/impassable boundary,
  // drawn over the ground fill from both sides of the junction, so the floor
  // reads as tucking under the terrain beyond it rather than butting flat
  // against it. With the per-tile seam stroke gone this and the rim light are
  // what mark the boundary, so a run of same-kind tiles reads as one
  // continuous region while the edge between regions stays sharp.
  private drawContactShadow(
    g: Phaser.GameObjects.Graphics,
    contour: TileContour,
    biome: Biome,
    camX: number,
    camY: number,
    depthRatio: number
  ) {
    if (depthRatio > CONTACT_SHADOW_MAX_DEPTH) return;
    const fade = 1 - depthRatio / CONTACT_SHADOW_MAX_DEPTH;
    for (const strip of contour.shadow) {
      g.fillStyle(0x000000, (CONTACT_SHADOW_ALPHA[strip.band] ?? 0) * fade);
      g.fillPoints(this.projectContour(strip.points, camX, camY), true);
    }
    if (contour.rim.length === 0) return;
    g.lineStyle(1.5, blend(biome.path, 0xffffff, 0.45), CONTOUR_RIM_ALPHA * fade);
    for (const lip of contour.rim) g.strokePoints(this.projectContour(lip, camX, camY), false);
  }

  // Distant walkable ground hazes toward a lighter target than its
  // surroundings do, so the route the player is planning stays visible all the
  // way to the horizon -- letting floor and off-path converge on one haze
  // color erases the boundary at exactly the range it is being read from.
  private walkableHazeTarget(biome: Biome): number {
    return blend(this.hazeTarget(biome), biome.path, 0.35);
  }

  // What the distance hazes toward: a biome's own fog color, carried toward
  // the next world's fog as the player nears the gate, so the air ahead
  // becomes the next world's air. Every haze in the scene reads this, so the
  // per-tile fog and the whole-screen wash always agree on where the
  // atmosphere is going.
  private hazeTarget(biome: Biome): number {
    if (this.hazeBlend <= 0) return biome.fogTarget;
    const cached = this.hazeCache.get(biome.fogTarget);
    if (cached != null) return cached;
    const next = getBiome(this.world + 1).fogTarget;
    const mixed = blend(biome.fogTarget, next, this.hazeBlend);
    this.hazeCache.set(biome.fogTarget, mixed);
    return mixed;
  }

  // How much of the next world's air has arrived, from the camera's distance
  // to the goal row. Gated on the goal gate's state: while this world's rival
  // still stands the gate is shut, and a shut gate shows nothing of what is
  // beyond it. World 10 has no next world -- it keeps its own air the whole
  // way, its horizon being the Qumatuomi sky rather than a neighbour.
  private forwardHazeBlend(): number {
    if (!BIOMES[this.world + 1]) return 0;
    if (!this.isRivalDefeated()) return 0;
    const rows = this.camPos.y - this.goalTile.y;
    return Phaser.Math.Clamp(1 - rows / HAZE_INHERIT_TILES, 0, 1) * HAZE_INHERIT_MAX;
  }

  // A wash of the biome's own haze color over the far reach of the ground
  // plane, on top of the per-tile depth fog rather than instead of it: the
  // per-tile blend alone still hands every tile a hard edge against its
  // neighbor, and the wash is what turns the far distance into continuous
  // atmosphere. Drawn into worldGfx so it stays under every actor.
  private drawDepthHaze(g: Phaser.GameObjects.Graphics) {
    const target = this.hazeTarget(this.biome);
    this.fillVerticalFade(g, target, HORIZON_Y, 240, (t) => 0.35 * Math.pow(1 - t, 3));
    this.drawHorizonBand(g, target);
  }

  // A vertical alpha ramp in one flat color, painted as abutting one-pixel
  // rows. The rows must not overlap: two translucent rects sharing a scanline
  // blend twice there, which draws a bright line at every seam -- invisible
  // while the color is close to the ground under it, and stripes across the
  // whole far distance as soon as it is not (a haze carrying the next world's
  // fog color, biomes.ts's note on holding `fogTarget` near the floor colors).
  private fillVerticalFade(
    g: Phaser.GameObjects.Graphics,
    color: number,
    top: number,
    height: number,
    alphaAt: (t: number) => number
  ) {
    const rows = Math.max(1, Math.round(height));
    for (let i = 0; i < rows; i++) {
      g.fillStyle(color, alphaAt(i / rows));
      g.fillRect(0, top + i * (height / rows), CANVAS_W, height / rows);
    }
  }

  // The last stretch of ground is painted atmosphere rather than tiles: past
  // the fog-saturation depth rows are compressed to nothing and hold nothing
  // the haze has not already taken, so the terrain dissolves and meets the sky
  // as a gradient instead of on the edge of a final row. The band is fully
  // opaque from the horizon line down to that depth -- which is what covers
  // the deepest rows, whose own fog caps well short of the haze color and
  // would otherwise surface as a visible edge -- and thins from there toward
  // the camera, running out at HORIZON_BAND_FROM of the draw distance. Both
  // ends are fixed depths rather than tracked off the deepest row drawn, so
  // the band never slides out from under the rows as the camera creeps.
  private drawHorizonBand(g: Phaser.GameObjects.Graphics, target: number) {
    const solid = this.projectTile(0, DRAW_DISTANCE_TILES).y;
    const foot = this.projectTile(0, DRAW_DISTANCE_TILES * HORIZON_BAND_FROM).y;
    const height = foot - HORIZON_Y;
    const solidT = (solid - HORIZON_Y) / height;
    this.fillVerticalFade(g, target, HORIZON_Y, height, (t) =>
      t <= solidT ? 1 : Math.pow((1 - t) / (1 - solidT), 1.5)
    );
  }

  // The ground plane leans hard on aerial perspective: `fogColor`'s own blend
  // caps out well short of the haze color, so pre-blend the rest of the way
  // with a curve that starts biting close to the camera instead of only at
  // the draw-distance edge.
  private groundColor(base: number, depthRatio: number, target: number): number {
    return blend(fogColor(base, depthRatio, target), target, 0.4 * Math.pow(depthRatio, 0.9));
  }

  // The guardian chokepoint (invariant B, world/mapgen.ts's forceChokepoint)
  // gets its own floor treatment -- a soft pulsing glow over the same path
  // fill, in that world's own guardian color (WORLD_GUARDIANS' strokeColor,
  // the same per-guardian color coding every panel/pill already uses) --
  // covering `midTile` and its immediate neighbors so the forced pinch reads
  // as a deliberate gate the player is walking through, not an arbitrary
  // narrow spot.
  private drawMidHighlight(g: Phaser.GameObjects.Graphics, fill: ProjectedPoint[], depthRatio: number, falloff: number) {
    if (depthRatio > 0.9) return;
    const glowColor = OverworldScene.WORLD_GUARDIANS[this.world]?.strokeColor ?? GOLD_ACCENT;
    const pulse = 0.5 + 0.5 * Math.sin(this.time.now / 320);
    g.fillStyle(glowColor, 0.28 * pulse * (1 - depthRatio) * falloff);
    g.fillPoints(fill, true);
  }

  // Paints one impassable tile. Every off-path tile is flat ground in that
  // biome's own off-path color, sitting in the same plane as the walkable
  // floor; what its `wallTheme` decides (through the terrain kind resolved in
  // buildTerrainPlan) is only the accent laid over that fill, so each world's
  // impassable terrain still reads as its own material -- 'lava' a glowing
  // molten crust, 'water' a rippling frozen lake, 'void' a starlit drop, and
  // 'solid' bare ground with no accent at all. The "you cannot walk here"
  // read comes from the color break plus the contact shadow and rim light at
  // the boundary, which every theme gets alike. A region-tinted tile resolves
  // to 'solid' and so keeps its domain color clean of any accent.
  private drawOffPathTile(
    g: Phaser.GameObjects.Graphics,
    tile: TerrainTile,
    fill: ProjectedPoint[],
    contour: TileContour | null,
    pFL: ProjectedPoint,
    pFR: ProjectedPoint,
    pNR: ProjectedPoint,
    pNL: ProjectedPoint,
    depthRatio: number
  ) {
    g.fillStyle(this.offPathColor(tile.biome, tile.regionTint, depthRatio), 1);
    g.fillPoints(fill, true);

    // Every accent is skipped past depthRatio 0.75 (the same gate
    // `decorateTile` uses) so distant tiles stay a cheap flat fill rather than
    // paying the animated-detail cost for the couple hundred off-path tiles a
    // single frame can contain.
    if (depthRatio <= 0.75) {
      if (tile.kind === 'lava') this.drawLavaAccent(g, fill, pFL, pFR, pNR, pNL);
      else if (tile.kind === 'water') this.drawWaterAccent(g, pFL, pFR, pNR, pNL);
      else if (tile.kind === 'void') this.drawVoidAccent(g, pFL, pFR, pNR, pNL);
    }

    // The impassable side of the contact shadow, over the accent rather than
    // under it, so the junction is shaded from both sides no matter which
    // theme this tile draws.
    if (contour) this.drawContactShadow(g, contour, tile.biome, this.camPos.x, this.camPos.y, depthRatio);
  }

  // The flat fill color of an impassable tile: the biome's own off-path
  // ground, hazed for depth, tinted toward a mapgen domain's color where the
  // tile belongs to one.
  private offPathColor(biome: Biome, regionTint: number | null, depthRatio: number): number {
    const base = this.groundColor(biome.ground, depthRatio, this.hazeTarget(biome));
    return regionTint != null ? blend(base, regionTint, 0.6) : base;
  }

  // 'lava' (Defect Wastes, world 9): a glowing molten crust over the off-path
  // fill -- a pulsing warm wash, a bright crack line and a hot core dot.
  private drawLavaAccent(
    g: Phaser.GameObjects.Graphics,
    fill: ProjectedPoint[],
    pFL: ProjectedPoint,
    pFR: ProjectedPoint,
    pNR: ProjectedPoint,
    pNL: ProjectedPoint
  ) {
    const cx = (pFL.x + pFR.x + pNR.x + pNL.x) / 4;
    const cy = (pFL.y + pFR.y + pNR.y + pNL.y) / 4;
    const s = pNL.scale;
    // Phase from the tile's screen position, geometry from its own center.
    // The spatial frequency is kept low -- a fraction of a radian between
    // neighboring tiles -- so the glow drifts across the crust as broad slow
    // waves; a phase step of a radian or more per tile makes adjacent tiles
    // pulse against each other and the whole crust read as a checkerboard of
    // the very tile grid the smoothed terrain is meant to hide. The wash is
    // also held dim enough that the crust never climbs toward the scorched
    // clay of the walkable route (biomes.ts's crackedWorld) -- the world
    // stays all reds, told apart by value.
    const pulse = 0.55 + 0.45 * Math.sin(this.time.now / 260 + cx * 0.012 + cy * 0.007);

    g.fillStyle(0xff5a1a, 0.24 * pulse);
    g.fillPoints(fill, true);

    g.lineStyle(1.6, 0xffcf4a, 0.6 * pulse);
    g.beginPath();
    g.moveTo(cx - 2.6 * s, cy - 1.2 * s);
    g.lineTo(cx - 0.4 * s, cy + 0.6 * s);
    g.lineTo(cx + 1.6 * s, cy - 0.8 * s);
    g.strokePath();

    g.fillStyle(0xfff0a0, 0.55 * pulse);
    g.fillCircle(cx, cy, 1.1 * s * pulse);
  }

  // 'water' (Frozen Caverns, world 5): a rippling frozen lake -- shimmer
  // streaks and a pale highlight drifting over the off-path fill.
  private drawWaterAccent(
    g: Phaser.GameObjects.Graphics,
    pFL: ProjectedPoint,
    pFR: ProjectedPoint,
    pNR: ProjectedPoint,
    pNL: ProjectedPoint
  ) {
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

  // 'void' (Topological Islands, world 3): the dark drop between islands --
  // a couple of faint stars glinting up out of it, so stepping off the path
  // reads as falling into open space rather than onto darker ground.
  private drawVoidAccent(
    g: Phaser.GameObjects.Graphics,
    pFL: ProjectedPoint,
    pFR: ProjectedPoint,
    pNR: ProjectedPoint,
    pNL: ProjectedPoint
  ) {
    const cx = (pFL.x + pFR.x + pNR.x + pNL.x) / 4;
    const cy = (pFL.y + pFR.y + pNR.y + pNL.y) / 4;
    const s = pNL.scale;
    const twinkle = 0.45 + 0.35 * Math.sin(this.time.now / 700 + cx * 0.07 + cy * 0.05);

    g.fillStyle(0xdfe9ff, 0.7 * twinkle);
    g.fillCircle(cx - 1.8 * s, cy - 0.7 * s, 0.5 * s);
    g.fillStyle(0xdfe9ff, 0.45 * (1 - twinkle));
    g.fillCircle(cx + 1.5 * s, cy + 0.8 * s, 0.4 * s);
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
      const p = this.projectTile(lane, depth);
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
  // paginates candidate-list buttons). onDone runs once page 2 is
  // dismissed, so create() doesn't need its own branch for "lore already
  // seen" vs "lore just finished."
  private showWorldLore(lore: WorldLore, onDone: () => void) {
    this.renderWorldLorePage(lore.page1, 'Next ->', () =>
      this.renderWorldLorePage(lore.page2, 'Onward', () => {
        markWorldLoreSeen(this.game.registry, this.world);
        persistFromRegistry(this.game.registry);
        this.closeDialogue();
        onDone();
      })
    );
  }

  private renderWorldLorePage(body: string, buttonLabel: string, onContinue: () => void) {
    this.dialogueContainer?.destroy(true);
    this.dialogueActive = true;

    const panelWidth = CANVAS_W - 40;
    const top = 16;
    const container = this.add.container(0, 0).setDepth(100);
    this.dialogueContainer = container;

    // Capped like BattleScene.drawMoveMenu's own chromeScale/headerScale --
    // this panel's multi-paragraph prose is long enough that letting it
    // scale all the way to the Settings panel's 2x "Large" preset overflows
    // the fixed CANVAS_H, the same fixed-budget problem that cap already
    // solves for the move menu's title/legend.
    const scale = Math.min(fontScale(this), 1.5);

    let y = top;
    const worldName = WORLD_NAMES[this.world] ?? `World ${this.world}`;
    const title = this.add
      .text(CANVAS_W / 2, y, worldName, {
        fontSize: `${Math.round(15 * scale)}px`,
        color: '#ffffff',
        fontStyle: 'bold',
        align: 'center',
        wordWrap: { width: panelWidth - 60 },
      })
      .setOrigin(0.5, 0);
    container.add(title);
    y += title.height + 8;

    const text = this.add
      .text(CANVAS_W / 2, y, body, {
        fontSize: `${Math.round(11 * scale)}px`,
        color: '#e6d9ff',
        align: 'center',
        wordWrap: { width: panelWidth - 60 },
        lineSpacing: 3,
      })
      .setOrigin(0.5, 0);
    container.add(text);
    y += text.height + 12;

    // fontSizePxOverride capped the same way the body text above is --
    // otherwise the button would fall through to addDialogueButtonAt's own
    // uncapped default and eat into the margin the body-text cap exists to
    // protect.
    const btn = this.addDialogueButtonAt(
      container,
      CANVAS_W / 2,
      y,
      buttonLabel,
      onContinue,
      180,
      `${Math.round(13 * scale)}px`
    );
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
    const panelY = 260;
    const container = this.add.container(0, 0).setDepth(100);
    this.dialogueContainer = container;

    const panel = this.add.rectangle(CANVAS_W / 2, panelY, 560, 200, PANEL_BG, 0.96).setStrokeStyle(2, STORY_LAVENDER);
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
