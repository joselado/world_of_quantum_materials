import type { OverworldScene } from '../OverworldScene';
import { makeAndersonAvatar } from '../../art/anderson';
import { playGuardianChime } from '../../audio/sfx';
import { CANVAS_W } from '../../art/perspective';
import { fontPx } from '../../ui/text';
import { MOVES, allCrystals, isHybridMaterial, findMaterialByName } from '../../data/materials';
import { persistFromRegistry } from '../../data/save';

// Anderson stands at world 9's middle tile (WORLD_GUARDIANS) and lets the
// player "dope in" a crystal they've encountered (or, in Superposition
// Mode, any crystal in the game) as an impurity, then learn one specific
// move from its moveset -- an Anderson-impurity take on the same idea
// Dresselhaus/Majorana explore differently: Dresselhaus becomes the whole state,
// Majorana fuses two states together, Anderson borrows just one
// excitation channel from a state without becoming it. The learned move
// is a completely ordinary entry in `unlockedMoves` -- MOVE_COMPATIBILITY
// still gates whether it actually shows up in the battle move menu
// (getBattleMoves), which is the point: an impurity's channel only
// manifests in combat once the player's own current form can physically
// host it. Host pool excludes any `isHybridMaterial` (a Majorana fusion,
// or one of world 10's own named recipe-result wilds) -- doping in an
// impurity is meant to be one real, single-crystal excitation, not a
// channel a fusion has borrowed from elsewhere. Two-step pick
// (scene.andersonSelection holds the host while the panel rebuilds to ask
// which of its moves to learn), paginated at the host-pick step via
// renderPagedButtons -- same shape as Majorana's combine flow, minus a
// second pagination pass since a host's moveset is always small
// (crystal() only ever assigns two).
export function showAndersonPanel(scene: OverworldScene) {
  scene.dialogueActive = true;

  const panelWidth = 600;
  const top = 20;
  const container = scene.add.container(0, 0).setDepth(100);
  scene.dialogueContainer = container;

  let y = top;

  const avatarY = y + 55;
  const avatar = makeAndersonAvatar(scene);
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
        ? '"I am Anderson. In superposition every crystal is available to dope in as an impurity -- pick one, and I will teach you the single channel it opens."'
        : '"I am Anderson. Dope in a crystal you have encountered as an impurity, and I will teach you the one channel it opens in your own lattice -- whether it ever fires depends on what your own physics can carry."',
      { fontSize: fontPx(scene, 12), fontStyle: 'italic', color: '#cfd8ff', align: 'center', wordWrap: { width: panelWidth - 80 } }
    )
    .setOrigin(0.5, 0);
  container.add(intro);
  y += intro.height + 14;

  // Doping in a hybrid (isHybridMaterial -- a Majorana fusion, or one of
  // world 10's own named recipe-result wilds) isn't offered here: an
  // impurity is meant to be one real, single-crystal excitation, not a
  // channel already borrowed from elsewhere.
  const pool: { name: string }[] = (superposition ? allCrystals() : scene.getDefeatedMaterials()).filter(
    (m) => !isHybridMaterial(m.name)
  );

  if (scene.andersonSelection === null) {
    if (pool.length === 0) {
      const text = scene.add
        .text(CANVAS_W / 2, y, "You haven't defeated any original crystals yet -- there is nothing to dope in.", {
          fontSize: fontPx(scene, 13),
          color: '#ffffff',
          align: 'center',
          wordWrap: { width: 480 },
        })
        .setOrigin(0.5, 0);
      container.add(text);
      y += text.height;
    } else {
      const label = scene.add
        .text(CANVAS_W / 2, y, 'Dope in which crystal?', {
          fontSize: fontPx(scene, 12),
          color: '#e8b27a',
          align: 'center',
        })
        .setOrigin(0.5, 0);
      container.add(label);
      y += label.height + 6;
      const sorted = pool.slice().sort((a, b) => a.name.localeCompare(b.name));
      y = scene.renderPagedButtons(
        container,
        y,
        sorted,
        scene.andersonPage,
        4,
        (m) => m.name,
        (m) => {
          scene.andersonSelection = m.name;
          scene.andersonPage = 0;
          scene.dialogueContainer?.destroy(true);
          showAndersonPanel(scene);
        },
        (page) => {
          scene.andersonPage = page;
          scene.dialogueContainer?.destroy(true);
          showAndersonPanel(scene);
        }
      );
    }
  } else {
    const host = findMaterialByName(scene.andersonSelection);
    const unlocked = scene.getUnlockedMoves();
    const learnable = host ? host.moves.filter((id) => !unlocked.includes(id)) : [];
    const label = scene.add
      .text(CANVAS_W / 2, y, `Learn which move from ${scene.andersonSelection}?`, {
        fontSize: fontPx(scene, 12),
        color: '#e8b27a',
        align: 'center',
        wordWrap: { width: 480 },
      })
      .setOrigin(0.5, 0);
    container.add(label);
    y += label.height + 6;

    if (learnable.length === 0) {
      const text = scene.add
        .text(CANVAS_W / 2, y, `You already carry every move ${scene.andersonSelection} has to offer.`, {
          fontSize: fontPx(scene, 13),
          color: '#ffffff',
          align: 'center',
          wordWrap: { width: 480 },
        })
        .setOrigin(0.5, 0);
      container.add(text);
      y += text.height + 6;
    } else {
      learnable.forEach((id) => {
        const move = MOVES[id];
        const btn = scene.addDialogueButton(container, y, `${move.name} (Pwr ${move.power})`, () => learnImpurityMove(scene, id));
        y += btn.height + 6;
      });
    }
    const cancelBtn = scene.addDialogueButton(container, y, 'Never mind', () => {
      scene.andersonSelection = null;
      scene.andersonPage = 0;
      scene.dialogueContainer?.destroy(true);
      showAndersonPanel(scene);
    });
    y += cancelBtn.height + 6;
  }
  y += 8;

  const closeBtn = scene.addDialogueButtonAt(container, CANVAS_W / 2, y, 'Farewell', () => scene.closeDialogue(), 300);
  y += closeBtn.height + 12;

  const panelHeight = y - top;
  const panel = scene.add
    .rectangle(CANVAS_W / 2, top + panelHeight / 2, panelWidth, panelHeight, 0x10101c, 0.94)
    .setStrokeStyle(2, 0xc9884a);
  container.addAt(panel, 0);
}

// Learns one move from the doped-in host's moveset -- just an ordinary
// append to `unlockedMoves` (see showAndersonPanel's comment for why this
// needs no special-case handling anywhere else: MOVE_COMPATIBILITY
// already gates whether it's actually usable).
function learnImpurityMove(scene: OverworldScene, moveId: string) {
  const unlocked = scene.getUnlockedMoves();
  if (!unlocked.includes(moveId)) {
    scene.game.registry.set('unlockedMoves', [...unlocked, moveId]);
    persistFromRegistry(scene.game.registry);
  }
  scene.andersonSelection = null;
  scene.andersonPage = 0;
  scene.dialogueContainer?.destroy(true);
  showAndersonPanel(scene);
}
