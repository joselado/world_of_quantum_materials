import type { GuardianPanelHost } from '../OverworldScene';
import { makeDresselhausAvatar } from '../../art/dresselhaus';
import { playGuardianChime } from '../../audio/sfx';
import { CANVAS_W } from '../../art/perspective';
import { fontPx, fontScale } from '../../ui/text';
import { PANEL_BG, REFERENCE_BLUE_GREY_HEX } from '../../ui/theme';
import { findMaterialByName, allCrystals, isHybridMaterial, DRESSELHAUS_TRANSMUTE_COST } from '../../data/materials';
import { persistFromRegistry } from '../../data/save';
import { LIST_DETAIL_PANEL_W, listDetailColumns, renderListColumn, insertColumnDivider, renderDetailCrystalHeader } from './listDetail';

// Dresselhaus stands at world 3's middle tile like every other guardian (see
// spawnGuardianSprite/WORLD_GUARDIANS), triggered on reaching that row
// (maybeAutoOpenMiddleDialogue). Lets the player transmute into any
// crystal they've defeated -- the physics rationale being that a material's
// properties come from how its atoms are structured, not just which atoms
// they are, so understanding a defeated crystal's structure well enough is
// what lets the player rebuild themselves into it for a while.
// Superposition Mode replaces "defeated" with every crystal in the game
// (allCrystals()).
// Each individual crystal is its own one-time DRESSELHAUS_TRANSMUTE_COST
// qumatessence unlock (registry/save `dresselhausUnlockedCrystals`, a list
// of crystal names already paid for), not a single flat unlock for the
// whole ability: becoming a given crystal for the first time costs
// qumatessence and records that crystal as unlocked, every later
// transmutation back into it is free. Superposition Mode bypasses this
// per-crystal cost entirely (`isSuperpositionMode()`, not the persisted
// list).
// List+detail layout (scenes/panels/listDetail.ts, STYLE.md's "List+detail
// panels"): the left column just names candidates; clicking one only
// *previews* it in the right column (`scene.dresselhausPreview`) --
// browsing costs nothing. The right column's own "Become <name>" button is
// the one action that actually checks/spends the unlock cost and
// transmutes, so a candidate can be looked at at length before committing.
// Content laid out top-down first (running `y`), panel sized/inserted
// behind everything afterward -- same pattern as showSettingsPanel.
export function showDresselhausPanel(scene: GuardianPanelHost) {
  scene.dialogueActive = true;

  const panelWidth = LIST_DETAIL_PANEL_W;
  const top = 20;
  const container = scene.add.container(0, 0).setDepth(100);
  scene.dialogueContainer = container;

  let y = top;

  const avatarY = y + 42;
  const avatar = makeDresselhausAvatar(scene);
  avatar.setPosition(CANVAS_W / 2, avatarY);
  container.add(avatar);
  scene.tweens.add({ targets: avatar, y: avatarY + 8, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  playGuardianChime();
  y = avatarY + 48;

  const superposition = scene.isSuperpositionMode();
  const intro = scene.add
    .text(
      CANVAS_W / 2,
      y,
      superposition
        ? '"I am Dresselhaus. In superposition every nanostructure is within reach at once -- become anything that exists, not only what you have already beaten."'
        : '"I am Dresselhaus. Build the same atoms into a different nanostructure and you get a different material entirely -- new electrons, new phonons, no new chemistry required. Study a defeated crystal\'s structure closely enough, and you can rebuild yourself into it, for a while."',
      { fontSize: fontPx(scene, 11), fontStyle: 'italic', color: '#cfd8ff', align: 'center', wordWrap: { width: panelWidth - 80 } }
    )
    .setOrigin(0.5, 0);
  container.add(intro);
  y += intro.height + 14;

  // Excludes every hybrid-recipe result (isHybridMaterial) -- becoming a
  // fused state is Majorana's mechanic, not this one, even for the ones
  // that are also ordinary wild encounters.
  const candidates: { name: string }[] = superposition
    ? allCrystals()
        .filter((m) => !isHybridMaterial(m.name))
        .sort((a, b) => a.name.localeCompare(b.name))
    : scene
        .getDefeatedMaterials()
        .filter((m) => !isHybridMaterial(m.name))
        .slice(-3);

  if (candidates.length === 0) {
    const text = scene.add
      .text(CANVAS_W / 2, y, "You haven't defeated any crystals yet -- there is nothing to become.", {
        fontSize: fontPx(scene, 13),
        color: '#ffffff',
        align: 'center',
        wordWrap: { width: 480 },
      })
      .setOrigin(0.5, 0);
    container.add(text);
    y += text.height;
  } else {
    const panelLeft = CANVAS_W / 2 - panelWidth / 2;
    const columns = listDetailColumns(panelLeft);
    const columnsTop = y;

    const effectivePreview = candidates.some((c) => c.name === scene.dresselhausPreview)
      ? (scene.dresselhausPreview as string)
      : candidates[0].name;

    const listResult = renderListColumn({
      scene,
      container,
      x: columns.leftX,
      y: columnsTop,
      width: columns.leftColW,
      items: candidates,
      idFor: (c) => c.name,
      labelFor: (c) => c.name,
      selectedId: effectivePreview,
      page: scene.dresselhausPage,
      onPageChange: (page) => {
        scene.dresselhausPage = page;
        scene.dialogueContainer?.destroy(true);
        showDresselhausPanel(scene);
      },
      onSelect: (c) => {
        scene.dresselhausPreview = c.name;
        scene.dialogueContainer?.destroy(true);
        showDresselhausPanel(scene);
      },
    });
    scene.dresselhausPage = listResult.page;

    const previewMaterial = findMaterialByName(effectivePreview);
    let rightY = columnsTop;
    if (previewMaterial) {
      rightY = renderDetailCrystalHeader(scene, container, previewMaterial, columns.rightColCenterX, rightY, columns.rightColW);

      const unlockedCrystals = (scene.game.registry.get('dresselhausUnlockedCrystals') as string[]) ?? [];
      const isUnlocked = superposition || unlockedCrystals.includes(previewMaterial.name);
      const isCurrent = scene.playerMaterial.name === previewMaterial.name;
      const tokens = (scene.game.registry.get('qumatessence') as number) || 0;
      const affordable = isUnlocked || tokens >= DRESSELHAUS_TRANSMUTE_COST;

      const statusScale = Math.min(fontScale(scene), 1.2);
      const statusText = scene.add
        .text(
          columns.rightColCenterX,
          rightY,
          isCurrent
            ? 'This is your current form.'
            : isUnlocked
            ? 'Already unlocked -- free to become.'
            : `Costs ${DRESSELHAUS_TRANSMUTE_COST} qumatessence to unlock (one-time; free after).`,
          { fontSize: `${Math.round(11 * statusScale)}px`, color: REFERENCE_BLUE_GREY_HEX, align: 'center', wordWrap: { width: columns.rightColW } }
        )
        .setOrigin(0.5, 0);
      container.add(statusText);
      rightY += statusText.height + 6;

      if (!isCurrent) {
        const buttonScale = Math.min(fontScale(scene), 1.3);
        const confirmBtn = scene.addDialogueButtonAt(
          container,
          columns.rightColCenterX,
          rightY,
          isUnlocked ? `Become ${previewMaterial.name}` : `Become ${previewMaterial.name} (${DRESSELHAUS_TRANSMUTE_COST} qumatessence)`,
          () => transmuteInto(scene, previewMaterial.name, isUnlocked, unlockedCrystals),
          columns.rightColW,
          `${Math.round(13 * buttonScale)}px`
        );
        if (!affordable) confirmBtn.setAlpha(0.5);
        rightY += confirmBtn.height;
      }
    }

    const columnsBottom = Math.max(listResult.bottom, rightY);
    insertColumnDivider(scene, container, columns.dividerX, columnsTop, columnsBottom);
    y = columnsBottom + 6;
  }
  y += 8;

  y = scene.renderFarewellFooter(container, y) + 12;

  const panelHeight = y - top;
  const panel = scene.add
    .rectangle(CANVAS_W / 2, top + panelHeight / 2, panelWidth, panelHeight, PANEL_BG, 0.94)
    .setStrokeStyle(2, 0x4ad9a0);
  container.addAt(panel, 0);
}

function transmuteInto(scene: GuardianPanelHost, name: string, isUnlocked: boolean, unlockedCrystals: string[]) {
  const material = findMaterialByName(name);
  if (!material) return;
  if (!isUnlocked) {
    if ((scene.game.registry.get('qumatessence') as number) < DRESSELHAUS_TRANSMUTE_COST) return;
    scene.qumatessence -= DRESSELHAUS_TRANSMUTE_COST;
    scene.game.registry.set('qumatessence', scene.qumatessence);
    scene.tokenText.setText(`Qumatessence: ${scene.qumatessence}`);
    scene.game.registry.set('dresselhausUnlockedCrystals', [...unlockedCrystals, name]);
    persistFromRegistry(scene.game.registry);
  }
  scene.applyPlayerForm(material);

  // Rebuild the panel in place (dialogueActive already true from the open
  // showDresselhausPanel call) so the new form's status line updates.
  scene.dialogueContainer?.destroy(true);
  showDresselhausPanel(scene);
}
