import Phaser from 'phaser';
import { makeCrystal } from '../art/crystals';
import { makeBossCrystal } from '../art/boss';
import { shade } from '../art/colors';
import { getBiome } from '../art/biomes';
import type { Biome } from '../art/biomes';
import { playAttackEffect, ANALYTIC_SHAPES, ULTIMATE_SHAPES } from '../art/attackEffects';
import { fontPx, fontScale } from '../ui/text';
import {
  MOVES,
  canHost,
  BASE_STAT,
  getPlayerMaterial,
  getPlayerStats,
  getBattleMoves,
  getTunedMoveClass,
  tunedMoveDisplayName,
  enemyStatsForWorld,
  ANALYTIC_MOVE_IDS,
  ULTIMATE_MOVE_IDS,
  KONDO_MOVE_IDS,
} from '../data/materials';
import { victoryLine, defeatLine } from '../data/greetings';
import { PASSIVES } from '../data/passives';
import type { PassiveOwner } from '../data/passives';
import { materialBlurb } from '../data/materialdex';
import { getAnalyticQuestion, getUltimateQuestions } from '../data/quiz';
import { persistFromRegistry } from '../data/save';
import type { DiscoveredMaterial } from '../data/save';
import type { Material, Move, Stats } from '../data/types';
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

const STATUS_DURATION = 3;
const SHIELD_DAMAGE_MULT = 0.7; // Shielded: incoming damage to the buffed side, multiplied down
const EVASION_CHANCE = 0.3; // Evasive: chance an incoming hit against the buffed side deals zero damage instead -- same 30%-ish magnitude the other two buffs' 0.7 multiplier implies (a 30% mitigation budget), picked from the 30-35% range a meaningful-but-not-dominant dodge chance should sit in
const REGEN_HEAL_FRACTION = 0.1; // Regenerating: fraction of the buffed side's own max HP healed on each tick (3 ticks over the buff's life -- roughly Bohr's Shared State ~22%-of-damage order of magnitude, spread out rather than landing in one hit)

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
// distinct from a ticking status at a glance (Bohr's own guardian color is
// itself a near-match for rust-orange, so it wouldn't have served that
// purpose).
const PASSIVE_PILL_COLOR = '#8fa0ff';

// A side can hold one Franklin passive and one Bohr passive at once
// (independent slots, one per data/passives.ts's PassiveOwner) -- joined
// onto a single pill line rather than one pill per passive, same '' when
// empty convention STATUS_INFO's pill uses. PASSIVES[id]? rather than a
// direct index -- every other read of playerActivePassives/
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

// Franklin's and Bohr's passive abilities (§5, data/passives.ts) -- unlike
// Kondo's status effects above, a passive has no duration/tick-down: it's
// simply on for the whole battle it's active for, so each one is just a
// flat multiplier/flag term read directly off whichever side currently has
// it active (this.activePassives(isPlayer), populated once in create() from
// registry/save activePassiveByOwner and never touched again mid-battle).
// Only the player can ever have one today, but every hook below reads
// generically off `isPlayer`/`defenderIsPlayer` the same way every other
// resolveHit term does, in case a future enemy ever has one.
const FRACTIONAL_GUARD_DAMAGE_MULT = 0.85; // Diffraction Shadow (id fractionalGuard): incoming damage taken by the holder
const ANYON_ECHO_FRACTION = 0.3; // Satellite Reflection (id anyonEcho): bonus follow-up tick, as a fraction of the crit that triggered it
const EDGE_CURRENT_MISMATCH_MULT = 1.5; // Amorphous Halo (id edgeCurrent): softened quasiparticle-mismatch multiplier (normally 2x)
const NONLOCAL_CORRELATION_FRACTION = 0.5; // Nonlocal Correlation: share of the opponent's own Quantumness added to Correlation
const SHARED_STATE_HEAL_FRACTION = 0.22; // Shared State: share of dealt damage returned as healing

// Field size is the shared canvas size (config/screen.ts) -- aliased to
// FIELD_W/FIELD_H here since every layout constant below reads as "a
// distance across the battle field" rather than "a distance across the
// canvas."
const FIELD_W = CANVAS_W;
const FIELD_H = CANVAS_H;
const HORIZON_Y = 262;
const LOG_Y = 440; // combat log's usual bottom-anchored resting position
// Ordinary-battle qumatessence stake for a given world (1-10): won on a win,
// lost (floored at 0) on a loss. Scales linearly from 50 at world 1 to 200 at
// world 10 so the late game pays out meaningfully more than the early game,
// rounded to the nearest 10 for a clean progression. A rival fight pays out
// double this, win or lose -- see the call site, which derives it from this
// same function rather than a separate table, so the two can't drift apart.
function battleStakeForWorld(world: number): number {
  const clamped = Math.min(10, Math.max(1, world));
  const raw = 50 + ((200 - 50) * (clamped - 1)) / 9;
  return Math.round(raw / 10) * 10;
}
const OPPONENT_POS = { x: 674, y: 150 };
// A rival/boss fight's opponent sits a bit further left and renders bigger
// (see BOSS_CRYSTAL_SIZE below) than an ordinary wild encounter's 50 --
// shifted off OPPONENT_POS's x so the wider, multi-shard boss silhouette
// (art/boss.ts's makeBossCrystal) has room before the move menu (MENU_X)
// starts, rather than overlapping it.
const BOSS_OPPONENT_POS = { x: 644, y: 155 };
const BOSS_CRYSTAL_SIZE = 64;
const PLAYER_POS = { x: 240, y: 345 };
// Gap before the next turn fires -- long enough for the fuller attack beat
// (windup + travel + impact shockwave, up to ~810ms for a ring move) in
// art/attackEffects.ts to land and read clearly before the screen moves on.
const TURN_GAP_MS = 850;
// Docked to the right of the field, clear of the opponent's crystal/HP bar
// above it and the log text below.
const MENU_X = 670;
const MENU_TOP = 178;
const MENU_WIDTH = 176;
const MENU_BOTTOM_MARGIN = 16;
// "Turns" preview widget (top-left corner, clear of both HP-bar columns and
// the log text further down) -- see `BattleScene.drawTurnPreview`.
const TURN_PREVIEW_X = 20;
const TURN_PREVIEW_Y = 8;
const TURN_PREVIEW_LENGTH = 5;
const TURN_PREVIEW_ICON_SIZE = 18;
const TURN_PREVIEW_ICON_SPACING = 22;
// Whose-turn ring drawn behind each icon (see `drawTurnPreview`) -- radius
// matches half the icon spacing so adjacent rings meet edge-to-edge without
// overlapping.
const TURN_PREVIEW_RING_RADIUS = TURN_PREVIEW_ICON_SPACING / 2;

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
  private turnLock = false;
  private opponentHpBar!: Phaser.GameObjects.Rectangle;
  private playerHpBar!: Phaser.GameObjects.Rectangle;
  private opponentCrystal!: Phaser.GameObjects.Container;
  private opponentPos: { x: number; y: number } = OPPONENT_POS;
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
  // Franklin's/Bohr's passives (§5) -- computed once in create() from
  // registry/save activePassiveByOwner and held for the whole battle (no
  // tick-down, unlike playerStatus/opponentStatus above).
  // opponentActivePassives stays empty today (no WORLD_CRYSTALS entry has
  // one), kept as its own field rather than hardcoding "player only" so
  // activePassives() below reads symmetrically off either side.
  private playerActivePassives = new Set<string>();
  private opponentActivePassives = new Set<string>();
  // Bohr's Correlated Response (§5): set on the defender's side the instant
  // the opponent lands a crit against them, consumed by that side's own very
  // next resolveHit call regardless of which move it is.
  private guaranteedCritNext = { player: false, opponent: false };

  constructor() {
    super('Battle');
  }

  init(data: BattleInitData) {
    this.wild = data.wild;
    this.world = data.world ?? 1;
    this.attackMultiplier = data.attackMultiplier ?? 1;
    this.isRival = data.isRival ?? false;
  }

  create() {
    music.play(`battle:${this.world}`);
    this.drawBackground();

    this.playerMaterial = getPlayerMaterial(this.game.registry);
    this.playerStats = getPlayerStats(this.game.registry);
    this.enemyStats = enemyStatsForWorld(this.world);

    // Franklin's/Bohr's active passives (§5) -- read once here, held for the
    // whole battle. Nonlocal Correlation needs recomputing fresh every battle
    // (rather than once at save time) since enemyStats.quantumness above is
    // itself recomputed fresh per battle -- spread into a *new* object rather
    // than mutating playerStats.correlation in place, since playerStats is
    // the same object getPlayerStats(registry) returned: mutating it would
    // permanently ratchet the save's own Correlation value the next time
    // anything persists the registry.
    const activeByOwner = (this.game.registry.get('activePassiveByOwner') as Partial<Record<PassiveOwner, string>>) ?? {};
    this.playerActivePassives = new Set(Object.values(activeByOwner).filter((id): id is string => !!id));
    this.opponentActivePassives = new Set();
    if (this.playerActivePassives.has('nonlocalCorrelation')) {
      this.playerStats = {
        ...this.playerStats,
        correlation: this.playerStats.correlation + Math.round(this.enemyStats.quantumness * NONLOCAL_CORRELATION_FRACTION),
      };
    }
    this.guaranteedCritNext = { player: false, opponent: false };

    const savedHp = (this.game.registry.get('playerHp') as number) || this.playerMaterial.maxHp;
    this.playerHp = Math.min(savedHp, this.playerMaterial.maxHp);
    this.opponentHp = this.wild.maxHp;
    this.turnLock = false;
    this.movePageIndex = 0;
    this.playerStatus = null;
    this.opponentStatus = null;

    // Opponent (top-right)
    // The bar sits a fixed gap below the *measured* name label rather than a
    // hardcoded y -- the name's font size (and so its rendered height) scales
    // with the text-size setting (data/settings.ts's FONT_SCALE_PRESETS, up
    // to 2x), and a fixed gap tuned for the 1x label overlapped the bar once
    // a taller label was in play. wordWrap for the same reason a long
    // material name (e.g. "Twisted Bilayer MoTe₂") needs it: starting this
    // far right (x=614, 60px left of OPPONENT_POS.x so the label/bar sit
    // just under the crystal) leaves too little room before the canvas edge
    // to trust an unbounded single line -- wrapping to a second line grows
    // `opponentName.height`, which opponentBarY below already reads live, so
    // the bar/pills still land in the right place either way. `useAdvancedWrap`
    // additionally lets Phaser break a single word mid-word when needed --
    // without it, wordWrap only breaks at spaces, so a long single word
    // (e.g. "Polycrystalline" in every WORLD_RIVALS/RIVAL_9_NAMES boss name)
    // wouldn't wrap at all and would overflow the box instead. A rival's own
    // name runs much longer on average than an ordinary wild's, so its label
    // uses a smaller base size to keep the wrapped block short enough to
    // clear MENU_TOP even at the largest text-size preset.
    const opponentName = this.add.text(614, 48, this.wild.name, {
      fontSize: fontPx(this, this.isRival ? 11 : 14),
      color: '#ffffff',
      backgroundColor: 'rgba(0,0,0,0.35)',
      padding: { x: 4, y: 2 },
      align: 'center',
      wordWrap: { width: FIELD_W - 614 - 12, useAdvancedWrap: true },
    });
    const opponentBarY = opponentName.y + opponentName.height + 8;
    this.add.rectangle(614, opponentBarY, 104, 12, 0x222222, 0.55).setOrigin(0, 0.5);
    this.opponentHpBar = this.add.rectangle(614, opponentBarY, 100, 8, 0x33cc33).setOrigin(0, 0.5);
    // Status pill (Kondo's moves, §5) -- empty/invisible until a status is
    // actually active (renderStatusLabel), so it costs nothing to lay out
    // for the common case where no status is in play.
    // Depth above the combat log (default depth 0, below) -- the log's own
    // box grows upward on a long wrapped line (setLogText) and can reach as
    // far up as this row at a big text-size setting; a higher depth keeps
    // the pill legibly on top rather than getting visually buried under it.
    this.opponentStatusLabel = this.add
      .text(614, opponentBarY + 9, '', {
        fontSize: fontPx(this, 11),
        color: STATUS_PILL_COLOR,
        backgroundColor: 'rgba(0,0,0,0.35)',
        padding: { x: 4, y: 1 },
      })
      .setOrigin(0, 0)
      .setDepth(5);
    // Passive pill (Franklin's/Bohr's abilities, §5) sits below the status
    // pill, offset from its *measured* height rather than a further
    // hardcoded gap -- same text-size-scaling reasoning as opponentBarY
    // above, and the status pill's own height still varies with the
    // text-size setting even while empty. Static for the whole battle
    // (playerActivePassives/opponentActivePassives never change mid-battle),
    // so its text is set once here (addPassivePill) rather than through a
    // render function like renderStatusLabel, and isn't kept as a field
    // since nothing needs to read it back afterward, same as
    // opponentName/playerName above.
    const opponentStatusBottom = this.opponentStatusLabel.y + this.opponentStatusLabel.height;
    this.addPassivePill(614, opponentStatusBottom + 4, passivePillText(this.opponentActivePassives), opponentStatusBottom);

    // A rival fight's opponent is that world's boss -- render it with the
    // same gigantic, multi-shard look it has standing at the goal tile in
    // the overworld (art/boss.ts's makeBossCrystal), not the plain shared
    // makeCrystal() every ordinary wild encounter uses.
    this.opponentPos = this.isRival ? BOSS_OPPONENT_POS : OPPONENT_POS;
    this.opponentCrystal = this.isRival
      ? makeBossCrystal(this, BOSS_CRYSTAL_SIZE, this.wild.color, this.wild.variant)
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

    // Everything below the crystal (the optional boost/fail note, the name,
    // the bar) is stacked from a running y rather than fixed pixel offsets --
    // same reasoning as the opponent bar above: label height scales with the
    // text-size setting (up to 2x, data/settings.ts), and fixed offsets tuned
    // for the smallest size let a taller label collide with whatever sits
    // below it (the name used to overlap the HP bar; with the boost/fail
    // note also fixed at a nearby y, moving one without the other just
    // shifts the collision).
    let playerY = PLAYER_POS.y + 30;

    if (this.attackMultiplier !== 1) {
      const boosted = this.attackMultiplier > 1;
      if (boosted) this.addBoostHalo(this.playerCrystal);
      else this.addFailCloud(this.playerCrystal);

      const boostText = this.add.text(190, playerY, boosted ? 'Attack boosted!' : 'Attack weakened...', {
        fontSize: fontPx(this, 12),
        color: boosted ? '#88ff88' : '#ff8888',
        backgroundColor: 'rgba(0,0,0,0.35)',
        padding: { x: 4, y: 2 },
      });
      playerY += boostText.height + 4;
    }

    const playerName = this.add.text(190, playerY, this.playerMaterial.name, {
      fontSize: fontPx(this, 14),
      color: '#ffffff',
      backgroundColor: 'rgba(0,0,0,0.35)',
      padding: { x: 4, y: 2 },
      wordWrap: { width: FIELD_W - 190 - 12 },
    });
    const playerBarY = playerName.y + playerName.height + 8;
    this.add.rectangle(190, playerBarY, 104, 12, 0x222222, 0.55).setOrigin(0, 0.5);
    this.playerHpBar = this.add.rectangle(190, playerBarY, 100, 8, 0x33cc33).setOrigin(0, 0.5);
    // Same depth-above-the-log reasoning as the opponent's pill above -- the
    // player's own bar sits closer to the log's usual bottom-anchored
    // resting spot, so this is the side actually at risk of the log's box
    // climbing up over it on a long wrapped line.
    this.playerStatusLabel = this.add
      .text(190, playerBarY + 9, '', {
        fontSize: fontPx(this, 11),
        color: STATUS_PILL_COLOR,
        backgroundColor: 'rgba(0,0,0,0.35)',
        padding: { x: 4, y: 1 },
      })
      .setOrigin(0, 0)
      .setDepth(5);
    // Same measured-height stacking (and off-canvas clamp) as the
    // opponent's passive pill above -- this is the side actually at risk of
    // it, since the boost/fail note and the crystal itself already eat into
    // the room below PLAYER_POS.y that this pill is the last row in.
    const playerStatusBottom = this.playerStatusLabel.y + this.playerStatusLabel.height;
    this.addPassivePill(190, playerStatusBottom + 4, passivePillText(this.playerActivePassives), playerStatusBottom);

    const openingLine = this.isRival ? `${this.wild.name} blocks the way onward!` : `A wild ${this.wild.name} appeared!`;
    this.logText = this.add.text(20, LOG_Y, '', {
      fontSize: fontPx(this, 14),
      color: '#ffffff',
      backgroundColor: 'rgba(0,0,0,0.45)',
      padding: { x: 8, y: 6 },
      wordWrap: { width: 600 },
    });
    this.setLogText(openingLine);

    // "Turns" preview widget (top-left corner) -- see drawTurnPreview's own
    // comment. Label is static chrome for the whole battle (same treatment
    // as the move menu's own section headers, `#8fa0c9`), so it's built once
    // here rather than inside drawTurnPreview, which only rebuilds the icon
    // row itself.
    this.turnPreviewLabel = this.add.text(TURN_PREVIEW_X, TURN_PREVIEW_Y, 'Turns', {
      fontSize: fontPx(this, 11),
      color: '#8fa0c9',
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

  // How many move rows can ever fit on one move-menu page without running
  // the panel off the bottom of the field -- the row-height floor
  // (drawMoveMenu's rowFloor) means a section with enough moves can't just
  // keep shrinking to fit, unlike everywhere else row height flexes to the
  // available space. Measured with throwaway Text objects at the *current*
  // text-size setting (rather than a hand-derived constant) so it keeps
  // tracking the real title/legend/header height the same way drawMoveMenu's
  // own rowsTop does, and deliberately assumes the worst case for chrome
  // that varies by section (pager arrows shown, a section legend line
  // present) so one shared number is safe to use for every section, not
  // just whichever one happens to be showing.
  private maxMoveRowsPerPage(): number {
    const scale = fontScale(this);
    const title = this.add.text(0, 0, 'MOVES', { fontSize: fontPx(this, 12), fontStyle: 'bold' });
    const legend = this.add.text(0, 0, '!! no natural defense (2x)', {
      fontSize: fontPx(this, 10),
      wordWrap: { width: MENU_WIDTH - 12 },
      lineSpacing: 2,
    });
    const rowsTop = MENU_TOP + 8 + title.height + 4 + legend.height + 8;
    title.destroy();
    legend.destroy();

    const headerScale = Math.min(scale, 1.15);
    const header = this.add.text(0, 0, 'BUFFS (9/9)', {
      fontSize: `${Math.round(10 * headerScale)}px`,
      fontStyle: 'bold',
    });
    const arrow = this.add.text(0, 0, '◀', { fontSize: `${Math.round(13 * headerScale)}px`, fontStyle: 'bold' });
    const sectionLegend = this.add.text(0, 0, '★ right=2x wrong=½x', {
      fontSize: `${Math.round(8 * headerScale)}px`,
    });
    const headerTotalH = Math.max(header.height, arrow.height) + sectionLegend.height + 1 + 1;
    header.destroy();
    arrow.destroy();
    sectionLegend.destroy();

    const rowFloor = 15; // the smaller of drawMoveMenu's two floors -- conservative on purpose
    const avail = FIELD_H - rowsTop - MENU_BOTTOM_MARGIN - headerTotalH;
    return Math.max(1, Math.floor(avail / rowFloor));
  }

  // moveSections() grouped by kind, further split so no single page ever
  // asks drawMoveMenu's row-height floor to cram in more rows than the
  // field actually has room for (this is what actually fixes the overflow
  // -- see maxMoveRowsPerPage's own comment). A section within the limit
  // stays one page, unchanged. An oversized one (ATTACKS for an
  // 'adaptive'-type crystal with every attack class learned is the only
  // section that currently gets this large) splits into evenly-sized pages
  // sharing the section's own label -- the header's own "(i/N)" page count
  // already disambiguates "ATTACKS" page 1 from page 2, the same way a
  // paginated candidate list elsewhere in the game numbers its pages,
  // rather than needing a second label scheme of its own.
  private moveMenuPages(moveIds: string[]): MoveSection[] {
    const maxRows = this.maxMoveRowsPerPage();
    return this.moveSections(moveIds).flatMap((section) => {
      if (section.ids.length <= maxRows) return [section];
      const pageCount = Math.ceil(section.ids.length / maxRows);
      const perPage = Math.ceil(section.ids.length / pageCount);
      const pages: MoveSection[] = [];
      for (let i = 0; i < section.ids.length; i += perPage) {
        pages.push({ label: section.label, ids: section.ids.slice(i, i + perPage), legend: section.legend });
      }
      return pages;
    });
  }

  // A dedicated docked panel on the right of the field, sized to fit
  // however many moves are currently usable (getBattleMoves -- the
  // player's learned moves intersected with what their current crystal
  // form's physics supports), instead of scattering individually
  // positioned buttons across the field.
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
  // Kondo move active never sees an empty page, and the pager itself is hidden entirely if there's
  // only one page to begin with. Showing one page instead of every section
  // stacked means each page's row height is budgeted only against that
  // page's own move count, not the worst-case total across every section at
  // once -- and moveMenuPages further splits any section too large for the
  // row-height floor to hold on one page (ATTACKS for an 'adaptive'-type
  // crystal with every attack class learned is the only one that currently
  // gets this large) into several same-label pages, so that floor is a
  // legibility limit, not a silent overflow off the bottom of the field.
  // Called again (destroying the old container first) on every page
  // switch, not just once at battle start.
  private drawMoveMenu(moveIds: string[]) {
    this.moveMenu?.destroy(true);
    const scale = fontScale(this);

    const container = this.add.container(0, 0).setDepth(30);
    this.moveMenu = container;

    // Title/legend built top-down first (running `y`, each line's own
    // wordWrap-driven height advancing it) so a long opponent name doesn't
    // wrap the legend into more lines than the old fixed legendH assumed
    // and run into row 1. The panel background is sized/inserted behind
    // everything once the real content height is known.
    let y = MENU_TOP + 8;
    const title = this.add
      .text(MENU_X + MENU_WIDTH / 2, y, 'MOVES', {
        fontSize: fontPx(this, 12),
        color: '#ffe066',
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 0);
    container.add(title);
    y += title.height + 4;

    // Kept short and name-independent on purpose -- this line's wrapped
    // height feeds directly into rowsTop, which shrinks every row's
    // available space (see the row-height budget below), so its length
    // can't scale with the current opponent's name (an early version read
    // "vs <wild.name>: ...", which overflowed the panel off-canvas against
    // a long name like "Thallium Copper Chloride" or "Polycrystalline
    // Manganese Bismuth Telluride Golem" at the largest text-size preset).
    // Only the mismatch symbol needs explaining up here now -- the analytic
    // ★2x/½x explanation moved to its own section header below (DESIGN.md
    // §4), so this line no longer has a longer conditional variant to worry
    // about.
    const legend = this.add
      .text(MENU_X + MENU_WIDTH / 2, y, '!! no natural defense (2x)', {
        fontSize: fontPx(this, 10),
        color: '#8fa0c9',
        align: 'center',
        wordWrap: { width: MENU_WIDTH - 12 },
        lineSpacing: 2,
      })
      .setOrigin(0.5, 0);
    container.add(legend);
    y += legend.height + 8;

    const rowsTop = y;

    if (moveIds.length === 0) {
      const empty = this.add
        .text(MENU_X + MENU_WIDTH / 2, rowsTop, 'No usable moves', {
          fontSize: fontPx(this, 11),
          color: '#cfd8ff',
          align: 'center',
          wordWrap: { width: MENU_WIDTH - 16 },
        })
        .setOrigin(0.5, 0);
      container.add(empty);
      const bg = this.add
        .rectangle(MENU_X, MENU_TOP, MENU_WIDTH, rowsTop + empty.height + 12 - MENU_TOP, 0x10101c, 0.9)
        .setOrigin(0, 0)
        .setStrokeStyle(2, 0xffe066);
      container.addAt(bg, 0);
      return;
    }

    const pages = this.moveMenuPages(moveIds);
    if (this.movePageIndex >= pages.length) this.movePageIndex = 0;
    const section = pages[this.movePageIndex];
    const showPager = pages.length > 1;
    const rowCount = Math.max(section.ids.length, 1);

    // Header is deliberately capped well below the text-size setting's full
    // range (headerScale, vs. the title/legend above which still scale
    // with it uncapped), same reasoning the row-height budget below has --
    // a header that grew all the way to the 2x 'Large' preset would eat
    // directly into the row budget and reintroduce the exact overflow the
    // row-height floor exists to prevent.
    const headerScale = Math.min(scale, 1.15);
    const HEADER_LEGEND_GAP = 1; // between the header's label and its own legend sub-line
    const HEADER_ROWS_GAP = 1; // from the header (or its legend) down to the first move row

    let rowY = rowsTop;
    let pagerRowH = 0;
    if (showPager) {
      const arrowPx = `${Math.round(13 * headerScale)}px`;
      const leftArrow = this.add
        .text(MENU_X + 14, rowY, '◀', { fontSize: arrowPx, color: '#ffe066', fontStyle: 'bold' })
        .setOrigin(0.5, 0)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.switchMovePage(-1));
      const rightArrow = this.add
        .text(MENU_X + MENU_WIDTH - 14, rowY, '▶', { fontSize: arrowPx, color: '#ffe066', fontStyle: 'bold' })
        .setOrigin(0.5, 0)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.switchMovePage(1));
      container.add(leftArrow);
      container.add(rightArrow);
      pagerRowH = Math.max(leftArrow.height, rightArrow.height);
    }
    const headerLabelText = showPager
      ? `${section.label} (${this.movePageIndex + 1}/${pages.length})`
      : section.label;
    const headerLabel = this.add
      .text(MENU_X + MENU_WIDTH / 2, rowY, headerLabelText, {
        fontSize: `${Math.round(10 * headerScale)}px`,
        color: '#8fa0c9',
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 0);
    container.add(headerLabel);
    // The arrow glyphs render at a larger px than the header label
    // (arrowPx vs 10*headerScale), so advancing by the label's own height
    // alone would let the taller arrows bleed into the first move row --
    // advance by whichever of the two is actually taller.
    rowY += Math.max(headerLabel.height, pagerRowH);
    if (section.legend) {
      const legendLine = this.add
        .text(MENU_X + MENU_WIDTH / 2, rowY, section.legend, {
          fontSize: `${Math.round(8 * headerScale)}px`,
          color: '#8fa0c9',
        })
        .setOrigin(0.5, 0);
      container.add(legendLine);
      rowY += legendLine.height + HEADER_LEGEND_GAP;
    }
    rowY += HEADER_ROWS_GAP;
    const headerTotalH = rowY - rowsTop;

    // Row height is a hard geometric budget -- whatever vertical space is
    // left in the field below the title/legend/header, divided across
    // however many moves this one page has -- not something the text-size
    // setting can just grow past. Each button's font size is derived from
    // its own row's actual height (fitPx) and clamped against the
    // setting-scaled desired size (desiredPx) -- growing with the setting
    // wherever the box has slack (few moves), but never past what the box
    // can physically hold. `rowCount` here can never exceed
    // maxMoveRowsPerPage's own limit -- moveMenuPages already split anything
    // larger into further pages -- so this floor is what sets the smallest
    // legible row size, not a bound this code has to also keep the panel on
    // screen against; that's moveMenuPages's job, verified against a live
    // browser render (headless-Chromium harness, DEVELOPMENT.md) at every
    // text-size preset with an 'adaptive'-type crystal carrying every
    // attack class at once, the worst case across every MaterialType's
    // MOVE_COMPATIBILITY entry.
    const rowFloor = rowCount <= 7 ? 20 : 15;
    const avail = FIELD_H - rowsTop - MENU_BOTTOM_MARGIN - headerTotalH;
    const naturalRowH = Math.floor(avail / rowCount);
    const maxRowH = Math.round(46 * Math.min(scale, 1.35));
    const rowH = Phaser.Math.Clamp(naturalRowH, rowFloor, Math.max(maxRowH, rowFloor));
    const compact = rowH < 40;
    const height = rowsTop - MENU_TOP + headerTotalH + rowCount * rowH + 8;

    const bg = this.add
      .rectangle(MENU_X, MENU_TOP, MENU_WIDTH, height, 0x10101c, 0.9)
      .setOrigin(0, 0)
      .setStrokeStyle(2, 0xffe066);
    container.addAt(bg, 0);

    const padY = compact ? 3 : 5;
    const fitPx = Math.max(9, Math.floor((rowH - padY * 2) / 2.4));
    const desiredPx = Math.round((compact ? 10 : 12) * scale);
    let btnPx = Math.min(desiredPx, fitPx);

    // fitPx above only budgets vertical space (rowH) -- it says nothing
    // about how wide a button's own two-line label renders, so a long tuned
    // move name (e.g. "Heavy Fermion Eruption", or any move's own name once
    // an Analytic/Ultimate/mismatch tag is appended) can still render wider
    // than MENU_WIDTH at a large text-size setting even though its height
    // fits fine. Measured (not wrapped) for the same reason maxMoveRowsPerPage
    // measures with throwaway Text objects rather than assuming a width --
    // wrapping the label onto a 3rd line would run into the row below it,
    // since rowH's vertical budget already assumes exactly two lines.
    // Shrunk once, uniformly across the whole page (every row on a page
    // shares one btnPx already) rather than per-button, so mismatched row
    // heights never appear.
    const measure = this.add.text(0, 0, '', { fontStyle: 'bold', padding: { x: 8, y: padY } });
    let widestLabelPx = 0;
    section.ids.forEach((moveId) => {
      measure.setFontSize(`${btnPx}px`).setText(this.moveButtonContent(moveId).text);
      widestLabelPx = Math.max(widestLabelPx, measure.width);
    });
    measure.destroy();
    if (widestLabelPx > MENU_WIDTH) {
      btnPx = Math.max(9, Math.floor(btnPx * (MENU_WIDTH / widestLabelPx)));
    }

    section.ids.forEach((moveId) => {
      this.addMoveButton(container, moveId, rowY, btnPx, padY);
      rowY += rowH;
    });
  }

  // The button label text and its color -- shared by addMoveButton (the
  // real interactive button) and drawMoveMenu's own width-fit measurement
  // pass above, so the two can never drift apart on what a button's label
  // actually says. Kondo's self-buff moves (KONDO_MOVE_IDS) get their own
  // early return: no mismatch check (they never attack, so canHost doesn't
  // apply -- calling it here would read every one of them as mismatched,
  // since 'screening' is deliberately off every type's MOVE_COMPATIBILITY
  // list) and no power number (never read as damage, see MOVES' own
  // comment), just the move's own fixed `name` -- unlike a tunable move,
  // none of Kondo's three are ever tuned, so `tunedMoveDisplayName` would
  // just read back the untuned 'screening' class's own bare label instead
  // of a real quasiparticle name.
  private moveButtonContent(moveId: string): { text: string; color: string } {
    const move = MOVES[moveId];
    if (KONDO_MOVE_IDS.includes(moveId)) {
      return { text: `${move.name}\n${STATUS_DURATION}-turn buff`, color: STATUS_PILL_COLOR };
    }
    const mismatch = !canHost(this.wild.type, getTunedMoveClass(this.game.registry, moveId));
    let tag = '';
    let color = '#ffff88';
    if (ANALYTIC_MOVE_IDS.includes(moveId)) {
      tag += ' ★';
      color = '#ffe066';
    }
    if (ULTIMATE_MOVE_IDS.includes(moveId)) {
      tag += ' ★★★';
      color = '#ff66ff';
    }
    if (mismatch) {
      tag += ' !!2x';
      color = '#ffaa44';
    }
    const displayName = tunedMoveDisplayName(this.game.registry, moveId);
    return { text: `${displayName}\nPwr ${move.power}${tag}`, color };
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
      .text(FIELD_W / 2, y, tunedMoveDisplayName(this.game.registry, move.id), {
        fontSize: fontPx(this, 15),
        color: '#ffe066',
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
      .rectangle(FIELD_W / 2, top + panelHeight / 2, panelWidth, panelHeight, 0x10101c, 0.94)
      .setStrokeStyle(2, 0xffe066);
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
          `${tunedMoveDisplayName(this.game.registry, move.id)} -- question ${index}/${questions.length}`,
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
        .rectangle(FIELD_W / 2, top + panelHeight / 2, panelWidth, panelHeight, 0x10101c, 0.94)
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
    this.add.ellipse(OPPONENT_POS.x, 195, 120, 28, shadowColor, 0.35);
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

    const outcrop3 = makeCrystal(this, 13, shade(biome.hillColor, 25), 'shard');
    outcrop3.setPosition(600, 252);
    outcrop3.setAlpha(0.8);
  }

  // Scattered pebbles and ground tufts across the field so the ground
  // reads as textured, not a flat gradient fill -- tufts tint off the
  // biome's path color (grass green in the meadow, icy blue in the frozen
  // caverns, ...) rather than a hardcoded grass green everywhere.
  private drawGroundDetail(biome: Biome) {
    const g = this.add.graphics();
    const spots: [number, number][] = [
      [40, 300], [590, 290], [520, 340], [110, 380], [30, 420],
      [610, 400], [340, 300], [260, 440], [430, 420], [500, 460],
      [150, 300], [560, 220],
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
    glow.fillStyle(0xffe066, 0.18);
    glow.fillCircle(0, 0, 58);
    glow.lineStyle(3, 0xffe066, 0.9);
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
      const ember = this.add.circle(Phaser.Math.Between(-22, 22), 34, Phaser.Math.Between(2, 3), 0xffe066, 0.9);
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
    this.opponentHpBar.width = Math.max(0, (this.opponentHp / this.wild.maxHp) * 100);
    this.playerHpBar.width = Math.max(0, (this.playerHp / this.playerMaterial.maxHp) * 100);
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
      const material = isPlayer ? this.playerMaterial : this.wild;
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
        ring.setStrokeStyle(3, 0xffe066, 1);
      } else {
        ring.setStrokeStyle(1.5, 0x8fa0c9, 0.45);
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
  // clamp with a higher ceiling instead of duplicating it.
  private setLogText(text: string, restY = LOG_Y) {
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
    const defenderType = isPlayer ? this.wild.type : this.playerMaterial.type;
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
    const mismatchMult = mismatch
      ? this.activePassives(defenderIsPlayer).has('edgeCurrent')
        ? EDGE_CURRENT_MISMATCH_MULT
        : 2
      : 1;

    // Bohr's Correlated Response (§5): a guaranteed crit set by the
    // defender's own previous turn (they were crit against while it was
    // active) is consumed here, before the ordinary roll, rather than after
    // -- a natural crit shouldn't burn a guaranteed one that would have
    // landed anyway.
    const guaranteed = this.guaranteedCritNext[isPlayer ? 'player' : 'opponent'];
    if (guaranteed) this.guaranteedCritNext[isPlayer ? 'player' : 'opponent'] = false;
    const critChance = Phaser.Math.Clamp((attackerStats.quantumness - BASE_STAT) * 0.02, 0, 0.5);
    const crit = guaranteed || Math.random() < critChance;
    // Landing a crit against a side with Correlated Response active arms
    // *their* own next move to guarantee a crit in return.
    if (crit && this.activePassives(defenderIsPlayer).has('correlatedResponse')) {
      this.guaranteedCritNext[defenderIsPlayer ? 'player' : 'opponent'] = true;
    }

    const attackMult = isPlayer ? this.attackMultiplier : 1;
    // Kondo's Screening Pulse buff (§5): incoming damage to whichever side
    // currently has Shielded active is multiplied down, symmetric like
    // every other resolveHit term, not hardcoded to "opponent only".
    const shieldedMult = this.statusShieldMultiplier(defenderIsPlayer);
    const defenseFactor = BASE_STAT / defenderStats.correlation;
    // Franklin's Diffraction Shadow (§5): incoming damage to whichever side
    // has it active is multiplied down for the whole battle -- a defect-
    // riddled lattice scatters and attenuates the blow, the way porous
    // carbon attenuates an X-ray beam.
    const fractionalGuardMult = this.activePassives(defenderIsPlayer).has('fractionalGuard')
      ? FRACTIONAL_GUARD_DAMAGE_MULT
      : 1;
    const dmg = Math.round(
      move.power *
        mismatchMult *
        attackMult *
        bonusMultiplier *
        shieldedMult *
        fractionalGuardMult *
        defenseFactor *
        (crit ? 1.5 : 1) *
        Phaser.Math.FloatBetween(0.85, 1.15)
    );
    // Kondo's Scattering Drag buff (§5): a defender with Evasive active has
    // a flat chance to dodge this hit entirely regardless of the damage just
    // computed above -- checked once per hit, independent of mismatch/crit
    // (a dodged hit never happened, it doesn't matter how hard it would have
    // landed).
    const evaded = this.statusEvasionActive(defenderIsPlayer) && Math.random() < EVASION_CHANCE;

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
      const who = isPlayer ? 'You' : `Wild ${this.wild.name}`;
      const defenderName = defenderIsPlayer ? this.playerMaterial.name : this.wild.name;
      const displayName = tunedMoveDisplayName(this.game.registry, moveId);
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

      // Bohr's Shared State (§5): a share of the damage the attacker just
      // dealt (the primary hit only, not Anyon Echo's own bonus tick above)
      // comes back to them as healing, capped at their own max HP.
      let healText = '';
      if (this.activePassives(isPlayer).has('sharedState')) {
        const healAmount = Math.round(dmg * SHARED_STATE_HEAL_FRACTION);
        const maxHp = isPlayer ? this.playerMaterial.maxHp : this.wild.maxHp;
        const currentHp = isPlayer ? this.playerHp : this.opponentHp;
        if (healAmount > 0 && currentHp < maxHp) {
          this.applyHeal(isPlayer, healAmount, maxHp);
          healText = ` ${PASSIVES.sharedState.name} heals ${who} for ${healAmount}!`;
        }
      }

      this.setLogText(
        whiff
          ? `${who}'s ${displayName} fizzles out -- the pattern never locked!`
          : `${who} used ${displayName}! (${dmg} dmg)${mismatchText}${critText}${buffText}${echoText}${healText}`
      );
    };

    // Win/lose check + turn handoff. For an ordinary move this runs right
    // after applyResult, synchronously below. For an Ultimate move it's
    // deferred to the animation's onComplete instead, so the opponent's
    // counter-swing can't be scheduled (and the battle can't end) until the
    // full summon animation has actually finished playing.
    const checkEndOrContinue = () => {
      if (this.opponentHp <= 0) {
        this.endBattle(true);
        return;
      }
      if (this.playerHp <= 0) {
        this.endBattle(false);
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

  // Which of Franklin's/Bohr's passives (data/passives.ts) are currently
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

  // Bohr's Shared State (§5) -- the healing counterpart to applyDamage
  // above, capped at `maxHp` rather than clamped at 0.
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
    return this.getStatus(isPlayer)?.kind === 'shielded' ? SHIELD_DAMAGE_MULT : 1;
  }

  private statusEvasionActive(isPlayer: boolean): boolean {
    return this.getStatus(isPlayer)?.kind === 'evasive';
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
    const who = isPlayer ? 'You' : `Wild ${this.wild.name}`;
    const pos = isPlayer ? PLAYER_POS : this.opponentPos;
    const targetCrystal = isPlayer ? this.playerCrystal : this.opponentCrystal;

    playAttackEffect(this, move.class, pos, pos, () => this.flashHit(targetCrystal), 1);

    const buffText = tickStatus ? this.applyOrTickBuff(move, isPlayer) : '';
    this.setLogText(`${who} used ${move.name}!${buffText}`);

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
    const casterName = isPlayer ? this.playerMaterial.name : this.wild.name;
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
  // fraction of its own max HP (REGEN_HEAL_FRACTION), called once per tick
  // from applyOrTickBuff above, capped so it never overheals past `maxHp`.
  // Returns '' (no log clause) once the side is already at full HP, the same
  // "nothing to report" convention Bohr's Shared State heal uses.
  private applyRegenTick(isPlayer: boolean, casterName: string): string {
    const maxHp = isPlayer ? this.playerMaterial.maxHp : this.wild.maxHp;
    const currentHp = isPlayer ? this.playerHp : this.opponentHp;
    const healAmount = Math.min(maxHp - currentHp, Math.round(maxHp * REGEN_HEAL_FRACTION));
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
  }

  // Creates the passive pill (Franklin's/Bohr's abilities, §5) stacked below
  // that side's status pill at (x, naturalY), then measures its actual
  // rendered size and corrects position/existence rather than trusting
  // naturalY/x directly -- up to two joined passive names (passivePillText)
  // can run wide enough at the largest text-size setting to push past
  // FIELD_W if left-anchored at the same x as the column above it (fixed
  // below by an x clamp), and that same setting can leave the whole stack
  // above it (boost/fail note + name + bar + status pill, on the player
  // side) taller than the room actually left under FIELD_H (fixed below by
  // dropping the pill rather than drawing it back on top of the status pill
  // it's stacked below).
  private addPassivePill(x: number, naturalY: number, text: string, statusBottom: number) {
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
    label.setPosition(Math.min(x, FIELD_W - label.width - 8), cappedY);
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
    this.game.registry.set('playerHp', this.playerMaterial.maxHp);

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
    const flavor = won ? victoryLine(this.wild) : defeatLine(this.wild);
    const blurb = materialBlurb(this.wild);
    // The end-of-battle summary runs several lines longer than an in-combat
    // log line (flavor + token delta + the physics blurb), so it needs a
    // much higher clamp ceiling than setLogText's default LOG_Y -- a big
    // text size or a long blurb still can't push the bottom off-canvas.
    this.setLogText(`${flavor}\n${tokenText}\n\n${blurb}\n\nPress SPACE to return.`, 210);

    this.input.keyboard!.once('keydown-SPACE', () => this.scene.start('Overworld', { world: this.world }));
  }
}
