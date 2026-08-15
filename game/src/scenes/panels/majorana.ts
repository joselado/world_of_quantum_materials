import type { GuardianPanelHost } from '../OverworldScene';
import { makeMajoranaAvatar } from '../../art/majorana';
import { killTweensDeep, makeCrystal } from '../../art/crystals';
import { playGuardianChime } from '../../audio/sfx';
import { CANVAS_W, CANVAS_H } from '../../art/perspective';
import { fontPx, fontScale } from '../../ui/text';
import { PANEL_BG, REFERENCE_BLUE_GREY_HEX } from '../../ui/theme';
import { allCrystals, combineMaterials, combinableHybridResults, MAJORANA_FUSE_COST, type HybridCombo } from '../../data/materials';
import { HYBRID_FUSION_LORE } from '../../data/materialdex';
import { persistFromRegistry } from '../../data/save';
import type { Material, MaterialType } from '../../data/types';
import {
  LIST_DETAIL_PANEL_W,
  listDetailColumns,
  renderListColumn,
  destroyPanel,
  insertColumnDivider,
  renderListColumnFooter,
  renderDetailCrystalHeader,
  renderStatusAndConfirm,
} from './listDetail';

// Majorana stands at world 5's middle tile (WORLD_GUARDIANS) and lets the
// player fuse two crystals they've already defeated into a new
// topological hybrid (data/materials.ts's combineMaterials), becoming it
// immediately via the same applyPlayerForm helper Dresselhaus's transmutation
// uses. Superposition Mode replaces "defeated" with every crystal in the
// game (allCrystals()) as the ingredient pool.
// Browsed by *result* rather than by ingredient (`combinableHybridResults`,
// data/materials.ts) -- the left column lists every hybrid the pool can
// currently reach, one row per named HYBRID_RECIPES result, since
// HYBRID_RECIPES has no two different pairs producing the same result, so
// "which pair makes this row" is unambiguous. This is a list+detail layout
// (scenes/panels/listDetail.ts, STYLE.md's "List+detail panels"): clicking a
// row only *previews* it in the right column (`scene.majoranaPreview`, now
// holding the previewed *result's* name); browsing every hybrid, however
// many times, costs nothing. The right column shows the two original
// component crystals, the resulting hybrid crystal below them
// (renderDetailCrystalHeader, the same crystal-plus-name block Dresselhaus's/
// Anderson's own detail panes use), an epic-plus-physics description of the
// fusion (`materialdex.ts`'s HYBRID_FUSION_LORE), and finally the cost/status
// line and confirm button.
// Each individual hybrid *result* is its own one-time MAJORANA_FUSE_COST
// qumatessence unlock (registry/save `majoranaUnlockedResults`, a list of
// result names already paid for), not a single flat unlock for the whole
// mechanic. The confirm button ("Fuse") is the one action that actually
// checks/spends the cost and fuses. Superposition Mode bypasses this
// per-result cost entirely (`isSuperpositionMode()`, not the persisted list).
// A preview click is a scoped update, not a panel rebuild (CODEMAP's
// "scoped update" convention): the avatar, intro and list rows are built
// once per panel open, and clicking a row only restyles the highlighted row
// (listResult.setSelectedId) and re-renders `detailBlock`/`chromeBlock` --
// which matters most here, since the detail pane rebuilds three crystals
// (both parents plus the result) on every click. Fusing still rebuilds the
// whole panel, since the player's own form has changed.
export function showMajoranaPanel(scene: GuardianPanelHost) {
  scene.dialogueActive = true;

  const panelWidth = LIST_DETAIL_PANEL_W;
  const top = 20;
  const container = scene.add.container(0, 0).setDepth(100);
  scene.dialogueContainer = container;

  // Added first so everything below (divider, footer, panel background)
  // renders beneath every row/button added to `container` afterward.
  const chromeBlock = scene.add.container(0, 0);
  container.add(chromeBlock);

  const finishPanel = (yEnd: number, target: Phaser.GameObjects.Container) => {
    const panelHeight = yEnd - top;
    const panel = scene.add
      .rectangle(CANVAS_W / 2, top + panelHeight / 2, panelWidth, panelHeight, PANEL_BG, 0.94)
      .setStrokeStyle(2, 0x4fd97a);
    target.addAt(panel, 0);
  };

  let y = top;

  const avatarY = y + 42;
  const avatar = makeMajoranaAvatar(scene);
  avatar.setPosition(CANVAS_W / 2, avatarY);
  container.add(avatar);
  scene.tweens.add({ targets: avatar, y: avatarY + 8, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  playGuardianChime();
  y = avatarY + 48;

  // Kept short -- this panel carries more content below than any other
  // guardian panel, and the header's own wrap grows uncapped at larger
  // text-size presets the same way every guardian's intro does (STYLE.md),
  // so a short quote here is what keeps the worst-case content (a long
  // hybrid name, largest preset) inside the canvas.
  const superposition = scene.isSuperpositionMode();
  const intro = scene.add
    .text(
      CANVAS_W / 2,
      y,
      superposition
        ? '"I am Majorana. In superposition every pairing is possible -- fuse any two states that make physical sense."'
        : '"I am Majorana. Fuse two states you understand and see what phase they make together."',
      { fontSize: fontPx(scene, 11), fontStyle: 'italic', color: '#cfd8ff', align: 'center', wordWrap: { width: panelWidth - 80 } }
    )
    .setOrigin(0.5, 0);
  container.add(intro);
  y += intro.height + 8;

  const pool: { name: string; type: MaterialType }[] = superposition ? allCrystals() : scene.getDefeatedMaterials();
  const combos = combinableHybridResults(pool).sort((a, b) => a.result.name.localeCompare(b.result.name));

  if (combos.length === 0) {
    const text = scene.add
      .text(
        CANVAS_W / 2,
        y,
        "None of the crystals you've defeated pair into a known hybrid recipe yet -- Majorana only knows specific real pairings (e.g. Aluminum + Indium Arsenide, or two Graphenes together).",
        { fontSize: fontPx(scene, 13), color: '#ffffff', align: 'center', wordWrap: { width: 480 } }
      )
      .setOrigin(0.5, 0);
    container.add(text);
    y += text.height;
    y += 2;
    y = scene.renderFarewellFooter(container, y) + 12;
    finishPanel(y, container);
    return;
  }

  // No "which hybrid?" step label -- Dresselhaus's single-step transmute
  // list has none either, and reclaiming this row's height matters more
  // here than in his panel (see the worst-case-content note above).

  const panelLeft = CANVAS_W / 2 - panelWidth / 2;
  const columns = listDetailColumns(panelLeft);
  const columnsTop = y;

  let preview = combos.some((c) => c.result.name === scene.majoranaPreview) ? (scene.majoranaPreview as string) : combos[0].result.name;

  const listResult = renderListColumn({
    scene,
    container,
    x: columns.leftX,
    y: columnsTop,
    width: columns.leftColW,
    items: combos,
    idFor: (c) => c.result.name,
    labelFor: (c) => c.result.name,
    selectedId: preview,
    page: scene.majoranaPage,
    onPageChange: (page) => {
      scene.majoranaPage = page;
      destroyPanel(scene);
      showMajoranaPanel(scene);
    },
    onSelect: (c) => {
      scene.majoranaPreview = c.result.name;
      preview = c.result.name;
      listResult.setSelectedId(c.result.name);
      renderDetail();
    },
  });
  scene.majoranaPage = listResult.page;

  const detailBlock = scene.add.container(0, 0);
  container.add(detailBlock);

  const renderDetail = () => {
    killTweensDeep(scene, detailBlock);
    detailBlock.removeAll(true);
    chromeBlock.removeAll(true);

    const combo = combos.find((c) => c.result.name === preview)!;
    let rightY = renderParentCrystalsRow(scene, detailBlock, combo.parentA, combo.parentB, columns.rightColCenterX, columnsTop, columns.rightColW);
    rightY = renderDetailCrystalHeader(scene, detailBlock, combo.result, columns.rightColCenterX, rightY, columns.rightColW);

    const unlockedResults = (scene.game.registry.get('majoranaUnlockedResults') as string[]) ?? [];
    const isUnlocked = (resultName: string) => superposition || unlockedResults.includes(resultName);
    const tokens = (scene.game.registry.get('qumatessence') as number) || 0;
    const resultUnlocked = isUnlocked(combo.result.name);
    const affordable = resultUnlocked || tokens >= MAJORANA_FUSE_COST;

    // Description shrinks in whole-px steps (floor 9), the same technique
    // HubScene.renderMaterialdexPanel's own blurb uses -- this pane already
    // stacks two crystal renders above it, so a long entry risks pushing the
    // status line/button/footer off the bottom of the canvas. Capped the
    // same way the parent caption/status text/button are (`Math.min(
    // fontScale(scene), 1.2)`) rather than the raw scale Qumatex's own blurb
    // uses -- Qumatex has only its own blurb competing for room below the
    // fold, this pane also carries two crystal renders above it, so letting
    // the description grow uncapped at the largest text-size preset would
    // make the worst case (largest preset) shrink from an even taller
    // starting point than the default preset, backwards from what's needed.
    // reservedBelow covers everything still to come below the description
    // (status line, confirm button, footer) rather than just one button,
    // unlike Qumatex's single-button pane.
    const descScale = Math.min(fontScale(scene), 1.2);
    let descBase = 11;
    const descText = scene.add
      .text(columns.rightColCenterX, rightY, HYBRID_FUSION_LORE[combo.result.name], {
        fontSize: `${Math.round(descBase * descScale)}px`,
        color: '#cfd8ff',
        align: 'left',
        wordWrap: { width: columns.rightColW },
        lineSpacing: 3,
      })
      .setOrigin(0.5, 0);
    detailBlock.add(descText);
    const reservedBelow = 100;
    while (rightY + descText.height + reservedBelow > CANVAS_H - 10 && descBase > 9) {
      descBase -= 1;
      descText.setFontSize(`${Math.round(descBase * descScale)}px`);
    }
    rightY += descText.height + 6;

    // The hybrid's own name is already the large title just above (from
    // renderDetailCrystalHeader), so the button doesn't repeat it -- keeps
    // the label short enough to stay one line even at the largest
    // text-size preset, unlike Dresselhaus's/Anderson's "Become/Dope in
    // <name>" (their result is the only crystal shown, so naming it there
    // is the only place it appears).
    rightY = renderStatusAndConfirm({
      scene,
      container: detailBlock,
      centerX: columns.rightColCenterX,
      y: rightY,
      colW: columns.rightColW,
      status: resultUnlocked
        ? 'Already unlocked -- free to fuse.'
        : `Costs ${MAJORANA_FUSE_COST} qumatessence to unlock (one-time; free after).`,
      confirm: {
        label: 'Fuse',
        onClick: () => createHybrid(scene, combo, unlockedResults),
        dimmed: !affordable,
      },
    });

    const leftBottom = renderListColumnFooter(scene, chromeBlock, columns, listResult.bottom + 10, 'Farewell', () => scene.closeDialogue());
    const columnsBottom = Math.max(leftBottom, rightY);
    insertColumnDivider(scene, chromeBlock, columns.dividerX, columnsTop, columnsBottom);
    finishPanel(columnsBottom + 14, chromeBlock);
  };
  renderDetail();
}

// The two original ingredients, rendered small and side by side above the
// resulting hybrid's own (full-size) render below -- so the player can see
// what makes this hybrid without needing to recall which pair produces it.
// A same-name recipe (e.g. Graphene + Graphene) renders the same crystal
// twice with a "x2" caption rather than a redundant "X + X" one, which also
// keeps the caption short for this panel's longest self-paired name
// (Monolayer MoTe₂ (2H)).
function renderParentCrystalsRow(
  scene: GuardianPanelHost,
  container: Phaser.GameObjects.Container,
  parentA: Material,
  parentB: Material,
  centerX: number,
  y: number,
  colW: number
): number {
  const crystalSize = 14;
  const blockH = 30;
  const offset = 28;
  const cA = makeCrystal(scene, crystalSize, parentA.color, parentA.variant, { seed: parentA.name });
  cA.setPosition(centerX - offset, y + blockH / 2);
  container.add(cA);
  const cB = makeCrystal(scene, crystalSize, parentB.color, parentB.variant, { seed: parentB.name });
  cB.setPosition(centerX + offset, y + blockH / 2);
  container.add(cB);
  const plus = scene.add
    .text(centerX, y + blockH / 2, '+', { fontSize: fontPx(scene, 12), color: REFERENCE_BLUE_GREY_HEX })
    .setOrigin(0.5, 0.5);
  container.add(plus);
  let ny = y + blockH;

  // Capped the same way the description below is -- a secondary caption,
  // not worth costing this already-tight panel extra height at the largest
  // text-size preset.
  const captionScale = Math.min(fontScale(scene), 1.2);
  const caption = parentA.name === parentB.name ? `${parentA.name} ×2` : `${parentA.name} + ${parentB.name}`;
  const captionText = scene.add
    .text(centerX, ny, caption, {
      fontSize: `${Math.round(10 * captionScale)}px`,
      color: '#cfd8ff',
      align: 'center',
      wordWrap: { width: colW },
    })
    .setOrigin(0.5, 0);
  container.add(captionText);
  ny += captionText.height + 2;
  return ny;
}

function becomeHybrid(scene: GuardianPanelHost, hybrid: Material) {
  scene.applyPlayerForm(hybrid);
  destroyPanel(scene);
  showMajoranaPanel(scene);
}

// `unlockedResults` is the registry snapshot read by the panel just before
// this was called -- if the result isn't unlocked yet, this is also where
// the MAJORANA_FUSE_COST purchase actually happens (Superposition Mode
// never reaches the paid branch, since the panel's own isUnlocked check
// already treats every result as unlocked there).
function createHybrid(scene: GuardianPanelHost, combo: HybridCombo, unlockedResults: string[]) {
  const hybrid = combineMaterials(combo.parentA, combo.parentB);
  if (!scene.isSuperpositionMode() && !unlockedResults.includes(hybrid.name)) {
    if ((scene.game.registry.get('qumatessence') as number) < MAJORANA_FUSE_COST) return;
    scene.qumatessence -= MAJORANA_FUSE_COST;
    scene.game.registry.set('qumatessence', scene.qumatessence);
    scene.tokenText.setText(`Qumatessence: ${scene.qumatessence}`);
    scene.game.registry.set('majoranaUnlockedResults', [...unlockedResults, hybrid.name]);
    persistFromRegistry(scene.game.registry);
  }
  becomeHybrid(scene, hybrid);
}
