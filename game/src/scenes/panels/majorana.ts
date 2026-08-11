import type { OverworldScene } from '../OverworldScene';
import { makeMajoranaAvatar } from '../../art/majorana';
import { playGuardianChime } from '../../audio/sfx';
import { CANVAS_W } from '../../art/perspective';
import { fontPx } from '../../ui/text';
import { allCrystals, findMaterialByName, combineMaterials, hybridRecipeResult } from '../../data/materials';
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
export function showMajoranaPanel(scene: OverworldScene) {
  scene.dialogueActive = true;

  const panelWidth = 600;
  const top = 20;
  const container = scene.add.container(0, 0).setDepth(100);
  scene.dialogueContainer = container;

  let y = top;

  const avatarY = y + 55;
  const avatar = makeMajoranaAvatar(scene);
  avatar.setPosition(CANVAS_W / 2, avatarY);
  container.add(avatar);
  scene.tweens.add({ targets: avatar, y: avatarY + 8, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  playGuardianChime();
  y = avatarY + 65;

  const superposition = scene.isSuperpositionMode();
  const intro = scene.add
    .text(
      CANVAS_W / 2,
      y,
      superposition
        ? '"I am Majorana. In superposition every pairing is already possible -- fuse any two states that make physical sense together, defeated or not."'
        : '"I am Majorana. Fuse two states you already understand and see what phase they make together -- a magnet and a superconductor, say, become something with edges neither one had alone."',
      { fontSize: fontPx(scene, 12), fontStyle: 'italic', color: '#cfd8ff', align: 'center', wordWrap: { width: panelWidth - 80 } }
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
    y = scene.renderPagedButtons(
      container,
      y,
      partners,
      scene.majoranaPage,
      4,
      (m) => m.name,
      (m) => createHybrid(scene, first, m.name),
      (page) => {
        scene.majoranaPage = page;
        scene.dialogueContainer?.destroy(true);
        showMajoranaPanel(scene);
      }
    );
    const cancelBtn = scene.addDialogueButton(container, y, 'Never mind', () => {
      scene.majoranaSelection = null;
      scene.majoranaPage = 0;
      scene.dialogueContainer?.destroy(true);
      showMajoranaPanel(scene);
    });
    y += cancelBtn.height + 6;
  }
  y += 8;

  const closeBtn = scene.addDialogueButtonAt(container, CANVAS_W / 2, y, 'Farewell', () => scene.closeDialogue(), 300);
  y += closeBtn.height + 12;

  const panelHeight = y - top;
  const panel = scene.add
    .rectangle(CANVAS_W / 2, top + panelHeight / 2, panelWidth, panelHeight, 0x10101c, 0.94)
    .setStrokeStyle(2, 0x4fd97a);
  container.addAt(panel, 0);
}

function becomeHybrid(scene: OverworldScene, hybrid: Material) {
  scene.applyPlayerForm(hybrid);
  scene.dialogueContainer?.destroy(true);
  showMajoranaPanel(scene);
}

// findMaterialByName only searches WORLD_CRYSTALS -- both names passed in
// here always come from getDefeatedMaterials(), which only ever records
// real wild crystals (never a rival, never an earlier hybrid), so this
// should never actually miss; the early return is just defensive.
function createHybrid(scene: OverworldScene, nameA: string, nameB: string) {
  scene.majoranaSelection = null;
  const a = findMaterialByName(nameA);
  const b = findMaterialByName(nameB);
  if (!a || !b) {
    scene.dialogueContainer?.destroy(true);
    showMajoranaPanel(scene);
    return;
  }

  becomeHybrid(scene, combineMaterials(a, b));
}
