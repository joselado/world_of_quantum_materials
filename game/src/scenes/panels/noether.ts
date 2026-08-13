import type Phaser from 'phaser';
import type { GuardianPanelHost } from '../OverworldScene';
import { makeNoetherAvatar } from '../../art/noether';
import { playGuardianChime } from '../../audio/sfx';
import { CANVAS_W } from '../../art/perspective';
import { fontPx } from '../../ui/text';
import { PANEL_BG, GOLD_ACCENT, GOLD_ACCENT_HEX, REFERENCE_BLUE_GREY_HEX } from '../../ui/theme';
import { MOVES, SHOP_MOVE_IDS, compatibleMoves, shopCost, getPlayerStats, statUpgradeCost } from '../../data/materials';
import { persistFromRegistry } from '../../data/save';
import type { Stats } from '../../data/types';

// Noether appears once the player reaches world 1's middle tile, selling
// the other early moves and stat upgrades for qumatessence, in two tabs of
// the same panel. Same in-map dialogue pattern as a wild encounter, but
// with a guardian avatar and a shop list instead of a fight.
// Content laid out top-down first (running `y`, each element's own
// height advancing it), panel sized/inserted behind everything
// afterward -- same pattern as showSettingsPanel. The intro quote used
// to sit at a fixed offset from the avatar that assumed a short 1-line
// render; at a bigger text-size setting it wraps to 3-4 lines and would
// otherwise run straight into the tabs/rows below it.
export function showNoetherShop(scene: GuardianPanelHost) {
  scene.dialogueActive = true;

  const panelWidth = 600;
  const top = 20;
  const container = scene.add.container(0, 0).setDepth(100);
  scene.dialogueContainer = container;

  let y = top;

  const avatarY = y + 42;
  const avatar = makeNoetherAvatar(scene);
  avatar.setPosition(CANVAS_W / 2, avatarY);
  container.add(avatar);
  scene.tweens.add({ targets: avatar, y: avatarY + 8, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  playGuardianChime();
  y = avatarY + 48;

  const intro = scene.add
    .text(
      CANVAS_W / 2,
      y,
      '"I am Noether. Every symmetry hides a conservation law -- spend your qumatessence on a new attack, or a sharper stat."',
      { fontSize: fontPx(scene, 11), fontStyle: 'italic', color: '#cfd8ff', align: 'center', wordWrap: { width: panelWidth - 80 } }
    )
    .setOrigin(0.5, 0);
  container.add(intro);
  y += intro.height + 10;

  y = renderShopTabs(scene, container, y);
  y += 6;

  y = scene.shopTab === 'moves' ? renderShopMoves(scene, container, y) : renderShopStats(scene, container, y);
  y += 8;
  y = scene.renderFarewellFooter(container, y);
  y += 8;

  const panelHeight = y - top;
  const panel = scene.add
    .rectangle(CANVAS_W / 2, top + panelHeight / 2, panelWidth, panelHeight, PANEL_BG, 0.94)
    .setStrokeStyle(2, GOLD_ACCENT);
  container.addAt(panel, 0);
}

function renderShopTabs(scene: GuardianPanelHost, container: Phaser.GameObjects.Container, y: number): number {
  let maxHeight = 0;
  (['moves', 'stats'] as const).forEach((tab, i) => {
    const active = scene.shopTab === tab;
    const btn = scene.add
      .text(CANVAS_W / 2 + (i === 0 ? -45 : 45), y, tab === 'moves' ? 'Moves' : 'Stats', {
        fontSize: fontPx(scene, 11),
        color: active ? GOLD_ACCENT_HEX : REFERENCE_BLUE_GREY_HEX,
        backgroundColor: active ? '#333355' : '#1a1a2e',
        padding: { x: 8, y: 3 },
      })
      .setOrigin(0.5, 0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        if (scene.shopTab === tab) return;
        scene.shopTab = tab;
        scene.dialogueContainer?.destroy(true);
        showNoetherShop(scene);
      });
    container.add(btn);
    maxHeight = Math.max(maxHeight, btn.height);
  });
  return y + maxHeight;
}

function renderShopMoves(scene: GuardianPanelHost, container: Phaser.GameObjects.Container, y: number): number {
  const unlocked = scene.getUnlockedMoves();
  const compatible = new Set(compatibleMoves(scene.playerMaterial));
  const forSale = SHOP_MOVE_IDS.filter((id) => !unlocked.includes(id) && compatible.has(id));
  const tokens = (scene.game.registry.get('qumatessence') as number) || 0;

  if (forSale.length === 0) {
    const text = scene.add
      .text(CANVAS_W / 2, y, "Nothing your current form can carry is left to teach.", {
        fontSize: fontPx(scene, 13),
        color: '#ffffff',
        align: 'center',
        wordWrap: { width: 480 },
      })
      .setOrigin(0.5, 0);
    container.add(text);
    return y + text.height;
  }

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
      persistFromRegistry(scene.game.registry);
      // Rebuild the whole panel so the purchased move disappears from
      // the list and the token total on display stays correct.
      scene.dialogueContainer?.destroy(true);
      showNoetherShop(scene);
    });
    if (!affordable) btn.setAlpha(0.5);
    y += btn.height + 3;
  });
  return y;
}

function renderShopStats(scene: GuardianPanelHost, container: Phaser.GameObjects.Container, y: number): number {
  const stats = getPlayerStats(scene.game.registry);
  const tokens = (scene.game.registry.get('qumatessence') as number) || 0;
  const rows: { key: keyof Stats; label: string }[] = [
    { key: 'quantumness', label: 'Quantumness (crit chance)' },
    { key: 'velocity', label: 'Velocity (turn order)' },
    { key: 'correlation', label: 'Correlation (defense)' },
  ];

  rows.forEach((row) => {
    const value = stats[row.key];
    const cost = statUpgradeCost(value);
    const affordable = tokens >= cost;
    const btn = scene.addDialogueButton(
      container,
      y,
      `${row.label}: ${value} -> ${value + 1} -- ${cost} qumatessence`,
      () => {
        const current = (scene.game.registry.get('qumatessence') as number) || 0;
        if (current < cost) return;
        const updated = { ...getPlayerStats(scene.game.registry), [row.key]: value + 1 };
        scene.qumatessence = current - cost;
        scene.game.registry.set('qumatessence', scene.qumatessence);
        scene.game.registry.set('playerStats', updated);
        scene.tokenText.setText(`Qumatessence: ${scene.qumatessence}`);
        persistFromRegistry(scene.game.registry);
        scene.dialogueContainer?.destroy(true);
        showNoetherShop(scene);
      }
    );
    if (!affordable) btn.setAlpha(0.5);
    y += btn.height + 3;
  });
  return y;
}
