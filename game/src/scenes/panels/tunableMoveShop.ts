import type Phaser from 'phaser';
import type { GuardianPanelHost } from '../OverworldScene';
import { CANVAS_W } from '../../art/perspective';
import { fontPx } from '../../ui/text';
import {
  MOVES,
  TUNABLE_MOVE_CLASSES,
  quasiparticleLabel,
  moveDisplayName,
  getTunedMoveClass,
  canHost,
  shopCost,
} from '../../data/materials';
import { persistFromRegistry } from '../../data/save';
import type { MoveClass } from '../../data/types';

// Shared shop UI for a guardian who sells a small, fixed list of
// quiz-gated, quasiparticle-tunable moves at the standard `shopCost`
// (power×5), one-time-purchase-then-free-forever-retune flow -- written
// generically (any move-id list, any reopen callback) so Laughlin's
// Analytic shop (panels/laughlin.ts, ANALYTIC_MOVE_IDS) can call it
// directly rather than duplicating the shop layout in his own file.
// Skłodowska-Curie's Ultimate shop (panels/sklodowskaCurie.ts) does NOT use
// this -- her per-quasiparticle-class unlock cost model is fundamentally
// different from this flat one-time purchase, so her panel is bespoke.
//
// Two sections, same shape as Kondo's own panel: still-unbought moves
// (buying opens showMoveClassPicker first, so a purchase always comes with a
// quasiparticle chosen) followed by every already-bought move showing which
// quasiparticle it's currently tuned to, with a free "Retune" click back
// into the same picker -- unlike Kondo's single active-move switch, every
// move sold here can be tuned (and usable) at once, this only ever changes
// which quasiparticle each one's mismatch check reads
// (materials.ts's getTunedMoveClass). Unlike Kondo's shop, `forSale`/
// `learned` don't always partition every id between them -- `moveIds` is a
// small fixed list with no third state, so `forSale` alone (not both being
// empty) is the real "nothing left to buy" signal, shown as its own line
// above the learned rows rather than replacing them.
export function renderTunableMoveShop(
  scene: GuardianPanelHost,
  container: Phaser.GameObjects.Container,
  y: number,
  moveIds: string[],
  reopen: () => void
): number {
  const unlocked = scene.getUnlockedMoves();
  const forSale = moveIds.filter((id) => !unlocked.includes(id));
  const learned = moveIds.filter((id) => unlocked.includes(id));
  const tokens = (scene.game.registry.get('qumatessence') as number) || 0;
  const assigned = (scene.game.registry.get('moveClassTuning') as Partial<Record<string, MoveClass>>) ?? {};

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
    const displayName = moveDisplayName(scene.game.registry, id);
    const btn = scene.addDialogueButton(container, y, `${displayName} -- ${cost} qumatessence`, () => {
      if ((scene.game.registry.get('qumatessence') as number) < cost) return;
      showMoveClassPicker(scene, id, (chosenClass) => {
        scene.qumatessence -= cost;
        scene.game.registry.set('qumatessence', scene.qumatessence);
        scene.tokenText.setText(`Qumatessence: ${scene.qumatessence}`);
        scene.game.registry.set('unlockedMoves', [...scene.getUnlockedMoves(), id]);
        scene.game.registry.set('moveClassTuning', { ...assigned, [id]: chosenClass });
        persistFromRegistry(scene.game.registry);
        scene.dialogueContainer?.destroy(true);
        reopen();
      });
    });
    if (!affordable) btn.setAlpha(0.5);
    y += btn.height + 3;
  });

  if (learned.length > 0) {
    if (forSale.length > 0) y += 6;
    learned.forEach((id) => {
      const assignedClass = assigned[id];
      const activeClass = getTunedMoveClass(scene.game.registry, id);
      const displayName = moveDisplayName(scene.game.registry, id);
      const label = !assignedClass
        ? `${displayName} -- untuned (pick a quasiparticle)`
        : activeClass === assignedClass
        ? `${displayName} -- tuned to ${quasiparticleLabel(assignedClass)} (retune)`
        : `${displayName} -- tuned to ${quasiparticleLabel(assignedClass)}, reverted to ${quasiparticleLabel(activeClass)} (this form can't host it -- retune)`;
      const btn = scene.addDialogueButton(container, y, label, () => {
        showMoveClassPicker(scene, id, (chosenClass) => {
          scene.game.registry.set('moveClassTuning', { ...assigned, [id]: chosenClass });
          persistFromRegistry(scene.game.registry);
          scene.dialogueContainer?.destroy(true);
          reopen();
        });
      });
      y += btn.height + 3;
    });
  }
  return y;
}

// The quasiparticle-choice sub-panel a tunable move's shop opens for one of
// its moves, both on first purchase and on a later "Retune" click
// (renderTunableMoveShop above) -- the move's own default MoveClass
// ('phonon') never changes (see getTunedMoveClass), this only decides which
// ordinary class the quasiparticle-mismatch check treats it as. Only offers
// classes the player's *current* form can actually host
// (TUNABLE_MOVE_CLASSES filtered through canHost) -- "which quasiparticle
// should this carry" is meant to be a real physics choice grounded in what
// the player's own crystal can host right now, not a free pick from every
// class in the game regardless of how little sense it makes for the current
// form; re-tuning later (after transmuting into a different form) just
// reopens this same filtered list. 'phonon' is on every MOVE_COMPATIBILITY
// list, so the filtered list is never empty. `onChosen` runs the caller's
// own save/persist/redraw, this panel just presents the pick. Panel border
// is a flat Laughlin-blue -- only Laughlin's Analytic shop calls into this
// module today, Skłodowska-Curie's Ultimate shop is bespoke (see
// panels/sklodowskaCurie.ts).
export function showMoveClassPicker(scene: GuardianPanelHost, moveId: string, onChosen: (chosenClass: MoveClass) => void) {
  scene.dialogueContainer?.destroy(true);
  scene.dialogueActive = true;

  const panelWidth = 600;
  const top = 20;
  const container = scene.add.container(0, 0).setDepth(100);
  scene.dialogueContainer = container;

  let y = top;
  const displayName = moveDisplayName(scene.game.registry, moveId);
  const title = scene.add
    .text(CANVAS_W / 2, y, `Which quasiparticle should ${displayName} carry?`, {
      fontSize: fontPx(scene, 13),
      color: '#ffffff',
      fontStyle: 'bold',
      align: 'center',
      wordWrap: { width: panelWidth - 60 },
    })
    .setOrigin(0.5, 0);
  container.add(title);
  y += title.height + 10;

  const hostable = TUNABLE_MOVE_CLASSES.filter((cls) => canHost(scene.playerMaterial.type, cls));
  hostable.forEach((cls) => {
    const btn = scene.addDialogueButton(container, y, quasiparticleLabel(cls), () => onChosen(cls));
    y += btn.height + 3;
  });
  y += top;

  const panelHeight = y - top;
  const panel = scene.add
    .rectangle(CANVAS_W / 2, top + panelHeight / 2, panelWidth, panelHeight, 0x10101c, 0.94)
    .setStrokeStyle(2, 0x6a7fff);
  container.addAt(panel, 0);
}
