import type Phaser from 'phaser';
import type { GuardianPanelHost } from '../OverworldScene';
import { makeNoetherAvatar } from '../../art/noether';
import { CANVAS_W } from '../../art/perspective';
import { fontPx, fontScale } from '../../ui/text';
import { PANEL_BG, GOLD_ACCENT, GOLD_ACCENT_HEX, REFERENCE_BLUE_GREY_HEX } from '../../ui/theme';
import {
  MOVES,
  ORDINARY_MOVE_IDS,
  compatibleMoves,
  shopCost,
  getPlayerStats,
  statUpgradeCost,
  MAX_STAT,
} from '../../data/materials';
import { STAT_LABELS } from '../../data/balance';
import { STAT_LORE } from '../../data/statLore';
import { persistFromRegistry } from '../../data/save';
import type { Stats } from '../../data/types';
import type { ListDetailColumns } from './listDetail';
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
  renderTreeHeading,
  treeHeadingHeight,
  TREE_ENTRY_INDENT,
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
// Moves tab's left column names every ordinary attack the player's current
// form can host, the ones still for sale ahead of the ones already carried
// (browsableMoves below); clicking one only *previews* it
// (scene.noetherMovePreview), the right column showing that move's own real
// battle-effect animation on a loop at its uncorrected level 0
// (renderMoveDetailHeader, the move's own static class, no shape override)
// plus either its cost and a "Learn <name>" confirm
// button, the one action that actually checks/spends the cost, or the line
// saying the player already carries it. The Stats tab
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

  y = renderShopBody(scene, container, y, panelWidth) + 8;

  const panelHeight = y - top;
  const panel = scene.add
    .rectangle(CANVAS_W / 2, top + panelHeight / 2, panelWidth, panelHeight, PANEL_BG, 0.94)
    .setStrokeStyle(2, GOLD_ACCENT);
  container.addAt(panel, 0);
}

// Everything Noether sells, in one two-level left column: the two things she
// deals in stand as headings, and pressing one opens that heading's own
// entries directly beneath it while the other stays closed. `shopTab` is which
// one is open. Two headings and one list of entries beat a row of tabs above a
// list here because the tabs and the list were saying the same kind of thing at
// two different places on the panel; a heading with its own entries under it
// says it once, and reading down the column is the whole navigation.
//
// The headings are chrome rather than list items: they are drawn here, and only
// the open heading's entries go through renderListColumn's own pagination. A
// heading paginated as an item would land on page 2 at the largest text-size
// preset, where a page holds three or four rows, and the way to the other
// category would be a page flip away with nothing on screen saying so.
function renderShopBody(scene: GuardianPanelHost, container: Phaser.GameObjects.Container, y: number, panelWidth: number): number {
  const panelLeft = CANVAS_W / 2 - panelWidth / 2;
  const columns = listDetailColumns(panelLeft);
  const columnsTop = y;
  const movesOpen = scene.shopTab === 'moves';

  let leftY = columnsTop;
  leftY = renderTreeHeading(scene, container, columns, leftY, 'Moves', movesOpen, () => {
    scene.shopTab = 'moves';
    destroyPanel(scene);
    showNoetherShop(scene);
  });
  // The closed heading below still has to fit, so an open Moves list is told
  // how much room to leave for it.
  const trailingHeadingRoom = movesOpen ? treeHeadingHeight(scene) : 0;
  if (movesOpen) leftY = renderShopMoves(scene, container, columns, leftY, trailingHeadingRoom);
  leftY = renderTreeHeading(scene, container, columns, leftY + 4, 'Stats', !movesOpen, () => {
    scene.shopTab = 'stats';
    destroyPanel(scene);
    showNoetherShop(scene);
  });
  if (!movesOpen) leftY = renderShopStats(scene, container, columns, leftY);

  const rightBottom = movesOpen
    ? renderMoveDetail(scene, container, columns, columnsTop)
    : renderStatDetail(scene, container, columns, columnsTop);

  const leftBottom = renderListColumnFooter(scene, container, columns, leftY + 10, 'Farewell', () => scene.closeDialogue());
  const columnsBottom = Math.max(leftBottom, rightBottom);
  insertColumnDivider(scene, container, columns.dividerX, columnsTop, columnsBottom);
  return columnsBottom + 6;
}

function renderShopMoves(
  scene: GuardianPanelHost,
  container: Phaser.GameObjects.Container,
  columns: ListDetailColumns,
  y: number,
  reserveBelow: number
): number {
  const browsable = browsableMoves(scene);
  if (browsable.length === 0) {
    const empty = scene.add
      .text(columns.leftX + TREE_ENTRY_INDENT, y, 'No move for this form.', { fontSize: fontPx(scene, 11), color: REFERENCE_BLUE_GREY_HEX })
      .setOrigin(0, 0);
    container.add(empty);
    return y + empty.height + 4;
  }

  const listResult = renderListColumn({
    scene,
    container,
    x: columns.leftX + TREE_ENTRY_INDENT,
    y,
    width: columns.leftColW - TREE_ENTRY_INDENT,
    items: browsable,
    idFor: (id) => id,
    labelFor: (id) => MOVES[id].name,
    selectedId: effectiveMovePreview(scene, browsable),
    page: scene.noetherMovePage,
    reserveBelow,
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
  return listResult.bottom;
}

// Every ordinary attack (ORDINARY_MOVE_IDS) the player's present form can
// host, whether or not Noether has anything left to charge for it: the ones
// she still sells first, then the ones the player already carries. The two
// groups read the same way and open the same demonstration stage, so the list
// is one list rather than two -- the same shape Kondo's and Landau's own move
// lists take, where a learned row still selects and previews and only its
// status line changes. Which of the two a row belongs to is re-derived in the
// pane below (whether `unlockedMoves` names it), and a move bought here
// crosses from the first group to the second on the rebuild that follows the
// purchase. The free starting Phonon Beam is never for sale, so it simply
// starts life in the carried half.
//
// The list is exactly the moves Noether herself deals in. Landau's Analytic
// pair, Skłodowska-Curie's Ultimate pair and Kondo's screenings each carry
// machinery that belongs to their own guardian -- a quiz gate, a tunable
// quasiparticle, a cloud raised on the caster instead of a strike thrown at a
// defender -- and each is browsed and demonstrated in that guardian's own
// panel. What Noether shows is the plain quasiparticle strike and nothing
// else.
function browsableMoves(scene: GuardianPanelHost): string[] {
  const unlocked = new Set(scene.getUnlockedMoves());
  const ordinary = new Set(ORDINARY_MOVE_IDS);
  const compatible = compatibleMoves(scene.playerMaterial).filter((id) => ordinary.has(id));
  return [...compatible.filter((id) => !unlocked.has(id)), ...compatible.filter((id) => unlocked.has(id))];
}

function effectiveMovePreview(scene: GuardianPanelHost, browsable: string[]): string {
  return browsable.includes(scene.noetherMovePreview ?? '') ? (scene.noetherMovePreview as string) : browsable[0];
}

// The pane beside an open Moves heading: the selected move's own real battle
// effect looping on its stage (the move's own static class, no shape
// override -- an ordinary move's battle look never changes), then either what
// it costs and the one button that spends it, or the line saying the player
// already carries it. The demonstration always runs at level 0, the move's
// uncorrected form -- Noether deals in the move itself, and the higher-order
// corrections that make it cascade are Feynman's, shown on his own stage at
// whatever tier the player has landed. With no move to preview at all this is
// the branch that stops the loop outright rather than retargeting it -- see
// art/moveEffectPreview.ts on why a caller must not stop a chain it is about
// to restart.
function renderMoveDetail(
  scene: GuardianPanelHost,
  container: Phaser.GameObjects.Container,
  columns: ListDetailColumns,
  y: number
): number {
  const browsable = browsableMoves(scene);
  if (browsable.length === 0) {
    stopMoveEffectPreview();
    const text = scene.add
      .text(columns.rightColCenterX, y, 'Your current form can carry no move at all.', {
        fontSize: fontPx(scene, 13),
        color: '#ffffff',
        align: 'center',
        wordWrap: { width: columns.rightColW },
      })
      .setOrigin(0.5, 0);
    container.add(text);
    return y + text.height + 6;
  }

  const move = MOVES[effectiveMovePreview(scene, browsable)];
  let rightY = renderMoveDetailHeader(scene, container, move.name, move.class, undefined, columns.rightColCenterX, y, columns.rightColW);

  if (scene.getUnlockedMoves().includes(move.id)) {
    return renderStatusAndConfirm({
      scene,
      container,
      centerX: columns.rightColCenterX,
      y: rightY,
      colW: columns.rightColW,
      status: `You already carry ${move.name}.`,
    });
  }

  const cost = shopCost(move);
  const tokens = (scene.game.registry.get('qumatessence') as number) || 0;
  return renderStatusAndConfirm({
    scene,
    container,
    centerX: columns.rightColCenterX,
    y: rightY,
    colW: columns.rightColW,
    status: `Costs ${cost} qumatessence.`,
    confirm: {
      label: `Learn ${move.name}`,
      onClick: () => buyNoetherMove(scene, move.id, cost),
      dimmed: tokens < cost,
    },
  });
}

function buyNoetherMove(scene: GuardianPanelHost, id: string, cost: number) {
  if ((scene.game.registry.get('qumatessence') as number) < cost) return;
  scene.qumatessence -= cost;
  scene.game.registry.set('qumatessence', scene.qumatessence);
  scene.tokenText.setText(`Qumatessence: ${scene.qumatessence}`);
  scene.game.registry.set('unlockedMoves', [...scene.getUnlockedMoves(), id]);
  persistFromRegistry(scene.game.registry);
  // Rebuild the whole panel so the purchased move crosses from the for-sale
  // half of the list to the carried half and the token total on display stays
  // correct.
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
// The three stats a crystal is, listed under the Stats heading. A stat is
// never filtered out: one already at MAX_STAT still selects and reads, its pane
// simply offering no confirm button (the same nothing-to-commit convention
// Feynman's fully-leveled moves and Dresselhaus's current form use).
// Superposition Mode pins every stat to MAX_STAT
// (OverworldScene.applySuperpositionUnlocks), so that is the state all three
// rows read in there.
const STAT_ROWS: { key: keyof Stats; effect: string }[] = [
  { key: 'quantumness', effect: 'Higher deals more damage.' },
  { key: 'velocity', effect: 'Higher goes first each round.' },
  { key: 'correlation', effect: 'Higher takes less damage.' },
];

function selectedStat(scene: GuardianPanelHost): { key: keyof Stats; effect: string } {
  return STAT_ROWS.find((row) => row.key === scene.noetherStatPreview) ?? STAT_ROWS[0];
}

function renderShopStats(
  scene: GuardianPanelHost,
  container: Phaser.GameObjects.Container,
  columns: ListDetailColumns,
  y: number
): number {
  const listResult = renderListColumn({
    scene,
    container,
    x: columns.leftX + TREE_ENTRY_INDENT,
    y,
    width: columns.leftColW - TREE_ENTRY_INDENT,
    items: STAT_ROWS,
    idFor: (row) => row.key,
    labelFor: (row) => STAT_LABELS[row.key],
    selectedId: selectedStat(scene).key,
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
  return listResult.bottom;
}

// The pane beside an open Stats heading. A stat has no art block to open on
// (listDetail.ts's own openers each render a crystal or a move effect), so it
// opens on its own name, then what it does in a fight, then what it *is*:
// data/statLore.ts's paragraph on the physics the name comes from, since these
// three are the numbers that define a quasiparticle rather than invented RPG
// attributes. This pane starts no battle-effect preview of its own, so nothing
// here will ever retarget a loop the Moves heading left running; it stops that
// loop outright instead.
function renderStatDetail(
  scene: GuardianPanelHost,
  container: Phaser.GameObjects.Container,
  columns: ListDetailColumns,
  y: number
): number {
  stopMoveEffectPreview();

  const stats = getPlayerStats(scene.game.registry);
  const tokens = (scene.game.registry.get('qumatessence') as number) || 0;
  const selected = selectedStat(scene);

  let rightY = y;
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
      color: GOLD_ACCENT_HEX,
      align: 'center',
      wordWrap: { width: columns.rightColW },
    })
    .setOrigin(0.5, 0);
  container.add(effectText);
  rightY += effectText.height + 6;

  // Capped tighter than the effect line above it: this is the longest text in
  // the panel, and left uncapped it walks the confirm button off the bottom of
  // the canvas at the largest text-size preset.
  const loreScale = Math.min(fontScale(scene), 1.15);
  const loreText = scene.add
    .text(columns.rightColCenterX, rightY, STAT_LORE[selected.key], {
      fontSize: `${Math.round(10 * loreScale)}px`,
      color: REFERENCE_BLUE_GREY_HEX,
      align: 'left',
      wordWrap: { width: columns.rightColW },
    })
    .setOrigin(0.5, 0);
  container.add(loreText);
  rightY += loreText.height + 8;

  const value = stats[selected.key];
  const maxed = value >= MAX_STAT;
  const cost = statUpgradeCost(value, selected.key);

  return renderStatusAndConfirm({
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
