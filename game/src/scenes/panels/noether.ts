import type Phaser from 'phaser';
import type { GuardianPanelHost } from '../OverworldScene';
import { makeNoetherAvatar } from '../../art/noether';
import { playGuardianChime } from '../../audio/sfx';
import { CANVAS_W } from '../../art/perspective';
import { fontPx } from '../../ui/text';
import { PANEL_BG, GOLD_ACCENT, GOLD_ACCENT_HEX, REFERENCE_BLUE_GREY_HEX } from '../../ui/theme';
import { MOVES, SHOP_MOVE_IDS, compatibleMoves, shopCost, getPlayerStats, statUpgradeCost, MAX_STAT } from '../../data/materials';
import { persistFromRegistry } from '../../data/save';
import type { Stats } from '../../data/types';
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

// Noether appears once the player reaches world 1's middle tile, selling
// the other early moves and stat upgrades for qumatessence, in two tabs of
// the same panel. Same in-map dialogue pattern as a wild encounter, but
// with a guardian avatar and a shop list instead of a fight.
// Content laid out top-down first (running `y`, each element's own
// height advancing it), panel sized/inserted behind everything
// afterward -- same pattern as showSettingsPanel. The intro quote used
// to sit at a fixed offset from the avatar that assumed a short 1-line
// render; at a bigger text-size setting it wraps to 3-4 lines and would
// otherwise run straight into the tabs/rows below it.
//
// The Moves tab is a list+detail layout (scenes/panels/listDetail.ts,
// STYLE.md's "List+detail panels") -- the left column just names
// still-unbought, current-form-compatible moves; clicking one only
// *previews* it (scene.noetherMovePreview), the right column showing that
// move's own real battle-effect animation on a loop (renderMoveDetailHeader,
// the move's own static class, no shape override -- unlike Laughlin's/
// Curie's tunable moves, an ordinary move's battle look never changes) plus
// its cost and a "Learn <name>" confirm button, the one action that
// actually checks/spends the cost. The Stats tab (renderShopStats below) has
// no move/animation concept and stays the plain button list it always was,
// at its own narrower panel width -- only the Moves tab needs the wider
// LIST_DETAIL_PANEL_W for its two columns.
export function showNoetherShop(scene: GuardianPanelHost) {
  scene.dialogueActive = true;

  const panelWidth = scene.shopTab === 'moves' ? LIST_DETAIL_PANEL_W : 600;
  const top = 20;
  const container = scene.add.container(0, 0).setDepth(100);
  scene.dialogueContainer = container;

  let y = top;

  const avatarY = y + 42;
  const avatar = makeNoetherAvatar(scene);
  avatar.setPosition(CANVAS_W / 2, avatarY);
  container.add(avatar);
  scene.tweens.add({ targets: avatar, y: avatarY + 8, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  playGuardianChime();
  y = avatarY + 48;

  const intro = scene.add
    .text(
      CANVAS_W / 2,
      y,
      '"I am Noether. Every symmetry hides a conservation law -- spend your qumatessence on a new attack, or a sharper stat."',
      { fontSize: fontPx(scene, 11), fontStyle: 'italic', color: '#cfd8ff', align: 'center', wordWrap: { width: panelWidth - 80 } }
    )
    .setOrigin(0.5, 0);
  container.add(intro);
  y += intro.height + 10;

  y = renderShopTabs(scene, container, y);
  y += 6;

  // The Moves tab is a list+detail layout and carries its own Farewell button
  // inside the left column (renderListColumnFooter); the Stats tab is a plain
  // single-column list with no left column to put one in, so it keeps the
  // full-width footer row below its content.
  if (scene.shopTab === 'moves') {
    y = renderShopMoves(scene, container, y, panelWidth) + 8;
  } else {
    y = renderShopStats(scene, container, y) + 8;
    y = scene.renderFarewellFooter(container, y) + 8;
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
      label: `Learn ${move.name} (${cost} qumatessence)`,
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

function renderShopStats(scene: GuardianPanelHost, container: Phaser.GameObjects.Container, y: number): number {
  // The Stats tab has no move/animation concept at all -- stop whatever
  // preview loop the Moves tab left running, same reasoning as the
  // empty-forSale branch above (renderShopMoves).
  stopMoveEffectPreview();
  const stats = getPlayerStats(scene.game.registry);
  const tokens = (scene.game.registry.get('qumatessence') as number) || 0;
  const rows: { key: keyof Stats; label: string }[] = [
    { key: 'quantumness', label: 'Quantumness (crit chance)' },
    { key: 'velocity', label: 'Velocity (turn order)' },
    { key: 'correlation', label: 'Correlation (defense)' },
  ];

  rows.forEach((row) => {
    const value = stats[row.key];
    const maxed = value >= MAX_STAT;
    const cost = statUpgradeCost(value, row.key);
    const affordable = !maxed && tokens >= cost;
    const label = maxed ? `${row.label}: ${value} -- maxed` : `${row.label}: ${value} -> ${value + 1} -- ${cost} qumatessence`;
    const btn = scene.addDialogueButton(container, y, label, () => {
      if (maxed) return;
      const current = (scene.game.registry.get('qumatessence') as number) || 0;
      if (current < cost) return;
      const updated = { ...getPlayerStats(scene.game.registry), [row.key]: value + 1 };
      scene.qumatessence = current - cost;
      scene.game.registry.set('qumatessence', scene.qumatessence);
      scene.game.registry.set('playerStats', updated);
      scene.tokenText.setText(`Qumatessence: ${scene.qumatessence}`);
      persistFromRegistry(scene.game.registry);
      destroyPanel(scene);
      showNoetherShop(scene);
    });
    if (!affordable) btn.setAlpha(0.5);
    y += btn.height + 3;
  });
  return y;
}
