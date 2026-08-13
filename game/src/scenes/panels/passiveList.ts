import type Phaser from 'phaser';
import type { GuardianPanelHost } from '../OverworldScene';
import { CANVAS_W } from '../../art/perspective';
import { fontScale } from '../../ui/text';
import { REFERENCE_BLUE_GREY_HEX } from '../../ui/theme';
import { PASSIVES } from '../../data/passives';
import type { PassiveOwner } from '../../data/passives';
import { persistFromRegistry } from '../../data/save';

export interface ChoiceListItem {
  id: string;
  name: string;
  description: string;
  cost: number;
}

// Reads/writes whatever registry keys back a given "buy several, only one
// active" kit -- Franklin's flat `passivesUnlocked`/`activePassiveByOwner`
// pair, Kondo's own `unlockedMoves`/`kondoActiveMove` pair, or a future
// guardian's own. Kept as an adapter rather than folding both kits onto one
// shared registry key: Kondo's moves are also real battle moves
// (`unlockedMoves`, read by the battle move menu itself), not a
// passives-only concept, so the two kits' storage genuinely differs beneath
// the identical shop UI.
export interface ChoiceListState {
  isUnlocked(id: string): boolean;
  activeId(): string | null;
  unlock(id: string): void;
  activate(id: string): void;
}

// The shared "buy several, only one active, switch by revisiting" shop
// engine -- Franklin's three passives and Kondo's three self-buff moves are
// both this same shape (see renderPassiveList below for Franklin's own
// thin wrapper around it), kept as one render loop parameterized over
// `items`/`state` rather than two near-identical copies. Still-unbought
// items get a buy button; every already-bought item gets its own "Make
// `<name>` active" button or a dimmed "`<name>` (active)" tag -- same
// dimmed-current convention every other guardian panel uses. Every row,
// bought or not, prints the item's one-line description underneath (an
// effect that isn't spelled out anywhere else the way a move's
// physics-flavored name usually implies it) -- otherwise it was only ever
// visible during the single visit that purchased it. Buying the very first
// item for a given kit activates it automatically, so a purchase is never
// immediately invisible in battle; switching between two-or-more
// already-bought items is always its own explicit "Make active" click.
export function renderChoiceList(
  scene: GuardianPanelHost,
  container: Phaser.GameObjects.Container,
  y: number,
  items: ChoiceListItem[],
  state: ChoiceListState,
  reopen: () => void
): number {
  const forSale = items.filter((item) => !state.isUnlocked(item.id));
  const learned = items.filter((item) => state.isUnlocked(item.id));
  const active = state.activeId();
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

  const addDescription = (text: string) => {
    const desc = scene.add
      .text(CANVAS_W / 2, y, text, {
        fontSize: descPx,
        color: REFERENCE_BLUE_GREY_HEX,
        align: 'center',
        wordWrap: { width: 480 },
      })
      .setOrigin(0.5, 0);
    container.add(desc);
    y += desc.height + 4;
  };

  forSale.forEach((item) => {
    const affordable = tokens >= item.cost;
    const btn = scene.addDialogueButtonAt(
      container,
      CANVAS_W / 2,
      y,
      `${item.name} -- ${item.cost} qumatessence`,
      () => {
        if ((scene.game.registry.get('qumatessence') as number) < item.cost) return;
        scene.qumatessence -= item.cost;
        scene.game.registry.set('qumatessence', scene.qumatessence);
        scene.tokenText.setText(`Qumatessence: ${scene.qumatessence}`);
        state.unlock(item.id);
        scene.dialogueContainer?.destroy(true);
        reopen();
      },
      480,
      buttonPx
    );
    if (!affordable) btn.setAlpha(0.5);
    y += btn.height + 2;
    addDescription(item.description);
  });

  if (learned.length > 0) {
    if (forSale.length > 0) y += 6;
    learned.forEach((item) => {
      const isActive = item.id === active;
      const label = isActive ? `${item.name} (active)` : `Make ${item.name} active`;
      const btn = scene.addDialogueButtonAt(
        container,
        CANVAS_W / 2,
        y,
        label,
        () => {
          if (isActive) return;
          state.activate(item.id);
          scene.dialogueContainer?.destroy(true);
          reopen();
        },
        480,
        buttonPx
      );
      if (isActive) btn.setAlpha(0.5);
      y += btn.height + 2;
      addDescription(item.description);
    });
  }

  return y;
}

// Franklin's own thin wrapper around renderChoiceList: builds `items` from
// data/passives.ts's flat PASSIVES registry and a `ChoiceListState` backed
// by the save's `passivesUnlocked` list (globally unique across PASSIVES,
// not parameterized per owner -- only which ids `passiveIds` passes in
// decides which owner's kit is being shown) and `activePassiveByOwner`
// (read/written per `owner`). Like Kondo's self-buff moves, a passive is
// never gated by MOVE_COMPATIBILITY (the same "player-learned technique,
// not a quasiparticle a crystal has to host" reasoning) -- every passive is
// always purchasable regardless of current form, so there's no "wrong form"
// empty state to special-case here.
export function renderPassiveList(
  scene: GuardianPanelHost,
  container: Phaser.GameObjects.Container,
  y: number,
  passiveIds: string[],
  owner: PassiveOwner,
  reopen: () => void
): number {
  const unlocked = (scene.game.registry.get('passivesUnlocked') as string[]) ?? [];
  const activeByOwner = (scene.game.registry.get('activePassiveByOwner') as Partial<Record<PassiveOwner, string>>) ?? {};
  const items: ChoiceListItem[] = passiveIds.map((id) => ({
    id,
    name: PASSIVES[id].name,
    description: PASSIVES[id].description,
    cost: PASSIVES[id].cost,
  }));
  const state: ChoiceListState = {
    isUnlocked: (id) => unlocked.includes(id),
    activeId: () => activeByOwner[owner] ?? null,
    unlock: (id) => {
      scene.game.registry.set('passivesUnlocked', [...unlocked, id]);
      if (!activeByOwner[owner]) {
        scene.game.registry.set('activePassiveByOwner', { ...activeByOwner, [owner]: id });
      }
      persistFromRegistry(scene.game.registry);
    },
    activate: (id) => {
      scene.game.registry.set('activePassiveByOwner', { ...activeByOwner, [owner]: id });
      persistFromRegistry(scene.game.registry);
    },
  };
  return renderChoiceList(scene, container, y, items, state, reopen);
}
