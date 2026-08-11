import Phaser from 'phaser';

// A doorway/cave-mouth landmark marking a walkable connection to an
// adjacent world (OverworldScene.spawnDoorSprites) -- stands at every built
// world's startTile (leading back to World N-1, or the Hub for World 1) and,
// once that world's rival is defeated, at its goalTile too (leading onward
// to World N+1, replacing the boss avatar that stood there while the rival
// was still undefeated). Purely a visual landmark, same as a guardian or
// boss avatar -- the actual world switch only happens through the confirm
// panel a walk onto the door tile opens (OverworldScene.showStartDoorPanel/
// showGatePanel), not a click handler on the sprite itself.
export function makeDoorSprite(scene: Phaser.Scene, size: number): Phaser.GameObjects.Container {
  const container = scene.add.container(0, 0);

  // A soft, wide additive glow behind everything else -- the same "big
  // faint aura" trick art/boss.ts's makeBossCrystal uses so a landmark
  // still reads as a colored beacon once it's shrunk small by distance,
  // rather than disappearing into the ground/wall colors around it.
  const halo = scene.add.graphics();
  halo.setBlendMode(Phaser.BlendModes.ADD);
  halo.fillStyle(0xd9a5ff, 0.2);
  halo.fillCircle(0, -size * 0.3, size * 1.05);
  container.add(halo);
  scene.tweens.add({
    targets: halo,
    scaleX: { from: 0.85, to: 1.15 },
    scaleY: { from: 0.85, to: 1.15 },
    alpha: { from: 0.55, to: 1 },
    duration: 1700,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });

  // Stone archway frame -- two pillars under a lightly rounded lintel,
  // kept genuinely rectangular (a small corner radius, not a radius close
  // to the shape's own half-width) so the silhouette reads as a doorway
  // rather than collapsing into a pill/gem outline at a distance.
  const frame = scene.add.graphics();
  frame.fillStyle(0x453f5e, 1);
  frame.fillRoundedRect(-size * 0.55, -size * 1.05, size * 1.1, size * 1.35, size * 0.2);
  frame.lineStyle(Math.max(2, size * 0.05), 0x7367a3, 1);
  frame.strokeRoundedRect(-size * 0.55, -size * 1.05, size * 1.1, size * 1.35, size * 0.2);
  container.add(frame);

  // The opening itself -- a darker inset void so the frame reads as a
  // structure you'd walk into, not a solid decorated block.
  const opening = scene.add.graphics();
  opening.fillStyle(0x0d0b16, 1);
  opening.fillRoundedRect(-size * 0.38, -size * 0.85, size * 0.76, size * 1.25, size * 0.14);
  container.add(opening);

  // Glowing portal filling the opening, additive-blended so it reads as an
  // actual light source rather than a flat colored shape -- lavender to
  // match showStoryBeat's own between-worlds panel stroke (0xd9a5ff), the
  // same "connective tissue between worlds" color already established there.
  const portal = scene.add.graphics();
  portal.setBlendMode(Phaser.BlendModes.ADD);
  portal.fillStyle(0xd9a5ff, 0.6);
  portal.fillEllipse(0, -size * 0.24, size * 0.52, size * 0.82);
  portal.fillStyle(0xffffff, 0.4);
  portal.fillEllipse(0, -size * 0.24, size * 0.26, size * 0.44);
  container.add(portal);
  scene.tweens.add({
    targets: portal,
    alpha: { from: 0.6, to: 1 },
    duration: 1400,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });

  // A few drifting motes inside the portal -- the same "something is
  // actively happening here" cue every guardian avatar's orbiting motes use.
  const motes = scene.add.container(0, -size * 0.24);
  for (let i = 0; i < 4; i++) {
    const ang = (i * Math.PI * 2) / 4;
    const mote = scene.add.circle(Math.cos(ang) * size * 0.16, Math.sin(ang) * size * 0.26, size * 0.045, 0xffffff, 0.9);
    mote.setBlendMode(Phaser.BlendModes.ADD);
    motes.add(mote);
  }
  container.add(motes);
  scene.tweens.add({ targets: motes, angle: 360, duration: 5000, repeat: -1, ease: 'Linear' });

  return container;
}
