import type { GuardianPanelHost } from '../OverworldScene';
import { makeMajoranaAvatar } from '../../art/majorana';
import { playGuardianChime } from '../../audio/sfx';
import { CANVAS_W } from '../../art/perspective';
import { fontPx } from '../../ui/text';
import { PANEL_BG } from '../../ui/theme';
import { allCrystals, findMaterialByName, combineMaterials, hybridRecipeResult, MAJORANA_FUSE_COST } from '../../data/materials';
import { persistFromRegistry } from '../../data/save';
import type { Material, MaterialType } from '../../data/types';

// Majorana stands at world 5's middle tile (WORLD_GUARDIANS) and lets the
// player fuse two crystals they've already defeated into a new
// topological hybrid (data/materials.ts's combineMaterials), becoming it
// immediately via the same applyPlayerForm helper Dresselhaus's transmutation
// uses. A two-step pick (scene.majoranaSelection holds the first choice
// while the panel rebuilds for the second) rather than one list of every
// pair, since the pair count grows quadratically with how many crystals
// are shown and a two-step flow reads more like an actual choice anyway.
// Deliberately no memory of earlier fusions to instantly re-become --
// every visit picks a fresh pair, the same as any other combine; the
// player's *current* form (which may already be an earlier hybrid) still
// persists on its own via `playerForm`, this only concerns re-selecting a
// past one without redoing the two-step pick. Superposition Mode replaces
// "defeated" with every crystal in the game (allCrystals()) as the
// ingredient pool, paginated (renderPagedButtons) at both steps since
// that pool is far bigger than a normal defeat count.
// Each individual hybrid *result* is its own one-time MAJORANA_FUSE_COST
// qumatessence unlock (registry/save `majoranaUnlockedResults`, a list of
// result names already paid for), not a single flat unlock for the whole
// mechanic -- keyed by the fused result's own name (not the parent pair)
// since HYBRID_RECIPES currently has no two different pairs producing the
// same result, so "have I paid to become this hybrid" is the same question
// regardless of which pair first reaches it. The cost only shows up at the
// second step (picking a specific partner), since that's the point a
// specific result is actually known and about to be committed to -- the
// first step (picking which crystal to start from) stays a free browse,
// same as ever, so backing out via "Never mind" after only choosing a
// first crystal never costs anything. A not-yet-unlocked partner shows the
// cost in its row label and dims if unaffordable; picking it is itself
// both the purchase and the fuse, there's no separate "unlock, then fuse
// later" step. Superposition Mode bypasses this per-result cost entirely
// (`isSuperpositionMode()`, not the persisted list).
export function showMajoranaPanel(scene: GuardianPanelHost) {
  scene.dialogueActive = true;

  const panelWidth = 600;
  const top = 20;
  const container = scene.add.container(0, 0).setDepth(100);
  scene.dialogueContainer = container;

  let y = top;

  const avatarY = y + 42;
  const avatar = makeMajoranaAvatar(scene);
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
        ? '"I am Majorana. In superposition every pairing is already possible -- fuse any two states that make physical sense together, defeated or not."'
        : '"I am Majorana. Fuse two states you already understand and see what phase they make together -- a magnet and a superconductor, say, become something with edges neither one had alone."',
      { fontSize: fontPx(scene, 11), fontStyle: 'italic', color: '#cfd8ff', align: 'center', wordWrap: { width: panelWidth - 80 } }
    )
    .setOrigin(0.5, 0);
  container.add(intro);
  y += intro.height + 14;

  // Every world's wild pool is often a single main type (world 6 is all
  // 'classicalMagnet', world 7 all 'quantumSpinLiquid', ...), so a same-world-only
  // recency window (Dresselhaus's `slice(-3)`, fine there since any single
  // defeated crystal is a valid transmute target) would make Majorana's
  // paired requirement nearly unreachable -- the player's last few
  // defeats right before reaching him are almost always all the same
  // type. `pool` is the *whole* `defeatedMaterials` history normally (an
  // earlier world's magnet still counts) or, in Superposition Mode, every
  // crystal in the game -- either way filtered for combinability first,
  // then paginated for display rather than an arbitrary recency cap.
  const pool: { name: string; type: MaterialType }[] = superposition ? allCrystals() : scene.getDefeatedMaterials();
  const isCombinable = (m: { name: string; type: MaterialType }) =>
    pool.some((other) => other.name !== m.name && hybridRecipeResult(m.name, other.name));
  const combinable = pool.filter(isCombinable).sort((a, b) => a.name.localeCompare(b.name));

  // Set true only when the "Never mind"+Farewell combined row below
  // renders, so the generic single-Farewell footer further down is skipped
  // in that case rather than adding a second one.
  let footerRendered = false;
  if (scene.majoranaSelection === null) {
    if (combinable.length < 2) {
      const text = scene.add
        .text(
          CANVAS_W / 2,
          y,
          "None of the crystals you've defeated pair into a known hybrid recipe yet -- Majorana only knows specific real pairings (e.g. Aluminum + Indium Arsenide, or two Graphenes together).",
          { fontSize: fontPx(scene, 13), color: '#ffffff', align: 'center', wordWrap: { width: 480 } }
        )
        .setOrigin(0.5, 0);
      container.add(text);
      y += text.height;
    } else {
      const label = scene.add
        .text(CANVAS_W / 2, y, 'Combine which crystal?', {
          fontSize: fontPx(scene, 12),
          color: '#9fffb0',
          align: 'center',
        })
        .setOrigin(0.5, 0);
      container.add(label);
      y += label.height + 6;
      y = scene.renderPagedButtons(
        container,
        y,
        combinable,
        scene.majoranaPage,
        4,
        (m) => m.name,
        (m) => {
          scene.majoranaSelection = m.name;
          scene.majoranaPage = 0;
          scene.dialogueContainer?.destroy(true);
          showMajoranaPanel(scene);
        },
        (page) => {
          scene.majoranaPage = page;
          scene.dialogueContainer?.destroy(true);
          showMajoranaPanel(scene);
        }
      );
    }
  } else {
    const first = scene.majoranaSelection;
    const label = scene.add
      .text(CANVAS_W / 2, y, `Combine ${first} with...`, {
        fontSize: fontPx(scene, 12),
        color: '#9fffb0',
        align: 'center',
        wordWrap: { width: 480 },
      })
      .setOrigin(0.5, 0);
    container.add(label);
    y += label.height + 6;
    const partners = pool
      .filter((m) => m.name !== first && hybridRecipeResult(first, m.name))
      .sort((a, b) => a.name.localeCompare(b.name));
    const unlockedResults = (scene.game.registry.get('majoranaUnlockedResults') as string[]) ?? [];
    const isUnlocked = (resultName: string) => superposition || unlockedResults.includes(resultName);
    const tokens = (scene.game.registry.get('qumatessence') as number) || 0;
    y = scene.renderPagedButtons(
      container,
      y,
      partners,
      scene.majoranaPage,
      4,
      (m) => {
        const result = hybridRecipeResult(first, m.name)!;
        return isUnlocked(result.name) ? m.name : `${m.name} (${MAJORANA_FUSE_COST} qumatessence)`;
      },
      (m) => createHybrid(scene, first, m.name, unlockedResults),
      (page) => {
        scene.majoranaPage = page;
        scene.dialogueContainer?.destroy(true);
        showMajoranaPanel(scene);
      },
      (m) => {
        const result = hybridRecipeResult(first, m.name)!;
        return !isUnlocked(result.name) && tokens < MAJORANA_FUSE_COST;
      }
    );
    // Shares one row with Farewell (side by side, same convention the goal
    // panel's own Farewell/Continue footer uses) rather than stacking two
    // separate footer rows -- this step already carries the most chrome of
    // any state in the panel (avatar, intro, "Combine X with..." label, the
    // partner list itself), so reclaiming a full row's height here is what
    // keeps it inside the canvas at the largest text-size preset.
    y =
      scene.renderCancelFarewellFooter(container, y, 'Never mind', () => {
        scene.majoranaSelection = null;
        scene.majoranaPage = 0;
        scene.dialogueContainer?.destroy(true);
        showMajoranaPanel(scene);
      }) + 12;
    footerRendered = true;
  }
  if (!footerRendered) {
    y += 8;
    y = scene.renderFarewellFooter(container, y) + 12;
  }

  const panelHeight = y - top;
  const panel = scene.add
    .rectangle(CANVAS_W / 2, top + panelHeight / 2, panelWidth, panelHeight, PANEL_BG, 0.94)
    .setStrokeStyle(2, 0x4fd97a);
  container.addAt(panel, 0);
}

function becomeHybrid(scene: GuardianPanelHost, hybrid: Material) {
  scene.applyPlayerForm(hybrid);
  scene.dialogueContainer?.destroy(true);
  showMajoranaPanel(scene);
}

// findMaterialByName only searches WORLD_CRYSTALS -- both names passed in
// here always come from getDefeatedMaterials(), which only ever records
// real wild crystals (never a rival, never an earlier hybrid), so this
// should never actually miss; the early return is just defensive.
// `unlockedResults` is the registry snapshot read by the panel just before
// this was called -- if the result isn't unlocked yet, this is also where
// the MAJORANA_FUSE_COST purchase actually happens (Superposition Mode
// never reaches the paid branch, since the panel's own isUnlocked check
// already treats every result as unlocked there).
function createHybrid(scene: GuardianPanelHost, nameA: string, nameB: string, unlockedResults: string[]) {
  scene.majoranaSelection = null;
  const a = findMaterialByName(nameA);
  const b = findMaterialByName(nameB);
  if (!a || !b) {
    scene.dialogueContainer?.destroy(true);
    showMajoranaPanel(scene);
    return;
  }

  const hybrid = combineMaterials(a, b);
  if (!scene.isSuperpositionMode() && !unlockedResults.includes(hybrid.name)) {
    if ((scene.game.registry.get('qumatessence') as number) < MAJORANA_FUSE_COST) return;
    scene.qumatessence -= MAJORANA_FUSE_COST;
    scene.game.registry.set('qumatessence', scene.qumatessence);
    scene.tokenText.setText(`Qumatessence: ${scene.qumatessence}`);
    scene.game.registry.set('majoranaUnlockedResults', [...unlockedResults, hybrid.name]);
    persistFromRegistry(scene.game.registry);
  }
  becomeHybrid(scene, hybrid);
}
