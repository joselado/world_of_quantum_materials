import Phaser from 'phaser';
import { TitleScene } from './scenes/TitleScene';
import { HubScene } from './scenes/HubScene';
import { OverworldScene, BUILT_WORLDS } from './scenes/OverworldScene';
import { BattleScene } from './scenes/BattleScene';
import { checkDataIntegrity } from './data/integrity';

// Dev-only: catches a renamed/removed move id or a built world missing its
// biome before the game even boots, rather than a specific save/player
// hitting it at runtime later (see data/integrity.ts).
if (import.meta.env.DEV) {
  checkDataIntegrity(BUILT_WORLDS);
}

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 640,
  height: 480,
  parent: 'game',
  backgroundColor: '#111111',
  scene: [TitleScene, HubScene, OverworldScene, BattleScene],
};

const game = new Phaser.Game(config);

// Dev-only: lets a headless script drive scenes directly (open a specific
// panel, read back its layout) without hand-scripting clicks through the
// UI to reach it -- see DEVELOPMENT.md's "Verifying UI changes".
if (import.meta.env.DEV) {
  (window as unknown as { __game: Phaser.Game }).__game = game;
}
