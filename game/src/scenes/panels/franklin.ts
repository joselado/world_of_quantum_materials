import type { GuardianPanelHost } from '../OverworldScene';
import { makeFranklinAvatar } from '../../art/franklin';
import { playGuardianChime } from '../../audio/sfx';
import { CANVAS_W } from '../../art/perspective';
import { fontPx } from '../../ui/text';
import { FRANKLIN_PASSIVE_IDS } from '../../data/passives';
import { renderPassiveList } from './passiveList';

// Franklin stands at world 9's middle tile (WORLD_GUARDIANS) and sells
// three passive abilities (data/passives.ts's FRANKLIN_PASSIVE_IDS --
// Diffraction Shadow, Satellite Reflection, Amorphous Halo) instead of
// moves: a whole-battle always-on modifier picked once by visiting Franklin,
// not something chosen from the move menu each turn. Uses the shared
// renderPassiveList below -- see that function's own comment for why it
// mirrors showKondoPanel's shape rather than a flat buy-only list.
export function showFranklinPanel(scene: GuardianPanelHost) {
  scene.dialogueActive = true;

  const panelWidth = 600;
  const top = 20;
  const container = scene.add.container(0, 0).setDepth(100);
  scene.dialogueContainer = container;

  let y = top;

  const avatarY = y + 42;
  const avatar = makeFranklinAvatar(scene);
  avatar.setPosition(CANVAS_W / 2, avatarY);
  container.add(avatar);
  scene.tweens.add({ targets: avatar, y: avatarY + 8, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  playGuardianChime();
  y = avatarY + 48;

  const intro = scene.add
    .text(
      CANVAS_W / 2,
      y,
      '"Fire X-rays through a defect-riddled crystal and the sharp spots blur into rings -- every pore and dislocation leaves its signature in how the beam scatters. I can teach your crystal to scatter a blow the same way -- only one lesson holds at a time."',
      { fontSize: fontPx(scene, 11), fontStyle: 'italic', color: '#cfd8ff', align: 'center', wordWrap: { width: panelWidth - 80 } }
    )
    .setOrigin(0.5, 0);
  container.add(intro);
  y += intro.height + 14;

  y = renderPassiveList(scene, container, y, FRANKLIN_PASSIVE_IDS, 'franklin', () => showFranklinPanel(scene));
  y += 8;
  y = scene.renderFarewellFooter(container, y);
  y += 8;

  const panelHeight = y - top;
  const panel = scene.add
    .rectangle(CANVAS_W / 2, top + panelHeight / 2, panelWidth, panelHeight, 0x10101c, 0.94)
    .setStrokeStyle(2, 0xa878c9);
  container.addAt(panel, 0);
}
