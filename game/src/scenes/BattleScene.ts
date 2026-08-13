import Phaser from 'phaser';
import { makeCrystal } from '../art/crystals';
import { makeBossCrystal } from '../art/boss';
import { shade } from '../art/colors';
import { getBiome } from '../art/biomes';
import type { Biome } from '../art/biomes';
import { playAttackEffect, ANALYTIC_SHAPES, ULTIMATE_SHAPES } from '../art/attackEffects';
import { fontPx, fontScale } from '../ui/text';
import { PANEL_BG, GOLD_ACCENT, GOLD_ACCENT_HEX, REFERENCE_BLUE_GREY, REFERENCE_BLUE_GREY_HEX } from '../ui/theme';
import {
  MOVES,
  canHost,
  getPlayerMaterial,
  getPlayerStats,
  getBattleMoves,
  getTunedMoveClass,
  tunedMoveDisplayName,
  moveDisplayName,
  effectiveMovePower,
  getMoveLevel,
  MOVE_LEVEL_MULTIPLIERS,
  enemyStatsForWorld,
  ANALYTIC_MOVE_IDS,
  ULTIMATE_MOVE_IDS,
  KONDO_MOVE_IDS,
  typesHosting,
  allCrystals,
} from '../data/materials';
import {
  battleStakeForWorld,
  mitigationFraction,
  resolveHitDamage,
  MISMATCH_MULTIPLIER,
  FRACTIONAL_GUARD_DAMAGE_MULT,
  ANYON_ECHO_FRACTION,
  EDGE_CURRENT_MISMATCH_MULT,
  STATUS_DURATION,
  SHIELD_BASE_REDUCTION,
  SHIELD_MAX_REDUCTION,
  EVASION_BASE_CHANCE,
  EVASION_MAX_CHANCE,
  REGEN_BASE_HEAL_FRACTION,
  REGEN_MAX_HEAL_FRACTION,
  wildHpForWorld,
  rivalHpForWorld,
  rollEncounterFactor,
} from '../data/balance';
import { victoryLine, defeatLine } from '../data/greetings';
import { PASSIVES } from '../data/passives';
import type { PassiveOwner } from '../data/passives';
import { materialBlurb } from '../data/materialdex';
import { getAnalyticQuestion, getUltimateQuestions } from '../data/quiz';
import { persistFromRegistry } from '../data/save';
import type { DiscoveredMaterial } from '../data/save';
import type { Material, Move, MoveClass, Stats } from '../data/types';
import { music } from '../audio/music';
import { CANVAS_W, CANVAS_H } from '../config/screen';

// Correct/wrong multipliers for Laughlin's two quiz-gated Analytic moves (§5) --
// deliberately steeper than the pre-battle quiz's QUIZ_CORRECT_MULTIPLIER/
// QUIZ_WRONG_MULTIPLIER (OverworldScene.ts, 1.5/0.6): those apply to every
// attack for a whole fight as a one-time roll, these are a per-use gamble
// the player opts into by picking one of these two moves specifically.
const ANALYTIC_CORRECT_MULTIPLIER = 2;
const ANALYTIC_WRONG_MULTIPLIER = 0.5;

// Kondo's three self-buff moves (§5, World 8) each deterministically apply
// one of these three 3-turn buffs to the *caster's own* side, replacing
// whatever buff (if any) was already there rather than stacking -- exactly
// one active buff per side at a time, matching the "one type-interaction
// rule, on purpose" simplicity DESIGN.md §4 already commits to elsewhere.
// Battle-ephemeral only (never persisted -- data/save.ts's SaveData has no
// field for this), reset fresh at the start of every battle.
type StatusKind = 'shielded' | 'evasive' | 'regenerating';

interface ActiveStatus {
  kind: StatusKind;
  turnsLeft: number;
}

// Which buff a given Kondo move id deterministically applies -- no
// randomness, the player picks the effect by picking the move (and, since
// only one of the three can be active in battle at a time, by which one
// they set active with OverworldScene.showKondoPanel).
const KONDO_MOVE_BUFF: Record<string, StatusKind> = {
  screeningCloud: 'shielded',
  scatteringDrag: 'evasive',
  kondoBreakdown: 'regenerating',
};

// Deliberately terse (one short clause, no second sentence) -- the log line
// this appends to can already carry a mismatch clause and a crit clause
// (setLogText's clamp was sized/verified against that two-clause worst case,
// see STYLE.md), and the status pill under the HP bar already spells out the
// ongoing effect ("Shielded (3)") for as long as it's active, so the log
// line itself only needs to announce the moment, not re-explain the effect.
const STATUS_INFO: Record<
  StatusKind,
  { label: string; applyText: (name: string) => string; expireText: (name: string) => string }
> = {
  shielded: {
    label: 'Shielded',
    applyText: (name) => `${name} is Shielded!`,
    expireText: (name) => `${name}'s shielding fades.`,
  },
  evasive: {
    label: 'Evasive',
    applyText: (name) => `${name} turns Evasive!`,
    expireText: (name) => `${name}'s evasiveness fades.`,
  },
  regenerating: {
    label: 'Regenerating',
    applyText: (name) => `${name} starts Regenerating!`,
    expireText: (name) => `${name}'s regeneration fades.`,
  },
};
// Single status-pill color for all three (Kondo's own rust-orange, matching
// WORLD_GUARDIANS[8].strokeColor/art/attackEffects.ts's 'screening' entry) --
// the label text itself already names which buff is active.
const STATUS_PILL_COLOR = '#ff8f6a';

// Passive pill color -- a fixed blue-violet, deliberately far from
// STATUS_PILL_COLOR's rust-orange so an always-on passive reads as visually
// distinct from a ticking status at a glance.
const PASSIVE_PILL_COLOR = '#8fa0ff';

// A side can hold one Franklin passive at a time (data/passives.ts's one
// current PassiveOwner) -- joined onto a single pill line the same '' when
// empty convention STATUS_INFO's pill uses, so a future second owner could
// stack onto the same line without changing this function. PASSIVES[id]?
// rather than a direct index -- every other read of playerActivePassives/
// opponentActivePassives (activePassives() below) only ever calls .has(id),
// so this is the first spot that actually dereferences one; guarding it
// means a stale id left over from a since-renamed passive in an old save
// degrades to "that name just doesn't show" instead of throwing out of
// create().
function passivePillText(ids: Set<string>): string {
  return [...ids]
    .map((id) => PASSIVES[id]?.name)
    .filter((name): name is string => !!name)
    .join(' · ');
}

// Franklin's passive abilities (§5, data/passives.ts) -- unlike Kondo's
// status effects above, a passive has no duration/tick-down: it's simply on
// for the whole battle it's active for, so each one is just a flat
// multiplier/flag term read directly off whichever side currently has it
// active (this.activePassives(isPlayer), populated once in create() from
// registry/save activePassiveByOwner and never touched again mid-battle).
// Only the player can ever have one today, but every hook below reads
// generically off `isPlayer`/`defenderIsPlayer` the same way every other
// resolveHit term does, in case a future enemy ever has one.
// FRACTIONAL_GUARD_DAMAGE_MULT/ANYON_ECHO_FRACTION/EDGE_CURRENT_MISMATCH_MULT
// live in data/balance.ts, imported above (Phaser-free so the balance
// simulator script can load them too).

// Field size is the shared canvas size (config/screen.ts) -- aliased to
// FIELD_W/FIELD_H here since every layout constant below reads as "a
// distance across the battle field" rather than "a distance across the
// canvas."
const FIELD_W = CANVAS_W;
const FIELD_H = CANVAS_H;
const HORIZON_Y = 262;
const LOG_Y = 440; // combat log's usual bottom-anchored resting position
// battleStakeForWorld lives in data/balance.ts, imported above -- a rival
// fight's stake is double this same world's ordinary stake, win or lose, see
// the call site below.
// A rival/boss fight's opponent renders bigger (see BOSS_CRYSTAL_SIZE below)
// than an ordinary wild encounter's 50, and sits a bit further left/down so
// its wider multi-shard silhouette (art/boss.ts's makeBossCrystal) stays
// clear of the "Turns" preview widget in the opposite corner. Both crystals
// sit well above MENU_MIN_TOP (below), so the move menu -- bottom-anchored,
// see MENU_MIN_TOP's own comment -- can never reach up into either one.
const OPPONENT_POS = { x: 674, y: 150 };
const BOSS_OPPONENT_POS = { x: 644, y: 155 };
const BOSS_CRYSTAL_SIZE = 64;
const PLAYER_POS = { x: 240, y: 345 };
// Shared HP-bar dimensions -- both the background/fill creation rects in
// create() and the fill-width math in updateBars() read these same
// constants, so the two can't silently drift out of sync the way two
// independent "100" literals once could. The fill sits inset from the
// background by the same margin on every side (see the (HP_BAR_W -
// HP_BAR_FILL_W)/2 math at each call site) rather than flush with it.
const HP_BAR_W = 156;
const HP_BAR_H = 18;
const HP_BAR_FILL_W = 150;
const HP_BAR_FILL_H = 12;
// Gap between the HP bar and the name label sharing its row (see "Opponent/
// player clusters" below).
const HP_BAR_NAME_GAP = 10;
// Gap before the next turn fires -- long enough for the fuller attack beat
// (windup + travel + impact shockwave, up to ~810ms for a ring move) in
// art/attackEffects.ts to land and read clearly before the screen moves on.
const TURN_GAP_MS = 850;
// Move menu: docked bottom-right, its bottom edge fixed at
// FIELD_H - MENU_BOTTOM_MARGIN and its top edge derived fresh on every
// drawMoveMenu call from however tall the current page's content actually
// is (drawMoveMenu's own comment) -- the panel grows upward from that fixed
// bottom rather than down from a fixed top, so it reads as bottom-right-
// docked at every page/section instead of just starting high and getting
// taller. MENU_MIN_TOP caps how far up that growth is ever allowed to
// reach, below the opponent's crystal in every case, including a rival
// fight's own bigger, wider boss silhouette -- whose rendered bounds
// (including its decorative halo/shard art, not just BOSS_CRYSTAL_SIZE's
// bare number) reach a measured ~223px, verified against a live
// headless-Chromium render at the largest text-size preset -- so the two
// can never collide regardless of how tall a page's content gets.
const MENU_WIDTH = 226;
const MENU_X = FIELD_W - 8 - MENU_WIDTH;
const MENU_BOTTOM_MARGIN = 16;
const MENU_MIN_TOP = 232;
// Every move-menu page is capped at this many rows, however many moves its
// section actually has (moveMenuPages splits a larger section into several
// same-label pages instead) -- a fixed cap keeps every page's row budget
// (and so its font size) close to identical regardless of content, rather
// than a few-move page rendering tiny text just because some other section
// happens to have many more moves.
const MOVE_MENU_MAX_ROWS = 3;
// "Turns" preview widget (top-left corner, clear of both HP-bar columns and
// the log text further down) -- see `BattleScene.drawTurnPreview`.
const TURN_PREVIEW_X = 20;
const TURN_PREVIEW_Y = 8;
const TURN_PREVIEW_LENGTH = 5;
const TURN_PREVIEW_ICON_SIZE = 24;
const TURN_PREVIEW_ICON_SPACING = 28;
// Whose-turn ring drawn behind each icon (see `drawTurnPreview`) -- radius
// matches half the icon spacing so adjacent rings meet edge-to-edge without
// overlapping.
const TURN_PREVIEW_RING_RADIUS = TURN_PREVIEW_ICON_SPACING / 2;
// How far the opponent's name label (which grows leftward from the HP bar,
// see "Opponent/player clusters" below) is kept from the field's left edge
// at minimum, so a long rival name's wrapped block never reaches into the
// "Turns" preview widget's own footprint (TURN_PREVIEW_X plus its row of
// icons, ~158px wide with the sizes above).
const OPPONENT_NAME_CLEAR_X = 180;
// Fixed vertical center of the opponent's name+bar row -- unlike the
// player's own row (which can be pushed down by the optional boost/fail
// note stacked above it, see create()), nothing ever sits above the
// opponent's row, so its y never needs to be computed at runtime.
const OPPONENT_ROW_Y = 46;
// Ordinary per-turn combat-log line width -- kept clear of the move menu's
// left edge (MENU_X), which shares the log's own vertical band now that the
// panel is bottom-anchored rather than confined to a column starting well
// below the log. The end-of-battle summary (endBattle) uses a much wider
// value instead: the move menu is already destroyed by the time it's shown
// (endBattle's first line), so there's no panel left to stay clear of.
const LOG_WRAP_WIDTH = MENU_X - 60;
const LOG_WRAP_WIDTH_VICTORY = FIELD_W - 40;

interface BattleInitData {
  wild: Material;
  world?: number;
  attackMultiplier?: number;
  isRival?: boolean;
}

interface MoveSection {
  label: string;
  ids: string[];
  legend?: string;
}

export class BattleScene extends Phaser.Scene {
  private wild!: Material;
  private world = 1;
  private attackMultiplier = 1;
  private isRival = false;
  private playerMaterial!: Material;
  private playerStats!: Stats;
  private enemyStats!: Stats;
  private playerHp = 0;
  private opponentHp = 0;
  // Neither the player's own crystal form nor `this.wild`/`adaptedForm`
  // carries an intrinsic HP number (`data/types.ts`'s `Material`, `data/
  // balance.ts`'s own comment) -- both max HP values are resolved once in
  // create() instead: the player's own from `wildHpForWorld(this.world)`
  // (no roll, their own body isn't a specimen with variance), the
  // opponent's from `wildHpForWorld` scaled by that battle's own
  // `rollEncounterFactor` for an ordinary wild, or from `rivalHpForWorld`
  // (no roll) for a rival -- see create()'s own comment.
  private playerMaxHp = 0;
  private opponentMaxHp = 0;
  private turnLock = false;
  private opponentHpBar!: Phaser.GameObjects.Rectangle;
  private playerHpBar!: Phaser.GameObjects.Rectangle;
  private opponentCrystal!: Phaser.GameObjects.Container;
  private opponentNameText!: Phaser.GameObjects.Text;
  private opponentPos: { x: number; y: number } = OPPONENT_POS;
  // World 10's rival ("The Adapted") has no fixed type/look/name of its own
  // -- see data/materials.ts's WORLD_RIVALS[10] comment. Set in create()
  // (mirroring the player's own current type) only for that one fight, then
  // replaced wholesale every time transmuteAdapted() fires; `null` for every
  // other fight, in which case opponentView() below falls back to the plain
  // static `this.wild` the same way every read here always did. Only its
  // type/name/color/variant are ever read off this -- `this.wild.moves`
  // (its actual attack moveset) stays fixed throughout, see
  // transmuteAdapted's own comment; HP is never read off either `Material`
  // at all (see `opponentMaxHp`'s own comment above).
  private adaptedForm: Material | null = null;
  private playerCrystal!: Phaser.GameObjects.Container;
  private logText!: Phaser.GameObjects.Text;
  private turnPreviewLabel!: Phaser.GameObjects.Text;
  private turnPreviewRow?: Phaser.GameObjects.Container;
  private moveMenu?: Phaser.GameObjects.Container;
  // Which page drawMoveMenu is currently showing -- see drawMoveMenu's own
  // comment for why only one renders at a time now. A page is usually one
  // move-kind section (ATTACKS/ANALYTIC/BUFFS) in full, but a section
  // with more moves than one page can hold at the row-height floor splits
  // into several same-label pages (moveMenuPages), so this indexes the
  // flattened page list, not the section list directly. Reset fresh in
  // create() below, same reasoning as every other battle-ephemeral field
  // here (Phaser reuses the Scene instance across scene.start() calls).
  private movePageIndex = 0;
  private currentMoveIds: string[] = [];
  // Kondo's status effects (§5) -- battle-ephemeral only, reset fresh in
  // create() below (Phaser reuses the same Scene instance across
  // scene.start() calls, so a field initializer alone wouldn't reset this
  // between battles -- see OverworldScene's own comment on the same gotcha).
  private playerStatus: ActiveStatus | null = null;
  private opponentStatus: ActiveStatus | null = null;
  private playerStatusLabel!: Phaser.GameObjects.Text;
  private opponentStatusLabel!: Phaser.GameObjects.Text;
  // Franklin's passives (§5) -- computed once in create() from
  // registry/save activePassiveByOwner and held for the whole battle (no
  // tick-down, unlike playerStatus/opponentStatus above).
  // opponentActivePassives stays empty today (no WORLD_CRYSTALS entry has
  // one), kept as its own field rather than hardcoding "player only" so
  // activePassives() below reads symmetrically off either side.
  private playerActivePassives = new Set<string>();
  private opponentActivePassives = new Set<string>();

  constructor() {
    super('Battle');
  }

  // The opponent's currently-displayed identity -- `adaptedForm` (World 10's
  // rival only, see that field's own comment) if set, otherwise the plain
  // static `this.wild` every other fight always reads. Every read of the
  // opponent's own type/name/color/variant for a mismatch check or a render
  // goes through this rather than `this.wild` directly, so a live
  // transmutation is reflected everywhere the opponent's identity shows up.
  private opponentView(): Material {
    return this.adaptedForm ?? this.wild;
  }

  init(data: BattleInitData) {
    this.wild = data.wild;
    this.world = data.world ?? 1;
    this.attackMultiplier = data.attackMultiplier ?? 1;
    this.isRival = data.isRival ?? false;
  }

  create() {
    music.play(`battle:${this.world}`);
    // Resolved before drawBackground() (which anchors the opponent's ground
    // shadow off this) and before the opponent's name/bar row below (which
    // anchors off this.opponentPos.x) -- a rival fight's opponent is that
    // world's boss, rendered bigger and at a different position than an
    // ordinary wild encounter (see BOSS_OPPONENT_POS/BOSS_CRYSTAL_SIZE).
    this.opponentPos = this.isRival ? BOSS_OPPONENT_POS : OPPONENT_POS;
    this.drawBackground();

    this.playerMaterial = getPlayerMaterial(this.game.registry);
    this.playerStats = getPlayerStats(this.game.registry);

    // Neither side's max HP/stats are intrinsic to a crystal form -- both
    // are resolved fresh here from the current world instead (`data/
    // balance.ts`). A rival is a fixed, known, repeatable challenge (no
    // roll, `rivalHpForWorld`, plain `enemyStatsForWorld`); an ordinary
    // wild gets one shared +/-15% `rollEncounterFactor` roll applied to both
    // its HP and its whole stat block, reading as one specimen's own
    // sample-to-sample variance rather than four independent rolls. The
    // player's own max HP uses the same `wildHpForWorld` an ordinary wild's
    // base HP does (their own body isn't a specimen with variance, so no
    // roll), for whichever world they're currently in -- transmuting/fusing
    // into a different form never changes it by itself.
    const encounterFactor = this.isRival ? 1 : rollEncounterFactor();
    const baseEnemyStats = enemyStatsForWorld(this.world);
    this.enemyStats = this.isRival
      ? baseEnemyStats
      : {
          quantumness: Math.round(baseEnemyStats.quantumness * encounterFactor),
          velocity: Math.round(baseEnemyStats.velocity * encounterFactor),
          correlation: Math.round(baseEnemyStats.correlation * encounterFactor),
        };
    this.playerMaxHp = wildHpForWorld(this.world);
    this.opponentMaxHp = this.isRival ? rivalHpForWorld(this.world) : Math.round(wildHpForWorld(this.world) * encounterFactor);

    // World 10's rival mirrors the player's own current type from turn one
    // (literalizing "a model of you" immediately, not just once it first
    // reacts) -- its look/name stay "The Adapted"'s own until the first
    // transmutation actually fires (checkEndOrContinue, resolveHit below).
    this.adaptedForm =
      this.isRival && this.world === 10
        ? { ...this.wild, type: this.playerMaterial.type }
        : null;

    // Franklin's active passives (§5) -- read once here, held for the whole
    // battle.
    const activeByOwner = (this.game.registry.get('activePassiveByOwner') as Partial<Record<PassiveOwner, string>>) ?? {};
    this.playerActivePassives = new Set(Object.values(activeByOwner).filter((id): id is string => !!id));
    this.opponentActivePassives = new Set();

    const savedHp = (this.game.registry.get('playerHp') as number) || this.playerMaxHp;
    this.playerHp = Math.min(savedHp, this.playerMaxHp);
    this.opponentHp = this.opponentMaxHp;
    this.turnLock = false;
    this.movePageIndex = 0;
    this.playerStatus = null;
    this.opponentStatus = null;

    // Opponent (top-right) -- name and HP bar share one row, mirrored from
    // the player's own row below (name after the bar there, name before the
    // bar here), both derived from this.opponentPos.x (the same anchor the
    // crystal itself renders at, OPPONENT_POS or the shifted
    // BOSS_OPPONENT_POS for a rival fight) rather than an independent
    // hardcoded x, so the two can never drift apart. The bar is horizontally
    // centered under/above the crystal; the name is right-aligned
    // (origin (1, 0.5)) immediately to its left and grows further left as it
    // wraps, clamped (OPPONENT_NAME_CLEAR_X) well clear of the "Turns"
    // preview widget in the opposite corner. `useAdvancedWrap` lets Phaser
    // break a single word mid-word when needed -- without it, wordWrap only
    // breaks at spaces, so a long single word (e.g. "Polycrystalline" in
    // every WORLD_RIVALS/RIVAL_9_NAMES boss name) wouldn't wrap at all and
    // would overflow the box instead. A rival's own name runs much longer on
    // average than an ordinary wild's, so its label uses a smaller base size
    // to keep the wrapped block from reaching too far across the field.
    const opponentBarLeftX = this.opponentPos.x - HP_BAR_W / 2;
    this.add.rectangle(opponentBarLeftX, OPPONENT_ROW_Y, HP_BAR_W, HP_BAR_H, 0x222222, 0.55).setOrigin(0, 0.5);
    this.opponentHpBar = this.add
      .rectangle(opponentBarLeftX + (HP_BAR_W - HP_BAR_FILL_W) / 2, OPPONENT_ROW_Y, HP_BAR_FILL_W, HP_BAR_FILL_H, 0x33cc33)
      .setOrigin(0, 0.5);
    const opponentNameRightX = opponentBarLeftX - HP_BAR_NAME_GAP;
    this.opponentNameText = this.add
      .text(opponentNameRightX, OPPONENT_ROW_Y, this.opponentView().name, {
        fontSize: fontPx(this, this.isRival ? 11 : 14),
        color: '#ffffff',
        backgroundColor: 'rgba(0,0,0,0.35)',
        padding: { x: 4, y: 2 },
        align: 'right',
        wordWrap: { width: Math.max(80, opponentNameRightX - OPPONENT_NAME_CLEAR_X), useAdvancedWrap: true },
      })
      .setOrigin(1, 0.5);
    // Status pill (Kondo's moves, §5) -- empty/invisible until a status is
    // actually active (renderStatusLabel), so it costs nothing to lay out
    // for the common case where no status is in play.
    // Depth above the combat log (default depth 0, below) -- the log's own
    // box grows upward on a long wrapped line (setLogText) and can reach as
    // far up as this row at a big text-size setting; a higher depth keeps
    // the pill legibly on top rather than getting visually buried under it.
    const opponentRowBottom = OPPONENT_ROW_Y + Math.max(HP_BAR_H, this.opponentNameText.height) / 2;
    this.opponentStatusLabel = this.add
      .text(opponentBarLeftX, opponentRowBottom + 6, '', {
        fontSize: fontPx(this, 11),
        color: STATUS_PILL_COLOR,
        padding: { x: 4, y: 1 },
      })
      .setOrigin(0, 0)
      .setDepth(5);
    // Passive pill (Franklin's abilities, §5) sits below the status
    // pill, offset from its *measured* height rather than a further
    // hardcoded gap -- same text-size-scaling reasoning as the row above,
    // and the status pill's own height still varies with the text-size
    // setting even while empty. Static for the whole battle
    // (playerActivePassives/opponentActivePassives never change mid-battle),
    // so its text is set once here (addPassivePill) rather than through a
    // render function like renderStatusLabel, and isn't kept as a field
    // since nothing needs to read it back afterward, same as
    // opponentName/playerName above.
    const opponentStatusBottom = this.opponentStatusLabel.y + this.opponentStatusLabel.height;
    this.addPassivePill(
      opponentBarLeftX,
      opponentStatusBottom + 4,
      passivePillText(this.opponentActivePassives),
      opponentStatusBottom,
      FIELD_W - 8
    );

    // A rival fight's opponent is that world's boss -- render it with the
    // same gigantic, multi-shard look it has standing at the goal tile in
    // the overworld (art/boss.ts's makeBossCrystal), not the plain shared
    // makeCrystal() every ordinary wild encounter uses.
    this.opponentCrystal = this.isRival
      ? makeBossCrystal(this, BOSS_CRYSTAL_SIZE, this.opponentView().color, this.opponentView().variant)
      : makeCrystal(this, 50, this.wild.color, this.wild.variant, { seed: this.wild.name, hybrid: this.wild.hybridParents });
    this.opponentCrystal.setPosition(this.opponentPos.x, this.opponentPos.y);
    this.bobCrystal(this.opponentCrystal, this.opponentPos.y);

    // Player (bottom-left)
    this.playerCrystal = makeCrystal(this, 55, this.playerMaterial.color, this.playerMaterial.variant, {
      seed: this.playerMaterial.name,
      hybrid: this.playerMaterial.hybridParents,
    });
    this.playerCrystal.setPosition(PLAYER_POS.x, PLAYER_POS.y);
    this.bobCrystal(this.playerCrystal, PLAYER_POS.y);

    // Everything below the crystal (the optional boost/fail note, then the
    // name+bar row) is stacked from a running y rather than fixed pixel
    // offsets -- label height scales with the text-size setting (up to 2x,
    // data/settings.ts), and a fixed offset tuned for the smallest size lets
    // a taller note collide with the row below it.
    let playerContentY = PLAYER_POS.y + 34;

    if (this.attackMultiplier !== 1) {
      const boosted = this.attackMultiplier > 1;
      if (boosted) this.addBoostHalo(this.playerCrystal);
      else this.addFailCloud(this.playerCrystal);

      const boostText = this.add
        .text(PLAYER_POS.x, playerContentY, boosted ? 'Attack boosted!' : 'Attack weakened...', {
          fontSize: fontPx(this, 12),
          color: boosted ? '#88ff88' : '#ff8888',
          backgroundColor: 'rgba(0,0,0,0.35)',
          padding: { x: 4, y: 2 },
        })
        .setOrigin(0.5, 0);
      playerContentY += boostText.height + 4;
    }

    // The bar and the name beside it are both vertically centered on this
    // same row -- name and bar share one row (bar then name, left to
    // right), mirrored from the opponent's row above, both derived from
    // PLAYER_POS.x the same way the opponent's row derives from
    // this.opponentPos.x.
    const playerRowY = playerContentY + HP_BAR_H / 2;
    const playerBarLeftX = PLAYER_POS.x - HP_BAR_W / 2;
    this.add.rectangle(playerBarLeftX, playerRowY, HP_BAR_W, HP_BAR_H, 0x222222, 0.55).setOrigin(0, 0.5);
    this.playerHpBar = this.add
      .rectangle(playerBarLeftX + (HP_BAR_W - HP_BAR_FILL_W) / 2, playerRowY, HP_BAR_FILL_W, HP_BAR_FILL_H, 0x33cc33)
      .setOrigin(0, 0.5);
    const playerNameX = playerBarLeftX + HP_BAR_W + HP_BAR_NAME_GAP;
    // Wrap width clamped to stop before MENU_X -- the move menu is
    // bottom-anchored and shares this same vertical band now (see
    // MENU_MIN_TOP's own comment), so unlike the top band above (clear of
    // the panel for the whole battle), a long hybrid name growing rightward
    // here has to stay clear of it explicitly.
    const playerName = this.add
      .text(playerNameX, playerRowY, this.playerMaterial.name, {
        fontSize: fontPx(this, 14),
        color: '#ffffff',
        backgroundColor: 'rgba(0,0,0,0.35)',
        padding: { x: 4, y: 2 },
        wordWrap: { width: Math.max(80, MENU_X - playerNameX - 16) },
      })
      .setOrigin(0, 0.5);
    // Same depth-above-the-log reasoning as the opponent's pill above -- the
    // player's own bar sits closer to the log's usual bottom-anchored
    // resting spot, so this is the side actually at risk of the log's box
    // climbing up over it on a long wrapped line.
    const playerRowBottom = playerRowY + Math.max(HP_BAR_H, playerName.height) / 2;
    this.playerStatusLabel = this.add
      .text(playerBarLeftX, playerRowBottom + 6, '', {
        fontSize: fontPx(this, 11),
        color: STATUS_PILL_COLOR,
        padding: { x: 4, y: 1 },
      })
      .setOrigin(0, 0)
      .setDepth(5);
    // Same measured-height stacking as the opponent's passive pill above --
    // this is the side actually at risk of it, since the boost/fail note and
    // the crystal itself already eat into the room below PLAYER_POS.y that
    // this pill is the last row in. Clamped against MENU_X rather than
    // FIELD_W (addPassivePill's own maxRightX param) for the same
    // shared-vertical-band reason the name's own wordWrap width is clamped
    // above.
    const playerStatusBottom = this.playerStatusLabel.y + this.playerStatusLabel.height;
    this.addPassivePill(playerBarLeftX, playerStatusBottom + 4, passivePillText(this.playerActivePassives), playerStatusBottom, MENU_X - 12);

    const openingLine = this.isRival ? `${this.wild.name} blocks the way onward!` : `A wild ${this.wild.name} appeared!`;
    this.logText = this.add.text(20, LOG_Y, '', {
      fontSize: fontPx(this, 14),
      color: '#ffffff',
      backgroundColor: 'rgba(0,0,0,0.45)',
      padding: { x: 8, y: 6 },
      wordWrap: { width: LOG_WRAP_WIDTH },
    });
    this.setLogText(openingLine);

    // "Turns" preview widget (top-left corner) -- see drawTurnPreview's own
    // comment. Label is static chrome for the whole battle (same treatment
    // as the move menu's own section headers, `#8fa0c9`), so it's built once
    // here rather than inside drawTurnPreview, which only rebuilds the icon
    // row itself.
    this.turnPreviewLabel = this.add.text(TURN_PREVIEW_X, TURN_PREVIEW_Y, 'Turns', {
      fontSize: fontPx(this, 11),
      color: REFERENCE_BLUE_GREY_HEX,
      backgroundColor: 'rgba(0,0,0,0.35)',
      padding: { x: 4, y: 2 },
    });
    this.drawTurnPreview();

    this.currentMoveIds = getBattleMoves(this.game.registry);
    this.drawMoveMenu(this.currentMoveIds);
    // Left/Right cycle which page is showing (drawMoveMenu's own comment) --
    // mirrors the on-screen ◀/▶ arrows for a keyboard-only player, same
    // "no-op if there's nothing to switch to" guard as those.
    this.input.keyboard!.on('keydown-LEFT', () => this.switchMovePage(-1));
    this.input.keyboard!.on('keydown-RIGHT', () => this.switchMovePage(1));

    this.updateBars();
  }

  // Rebuilds the current page list from currentMoveIds and steps
  // movePageIndex by `delta`, wrapping around -- the actual redraw happens
  // inside drawMoveMenu, called fresh each time so a mid-battle change to
  // currentMoveIds (there isn't one today, but drawMoveMenu already takes
  // moveIds as a parameter rather than assuming it's static) is picked up
  // automatically. A no-op while turnLock is held (mid-swing, and also true
  // for the rest of the scene's life once a KO ends the battle --
  // resolveHit's win/lose branch returns before ever releasing it, see
  // playerAttack's own comment) or if there's only one page to begin with,
  // same guard `addMoveButton` already applies to clicks. `!this.moveMenu`
  // is a second, explicit belt-and-suspenders check -- endBattle destroys
  // it -- so a Left/Right press after the results screen is up can never
  // resurrect the panel even if the turnLock invariant above is ever
  // refactored away.
  private switchMovePage(delta: number) {
    if (this.turnLock || !this.moveMenu) return;
    const pageCount = this.moveMenuPages(this.currentMoveIds).length;
    if (pageCount <= 1) return;
    this.movePageIndex = (this.movePageIndex + delta + pageCount) % pageCount;
    this.drawMoveMenu(this.currentMoveIds);
  }

  // The four possible move-kind sections (DESIGN.md §4's "group moves by
  // kind"), filtered down to whichever ones actually have a usable move.
  private moveSections(moveIds: string[]): MoveSection[] {
    return [
      {
        label: 'ATTACKS',
        ids: moveIds.filter(
          (id) => !ANALYTIC_MOVE_IDS.includes(id) && !ULTIMATE_MOVE_IDS.includes(id) && MOVES[id].class !== 'screening'
        ),
      },
      {
        label: 'ANALYTIC',
        ids: moveIds.filter((id) => ANALYTIC_MOVE_IDS.includes(id)),
        legend: '★ right=2x wrong=½x',
      },
      {
        label: 'ULTIMATE',
        ids: moveIds.filter((id) => ULTIMATE_MOVE_IDS.includes(id)),
        legend: '★★★ 3/3 correct or it whiffs',
      },
      {
        label: 'BUFFS',
        ids: moveIds.filter((id) => MOVES[id].class === 'screening'),
        legend: `self-buff, no damage, ${STATUS_DURATION} turns`,
      },
    ].filter((s) => s.ids.length > 0);
  }

  // moveSections() split so no single page ever holds more than
  // MOVE_MENU_MAX_ROWS moves -- a section within the cap stays one page,
  // unchanged. An oversized one splits into evenly-sized pages sharing the
  // section's own label -- `chernSuperconductor` (electron/phonon/higgs/
  // chiral/majorana, the broadest single main type's own MOVE_COMPATIBILITY
  // list) is the one form whose ATTACKS section needs this today, once every
  // matching move is unlocked, splitting its 5 moves into two pages (3 + 2).
  // The header's own "(i/N)" page count already disambiguates "ATTACKS" page
  // 1 from page 2, the same way a paginated candidate list elsewhere in the
  // game numbers its pages, rather than needing a second label scheme of its
  // own.
  private moveMenuPages(moveIds: string[]): MoveSection[] {
    return this.moveSections(moveIds).flatMap((section) => {
      if (section.ids.length <= MOVE_MENU_MAX_ROWS) return [section];
      const pageCount = Math.ceil(section.ids.length / MOVE_MENU_MAX_ROWS);
      const perPage = Math.ceil(section.ids.length / pageCount);
      const pages: MoveSection[] = [];
      for (let i = 0; i < section.ids.length; i += perPage) {
        pages.push({ label: section.label, ids: section.ids.slice(i, i + perPage), legend: section.legend });
      }
      return pages;
    });
  }

  // A dedicated docked panel, bottom-right, sized to fit however many moves
  // are on the current page (getBattleMoves -- the player's learned moves
  // intersected with what their current crystal form's physics supports),
  // instead of scattering individually positioned buttons across the field.
  //
  // Move menu matchup info (DESIGN.md §4): each ordinary attack button also
  // shows the move's power and, against *this* opponent, whether the
  // opponent has no natural way to host it at all -- the "quasiparticle
  // mismatch" double-damage rule, the sole type-interaction term in battle,
  // marked !! 2x -- previously only visible after the hit landed in the
  // battle log, so a first-time player had no way to plan a move before
  // swinging. Kondo's self-buff moves show neither (see moveButtonContent),
  // since they never deal damage or mismatch at all.
  //
  // Shows exactly one page at a time (DESIGN.md §4's "group moves by kind"
  // -- physics-gated attacks, Laughlin's two answer-gated Analytic moves,
  // and Kondo's currently-active self-buff move work differently enough
  // that a flat list blurred the distinction), paged with on-screen ◀/▶
  // arrows and the Left/Right keys (movePageIndex/switchMovePage) -- a
  // move-kind section only produces a page at all if it has at least one
  // usable move, so a player with none of Laughlin's moves bought or no
  // Kondo move active never sees an empty page, and the pager itself is
  // hidden entirely if there's only one page to begin with. Every page holds
  // at most MOVE_MENU_MAX_ROWS moves (moveMenuPages splits a larger section
  // into several same-label pages instead), so every page's row budget is
  // close to identical rather than a few-move page rendering tiny text just
  // because some other section happens to have more moves in total. Called
  // again (destroying the old container first) on every page switch, not
  // just once at battle start.
  //
  // Bottom-anchored: the panel's bottom edge is fixed
  // (FIELD_H - MENU_BOTTOM_MARGIN) and its top edge is derived from however
  // tall the current page's content actually is, rather than a fixed top the
  // panel only ever grows downward from. Since the real content height isn't
  // known until every line/row has been laid out, and every line here is
  // positioned in absolute field coordinates (not container-local, so a
  // button's `pointerdown` handler keeps working exactly like every other
  // interactive text in the scene), this runs the same title/legend/header
  // layout twice: a throwaway measurement pass (destroyed immediately,
  // mirroring the measurement pattern moveButtonContent's own width-fit used
  // to use) that exists only to learn the real chrome/row height so
  // MENU_TOP can be computed, then the real render pass at the now-known
  // absolute y.
  private drawMoveMenu(moveIds: string[]) {
    this.moveMenu?.destroy(true);
    const scale = fontScale(this);
    // Title/legend are capped the same way the section header below already
    // is (headerScale) -- letting them scale all the way to the 2x 'Large'
    // preset would eat directly into the row budget below, since both feed
    // into the panel's own chrome height.
    const chromeScale = Math.min(scale, 1.35);
    const headerScale = Math.min(scale, 1.15);

    const container = this.add.container(0, 0).setDepth(30);
    this.moveMenu = container;

    const titleStyle = { fontSize: `${Math.round(12 * chromeScale)}px`, fontStyle: 'bold' as const };
    const legendStyle = {
      fontSize: `${Math.round(10 * chromeScale)}px`,
      wordWrap: { width: MENU_WIDTH - 12 },
      lineSpacing: 2,
    };

    if (moveIds.length === 0) {
      const measureTitle = this.add.text(0, 0, 'MOVES', titleStyle);
      const measureLegend = this.add.text(0, 0, '!! no natural defense (2x)', legendStyle);
      const measureEmpty = this.add.text(0, 0, 'No usable moves', { fontSize: fontPx(this, 11), wordWrap: { width: MENU_WIDTH - 16 } });
      const height = 8 + measureTitle.height + 4 + measureLegend.height + 8 + measureEmpty.height + 12;
      measureTitle.destroy();
      measureLegend.destroy();
      measureEmpty.destroy();
      const menuTop = FIELD_H - MENU_BOTTOM_MARGIN - height;

      let y = menuTop + 8;
      const title = this.add.text(MENU_X + MENU_WIDTH / 2, y, 'MOVES', { ...titleStyle, color: GOLD_ACCENT_HEX }).setOrigin(0.5, 0);
      container.add(title);
      y += title.height + 4;
      const legend = this.add
        .text(MENU_X + MENU_WIDTH / 2, y, '!! no natural defense (2x)', { ...legendStyle, color: REFERENCE_BLUE_GREY_HEX, align: 'center' })
        .setOrigin(0.5, 0);
      container.add(legend);
      y += legend.height + 8;
      const empty = this.add
        .text(MENU_X + MENU_WIDTH / 2, y, 'No usable moves', {
          fontSize: fontPx(this, 11),
          color: '#cfd8ff',
          align: 'center',
          wordWrap: { width: MENU_WIDTH - 16 },
        })
        .setOrigin(0.5, 0);
      container.add(empty);
      const bg = this.add
        .rectangle(MENU_X, menuTop, MENU_WIDTH, height, PANEL_BG, 0.9)
        .setOrigin(0, 0)
        .setStrokeStyle(2, GOLD_ACCENT);
      container.addAt(bg, 0);
      return;
    }

    const pages = this.moveMenuPages(moveIds);
    if (this.movePageIndex >= pages.length) this.movePageIndex = 0;
    const section = pages[this.movePageIndex];
    const showPager = pages.length > 1;
    const rowCount = Math.max(section.ids.length, 1);
    const headerLabelText = showPager ? `${section.label} (${this.movePageIndex + 1}/${pages.length})` : section.label;

    const HEADER_LEGEND_GAP = 1; // between the header's label and its own legend sub-line
    const HEADER_ROWS_GAP = 1; // from the header (or its legend) down to the first move row
    const headerStyle = { fontSize: `${Math.round(10 * headerScale)}px`, fontStyle: 'bold' as const };
    const arrowStyle = { fontSize: `${Math.round(13 * headerScale)}px`, fontStyle: 'bold' as const };
    const sectionLegendStyle = { fontSize: `${Math.round(8 * headerScale)}px` };

    // --- Measurement pass: throwaway Text objects, destroyed immediately,
    // just to learn how tall this page's chrome (title/legend/header/pager/
    // section-legend) and rows actually render at the current text-size
    // setting -- see this method's own comment for why the panel being
    // bottom-anchored means this has to happen before anything permanent
    // can be positioned.
    const measureTitle = this.add.text(0, 0, 'MOVES', titleStyle);
    const measureLegend = this.add.text(0, 0, '!! no natural defense (2x)', legendStyle);
    const rowsTop = 8 + measureTitle.height + 4 + measureLegend.height + 8;
    measureTitle.destroy();
    measureLegend.destroy();

    const measureHeader = this.add.text(0, 0, headerLabelText, headerStyle);
    const measureArrow = showPager ? this.add.text(0, 0, '◀', arrowStyle) : null;
    const measureSectionLegend = section.legend ? this.add.text(0, 0, section.legend, sectionLegendStyle) : null;
    let headerTotalH = Math.max(measureHeader.height, measureArrow?.height ?? 0) + HEADER_ROWS_GAP;
    if (measureSectionLegend) headerTotalH += measureSectionLegend.height + HEADER_LEGEND_GAP;
    measureHeader.destroy();
    measureArrow?.destroy();
    measureSectionLegend?.destroy();

    // Row height is a hard geometric budget -- whatever vertical room is
    // left in the panel's fixed bottom-anchored band (MENU_MIN_TOP down to
    // FIELD_H - MENU_BOTTOM_MARGIN) after the chrome above, divided across
    // however many moves this page has -- not something the text-size
    // setting can just grow past. Each button's font size is derived from
    // its own row's actual height (fitPx) and clamped against the
    // setting-scaled desired size (desiredPx) -- growing with the setting
    // wherever the row has slack, but never past what the row can
    // physically hold. `rowCount` here can never exceed MOVE_MENU_MAX_ROWS
    // -- moveMenuPages already split anything larger into further pages --
    // so every page's budget is close to identical, which is what keeps
    // `btnPx` close to its `desiredPx` ceiling on every page rather than
    // collapsing on whichever ones happen to have more moves. Verified
    // against a live browser render (headless-Chromium harness,
    // DEVELOPMENT.md) at every text-size preset with a form carrying every
    // attack class at once (the worst case any MOVE_COMPATIBILITY entry can
    // reach) -- no page overflows the field, and no label reaches a 3rd
    // line, at any preset.
    const rowFloor = 20;
    const maxRowH = Math.round(46 * Math.min(scale, 1.35));
    const budget = FIELD_H - MENU_BOTTOM_MARGIN - MENU_MIN_TOP;
    const chromeH = rowsTop + headerTotalH + 8; // +8 matches the panel's own trailing bottom pad below
    const avail = budget - chromeH;
    const naturalRowH = Math.floor(avail / rowCount);
    const rowH = Phaser.Math.Clamp(naturalRowH, rowFloor, Math.max(maxRowH, rowFloor));
    const height = chromeH + rowCount * rowH;
    const menuTop = FIELD_H - MENU_BOTTOM_MARGIN - height;

    const padY = 5;
    const fitPx = Math.max(9, Math.floor((rowH - padY * 2) / 2.4));
    const desiredPx = Math.round(10 * scale);
    let btnPx = Math.min(desiredPx, fitPx);

    // fitPx above only budgets vertical space (rowH) on the assumption a
    // label wraps to at most 2 lines -- it says nothing about whether a
    // long tuned move name plus an Ultimate's ★★★ and a mismatch !!2x tag,
    // all at once, actually wraps that short at this page's own generous
    // font size (a 2-row ULTIMATE page has enough vertical room that fitPx
    // alone can land well above what the panel's fixed width can wrap to 2
    // lines). Checked with a throwaway Text object (destroyed immediately)
    // rather than assumed, and shrunk in whole-pixel steps -- uniformly
    // across the page, same as every row already sharing one btnPx -- until
    // every label on this page actually wraps to 2 lines or fewer. Verified
    // against a live browser render (headless-Chromium harness,
    // DEVELOPMENT.md) at the largest text-size preset with Skłodowska-
    // Curie's Ultimate moves tuned to 'heavyFermion' (the longest
    // quasiparticle name) and mismatched against the opponent -- the worst
    // case across every tunable move.
    const measure = this.add.text(0, 0, '', { fontStyle: 'bold', wordWrap: { width: MENU_WIDTH - 16 } });
    const widestLineCount = () => {
      let lines = 1;
      section.ids.forEach((moveId) => {
        measure.setFontSize(`${btnPx}px`).setText(this.moveButtonContent(moveId).text);
        lines = Math.max(lines, measure.getWrappedText().length);
      });
      return lines;
    };
    // Floored at the same 9px `fitPx` uses -- legibility wins over the
    // 2-line guarantee below that floor, on the assumption a label long
    // enough to still wrap 3 lines at 9px never actually occurs (verified
    // for every current move/tag combination, see above). A future move
    // whose tuned name is long enough to break that assumption would need
    // this floor revisited, not just a bigger MENU_WIDTH.
    while (btnPx > 9 && widestLineCount() > 2) btnPx -= 1;
    measure.destroy();

    // --- Render pass: identical layout math to the measurement pass above,
    // now building the real, permanent, absolutely-positioned elements at
    // the now-known menuTop.
    const bg = this.add
      .rectangle(MENU_X, menuTop, MENU_WIDTH, height, PANEL_BG, 0.9)
      .setOrigin(0, 0)
      .setStrokeStyle(2, GOLD_ACCENT);
    container.addAt(bg, 0);

    let y = menuTop + 8;
    const title = this.add.text(MENU_X + MENU_WIDTH / 2, y, 'MOVES', { ...titleStyle, color: GOLD_ACCENT_HEX }).setOrigin(0.5, 0);
    container.add(title);
    y += title.height + 4;
    const legend = this.add
      .text(MENU_X + MENU_WIDTH / 2, y, '!! no natural defense (2x)', { ...legendStyle, color: REFERENCE_BLUE_GREY_HEX, align: 'center' })
      .setOrigin(0.5, 0);
    container.add(legend);
    y += legend.height + 8;

    let rowY = y;
    let pagerRowH = 0;
    if (showPager) {
      const leftArrow = this.add
        .text(MENU_X + 14, rowY, '◀', { ...arrowStyle, color: GOLD_ACCENT_HEX })
        .setOrigin(0.5, 0)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.switchMovePage(-1));
      const rightArrow = this.add
        .text(MENU_X + MENU_WIDTH - 14, rowY, '▶', { ...arrowStyle, color: GOLD_ACCENT_HEX })
        .setOrigin(0.5, 0)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.switchMovePage(1));
      container.add(leftArrow);
      container.add(rightArrow);
      pagerRowH = Math.max(leftArrow.height, rightArrow.height);
    }
    const headerLabel = this.add
      .text(MENU_X + MENU_WIDTH / 2, rowY, headerLabelText, { ...headerStyle, color: REFERENCE_BLUE_GREY_HEX })
      .setOrigin(0.5, 0);
    container.add(headerLabel);
    // The arrow glyphs render at a larger px than the header label, so
    // advancing by the label's own height alone would let the taller arrows
    // bleed into the first move row -- advance by whichever is taller.
    rowY += Math.max(headerLabel.height, pagerRowH);
    if (section.legend) {
      const legendLine = this.add
        .text(MENU_X + MENU_WIDTH / 2, rowY, section.legend, { ...sectionLegendStyle, color: REFERENCE_BLUE_GREY_HEX })
        .setOrigin(0.5, 0);
      container.add(legendLine);
      rowY += legendLine.height + HEADER_LEGEND_GAP;
    }
    rowY += HEADER_ROWS_GAP;

    section.ids.forEach((moveId) => {
      this.addMoveButton(container, moveId, rowY, btnPx, padY);
      rowY += rowH;
    });
  }

  // The button label text and its color -- shared by addMoveButton (the
  // real interactive button) below. Kondo's self-buff moves (KONDO_MOVE_IDS)
  // get their own early return: no mismatch check (they never attack, so
  // canHost doesn't apply -- calling it here would read every one of them
  // as mismatched, since 'screening' is deliberately off every type's
  // MOVE_COMPATIBILITY list) and no power number (never read as damage, see
  // MOVES' own comment), just moveDisplayName's own fallback for a
  // 'screening'-class move (its fixed name plus Feynman's level prefix, see
  // that function's own comment for why it can't read tunedMoveDisplayName
  // directly here).
  //
  // A single "name — details" line rather than a forced two-line name/Pwr
  // split -- addMoveButton's own wordWrap only breaks this onto a second
  // line for a genuinely long label (a long tuned name plus an Ultimate's
  // ★★★ and a mismatch !!2x tag all at once), so a short label like "Phonon
  // Beam — Pwr 6" renders on one line instead of always reserving room for
  // two. Always the player's own move menu, so Feynman's level prefix/
  // effective power apply unconditionally here (unlike resolveHit's own
  // isPlayer-gated read, see that method's own comment).
  private moveButtonContent(moveId: string): { text: string; color: string } {
    if (KONDO_MOVE_IDS.includes(moveId)) {
      return { text: `${moveDisplayName(this.game.registry, moveId)} — ${STATUS_DURATION}-turn buff`, color: STATUS_PILL_COLOR };
    }
    const mismatch = !canHost(this.opponentView().type, getTunedMoveClass(this.game.registry, moveId));
    let tag = '';
    let color = '#ffff88';
    if (ANALYTIC_MOVE_IDS.includes(moveId)) {
      tag += ' ★';
      color = GOLD_ACCENT_HEX;
    }
    if (ULTIMATE_MOVE_IDS.includes(moveId)) {
      tag += ' ★★★';
      color = '#ff66ff';
    }
    if (mismatch) {
      tag += ' !!2x';
      color = '#ffaa44';
    }
    const displayName = moveDisplayName(this.game.registry, moveId);
    const power = Math.round(effectiveMovePower(this.game.registry, moveId));
    return { text: `${displayName} — Pwr ${power}${tag}`, color };
  }

  // One move button -- factored out of drawMoveMenu so the per-section loop
  // above doesn't duplicate the click-handler logic three times over.
  private addMoveButton(container: Phaser.GameObjects.Container, moveId: string, y: number, btnPx: number, padY: number) {
    const move = MOVES[moveId];
    const { text, color } = this.moveButtonContent(moveId);
    const btn = this.add
      .text(MENU_X + MENU_WIDTH / 2, y, text, {
        fontSize: `${btnPx}px`,
        color,
        backgroundColor: '#222244',
        padding: { x: 8, y: padY },
        align: 'center',
        wordWrap: { width: MENU_WIDTH - 16 },
      })
      .setOrigin(0.5, 0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        if (this.turnLock) return;
        if (ANALYTIC_MOVE_IDS.includes(moveId)) {
          this.turnLock = true;
          this.showAnalyticQuestion(move, (bonusMultiplier) => {
            this.turnLock = false;
            this.playerAttack(moveId, bonusMultiplier);
          });
        } else if (ULTIMATE_MOVE_IDS.includes(moveId)) {
          this.turnLock = true;
          this.showUltimateQuestions(move, (allCorrect) => {
            this.turnLock = false;
            this.playerAttack(moveId, allCorrect ? 1 : 0);
          });
        } else {
          this.playerAttack(moveId);
        }
      });
    container.add(btn);
  }

  // The question panel an analytic move (Laughlin's `skyfallBeam`/`groundEruption`,
  // §5) opens before it resolves -- turnLock is already true by
  // the time this is called (the move button handler sets it before
  // calling this), so no other move/menu interaction can happen underneath
  // it. Both options lead to `onAnswered`, which the caller uses to release
  // turnLock and re-enter the normal attack flow via playerAttack -- there
  // is no third way out (no cancel), so every path this panel can take
  // ends in the lock being released, same invariant playerAttack/resolveHit
  // already rely on.
  private showAnalyticQuestion(move: Move, onAnswered: (bonusMultiplier: number) => void) {
    const question = getAnalyticQuestion(this.game.registry.get('visitedWorlds') as number[]);
    const container = this.add.container(0, 0).setDepth(100);

    const panelWidth = 520;
    const top = 90;
    let y = top + 16;

    const title = this.add
      .text(FIELD_W / 2, y, moveDisplayName(this.game.registry, move.id), {
        fontSize: fontPx(this, 15),
        color: GOLD_ACCENT_HEX,
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 0);
    container.add(title);
    y += title.height + 8;

    const prompt = this.add
      .text(FIELD_W / 2, y, question.prompt, {
        fontSize: fontPx(this, 12),
        color: '#ffffff',
        align: 'center',
        wordWrap: { width: panelWidth - 60 },
      })
      .setOrigin(0.5, 0);
    container.add(prompt);
    y += prompt.height + 14;

    const options = Phaser.Utils.Array.Shuffle([
      { text: question.correct, correct: true },
      { text: question.incorrect, correct: false },
    ]);

    const finish = (correct: boolean) => {
      container.destroy(true);
      onAnswered(correct ? ANALYTIC_CORRECT_MULTIPLIER : ANALYTIC_WRONG_MULTIPLIER);
    };

    options.forEach((opt) => {
      const btn = this.addAnswerButton(container, y, opt.text, () => finish(opt.correct));
      y += btn.height + 8;
    });

    const panelHeight = y - top + 10;
    const panel = this.add
      .rectangle(FIELD_W / 2, top + panelHeight / 2, panelWidth, panelHeight, PANEL_BG, 0.94)
      .setStrokeStyle(2, GOLD_ACCENT);
    container.addAt(panel, 0);
  }

  private addAnswerButton(container: Phaser.GameObjects.Container, y: number, label: string, onClick: () => void) {
    const btn = this.add
      .text(FIELD_W / 2, y, label, {
        fontSize: fontPx(this, 12),
        color: '#ffff88',
        backgroundColor: '#222244',
        padding: { x: 10, y: 5 },
        align: 'center',
        wordWrap: { width: 440 },
      })
      .setOrigin(0.5, 0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', onClick);
    container.add(btn);
    return btn;
  }

  // The three-question gate an Ultimate move (Skłodowska-Curie's two moves,
  // §5) opens before it resolves -- turnLock is already true by the time
  // this is called (the move button handler sets it before calling this),
  // same invariant showAnalyticQuestion relies on. Unlike Analytic's single
  // question, ALL 3 must be answered correctly for the move to land at all --
  // stops at the first wrong answer rather than forcing the player through
  // all 3 regardless, since the outcome (whiff) is already decided at that
  // point. Every path through this panel ends in onAnswered being called
  // exactly once, which the caller uses to release turnLock and re-enter the
  // normal attack flow via playerAttack (bonusMultiplier 1 or 0) -- same
  // "no third way out" invariant showAnalyticQuestion already relies on.
  private showUltimateQuestions(move: Move, onAnswered: (allCorrect: boolean) => void) {
    const questions = getUltimateQuestions(3);
    let index = 0;

    const askNext = () => {
      if (index >= questions.length) {
        onAnswered(true);
        return;
      }
      const question = questions[index];
      index += 1;
      const container = this.add.container(0, 0).setDepth(100);

      const panelWidth = 520;
      const top = 90;
      let y = top + 16;

      const title = this.add
        .text(
          FIELD_W / 2,
          y,
          `${moveDisplayName(this.game.registry, move.id)} -- question ${index}/${questions.length}`,
          { fontSize: fontPx(this, 15), color: '#ff66ff', fontStyle: 'bold' }
        )
        .setOrigin(0.5, 0);
      container.add(title);
      y += title.height + 8;

      const prompt = this.add
        .text(FIELD_W / 2, y, question.prompt, {
          fontSize: fontPx(this, 12),
          color: '#ffffff',
          align: 'center',
          wordWrap: { width: panelWidth - 60 },
        })
        .setOrigin(0.5, 0);
      container.add(prompt);
      y += prompt.height + 14;

      const options = Phaser.Utils.Array.Shuffle([
        { text: question.correct, correct: true },
        { text: question.incorrect, correct: false },
      ]);

      const finish = (correct: boolean) => {
        container.destroy(true);
        if (!correct) {
          onAnswered(false);
          return;
        }
        askNext();
      };

      options.forEach((opt) => {
        const btn = this.addAnswerButton(container, y, opt.text, () => finish(opt.correct));
        y += btn.height + 8;
      });

      const panelHeight = y - top + 10;
      const panel = this.add
        .rectangle(FIELD_W / 2, top + panelHeight / 2, panelWidth, panelHeight, PANEL_BG, 0.94)
        .setStrokeStyle(2, 0xff66ff);
      container.addAt(panel, 0);
    };

    askNext();
  }

  // Colored from that world's own biome (art/biomes.ts, the same table
  // OverworldScene's corridor uses) instead of a fixed pastoral meadow --
  // every world's battles used to render the same green-hills-and-blue-sky
  // arena regardless of whether the fight was in a frozen cavern or a
  // cracked, glitching world.
  private drawBackground() {
    const biome = getBiome(this.world);
    const g = this.add.graphics();

    // Sky, brightest near the horizon where it meets the ridgeline.
    g.fillGradientStyle(biome.skyTop, biome.skyTop, biome.skyBottom, biome.skyBottom, 1);
    g.fillRect(0, 0, FIELD_W, HORIZON_Y);

    if (biome.clouds) {
      this.drawSun(560, 55);
      this.drawCloud(90, 40);
      this.drawCloud(230, 70);
      this.drawCloud(540, 40);
    }

    // Layered ridgelines behind the field, hazier and bluer the further
    // back they sit, giving the field actual depth instead of a flat
    // two-tone sky/ground split -- shaded off the biome's own hill/ground
    // colors so the layering effect survives across every palette.
    this.drawRidge(g, HORIZON_Y - 20, shade(biome.hillColor, 25), biome.hillAlpha * 0.85, [40, 150, 40, 170, 30, 140, 20, 160, 40]);
    this.drawRidge(g, HORIZON_Y - 4, biome.hillColor, biome.hillAlpha, [10, 70, 25, 95, 15, 60, 30, 80, 10]);
    this.drawRidge(g, HORIZON_Y + 6, shade(biome.ground, 22), 1, [5, 30, 10, 40, 6, 28, 12, 34, 5]);

    // Ground.
    g.fillGradientStyle(
      shade(biome.ground, 25),
      shade(biome.ground, 25),
      shade(biome.ground, -15),
      shade(biome.ground, -15),
      1
    );
    g.fillRect(0, HORIZON_Y, FIELD_W, FIELD_H - HORIZON_Y);

    this.drawBackgroundCrystals(biome);
    this.drawGroundDetail(biome);

    const shadowColor = shade(biome.ground, -40);
    // Anchored to the live this.opponentPos (set before drawBackground() is
    // called, see create()'s own comment) rather than the plain OPPONENT_POS
    // constant, so the shadow still sits under the crystal in a rival fight,
    // where the opponent actually renders at BOSS_OPPONENT_POS instead.
    this.add.ellipse(this.opponentPos.x, 195, 120, 28, shadowColor, 0.35);
    this.add.ellipse(PLAYER_POS.x, 392, 130, 30, shadowColor, 0.35);
  }

  // A jagged ridge silhouette spanning the field width, from a flat
  // baseline up through a zig-zag of peaks -- used for both the hazy
  // far mountains and the closer, darker foothills.
  private drawRidge(
    g: Phaser.GameObjects.Graphics,
    baseY: number,
    color: number,
    alpha: number,
    peaks: number[]
  ) {
    const stepX = FIELD_W / (peaks.length - 1);
    g.fillStyle(color, alpha);
    g.beginPath();
    g.moveTo(0, baseY);
    peaks.forEach((h, i) => g.lineTo(i * stepX, baseY - h));
    g.lineTo(FIELD_W, baseY);
    g.closePath();
    g.fillPath();
  }

  private drawSun(x: number, y: number) {
    const g = this.add.graphics();
    g.fillStyle(0xfff6c9, 0.35);
    g.fillCircle(x, y, 34);
    g.fillStyle(0xfff9e0, 0.9);
    g.fillCircle(x, y, 18);
  }

  private drawCloud(x: number, y: number) {
    const g = this.add.graphics();
    g.fillStyle(0xffffff, 0.85);
    g.fillEllipse(x, y, 46, 20);
    g.fillEllipse(x - 18, y + 4, 30, 16);
    g.fillEllipse(x + 18, y + 4, 30, 16);
  }

  // A couple of small crystal outcrops jutting from the field itself --
  // purely decorative (no gameplay meaning), giving the arena a "quantum
  // materials" identity instead of a generic pastoral RPG field. Tinted off
  // the biome's own path color so they still read as an accent rather than
  // clashing with a world whose palette isn't blue/green.
  private drawBackgroundCrystals(biome: Biome) {
    const outcrop = makeCrystal(this, 16, shade(biome.path, 10), 'prism');
    outcrop.setPosition(70, 250);
    outcrop.setAlpha(0.8);

    const outcrop2 = makeCrystal(this, 11, shade(biome.path, -10), 'shard');
    outcrop2.setPosition(95, 258);
    outcrop2.setAlpha(0.75);

    // Sits just inside the move menu's left edge (MENU_X).
    const outcrop3 = makeCrystal(this, 13, shade(biome.hillColor, 25), 'shard');
    outcrop3.setPosition(MENU_X - 40, 252);
    outcrop3.setAlpha(0.8);
  }

  // Scattered pebbles and ground tufts across the field so the ground
  // reads as textured, not a flat gradient fill -- tufts tint off the
  // biome's path color (grass green in the meadow, icy blue in the frozen
  // caverns, ...) rather than a hardcoded grass green everywhere.
  private drawGroundDetail(biome: Biome) {
    const g = this.add.graphics();
    // Spread across the field's visible width, staying just inside the
    // move menu's left edge (MENU_X).
    const spots: [number, number][] = [
      [36, 300], [590, 290], [549, 340], [111, 380], [25, 420],
      [MENU_X - 25, 400], [356, 300], [271, 440], [453, 420], [527, 460],
      [153, 300], [MENU_X - 44, 220],
    ];
    spots.forEach(([x, y], i) => {
      const tuftColor = shade(biome.path, -10 - (y - HORIZON_Y) * 0.15);
      if (i % 3 === 0) {
        g.fillStyle(shade(biome.ground, -30), 0.55);
        g.fillEllipse(x, y, 10, 4);
        g.fillEllipse(x + 5, y + 2, 6, 3);
      } else {
        g.fillStyle(tuftColor, 0.6);
        [0, 1, 2].forEach((j) => {
          const ang = -Math.PI / 2 + (j - 1) * 0.5;
          g.fillTriangle(x, y, x + Math.cos(ang) * 3, y + Math.sin(ang) * 9, x + 3, y);
        });
      }
    });
  }

  // Correct-answer bonus: a "super saiyan" golden aura -- concentric glow
  // rings, a rotating ring of radiant spikes (additive-blended so they
  // actually glow instead of just being solid gold shapes), and rising
  // embers -- all added behind the crystal's own shapes (index 0) so the
  // crystal itself stays on top and readable.
  private addBoostHalo(container: Phaser.GameObjects.Container) {
    const glow = this.add.graphics();
    glow.setBlendMode(Phaser.BlendModes.ADD);
    glow.fillStyle(GOLD_ACCENT, 0.18);
    glow.fillCircle(0, 0, 58);
    glow.lineStyle(3, GOLD_ACCENT, 0.9);
    glow.strokeCircle(0, 0, 44);
    glow.lineStyle(6, 0xffcc33, 0.4);
    glow.strokeCircle(0, 0, 52);
    container.addAt(glow, 0);
    this.tweens.add({
      targets: glow,
      alpha: { from: 0.6, to: 1 },
      scaleX: { from: 0.9, to: 1.18 },
      scaleY: { from: 0.9, to: 1.18 },
      duration: 500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    const spikes = this.add.graphics();
    spikes.setBlendMode(Phaser.BlendModes.ADD);
    const spikeCount = 10;
    for (let i = 0; i < spikeCount; i++) {
      const ang = (i / spikeCount) * Math.PI * 2;
      spikes.lineStyle(2, 0xfff2b0, 0.85);
      spikes.lineBetween(Math.cos(ang) * 34, Math.sin(ang) * 34, Math.cos(ang) * 72, Math.sin(ang) * 72);
    }
    container.addAt(spikes, 0);
    this.tweens.add({ targets: spikes, angle: 360, duration: 2200, repeat: -1, ease: 'Linear' });

    for (let i = 0; i < 6; i++) {
      const ember = this.add.circle(Phaser.Math.Between(-22, 22), 34, Phaser.Math.Between(2, 3), GOLD_ACCENT, 0.9);
      container.add(ember);
      this.tweens.add({
        targets: ember,
        y: -70,
        alpha: 0,
        duration: 1000 + Math.random() * 500,
        delay: i * 180,
        repeat: -1,
        ease: 'Sine.easeOut',
      });
    }
  }

  // Wrong-answer penalty: a small grey raincloud drooping above the
  // player's crystal.
  private addFailCloud(container: Phaser.GameObjects.Container) {
    const cloud = this.add.graphics();
    cloud.fillStyle(0x777788, 0.9);
    cloud.fillEllipse(0, -58, 36, 16);
    cloud.fillEllipse(-15, -53, 22, 13);
    cloud.fillEllipse(15, -53, 22, 13);
    cloud.fillStyle(0x9999aa, 0.7);
    cloud.fillEllipse(0, -63, 26, 10);
    container.add(cloud);

    this.tweens.add({
      targets: cloud,
      y: '+=5',
      duration: 850,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private bobCrystal(container: Phaser.GameObjects.Container, baseY: number) {
    this.tweens.add({
      targets: container,
      y: baseY - 6,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private updateBars() {
    this.opponentHpBar.width = Math.max(0, (this.opponentHp / this.opponentMaxHp) * HP_BAR_FILL_W);
    this.playerHpBar.width = Math.max(0, (this.playerHp / this.playerMaxHp) * HP_BAR_FILL_W);
  }

  // Recursively kills every tween targeting a Container or any descendant of
  // it -- reused by transmuteAdapted below (World 10's rival) whenever it
  // destroys-and-rebuilds the opponent's makeBossCrystal() subtree mid-battle.
  // Plain `destroy(true)` reclaims the GameObjects but leaves any tween still
  // targeting them (the aura/orbit tweens inside makeBossCrystal, or the
  // sparkle tweens inside each shard's own makeCrystal(), see
  // drawTurnPreview's own comment on the same issue) ticking forever against
  // a dead object otherwise.
  private killTweensDeep(obj: Phaser.GameObjects.GameObject) {
    this.tweens.killTweensOf(obj);
    if (obj instanceof Phaser.GameObjects.Container) {
      obj.each((child: Phaser.GameObjects.GameObject) => this.killTweensDeep(child));
    }
  }

  // World 10's rival transmutation (§5/§6, DESIGN.md) -- called from
  // resolveHit's checkEndOrContinue once per player attack that resolves
  // against a still-living Adapted. Picks a new type at random from among
  // every MaterialType that genuinely hosts `moveClass` (typesHosting,
  // data/materials.ts's reverse MOVE_COMPATIBILITY lookup), then a real,
  // already-defined compound of that type from the full roster (allCrystals())
  // to become -- so the opponent reacts by taking on a type it can actually
  // host the class the player just used, the same "Polycrystalline
  // <compound> Golem" naming every other world's rival already follows. The
  // swap plays out as an in-field glow/dissolve/reform effect directly on
  // the boss's own sprite (playTransmuteGlow below), the same way an ordinary
  // attack effect or impactPunch's crit flash already renders in the field
  // rather than a separate panel/overlay. `this.wild.moves` (its real attack
  // moveset) is never touched by any of this, so it keeps fighting at the
  // same power it was authored with, just under a new disguise -- and HP was
  // never tied to its identity in the first place (`opponentMaxHp` stays
  // fixed for the whole battle regardless of how many times it transmutes).
  // `onDone` fires after a fixed TURN_GAP_MS beat (the same gap
  // every other turn transition uses), independent of the glow effect's own
  // exact runtime, the same "don't gate the game's own flow on a purely
  // decorative animation" pattern an ordinary non-Ultimate move's
  // playAttackEffect call already follows.
  private transmuteAdapted(moveClass: MoveClass, onDone: () => void) {
    const hostTypes = typesHosting(moveClass);
    const candidates = allCrystals().filter((m) => hostTypes.includes(m.type));
    if (candidates.length === 0) {
      onDone();
      return;
    }
    const picked = Phaser.Utils.Array.GetRandom(candidates);
    const newForm: Material = { ...picked, name: `Polycrystalline ${picked.name} Golem` };

    this.playTransmuteGlow(() => {
      this.adaptedForm = newForm;

      this.killTweensDeep(this.opponentCrystal);
      this.opponentCrystal.destroy(true);
      this.opponentCrystal = makeBossCrystal(this, BOSS_CRYSTAL_SIZE, newForm.color, newForm.variant);
      this.opponentCrystal.setPosition(this.opponentPos.x, this.opponentPos.y);
      this.bobCrystal(this.opponentCrystal, this.opponentPos.y);
      this.flashHit(this.opponentCrystal);

      this.opponentNameText.setText(newForm.name);
      this.setLogText(`${this.wild.name} reshapes into ${newForm.name}!`);
    });

    this.time.delayedCall(TURN_GAP_MS, onDone);
  }

  // The transmutation's own light effect, playing directly on/around the
  // boss's current sprite -- a bright glow rises in place (the "dissolve"
  // beat; `onSwap` fires right at its peak, hidden inside the flash, which
  // is where transmuteAdapted actually destroys the old crystal and builds
  // the new one), then fades back out scattering a handful of sparks
  // outward (the "reform" beat, now revealing the new crystal already
  // sitting underneath). Teal-green (`0x4ad9a0`) throughout, plus a matching
  // camera flash at the swap -- the same accent color Dresselhaus's own
  // transmutation panel uses (art/dresselhaus.ts), a stylistic nod tying
  // this to the game's one other "become a different crystal" moment,
  // distinct from any ordinary attack's own EFFECT_STYLE color.
  private playTransmuteGlow(onSwap: () => void) {
    const { x, y } = this.opponentPos;
    const RISE_MS = 360;
    const FALL_MS = 320;
    const g = this.add.graphics().setDepth(59).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: RISE_MS,
      ease: 'Cubic.easeIn',
      onUpdate: (tw) => {
        const t = tw.getValue() ?? 0;
        g.clear();
        g.fillStyle(0x4ad9a0, 0.6 * t);
        g.fillCircle(x, y, 12 + t * 84);
        g.lineStyle(3, 0xffffff, 0.85 * t);
        g.strokeCircle(x, y, 16 + t * 66);
      },
      onComplete: () => {
        onSwap();
        this.cameras.main.flash(180, 0x4a, 0xd9, 0xa0, false);

        for (let i = 0; i < 8; i++) {
          const ang = (i / 8) * Math.PI * 2;
          const spark = this.add.circle(x, y, 3, 0xbdffe8, 0.95).setBlendMode(Phaser.BlendModes.ADD);
          this.tweens.add({
            targets: spark,
            x: x + Math.cos(ang) * 60,
            y: y + Math.sin(ang) * 60,
            alpha: 0,
            duration: FALL_MS,
            ease: 'Cubic.easeOut',
            onComplete: () => spark.destroy(),
          });
        }

        this.tweens.addCounter({
          from: 1,
          to: 0,
          duration: FALL_MS,
          ease: 'Cubic.easeOut',
          onUpdate: (tw) => {
            const t = tw.getValue() ?? 0;
            g.clear();
            g.fillStyle(0x4ad9a0, 0.6 * t);
            g.fillCircle(x, y, 12 + t * 96);
            g.lineStyle(3, 0xffffff, 0.85 * t);
            g.strokeCircle(x, y, 16 + t * 82);
          },
          onComplete: () => g.destroy(),
        });
      },
    });
  }

  // Velocity decides who swings first each round, and by how much faster it
  // is, how many extra times it swings (DESIGN.md §4): `ratio` is the faster
  // side's effective Velocity divided by the slower side's, and the faster
  // side gets `clamp(floor(ratio), 1, 3)` hits this round -- the cap keeps an
  // extreme velocity gap from producing an unbounded hit sequence. The slower
  // side always still gets exactly one hit. Ties (ratio exactly 1) keep the
  // player going first, one hit each. Shared by `playerAttack` (which
  // actually resolves the round's hits) and `drawTurnPreview` (which reads it
  // to render the "Turns" widget) so the two can't drift apart.
  private currentHitOrder(): { fasterIsPlayer: boolean; fasterHits: number } {
    const playerVelocity = this.playerStats.velocity;
    const enemyVelocity = this.enemyStats.velocity;
    const fasterIsPlayer = playerVelocity >= enemyVelocity;
    const ratio = fasterIsPlayer ? playerVelocity / enemyVelocity : enemyVelocity / playerVelocity;
    const fasterHits = Phaser.Math.Clamp(Math.floor(ratio), 1, 3);
    return { fasterIsPlayer, fasterHits };
  }

  // Redraws the small "Turns" preview row in the field's top-left corner
  // (`TURN_PREVIEW_X/Y`): a best-effort look-ahead at the next
  // `TURN_PREVIEW_LENGTH` hits, built by tiling `currentHitOrder`'s one-round
  // pattern (the faster side's `fasterHits` icons, then the slower side's
  // one) out to that length. It's only exactly right if the player keeps
  // picking ordinary moves and neither side's stats change mid-sequence --
  // an Ultimate/Analytic pick (exempt from the multi-hit scaling) or one of
  // Kondo's self-buff moves (always resolves as the caster's own single
  // action for the round regardless of Velocity, see `playerAttack`) makes
  // that round's actual hit count deviate from the current preview, not a
  // bug, just the approximation this widget is meant to be. Called once
  // from `create()` and again every time a round actually finishes
  // (`playerAttack`'s `releaseLock`).
  //
  // Each icon's sparkles (`makeCrystal`/`addHighlightAndSparkles`) carry an
  // infinitely-repeating tween -- `Container.destroy(true)` destroys the
  // sparkle Text objects themselves but doesn't stop tweens still targeting
  // them, so a plain destroy-and-rebuild every round would leak a handful of
  // dead-but-still-ticking tweens per round for the rest of the battle.
  // Killing tweens of every descendant of the old row before destroying it
  // keeps this redraw actually cheap to call every round. The whose-turn
  // ring added behind each icon (below) is a plain static Arc with no tween
  // of its own, so it needs no special handling here -- killTweensOf on it
  // is just a harmless no-op, and `destroy(true)` still reclaims it along
  // with everything else in the row.
  private drawTurnPreview() {
    if (this.turnPreviewRow) {
      this.turnPreviewRow.each((icon: Phaser.GameObjects.GameObject) => {
        if (icon instanceof Phaser.GameObjects.Container) {
          icon.each((child: Phaser.GameObjects.GameObject) => this.tweens.killTweensOf(child));
        }
      });
      this.turnPreviewRow.destroy(true);
    }

    const { fasterIsPlayer, fasterHits } = this.currentHitOrder();
    const roundPattern: boolean[] = [];
    for (let i = 0; i < fasterHits; i++) roundPattern.push(fasterIsPlayer);
    roundPattern.push(!fasterIsPlayer);
    const sequence = Array.from({ length: TURN_PREVIEW_LENGTH }, (_, i) => roundPattern[i % roundPattern.length]);

    // Gap below the label padded out by how far the ring extends past the
    // icon's own half-size, so the ring never touches the label tag above
    // it at any font-scale preset (the ring is the widest thing in each
    // icon's footprint, wider than the crystal art itself).
    const previewRowY =
      this.turnPreviewLabel.y +
      this.turnPreviewLabel.height +
      4 +
      Math.max(0, TURN_PREVIEW_RING_RADIUS - TURN_PREVIEW_ICON_SIZE / 2);
    const container = this.add.container(TURN_PREVIEW_X, previewRowY);
    sequence.forEach((isPlayer, i) => {
      const material = isPlayer ? this.playerMaterial : this.opponentView();
      const icon = makeCrystal(this, TURN_PREVIEW_ICON_SIZE, material.color, material.variant, {
        seed: material.name,
        hybrid: material.hybridParents,
      });
      // Whose-turn ring behind the crystal shapes (`addAt(..., 0)`): a bold
      // full-opacity gold ring for the player's hits, matching this
      // project's established active/highlighted accent color, versus a
      // thinner, dimmer blue-grey ring (the same "inactive" tone used
      // elsewhere, e.g. the shop's inactive tab) for the opponent's --
      // keeps the row legible on whose turn is whose even when the two
      // sides happen to share the exact same crystal color (same-material
      // matchups, routine from world 9 onward).
      const ring = this.add.circle(0, 0, TURN_PREVIEW_RING_RADIUS);
      if (isPlayer) {
        ring.setStrokeStyle(3, GOLD_ACCENT, 1);
      } else {
        ring.setStrokeStyle(1.5, REFERENCE_BLUE_GREY, 0.45);
      }
      icon.addAt(ring, 0);
      icon.setPosition(i * TURN_PREVIEW_ICON_SPACING + TURN_PREVIEW_ICON_SIZE / 2, TURN_PREVIEW_ICON_SIZE / 2);
      container.add(icon);
    });
    this.turnPreviewRow = container;
  }

  private playerAttack(moveId: string, bonusMultiplier = 1) {
    if (this.turnLock) return;
    this.turnLock = true;

    const { fasterIsPlayer, fasterHits } = this.currentHitOrder();
    const playerFirst = fasterIsPlayer; // tie keeps player-first, same as currentHitOrder's own tie rule
    const opponentMoveId = () => Phaser.Utils.Array.GetRandom(this.wild.moves);

    const releaseLock = () => {
      this.turnLock = false;
      this.drawTurnPreview();
    };

    const exempt = ANALYTIC_MOVE_IDS.includes(moveId) || ULTIMATE_MOVE_IDS.includes(moveId);
    if (exempt) {
      if (playerFirst) {
        this.resolveHit(
          true,
          moveId,
          () => {
            if (this.opponentHp <= 0 || this.playerHp <= 0) return;
            this.time.delayedCall(TURN_GAP_MS, () => this.resolveHit(false, opponentMoveId(), releaseLock));
          },
          bonusMultiplier
        );
      } else {
        this.resolveHit(false, opponentMoveId(), () => {
          if (this.opponentHp <= 0 || this.playerHp <= 0) return;
          this.time.delayedCall(TURN_GAP_MS, () => this.resolveHit(true, moveId, releaseLock, bonusMultiplier));
        });
      }
      return;
    }

    // The round's full hit order: the faster side swings `fasterHits` times
    // (reusing the same moveId each time on the player's side; re-rolled
    // fresh from the wild's own moveset each time on the enemy's side, same
    // as its single hit always was), then the slower side swings once. One
    // exception: a Kondo self-buff move is always exactly one action for its
    // round, even if the caster is the faster side -- it isn't an attack
    // landing repeatedly on a defender, just a single technique the caster
    // applies to themselves, and repeating it would only refresh the same
    // buff to the same 3 turns with nothing else observable. The other
    // side's own `fasterHits` (if *they* are the faster side instead) is
    // untouched by this -- only the self-buff caster's own contribution to
    // `hits` collapses to one.
    const playerIsSelfBuff = KONDO_MOVE_IDS.includes(moveId);
    const hits: { isPlayer: boolean; moveId: string }[] = [];
    if (fasterIsPlayer) {
      const playerHitCount = playerIsSelfBuff ? 1 : fasterHits;
      for (let i = 0; i < playerHitCount; i++) hits.push({ isPlayer: true, moveId });
      hits.push({ isPlayer: false, moveId: opponentMoveId() });
    } else {
      for (let i = 0; i < fasterHits; i++) hits.push({ isPlayer: false, moveId: opponentMoveId() });
      hits.push({ isPlayer: true, moveId });
    }

    // A side's own buff (Kondo's three moves, §5) must apply/tick down at
    // most once per round, even when that side lands more than one hit this
    // round -- and it has to be that side's *last* action this round, not
    // its first: an existing buff (e.g. Regenerating on its final tick) has
    // to keep applying through every one of that side's earlier hits before
    // it expires, and a buff freshly cast this round shouldn't retroactively
    // apply to the actions that cast it, only the round after. Found by
    // scanning `hits` for each side's own last index, rather than assumed
    // from position, since the self-buff collapse above means a side's
    // block of hits isn't always exactly `fasterHits` long.
    const lastIndexFor = (isPlayer: boolean) => {
      let last = -1;
      hits.forEach((h, i) => {
        if (h.isPlayer === isPlayer) last = i;
      });
      return last;
    };
    const playerLastIndex = lastIndexFor(true);
    const enemyLastIndex = lastIndexFor(false);

    const runHit = (index: number) => {
      const hit = hits[index];
      const tickStatus = index === (hit.isPlayer ? playerLastIndex : enemyLastIndex);
      const isLastHit = index === hits.length - 1;
      this.resolveHit(
        hit.isPlayer,
        hit.moveId,
        () => {
          if (this.opponentHp <= 0 || this.playerHp <= 0) return;
          if (isLastHit) {
            releaseLock();
          } else {
            this.time.delayedCall(TURN_GAP_MS, () => runHit(index + 1));
          }
        },
        hit.isPlayer ? bonusMultiplier : 1,
        tickStatus
      );
    };

    runHit(0);
  }

  // Sets the combat-log text and repositions it upward just enough to keep
  // it on screen. Most per-turn messages are one line and rest at the usual
  // bottom-anchored LOG_Y, but a message that wraps to two lines (e.g. a
  // quasiparticle-mismatch hit's "No natural defense against this!" suffix)
  // would otherwise run its second line off the bottom of the canvas at a
  // fixed y -- `restY` lets endBattle's much longer summary reuse the same
  // clamp with a higher ceiling instead of duplicating it. `wrapWidth`
  // defaults to the ordinary in-battle width (kept clear of the move menu,
  // which shares this row's vertical band while a battle is still in
  // progress) -- endBattle passes the much wider LOG_WRAP_WIDTH_VICTORY
  // instead, since it destroys the move menu before ever calling this, so
  // there's no panel left to stay clear of.
  private setLogText(text: string, restY = LOG_Y, wrapWidth = LOG_WRAP_WIDTH) {
    this.logText.setWordWrapWidth(wrapWidth);
    this.logText.setText(text);
    const y = Math.max(8, Math.min(restY, FIELD_H - this.logText.height - 16));
    this.logText.setPosition(20, y);
  }

  // Shared by both the player's and the opponent's swings -- the only
  // difference is which side is attacking, so the damage/crit/log/effect
  // logic lives here once instead of duplicated per side. `bonusMultiplier`
  // is the Analytic-move correct/wrong multiplier or the Ultimate-move
  // all-correct/whiff multiplier (default 1, a no-op for every ordinary
  // move) -- always already decided by the time this runs
  // (showAnalyticQuestion/showUltimateQuestions resolve before playerAttack
  // ever calls this). For every non-Ultimate move the tail below (damage/log/
  // win-lose/onDone) still runs synchronously right after the animation
  // fires, same as ever. For Skłodowska-Curie's two Ultimate moves (§5,
  // World 10) it doesn't: their 4-6s multi-phase animation
  // (art/attackEffects.ts's playMeteor/playNova) needs the damage/log to
  // land in sync with the animation's own impact beat (not ~5s early) and
  // the win/lose check + onDone (which schedules the opponent's counter-
  // swing) to wait until the full animation has actually finished playing --
  // see applyResult/checkEndOrContinue and the isUltimate branch at the
  // bottom of this method. `tickStatus` (default true) gates whether this
  // call is allowed to apply/tick down the *attacking* side's own Kondo buff
  // (§5) -- playerAttack passes true only for that side's *last* action
  // within the round, so a side that lands more than one hit this round
  // (the velocity-ratio multi-attack rule, DESIGN.md §4) still only has its
  // own buff resolved once per round. One of Kondo's three moves (§5) is a
  // self-buff, not an attack -- routed to `resolveSelfBuff` below instead,
  // before any of the attack-only terms (mismatch, crit, damage) are
  // computed at all.
  private resolveHit(isPlayer: boolean, moveId: string, onDone: () => void, bonusMultiplier = 1, tickStatus = true) {
    const move = MOVES[moveId];
    if (KONDO_MOVE_IDS.includes(moveId)) {
      this.resolveSelfBuff(isPlayer, move, tickStatus, onDone);
      return;
    }
    const attackerStats = isPlayer ? this.playerStats : this.enemyStats;
    const defenderStats = isPlayer ? this.enemyStats : this.playerStats;
    const defenderType = isPlayer ? this.opponentView().type : this.playerMaterial.type;
    const defenderIsPlayer = !isPlayer;
    // A defender whose own physics can't host this quasiparticle at all (no
    // magnetic order to carry a magnon pulse, no gauge structure for an
    // anyon braid, ...) has no natural way to dampen it -- it lands at
    // double force. This is the only type-interaction term battle damage
    // has (DESIGN.md §4) -- there is no separate strong/weak type chart on
    // top of it. Every move's own fixed `class` decides this, except for a
    // tunable move (Laughlin's Analytic pair, Skłodowska-Curie's Ultimate
    // pair) once tuned via the owning guardian's picker: getTunedMoveClass
    // swaps in whatever quasiparticle the player assigned instead of the
    // move's default 'phonon', so a tuned move mismatches like an ordinary
    // attack of that class would -- on top of, not instead of,
    // bonusMultiplier from the question. Franklin's Amorphous Halo (§5)
    // softens this to a smaller multiplier for whichever side has it active
    // as the defender -- a defect-broadened diffraction halo partially
    // shrugging off a hit that would otherwise land unmitigated.
    const effectiveClass = getTunedMoveClass(this.game.registry, moveId);
    const mismatch = !canHost(defenderType, effectiveClass);
    const mismatchMultiplier = this.activePassives(defenderIsPlayer).has('edgeCurrent')
      ? EDGE_CURRENT_MISMATCH_MULT
      : MISMATCH_MULTIPLIER;
    const mismatchMult = mismatch ? mismatchMultiplier : 1;

    const attackMult = isPlayer ? this.attackMultiplier : 1;
    // Kondo's Screening Pulse buff (§5): incoming damage to whichever side
    // currently has Shielded active is multiplied down, symmetric like
    // every other resolveHit term, not hardcoded to "opponent only".
    const shieldedMult = this.statusShieldMultiplier(defenderIsPlayer);
    // Franklin's Diffraction Shadow (§5): incoming damage to whichever side
    // has it active is multiplied down for the whole battle -- a defect-
    // riddled lattice scatters and attenuates the blow, the way porous
    // carbon attenuates an X-ray beam.
    const fractionalGuardMult = this.activePassives(defenderIsPlayer).has('fractionalGuard')
      ? FRACTIONAL_GUARD_DAMAGE_MULT
      : 1;
    // Feynman's move-leveling (§5): a leveled move's own base power is
    // scaled up by its current tier's multiplier -- the player's own save
    // state only, so an opponent's copy of the same move id is never
    // affected by it.
    const power = isPlayer ? effectiveMovePower(this.game.registry, moveId) : move.power;
    // The crit-chance/defense-factor/final-product math lives in
    // data/balance.ts's resolveHitDamage (Phaser-free, shared with the
    // balance simulator script) -- this just assembles this hit's own
    // per-term multipliers and reads back the damage + whether it crit.
    const { damage: dmg, crit } = resolveHitDamage({
      attackerStats,
      defenderStats,
      power,
      mismatch,
      mismatchMultiplier,
      attackMult,
      bonusMultiplier,
      shieldedMult,
      fractionalGuardMult,
    });
    // Kondo's Scattering Drag buff (§5): a defender with Evasive active has
    // a chance (statusEvasionChance -- 0 when not evasive) to dodge this hit
    // entirely regardless of the damage just computed above -- checked once
    // per hit, independent of mismatch/crit (a dodged hit never happened, it
    // doesn't matter how hard it would have landed).
    const evaded = Math.random() < this.statusEvasionChance(defenderIsPlayer);

    const from = isPlayer ? PLAYER_POS : this.opponentPos;
    const to = isPlayer ? this.opponentPos : PLAYER_POS;
    const targetCrystal = isPlayer ? this.opponentCrystal : this.playerCrystal;
    const shapeOverride = ANALYTIC_SHAPES[move.id] ?? ULTIMATE_SHAPES[move.id];
    const isUltimate = ULTIMATE_MOVE_IDS.includes(moveId);
    const whiff = isUltimate && bonusMultiplier === 0;

    // Applies the hit's damage/log/echo/heal. For an ordinary move this runs
    // synchronously right below (near-instant animation, no desync risk). For
    // an Ultimate move it's deferred until the multi-second animation's own
    // impact beat instead (see the branch at the bottom of this method), so
    // the HP bar/log line land in sync with what's on screen rather than
    // seconds ahead of it.
    const applyResult = () => {
      const who = isPlayer ? 'You' : `Wild ${this.opponentView().name}`;
      const defenderName = defenderIsPlayer ? this.playerMaterial.name : this.opponentView().name;
      // Feynman's level prefix (§5) is the player's own save state -- an
      // opponent's own use of the same move id never carries it.
      const displayName = isPlayer
        ? moveDisplayName(this.game.registry, moveId)
        : tunedMoveDisplayName(this.game.registry, moveId);
      // The attacker's own Kondo buff (§5) ticks/casts regardless of whether
      // this particular hit lands -- it's the attacker's own technique, not
      // something that depends on the defender. Gated by `tickStatus` (see
      // resolveHit's own comment) rather than firing on every hit, since a
      // faster side can land more than one hit in a single round. See
      // applyOrTickBuff.
      const buffText = tickStatus ? this.applyOrTickBuff(move, isPlayer) : '';

      if (evaded) {
        this.setLogText(`${who} used ${displayName}, but ${defenderName} evaded it!${buffText}`);
        return;
      }

      this.applyDamage(defenderIsPlayer, dmg);

      const mismatchText = mismatch ? ' No natural defense against this!' : '';
      const critText = crit ? ' A coherent critical hit!' : '';

      // Franklin's Satellite Reflection (§5): a crit from a side with it
      // active triggers a bonus follow-up tick against the same defender,
      // computed after the buff clause above so it still reads as part of
      // the same hit's log line -- fixed order (mismatch, crit, buff, echo,
      // heal), same "stack a clause onto the existing line" pattern every
      // other term here uses.
      let echoText = '';
      if (crit && this.activePassives(isPlayer).has('anyonEcho')) {
        const echoDmg = Math.round(dmg * ANYON_ECHO_FRACTION);
        if (echoDmg > 0) {
          this.applyDamage(defenderIsPlayer, echoDmg);
          this.impactPunch(targetCrystal);
          echoText = ` ${PASSIVES.anyonEcho.name} strikes again for ${echoDmg}!`;
        }
      }

      this.setLogText(
        whiff
          ? `${who}'s ${displayName} fizzles out -- the pattern never locked!`
          : `${who} used ${displayName}! (${dmg} dmg)${mismatchText}${critText}${buffText}${echoText}`
      );
    };

    // Win/lose check + turn handoff. For an ordinary move this runs right
    // after applyResult, synchronously below. For an Ultimate move it's
    // deferred to the animation's onComplete instead, so the opponent's
    // counter-swing can't be scheduled (and the battle can't end) until the
    // full summon animation has actually finished playing.
    //
    // World 10's rival transmutation (adaptedForm, transmuteAdapted below)
    // fires from here rather than from applyResult -- `isPlayer` already
    // excludes the opponent's own swings, the two win/lose branches above
    // already return before it, and Kondo's self-buff moves never reach this
    // function at all (resolveHit's own early return above), so this is
    // exactly "every player Attack/Analytic/Ultimate move that resolves
    // against a living Adapted," with no separate condition needed. The
    // *current* hit already checked its own mismatch above against whatever
    // type the opponent was *before* this -- the adaptation is a reaction to
    // the class just used, not a precognitive dodge of this hit.
    const checkEndOrContinue = () => {
      if (this.opponentHp <= 0) {
        this.endBattle(true);
        return;
      }
      if (this.playerHp <= 0) {
        this.endBattle(false);
        return;
      }
      if (isPlayer && this.adaptedForm) {
        this.transmuteAdapted(effectiveClass, onDone);
        return;
      }
      onDone();
    };

    if (isUltimate) {
      playAttackEffect(
        this,
        effectiveClass,
        from,
        to,
        () => {
          this.impactPunch(targetCrystal);
          applyResult();
        },
        mismatchMult * bonusMultiplier,
        shapeOverride,
        () => checkEndOrContinue(),
        whiff
      );
      return;
    }

    playAttackEffect(this, effectiveClass, from, to, () => this.impactPunch(targetCrystal), mismatchMult * bonusMultiplier, shapeOverride);
    applyResult();
    checkEndOrContinue();
  }

  // Which of Franklin's passives (data/passives.ts) are currently
  // active for a given side -- read once per battle in create(), see that
  // field's own comment. Generic over `isPlayer` the same way
  // getStatus/statusShieldMultiplier below are, even though only the player
  // can currently have one.
  private activePassives(isPlayer: boolean): Set<string> {
    return isPlayer ? this.playerActivePassives : this.opponentActivePassives;
  }

  // Applies damage to whichever side is the defender, mirroring the
  // registry-write/persist rule the original inline branch used: only the
  // player's HP needs to survive a reload, so only that branch touches the
  // registry. Shared by resolveHit's primary hit and Anyon Echo's bonus tick
  // so both go through the exact same bookkeeping.
  private applyDamage(toPlayer: boolean, amount: number) {
    if (toPlayer) {
      this.playerHp = Math.max(0, this.playerHp - amount);
      this.game.registry.set('playerHp', this.playerHp);
      persistFromRegistry(this.game.registry);
    } else {
      this.opponentHp = Math.max(0, this.opponentHp - amount);
    }
    this.updateBars();
  }

  // Regenerating's per-tick heal (applyRegenTick, §4/§5) -- the healing
  // counterpart to applyDamage above, capped at `maxHp` rather than clamped
  // at 0.
  private applyHeal(toPlayer: boolean, amount: number, maxHp: number) {
    if (toPlayer) {
      this.playerHp = Math.min(maxHp, this.playerHp + amount);
      this.game.registry.set('playerHp', this.playerHp);
      persistFromRegistry(this.game.registry);
    } else {
      this.opponentHp = Math.min(maxHp, this.opponentHp + amount);
    }
    this.updateBars();
  }

  private getStatus(isPlayer: boolean): ActiveStatus | null {
    return isPlayer ? this.playerStatus : this.opponentStatus;
  }

  private setStatus(isPlayer: boolean, status: ActiveStatus | null) {
    if (isPlayer) this.playerStatus = status;
    else this.opponentStatus = status;
    this.renderStatusLabel(isPlayer);
  }

  private statusShieldMultiplier(isPlayer: boolean): number {
    if (this.getStatus(isPlayer)?.kind !== 'shielded') return 1;
    return 1 - this.kondoMitigationFraction(isPlayer, 'screeningCloud', SHIELD_BASE_REDUCTION, SHIELD_MAX_REDUCTION);
  }

  private statusEvasionChance(isPlayer: boolean): number {
    if (this.getStatus(isPlayer)?.kind !== 'evasive') return 0;
    return this.kondoMitigationFraction(isPlayer, 'scatteringDrag', EVASION_BASE_CHANCE, EVASION_MAX_CHANCE);
  }

  // Scales one of Kondo's three buffs' base mitigation strength by the
  // *caster's own* level of the specific move that cast it (Feynman's
  // move-leveling, §5), capped at `cap` -- gated on `isPlayer` the same way
  // `effectiveMovePower` is: `moveLevels` is the player's own save state,
  // and no wild ever casts a Kondo move in the first place (see
  // `KONDO_MOVE_IDS`' own comment in data/materials.ts), so an opponent's
  // copy of the same buff always reads the flat, unleveled `base` instead.
  private kondoMitigationFraction(isPlayer: boolean, moveId: string, base: number, cap: number): number {
    if (!isPlayer) return base;
    const multiplier = MOVE_LEVEL_MULTIPLIERS[getMoveLevel(this.game.registry, moveId)];
    return mitigationFraction(multiplier, base, cap);
  }

  // Resolves one of Kondo's three self-buff moves (§5, KONDO_MOVE_IDS) --
  // routed here from resolveHit's own early branch, before any attack-only
  // term (mismatch, crit, damage) is ever computed, since a self-buff never
  // hits the opponent at all. Plays the same windup+ring beat an ordinary
  // 'screening'-class hit would (art/attackEffects.ts's EFFECT_STYLE still
  // has an entry for it), just centered on the caster's own position instead
  // of traveling to the opponent's -- a squash bounce on the caster's own
  // crystal reads as the buff taking hold without the camera shake/flash
  // `impactPunch` gives an ordinary "hit landed" beat, which would read as
  // the caster taking damage instead. Never changes either side's HP by
  // itself (Regenerating only ever heals, on a later tick -- see
  // applyOrTickBuff/applyRegenTick), so there is no win/lose check to make
  // here the way resolveHit's own tail has to.
  private resolveSelfBuff(isPlayer: boolean, move: Move, tickStatus: boolean, onDone: () => void) {
    const who = isPlayer ? 'You' : `Wild ${this.opponentView().name}`;
    const pos = isPlayer ? PLAYER_POS : this.opponentPos;
    const targetCrystal = isPlayer ? this.playerCrystal : this.opponentCrystal;

    playAttackEffect(this, move.class, pos, pos, () => this.flashHit(targetCrystal), 1);

    const buffText = tickStatus ? this.applyOrTickBuff(move, isPlayer) : '';
    // Feynman's level prefix (§5) is the player's own save state -- see
    // resolveHit's own applyResult for the same isPlayer-gated read.
    const displayName = isPlayer ? moveDisplayName(this.game.registry, move.id) : move.name;
    this.setLogText(`${who} used ${displayName}!${buffText}`);

    onDone();
  }

  // Called from a resolveHit/resolveSelfBuff whose own `tickStatus` was true
  // -- playerAttack only ever passes true for a side's *last* action within
  // the round (so an existing buff stays active through every one of that
  // side's earlier hits that round, and a buff cast this round doesn't
  // retroactively apply to the actions that cast it), so this always fires
  // at most once per round per side, even when a side lands more than one
  // hit (DESIGN.md §4's velocity-ratio multi-attack). If the move is one of
  // Kondo's three (KONDO_MOVE_BUFF), it replaces whatever buff the caster
  // already had outright -- one buff per side, never stacked. Otherwise it
  // ticks down whatever buff that side already carries by one, applying a
  // Regenerating heal on every tick (including the one that expires it --
  // see applyRegenTick), and clears/announces the buff once it expires.
  // Returns the log clause to append (empty string if nothing to report),
  // same "stack a clause onto the existing line" pattern as
  // mismatchText/critText use elsewhere.
  private applyOrTickBuff(move: Move, isPlayer: boolean): string {
    const casterName = isPlayer ? this.playerMaterial.name : this.opponentView().name;
    const kondoBuff = KONDO_MOVE_BUFF[move.id];
    if (kondoBuff) {
      this.setStatus(isPlayer, { kind: kondoBuff, turnsLeft: STATUS_DURATION });
      return ' ' + STATUS_INFO[kondoBuff].applyText(casterName);
    }
    const status = this.getStatus(isPlayer);
    if (!status) return '';
    const clauses: string[] = [];
    if (status.kind === 'regenerating') {
      const healClause = this.applyRegenTick(isPlayer, casterName);
      if (healClause) clauses.push(healClause);
    }
    status.turnsLeft -= 1;
    if (status.turnsLeft <= 0) {
      this.setStatus(isPlayer, null);
      clauses.push(STATUS_INFO[status.kind].expireText(casterName));
    } else {
      this.renderStatusLabel(isPlayer);
    }
    return clauses.length ? ' ' + clauses.join(' ') : '';
  }

  // Coherence Cascade's Regenerating buff (§5) -- heals the buffed side a
  // fraction of its own max HP (REGEN_BASE_HEAL_FRACTION, scaled by the
  // caster's own move level via kondoMitigationFraction), called once per
  // tick from applyOrTickBuff above, capped so it never overheals past
  // `maxHp`. Returns '' (no log clause) once the side is already at full
  // HP -- there is nothing to report on a fully-healed side.
  private applyRegenTick(isPlayer: boolean, casterName: string): string {
    const maxHp = isPlayer ? this.playerMaxHp : this.opponentMaxHp;
    const currentHp = isPlayer ? this.playerHp : this.opponentHp;
    const healFraction = this.kondoMitigationFraction(isPlayer, 'kondoBreakdown', REGEN_BASE_HEAL_FRACTION, REGEN_MAX_HEAL_FRACTION);
    const healAmount = Math.min(maxHp - currentHp, Math.round(maxHp * healFraction));
    if (healAmount <= 0) return '';
    this.applyHeal(isPlayer, healAmount, maxHp);
    return `${casterName} regenerates ${healAmount} HP!`;
  }

  // Updates (or clears) the small status pill under that side's HP bar --
  // called from setStatus (apply/expire) and from applyOrTickBuff's plain
  // tick-down path (turnsLeft changed but the buff is still active).
  private renderStatusLabel(isPlayer: boolean) {
    const label = isPlayer ? this.playerStatusLabel : this.opponentStatusLabel;
    const status = this.getStatus(isPlayer);
    label.setText(status ? `${STATUS_INFO[status.kind].label} (${status.turnsLeft})` : '');
    // Phaser fills a Text object's backgroundColor even when its string is
    // empty (nonzero line-height + padding still gives it an area to fill),
    // so the pill's background has to be toggled off explicitly rather than
    // left set -- otherwise an inactive status still renders as a bare box.
    label.setBackgroundColor(status ? 'rgba(0,0,0,0.35)' : '');
  }

  // Creates the passive pill (Franklin's abilities, §5) stacked below
  // that side's status pill at (x, naturalY), then measures its actual
  // rendered size and corrects position/existence rather than trusting
  // naturalY/x directly -- up to two joined passive names (passivePillText)
  // can run wide enough at the largest text-size setting to push past
  // maxRightX if left-anchored at the same x as the column above it (fixed
  // below by an x clamp; the player's own call site passes MENU_X rather
  // than FIELD_W, since the bottom-anchored move menu shares that side's
  // vertical band -- see MENU_MIN_TOP's own comment), and that same setting
  // can leave the whole stack above it (boost/fail note + name/bar row +
  // status pill, on the player side) taller than the room actually left
  // under FIELD_H (fixed below by dropping the pill rather than drawing it
  // back on top of the status pill it's stacked below).
  private addPassivePill(x: number, naturalY: number, text: string, statusBottom: number, maxRightX: number) {
    // Static for the whole battle (see this method's own comment above), so
    // unlike the status pill there's no later render pass to toggle a
    // background back off -- skip creating the label at all when there's no
    // passive to show, rather than drawing an empty box (Phaser fills a
    // Text object's backgroundColor even for an empty string).
    if (!text) return;
    const label = this.add
      .text(x, naturalY, text, {
        fontSize: fontPx(this, 11),
        color: PASSIVE_PILL_COLOR,
        backgroundColor: 'rgba(0,0,0,0.35)',
        padding: { x: 4, y: 1 },
      })
      .setOrigin(0, 0)
      .setDepth(5);
    const cappedY = Math.min(naturalY, FIELD_H - label.height - 4);
    // Vertical clamp only ever pulls the pill *up* off the canvas floor, never
    // down -- if pulling it up that far would land it back on top of the
    // status pill above it (the row it's stacked below in the first place),
    // that would trade "passive pill clipped" for "status pill unreadable,"
    // which is worse: the status pill already existed and already worked.
    // Drop the passive pill instead of showing it garbled -- this only
    // happens in the narrow combo of a boosted/weakened attack plus the
    // largest text-size setting, where there simply isn't room for a fifth
    // stacked row under the player crystal.
    if (cappedY < statusBottom) {
      label.destroy();
      return;
    }
    label.setPosition(Math.min(x, maxRightX - label.width), cappedY);
  }

  // Quick punchy scale-squash on the target crystal when a projectile
  // effect lands, so hits register even before the HP bar visibly moves.
  private flashHit(container: Phaser.GameObjects.Container) {
    this.tweens.add({ targets: container, scaleX: 1.18, scaleY: 0.82, duration: 90, yoyo: true });
  }

  // The full "hit landed" beat on top of art/attackEffects.ts's own impact
  // shockwave: the crystal squash, a small camera shake (kept subtle --
  // main.ts's canvas background is solid black, so anything punchier reveals
  // it at the field's fixed-coordinate edges), and a brief white flash.
  private impactPunch(container: Phaser.GameObjects.Container) {
    this.flashHit(container);
    this.cameras.main.shake(140, 0.006);
    this.cameras.main.flash(90, 255, 255, 255, false);
  }

  private endBattle(won: boolean) {
    // Nulled, not just destroyed -- switchMovePage's `!this.moveMenu`
    // guard checks the field itself, and a destroy()ed Container is still a
    // truthy JS reference, so leaving this set would make that guard clause
    // permanently inert instead of the real second line of defense it's
    // meant to be (turnLock alone already blocks it today, see that guard's
    // own comment, but this is the one that has to keep working if that
    // ever changes).
    this.moveMenu?.destroy(true);
    this.moveMenu = undefined;

    const stake = this.isRival ? 2 * battleStakeForWorld(this.world) : battleStakeForWorld(this.world);
    const tokens = (this.game.registry.get('qumatessence') as number) || 0;
    const newTokens = won ? tokens + stake : Math.max(0, tokens - stake);
    this.game.registry.set('qumatessence', newTokens);

    // Win or lose, the player crystal is fully healed afterward -- only the
    // qumatessence stake is on the line, not attrition into the next fight.
    this.game.registry.set('playerHp', this.playerMaxHp);

    // Beating the world's gating rival crystal is what actually unlocks
    // the guardian's shop/panel and the way to the next world -- see
    // OverworldScene.showRivalEncounter/maybeAutoOpenGoalDialogue.
    if (won && this.isRival) {
      const rivalDefeated = (this.game.registry.get('rivalDefeated') as Record<number, boolean>) ?? {};
      this.game.registry.set('rivalDefeated', { ...rivalDefeated, [this.world]: true });
    }

    // Rivals are gate encounters, not collectible materials (same rule as
    // OverworldScene's discoveredMaterials), so only an ordinary wild win is
    // ever offered to Dresselhaus's transmutation panel.
    if (won && !this.isRival) {
      const defeated = (this.game.registry.get('defeatedMaterials') as DiscoveredMaterial[]) ?? [];
      if (!defeated.some((m) => m.name === this.wild.name)) {
        this.game.registry.set('defeatedMaterials', [...defeated, { name: this.wild.name, type: this.wild.type }]);
      }
    }
    persistFromRegistry(this.game.registry);

    const tokenText = won ? `+${stake} qumatessence!` : `-${tokens - newTokens} qumatessence...`;
    // opponentView() rather than this.wild -- for World 10's rival, this
    // reads whatever real compound it was last disguised as (or the player's
    // own mirrored type, if the fight ended before its first transmutation),
    // so the closing flavor/blurb actually matches whichever form was just
    // beaten instead of a placeholder type that was never meant to be shown.
    const flavor = won ? victoryLine(this.opponentView()) : defeatLine(this.opponentView());
    const blurb = materialBlurb(this.opponentView());
    // The end-of-battle summary runs several lines longer than an in-combat
    // log line (flavor + token delta + the physics blurb), so it needs a
    // much higher clamp ceiling than setLogText's default LOG_Y -- a big
    // text size or a long blurb still can't push the bottom off-canvas. It
    // also spreads across nearly the full field width (LOG_WRAP_WIDTH_VICTORY)
    // rather than the narrower in-battle width -- the move menu (destroyed
    // above, at the top of this method) is gone by now, so there's nothing
    // left to dodge.
    this.setLogText(`${flavor}\n${tokenText}\n\n${blurb}\n\nPress SPACE to return.`, 210, LOG_WRAP_WIDTH_VICTORY);

    this.input.keyboard!.once('keydown-SPACE', () => this.scene.start('Overworld', { world: this.world }));
  }
}
