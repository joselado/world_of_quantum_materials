import Phaser from 'phaser';
import { killTweensDeep, makeCrystal } from '../art/crystals';
import { makeBossCrystal } from '../art/boss';
import { shade, blend, hashSeed, seededRandom } from '../art/colors';
import { getBiome } from '../art/biomes';
import type { Biome, WallTheme } from '../art/biomes';
import { wallThemeOf } from './overworld/terrain/plan';
import type { BattleLocale } from './overworld/terrain/types';
import { playAttackEffect, followAnchor, ANALYTIC_SHAPES, ULTIMATE_SHAPES, type EffectAnchor } from '../art/attackEffects';
import { drawFranklinPassiveHalo } from '../art/passiveHalos';
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
  isGrainedGolem,
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
  MAX_MULTI_HIT,
  DIFFICULTY_MULTIPLIERS,
  superpositionEnemyStats,
} from '../data/balance';
import { DEFAULT_DIFFICULTY_TIER } from '../data/settings';
import type { DifficultyTier } from '../data/settings';
import { victoryLine, defeatLine } from '../data/greetings';
import { PASSIVES } from '../data/passives';
import type { PassiveOwner } from '../data/passives';
import { materialBlurb } from '../data/materialdex';
import { getAnalyticQuestion, getUltimateQuestions } from '../data/quiz';
import { persistFromRegistry } from '../data/save';
import type { DiscoveredMaterial } from '../data/save';
import type { Material, Move, MoveClass, Stats } from '../data/types';
import { music } from '../audio/music';
import {
  FIELD_W,
  FIELD_H,
  HORIZON_Y,
  BOTTOM_RAIL,
  PLAYER_POS,
  OPPONENT_POS,
  BOSS_OPPONENT_POS,
  PLAYER_CRYSTAL_SIZE,
  WILD_CRYSTAL_SIZE,
  BOSS_CRYSTAL_SIZE,
  SHADOW_DROP,
  PLAYER_HEAD_RISE,
  WILD_HEAD_RISE,
  BOSS_HEAD_RISE,
  HP_BAR_FILL_W,
  MENU_WIDTH,
  MENU_X,
  MENU_BOTTOM,
  MENU_MIN_TOP,
  TURN_PREVIEW_LENGTH,
  LOG_X,
  LOG_Y,
  LOG_MIN_TOP,
  LOG_WRAP_WIDTH,
  LOG_WRAP_WIDTH_VICTORY,
  STATUS_PILL_COLOR,
  drawNameplate,
  drawTurnPreview,
  type Nameplate,
} from './battle/hud';

// Correct/wrong multipliers for Landau's two quiz-gated Analytic moves (§5) --
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

// Passive pill color -- a fixed blue-violet, deliberately far from
// STATUS_PILL_COLOR's rust-orange so an always-on passive reads as visually
// distinct from a ticking status at a glance.

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

// Gap before the next turn fires -- long enough for the fuller attack beat
// (windup + travel + impact shockwave, up to ~810ms for a ring move) in
// art/attackEffects.ts to land and read clearly before the screen moves on.
const TURN_GAP_MS = 850;
// Every move-menu page is capped at this many rows, however many moves its
// section actually has (moveMenuPages splits a larger section into several
// same-label pages instead) -- a fixed cap keeps every page's row budget
// (and so its font size) close to identical regardless of content, rather
// than a few-move page rendering tiny text just because some other section
// happens to have many more moves.
const MOVE_MENU_MAX_ROWS = 3;
// The one tag the move buttons carry that needs explaining, kept deliberately
// terse -- it sits as a dim strip along the panel's bottom edge, out of the
// row budget's way.
const MENU_LEGEND = '!! no natural defense (2x)';

interface BattleInitData {
  wild: Material;
  world?: number;
  attackMultiplier?: number;
  isRival?: boolean;
  // Where on that world's map the fight started (scenes/overworld/terrain/
  // plan.ts's sampleBattleLocale). Optional: without it the arena falls back
  // to the world's own default biome and skyline.
  locale?: BattleLocale;
}

interface MoveSection {
  label: string;
  ids: string[];
  legend?: string;
}

export class BattleScene extends Phaser.Scene {
  private wild!: Material;
  private world = 1;
  // Where this fight started, when the caller knows (drawBackground). Assigned
  // unconditionally in init() -- Phaser reuses the scene instance across
  // scene.start(), so a battle entered without one has to clear the previous
  // battle's locale rather than inherit it.
  private locale?: BattleLocale;
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
  // The opponent's own nameplate, held (rather than just its hp bar and
  // status label) so `drawOpponentPlate` can tear the whole fitted layout
  // down and rebuild it when World 10's rival renames itself mid-fight.
  private opponentPlate?: Nameplate;
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
  // Where each side's half of an attack effect draws (art/attackAnchors.ts).
  // Each one reads only its own crystal's live container position, so the
  // attacker's part of an effect and the target's part are computed
  // independently of each other -- neither is pinned to a fixed field
  // coordinate, and neither has to stay in step with the other. Thunks to
  // the *fields*, not to the containers: `transmuteAdapted` replaces
  // `opponentCrystal` outright (from inside `checkEndOrContinue`, which for
  // an ordinary move runs while that move's effect is still on screen), and
  // a thunk keeps tracking the crystal that's actually there.
  private playerAnchor: EffectAnchor = followAnchor(() => this.playerCrystal);
  private opponentAnchor: EffectAnchor = followAnchor(() => this.opponentCrystal);
  private logText!: Phaser.GameObjects.Text;
  private logBasePx = 14;
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
    this.locale = data.locale;
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
    // into a different form never changes it by itself. `enemyStatsForWorld`'s
    // own multiplier comes from the Lab's Settings station (data/settings.ts's
    // DifficultyTier, DIFFICULTY_MULTIPLIERS), read fresh here rather than
    // cached, so a mid-playthrough difficulty change applies from the very
    // next battle. In Superposition Mode, every stat is already pinned to
    // MAX_STAT (OverworldScene's applySuperpositionUnlocks), so there's no
    // "this world is harder than the last" progression left to track on the
    // opponent's side either -- `superpositionEnemyStats` (still scaled by
    // the same difficulty tier) replaces the per-world climb with one flat,
    // representative value shared by every world.
    const encounterFactor = this.isRival ? 1 : rollEncounterFactor();
    const difficultyTier = (this.game.registry.get('difficultyTier') as DifficultyTier) ?? DEFAULT_DIFFICULTY_TIER;
    const superposition = !!this.game.registry.get('superpositionMode');
    const baseEnemyStats = superposition
      ? superpositionEnemyStats(DIFFICULTY_MULTIPLIERS[difficultyTier])
      : enemyStatsForWorld(this.world, DIFFICULTY_MULTIPLIERS[difficultyTier]);
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
    // Franklin's ground halo (art/passiveHalos.ts) for whichever passive is
    // active, drawn once here rather than per-turn -- no passive is ever
    // active for the opponent side (opponentActivePassives above stays
    // empty), so only the player's own ground shadow ever gets one. Drawn
    // before the player crystal itself (create()'s own later section) so it
    // renders behind it, anchored to the shadow ellipse's position
    // (drawBackground's own `PLAYER_POS.x, 392`) rather than wrapped around
    // the crystal body the way addBoostHalo's temporary aura is.
    const franklinPassiveId = [...this.playerActivePassives].find((id) => id in PASSIVES);
    if (franklinPassiveId) {
      const haloLayer = this.add.container(0, 0);
      drawFranklinPassiveHalo(this, haloLayer, PLAYER_POS.x, PLAYER_POS.y + SHADOW_DROP, franklinPassiveId, 65, 15);
    }

    const savedHp = (this.game.registry.get('playerHp') as number) || this.playerMaxHp;
    this.playerHp = Math.min(savedHp, this.playerMaxHp);
    this.opponentHp = this.opponentMaxHp;
    this.turnLock = false;
    this.movePageIndex = 0;
    this.playerStatus = null;
    this.opponentStatus = null;
    // Dropped rather than destroyed: the scene teardown already reclaimed the
    // previous battle's objects, and this is the same battle-ephemeral reset
    // every field above needs because Phaser reuses the Scene instance across
    // scene.start() calls.
    this.opponentPlate = undefined;

    // A rival fight's opponent is that world's boss -- render it with the
    // same gigantic, multi-shard look it has standing at the goal tile in
    // the overworld (art/boss.ts's makeBossCrystal), not the plain shared
    // makeCrystal() every ordinary wild encounter uses.
    this.opponentCrystal = this.isRival
      ? makeBossCrystal(this, BOSS_CRYSTAL_SIZE, this.opponentView().color, this.opponentView().variant, isGrainedGolem(this.opponentView().name))
      : makeCrystal(this, WILD_CRYSTAL_SIZE, this.wild.color, this.wild.variant, { seed: this.wild.name, hybrid: this.wild.hybridParents });
    this.opponentCrystal.setPosition(this.opponentPos.x, this.opponentPos.y);
    this.bobCrystal(this.opponentCrystal, this.opponentPos.y);

    this.drawOpponentPlate();

    // Player (bottom-left)
    this.playerCrystal = makeCrystal(this, PLAYER_CRYSTAL_SIZE, this.playerMaterial.color, this.playerMaterial.variant, {
      seed: this.playerMaterial.name,
      hybrid: this.playerMaterial.hybridParents,
    });
    this.playerCrystal.setPosition(PLAYER_POS.x, PLAYER_POS.y);
    this.bobCrystal(this.playerCrystal, PLAYER_POS.y);

    if (this.attackMultiplier !== 1) {
      if (this.attackMultiplier > 1) this.addBoostHalo(this.playerCrystal);
      else this.addFailCloud(this.playerCrystal);
    }

    // Player nameplate, floating above the player's own head exactly the way
    // the opponent's does. Room for the Kondo status pill is reserved only
    // when this form actually has one of his moves to cast (the plate is
    // bottom-anchored, so an unreserved pill would shove the name and bar
    // upward on the turn it lands).
    this.currentMoveIds = getBattleMoves(this.game.registry);
    const boosted = this.attackMultiplier > 1;
    const playerPlate = drawNameplate(this, {
      centerX: PLAYER_POS.x,
      headTop: PLAYER_POS.y - PLAYER_HEAD_RISE,
      name: this.playerMaterial.name,
      namePx: Math.round(14 * Math.min(fontScale(this), 1.5)),
      accent: GOLD_ACCENT,
      reserveStatus: this.currentMoveIds.some((id) => KONDO_MOVE_IDS.includes(id)),
      passiveText: passivePillText(this.playerActivePassives),
      note:
        this.attackMultiplier === 1
          ? undefined
          : {
              text: boosted ? 'Attack boosted!' : 'Attack weakened...',
              color: boosted ? '#88ff88' : '#ff8888',
              px: Math.round(12 * Math.min(fontScale(this), 1.5)),
            },
    });
    this.playerHpBar = playerPlate.hpFill;
    this.playerStatusLabel = playerPlate.statusLabel;

    const openingLine = this.isRival ? `${this.wild.name} blocks the way onward!` : `A wild ${this.wild.name} appeared!`;
    this.logText = this.add.text(LOG_X, LOG_Y, '', {
      fontSize: fontPx(this, 14),
      color: '#ffffff',
      backgroundColor: 'rgba(0,0,0,0.45)',
      padding: { x: 8, y: 6 },
      wordWrap: { width: LOG_WRAP_WIDTH },
    });
    this.logBasePx = Math.round(14 * fontScale(this));
    this.setLogText(openingLine);

    this.drawTurnPreview();
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
  // -- physics-gated attacks, Landau's two answer-gated Analytic moves,
  // and Kondo's currently-active self-buff move work differently enough
  // that a flat list blurred the distinction), paged with on-screen ◀/▶
  // arrows and the Left/Right keys (movePageIndex/switchMovePage) -- a
  // move-kind section only produces a page at all if it has at least one
  // usable move, so a player with none of Landau's moves bought or no
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

    const legendStyle = {
      fontSize: `${Math.round(10 * chromeScale)}px`,
      wordWrap: { width: MENU_WIDTH - 12 },
      lineSpacing: 2,
    };

    if (moveIds.length === 0) {
      const measureLegend = this.add.text(0, 0, MENU_LEGEND, legendStyle);
      const measureEmpty = this.add.text(0, 0, 'No usable moves', { fontSize: fontPx(this, 11), wordWrap: { width: MENU_WIDTH - 16 } });
      const height = 8 + measureEmpty.height + 8 + measureLegend.height + 8;
      measureLegend.destroy();
      measureEmpty.destroy();
      const menuTop = MENU_BOTTOM - height;

      const empty = this.add
        .text(MENU_X + MENU_WIDTH / 2, menuTop + 8, 'No usable moves', {
          fontSize: fontPx(this, 11),
          color: '#cfd8ff',
          align: 'center',
          wordWrap: { width: MENU_WIDTH - 16 },
        })
        .setOrigin(0.5, 0);
      container.add(empty);
      const legend = this.add
        .text(MENU_X + MENU_WIDTH / 2, menuTop + height - 8, MENU_LEGEND, { ...legendStyle, color: REFERENCE_BLUE_GREY_HEX, align: 'center' })
        .setOrigin(0.5, 1);
      container.add(legend);
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
    const headerStyle = { fontSize: `${Math.round(12 * headerScale)}px`, fontStyle: 'bold' as const };
    const arrowStyle = { fontSize: `${Math.round(14 * headerScale)}px`, fontStyle: 'bold' as const };
    const sectionLegendStyle = { fontSize: `${Math.round(8 * headerScale)}px` };

    // --- Measurement pass: throwaway Text objects, destroyed immediately,
    // just to learn how tall this page's chrome (title/legend/header/pager/
    // section-legend) and rows actually render at the current text-size
    // setting -- see this method's own comment for why the panel being
    // bottom-anchored means this has to happen before anything permanent
    // can be positioned.
    const measureLegend = this.add.text(0, 0, MENU_LEGEND, legendStyle);
    const legendH = measureLegend.height + 6;
    measureLegend.destroy();
    const rowsTop = 8;

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
    const budget = MENU_BOTTOM - MENU_MIN_TOP;
    const chromeH = rowsTop + headerTotalH + legendH + 8; // +8 matches the panel's own trailing bottom pad below
    const avail = budget - chromeH;
    const naturalRowH = Math.floor(avail / rowCount);
    const rowH = Phaser.Math.Clamp(naturalRowH, rowFloor, Math.max(maxRowH, rowFloor));
    const height = chromeH + rowCount * rowH;
    const menuTop = MENU_BOTTOM - height;

    const padY = 5;
    const fitPx = Math.max(9, Math.floor((rowH - padY * 2) / 2.4));
    const desiredPx = Math.round(11 * scale);
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

    const legend = this.add
      .text(MENU_X + MENU_WIDTH / 2, menuTop + height - 8, MENU_LEGEND, {
        ...legendStyle,
        color: REFERENCE_BLUE_GREY_HEX,
        align: 'center',
      })
      .setOrigin(0.5, 1);
    container.add(legend);

    let rowY = menuTop + rowsTop;
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
      .text(MENU_X + MENU_WIDTH / 2, rowY, headerLabelText, { ...headerStyle, color: GOLD_ACCENT_HEX })
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

    // Each button is centered in its own row band rather than pinned to the
    // band's top edge, so a page with slack (a short BUFFS page, or any page
    // at a small text-size preset) reads as evenly spaced rather than as one
    // dead gap under the first button.
    section.ids.forEach((moveId, i) => {
      this.addMoveButton(container, moveId, rowY + rowH * (i + 0.5), btnPx, padY);
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
  // A single "Name: details" line rather than a forced two-line name/Pwr
  // split -- addMoveButton's own wordWrap only breaks this onto a second
  // line for a genuinely long label (a long tuned name plus an Ultimate's
  // ★★★ and a mismatch !!2x tag all at once), so a short label like "Phonon
  // Beam: Pwr 6" renders on one line instead of always reserving room for
  // two. Always the player's own move menu, so Feynman's level prefix/
  // effective power apply unconditionally here (unlike resolveHit's own
  // isPlayer-gated read, see that method's own comment).
  private moveButtonContent(moveId: string): { text: string; color: string } {
    if (KONDO_MOVE_IDS.includes(moveId)) {
      return { text: `${moveDisplayName(this.game.registry, moveId)}: ${STATUS_DURATION}-turn buff`, color: STATUS_PILL_COLOR };
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
    return { text: `${displayName}: Pwr ${power}${tag}`, color };
  }

  // One move button -- factored out of drawMoveMenu so the per-section loop
  // above doesn't duplicate the click-handler logic three times over.
  private addMoveButton(container: Phaser.GameObjects.Container, moveId: string, centerY: number, btnPx: number, padY: number) {
    const move = MOVES[moveId];
    const { text, color } = this.moveButtonContent(moveId);
    const btn = this.add
      .text(MENU_X + MENU_WIDTH / 2, centerY, text, {
        fontSize: `${btnPx}px`,
        color,
        backgroundColor: '#222244',
        padding: { x: 8, y: padY },
        align: 'center',
        wordWrap: { width: MENU_WIDTH - 16 },
      })
      .setOrigin(0.5, 0.5)
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

  // The question panel an analytic move (Landau's `skyfallBeam`/`groundEruption`,
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
    this.renderQuestionPanel({
      title: moveDisplayName(this.game.registry, move.id),
      titleColor: GOLD_ACCENT_HEX,
      strokeColor: GOLD_ACCENT,
      prompt: question.prompt,
      options: [
        { text: question.correct, correct: true },
        { text: question.incorrect, correct: false },
      ],
      onPick: (correct) => onAnswered(correct ? ANALYTIC_CORRECT_MULTIPLIER : ANALYTIC_WRONG_MULTIPLIER),
    });
  }

  // Shared panel builder for showAnalyticQuestion's single question and
  // showUltimateQuestions' 3-question streak -- both are otherwise the same
  // title/prompt/two-shuffled-answers layout on a bordered rectangle, just
  // with a different title, color and onPick outcome. The title's length
  // varies a lot at runtime: Feynman's level prefix ('Infinite') plus
  // whichever quasiparticle the move is currently tuned to (e.g. 'Heavy
  // Fermion') can produce something like "Infinite Heavy Fermion Meteor --
  // question 3/3", well past the fixed panel width -- so the title wraps
  // like the prompt below it, and the font scale is capped at the default
  // 1.5 preset (only the 2x 'Large' preset gets clamped, matching
  // drawMoveMenu's headerScale cap) rather than growing unbounded. If the
  // measured panel still doesn't fit the field after that cap -- a long
  // prompt/answer pair on top of a long title -- the whole panel shrinks
  // further in fixed steps down to a floor where the 12px body text bottoms
  // out at 9px, the same floor HubScene.renderMaterialdexPanel's own
  // blurb-shrink loop uses.
  private renderQuestionPanel(params: {
    title: string;
    titleColor: string;
    strokeColor: number;
    prompt: string;
    options: { text: string; correct: boolean }[];
    onPick: (correct: boolean) => void;
  }) {
    const { title, titleColor, strokeColor, prompt, options, onPick } = params;
    const panelWidth = 520;
    const top = 90;
    const contentWidth = panelWidth - 60;
    const shuffled = Phaser.Utils.Array.Shuffle(options.slice());

    const attempt = (scale: number) => {
      const container = this.add.container(0, 0).setDepth(100);
      let y = top + 16;

      const titleText = this.add
        .text(FIELD_W / 2, y, title, {
          fontSize: `${Math.round(15 * scale)}px`,
          color: titleColor,
          fontStyle: 'bold',
          align: 'center',
          wordWrap: { width: contentWidth },
        })
        .setOrigin(0.5, 0);
      container.add(titleText);
      y += titleText.height + 8;

      const promptText = this.add
        .text(FIELD_W / 2, y, prompt, {
          fontSize: `${Math.round(12 * scale)}px`,
          color: '#ffffff',
          align: 'center',
          wordWrap: { width: contentWidth },
        })
        .setOrigin(0.5, 0);
      container.add(promptText);
      y += promptText.height + 14;

      const finish = (correct: boolean) => {
        container.destroy(true);
        onPick(correct);
      };

      shuffled.forEach((opt) => {
        const btn = this.addAnswerButton(container, y, opt.text, scale, contentWidth, () => finish(opt.correct));
        y += btn.height + 8;
      });

      const panelHeight = y - top + 10;
      return { container, panelHeight };
    };

    let scale = Math.min(fontScale(this), 1.5);
    let { container, panelHeight } = attempt(scale);
    while (top + panelHeight > FIELD_H - 10 && scale > 0.75) {
      container.destroy(true);
      scale = Math.max(0.75, scale - 0.1);
      ({ container, panelHeight } = attempt(scale));
    }

    const panel = this.add
      .rectangle(FIELD_W / 2, top + panelHeight / 2, panelWidth, panelHeight, PANEL_BG, 0.94)
      .setStrokeStyle(2, strokeColor);
    container.addAt(panel, 0);
  }

  private addAnswerButton(
    container: Phaser.GameObjects.Container,
    y: number,
    label: string,
    scale: number,
    width: number,
    onClick: () => void
  ) {
    const btn = this.add
      .text(FIELD_W / 2, y, label, {
        fontSize: `${Math.round(12 * scale)}px`,
        color: '#ffff88',
        backgroundColor: '#222244',
        padding: { x: 10, y: 5 },
        align: 'center',
        wordWrap: { width },
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
      this.renderQuestionPanel({
        title: `${moveDisplayName(this.game.registry, move.id)} (question ${index}/${questions.length})`,
        titleColor: '#ff66ff',
        strokeColor: 0xff66ff,
        prompt: question.prompt,
        options: [
          { text: question.correct, correct: true },
          { text: question.incorrect, correct: false },
        ],
        onPick: (correct) => {
          if (!correct) {
            onAnswered(false);
            return;
          }
          askNext();
        },
      });
    };

    askNext();
  }

  // The whole battle backdrop, colored from where on the map the fight
  // started (`locale`, scenes/overworld/terrain/plan.ts's sampleBattleLocale)
  // rather than from the world alone: the encounter tile's own biome supplies
  // the palette, its surroundings the color grade, its coordinates the
  // skyline. Without a locale the world's own biome answers all three, which
  // is the arena a caller that doesn't know where it stands gets.
  //
  // Drawn once per battle entry (not per frame), which is what affords the
  // layered-atmosphere treatment below: eased sky wash, four curved parallax
  // ridgelines, fog/mist blending, theme-keyed color grade, drifting haze,
  // and a corner vignette. It stays a backdrop -- the local read tints and
  // grades an arena rather than restaging the overworld's terrain in it, and
  // the whole value range stays compressed so the crystals read in front.
  private drawBackground() {
    const base = this.locale?.biome ?? getBiome(this.world);
    const tint = this.locale?.regionTint ?? null;
    // A domain tint from the ground around the tile (worlds 1/3/8's colored
    // regions) pulled into the arena's own ground at a fraction, so two
    // domains of one world are distinguishable underfoot without the arena
    // reading as a different world.
    const biome: Biome = tint == null ? base : { ...base, ground: blend(base.ground, tint, 0.15) };
    const g = this.add.graphics();

    // Sky as an eased two-segment vertical wash (dark zenith easing into a
    // brighter horizon) rather than one linear gradient -- the mid-stop sits
    // above the geometric middle so the brightening accelerates toward the
    // horizon the way real atmospheric scattering does.
    const skyMid = blend(biome.skyTop, biome.skyBottom, 0.45);
    const skyMidY = Math.round(HORIZON_Y * 0.52);
    g.fillGradientStyle(biome.skyTop, biome.skyTop, skyMid, skyMid, 1);
    g.fillRect(0, 0, FIELD_W, skyMidY);
    g.fillGradientStyle(skyMid, skyMid, biome.skyBottom, biome.skyBottom, 1);
    g.fillRect(0, skyMidY, FIELD_W, HORIZON_Y - skyMidY);
    // A soft glow hugging the horizon, tinted off the biome's own fog color,
    // so the sky melts into the ridgelines instead of meeting them at a
    // clean band boundary.
    const horizonGlow = blend(biome.skyBottom, shade(biome.fogTarget, 20), 0.7);
    g.fillGradientStyle(horizonGlow, horizonGlow, horizonGlow, horizonGlow, 0, 0, 0.5, 0.5);
    g.fillRect(0, HORIZON_Y - 70, FIELD_W, 70);

    if (biome.clouds) {
      this.drawSun(560, 55);
      this.drawCloud(90, 40);
      this.drawCloud(230, 70);
      this.drawCloud(540, 40);
    }

    // Four stacked ridgeline layers behind the field, each further layer
    // flatter and blended harder toward the sky/fog color (aerial
    // perspective), the nearer ones darker and more sculpted. Silhouettes
    // are Catmull-Rom curves through seeded peak heights, seeded off the
    // encounter tile as well as the world, so every place in a world has its
    // own rolling skyline -- the same spot always the same one -- and the
    // value range stays compressed relative to the crystals fighting in
    // front of it.
    const ridgeLayers: {
      baseY: number;
      count: number;
      minH: number;
      maxH: number;
      color: number;
      alpha: number;
      rim: boolean;
    }[] = [
      // Each layer's color takes an explicit brighten/darken step on top of
      // the sky/fog blend -- in dark biomes the raw blend endpoints sit so
      // close together that the layers would otherwise merge into one lump.
      // The alphas are the backdrop's own: `hillColor` is borrowed as a
      // per-world ridge tone, but `hillAlpha` is the overworld's swallow knob
      // (`art/biomes.ts`) and means nothing here -- the arena is a near view,
      // where a world whose horizon is swallowed still has a skyline.
      { baseY: HORIZON_Y - 26, count: 6, minH: 46, maxH: 122, color: shade(blend(biome.hillColor, biome.skyBottom, 0.58), 11), alpha: 0.95, rim: false },
      { baseY: HORIZON_Y - 16, count: 7, minH: 26, maxH: 84, color: shade(blend(biome.hillColor, biome.skyBottom, 0.34), 4), alpha: 0.95, rim: false },
      { baseY: HORIZON_Y - 4, count: 8, minH: 12, maxH: 46, color: shade(blend(biome.hillColor, biome.fogTarget, 0.15), -5), alpha: 0.85, rim: true },
      { baseY: HORIZON_Y + 6, count: 9, minH: 5, maxH: 24, color: blend(shade(biome.ground, 20), biome.fogTarget, 0.1), alpha: 1, rim: true },
    ];
    const spot = this.locale ? `${this.locale.x},${this.locale.y}-` : '';
    ridgeLayers.forEach((layer, i) => {
      const rand = seededRandom(hashSeed(`battle-ridge-${this.world}-${spot}${i}`));
      const heights = Array.from({ length: layer.count }, () => layer.minH + rand() * (layer.maxH - layer.minH));
      this.drawRidge(g, layer.baseY, layer.color, layer.alpha, heights, layer.rim);
    });

    // Ground, its horizon edge pulled toward the fog color so it recedes
    // into the same atmosphere the ridges sit in.
    const groundFar = blend(shade(biome.ground, 20), biome.fogTarget, 0.3);
    const groundNear = shade(biome.ground, -18);
    g.fillGradientStyle(groundFar, groundFar, groundNear, groundNear, 1);
    g.fillRect(0, HORIZON_Y, FIELD_W, FIELD_H - HORIZON_Y);
    // Mist pooling just below the horizon, fading out down the field.
    const mist = shade(biome.fogTarget, 25);
    g.fillGradientStyle(mist, mist, mist, mist, 0.32, 0.32, 0, 0);
    g.fillRect(0, HORIZON_Y, FIELD_W, 64);

    this.drawColorGrade(g, biome);
    this.drawHazeBands(biome);

    this.drawBackgroundCrystals(biome);
    this.drawGroundDetail(biome);

    // Corner-only vignette, in a near-black derived from the biome's own
    // sky, pulling the eye toward center-frame. Drawn before the crystals/
    // UI are added so only the backdrop is dimmed, never the foreground.
    this.drawVignette(biome);

    const shadowColor = shade(biome.ground, -40);
    // Anchored to the live this.opponentPos (set before drawBackground() is
    // called, see create()'s own comment) rather than the plain OPPONENT_POS
    // constant, so the shadow still sits under the crystal in a rival fight,
    // where the opponent actually renders at BOSS_OPPONENT_POS instead.
    this.add.ellipse(this.opponentPos.x, this.opponentPos.y + SHADOW_DROP, 120, 28, shadowColor, 0.35);
    this.add.ellipse(PLAYER_POS.x, PLAYER_POS.y + SHADOW_DROP, 130, 30, shadowColor, 0.35);
  }

  // One rolling ridge silhouette spanning the field width: a Catmull-Rom
  // spline through the given peak heights (sampled densely, so the fill is
  // a smooth curve rather than straight segments), filled down to its
  // baseline. `rim` adds a thin lighter stroke along just the top edge --
  // directional skylight on the nearer ridges, without any per-shape
  // internal shading.
  private drawRidge(
    g: Phaser.GameObjects.Graphics,
    baseY: number,
    color: number,
    alpha: number,
    peaks: number[],
    rim = false
  ) {
    // Control points overshoot both edges so the visible curve never sags
    // toward an endpoint inside the frame.
    const margin = 60;
    const stepX = (FIELD_W + margin * 2) / (peaks.length - 1);
    const controls = peaks.map((h, i) => new Phaser.Math.Vector2(-margin + i * stepX, baseY - h));
    const curvePts = new Phaser.Curves.Spline(controls).getPoints(80);

    g.fillStyle(color, alpha);
    g.beginPath();
    g.moveTo(-margin, baseY + 4);
    curvePts.forEach((p) => g.lineTo(p.x, p.y));
    g.lineTo(FIELD_W + margin, baseY + 4);
    g.closePath();
    g.fillPath();

    if (rim) {
      g.lineStyle(1.5, blend(color, 0xffffff, 0.38), 0.32);
      g.beginPath();
      g.moveTo(curvePts[0].x, curvePts[0].y);
      curvePts.forEach((p) => g.lineTo(p.x, p.y));
      g.strokePath();
    }
  }

  // Whole-scene translucent color-grade keyed off what the ground around the
  // encounter tile is actually made of (the locale's sampled surround,
  // falling back to the biome's own terrain theme) -- zone-level tinting (a
  // cool wash over a frozen field, embers glowing at a scorched horizon),
  // never per-shape shading. Every tint here is held at or below 0.14 alpha:
  // the grade says what kind of place this is and then gets out of the way.
  private drawColorGrade(g: Phaser.GameObjects.Graphics, biome: Biome) {
    const theme: WallTheme = this.locale ? wallThemeOf(this.locale.surround) : biome.wallTheme;
    switch (theme) {
      case 'ice': {
        // Cool cyan wash deepening down the field, as if lit through ice.
        const cool = 0x3a8ab8;
        g.fillGradientStyle(cool, cool, cool, cool, 0, 0, 0.1, 0.1);
        g.fillRect(0, HORIZON_Y, FIELD_W, FIELD_H - HORIZON_Y);
        break;
      }
      case 'lava': {
        // Warm ember glow straddling the horizon, strongest at the ridge
        // bases, as if lit from molten ground beyond them.
        const ember = 0xff5a22;
        g.fillGradientStyle(ember, ember, ember, ember, 0, 0, 0.14, 0.14);
        g.fillRect(0, HORIZON_Y - 60, FIELD_W, 60);
        g.fillGradientStyle(ember, ember, ember, ember, 0.1, 0.1, 0, 0);
        g.fillRect(0, HORIZON_Y, FIELD_W, 70);
        break;
      }
      case 'shards': {
        // Aurora green pooled along the horizon, the only light this world
        // has left and emitted rather than received.
        const aurora = 0x3fd97a;
        g.fillGradientStyle(aurora, aurora, aurora, aurora, 0, 0, 0.1, 0.1);
        g.fillRect(0, HORIZON_Y - 70, FIELD_W, 70);
        break;
      }
      default: {
        // Open-sky daylight worlds get a faint warm sunlight wash from
        // above; enclosed rock worlds stay untinted.
        if (biome.clouds) {
          const sun = 0xfff0c0;
          g.fillGradientStyle(sun, sun, sun, sun, 0.08, 0.08, 0, 0);
          g.fillRect(0, 0, FIELD_W, HORIZON_Y);
        }
      }
    }
  }

  // Two wide, faint fog bands drifting slowly across the horizon --
  // just enough ambient motion that the arena reads as a place with air in
  // it, kept far too translucent and slow to compete with move effects or
  // UI. Cheap: two ellipses on infinite yoyo tweens, no per-frame redraw.
  private drawHazeBands(biome: Biome) {
    const hazeColor = shade(biome.fogTarget, 35);
    const haze1 = this.add.ellipse(FIELD_W * 0.3, HORIZON_Y - 26, 460, 44, hazeColor, 0.08);
    const haze2 = this.add.ellipse(FIELD_W * 0.72, HORIZON_Y - 6, 540, 36, hazeColor, 0.1);
    this.tweens.add({ targets: haze1, x: haze1.x + 46, duration: 17000, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    this.tweens.add({ targets: haze2, x: haze2.x - 54, duration: 21000, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
  }

  // Corner-only translucent vignette: four gradient rects whose alpha peaks
  // at the frame corner and falls to zero toward center-frame, leaving the
  // middle of the arena (where both crystals live) untouched.
  private drawVignette(biome: Biome) {
    const g = this.add.graphics();
    const c = blend(biome.skyTop, 0x000000, 0.75);
    const w = 300;
    const h = 200;
    const a = 0.2;
    // top-left / top-right
    g.fillGradientStyle(c, c, c, c, a, 0, 0, 0);
    g.fillRect(0, 0, w, h);
    g.fillGradientStyle(c, c, c, c, 0, a, 0, 0);
    g.fillRect(FIELD_W - w, 0, w, h);
    // bottom-left / bottom-right
    g.fillGradientStyle(c, c, c, c, 0, 0, a, 0);
    g.fillRect(0, FIELD_H - h, w, h);
    g.fillGradientStyle(c, c, c, c, 0, 0, 0, a);
    g.fillRect(FIELD_W - w, FIELD_H - h, w, h);
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
  // biome's path color (pale wheat in the Mean Fields, swept ice on the
  // Vortex Glacier, ...) rather than a hardcoded grass green everywhere.
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

  // The opponent's floating name-over-bar plate -- the same one the player
  // gets in create(), centered on whichever position this fight placed the
  // opponent at and floating just above its own painted head. A rival's name
  // runs much longer on average than an ordinary wild's, so its label starts
  // a size smaller; the plate's own shrink-to-fit takes it the rest of the
  // way when the boss golem's head leaves little room above it. No wild ever
  // casts a Kondo move (KONDO_MOVE_IDS), so this side reserves no room for a
  // status pill, and no opponent ever carries a passive.
  //
  // Its own method rather than inline in create() because the plate is a
  // one-shot fitted layout (see `Nameplate.destroy`) and World 10's rival
  // renames itself mid-fight: transmuteAdapted rebuilds the whole plate
  // through this after swapping `adaptedForm`, so the new name gets a chip
  // and a shrink-to-fit actually measured against it. Reads the name off
  // `opponentView()`, so it picks up whichever identity is current with no
  // argument to keep in step.
  private drawOpponentPlate() {
    this.opponentPlate?.destroy();
    this.opponentPlate = drawNameplate(this, {
      centerX: this.opponentPos.x,
      headTop: this.opponentPos.y - (this.isRival ? BOSS_HEAD_RISE : WILD_HEAD_RISE),
      name: this.opponentView().name,
      namePx: Math.round((this.isRival ? 11 : 14) * Math.min(fontScale(this), 1.5)),
      accent: REFERENCE_BLUE_GREY,
      reserveStatus: false,
      passiveText: passivePillText(this.opponentActivePassives),
    });
    this.opponentHpBar = this.opponentPlate.hpFill;
    this.opponentStatusLabel = this.opponentPlate.statusLabel;
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

      killTweensDeep(this, this.opponentCrystal);
      this.opponentCrystal.destroy(true);
      this.opponentCrystal = makeBossCrystal(this, BOSS_CRYSTAL_SIZE, newForm.color, newForm.variant, isGrainedGolem(newForm.name));
      this.opponentCrystal.setPosition(this.opponentPos.x, this.opponentPos.y);
      this.bobCrystal(this.opponentCrystal, this.opponentPos.y);
      this.flashHit(this.opponentCrystal);

      // Rebuilt whole rather than retitled in place: the plate's chip is
      // fitted to its name's rendered width, and a "Polycrystalline <compound>
      // Golem" name is long enough that reusing the old fit would spill the
      // label out of its own chip and over the bar under it. The rebuild
      // re-binds the hp bar and status pill, so both have to be re-rendered
      // onto the new objects.
      this.drawOpponentPlate();
      this.updateBars();
      this.renderStatusLabel(false);
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
  // side gets `clamp(floor(ratio), 1, MAX_MULTI_HIT)` hits this round -- the
  // cap keeps an extreme velocity gap from producing an unbounded hit
  // sequence. The slower side always still gets exactly one hit. Ties (ratio
  // exactly 1) keep the player going first, one hit each. Shared by
  // `playerAttack` (which actually resolves the round's hits) and
  // `drawTurnPreview` (which reads it to render the "Turns" widget) so the
  // two can't drift apart.
  private currentHitOrder(): { fasterIsPlayer: boolean; fasterHits: number } {
    const playerVelocity = this.playerStats.velocity;
    const enemyVelocity = this.enemyStats.velocity;
    const fasterIsPlayer = playerVelocity >= enemyVelocity;
    const ratio = fasterIsPlayer ? playerVelocity / enemyVelocity : enemyVelocity / playerVelocity;
    const fasterHits = Phaser.Math.Clamp(Math.floor(ratio), 1, MAX_MULTI_HIT);
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
      killTweensDeep(this, this.turnPreviewRow);
      this.turnPreviewRow.destroy(true);
    }
    const { fasterIsPlayer, fasterHits } = this.currentHitOrder();
    const roundPattern: boolean[] = [];
    for (let i = 0; i < fasterHits; i++) roundPattern.push(fasterIsPlayer);
    roundPattern.push(!fasterIsPlayer);
    const sequence = Array.from({ length: TURN_PREVIEW_LENGTH }, (_, i) => roundPattern[i % roundPattern.length]);
    this.turnPreviewRow = drawTurnPreview(this, sequence, this.playerMaterial, this.opponentView(), this.isRival);
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
  // Every combat-log update goes through here, clamped into the band the
  // frame leaves free at the bottom-left (LOG_MIN_TOP..BOTTOM_RAIL) rather
  // than sitting at a fixed y regardless of how many lines it wraps to. A
  // line too tall for that band shrinks in whole-px steps (floor 10, the
  // same shrink-to-fit every other fixed-budget text block in the game uses)
  // instead of climbing up into the player's own crystal and nameplate. The
  // end-of-battle summary passes its own much higher ceiling and wider wrap,
  // since it runs several lines longer and the move menu it would otherwise
  // have to stay clear of is already destroyed by then.
  private setLogText(text: string, minTop = LOG_MIN_TOP, wrapWidth = LOG_WRAP_WIDTH) {
    this.logText.setWordWrapWidth(wrapWidth);
    let px = this.logBasePx;
    this.logText.setFontSize(`${px}px`);
    this.logText.setText(text);
    while (px > 10 && this.logText.height > BOTTOM_RAIL - minTop) {
      px -= 1;
      this.logText.setFontSize(`${px}px`);
    }
    const y = Math.max(minTop, BOTTOM_RAIL - this.logText.height);
    this.logText.setPosition(LOG_X, y);
  }

  // Lifts the log out of the field and onto a panel of its own, once the
  // fight is over. During combat the log is a caption on the action -- one
  // line at a time, deliberately not covering the crystals it is describing
  // -- and a translucent strip behind it is the right weight for that. The
  // closing summary is a different thing: several lines of flavour, payout
  // and the physics the fight was actually teaching, which is the one text in
  // a battle the player is meant to stop and read. Over an arena of lit
  // crystals, a shaded strip is not enough to read a paragraph off, so it
  // takes the same panel every other block of read-me text in this scene gets
  // (renderQuestionPanel) -- opaque, bordered, and above everything left on
  // the field.
  private raiseLogToPanel(won: boolean) {
    const pad = 14;
    const b = this.logText.getBounds();
    // Centred on the field rather than left-anchored where the log sat: with
    // the move menu gone there is nothing to dodge, and a paragraph reads
    // from the middle of the frame.
    const panelW = Math.min(FIELD_W - 24, b.width + pad * 2);
    const panelH = b.height + pad * 2;
    const cx = FIELD_W / 2;
    const cy = Math.min(b.centerY, FIELD_H - panelH / 2 - 10);
    this.logText.setPosition(cx - b.width / 2, cy - b.height / 2);
    this.logText.setBackgroundColor('rgba(0,0,0,0)');
    this.logText.setDepth(101);

    this.add
      .rectangle(cx, cy, panelW, panelH, PANEL_BG, 0.94)
      .setStrokeStyle(2, won ? GOLD_ACCENT : REFERENCE_BLUE_GREY)
      .setDepth(100);
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
    // tunable move (Landau's Analytic pair, Skłodowska-Curie's Ultimate
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
    // affected by it. `level` feeds playAttackEffect below (art/
    // attackEffects.ts) purely for presentation -- the escalating repeat
    // animation there never touches damage, which is already fully decided
    // by `power` here.
    const power = isPlayer ? effectiveMovePower(this.game.registry, moveId) : move.power;
    const level = isPlayer ? getMoveLevel(this.game.registry, moveId) : 0;
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

    const from = isPlayer ? this.playerAnchor : this.opponentAnchor;
    const to = isPlayer ? this.opponentAnchor : this.playerAnchor;
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
          ? `${who}'s ${displayName} fizzles out. The pattern never locked!`
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
        whiff,
        0,
        level
      );
      return;
    }

    playAttackEffect(
      this,
      effectiveClass,
      from,
      to,
      () => this.impactPunch(targetCrystal),
      mismatchMult * bonusMultiplier,
      shapeOverride,
      undefined,
      false,
      0,
      level
    );
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
  // here the way resolveHit's own tail has to. Kondo's three moves are as
  // leveled-by-Feynman as any attack move (kondoMitigationFraction already
  // scales their own buff strength by the caster's level) -- `level` here
  // gets the same escalating-repeat ring pulse resolveHit's own attack path
  // gets, gated `isPlayer`-only the same way (no wild ever casts a Kondo
  // move, see KONDO_MOVE_IDS' own comment).
  private resolveSelfBuff(isPlayer: boolean, move: Move, tickStatus: boolean, onDone: () => void) {
    const who = isPlayer ? 'You' : `Wild ${this.opponentView().name}`;
    const pos = isPlayer ? this.playerAnchor : this.opponentAnchor;
    const targetCrystal = isPlayer ? this.playerCrystal : this.opponentCrystal;
    const level = isPlayer ? getMoveLevel(this.game.registry, move.id) : 0;

    playAttackEffect(this, move.class, pos, pos, () => this.flashHit(targetCrystal), 1, undefined, undefined, false, 0, level);

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


  // Quick punchy scale-squash on the target crystal when a projectile
  // effect lands, so hits register even before the HP bar visibly moves.
  private flashHit(container: Phaser.GameObjects.Container) {
    this.tweens.add({ targets: container, scaleX: 1.18, scaleY: 0.82, duration: 90, yoyo: true });
  }

  // The full "hit landed" beat on top of art/attackEffects.ts's own impact
  // shockwave: the crystal squash, a small camera shake (kept subtle --
  // main.ts's canvas background is solid black, so anything punchier reveals
  // it at the field's fixed-coordinate edges), and a brief pale lift of the
  // whole field. The lift is deliberately dim and short: the impact's own
  // shockwave already carries the hit locally, and a full-brightness
  // white flash washes the field out for long enough to swallow whichever
  // silhouette just landed -- the flashier the move, the more it costs.
  private impactPunch(container: Phaser.GameObjects.Container) {
    this.flashHit(container);
    this.cameras.main.shake(140, 0.006);
    this.cameras.main.flash(70, 110, 118, 140, false);
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
    // OverworldScene.showRivalEncounter.
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
    this.setLogText(`${flavor}\n${tokenText}\n\n${blurb}\n\nPress SPACE to return.`, 150, LOG_WRAP_WIDTH_VICTORY);
    this.raiseLogToPanel(won);

    this.input.keyboard!.once('keydown-SPACE', () => this.scene.start('Overworld', { world: this.world }));
  }
}
