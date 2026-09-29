import type Phaser from 'phaser';
import type { GuardianPanelHost } from '../OverworldScene';
import { renderGuardianHeader } from './guardianHeader';
import { guardianQuoteFor } from '../../data/guardianQuotes';
import { storyLength } from '../../data/settings';
import { makeSklodowskaCurieAvatar } from '../../art/sklodowskaCurie';
import { ULTIMATE_SHAPES } from '../../art/attackEffects';
import { CANVAS_W } from '../../art/perspective';
import { PANEL_BG } from '../../ui/theme';
import {
  ULTIMATE_MOVE_IDS,
  ULTIMATE_CLASS_UNLOCK_COST,
  quasiparticleLabel,
  moveDisplayName,
  moveShapeName,
  getTunedMoveClass,
  getMoveLevel,
} from '../../data/materials';
import { persistFromRegistry } from '../../data/save';
import type { MoveClass } from '../../data/types';
import { hostableClasses } from './tunableMoveShop';
import {
  LIST_DETAIL_PANEL_W,
  listDetailColumns,
  renderListColumn,
  renderListColumnFooter,
  renderMoveDetailHeader,
  renderStatusAndConfirm,
  renderTreeHeading,
  treeHeadingHeight,
  insertColumnDivider,
  destroyPanel,
  TREE_ENTRY_INDENT,
  TUNED_MOVE_STAGE_H,
} from './listDetail';

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
// Ordinary list+detail layout (LIST_DETAIL_PANEL_W, scenes/panels/
// listDetail.ts), the same shape Landau's own panel and every other selling
// guardian's uses: her two moves are two rows in the left column, and
// whichever is selected fills one full-width detail pane. The pane opens with
// that move's own real battle-effect animation on a loop
// (renderMoveDetailHeader), overriding the plain per-class shape via
// ULTIMATE_SHAPES to the longer, multi-phase playMeteor/playNova sequences
// -- the same override BattleScene itself applies -- coloured and captioned
// by the quasiparticle row the player has picked in the column beside it
// (previewClass: the picked row, or the move's current tuning,
// getTunedMoveClass, until one is picked, same fallback rules as Landau's
// Analytic pair) and escalated to the player's real Feynman level for that
// move (getMoveLevel). Below that, a status line reading the previewed
// class's own cost straight off registry/save
// `ultimateClassesUnlocked[moveId]` rather than a single flat cost the way
// Landau's pane does -- free for an already-unlocked class,
// `ULTIMATE_CLASS_UNLOCK_COST` qumatessence otherwise -- and the one button
// that commits: it unlocks (a class never picked for this move before) or
// retunes (one already unlocked) in a single click and, on this move's very
// first-ever class pick, also adds the move id to `unlockedMoves` so it
// appears in the battle menu (pickUltimateClass). That button can be
// genuinely unaffordable -- with no class yet unlocked for a move and too
// little qumatessence it is dimmed and a no-op -- but the pane needs no
// dedicated escape button of its own for that case: the Farewell button in
// the left column is always present regardless of affordability, so a
// too-poor player is never left with nothing clickable and `dialogueActive`
// stuck true.
export function showSklodowskaCuriePanel(scene: GuardianPanelHost) {
  scene.dialogueActive = true;
  // Deliberately does NOT call stopMoveEffectPreview() here -- same
  // reasoning as showLandauPanel's own comment (panels/landau.ts): the
  // pane's own renderMoveDetailHeader call always runs, and the chain
  // restarts on its own when the move or its class changes (a meteor cut
  // off mid-fall is gone at once, the new one summoned from the start) and
  // keeps looping otherwise.

  const panelWidth = LIST_DETAIL_PANEL_W;
  const top = 20;
  const container = scene.add.container(0, 0).setDepth(100);
  scene.dialogueContainer = container;

  let y = top;

  // Skłodowska-Curie's own quote is the longest in the game (it names all
  // ten guardians), so it is the line the header's fit to the portrait band
  // (panels/guardianHeader.ts) shrinks furthest at the larger presets; that
  // fit is what keeps the picker's rows below on the canvas, on top of the
  // full animation-stage pane and the avatar/footer every panel has.
  y = renderGuardianHeader(scene, container, {
    y,
    panelWidth,
    avatar: makeSklodowskaCurieAvatar,
    quote: guardianQuoteFor('sklodowskaCurie', storyLength(scene.game.registry)),
  });

  // Farewell rides inside the left column beneath its rows
  // (renderListColumnFooter, called from renderUltimateColumns), not in a full-width row
  // under both columns -- the left column is the shorter of the two, so a
  // footer inside it costs the panel no height at all.
  y = renderUltimateColumns(scene, container, y, panelWidth);
  y += 8;

  const panelHeight = y - top;
  const panel = scene.add
    .rectangle(CANVAS_W / 2, top + panelHeight / 2, panelWidth, panelHeight, PANEL_BG, 0.94)
    .setStrokeStyle(2, 0xc9d84a);
  container.addAt(panel, 0);
}

// The left column is two levels: each of her two Ultimate moves is a heading,
// and the open one's own hostable quasiparticles are its entries. A heading
// reads the bare shape word, "Meteor" and "Nova" (moveShapeName), rather
// than the move's full resolved name: the quasiparticle in front of it is
// exactly what the entries underneath are for, and the detail pane beside
// them still shows the full name (see moveShapeName's own comment). Picking a
// quasiparticle row only *previews* it; the pane's own button is what unlocks
// or retunes, the same preview-then-confirm flow every other list+detail panel
// uses (STYLE.md's "List+detail panels"). That matters more here than
// anywhere else in the game: an unlock costs ULTIMATE_CLASS_UNLOCK_COST, by
// far the largest single price a player ever pays.
function renderUltimateColumns(scene: GuardianPanelHost, container: Phaser.GameObjects.Container, y: number, panelWidth: number): number {
  const panelLeft = CANVAS_W / 2 - panelWidth / 2;
  const columns = listDetailColumns(panelLeft);
  const columnsTop = y;

  const ids = [...ULTIMATE_MOVE_IDS];
  const openId = ids.includes(scene.curieMovePreview ?? '') ? (scene.curieMovePreview as string) : ids[0];
  const classes = hostableClasses(scene);
  const previewClass = classes.includes(scene.curieClassPreview as MoveClass)
    ? (scene.curieClassPreview as MoveClass)
    : getTunedMoveClass(scene.game.registry, openId);

  let leftY = columnsTop;
  ids.forEach((id, i) => {
    const open = id === openId;
    leftY = renderTreeHeading(scene, container, columns, leftY + (i === 0 ? 0 : 4), moveShapeName(id), open, () => {
      scene.curieMovePreview = id;
      scene.curieClassPreview = null;
      scene.curieClassPage = 0;
      destroyPanel(scene);
      showSklodowskaCuriePanel(scene);
    });
    if (!open) return;
    const assigned = ((scene.game.registry.get('moveClassTuning') as Partial<Record<string, MoveClass>>) ?? {})[id];
    const listResult = renderListColumn({
      scene,
      container,
      x: columns.leftX + TREE_ENTRY_INDENT,
      y: leftY,
      width: columns.leftColW - TREE_ENTRY_INDENT,
      items: classes,
      idFor: (cls) => cls,
      labelFor: (cls) => `${quasiparticleLabel(cls)}${cls === assigned ? ' (current)' : ''}`,
      selectedId: previewClass,
      page: scene.curieClassPage,
      reserveBelow: i < ids.length - 1 ? treeHeadingHeight(scene) : 0,
      onPageChange: (page) => {
        scene.curieClassPage = page;
        destroyPanel(scene);
        showSklodowskaCuriePanel(scene);
      },
      onSelect: (cls) => {
        scene.curieClassPreview = cls;
        destroyPanel(scene);
        showSklodowskaCuriePanel(scene);
      },
    });
    scene.curieClassPage = listResult.page;
    leftY = listResult.bottom;
  });

  const rightBottom = renderUltimateColumn(scene, container, openId, previewClass, columns.rightColCenterX, columnsTop, columns.rightColW);
  const leftBottom = renderListColumnFooter(scene, container, columns, leftY + 10, 'Farewell', () => scene.closeDialogue());
  const columnsBottom = Math.max(leftBottom, rightBottom);
  insertColumnDivider(scene, container, columns.dividerX, columnsTop, columnsBottom);
  return columnsBottom + 6;
}

function renderUltimateColumn(
  scene: GuardianPanelHost,
  container: Phaser.GameObjects.Container,
  id: string,
  previewClass: MoveClass,
  centerX: number,
  y: number,
  colW: number
): number {
  // The stage and its caption follow the row picked in the column beside
  // them (previewClass), not the move's saved tuning, the same way Landau's
  // pane does: the meteor falls in the previewed class's colour, captioned
  // for it, before that class is unlocked or carried.
  const displayName = moveDisplayName(scene.game.registry, id, previewClass);
  const level = getMoveLevel(scene.game.registry, id);
  // The stage runs at the taller TUNED_MOVE_STAGE_H rather than the ordinary
  // detail-pane block: this panel's height is set by its left column, so the
  // room is already reserved (listDetail.ts).
  let ny = renderMoveDetailHeader(
    scene,
    container,
    displayName,
    previewClass,
    ULTIMATE_SHAPES[id],
    centerX,
    y,
    colW,
    level,
    undefined,
    TUNED_MOVE_STAGE_H
  );

  const isUnlocked = scene.getUnlockedMoves().includes(id);
  const assigned = ((scene.game.registry.get('moveClassTuning') as Partial<Record<string, MoveClass>>) ?? {})[id];
  const superposition = scene.isSuperpositionMode();
  const unlockedForMove = superposition
    ? hostableClasses(scene)
    : ((scene.game.registry.get('ultimateClassesUnlocked') as Partial<Record<string, MoveClass[]>>) ?? {})[id] ?? [];
  const classUnlocked = unlockedForMove.includes(previewClass);
  const tokens = (scene.game.registry.get('qumatessence') as number) || 0;

  const statusLabel = !isUnlocked
    ? `Not yet unlocked. ${quasiparticleLabel(previewClass)} costs ${ULTIMATE_CLASS_UNLOCK_COST} qumatessence.`
    : previewClass === assigned
    ? `Already carrying ${quasiparticleLabel(previewClass)}.`
    : classUnlocked
    ? `${quasiparticleLabel(previewClass)} is already yours. Carrying it again is free.`
    : `${quasiparticleLabel(previewClass)} costs ${ULTIMATE_CLASS_UNLOCK_COST} qumatessence to unlock.`;

  const commit =
    isUnlocked && previewClass === assigned
      ? undefined
      : {
          label: classUnlocked ? `Carry ${quasiparticleLabel(previewClass)}` : `Unlock ${quasiparticleLabel(previewClass)}`,
          onClick: () => pickUltimateClass(scene, id, previewClass),
          dimmed: !classUnlocked && tokens < ULTIMATE_CLASS_UNLOCK_COST,
        };

  return renderStatusAndConfirm({
    scene,
    container,
    centerX,
    y: ny,
    colW,
    status: statusLabel,
    statusCap: 1.15,
    confirm: commit,
  });
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
  destroyPanel(scene);
  showSklodowskaCuriePanel(scene);
}
