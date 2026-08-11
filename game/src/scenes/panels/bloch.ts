import type { OverworldScene } from '../OverworldScene';
import { BUILT_WORLDS } from '../OverworldScene';
import { makeBlochAvatar } from '../../art/bloch';
import { playGuardianChime } from '../../audio/sfx';
import { CANVAS_W } from '../../art/perspective';
import { fontPx } from '../../ui/text';
import { WORLD_NAMES } from '../../data/materials';

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
// Content laid out top-down first (running `y`), panel sized/inserted
// behind everything afterward -- same pattern as showSettingsPanel.
export function showBlochHub(scene: OverworldScene) {
  scene.dialogueActive = true;

  const destinations = scene.getVisitedWorlds().filter((w) => BUILT_WORLDS.includes(w) && w !== scene.world);

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
    const items = destinations.map((w) => ({ world: w, name: WORLD_NAMES[w] ?? `World ${w}` }));
    y = scene.renderPagedButtons(
      container,
      y,
      items,
      scene.blochPage,
      4,
      (d) => `Travel to World ${d.world} -- ${d.name}`,
      (d) => scene.advanceToWorld(d.world),
      (page) => {
        scene.blochPage = page;
        scene.dialogueContainer?.destroy(true);
        showBlochHub(scene);
      }
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
