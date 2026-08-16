import type Phaser from 'phaser';
import type { GuardianPanelHost } from '../OverworldScene';
import { makeNoetherAvatar } from '../../art/noether';
import { CANVAS_W } from '../../art/perspective';
import { fontPx, fontScale } from '../../ui/text';
import { PANEL_BG, GOLD_ACCENT, GOLD_ACCENT_HEX, REFERENCE_BLUE_GREY_HEX } from '../../ui/theme';
import { MOVES, SHOP_MOVE_IDS, compatibleMoves, shopCost, getPlayerStats, statUpgradeCost, MAX_STAT } from '../../data/materials';
import { STAT_LABELS } from '../../data/balance';
import { persistFromRegistry } from '../../data/save';
import type { Stats } from '../../data/types';
import {
  DETAIL_NAME_CAP,
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
import { renderGuardianHeader } from './guardianHeader';

// Noether appears once the player reaches world 1's middle tile, selling
// the other early moves and stat upgrades for qumatessence, in two tabs of
// the same panel. Same in-map dialogue pattern as a wild encounter, but
// with a guardian avatar and a shop list instead of a fight.
// Content laid out top-down first (running `y`, each element's own
// height advancing it), panel sized/inserted behind everything
// afterward -- same pattern as showSettingsPanel. The intro quote flows
// from that running `y` off its own measured height rather than a fixed
// offset from the avatar: at a bigger text-size setting it wraps to 3-4
// lines and would otherwise run straight into the tabs/rows below it.
//
// Both tabs are list+detail layouts (scenes/panels/listDetail.ts,
// STYLE.md's "List+detail panels") at the shared LIST_DETAIL_PANEL_W, so the
// panel keeps one width and one row shape whichever tab is showing. The
// Moves tab's left column just names still-unbought, current-form-compatible
// moves; clicking one only *previews* it (scene.noetherMovePreview), the
// right column showing that move's own real battle-effect animation on a
// loop (renderMoveDetailHeader, the move's own static class, no shape
// override -- unlike Landau's/Curie's tunable moves, an ordinary move's
// battle look never changes) plus its cost and a "Learn <name>" confirm
// button, the one action that actually checks/spends the cost. The Stats tab
// (renderShopStats below) lists the three stats the same way; a stat has no
// art of its own, so its detail pane opens with the stat's name and what it
// does instead of a crystal render or an animation stage.
export function showNoetherShop(scene: GuardianPanelHost) {
  scene.dialogueActive = true;

  const panelWidth = LIST_DETAIL_PANEL_W;
  const top = 20;
  const container = scene.add.container(0, 0).setDepth(100);
  scene.dialogueContainer = container;

  let y = top;

  y = renderGuardianHeader(scene, container, {
    y,
    panelWidth,
    avatar: makeNoetherAvatar,
    quote: '"I am Noether. Every symmetry hides a conservation law. Spend your qumatessence on a new attack, or a sharper stat."',
    introPx: fontPx(scene, 11),
  });

  y = renderShopTabs(scene, container, y);
  y += 6;

  // Either tab carries its own Farewell button inside its left column
  // (renderListColumnFooter). The one branch that falls back to the
  // full-width footer row is the Moves tab's empty state, which renders no
  // columns at all (renderShopMoves below).
  if (scene.shopTab === 'moves') {
    y = renderShopMoves(scene, container, y, panelWidth) + 8;
  } else {
    y = renderShopStats(scene, container, y, panelWidth) + 8;
  }

  const panelHeight = y - top;
  const panel = scene.add
    .rectangle(CANVAS_W / 2, top + panelHeight / 2, panelWidth, panelHeight, PANEL_BG, 0.94)
    .setStrokeStyle(2, GOLD_ACCENT);
  container.addAt(panel, 0);
}

function renderShopTabs(scene: GuardianPanelHost, container: Phaser.GameObjects.Container, y: number): number {
  let maxHeight = 0;
  (['moves', 'stats'] as const).forEach((tab, i) => {
    const active = scene.shopTab === tab;
    const btn = scene.add
      .text(CANVAS_W / 2 + (i === 0 ? -45 : 45), y, tab === 'moves' ? 'Moves' : 'Stats', {
        fontSize: fontPx(scene, 11),
        color: active ? GOLD_ACCENT_HEX : REFERENCE_BLUE_GREY_HEX,
        backgroundColor: active ? '#333355' : '#1a1a2e',
        padding: { x: 8, y: 3 },
      })
      .setOrigin(0.5, 0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        if (scene.shopTab === tab) return;
        scene.shopTab = tab;
        destroyPanel(scene);
        showNoetherShop(scene);
      });
    container.add(btn);
    maxHeight = Math.max(maxHeight, btn.height);
  });
  return y + maxHeight;
}

function renderShopMoves(scene: GuardianPanelHost, container: Phaser.GameObjects.Container, y: number, panelWidth: number): number {
  const unlocked = scene.getUnlockedMoves();
  const compatible = new Set(compatibleMoves(scene.playerMaterial));
  const forSale = SHOP_MOVE_IDS.filter((id) => !unlocked.includes(id) && compatible.has(id));

  if (forSale.length === 0) {
    // No detail pane renders in this branch, so nothing else will ever call
    // startMoveEffectPreview to replace whatever the list was last
    // previewing -- stop it explicitly here rather than leaving it running
    // against a screen that no longer shows it. (Deliberately not called
    // unconditionally at the top of showNoetherShop: a rebuild that DOES
    // reach renderMoveDetailHeader below needs the *running* chain left
    // alone so its own defer-until-settled logic can retarget it without
    // briefly overlapping two plays -- see moveEffectPreview.ts's own
    // comment.)
    stopMoveEffectPreview();
    const text = scene.add
      .text(CANVAS_W / 2, y, "Nothing your current form can carry is left to teach.", {
        fontSize: fontPx(scene, 13),
        color: '#ffffff',
        align: 'center',
        wordWrap: { width: 480 },
      })
      .setOrigin(0.5, 0);
    container.add(text);
    // No columns render in this branch, so there is no left column to put the
    // Farewell button in -- it takes the full-width footer row the Stats tab
    // uses instead. Without one the panel has nothing clickable at all and
    // `dialogueActive` stays stuck true.
    return scene.renderFarewellFooter(container, y + text.height + 8);
  }

  const panelLeft = CANVAS_W / 2 - panelWidth / 2;
  const columns = listDetailColumns(panelLeft);
  const columnsTop = y;

  const effectivePreview = forSale.includes(scene.noetherMovePreview ?? '') ? (scene.noetherMovePreview as string) : forSale[0];

  const listResult = renderListColumn({
    scene,
    container,
    x: columns.leftX,
    y: columnsTop,
    width: columns.leftColW,
    items: forSale,
    idFor: (id) => id,
    labelFor: (id) => MOVES[id].name,
    selectedId: effectivePreview,
    page: scene.noetherMovePage,
    onPageChange: (page) => {
      scene.noetherMovePage = page;
      destroyPanel(scene);
      showNoetherShop(scene);
    },
    onSelect: (id) => {
      scene.noetherMovePreview = id;
      destroyPanel(scene);
      showNoetherShop(scene);
    },
  });
  scene.noetherMovePage = listResult.page;

  const move = MOVES[effectivePreview];
  let rightY = columnsTop;
  rightY = renderMoveDetailHeader(scene, container, move.name, move.class, undefined, columns.rightColCenterX, rightY, columns.rightColW);

  const cost = shopCost(move);
  const tokens = (scene.game.registry.get('qumatessence') as number) || 0;

  rightY = renderStatusAndConfirm({
    scene,
    container,
    centerX: columns.rightColCenterX,
    y: rightY,
    colW: columns.rightColW,
    status: `Costs ${cost} qumatessence.`,
    confirm: {
      label: `Learn ${move.name}`,
      onClick: () => buyNoetherMove(scene, effectivePreview, cost),
      dimmed: tokens < cost,
    },
  });

  const leftBottom = renderListColumnFooter(scene, container, columns, listResult.bottom + 10, 'Farewell', () => scene.closeDialogue());
  const columnsBottom = Math.max(leftBottom, rightY);
  insertColumnDivider(scene, container, columns.dividerX, columnsTop, columnsBottom);
  return columnsBottom + 6;
}

function buyNoetherMove(scene: GuardianPanelHost, id: string, cost: number) {
  if ((scene.game.registry.get('qumatessence') as number) < cost) return;
  scene.qumatessence -= cost;
  scene.game.registry.set('qumatessence', scene.qumatessence);
  scene.tokenText.setText(`Qumatessence: ${scene.qumatessence}`);
  scene.game.registry.set('unlockedMoves', [...scene.getUnlockedMoves(), id]);
  persistFromRegistry(scene.game.registry);
  // Rebuild the whole panel so the purchased move disappears from
  // the list and the token total on display stays correct.
  destroyPanel(scene);
  showNoetherShop(scene);
}

// The three stats, browsed the same way the Moves tab browses moves: the
// left column names them, the right pane carries the selected stat's own
// effect, its current value, what the next point costs, and the one button
// that spends it. A stat is never filtered out of the list -- one already at
// MAX_STAT still selects and reads, its pane simply offering no confirm
// button (the same nothing-to-commit convention Feynman's fully-leveled
// moves and Dresselhaus's current form use). Superposition Mode pins every
// stat to MAX_STAT (OverworldScene.applySuperpositionUnlocks), so that is
// the state all three rows read in there.
function renderShopStats(scene: GuardianPanelHost, container: Phaser.GameObjects.Container, y: number, panelWidth: number): number {
  // This pane starts no battle-effect preview of its own, so nothing here
  // will ever retarget the loop the Moves tab left running -- stop it
  // explicitly, same reasoning as the empty-forSale branch above
  // (renderShopMoves).
  stopMoveEffectPreview();

  const stats = getPlayerStats(scene.game.registry);
  const tokens = (scene.game.registry.get('qumatessence') as number) || 0;
  const rows: { key: keyof Stats; effect: string }[] = [
    { key: 'quantumness', effect: 'Raises your crit chance.' },
    { key: 'velocity', effect: 'Higher goes first each round.' },
    { key: 'correlation', effect: 'Higher takes less damage.' },
  ];

  const columns = listDetailColumns(CANVAS_W / 2 - panelWidth / 2);
  const columnsTop = y;

  const selected = rows.find((row) => row.key === scene.noetherStatPreview) ?? rows[0];

  const listResult = renderListColumn({
    scene,
    container,
    x: columns.leftX,
    y: columnsTop,
    width: columns.leftColW,
    items: rows,
    idFor: (row) => row.key,
    labelFor: (row) => STAT_LABELS[row.key],
    selectedId: selected.key,
    page: scene.noetherStatPage,
    onPageChange: (page) => {
      scene.noetherStatPage = page;
      destroyPanel(scene);
      showNoetherShop(scene);
    },
    onSelect: (row) => {
      scene.noetherStatPreview = row.key;
      destroyPanel(scene);
      showNoetherShop(scene);
    },
  });
  scene.noetherStatPage = listResult.page;

  // A stat has no art block to open the pane with (listDetail.ts's own
  // openers each render a crystal or a move effect), so the pane opens on
  // its name directly, capped at the same DETAIL_NAME_CAP those openers use.
  let rightY = columnsTop;
  const nameScale = Math.min(fontScale(scene), DETAIL_NAME_CAP);
  const nameText = scene.add
    .text(columns.rightColCenterX, rightY, STAT_LABELS[selected.key], {
      fontSize: `${Math.round(14 * nameScale)}px`,
      color: '#ffffff',
      fontStyle: 'bold',
      align: 'center',
      wordWrap: { width: columns.rightColW },
    })
    .setOrigin(0.5, 0);
  container.add(nameText);
  rightY += nameText.height + 6;

  const effectScale = Math.min(fontScale(scene), 1.2);
  const effectText = scene.add
    .text(columns.rightColCenterX, rightY, selected.effect, {
      fontSize: `${Math.round(11 * effectScale)}px`,
      color: REFERENCE_BLUE_GREY_HEX,
      align: 'center',
      wordWrap: { width: columns.rightColW },
    })
    .setOrigin(0.5, 0);
  container.add(effectText);
  rightY += effectText.height + 6;

  const value = stats[selected.key];
  const maxed = value >= MAX_STAT;
  const cost = statUpgradeCost(value, selected.key);

  rightY = renderStatusAndConfirm({
    scene,
    container,
    centerX: columns.rightColCenterX,
    y: rightY,
    colW: columns.rightColW,
    status: maxed
      ? `Already at ${MAX_STAT}, as high as I can raise it.`
      : `Now at ${value}. Raising it to ${value + 1} costs ${cost} qumatessence.`,
    confirm: maxed
      ? undefined
      : {
          label: `Raise ${STAT_LABELS[selected.key]}`,
          onClick: () => buyStatPoint(scene, selected.key, value, cost),
          dimmed: tokens < cost,
        },
  });

  const leftBottom = renderListColumnFooter(scene, container, columns, listResult.bottom + 10, 'Farewell', () => scene.closeDialogue());
  const columnsBottom = Math.max(leftBottom, rightY);
  insertColumnDivider(scene, container, columns.dividerX, columnsTop, columnsBottom);
  return columnsBottom + 6;
}

function buyStatPoint(scene: GuardianPanelHost, key: keyof Stats, value: number, cost: number) {
  const current = (scene.game.registry.get('qumatessence') as number) || 0;
  if (current < cost) return;
  const updated = { ...getPlayerStats(scene.game.registry), [key]: value + 1 };
  scene.qumatessence = current - cost;
  scene.game.registry.set('qumatessence', scene.qumatessence);
  scene.game.registry.set('playerStats', updated);
  scene.tokenText.setText(`Qumatessence: ${scene.qumatessence}`);
  persistFromRegistry(scene.game.registry);
  // Rebuild the whole panel so the new value and the next point's own price
  // are what the pane shows, and the token total on display stays correct.
  destroyPanel(scene);
  showNoetherShop(scene);
}
