import type Phaser from 'phaser';
import type { GuardianPanelHost } from '../OverworldScene';
import { CANVAS_W } from '../../art/perspective';
import { fontScale } from '../../ui/text';
import { PASSIVES } from '../../data/passives';
import type { PassiveOwner } from '../../data/passives';
import { persistFromRegistry } from '../../data/save';

// Used by panels/franklin.ts's showFranklinPanel to sell her three-passive
// kit, the same "buy several, only one active, switch by a click" shape
// Kondo's three moves already use (panels/kondo.ts's renderKondoMoves),
// just for a whole-battle passive instead of a move usable from the battle
// menu -- kept parameterized over `owner`/`passiveIds` rather than folded
// into franklin.ts directly, the same "a helper more than one guardian
// could call gets its own file" convention every other cross-guardian
// helper here follows, in case a future guardian teaches passives too:
// still-unbought passives get a buy button, every already-bought passive
// gets its own "Make `<name>` active" button or a dimmed "`<name>` (active)"
// tag -- same dimmed-current convention every other guardian panel uses.
// Every row, bought or not, prints the passive's one-line description
// underneath (a passive's effect isn't spelled out anywhere else the way a
// move's physics-flavored name usually implies it) -- otherwise it was only
// ever visible during the single visit that purchased it, the same reasoning
// panels/kondo.ts's renderKondoMoves prints each of Kondo's own move
// descriptions for. Like Kondo's self-buff moves, a passive is never gated
// by MOVE_COMPATIBILITY (the same "player-learned technique, not a
// quasiparticle a crystal has to host" reasoning) -- every passive is always
// purchasable regardless of current form, so there's no "wrong form" empty
// state to special-case here. Buying the very first passive for a given
// owner activates it automatically, same reasoning as Kondo's first move.
//
// `passiveIds` is filtered against the flat registry/save `passivesUnlocked`
// list (globally unique across PASSIVES, not parameterized per owner --
// only which ids this call passes in decides which owner's kit is being
// shown), while the active pick is read/written per `owner` from
// `activePassiveByOwner`.
export function renderPassiveList(
  scene: GuardianPanelHost,
  container: Phaser.GameObjects.Container,
  y: number,
  passiveIds: string[],
  owner: PassiveOwner,
  reopen: () => void
): number {
  const unlocked = (scene.game.registry.get('passivesUnlocked') as string[]) ?? [];
  const forSale = passiveIds.filter((id) => !unlocked.includes(id));
  const learned = passiveIds.filter((id) => unlocked.includes(id));
  const activeByOwner = (scene.game.registry.get('activePassiveByOwner') as Partial<Record<PassiveOwner, string>>) ?? {};
  const active = activeByOwner[owner] ?? null;
  const tokens = (scene.game.registry.get('qumatessence') as number) || 0;

  // Every row's font size -- buy rows and already-bought/active rows alike
  // -- is capped well below the text-size setting's full range (same
  // reasoning as BattleScene's move-menu section headers, STYLE.md's
  // "Battle move menu") -- this panel has no shrink-to-fit safety net the
  // way showInfoPanel does, and an uncapped label at the setting's
  // 'Large' preset wraps to two lines, which combined with three rows and
  // their own description line each was enough to push the whole panel's
  // Farewell button off the bottom of the canvas the first time this was
  // tried at the default preset already. Both sections pass `buttonPx`
  // explicitly (addDialogueButtonAt, not the uncapped addDialogueButton
  // convenience wrapper) for exactly this reason.
  const buttonScale = Math.min(fontScale(scene), 1.3);
  const buttonPx = `${Math.round(12 * buttonScale)}px`;
  const descScale = Math.min(fontScale(scene), 1.2);
  const descPx = `${Math.round(9 * descScale)}px`;

  forSale.forEach((id) => {
    const passive = PASSIVES[id];
    const affordable = tokens >= passive.cost;
    const btn = scene.addDialogueButtonAt(
      container,
      CANVAS_W / 2,
      y,
      `${passive.name} -- ${passive.cost} qumatessence`,
      () => {
        if ((scene.game.registry.get('qumatessence') as number) < passive.cost) return;
        scene.qumatessence -= passive.cost;
        scene.game.registry.set('qumatessence', scene.qumatessence);
        scene.tokenText.setText(`Qumatessence: ${scene.qumatessence}`);
        scene.game.registry.set('passivesUnlocked', [...unlocked, id]);
        if (!activeByOwner[owner]) {
          scene.game.registry.set('activePassiveByOwner', { ...activeByOwner, [owner]: id });
        }
        persistFromRegistry(scene.game.registry);
        scene.dialogueContainer?.destroy(true);
        reopen();
      },
      480,
      buttonPx
    );
    if (!affordable) btn.setAlpha(0.5);
    y += btn.height + 2;
    const desc = scene.add
      .text(CANVAS_W / 2, y, passive.description, {
        fontSize: descPx,
        color: '#8fa0c9',
        align: 'center',
        wordWrap: { width: 480 },
      })
      .setOrigin(0.5, 0);
    container.add(desc);
    y += desc.height + 4;
  });

  if (learned.length > 0) {
    if (forSale.length > 0) y += 6;
    learned.forEach((id) => {
      const passive = PASSIVES[id];
      const isActive = id === active;
      const label = isActive ? `${passive.name} (active)` : `Make ${passive.name} active`;
      const btn = scene.addDialogueButtonAt(
        container,
        CANVAS_W / 2,
        y,
        label,
        () => {
          if (isActive) return;
          scene.game.registry.set('activePassiveByOwner', { ...activeByOwner, [owner]: id });
          persistFromRegistry(scene.game.registry);
          scene.dialogueContainer?.destroy(true);
          reopen();
        },
        480,
        buttonPx
      );
      if (isActive) btn.setAlpha(0.5);
      y += btn.height + 2;
      // Same one-line description a still-unbought passive shows above --
      // once bought, a passive's effect was otherwise only ever spelled
      // out during the single visit that purchased it.
      const desc = scene.add
        .text(CANVAS_W / 2, y, passive.description, {
          fontSize: descPx,
          color: '#8fa0c9',
          align: 'center',
          wordWrap: { width: 480 },
        })
        .setOrigin(0.5, 0);
      container.add(desc);
      y += desc.height + 4;
    });
  }

  return y;
}
