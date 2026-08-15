import type Phaser from 'phaser';
import type { GuardianPanelHost } from '../OverworldScene';
import { makeSklodowskaCurieAvatar } from '../../art/sklodowskaCurie';
import { playGuardianChime } from '../../audio/sfx';
import { ULTIMATE_SHAPES } from '../../art/attackEffects';
import { CANVAS_W } from '../../art/perspective';
import { fontScale } from '../../ui/text';
import { PANEL_BG, REFERENCE_BLUE_GREY_HEX } from '../../ui/theme';
import {
  ULTIMATE_MOVE_IDS,
  ULTIMATE_CLASS_UNLOCK_COST,
  quasiparticleLabel,
  moveDisplayName,
  getTunedMoveClass,
  getMoveLevel,
} from '../../data/materials';
import { persistFromRegistry } from '../../data/save';
import type { MoveClass } from '../../data/types';
import { hostableClasses, renderInlineClassPicker } from './tunableMoveShop';
import { TWO_UP_PANEL_W, TWO_UP_STAGE_H, sideBySideColumns, renderMoveDetailHeader, insertColumnDivider } from './listDetail';

// Skłodowska-Curie stands at world 10's middle tile (WORLD_GUARDIANS,
// `id: 'sklodowskaCurie'` -- deliberately not `'curie'`, so she's gated
// behind actually reaching World 10 rather than inheriting "met" status from
// an old save's World-6 Curie visit) and sells her two quiz-gated Ultimate
// moves (data/materials.ts's ULTIMATE_MOVE_IDS, a meteor move and a nova
// move). Her pricing model is deliberately NOT the standard `shopCost`
// flow Landau's shop uses -- there is no separate "buy the move" step;
// instead each quasiparticle class costs `ULTIMATE_CLASS_UNLOCK_COST`
// qumatessence to unlock per move, the first time it's picked for that move,
// after which retuning back to an already-unlocked class is free forever
// (see renderUltimateColumn/pickUltimateClass below). The move's own
// battle-side 3-question gate lives in BattleScene, not here -- this panel
// only ever sells the quasiparticle tuning.
//
// Bespoke two-column layout (TWO_UP_PANEL_W, wider than the ordinary
// LIST_DETAIL_PANEL_W list+detail panels use, scenes/panels/listDetail.ts),
// the same shape Landau's own panel uses: both of her fixed two moves are
// always visible side by side, not browsed one at a time through a left-hand
// candidate list. Each column opens with that move's own real battle-effect
// animation on a loop (renderMoveDetailHeader), overriding the plain
// per-class shape via ULTIMATE_SHAPES to the longer, multi-phase
// playMeteor/playNova sequences -- the same override BattleScene itself
// applies -- still colored by whichever quasiparticle class the move is
// currently tuned to (getTunedMoveClass, same fallback rules as Landau's
// Analytic pair) and escalated to the player's real Feynman level for that
// move (getMoveLevel). Below that, a status line and -- inline, not a
// separate full-panel sub-view -- one row per hostable quasiparticle class
// (tunableMoveShop.ts's renderInlineClassPicker), each row's own cost read
// straight off registry/save `ultimateClassesUnlocked[moveId]` rather than a
// single flat cost the way Landau's picker shows: "Free" for an
// already-unlocked class, `ULTIMATE_CLASS_UNLOCK_COST` qumatessence
// otherwise. Picking any row is the one action that unlocks (on a class
// never picked for this move before) or retunes (on one already unlocked)
// in a single click -- and, on this move's very first-ever class pick,
// also adds the move id to `unlockedMoves` so it appears in the battle menu.
// A row here can be genuinely unaffordable -- with no class yet unlocked for
// a move and too little qumatessence, that row is a no-op click -- but this
// picker needs no dedicated escape button of its own for that case:
// `renderFarewellFooter` below is always present as part of the main panel
// regardless of affordability, so a too-poor player is never left with
// nothing clickable and `dialogueActive` stuck true.
export function showSklodowskaCuriePanel(scene: GuardianPanelHost) {
  scene.dialogueActive = true;
  // Deliberately does NOT call stopMoveEffectPreview() here -- same
  // reasoning as showLandauPanel's own comment (panels/landau.ts): both
  // columns' own renderMoveDetailHeader calls always run, retargeting their
  // own already-running preview chain in place.

  const panelWidth = TWO_UP_PANEL_W;
  const top = 20;
  const container = scene.add.container(0, 0).setDepth(100);
  scene.dialogueContainer = container;

  let y = top;

  const avatarY = y + 42;
  const avatar = makeSklodowskaCurieAvatar(scene);
  avatar.setPosition(CANVAS_W / 2, avatarY);
  container.add(avatar);
  scene.tweens.add({ targets: avatar, y: avatarY + 8, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  playGuardianChime();
  y = avatarY + 48;

  // Capped tighter than the ordinary intro-quote scaling every other
  // guardian panel uses (STYLE.md) -- Skłodowska-Curie's own quote is the
  // longest in the game (it names all ten guardians) and this panel now
  // carries two full animation-stage-plus-inline-picker columns below it, on
  // top of the avatar/footer every panel already has; an uncapped quote at
  // the largest text-size preset was enough on its own to push the columns'
  // own confirm rows off the bottom of the canvas (same failure mode
  // Anderson's own headline cap, STYLE.md, guards against).
  const introScale = Math.min(fontScale(scene), 1.15);
  const intro = scene.add
    .text(
      CANVAS_W / 2,
      y,
      '"I am Skłodowska-Curie, and I lead this circle of guardians: Noether, Bloch, Dresselhaus, Landau, Majorana, Anderson, Feynman, Kondo, Franklin, and I. Here is our last lesson. Answer three questions on the physics running through everything you have learned, all three correct, and your crystal strikes with a force none of the others can match. Miss even one and the blow lands nowhere at all. Tell me which quasiparticle should carry it, too. A new one costs dearly to unlock, but once bought it is yours to wear again for free."',
      { fontSize: `${Math.round(11 * introScale)}px`, fontStyle: 'italic', color: '#cfd8ff', align: 'center', wordWrap: { width: panelWidth - 80 } }
    )
    .setOrigin(0.5, 0);
  container.add(intro);
  y += intro.height + 14;

  y = renderUltimateColumns(scene, container, y, panelWidth);
  y += 8;
  y = scene.renderFarewellFooter(container, y);
  y += 8;

  const panelHeight = y - top;
  const panel = scene.add
    .rectangle(CANVAS_W / 2, top + panelHeight / 2, panelWidth, panelHeight, PANEL_BG, 0.94)
    .setStrokeStyle(2, 0xc9d84a);
  container.addAt(panel, 0);
}

function renderUltimateColumns(scene: GuardianPanelHost, container: Phaser.GameObjects.Container, y: number, panelWidth: number): number {
  const panelLeft = CANVAS_W / 2 - panelWidth / 2;
  const columns = sideBySideColumns(panelLeft, panelWidth);
  const columnsTop = y;

  const leftBottom = renderUltimateColumn(scene, container, ULTIMATE_MOVE_IDS[0], columns.leftCenterX, columnsTop, columns.colW);
  const rightBottom = renderUltimateColumn(scene, container, ULTIMATE_MOVE_IDS[1], columns.rightCenterX, columnsTop, columns.colW);

  const columnsBottom = Math.max(leftBottom, rightBottom);
  insertColumnDivider(scene, container, columns.dividerX, columnsTop, columnsBottom);
  return columnsBottom + 6;
}

function renderUltimateColumn(
  scene: GuardianPanelHost,
  container: Phaser.GameObjects.Container,
  id: string,
  centerX: number,
  y: number,
  colW: number
): number {
  const displayName = moveDisplayName(scene.game.registry, id);
  const activeClass = getTunedMoveClass(scene.game.registry, id);
  const level = getMoveLevel(scene.game.registry, id);
  let ny = renderMoveDetailHeader(
    scene,
    container,
    displayName,
    activeClass,
    ULTIMATE_SHAPES[id],
    centerX,
    y,
    colW,
    level,
    `curie:${id}`,
    TWO_UP_STAGE_H
  );

  const unlocked = scene.getUnlockedMoves();
  const isUnlocked = unlocked.includes(id);
  const assigned = ((scene.game.registry.get('moveClassTuning') as Partial<Record<string, MoveClass>>) ?? {})[id];

  const statusScale = Math.min(fontScale(scene), 1.15);
  const statusLabel = !isUnlocked
    ? 'Not yet unlocked: pick a quasiparticle to unlock it.'
    : !assigned
    ? 'Unlocked, but untuned: pick a quasiparticle.'
    : activeClass === assigned
    ? `Carrying ${quasiparticleLabel(assigned)}.`
    : `Carrying ${quasiparticleLabel(assigned)}, reverted to ${quasiparticleLabel(activeClass)} (this form can't host it).`;
  const statusText = scene.add
    .text(centerX, ny, statusLabel, {
      fontSize: `${Math.round(11 * statusScale)}px`,
      color: REFERENCE_BLUE_GREY_HEX,
      align: 'center',
      wordWrap: { width: colW },
    })
    .setOrigin(0.5, 0);
  container.add(statusText);
  ny += statusText.height + 6;

  const superposition = scene.isSuperpositionMode();
  const hostable = hostableClasses(scene);
  const unlockedForMove = superposition
    ? hostable
    : ((scene.game.registry.get('ultimateClassesUnlocked') as Partial<Record<string, MoveClass[]>>) ?? {})[id] ?? [];
  const tokens = (scene.game.registry.get('qumatessence') as number) || 0;

  const options = hostable.map((cls) => {
    const isClassUnlocked = unlockedForMove.includes(cls);
    const costLabel = isClassUnlocked ? 'Free' : `${ULTIMATE_CLASS_UNLOCK_COST} qumatessence`;
    const isCurrent = isClassUnlocked && cls === assigned;
    return {
      cls,
      label: `${quasiparticleLabel(cls)}: ${costLabel}${isCurrent ? ' (current)' : ''}`,
      dim: !isClassUnlocked && tokens < ULTIMATE_CLASS_UNLOCK_COST,
    };
  });
  ny = renderInlineClassPicker(scene, container, centerX, ny, colW, options, (cls) => pickUltimateClass(scene, id, cls));

  return ny;
}

// Unlocks (first time) or retunes (already unlocked) `moveId` to `cls` in a
// single click -- see this file's own top comment for the exact pricing
// rules. In Superposition Mode every hostable class reads and behaves as
// already unlocked (matches OverworldScene.applySuperpositionLeveling's
// blanket-grant treatment of every other guardian's gated content): retuning
// either Ultimate move to any hostable quasiparticle is free, with no
// qumatessence deducted and no dependence on `ultimateClassesUnlocked`
// actually holding the class.
function pickUltimateClass(scene: GuardianPanelHost, moveId: string, cls: MoveClass) {
  const superposition = scene.isSuperpositionMode();
  const allUnlocked = (scene.game.registry.get('ultimateClassesUnlocked') as Partial<Record<string, MoveClass[]>>) ?? {};
  const forThisMove = allUnlocked[moveId] ?? [];
  const assigned = (scene.game.registry.get('moveClassTuning') as Partial<Record<string, MoveClass>>) ?? {};
  if (superposition || forThisMove.includes(cls)) {
    scene.game.registry.set('moveClassTuning', { ...assigned, [moveId]: cls });
  } else {
    const tokensNow = (scene.game.registry.get('qumatessence') as number) || 0;
    if (tokensNow < ULTIMATE_CLASS_UNLOCK_COST) return;
    scene.qumatessence -= ULTIMATE_CLASS_UNLOCK_COST;
    scene.game.registry.set('qumatessence', scene.qumatessence);
    scene.tokenText.setText(`Qumatessence: ${scene.qumatessence}`);
    scene.game.registry.set('ultimateClassesUnlocked', { ...allUnlocked, [moveId]: [...forThisMove, cls] });
    scene.game.registry.set('moveClassTuning', { ...assigned, [moveId]: cls });
    const unlockedMoves = scene.getUnlockedMoves();
    if (!unlockedMoves.includes(moveId)) {
      scene.game.registry.set('unlockedMoves', [...unlockedMoves, moveId]);
    }
  }
  persistFromRegistry(scene.game.registry);
  scene.dialogueContainer?.destroy(true);
  showSklodowskaCuriePanel(scene);
}
