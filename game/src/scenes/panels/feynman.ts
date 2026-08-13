import Phaser from 'phaser';
import type { GuardianPanelHost } from '../OverworldScene';
import { makeFeynmanAvatar } from '../../art/feynman';
import { playGuardianChime } from '../../audio/sfx';
import { CANVAS_W } from '../../art/perspective';
import { fontPx } from '../../ui/text';
import { PANEL_BG } from '../../ui/theme';
import {
  MOVES,
  getMoveLevel,
  moveDisplayName,
  feynmanLevelCost,
  MOVE_LEVEL_NAMES,
  MOVE_LEVEL_STREAKS,
} from '../../data/materials';
import type { MoveLevel } from '../../data/materials';
import { getAnalyticQuestions } from '../../data/quiz';
import { persistFromRegistry } from '../../data/save';
import type { Move } from '../../data/types';

// Feynman stands at world 7's middle tile (WORLD_GUARDIANS) and offers to
// level up any move the player already carries (`unlockedMoves`, regardless
// of which guardian originally sold it) -- three tiers per move (§5,
// data/materials.ts's MOVE_LEVEL_NAMES/MULTIPLIERS/STREAKS), one at a time
// in sequence. Unlike every other guardian's panel, there's no separate
// purchase step: picking a row here both pays `feynmanLevelCost` up front
// (lost regardless of outcome) and immediately opens the streak of quiz
// questions that decides whether the level actually lands -- see
// showLevelStreak below. Shaped closer to Franklin's/Kondo's own
// already-bought-move lists than to a flat buy-list shop, since every row
// here is already something the player owns.
export function showFeynmanPanel(scene: GuardianPanelHost) {
  scene.dialogueActive = true;

  const panelWidth = 600;
  const top = 20;
  const container = scene.add.container(0, 0).setDepth(100);
  scene.dialogueContainer = container;

  let y = top;

  const avatarY = y + 42;
  const avatar = makeFeynmanAvatar(scene);
  avatar.setPosition(CANVAS_W / 2, avatarY);
  container.add(avatar);
  scene.tweens.add({ targets: avatar, y: avatarY + 8, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  playGuardianChime();
  y = avatarY + 48;

  const intro = scene.add
    .text(
      CANVAS_W / 2,
      y,
      '"A tensor network and a Feynman diagram draw the same trick two ways -- a vertex for every point, a line for every leg. Show me you understand a move you already carry, and I will draw a higher-order correction into it. Paid for whether it lands or not."',
      { fontSize: fontPx(scene, 11), fontStyle: 'italic', color: '#cfd8ff', align: 'center', wordWrap: { width: panelWidth - 80 } }
    )
    .setOrigin(0.5, 0);
  container.add(intro);
  y += intro.height + 14;

  y = renderMoveLevelList(scene, container, y);
  y += 8;
  y = scene.renderFarewellFooter(container, y);
  y += 8;

  const panelHeight = y - top;
  const panel = scene.add
    .rectangle(CANVAS_W / 2, top + panelHeight / 2, panelWidth, panelHeight, PANEL_BG, 0.94)
    .setStrokeStyle(2, 0xffa64a);
  container.addAt(panel, 0);
}

// One row per move the player has ever unlocked (getUnlockedMoves --
// deliberately not getBattleMoves: a move currently unusable in the
// player's present form is still a real move worth leveling for the next
// time it becomes usable again). Paginated like every other candidate list
// that can outgrow one panel (renderPagedButtons, scene.feynmanPage) --
// SHOP_MOVE_IDS alone already outgrows a handful of rows once Noether's/
// Laughlin's/Kondo's/Anderson's moves start piling up over a playthrough.
// A maxed-out (level 3) move's row dims and is a no-op, same as every other
// panel's unaffordable/unusable row convention.
function renderMoveLevelList(scene: GuardianPanelHost, container: Phaser.GameObjects.Container, y: number): number {
  const moves = scene.getUnlockedMoves().map((id) => MOVES[id]);
  const tokens = (scene.game.registry.get('qumatessence') as number) || 0;

  const labelFor = (move: Move) => {
    const level = getMoveLevel(scene.game.registry, move.id) as MoveLevel;
    const name = moveDisplayName(scene.game.registry, move.id);
    if (level >= 3) return `${name} -- max level`;
    const nextLevel = (level + 1) as 1 | 2 | 3;
    const cost = feynmanLevelCost(move, nextLevel);
    const streak = MOVE_LEVEL_STREAKS[nextLevel];
    return `${name} -- level to "${MOVE_LEVEL_NAMES[nextLevel]}" (streak ${streak}): ${cost} qumatessence`;
  };

  const isMaxedOrUnaffordable = (move: Move) => {
    const level = getMoveLevel(scene.game.registry, move.id) as MoveLevel;
    if (level >= 3) return true;
    const cost = feynmanLevelCost(move, (level + 1) as 1 | 2 | 3);
    return tokens < cost;
  };

  return scene.renderPagedButtons(
    container,
    y,
    moves,
    scene.feynmanPage,
    4,
    labelFor,
    (move) => {
      const level = getMoveLevel(scene.game.registry, move.id) as MoveLevel;
      if (level >= 3) return;
      const nextLevel = (level + 1) as 1 | 2 | 3;
      const cost = feynmanLevelCost(move, nextLevel);
      if (((scene.game.registry.get('qumatessence') as number) || 0) < cost) return;
      scene.qumatessence -= cost;
      scene.game.registry.set('qumatessence', scene.qumatessence);
      scene.tokenText.setText(`Qumatessence: ${scene.qumatessence}`);
      persistFromRegistry(scene.game.registry);
      scene.dialogueContainer?.destroy(true);
      showLevelStreak(scene, move.id, nextLevel);
    },
    (page) => {
      scene.feynmanPage = page;
      scene.dialogueContainer?.destroy(true);
      showFeynmanPanel(scene);
    },
    isMaxedOrUnaffordable
  );
}

// The pay-then-answer-a-streak gamble itself (§5) -- the qumatessence is
// already spent by the time this opens (renderMoveLevelList's own click
// handler), so every path out of here just decides whether the move's
// level actually changes, never whether the payment is refunded. Draws
// `MOVE_LEVEL_STREAKS[targetLevel]` questions from the same
// visited-world-filtered pool Laughlin's Analytic moves use
// (getAnalyticQuestions), asked one at a time -- stops at the first wrong
// answer, the same no-partial-credit shape
// BattleScene.showUltimateQuestions uses for Skłodowska-Curie's Ultimate
// gate, generalized to a variable streak length instead of a fixed 3.
// Every path through this panel ends by rebuilding showFeynmanPanel, same
// "destroy container, re-show the guardian panel" convention every other
// in-panel action already uses.
function showLevelStreak(scene: GuardianPanelHost, moveId: string, targetLevel: 1 | 2 | 3) {
  const questions = getAnalyticQuestions(scene.getVisitedWorlds(), MOVE_LEVEL_STREAKS[targetLevel]);
  let index = 0;

  const finishStreak = (success: boolean) => {
    if (success) {
      const levels = (scene.game.registry.get('moveLevels') as Partial<Record<string, MoveLevel>>) ?? {};
      scene.game.registry.set('moveLevels', { ...levels, [moveId]: targetLevel });
      persistFromRegistry(scene.game.registry);
    }
    scene.dialogueContainer?.destroy(true);
    showFeynmanPanel(scene);
  };

  const askNext = () => {
    if (index >= questions.length) {
      finishStreak(true);
      return;
    }
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
        `${moveDisplayName(scene.game.registry, moveId)} -> "${MOVE_LEVEL_NAMES[targetLevel]}" -- question ${index + 1}/${questions.length}`,
        { fontSize: fontPx(scene, 13), color: '#ffa64a', fontStyle: 'bold', align: 'center', wordWrap: { width: panelWidth - 60 } }
      )
      .setOrigin(0.5, 0);
    container.add(title);
    y += title.height + 10;

    const prompt = scene.add
      .text(CANVAS_W / 2, y, question.prompt, {
        fontSize: fontPx(scene, 12),
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

    options.forEach((opt) => {
      const btn = scene.addDialogueButton(container, y, opt.text, () => {
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
