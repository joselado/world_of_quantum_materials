import Phaser from 'phaser';
import { TitleScene } from './scenes/TitleScene';
import { HubScene } from './scenes/HubScene';
import { OverworldScene, BUILT_WORLDS } from './scenes/OverworldScene';
import { BattleScene } from './scenes/BattleScene';
import { checkDataIntegrity } from './data/integrity';
import { CANVAS_W, CANVAS_H } from './config/screen';
import { installCanvasRenderer } from './art/canvasRenderer';

// Dev-only: catches a renamed/removed move id or a built world missing its
// biome before the game even boots, rather than a specific save/player
// hitting it at runtime later (see data/integrity.ts).
if (import.meta.env.DEV) {
  checkDataIntegrity(BUILT_WORLDS);
}

// Before the game exists, so a browser without WebGL gets a Canvas renderer
// that draws gradients and tints as the WebGL one does (art/canvasRenderer.ts).
installCanvasRenderer();

// Which renderer draws the game. WebGL on a real GPU is the cheapest by far;
// but WebGL offered by a software rasterizer (a machine with no usable GPU)
// emulates a GPU on the CPU and runs the overworld at a third of the frame
// rate the browser's own 2D canvas manages on the same CPU, at several times
// the cost. So a software WebGL is passed over for the Canvas renderer, and
// anything else is left to Phaser.AUTO. `?renderer=webgl` or `?renderer=canvas`
// in the URL picks one outright -- the check scripts under scripts/ pin WebGL
// with it, since headless Chrome's WebGL is itself a software one.
function chooseRenderer(): number {
  const asked = new URLSearchParams(window.location.search).get('renderer');
  if (asked === 'webgl') return Phaser.WEBGL;
  if (asked === 'canvas') return Phaser.CANVAS;
  return softwareWebGL() ? Phaser.CANVAS : Phaser.AUTO;
}

function softwareWebGL(): boolean {
  const gl = document.createElement('canvas').getContext('webgl');
  if (!gl) return false;
  const info = gl.getExtension('WEBGL_debug_renderer_info');
  const name = String(info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
  gl.getExtension('WEBGL_lose_context')?.loseContext();
  return /swiftshader|llvmpipe|softpipe|software|basic render/i.test(name);
}

const config: Phaser.Types.Core.GameConfig = {
  type: chooseRenderer(),
  width: CANVAS_W,
  height: CANVAS_H,
  parent: 'game',
  backgroundColor: '#111111',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  // Two fingers at once: the overworld's walking arrows are held down
  // (scenes/overworld/touchControls.ts) while the other hand taps a prompt or
  // the Lab hint, and Phaser tracks only one touch pointer unless asked for
  // more.
  input: { activePointers: 3 },
  scene: [TitleScene, HubScene, OverworldScene, BattleScene],
};

const game = new Phaser.Game(config);

// Dev-only: lets a headless script drive scenes directly (open a specific
// panel, read back its layout) without hand-scripting clicks through the
// UI to reach it -- see DEVELOPMENT.md's "Verifying UI changes".
if (import.meta.env.DEV) {
  (window as unknown as { __game: Phaser.Game }).__game = game;
}
