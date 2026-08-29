import Phaser from 'phaser';

// The one place the browser's Fullscreen API is reached from, so the Lab's
// Settings station (scenes/panels/hubStations.ts's showSettingsPanel) and the
// F key are the same action reading the same state, rather than two paths
// that can disagree about whether the game is filling the screen.
//
// Unlike every other Settings row, this one deliberately gets no
// `SaveData`/`defaultSave`/`persistFromRegistry` entry. A browser grants
// fullscreen only from inside a user gesture, so a persisted "was fullscreen"
// flag could not be honoured at boot: the game would come back windowed with a
// setting claiming otherwise, which is worse than a switch the player flips
// again. Phaser's own scale manager holds the state and every reader asks it.

export function fullscreenAvailable(scene: Phaser.Scene): boolean {
  return scene.scale.fullscreen.available;
}

export function isFullscreen(scene: Phaser.Scene): boolean {
  return scene.scale.isFullscreen;
}

// Both entry points come through here. Phaser handles a DOM input event in the
// native handler rather than queueing it to the next frame, so a keypress or a
// click on a Settings chip still carries the user gesture the API requires.
//
// The request resolves a tick later, on the browser's own
// ENTER_FULLSCREEN/LEAVE_FULLSCREEN event -- `isFullscreen()` read immediately
// after this call still reports the old state, so anything that draws the
// current state listens for those events instead of assuming the toggle took.
export function toggleFullscreen(scene: Phaser.Scene) {
  if (!fullscreenAvailable(scene)) return;
  scene.scale.toggleFullscreen();
}

// Installed per scene rather than once on the document: KeyboardPlugin is
// scene-scoped, so a scene shutting down takes its own binding with it and
// nothing needs tearing down by hand. Every scene the player can be looking at
// installs it, so F works from wherever they are.
export function installFullscreenKey(scene: Phaser.Scene) {
  scene.input.keyboard?.on('keydown-F', () => toggleFullscreen(scene));
}
