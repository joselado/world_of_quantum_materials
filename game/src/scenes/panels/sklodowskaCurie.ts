import type { OverworldScene } from '../OverworldScene';
import { makeSklodowskaCurieAvatar } from '../../art/sklodowskaCurie';
import { playGuardianChime } from '../../audio/sfx';
import { CANVAS_W } from '../../art/perspective';
import { fontPx } from '../../ui/text';
import {
  ULTIMATE_MOVE_IDS,
  ULTIMATE_CLASS_UNLOCK_COST,
  TUNABLE_MOVE_CLASSES,
  quasiparticleLabel,
  tunedMoveDisplayName,
  getTunedMoveClass,
  canHost,
} from '../../data/materials';
import { persistFromRegistry } from '../../data/save';
import type { MoveClass } from '../../data/types';

// Skłodowska-Curie stands at world 10's middle tile (WORLD_GUARDIANS,
// `id: 'sklodowskaCurie'` -- deliberately not `'curie'`, so she's gated
// behind actually reaching World 10 rather than inheriting "met" status from
// an old save's World-6 Curie visit) and sells her two quiz-gated Ultimate
// moves (data/materials.ts's ULTIMATE_MOVE_IDS, a meteor move and a nova
// move). Her pricing model is deliberately NOT the standard `shopCost`
// flow every other tunable-move shop uses (panels/tunableMoveShop.ts) --
// there is no separate "buy the move" step; instead each quasiparticle
// class costs `ULTIMATE_CLASS_UNLOCK_COST` qumatessence to unlock per move,
// the first time it's picked for that move, after which retuning back to
// an already-unlocked class is free forever (see
// showUltimateClassPicker below). The move's own battle-side 3-question
// gate lives in BattleScene, not here -- this panel only ever sells the
// quasiparticle tuning.
export function showSklodowskaCuriePanel(scene: OverworldScene) {
  scene.dialogueActive = true;

  const panelWidth = 600;
  const top = 20;
  const container = scene.add.container(0, 0).setDepth(100);
  scene.dialogueContainer = container;

  let y = top;

  const avatarY = y + 45;
  const avatar = makeSklodowskaCurieAvatar(scene);
  avatar.setPosition(CANVAS_W / 2, avatarY);
  container.add(avatar);
  scene.tweens.add({ targets: avatar, y: avatarY + 8, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  playGuardianChime();
  y = avatarY + 55;

  const intro = scene.add
    .text(
      CANVAS_W / 2,
      y,
      '"I am Skłodowska-Curie -- I lead this circle of guardians, and here is our last lesson. Answer three questions on the physics running through everything you have learned, all three correct, and your crystal strikes with a force none of the others can match. Miss even one and the blow lands nowhere at all. Tell me which quasiparticle should carry it, too -- a new one costs dearly to unlock, but once bought it is yours to wear again for free."',
      { fontSize: fontPx(scene, 11), fontStyle: 'italic', color: '#cfd8ff', align: 'center', wordWrap: { width: panelWidth - 80 } }
    )
    .setOrigin(0.5, 0);
  container.add(intro);
  y += intro.height + 14;

  y = renderUltimateMoves(scene, container, y);
  y += 8;
  y = scene.renderFarewellFooter(container, y);
  y += 8;

  const panelHeight = y - top;
  const panel = scene.add
    .rectangle(CANVAS_W / 2, top + panelHeight / 2, panelWidth, panelHeight, 0x10101c, 0.94)
    .setStrokeStyle(2, 0xc9d84a);
  container.addAt(panel, 0);
}

// One row per Ultimate move, always shown (unlike panels/tunableMoveShop.ts's
// forSale/learned split -- there is no separate purchase step here, opening
// the class picker and paying for a class is itself what first unlocks the
// move, see showUltimateClassPicker) -- each row names which quasiparticle
// it's currently carrying (tunedMoveDisplayName/getTunedMoveClass, same
// helpers Laughlin's Analytic shop reads) and opens the picker to change it.
// A move not yet in `unlockedMoves` says so explicitly rather than "carrying
// Phonon Beam" -- that phrasing would otherwise read as already usable in
// battle when it isn't yet.
function renderUltimateMoves(scene: OverworldScene, container: Phaser.GameObjects.Container, y: number): number {
  const unlocked = scene.getUnlockedMoves();
  ULTIMATE_MOVE_IDS.forEach((id) => {
    const displayName = tunedMoveDisplayName(scene.game.registry, id);
    const activeClass = getTunedMoveClass(scene.game.registry, id);
    const label = unlocked.includes(id)
      ? `${displayName} -- carrying ${quasiparticleLabel(activeClass)} (tune)`
      : `${displayName} -- not yet unlocked (pick a quasiparticle)`;
    const btn = scene.addDialogueButton(container, y, label, () => {
      showUltimateClassPicker(scene, id, () => {
        scene.dialogueContainer?.destroy(true);
        showSklodowskaCuriePanel(scene);
      });
    });
    y += btn.height + 3;
  });
  return y;
}

// The quasiparticle-choice sub-panel for one Ultimate move -- offers the
// same TUNABLE_MOVE_CLASSES-filtered-by-canHost list panels/
// tunableMoveShop.ts's showMoveClassPicker does, but each row's cost is
// per-class instead of a flat move purchase: "Free (already unlocked)" for
// any class already in registry/save `ultimateClassesUnlocked[moveId]`,
// else `ULTIMATE_CLASS_UNLOCK_COST` qumatessence. Picking an unlocked class is
// free and just retunes; picking a not-yet-unlocked one deducts the cost,
// records the unlock, retunes, and -- on this move's very first-ever
// unlock -- adds the move id to `unlockedMoves` so it appears in the battle
// menu (mirrors how buying unlocks a move in every other guardian shop).
function showUltimateClassPicker(scene: OverworldScene, moveId: string, onDone: () => void) {
  scene.dialogueContainer?.destroy(true);
  scene.dialogueActive = true;

  const panelWidth = 600;
  const top = 20;
  const container = scene.add.container(0, 0).setDepth(100);
  scene.dialogueContainer = container;

  let y = top;
  const displayName = tunedMoveDisplayName(scene.game.registry, moveId);
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

  const unlockedForMove =
    ((scene.game.registry.get('ultimateClassesUnlocked') as Partial<Record<string, MoveClass[]>>) ?? {})[moveId] ?? [];
  const tokens = (scene.game.registry.get('qumatessence') as number) || 0;
  const hostable = TUNABLE_MOVE_CLASSES.filter((cls) => canHost(scene.playerMaterial.type, cls));

  hostable.forEach((cls) => {
    const isUnlocked = unlockedForMove.includes(cls);
    const costLabel = isUnlocked ? 'Free (already unlocked)' : `${ULTIMATE_CLASS_UNLOCK_COST} qumatessence`;
    const affordable = isUnlocked || tokens >= ULTIMATE_CLASS_UNLOCK_COST;
    const btn = scene.addDialogueButton(container, y, `${quasiparticleLabel(cls)} -- ${costLabel}`, () => {
      const allUnlocked = (scene.game.registry.get('ultimateClassesUnlocked') as Partial<Record<string, MoveClass[]>>) ?? {};
      const forThisMove = allUnlocked[moveId] ?? [];
      const assigned = (scene.game.registry.get('moveClassTuning') as Partial<Record<string, MoveClass>>) ?? {};
      if (forThisMove.includes(cls)) {
        scene.game.registry.set('moveClassTuning', { ...assigned, [moveId]: cls });
      } else {
        const tokensNow = (scene.game.registry.get('qumatessence') as number) || 0;
        if (tokensNow < ULTIMATE_CLASS_UNLOCK_COST) return;
        scene.qumatessence -= ULTIMATE_CLASS_UNLOCK_COST;
        scene.game.registry.set('qumatessence', scene.qumatessence);
        scene.tokenText.setText(`Qumatessence: ${scene.qumatessence}`);
        scene.game.registry.set('ultimateClassesUnlocked', { ...allUnlocked, [moveId]: [...forThisMove, cls] });
        scene.game.registry.set('moveClassTuning', { ...assigned, [moveId]: cls });
        const unlockedMoves = scene.getUnlockedMoves();
        if (!unlockedMoves.includes(moveId)) {
          scene.game.registry.set('unlockedMoves', [...unlockedMoves, moveId]);
        }
      }
      persistFromRegistry(scene.game.registry);
      onDone();
    });
    if (!affordable) btn.setAlpha(0.5);
    y += btn.height + 3;
  });
  y += top;

  const panelHeight = y - top;
  const panel = scene.add
    .rectangle(CANVAS_W / 2, top + panelHeight / 2, panelWidth, panelHeight, 0x10101c, 0.94)
    .setStrokeStyle(2, 0xc9d84a);
  container.addAt(panel, 0);
}
