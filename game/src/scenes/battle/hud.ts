// Battle-screen layout: where every fixed piece of the arena and its HUD
// sits, plus the two HUD pieces that are pure geometry (the floating
// nameplates and the turn-order preview row).
//
// Split out of BattleScene so "where things are drawn" lives apart from
// "what a battle does" -- everything here is a plain function taking the
// scene, holding no battle state of its own, the same shape
// scenes/panels/hubStations.ts uses for the Lab's panels. The move menu
// stays in BattleScene: it reads and writes that scene's own paging/turn-lock
// state and wires up move buttons, so it is battle behaviour with a layout,
// not layout on its own.
//
// The composition it lays out: the two combatants on a lower-left/upper-right
// diagonal, each carrying its own nameplate floating directly above its head,
// and every piece of screen chrome (turn-order preview, move menu, combat
// log) seated on a shared margin frame. That split -- a combatant's own
// readouts travel with the combatant, everything else sits on the frame --
// is what keeps the screen reading as one composition instead of a corner
// each.
import Phaser from 'phaser';
import { makeCrystal } from '../../art/crystals';
import { BOSS_FOOT, makeBossIcon } from '../../art/boss';
import { GROUND_DROP } from '../../art/attackShapes';
import { GOLD_ACCENT, PANEL_BG, REFERENCE_BLUE_GREY } from '../../ui/theme';
import { fontScale } from '../../ui/text';
import { CANVAS_W, CANVAS_H } from '../../config/screen';
import type { Material } from '../../data/types';

// Field size is the shared canvas size (config/screen.ts) -- aliased here
// since every constant below reads as "a distance across the battle field"
// rather than "a distance across the canvas."
export const FIELD_W = CANVAS_W;
export const FIELD_H = CANVAS_H;
export const HORIZON_Y = 262;
// Where the walkable floor's far edge crosses the arena, splitting the near
// ground into the surround the route is hemmed in by (above) and the floor the
// fight is standing on (below). Held above the player's own feet
// (PLAYER_POS.y) with room to spare, since the player must read as standing on
// the floor rather than astride its edge; the opponent sits higher up the
// frame by composition and is not on this plane at all.
export const FLOOR_EDGE_Y = HORIZON_Y + 62;

// The margin frame every screen-anchored element sits on. A single set of
// rails rather than a per-widget margin is what makes the corners read as
// one frame around the fight.
export const LEFT_RAIL = 16;
export const RIGHT_RAIL = FIELD_W - 16;
export const TOP_RAIL = 10;
export const BOTTOM_RAIL = FIELD_H - 16;

// Both combatants and the ground they stand on. A crystal's ground shadow
// is always GROUND_DROP below its own anchor -- the same offset
// art/attackShapes.ts drops a ground-anchored effect (a meteor's rune, an
// impact shockwave) to, so the floor those effects land on and the floor the
// crystal visibly stands on are the same line by construction, at whichever
// position that fight placed either crystal.
export const PLAYER_POS = { x: 240, y: 345 };
export const OPPONENT_POS = { x: 674, y: 162 };
export const BOSS_OPPONENT_POS = { x: 644, y: 184 };
export const PLAYER_CRYSTAL_SIZE = 55;
export const WILD_CRYSTAL_SIZE = 50;
export const BOSS_CRYSTAL_SIZE = 64;
export const SHADOW_DROP = GROUND_DROP;

// A rival's golem is a standing figure, not a hovering gem: its feet have to
// meet the arena floor exactly, and the arena floor at a combatant's spot is
// GROUND_DROP below that combatant's anchor by the rule above. The golem's
// own art puts its feet BOSS_FOOT*size below wherever it is drawn, which is
// further than that, so it is handed to `makeBossCrystal` as a `footDrop` of
// SHADOW_DROP instead -- its art rides this much higher inside its own
// container, and its feet, its contact shadow, the arena's painted floor
// shadow and every ground-anchored attack effect all land on one line.
// BOSS_OPPONENT_POS is set so that line falls where it does, rather than the
// golem itself moving up the field.
export const BOSS_GROUND_LIFT = BOSS_FOOT * BOSS_CRYSTAL_SIZE - GROUND_DROP;

// How far each crystal's actually-painted art reaches above and below its
// own anchor point -- measured from a live headless-Chromium render (see
// DEVELOPMENT.md), by hiding every other object in the scene, putting a flat
// mid-grey behind it (so a dark contact shadow counts as painted as much as
// a bright rim does) and scanning several seconds of frames for any pixel
// that differs from it, so the idle motion is included in the reach rather
// than only the pose one frame happened to catch. Not computed from the
// art's nominal size (every one of these silhouettes reaches well past it,
// the boss golem most of all). A nameplate floats off the head offset; the move menu's own ceiling
// is derived from the boss's foot offset. The boss's pair is measured from
// its own anchor, so both already carry BOSS_GROUND_LIFT: its head sits
// further above that ground point than a body-centred offset would suggest,
// and its foot drop is the contact shadow's own reach past GROUND_DROP.
export const PLAYER_HEAD_RISE = 57;
export const WILD_HEAD_RISE = 45;
export const BOSS_HEAD_RISE = 108;
export const BOSS_FOOT_DROP = 57;

// Nameplate geometry, shared by both sides.
export const HP_BAR_W = 140;
export const HP_BAR_H = 10;
export const HP_BAR_FILL_W = 134;
export const HP_BAR_FILL_H = 6;
const PLATE_MAX_W = 380;
const PLATE_PAD_X = 10;
const PLATE_PAD_Y = 5;
const PLATE_HEAD_GAP = 8; // between a plate's bottom edge and the head it floats over
const PLATE_ROW_GAP = 4;
const PLATE_MIN_NAME_PX = 9;
export const STATUS_PILL_COLOR = '#ff8f6a';
// Franklin's passives read in their own muted blue-violet rather than
// Kondo's rust-orange, so an always-on passive is distinct at a glance from
// a ticking status.
export const PASSIVE_PILL_COLOR = '#8fa0ff';

// Move menu: docked bottom-right on the frame's own rails, its bottom edge
// fixed and its top edge derived fresh on every draw from however tall the
// current page's content is (BattleScene.drawMoveMenu), so the panel grows
// upward from that fixed bottom. MENU_MIN_TOP is how far up that growth is
// ever allowed to reach: the boss golem's own painted feet plus a margin,
// derived from the same measured offset the golem is actually drawn with
// rather than hand-tuned, so moving the boss can never silently leave the
// two overlapping.
export const MENU_WIDTH = 284;
export const MENU_X = RIGHT_RAIL - MENU_WIDTH;
export const MENU_BOTTOM = BOTTOM_RAIL;
export const MENU_MIN_TOP = BOSS_OPPONENT_POS.y + BOSS_FOOT_DROP + 7;

// "Turns" preview widget, top-left on the frame's rails.
export const TURN_PREVIEW_X = LEFT_RAIL;
export const TURN_PREVIEW_Y = TOP_RAIL;
export const TURN_PREVIEW_LENGTH = 5;
export const TURN_PREVIEW_ICON_SIZE = 32;
export const TURN_PREVIEW_ICON_SPACING = 36;
// Whose-turn ring drawn behind each icon -- radius matches half the icon
// spacing so adjacent rings meet edge-to-edge without overlapping.
export const TURN_PREVIEW_RING_RADIUS = TURN_PREVIEW_ICON_SPACING / 2;

// Combat log: bottom-left on the rails, filling the band the player's own
// cluster leaves free below its ground shadow. Its band is bounded on both
// sides (LOG_MIN_TOP..BOTTOM_RAIL) and its text shrinks to fit that band
// (BattleScene.setLogText) rather than climbing into the player's crystal,
// which is what a long line at the largest text-size preset would otherwise
// do. The end-of-battle summary runs several lines longer and passes its own
// wider wrap/higher ceiling instead -- the move menu is already destroyed by
// then, so there is no panel left for it to stay clear of.
export const LOG_X = 20;
export const LOG_Y = BOTTOM_RAIL - 24;
export const LOG_MIN_TOP = PLAYER_POS.y + SHADOW_DROP + 19;
export const LOG_WRAP_WIDTH = MENU_X - LOG_X - 16;
export const LOG_WRAP_WIDTH_VICTORY = FIELD_W - 40;

export interface Nameplate {
  hpFill: Phaser.GameObjects.Rectangle;
  statusLabel: Phaser.GameObjects.Text;
  top: number;
  // Tears down every object this plate drew. The plate is a one-shot fitted
  // layout -- the chip is sized to the name's *rendered* width and the bar
  // sits under the name's measured height -- so a side whose name changes
  // mid-battle (World 10's rival, BattleScene.transmuteAdapted) rebuilds its
  // plate whole through this rather than retitling the label in place, which
  // would leave a long new name overflowing a chip fitted to the old one.
  // The plate draws straight into scene coordinates rather than into a
  // container of its own, so the struct has to own this list itself.
  destroy: () => void;
}

export interface NameplateOptions {
  // Anchor of the crystal this plate belongs to, and how far its painted art
  // reaches above that anchor -- the plate floats just above that head.
  centerX: number;
  headTop: number;
  name: string;
  namePx: number;
  // Gold for the player's own plate, dim blue-grey for the opponent's --
  // the same "gold means the player" code the turn-order rings and the move
  // menu already use, carried onto the nameplates so a glance at any piece
  // of chrome says whose it is.
  accent: number;
  // Reserved height for the Kondo status pill, which appears and disappears
  // mid-battle: a side that can never cast one (no wild ever does) leaves no
  // gap for it. Reserved rather than measured live because the plate is
  // bottom-anchored -- an unreserved pill appearing mid-fight would shove the
  // name and bar upward on the turn it lands.
  reserveStatus: boolean;
  passiveText: string;
  // The quiz result's own one-off note ('Attack boosted!'), stacked at the
  // top of the plate for the battles that carry one.
  note?: { text: string; color: string; px: number };
}

// One floating name-over-bar plate, laid out as a bottom-anchored stack
// (note, name, bar, status pill, passive pill) whose bottom edge sits just
// above the crystal's own painted head, clamped so a tall stack rides down
// onto the top rail instead of off the top of the field. Both sides build
// theirs from this same function -- the plate is a combatant's own readout,
// so it travels with the combatant rather than living in a screen corner,
// and the boss golem (whose head already reaches into the top of the field)
// gets the same plate simply pushed up against the rail.
export function drawNameplate(scene: Phaser.Scene, opts: NameplateOptions): Nameplate {
  const maxWidth = Math.min(PLATE_MAX_W, 2 * Math.min(opts.centerX - LEFT_RAIL, RIGHT_RAIL - opts.centerX));
  const wrapW = maxWidth - PLATE_PAD_X * 2;
  const plateBottom = opts.headTop - PLATE_HEAD_GAP;
  const room = plateBottom - TOP_RAIL;

  const note = opts.note
    ? scene.add
        .text(0, 0, opts.note.text, {
          fontSize: `${opts.note.px}px`,
          color: opts.note.color,
          backgroundColor: 'rgba(0,0,0,0.35)',
          padding: { x: 4, y: 2 },
        })
        .setOrigin(0.5, 0)
    : null;
  const statusLabel = scene.add
    .text(0, 0, '', { fontSize: `${Math.round(opts.namePx * 0.8)}px`, color: STATUS_PILL_COLOR, padding: { x: 4, y: 1 } })
    .setOrigin(0.5, 0);
  const passive = opts.passiveText
    ? scene.add
        .text(0, 0, opts.passiveText, {
          fontSize: `${Math.round(opts.namePx * 0.8)}px`,
          color: PASSIVE_PILL_COLOR,
          backgroundColor: 'rgba(0,0,0,0.35)',
          padding: { x: 4, y: 1 },
        })
        .setOrigin(0.5, 0)
    : null;

  // `useAdvancedWrap` lets Phaser break mid-word where it has to -- plain
  // wordWrap only breaks at spaces, and a rival's name carries single words
  // ('Polycrystalline') long enough to run past the plate on their own.
  const nameText = scene.add
    .text(0, 0, opts.name, {
      fontSize: `${opts.namePx}px`,
      color: '#ffffff',
      align: 'center',
      wordWrap: { width: wrapW, useAdvancedWrap: true },
    })
    .setOrigin(0.5, 0);

  // Shrink-to-fit against the room the crystal's own head leaves above it,
  // the same whole-px-steps-down-to-a-floor treatment every other text block
  // in the game that has to live inside a fixed budget uses. It only ever
  // bites for a long rival name at a large text-size preset, where the boss's
  // head reaches highest and leaves least room.
  const chipH = () => PLATE_PAD_Y * 2 + nameText.height + PLATE_ROW_GAP + HP_BAR_H;
  const stackH = () =>
    (note ? note.height + PLATE_ROW_GAP : 0) +
    chipH() +
    (opts.reserveStatus ? statusLabel.height + 2 : 0) +
    (passive ? passive.height + 2 : 0);
  let namePx = opts.namePx;
  while (namePx > PLATE_MIN_NAME_PX && stackH() > room) {
    namePx -= 1;
    nameText.setFontSize(`${namePx}px`);
  }

  const height = stackH();
  const top = Math.max(TOP_RAIL, plateBottom - height);
  // The chip is sized to what it actually holds -- its own name at whatever
  // width that name really rendered to, floored at the bar it has to contain
  // -- rather than every plate stretching to the full width the rails would
  // allow. A short name gets a small plate, so the plate reads as a label on
  // its crystal rather than a banner across the field.
  const width = Phaser.Math.Clamp(Math.ceil(nameText.width) + PLATE_PAD_X * 2, HP_BAR_W + PLATE_PAD_X * 2, maxWidth);

  let y = top;
  if (note) {
    note.setPosition(opts.centerX, y);
    y += note.height + PLATE_ROW_GAP;
  }

  const chipHeight = chipH();
  const chip = scene.add.graphics().setDepth(4);
  chip.fillStyle(PANEL_BG, 0.72);
  chip.fillRoundedRect(opts.centerX - width / 2, y, width, chipHeight, 6);
  chip.lineStyle(1, opts.accent, 0.55);
  chip.strokeRoundedRect(opts.centerX - width / 2, y, width, chipHeight, 6);

  nameText.setPosition(opts.centerX, y + PLATE_PAD_Y);
  const barY = y + PLATE_PAD_Y + nameText.height + PLATE_ROW_GAP;
  // A track behind the fill, stroked, so a bar at full health still reads as
  // a gauge rather than a plain green rectangle.
  const track = scene.add.rectangle(opts.centerX, barY, HP_BAR_W, HP_BAR_H, 0x0b1020, 0.85).setOrigin(0.5, 0);
  track.setStrokeStyle(1, opts.accent, 0.45);
  const hpFill = scene.add
    .rectangle(opts.centerX - HP_BAR_FILL_W / 2, barY + (HP_BAR_H - HP_BAR_FILL_H) / 2, HP_BAR_FILL_W, HP_BAR_FILL_H, 0x33cc33)
    .setOrigin(0, 0);

  y += chipHeight;
  statusLabel.setPosition(opts.centerX, y + 2);
  if (opts.reserveStatus) y += statusLabel.height + 2;
  passive?.setPosition(opts.centerX, y + 2);

  // Above the combat log (default depth), whose own box grows upward on a
  // long wrapped line and shares the field with the player's plate.
  [note, nameText, track, hpFill, statusLabel, passive].forEach((obj) => obj?.setDepth(5));

  const parts = [note, nameText, chip, track, hpFill, statusLabel, passive];
  return { hpFill, statusLabel, top, destroy: () => parts.forEach((obj) => obj?.destroy()) };
}

// The row of upcoming-hit icons under the "Turns" label, rebuilt whole
// (label included) every time the predicted order changes.
export function drawTurnPreview(
  scene: Phaser.Scene,
  sequence: boolean[],
  playerMaterial: Material,
  opponentMaterial: Material,
  opponentIsBoss: boolean
): Phaser.GameObjects.Container {
  const container = scene.add.container(TURN_PREVIEW_X, TURN_PREVIEW_Y).setDepth(5);
  const label = scene.add
    .text(0, 0, 'TURNS', {
      fontSize: `${Math.round(10 * Math.min(fontScale(scene), 1.35))}px`,
      fontStyle: 'bold',
      color: '#8fa0c9',
      backgroundColor: 'rgba(0,0,0,0.35)',
      padding: { x: 4, y: 2 },
    })
    .setOrigin(0, 0);
  container.add(label);

  // Gap below the label padded out by how far the ring extends past the
  // icon's own half-size, so the ring never touches the label tag above it
  // at any font-scale preset (the ring is the widest thing in each icon's
  // footprint, wider than the crystal art itself).
  const rowY = label.height + 4 + Math.max(0, TURN_PREVIEW_RING_RADIUS - TURN_PREVIEW_ICON_SIZE / 2);
  sequence.forEach((isPlayer, i) => {
    const material = isPlayer ? playerMaterial : opponentMaterial;
    // A rival's icons carry the golem silhouette the same opponent has on the
    // field (art/boss.ts's makeBossIcon, reduced to what reads at this size),
    // so the row shows the same two fighters the arena does rather than
    // demoting the boss to an ordinary crystal.
    const icon =
      !isPlayer && opponentIsBoss
        ? makeBossIcon(scene, TURN_PREVIEW_ICON_SIZE, material.color)
        : makeCrystal(scene, TURN_PREVIEW_ICON_SIZE, material.color, material.variant, {
            seed: material.name,
            hybrid: material.hybridParents,
          });
    // Whose-turn ring behind the crystal shapes (`addAt(..., 0)`): a bold
    // full-opacity gold ring for the player's hits, matching this project's
    // established active/highlighted accent color, versus a thinner, dimmer
    // blue-grey ring for the opponent's -- keeps the row legible on whose
    // turn is whose even when the two sides happen to share the exact same
    // crystal color (same-material matchups, routine from world 9 onward).
    const ring = scene.add.circle(0, 0, TURN_PREVIEW_RING_RADIUS);
    if (isPlayer) ring.setStrokeStyle(3, GOLD_ACCENT, 1);
    else ring.setStrokeStyle(1.5, REFERENCE_BLUE_GREY, 0.45);
    icon.addAt(ring, 0);
    icon.setPosition(i * TURN_PREVIEW_ICON_SPACING + TURN_PREVIEW_ICON_SIZE / 2, rowY + TURN_PREVIEW_ICON_SIZE / 2);
    container.add(icon);
  });
  return container;
}
