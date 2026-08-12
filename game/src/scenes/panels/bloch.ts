import type { OverworldScene } from '../OverworldScene';
import { BUILT_WORLDS } from '../OverworldScene';
import { makeBlochAvatar } from '../../art/bloch';
import { playGuardianChime } from '../../audio/sfx';
import { CANVAS_W } from '../../art/perspective';
import { fontPx } from '../../ui/text';
import { WORLD_NAMES, BLOCH_DESTINATION_COST } from '../../data/materials';
import { persistFromRegistry } from '../../data/save';

// Bloch stands at world 2's middle tile (see spawnGuardianSprite/
// WORLD_GUARDIANS) and folds the player to any other world they've already
// visited and that actually has a built map (BUILT_WORLDS) -- offering an
// unbuilt world would teleport the player somewhere with no map to stand
// on. Ends in the plain "Farewell"-only renderFarewellFooter, not the
// Face-the-Rival/Continue footer -- that stays exclusive to the goal
// panel now that Bloch stands mid-corridor rather than at the goal.
// Destinations paginate via renderPagedButtons (same helper Dresselhaus/
// Majorana/Anderson use) -- with only a handful of built worlds this used
// to just shrink the row font/drop the avatar past 5 destinations, but
// Superposition Mode pre-seeding every world as visited made a 9-
// destination list the common case rather than a rare one, and no amount
// of font shrinking keeps 9 full rows plus avatar/quote/footer inside the
// 480px canvas -- capping the row *count* per page is the only fix that
// actually bounds the height.
// Each individual destination is its own one-time BLOCH_DESTINATION_COST
// qumatessence unlock (registry/save `blochUnlockedWorlds`, a list of
// world numbers already paid for), not a single flat unlock for the whole
// hub: traveling to a world for the first time costs qumatessence and
// records that world as unlocked in the same click, every later trip to
// that same world is free. A destination not yet unlocked shows its cost
// in the row label and dims if unaffordable (like every other guardian's
// buy row), the same "check tokens, deduct, persist" flow those rows use --
// there's no separate "unlock, then travel later" step since clicking a
// destination is itself the only thing there is to do with it. Superposition
// Mode bypasses this per-destination cost entirely (`isSuperpositionMode()`,
// not the persisted list) -- that mode pre-seeds every built world as
// visited and relies on Bloch's hub being the *sole* way to move between
// worlds (there is no separate warp panel), so a fresh Superposition save
// with no qumatessence must still be able to teleport anywhere immediately.
// Content laid out top-down first (running `y`), panel sized/inserted
// behind everything afterward -- same pattern as showSettingsPanel.
export function showBlochHub(scene: OverworldScene) {
  scene.dialogueActive = true;

  const destinations = scene.getVisitedWorlds().filter((w) => BUILT_WORLDS.includes(w) && w !== scene.world);
  const superposition = scene.isSuperpositionMode();
  const unlockedWorlds = (scene.game.registry.get('blochUnlockedWorlds') as number[]) ?? [];
  const isUnlocked = (world: number) => superposition || unlockedWorlds.includes(world);

  const panelWidth = 600;
  const top = 20;
  const container = scene.add.container(0, 0).setDepth(100);
  scene.dialogueContainer = container;

  let y = top;

  const avatarY = y + 55;
  const avatar = makeBlochAvatar(scene);
  avatar.setPosition(CANVAS_W / 2, avatarY);
  container.add(avatar);
  scene.tweens.add({ targets: avatar, y: avatarY + 8, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  y = avatarY + 65;
  playGuardianChime();

  const intro = scene.add
    .text(
      CANVAS_W / 2,
      y,
      '"I am Bloch. Every crystal is a superposition of the worlds it has touched -- name one you have visited, and I will fold you there."',
      {
        fontSize: fontPx(scene, 12),
        fontStyle: 'italic',
        color: '#cfd8ff',
        align: 'center',
        wordWrap: { width: panelWidth - 80 },
      }
    )
    .setOrigin(0.5, 0);
  container.add(intro);
  y += intro.height + 14;

  if (destinations.length === 0) {
    const text = scene.add
      .text(CANVAS_W / 2, y, "You haven't mapped anywhere else yet.", { fontSize: fontPx(scene, 13), color: '#ffffff' })
      .setOrigin(0.5, 0);
    container.add(text);
    y += text.height;
  } else {
    const tokens = (scene.game.registry.get('qumatessence') as number) || 0;
    const items = destinations.map((w) => ({ world: w, name: WORLD_NAMES[w] ?? `World ${w}` }));
    y = scene.renderPagedButtons(
      container,
      y,
      items,
      scene.blochPage,
      4,
      (d) =>
        isUnlocked(d.world)
          ? `Travel to World ${d.world} -- ${d.name}`
          : `Travel to World ${d.world} -- ${d.name} (${BLOCH_DESTINATION_COST} qumatessence)`,
      (d) => {
        if (isUnlocked(d.world)) {
          scene.advanceToWorld(d.world);
          return;
        }
        if ((scene.game.registry.get('qumatessence') as number) < BLOCH_DESTINATION_COST) return;
        scene.qumatessence -= BLOCH_DESTINATION_COST;
        scene.game.registry.set('qumatessence', scene.qumatessence);
        scene.tokenText.setText(`Qumatessence: ${scene.qumatessence}`);
        scene.game.registry.set('blochUnlockedWorlds', [...unlockedWorlds, d.world]);
        persistFromRegistry(scene.game.registry);
        scene.advanceToWorld(d.world);
      },
      (page) => {
        scene.blochPage = page;
        scene.dialogueContainer?.destroy(true);
        showBlochHub(scene);
      },
      (d) => !isUnlocked(d.world) && tokens < BLOCH_DESTINATION_COST
    );
  }
  y += 8;

  y = scene.renderFarewellFooter(container, y);
  y += 12;

  const panelHeight = y - top;
  const panel = scene.add
    .rectangle(CANVAS_W / 2, top + panelHeight / 2, panelWidth, panelHeight, 0x10101c, 0.94)
    .setStrokeStyle(2, 0x4adde0);
  container.addAt(panel, 0);
}
