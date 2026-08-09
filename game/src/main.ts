import Phaser from 'phaser';
import { TitleScene } from './scenes/TitleScene';
import { HubScene } from './scenes/HubScene';
import { OverworldScene } from './scenes/OverworldScene';
import { BattleScene } from './scenes/BattleScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 640,
  height: 480,
  parent: 'game',
  backgroundColor: '#111111',
  scene: [TitleScene, HubScene, OverworldScene, BattleScene],
};

new Phaser.Game(config);
