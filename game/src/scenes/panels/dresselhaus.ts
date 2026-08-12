import type { OverworldScene } from '../OverworldScene';
import { makeDresselhausAvatar } from '../../art/dresselhaus';
import { playGuardianChime } from '../../audio/sfx';
import { CANVAS_W } from '../../art/perspective';
import { fontPx } from '../../ui/text';
import { findMaterialByName, allCrystals, isHybridMaterial } from '../../data/materials';

// Dresselhaus stands at world 3's middle tile like every other guardian (see
// spawnGuardianSprite/WORLD_GUARDIANS), triggered on reaching that row
// (maybeAutoOpenMiddleDialogue). Lets the player transmute into any
// crystal they've defeated -- the physics rationale being that a material's
// properties come from how its atoms are structured, not just which atoms
// they are, so understanding a defeated crystal's structure well enough is
// what lets the player rebuild themselves into it for a while.
// Superposition Mode replaces "defeated" with every crystal in the game
// (allCrystals()), paginated via renderPagedButtons since that pool is
// far bigger than the normal handful of recent defeats.
// Content laid out top-down first (running `y`), panel sized/inserted
// behind everything afterward -- same pattern as showSettingsPanel.
export function showDresselhausPanel(scene: OverworldScene) {
  scene.dialogueActive = true;

  const panelWidth = 600;
  const top = 20;
  const container = scene.add.container(0, 0).setDepth(100);
  scene.dialogueContainer = container;

  let y = top;

  const avatarY = y + 55;
  const avatar = makeDresselhausAvatar(scene);
  avatar.setPosition(CANVAS_W / 2, avatarY);
  container.add(avatar);
  scene.tweens.add({ targets: avatar, y: avatarY + 8, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  playGuardianChime();
  y = avatarY + 65;

  const superposition = scene.isSuperpositionMode();
  const intro = scene.add
    .text(
      CANVAS_W / 2,
      y,
      superposition
        ? '"I am Dresselhaus. In superposition every nanostructure is within reach at once -- become anything that exists, not only what you have already beaten."'
        : '"I am Dresselhaus. Build the same atoms into a different nanostructure and you get a different material entirely -- new electrons, new phonons, no new chemistry required. Study a defeated crystal\'s structure closely enough, and you can rebuild yourself into it, for a while."',
      { fontSize: fontPx(scene, 12), fontStyle: 'italic', color: '#cfd8ff', align: 'center', wordWrap: { width: panelWidth - 80 } }
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
    y = scene.renderPagedButtons(
      container,
      y,
      candidates,
      scene.dresselhausPage,
      4,
      (m) => (scene.playerMaterial.name === m.name ? `${m.name} (current form)` : `Become ${m.name}`),
      (m) => {
        if (scene.playerMaterial.name === m.name) return;
        transmuteInto(scene, m.name);
      },
      (page) => {
        scene.dresselhausPage = page;
        scene.dialogueContainer?.destroy(true);
        showDresselhausPanel(scene);
      },
      (m) => scene.playerMaterial.name === m.name
    );
  }
  y += 8;

  const closeBtn = scene.addDialogueButtonAt(container, CANVAS_W / 2, y, 'Farewell', () => scene.closeDialogue(), 300);
  y += closeBtn.height + 12;

  const panelHeight = y - top;
  const panel = scene.add
    .rectangle(CANVAS_W / 2, top + panelHeight / 2, panelWidth, panelHeight, 0x10101c, 0.94)
    .setStrokeStyle(2, 0x4ad9a0);
  container.addAt(panel, 0);
}

function transmuteInto(scene: OverworldScene, name: string) {
  const material = findMaterialByName(name);
  if (!material) return;
  scene.applyPlayerForm(material);

  // Rebuild the panel in place (dialogueActive already true from the open
  // showDresselhausPanel call) so the new form's "(current form)" tag updates.
  scene.dialogueContainer?.destroy(true);
  showDresselhausPanel(scene);
}
