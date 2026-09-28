import type { GuardianPanelHost } from '../OverworldScene';
import { renderGuardianHeader } from './guardianHeader';
import { makeFranklinAvatar } from '../../art/franklin';
import { killTweensDeep } from '../../art/crystals';
import { CANVAS_W } from '../../art/perspective';
import { fontScale } from '../../ui/text';
import { PANEL_BG, REFERENCE_BLUE_GREY_HEX } from '../../ui/theme';
import {
  FRANKLIN_PASSIVE_IDS,
  PASSIVES,
  PASSIVE_MAX_SLOTS,
  PASSIVE_SLOT_COSTS,
  activePassiveIds,
  passiveSlotCount,
  passiveSlotsUsed,
} from '../../data/passives';
import type { ActivePassivesByOwner, PassiveOwner, PassiveSlotsByOwner } from '../../data/passives';
import { persistFromRegistry } from '../../data/save';
import {
  LIST_DETAIL_PANEL_W,
  listDetailColumns,
  renderListColumn,
  destroyPanel,
  insertColumnDivider,
  renderListColumnFooter,
  renderPassiveDetailHeader,
  renderStatusAndConfirm,
} from './listDetail';

// Franklin stands at world 9's middle tile (WORLD_GUARDIANS) and teaches
// five passive abilities (data/passives.ts's FRANKLIN_PASSIVE_IDS --
// Diffraction Shadow, Satellite Reflection, Amorphous Halo, Last
// Scattering, Full Reflection) instead of moves: a whole-battle always-on
// modifier picked here rather than something chosen from the move menu each
// turn. Every passive can be bought independently, but running one takes
// room: the crystal starts with no passive slot, Franklin sells up to
// PASSIVE_MAX_SLOTS of them one at a time (PASSIVE_SLOT_COSTS, the button
// under the list -- renderSlotButton below, deliberately not a row among
// the abilities), and each passive takes up `Passive.slots` of them while
// active. Which ones are active lives in registry/save
// activePassivesByOwner, oldest-equipped first; making a passive active
// with too little room free sets the oldest-equipped ones aside until it
// fits, and the detail pane's status line names them before the click.
//
// List+detail layout (scenes/panels/listDetail.ts, STYLE.md's "List+detail
// panels"), the same shape Kondo's panel uses: the left column names the
// five passives, a row click only *previews* it (scene.franklinPreview), and
// the right column shows the player's own current crystal standing on its
// ground shadow wearing that passive's own halo (art/passiveHalos.ts, the
// same halo BattleScene draws under the crystal when the passive is active)
// -- an active passive shows the whole active loadout, every active halo
// stacked at full alpha, since that is what the crystal wears in battle; an
// inactive one shows its own halo alone, dimmed -- then the passive's
// physics description, a cost/status line naming how many slots it takes,
// and a confirm button: "Learn <name>" for a still-unbought passive, "Make
// <name> active" for a bought one that isn't (dimmed while the crystal owns
// fewer slots than it needs), "Set <name> aside" for one that is. Buying a
// passive that fits in the free slots activates it in the same click, so a
// purchase is never invisible in the next battle; otherwise it doesn't, and
// switching is always its own explicit click. Like Kondo's self-buff moves,
// a passive is never gated by MOVE_COMPATIBILITY (a player-learned
// technique, not a quasiparticle a crystal has to host), so every row is
// always for sale until bought -- no "wrong form" empty state to render.
//
// A preview click is a scoped update, not a panel rebuild (CODEMAP's
// "scoped update" convention): the avatar, intro and list rows are built
// once per panel open, and clicking a row only restyles the highlighted row
// (listResult.setSelectedId) and re-renders `detailBlock`/`chromeBlock`.
// Buying, activating or setting aside still rebuilds the whole panel, since
// each changes state every row's own pane reads.
const OWNER: PassiveOwner = 'franklin';
// The slot button's own font cap: the left column is 200px wide and the
// label has to stay on one line there at the largest text-size preset,
// which the footer's own uncapped size would not.
const SLOT_BUTTON_CAP = 1.3;

// Which currently active passives a newly activated `id` would push out:
// the oldest-equipped ones, in order, until what is left plus `id` fits in
// `slots`. Shared by the status line (which names them) and activatePassive
// (which does it), so the two can never disagree.
function displacedBy(id: string, active: string[], slots: number): string[] {
  const kept = active.filter((a) => a !== id);
  const out: string[] = [];
  while (kept.length > 0 && passiveSlotsUsed(kept) + PASSIVES[id].slots > slots) out.push(kept.shift() as string);
  return out;
}

export function showFranklinPanel(scene: GuardianPanelHost) {
  scene.dialogueActive = true;

  const panelWidth = LIST_DETAIL_PANEL_W;
  const top = 20;
  const container = scene.add.container(0, 0).setDepth(100);
  scene.dialogueContainer = container;

  // Added first so everything below (divider, footer, panel background)
  // renders beneath every row/button added to `container` afterward.
  const chromeBlock = scene.add.container(0, 0);
  container.add(chromeBlock);

  let y = top;

  // Capped the same way Kondo's intro is (panels/kondo.ts): this panel
  // carries the full list+detail layout with a 104px art stage plus a
  // description under it, and an uncapped quote at the largest text-size
  // preset pushes the pane's own confirm button past the bottom of the
  // canvas.
  const introScale = Math.min(fontScale(scene), 1.15);
  y = renderGuardianHeader(scene, container, {
    y,
    panelWidth,
    avatar: makeFranklinAvatar,
    quote: '"Fire X-rays through a crystal full of defects and the sharp spots blur into rings. Every pore and dislocation leaves its mark in how the beam scatters. I can teach your crystal to scatter a blow the same way. A lesson needs room to hold, though: I sell that room slot by slot, and the heaviest lessons take all of it."',
    introPx: `${Math.round(11 * introScale)}px`,
  });

  const panelLeft = CANVAS_W / 2 - panelWidth / 2;
  const columns = listDetailColumns(panelLeft);
  const columnsTop = y;
  const slotButtonPx = `${Math.round(12 * Math.min(fontScale(scene), SLOT_BUTTON_CAP))}px`;

  // The slot button sits between the rows and Farewell, so the list is told
  // to keep that much room free (measured off a throwaway sample, the same
  // technique renderListColumn itself uses for its rows) rather than fitting
  // its rows right up to the footer.
  const sample = scene.addDialogueButtonAt(container, -1000, -1000, 'Sample', () => {}, columns.leftColW, slotButtonPx);
  const slotButtonH = sample.height;
  sample.destroy();

  let preview = FRANKLIN_PASSIVE_IDS.includes(scene.franklinPreview ?? '') ? (scene.franklinPreview as string) : FRANKLIN_PASSIVE_IDS[0];

  const listResult = renderListColumn({
    scene,
    container,
    x: columns.leftX,
    y: columnsTop,
    width: columns.leftColW,
    items: FRANKLIN_PASSIVE_IDS,
    idFor: (id) => id,
    labelFor: (id) => PASSIVES[id].name,
    selectedId: preview,
    page: scene.franklinPage,
    onPageChange: (page) => {
      scene.franklinPage = page;
      destroyPanel(scene);
      showFranklinPanel(scene);
    },
    onSelect: (id) => {
      scene.franklinPreview = id;
      preview = id;
      listResult.setSelectedId(id);
      renderDetail();
    },
    reserveBelow: slotButtonH + 6,
  });
  scene.franklinPage = listResult.page;

  const detailBlock = scene.add.container(0, 0);
  container.add(detailBlock);

  // The next rung of the slot ladder -- "Buy slot N (<cost>)" -- or, with
  // every slot bought, a dimmed "3 slots owned" tag (the same dimmed-current
  // convention every guardian panel's "(active)" tag uses). Rendered into
  // chromeBlock with the footer, since both sit under the list and are laid
  // out together.
  const renderSlotButton = (slots: number, tokens: number, atY: number): number => {
    const full = slots >= PASSIVE_MAX_SLOTS;
    const cost = full ? 0 : PASSIVE_SLOT_COSTS[slots];
    const btn = scene.addDialogueButtonAt(
      chromeBlock,
      columns.leftX + columns.leftColW / 2,
      atY,
      full ? `${PASSIVE_MAX_SLOTS} slots owned` : `Buy slot ${slots + 1} (${cost})`,
      () => {
        if (!full) buySlot(scene);
      },
      columns.leftColW,
      slotButtonPx
    );
    if (full || tokens < cost) btn.setAlpha(0.5);
    return atY + btn.height;
  };

  const renderDetail = () => {
    killTweensDeep(scene, detailBlock);
    detailBlock.removeAll(true);
    chromeBlock.removeAll(true);

    const registry = scene.game.registry;
    const unlocked = (registry.get('passivesUnlocked') as string[]) ?? [];
    const active = activePassiveIds(registry, OWNER);
    const slots = passiveSlotCount(registry, OWNER);
    const tokens = (registry.get('qumatessence') as number) || 0;
    const id = preview;
    const passive = PASSIVES[id];
    const name = passive.name;
    const isLearned = unlocked.includes(id);
    const isActive = active.includes(id);

    let rightY = columnsTop;
    rightY = renderPassiveDetailHeader(
      scene,
      detailBlock,
      scene.playerMaterial,
      name,
      isActive ? active : [id],
      isActive ? 1 : 0.45,
      columns.rightColCenterX,
      rightY,
      columns.rightColW
    );

    const descScale = Math.min(fontScale(scene), 1.2);
    const descText = scene.add
      .text(columns.rightColCenterX, rightY, passive.description, {
        fontSize: `${Math.round(11 * descScale)}px`,
        color: REFERENCE_BLUE_GREY_HEX,
        align: 'center',
        wordWrap: { width: columns.rightColW },
      })
      .setOrigin(0.5, 0);
    detailBlock.add(descText);
    rightY += descText.height + 6;

    const slotWord = passive.slots === 1 ? 'slot' : 'slots';
    const free = slots - passiveSlotsUsed(active);
    const tooFewSlots = passive.slots > slots;
    const displaced = displacedBy(id, active, slots).map((a) => PASSIVES[a].name);
    let status: string;
    if (!isLearned) status = `Costs ${passive.cost} qumatessence to learn. Takes ${passive.slots} ${slotWord}.`;
    else if (isActive) status = `${name} is active, taking ${passive.slots} of your ${slots} ${slots === 1 ? 'slot' : 'slots'}.`;
    else if (tooFewSlots) status = `Learned, but not active: it takes ${passive.slots} ${slotWord} and your crystal owns ${slots}.`;
    else if (displaced.length === 0) status = `Learned, but not currently active. Takes ${passive.slots} ${slotWord}; ${free} free.`;
    else {
      const names = displaced.length > 1 ? `${displaced.slice(0, -1).join(', ')} and ${displaced[displaced.length - 1]}` : displaced[0];
      status = `Learned, but not currently active. Takes ${passive.slots} ${slotWord}; making it active sets ${names} aside.`;
    }
    rightY = renderStatusAndConfirm({
      scene,
      container: detailBlock,
      centerX: columns.rightColCenterX,
      y: rightY,
      colW: columns.rightColW,
      status,
      confirm: {
        label: !isLearned ? `Learn ${name}` : isActive ? `Set ${name} aside` : `Make ${name} active`,
        onClick: () => {
          if (!isLearned) buyPassive(scene, id, passive.cost);
          else if (isActive) deactivatePassive(scene, id);
          else if (!tooFewSlots) activatePassive(scene, id);
        },
        dimmed: (!isLearned && tokens < passive.cost) || (isLearned && !isActive && tooFewSlots),
      },
    });

    const slotBottom = renderSlotButton(slots, tokens, listResult.bottom + 6);
    const leftBottom = renderListColumnFooter(scene, chromeBlock, columns, slotBottom + 4, 'Farewell', () => scene.closeDialogue());
    const columnsBottom = Math.max(leftBottom, rightY);
    insertColumnDivider(scene, chromeBlock, columns.dividerX, columnsTop, columnsBottom);
    const panelHeight = columnsBottom + 14 - top;
    const panel = scene.add
      .rectangle(CANVAS_W / 2, top + panelHeight / 2, panelWidth, panelHeight, PANEL_BG, 0.94)
      .setStrokeStyle(2, 0xa878c9);
    chromeBlock.addAt(panel, 0);
  };
  renderDetail();
}

function writeActive(scene: GuardianPanelHost, ids: string[]) {
  const byOwner = { ...((scene.game.registry.get('activePassivesByOwner') as ActivePassivesByOwner) ?? {}) };
  byOwner[OWNER] = ids;
  scene.game.registry.set('activePassivesByOwner', byOwner);
}

function reopen(scene: GuardianPanelHost) {
  persistFromRegistry(scene.game.registry);
  destroyPanel(scene);
  showFranklinPanel(scene);
}

function buyPassive(scene: GuardianPanelHost, id: string, cost: number) {
  if ((scene.game.registry.get('qumatessence') as number) < cost) return;
  scene.qumatessence -= cost;
  scene.game.registry.set('qumatessence', scene.qumatessence);
  scene.tokenText.setText(`Qumatessence: ${scene.qumatessence}`);
  const unlocked = (scene.game.registry.get('passivesUnlocked') as string[]) ?? [];
  scene.game.registry.set('passivesUnlocked', [...unlocked, id]);
  // A purchase that fits in the free slots goes straight into them --
  // "picked by talking to Franklin" happens right here, in this same
  // conversation, so there's no dead-purchase state where a freshly bought
  // passive shows up nowhere in battle. One that doesn't fit doesn't: which
  // active passive to give up (or which slot to buy) is the player's own
  // explicit click.
  const active = activePassiveIds(scene.game.registry, OWNER);
  if (passiveSlotsUsed(active) + PASSIVES[id].slots <= passiveSlotCount(scene.game.registry, OWNER)) writeActive(scene, [...active, id]);
  reopen(scene);
}

// Fills the free slots, or, when they are not enough, sets the
// oldest-equipped passives aside until they are (displacedBy above -- the
// same list the status line named before the click). Never called with a
// passive that needs more slots than the crystal owns (its button is inert).
function activatePassive(scene: GuardianPanelHost, id: string) {
  const active = activePassiveIds(scene.game.registry, OWNER);
  const displaced = new Set(displacedBy(id, active, passiveSlotCount(scene.game.registry, OWNER)));
  writeActive(scene, [...active.filter((a) => a !== id && !displaced.has(a)), id]);
  reopen(scene);
}

function deactivatePassive(scene: GuardianPanelHost, id: string) {
  writeActive(
    scene,
    activePassiveIds(scene.game.registry, OWNER).filter((a) => a !== id)
  );
  reopen(scene);
}

function buySlot(scene: GuardianPanelHost) {
  const slots = passiveSlotCount(scene.game.registry, OWNER);
  if (slots >= PASSIVE_MAX_SLOTS) return;
  const cost = PASSIVE_SLOT_COSTS[slots];
  if ((scene.game.registry.get('qumatessence') as number) < cost) return;
  scene.qumatessence -= cost;
  scene.game.registry.set('qumatessence', scene.qumatessence);
  scene.tokenText.setText(`Qumatessence: ${scene.qumatessence}`);
  const byOwner = { ...((scene.game.registry.get('passiveSlotsByOwner') as PassiveSlotsByOwner) ?? {}) };
  byOwner[OWNER] = slots + 1;
  scene.game.registry.set('passiveSlotsByOwner', byOwner);
  reopen(scene);
}
