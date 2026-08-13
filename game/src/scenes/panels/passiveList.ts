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
// pair today, or a future guardian's own. Kept as its own adapter interface
// rather than a single hardcoded registry shape, since a future kit's
// storage could differ from Franklin's own the way a kit selling real battle
// moves (rather than passives) would need to read/write `unlockedMoves` plus
// its own single "which one is active" key instead (Kondo's self-buff moves,
// scenes/panels/kondo.ts, are exactly that shape -- but browsed through
// listDetail.ts's own list+detail layout rather than this file's, since each
// one is worth previewing with its own real battle-effect animation).
export interface ChoiceListState {
  isUnlocked(id: string): boolean;
  activeId(): string | null;
  unlock(id: string): void;
  activate(id: string): void;
}

// Opt-in layout/preview hooks, all defaulting to today's plain,
// full-canvas-centered behavior so a caller that passes nothing renders the
// same as if this options param didn't exist at all. `centerX`/`wrapWidth`
// let a caller lay the list out in a narrower column instead (Franklin's own
// panel, see franklin.ts, puts a crystal preview beside this list rather
// than below it). `onSelect` adds a non-committal "look" click on top of
// the existing "buy"/"make active" buttons (both of which already commit
// something) -- every guardian panel's own "look costs nothing, only
// committing does" convention, extended here to previewing a passive's own
// ground halo (franklin.ts) without needing a second full render pass.
export interface ChoiceListRenderOptions {
  centerX?: number;
  wrapWidth?: number;
  onSelect?: (id: string) => void;
}

// The shared "buy several, only one active, switch by revisiting" shop
// engine -- Franklin's three passives are this shape (see renderPassiveList
// below for Franklin's own thin wrapper around it), kept generic over
// `items`/`state` rather than hardcoded to Franklin's own registry keys so a
// future guardian selling another flat, non-previewable "buy several, equip
// one" kit can reuse it the same way. Still-unbought
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
  reopen: () => void,
  options: ChoiceListRenderOptions = {}
): number {
  const centerX = options.centerX ?? CANVAS_W / 2;
  const wrapWidth = options.wrapWidth ?? 480;
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

  const addDescription = (id: string, text: string) => {
    const desc = scene.add
      .text(centerX, y, text, {
        fontSize: descPx,
        color: REFERENCE_BLUE_GREY_HEX,
        align: 'center',
        wordWrap: { width: wrapWidth },
      })
      .setOrigin(0.5, 0);
    if (options.onSelect) {
      const onSelect = options.onSelect;
      desc.setInteractive({ useHandCursor: true }).on('pointerdown', () => onSelect(id));
    }
    container.add(desc);
    y += desc.height + 4;
  };

  forSale.forEach((item) => {
    const affordable = tokens >= item.cost;
    const btn = scene.addDialogueButtonAt(
      container,
      centerX,
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
      wrapWidth,
      buttonPx
    );
    if (!affordable) btn.setAlpha(0.5);
    y += btn.height + 2;
    addDescription(item.id, item.description);
  });

  if (learned.length > 0) {
    if (forSale.length > 0) y += 6;
    learned.forEach((item) => {
      const isActive = item.id === active;
      const label = isActive ? `${item.name} (active)` : `Make ${item.name} active`;
      const btn = scene.addDialogueButtonAt(
        container,
        centerX,
        y,
        label,
        () => {
          if (isActive) return;
          state.activate(item.id);
          scene.dialogueContainer?.destroy(true);
          reopen();
        },
        wrapWidth,
        buttonPx
      );
      if (isActive) btn.setAlpha(0.5);
      y += btn.height + 2;
      addDescription(item.id, item.description);
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
  reopen: () => void,
  options?: ChoiceListRenderOptions
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
  return renderChoiceList(scene, container, y, items, state, reopen, options);
}
