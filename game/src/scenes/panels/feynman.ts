import Phaser from 'phaser';
import type { GuardianPanelHost } from '../OverworldScene';
import { renderGuardianHeader } from './guardianHeader';
import { makeFeynmanAvatar } from '../../art/feynman';
import { CANVAS_W } from '../../art/perspective';
import { fontPx, fontScale } from '../../ui/text';
import { makeQuestionText } from '../../ui/mathtext';
import { PANEL_BG, REFERENCE_BLUE_GREY_HEX } from '../../ui/theme';
import {
  MOVES,
  compatibleMoves,
  getPlayerMaterial,
  getMoveLevel,
  getUnlockedMoveLevel,
  getTunedMoveClass,
  moveDisplayName,
  tunedMoveDisplayName,
  feynmanLevelCost,
  MOVE_LEVEL_NAMES,
  MOVE_LEVEL_STREAKS,
} from '../../data/materials';
import type { MoveLevel } from '../../data/materials';
import { getAnalyticQuestions } from '../../data/quiz';
import { persistFromRegistry } from '../../data/save';
import type { Move } from '../../data/types';
import {
  LIST_DETAIL_PANEL_W,
  listDetailColumns,
  renderListColumn,
  destroyPanel,
  insertColumnDivider,
  renderListColumnFooter,
  renderMoveDetailHeader,
  renderStatusAndConfirm,
} from './listDetail';
import { stopMoveEffectPreview } from '../../art/moveEffectPreview';
import { ANALYTIC_SHAPES, ULTIMATE_SHAPES } from '../../art/attackEffects';

// Feynman stands at world 7's middle tile (WORLD_GUARDIANS) and offers to
// level up any move the player already carries (`unlockedMoves`, regardless
// of which guardian originally sold it) -- three tiers per move (§5,
// data/materials.ts's MOVE_LEVEL_NAMES/MULTIPLIERS/STREAKS), one at a time
// in sequence. Unlike every other guardian's panel, there's no separate
// purchase step: picking a row here both pays `feynmanLevelCost` up front
// (lost regardless of outcome) and immediately opens the streak of quiz
// questions that decides whether the level actually lands -- see
// showLevelStreak below. A list+detail panel (listDetail.ts): the left
// column lists the moves the player owns, the right pane previews the
// selected one at the tier it is currently carried at, offers every tier it
// has already unlocked as a free pick (renderCarriedLevelRow), and states
// what the next tier up costs and how long a streak it demands.
export function showFeynmanPanel(scene: GuardianPanelHost) {
  scene.dialogueActive = true;

  const panelWidth = LIST_DETAIL_PANEL_W;
  const top = 20;
  const container = scene.add.container(0, 0).setDepth(100);
  scene.dialogueContainer = container;

  let y = top;

  y = renderGuardianHeader(scene, container, {
    y,
    panelWidth,
    avatar: makeFeynmanAvatar,
    quote: '"A tensor network and a Feynman diagram draw the same trick two ways: a vertex for every point, a line for every leg. Show me you understand a move you already carry, and I will draw a higher-order correction into it. Paid for whether it lands or not."',
    introPx: fontPx(scene, 11),
  });

  y = renderMoveLevelList(scene, container, y, panelWidth);
  y += 8;

  const panelHeight = y - top;
  const panel = scene.add
    .rectangle(CANVAS_W / 2, top + panelHeight / 2, panelWidth, panelHeight, PANEL_BG, 0.94)
    .setStrokeStyle(2, 0xffa64a);
  container.addAt(panel, 0);
}

// One row per unlocked move **the player's current crystal can actually
// host** -- the unlocked list filtered by `compatibleMoves` on the form they
// are wearing right now. Feynman deepens a move the player carries, and a
// quasiparticle their present lattice has no way to support is not one they
// carry; offering to level it is offering to sharpen something they cannot
// swing. Transmuting or fusing into a form that hosts it brings it back into
// the list, at whatever level it already had, since the level lives on the
// move rather than on the form.
//
// The Kondo single-active-move rule is deliberately *not* applied here (so
// this is not simply `getBattleMoves`): which Kondo move is screened in right
// now is a battle-loadout question, and both are equally real to level. Rows
// carry the move's tuned name without
// its level prefix (tunedMoveDisplayName, not moveDisplayName): the prefix
// is the same word on every row of a well-leveled save, and at the largest
// text-size preset it alone fills the 200px column, trimming every row to
// an identical "Infinite ..." Level, streak length and cost all live in the
// detail pane instead, beside the move's own animated preview -- the pane
// has the width to show the full leveled name in its header. A maxed-out (level 3) move
// still selects and previews -- its cascade at full level is the reward for
// having leveled it -- but the pane offers no confirm button, the same
// nothing-to-commit convention Dresselhaus's current form and Bloch's
// current world use.
function renderMoveLevelList(
  scene: GuardianPanelHost,
  container: Phaser.GameObjects.Container,
  y: number,
  panelWidth: number
): number {
  const hostable = new Set(compatibleMoves(getPlayerMaterial(scene.game.registry)));
  const moves = scene.getUnlockedMoves().filter((id) => hostable.has(id)).map((id) => MOVES[id]);

  if (moves.length === 0) {
    const text = scene.add
      .text(CANVAS_W / 2, y, 'You carry no moves for me to correct.', {
        fontSize: fontPx(scene, 13),
        color: '#ffffff',
        align: 'center',
        wordWrap: { width: panelWidth - 80 },
      })
      .setOrigin(0.5, 0);
    container.add(text);
    // No columns render in this branch, so there is no left column to put
    // the Farewell button in -- it takes a full-width footer row instead.
    return scene.renderFarewellFooter(container, y + text.height + 8);
  }

  const columns = listDetailColumns((CANVAS_W - panelWidth) / 2);
  const columnsTop = y;

  const preview = scene.feynmanPreview && MOVES[scene.feynmanPreview] ? scene.feynmanPreview : null;
  const effectivePreview = preview && moves.some((m) => m.id === preview) ? preview : moves[0].id;

  const listResult = renderListColumn({
    scene,
    container,
    x: columns.leftX,
    y: columnsTop,
    width: columns.leftColW,
    items: moves,
    idFor: (move) => move.id,
    labelFor: (move) =>
      move.class === 'screening' ? move.name : tunedMoveDisplayName(scene.game.registry, move.id),
    selectedId: effectivePreview,
    page: scene.feynmanPage,
    onPageChange: (page) => {
      scene.feynmanPage = page;
      destroyPanel(scene);
      showFeynmanPanel(scene);
    },
    onSelect: (move) => {
      scene.feynmanPreview = move.id;
      destroyPanel(scene);
      showFeynmanPanel(scene);
    },
  });
  scene.feynmanPage = listResult.page;

  const move = MOVES[effectivePreview];
  // Two different levels, and the pane needs both: `unlocked` is the highest
  // tier this move has ever landed (what the next attempt builds on),
  // `carried` is the tier the player currently has it set to swing at (what
  // the name, the stage's cascade and the battle itself use).
  const unlocked = getUnlockedMoveLevel(scene.game.registry, move.id);
  const carried = getMoveLevel(scene.game.registry, move.id) as MoveLevel;
  const tokens = (scene.game.registry.get('qumatessence') as number) || 0;

  let rightY = columnsTop;
  // Feynman's list carries every move the player owns, Landau's Analytic pair
  // and Skłodowska-Curie's Ultimate pair included, so the pane resolves the
  // same current class/shape override those guardians' own panels do
  // (listDetail.ts's renderMoveDetailHeader contract) -- otherwise a move
  // titled "Magnon Lance" would preview as its static Phonon bolt.
  rightY = renderMoveDetailHeader(
    scene,
    container,
    moveDisplayName(scene.game.registry, move.id),
    getTunedMoveClass(scene.game.registry, move.id),
    ANALYTIC_SHAPES[move.id] ?? ULTIMATE_SHAPES[move.id],
    columns.rightColCenterX,
    rightY,
    columns.rightColW,
    carried
  );

  rightY = renderCarriedLevelRow(scene, container, move.id, unlocked, carried, columns.rightColCenterX, rightY, columns.rightColW);

  if (unlocked >= 3) {
    rightY = renderStatusAndConfirm({
      scene,
      container,
      centerX: columns.rightColCenterX,
      y: rightY,
      colW: columns.rightColW,
      status: `Already at "${MOVE_LEVEL_NAMES[3]}", the highest correction I can draw.`,
    });
  } else {
    const nextLevel = (unlocked + 1) as 1 | 2 | 3;
    const cost = feynmanLevelCost(move, nextLevel);
    const streak = MOVE_LEVEL_STREAKS[nextLevel];
    rightY = renderStatusAndConfirm({
      scene,
      container,
      centerX: columns.rightColCenterX,
      y: rightY,
      colW: columns.rightColW,
      status: `Level to "${MOVE_LEVEL_NAMES[nextLevel]}": ${streak} questions in a row, ${cost} qumatessence paid whether it lands or not.`,
      confirm: {
        label: `Level to "${MOVE_LEVEL_NAMES[nextLevel]}"`,
        onClick: () => startLevelUp(scene, move, nextLevel, cost),
        dimmed: tokens < cost,
      },
    });
  }

  const leftBottom = renderListColumnFooter(scene, container, columns, listResult.bottom + 10, 'Farewell', () =>
    scene.closeDialogue()
  );
  const columnsBottom = Math.max(leftBottom, rightY);
  insertColumnDivider(scene, container, columns.dividerX, columnsTop, columnsBottom);
  return columnsBottom + 6;
}

// Which tier a move is carried at is the player's own pick among the tiers
// they have landed, not automatically the deepest one (§5) -- so this row
// offers every level from the move's uncorrected base up to its unlocked
// ceiling, and picking one is what `getMoveLevel` reads everywhere
// afterward: the move's name, its damage, the cascade its effect animates,
// and (for one of Kondo's) how hard its cloud screens. Renders nothing at
// all while a move is still at level 0, since there is no choice to make
// yet, so the pane keeps the height it has always had until the player's
// first tier lands. The carried tier reads as a dimmed no-op button, the
// same "already the active choice" treatment every other pane's confirm
// button uses for a commit that would change nothing.
const CARRIED_LEVEL_LABELS = ['Base', ...MOVE_LEVEL_NAMES.slice(1)];

function renderCarriedLevelRow(
  scene: GuardianPanelHost,
  container: Phaser.GameObjects.Container,
  moveId: string,
  unlocked: MoveLevel,
  carried: MoveLevel,
  centerX: number,
  y: number,
  colW: number
): number {
  if (unlocked <= 0) return y;

  const captionScale = Math.min(fontScale(scene), 1.15);
  const caption = scene.add
    .text(centerX, y, 'Swing it at:', {
      fontSize: `${Math.round(11 * captionScale)}px`,
      color: REFERENCE_BLUE_GREY_HEX,
      align: 'center',
    })
    .setOrigin(0.5, 0);
  container.add(caption);
  let rowY = y + caption.height + 4;

  // One button per tier, laid across the pane's full width -- four at the
  // most (base plus three corrections), which is why they can be a plain
  // fixed row rather than the paged list every longer set of options in the
  // game uses.
  const levels = Array.from({ length: unlocked + 1 }, (_, i) => i as MoveLevel);
  const gap = 6;
  const buttonW = (colW - gap * (levels.length - 1)) / levels.length;
  const buttonPx = `${Math.round(12 * Math.min(fontScale(scene), 1.15))}px`;
  let bottom = rowY;
  levels.forEach((lvl, i) => {
    const x = centerX - colW / 2 + buttonW / 2 + i * (buttonW + gap);
    const btn = scene.addDialogueButtonAt(
      container,
      x,
      rowY,
      CARRIED_LEVEL_LABELS[lvl],
      () => {
        if (lvl === carried) return;
        carryMoveLevel(scene, moveId, lvl);
      },
      buttonW,
      buttonPx
    );
    if (lvl === carried) btn.setAlpha(0.5);
    bottom = Math.max(bottom, rowY + btn.height);
  });
  return bottom + 6;
}

// Sets which unlocked tier `moveId` is carried at (registry/save
// `carriedMoveLevels`). Free and instantly reversible -- the tier itself was
// already paid for when it was landed, and this only decides which of the
// paid-for ones is in effect.
function carryMoveLevel(scene: GuardianPanelHost, moveId: string, level: MoveLevel) {
  const carried = (scene.game.registry.get('carriedMoveLevels') as Partial<Record<string, MoveLevel>>) ?? {};
  scene.game.registry.set('carriedMoveLevels', { ...carried, [moveId]: level });
  persistFromRegistry(scene.game.registry);
  destroyPanel(scene);
  showFeynmanPanel(scene);
}

// Pays up front, then hands off to the streak -- the qumatessence is gone
// the moment this runs, regardless of how the questions go (§5).
function startLevelUp(scene: GuardianPanelHost, move: Move, nextLevel: 1 | 2 | 3, cost: number) {
  if (((scene.game.registry.get('qumatessence') as number) || 0) < cost) return;
  scene.qumatessence -= cost;
  scene.game.registry.set('qumatessence', scene.qumatessence);
  scene.tokenText.setText(`Qumatessence: ${scene.qumatessence}`);
  persistFromRegistry(scene.game.registry);
  destroyPanel(scene);
  showLevelStreak(scene, move.id, nextLevel);
}

// The pay-then-answer-a-streak gamble itself (§5) -- the qumatessence is
// already spent by the time this opens (renderMoveLevelList's own click
// handler), so every path out of here just decides whether the move's
// level actually changes, never whether the payment is refunded. Draws
// `MOVE_LEVEL_STREAKS[targetLevel]` questions from the same
// visited-world-filtered pool Landau's Analytic moves use
// (getAnalyticQuestions), asked one at a time -- stops at the first wrong
// answer, the same no-partial-credit shape
// BattleScene.showUltimateQuestions uses for Skłodowska-Curie's Ultimate
// gate, generalized to a variable streak length instead of a fixed 3.
// Every path through this panel ends by rebuilding showFeynmanPanel, same
// "destroy container, re-show the guardian panel" convention every other
// in-panel action already uses.
function showLevelStreak(scene: GuardianPanelHost, moveId: string, targetLevel: 1 | 2 | 3) {
  // The streak panel demonstrates nothing, so nothing in it will ever
  // retarget the battle-effect loop the move list left running against its
  // detail pane -- stop it explicitly, the same way Noether's panes that
  // start no preview of their own do, rather than leaving the move's impact
  // flashing over the questions (it draws above a dialogue container by
  // design, art/moveEffectPreview.ts).
  stopMoveEffectPreview();
  const questions = getAnalyticQuestions(scene.getVisitedWorlds(), MOVE_LEVEL_STREAKS[targetLevel]);
  let index = 0;

  const finishStreak = (success: boolean) => {
    if (success) {
      const levels = (scene.game.registry.get('moveLevels') as Partial<Record<string, MoveLevel>>) ?? {};
      scene.game.registry.set('moveLevels', { ...levels, [moveId]: targetLevel });
      // Landing a tier also carries it: the correction the player just paid
      // for and answered for is the one they walk away swinging, and the
      // picker is there to step back down afterward if they want to.
      const carried = (scene.game.registry.get('carriedMoveLevels') as Partial<Record<string, MoveLevel>>) ?? {};
      scene.game.registry.set('carriedMoveLevels', { ...carried, [moveId]: targetLevel });
      persistFromRegistry(scene.game.registry);
    }
    destroyPanel(scene);
    showFeynmanPanel(scene);
  };

  const askNext = () => {
    if (index >= questions.length) {
      finishStreak(true);
      return;
    }
    // Each question replaces the one before it: the streak walks through
    // several panels in a row, and the previous one has to come down before
    // the next goes up or its own answer buttons stay live underneath.
    destroyPanel(scene);
    const question = questions[index];
    scene.dialogueActive = true;
    const container = scene.add.container(0, 0).setDepth(100);
    scene.dialogueContainer = container;

    const panelWidth = 600;
    const top = 20;
    let y = top;

    const title = scene.add
      .text(
        CANVAS_W / 2,
        y,
        `${moveDisplayName(scene.game.registry, moveId)} -> "${MOVE_LEVEL_NAMES[targetLevel]}" (question ${index + 1}/${questions.length})`,
        { fontSize: fontPx(scene, 13), color: '#ffa64a', fontStyle: 'bold', align: 'center', wordWrap: { width: panelWidth - 60 } }
      )
      .setOrigin(0.5, 0);
    container.add(title);
    y += title.height + 10;

    const prompt = makeQuestionText(scene, CANVAS_W / 2, y, question.prompt, {
      fontSizePx: 12 * fontScale(scene),
      color: '#ffffff',
      wrapWidth: panelWidth - 60,
    });
    container.add(prompt);
    y += prompt.height + 14;

    const options = Phaser.Utils.Array.Shuffle([
      { text: question.correct, correct: true },
      { text: question.incorrect, correct: false },
    ]);

    options.forEach((opt) => {
      const btn = scene.addQuestionButton(container, y, opt.text, () => {
        if (!opt.correct) {
          finishStreak(false);
          return;
        }
        index += 1;
        askNext();
      });
      y += btn.height + 8;
    });
    y += top;

    const panelHeight = y - top;
    const panel = scene.add
      .rectangle(CANVAS_W / 2, top + panelHeight / 2, panelWidth, panelHeight, PANEL_BG, 0.94)
      .setStrokeStyle(2, 0xffa64a);
    container.addAt(panel, 0);
  };

  askNext();
}
