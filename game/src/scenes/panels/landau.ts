import type Phaser from 'phaser';
import type { GuardianPanelHost } from '../OverworldScene';
import { renderGuardianHeader } from './guardianHeader';
import { makeLandauAvatar } from '../../art/landau';
import { ANALYTIC_SHAPES } from '../../art/attackEffects';
import { CANVAS_W } from '../../art/perspective';
import { fontScale } from '../../ui/text';
import { PANEL_BG, REFERENCE_BLUE_GREY_HEX } from '../../ui/theme';
import { ANALYTIC_MOVE_IDS, shopCost, moveDisplayName, getTunedMoveClass, getMoveLevel, quasiparticleLabel, MOVES } from '../../data/materials';
import type { MoveClass } from '../../data/types';
import { hostableClasses, renderInlineClassPicker } from './tunableMoveShop';
import {
  LIST_DETAIL_PANEL_W,
  listDetailColumns,
  renderListColumn,
  renderListColumnFooter,
  renderMoveDetailHeader,
  insertColumnDivider,
  destroyPanel,
} from './listDetail';
import { persistFromRegistry } from '../../data/save';

// Landau stands at world 4's middle tile (WORLD_GUARDIANS) and sells his
// two quiz-gated Analytic moves (data/materials.ts's ANALYTIC_MOVE_IDS, a
// lance move and an eruption move, each displayed as "<quasiparticle> Lance"/
// "<quasiparticle> Eruption" via moveDisplayName, which also folds in
// Feynman's own Double/Triple/Infinite level prefix) -- kept out of
// Noether's own shop (SHOP_MOVE_IDS excludes them, see materials.ts's
// comment) so Landau is their one source.
//
// Ordinary list+detail layout (LIST_DETAIL_PANEL_W, scenes/panels/
// listDetail.ts), the same shape every other guardian who sells something is
// read through: his two moves are two rows in the left column, and whichever
// is selected fills one full-width detail pane. Two rows and one pane cost
// far less height than two half-width panes side by side did, which is the
// whole reason this panel is shaped like its neighbours -- with a
// full-height animation stage plus an inline picker under it, half a panel
// was never enough width for either. The pane (renderAnalyticColumn) opens
// with that move's own real battle-effect animation on a loop
// (renderMoveDetailHeader), overriding the plain per-class bolt/ring/burst
// shape via ANALYTIC_SHAPES (each Analytic move is 'beam' or 'eruption') the
// same way BattleScene itself does, still colored by whichever quasiparticle
// class the move is currently tuned to (getTunedMoveClass -- a not-yet-tuned
// move falls back to its own default 'phonon', same fallback the real fight
// uses) and escalated to the player's real Feynman level for that move
// (getMoveLevel) so a leveled move's preview shows the same multi-trigger
// cascade a real cast plays. Below that, a cost/status line and -- inline,
// not a separate full-panel sub-view -- one row per hostable quasiparticle
// class (tunableMoveShop.ts's renderInlineClassPicker): for a still-unbought
// move, clicking any row buys and tunes to that class in one step
// (buyLandauMove); for an already-bought move, clicking a row retunes for
// free among any hostable class (retuneLandauMove), the currently-tuned
// row marked "(current)". Picking a different class re-renders the whole
// panel (this file's own established full-rebuild-per-click convention,
// same as every other guardian panel), but only *this* column's own preview
// chain (art/moveEffectPreview.ts, keyed per move id) is retargeted by
// it -- the other column's chain keeps looping through the rebuild
// undisturbed, since it's still passed the same params it already had.
export function showLandauPanel(scene: GuardianPanelHost) {
  scene.dialogueActive = true;
  // Deliberately does NOT call stopMoveEffectPreview() here -- both
  // columns' own renderMoveDetailHeader calls below always run, retargeting
  // their own already-running preview chain in place (art/
  // moveEffectPreview.ts's own defer-until-settled retarget logic) rather
  // than needing this panel to stop and restart either one itself.

  const panelWidth = LIST_DETAIL_PANEL_W;
  const top = 20;
  const container = scene.add.container(0, 0).setDepth(100);
  scene.dialogueContainer = container;

  let y = top;

  // Capped tighter than the ordinary intro-quote scaling every other
  // guardian panel uses (STYLE.md), same reasoning/cap as Skłodowska-Curie's
  // own intro (panels/sklodowskaCurie.ts) -- a full-height animation stage
  // plus an inline quasiparticle picker under it is the tallest detail pane
  // any guardian has, and an uncapped quote at the largest text-size preset
  // risks pushing the picker's own rows past the bottom of the canvas.
  const introScale = Math.min(fontScale(scene), 1.15);
  y = renderGuardianHeader(scene, container, {
    y,
    panelWidth,
    avatar: makeLandauAvatar,
    quote: '"Put a strong enough field on a two-dimensional electron gas and its whole band breaks into a ladder of flat levels, one fixed quantum of energy apart. Tell me the physics right and I will teach your crystal to strike by that ladder. Answer right and the hit climbs a rung and lands twice as hard. Answer wrong and it barely lands at all. Tell me which quasiparticle should carry it, too."',
    introPx: `${Math.round(11 * introScale)}px`,
  });

  // Farewell rides inside the left column beneath its rows
  // (renderListColumnFooter, called from renderAnalyticColumns), not in a full-width row
  // under both columns -- the left column is the shorter of the two, so a
  // footer inside it costs the panel no height at all.
  y = renderAnalyticColumns(scene, container, y, panelWidth);
  y += 8;

  const panelHeight = y - top;
  const panel = scene.add
    .rectangle(CANVAS_W / 2, top + panelHeight / 2, panelWidth, panelHeight, PANEL_BG, 0.94)
    .setStrokeStyle(2, 0x6a7fff);
  container.addAt(panel, 0);
}

function renderAnalyticColumns(scene: GuardianPanelHost, container: Phaser.GameObjects.Container, y: number, panelWidth: number): number {
  const panelLeft = CANVAS_W / 2 - panelWidth / 2;
  const columns = listDetailColumns(panelLeft);
  const columnsTop = y;

  const ids = [...ANALYTIC_MOVE_IDS];
  const selected = ids.includes(scene.landauMovePreview ?? '') ? (scene.landauMovePreview as string) : ids[0];

  const listResult = renderListColumn({
    scene,
    container,
    x: columns.leftX,
    y: columnsTop,
    width: columns.leftColW,
    items: ids,
    idFor: (id) => id,
    labelFor: (id) => moveDisplayName(scene.game.registry, id),
    selectedId: selected,
    page: 0,
    onPageChange: () => {},
    onSelect: (id) => {
      scene.landauMovePreview = id;
      destroyPanel(scene);
      showLandauPanel(scene);
    },
  });

  const rightBottom = renderAnalyticColumn(scene, container, selected, columns.rightColCenterX, columnsTop, columns.rightColW);
  const leftBottom = renderListColumnFooter(scene, container, columns, listResult.bottom + 10, 'Farewell', () => scene.closeDialogue());
  const columnsBottom = Math.max(leftBottom, rightBottom);
  insertColumnDivider(scene, container, columns.dividerX, columnsTop, columnsBottom);
  return columnsBottom + 6;
}

function renderAnalyticColumn(
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
    ANALYTIC_SHAPES[id],
    centerX,
    y,
    colW,
    level
  );

  const unlocked = scene.getUnlockedMoves();
  const isLearned = unlocked.includes(id);
  const cost = shopCost(MOVES[id]);
  const tokens = (scene.game.registry.get('qumatessence') as number) || 0;
  const affordable = isLearned || tokens >= cost;
  const assigned = ((scene.game.registry.get('moveClassTuning') as Partial<Record<string, MoveClass>>) ?? {})[id];

  const statusScale = Math.min(fontScale(scene), 1.15);
  const statusLabel = !isLearned
    ? `Costs ${cost} qumatessence to learn.`
    : !assigned
    ? 'Untuned: pick a quasiparticle.'
    : activeClass === assigned
    ? `Tuned to ${quasiparticleLabel(assigned)}.`
    : `Tuned to ${quasiparticleLabel(assigned)}, reverted to ${quasiparticleLabel(activeClass)} (this form can't host it).`;
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

  const options = hostableClasses(scene).map((cls) => ({
    cls,
    label: `${quasiparticleLabel(cls)}${isLearned && cls === assigned ? ' (current)' : ''}`,
    dim: !isLearned && !affordable,
  }));
  ny = renderInlineClassPicker(scene, container, centerX, ny, colW, options, (cls) =>
    isLearned ? retuneLandauMove(scene, id, cls) : buyLandauMove(scene, id, cost, cls)
  );

  return ny;
}

function buyLandauMove(scene: GuardianPanelHost, id: string, cost: number, chosenClass: MoveClass) {
  if ((scene.game.registry.get('qumatessence') as number) < cost) return;
  const assigned = (scene.game.registry.get('moveClassTuning') as Partial<Record<string, MoveClass>>) ?? {};
  scene.qumatessence -= cost;
  scene.game.registry.set('qumatessence', scene.qumatessence);
  scene.tokenText.setText(`Qumatessence: ${scene.qumatessence}`);
  scene.game.registry.set('unlockedMoves', [...scene.getUnlockedMoves(), id]);
  scene.game.registry.set('moveClassTuning', { ...assigned, [id]: chosenClass });
  persistFromRegistry(scene.game.registry);
  destroyPanel(scene);
  showLandauPanel(scene);
}

function retuneLandauMove(scene: GuardianPanelHost, id: string, chosenClass: MoveClass) {
  const assigned = (scene.game.registry.get('moveClassTuning') as Partial<Record<string, MoveClass>>) ?? {};
  scene.game.registry.set('moveClassTuning', { ...assigned, [id]: chosenClass });
  persistFromRegistry(scene.game.registry);
  destroyPanel(scene);
  showLandauPanel(scene);
}
