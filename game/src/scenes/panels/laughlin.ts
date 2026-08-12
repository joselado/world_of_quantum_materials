import type { GuardianPanelHost } from '../OverworldScene';
import { makeLaughlinAvatar } from '../../art/laughlin';
import { playGuardianChime } from '../../audio/sfx';
import { CANVAS_W } from '../../art/perspective';
import { fontPx } from '../../ui/text';
import { ANALYTIC_MOVE_IDS } from '../../data/materials';
import { renderTunableMoveShop } from './tunableMoveShop';

// Laughlin stands at world 4's middle tile (WORLD_GUARDIANS) and sells his
// two quiz-gated Analytic moves (data/materials.ts's ANALYTIC_MOVE_IDS, a
// beam move and an eruption move, each displayed as "<quasiparticle> Beam"/
// "<quasiparticle> Eruption" via tunedMoveDisplayName) -- kept out of
// Noether's own shop (SHOP_MOVE_IDS excludes them, see materials.ts's
// comment) so Laughlin is their one source. Mirrors showNoetherShop's
// layout/structure, minus the Moves/Stats tabs since he only ever has one
// thing to sell. Buying (or later revisiting) a move also opens a
// quasiparticle picker to assign it a class -- see renderTunableMoveShop.
export function showLaughlinPanel(scene: GuardianPanelHost) {
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
      '"An excited fractional quantum Hall state answers a blow with only a fraction of its force -- but tell me the physics right and I\'ll teach your crystal to strike by it instead. Answer right and the hit lands twice as hard, answer wrong and it barely lands at all. Tell me which quasiparticle to carry it with, too."',
      { fontSize: fontPx(scene, 11), fontStyle: 'italic', color: '#cfd8ff', align: 'center', wordWrap: { width: panelWidth - 80 } }
    )
    .setOrigin(0.5, 0);
  container.add(intro);
  y += intro.height + 14;

  y = renderTunableMoveShop(scene, container, y, ANALYTIC_MOVE_IDS, () => showLaughlinPanel(scene));
  y += 8;
  y = scene.renderFarewellFooter(container, y);
  y += 8;

  const panelHeight = y - top;
  const panel = scene.add
    .rectangle(CANVAS_W / 2, top + panelHeight / 2, panelWidth, panelHeight, 0x10101c, 0.94)
    .setStrokeStyle(2, 0x6a7fff);
  container.addAt(panel, 0);
}
