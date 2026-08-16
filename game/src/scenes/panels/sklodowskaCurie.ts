import type Phaser from 'phaser';
import type { GuardianPanelHost } from '../OverworldScene';
import { renderGuardianHeader } from './guardianHeader';
import { makeSklodowskaCurieAvatar } from '../../art/sklodowskaCurie';
import { ULTIMATE_SHAPES } from '../../art/attackEffects';
import { CANVAS_W } from '../../art/perspective';
import { fontScale } from '../../ui/text';
import { PANEL_BG } from '../../ui/theme';
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
// (renderMoveDetailHeader), overriding the plain
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
// picker needs no dedicated escape button of its own for that case: the
// Farewell button in the left column is always present regardless of
// affordability, so a too-poor player is never left with nothing clickable
// and `dialogueActive` stuck true.
export function showSklodowskaCuriePanel(scene: GuardianPanelHost) {
  scene.dialogueActive = true;
  // Deliberately does NOT call stopMoveEffectPreview() here -- same
  // reasoning as showLandauPanel's own comment (panels/landau.ts): both
  // columns' own renderMoveDetailHeader calls always run, retargeting their
  // own already-running preview chain in place.

  const panelWidth = LIST_DETAIL_PANEL_W;
  const top = 20;
  const container = scene.add.container(0, 0).setDepth(100);
  scene.dialogueContainer = container;

  let y = top;

  // Capped tighter than the ordinary intro-quote scaling every other
  // guardian panel uses (STYLE.md) -- Skłodowska-Curie's own quote is the
  // longest in the game (it names all ten guardians) and this panel now
  // carries a full animation-stage-plus-inline-picker pane below it, on top
  // of the avatar/footer every panel already has; an uncapped quote at the
  // largest text-size preset was enough on its own to push the picker's own
  // rows off the bottom of the canvas (same failure mode Anderson's own
  // headline cap, STYLE.md, guards against).
  const introScale = Math.min(fontScale(scene), 1.15);
  y = renderGuardianHeader(scene, container, {
    y,
    panelWidth,
    avatar: makeSklodowskaCurieAvatar,
    quote: '"I am Skłodowska-Curie, and I lead this circle of guardians: Noether, Bloch, Dresselhaus, Landau, Majorana, Anderson, Feynman, Kondo, Franklin, and I. Here is our last lesson. Answer three questions on the physics running through everything you have learned. Get all three right and your crystal strikes with a force none of the others can match. Miss even one and the blow lands nowhere at all. Tell me which quasiparticle carries it, too. A new one costs a lot to unlock, but once bought it is yours to wear again for free."',
    introPx: `${Math.round(11 * introScale)}px`,
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
// and the open one's own hostable quasiparticles are its entries. Picking a
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
    leftY = renderTreeHeading(scene, container, columns, leftY + (i === 0 ? 0 : 4), moveDisplayName(scene.game.registry, id), open, () => {
      scene.curieMovePreview = id;
      scene.curieClassPreview = null;
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
      page: 0,
      reserveBelow: i < ids.length - 1 ? treeHeadingHeight(scene) : 0,
      onPageChange: () => {},
      onSelect: (cls) => {
        scene.curieClassPreview = cls;
        destroyPanel(scene);
        showSklodowskaCuriePanel(scene);
      },
    });
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
  const displayName = moveDisplayName(scene.game.registry, id);
  const activeClass = getTunedMoveClass(scene.game.registry, id);
  const level = getMoveLevel(scene.game.registry, id);
  // The stage runs at the taller TUNED_MOVE_STAGE_H rather than the ordinary
  // detail-pane block: this panel's height is set by its left column, so the
  // room is already reserved (listDetail.ts).
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
