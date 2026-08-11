import type { OverworldScene } from '../OverworldScene';
import { makeBohrAvatar } from '../../art/bohr';
import { playGuardianChime } from '../../audio/sfx';
import { CANVAS_W } from '../../art/perspective';
import { fontPx } from '../../ui/text';
import { BOHR_PASSIVE_IDS } from '../../data/passives';
import { renderPassiveList } from './passiveList';

// Bohr stands at world 7's middle tile (WORLD_GUARDIANS) and sells three
// passive abilities (data/passives.ts's BOHR_PASSIVE_IDS -- Correlated
// Response, Nonlocal Correlation, Shared State), same shape as
// showLaughlinPanel above -- see renderPassiveList's own comment.
export function showBohrPanel(scene: OverworldScene) {
  scene.dialogueActive = true;

  const panelWidth = 600;
  const top = 20;
  const container = scene.add.container(0, 0).setDepth(100);
  scene.dialogueContainer = container;

  let y = top;

  const avatarY = y + 42;
  const avatar = makeBohrAvatar(scene);
  avatar.setPosition(CANVAS_W / 2, avatarY);
  container.add(avatar);
  scene.tweens.add({ targets: avatar, y: avatarY + 8, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  playGuardianChime();
  y = avatarY + 48;

  const intro = scene.add
    .text(
      CANVAS_W / 2,
      y,
      '"Measure one half of an entangled pair and the other answers instantly. I can teach your crystal to answer that way too -- only one bond holds at a time."',
      { fontSize: fontPx(scene, 11), fontStyle: 'italic', color: '#cfd8ff', align: 'center', wordWrap: { width: panelWidth - 80 } }
    )
    .setOrigin(0.5, 0);
  container.add(intro);
  y += intro.height + 14;

  y = renderPassiveList(scene, container, y, BOHR_PASSIVE_IDS, 'bohrPassivesUnlocked', 'bohrActivePassive', () =>
    showBohrPanel(scene)
  );
  y += 8;
  y = scene.renderFarewellFooter(container, y);
  y += 8;

  const panelHeight = y - top;
  const panel = scene.add
    .rectangle(CANVAS_W / 2, top + panelHeight / 2, panelWidth, panelHeight, 0x10101c, 0.94)
    .setStrokeStyle(2, 0xffa64a);
  container.addAt(panel, 0);
}
