import Phaser from 'phaser';
import { BIOMES, getBiome } from '../art/biomes';
import type { Biome } from '../art/biomes';
import { makeCrystal } from '../art/crystals';
import { makeToken } from '../art/tokens';
import { makeNoetherAvatar } from '../art/noether';
import { BOSS_FOOT, BOSS_SILHOUETTE_BOTTOM, BOSS_SILHOUETTE_HALF_WIDTH, BOSS_SILHOUETTE_TOP, makeBossCrystal } from '../art/boss';
import { BOARD_FOOT, makePassBoard } from '../art/passBoard';
import { makeBlochAvatar } from '../art/bloch';
import { makeFeynmanAvatar } from '../art/feynman';
import { makeDresselhausAvatar } from '../art/dresselhaus';
import { makeLandauAvatar } from '../art/landau';
import { makeMajoranaAvatar } from '../art/majorana';
import { makeSklodowskaCurieAvatar } from '../art/sklodowskaCurie';
import { makeKondoAvatar } from '../art/kondo';
import { makeAndersonAvatar } from '../art/anderson';
import { makeFranklinAvatar } from '../art/franklin';
import { stopMoveEffectPreview } from '../art/moveEffectPreview';
import { project, CANVAS_W, CANVAS_H, LANE_PX } from '../art/perspective';
import {
  CAMERA_BACK_TILES,
  DRAW_DISTANCE_TILES,
  LANE_CLIP,
  TILE_SCALE,
  VISIBLE_DEPTH_FRACTION,
  gridH,
  gridW,
  laneClipAt,
  projectTile,
  setActiveGridDims,
} from './overworld/projection';
import { drawSky, forwardHazeBlend } from './overworld/sky';
import type { GateView } from './overworld/sky';
import { buildTerrainPlan, sampleBattleLocale } from './overworld/terrain/plan';
import { drawTerrain } from './overworld/terrain/paint';
import type { BattleLocale, TerrainPlan, TerrainView } from './overworld/terrain/types';
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
import { pickTokenValue, tokenColorForValue } from '../data/tokens';
import { getWorldQuestion } from '../data/quiz';
import type { MaterialQuestion } from '../data/quiz';
import { hasMath, makeQuestionText, makeFormulaButton } from '../ui/mathtext';
import { encounterGreeting } from '../data/greetings';
import { TUTORIAL_TIPS, hasSeenTip, markTipSeen } from '../data/tutorial';
import type { TutorialTipId } from '../data/tutorial';
import { STORY_BEATS, WORLD_GOAL_TEXT, FINALE_TITLE, FINALE_BODY } from '../data/story';
import { WORLD_LORE, RIVAL_TAUNTS, hasSeenWorldLore, markWorldLoreSeen } from '../data/worldLore';
import type { WorldLore } from '../data/worldLore';
import {
  DEFAULT_ENCOUNTER_DENSITY,
  DEFAULT_TOUCH_CONTROLS,
  DEFAULT_WORLD_SIZE,
  gridDimsFor,
  touchControlsActive,
  tutorialTipsEnabled,
  storyScreensEnabled,
  worldSizeFactor,
} from '../data/settings';
import type { TouchControlsMode, WorldSizeId } from '../data/settings';
import { createTouchPad, PAD_KEEPOUT } from './overworld/touchControls';
import type { TouchPad } from './overworld/touchControls';
import { persistFromRegistry } from '../data/save';
import type { DiscoveredMaterial } from '../data/save';
import type { Material, MaterialType, MoveClass } from '../data/types';
import { generateWorldMap } from '../world/mapgen';
import type { GridPoint } from '../world/mapgen';
import { PASS_HALF_WIDTH, passZoneRows, reachableGround, scaleOfGrid, worldScale } from '../world/generators/shared';
import type { WorldScale } from '../world/generators/shared';
import { fontPx, fontScale, fitProseToBudget } from '../ui/text';
import { PANEL_BG, GOLD_ACCENT, GOLD_ACCENT_HEX, REFERENCE_BLUE_GREY_HEX, TUTORIAL_CYAN, STORY_LAVENDER } from '../ui/theme';
import { music } from '../audio/music';
import { renderGuardianHeader } from './panels/guardianHeader';
import { showNoetherShop } from './panels/noether';
import { showSklodowskaCuriePanel } from './panels/sklodowskaCurie';
import { showKondoPanel } from './panels/kondo';
import { showLandauPanel } from './panels/landau';
import { showFeynmanPanel } from './panels/feynman';
import { showBlochHub } from './panels/bloch';
import { showDresselhausPanel } from './panels/dresselhaus';
import { showMajoranaPanel } from './panels/majorana';
import { showAndersonPanel } from './panels/anderson';
import { showFranklinPanel } from './panels/franklin';

// Snapshot of an in-progress map, stashed in the game registry so a round
// trip through BattleScene resumes exactly where the player left off instead
// of generating (and spawning onto) a brand new random map. Ignored when the
// scene is (re)created with `regenerate: true` -- an explicit world change
// via the Hub door, Bloch's teleport, or a debug warp -- which is the one
// situation meant to generate a fresh layout. It belongs to the run that
// built it rather than to a save slot, so the title screen drops it whenever
// it loads a slot (TitleScene.loadIntoRegistry).
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
  featureCores: GridPoint[];
  reachedGoal: boolean;
  reachedMiddle: boolean;
  // Respawn bookkeeping (see "Respawning" below): the standing population of
  // each kind this map carries. Both are scalars rather than the grids above,
  // so unlike `walkable`/`tokenTiles` they are genuinely copied here rather
  // than shared by reference -- a respawn has to re-snapshot for them to
  // survive a round trip through BattleScene.
  wildTarget: number;
  tokenTarget: number;
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
// The walkable width of a pass throat, in tiles (world/generators/shared.ts's
// taper). Everything sized against the aperture reads off this.
const PASS_APERTURE_TILES = PASS_HALF_WIDTH * 2 + 1;
// The rival is sized to the pass it holds, not to the screen: its widest
// span (art/boss.ts's BOSS_SILHOUETTE_HALF_WIDTH, the outstretched fists)
// covers the throat's full walkable width, so no gap shows past it from the
// approach tile. Scale is not in this ratio because it cancels -- the golem
// and the aperture stand at the same depth, so one number holds at every
// distance the pass is looked at from. Scale is read against the opening
// (WORLDS.md section 4): a figure filling a narrow notch reads larger than a
// giant in an open field, and this comes out far above the player's own 34.
const BOSS_CRYSTAL_SIZE = Math.round((PASS_APERTURE_TILES * TILE_SCALE * LANE_PX) / (2 * BOSS_SILHOUETTE_HALF_WIDTH));
// The golem's full vertical extent per unit of size, head to contact shadow.
const BOSS_SILHOUETTE_HEIGHT = BOSS_SILHOUETTE_TOP + BOSS_SILHOUETTE_BOTTOM;
// How small the rival's taunt-page golem may shrink before the taunt text
// starts giving up size instead (renderRivalTauntPage). A figure below this
// stops reading as the golem standing in the pass and starts reading as an
// icon of one, which is worth more than a point of font size.
const MIN_BOSS_SIZE = 56;
// The taunt page's fixed vertical spacing: headroom above the golem's head,
// the gap from its feet to the first line, from the last line to the button,
// and below the button to the panel edge -- plus the margin the panel itself
// keeps off the bottom of the canvas.
const HEAD_ROOM = 20;
const CRYSTAL_TO_TEXT = 20;
const TEXT_TO_BUTTON = 16;
const BELOW_BUTTON = 20;
const BOTTOM_MARGIN = 10;
// The signboard in a pass. Read at approach distance and no further, so it
// stays a signpost rather than competing with the horizon it captions.
const BOARD_SPRITE_SIZE = 34;
const QUIZ_CORRECT_MULTIPLIER = 1.5;
const QUIZ_WRONG_MULTIPLIER = 0.6;

// --- Respawning ------------------------------------------------------------
// A world refills itself while the player walks it: wild crystals drift back
// in and qumatessence condenses again as soon as the ground they land on has
// left the player's view, so a map that has been picked clean doesn't stay a
// dead corridor and walking back to a stretch already cleared finds it grown
// over again. Driven off the player's own steps (`refillHidden`), since which
// ground is hidden can only change when the player moves.
//
// The two margins a respawn must clear, in rows. Nothing may ever appear
// within view, so the world refills only outside the drawn world -- ahead of
// the player past the far edge of their field of vision, or behind them past
// the camera.
//
// The northern margin is derived from the projection's own draw distance
// rather than fixed, plus two rows of slack -- one for the camera lagging
// behind the player's tile mid-step, one for a sprite's own wander -- so
// widening the draw distance can never start popping respawns into view.
//
// The southern margin exists because the world has to refill *behind* the
// player too: a player walking a corridor back and forth must always find
// more, and refills that only ever land ahead leave the stretch already
// walked permanently bare and stop entirely near the north end of a map. The
// camera faces north permanently and sits CAMERA_BACK_TILES behind the
// player, so a tile even one row south of the player's own is already culled
// -- but `playerTile` moves to the destination the instant a step begins
// while the camera is still tweening from the tile behind, so the margin has
// to cover a full step of that lag, plus the same wander slack, plus one
// spare.
const RESPAWN_MIN_ROWS_AHEAD = Math.ceil(DRAW_DISTANCE_TILES * VISIBLE_DEPTH_FRACTION) + 2;
const RESPAWN_MIN_ROWS_BEHIND = Math.ceil(CAMERA_BACK_TILES) + 2;

// Worlds with a built overworld map (biome + rival, where applicable) --
// bounds Bloch's teleport offers (a "visited" world the player can't
// actually walk isn't a real destination), including the Superposition-Mode
// case where every one of them is marked visited from the start. All
// 10 worlds are built as of DESIGN.md's "full build-out" pass. Exported so
// data/integrity.ts can assert every entry here actually has a biome and a
// rival.
export const BUILT_WORLDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

// The last world there is. What makes it the last is visible in it: its road
// stops at a cliff instead of running on into a neighbour (overlookView).
export const FINAL_WORLD = Math.max(...BUILT_WORLDS);

// Superposition Mode's blanket "every guardian is already unlocked" grant --
// registry-only and world-independent, so it's shared by
// OverworldScene.applySuperpositionLeveling (re-applied on every world
// entry) and HubScene.create (which stands every guardian's own avatar in the
// Lab regardless of `metGuardians` in this mode, so each one's panel needs to
// be fully unlocked even on a save
// that has never yet stepped through a world door; without this, Kondo/
// Franklin/Noether/Landau/Feynman/Skłodowska-Curie/Bloch's Lab panels
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
  // means every move's ceiling already at max rather than one random pick
  // among mutually-exclusive options. Unconditional, same as
  // unlockedMoves/discoveredMaterials/passivesUnlocked above: this raises
  // the ceiling only, and which tier a move is actually *carried* at is a
  // separate deliberate pick living in `carriedMoveLevels`, which this
  // never touches, so re-applying the grant on every world entry cannot
  // stamp over a player's own choice to swing a move at a lower tier.
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

// One refill's survey of the ground it may place on (`surveyRespawnGround`):
// the eligible tiles with the geometry the placers ask about, and the rows
// that already hold an encounter. Both placers consume from it -- a placed
// tile is spliced out -- so the survey is walked once and spent, never rebuilt
// per item.
interface RespawnGround {
  tiles: { p: GridPoint; runWidth: number; degree: number }[];
  rowsWithEncounter: Set<number>;
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
  // Planted: no wander, no bob. A loose crystal glints and drifts because it
  // is a gem hovering over the tile it sits on, but anything that meets the
  // ground -- a signboard nailed to two posts, a rival's golem standing on
  // its own two feet -- has to stay where it is put. Drifting reads as a
  // prop rather than as part of the road; bobbing carries the sprite's own
  // contact shadow up with it and reads as floating. A planted sprite is
  // still free to be alive, from art of its own that moves without leaving
  // the ground (art/boss.ts's feet-pivoted idle rig).
  still?: boolean;
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
  addQuestionButton(
    container: Phaser.GameObjects.Container,
    y: number,
    label: string,
    onClick: () => void
  ): Phaser.GameObjects.Text | Phaser.GameObjects.Container;
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
  // closeDialogue()) as every other per-guardian field above. Landau's and
  // Skłodowska-Curie's own panels (scenes/panels/landau.ts/
  // sklodowskaCurie.ts) have no preview/pagination field of their own --
  // each has exactly two fixed moves, always both rendered side by side
  // rather than browsed one at a time through a candidate list.
  noetherMovePreview: string | null;
  noetherMovePage: number;
  // The same pair again for Noether's other tab, holding a `Stats` key
  // (data/balance.ts's STAT_LABELS) rather than a move id. Kept separate from
  // the Moves pair so switching tabs never drags one tab's selection into the
  // other's list.
  noetherStatPreview: string | null;
  noetherStatPage: number;
  // Same convention as noetherMovePreview above, for Landau's and
  // Skłodowska-Curie's own list+detail panels -- each has exactly two fixed
  // moves, so neither needs a page field to go with it.
  landauMovePreview: string | null;
  curieMovePreview: string | null;
  // Which quasiparticle those two panels are currently *previewing* for the
  // open move -- the pick only commits from the pane's own button, so this is
  // browsing state like every other preview field here. Null falls back to the
  // move's own currently-tuned class.
  landauClassPreview: MoveClass | null;
  curieClassPreview: MoveClass | null;
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
// (teleport hub), Dresselhaus (transmutation), Landau (analytic moves),
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
  // The subset of `walkable` the player can actually walk to from the start
  // tile (world/generators/shared.ts's reachableGround). A network-shaped
  // world can carry branches the guardian's chokepoint severed from the
  // route; they are still drawn as ground, but nothing is ever placed on
  // them, since a wild or a pickup there is visible and unreachable forever.
  // Derived from the grid rather than stored in the map snapshot: the grid
  // never changes while a world is being walked, so this is recomputed
  // wherever `walkable` itself is set.
  private routeGround: boolean[][] = [];
  private encounterTiles: (Material | null)[][] = [];
  private tokenTiles: number[][] = [];
  // How many wild crystals this map stood up at generation, which is also the
  // ceiling respawns refill it back toward -- so the Settings station's
  // encounter-density preset sets the world's standing population, not just
  // its opening one.
  private wildTarget = 0;
  // The same standing population for qumatessence. A map refills toward it
  // for as long as the player walks it: farming is intended, so the ceiling
  // is on how much sits out at once, never on how much a map gives in total
  // (DESIGN.md §2's pickup economy).
  private tokenTarget = 0;
  private flowerMap: boolean[][] = [];
  // How big the map currently standing is (data/settings.ts's world-size
  // knob, world/generators/shared.ts's WorldScale). Held per map rather than
  // read from the setting on demand: the pass geometry recomputed here
  // (respawnTiles) has to agree with the geometry the generator used, and a
  // map restored after a settings change was built at the old size.
  private mapScale: WorldScale = worldScale(1);
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
  // Impassable tiles the generator built its shape around; the world's own
  // off-path material draws its named feature at each -- world 5's vortex
  // pits, world 8's local moments (world/generators/shared.ts's
  // `featureCores`).
  private featureCores: GridPoint[] = [];
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
  // This world's forward pass as the drawing code sees it, rebuilt each frame
  // by drawWorld from gateView().
  private gate: GateView | null = null;
  private reachedGoal = false;
  private reachedMiddle = false;
  // Public rather than private: read/written directly by the extracted
  // scenes/panels/*.ts guardian-panel modules (Noether/Landau/Kondo/
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
  // 0 or 1 entries -- this world's rival, standing in the forward pass and
  // barring it for as long as it lives (spawnBossSprite/art/boss.ts's
  // makeBossCrystal). The guard is the whole of what signals a shut gate, so
  // this emptying is what "the way is open" looks like.
  private bossSprites: WorldSprite[] = [];
  // The scenery in this world's two passes: a board naming the destination at
  // each (art/passBoard.ts), except that World 1's backward exit is a door
  // instead (it leads to the Lab, which is not a place) and World 10's
  // forward pass gets no board (nothing lies beyond). The forward board only
  // stands once the rival has fallen; the backward one always does.
  private gateSprites: WorldSprite[] = [];
  private worldGfx!: Phaser.GameObjects.Graphics;
  private player!: Phaser.GameObjects.Container;
  private playerCrystalGfx!: Phaser.GameObjects.Container;
  playerMaterial!: Material;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  // The on-screen walking arrows (scenes/overworld/touchControls.ts), built
  // only when the Settings station's Touch Controls row resolves to on --
  // null on a keyboard machine, where nothing should sit over the world.
  private touchPad: TouchPad | null = null;
  tokenText!: Phaser.GameObjects.Text;
  private goalText!: Phaser.GameObjects.Text;
  // The interact prompt: interface, not scenery. It obeys every text-size
  // preset, sits at a fixed place on screen rather than on a tile, and is
  // what carries the choice -- approach, read, press.
  private gatePrompt!: Phaser.GameObjects.Text;
  // The same offer, made for a guardian the player has already met: its own
  // object rather than a second label on the pass prompt above, so each offer
  // owns its own text, its own hit area and its own visibility.
  private guardianPrompt!: Phaser.GameObjects.Text;
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
  // Landau's/Kondo's/Anderson's own) can outgrow one panel well before
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
  noetherStatPreview: string | null = null;
  noetherStatPage = 0;
  landauMovePreview: string | null = null;
  curieMovePreview: string | null = null;
  landauClassPreview: MoveClass | null = null;
  curieClassPreview: MoveClass | null = null;
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
      quote: 'Every quantum material is a superposition of the worlds it has touched.',
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
      blurb: 'Lets you transmute into a defeated material.',
      avatar: makeDresselhausAvatar,
      tile: 'middle',
      open: (s) => showDresselhausPanel(s),
    },
    4: {
      id: 'landau',
      name: "Landau's Formulas",
      shortName: 'Landau',
      labelColor: '#8fa0ff',
      strokeColor: 0x6a7fff,
      quote:
        'Switch on a field across the plane and every electron orbit closes. The smooth band breaks into flat levels, one fixed quantum of energy apart, with nothing in between. Answer my questions right and I will teach your crystal to strike by that same physics.',
      blurb: 'Sells two quiz-gated Analytic moves.',
      avatar: makeLandauAvatar,
      tile: 'middle',
      open: (s) => showLandauPanel(s),
    },
    5: {
      id: 'majorana',
      name: "Majorana's Fusion",
      shortName: 'Majorana',
      labelColor: '#9fffb0',
      strokeColor: 0x4fd97a,
      quote: 'Split one fermion into two halves, each its own antiparticle, and see what a superconductor can hide at its edge.',
      blurb: 'Fuses two materials into a hybrid state.',
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
      quote: 'Enough disorder and a wave stops spreading. It localizes, trapped by the very randomness around it.',
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
      quote: 'A tensor network and a Feynman diagram draw the same trick two ways: a vertex for every point, a line for every leg.',
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
        'Fire X-rays through a crystal full of defects and the sharp spots blur into rings. Every pore and dislocation leaves its own mark in how the beam scatters. I can teach your crystal to scatter a blow the same way.',
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
        'I lead this circle of guardians, and here is our last lesson. Answer three questions in a row on everything you have learned, and your crystal will strike with a force none of the others can match.',
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
    this.noetherStatPreview = null;
    this.noetherStatPage = 0;
    this.landauMovePreview = null;
    this.curieMovePreview = null;
    this.landauClassPreview = null;
    this.curieClassPreview = null;
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
    // A create() that restores the map it left is the same visit resumed (a
    // battle just fought, the Lab just visited); anything else is a fresh
    // arrival, laying out a new corridor to walk.
    const resuming = saved !== undefined && saved.world === this.world && !this.regenerate;

    // World 9's rival re-rolls every time the player *arrives* in this world
    // (Hub door, Bloch's teleport, a crossed pass, a debug warp -- every path
    // that lands here goes through this same create()): clearing the cached
    // value forces resolveRival9Type()'s first read of the visit to roll
    // fresh. It then stays cached for the rest of that visit, through every
    // battle and Lab round trip, so the goal-tile boss the player walked up
    // to read is the one they end up fighting.
    if (this.world === 9 && !resuming) this.game.registry.remove('rival9Type');

    if (resuming) {
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
    this.spawnGateSprites();
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
    // narrowed to stop short of it, so a long world name (e.g. world 10's
    // "The Devouring Mirror") or a big text-size setting wraps
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
      .text(8, 8, `World ${this.world}: ${name}`, {
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
      .setVisible(false);
    // The way back to the Lab, said and offered in the same object: the hint
    // is itself the button, so a player who cannot press Enter can tap it.
    // With the walking arrows up it says so in the words a touchscreen player
    // is reading it in, and it grows into a target a finger can hit.
    const touchOn = this.touchControlsOn();
    const labHint = this.add
      .text(CANVAS_W - 8, CANVAS_H - 8, touchOn ? 'Tap here for the Lab' : 'Press Enter to go to the Lab', {
        fontSize: fontPx(this, 12),
        color: REFERENCE_BLUE_GREY_HEX,
        backgroundColor: 'rgba(0,0,0,0.35)',
        padding: touchOn ? { x: 12, y: 10 } : { x: 4, y: 2 },
      })
      .setOrigin(1, 1)
      .setDepth(50);
    labHint.setInteractive({ useHandCursor: true });
    labHint.on('pointerdown', () => this.returnToHub());
    // Interface, not scenery: fixed on screen, sized by the text preset, and
    // sitting low and centred where the pass itself is, so the offer reads as
    // attached to what the player is looking at without being painted into
    // the world. It is the only thing that arrives at the threshold -- the
    // board and the guard were always there.
    //
    // Stacked above the Lab hint by measuring it rather than by a fixed
    // offset: both grow with the text-size preset, and at the largest one a
    // guessed gap puts the two plates through each other.
    //
    // With the walking arrows up the prompt keeps out of both bottom corners
    // (it wraps narrower, growing upward instead of sideways), so a long
    // offer can never lie across the arrows a player is holding.
    this.gatePrompt = this.add
      .text(CANVAS_W / 2, labHint.y - labHint.height - 6, '', {
        fontSize: fontPx(this, 14),
        color: '#e6d9ff',
        backgroundColor: 'rgba(0,0,0,0.62)',
        padding: touchOn ? { x: 12, y: 10 } : { x: 8, y: 4 },
        align: 'center',
        wordWrap: { width: touchOn ? CANVAS_W - PAD_KEEPOUT * 2 : CANVAS_W - 60 },
      })
      .setOrigin(0.5, 1)
      .setDepth(50)
      .setVisible(false);
    // Clicking the prompt is identical to pressing the key, and the prompt is
    // interactive exactly while it is on screen -- so the affordance and the
    // hit area are the same object and cannot drift apart.
    this.gatePrompt.on('pointerdown', () => this.confirmGate());

    // Standing with a guardian is offered the same way standing at a pass is,
    // in the same place on screen and in the same words, since it is the same
    // kind of thing: a landmark the player has walked up to, and a keypress
    // that accepts what it offers.
    this.guardianPrompt = this.add
      .text(this.gatePrompt.x, this.gatePrompt.y, '', {
        fontSize: fontPx(this, 14),
        color: '#e6d9ff',
        backgroundColor: 'rgba(0,0,0,0.62)',
        padding: touchOn ? { x: 12, y: 10 } : { x: 8, y: 4 },
        align: 'center',
        wordWrap: { width: touchOn ? CANVAS_W - PAD_KEEPOUT * 2 : CANVAS_W - 60 },
      })
      .setOrigin(0.5, 1)
      .setDepth(50)
      .setVisible(false);
    this.guardianPrompt.on('pointerdown', () => this.talkToGuardian());

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
    // Below the dialogue panels' depth 100: a panel covers the arrows while
    // it is open, and update() hides them outright for as long as it is.
    this.touchPad = touchOn ? createTouchPad(this, 60) : null;
    this.input.keyboard!.on('keydown-ENTER', () => this.returnToHub());
    this.input.keyboard!.on('keydown-SPACE', () => this.confirmAction());

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
    // middle row, so this only actually skips in practice if a future change
    // moves the start closer to it.
    const finishEntry = () => {
      this.maybeAutoOpenMiddleDialogue();
      if (!this.dialogueActive) this.showTutorialTip('controls');
    };
    // World lore is the more "establishing" content when both are due on
    // the same entry, so it plays first and finishEntry (the guardian's
    // auto-dialogue, then the controls tip) only runs once it's dismissed.
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
  // maybeReachGoal (goal), plus the 'controls' call right above this
  // method. `onClose` is whatever the caller was about to do next (open
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
    // With the Settings station's Tutorial Tips row off, the tip is marked on
    // the way past and the popup itself skipped, so the Lab's Tutorial station
    // still lists this topic on the same schedule and holds its text.
    if (!tutorialTipsEnabled(this.game.registry)) {
      onClose?.();
      return;
    }
    this.renderTutorialTipPopup(TUTORIAL_TIPS[id].title, TUTORIAL_TIPS[id].body.split('\n\n'), onClose);
  }

  // A single-topic version of the Lab's Tutorial station (no topic list,
  // just a "Got it" button) -- content laid out top-down first, panel sized/
  // inserted behind it afterward, same pattern as every other panel here.
  // Takes the tip body as a paragraph list and fits it the same way the
  // world-entry lore screen does (ui/text.ts's fitProseToBudget): anything
  // past the canvas continues on a further screen, and a paragraph with no
  // break left to take shrinks instead. `onClose` runs once the last screen
  // is dismissed.
  private renderTutorialTipPopup(title: string, paragraphs: string[], onClose?: () => void) {
    this.dialogueContainer?.destroy(true);
    this.dialogueActive = true;

    const panelWidth = 520;
    const top = 60;
    const bottomMargin = 16;
    const container = this.add.container(0, 0).setDepth(100);
    this.dialogueContainer = container;

    // Capped like the lore screen's and the story beat's own prose -- the
    // Settings panel's 2x "Large" preset otherwise makes a tip several times
    // taller than the fixed CANVAS_H can hold.
    const scale = Math.min(fontScale(this), 1.5);

    let y = top;
    const titleText = this.add
      .text(CANVAS_W / 2, y, title, {
        fontSize: `${Math.round(16 * scale)}px`,
        color: '#ffffff',
        fontStyle: 'bold',
        align: 'center',
        wordWrap: { width: panelWidth - 60 },
      })
      .setOrigin(0.5, 0);
    container.add(titleText);
    y += titleText.height + 12;

    // Built before the body so the fit budget below uses the button's real
    // measured height; its label and handler are filled in once the body
    // knows whether anything is left over. Both labels are single-line at
    // the same size, so setting the text afterwards can't change the height
    // already budgeted against.
    let onContinue = () => {};
    const gotIt = this.addDialogueButtonAt(
      container,
      CANVAS_W / 2,
      0,
      'Got it',
      () => onContinue(),
      140,
      `${Math.round(13 * scale)}px`
    );

    const body = this.add
      .text(CANVAS_W / 2, y, '', {
        fontSize: `${Math.round(12 * scale)}px`,
        color: '#cfd8ff',
        align: 'center',
        wordWrap: { width: panelWidth - 60 },
        lineSpacing: 5,
      })
      .setOrigin(0.5, 0);
    container.add(body);

    const rest = fitProseToBudget(body, paragraphs, CANVAS_H - bottomMargin - (18 + gotIt.height + 14) - y);
    y += body.height + 18;

    gotIt.setY(y);
    if (rest.length) {
      gotIt.setText('Next ->');
      onContinue = () => this.renderTutorialTipPopup(title, rest, onClose);
    } else {
      onContinue = () => {
        this.closeDialogue();
        onClose?.();
      };
    }
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

    // How big this world is, read fresh from the Settings station's knob
    // (like the encounter density below it) and applied to the grid before
    // anything is laid out on it -- the projection's own dimensions, the
    // generator's lengths, and every grid this scene allocates below all
    // have to be the same size as each other.
    this.mapScale = worldScale(worldSizeFactor(this.worldSize()));
    const dims = gridDimsFor(this.mapScale.factor);
    setActiveGridDims(dims.w, dims.h);
    this.playerTile = { x: Math.floor(gridW() / 2), y: gridH() - this.mapScale.tiles(5) };

    const wildPool = getWildPool(this.world);
    // World 10's own shape is dispatched by the player's current material
    // type (world/generators/world10.ts) -- every other world ignores this
    // param.
    const playerType = this.world === 10 ? getPlayerMaterial(this.game.registry).type : undefined;
    const map = generateWorldMap(gridW(), gridH(), this.playerTile, this.world, this.mapScale, playerType);
    this.walkable = map.walkable;
    this.routeGround = reachableGround(map.walkable, gridW(), gridH(), map.start);
    this.tokenTiles = map.tokens;
    this.goalTile = map.goal;
    this.startTile = map.start;
    this.midTile = map.mid;
    this.regionColor = map.regionColor;
    this.biomeOverride = map.biomeOverride;
    this.featureCores = map.featureCores;

    // The backward door (returnToPreviousWorld) lands the player on this
    // freshly generated map's goalTile instead of the corridor's south-edge
    // startTile -- walking in from the far end, already at the reached
    // goal, rather than re-walking the whole corridor. Overriding playerTile
    // here (after generateWorldMap already used the default south-edge
    // point to lay the corridor out) leaves map generation itself untouched.
    // Landing on the pass mouth rather than in the throat itself: the throat
    // is the rival's tile whenever this world's rival still stands, and
    // walking in from the far end must not put the player on the wrong side
    // of a guard they have not beaten.
    if (this.enterFrom === 'goal') {
      this.playerTile = { x: this.goalTile.x, y: this.goalTile.y + 1 };
      this.reachedGoal = true;
    }

    this.encounterTiles = Array.from({ length: gridH() }, () => Array(gridW()).fill(null));
    this.flowerMap = Array.from({ length: gridH() }, () => Array(gridW()).fill(false));
    this.crystalSprites = [];
    this.tokenSprites = [];

    // Ground decoration is scattered over the walkable route itself
    // (terrain/decoration.ts): each world's motif is a property of the
    // ground it teaches with -- orbit rings, spin-wave ripples, cracks --
    // and belongs underfoot. Impassable tiles carry their material's own
    // accent instead (terrain/materials/), so decorating them too would
    // stack two treatments on one fill.
    for (let y = 0; y < gridH(); y++) {
      for (let x = 0; x < gridW(); x++) {
        if (this.walkable[y][x]) {
          this.flowerMap[y][x] = Math.random() < this.biome.decorationChance;
        }
      }
    }

    // One wild encounter roll per corridor row (not per tile) so encounter
    // density stays roughly constant regardless of how wide the corridor
    // is -- placed at a random column within that row's walkable band.
    const encounterChance = this.encounterChance();
    const landmarks = this.landmarkKeys();
    map.rows.forEach((r) => {
      if (r.y === this.playerTile.y) return; // never spawn right on the player
      if (wildPool.length === 0 || Math.random() >= encounterChance) return;
      const x = r.left + Math.floor(Math.random() * (r.right - r.left + 1));
      if (this.tokenTiles[r.y][x]) return;
      if (landmarks.has(`${x},${r.y}`)) return;
      this.encounterTiles[r.y][x] = Phaser.Utils.Array.GetRandom(wildPool);
    });

    // What this map stood up is what respawns refill it back toward -- both
    // read off the actual placements above rather than re-derived, so density
    // and the token scatter's own count each stay the single knob they
    // already are.
    this.wildTarget = this.encounterTiles.reduce((n, row) => n + row.filter(Boolean).length, 0);
    this.tokenTarget = this.tokenTiles.reduce((n, row) => n + row.filter((v) => v > 0).length, 0);

    // Landing via the backward door (enterFrom === 'goal', above) needs this
    // freshly generated layout snapshotted immediately, not just held in
    // memory -- a wild fight fought anywhere in this world (e.g. answering
    // pressing at the pass mouth) round
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

  // The same station's touch-controls knob, resolved through
  // data/settings.ts's touchControlsActive so 'Auto' means "whatever this
  // device is". Read once per scene create: the arrows, the Lab hint's own
  // wording and the pass prompt's width are all built from one answer, so
  // a change made in the Lab lands on the next world entered.
  private touchControlsOn(): boolean {
    return touchControlsActive((this.game.registry.get('touchControls') as TouchControlsMode) ?? DEFAULT_TOUCH_CONTROLS);
  }

  // The same station's world-size knob, read at the same moment and for the
  // same reason: a world is built at whatever size the setting says when it
  // is generated, and keeps that size for as long as it stands.
  private worldSize(): WorldSizeId {
    return (this.game.registry.get('worldSize') as WorldSizeId) ?? DEFAULT_WORLD_SIZE;
  }

  // Round trip through BattleScene resumes here -- restores the exact
  // layout and player position saveMapState() captured right before the
  // battle started, instead of rolling a brand new map.
  private restoreMap(saved: SavedMapState) {
    // The size the saved grid was actually built at, taken from the grid
    // itself rather than from the setting: the player may have changed the
    // world-size knob in the Lab and come back through the door to a world
    // still standing at its old size, and the projection has to draw the map
    // in hand, not the one the setting would generate next.
    setActiveGridDims(saved.walkable[0]?.length ?? gridW(), saved.walkable.length);
    this.mapScale = scaleOfGrid(saved.walkable.length);
    this.playerTile = { ...saved.playerTile };
    this.walkable = saved.walkable;
    this.routeGround = reachableGround(saved.walkable, gridW(), gridH(), saved.startTile);
    this.tokenTiles = saved.tokenTiles;
    this.encounterTiles = saved.encounterTiles;
    this.flowerMap = saved.flowerMap;
    this.goalTile = saved.goalTile;
    this.startTile = saved.startTile;
    this.midTile = saved.midTile;
    this.regionColor = saved.regionColor;
    this.biomeOverride = saved.biomeOverride;
    this.featureCores = saved.featureCores;
    this.reachedGoal = saved.reachedGoal;
    this.reachedMiddle = saved.reachedMiddle;
    this.wildTarget = saved.wildTarget;
    this.tokenTarget = saved.tokenTarget;
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
      featureCores: this.featureCores,
      reachedGoal: this.reachedGoal,
      reachedMiddle: this.reachedMiddle,
      wildTarget: this.wildTarget,
      tokenTarget: this.tokenTarget,
    };
    this.game.registry.set('mapState', saved);
  }

  // Every path back to the Hub (Enter, the World 10 finale, stepping back
  // through World 1's own start door) goes through this rather than calling
  // `scene.start('Hub')` directly -- saveMapState() only fires at specific
  // event tiles (encounter/goal/middle) otherwise, so a player who simply
  // walks around and leaves without hitting one of those would find `mapState`
  // stale or (on a world visited for the first time) entirely absent, and the
  // Hub door's next "resume in place" attempt would silently regenerate a
  // fresh map instead (HubScene.canResumeWorld() checks this same `mapState`
  // key to decide whether its door/Enter-key promise a resume at all).
  // Leaves through closeDialogue() first, the same way advanceToWorld/
  // returnToPreviousWorld do: Enter fires with a guardian panel open, and a
  // panel's move-effect preview chain (art/moveEffectPreview.ts) is keyed on
  // this scene instance, which Phaser reuses across scene.start -- so a chain
  // left registered here would be seen as already running the next time the
  // same panel opens, with its timer long since destroyed by the scene's own
  // shutdown and nothing left to restart it.
  private returnToHub() {
    this.closeDialogue();
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
    this.updateWorldSprites(this.gateSprites);
    this.updateGatePrompt();
    this.updateGuardianPrompt();
    this.updateGoalBanner();
    this.touchPad?.setVisible(!this.dialogueActive);

    if (this.moving || this.dialogueActive) return;

    // The on-screen arrows are read as held state beside the keys, not as
    // events, so holding one walks exactly the way holding an arrow key does
    // and the same `moving` gate paces both.
    const touch = this.touchPad?.held() ?? { dx: 0, dy: 0 };
    let dx = 0;
    let dy = 0;
    if (this.cursors.left.isDown || touch.dx < 0) dx = -1;
    else if (this.cursors.right.isDown || touch.dx > 0) dx = 1;
    else if (this.cursors.up.isDown || touch.dy < 0) dy = -1;
    else if (this.cursors.down.isDown || touch.dy > 0) dy = 1;

    this.tryMove(dx, dy);
  }

  private tryMove(dx: number, dy: number) {
    if (dx === 0 && dy === 0) return;

    const nx = Phaser.Math.Clamp(this.playerTile.x + dx, 0, gridW() - 1);
    const ny = Phaser.Math.Clamp(this.playerTile.y + dy, 0, gridH() - 1);
    if (nx === this.playerTile.x && ny === this.playerTile.y) return;
    if (!this.walkable[ny]?.[nx]) return;
    // The rival physically holds the throat while it lives, so the throat
    // row is not walkable while it does. This is the state signal made
    // literal -- the way is barred by the thing barring it.
    if (ny === this.goalTile.y && !this.isRivalDefeated()) return;

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
        this.refillHidden();
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
        featureCores: this.featureCores,
        flowerMap: this.flowerMap,
        midTile: this.midTile,
        biome: this.biome,
        endsAtCliff: this.endsAtCliff(),
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
      gate: this.gate,
      route: this.getVisitedWorlds(),
      overlook: this.overlookView(),
    };
  }

  // The Devouring Mirror ends at a cliff once The Adapted has fallen: the road
  // does not run on, because there is nothing after this world to run on to,
  // and what the edge looks out over is the Qumatuomi map -- every world at
  // once, seen from above, which is the view the thing the player just beat
  // had of them (WORLDS.md section 4). Null everywhere else, which is every
  // other world and this one while the boss still stands in the way.
  //
  // The lip is the near edge of the goal row, which is the last row the
  // terrain sweep draws: every generator paints its final band there and
  // leaves the rows north of it unwalkable. So the gap the map fills is
  // exactly the gap the ground leaves.
  // The map below is placed off the lip's own depth rather than off the gap it
  // leaves on screen (overworld/sky.ts's drawOverlook), so the country lies at
  // a fixed distance past the edge and the walk out to it is what brings it up.
  // `lane` is the goal column measured from the camera, the same
  // tile-minus-camera lane every ground row is drawn at: it is what keeps the
  // land still against the ground when the player walks along the cliff instead
  // of straight at it.
  private overlookView(): { lipY: number; lipDepth: number; lane: number } | null {
    if (!this.endsAtCliff()) return null;
    const lipDepth = this.camPos.y - this.goalTile.y - 0.5;
    return { lipY: projectTile(0, lipDepth).y, lipDepth, lane: this.goalTile.x - this.camPos.x };
  }

  // Whether this world stops at its far edge rather than running on past it.
  // Deliberately independent of the terrain plan, which asks this question
  // while it is being built.
  private endsAtCliff(): boolean {
    return this.world === FINAL_WORLD && this.isRivalDefeated();
  }

  private drawWorld() {
    this.gate = this.gateView();
    this.hazeBlend = forwardHazeBlend(this.world, this.gate.open, this.camPos.y, this.goalTile.y);
    this.hazeCache.clear();
    drawTerrain(this.terrainView());
  }

  // One Container(+Text) per encounter/token tile, created once and
  // repositioned every frame in updateWorldSprites() -- unlike the ground (a
  // single Graphics mesh cheaply rebuilt from scratch each frame), a crystal
  // is a handful of shaded shapes plus sparkle tweens, too costly to
  // recreate every frame.
  private spawnCrystalSprites() {
    for (let y = 0; y < gridH(); y++) {
      for (let x = 0; x < gridW(); x++) {
        const material = this.encounterTiles[y]?.[x];
        if (material) this.addCrystalSprite(x, y, material);
      }
    }
  }

  // One wild crystal's own sprite. Built hidden: updateWorldSprites decides
  // visibility from the tile's own projected depth on the very next frame, and
  // a sprite added mid-walk (respawnWild) must never be painted before that
  // check has run.
  private addCrystalSprite(x: number, y: number, material: Material) {
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
    container.setDepth(20).setVisible(false);

    const label = this.add
      .text(0, 0, material.name, {
        fontSize: fontPx(this, 11),
        color: '#ffffff',
        backgroundColor: 'rgba(0,0,0,0.45)',
        padding: { x: 3, y: 1 },
      })
      .setOrigin(0.5, 1)
      .setDepth(22)
      .setVisible(false);

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

  // Qumatessence pickups live only at the dead end of branches -- shiny little
  // clouds (see art/tokens.ts), colored by value tier (data/tokens.ts) and
  // labeled with the exact value so the payout reads at a glance before the
  // player walks all the way out there.
  private spawnTokenSprites() {
    for (let y = 0; y < gridH(); y++) {
      for (let x = 0; x < gridW(); x++) {
        const value = this.tokenTiles[y]?.[x];
        if (value) this.addTokenSprite(x, y, value);
      }
    }
  }

  // One pickup's own sprite, built hidden for the same reason a wild
  // crystal's is (addCrystalSprite above).
  private addTokenSprite(x: number, y: number, value: number) {
    const container = makeToken(this, TOKEN_SIZE, tokenColorForValue(value));
    container.setDepth(19).setVisible(false);

    const label = this.add
      .text(0, 0, `+${value}`, {
        fontSize: fontPx(this, 12),
        color: '#ffffff',
        backgroundColor: 'rgba(0,0,0,0.45)',
        padding: { x: 3, y: 1 },
      })
      .setOrigin(0.5, 1)
      .setDepth(22)
      .setVisible(false);

    // A qumatessence cloud hangs over its tile rather than resting on it,
    // so its own centre is what the tile's ground point carries.
    this.tokenSprites.push({ x, y, size: TOKEN_SIZE, foot: 0, container, label, seed: Math.random() * Math.PI * 2 });
  }

  // The world refills its hidden ground, run on every step the player takes.
  // Both kinds fill all the way back to the ceiling the map stood up
  // (`wildTarget`/`tokenTarget`), so ground that has left view is restored
  // toward its normal density rather than stacking each time it is hidden.
  // A refill re-snapshots the map: the grids themselves are shared by
  // reference with `mapState`, but the scalar budgets are not (see
  // SavedMapState).
  // The eligible ground is surveyed once per refill and then consumed, rather
  // than re-surveyed per thing placed: a survey walks the whole grid and
  // measures each open tile's run width and degree, so re-running it for every
  // item turned a refill of n things into n grid walks. That is the shape that
  // spikes exactly when a player has just cleared a stretch and the refill has
  // the most to do -- one long frame in the middle of walking, which is the
  // thing STYLE.md's cost rule forbids. Surveying once makes a refill one walk
  // regardless of how much it restores.
  private refillHidden() {
    if (this.crystalSprites.length >= this.wildTarget && this.tokenSprites.length >= this.tokenTarget) return;
    const open = this.surveyRespawnGround();
    let changed = false;
    while (this.respawnWild(open)) changed = true;
    while (this.respawnToken(open)) changed = true;
    if (changed) this.saveMapState();
  }

  // One walk of the grid: every tile a respawn may land on, each carrying the
  // geometry the two placers ask about, plus the set of rows that already hold
  // an encounter. Shuffled here so a placer can take the first tile that suits
  // it and still be picking uniformly at random, the way both did when each
  // built and sampled its own candidate list.
  private surveyRespawnGround(): RespawnGround {
    const rowsWithEncounter = new Set<number>();
    for (let y = 0; y < gridH(); y++) {
      if (this.encounterTiles[y]?.some(Boolean)) rowsWithEncounter.add(y);
    }
    const tiles = this.respawnTiles().map((p) => ({
      p,
      runWidth: this.walkableRunWidth(p.x, p.y),
      degree: this.walkableDegree(p.x, p.y),
    }));
    Phaser.Utils.Array.Shuffle(tiles);
    return { tiles, rowsWithEncounter };
  }

  // A wild drifts back in, drawn from exactly the pool generation drew from --
  // `getWildPool(this.world)`, so World 10 stays hybrid-only and World 9 stays
  // everything. Capped at the population the map stood up (`wildTarget`),
  // which is what keeps the Settings station's density preset meaningful:
  // respawns replace what was fought, they never outpace the setting.
  private respawnWild(open: RespawnGround): boolean {
    if (this.crystalSprites.length >= this.wildTarget) return false;
    const pool = getWildPool(this.world);
    if (pool.length === 0) return false;
    // One encounter per row at most and never in a run narrower than two
    // tiles, the same two rules generation obeys -- together they are why a
    // wild can never fully block the route (DESIGN.md §2). The row rule reads
    // the survey's own set, which this placer keeps current as it fills.
    const i = open.tiles.findIndex((t) => t.runWidth >= 2 && !open.rowsWithEncounter.has(t.p.y));
    if (i < 0) return false;

    const tile = open.tiles.splice(i, 1)[0].p;
    const material = Phaser.Utils.Array.GetRandom(pool);
    this.encounterTiles[tile.y][tile.x] = material;
    open.rowsWithEncounter.add(tile.y);
    this.addCrystalSprite(tile.x, tile.y, material);
    return true;
  }

  // Qumatessence condenses again, valued by the same per-world tier window as
  // the original scatter (data/tokens.ts). Capped only on the *concurrent*
  // population, exactly as wilds are: a map never carries more pickups at once
  // than it stood up, and over time it gives back without limit, so a player
  // walking it can always find more (DESIGN.md §2's respawn rule).
  private respawnToken(open: RespawnGround): boolean {
    if (this.tokenSprites.length >= this.tokenTarget) return false;
    if (open.tiles.length === 0) return false;

    // The same "reward sits at the end of a detour" preference the generator's
    // own scatter has (world/generators/shared.ts's scatterTokens) -- a dead
    // end first, any open tile only if the survey turned up none.
    const leaf = open.tiles.findIndex((t) => t.degree === 1);
    const tile = open.tiles.splice(leaf >= 0 ? leaf : 0, 1)[0].p;
    const value = pickTokenValue(this.world);
    this.tokenTiles[tile.y][tile.x] = value;
    this.addTokenSprite(tile.x, tile.y, value);
    return true;
  }

  // Every tile a respawn is allowed to land on: outside the drawn world in
  // either direction (past RESPAWN_MIN_ROWS_AHEAD to the north or
  // RESPAWN_MIN_ROWS_BEHIND to the south), on ground the player can actually
  // walk to, empty, outside both passes, and off the three landmark tiles the
  // guardian, the rival and the backward exit stand on. Refilling in both
  // directions is what lets a player walk a corridor back and forth and always
  // find more -- a rule that only reached ahead would leave the walked stretch
  // bare and stop refilling at all once the player neared the north end of a
  // map.
  private respawnTiles(): GridPoint[] {
    const aheadOf = this.playerTile.y - RESPAWN_MIN_ROWS_AHEAD;
    const behind = this.playerTile.y + RESPAWN_MIN_ROWS_BEHIND;
    // A pass is the one place a walkable run is allowed to be narrower than
    // two tiles, and that exception only holds while nothing can stand in it
    // (world/generators/shared.ts's passZoneRows) -- the same suppression the
    // generator applies, recomputed from the three points mapState already
    // carries.
    const passRows = passZoneRows(this.startTile, this.goalTile, this.midTile, this.mapScale);
    const landmarks = this.landmarkKeys();

    const tiles: GridPoint[] = [];
    for (let y = 0; y < gridH(); y++) {
      if (y > aheadOf && y < behind) continue;
      if (passRows.has(y)) continue;
      for (let x = 0; x < gridW(); x++) {
        if (!this.routeGround[y]?.[x]) continue;
        if (this.tokenTiles[y][x] || this.encounterTiles[y][x]) continue;
        if (landmarks.has(`${x},${y}`)) continue;
        tiles.push({ x, y });
      }
    }
    return tiles;
  }

  // The three tiles that read as landmarks rather than ground: the guardian's
  // chokepoint, the rival's throat and the backward exit. Nothing is ever
  // placed on one of them, at generation or on a respawn, so the thing
  // standing there is the only thing standing there.
  private landmarkKeys(): Set<string> {
    return new Set([this.startTile, this.goalTile, this.midTile].map((p) => `${p.x},${p.y}`));
  }

  // Width of the contiguous walkable run this tile sits in, along its own row.
  private walkableRunWidth(x: number, y: number): number {
    let left = x;
    while (left > 0 && this.walkable[y][left - 1]) left--;
    let right = x;
    while (right < gridW() - 1 && this.walkable[y][right + 1]) right++;
    return right - left + 1;
  }

  // How many walkable neighbours a tile has; 1 marks the tip of a dead-end
  // spur, which is where a pickup belongs.
  private walkableDegree(x: number, y: number): number {
    return [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ].filter(([dx, dy]) => this.walkable[y + dy]?.[x + dx]).length;
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

  // This world's rival (getWorldRival), standing in the throat of the forward
  // pass and physically barring it (no world has a WORLD_RIVALS gap, so this
  // always finds one for a built world). Every rival is its world's physics
  // made incorruptible, so holding the boundary is its job rather than a
  // staging choice, and a body in the way is a plainer statement of "shut"
  // than any weather drawn over the gap. Walking up to it triggers nothing on
  // its own -- the fight starts on the confirm keypress the approach prompt
  // offers (confirmGate). Stops rendering once the rival is beaten, which is
  // the whole of what "the way is open" looks like.
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
      // It stands in the pass on its own two feet -- see `still`. What
      // makes it read as alive rather than as scenery is its own idle rig
      // (art/boss.ts), which breathes and shifts its weight without ever
      // lifting off the tile.
      still: true,
    });
  }

  // The scenery standing in this world's two passes. Both are always there,
  // depth-scaled and unreadably small from far off; what arrives as the
  // player walks up is *interactivity* (the HUD prompt), never the object.
  //
  // The backward pass carries a board from the moment the player arrives,
  // since the way back is open from then on and carries no state. The
  // forward pass carries one only once its guard has fallen -- while the
  // rival stands there, there is nothing to name, because nothing of the
  // next world is visible past it.
  //
  // Two exceptions, both ontology rather than convenience: World 1's
  // backward exit names no world, because it leads to the Lab and the Lab is
  // not a place; and World 10's forward pass gets no board, because the
  // grammar means "another world lies beyond" and the finale's meaning is
  // that there is not one.
  //
  // World 1's exit carries no landmark of its own at all. Nothing in this
  // game hovers over the ground except a crystal, which is what a crystal
  // *is* -- so an archway floating at the world's edge read as a misplaced
  // creature rather than as a way out. The prompt the approach raises is what
  // says the Lab is back there, and the exit's geography already says the
  // rest: it is the one boundary in the game that never narrows into a pass.
  private spawnGateSprites() {
    this.gateSprites = [];

    // Drawn one row north of startTile itself (still walkable -- the start
    // mouth's own throat row is centred on startTile.x, world/generators/
    // shared.ts's openStartMouth), not on top of it. The camera looks forward
    // from just behind the player, so anything sitting exactly on startTile
    // would only ever be visible stacked under the player's own crystal.
    if (this.world > 1) {
      this.gateSprites.push(this.makeBoardSprite(this.startTile.x, this.startTile.y - 1, worldName(this.world - 1)));
    }

    if (!this.isRivalDefeated()) return;
    if (this.world >= FINAL_WORLD) return;
    // Beside the throat rather than in it, so the board captions the opening
    // instead of standing in the gap the player is about to walk through.
    // Whichever flank the grid actually has room for.
    const right = this.goalTile.x + PASS_HALF_WIDTH + 1;
    const boardX = right < gridW() ? right : this.goalTile.x - PASS_HALF_WIDTH - 1;
    this.gateSprites.push(this.makeBoardSprite(boardX, this.goalTile.y + 1, worldName(this.world + 1)));
  }

  private makeBoardSprite(x: number, y: number, destination: string): WorldSprite {
    return {
      x,
      y,
      size: BOARD_SPRITE_SIZE * 1.9,
      foot: BOARD_SPRITE_SIZE * BOARD_FOOT,
      container: makePassBoard(this, BOARD_SPRITE_SIZE, destination),
      seed: Math.random() * Math.PI * 2,
      still: true,
    };
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
      const wanderLane = c.still ? 0 : Math.sin(t * 0.0012 + c.seed) * 0.18;
      const wanderDepth = c.still ? 0 : Math.cos(t * 0.0009 + c.seed * 1.7) * 0.12;

      const lane = c.x - camX + wanderLane;
      const depth = camY - c.y + wanderDepth;
      const laneL = lane - 0.5;
      const laneR = lane + 0.5;

      // How far off-center this sprite may stand and still be on screen,
      // which depends on how far away it is: the projection narrows a
      // tile-width toward the vanishing point, so ground that runs off the
      // frame edge up close is well inside it further out. The ground itself
      // is already painted to that same widening bound (laneClipAt), and a
      // wide world -- Macro's corridors run three times the width of Meso's
      // -- puts real walkable ground, and the crystals standing on it, out
      // past a fixed lane window that a narrow corridor never reached.
      const laneClip = Math.max(LANE_CLIP, laneClipAt(depth));
      const visible =
        depth + CAMERA_BACK_TILES > 0.15 &&
        laneL <= laneClip &&
        laneR >= -laneClip &&
        depth / DRAW_DISTANCE_TILES < VISIBLE_DEPTH_FRACTION;
      c.container.setVisible(visible);
      c.label?.setVisible(visible);
      if (!visible) continue;

      // `p` is the sprite's tile centre on the ground plane, so the art is
      // lifted by its own ground-contact offset to stand on that point rather
      // than being centred over it.
      const p = projectTile(lane, depth);
      const bob = c.still ? 0 : Math.sin(t * 0.004 + c.seed * 2.3) * 3 * p.scale;
      const originY = p.y - c.foot * p.scale + bob;

      c.container.setPosition(p.x, originY);
      c.container.setScale(p.scale);
      // Every actor standing on the map sorts by its own projected depth, so
      // whatever is nearer the camera is drawn over whatever is further --
      // the rival in a pass among the boards and crystals around it included,
      // rather than any one of them being a fixed-depth special case. Sits
      // under the player (40) and well under any dialogue (100).
      c.container.setDepth(30 - depth);
      c.label?.setDepth(30 - depth + 0.5);
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

  // In-map dialogue for a wild encounter: the greeting and (for materials
  // with a quiz entry) the physics question, or straight to a fight/pass
  // choice if there's no question yet. Deliberately an overlay inside this
  // scene rather than a separate scene -- asking a question shouldn't feel
  // like leaving the map.
  //
  // The question and the shuffled answer order are drawn once here rather
  // than inside the page renderer, so paging back and forth re-shows the
  // same question with the answers in the same places instead of rerolling
  // both on every arrow press.
  private showEncounter(material: Material) {
    const question = getWorldQuestion(this.world, material.name);
    const options = question
      ? Phaser.Utils.Array.Shuffle([
          { text: question.correct, correct: true },
          { text: question.incorrect, correct: false },
        ])
      : undefined;
    this.renderEncounterPage(material, question, options, 0);
  }

  // One page of the wild-encounter panel.
  //
  // Content is laid out top-down first (running `y`, each element's own
  // height advancing it) and the panel sized/inserted behind it afterward --
  // the same pattern as showSettingsPanel/renderTutorialPage, needed here
  // because this is the single most-seen dialogue in the game and both the
  // greeting and the physics question vary in length per material.
  //
  // At the larger text-size presets a long question and two long answers
  // together outgrow the canvas, so the panel splits across pages joined by
  // the same '<- Prev'/'Next ->' row every paginated list in the game uses
  // (renderPagedButtons). Three layouts are measured in order and the first
  // one whose every page fits the canvas wins, so a short encounter keeps
  // the single uninterrupted screen and only a long one pays for the split:
  //
  //   'single'    everything on one page, no arrows -- what almost every
  //               encounter at the default text size gets.
  //   'split'     page 1 greets and asks; page 2 repeats the question above
  //               the answers, so the question is still on screen while the
  //               player picks.
  //   'splitBare' as 'split', but page 2 carries the answers alone -- the
  //               fallback for a question so long it cannot share a page
  //               with them at all, one arrow press away from being re-read.
  //
  // Measuring passes build the same layout minus the crystal art, which is
  // expensive to build and contributes a fixed offset rather than a measured
  // height; only the page actually shown builds it.
  private renderEncounterPage(
    material: Material,
    question: MaterialQuestion | undefined,
    options: { text: string; correct: boolean }[] | undefined,
    page: number
  ) {
    this.dialogueContainer?.destroy(true);
    this.dialogueActive = true;

    const panelWidth = 600;
    const contentWidth = panelWidth - 60;
    const top = 20;
    const crystalY = top + 34;

    type Layout = 'single' | 'split' | 'splitBare';

    const build = (layout: Layout, shownPage: number, withCrystal: boolean) => {
      const container = this.add.container(0, 0).setDepth(100);
      const split = layout !== 'single';
      // Page 1 of a split panel greets and asks; page 2 answers. An unsplit
      // panel does both at once.
      const showGreeting = !split || shownPage === 0;
      const showPrompt = !!question && (!split || shownPage === 0 || layout === 'split');
      const showChoices = !split || shownPage === 1;

      let y = top;
      if (showGreeting) {
        if (withCrystal) {
          const crystal = makeCrystal(this, 30, material.color, material.variant, {
            seed: material.name,
            hybrid: material.hybridParents,
          });
          crystal.setPosition(CANVAS_W / 2, crystalY);
          container.add(crystal);
          this.tweens.add({ targets: crystal, y: crystalY + 8, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        }
        y = crystalY + 40;

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
      }

      if (question && showPrompt) {
        const prompt = makeQuestionText(this, CANVAS_W / 2, y, question.prompt, {
          fontSizePx: 13 * fontScale(this),
          color: GOLD_ACCENT_HEX,
          wrapWidth: contentWidth,
        });
        container.add(prompt);
        y += prompt.height + 14;
      }

      if (showChoices) {
        if (question && options) {
          const btn1 = this.addQuestionButton(container, y, options[0].text, () =>
            this.startBattle(material, options[0].correct ? QUIZ_CORRECT_MULTIPLIER : QUIZ_WRONG_MULTIPLIER)
          );
          y += btn1.height + 8;
          const btn2 = this.addQuestionButton(container, y, options[1].text, () =>
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
      }

      if (split) {
        y += 8;
        // Same shared Prev/Next-and-page-label row renderPagedButtons uses,
        // so a paged encounter reads like every other paged panel.
        const prev = this.addDialogueButtonAt(
          container,
          CANVAS_W / 2 - 170,
          y,
          '<- Prev',
          () => {
            if (shownPage > 0) this.renderEncounterPage(material, question, options, shownPage - 1);
          },
          120
        );
        if (shownPage === 0) prev.setAlpha(0.35);
        const next = this.addDialogueButtonAt(
          container,
          CANVAS_W / 2 + 170,
          y,
          'Next ->',
          () => {
            if (shownPage < 1) this.renderEncounterPage(material, question, options, shownPage + 1);
          },
          120
        );
        if (shownPage === 1) next.setAlpha(0.35);
        const controlsRowH = Math.max(prev.height, next.height);
        const pageLabel = this.add
          .text(CANVAS_W / 2, y, `Page ${shownPage + 1}/2`, { fontSize: fontPx(this, 11), color: REFERENCE_BLUE_GREY_HEX })
          .setOrigin(0.5, 0);
        pageLabel.setY(y + (controlsRowH - pageLabel.height) / 2);
        container.add(pageLabel);
        y += controlsRowH;
      }

      y += top;
      const panelHeight = y - top;
      const panel = this.add
        .rectangle(CANVAS_W / 2, top + panelHeight / 2, panelWidth, panelHeight, PANEL_BG, 0.94)
        .setStrokeStyle(2, 0x444466);
      container.addAt(panel, 0);
      return { container, bottom: top + panelHeight };
    };

    // First layout whose every page fits the canvas. 'splitBare' is the
    // floor rather than another candidate to fall past, since its page 2
    // carries nothing but the answer buttons.
    const fits = (layout: Layout) => {
      const pages = layout === 'single' ? [0] : [0, 1];
      const built = pages.map((p) => build(layout, p, false));
      const ok = built.every((b) => b.bottom <= CANVAS_H);
      built.forEach((b) => b.container.destroy(true));
      return ok;
    };
    const layout: Layout = (['single', 'split'] as Layout[]).find(fits) ?? 'splitBare';
    const shownPage = layout === 'single' ? 0 : Phaser.Math.Clamp(page, 0, 1);

    this.dialogueContainer = build(layout, shownPage, true).container;
  }

  addDialogueButton(container: Phaser.GameObjects.Container, y: number, label: string, onClick: () => void) {
    return this.addDialogueButtonAt(container, CANVAS_W / 2, y, label, onClick, 480);
  }

  // A quiz answer, which unlike every other dialogue button may carry a
  // formula in its label (ui/mathtext.ts) and then needs a drawn plate and
  // an explicit hit area instead of a text background. Answers with no
  // formula in them stay ordinary dialogue buttons.
  addQuestionButton(container: Phaser.GameObjects.Container, y: number, label: string, onClick: () => void) {
    if (!hasMath(label)) return this.addDialogueButton(container, y, label, onClick);
    const btn = makeFormulaButton(
      this,
      CANVAS_W / 2,
      y,
      label,
      {
        fontSizePx: 13 * fontScale(this),
        color: '#ffff88',
        wrapWidth: 480,
        backgroundColor: 0x222244,
        padX: 10,
        padY: 5,
      },
      onClick
    );
    container.add(btn);
    return btn;
  }

  // Underlies addDialogueButton -- broken out so a footer row can place two
  // buttons side by side (a guardian panel's "Farewell" / "Not yet")
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

  // Where the fight is happening, sampled off the terrain plan the corridor
  // is already drawn from. Every battle is entered through startBattle below,
  // rivals included, so this is the one place the arena is told its location.
  private battleLocale(): BattleLocale {
    return sampleBattleLocale(this.terrainPlan(), this.playerTile);
  }

  // Every battle leaves the scene, and create() resumes from the map
  // snapshot, so every battle snapshots first -- here, at the one door all
  // of them go through. Without it a fight resumes at whatever position was
  // last written for some other reason (a respawn refill, an earlier
  // encounter), which for a rival fight means walking to the pass, winning
  // it, and being put back wherever the player happened to be standing the
  // last time the world refilled itself -- most visibly at the guardian.
  private startBattle(material: Material, attackMultiplier: number, isRival = false) {
    this.showTutorialTip('battle', () => {
      this.closeDialogue();
      this.saveMapState();
      this.scene.start('Battle', {
        wild: material,
        world: this.world,
        attackMultiplier,
        isRival,
        locale: this.battleLocale(),
      });
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
    this.noetherStatPreview = null;
    this.noetherStatPage = 0;
    this.landauMovePreview = null;
    this.curieMovePreview = null;
    this.landauClassPreview = null;
    this.curieClassPreview = null;
    this.kondoMovePreview = null;
    this.kondoMovePage = 0;
    this.blochPreview = null;
  }

  private isRivalDefeated(): boolean {
    const rivalDefeated = (this.game.registry.get('rivalDefeated') as Record<number, boolean>) ?? {};
    return !!rivalDefeated[this.world];
  }

  // This world's forward pass, as everything that draws it needs to see it
  // (sky.ts's GateView): where the throat sits, how wide it is, whether its
  // guard has fallen and what lies beyond. One record, so the aperture in the
  // horizon, the ground seam and the repeated road cannot disagree about
  // whether the way is open.
  private gateView(): GateView {
    const open = this.isRivalDefeated();
    return {
      row: this.goalTile.y,
      lane: this.goalTile.x - this.camPos.x,
      halfTiles: PASS_HALF_WIDTH + 0.5,
      open,
      next: open ? BIOMES[this.world + 1] ?? null : null,
    };
  }

  // Whether the player is standing where a pass is taken, which is where its
  // prompt shows and its keypress commits. The forward pass counts from its
  // mouth -- one tile south of the throat, close enough that the pass fills
  // the frame -- and from the throat row itself, which is walkable ground the
  // moment the rival holding it falls. Both, not just the mouth: the offer to
  // cross has to survive the player walking the last step into the gap they
  // are being offered, or stepping forward takes the way onward off the
  // screen. The backward pass is a single tile, the one the player arrived on.
  private gateAtPlayer(): 'forward' | 'backward' | null {
    const { x, y } = this.playerTile;
    if ((y === this.goalTile.y || y === this.goalTile.y + 1) && Math.abs(x - this.goalTile.x) <= PASS_HALF_WIDTH) return 'forward';
    if (y === this.startTile.y && x === this.startTile.x) return 'backward';
    return null;
  }

  // The prompt: shown a tile out from either pass, hidden everywhere else and
  // while anything else owns the screen. Arrival alone never transitions or
  // starts a fight -- a pass is the most interesting object in a world and
  // players walk into it to look -- so what a step into range buys is the
  // offer, and the keypress is what accepts it.
  private updateGatePrompt() {
    const gate = this.dialogueActive || this.moving ? null : this.gateAtPlayer();
    if (!gate) {
      if (this.gatePrompt.visible) this.gatePrompt.setVisible(false).disableInteractive();
      return;
    }
    this.gatePrompt.setText(this.gatePromptLabel(gate)).setVisible(true).setInteractive({ useHandCursor: true });
  }

  // The prompt names the input the player actually has: the key when there is
  // a keyboard, the tap on the prompt itself when the walking arrows are up.
  // Either one reaches confirmGate, so only the wording changes.
  private gatePromptLabel(gate: 'forward' | 'backward'): string {
    const press = this.touchPad ? 'Tap here' : 'Press Space';
    if (gate === 'backward') return `${press} to go back to ${this.world === 1 ? 'the Lab' : worldName(this.world - 1)}`;
    if (!this.isRivalDefeated()) return `${press} to challenge ${this.getWorldRival()?.name ?? 'the rival'}`;
    if (this.world >= FINAL_WORLD) return `${press} to look out over the worlds`;
    return `${press} to cross into ${worldName(this.world + 1)}`;
  }

  // This world's guardian when the player is standing with them: on the
  // guardian's own tile or on any of the eight around it, close enough that
  // the avatar and the player are plainly together on screen. Only after they
  // have been met -- the first meeting is the walk onto their row
  // (maybeReachMiddle/maybeAutoOpenMiddleDialogue), which is the introduction,
  // and this is the way back to someone already introduced.
  private guardianAtPlayer(): GuardianDef | null {
    const guardian = OverworldScene.WORLD_GUARDIANS[this.world];
    if (!guardian) return null;
    const met = (this.game.registry.get('metGuardians') as string[]) ?? [];
    if (!met.includes(guardian.id)) return null;
    const tile = guardian.tile === 'start' ? this.startTile : guardian.tile === 'middle' ? this.midTile : this.goalTile;
    if (!tile) return null;
    return Math.abs(this.playerTile.x - tile.x) <= 1 && Math.abs(this.playerTile.y - tile.y) <= 1 ? guardian : null;
  }

  // Same rule the pass prompt follows: shown while the player is standing
  // where the offer can be accepted, hidden while anything else owns the
  // screen. A pass offer wins if both are somehow live at once, so the two
  // plates can never stack in the one spot they share.
  private updateGuardianPrompt() {
    const guardian = this.dialogueActive || this.moving || this.gateAtPlayer() ? null : this.guardianAtPlayer();
    if (!guardian) {
      if (this.guardianPrompt.visible) this.guardianPrompt.setVisible(false).disableInteractive();
      return;
    }
    const press = this.touchPad ? 'Tap here' : 'Press Space';
    this.guardianPrompt
      .setText(`${press} to talk with ${guardian.name}`)
      .setVisible(true)
      .setInteractive({ useHandCursor: true });
  }

  // Opening a met guardian's own panel from the world, the deliberate way in
  // beside the automatic one that fires on first reaching their row.
  private talkToGuardian() {
    if (this.dialogueActive || this.moving) return;
    const guardian = this.guardianAtPlayer();
    if (!guardian) return;
    this.guardianPrompt.setVisible(false).disableInteractive();
    this.openGuardian(guardian);
  }

  // What Space does, which depends on what the player is standing with: a
  // pass is the more consequential of the two, so it is offered first.
  private confirmAction() {
    if (this.dialogueActive || this.moving) return;
    if (this.gateAtPlayer()) {
      this.confirmGate();
      return;
    }
    this.talkToGuardian();
  }

  // The keypress at a pass, which is the whole of the commitment. Challenging
  // in the shut state, crossing in the open one -- the confirmation the
  // retired gate panels carried, relocated into the prompt rather than
  // removed.
  private confirmGate() {
    if (this.dialogueActive || this.moving) return;
    const gate = this.gateAtPlayer();
    if (!gate) return;
    this.gatePrompt.setVisible(false).disableInteractive();

    if (gate === 'backward') {
      this.returnToPreviousWorld();
      return;
    }
    if (!this.isRivalDefeated()) {
      this.showRivalEncounter();
      return;
    }
    if (this.world >= FINAL_WORLD) {
      this.showFinalePanel();
      return;
    }
    this.crossPass();
  }

  // Crossing, with the story beat riding the transition rather than standing
  // beside it: the screen fades to the connective lavender first, and
  // STORY_BEATS is read over that fade. It is the semantic descendant of the
  // click that used to carry it, and playing it over the fade is what stops
  // it stacking against the board and the horizon reveal the player is in the
  // middle of looking at.
  private crossPass() {
    const fade = this.add
      .rectangle(CANVAS_W / 2, CANVAS_H / 2, CANVAS_W, CANVAS_H, PANEL_BG, 0)
      .setDepth(90);
    this.dialogueActive = true;
    this.tweens.add({
      targets: fade,
      fillAlpha: 0.92,
      duration: 420,
      ease: 'Sine.easeIn',
      onComplete: () => {
        this.dialogueActive = false;
        this.showStoryBeat(this.world);
      },
    });
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
    // Story Screens off: mark the lore read and hand straight back, so the
    // Lab's Story station unmasks this world's two chapters exactly as it
    // would have and keeps the text the player chose not to be stopped by.
    if (!storyScreensEnabled(this.game.registry)) {
      markWorldLoreSeen(this.game.registry, this.world);
      persistFromRegistry(this.game.registry);
      onDone();
      return;
    }
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

    const text = this.add
      .text(CANVAS_W / 2, y, '', {
        fontSize: `${Math.round(11 * scale)}px`,
        color: '#e6d9ff',
        align: 'center',
        wordWrap: { width: panelWidth - 60 },
        lineSpacing: 3,
      })
      .setOrigin(0.5, 0);
    container.add(text);

    const rest = fitProseToBudget(text, paragraphs, CANVAS_H - bottomMargin - (12 + btn.height + 12) - y);
    y += text.height + 12;

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
  // so a missing beat is never a dead end, and the same way when the Settings
  // station's Story Screens row is off.
  private showStoryBeat(completedWorld: number) {
    const line = STORY_BEATS[completedWorld];
    if (!line || !storyScreensEnabled(this.game.registry)) {
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
  // rather than a dead crossing into a world that doesn't exist. Pays off World 10's reveal (WORLD_LORE[10].page2):
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
      .text(CANVAS_W / 2, y, FINALE_TITLE, {
        fontSize: `${Math.round(16 * scale)}px`,
        color: GOLD_ACCENT_HEX,
        fontStyle: 'bold',
        align: 'center',
        wordWrap: { width: panelWidth - 80 },
      })
      .setOrigin(0.5, 0);
    container.add(title);
    y += title.height + 16;

    // Thanks line and button are built before the body so the fit budget
    // below can use their real measured heights (same pattern as
    // renderWorldLorePage); both are positioned once the body's fitted
    // height is known.
    const thanks = this.add
      .text(CANVAS_W / 2, 0, 'Thanks for playing.', {
        fontSize: `${Math.round(12 * scale)}px`,
        color: REFERENCE_BLUE_GREY_HEX,
        align: 'center',
      })
      .setOrigin(0.5, 0);
    container.add(thanks);

    const button = this.addDialogueButtonAt(
      container,
      CANVAS_W / 2,
      0,
      'Return to the Lab',
      () => {
        this.closeDialogue();
        this.returnToHub();
      },
      260,
      `${Math.round(13 * scale)}px`
    );

    const body = this.add
      .text(
        CANVAS_W / 2,
        y,
        '',
        { fontSize: `${Math.round(13 * scale)}px`, color: '#cfd8ff', align: 'center', wordWrap: { width: 480 } }
      )
      .setOrigin(0.5, 0);
    container.add(body);
    // Shrink-only fit (the whole body as one paragraph, nowhere to continue
    // to): an ending screen pages to nothing, so the closing text gives up
    // font size rather than splitting, and the panel always ends on the
    // canvas at every FONT_SCALE_PRESETS setting.
    fitProseToBudget(body, [FINALE_BODY], CANVAS_H - y - (16 + thanks.height + 20 + button.height + top));
    y += body.height + 16;

    thanks.setY(y);
    y += thanks.height + 20;

    button.setY(y);
    y += button.height + top;

    const panelHeight = y - top;
    const panel = this.add
      .rectangle(CANVAS_W / 2, top + panelHeight / 2, panelWidth, panelHeight, PANEL_BG, 0.96)
      .setStrokeStyle(2, GOLD_ACCENT);
    container.addAt(panel, 0);
  }

  // The "beat the world's rival crystal" gate DESIGN.md's world table lists
  // per world -- triggered by the confirm keypress at the pass mouth rather
  // than automatically on reaching it, so the player can prepare with the
  // mid-corridor guardian first. Same in-map dialogue pattern as a wild encounter,
  // but with no "let me pass" option, since a gate that can be skipped
  // isn't a gate.
  private showRivalEncounter() {
    const rival = this.getWorldRival();
    // Safety net for a world with no WORLD_RIVALS entry yet -- no world has
    // one, but a gate that cannot open would strand the player behind it.
    if (!rival) return;

    // RIVAL_TAUNTS (data/worldLore.ts) gives most worlds a two-part taunt --
    // a narration+dialogue line, then a second that raises the stakes --
    // chained as two pages the same destroy-and-rebuild way showWorldLore
    // chains its own two pages above. A world with no entry yet (a future/
    // unbuilt world) falls back to the old single generic line so it's
    // never a dead end.
    // Story Screens off: straight into the fight. The taunt pages carry only
    // forward buttons, so they are pacing rather than a confirmation step, and
    // the story log unmasks this world's chapter on the win itself.
    if (!storyScreensEnabled(this.game.registry)) {
      this.startBattle(rival, 1, true);
      return;
    }

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

    const scale = Math.min(fontScale(this), 1.5);

    // Everything on this page is measured before anything is placed, because
    // the button is the one element that must never leave the canvas: this
    // dialogue is the only way into a rival fight, so a button pushed past
    // CANVAS_H doesn't just look wrong, it strands the player at the pass
    // with no way onward. The order is button, then taunt, then the golem
    // last with whatever height the other two didn't need -- the reverse of
    // the reading order, and deliberately so, since the golem is the only
    // one of the three that can give ground without costing the player
    // anything.
    //
    // fontSizePxOverride matches the taunt's own cap below; addDialogueButton
    // has no override parameter, so this goes through addDialogueButtonAt.
    const btn = this.addDialogueButtonAt(
      container,
      CANVAS_W / 2,
      0,
      buttonLabel,
      onButton,
      480,
      `${Math.round(13 * scale)}px`
    );

    // The taunt shrinks only against the budget left once the golem is at its
    // smallest, so a long taunt (worlds 9/10) costs reading size only after
    // the golem has already given up everything it can.
    const text = this.add
      .text(CANVAS_W / 2, 0, line, {
        fontSize: `${Math.round(12 * scale)}px`,
        fontStyle: 'italic',
        color: '#ffb3b3',
        align: 'center',
        wordWrap: { width: panelWidth - 80 },
      })
      .setOrigin(0.5, 0);
    container.add(text);
    const chrome = top + HEAD_ROOM + CRYSTAL_TO_TEXT + TEXT_TO_BUTTON + btn.height + BELOW_BUTTON + BOTTOM_MARGIN;
    // A single-element list: this page has nowhere to continue to, so
    // fitProseToBudget shrinks rather than paginating (ui/text.ts).
    fitProseToBudget(text, [line], CANVAS_H - chrome - MIN_BOSS_SIZE * BOSS_SILHOUETTE_HEIGHT);

    // Same makeBossCrystal golem spawnBossSprite renders standing at the goal
    // tile (and BattleScene renders as the opponent once the fight starts) --
    // the rival shouldn't revert to an ordinary plain-crystal look just
    // because this pre-fight taunt dialogue is up. Redrawn on every page
    // (rather than kept across the destroy-and-rebuild) so it's on screen
    // for both parts of the taunt, not just the first.
    //
    // Its size is what the page has left rather than the fixed
    // BOSS_CRYSTAL_SIZE, which is sized for the pass aperture out in the
    // world (see its own definition) and is far taller than a dialogue panel
    // sharing the canvas with prose and a button can afford. A short taunt at
    // a small text preset leaves enough room that the clamp lands back on the
    // full BOSS_CRYSTAL_SIZE, so the common case is the golem at full height.
    const crystalSize = Phaser.Math.Clamp(
      (CANVAS_H - chrome - text.height) / BOSS_SILHOUETTE_HEIGHT,
      MIN_BOSS_SIZE,
      BOSS_CRYSTAL_SIZE
    );

    let y = top;
    // The golem's silhouette is taller than it is wide and asymmetric about
    // its own center (art/boss.ts's BOSS_SILHOUETTE_TOP/BOTTOM), so both the
    // headroom above it and the gap to the taunt text below come off those
    // two extents rather than a bare size -- the head clears the panel's top
    // border, and the contact shadow under its feet clears the first line of
    // text.
    const crystalY = y + crystalSize * BOSS_SILHOUETTE_TOP + HEAD_ROOM;
    const crystal = makeBossCrystal(this, crystalSize, rival.color, rival.variant);
    crystal.setPosition(CANVAS_W / 2, crystalY);
    container.add(crystal);
    y = crystalY + crystalSize * BOSS_SILHOUETTE_BOTTOM + CRYSTAL_TO_TEXT;

    text.setY(y);
    y += text.height + TEXT_TO_BUTTON;

    btn.setY(y);
    y += btn.height;
    y += BELOW_BUTTON;

    const panelHeight = y - top;
    const panel = this.add
      .rectangle(CANVAS_W / 2, top + panelHeight / 2, panelWidth, panelHeight, PANEL_BG, 0.94)
      .setStrokeStyle(2, 0xff6666);
    container.addAt(panel, 0);
  }

  // A guardian panel only ever needs a way to close. Leaving a world is a
  // thing the player walks to and presses at (confirmGate), never a button
  // inside a shop, so no guardian's panel carries one.
  renderFarewellFooter(container: Phaser.GameObjects.Container, footerY: number): number {
    const btn = this.addDialogueButtonAt(container, CANVAS_W / 2, footerY, 'Farewell', () => this.closeDialogue(), 260);
    return footerY + btn.height;
  }

  // Two-button variant for a guardian panel with a pending two-step pick
  // (Majorana's first-crystal choice, Anderson's dope-in choice) --
  // `cancelLabel`'s handler backs out of just the pending pick, Farewell
  // backs out of the whole panel, side by side in one row rather than
  // stacking two
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

  // Backward counterpart to crossPass/advanceToWorld -- World 1's backward
  // exit leads to the Lab (there is no World 0 overworld map to land on),
  // every other world's to World N-1, landing the player at that world's own
  // goalTile with reachedGoal already true (advanceToWorld's `enterFrom:
  // 'goal'`) rather than its startTile, so stepping back reads as walking in
  // from the far end, not re-walking the whole corridor. No confirm panel:
  // the keypress at the pass mouth is itself the confirmation, and arriving
  // at the mouth alone does nothing.
  private returnToPreviousWorld() {
    this.closeDialogue();
    if (this.world === 1) {
      this.returnToHub();
      return;
    }
    this.advanceToWorld(this.world - 1, 'goal');
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
  // in renderFarewellFooter -- every guardian stands mid-corridor, and
  // leaving the world is something the player walks the rest of the way to
  // the pass and presses at.
  // Content laid out top-down first (running `y`), panel sized/inserted
  // behind everything afterward -- same pattern as showSettingsPanel.
  private showGuardianLore(guardian: GuardianDef) {
    this.dialogueActive = true;

    const panelWidth = 600;
    const top = 20;
    const container = this.add.container(0, 0).setDepth(100);
    this.dialogueContainer = container;

    let y = top;

    y = renderGuardianHeader(this, container, {
      y,
      panelWidth,
      avatar: guardian.avatar,
      quote: `"${guardian.quote}"`,
      introPx: fontPx(this, 11),
    });

    const note = this.add
      .text(CANVAS_W / 2, y, `${guardian.name} has nothing to teach you yet. More to come.`, {
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

  // The middle row every guardian now
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

  // The goal event fires at the pass mouth, the row the throat is entered
  // from, rather than on the throat row itself: the throat is where the
  // rival stands, so while the gate is shut the throat row cannot be walked
  // onto at all, and a goal event waiting there would never fire. Reaching
  // the mouth anywhere along its row counts -- it is a whole row, and the
  // corridor is still wide there.
  private maybeReachGoal(_x: number, y: number) {
    if (this.reachedGoal || y > this.goalTile.y + 1) return;
    this.reachedGoal = true;
    this.saveMapState();
    this.showTutorialTip('goal');
  }

  // The far-edge line belongs to the far edge. It is a caption on a place, so
  // it is shown while the player is standing in that place and not otherwise
  // -- driven by where they are rather than latched on by `reachedGoal`, which
  // is a fact about progress and stays true for the rest of the run. Latching
  // it left the line sitting over the whole world once reached, and over a
  // finished world from the first step back into it.
  //
  // Same "the whole row counts" rule maybeReachGoal uses: the mouth is a row,
  // and the throat beyond it is where the rival stands.
  private updateGoalBanner() {
    this.goalText?.setVisible(!!this.goalTile && this.playerTile.y <= this.goalTile.y + 1);
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
