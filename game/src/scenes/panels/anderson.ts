import type Phaser from 'phaser';
import type { GuardianPanelHost } from '../OverworldScene';
import { makeAndersonAvatar } from '../../art/anderson';
import { killTweensDeep } from '../../art/crystals';
import { playGuardianChime } from '../../audio/sfx';
import { CANVAS_W } from '../../art/perspective';
import { fontPx, fontScale } from '../../ui/text';
import { PANEL_BG } from '../../ui/theme';
import { MOVES, allCrystals, isHybridMaterial, findMaterialByName, getBattleMoves, ANDERSON_DOPE_COST } from '../../data/materials';
import { persistFromRegistry } from '../../data/save';
import {
  LIST_DETAIL_PANEL_W,
  listDetailColumns,
  renderListColumn,
  destroyPanel,
  insertColumnDivider,
  renderListColumnFooter,
  renderDetailCrystalHeader,
  renderStatusAndConfirm,
} from './listDetail';

// Anderson stands at world 6's middle tile (WORLD_GUARDIANS) and lets the
// player "dope in" a crystal they've encountered (or, in Superposition
// Mode, any crystal in the game) as an impurity, then learn one specific
// move from its moveset -- an Anderson-impurity take on the same idea
// Dresselhaus/Majorana explore differently: Dresselhaus becomes the whole
// state, Majorana fuses two states together, Anderson borrows just one
// excitation channel from a state without becoming it. Picking a host only
// records which one the player is browsing (`scene.andersonSelection`) --
// it does *not* touch the active impurity, so looking at a candidate's
// moveset and backing out without learning anything leaves whatever was
// doped in before untouched. The registry/save `andersonDopant` (persists
// across battles and reloads, replacing whatever was doped in before --
// only one impurity species at a time) is written by learnImpurityMove
// below, at the same moment the chosen move becomes a completely ordinary
// entry in `unlockedMoves` -- picking a host and committing to one of its
// moves is a single action, not two. MOVE_COMPATIBILITY still gates whether
// a move actually shows up in the battle move menu (getBattleMoves), but
// that gate checks the player's own current form *or* the currently
// doped-in impurity's type -- an impurity state is a real, local excitation
// for as long as the impurity itself stays doped in, and it goes away the
// moment a different crystal is doped in instead, the same way a real
// dopant atom's bound states vanish if you swap in a different dopant
// species. Host pool excludes any `isHybridMaterial` (a Majorana fusion, or
// one of world 10's own named recipe-result wilds) -- doping in an impurity
// is meant to be one real, single-crystal excitation, not a channel a
// fusion has borrowed from elsewhere.
// The host-pick step below is a list+detail layout (scenes/panels/
// listDetail.ts, STYLE.md's "List+detail panels"): the left column just
// names candidates; clicking one only *previews* it in the right column
// (`scene.andersonHostPreview`), free to browse -- the right column's own
// "Dope in <name>" button is what actually commits to that host and
// advances to the second step (`scene.andersonSelection`), still costing
// nothing itself; the ANDERSON_DOPE_COST charge only ever happens on the
// *second* step, picking a specific move to learn (learnImpurityMove). A
// preview click there is a scoped update, not a panel rebuild (CODEMAP's
// "scoped update" convention): the avatar, intro and list rows are built
// once per panel open, and clicking a row only restyles the highlighted row
// (listResult.setSelectedId) and re-renders `detailBlock`/`chromeBlock`.
// The second step (which move to learn) is a flat paginated button list
// (renderPagedButtons, scene.andersonMovePage) -- a move has no crystal art
// of its own to preview, so it doesn't get a list+detail treatment.
// The "which move" step offers only moves that would newly become usable by
// doping this host in (compares the host's moveset against
// `getBattleMoves` computed with whatever's doped in *right now*, not
// against raw `unlockedMoves`) -- Superposition Mode auto-grants every move
// id to `unlockedMoves` on every world entry, so comparing against raw
// `unlockedMoves` would report every host as teaching nothing there, making
// the whole learn step permanently unreachable.
// Each individual host is its own one-time ANDERSON_DOPE_COST qumatessence
// unlock (registry/save `andersonUnlockedHosts`, a list of host crystal
// names already paid for), keyed by host rather than by which move was
// learned -- once a host is unlocked, doping into it and learning *any* of
// its moves (now or later) is free. Superposition Mode bypasses this
// per-host cost entirely (`isSuperpositionMode()`, not the persisted list).
export function showAndersonPanel(scene: GuardianPanelHost) {
  scene.dialogueActive = true;

  const panelWidth = LIST_DETAIL_PANEL_W;
  const top = 20;
  const container = scene.add.container(0, 0).setDepth(100);
  scene.dialogueContainer = container;

  // Added first so everything below (divider, footer, panel background)
  // renders beneath every row/button added to `container` afterward.
  const chromeBlock = scene.add.container(0, 0);
  container.add(chromeBlock);

  const finishPanel = (yEnd: number, target: Phaser.GameObjects.Container) => {
    const panelHeight = yEnd - top;
    const panel = scene.add
      .rectangle(CANVAS_W / 2, top + panelHeight / 2, panelWidth, panelHeight, PANEL_BG, 0.94)
      .setStrokeStyle(2, 0xc9884a);
    target.addAt(panel, 0);
  };

  let y = top;

  const avatarY = y + 42;
  const avatar = makeAndersonAvatar(scene);
  avatar.setPosition(CANVAS_W / 2, avatarY);
  container.add(avatar);
  scene.tweens.add({ targets: avatar, y: avatarY + 8, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  playGuardianChime();
  y = avatarY + 48;

  const superposition = scene.isSuperpositionMode();
  const intro = scene.add
    .text(
      CANVAS_W / 2,
      y,
      superposition
        ? '"I am Anderson. In superposition any quantum material can be doped in as an impurity. Pick one, and I\'ll teach you the channel it opens, active for as long as that impurity stays doped in; a new one replaces it."'
        : '"I am Anderson. Dope in a defeated quantum material as an impurity, and I\'ll teach you the one channel it opens, active only while that impurity stays doped in; a new dopant replaces it. One impurity, placed on purpose, is a question. Enough of them, placed by no one, is a verdict. I teach the dose."',
      { fontSize: fontPx(scene, 11), fontStyle: 'italic', color: '#cfd8ff', align: 'center', wordWrap: { width: panelWidth - 80 } }
    )
    .setOrigin(0.5, 0);
  container.add(intro);
  y += intro.height + 14;

  // Font capped tighter than the detail-pane content below (Franklin's own
  // precedent for capping a font against overflow, STYLE.md, applied more
  // aggressively here) -- this line plus the "Dope in which crystal?" label
  // sit above the two-column area, so their size pushes columnsTop (and with
  // it the fixed-height right column below) down; an uncapped or lightly
  // capped size at the largest text-size preset was enough on its own to
  // overflow the canvas.
  const headlineScale = Math.min(fontScale(scene), 1.05);
  const currentDopant = (scene.game.registry.get('andersonDopant') as string | null) ?? null;
  if (currentDopant) {
    const dopedText = scene.add
      .text(CANVAS_W / 2, y, `Currently doped with: ${currentDopant}`, {
        fontSize: `${Math.round(12 * headlineScale)}px`,
        color: '#8fd6a0',
        align: 'center',
      })
      .setOrigin(0.5, 0);
    container.add(dopedText);
    y += dopedText.height + 6;
  }

  // Doping in a hybrid (isHybridMaterial -- a Majorana fusion, or one of
  // world 10's own named recipe-result wilds) isn't offered here: an
  // impurity is meant to be one real, single-crystal excitation, not a
  // channel already borrowed from elsewhere.
  const pool: { name: string }[] = (superposition ? allCrystals() : scene.getDefeatedMaterials()).filter(
    (m) => !isHybridMaterial(m.name)
  );

  // Set true only when the "Never mind"+Farewell combined row below
  // renders, so the generic single-Farewell footer at the very end of this
  // function is skipped in that case rather than adding a second one.
  let footerRendered = false;
  if (scene.andersonSelection === null) {
    if (pool.length === 0) {
      const text = scene.add
        .text(CANVAS_W / 2, y, "You haven't defeated any original materials yet, so there is nothing to dope in.", {
          fontSize: fontPx(scene, 13),
          color: '#ffffff',
          align: 'center',
          wordWrap: { width: 480 },
        })
        .setOrigin(0.5, 0);
      container.add(text);
      y += text.height;
    } else {
      const label = scene.add
        .text(CANVAS_W / 2, y, 'Dope in which material?', {
          fontSize: `${Math.round(12 * headlineScale)}px`,
          color: '#e8b27a',
          align: 'center',
        })
        .setOrigin(0.5, 0);
      container.add(label);
      y += label.height + 4;

      const sorted = pool.slice().sort((a, b) => a.name.localeCompare(b.name));
      const panelLeft = CANVAS_W / 2 - panelWidth / 2;
      const columns = listDetailColumns(panelLeft);
      const columnsTop = y;

      let preview = sorted.some((c) => c.name === scene.andersonHostPreview) ? (scene.andersonHostPreview as string) : sorted[0].name;

      const listResult = renderListColumn({
        scene,
        container,
        x: columns.leftX,
        y: columnsTop,
        width: columns.leftColW,
        items: sorted,
        idFor: (m) => m.name,
        labelFor: (m) => m.name,
        selectedId: preview,
        page: scene.andersonPage,
        onPageChange: (page) => {
          scene.andersonPage = page;
          destroyPanel(scene);
          showAndersonPanel(scene);
        },
        onSelect: (m) => {
          scene.andersonHostPreview = m.name;
          preview = m.name;
          listResult.setSelectedId(m.name);
          renderDetail();
        },
      });
      scene.andersonPage = listResult.page;

      const detailBlock = scene.add.container(0, 0);
      container.add(detailBlock);

      const renderDetail = () => {
        killTweensDeep(scene, detailBlock);
        detailBlock.removeAll(true);
        chromeBlock.removeAll(true);

        const previewMaterial = findMaterialByName(preview);
        let rightY = columnsTop;
        if (previewMaterial) {
          rightY = renderDetailCrystalHeader(scene, detailBlock, previewMaterial, columns.rightColCenterX, rightY, columns.rightColW);

          const unlockedHosts = (scene.game.registry.get('andersonUnlockedHosts') as string[]) ?? [];
          const hostUnlocked = superposition || unlockedHosts.includes(previewMaterial.name);

          rightY = renderStatusAndConfirm({
            scene,
            container: detailBlock,
            centerX: columns.rightColCenterX,
            y: rightY,
            colW: columns.rightColW,
            // Capped tighter than the other panels' 1.2, for the same
            // reason the headline above is: this pane sits under two extra
            // header lines of Anderson's own.
            statusCap: 1.1,
            status: hostUnlocked
              ? 'Already unlocked, free to learn its moves.'
              : `Costs ${ANDERSON_DOPE_COST} qumatessence to unlock (one-time, host-wide).`,
            // Picking a host to browse its moveset is always free -- only
            // committing to one of its actual moves at the second step
            // (learnImpurityMove) can spend ANDERSON_DOPE_COST -- so this
            // confirm button just advances to that step, and never dims on
            // affordability the way every other guardian's buy button does.
            confirm: {
              label: `Dope in ${previewMaterial.name}`,
              onClick: () => {
                scene.andersonSelection = previewMaterial.name;
                scene.andersonPage = 0;
                scene.andersonMovePage = 0;
                scene.andersonHostPreview = null;
                destroyPanel(scene);
                showAndersonPanel(scene);
              },
            },
          });
        }

        const leftBottom = renderListColumnFooter(scene, chromeBlock, columns, listResult.bottom + 10, 'Farewell', () => scene.closeDialogue());
        const columnsBottom = Math.max(leftBottom, rightY);
        insertColumnDivider(scene, chromeBlock, columns.dividerX, columnsTop, columnsBottom);
        finishPanel(columnsBottom + 14, chromeBlock);
      };
      renderDetail();
      return;
    }
  } else {
    const host = findMaterialByName(scene.andersonSelection);
    // What this host would actually add if doped in, not just what's absent
    // from `unlockedMoves` -- Superposition Mode auto-grants every move id
    // to `unlockedMoves` on every world entry (OverworldScene's
    // applySuperpositionLeveling), so "not yet unlocked" is never true there
    // and this step would otherwise always report every host as teaching
    // nothing. `getBattleMoves` is read here *before* this host becomes the
    // active dopant (that only happens in learnImpurityMove below), so it
    // reflects what's usable under the player's current form and whichever
    // impurity is doped in right now -- exactly the baseline a host's own
    // moves should be compared against to find what's genuinely new.
    const currentlyUsable = new Set(getBattleMoves(scene.game.registry));
    const learnable = host ? host.moves.filter((id) => !currentlyUsable.has(id)) : [];
    const label = scene.add
      .text(CANVAS_W / 2, y, `Learn which move from ${scene.andersonSelection}?`, {
        fontSize: fontPx(scene, 12),
        color: '#e8b27a',
        align: 'center',
        wordWrap: { width: 480 },
      })
      .setOrigin(0.5, 0);
    container.add(label);
    y += label.height + 6;

    if (learnable.length === 0) {
      const text = scene.add
        .text(CANVAS_W / 2, y, `You already carry every move ${scene.andersonSelection} has to offer.`, {
          fontSize: fontPx(scene, 13),
          color: '#ffffff',
          align: 'center',
          wordWrap: { width: 480 },
        })
        .setOrigin(0.5, 0);
      container.add(text);
      y += text.height + 6;
    } else {
      const unlockedHosts = (scene.game.registry.get('andersonUnlockedHosts') as string[]) ?? [];
      const hostUnlocked = superposition || unlockedHosts.includes(scene.andersonSelection);
      const tokens = (scene.game.registry.get('qumatessence') as number) || 0;
      const affordable = hostUnlocked || tokens >= ANDERSON_DOPE_COST;
      // Paginated (renderPagedButtons) even though a host only ever offers
      // 1-2 moves in practice (crystal() never assigns more) -- a
      // not-yet-unlocked host's cost suffix on each row still needs the
      // same measured shrink-to-fit protection every other candidate list
      // gets, rather than an unprotected fixed render. A flat button list
      // rather than the list+detail layout the host-pick step above uses --
      // a move has no crystal art of its own to preview.
      const learnableItems = learnable.map((id) => ({ id, name: MOVES[id].name, power: MOVES[id].power }));
      y = scene.renderPagedButtons(
        container,
        y,
        learnableItems,
        scene.andersonMovePage,
        4,
        (m) => (hostUnlocked ? `${m.name} (Pwr ${m.power})` : `${m.name} (Pwr ${m.power}): ${ANDERSON_DOPE_COST} qumatessence`),
        (m) => learnImpurityMove(scene, m.id, hostUnlocked, unlockedHosts),
        (page) => {
          scene.andersonMovePage = page;
          destroyPanel(scene);
          showAndersonPanel(scene);
        },
        () => !affordable
      );
    }
    // Shares one row with Farewell (side by side, same convention the goal
    // panel's own Farewell/Continue footer uses) rather than stacking two
    // separate footer rows -- this step already carries the most chrome of
    // any state in the panel (avatar, intro, "Learn which move" label, the
    // move list itself), so reclaiming a full row's height here is what
    // keeps it inside the canvas at the largest text-size preset.
    y =
      scene.renderCancelFarewellFooter(container, y, 'Never mind', () => {
        scene.andersonSelection = null;
        scene.andersonPage = 0;
        scene.andersonMovePage = 0;
        destroyPanel(scene);
        showAndersonPanel(scene);
      }) + 12;
    footerRendered = true;
  }
  if (!footerRendered) {
    y += 8;
    y = scene.renderFarewellFooter(container, y) + 12;
  }

  finishPanel(y, container);
}

// Learning a move is the one action that actually commits to a new
// impurity: this is the only place `andersonDopant` gets written (the
// host-pick step in showAndersonPanel only records which host the player is
// browsing/previewing, so looking at a candidate's moves and backing out via
// "Never mind"/"Farewell" leaves whatever was doped in before untouched).
// Once committed, `unlockedMoves` gets the ordinary append and
// getBattleMoves unions this dopant's MOVE_COMPATIBILITY classes into the
// player's own to decide what's actually usable in battle. `hostUnlocked`/
// `unlockedHosts` are the panel's own snapshot from just before this was
// called -- if the host isn't unlocked yet, this is also where the
// ANDERSON_DOPE_COST purchase happens (guarded by an affordability check,
// same as any other paid row's click handler); once paid, this host stays
// free to dope into and learn from for the rest of the save.
function learnImpurityMove(scene: GuardianPanelHost, moveId: string, hostUnlocked: boolean, unlockedHosts: string[]) {
  if (!hostUnlocked) {
    if ((scene.game.registry.get('qumatessence') as number) < ANDERSON_DOPE_COST) return;
    scene.qumatessence -= ANDERSON_DOPE_COST;
    scene.game.registry.set('qumatessence', scene.qumatessence);
    scene.tokenText.setText(`Qumatessence: ${scene.qumatessence}`);
    scene.game.registry.set('andersonUnlockedHosts', [...unlockedHosts, scene.andersonSelection]);
  }
  const unlocked = scene.getUnlockedMoves();
  if (!unlocked.includes(moveId)) {
    scene.game.registry.set('unlockedMoves', [...unlocked, moveId]);
  }
  scene.game.registry.set('andersonDopant', scene.andersonSelection);
  persistFromRegistry(scene.game.registry);
  scene.andersonSelection = null;
  scene.andersonPage = 0;
  scene.andersonMovePage = 0;
  destroyPanel(scene);
  showAndersonPanel(scene);
}
