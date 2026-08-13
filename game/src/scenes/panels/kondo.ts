import type Phaser from 'phaser';
import type { GuardianPanelHost } from '../OverworldScene';
import { makeKondoAvatar } from '../../art/kondo';
import { playGuardianChime } from '../../audio/sfx';
import { CANVAS_W } from '../../art/perspective';
import { fontPx, fontScale } from '../../ui/text';
import { PANEL_BG, REFERENCE_BLUE_GREY_HEX } from '../../ui/theme';
import { MOVES, KONDO_MOVE_IDS, shopCost, moveDisplayName } from '../../data/materials';
import { persistFromRegistry } from '../../data/save';

// Kondo stands at world 8's middle tile (WORLD_GUARDIANS) and sells three
// self-buff moves (data/materials.ts's KONDO_MOVE_IDS -- Screening
// Pulse/Scattering Drag/Coherence Cascade, kept out of Noether's and
// Laughlin's own lists so Kondo is their one source), usable from any
// crystal form the player is currently wearing since a self-buff isn't
// gated by MOVE_COMPATIBILITY at all. Mirrors showLaughlinPanel's
// Analytic-shop layout, but with a 3-entry list where each bought move
// gets its own "buy" or "switch active" row instead of Laughlin's flat
// buy-only list -- see renderKondoMoves below for why: only one of the
// three can ever be usable in battle at a time (registry/save
// `kondoActiveMove`), so this panel is also the only place that switches
// it, not just the one that sells them.
export function showKondoPanel(scene: GuardianPanelHost) {
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
      '"I am Kondo. Any crystal can turn its own disorder to its advantage -- screen itself, scatter its own signature, cascade its own coherence back together. Learn a technique, then tell me which one to hold. Only one at a time."',
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
    .rectangle(CANVAS_W / 2, top + panelHeight / 2, panelWidth, panelHeight, PANEL_BG, 0.94)
    .setStrokeStyle(2, 0xe86a44);
  container.addAt(panel, 0);
}

// Two sections, not Laughlin's flat buy-only list: still-unbought Kondo
// moves (same shopCost/afford/dim treatment as every other shop, usable
// from any form since a self-buff isn't gated by MOVE_COMPATIBILITY at
// all) followed by every already-bought Kondo move with a "make active"/
// dimmed-"(active)" row -- same dimmed-current convention Dresselhaus/
// Majorana's "(current form)"/"(current form) again" rows already use.
// Every row, bought or not, prints the move's own one-line `description`
// underneath (data/materials.ts's `Move.description`, only ever set for
// Kondo's three) -- same "otherwise only ever explained during the single
// visit that bought it" reasoning panels/passiveList.ts's renderPassiveList
// already gives for doing this, and the same reason this panel's buy/switch
// buttons are capped at a lower font-scale ceiling than every other
// guardian panel's (`buttonScale`/`buttonPx` below, mirroring
// `renderPassiveList`'s own `buttonScale`/`buttonPx`) rather than the
// uncapped `addDialogueButton` convenience wrapper -- three rows each
// carrying their own description line, on top of the avatar/intro/Farewell
// footer every guardian panel already has, pushed the Farewell button off
// the bottom of the canvas at the largest text-size preset the first time
// this was tried uncapped, verified via a live headless-Chromium run at
// every `fontScale` preset. Buying the very first Kondo move
// auto-activates it (see the buy handler below) so a purchase is never
// immediately invisible in battle; buying a second or third on top of an
// already-active one does not -- switching between two-or-more
// already-bought moves is always its own explicit "Make active" click.
// forSale/learned always partition all three KONDO_MOVE_IDS between them,
// so there's no empty state to render here.
function renderKondoMoves(scene: GuardianPanelHost, container: Phaser.GameObjects.Container, y: number): number {
  const unlocked = scene.getUnlockedMoves();
  const forSale = KONDO_MOVE_IDS.filter((id) => !unlocked.includes(id));
  const learned = KONDO_MOVE_IDS.filter((id) => unlocked.includes(id));
  const tokens = (scene.game.registry.get('qumatessence') as number) || 0;
  const activeMove = (scene.game.registry.get('kondoActiveMove') as string | null) ?? null;
  const buttonScale = Math.min(fontScale(scene), 1.3);
  const buttonPx = `${Math.round(12 * buttonScale)}px`;
  const descScale = Math.min(fontScale(scene), 1.2);
  const descPx = `${Math.round(9 * descScale)}px`;

  const addDescription = (id: string) => {
    const desc = scene.add
      .text(CANVAS_W / 2, y, MOVES[id].description ?? '', {
        fontSize: descPx,
        color: REFERENCE_BLUE_GREY_HEX,
        align: 'center',
        wordWrap: { width: 480 },
      })
      .setOrigin(0.5, 0);
    container.add(desc);
    y += desc.height + 4;
  };

  forSale.forEach((id) => {
    const move = MOVES[id];
    const cost = shopCost(move);
    const affordable = tokens >= cost;
    const btn = scene.addDialogueButtonAt(
      container,
      CANVAS_W / 2,
      y,
      `${move.name} -- ${cost} qumatessence`,
      () => {
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
      },
      480,
      buttonPx
    );
    if (!affordable) btn.setAlpha(0.5);
    y += btn.height + 2;
    addDescription(id);
  });

  if (learned.length > 0) {
    if (forSale.length > 0) y += 6;
    learned.forEach((id) => {
      const name = moveDisplayName(scene.game.registry, id);
      const isActive = id === activeMove;
      const label = isActive ? `${name} (active)` : `Make ${name} active`;
      const btn = scene.addDialogueButtonAt(
        container,
        CANVAS_W / 2,
        y,
        label,
        () => {
          if (isActive) return;
          scene.game.registry.set('kondoActiveMove', id);
          persistFromRegistry(scene.game.registry);
          scene.dialogueContainer?.destroy(true);
          showKondoPanel(scene);
        },
        480,
        buttonPx
      );
      if (isActive) btn.setAlpha(0.5);
      y += btn.height + 2;
      addDescription(id);
    });
  }

  return y;
}
