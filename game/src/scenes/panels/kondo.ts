import type Phaser from 'phaser';
import type { OverworldScene } from '../OverworldScene';
import { makeKondoAvatar } from '../../art/kondo';
import { playGuardianChime } from '../../audio/sfx';
import { CANVAS_W } from '../../art/perspective';
import { fontPx } from '../../ui/text';
import { MOVES, KONDO_MOVE_IDS, shopCost } from '../../data/materials';
import { persistFromRegistry } from '../../data/save';

// Kondo stands at world 8's middle tile (WORLD_GUARDIANS) and sells the
// three screening-class moves (data/materials.ts's KONDO_MOVE_IDS --
// Screening Pulse/Scattering Drag/Breakdown Cascade, kept out of
// Noether's and Laughlin's own lists so Kondo is their one source), usable
// from any crystal form the player is currently wearing. Mirrors
// showLaughlinPanel's Analytic-shop layout, but with a 3-entry list where each bought move
// gets its own "buy" or "switch active" row instead of Laughlin's flat
// buy-only list -- see renderKondoMoves below for why: only one of the
// three can ever be usable in battle at a time (registry/save
// `kondoActiveMove`), so this panel is also the only place that switches
// it, not just the one that sells them.
export function showKondoPanel(scene: OverworldScene) {
  scene.dialogueActive = true;

  const panelWidth = 600;
  const top = 20;
  const container = scene.add.container(0, 0).setDepth(100);
  scene.dialogueContainer = container;

  let y = top;

  const avatarY = y + 42;
  const avatar = makeKondoAvatar(scene);
  avatar.setPosition(CANVAS_W / 2, avatarY);
  container.add(avatar);
  scene.tweens.add({ targets: avatar, y: avatarY + 8, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  playGuardianChime();
  y = avatarY + 48;

  const intro = scene.add
    .text(
      CANVAS_W / 2,
      y,
      '"I am Kondo. Any crystal has disorder and decoherence to exploit -- screening, scattering, collapse. Learn a channel, then tell me which one to tune. Only one can be tuned at a time; come back if you want a different one."',
      { fontSize: fontPx(scene, 11), fontStyle: 'italic', color: '#cfd8ff', align: 'center', wordWrap: { width: panelWidth - 80 } }
    )
    .setOrigin(0.5, 0);
  container.add(intro);
  y += intro.height + 14;

  y = renderKondoMoves(scene, container, y);
  y += 8;
  y = scene.renderFarewellFooter(container, y);
  y += 8;

  const panelHeight = y - top;
  const panel = scene.add
    .rectangle(CANVAS_W / 2, top + panelHeight / 2, panelWidth, panelHeight, 0x10101c, 0.94)
    .setStrokeStyle(2, 0xe86a44);
  container.addAt(panel, 0);
}

// Two sections, not Laughlin's flat buy-only list: still-unbought Kondo
// moves (same shopCost/afford/dim treatment as every other shop, usable
// from any form since MOVE_COMPATIBILITY grants 'screening' to every
// type) followed by every already-bought Kondo move with a "make active"/
// dimmed-"(active)" row -- same dimmed-current convention Dresselhaus/
// Majorana's "(current form)"/"(current form) again" rows already use.
// Buying the very first Kondo move auto-activates it (see the buy handler
// below) so a purchase is never immediately invisible in battle; buying a
// second or third on top of an already-active one does not -- switching
// between two-or-more already-bought moves is always its own explicit
// "Make active" click. forSale/learned always partition all three
// KONDO_MOVE_IDS between them, so there's no empty state to render here.
function renderKondoMoves(scene: OverworldScene, container: Phaser.GameObjects.Container, y: number): number {
  const unlocked = scene.getUnlockedMoves();
  const forSale = KONDO_MOVE_IDS.filter((id) => !unlocked.includes(id));
  const learned = KONDO_MOVE_IDS.filter((id) => unlocked.includes(id));
  const tokens = (scene.game.registry.get('qumatessence') as number) || 0;
  const activeMove = (scene.game.registry.get('kondoActiveMove') as string | null) ?? null;

  forSale.forEach((id) => {
    const move = MOVES[id];
    const cost = shopCost(move);
    const affordable = tokens >= cost;
    const btn = scene.addDialogueButton(container, y, `${move.name} -- ${cost} qumatessence`, () => {
      if ((scene.game.registry.get('qumatessence') as number) < cost) return;
      scene.qumatessence -= cost;
      scene.game.registry.set('qumatessence', scene.qumatessence);
      scene.tokenText.setText(`Qumatessence: ${scene.qumatessence}`);
      scene.game.registry.set('unlockedMoves', [...scene.getUnlockedMoves(), id]);
      // The very first Kondo move bought becomes active automatically --
      // "picked for the first time" happens right here, in this same
      // conversation with Kondo, so there's no dead-purchase state where a
      // freshly bought move shows up nowhere in battle. Switching between
      // two-or-more already-bought moves still always requires its own
      // explicit "Make active" click below.
      if (!scene.game.registry.get('kondoActiveMove')) {
        scene.game.registry.set('kondoActiveMove', id);
      }
      persistFromRegistry(scene.game.registry);
      scene.dialogueContainer?.destroy(true);
      showKondoPanel(scene);
    });
    if (!affordable) btn.setAlpha(0.5);
    y += btn.height + 3;
  });

  if (learned.length > 0) {
    if (forSale.length > 0) y += 6;
    learned.forEach((id) => {
      const move = MOVES[id];
      const isActive = id === activeMove;
      const label = isActive ? `${move.name} (active)` : `Make ${move.name} active`;
      const btn = scene.addDialogueButton(container, y, label, () => {
        if (isActive) return;
        scene.game.registry.set('kondoActiveMove', id);
        persistFromRegistry(scene.game.registry);
        scene.dialogueContainer?.destroy(true);
        showKondoPanel(scene);
      });
      if (isActive) btn.setAlpha(0.5);
      y += btn.height + 3;
    });
  }

  return y;
}
