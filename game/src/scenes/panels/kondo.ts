import type { GuardianPanelHost } from '../OverworldScene';
import { makeKondoAvatar } from '../../art/kondo';
import { playGuardianChime } from '../../audio/sfx';
import { CANVAS_W } from '../../art/perspective';
import { fontPx } from '../../ui/text';
import { PANEL_BG } from '../../ui/theme';
import { MOVES, KONDO_MOVE_IDS, shopCost, moveDisplayName } from '../../data/materials';
import { persistFromRegistry } from '../../data/save';
import { renderChoiceList } from './passiveList';
import type { ChoiceListItem, ChoiceListState } from './passiveList';

// Kondo stands at world 8's middle tile (WORLD_GUARDIANS) and sells three
// self-buff moves (data/materials.ts's KONDO_MOVE_IDS -- Screening
// Pulse/Scattering Drag/Coherence Cascade, kept out of Noether's and
// Laughlin's own lists so Kondo is their one source), usable from any
// crystal form the player is currently wearing since a self-buff isn't
// gated by MOVE_COMPATIBILITY at all. Uses the same shared renderChoiceList
// (panels/passiveList.ts) Franklin's passive shop uses, not Laughlin's flat
// buy-only list -- see renderChoiceList's own comment for why: only one of
// the three can ever be usable in battle at a time (registry/save
// `kondoActiveMove`), so this panel is also the only place that switches
// it, not just the one that sells them.
export function showKondoPanel(scene: GuardianPanelHost) {
  scene.dialogueActive = true;

  const panelWidth = 600;
  const top = 20;
  const container = scene.add.container(0, 0).setDepth(100);
  scene.dialogueContainer = container;

  let y = top;

  const avatarY = y + 42;
  const avatar = makeKondoAvatar(scene);
  avatar.setPosition(CANVAS_W / 2, avatarY);
  container.add(avatar);
  scene.tweens.add({ targets: avatar, y: avatarY + 8, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  playGuardianChime();
  y = avatarY + 48;

  const intro = scene.add
    .text(
      CANVAS_W / 2,
      y,
      '"I am Kondo. Any crystal can turn its own disorder to its advantage -- screen itself, scatter its own signature, cascade its own coherence back together. Learn a technique, then tell me which one to hold. Only one at a time."',
      { fontSize: fontPx(scene, 11), fontStyle: 'italic', color: '#cfd8ff', align: 'center', wordWrap: { width: panelWidth - 80 } }
    )
    .setOrigin(0.5, 0);
  container.add(intro);
  y += intro.height + 14;

  y = renderChoiceList(scene, container, y, kondoChoiceItems(scene), kondoChoiceState(scene), () => showKondoPanel(scene));
  y += 8;
  y = scene.renderFarewellFooter(container, y);
  y += 8;

  const panelHeight = y - top;
  const panel = scene.add
    .rectangle(CANVAS_W / 2, top + panelHeight / 2, panelWidth, panelHeight, PANEL_BG, 0.94)
    .setStrokeStyle(2, 0xe86a44);
  container.addAt(panel, 0);
}

// KONDO_MOVE_IDS as ChoiceListItems -- display name folds in Feynman's level
// prefix (moveDisplayName), which is always a no-op for a not-yet-bought
// move (leveling requires already owning it), so this one field is correct
// for both the buy row and the already-bought "make active" row.
function kondoChoiceItems(scene: GuardianPanelHost): ChoiceListItem[] {
  return KONDO_MOVE_IDS.map((id) => ({
    id,
    name: moveDisplayName(scene.game.registry, id),
    description: MOVES[id].description ?? '',
    cost: shopCost(MOVES[id]),
  }));
}

// Kondo's own ChoiceListState: unlocking a Kondo move is really unlocking a
// battle move (`unlockedMoves`, read by the battle move menu itself, not a
// passives-only concept), and "active" is the single flat registry/save
// `kondoActiveMove` key rather than Franklin's per-owner map -- see
// ChoiceListState's own comment for why this stays an adapter instead of
// folding both kits onto one shared registry shape.
function kondoChoiceState(scene: GuardianPanelHost): ChoiceListState {
  return {
    isUnlocked: (id) => scene.getUnlockedMoves().includes(id),
    activeId: () => (scene.game.registry.get('kondoActiveMove') as string | null) ?? null,
    unlock: (id) => {
      scene.game.registry.set('unlockedMoves', [...scene.getUnlockedMoves(), id]);
      // The very first Kondo move bought becomes active automatically --
      // "picked for the first time" happens right here, in this same
      // conversation with Kondo, so there's no dead-purchase state where a
      // freshly bought move shows up nowhere in battle. Switching between
      // two-or-more already-bought moves still always requires its own
      // explicit "Make active" click.
      if (!scene.game.registry.get('kondoActiveMove')) {
        scene.game.registry.set('kondoActiveMove', id);
      }
      persistFromRegistry(scene.game.registry);
    },
    activate: (id) => {
      scene.game.registry.set('kondoActiveMove', id);
      persistFromRegistry(scene.game.registry);
    },
  };
}
