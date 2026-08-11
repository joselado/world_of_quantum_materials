import type Phaser from 'phaser';
import type { OverworldScene } from '../OverworldScene';
import { makeCurieAvatar } from '../../art/curie';
import { playGuardianChime } from '../../audio/sfx';
import { CANVAS_W } from '../../art/perspective';
import { fontPx } from '../../ui/text';
import {
  MOVES,
  ANALYTIC_MOVE_IDS,
  CURIE_TUNABLE_CLASSES,
  quasiparticleLabel,
  curieMoveDisplayName,
  getCurieMoveClass,
  canHost,
  shopCost,
} from '../../data/materials';
import { persistFromRegistry } from '../../data/save';
import type { MoveClass } from '../../data/types';

// Curie stands at world 6's middle tile (WORLD_GUARDIANS) and sells her
// two quiz-gated moves (data/materials.ts's ANALYTIC_MOVE_IDS, currently
// Skyfall Beam/Ground Eruption) -- kept out of Noether's own shop
// (SHOP_MOVE_IDS excludes them, see materials.ts's comment) so Curie is
// their one source. Mirrors showNoetherShop's layout/structure, minus the
// Moves/Stats tabs since she only ever has one thing to sell. Buying (or
// later revisiting) a move also opens showCurieClassPicker to assign it a
// quasiparticle -- see renderCurieMoves.
export function showCuriePanel(scene: OverworldScene) {
  scene.dialogueActive = true;

  const panelWidth = 600;
  const top = 20;
  const container = scene.add.container(0, 0).setDepth(100);
  scene.dialogueContainer = container;

  let y = top;

  const avatarY = y + 45;
  const avatar = makeCurieAvatar(scene);
  avatar.setPosition(CANVAS_W / 2, avatarY);
  container.add(avatar);
  scene.tweens.add({ targets: avatar, y: avatarY + 8, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  playGuardianChime();
  y = avatarY + 55;

  const intro = scene.add
    .text(
      CANVAS_W / 2,
      y,
      '"I am Curie. Learn the analytic side of the physics and I will teach you to strike by it -- answer right and the hit lands twice as hard, answer wrong and it barely lands at all. Tell me which quasiparticle to carry it with, too -- a defender with no natural channel for it takes the hit even harder."',
      { fontSize: fontPx(scene, 11), fontStyle: 'italic', color: '#cfd8ff', align: 'center', wordWrap: { width: panelWidth - 80 } }
    )
    .setOrigin(0.5, 0);
  container.add(intro);
  y += intro.height + 14;

  y = renderCurieMoves(scene, container, y);
  y += 8;
  y = scene.renderFarewellFooter(container, y);
  y += 8;

  const panelHeight = y - top;
  const panel = scene.add
    .rectangle(CANVAS_W / 2, top + panelHeight / 2, panelWidth, panelHeight, 0x10101c, 0.94)
    .setStrokeStyle(2, 0xc9d84a);
  container.addAt(panel, 0);
}

// Two sections, same shape as Kondo's own panel: still-unbought moves
// (buying opens showCurieClassPicker first, so a purchase always comes
// with a quasiparticle chosen) followed by every already-bought move
// showing which quasiparticle it's currently tuned to, with a free
// "Retune" click back into the same picker -- unlike Kondo's single
// active-move switch, both of Curie's moves can be tuned (and usable) at
// once, this only ever changes which quasiparticle each one's mismatch
// check reads (materials.ts's getCurieMoveClass). Unlike Kondo's shop,
// `forSale`/`learned` don't always partition every id between them --
// ANALYTIC_MOVE_IDS is fixed at 2 with no third state, so `forSale` alone
// (not both being empty) is the real "nothing left to buy" signal, shown
// as its own line above the learned rows rather than replacing them.
function renderCurieMoves(scene: OverworldScene, container: Phaser.GameObjects.Container, y: number): number {
  const unlocked = scene.getUnlockedMoves();
  const forSale = ANALYTIC_MOVE_IDS.filter((id) => !unlocked.includes(id));
  const learned = ANALYTIC_MOVE_IDS.filter((id) => unlocked.includes(id));
  const tokens = (scene.game.registry.get('qumatokens') as number) || 0;
  const assigned = (scene.game.registry.get('curieMoveClass') as Partial<Record<string, MoveClass>>) ?? {};

  if (forSale.length === 0) {
    const text = scene.add
      .text(CANVAS_W / 2, y, 'You already carry every analytic technique I can teach.', {
        fontSize: fontPx(scene, 13),
        color: '#ffffff',
        align: 'center',
        wordWrap: { width: 480 },
      })
      .setOrigin(0.5, 0);
    container.add(text);
    y += text.height + 6;
  }

  forSale.forEach((id) => {
    const move = MOVES[id];
    const cost = shopCost(move);
    const affordable = tokens >= cost;
    const btn = scene.addDialogueButton(container, y, `${move.name} -- ${cost} qumatokens`, () => {
      if ((scene.game.registry.get('qumatokens') as number) < cost) return;
      showCurieClassPicker(scene, id, (chosenClass) => {
        scene.qumatokens -= cost;
        scene.game.registry.set('qumatokens', scene.qumatokens);
        scene.tokenText.setText(`Qumatokens: ${scene.qumatokens}`);
        scene.game.registry.set('unlockedMoves', [...scene.getUnlockedMoves(), id]);
        scene.game.registry.set('curieMoveClass', { ...assigned, [id]: chosenClass });
        persistFromRegistry(scene.game.registry);
        scene.dialogueContainer?.destroy(true);
        showCuriePanel(scene);
      });
    });
    if (!affordable) btn.setAlpha(0.5);
    y += btn.height + 3;
  });

  if (learned.length > 0) {
    if (forSale.length > 0) y += 6;
    learned.forEach((id) => {
      const assignedClass = assigned[id];
      const activeClass = getCurieMoveClass(scene.game.registry, id);
      const displayName = curieMoveDisplayName(scene.game.registry, id);
      const label = !assignedClass
        ? `${displayName} -- untuned (pick a quasiparticle)`
        : activeClass === assignedClass
        ? `${displayName} -- tuned to ${quasiparticleLabel(assignedClass)} (retune)`
        : `${displayName} -- tuned to ${quasiparticleLabel(assignedClass)}, reverted to ${quasiparticleLabel(activeClass)} (this form can't host it -- retune)`;
      const btn = scene.addDialogueButton(container, y, label, () => {
        showCurieClassPicker(scene, id, (chosenClass) => {
          scene.game.registry.set('curieMoveClass', { ...assigned, [id]: chosenClass });
          persistFromRegistry(scene.game.registry);
          scene.dialogueContainer?.destroy(true);
          showCuriePanel(scene);
        });
      });
      y += btn.height + 3;
    });
  }
  return y;
}

// The quasiparticle-choice sub-panel Curie's shop opens for one of her two
// moves, both on first purchase and on a later "Retune" click
// (renderCurieMoves above) -- the move's own default MoveClass ('phonon')
// never changes (see getCurieMoveClass), this only decides which ordinary
// class the quasiparticle-mismatch check treats it as. Only offers
// classes the player's *current* form can actually host
// (CURIE_TUNABLE_CLASSES filtered through canHost) -- "which quasiparticle
// should this carry" is meant to be a real physics choice grounded in
// what the player's own crystal can host right now, not a free pick from
// every class in the game regardless of how little sense it makes for the
// current form; re-tuning later (after transmuting into a different form)
// just reopens this same filtered list. 'phonon' is on every
// MOVE_COMPATIBILITY list, so the filtered list is never empty.
// `onChosen` runs the caller's own save/persist/redraw, this panel just
// presents the pick.
function showCurieClassPicker(scene: OverworldScene, moveId: string, onChosen: (chosenClass: MoveClass) => void) {
  scene.dialogueContainer?.destroy(true);
  scene.dialogueActive = true;

  const panelWidth = 600;
  const top = 20;
  const container = scene.add.container(0, 0).setDepth(100);
  scene.dialogueContainer = container;

  let y = top;
  const move = MOVES[moveId];
  const title = scene.add
    .text(CANVAS_W / 2, y, `Which quasiparticle should ${move.name} carry?`, {
      fontSize: fontPx(scene, 13),
      color: '#ffffff',
      fontStyle: 'bold',
      align: 'center',
      wordWrap: { width: panelWidth - 60 },
    })
    .setOrigin(0.5, 0);
  container.add(title);
  y += title.height + 10;

  const hostable = CURIE_TUNABLE_CLASSES.filter((cls) => canHost(scene.playerMaterial.type, cls));
  hostable.forEach((cls) => {
    const btn = scene.addDialogueButton(container, y, quasiparticleLabel(cls), () => onChosen(cls));
    y += btn.height + 3;
  });
  y += top;

  const panelHeight = y - top;
  const panel = scene.add
    .rectangle(CANVAS_W / 2, top + panelHeight / 2, panelWidth, panelHeight, 0x10101c, 0.94)
    .setStrokeStyle(2, 0xc9d84a);
  container.addAt(panel, 0);
}
