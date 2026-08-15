import type { GuardianPanelHost } from '../OverworldScene';
import { makeKondoAvatar } from '../../art/kondo';
import { killTweensDeep } from '../../art/crystals';
import { playGuardianChime } from '../../audio/sfx';
import { CANVAS_W } from '../../art/perspective';
import { fontScale } from '../../ui/text';
import { PANEL_BG, REFERENCE_BLUE_GREY_HEX } from '../../ui/theme';
import { MOVES, KONDO_MOVE_IDS, shopCost, moveDisplayName, getMoveLevel } from '../../data/materials';
import { persistFromRegistry } from '../../data/save';
import {
  LIST_DETAIL_PANEL_W,
  listDetailColumns,
  renderListColumn,
  destroyPanel,
  insertColumnDivider,
  renderListColumnFooter,
  renderSelfBuffMoveDetailHeader,
  renderStatusAndConfirm,
} from './listDetail';

// Kondo stands at world 8's middle tile (WORLD_GUARDIANS) and sells three
// self-buff moves (data/materials.ts's KONDO_MOVE_IDS -- Screening
// Pulse/Scattering Drag/Coherence Cascade, kept out of Noether's and
// Landau's own lists so Kondo is their one source), usable from any
// crystal form the player is currently wearing since a self-buff isn't
// gated by MOVE_COMPATIBILITY at all.
//
// List+detail layout (scenes/panels/listDetail.ts, STYLE.md's "List+detail
// panels"), the same shape Noether's/Landau's/Skłodowska-Curie's own
// move-browsing steps use: the left column names all three KONDO_MOVE_IDS
// (moveDisplayName, folding in Feynman's level prefix -- always a no-op for
// a still-unbought move, since leveling requires already owning it). A row
// click only *previews* it (scene.kondoMovePreview), free regardless of how
// many rows are looked at. Unlike those three guardians' own moves, a Kondo
// move is a self-buff, not a travelling attack -- BattleScene.resolveSelfBuff
// plays its real effect centered on the caster's own position (from === to
// === pos), not flying across the field -- so the right column's own detail
// header (renderSelfBuffMoveDetailHeader, listDetail.ts) shows the player's
// own current crystal standing on a ground shadow with the move's
// 'screening'-class ring effect looping centered on it, rather than a
// projectile crossing the pane. Below that: the move's own physics
// description (data/materials.ts's Move.description, only Kondo's three
// moves carry one), then a cost/status line and a confirm button -- "Learn
// <name> (<cost> qumatessence)" for a still-unbought move (buying the very
// first Kondo move ever bought auto-activates it, so a purchase is never
// silently unusable), "Make <name> active" for an already-bought, inactive
// move, or a dimmed "<name> (active)" tag (no-op click) for whichever one is
// currently active (registry/save kondoActiveMove) -- only one of the three
// is ever usable in battle at a time, switched by returning to this panel,
// never a per-turn choice in the battle move menu. None of the three is
// gated by MOVE_COMPATIBILITY, so all three are always for sale until
// bought -- no empty/wrong-form state to render here.
//
// A preview click is a scoped update, not a panel rebuild (CODEMAP's
// "scoped update" convention): the avatar, intro and list rows are built
// once per panel open, and clicking a row only restyles the highlighted row
// (listResult.setSelectedId) and re-renders `detailBlock`/`chromeBlock`.
// Buying or activating still rebuilds the whole panel, since both change
// state every row's own label reads.
export function showKondoPanel(scene: GuardianPanelHost) {
  scene.dialogueActive = true;

  const panelWidth = LIST_DETAIL_PANEL_W;
  const top = 20;
  const container = scene.add.container(0, 0).setDepth(100);
  scene.dialogueContainer = container;

  // Added first so everything below (divider, footer, panel background)
  // renders beneath every row/button added to `container` afterward.
  const chromeBlock = scene.add.container(0, 0);
  container.add(chromeBlock);

  let y = top;

  const avatarY = y + 42;
  const avatar = makeKondoAvatar(scene);
  avatar.setPosition(CANVAS_W / 2, avatarY);
  container.add(avatar);
  scene.tweens.add({ targets: avatar, y: avatarY + 8, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  playGuardianChime();
  y = avatarY + 48;

  // Capped tighter than the ordinary intro-quote scaling every other guardian
  // panel uses (STYLE.md), same reasoning/cap as Landau's own intro
  // (panels/landau.ts) -- this panel now carries a full list+detail layout
  // with an 84px animation stage plus a per-move description line below it,
  // and an uncapped quote at the largest text-size preset pushed the detail
  // pane's own confirm button past the bottom of the canvas.
  const introScale = Math.min(fontScale(scene), 1.15);
  const intro = scene.add
    .text(
      CANVAS_W / 2,
      y,
      '"I am Kondo. Any crystal can turn its own disorder to its advantage -- screen itself, scatter its own signature, cascade its own coherence back together. Learn a technique, then tell me which one to hold. Only one at a time."',
      { fontSize: `${Math.round(11 * introScale)}px`, fontStyle: 'italic', color: '#cfd8ff', align: 'center', wordWrap: { width: panelWidth - 80 } }
    )
    .setOrigin(0.5, 0);
  container.add(intro);
  y += intro.height + 14;

  const panelLeft = CANVAS_W / 2 - panelWidth / 2;
  const columns = listDetailColumns(panelLeft);
  const columnsTop = y;

  let preview = KONDO_MOVE_IDS.includes(scene.kondoMovePreview ?? '') ? (scene.kondoMovePreview as string) : KONDO_MOVE_IDS[0];

  const listResult = renderListColumn({
    scene,
    container,
    x: columns.leftX,
    y: columnsTop,
    width: columns.leftColW,
    items: KONDO_MOVE_IDS,
    idFor: (id) => id,
    labelFor: (id) => moveDisplayName(scene.game.registry, id),
    selectedId: preview,
    page: scene.kondoMovePage,
    onPageChange: (page) => {
      scene.kondoMovePage = page;
      destroyPanel(scene);
      showKondoPanel(scene);
    },
    onSelect: (id) => {
      scene.kondoMovePreview = id;
      preview = id;
      listResult.setSelectedId(id);
      renderDetail();
    },
  });
  scene.kondoMovePage = listResult.page;

  const detailBlock = scene.add.container(0, 0);
  container.add(detailBlock);

  const renderDetail = () => {
    killTweensDeep(scene, detailBlock);
    detailBlock.removeAll(true);
    chromeBlock.removeAll(true);

    const id = preview;
    const move = MOVES[id];
    const displayName = moveDisplayName(scene.game.registry, id);
    let rightY = columnsTop;
    rightY = renderSelfBuffMoveDetailHeader(
      scene,
      detailBlock,
      scene.playerMaterial,
      displayName,
      move.class,
      columns.rightColCenterX,
      rightY,
      columns.rightColW,
      getMoveLevel(scene.game.registry, id)
    );

    const descScale = Math.min(fontScale(scene), 1.2);
    const descText = scene.add
      .text(columns.rightColCenterX, rightY, move.description ?? '', {
        fontSize: `${Math.round(11 * descScale)}px`,
        color: REFERENCE_BLUE_GREY_HEX,
        align: 'center',
        wordWrap: { width: columns.rightColW },
      })
      .setOrigin(0.5, 0);
    detailBlock.add(descText);
    rightY += descText.height + 6;

    const unlocked = scene.getUnlockedMoves();
    const isLearned = unlocked.includes(id);
    const active = (scene.game.registry.get('kondoActiveMove') as string | null) ?? null;
    const isActive = id === active;
    const cost = shopCost(move);
    const tokens = (scene.game.registry.get('qumatessence') as number) || 0;
    const affordable = isLearned || tokens >= cost;

    rightY = renderStatusAndConfirm({
      scene,
      container: detailBlock,
      centerX: columns.rightColCenterX,
      y: rightY,
      colW: columns.rightColW,
      status: !isLearned
        ? `Costs ${cost} qumatessence to learn.`
        : isActive
        ? `${displayName} is your active technique.`
        : 'Learned -- not currently active.',
      confirm: {
        label: !isLearned ? `Learn ${displayName}` : isActive ? `${displayName} (active)` : `Make ${displayName} active`,
        onClick: () => {
          if (isActive) return;
          if (isLearned) activateKondoMove(scene, id);
          else buyKondoMove(scene, id, cost);
        },
        dimmed: isActive || !affordable,
      },
    });

    const leftBottom = renderListColumnFooter(scene, chromeBlock, columns, listResult.bottom + 10, 'Farewell', () => scene.closeDialogue());
    const columnsBottom = Math.max(leftBottom, rightY);
    insertColumnDivider(scene, chromeBlock, columns.dividerX, columnsTop, columnsBottom);
    const panelHeight = columnsBottom + 14 - top;
    const panel = scene.add
      .rectangle(CANVAS_W / 2, top + panelHeight / 2, panelWidth, panelHeight, PANEL_BG, 0.94)
      .setStrokeStyle(2, 0xe86a44);
    chromeBlock.addAt(panel, 0);
  };
  renderDetail();
}

function buyKondoMove(scene: GuardianPanelHost, id: string, cost: number) {
  if ((scene.game.registry.get('qumatessence') as number) < cost) return;
  scene.qumatessence -= cost;
  scene.game.registry.set('qumatessence', scene.qumatessence);
  scene.tokenText.setText(`Qumatessence: ${scene.qumatessence}`);
  scene.game.registry.set('unlockedMoves', [...scene.getUnlockedMoves(), id]);
  // The very first Kondo move ever bought becomes active automatically --
  // "picked for the first time" happens right here, in this same
  // conversation with Kondo, so there's no dead-purchase state where a
  // freshly bought move shows up nowhere in battle. Buying a second or third
  // afterward doesn't -- switching between already-bought moves always
  // requires its own explicit "Make active" click.
  if (!scene.game.registry.get('kondoActiveMove')) {
    scene.game.registry.set('kondoActiveMove', id);
  }
  persistFromRegistry(scene.game.registry);
  destroyPanel(scene);
  showKondoPanel(scene);
}

function activateKondoMove(scene: GuardianPanelHost, id: string) {
  scene.game.registry.set('kondoActiveMove', id);
  persistFromRegistry(scene.game.registry);
  destroyPanel(scene);
  showKondoPanel(scene);
}
