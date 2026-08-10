# Code Map

Living reference for **where things live in the code**, companion to `DESIGN.md`
(mechanics/content) and `STYLE.md` (visual look). Those two answer "what should this do" and
"what should this look like"; this one answers "which file, which function, which existing
pattern to reuse" -- so a future session can implement a new feature without re-reading the
whole `game/src/` tree first. Edit this in place as the code changes; if something below goes
stale, fix it rather than leaving it wrong.

## File tree

```
game/src/
  main.ts                    Phaser game config, scene list, boot order
  scenes/
    TitleScene.ts             Loads save -> registry, title showcase crystals, "Continue"/"New Game" -> Hub, Debug Mode toggle
    HubScene.ts                World 0, static room, 3 hotspots (Materialdex/Save/Door, door doubles
                                 as a debug world-select when Debug Mode is on)
    OverworldScene.ts          Per-world walkable map: movement, encounters, shop, rival gate
    BattleScene.ts             Turn-based battle: move buttons, HP bars, attack effects, log
  world/
    mapgen.ts                  Per-world corridor layout generator (walkable grid, branches)
  art/
    perspective.ts             Pseudo-3D projection (grid coord -> screen point)
    biomes.ts                  Per-world visual skin (sky, walls, path, decoration, fog)
    crystals.ts                 makeCrystal() -- shared shard/cluster/prism sprite builder
    mentor.ts                   makeNoetherAvatar()
    bloch.ts                    makeBlochAvatar()
    bohr.ts                     makeBohrAvatar()
    boss.ts                      makeBossCrystal() -- gigantic multi-shard boss avatar at a world's goal
    tokens.ts                   makeToken() -- qumatoken pickup sprite
    attackEffects.ts            playAttackEffect() -- bolt/ring/burst particle effect per MoveClass
    colors.ts                   shade() and other color helpers
  audio/
    sfx.ts                      Procedural sound effects (attack/impact/playMentorChime)
    music.ts                    MusicEngine, per-scene tracks, duck() for attack beats
  data/
    types.ts                    Move, Material, MoveClass, MaterialType, CrystalVariant, Stats
    materials.ts                 MOVES, TYPE_LOOK, TYPE_CHART, WORLD_CRYSTALS, WORLD_RIVALS,
                                  PLAYER_MATERIAL, SHOP_MOVE_IDS, WORLD_NAMES, DEFAULT_STATS,
                                  getWildPool(), getRival(), effectiveness(), compatibleMoves(),
                                  canHost(), getPlayerMaterial(), getPlayerStats(), getBattleMoves(),
                                  enemyStatsForWorld(), statUpgradeCost(), findMaterialByName()
    tokens.ts                    Qumatoken value tiers + weights
    quiz.ts                      Per-material physics question pools (>=6 each)
    greetings.ts                 Per-MaterialType flavor lines (encounter/victory/defeat)
    materialdex.ts               Per-material (fallback per-type) physics blurb for Materialdex
    save.ts                      localStorage schema + persistFromRegistry()/load()
    tutorial.ts                    TUTORIAL_PAGES -- first-run/replayable tutorial popup copy
    settings.ts                    DENSITY_PRESETS/DEFAULT_ENCOUNTER_DENSITY -- wild-encounter density presets
data/materials.json            Repo-root design-time reference (fuller roster than materials.ts)
```

## Data model (`data/types.ts`, `data/materials.ts`)

- A **Material** is a crystal: `name`, `type` (`MaterialType`), `color`, `variant`
  (shard/cluster/prism), `maxHp`, `moves` (string ids into `MOVES`).
- The player is not a separate class -- `PLAYER_MATERIAL` is just one `Material` row (currently
  Silicon, `type: 'trivial'`). Its starting `moves` is the tutorial loadout; moves actually
  available in battle also depend on the registry's `unlockedMoves` (grows via Noether's shop).
- `WORLD_CRYSTALS: Record<world, Material[]>` -- wild-encounter pool per world, pulled via
  `getWildPool(world)`. `WORLD_RIVALS: Record<world, Material>` -- the one gating fight per
  world, pulled via `getRival(world)`.
- `MOVES: Record<id, Move>` -- every move is named after the quasiparticle that carries it
  (Phonon Beam, not "Thermal Attack"). `class: MoveClass` still drives the type chart and the
  attack-effect shape/color (`art/attackEffects.ts`'s `EFFECT_STYLE`).
- `TYPE_CHART` + `effectiveness(moveClass, defenderType)` -- draft, described in DESIGN.md
  section 3's table; not yet playtested. `canHost(defenderType, moveClass)` is a separate,
  narrower check (does the defender's own `MOVE_COMPATIBILITY` list include this class at
  all) that stacks on top of `effectiveness()` as BattleScene's 2x "quasiparticle mismatch"
  multiplier (DESIGN.md §4) -- don't conflate the two, they answer different questions.
- Per-type look lives in `TYPE_LOOK` (base color + variant, exported); individual compounds
  of the same type get `shade(color, shadeStep * 18)` so siblings (Iron vs. Cobalt) read as a
  family. `TitleScene`'s showcase cluster is the one consumer outside `data/materials.ts`
  itself so far.

## Cross-cutting patterns (reuse these, don't reinvent)

- **Registry-then-persist.** The Phaser registry (`this.registry`/`game.registry`) is the
  runtime source of truth every scene reads/writes; `data/save.ts`'s `persistFromRegistry()` is
  called after *every* mutation that should survive a reload (token pickup, move purchase, stat
  upgrade, rival defeat, battle outcome, transmutation) rather than only at fixed checkpoints.
  `TitleScene` is the only place that loads localStorage *into* the registry. Any new persistent
  state should follow this same registry-first, persist-on-mutation shape and get added to
  `data/save.ts`'s `SaveData`/`defaultSave()`/`persistFromRegistry()` together.
- **World sprites.** Wild-encounter crystals, qumatoken pickups, and every mentor's overworld
  avatar (Noether, Bloch, Bohr) all share one `WorldSprite` projection/wander/bob system in
  `OverworldScene` (`updateWorldSprites`) rather than bespoke per-kind code -- a new NPC should
  spawn through the same system (see `spawnNoetherSprite`/`spawnBlochSprite`/`spawnBohrSprite`
  as templates), not a new one-off.
- **Panel/dialogue UI.** Every overlay (wild encounter, mentor panels, rival gate, Hub's
  Materialdex/Save panels, the Enter-key menu) is the same dark rounded-rectangle-with-stroke
  treatment, with the stroke color signaling the panel's kind: blue-grey `0x444466` = wild
  encounter (`OverworldScene.showEncounter`) and the Enter-key menu/info panels (`0x8fa0c9`,
  a distinct blue-grey so it doesn't collide), gold `0xffe066` = Noether, teal `0x4adde0` =
  Bloch, amber `0xffa64a` = Bohr, red `0xff6666` = rival gate, purple `0x9a6ad9` = Hub's
  `showPanel` (Materialdex/Save). A new panel should pick a stroke color that doesn't collide
  with these.
- **Mentor avatars.** One builder per mentor in its own file: `art/mentor.ts`'s
  `makeNoetherAvatar()`, `art/bloch.ts`'s `makeBlochAvatar()`, `art/bohr.ts`'s
  `makeBohrAvatar()`. Never a shared parameterized builder -- each mentor needs to read as
  visually distinct.
- **Attack effects keyed by MoveClass**, not by move id -- adding/removing a move never touches
  `attackEffects.ts`, only adding/removing a whole `MoveClass` does (update `EFFECT_STYLE` in
  `art/attackEffects.ts`, `TYPE_CHART` in `data/materials.ts`, and `MOVE_COMPATIBILITY` in
  `data/materials.ts` together).
- **Discovery vs. defeat tracking.** Two separate registry/save lists, both excluding rivals
  (not real compounds): `discoveredMaterials` (`OverworldScene.recordDiscovery`, written on
  first wild *encounter*, feeds the Hub's Materialdex) and `defeatedMaterials`
  (`BattleScene.endBattle`, written on an ordinary wild *win*, feeds Bohr's transmutation
  panel). Don't conflate them -- a material can be encountered without being defeated.

## Current architecture (as of the 2026-08 stats/teleport/transmutation batch)

**Player form is no longer a constant.** `PLAYER_MATERIAL` (Silicon) is only the *default* --
the player's actual current crystal is `getPlayerMaterial(registry)` (`data/materials.ts`),
which reads registry/save key `playerForm` (a full `Material` or `null`). Every scene that
draws/sizes/types the player now goes through this instead of `PLAYER_MATERIAL` directly:
`BattleScene.playerMaterial`, `OverworldScene.playerMaterial`, `HubScene`'s crystal. Bohr's
`OverworldScene.transmuteInto(name)` is the only writer (`findMaterialByName` looks the target
up across `WORLD_CRYSTALS`, never `WORLD_RIVALS` -- rivals aren't real compounds).

**Move availability is an intersection, not a flat list.** `unlockedMoves` (registry/save)
stays a global "moves learned," unaffected by transmuting. What's actually offered in the
battle menu or Noether's shop is `getBattleMoves(registry)`/an inline `compatibleMoves(...)`
filter -- learned ∩ `compatibleMoves(currentForm)`, where `compatibleMoves` derives from
`MOVE_COMPATIBILITY: Record<MaterialType, MoveClass[]>` (`data/materials.ts`). Phonon Beam
(`thermal`) is the one class every type allows, so it's always available regardless of form.
There is no `disorderPulse`/`'disorder'` move or class anywhere in the codebase -- every move
is a real quasiparticle now.

**Stats** (`data/types.ts`'s `Stats`, `data/materials.ts`): `quantumness`/`velocity`/
`correlation`, base `10` each (`BASE_STAT`/`DEFAULT_STATS`). Player stats live in
registry/save key `playerStats`, grown via `OverworldScene.renderShopStats` (Noether's
"Stats" tab, cost `statUpgradeCost(current)` per +1 point). Opponent stats are never stored
per-material -- `enemyStatsForWorld(world)` computes them fresh at battle start
(`BattleScene.create`), scaling `+2` per stat per world past world 1. `BattleScene.resolveHit`
is the single damage-resolution function both sides' attacks go through (unified from the old
separate `playerAttack`/`opponentAttack` bodies): crit chance from the attacker's Quantumness,
turn order each round from comparing both sides' Velocity, incoming damage divided by the
defender's Correlation (`BASE_STAT / correlation`), and a `2x` "quasiparticle mismatch"
multiplier from `data/materials.ts`'s `canHost(defenderType, move.class)` -- a defender whose
own `MOVE_COMPATIBILITY` list doesn't include the attacking move's class takes it at double
force, stacked with `effectiveness()`'s own type-chart multiplier, not a replacement for it.

**Rival fights render the boss look in battle too.** `BattleScene.create` picks
`art/boss.ts`'s `makeBossCrystal` over the plain `makeCrystal` when `this.isRival`, sized
`BOSS_CRYSTAL_SIZE` and positioned at `BOSS_OPPONENT_POS` (both module constants) instead of
the wild encounter's `OPPONENT_POS` -- the instance field `this.opponentPos` tracks whichever
was actually used, and `resolveHit`'s attack-effect `from`/`to` read that field, not the
`OPPONENT_POS` constant directly, so bolts/rings/bursts still travel to the crystal's real
(possibly shifted) position.

**Battle move menu** is a real component now: `BattleScene.drawMoveMenu(moveIds)` builds a
docked `Container` (field `moveMenu`) on the right of the field from `getBattleMoves`, sized to
the current move count -- not individually positioned `Text` buttons.

**World progression generalized past worlds 1-2.** `HubScene.highestUnlockedWorld()` walks
`rivalDefeated` from world 1 until it finds a world not yet beaten, instead of a hardcoded
`?2:1`. `OverworldScene.tryAdvanceToNextWorld()`/`advanceToWorld(this.world + 1)` likewise use
`this.world + 1`, not a literal `2`. `WORLD_RIVALS` now has both a world-1 and world-2 entry;
`art/biomes.ts` now has a world-3 entry (`FLOATING_ISLANDS`) too. `BUILT_WORLDS = [1, 2, 3]`
(renamed from `TESTABLE_WORLDS`) is the single source of truth for "worlds with a walkable
map," used by both the dev Space-cycle shortcut and Bloch's teleport destination filter --
extend it (plus a biome entry) together whenever a new world's map gets built.
`OverworldScene.recordVisit()`/`getVisitedWorlds()` track registry/save key `visitedWorlds`
(distinct from `rivalDefeated` -- you can visit a world without beating its rival), written
once per world the first time that world's scene is created.

**New mentors follow the established one-file-per-avatar pattern**: `art/bloch.ts`'s
`makeBlochAvatar` (a wireframe Bloch-sphere head, teal) and `art/bohr.ts`'s `makeBohrAvatar`
(a Bohr-model-atom head, amber), alongside `art/mentor.ts`'s `makeNoetherAvatar`, and one file
per mentor from Dirac onward too. Every mentor now spawns through one unified
`OverworldScene.spawnMentorSprite` (looked up from the `WORLD_MENTORS` table), not a bespoke
`spawnXSprite` per mentor. All three (all nine, now) share one chime, `playMentorChime()` in
`audio/sfx.ts`.

**Every mentor stands mid-corridor, not at the goal or start.** `MentorDef.tile` is
`'goal' | 'start' | 'middle'`, but every current `WORLD_MENTORS` entry uses `'middle'` --
`world/mapgen.ts`'s `generateWorldMap` computes a `mid: GridPoint` (roughly the corridor's
halfway row) alongside `start`/`goal`, threaded through `OverworldScene.midTile` and
`SavedMapState` the same way `goalTile`/`startTile` already were. Reaching that row
(`OverworldScene.maybeReachMiddle`, mirroring `maybeReachGoal`'s "whole row counts, not one
tile" rule) sets `reachedMiddle` and calls `maybeAutoOpenMiddleDialogue()` -- the direct
counterpart to `maybeAutoOpenGoalDialogue()`/`maybeReachGoal`, both still used for the goal
tile's own panel. `'start'`/`'goal'` remain valid `tile` values (and `spawnMentorSprite`'s
tile-lookup still branches on all three) purely so a future mentor could choose them; nothing
currently does.

**The goal tile now belongs to that world's boss, not a mentor.** `OverworldScene
.spawnBossSprite` spawns `art/boss.ts`'s `makeBossCrystal` (a fused multi-shard cluster +
pulsing aura + orbiting embers, `BOSS_CRYSTAL_SIZE = 70`) at `goalTile` for every built
world's `getRival()` -- purely a visual landmark via the same `WorldSprite` machinery, no
click handler of its own. `openGoalMentorPanel()`'s branch on `mentor?.tile === 'goal'` is
now permanently a no-op (no entry uses it) so it always falls through to `showGatePanel()`,
which is what actually renders at the goal now that no mentor does.

**Progression (Face the Rival/Continue) is exclusive to the goal panel.** `renderShopFooter`
(Farewell + Face-the-Rival/Continue, `showGatePanel`'s only caller) and the new
`renderFarewellFooter` (Farewell only) are siblings -- every mid-corridor mentor panel
(`showNoetherShop`'s two tabs, `showBlochHub`, `showMentorLore`; `showBohrPanel` already had
its own plain Farewell button) calls `renderFarewellFooter`, never `renderShopFooter`. This
split matters: before it existed, a mentor panel reachable mid-corridor also carried the
Face-the-Rival button, letting the player trigger that world's boss fight without ever
walking to (or seeing) the goal. If a future mentor panel needs a progression action, route
it through `showGatePanel`, not by reaching for `renderShopFooter` directly.

**Enter-key pause menu** (`OverworldScene.togglePauseMenu`/`showPauseMenu`/`showInfoPanel`):
follows the existing `dialogueContainer`/`dialogueActive`/`closeDialogue()` overlay convention,
gated so it can't open over another panel. Lives only in `OverworldScene`, not `BattleScene` or
`HubScene`. `showPauseMenu`'s rows are a data-driven array (label + onClick) rather than
hand-placed buttons specifically so the debug-only "Warp" row (see below) can be spliced in
without recomputing every other button's y position -- follow that pattern for any future
conditional row rather than reverting to fixed positions.

**Save schema** (`data/save.ts`'s `SaveData`) gained seven fields alongside the pre-existing
ones: `playerStats: Stats`, `visitedWorlds: number[]`, `defeatedMaterials: DiscoveredMaterial[]`
(written by `BattleScene.endBattle` on an ordinary wild win, same "not for rivals" rule as
`discoveredMaterials`), `playerForm: Material | null`, `tutorialSeen: boolean`, `debugMode:
boolean`, `encounterDensity: number` (one of `data/settings.ts`'s `DENSITY_PRESETS`, set via
the Enter-menu's Settings panel). `defaultSave()`/`persistFromRegistry()` are still the two
places that need touching together for any future field, and `loadSave()`'s
`{ ...defaultSave(), ...saved }` spread keeps old localStorage saves compatible for free.

**Tutorial popups** (`data/tutorial.ts`'s `TUTORIAL_PAGES`, `OverworldScene.showTutorial`/
`renderTutorialPage`/`maybeShowFirstTimeTutorial`): a paged overlay using the same
`dialogueContainer`/`addDialogueButtonAt` overlay convention as every other panel, stroked a
fresh cyan (`0x5ad9ff`, see `STYLE.md`) not used elsewhere. `showTutorial(startIndex)` always
resets `tutorialIndex` and re-renders; Back/Next mutate `tutorialIndex` and call
`renderTutorialPage()` again rather than rebuilding the whole scene. To add/edit a page, only
`data/tutorial.ts` needs touching -- the paging/panel code reads its length generically.

**Debug Mode** (save/registry `debugMode`, toggled on `TitleScene`'s title screen via
`addDebugToggle`): a testing/exploration aid, not part of normal progression.
`OverworldScene.applyDebugLeveling()` runs on every `create()` (covers Space-cycle, Continue,
Bloch teleport, and an explicit debug warp alike) and re-levels `playerStats` to
`enemyStatsForWorld(this.world)` plus a flat `+2`, grants every move
(`Object.keys(MOVES)`), and fully heals. World access while debug mode is on bypasses
`rivalDefeated` entirely via two separate warp panels that both jump straight to any of the 10
worlds: `HubScene.showWorldSelectPanel` (replaces the door's normal `enterWorld()` when
`isDebugMode()`) and `OverworldScene.showDebugWarpPanel` (an extra pause-menu row, for
mid-run use without backtracking to the Hub). Both are stroked magenta (`0xff4fd8`/`0xff5a7a`
label tint) to read as clearly non-diegetic, distinct from every mentor/dialogue panel color.

## How to use this file

Before touching `video_game/game/src/`, read this file (and the relevant section of
`DESIGN.md`/`STYLE.md`) instead of re-exploring the tree. If you learn something mid-task that
would have saved a file read -- an exact function name, a pattern you had to reverse-engineer,
a gotcha in how two files interact -- add it here before you forget it, in the section it best
fits. Keep entries about *structure and pattern*, not a changelog of specific past edits (that's
what git history is for).
