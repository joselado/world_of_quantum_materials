import type { OverworldScene } from '../OverworldScene';
import { makeLaughlinAvatar } from '../../art/laughlin';
import { playGuardianChime } from '../../audio/sfx';
import { CANVAS_W } from '../../art/perspective';
import { fontPx } from '../../ui/text';
import { LAUGHLIN_PASSIVE_IDS } from '../../data/passives';
import { renderPassiveList } from './passiveList';

// Laughlin stands at world 4's middle tile (WORLD_GUARDIANS) and sells
// three passive abilities (data/passives.ts's LAUGHLIN_PASSIVE_IDS --
// Fractional Guard, Anyon Echo, Edge Current) instead of moves: a
// whole-battle always-on modifier picked once by visiting Laughlin, not
// something chosen from the move menu each turn. Shares renderPassiveList
// below with showBohrPanel -- see that method's own comment for why it
// mirrors showKondoPanel's shape rather than Curie's flat buy-only list.
export function showLaughlinPanel(scene: OverworldScene) {
  scene.dialogueActive = true;

  const panelWidth = 600;
  const top = 20;
  const container = scene.add.container(0, 0).setDepth(100);
  scene.dialogueContainer = container;

  let y = top;

  const avatarY = y + 42;
  const avatar = makeLaughlinAvatar(scene);
  avatar.setPosition(CANVAS_W / 2, avatarY);
  container.add(avatar);
  scene.tweens.add({ targets: avatar, y: avatarY + 8, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  playGuardianChime();
  y = avatarY + 48;

  const intro = scene.add
    .text(
      CANVAS_W / 2,
      y,
      '"An excited fractional quantum Hall state answers a blow with only a fraction of its force. I can teach your crystal the same trick -- only one lesson holds at a time."',
      { fontSize: fontPx(scene, 11), fontStyle: 'italic', color: '#cfd8ff', align: 'center', wordWrap: { width: panelWidth - 80 } }
    )
    .setOrigin(0.5, 0);
  container.add(intro);
  y += intro.height + 14;

  y = renderPassiveList(scene, container, y, LAUGHLIN_PASSIVE_IDS, 'laughlinPassivesUnlocked', 'laughlinActivePassive', () =>
    showLaughlinPanel(scene)
  );
  y += 8;
  y = scene.renderFarewellFooter(container, y);
  y += 8;

  const panelHeight = y - top;
  const panel = scene.add
    .rectangle(CANVAS_W / 2, top + panelHeight / 2, panelWidth, panelHeight, 0x10101c, 0.94)
    .setStrokeStyle(2, 0x6a7fff);
  container.addAt(panel, 0);
}
